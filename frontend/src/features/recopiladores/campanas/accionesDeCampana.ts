// accionesDeCampana.ts — qué se puede hacer con cada campaña (ADR 0111 §7).
//
// La campaña de aulas no se borra, se archiva: sale de la lista sin perder
// plan, fichas ni traspaso, y se reabre. Las de correo se duplican, se
// renombran y se borran con su nombre como confirmación. Archivar y renombrar
// la de aulas escriben el registro del backend; sin él (respaldo derivado) la
// acción se ve deshabilitada con su motivo, no desaparece.

import type { CampanaMaterial } from "../../../api/materialCampanas";
import { LIMITE_CAMPANAS } from "../correos/modeloCampanas";
import type { FuenteDelRegistro } from "./useRegistroDeCampanas";

export type IdDeAccion = "renombrar" | "duplicar" | "borrar" | "archivar" | "reabrir";

export type AccionDeCampana = {
  id: IdDeAccion;
  label: string;
  /** Por qué no se puede ahora; `null` si se puede. */
  motivo: string | null;
  peligrosa: boolean;
};

const SIN_REGISTRO = "Esta versión del backend no registra campañas.";

export function accionesDeCampana(
  campana: CampanaMaterial,
  contexto: { fuente: FuenteDelRegistro | null; correos: number },
): AccionDeCampana[] {
  const conRegistro = contexto.fuente === "registro";
  if (campana.tipo === "aulas") {
    if (campana.archived) {
      return [{ id: "reabrir", label: "Reabrir", motivo: conRegistro ? null : SIN_REGISTRO, peligrosa: false }];
    }
    return [
      { id: "renombrar", label: "Renombrar…", motivo: conRegistro ? null : SIN_REGISTRO, peligrosa: false },
      { id: "archivar", label: "Archivar", motivo: conRegistro ? null : SIN_REGISTRO, peligrosa: false },
    ];
  }
  if (campana.tipo === "correo") {
    const lleno = contexto.correos >= LIMITE_CAMPANAS;
    return [
      { id: "renombrar", label: "Renombrar…", motivo: null, peligrosa: false },
      { id: "duplicar", label: "Duplicar", motivo: lleno ? `Hasta ${LIMITE_CAMPANAS} campañas de correo por proyecto.` : null, peligrosa: false },
      { id: "borrar", label: "Borrar…", motivo: null, peligrosa: true },
    ];
  }
  return [];
}
