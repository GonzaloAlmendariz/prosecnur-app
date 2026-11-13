/**
 * El detalle de casos de una regla, entero (ítem 22 del checklist de
 * validación del practicante).
 *
 * El motor publica el detalle por páginas (`desde`, `limite`) con
 * `n_casos_total`, los casos que la regla marca en la auditoría de la base
 * pedida. Antes llegaban solo los primeros 500 y la tabla, el caso y la
 * Decisión decían "500" en una regla de 853. Aquí se piden las páginas que
 * faltan y se unen en un solo detalle: `casos`, `case_ids`, `esperado`,
 * `contexto_por_caso` y `coincide_con` siguen paralelos por posición.
 */
import type { InstrumentoDrillResult } from "../../../api/validacion";

export const CASOS_POR_PAGINA = 2000;

type PedirPagina = (pagina?: { desde: number; limite: number }) => Promise<InstrumentoDrillResult>;

const PARALELOS = ["case_ids", "esperado", "contexto_por_caso", "coincide_con"] as const;

/** Los casos que la regla marca: el total del motor o, si no lo trae, los que llegaron. */
export function totalDeCasos(drill: InstrumentoDrillResult | null): number | null {
  if (!drill) return null;
  const total = drill.n_casos_total;
  return typeof total === "number" && Number.isFinite(total) ? total : drill.casos?.length ?? 0;
}

/** Une páginas consecutivas del detalle en una sola respuesta. */
export function unirPaginasDelDetalle(paginas: readonly InstrumentoDrillResult[]): InstrumentoDrillResult {
  const [primera, ...resto] = paginas;
  if (!primera) throw new Error("No llegó ninguna página del detalle de casos.");
  if (!resto.length) return primera;
  const unido: Record<string, unknown> = { ...primera, casos: paginas.flatMap((p) => p.casos ?? []) };
  for (const campo of PARALELOS) {
    const listas = paginas.map((p) => (p as unknown as Record<string, unknown>)[campo]);
    // Un campo que no viene como lista en alguna página (por ejemplo,
    // `coincide_con` fuera de la regla de casi iguales) queda como en la primera.
    if (listas.every(Array.isArray)) unido[campo] = (listas as unknown[][]).flat();
  }
  const ultima = paginas[paginas.length - 1]!;
  unido.hay_mas = ultima.hay_mas ?? false;
  unido.desde = primera.desde ?? 0;
  unido.limite = (unido.casos as unknown[]).length;
  return unido as unknown as InstrumentoDrillResult;
}

/**
 * Pide la primera página tal como antes (sin `desde` ni `limite`) y, si la
 * regla marca más casos, las siguientes, hasta tenerlos todos. Si una página
 * llega vacía antes del total, falla con la causa en vez de quedarse corta.
 */
export async function cargarDetalleCompleto(pedir: PedirPagina, porPagina = CASOS_POR_PAGINA): Promise<InstrumentoDrillResult> {
  const primera = await pedir();
  const total = totalDeCasos(primera) ?? 0;
  const paginas: InstrumentoDrillResult[] = [primera];
  let cargados = primera.casos?.length ?? 0;
  let hayMas = primera.hay_mas === true;
  while (hayMas && cargados < total) {
    const pagina = await pedir({ desde: cargados, limite: porPagina });
    const n = pagina.casos?.length ?? 0;
    if (!n) {
      throw new Error(`El detalle de la regla trajo ${cargados} de ${total} casos: la página desde el caso ${cargados + 1} llegó vacía.`);
    }
    paginas.push(pagina);
    cargados += n;
    hayMas = pagina.hay_mas === true;
  }
  return unirPaginasDelDetalle(paginas);
}
