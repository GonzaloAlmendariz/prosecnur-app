// Textos del paso de confirmación antes de escribir (importar secciones o aplicar el plan portátil). Importar hidrata el
// editor desde el backend y reinicia el historial, así que Deshacer no lo revierte: la confirmación lo dice.

import type { ModoImportacionJson } from "./seccionesJson";

export type TextoConfirmacion = { titulo: string; detalle: string; accion: string };

const NO_SE_DESHACE = "No se puede revertir con Deshacer: si dudas, exporta antes una copia.";

function secciones(n: number): string {
  return `${n} ${n === 1 ? "sección" : "secciones"}`;
}

export function textoConfirmarImportacion(modo: ModoImportacionJson, nSecciones: number, archivo: string): TextoConfirmacion {
  if (modo === "replace") {
    return {
      titulo: `¿Reemplazar ${secciones(nSecciones)} con «${archivo}»?`,
      detalle: `Lo que hay hoy en ${nSecciones === 1 ? "esa sección" : "esas secciones"} se sustituye por lo del archivo. ${NO_SE_DESHACE}`,
      accion: "Reemplazar",
    };
  }
  return {
    titulo: `¿Combinar ${secciones(nSecciones)} de «${archivo}»?`,
    detalle: `Se conserva lo existente y se suma lo del archivo; donde coinciden, queda lo del archivo. ${NO_SE_DESHACE}`,
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
