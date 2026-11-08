// El corte de la regla: la cifra (slider y número), el reparto de las candidatas sobre el mismo eje, el eje con su
// rótulo y el chip del límite de la lámina nativa junto al corte (con la marca del tope en el reparto cuando la selección
// lo pasa). Superficie propia del grupo de la regla (C1: miembro de `graficos/f6-regla`).

import type { TipoReglaPreguntas } from "../../../../api/graficosRegla";
import { Panel } from "../../../../components/Panel";
import { Skeleton } from "../../../../components/Skeleton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { LimiteLamina } from "./LimiteLamina";
import type { EstadoLimite } from "./limiteRegla";
import { CifraDeslizable } from "./CifraDeslizable";
import type { Resaltada } from "./ListaCandidatas";
import { textoMetrica } from "./modeloReglaPreguntas";
import { pasoGrande, recorridoSlider, textoCorteEje, type Reparto } from "./repartoRegla";
import { RepartoCandidatas } from "./RepartoCandidatas";

type Props = {
  id: string;
  tipo: TipoReglaPreguntas;
  campo: { rotulo: string; min: number; max: number; paso: number };
  valor: number;
  reparto: Reparto | null;
  rotuloMetrica: string;
  etiquetas: ReadonlyMap<string, string>;
  /** El chip del límite de la lámina nativa: el tope (optimista) y la otra causa de imagen que dice el motor. */
  limite: EstadoLimite | null;
  /** Sin reparto todavía (llega el conteo): la silueta ocupa su sitio para que el marco no salte. */
  cargando: boolean;
  resaltada: Resaltada;
  onResaltar: (r: Resaltada) => void;
  onMover: (v: number) => void;
  onSoltar: () => void;
};

export function CorteRegla({ id, tipo, campo, valor, reparto, rotuloMetrica, etiquetas, limite, cargando, resaltada, onResaltar, onMover, onSoltar }: Props) {
  const conPuntos = reparto && reparto.puntos.length > 0 ? reparto : null;
  const silueta = !reparto && cargando;
  const puesto = (n: number) => `${formatoConteo(n)}.º`;
  return (
    <Panel variant="subtle" noPadding className="pulso-f6-regla-corte" data-qa-geometry-member data-modo={conPuntos?.modo ?? "sin-reparto"}>
      <CifraDeslizable id={id} rotulo={campo.rotulo} valor={valor}
        recorrido={conPuntos ? recorridoSlider(conPuntos, tipo, campo, valor) : { pista: campo, valores: campo }} campo={campo}
        paso={campo.paso} grande={pasoGrande(tipo, campo.paso)} onMover={onMover} onSoltar={onSoltar}
        encima={conPuntos ? (
          <RepartoCandidatas reparto={conPuntos} tipo={tipo} rotulo={rotuloMetrica} etiquetas={etiquetas}
            tope={limite?.excedido ? limite.tope : null} resaltada={resaltada} onResaltar={onResaltar} />
        ) : silueta ? (
          <div className="pulso-f6-regla-reparto-lienzo" aria-hidden="true"><Skeleton forma="grafico" alto={64} /></div>
        ) : null}
        debajo={conPuntos ? (
          <div className="pulso-f6-regla-eje">
            <span>{conPuntos.modo === "umbral" ? "0" : puesto(1)}</span>
            <span className="pulso-f6-regla-eje-rotulo">
              {rotuloMetrica}
              {conPuntos.modo === "posicion" && conPuntos.cortesValor.length > 0 && (
                <> <span className="pulso-f6-regla-eje-corte">{textoCorteEje(tipo, conPuntos.cortesValor.map(textoMetrica))}</span></>
              )}
            </span>
            <span>{conPuntos.modo === "umbral" ? String(conPuntos.ejeMax) : puesto(conPuntos.ejeMax)}</span>
          </div>
        ) : silueta ? <div className="pulso-f6-regla-eje" aria-hidden="true"><span>&nbsp;</span></div> : null} />
      {limite && <LimiteLamina limite={limite} />}
      {reparto && reparto.sinDato > 0 && <span className="pulso-f6-dato-ayuda">Sin dato: {reparto.sinDato}</span>}
    </Panel>
  );
}
