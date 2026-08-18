/**
 * Los criterios del MARCO, uno por uno, tal como rigen hoy.
 *
 * La tarjeta «Lo que rige para todas las facultades» compara el DISEÑO —muestra,
 * sobremuestra, τ, deff, método—. Lo que decide qué aulas entran es otra cosa y
 * no estaba en ninguna pantalla junta: modalidad, tipo de sesión, nivel del
 * curso, mínimo por aula, facultades excluidas, tipo de docente y condición del
 * curso. Gonzalo lo pidió como «un comparativo no sólo de números sino de
 * método».
 *
 * Todo se LEE del config vigente. Cuando un criterio no está declarado se dice
 * «no se aplica» en vez de callarlo: un criterio ausente y uno inactivo se ven
 * igual en una tabla que omite filas, y no son lo mismo.
 *
 * La columna del estudio anterior sale de `referencia.general` cuando el
 * histórico la trae. Hoy el proyecto sólo guarda lo que 2025 EJECUTÓ, no sus
 * criterios, así que casi todas quedan sin referencia — y eso también es una
 * afirmación útil, porque dice dónde no hay con qué comparar.
 */
import type { CriterioGeneralFila } from "./CriteriosGeneralesCard";

const ETIQUETA_FACULTAD: Record<string, string> = {};

function lista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(String).filter(Boolean);
  if (typeof valor === "string" && valor.trim()) return [valor];
  return [];
}

function bonito(cat: string): string {
  return cat.replace(/_/g, " ").toLowerCase();
}

/** Categorías de un criterio `byVariable`, con sus excepciones por facultad. */
function describeCategorias(crit: Record<string, unknown> | undefined): string {
  if (!crit) return "";
  const cats = lista(crit.categories).map(bonito);
  const exc = (crit.exceptions ?? {}) as Record<string, Record<string, unknown>>;
  const claves = Object.keys(exc);
  const base = cats.length ? cats.join(", ") : "";
  if (!claves.length) return base;
  const partes = claves.map((k) => {
    const e = exc[k] ?? {};
    const suyas = lista(e.categories).map(bonito).join(", ");
    const etiqueta = ETIQUETA_FACULTAD[k] ?? k.replace(/_/g, " ");
    if (String(e.op) === "exenta") return `${etiqueta}: exenta`;
    if (String(e.op) === "replace") return `${etiqueta}: sólo ${suyas}`;
    return `${etiqueta}: además ${suyas}`;
  });
  return base ? `${base} · ${partes.join(" · ")}` : partes.join(" · ");
}

/** Rangos de nivel por facultad, resumidos sin enumerar las quince. */
function describeNivel(ranges: unknown): string {
  if (!ranges || typeof ranges !== "object") return "";
  const mapa = ranges as Record<string, unknown>;
  const claves = Object.keys(mapa);
  if (!claves.length) return "";
  const exentas: string[] = [];
  const tramos = new Set<string>();
  for (const k of claves) {
    const rr = mapa[k];
    const arr = Array.isArray(rr) ? rr : [];
    if (arr.some((r) => (r as Record<string, unknown>)?.exenta === true)) {
      exentas.push(ETIQUETA_FACULTAD[k] ?? k.replace(/_/g, " "));
      continue;
    }
    for (const r of arr) {
      const o = r as Record<string, unknown>;
      if (o?.min != null && o?.max != null) tramos.add(`${o.min}–${o.max}`);
    }
  }
  const base = tramos.size ? `niveles ${[...tramos].join(", ")}` : "";
  const ex = exentas.length ? `${exentas.length} facultad${exentas.length === 1 ? "" : "es"} exenta${exentas.length === 1 ? "" : "s"}` : "";
  return [base, ex].filter(Boolean).join(" · ");
}

/** Mínimo por aula: umbral general y cuántas facultades tienen el suyo. */
function describeMinimo(min: Record<string, unknown> | undefined): string {
  if (!min) return "";
  const thr = Number(min.threshold);
  const by = (min.byFaculty ?? {}) as Record<string, unknown>;
  const n = Object.keys(by).length;
  if (!Number.isFinite(thr)) return "";
  const propios = n ? ` · ${n} facultad${n === 1 ? "" : "es"} con mínimo propio` : "";
  return `${thr} elegibles${propios}`;
}

export function criteriosMarcoDeEstudio(
  criteriosSeleccion: unknown,
  filters: Record<string, unknown> | null | undefined,
): CriterioGeneralFila[] {
  const sel = (criteriosSeleccion ?? {}) as Record<string, unknown>;
  const by = (sel.byVariable ?? {}) as Record<string, Record<string, unknown>>;
  const f = (filters ?? {}) as Record<string, unknown>;
  const NO = "no se aplica";

  const excluidas = lista(f.excluded_faculties);
  const docente = describeCategorias(by.teacher_type);
  const condicion = describeCategorias(by.condicion_curso);

  return [
    { concepto: "Modalidad", hoy: describeCategorias(by.modality) || NO, claveHistorica: "criterio_modalidad" },
    { concepto: "Tipo de sesión", hoy: describeCategorias(by.session_type) || NO, claveHistorica: "criterio_session_type" },
    { concepto: "Nivel del curso", hoy: describeNivel(sel.courseLevelRanges) || NO, claveHistorica: "criterio_nivel" },
    { concepto: "Mínimo por curso-horario", hoy: describeMinimo(sel.minEligible as Record<string, unknown>) || NO, claveHistorica: "criterio_minimo" },
    {
      concepto: "Facultades excluidas",
      hoy: excluidas.length ? excluidas.join(", ") : "ninguna",
      claveHistorica: "criterio_facultades_excluidas",
    },
    { concepto: "Tipo de docente", hoy: docente || NO, claveHistorica: "criterio_teacher_type" },
    { concepto: "Condición del curso", hoy: condicion || NO, claveHistorica: "criterio_condicion" },
  ];
}
