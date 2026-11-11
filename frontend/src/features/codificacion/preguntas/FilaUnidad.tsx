import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { PreguntaAbierta } from "../../../api/codificacion";
import { BloquePregunta } from "../../../components/procesamiento/BloquePregunta";
import { textoPlano } from "../../../lib/textoPlano";
import { GripVertical } from "../../../vendor/lucide-react";
import { EstadoUnidad } from "./EstadoUnidad";
import { LazoUnidad } from "./LazoUnidad";
import { admiteEmparejar, cifrasDeUnidad, formaDeUnidad, tipoDeFicha, type DestinoDeArrastre, type Unidad } from "./modeloUnidades";

/** El papel de la fila mientras se arrastra otra: de dónde salió, si la recibe o si queda fuera. */
export type PapelEnArrastre = "origen" | DestinoDeArrastre | "fuera";

export type FilaUnidadProps = {
  unidad: Unidad;
  seleccionada: boolean;
  /** La fila por la que el tabulador entra a la lista; las demás se alcanzan con las flechas. */
  tabulable: boolean;
  ocupada: boolean;
  reciente: boolean;
  /** Sin arrastre en curso no hay papel. */
  papel: PapelEnArrastre | null;
  onSeleccionar: (id: string) => void;
  onEmparejar: (unidad: Unidad) => void;
};

/** El bloque de una pregunta de la lista: su código, su tipo y su etiqueta sin marcado. */
function bloqueDe(p: PreguntaAbierta) {
  const etiqueta = textoPlano(p.parent_label);
  return { tipo: tipoDeFicha(p.tipo), codigo: etiqueta ? p.parent : undefined, etiqueta: etiqueta || p.parent };
}

/**
 * Una unidad de la lista. Una pareja son dos bloques con el nodo de enlace en medio (a la izquierda la
 * pregunta que recibe los códigos, a la derecha la que aporta las respuestas); una abierta sin
 * pareja, un bloque a todo el ancho con el nodo punteado al final; una cerrada sin texto, su bloque a
 * la izquierda y el nodo punteado a continuación. A la derecha, en su columna, el estado.
 *
 * La fila se selecciona con su botón y se levanta con el asa (o arrastrándola con el puntero). El nodo
 * punteado es donde se suelta la otra pregunta, y al pulsarlo abre el selector para elegirla.
 */
export function FilaUnidad({ unidad, seleccionada, tabulable, ocupada, reciente, papel, onSeleccionar, onEmparejar }: FilaUnidadProps) {
  const empareja = admiteEmparejar(unidad);
  const arrastrable = useDraggable({ id: unidad.id, disabled: !empareja });
  const destino = useDroppable({ id: unidad.id, disabled: !empareja });
  const forma = formaDeUnidad(unidad);
  const cifras = cifrasDeUnidad(unidad);

  return (
    <li
      ref={(nodo) => {
        arrastrable.setNodeRef(nodo);
        destino.setNodeRef(nodo);
      }}
      {...(empareja ? arrastrable.listeners : undefined)}
      className="pulso-preg-fila"
      data-qa-geometry-member=""
      data-unidad={unidad.id}
      data-clase={unidad.clase}
      data-forma={forma}
      data-nodo={empareja ? "" : undefined}
      data-seleccionada={seleccionada ? "" : undefined}
      data-ocupada={ocupada ? "" : undefined}
      data-arrastre={papel ?? undefined}
      data-sobre={destino.isOver && papel !== null && papel !== "origen" && papel !== "fuera" ? "" : undefined}
    >
      <button
        type="button"
        className="pulso-preg-fila-boton"
        data-fila-boton={unidad.id}
        tabIndex={tabulable ? 0 : -1}
        aria-current={seleccionada ? "true" : undefined}
        aria-busy={ocupada || undefined}
        onClick={() => onSeleccionar(unidad.id)}
      >
        <span className="pulso-preg-lados">
          {forma === "pareja" ? (
            <>
              <BloquePregunta {...bloqueDe(unidad.principal)} />
              <span className="pulso-sr-only">emparejada con</span>
              <LazoUnidad forma="unido" reciente={reciente} />
              {unidad.aporta ? (
                <BloquePregunta {...bloqueDe(unidad.aporta)} detalle={cifras} />
              ) : (
                <BloquePregunta tipo="texto" etiqueta={unidad.columnaTexto} detalle={cifras} />
              )}
            </>
          ) : (
            <BloquePregunta {...bloqueDe(unidad.principal)} detalle={cifras} ancho={forma === "abierta" ? "completo" : "lado"} />
          )}
        </span>
        <span className="pulso-preg-fila-estado">
          <EstadoUnidad unidad={unidad} />
        </span>
      </button>
      {/* El nodo punteado y el asa van después del botón en el marcado (el foco llega primero a la fila). */}
      {empareja ? (
        <LazoUnidad
          forma="suelto"
          rotulo={`Emparejar ${unidad.id} con otra pregunta`}
          onPulsar={() => {
            onSeleccionar(unidad.id);
            onEmparejar(unidad);
          }}
        />
      ) : null}
      {empareja ? (
        <button
          type="button"
          ref={arrastrable.setActivatorNodeRef}
          {...arrastrable.attributes}
          tabIndex={tabulable ? 0 : -1}
          className="pulso-preg-asa"
          aria-label={`Arrastrar ${unidad.id} sobre otra pregunta para emparejarlas`}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
      ) : (
        <span className="pulso-preg-asa" data-quieta="" aria-hidden="true" />
      )}
    </li>
  );
}
