// Un vacío que dice en qué punto está el proyecto y por dónde se sale.
//
// El marco se comparte; la copia no. Un vacío genérico —«Resumen pendiente ·
// Todavía no hay un panel local preparado»— es el que hay que evitar: dice que
// no hay nada y nada más. Cada superficie sabe qué le falta y adónde mandar a
// quien la mira, y eso no se puede parametrizar desde aquí sin volver a
// escribir una frase que valga para todas y no sirva para ninguna.
//
// De ahí el reparto: este componente pone la receta del kit (`EstadoVacio` en
// tamaño `normal`, porque ocupa la sección entera) y la acción; quien lo usa
// pone el título, el dato y el destino.

import type { ReactNode } from "react";
import type { LucideIcon } from "../../../vendor/lucide-react";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";

export function VacioConSalida({
  icon: Icon,
  titulo,
  dato,
  accion,
}: {
  icon: LucideIcon;
  /** Qué falta. En una línea y sin sermón. */
  titulo: string;
  /** El dato de ESTE proyecto, que es lo que ocupa el hueco. */
  dato: ReactNode;
  /** Adónde se va a arreglarlo. Sin destino no se pinta. */
  accion?: { label: string; onClick: () => void };
}) {
  return (
    <EstadoVacio
      tamano="normal"
      icono={<Icon size={18} />}
      titulo={titulo}
      descripcion={dato}
      accion={accion ? (
        <PulsoButton type="button" variant="secondary" size="sm" onClick={accion.onClick}>
          {accion.label}
        </PulsoButton>
      ) : undefined}
    />
  );
}
