import type { MonitoreoFamilyModule } from "../types";

const acreditacionProfile: MonitoreoFamilyModule = {
  family: "acreditacion",
  chunk: "monitoreo-acreditacion",
  label: "Acreditacion",
  views: ["fuentes", "modelo", "consultas", "telefonico", "avance"],
  loadPage: () => import("./AcreditacionMonitoreoPage"),
  warmupScopes: ["source", "advance_summary", "queries_summary", "phone_summary"],
  reportScopes: {
    fuentes: "source",
    consultas: "queries_summary",
    telefonico: "phone_summary",
    avance: "advance_summary",
  },
};

export default acreditacionProfile;
