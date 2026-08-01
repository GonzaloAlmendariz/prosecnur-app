// Un vacío que dice en qué punto está el proyecto y por dónde se sale.
//
// El marco se comparte; la copia no. Un vacío genérico —«Resumen pendiente ·
// Todavía no hay un panel local preparado»— es el que hay que evitar: dice que
// no hay nada y nada más. Cada superficie sabe qué le falta y adónde mandar a
// quien la mira, y eso no se puede parametrizar desde aquí sin volver a
// escribir una frase que valga para todas y no sirva para ninguna.
//
// De ahí el reparto: este componente pone el recuadro, el icono, la jerarquía y
// la acción; quien lo usa pone el título, el dato y el destino.

import type { ReactNode } from "react";
import type { LucideIcon } from "../../../vendor/lucide-react";
import "./vacioConSalida.css";

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
    <div className="mon-profile-empty mon-vacio-con-salida">
      <span className="mon-profile-empty__icon"><Icon size={18} /></span>
      <strong>{titulo}</strong>
      <p>{dato}</p>
      {accion ? (
        <button type="button" className="mon-vacio-con-salida__accion" onClick={accion.onClick}>
          {accion.label}
        </button>
      ) : null}
    </div>
  );
}
