// El corte de la regla: la cifra (slider y número), el reparto de las candidatas sobre el mismo eje, el eje con su
// rótulo y, cuando la selección pasa lo que admite la lámina nativa, el aviso del tope junto al corte (y su marca en el
// reparto). Superficie propia del grupo de la regla (C1: miembro de `graficos/f6-regla`).

import type { TipoReglaPreguntas } from "../../../../api/graficosRegla";
import { Panel } from "../../../../components/Panel";
import { CifraDeslizable } from "./CifraDeslizable";
import type { Resaltada } from "./ListaCandidatas";
import { textoMetrica } from "./modeloReglaPreguntas";
import { pasoGrande, recorridoSlider, type Reparto } from "./repartoRegla";
import { RepartoCandidatas } from "./RepartoCandidatas";

type Props = {
  id: string;
  tipo: TipoReglaPreguntas;
  campo: { rotulo: string; min: number; max: number; paso: number };
  valor: number;
  reparto: Reparto | null;
  rotuloMetrica: string;
  etiquetas: ReadonlyMap<string, string>;
  tope: { aviso: string; tope: number } | null;
  /** El aviso del tope es de la cifra que respondió el motor: mientras se proyecta, se atenúa. */
  proyectada: boolean;
  resaltada: Resaltada;
  onResaltar: (r: Resaltada) => void;
  onMover: (v: number) => void;
  onSoltar: () => void;
};

export function CorteRegla({ id, tipo, campo, valor, reparto, rotuloMetrica, etiquetas, tope, proyectada, resaltada, onResaltar, onMover, onSoltar }: Props) {
  const conPuntos = reparto && reparto.puntos.length > 0 ? reparto : null;
  const primera = conPuntos?.puntos[0];
  const ultima = conPuntos?.puntos[conPuntos.puntos.length - 1];
  return (
    <Panel variant="subtle" noPadding className="pulso-f6-regla-corte" data-qa-geometry-member data-modo={conPuntos?.modo ?? "sin-reparto"}>
      <CifraDeslizable id={id} rotulo={campo.rotulo} valor={valor}
        recorrido={conPuntos ? recorridoSlider(conPuntos, tipo, campo, valor) : campo} campo={campo}
        paso={campo.paso} grande={pasoGrande(tipo, campo.paso)} onMover={onMover} onSoltar={onSoltar}
        encima={conPuntos ? (
          <RepartoCandidatas reparto={conPuntos} tipo={tipo} rotulo={rotuloMetrica} etiquetas={etiquetas} tope={tope?.tope ?? null}
            resaltada={resaltada} onResaltar={onResaltar} />
        ) : null}
        debajo={conPuntos && primera && ultima ? (
          <div className="pulso-f6-regla-eje">
            <span>{conPuntos.modo === "umbral" ? "0" : textoMetrica(primera.metrica)}</span>
            <span className="pulso-f6-regla-eje-rotulo">
              {rotuloMetrica}
              {conPuntos.modo === "posicion" && conPuntos.cortesValor.length > 0 && (
                <> <span className="pulso-f6-regla-eje-corte">Corte {conPuntos.cortesValor.map(textoMetrica).join(" y ")}</span></>
              )}
            </span>
            <span>{conPuntos.modo === "umbral" ? String(conPuntos.ejeMax) : textoMetrica(ultima.metrica)}</span>
          </div>
        ) : null} />
      {tope && (
        <span className={`pulso-f6-regla-tope${proyectada ? " is-desfasado" : ""}`} role="note">
          <span className="pulso-f6-regla-tope-marca" aria-hidden="true" />
          {tope.aviso}
        </span>
      )}
      {reparto && reparto.sinDato > 0 && <span className="pulso-f6-dato-ayuda">Sin dato: {reparto.sinDato}</span>}
    </Panel>
  );
}
