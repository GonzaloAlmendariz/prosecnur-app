// mermaDeRespuestas.ts — de las respuestas que llegaron, cuáles cuentan y por
// qué no las demás. UNA regla para dos superficies.
//
// A2 (loop estética-aulas-sheets, 2026-09-07). La tarjeta «Respuestas leídas»
// (kpisDeAulas.ts) decía «273» a secas y el embudo (embudoDelOperativo.ts), en
// la misma pantalla, restaba «37 fuera del operativo · 24 no pasan el
// criterio»: dos lecturas de la misma cifra, cada una con su cuenta. Ahora las
// dos leen de aquí.
//
// La regla, que el embudo ya había fijado y que se conserva tal cual:
//
// - **La merma es la diferencia entre recibidas y efectivas**, no otra cuenta.
//   `filter_rejected` del motor mira una columna llamada `consent`/`apto`/…
//   si existe, no la cadena de filtros declarada, y en HSVG2026 dio 174 donde
//   el embudo mostraba 67. Restar las dos etapas la hace cierta por
//   construcción.
// - **De esa merma, lo que no era del estudio se separa.** Las filas que
//   llegaron por el QR de capacitación o de prueba (`respuestas_fuera_del_operativo`)
//   no son del operativo y no hay nada que arreglar; las que sí salieron de un
//   curso-horario y no pasan el criterio son lo único sobre lo que el campo
//   puede actuar. El primer día de HSVG2026 eran 37 y 24.

/** Las claves del bloque `kpis` del tablero que esta regla necesita. */
export type CifrasDeRespuestas = {
  respuestas_total?: number | null;
  respuestas_validas?: number | null;
  respuestas_fuera_del_operativo?: number | null;
};

/** Un conteo no negativo, o 0 cuando la cifra no es un número. */
export const entero = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
};

export type MermaDeRespuestas = {
  /** Todas las filas que llegaron de la plataforma, del estudio o no. */
  recibidas: number;
  /** Las que pasan el criterio de efectividad. */
  efectivas: number;
  /** recibidas − efectivas. */
  rechazadas: number;
  /** De las rechazadas, las del QR de capacitación o de prueba. */
  fueraDelOperativo: number;
  /** De las rechazadas, las que sí eran de un aula y no pasan el criterio. */
  noPasanElCriterio: number;
};

export function mermaDeRespuestas(c: CifrasDeRespuestas | null | undefined): MermaDeRespuestas {
  const cifras = c ?? {};
  const recibidas = entero(cifras.respuestas_total);
  const efectivas = entero(cifras.respuestas_validas);
  const rechazadas = Math.max(0, recibidas - efectivas);
  const fueraDelOperativo = Math.min(rechazadas, entero(cifras.respuestas_fuera_del_operativo));
  const noPasanElCriterio = Math.max(0, rechazadas - fueraDelOperativo);
  return { recibidas, efectivas, rechazadas, fueraDelOperativo, noPasanElCriterio };
}
