import { useId, type KeyboardEvent } from "react";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { Inbox } from "../../../vendor/lucide-react";
import { FilaUnidad, type PapelEnArrastre } from "./FilaUnidad";
import { destinoDeArrastre, type SeccionDeUnidades, type Unidad } from "./modeloUnidades";

export type ListaUnidadesProps = {
  secciones: SeccionDeUnidades[];
  /** Si la base trae preguntas: decide qué dice el vacío. */
  hayUnidades: boolean;
  buscando: boolean;
  seleccion: string | null;
  ocupada: string;
  recienUnida: string;
  /** La unidad que se está arrastrando, si hay una. */
  levantada: Unidad | null;
  onSeleccionar: (id: string) => void;
  /** Al pulsar el nodo punteado de una suelta: abre el selector para elegir su pareja. */
  onEmparejar: (unidad: Unidad) => void;
  onVerTodas: () => void;
};

const TECLAS = ["ArrowDown", "ArrowUp", "Home", "End"];

function papelDe(unidad: Unidad, levantada: Unidad | null): PapelEnArrastre | null {
  if (!levantada) return null;
  if (unidad.id === levantada.id) return "origen";
  return destinoDeArrastre(levantada, unidad) ?? "fuera";
}

/**
 * La lista de unidades, agrupada por sección del formulario. Es la dueña de su desplazamiento y del
 * vacío que queda bajo la última fila. El tabulador entra a una sola fila; con las flechas se pasa de
 * fila en fila y la selección las sigue, así el inspector queda a un tabulador de cualquier pregunta.
 */
export function ListaUnidades({
  secciones, hayUnidades, buscando, seleccion, ocupada, recienUnida, levantada, onSeleccionar, onEmparejar, onVerTodas,
}: ListaUnidadesProps) {
  const idBase = useId();

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    if (!TECLAS.includes(evento.key)) return;
    // Solo desde el botón de una fila: en el asa las flechas mueven la pregunta levantada.
    const actual = (evento.target as HTMLElement).closest<HTMLElement>("[data-fila-boton]");
    if (!actual) return;
    const botones = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>("[data-fila-boton]"));
    const i = botones.indexOf(actual);
    const ultimo = botones.length - 1;
    const j =
      evento.key === "Home" ? 0 : evento.key === "End" ? ultimo : Math.min(ultimo, Math.max(0, i + (evento.key === "ArrowDown" ? 1 : -1)));
    if (j === i) return;
    evento.preventDefault();
    const siguiente = botones[j];
    siguiente.focus();
    if (siguiente.dataset.filaBoton) onSeleccionar(siguiente.dataset.filaBoton);
  }

  // La lista es una sola parada del tabulador: la fila seleccionada o, si no está a la vista, la primera.
  const visibles = secciones.flatMap((seccion) => seccion.unidades);
  const tabulable = visibles.some((u) => u.id === seleccion) ? seleccion : visibles[0]?.id ?? null;

  return (
    <div
      className="pulso-preg-unidades"
      data-arrastrando={levantada ? "" : undefined}
      data-qa-geometry-group="codificacion/unidades"
      data-qa-geometry-contract="intrinsic"
      data-qa-geometry-capacity="owned"
      onKeyDown={alTeclear}
    >
      {secciones.length === 0 ? (
        <div className="pulso-preg-sin-filas">
          {hayUnidades ? (
            <EstadoVacio
              tamano="normal"
              icono={<Inbox size={18} />}
              titulo="Sin preguntas en esta vista"
              descripcion={buscando ? "Ninguna pregunta coincide con la búsqueda." : "Ninguna pregunta cumple este filtro."}
              accion={<PulsoButton variant="secondary" size="sm" onClick={onVerTodas}>Ver todas</PulsoButton>}
            />
          ) : (
            <EstadoVacio
              tamano="normal"
              icono={<Inbox size={18} />}
              titulo="Sin preguntas en esta base"
              descripcion="El formulario de esta base no trae preguntas que se puedan codificar."
            />
          )}
        </div>
      ) : (
        secciones.map((seccion, i) => (
          <div key={seccion.id} className="pulso-preg-seccion" role="group" aria-labelledby={`${idBase}-${i}`}>
            <h4 id={`${idBase}-${i}`} className="pulso-preg-seccion-rotulo">{seccion.rotulo}</h4>
            <ul className="pulso-preg-filas">
              {seccion.unidades.map((unidad) => (
                <FilaUnidad
                  key={unidad.id}
                  unidad={unidad}
                  seleccionada={seleccion === unidad.id}
                  tabulable={tabulable === unidad.id}
                  ocupada={ocupada === unidad.id}
                  reciente={recienUnida === unidad.id}
                  papel={papelDe(unidad, levantada)}
                  onSeleccionar={onSeleccionar}
                  onEmparejar={onEmparejar}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
