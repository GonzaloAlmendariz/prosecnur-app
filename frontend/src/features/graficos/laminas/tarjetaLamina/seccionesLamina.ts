// H4 (continuación): las secciones plegables de la pestaña «Lámina» del inspector. Composición y Textos están en toda
// lámina; las de resumen (Hallazgos clave, Resumen de diferencias) suman sus ajustes y sus capítulos, donde vive la
// propuesta del motor. Sólo la primera arranca abierta; el índice pegado aparece con tres secciones o más.

import type { ArgMetadata } from "../../../../api/graficos";
import { ajustesQueAplican } from "../contenidoEspecial/ajustesRegistro";

export type SeccionLamina = "composicion" | "textos" | "ajustes" | "capitulos";

export const SECCIONES_LAMINA: readonly SeccionLamina[] = ["composicion", "textos", "ajustes", "capitulos"];

/** Con menos secciones que éstas el índice no ahorra nada: se ven todas las cabeceras de un vistazo. */
export const MIN_SECCIONES_INDICE = 3;

export type SeccionesLaminaAbiertas = Partial<Record<SeccionLamina, boolean>>;

/** Sólo la primera (Composición) arranca abierta. */
export function seccionLaminaAbierta(abiertas: SeccionesLaminaAbiertas, s: SeccionLamina): boolean {
  return abiertas[s] ?? s === SECCIONES_LAMINA[0];
}

export function conSeccionLamina(abiertas: SeccionesLaminaAbiertas, s: SeccionLamina, abierta: boolean): SeccionesLaminaAbiertas {
  return seccionLaminaAbierta(abiertas, s) === abierta ? abiertas : { ...abiertas, [s]: abierta };
}

export type SeccionLaminaPresente = { clave: SeccionLamina; titulo: string; rotulo: string };

const TIPOS_CAPITULOS = new Set<string>(["hallazgos_capitulos", "resumen_capitulos"]);

/** Títulos de las secciones de resumen según el tipo de lámina. */
function titulosResumen(tipo: string): { ajustes: string; capitulos: string; rotuloAjustes: string } {
  return tipo === "p_slide_resumen_diferencias"
    ? { ajustes: "Resumen de diferencias", capitulos: "Capítulos y filas", rotuloAjustes: "Resumen" }
    : { ajustes: "Hallazgos", capitulos: "Capítulos y hallazgos", rotuloAjustes: "Hallazgos" };
}

export function tituloSeccionLamina(tipo: string, s: SeccionLamina): string {
  if (s === "composicion") return "Composición";
  if (s === "textos") return "Textos";
  const t = titulosResumen(tipo);
  return s === "ajustes" ? t.ajustes : t.capitulos;
}

/** Los capítulos son el ajuste de tipo capítulos; los demás ajustes van en su propia sección. */
export function esArgCapitulos(a: Pick<ArgMetadata, "tipo_input">): boolean {
  return TIPOS_CAPITULOS.has(String(a.tipo_input));
}

/**
 * Las secciones que esta lámina pinta, en orden. `ajustes` son los argumentos de su bloque propio (modeloContenidoEspecial);
 * los capítulos sólo cuentan cuando aplican a lo guardado (en modo de cifras no hay).
 */
export function seccionesDeLamina(tipo: string, ajustes: readonly ArgMetadata[], payload: Record<string, unknown>): SeccionLaminaPresente[] {
  const t = titulosResumen(tipo);
  const fuera: SeccionLaminaPresente[] = [
    { clave: "composicion", titulo: "Composición", rotulo: "Composición" },
    { clave: "textos", titulo: "Textos", rotulo: "Textos" },
  ];
  if (ajustes.length === 0) return fuera;
  const aplican = ajustesQueAplican(ajustes, payload);
  fuera.push({ clave: "ajustes", titulo: t.ajustes, rotulo: t.rotuloAjustes });
  if (aplican.some(esArgCapitulos)) fuera.push({ clave: "capitulos", titulo: t.capitulos, rotulo: "Capítulos" });
  return fuera;
}

export function esSeccionLamina(v: unknown): v is SeccionLamina {
  return typeof v === "string" && (SECCIONES_LAMINA as readonly string[]).includes(v);
}
