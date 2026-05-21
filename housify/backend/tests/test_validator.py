"""Quick sanity tests for the floor plan validator. Run via `python manage.py test tests`."""
import django
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ecc.settings")
django.setup()

from django.test import SimpleTestCase
from floorplan.validator import validate_and_normalize


class ValidatorTests(SimpleTestCase):
    def test_simple_rect_room(self):
        doc = {
            "rooms": [{"id": "r1", "name": "living", "polygon": [[0, 0], [5, 0], [5, 4], [0, 4]]}],
            "openings": [],
            "roof": {"style": "gable", "pitch_deg": 30},
            "wall_height": 2.7,
            "wall_thickness": 0.15,
        }
        out = validate_and_normalize(doc)
        self.assertEqual(out["bbox"], [5.0, 4.0])
        self.assertEqual(out["validation"]["errors"], [])

    def test_overlap_warning(self):
        doc = {
            "rooms": [
                {"id": "r1", "name": "a", "polygon": [[0, 0], [4, 0], [4, 4], [0, 4]]},
                {"id": "r2", "name": "b", "polygon": [[2, 2], [6, 2], [6, 6], [2, 6]]},
            ],
            "openings": [],
            "roof": {"style": "gable", "pitch_deg": 30},
            "wall_height": 2.7, "wall_thickness": 0.15,
        }
        out = validate_and_normalize(doc)
        self.assertTrue(any("overlap" in w for w in out["validation"]["warnings"]))

    def test_opening_on_wall(self):
        doc = {
            "rooms": [{"id": "r1", "name": "x", "polygon": [[0, 0], [5, 0], [5, 4], [0, 4]]}],
            "openings": [{
                "id": "d1", "kind": "door", "wall_segment": {"a": [0, 0], "b": [5, 0]},
                "offset": 1.5, "width": 0.9, "height": 2.1, "sill": 0.0,
            }],
            "roof": {"style": "gable", "pitch_deg": 30},
            "wall_height": 2.7, "wall_thickness": 0.15,
        }
        out = validate_and_normalize(doc)
        self.assertEqual(out["validation"]["warnings"], [])


class NonRectangularTests(SimpleTestCase):
    def test_l_shape_room_no_errors(self):
        # L-shape (concave) polygon — 6 vertices forming an "L"
        doc = {
            "rooms": [{"id": "l1", "name": "great", "polygon": [
                [0, 0], [6, 0], [6, 3], [3, 3], [3, 5], [0, 5]
            ]}],
            "openings": [],
            "roof": {"style": "gable", "pitch_deg": 30},
            "wall_height": 2.7, "wall_thickness": 0.15,
        }
        out = validate_and_normalize(doc)
        self.assertEqual(out["validation"]["errors"], [])
        self.assertEqual(out["bbox"], [6.0, 5.0])

    def test_l_shape_plus_filler_no_overlap_warning(self):
        # L-shaped room A whose notch is exactly filled by rectangular room B.
        # Validator must NOT flag this as overlapping.
        doc = {
            "rooms": [
                {"id": "a", "name": "l", "polygon": [
                    [0, 0], [6, 0], [6, 3], [3, 3], [3, 5], [0, 5]
                ]},
                {"id": "b", "name": "filler", "polygon": [
                    [3, 3], [6, 3], [6, 5], [3, 5]
                ]},
            ],
            "openings": [],
            "roof": {"style": "gable", "pitch_deg": 30},
            "wall_height": 2.7, "wall_thickness": 0.15,
        }
        out = validate_and_normalize(doc)
        self.assertFalse(
            any("overlap" in w for w in out["validation"]["warnings"]),
            f"unexpected overlap warning: {out['validation']['warnings']}",
        )

    def test_angled_wall_opening(self):
        # Pentagon-ish room with an angled (diagonal) wall hosting a window.
        doc = {
            "rooms": [{"id": "p", "name": "p", "polygon": [
                [0, 0], [5, 0], [5, 3], [3.5, 4.2], [0, 4.2]
            ]}],
            "openings": [{
                "id": "w1", "kind": "window",
                "wall_segment": {"a": [5, 3], "b": [3.5, 4.2]},
                "offset": 0.3, "width": 0.8, "height": 1.2, "sill": 0.9,
            }],
            "roof": {"style": "gable", "pitch_deg": 30},
            "wall_height": 2.7, "wall_thickness": 0.15,
        }
        out = validate_and_normalize(doc)
        self.assertEqual(out["validation"]["warnings"], [])
        self.assertEqual(out["validation"]["errors"], [])
