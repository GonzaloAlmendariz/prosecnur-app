// Glifos de las marcas de cada pregunta (riel «Señales», 2026-10-17), portados de la propuesta aprobada.
// Mismo formato que los glifos de tipo (glifosTipo.ts).

import type { Glifo } from "./glifosTipo";

export type ClaveMarca = "oblig" | "cond" | "hered" | "regla" | "calc" | "filtro" | "repite";

export const GLIFOS_MARCA: Readonly<Record<ClaveMarca, Glifo>> = {
  oblig: [{e:"circle",c:"a",a:{cx:"12",cy:"12",r:"9"}},{e:"path",c:"k",a:{d:"M12 6.8v10.4M7.5 9.4l9 5.2M16.5 9.4l-9 5.2"}}],
  cond: [{e:"path",c:"t",a:{d:"M12 21.5v-6.8M12 14.7C12 10.4 6.6 10 6.6 5.6M12 14.7c0-4.3 5.4-4.7 5.4-9.1"}},{e:"path",c:"a",a:{d:"M6.6 1.8l3.2 4.4H3.4zM17.4 1.8l3.2 4.4h-6.4z"}}],
  hered: [{e:"rect",c:"t",a:{x:"2.2",y:"2.2",width:"19.6",height:"19.6",rx:"4.4"}},{e:"path",c:"t",a:{d:"M12 18.4v-4.2M12 14.2c0-2.8-3.6-3-3.6-5.8M12 14.2c0-2.8 3.6-3 3.6-5.8"}},{e:"path",c:"a",a:{d:"M8.4 5.2l2.1 2.9H6.3zM15.6 5.2l2.1 2.9h-4.2z"}}],
  regla: [{e:"path",c:"a",a:{d:"M12 2.6l8.4 3.2v6c0 5.2-3.6 8.6-8.4 9.6-4.8-1-8.4-4.4-8.4-9.6v-6z"}},{e:"path",c:"k",a:{d:"M8.2 12.2l2.6 2.6 5-5.4"}}],
  calc: [{e:"text",a:{x:"11.6",y:"17.4",textAnchor:"middle",fontSize:"15",fontStyle:"italic"},texto:"ƒx"}],
  filtro: [{e:"path",c:"a",a:{d:"M3 4.4h18l-7 8.4V20l-4-2v-5.2z"}}],
  repite: [{e:"path",c:"t",a:{d:"M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3"}}],
};
