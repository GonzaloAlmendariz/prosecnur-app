/**
 * **Los viajes al campus por UNA sola aula, con el motivo de cada uno.**
 *
 * Dictado de Gonzalo (2026-09-04): «que todos tengan asignaciones el mismo día
 * y no vengan en días diferentes, o aunque sea por lo menos vengan por dos
 * aplicaciones». El motor lo cumple hasta donde la física deja: sobre el
 * operativo bajó de dieciocho viajes solitarios a nueve. Los que quedan no son
 * un fallo del reparto, y enseñarlos como un número suelto invita justo a
 * pensar que sí.
 *
 * De los nueve medidos uno por uno: tres caen en días con una sola cita
 * agendada, dos son un choque de hora —dos aulas a las 19:30 del mismo martes,
 * hacen falta dos personas sí o sí— y el resto lo bloquean horarios y solapes.
 * Sólo en dos el obstáculo era el tope del día, y ésa es la única causa que el
 * usuario puede resolver desde esta misma tabla, fijando la cita a mano.
 *
 * Por eso la causa se dice con nombres y no como categoría: «Manayay podría,
 * pero ya lleva 4» permite decidir; «bloqueado» no. Es el mismo criterio del
 * aviso de descubiertos, que ya nombraba a quién soltar.
 */
import { fmt } from "./kpisDeAulas";
import { nombreDeAplicador } from "./nombreDeAplicador";
import type { SalidaDeViajeSolitario } from "./salidasDelReparto";

/**
 * El motivo, en palabras y con la gente nombrada.
 *
 * Se devuelve como texto y no como nodo porque las cuatro causas caben en una
 * línea: el bloque es una lista de diagnóstico, no una ficha.
 */
export function motivoDelViaje(s: SalidaDeViajeSolitario): string {
  if (s.causa === "dia-de-una-cita") {
    return "ese día no hay ningún otro curso-horario agendado con el que juntarlo";
  }
  if (s.causa === "tope") {
    const quienes = s.frenadosPorTope
      .map((f) => `${nombreDeAplicador(f.aplicador)} lleva ${fmt(f.lleva)}`)
      .join(", ");
    return `podría llevársela quien ya está ese día, pero llegó al tope: ${quienes}`;
  }
  if (s.causa === "ocupados") {
    const quienes = s.ocupados
      .map((o) => `${nombreDeAplicador(o.aplicador)} está en ${o.porCodigo}`)
      .join(", ");
    return `a esa hora los demás del día están ocupados: ${quienes}`;
  }
  return "de quienes vienen ese día, ninguno declaró ese horario";
}

/**
 * Cuáles se resuelven desde aquí y cuáles no.
 *
 * `tope` es la única accionable sin tocar la agenda: se fija la cita a mano en
 * la tabla y el motor respeta la fijación. Las otras tres piden mover una cita
 * o conseguir gente, que es una decisión de campo y no del reparto.
 */
const ACCIONABLE = new Set<SalidaDeViajeSolitario["causa"]>(["tope"]);

export default function AulasViajesSolitarios({
  viajes,
}: {
  viajes: SalidaDeViajeSolitario[];
}) {
  if (viajes.length === 0) return null;
  const accionables = viajes.filter((v) => ACCIONABLE.has(v.causa)).length;
  return (
    <details className="aulas-asigna-solitarios">
      <summary>
        {fmt(viajes.length)}{" "}
        {viajes.length === 1 ? "viaje" : "viajes"} por una sola aula: por qué
        {accionables > 0 ? `, y ${fmt(accionables)} que puedes resolver` : ""}
      </summary>
      <ul>
        {viajes.map((v) => (
          <li
            key={[v.aplicador, v.fecha, v.codigo].join("\r")}
            className={ACCIONABLE.has(v.causa) ? "es-accionable" : undefined}
          >
            <strong>{nombreDeAplicador(v.aplicador)}</strong>{" "}
            <span className="aulas-asigna-solitarios-cita">
              {v.etiqueta} · {v.codigo} · {v.desdeRecojo} a {v.hasta}
            </span>
            <span className="aulas-asigna-solitarios-motivo">{motivoDelViaje(v)}</span>
          </li>
        ))}
      </ul>
      <p className="aulas-asigna-solitarios-nota">
        {accionables > 0
          ? "Los que se pueden resolver salen marcados: fija esa cita a mano en la tabla y el reparto la respeta."
          : "Ninguno de estos se resuelve desde el reparto. Para cerrarlos habría que mover una cita de día o de hora, o sumar disponibilidad a esas horas."}
      </p>
    </details>
  );
}
