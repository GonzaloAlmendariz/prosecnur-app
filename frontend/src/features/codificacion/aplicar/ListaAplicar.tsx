// Las preguntas que se aplican, una fila por pregunta y sin acordeones. Es una
// lista con selección: la fila elegida muestra su desglose por código en el
// panel de detalle. Se elige con clic o con las flechas (también Inicio y Fin);
// la selección sigue al foco y no escribe nada en la dirección.
//
// C1: la lista es el contenedor de datos y declara su contrato. Es intrínseco:
// una etiqueta larga parte en dos renglones y su fila mide lo que su contenido.
// No tiene scroll propio; el dueño es el cuerpo de su panel.

import { useRef, type KeyboardEvent } from "react";

import type { PlanPregunta } from "../../../api/dashboard";
import { FilaAplicar } from "./FilaAplicar";
import { claveDePregunta, filaDeAplicar, filaTrasTecla } from "./modeloAplicar";

type Props = {
  preguntas: readonly PlanPregunta[];
  /** `claveDePregunta` de la fila elegida. */
  elegida: string | null;
  onElegir: (clave: string) => void;
  /** El panel de detalle que esta lista gobierna. */
  idDeDetalle?: string;
};

export function ListaAplicar({ preguntas, elegida, onElegir, idDeDetalle }: Props) {
  const lista = useRef<HTMLUListElement>(null);

  const alPulsar = (evento: KeyboardEvent<HTMLLIElement>, desde: number) => {
    const destino = filaTrasTecla(evento.key, desde, preguntas.length);
    if (destino == null) return;
    evento.preventDefault();
    if (destino === desde) return;
    onElegir(claveDePregunta(preguntas[destino]));
    // El foco acompaña a la selección; la fila se trae a la vista dentro de su dueño de scroll.
    const fila = lista.current?.children[destino];
    if (fila instanceof HTMLElement) {
      fila.focus({ preventScroll: true });
      fila.scrollIntoView?.({ block: "nearest" });
    }
  };

  return (
    <ul
      ref={lista}
      className="pulso-aplicar-lista"
      role="listbox"
      aria-label="Preguntas por aplicar"
      aria-orientation="vertical"
      aria-controls={idDeDetalle}
      data-qa-geometry-group="codificacion/aplicar-preguntas"
      data-qa-geometry-contract="intrinsic"
    >
      {preguntas.map((p, i) => {
        const clave = claveDePregunta(p);
        return (
          <FilaAplicar
            key={`${clave}::${i}`}
            // Con una sola pregunta, sus conteos de códigos son los de la franja: la fila no los repite.
            fila={filaDeAplicar(p, { unica: preguntas.length === 1 })}
            elegida={clave === elegida}
            onElegir={() => onElegir(clave)}
            onTecla={(evento) => alPulsar(evento, i)}
          />
        );
      })}
    </ul>
  );
}
