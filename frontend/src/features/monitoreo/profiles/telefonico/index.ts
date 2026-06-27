import type { MonitoreoFamilyModule } from "../types";

const telefonicoProfile: MonitoreoFamilyModule = {
  family: "telefonico",
  chunk: "monitoreo-telefonico",
  label: "Telefónico",
  views: ["telefonico", "avance", "modelo", "fuentes"],
  loadPage: () => import("./TelefonicoMonitoreoPage"),
  warmupScopes: ["source", "advance_summary"],
  reportScopes: {
    fuentes: "source",
    modelo: "source",
    telefonico: "full",
    avance: "advance_summary",
  },
};

export default telefonicoProfile;
