/**
 * Salud del diseño muestral: veredicto NUEVO derivado de cifras que el motor R
 * ya validó. No recalcula estadística — solo LEE los números que las pestañas
 * ya muestran (n objetivo, N del marco, estudiantes esperados, score de
 * representatividad, tolerancias del balance, CV de pesos) y los convierte en
 * observaciones tipadas.
 *
 * Concepto clave: "cifra validada" habla de PROCEDENCIA (la calculó el motor y
 * no se toca); la salud habla de si el diseño que esas cifras describen se
 * puede defender. Son ortogonales: una cifra validada puede describir un
 * diseño enfermo (censo disfrazado de muestra, cobertura a medias, score 34).
 */
import type { CalcMuestraAulasProfileDistribution } from "../../../../api/client";
import { fmtDec, fmtInt, fmtPct, safeNumber } from "../../sharedCore";
import { classroomRowNumber, classroomRowText, normalizeUniversityLabel } from "./format";
import { proposalShortLabel } from "./study";
import type { ClassroomLabModel } from "../aulas/aulasParts";

export type SaludNivel = "warn" | "danger";

export type SaludObservacion = {
  id: string;
  nivel: SaludNivel;
  titulo: string;
  detalle: string;
  accion: string;
};

/** Umbrales del score global (misma escala 0-100 que muestra classroomScore). */
export const UMBRAL_SCORE_RIESGO = 50;
export const UMBRAL_SCORE_OBSERVACION = 70;

/**
 * Piezas mínimas que la derivación necesita. Se construyen desde el modelo del
 * laboratorio (piezasDesdeModel) o a mano en tests: la derivación es pura.
 */
export type SaludPiezas = {
  /** Componentes del cálculo: n objetivo del motor y N del marco de cada uno. */
  componentes: Array<{ etiqueta: string; nObjetivo: number; marcoN: number }>;
  /** true cuando el motor ya devolvió aulas titulares. */
  selectionReady: boolean;
  /** Estudiantes esperados sumados de las aulas titulares (0 = sin dato). */
  estudiantesEsperados: number;
  /** Objetivo de entrevistas del cálculo (el mismo que muestran los KPIs). */
  objetivoEntrevistas: number;
  /** Facultades con al menos un aula titular. */
  facultadesCubiertas: string[];
  /** Facultades (estratos) del marco del cálculo. */
  facultadesMarco: string[];
  /** Score global de representatividad (escala 0-1 o 0-100; null = sin dato). */
  representatividad: number | null;
  /** Categorías de la auditoría post-selección fuera de su tolerancia. */
  balanceFuera: number;
  balanceEvaluadas: number;
  /** CV de pesos del motor y sus umbrales declarados (null = sin dato). */
  cvPesos: number | null;
  cvWarn: number;
  cvCritical: number;
};

/** n objetivo que iguala o supera la población elegible: censo, no muestra. */
export function esCenso(nObjetivo: number, marcoN: number) {
  return nObjetivo > 0 && marcoN > 0 && nObjetivo >= marcoN;
}

/** Lleva el score a escala 0-100 (misma regla que classroomScore). */
export function scoreEscala100(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 1 ? value * 100 : value;
}

