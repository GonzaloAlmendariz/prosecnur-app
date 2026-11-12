import { memo, type ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { formatoConteo } from "../../../lib/formatoNumero";
import { InsigniaCodigo } from "../tabla/InsigniaCodigo";
import type { FilaDeRespuesta } from "./modeloDeCodificar";
import { modoDeClic, type ModoDeSeleccion } from "./seleccionRespuestas";

/** Id de arrastre de una respuesta. */
export function idDeArrastre(clave: string): string {
  return `respuesta:${clave}`;
}

/** La clave de la respuesta que se arrastra, a partir de su id. */
export function claveDeArrastre(id: string | number): string {
  return String(id).replace(/^respuesta:/, "");
}

export type FilaRespuestaProps = {
  fila: FilaDeRespuesta;
  /** Posición entre lo que pinta la lista, contando desde cero. */
  indice: number;
  seleccionada: boolean;
  /** La fila por la que el tabulador entra a la lista; a las demás se llega con las flechas. */
  tabulable: boolean;
  /** Va en el lote que se está arrastrando. */
  levantada: boolean;
  /** Lo que la mesa agrega a la fila: la propuesta de módulo de un texto abierto. */
  extra?: ReactNode;
  onPulsar: (clave: string, modo: ModoDeSeleccion) => void;
  onQuitar: (clave: string, grupoId: string) => void;
  /** Recibe el elemento de la fila: lo usa la medición de la lista virtual. */
  alMontar?: (elemento: HTMLLIElement | null) => void;
};

/**
 * Una respuesta de la lista. En el primer renglón, el texto entero con todo el ancho que dejan los códigos
 * que lleva y sus veces; en el segundo, solo si hay algo que decir, la propuesta de módulo (con su acción
 * de confirmar) y las variantes, en letra secundaria. Se elige con un clic (Mayús para el tramo, Cmd o
 * Ctrl para sumar) y se arrastra desde cualquier punto de la fila a la tarjeta de un código.
 */
export const FilaRespuesta = memo(function FilaRespuesta({
  fila,
  indice,
  seleccionada,
  tabulable,
  levantada,
  extra,
  onPulsar,
  onQuitar,
  alMontar,
}: FilaRespuestaProps) {
  const arrastre = useDraggable({ id: idDeArrastre(fila.clave) });
  const conExtra = extra !== null && extra !== undefined && extra !== false;

  return (
    <li
      ref={(nodo) => {
        arrastre.setNodeRef(nodo);
        alMontar?.(nodo);
      }}
      {...arrastre.listeners}
      className="pulso-cc-fila pulso-cv2-resp-row"
      data-qa-geometry-member=""
      data-index={indice}
      data-seleccionada={seleccionada ? "" : undefined}
      data-levantada={levantada ? "" : undefined}
      data-sin-codigo={fila.codigos.length === 0 ? "" : undefined}
      onClick={(evento) => onPulsar(fila.clave, modoDeClic(evento))}
    >
      {/* La casilla del prototipo: elige o suelta la respuesta sin tocar las demás. La fila entera se sigue
          arrastrando y eligiendo con clic, Mayús y Cmd o Ctrl como antes. */}
      <button
        type="button"
        className="pulso-ct-casilla pulso-cc-fila-asa"
        aria-pressed={seleccionada}
        aria-label={`${seleccionada ? "Soltar" : "Elegir"} "${fila.texto}"`}
        tabIndex={-1}
        onClick={(evento) => {
          evento.stopPropagation();
          onPulsar(fila.clave, "alternar");
        }}
      />
      <button
        type="button"
        className="pulso-cc-fila-boton"
        data-fila-respuesta={fila.clave}
        tabIndex={tabulable ? 0 : -1}
        aria-pressed={seleccionada}
        title={fila.titulo}
      >
        {fila.codigoDeRespuesta ? <code className="pulso-cv2-resp-code">{fila.codigoDeRespuesta}</code> : null}
        {fila.texto}
      </button>
      {fila.codigos.length > 0 ? (
        // Un clic en un código actúa sobre el código: no cambia la selección.
        <div className="pulso-cc-fila-codigos" onClick={(evento) => evento.stopPropagation()}>
          {fila.codigos.map((codigo) => (
            <InsigniaCodigo
              key={codigo.id}
              codigo={codigo}
              respuesta={fila.texto}
              enfocable={tabulable}
              onQuitar={() => onQuitar(fila.clave, codigo.id)}
            />
          ))}
        </div>
      ) : null}
      <span className="pulso-cc-fila-veces">
        {formatoConteo(fila.veces)} {fila.veces === 1 ? "vez" : "veces"}
      </span>
      {conExtra ? (
        // La propuesta de módulo, bajo el texto: un clic la confirma sin cambiar la selección.
        <div className="pulso-cc-fila-sugerencia" onClick={(evento) => evento.stopPropagation()}>
          {extra}
        </div>
      ) : null}
      {fila.variantes > 1 ? <span className="pulso-cc-fila-variantes">{formatoConteo(fila.variantes)} variantes</span> : null}
    </li>
  );
});
