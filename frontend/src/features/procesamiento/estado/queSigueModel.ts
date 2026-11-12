// "Qué sigue" en Estado del estudio: el siguiente paso del estudio y lo que la
// banda ya sabe que falta. Todo sale del estado de la sesión; nada se estima.

import type { SessionState } from "../../../api/core";
import { coberturaGraficos } from "../../graficos/coberturaBases";
import { seccionesDeProcesamiento } from "./seccionesDeProcesamiento";

export type SeccionId = "carga" | "validacion" | "codificacion" | "analitica" | "graficos";

export const SECCIONES_EN_ORDEN: readonly SeccionId[] = [
  "carga",
  "validacion",
  "codificacion",
  "analitica",
  "graficos",
];

export const RUTA_DE_SECCION: Readonly<Record<SeccionId, string>> = {
  carga: "/carga",
  validacion: "/validacion",
  codificacion: "/codificacion",
  analitica: "/analitica",
  graficos: "/graficos",
};

export const NOMBRE_DE_SECCION: Readonly<Record<SeccionId, string>> = {
  carga: "Carga",
  validacion: "Validación",
  codificacion: "Codificación",
  analitica: "Analítica",
  graficos: "Gráficos",
};

/**
 * La sección a la que entraba `/procesamiento` cuando redirigía
 * (`features/home/ProcesamientoEntry.tsx` hasta la etapa P2 del ADR 0142). La
 * regla es la misma, en el mismo orden: la primera sección sin hacer.
 */
export function seccionQueSigue(state: SessionState | null | undefined): SeccionId {
  if (!state?.xlsform || !state?.data) return "carga";
  if (!state?.auditoria_run) return "validacion";
  if (!state?.codif_aplicado) return "codificacion";
  if (!state?.analitica_prep_ok) return "analitica";
  return "graficos";
}

export type PasoSiguiente = {
  seccion: SeccionId;
  to: string;
  titulo: string;
  /** Por qué ese es el paso. `null` cuando no queda ninguno. */
  causa: string | null;
  /** Rótulo del botón: nombra el destino. */
  accion: string;
};

export type PendienteDeSeccion = {
  seccion: SeccionId;
  nombre: string;
  to: string;
  /** `bloqueada`: no se puede abrir todavía. `incompleta`: se puede abrir y le falta algo. */
  estado: "bloqueada" | "incompleta";
  motivo: string;
};

export type QueSigue = {
  paso: PasoSiguiente;
  /** Las cinco secciones tienen su trabajo hecho: no hay paso pendiente. */
  completo: boolean;
  pendientes: PendienteDeSeccion[];
};

export function seccionDeRuta(to: string): SeccionId | null {
  return SECCIONES_EN_ORDEN.find((id) => RUTA_DE_SECCION[id] === to) ?? null;
}

/** "Bloqueada: prepara Analítica." pasa a "Prepara Analítica.": el estado ya va en su chip. */
export function motivoSinPrefijo(motivo: string): string {
  const limpio = motivo.replace(/^Bloqueada:\s*/i, "").trim();
  return limpio ? limpio.charAt(0).toLocaleUpperCase("es-PE") + limpio.slice(1) : limpio;
}

function causaDeCarga(state: SessionState | null | undefined): string {
  if (!state?.xlsform && !state?.data) return "El estudio todavía no tiene formulario ni respuestas.";
  if (!state?.xlsform) return "Falta el formulario.";
  return "Faltan las respuestas.";
}

function pasoSiguiente(state: SessionState | null | undefined): { paso: PasoSiguiente; completo: boolean } {
  const seccion = seccionQueSigue(state);
  const base = { seccion, to: RUTA_DE_SECCION[seccion], accion: `Abrir ${NOMBRE_DE_SECCION[seccion]}` };
  const variasBases = (state?.n_bases ?? 0) > 1;

  if (seccion === "carga") {
    return {
      completo: false,
      paso: { ...base, titulo: "Cargar el formulario y las respuestas", causa: causaDeCarga(state) },
    };
  }
  if (seccion === "validacion") {
    return {
      completo: false,
      paso: { ...base, titulo: "Auditar las respuestas", causa: "Todavía no se ha ejecutado la auditoría." },
    };
  }
  if (seccion === "codificacion") {
    return {
      completo: false,
      paso: {
        ...base,
        titulo: "Aplicar la codificación",
        causa: variasBases
          ? "La codificación no está aplicada en todas las bases."
          : "La codificación todavía no se ha aplicado.",
      },
    };
  }
  if (seccion === "analitica") {
    return {
      completo: false,
      paso: { ...base, titulo: "Preparar Analítica", causa: "Los datos de Analítica todavía no están preparados." },
    };
  }
  const cobertura = coberturaGraficos(state);
  if (cobertura.hecho) {
    return { completo: true, paso: { ...base, titulo: "Sin pasos pendientes", causa: null } };
  }
  return {
    completo: false,
    paso: {
      ...base,
      titulo: "Generar el informe",
      causa: cobertura.motivo ?? "Todavía no se ha generado un informe.",
    },
  };
}

/**
 * El siguiente paso y los pendientes que la banda ya conoce (`blockedReason` y
 * `faltaReason`). La sección del siguiente paso no se repite entre los
 * pendientes: su motivo ya es la causa del paso.
 */
export function queSigue(state: SessionState | null | undefined): QueSigue {
  const { paso, completo } = pasoSiguiente(state);
  const pendientes: PendienteDeSeccion[] = [];
  for (const item of seccionesDeProcesamiento(state)) {
    const seccion = seccionDeRuta(item.to);
    if (!seccion || seccion === paso.seccion) continue;
    if (item.blockedReason) {
      pendientes.push({
        seccion,
        nombre: item.label,
        to: item.to,
        estado: "bloqueada",
        motivo: motivoSinPrefijo(item.blockedReason),
      });
    } else if (item.faltaReason) {
      pendientes.push({
        seccion,
        nombre: item.label,
        to: item.to,
        estado: "incompleta",
        motivo: item.faltaReason,
      });
    }
  }
  return { paso, completo, pendientes };
}
