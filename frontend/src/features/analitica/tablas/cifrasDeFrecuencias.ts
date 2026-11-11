// Los textos de la banda de Frecuencias y el motivo por el que no se puede
// generar. Las cifras del archivo (cuántas tablas, si sale con pesos, de qué
// base) son las de la vista previa del motor; las de la config (secciones,
// excluidas) son lo que el analista declaró.

import type { FrecuenciasPreview } from "../../../api/analitica";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { TonoCifra } from "../CifrasPestana";
import type { ResumenSecciones } from "../estructuraDeSecciones";
import type { OpcionDeSegmentado } from "../ponderacion/Segmentado";
import type { FrecuenciasConfig } from "../store";
import type { Lectura } from "./useLecturaPorBase";
import { causaDelArchivoVacio, ponderacionSinAplicar } from "./vistaPreviaModelo";

export type TextoDeCifra = { valor: string; titulo?: string; tono?: TonoCifra };

/** El servicio no tiene una base analítica preparada. */
export const SIN_BASE_PREPARADA = "E_NO_RP_DATA";

/** El rótulo de la cifra de tablas: con varias bases, la vista previa es de una. */
export function rotuloDeTablas(lectura: Lectura<FrecuenciasPreview>): string {
  return (lectura.datos?.base.n_bases ?? 1) > 1 ? "Tablas de esta base" : "Tablas en el archivo";
}

/** Las tablas del archivo: `total_variables` de la vista previa. */
export function cifraDeTablas(lectura: Lectura<FrecuenciasPreview>): TextoDeCifra {
  if (lectura.fase === "error") return { valor: "Sin leer", tono: "alerta", titulo: "No se pudo leer la vista previa del archivo." };
  if (lectura.datos === null) return { valor: "Leyendo" };
  return { valor: formatoConteo(lectura.datos.total_variables) };
}

/** Con qué pesos salen las tablas, según la vista previa. */
export function cifraDePesos(lectura: Lectura<FrecuenciasPreview>): TextoDeCifra {
  if (lectura.fase === "error") return { valor: "Sin leer", tono: "alerta" };
  const p = lectura.datos;
  if (p === null) return { valor: "Leyendo" };
  if (p.ponderado) {
    // "n efectivo", como lo dicen el archivo y la ficha técnica.
    const n = p.ponderacion.n_efectivo;
    const regla = "Porcentajes, N y estadísticos ponderados; los casos que respondieron, sin ponderar.";
    return { valor: "Con ponderación", tono: "acento", titulo: n === null ? regla : `${regla} n efectivo: ${formatoConteo(n)}.` };
  }
  if (ponderacionSinAplicar(p)) return { valor: "Sin aplicar", tono: "alerta", titulo: "La ponderación está activada y no se aplicó." };
  return { valor: "Sin ponderación" };
}

/** "8 de 9 visibles", o las del formulario cuando Datos no declara ninguna. */
export function cifraDeSecciones(resumen: ResumenSecciones, declaradas: number): TextoDeCifra {
  if (resumen.modo === "instrumento") {
    return { valor: "Las del formulario", titulo: "Datos no declara secciones: el archivo usa las del formulario." };
  }
  return { valor: `${formatoConteo(resumen.activas)} de ${formatoConteo(declaradas)} visibles` };
}

/**
 * Por qué el archivo no tendría tablas. Con todas las secciones ocultas lo
 * dice la config; si no, el aviso del servicio.
 */
export function causaSinTablas(resumen: ResumenSecciones, preview: FrecuenciasPreview): string {
  if (resumen.modo === "declaradas" && resumen.activas === 0) {
    return "Todas las secciones están ocultas. Muestra alguna en la pestaña Datos.";
  }
  return causaDelArchivoVacio(preview) ?? "No hay variables que tabular. Incluye alguna en la pestaña Datos.";
}

/**
 * Lo que se lee junto al botón deshabilitado. Sin motivo, `undefined`: un
 * fallo de la vista previa que no sea la falta de base no impide generar.
 */
export function motivoSinGenerar(
  lectura: Lectura<FrecuenciasPreview>,
  resumen: ResumenSecciones,
  ajustes: { sinGuardar: boolean; errorGuardado: string | null } = { sinGuardar: false, errorGuardado: null },
): string | undefined {
  // Generar con ajustes sin guardar usaría los anteriores: el botón espera al guardado.
  if (ajustes.errorGuardado) return "Ajustes sin guardar";
  if (ajustes.sinGuardar) return "Guardando los ajustes";
  if (lectura.fase === "error") {
    // La causa completa y la acción van en la vista previa; aquí, la frase corta.
    return lectura.codigo === SIN_BASE_PREPARADA ? "Falta preparar la base." : undefined;
  }
  if (lectura.datos === null) return "Leyendo las tablas del archivo";
  if (lectura.datos.total_variables === 0) return causaSinTablas(resumen, lectura.datos);
  return undefined;
}

export const OPCIONES_DE_ORDEN: readonly OpcionDeSegmentado<FrecuenciasConfig["orden"]>[] = [
  { valor: "original", rotulo: "Formulario" },
  { valor: "desc", rotulo: "Mayor a menor" },
  { valor: "asc", rotulo: "Menor a mayor" },
];
