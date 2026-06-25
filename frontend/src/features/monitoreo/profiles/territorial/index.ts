import type { MonitoreoFamilyModule } from "../types";

const territorialProfile: MonitoreoFamilyModule = {
  family: "territorial",
  chunk: "monitoreo-territorial",
  label: "Territorial",
  views: ["fuentes", "modelo", "calidad", "consultas", "avance", "ocurrencias"],
  loadPage: () => import("./TerritorialMonitoreoPage"),
  warmupScopes: ["source", "route_summary", "validation_summary", "advance_summary", "queries_summary"],
  reportScopes: {
    fuentes: "source",
    modelo: "route_summary",
    avance: "advance_summary",
    calidad: "validation_summary",
    consultas: "queries_summary",
    ocurrencias: "queries_summary",
  },
};

export default territorialProfile;
