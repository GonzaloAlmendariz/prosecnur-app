// Portada del Word (W3 del rediseño, 2026-10-15). Puro y espejo de `.word_portada` (api/R/reporte_word_portada.R) y de
// cómo la arma `.word_documento`: el título es el de la lámina de portada; subtítulo y fecha también, salvo que Word ›
// Portada los cambie (`meta_portada`); «por» es PULSO PUCP si no se dice otro; lo vacío se omite.

import type { DocumentoWordOpciones } from "../../../api/graficosConfigNormalizer";

export type VariantePortada = "A" | "B" | "C";
export type DatosPortada = { variante: VariantePortada; ante: string; titulo: string; sub: string; por: string; fecha: string; para: string; version: string };

export const VARIANTES_PORTADA: readonly { clave: VariantePortada; nombre: string; detalle: string }[] = [
  { clave: "A", nombre: "Tipográfica", detalle: "Título grande, filete coral, quién y cuándo." },
  { clave: "B", nombre: "Banda", detalle: "Banda azul a la izquierda y el texto abajo." },
  { clave: "C", nombre: "Con ficha", detalle: "Como la tipográfica, con la ficha: para quién, por quién, fecha y versión." },
];

export function datosPortada(desdeLamina: { titulo: string; sub: string; fecha: string }, dw: DocumentoWordOpciones): DatosPortada {
  const m = dw.meta_portada ?? {};
  return {
    variante: dw.portada ?? "A",
    ante: m.ante ?? "",
    titulo: desdeLamina.titulo,
    sub: m.sub ?? desdeLamina.sub,
    por: m.por ?? "PULSO PUCP",
    fecha: m.fecha ?? desdeLamina.fecha,
    para: m.para ?? "",
    version: m.version ?? "",
  };
}

/** La ficha de la variante C: sólo las filas con dato, como el motor. */
export function fichaPortada(d: DatosPortada): { k: string; v: string }[] {
  return [
    { k: "Elaborado para", v: d.para }, { k: "Elaborado por", v: d.por }, { k: "Fecha", v: d.fecha }, { k: "Versión", v: d.version },
  ].filter((f) => f.v.trim());
}
