import type { MonitoreoFamilyModule } from "../types";

const telefonicoProfile: MonitoreoFamilyModule = {
  family: "telefonico",
  chunk: "monitoreo-telefonico",
  label: "Telefónico",
  views: ["fuentes", "modelo", "consultas", "telefonico", "avance"],
  loadPage: () => import("./TelefonicoMonitoreoPage"),
  warmupScopes: ["source", "advance_summary", "queries_summary", "phone_summary"],
  reportScopes: {
    fuentes: "source",
    modelo: "advance_summary",
    consultas: "queries_summary",
    telefonico: "phone_summary",
    avance: "advance_summary",
  },
};

export default telefonicoProfile;
