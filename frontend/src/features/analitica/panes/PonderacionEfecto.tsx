// Panel "Efecto de ponderar": lo que resulta de la config declarada. Las cuatro
// cifras del resultado viven solo aquí (la banda de la pestaña no las repite),
// seguidas del detalle del recorte, los casos imputados y los avisos del motor
// con su causa. Cada estado tiene su bloque: calculando, error con causa, sin
// nada que aplicar y efecto calculado.

import { Alert } from "../../../components/Alert";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { Skeleton } from "../../../components/Skeleton";
import { ErrorBlock } from "../../../components/States";
import { Gauge, Scale } from "../../../vendor/lucide-react";
import type { LecturaDelEfecto } from "../ponderacion/calculoDePonderacion";
import { CIFRAS_DEL_EFECTO, cifrasDelEfecto } from "../ponderacion/cifrasDePonderacion";
import { CifrasDelEfecto, RejillaDelEfecto } from "../ponderacion/CifrasDelEfecto";
import { DetalleDelEfecto } from "../ponderacion/DetalleDelEfecto";

export function PonderacionEfecto({ lectura, etiquetaDe, onReintentar }: {
  lectura: LecturaDelEfecto;
  etiquetaDe: (variable: string) => string;
  onReintentar?: () => void;
}) {
  return (
    <Panel
      noPadding
      data-entra="sube"
      className="pond-panel pond-panel-efecto"
      title={<><Gauge size={16} aria-hidden="true" /><span>Efecto de ponderar</span></>}
      aria-busy={lectura.tipo === "calculando" || (lectura.tipo === "efecto" && lectura.recalculando) || undefined}
    >
      {lectura.tipo === "inactivo" ? (
        <div className="pond-panel-cuerpo" data-qa-geometry-capacity="owned">
          <EstadoVacio
            icono={<Scale size={16} />}
            titulo="Sin efecto que calcular"
            descripcion="El peso se toma de una columna de la base, sin calibración."
          />
        </div>
      ) : null}

      {lectura.tipo === "calculando" ? (
        // C2: la espera ocupa las mismas cuatro celdas que las cifras.
        <div role="status" data-pond-efecto="calculando">
          <span className="pulso-sr-only">Calculando los pesos</span>
          <RejillaDelEfecto celdas={CIFRAS_DEL_EFECTO} clave={(clave) => clave}>
            {(clave) => (
              <div key={clave} className="pond-efecto-cifra">
                <Skeleton forma="titulo" ancho="38%" />
                <Skeleton forma="texto" ancho="72%" />
                <Skeleton forma="texto" ancho="56%" />
              </div>
            )}
          </RejillaDelEfecto>
        </div>
      ) : null}

      {lectura.tipo === "error" ? (
        <div className="pond-panel-cuerpo" data-pond-efecto="error">
          <ErrorBlock
            label="No se pudieron calcular los pesos"
            causa={lectura.causa}
            acciones={lectura.reintentable && onReintentar ? (
              <PulsoButton variant="secondary" onClick={onReintentar}>Reintentar</PulsoButton>
            ) : undefined}
          />
        </div>
      ) : null}

      {lectura.tipo === "sin-efecto" ? (
        <div className="pond-panel-cuerpo" data-qa-geometry-capacity="owned" data-pond-efecto="sin-efecto">
          <EstadoVacio
            icono={<Scale size={16} />}
            titulo="Sin efecto que mostrar"
            descripcion="Falta un peso base o una variable de ajuste con metas."
          />
        </div>
      ) : null}

      {lectura.tipo === "efecto" ? (
        <div className="pond-efecto" data-pond-efecto="listo" data-recalculando={lectura.recalculando ? "" : undefined}>
          <CifrasDelEfecto cifras={cifrasDelEfecto(lectura.preview)} />
          <DetalleDelEfecto preview={lectura.preview} etiquetaDe={etiquetaDe} />
          {(lectura.preview.warnings ?? []).length > 0 ? (
            <div className="pond-efecto-avisos">
              {(lectura.preview.warnings ?? []).map((w, i) => (
                <div key={`${w.code}-${i}`} data-pond-aviso={w.code}>
                  <Alert kind={w.level === "warn" ? "warn" : "info"}>{w.message}</Alert>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}
