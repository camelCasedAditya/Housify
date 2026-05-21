import { create } from "zustand";
import { api, PhaseDoc, Phase } from "../lib/api";

interface ProjectState {
  projectId: string | null;
  phaseDoc: Record<Phase, PhaseDoc | null>;
  loading: boolean;
  setProjectId: (id: string) => void;
  reloadPhase: (phase: Phase) => Promise<void>;
  setPhaseDoc: (phase: Phase, pd: PhaseDoc | null) => void;
}

export const useProject = create<ProjectState>((set, get) => ({
  projectId: null,
  phaseDoc: { floorplan: null, scene3d: null, furnish: null },
  loading: false,
  setProjectId: (id) => set({ projectId: id }),
  setPhaseDoc: (phase, pd) =>
    set((s) => ({ phaseDoc: { ...s.phaseDoc, [phase]: pd } })),
  reloadPhase: async (phase) => {
    const id = get().projectId;
    if (!id) return;
    set({ loading: true });
    try {
      const pd = await api.getPhase(id, phase);
      set((s) => ({ phaseDoc: { ...s.phaseDoc, [phase]: pd } }));
    } catch {
      set((s) => ({ phaseDoc: { ...s.phaseDoc, [phase]: null } }));
    } finally {
      set({ loading: false });
    }
  },
}));
