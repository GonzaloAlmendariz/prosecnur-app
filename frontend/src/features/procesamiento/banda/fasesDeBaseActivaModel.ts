// La marca de cada sección en la banda de Procesamiento, de la BASE ACTIVA: el ✓
// cuando su fase terminó y el punto cuando quedó desactualizada. Sale del
// estado por fase que publica el motor (`bases[<activa>].fases`, M8), no de los
// indicadores de la sesión, que describen el estudio y no una base.
//
// Sin ese estado (lectura en curso, error o motor anterior a M8) no hay marca:
// la banda no afirma que una sección esté lista.

import type { EstudioPayload } from "../../../api/estudio";
import { normalizarFasesDeBase } from "../../../api/estudioFases";
import { SECCIONES_EN_ORDEN, type SeccionId } from "../estado/queSigueModel";

export type MarcaDeSeccion = {
  hecha: boolean;
  desactualizada: boolean;
  /** Por qué quedó desactualizada, para el tooltip. */
  causa: string | null;
};

export type MarcasDeBaseActiva = {
  base: string;
  porSeccion: Readonly<Record<SeccionId, MarcaDeSeccion>>;
};

export function marcasDeBaseActiva(estudio: EstudioPayload | null): MarcasDeBaseActiva | null {
  if (!estudio) return null;
  const nombres = Object.keys(estudio.bases ?? {});
  const activa = (estudio.active_base ?? "").trim() || nombres[0] || "";
  const base = activa ? estudio.bases?.[activa] : undefined;
  const motor = normalizarFasesDeBase(base?.fases);
  if (!base || !motor) return null;
  const porSeccion = {} as Record<SeccionId, MarcaDeSeccion>;
  for (const seccion of SECCIONES_EN_ORDEN) {
    const fase = motor.fases[seccion];
    porSeccion[seccion] = {
      hecha: fase?.estado === "hecha",
      desactualizada: fase?.estado === "desactualizada",
      causa: fase?.estado === "desactualizada" ? fase.causa : null,
    };
  }
  return { base: activa, porSeccion };
}

