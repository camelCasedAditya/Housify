import { useEffect } from "react";
import { useProject } from "../store/project";
import FloorplanCanvas from "../components/FloorplanCanvas";
import ChatPanel from "../components/ChatPanel";
import VersionPanel from "../components/VersionPanel";

export default function PhaseFloorplan() {
  const doc = useProject((s) => s.phaseDoc.floorplan);
  const reloadPhase = useProject((s) => s.reloadPhase);

  useEffect(() => { reloadPhase("floorplan"); }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", height: "100%" }}>
      <div style={{ position: "relative", padding: "0.75rem" }}>
        {doc?.doc ? (
          <FloorplanCanvas doc={doc.doc} />
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#a0a8b8" }}>
            Generating floor plan…
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateRows: "1fr auto" }}>
        <ChatPanel phase="floorplan" />
        <VersionPanel phase="floorplan" />
      </div>
    </div>
  );
}
