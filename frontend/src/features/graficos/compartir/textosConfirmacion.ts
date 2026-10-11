// Textos del paso de confirmación antes de escribir (importar secciones o aplicar el plan portátil). Importar hidrata el
// editor desde el backend y reinicia el historial, así que Deshacer no lo revierte: la confirmación lo dice. Vaciar el
// plan (C14) sí es un paso del historial del editor (`usePlanStore.reset` pasa por `dirty`): se revierte con Deshacer
// mientras el informe no se vuelva a cargar, y la confirmación también lo dice.

import type { GraficosReportScope } from "../reportScope";
import type { ModoImportacionJson } from "./seccionesJson";

export type TextoConfirmacion = { titulo: string; detalle: string; accion: string };

const NO_SE_DESHACE = "No se puede revertir con Deshacer: si dudas, exporta antes una copia.";

function secciones(n: number): string {
  return `${n} ${n === 1 ? "sección" : "secciones"}`;
}

/** Lo que la importación no aplicará, para decirlo antes del «sí» (`resumenImportacion` en seccionesJson.ts). */
export type AvisosImportacion = {
  /** Rótulos de las secciones elegidas que el archivo no trae. */
  ausentes?: readonly string[];
  /** Rótulos de los logos que se descartan porque su PNG no está en el proyecto. */
  logosDescartados?: readonly string[];
};

function lista(xs: readonly string[]): string {
  return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`;
}

/** Frases de aviso, vacías si no hay nada que avisar. Un JSON no lleva el PNG de un logo: sólo su referencia. */
export function textoAvisosImportacion(avisos: AvisosImportacion = {}): string {
  const partes: string[] = [];
  const ausentes = avisos.ausentes ?? [];
  const logos = avisos.logosDescartados ?? [];
  if (ausentes.length) {
    partes.push(`El archivo no trae ${lista(ausentes)}: ${ausentes.length === 1 ? "queda" : "quedan"} como está${ausentes.length === 1 ? "" : "n"}.`);
  }
  if (logos.length) {
    partes.push(`${logos.length === 1 ? "El logo" : "Los logos"} ${lista(logos)} no ${logos.length === 1 ? "está" : "están"} en este proyecto y se ${logos.length === 1 ? "descarta" : "descartan"}: el archivo no lleva la imagen; súbela en Identidad.`);
  }
  return partes.join(" ");
}

export function textoConfirmarImportacion(
  modo: ModoImportacionJson,
  nSecciones: number,
  archivo: string,
  avisos?: AvisosImportacion,
): TextoConfirmacion {
  const aviso = textoAvisosImportacion(avisos);
  const conAviso = aviso ? `${aviso} ` : "";
  if (modo === "replace") {
    return {
      titulo: `¿Reemplazar ${secciones(nSecciones)} con «${archivo}»?`,
      detalle: `Lo que hay hoy en ${nSecciones === 1 ? "esa sección" : "esas secciones"} se sustituye por lo del archivo. ${conAviso}${NO_SE_DESHACE}`,
      accion: "Reemplazar",
    };
  }
  return {
    titulo: `¿Combinar ${secciones(nSecciones)} de «${archivo}»?`,
    detalle: `Se conserva lo existente y se suma lo del archivo; donde coinciden, queda lo del archivo. ${conAviso}${NO_SE_DESHACE}`,
    accion: "Combinar",
  };
}

export function textoConfirmarPlan(nBases: number): TextoConfirmacion {
  const bases = `${nBases} base${nBases === 1 ? "" : "s"}`;
  return {
    titulo: `¿Aplicar el plan a ${bases}?`,
    detalle: `El plan de gráficos de ${nBases === 1 ? "esa base" : "esas bases"} se reemplaza por el del paquete; formulario y respuestas no cambian. ${NO_SE_DESHACE}`,
    accion: "Aplicar",
  };
}

/** Deshacer revierte el vaciado mientras el historial siga en memoria: recargar o cambiar de base lo reinicia. */
export const VACIAR_SE_DESHACE = "Se puede revertir con Deshacer mientras no recargues el informe ni cambies de base.";

export function textoConfirmarVaciar(scope: GraficosReportScope, nLaminas: number): TextoConfirmacion {
  const laminas = `${nLaminas} ${nLaminas === 1 ? "lámina" : "láminas"}`;
  const donde = scope === "consolidated"
    ? "del informe compartido; el plan de cada base no cambia"
    : "del plan de esta base";
  return {
    titulo: scope === "consolidated" ? "¿Vaciar el informe compartido?" : "¿Vaciar el plan?",
    detalle: `Se quitan ${nLaminas === 1 ? "la" : "las"} ${laminas} y vuelven a su valor inicial estilos, paletas e íconos ${donde}. ${VACIAR_SE_DESHACE}`,
    accion: "Vaciar",
  };
}
