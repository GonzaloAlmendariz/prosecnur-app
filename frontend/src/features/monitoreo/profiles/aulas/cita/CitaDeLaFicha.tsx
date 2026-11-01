import { CalendarClock } from "lucide-react";

import { fmt } from "../kpisDeAulas";
import { fechaEnPalabras, type LecturaDeCita } from "./lecturaDeCita";
import "./cita.css";

/**
 * P4 · Bloque de la ficha del curso-horario para la cita vencida o reagendada.
 * Las salidas que se resuelven en la hoja (P5, «manda la hoja») se nombran con
 * su sitio; la única que vive en la app —activar el reemplazo— es un botón.
 */
export function CitaDeLaFicha({ lectura, codigo, onReemplazar }: {
  lectura: LecturaDeCita;
  codigo: string;
  onReemplazar?: ((codigo: string) => void) | null;
}) {
  if (lectura.caso === "vencida") {
    return (
      <section className="aulas-cita" data-caso="vencida" aria-label="Cita vencida">
        <header>
          <CalendarClock size={16} aria-hidden="true" />
          <b>La cita venció</b>
          <span>
            Citada el {fechaEnPalabras(lectura.citada)}, hace {fmt(lectura.dias)} {lectura.dias === 1 ? "día" : "días"}, sin parte ni respuestas
            {lectura.yaReagendada ? "; ya se había reagendado una vez" : ""}.
          </span>
        </header>
        <ol className="aulas-cita-salidas">
          <li>
            <b>Reagendar</b>
            <span>La fecha nueva se teclea en la agenda del libro; «Actualizar» la recoge.</span>
          </li>
          <li>
            <b>Reemplazar</b>
            <span>Si el docente ya no la da, entra la siguiente reserva de su cadena.</span>
            {onReemplazar ? (
              <button type="button" className="pulso-button pulso-button--secondary pulso-button--sm" onClick={() => onReemplazar(codigo)}>
                Activar el reemplazo
              </button>
            ) : null}
          </li>
          <li>
            <b>Darla por no aplicada</b>
            <span>Se anota «No aplicada» en el parte del libro: sale de la agenda y su meta queda por cubrir.</span>
          </li>
        </ol>
      </section>
    );
  }
  return (
    <section className="aulas-cita" data-caso="reagendada" aria-label="Cita reagendada">
      <header>
        <CalendarClock size={16} aria-hidden="true" />
        <b>Cita reagendada</b>
        <span>
          {!lectura.conParte
            ? `El equipo la movió al ${fechaEnPalabras(lectura.citada)}; todavía no hay parte.`
            : lectura.coincide === false
              ? `La agenda la cita el ${fechaEnPalabras(lectura.citada)} y el parte dice que se aplicó el ${fechaEnPalabras(lectura.aplicada)}. La fecha se corrige en la hoja que esté mal.`
              : lectura.coincide
                ? `Se aplicó el ${fechaEnPalabras(lectura.citada)}, en la fecha reagendada.`
                : `El equipo la movió al ${fechaEnPalabras(lectura.citada)}; el parte no anota la fecha de aplicación.`}
        </span>
      </header>
    </section>
  );
}
