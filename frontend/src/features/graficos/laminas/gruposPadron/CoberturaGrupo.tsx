// X5: la cobertura de un grupo incluido frente a su padrón, junto al padrón: n del cruce, padrón y porcentaje, con la
// regla del motor (modeloGruposPadron.coberturaDeGrupo). Sin n o sin padrón no se pinta nada: no hay cifra que dar.

import { coberturaDeGrupo, textoCobertura } from "./modeloGruposPadron";
import type { Padron } from "./modeloPadron";

type Props = { n: number | null; padron: Padron };

export function CoberturaGrupo({ n, padron }: Props) {
  const c = coberturaDeGrupo(n, padron);
  if (!c) return null;
  const clase = c.tipo === "en-base" ? "pulso-f6-grupos-cobertura" : c.tipo === "supera"
    ? "pulso-f6-grupos-cobertura is-aviso" : "pulso-f6-grupos-cobertura is-nota";
  return <span className={clase} data-cobertura={c.tipo}>{textoCobertura(c)}</span>;
}
