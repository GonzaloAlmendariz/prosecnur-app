// El chip del límite de la lámina nativa (LimiteLamina): texto, tono y título. La escala del resumen sale como imagen
// por dos causas (graficos_escala_tope.R): más filas que el tope, o más de una opción «Sin información» (98 y 99).
//
// - El tope por filas es optimista: se mide con la selección que se ve (la local mientras se arrastra).
// - La otra causa no se deduce en el cliente: la dice el motor (`cabe_nativa === false` con su `motivo_imagen`) y pone
//   el chip en aviso sin importar el corte.
// - Con `cabe_nativa` null (o un motivo que sólo habla de filas) el cliente no promete nada más que el tope.
// Los avisos del motor que repiten una causa del chip no van a la lista: quedan como su título.

import type { ConteoRegla } from "../../../../api/graficosRegla";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { estadoTope, repiteElTope } from "./repartoRegla";

export type EstadoLimite = {
  /** El tope de filas, si el graficador tiene. */
  tope: number | null;
  /** La selección que se ve pasa el tope (optimista). */
  excedido: boolean;
  /** La causa que no es el número de filas, en la redacción del motor; `null` si el motor no la dijo. */
  otraCausa: string | null;
  /** Tono de aviso: por el tope o por la otra causa. */
  aviso: boolean;
  texto: string;
  /** Los avisos del motor que el chip absorbe, para su `title`. */
  titulo: string | null;
};

type ConteoLimite = Pick<ConteoRegla, "avisos" | "cabe_nativa" | "motivo_imagen">;

/** Las frases de un motivo: el motor junta las dos causas con un espacio. */
function frases(texto: string): string[] {
  return texto.split(/(?<=\.)\s+/).map((f) => f.trim()).filter(Boolean);
}

/** La causa que no es el número de filas, si el motor dice que la lámina no cabe por ella. */
export function otraCausaImagen(conteo: ConteoLimite | null | undefined): string | null {
  if (!conteo || conteo.cabe_nativa !== false || !conteo.motivo_imagen) return null;
  const resto = frases(conteo.motivo_imagen).filter((f) => !repiteElTope(f));
  return resto.length ? resto.join(" ") : null;
}

/**
 * El estado del chip con el tope (el del conteo, o el recordado del graficador) y la selección que se ve. `null` si no
 * hay nada que decir: ni tope ni otra causa.
 */
export function estadoLimite(conteo: ConteoLimite | null | undefined, tope: number | null | undefined, seleccionadas: number): EstadoLimite | null {
  const t = estadoTope(tope, seleccionadas);
  const otraCausa = otraCausaImagen(conteo);
  if (!t && !otraCausa) return null;
  const partes = otraCausa ? frases(otraCausa) : [];
  const absorbidos = (conteo?.avisos ?? []).filter((a) => (t && repiteElTope(a)) || partes.includes(a.trim()));
  return {
    tope: t?.tope ?? null,
    excedido: !!t?.excedido,
    otraCausa,
    aviso: !!t?.excedido || !!otraCausa,
    texto: otraCausa ?? `La lámina nativa admite ${formatoConteo(t?.tope ?? 0)}`,
    titulo: absorbidos.length ? absorbidos.join(" ") : null,
  };
}

/** Los avisos que van a la lista: sin los que el chip ya dice. */
export function avisosFueraDelLimite(avisos: readonly string[], limite: EstadoLimite | null): string[] {
  if (!limite) return [...avisos];
  const partes = limite.otraCausa ? frases(limite.otraCausa) : [];
  return avisos.filter((a) => !((limite.tope !== null && repiteElTope(a)) || partes.includes(a.trim())));
}
