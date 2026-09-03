import { calendarioDeAgenda } from "./calendarioDeAgenda";
import type { DiaDeAgenda } from "./agendaPorDia";
import { fmt } from "./kpisDeAulas";
import "./aulasCalendarioDeAgenda.css";

/**
 * La agenda como calendario: semanas de lunes a domingo entre el primer y el
 * último día agendado, cada celda con su día del mes y su cuenta.
 *
 * Reemplaza a la franja de chips de la Agenda por día (dictado 2026-09-01):
 * la lista decía la carga de cada fecha pero no su FORMA de semana — qué días
 * quedan libres, si el campo cae en fin de semana, cuánto falta desde hoy.
 * Una tabla de verdad, no un grid decorativo: las columnas se leen de la
 * cabecera y cada fecha de su posición.
 *
 * La colocación la hace `calendarioDeAgenda` (helper puro con su suite) sobre
 * el `dias` que ya produce `agendaPorDia`: aquí no se recalcula ningún
 * agregado. Lo que no cabe en un calendario se declara en repisas —sin fecha,
 * fechas que no existen, días más allá del lienzo— en vez de esfumarse (C3).
 */

const COLUMNAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export function AulasCalendarioDeAgenda({ dias, hoy }: {
  dias: ReadonlyArray<DiaDeAgenda>;
  /** La fecha local del usuario en ISO; entra como dato para que el markup
   *  de un día concreto sea el mismo se mire cuando se mire. */
  hoy: string;
}) {
  const cal = calendarioDeAgenda(dias, hoy);
  // El grupo sin fecha no tiene celda: es la repisa de la superficie.
  const sinFecha = dias.find((d) => !d.fecha)?.aulas ?? 0;
  // La familia del DÍA QUE TOCA (B43/B46/B49) también vive aquí: la primera
  // fecha no pasada CON agenda lleva su anillo — el agendador ve en el mapa
  // del mes cuál es el despliegue inminente.
  const fechaQueToca = cal.semanas
    .flat()
    .filter((c) => c.enRango && c.aulas > 0 && c.fecha >= hoy)
    .map((c) => c.fecha)
    .sort()[0] ?? null;

  if (!cal.semanas.length && !cal.fechasIlegibles.length) return null;

  return (
    <div className="aulas-calendario" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      {cal.semanas.length ? (
        <table className="aulas-calendario-tabla">
          <caption className="aulas-calendario-titulo">{cal.titulo}</caption>
          <thead>
            <tr>
              {COLUMNAS.map((col) => <th key={col} scope="col">{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {cal.semanas.map((semana) => (
              <tr key={semana[0].fecha}>
                {semana.map((celda) => (
                  <td
                    key={celda.fecha}
                    className={[
                      celda.enRango ? "" : "es-relleno",
                      celda.esHoy ? "es-hoy" : "",
                      celda.aulas ? "tiene-agenda" : "",
                      celda.fecha === fechaQueToca ? "es-el-que-toca" : "",
                    ].filter(Boolean).join(" ") || undefined}
                    aria-current={celda.esHoy ? "date" : undefined}
                    title={celda.fecha === fechaQueToca ? "El día que toca: el despliegue inminente" : undefined}
                  >
                    <span className="aulas-calendario-num">{celda.diaDelMes}</span>
                    {celda.aulas ? (
                      /* La misma lectura que la franja vieja, pronunciada como
                         dos cifras separadas por palabras: el guard de
                         «193 sin empezar» sigue vigilando este label. */
                      <span
                        className="aulas-calendario-carga"
                        aria-label={`${celda.aulas} ${celda.aulas === 1 ? "curso-horario" : "cursos-horario"}, ${
                          celda.sinEmpezar ? `${celda.sinEmpezar} sin empezar` : "todas con respuestas"
                        }`}
                      >
                        <strong aria-hidden="true">{celda.aulas}</strong>
                        {celda.sinEmpezar ? (
                          <em aria-hidden="true">{celda.sinEmpezar} sin empezar</em>
                        ) : null}
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {sinFecha ? (
        <p className="aulas-calendario-repisa">
          <strong>{fmt(sinFecha)}</strong> {sinFecha === 1 ? "curso-horario" : "cursos-horario"} sin
          fecha agendada: entran al calendario cuando el libro les dé un día.
        </p>
      ) : null}
      {cal.fueraDelLienzo.length ? (
        <p className="aulas-calendario-repisa es-aviso">
          Quedan fuera del calendario dibujado:{" "}
          {cal.fueraDelLienzo.map((d) => `${d.fecha} (${fmt(d.aulas)})`).join(", ")}. Si esas
          fechas no son del operativo, revísalas en el libro.
        </p>
      ) : null}
      {cal.fechasIlegibles.length ? (
        <p className="aulas-calendario-repisa es-aviso">
          {cal.fechasIlegibles.length === 1 ? "Una fecha del libro no existe" : "Fechas del libro que no existen"} y no
          {cal.fechasIlegibles.length === 1 ? " se puede" : " se pueden"} colocar:{" "}
          {cal.fechasIlegibles.map((d) => `${d.fecha} (${fmt(d.aulas)})`).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
