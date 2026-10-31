// =============================================================================
// modeloHermanas.ts — lo que «Aplicar a las campañas hermanas» dice de cada una
// (GOAL editor de correos, L16), sin React
// =============================================================================

import type { MailHermana } from "../../../api/materialMailHermanas";

export type FraseDeHermana = { texto: string; tono: "cambio" | "conserva" | "problema" };

const lista = (xs: string[]) => xs.join(", ");

/** Qué cambia, qué se agrega y qué conserva una hermana, en frases cortas. */
export function frasesDeLaHermana(h: MailHermana): FraseDeHermana[] {
  const out: FraseDeHermana[] = [];
  for (const p of h.problemas) out.push({ texto: p.detail || p.path, tono: "problema" });
  if (!h.cambios.length && !h.campos_agregados.length && !h.datos_agregados.length) {
    out.push({ texto: "Ya está igual: no cambia nada.", tono: "conserva" });
  }
  const cuerpo = h.cambios.filter((c) => !c.includes(":"));
  const envios = h.cambios.filter((c) => c.includes(":"));
  if (cuerpo.length) out.push({ texto: `Cambia: ${lista(cuerpo)}.`, tono: "cambio" });
  for (const e of envios) out.push({ texto: `${e}.`, tono: "cambio" });
  if (h.campos_agregados.length) out.push({ texto: `Se agregan los campos ${lista(h.campos_agregados.map((k) => `{{${k}}}`))}.`, tono: "cambio" });
  if (h.datos_agregados.length) {
    out.push({ texto: `Se agregan los datos ${lista(h.datos_agregados.map((k) => `{{${k}}}`))} con el valor del origen: revísalos.`, tono: "cambio" });
  }
  if (h.envios_que_quedan.length) out.push({ texto: `Quedan como están: ${lista(h.envios_que_quedan)}.`, tono: "conserva" });
  const conserva = [
    ...(h.conserva.saludo ? ["su saludo"] : []),
    h.conserva.registro === "tu" ? "trato tú" : "trato usted",
    ...(h.conserva.enlaces.length ? [`enlace ${lista(h.conserva.enlaces.map((t) => `*|${t}|*`))}`] : []),
    ...(h.conserva.datos ? [`${h.conserva.datos} ${h.conserva.datos === 1 ? "dato" : "datos"} con su valor`] : []),
  ];
  out.push({ texto: `Conserva: ${lista(conserva)}.`, tono: "conserva" });
  return out;
}
