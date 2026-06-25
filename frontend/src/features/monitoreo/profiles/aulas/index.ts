import type { MonitoreoFamilyModule } from "../types";

const aulasProfile: MonitoreoFamilyModule = {
  family: "aulas_universitarias",
  chunk: "monitoreo-aulas",
  label: "Aulas universitarias",
  views: ["fuentes", "modelo", "avance", "calidad", "consultas"],
  loadPage: () => import("./AulasMonitoreoPage"),
  warmupScopes: ["source", "advance_summary", "validation_summary", "queries_summary"],
  reportScopes: {
    fuentes: "source",
    modelo: "source",
    avance: "advance_summary",
    calidad: "validation_summary",
    consultas: "queries_summary",
  },
};

export default aulasProfile;
