import type { MonitoreoAulasDashboard, MonitoreoRow } from "../../../../../api/monitoreo";
import { cintaDeMetas } from "../metasDeLaPestana";
import { fmt } from "../kpisDeAulas";
import { proyeccionElegida } from "../proyeccionDeMetas";

/**
 * Modelo › Metas (ficha M1, `docs/qa/revamp-monitoreo/aulas.md`; F5 del ADR
 * 0121). ¿Contra qué se mide el avance? Lo que el diseño prometió, leído de la
 * representatividad declarada (universo, variables y celdas): la tabla no
 * asume «facultad × sexo», se arma con las variables que el estudio declara
 * (facultad × sexo en HSVG, nivel en CCSS).
 *
 * Solo lectura: la meta se edita en Cálculo de muestra.
 */

export type ColumnaDeCuota = { valor: string; etiqueta: string };

export type FilaDeCuota = {
  clave: string;
  etiqueta: string;
  /** Cuota por categoría de la segunda variable, en el orden de `columnas`. */
  porColumna: Array<number | null>;
  cuota: number;
  tasa: string;
  /** Titulares, elegibles y esperadas del plan; `null` si la variable no es del aula. */
  titulares: number | null;
  elegibles: number | null;
  esperadas: number | null;
};

export type ModeloMetas =
  | { estado: "sin-tablero" }
  | { estado: "sin-diseno"; causa: string }
  | {
    estado: "listo";
    franja: Array<{ clave: string; rotulo: string; valor: string; sub: string }>;
    universo: string;
    variables: string[];
    origen: string;
    columnas: ColumnaDeCuota[];
    filas: FilaDeCuota[];
    total: { cuota: number; titulares: number | null; elegibles: number | null; esperadas: number | null };
    /** «Las esperadas de los titulares cubren el 126 % de la cuota». */
    cobertura: string | null;
    /** El diseño cambió después del corte: se dice con su salida. */
    desfasado: string | null;
  };

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

function pct(proporcion: number | null | undefined): string {
  if (proporcion == null || !Number.isFinite(proporcion)) return "—";
  const p = proporcion > 1 ? proporcion : proporcion * 100;
  return `${p.toFixed(1)} %`;
}

const ORIGEN: Record<string, string> = {
  planner: "Universo y variables del Planner; cuotas del diseño en Cálculo de muestra",
  diseno: "Del diseño en Cálculo de muestra",
  traducida_v1: "Del diseño en Cálculo de muestra (contrato anterior)",
};

/** El valor de la primera variable en una fila del plan, cuando la variable es del aula. */
function valorEnElPlan(fila: MonitoreoRow, clave: string): string {
  if (clave === "facultad") return texto(fila.faculty ?? fila.facultad);
  return texto(fila[clave]);
}

