// El corte que todavía no existe.
//
// Los perfiles de acreditación y telefónico renderizan sus secciones a partir
// del último corte (`state.dashboard.acreditacion_reports`). Mientras no hay
// corte ese objeto es `null`, y la página cortaba en seco: cualquier sección
// devolvía «Resumen pendiente».
//
// Para casi todas las secciones eso es correcto —Avance, Llamadas y Consultas
// no tienen nada que decir sin cifras—. Para Fuentes es un candado: el corte
// sale de sincronizar las fuentes, y las fuentes se conectan en Fuentes. Un
// estudio recién abierto quedaba sin puerta de entrada: 0/3 fuentes, «Sin
// corte» y un panel vacío donde tenía que estar el botón de conectar.
//
// Fuentes se monta entonces con este corte neutro. No finge datos —cero hojas,
// cero reportes, sin fecha—: solo evita que la ausencia del corte borre la
// única superficie que sabe producirlo.

import type { MonitoreoAcreditacionReports } from "../../../api/monitoreo";

export const CORTE_VACIO: MonitoreoAcreditacionReports = {
  schema: "apps_script_acreditacion_v1",
  generated_at: "",
  reference_tabs: [],
  internal_queries: null,
  client_report: null,
  sheets: [],
};
