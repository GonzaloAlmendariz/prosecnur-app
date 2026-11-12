import { useDraggable, useDroppable } from "@dnd-kit/core";
import { sinMarcadores } from "../sugerenciasModulo";
import type { PreguntaAbierta } from "../../../api/codificacion";
import { BloquePregunta } from "../../../components/procesamiento/BloquePregunta";
import { FichaPregunta } from "../../../components/procesamiento/FichaPregunta";
import { formatoConteo } from "../../../lib/formatoNumero";
import { textoPlano } from "../../../lib/textoPlano";
import { ArrowRight, GripVertical } from "../../../vendor/lucide-react";
import { AnilloDeAvance } from "./AnilloDeAvance";
import { EstadoUnidad } from "./EstadoUnidad";
import { LazoUnidad } from "./LazoUnidad";
import { useAvances, unidadesConAvance } from "../avanceStore";
import { porcentajeDeAvance } from "../avanceDeCodificacion";
import { tipoResultanteActivo } from "../codificar/tipoResultante";
import { admiteEmparejar, cifrasDeUnidad, formaDeUnidad, resultanteDeUnidad, tipoDeFicha, type DestinoDeArrastre, type Unidad } from "./modeloUnidades";

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
  const etiqueta = sinMarcadores(textoPlano(p.parent_label));
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
  // El avance y el tipo de una abierta ya codificada salen de sus respuestas (avanceStore.ts), lo mismo que
  // en Codificar; mientras no se leen, la fila va sin anillo.
  const dato = useAvances((s) => s.porPregunta[unidad.principal.parent]);
  const conAvance = unidadesConAvance([unidad]).length > 0;
  const avance = conAvance && dato ? dato.avance : null;
  const resultante = resultanteDeUnidad(unidad) ?? (dato?.grupos ? tipoResultanteActivo(unidad.principal, unidad.arquetipo, dato.grupos) : null);

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
        {/* C1: los lados de la unidad (pregunta cerrada, lazo y texto) son piezas distintas, no pares. */}
        <span className="pulso-preg-lados" data-qa-geometry-group="codificacion/preguntas-lados" data-qa-geometry-contract="intrinsic">
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
        <span className="pulso-preg-res">
          {resultante ? (
            <>
              <ArrowRight size={16} className="pulso-preg-res-flecha" aria-label="sale como" />
              {resultante.tipo ? (
                <FichaPregunta tipo={resultante.tipo} etiqueta={resultante.rotulo} />
              ) : (
                <span className="pulso-cc-por-definir">{resultante.rotulo}</span>
              )}
              {resultante.leyenda ? <small className="pulso-preg-res-leyenda">{resultante.leyenda}</small> : null}
            </>
          ) : null}
        </span>
        <span className="pulso-preg-fila-estado">
          {avance && avance.casos > 0 ? (
            <AnilloDeAvance
              porcentaje={porcentajeDeAvance(avance)}
              detalle={`${formatoConteo(avance.casosConCodigo)} de ${formatoConteo(avance.casos)} ${avance.casos === 1 ? "respuesta" : "respuestas"} con código`}
            />
          ) : null}
          <EstadoUnidad unidad={unidad} avance={avance} />
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
