import { useMemo } from "react";
import { contar } from "../../fuentes/vocabulario";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { consumoDeCadena } from "./consumoDeCadena";

/** De cadena intacta a cadena muy consumida: el color acompaña el desgaste. */
const TONOS = [
  COLOR_RESULTADO.efectiva,
  COLOR_RESULTADO.parcial,
  COLOR_RESULTADO.rechazo,
  COLOR_RESULTADO.rechazo,
];

const fmt = (n: number) => n.toLocaleString("es-PE");

/**
 * Cuánta reserva lleva gastada el operativo.
 *
 * La tabla de reemplazos dice, aula por aula, cuál entró y por qué. Lo que no
 * dice es si el **plan** aguanta: para eso hay que contar cuántas cadenas siguen
 * intactas y cuántas van por el tercer eslabón. El estudio de 2025 planificó
 * cadenas de hasta once y consumió dos.
 */
export function AulasCadenaChart({ filas }: { filas: ReadonlyArray<MonitoreoAulasPlanRow> }) {
  const { tramos, sinReserva, reservasLibres, reservasGastadas, cadenas } = useMemo(
    () => consumoDeCadena(filas),
    [filas],
  );

  if (!cadenas) {
    return (
      <p className="mon-profile-muted">
        {sinReserva
          // No es lo mismo «no hay plan» que «el plan no dotó reservas»: la
          // segunda es una decisión de la muestra y hay que poder verla (L54).
          ? `Ninguno de los ${sinReserva} cursos-horario titulares tiene reserva en el plan.`
          : "El plan todavía no declara cadenas de reemplazo."}
      </p>
    );
  }

  const total = tramos.reduce((suma, t) => suma + t.cadenas, 0);
  // El tramo más profundo que de verdad ocurrió. Con él se puede decir en
  // palabras lo que dos barras en cero decían en blanco.
  const masProfundo = tramos.reduce(
    (max, t, i) => (t.cadenas ? i : max),
    0,
  );

  return (
    <div className="aulas-cadena-chart">
      {/* Una franja y no cuatro barras: eran 200 px de tela para cuatro
          categorías de las que DOS venían en cero, así que media lámina salía
          en blanco sin que el blanco dijera nada. Repartidas en una sola barra
          se lee de un golpe la proporción —dos tercios de las cadenas ya
          gastaron una reserva— y caben los ceros escritos debajo, que es donde
          por fin se leen. */}
      <div
        className="aulas-consumo-franja"
        role="img"
        aria-label={`Cadenas por reservas consumidas: ${tramos.map((t) => `${t.etiqueta}, ${t.cadenas}`).join("; ")}`}
      >
        {tramos.map((tramo, i) => (
          tramo.cadenas ? (
            <span
              key={tramo.etiqueta}
              style={{ flexGrow: tramo.cadenas, background: TONOS[i] }}
              title={`${tramo.etiqueta}: ${fmt(tramo.cadenas)}`}
            />
          ) : null
        ))}
      </div>
      {/* Los cuatro tramos, con sus ceros. Un tramo vacío NO desaparece: que
          ninguna cadena llegara al segundo reemplazo es un resultado medido, y
          borrarlo dejaría la franja diciendo lo mismo que si el tramo no
          existiera (verde por conformidad, no por ausencia). */}
      <ul className="aulas-consumo-leyenda">
        {tramos.map((tramo, i) => (
          <li key={tramo.etiqueta} className={tramo.cadenas ? "" : "es-cero"}>
            <i aria-hidden="true" style={{ background: TONOS[i] }} />
            {tramo.etiqueta}
            <strong>{fmt(tramo.cadenas)}</strong>
          </li>
        ))}
      </ul>
      <p className="aulas-cadenas-lectura">
        {masProfundo === 0
          ? `Ninguna de las ${fmt(total)} cadenas ha gastado reserva.`
          : `Ninguna cadena pasó de ${tramos[masProfundo].etiqueta.toLowerCase()}.`}
      </p>
      <p className="mon-profile-table-recorte">
        {reservasGastadas
          ? `${contar(reservasGastadas, "reserva gastada", "reservas gastadas")} y ${reservasLibres} todavía en el banco.`
          : `Ninguna reserva gastada: las ${reservasLibres} del plan siguen en el banco.`}
        {sinReserva
          ? ` ${sinReserva} ${sinReserva === 1 ? "titular no tiene" : "titulares no tienen"} ninguna reserva, así que ${sinReserva === 1 ? "su meta queda" : "sus metas quedan"} sin cubrir si ${sinReserva === 1 ? "cae" : "caen"}.`
          : ""}
      </p>
    </div>
  );
}
