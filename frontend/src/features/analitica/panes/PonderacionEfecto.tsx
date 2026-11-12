// Panel "Efecto de ponderar": lo que resulta de la config declarada. Las cuatro
// cifras del resultado viven solo aquí (la cabecera de la pestaña no las
// repite), seguidas del detalle del recorte, los casos imputados y los avisos
// del motor con su causa, sin volver a escribir esas cifras. Cada estado tiene
// su bloque: calculando, error con causa, sin nada que aplicar y efecto calculado.
//
// El prototipo dibuja además el margen de error al 95 %, sin ponderar y
// ponderado. El motor no lo publica: queda declarado como hueco en el marcado
// (`data-cifras-pendientes`) y pedido al motor, sin calcularlo aquí.

import { Alert } from "../../../components/Alert";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { Skeleton } from "../../../components/Skeleton";
import { ErrorBlock } from "../../../components/States";
import { Gauge, Scale } from "../../../vendor/lucide-react";
import { avisosDelEfecto } from "../ponderacion/avisosDelEfecto";
import type { LecturaDelEfecto } from "../ponderacion/calculoDePonderacion";
import { CIFRAS_DEL_EFECTO, cifrasDelEfecto } from "../ponderacion/cifrasDePonderacion";
import { CifrasDelEfecto, RejillaDelEfecto } from "../ponderacion/CifrasDelEfecto";
import { DetalleDelEfecto } from "../ponderacion/DetalleDelEfecto";

/** Lo que el prototipo dibuja en este panel y el motor no publica. */
export const EFECTO_PENDIENTE =
  "Margen de error al 95 %, sin ponderar y ponderado: el motor no lo publica en la vista previa de la ponderación.";

export function PonderacionEfecto({ lectura, etiquetaDe, onReintentar }: {
  lectura: LecturaDelEfecto;
  etiquetaDe: (variable: string) => string;
  onReintentar?: () => void;
}) {
  const avisos = lectura.tipo === "efecto" ? avisosDelEfecto(lectura.preview.warnings) : [];
  return (
    <PanelDeMesa
      zona="efecto"
      titulo="Efecto de ponderar"
      icono={<Gauge size={16} aria-hidden="true" />}
      ocupado={lectura.tipo === "calculando" || (lectura.tipo === "efecto" && lectura.recalculando)}
    >
      {lectura.tipo === "inactivo" ? (
        <div className="pond-panel-cuerpo">
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
        <div className="pond-panel-cuerpo" data-pond-efecto="sin-efecto">
          <EstadoVacio
            icono={<Scale size={16} />}
            titulo="Sin efecto que mostrar"
            descripcion="Falta un peso base o una variable de ajuste con metas."
          />
        </div>
      ) : null}

      {lectura.tipo === "efecto" ? (
        <div
          className="pond-efecto"
          data-pond-efecto="listo"
          data-recalculando={lectura.recalculando ? "" : undefined}
          data-cifras-pendientes={EFECTO_PENDIENTE}
        >
          <CifrasDelEfecto cifras={cifrasDelEfecto(lectura.preview)} />
          <DetalleDelEfecto preview={lectura.preview} etiquetaDe={etiquetaDe} />
          {avisos.length > 0 ? (
            <div className="pond-efecto-avisos">
              {avisos.map((w, i) => (
                <div key={`${w.code}-${i}`} data-pond-aviso={w.code}>
                  <Alert kind={w.level === "warn" ? "warn" : "info"}>{w.message}</Alert>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </PanelDeMesa>
  );
}
