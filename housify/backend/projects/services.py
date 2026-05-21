"""Shared helpers for working with projects, phase docs and chat turns."""
from typing import Optional
from django.db import transaction
from .models import Project, PhaseDoc


def get_current_doc(project: Project, phase: str) -> Optional[PhaseDoc]:
    return (
        PhaseDoc.objects.filter(project=project, phase=phase)
        .order_by("-version")
        .first()
    )


@transaction.atomic
def save_new_version(project: Project, phase: str, doc: dict, parent_version: Optional[int] = None) -> PhaseDoc:
    last = get_current_doc(project, phase)
    next_version = (last.version + 1) if last else 1
    pd = PhaseDoc.objects.create(
        project=project,
        phase=phase,
        version=next_version,
        doc=doc,
        parent_version=parent_version if parent_version is not None else (last.version if last else None),
    )
    return pd
