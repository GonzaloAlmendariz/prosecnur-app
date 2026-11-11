// Las cifras de la pestaña Ponderación, cada una en un solo lugar.
//
// La banda de la pestaña repetía dos de las cuatro cifras del panel "Efecto de
// ponderar" (tamaño efectivo y efecto de diseño). Reparto: la banda dice lo que
// se declaró (variables de ajuste con metas) y la suma de pesos; el panel, lo
// que resulta. `CIFRAS_DE_LA_BANDA` y `CIFRAS_DEL_EFECTO` no comparten ninguna
// clave y su prueba lo vigila.
//
// Aquí no se calcula nada: cada valor es un campo que el motor ya entrega
// (`PonderDiagnostics`, `PonderRecorte`). Lo que se agrega es la base que ese
// campo ya usa, escrita junto a la cifra.

import type { PonderPreview } from "../../../api/analitica";
import { formatoConteo, formatoDecimal, SIN_CIFRA } from "../../../lib/formatoNumero";
import type { CifraPestana } from "../CifrasPestana";
import type { PonderacionConfig } from "../store";

export const CIFRAS_DE_LA_BANDA = ["variables-de-ajuste", "suma-de-pesos"] as const;
export const CIFRAS_DEL_EFECTO = ["tamano-efectivo", "efecto-de-diseno", "peso-minimo", "peso-maximo"] as const;

export type ClaveDelEfecto = (typeof CIFRAS_DEL_EFECTO)[number];

export type CifraDelEfecto = {
  clave: ClaveDelEfecto;
  valor: string;
  rotulo: string;
  /** Sobre qué se lee la cifra. Nunca vacía. */
  base: string;
  /** El valor antes del recorte de pesos extremos, cuando lo hubo, diciendo de qué es. */
  antes?: string;
  tono?: "aviso";
};

/** A partir de qué pérdida frente a los casos sin ponderar la cifra se marca. La misma del panel anterior. */
export const PERDIDA_QUE_SE_AVISA = 25;

const esNumero = (x: number | null | undefined): x is number => x != null && Number.isFinite(x);

/** Un peso: dos decimales en la escala de media 1; con millares en la de expansión. */
export function formatoPeso(x: number | null | undefined): string {
  if (!esNumero(x)) return SIN_CIFRA;
  return Math.abs(x) >= 100 ? formatoDecimal(x, 1) : x.toFixed(2);
}

const razon = (x: number | null | undefined) => (esNumero(x) ? x.toFixed(2) : SIN_CIFRA);

/** Una variable ajusta solo si tiene al menos una meta: declarada y vacía no cambia ningún peso. */
export function variablesQueAjustan(pond: PonderacionConfig): number {
  return (pond.rake?.margins ?? [])
    .filter((m) => Object.values(m.targets ?? {}).some((meta) => esNumero(meta)))
    .length;
}

/** La banda: las variables que ajustan y la suma de pesos. */
export function cifrasDeLaBanda(pond: PonderacionConfig, preview: PonderPreview | null): CifraPestana[] {
  const cifras: CifraPestana[] = [
    {
      clave: "variables-de-ajuste",
      etiqueta: "Variables de ajuste",
      valor: formatoConteo(variablesQueAjustan(pond)),
    },
  ];
  // El motor entrega el total solo con pesos de expansión, que suman la
  // población. Se rotula "Suma de pesos" y no "Población": la población
  // censada del bloque del censo es otra cifra, con otra fuente.
  const total = preview?.ok ? preview.total_poblacion : null;
  if (esNumero(total)) {
    cifras.push({
      clave: "suma-de-pesos",
      etiqueta: "Suma de pesos",
      valor: formatoConteo(total),
    });
  }
  return cifras;
}

/** El panel "Efecto de ponderar": las cuatro cifras del resultado, con su base. */
export function cifrasDelEfecto(preview: PonderPreview): CifraDelEfecto[] {
  const d = preview.diagnostics;
  if (!d) return [];
  const antes = preview.recorte?.antes ?? null;
  const perdida = esNumero(d.loss_pct) ? Math.round(d.loss_pct) : null;
  const casos = `de ${formatoConteo(d.n)} ${d.n === 1 ? "caso" : "casos"}`;
  const media = `media ${formatoPeso(d.mean)}`;
  return [
    {
      clave: "tamano-efectivo",
      valor: formatoConteo(d.n_eff),
      rotulo: "Tamaño efectivo",
      base: perdida != null && perdida > 0 ? `${casos}, ${perdida} % menos` : casos,
      antes: antes ? `tamaño efectivo ${formatoConteo(antes.n_eff)} antes del recorte` : undefined,
      tono: perdida != null && perdida >= PERDIDA_QUE_SE_AVISA ? "aviso" : undefined,
    },
    {
      clave: "efecto-de-diseno",
      valor: razon(d.deff),
      rotulo: "Efecto de diseño por ponderación",
      base: "casos entre tamaño efectivo",
      antes: antes ? `efecto de diseño ${razon(antes.deff)} antes del recorte` : undefined,
    },
    { clave: "peso-minimo", valor: formatoPeso(d.min), rotulo: "Peso mínimo", base: media },
    { clave: "peso-maximo", valor: formatoPeso(d.max), rotulo: "Peso máximo", base: media },
  ];
}
