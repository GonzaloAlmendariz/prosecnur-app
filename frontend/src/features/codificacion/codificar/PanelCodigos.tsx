import type { Grupo, RespuestaUnica } from "../../../api/codificacion";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { Plus } from "../../../vendor/lucide-react";
import { GrupoCodificacionCard } from "../GrupoCodificacionCard";
import { respuestasParecidas, type AvisoDelLote, type TarjetaDeCodigo } from "./modeloDeCodificar";
import { TarjetaCodigoNuevo } from "./TarjetaCodigoNuevo";

export type PanelCodigosProps = {
  tarjetas: readonly TarjetaDeCodigo[];
  grupos: readonly Grupo[];
  respuestas: readonly RespuestaUnica[];
  /** Casos con texto de la pregunta: la base de la barra de proporción de cada código. */
  casosConTexto: number;
  permiteVarios: boolean;
  /** Se está arrastrando un lote de respuestas. */
  arrastrando: boolean;
  /** Aviso de "ya marcada" de cada código para el lote elegido o arrastrado, por id de grupo. */
  avisos: ReadonlyMap<string, AvisoDelLote>;
  /** El número del código que se crearía. */
  siguiente: string;
  /** Respuestas que esperan el nombre del código nuevo; `null` con el formulario cerrado. */
  pendientesDeNuevo: number | null;
  onAbrirNuevo: () => void;
  onCrear: (nombre: string) => void;
  onCancelarNuevo: () => void;
  onCambiar: (grupoId: string, cambio: Partial<Grupo>) => void;
  onEliminar: (grupoId: string) => void;
  onMover: (grupoId: string, hacia: "arriba" | "abajo") => void;
  onQuitarRespuesta: (clave: string, grupoId: string) => void;
  onAgregarRespuesta: (clave: string, grupoId: string) => void;
};

/**
 * Los códigos de la pregunta, cada uno en su tarjeta, y al final la tarjeta punteada que crea uno. El
 * cuerpo es el dueño del desplazamiento y del vacío del panel. Lo comparten la vista de tarjetas y la de
 * tabla.
 */
export function PanelCodigos({
  tarjetas,
  grupos,
  respuestas,
  casosConTexto,
  permiteVarios,
  arrastrando,
  avisos,
  siguiente,
  pendientesDeNuevo,
  onAbrirNuevo,
  onCrear,
  onCancelarNuevo,
  onCambiar,
  onEliminar,
  onMover,
  onQuitarRespuesta,
  onAgregarRespuesta,
}: PanelCodigosProps) {
  return (
    <Panel noPadding className="pulso-cc-panel pulso-cc-codigos pulso-cv2-col" aria-label="Códigos" data-arrastrando={arrastrando ? "" : undefined}>
      <div className="pulso-cc-panel-cab">
        <h3 className="pulso-cc-panel-titulo">Códigos</h3>
        <span className="pulso-cc-cuenta" title={tarjetas.length === 1 ? "1 código" : `${formatoConteo(tarjetas.length)} códigos`}>
          {formatoConteo(tarjetas.length)}
        </span>
        <PulsoButton variant="secondary" size="sm" className="pulso-cc-panel-accion" onClick={onAbrirNuevo}>
          <Plus size={14} aria-hidden="true" />
          Nuevo código
        </PulsoButton>
      </div>
      <div
        className="pulso-cc-codigos-cuerpo"
        // C1: cada tarjeta mide lo que sus respuestas; el cuerpo es el dueño del desplazamiento y del vacío.
        data-qa-geometry-group="codificacion/grupos"
        data-qa-geometry-contract="intrinsic"
        data-qa-geometry-capacity="owned"
      >
        <ul className="pulso-cc-codigos-lista pulso-codificacion-grupos-list">
          {tarjetas.map((tarjeta, i) => {
            const id = tarjeta.grupo.id;
            return (
              <li key={id} data-qa-geometry-member="">
                <GrupoCodificacionCard
                  tarjeta={tarjeta}
                  casosConTexto={casosConTexto}
                  esDestino={arrastrando}
                  aviso={avisos.get(id) ?? null}
                  esPrimero={i === 0}
                  esUltimo={i === tarjetas.length - 1}
                  buscarParecidas={() => respuestasParecidas(tarjeta.grupo, grupos, respuestas, permiteVarios)}
                  onCambiar={(cambio) => onCambiar(id, cambio)}
                  onEliminar={() => onEliminar(id)}
                  onSubir={() => onMover(id, "arriba")}
                  onBajar={() => onMover(id, "abajo")}
                  onQuitarRespuesta={(clave) => onQuitarRespuesta(clave, id)}
                  onAgregarRespuesta={(clave) => onAgregarRespuesta(clave, id)}
                />
              </li>
            );
          })}
          <li data-qa-geometry-member="nuevo">
            <TarjetaCodigoNuevo
              numero={siguiente}
              unica={tarjetas.length === 0}
              esDestino={arrastrando}
              pendientes={pendientesDeNuevo}
              onAbrir={onAbrirNuevo}
              onCrear={onCrear}
              onCancelar={onCancelarNuevo}
            />
          </li>
        </ul>
      </div>
    </Panel>
  );
}
