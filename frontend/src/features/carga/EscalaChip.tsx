// Chip de escala con su lista desplegable (ADR 0064).
//
// El chip decía la escala entera y la recortaba con puntos suspensivos a 240 px.
// Con cinco opciones —«Totalmente en desacuerdo / En desacuerdo / De acuerdo /
// Totalmente de acuerdo / SIN INF»— deformaba la cabecera de la tarjeta y no
// llegaba a decir la escala: lo que se leía era el principio de la primera
// opción. Aquí el chip dice lo que cabe —la escala corta entera, o cuántas
// opciones son— y el resto se despliega.
//
// El globo es el `Popover` del kit (portal + `position: fixed` anclado al
// chip, clamp al viewport, cierre por Escape y click fuera). Fijo y no
// absoluto porque la tarjeta de diapositiva tiene `overflow-x: auto`: un hijo
// posicionado dentro quedaría recortado por ese contenedor. El foco no sale
// del chip, así que no hay foco que devolver al cerrar.

import { ChevronDown } from "../../vendor/lucide-react";
import type { OpcionDeEscala } from "../../api/equivalencias";
import { Popover } from "../../components/Popover";

export type EscalaChipProps = {
  /** Resumen que cabe en el chip. */
  texto: string;
  /** Opciones enteras. Sin ellas el chip no despliega nada y no es un botón. */
  opciones: readonly OpcionDeEscala[];
  /** Qué describe esta escala, para el lector de pantalla. */
  contexto: string;
};

export function EscalaChip({ texto, opciones, contexto }: EscalaChipProps) {
  if (!texto) return null;

  // Sin opciones que desplegar no hay nada que abrir: se muestra como etiqueta y
  // no como control, para no ofrecer una afordancia que no lleva a ningún sitio.
  if (!opciones.length) {
    return <span className="pulso-equiv-chip-escala">{texto}</span>;
  }

  // Se ancla a la derecha del chip porque el chip vive al final de la cabecera;
  // así el globo crece hacia dentro de la tarjeta y no hacia fuera de la ventana.
  return (
    <Popover
      align="end"
      maxWidth={300}
      className="pulso-equiv-escala-globo"
      ariaLabel={`Opciones de la escala de ${contexto}`}
      trigger={
        <button
          type="button"
          className="pulso-equiv-chip-escala"
          aria-label={`Escala de ${contexto}: ${opciones.length} opciones`}
        >
          <span>{texto}</span>
          <ChevronDown size={11} aria-hidden="true" />
        </button>
      }
    >
      <p className="pulso-equiv-escala-globo-head">
        {opciones.length} opciones · {contexto}
      </p>
      <ol className="pulso-equiv-escala-lista">
        {opciones.map((o) => (
          <li key={o.codigo}>
            <span className="pulso-equiv-escala-codigo">{o.codigo}</span>
            <span>{o.etiqueta}</span>
          </li>
        ))}
      </ol>
    </Popover>
  );
}
