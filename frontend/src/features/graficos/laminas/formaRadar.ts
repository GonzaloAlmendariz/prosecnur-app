// Qué dibuja de verdad el motor para un `p_radar` entre públicos (modo «publicos»). Réplica pura de `.radar_mb_forma`
// (api/R/graficos_radar_multibase.R; `.RADAR_MIN_CRITERIOS` = 5, `.RADAR_MAX_CRITERIOS` = 8) y de la regla de `tabla`
// (graficos_radar_tabla.R `.radar_mb_tabla_procede`: con «Automática», tabla junto al radar y a las líneas y puntos; con
// barras, no). La maqueta y la nota de la tarjeta leen de aquí; si el motor cambia la regla, cambia aquí también.

export const RADAR_MIN_CRITERIOS = 5;
export const RADAR_MAX_CRITERIOS = 8;

export type FormaDibujada = "radar" | "puntos" | "barras";
export type EntradaForma = {
  forma?: unknown; fallback_pocos?: unknown; tabla?: unknown;
  /** Entradas de `vars` (un criterio cada una). */
  nCriterios: number;
};
export type FormaEfectiva = { forma: FormaDibujada; conTabla: boolean; nota: string | null; aviso: string | null };

const NOMBRE: Record<FormaDibujada, string> = { radar: "radar", puntos: "líneas y puntos", barras: "barras comparativas" };

/** Cantidad de criterios del radar: las entradas de `vars` (lista nombrada por criterio, o lista simple). */
export function criteriosDelRadar(args: Readonly<Record<string, unknown>>): number {
  const v = args.vars;
  if (Array.isArray(v)) return v.length;
  return v && typeof v === "object" ? Object.keys(v).length : 0;
}

export function formaEfectivaRadar(e: EntradaForma): FormaEfectiva {
  const n = e.nCriterios;
  const pedida = e.forma === "puntos" || e.forma === "radar" || e.forma === "barras" ? e.forma : "auto";
  const fallback: FormaDibujada = e.fallback_pocos === "barras" ? "barras" : "puntos";
  const tabla = e.tabla === "si" || e.tabla === "no" ? e.tabla : "auto";
  // Sin criterios elegidos no hay nada que contar: el dibujo de siempre.
  if (n <= 0) return { forma: "radar", conTabla: tabla !== "no", nota: null, aviso: null };

  let forma: FormaDibujada;
  let nota: string | null = null;
  if (pedida === "auto") {
    if (n >= RADAR_MIN_CRITERIOS) forma = "radar";
    else {
      forma = fallback;
      nota = `Se dibujará como ${NOMBRE[forma]}: este radar tiene ${n} ${n === 1 ? "criterio" : "criterios"} (el radar pide ${RADAR_MIN_CRITERIOS} a ${RADAR_MAX_CRITERIOS})`;
    }
  } else forma = pedida;

  let aviso: string | null = null;
  if (n > RADAR_MAX_CRITERIOS) aviso = `Con más de ${RADAR_MAX_CRITERIOS} criterios el gráfico se lee mal`;
  else if (pedida === "radar" && n < 3) aviso = "Con menos de 3 criterios el radar no se puede dibujar";
  else if (pedida === "radar" && n < RADAR_MIN_CRITERIOS) aviso = `Con ${n} criterios el radar queda como ${n === 3 ? "triángulo" : "rombo"}`;

  const conTabla = tabla === "si" ? true : tabla === "no" ? false : forma !== "barras";
  return { forma, conTabla, nota, aviso };
}

/** Rótulo de la opción «Automática» de la tabla: con barras, que no llevan tabla, no promete ninguna. */
export function rotuloTablaAuto(forma: FormaDibujada, rotulo: string): string {
  return forma !== "barras" ? rotulo : rotulo.split(":")[0];
}
