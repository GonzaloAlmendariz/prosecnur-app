// X5: el padrón de la base de la pregunta que divide, como referencia junto a los grupos («Padrón de Docentes: 254»,
// con su origen en el «?»), y los grupos incluidos que siguen sin padrón con el enlace al marco de Cálculo de muestra.
// La propuesta es por base (GET /api/graficos/resumenes/padron): no trae el padrón de cada grupo, así que no se escribe
// nada; sólo se muestra lo que el estudio declaró para la base.

import { formatoConteo } from "../../../../lib/formatoNumero";
import { AyudaGlobo } from "../AyudaGlobo";
import { DeclararPadron } from "./DeclararPadron";
import { baseDeCruce, textoSinPadron } from "./modeloGruposPadron";
import { nombrePublico, propuestaDe } from "./modeloPadron";
import { propuestasDe, usePadronPropuesto } from "./usePadronPropuesto";

type Props = {
  cruce: string;
  scope: "active" | "consolidated";
  /** Los grupos incluidos sin padrón, en el orden de la lámina. */
  sinPadron: readonly string[];
  /** Hay grupos incluidos: sin ellos no se pide la propuesta. */
  activo: boolean;
};

export function PadronDelCruce({ cruce, scope, sinPadron, activo }: Props) {
  const base = baseDeCruce(cruce);
  const propuesta = usePadronPropuesto(scope, activo && !!base);
  const p = base ? propuestaDe(propuestasDe(propuesta), base) : null;
  const cifra = p?.padron ?? null;
  const vacio = textoSinPadron(sinPadron);
  if (!activo || (!vacio && cifra === null)) return null;
  const nombre = nombrePublico(base);
  return (
    <div className="pulso-f6-grupos-referencia" data-qa="padron-del-cruce">
      {cifra !== null && (
        <span className="pulso-f6-grupos-referencia-cifra">
          Padrón de {nombre}: {formatoConteo(cifra)}
          {p?.padron_origen && <AyudaGlobo rotulo={`Padrón de ${nombre}`} detalle={p.padron_origen} />}
        </span>
      )}
      {vacio && (
        <p className="pulso-f6-dato-ayuda pulso-f6-grupos-sin-padron" role="note">
          <span>{vacio}</span>
          <DeclararPadron para="grupos" />
        </p>
      )}
    </div>
  );
}