export function construirMetas(dashboard: MonitoreoAulasDashboard | null): ModeloMetas {
  if (!dashboard) return { estado: "sin-tablero" };
  const rep = dashboard.representatividad_declarada;
  if (!rep || !rep.variables?.length || !rep.celdas?.length) {
    return { estado: "sin-diseno", causa: "El estudio todavía no tiene metas del diseño: se fijan en Cálculo de muestra." };
  }
  const [primera, segunda] = rep.variables;
  const columnas: ColumnaDeCuota[] = segunda
    ? (segunda.categorias ?? []).map((c) => ({ valor: c.valor, etiqueta: c.etiqueta || c.valor }))
    : [];

  // Titulares, elegibles y esperadas por categoría, sólo si la variable es del aula.
  const delAula = (primera.atribucion ?? "aula") === "aula";
  const titulares = ((dashboard.agenda ?? []) as MonitoreoRow[]).filter((f) => texto(f.sample_role).toLowerCase() === "titular");
  const porCategoria = new Map<string, { titulares: number; elegibles: number; esperadas: number }>();
  if (delAula) {
    for (const f of titulares) {
      const v = valorEnElPlan(f, primera.clave);
      const g = porCategoria.get(v) ?? { titulares: 0, elegibles: 0, esperadas: 0 };
      g.titulares += 1;
      g.elegibles += n(f.eligible_n);
      g.esperadas += n(f.expected_valid);
      porCategoria.set(v, g);
    }
  }

  const categorias = primera.categorias?.length
    ? primera.categorias.map((c) => ({ valor: c.valor, etiqueta: c.etiqueta || c.valor }))
    : [...new Set(rep.celdas.map((c) => c.valores[primera.clave]))].map((v) => ({ valor: v, etiqueta: v }));

  const filas: FilaDeCuota[] = categorias.map((cat) => {
    const suyas = rep.celdas.filter((c) => c.valores[primera.clave] === cat.valor);
    const porColumna = columnas.map((col) => {
      const celda = suyas.find((c) => c.valores[segunda!.clave] === col.valor);
      return celda?.cuota ?? null;
    });
    const cuota = suyas.reduce((s, c) => s + n(c.cuota), 0);
    const tau = suyas.find((c) => c.tau != null)?.tau ?? null;
    const g = delAula ? porCategoria.get(cat.valor) ?? { titulares: 0, elegibles: 0, esperadas: 0 } : null;
    return {
      clave: cat.valor,
      etiqueta: cat.etiqueta,
      porColumna,
      cuota,
      tasa: pct(tau),
      titulares: g ? g.titulares : null,
      elegibles: g ? g.elegibles : null,
      esperadas: g ? Math.round(g.esperadas) : null,
    };
  }).filter((f) => f.cuota > 0);

  const suma = (k: "titulares" | "elegibles" | "esperadas") =>
    delAula ? filas.reduce((s, f) => s + (f[k] ?? 0), 0) : null;
  const total = { cuota: filas.reduce((s, f) => s + f.cuota, 0), titulares: suma("titulares"), elegibles: suma("elegibles"), esperadas: suma("esperadas") };

  // La franja con las cifras que usa Avance (C5): muestra y sobremuestra salen
  // de la misma proyección que lee la pestaña de metas.
  const muestra = cintaDeMetas(proyeccionElegida(dashboard.proyeccion_metas, "muestra", "diseno"))?.meta ?? total.cuota;
  const operativa = cintaDeMetas(proyeccionElegida(dashboard.proyeccion_metas, "sobremuestra", "diseno"))?.meta ?? null;
  const tau = dashboard.efectividad_seguimiento?.total?.tau_previsto ?? null;
  const franja = [
    { clave: "muestra", rotulo: "Muestra", valor: fmt(muestra), sub: "la cuota del diseño" },
    { clave: "sobremuestra", rotulo: "Sobremuestra", valor: operativa != null ? fmt(Math.max(0, operativa - muestra)) : "—", sub: "lo que se agrega para cubrir la no respuesta" },
    { clave: "operativa", rotulo: "Meta operativa", valor: operativa != null ? fmt(operativa) : "—", sub: "muestra más sobremuestra" },
    { clave: "tasa", rotulo: "Tasa prevista", valor: pct(tau), sub: "de elegibles a efectivas" },
  ];

  const vigencia = texto(dashboard.avance_cuota?.vigencia);
  return {
    estado: "listo",
    franja,
    universo: rep.universo?.etiqueta || rep.universo?.valor || "",
    variables: rep.variables.map((v) => v.etiqueta || v.clave),
    origen: ORIGEN[texto(rep.origen)] ?? "Del diseño",
    columnas,
    filas,
    total,
    cobertura: total.esperadas != null && total.cuota > 0
      ? `Las esperadas de los titulares (${fmt(total.esperadas)}) cubren el ${(100 * total.esperadas / total.cuota).toFixed(1)} % de la cuota.`
      : null,
    desfasado: vigencia && vigencia !== "vigente"
      ? "El diseño cambió después de este corte: las metas pueden no ser las vigentes."
      : null,
  };
}

export const MARCA_METAS_AULAS = "monitoreo-aulas-modelo-metas";
export function readinessDeMetas(cargando: boolean, modelo: ModeloMetas | null): string {
  if (cargando || !modelo) return "false";
  return modelo.estado === "listo" ? MARCA_METAS_AULAS : `vacio:${modelo.estado}`;
}
