import type { ReactNode } from "react";
import type { Grupo, RespuestaUnica } from "../../../api/codificacion";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { Tags } from "../../../vendor/lucide-react";
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
  /** Las herramientas de un texto abierto en la cabecera: "Sugerir códigos" y "Palabras". */
  herramientas?: ReactNode;
  /** "Códigos" junto a las tarjetas; "Libro de códigos" junto a la tabla, como en el prototipo. */
  titulo?: string;
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
 * Los códigos de la pregunta en tarjetas de dos columnas (`pp-codigos` del prototipo) y al final la
 * tarjeta punteada que crea uno, pulsándola o soltando respuestas sobre ella. El cuerpo del contenedor es
 * el dueño del desplazamiento y del vacío. Lo comparten la vista de tarjetas y la de tabla.
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
  herramientas,
  titulo = "Códigos",
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
    <PanelDeMesa
      zona="codigos"
      titulo={titulo}
      icono={<Tags size={15} />}
      conteo={tarjetas.length}
      acciones={herramientas}
      grupo="codificacion/grupos"
    >
      <div className="pulso-cc-codigos-cuerpo" data-arrastrando={arrastrando ? "" : undefined}>
        {/* C1: las tarjetas de un renglón comparten el alto; una que muestra sus respuestas crece sola. */}
        <ul className="pulso-cc-codigos-lista pulso-codificacion-grupos-list" data-qa-geometry-group="codificacion/codigos-tarjetas" data-qa-geometry-contract="intrinsic">
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
    </PanelDeMesa>
  );
}
