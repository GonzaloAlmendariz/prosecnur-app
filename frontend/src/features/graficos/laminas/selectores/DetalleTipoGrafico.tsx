// Detalle del gráfico elegido en «¿Qué gráfico?» (F6.2; dirección F6 §4.4, columna derecha): qué muestra, qué pide,
// cómo sale, si cabe en la ranura de la lámina y el botón para usarlo.

import { AlertTriangle } from "../../../../vendor/lucide-react";
import type { GraficadorMetadata, GraficadorDataRequirement } from "../../../../api/graficos";
import { PulsoButton } from "../../../../components/PulsoButton";
import { GlifoGrafico } from "../../iconos/GlifoGrafico";
import { resolveGraficadorContract } from "../../slidePreviewModel";
import { ETIQUETA_SALIDA, FAMILIAS_GRAFICO, familiaDe, salidaDe, type Encaje } from "./tiposGrafico";

const PIDE: Record<GraficadorDataRequirement, string> = {
  var_or_vars: "Una pregunta, o varias que comparten escala.",
  var_cruces_corte: "Una pregunta y el corte con que se cruza.",
  named_vars: "Las preguntas que el gráfico nombra.",
  capability: "Un cálculo previo del estudio.",
  unknown: "Un requisito que esta versión no reconoce.",
};

type Props = {
  meta: GraficadorMetadata;
  nombre: string;
  /** «Gráfico 2 · Derecha». */
  ranura: string;
  encaje: Encaje;
  /** Motivo por el que no se puede insertar (disponibilidad, dimensiones…). */
  bloqueo: string | null;
  esActual: boolean;
  onAplicar: () => void;
};

export function DetalleTipoGrafico({ meta, nombre, ranura, encaje, bloqueo, esActual, onAplicar }: Props) {
  const contrato = resolveGraficadorContract(meta);
  const salida = salidaDe(meta.name);
  const familia = FAMILIAS_GRAFICO.find((f) => f.id === familiaDe(meta));
  const motivo = !encaje.cabe ? encaje.nota : bloqueo;
  return (
    <div className="pulso-f6-detalle">
      <div className="pulso-f6-detalle-lienzo is-grafico">
        <GlifoGrafico tipo={meta.name} titulo={`Esquema de “${nombre}”`} />
      </div>
      <div className="pulso-f6-detalle-texto">
        <h3>{nombre}</h3>
        {meta.descripcion && <p>{meta.descripcion}</p>}
      </div>
      <dl className="pulso-f6-ficha">
        {familia && (<><dt>Familia</dt><dd>{familia.label}</dd></>)}
        <dt>Qué pide</dt>
        <dd>{contrato.requirementLabel || PIDE[contrato.dataRequirement]}</dd>
        <dt>Cómo sale</dt>
        <dd>{ETIQUETA_SALIDA[salida].largo}</dd>
        <dt>En esta lámina</dt>
        <dd>{encaje.cabe ? `Va en ${ranura}.` : `No va en ${ranura}.`}{encaje.nota && encaje.cabe ? ` ${encaje.nota}` : ""}</dd>
      </dl>
      <div className="pulso-f6-selector-pie">
        {motivo && (
          <div className="pulso-f6-aviso-cambio" role="status">
            <strong><AlertTriangle size={14} aria-hidden="true" /> {motivo}</strong>
          </div>
        )}
        <PulsoButton variant="primary" size="sm" disabled={esActual || !!motivo} onClick={onAplicar}>
          {esActual ? "Es el gráfico actual" : "Usar este gráfico"}
        </PulsoButton>
      </div>
    </div>
  );
}