function listaCorta(items: string[], max = 4) {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} y ${fmtInt(items.length - max)} más`;
}

/**
 * Deriva las observaciones de salud a partir de cifras del motor. Solo lectura:
 * cero estadística nueva. Devuelve los peligros primero, en orden estable.
 */
export function derivarSaludDiseno(piezas: SaludPiezas): SaludObservacion[] {
  const observaciones: SaludObservacion[] = [];

  // a. Censo o n imposible (por componente del cálculo).
  for (const comp of piezas.componentes) {
    if (!esCenso(comp.nObjetivo, comp.marcoN)) continue;
    observaciones.push({
      id: `censo-${normalizeUniversityLabel(comp.etiqueta).toLowerCase().replace(/\s+/g, "-") || "componente"}`,
      nivel: "danger",
      titulo: `El n objetivo iguala o supera la población (N=${fmtInt(comp.marcoN)}): esto es un censo, no una muestra`,
      detalle: `${comp.etiqueta}: pide ${fmtInt(comp.nObjetivo)} entrevistas sobre ${fmtInt(comp.marcoN)} personas elegibles. Con n ≥ N no hay margen de error que defender.`,
      accion: "Revisa la meta aplicada o los parámetros en Cálculo → Propuestas.",
    });
  }

  // b. Brecha de cobertura: la selección no alcanza el objetivo del cálculo.
  if (
    piezas.selectionReady &&
    piezas.objetivoEntrevistas > 0 &&
    piezas.estudiantesEsperados > 0 &&
    piezas.estudiantesEsperados < piezas.objetivoEntrevistas
  ) {
    const cobertura = piezas.estudiantesEsperados / piezas.objetivoEntrevistas;
    observaciones.push({
      id: "brecha-cobertura",
      nivel: "warn",
      titulo: `La selección cubre ${fmtPct(cobertura)} del objetivo de entrevistas`,
      detalle: `Los cursos-horario titulares aportan ${fmtInt(piezas.estudiantesEsperados)} estudiantes esperados frente a ${fmtInt(piezas.objetivoEntrevistas)} del cálculo.`,
      accion: "Aumenta los cursos-horario necesarios en Objetivo de muestra o revisa las cuotas.",
    });
  }

  // c. Facultades del marco sin aula titular.
  if (piezas.selectionReady && piezas.facultadesMarco.length > 0) {
    const cubiertas = new Set(piezas.facultadesCubiertas.map(normalizeUniversityLabel));
    const ausentes = piezas.facultadesMarco.filter((label) => !cubiertas.has(normalizeUniversityLabel(label)));
    if (ausentes.length > 0) {
      const conAula = piezas.facultadesMarco.length - ausentes.length;
      observaciones.push({
        id: "facultades-sin-titular",
        nivel: "warn",
        titulo: `${fmtInt(conAula)} de ${fmtInt(piezas.facultadesMarco.length)} facultades con al menos un curso-horario titular; ${fmtInt(ausentes.length)} quedan sin presencia`,
        detalle: `Sin curso-horario titular: ${listaCorta(ausentes)}.`,
        accion: "Revisa la selección de cursos-horario titulares o el reparto por facultad en Objetivo de muestra.",
      });
    }
  }

  // d. Representatividad global baja (score que ya reporta el motor).
  const score = piezas.selectionReady ? scoreEscala100(piezas.representatividad) : null;
  if (score != null && score < UMBRAL_SCORE_RIESGO) {
    observaciones.push({
      id: "representatividad-baja",
      nivel: "danger",
      titulo: `Representatividad ${Math.round(score)}/100: por debajo del mínimo defendible`,
      detalle: "El score global de la selección indica que la muestra se aleja demasiado de la estructura del marco.",
      // El «y» hacía obligatorio comparar, que desde el 2026-08-22 ya no lo es
      // para sortear (commit f2623619). Se nombra lo que de verdad hay que
      // hacer: probar otro método, que se puede con o sin comparación previa.
      accion: "Prueba otro método o vuelve a sortear antes de defender el diseño.",
    });
  } else if (score != null && score < UMBRAL_SCORE_OBSERVACION) {
    observaciones.push({
      id: "representatividad-justa",
      nivel: "warn",
      titulo: `Representatividad ${Math.round(score)}/100: revisable antes de defenderla`,
      detalle: "El score global de la selección queda por debajo del rango cómodo para sustentar la muestra.",
      accion: "Compara métodos o ajusta el objetivo para acercar la selección al marco.",
    });
  }

  // e. Balance fuera de tolerancia (las tarjetas ámbar que ya existen, agregadas).
  if (piezas.selectionReady && piezas.balanceFuera > 0) {
    observaciones.push({
      id: "balance-fuera-tolerancia",
      nivel: "warn",
      titulo: `${fmtInt(piezas.balanceFuera)} de ${fmtInt(piezas.balanceEvaluadas)} categorías fuera de su banda de tolerancia`,
      detalle: "Las brechas frente al marco exceden la tolerancia declarada en el objetivo de representatividad.",
      accion: "Revisa el ajuste frente al marco en Cursos-horario titulares.",
    });
  }

  // f. CV de pesos sobre el umbral que el propio objetivo declara.
  if (piezas.cvPesos != null && Number.isFinite(piezas.cvPesos) && piezas.cvPesos > piezas.cvWarn) {
    const critico = piezas.cvPesos >= piezas.cvCritical;
    observaciones.push({
      id: "cv-pesos",
      nivel: critico ? "danger" : "warn",
      // Decía «CV de pesos 0.65 sobre el umbral 0.50» mientras la cifra de la
      // MISMA pestaña ya se llama «Desigualdad entre pesos»: el mismo concepto
      // con dos nombres a 200 px de distancia. El aviso usa el nombre de la
      // cifra que manda a mirar.
      titulo: `Desigualdad entre pesos ${fmtDec(piezas.cvPesos, 2)}, por encima de ${fmtDec(piezas.cvWarn, 2)}`,
      detalle: "Unas pocas aulas representan a muchas más que el resto, así que la muestra rinde como si fuera más pequeña de lo que es.",
      accion: "Míralo en Simulación, en «Estabilidad de pesos».",
    });
  }

  // Peligros primero, preservando el orden de los chequeos dentro de cada nivel.
  return [
    ...observaciones.filter((obs) => obs.nivel === "danger"),
    ...observaciones.filter((obs) => obs.nivel === "warn"),
  ];
}

/* =============================================================================
   Adaptadores: del modelo del laboratorio a las piezas, y de las observaciones
   al rail de riesgos (ClassroomRiskList) sin duplicar copy.
   ============================================================================= */

/** Claves de columnas con estudiantes esperados por aula (mismas que la capa didáctica). */
const ESPERADOS_KEYS = ["expected_completes", "expected_n", "esperados", "eligible_n", "matriculados_poblacion", "matriculados"];

export type SaludModelo = Pick<
  ClassroomLabModel,
  | "selectedComp"
  | "selectionReady"
  | "m1Rows"
  | "targetForDisplay"
  | "facultades"
  | "currentRepresentativityScore"
  | "visibleProfiles"
  | "weightStability"
  | "objective"
>;

function balanceFueraDeTolerancia(rows: CalcMuestraAulasProfileDistribution[]) {
  const evaluadas = rows.filter((row) => {
    const tolerance = safeNumber(row.tolerance, Number.NaN);
    return (Number.isFinite(tolerance) && tolerance > 0) || row.within_tolerance != null;
  });
  const fuera = evaluadas.filter((row) => {
    if (row.within_tolerance != null) return !row.within_tolerance;
    const frame = safeNumber(row.frame_prop, 0);
    const selected = safeNumber(row.selected_prop, 0);
    return Math.abs(selected - frame) > safeNumber(row.tolerance, 0);
  });
  return { fuera: fuera.length, evaluadas: evaluadas.length };
}

export function piezasDesdeModel(model: SaludModelo): SaludPiezas {
  const componentes = [model.selectedComp].map((comp) => ({
    etiqueta: proposalShortLabel(comp),
    nObjetivo: safeNumber(comp.resultado?.n_objetivo, 0),
    marcoN: safeNumber(comp.marco.marco_validado, 0),
  }));
  const estudiantesEsperados = Math.round(
    model.m1Rows.reduce((sum, row) => {
      const n = classroomRowNumber(row, ESPERADOS_KEYS);
      return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
    }, 0),
  );
  const cubiertasPorNorm = new Map<string, string>();
  for (const row of model.m1Rows) {
    const faculty = classroomRowText(row, ["faculty", "facultad", "stratum"]);
    if (faculty) cubiertasPorNorm.set(normalizeUniversityLabel(faculty), faculty);
  }
  const cv = model.weightStability ? classroomRowNumber(model.weightStability, ["cv"]) : Number.NaN;
  const balance = balanceFueraDeTolerancia(model.visibleProfiles);
  return {
    componentes,
    selectionReady: model.selectionReady,
    estudiantesEsperados,
    objetivoEntrevistas: model.targetForDisplay,
    facultadesCubiertas: [...cubiertasPorNorm.values()],
    facultadesMarco: (model.facultades ?? []).map((estrato) => estrato.label).filter(Boolean),
    representatividad: Number.isFinite(model.currentRepresentativityScore) ? model.currentRepresentativityScore : null,
    balanceFuera: balance.fuera,
    balanceEvaluadas: balance.evaluadas,
    cvPesos: Number.isFinite(cv) ? cv : null,
    cvWarn: safeNumber(model.objective.weight_cv_warn, 0.5),
    cvCritical: safeNumber(model.objective.weight_cv_critical, 1),
  };
}

export function saludDesdeModel(model: SaludModelo): SaludObservacion[] {
  return derivarSaludDiseno(piezasDesdeModel(model));
}

/** Observaciones en el formato del rail de riesgos (severidades is-alta/is-media). */
export function saludComoRiesgos(observaciones: SaludObservacion[]) {
  return observaciones.map((obs) => ({
    code: `salud_${obs.id}`,
    severity: obs.nivel === "danger" ? "alta" : "media",
    title: obs.titulo,
    detail: `${obs.detalle} ${obs.accion}`,
  }));
}
