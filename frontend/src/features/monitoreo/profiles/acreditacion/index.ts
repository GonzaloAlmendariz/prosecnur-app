import type { MonitoreoFamilyModule } from "../types";

const acreditacionProfile: MonitoreoFamilyModule = {
  family: "acreditacion",
  chunk: "monitoreo-acreditacion",
  label: "Acreditacion",
  views: ["fuentes", "modelo", "consultas", "telefonico", "avance"],
  // Mantener acreditación en la experiencia canónica completa de Monitoreo,
  // la misma superficie donde vive territorial.
  loadPage: () => import("../../MonitoreoPage"),
  warmupScopes: ["source", "advance_summary", "queries_summary"],
  reportScopes: {
    fuentes: "source",
    consultas: "queries_summary",
    telefonico: "full",
    avance: "advance_summary",
  },
};

export default acreditacionProfile;
