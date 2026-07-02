import type { MonitoreoFamilyModule } from "../types";

const telefonicoProfile: MonitoreoFamilyModule = {
  family: "telefonico",
  chunk: "monitoreo-telefonico",
  label: "Telefónico",
  views: ["fuentes", "modelo", "telefonico", "consultas", "avance"],
  loadPage: () => import("./TelefonicoMonitoreoPage"),
  warmupScopes: ["source", "phone_summary"],
  reportScopes: {
    fuentes: "source",
    modelo: "phone_summary",
    telefonico: "phone_summary",
    consultas: "queries_summary",
    avance: "advance_summary",
  },
};

export default telefonicoProfile;
