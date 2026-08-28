/**
 * El letrero de fijaciones pendientes (hallazgo del click-test EF8c): al
 * fijar titulares de una facultad, la selección se invalida en cadena — y
 * este aviso NOMBRA la causa y el camino, para que el analista no vea
 * desaparecer su selección sin explicación. Sin fijas pendientes no pinta
 * nada.
 */
import { Pin } from "lucide-react";
import { fijasPendientes, type FijaPendiente } from "./certificacionAcciones";
import "./docenteUnico.css";

export function FijasPendientesAviso({
  estratos,
  aulasPorEstrato,
}: {
  estratos: Parameters<typeof fijasPendientes>[0];
  aulasPorEstrato: Parameters<typeof fijasPendientes>[1];
}) {
  const pendientes: FijaPendiente[] = fijasPendientes(estratos, aulasPorEstrato);
  if (!pendientes.length) return null;

  // «Fijaste a mano los titulares de 15 facultades» era falso en el caso más
  // común: al ajustar UNA facultad el resultado se invalida entero, así que
  // ninguna fijación tiene ya un número calculado contra el que compararse y
  // las quince salían como recién tocadas. Cuando NO hay cálculo vigente, lo
  // que hay que decir es que el cálculo está pendiente y éstas son las
  // fijaciones que se aplicarán —no que el analista acaba de escribirlas.
  const sinCalculo = pendientes.every((p) => p.calculada == null);
  const n = pendientes.length;

  return (
    <section className="cmv2-docente-unico" aria-label="Fijaciones pendientes de recalcular">
      <header>
        <Pin size={14} aria-hidden="true" />
        <strong>
          {sinCalculo
            ? n === 1
              ? "1 facultad tiene los titulares fijados a mano"
              : `${n} facultades tienen los titulares fijados a mano`
            : n === 1
              ? "Fijaste a mano los titulares de 1 facultad"
              : `Fijaste a mano los titulares de ${n} facultades`}
        </strong>
        <span>
          {sinCalculo
            ? "el cálculo quedó pendiente, así que ninguna está aplicada todavía; recalcula la propuesta y vuelve a seleccionar"
            : "una fijación reemplaza al número que la fórmula calcula; para que el sorteo la use: recalcula la propuesta y vuelve a seleccionar"}
        </span>
      </header>
      <ul>
        {pendientes.map((p) => (
          <li key={p.facultad}>
            <b>{p.facultad}</b>
            <span className="cmv2-docente-unico-swap">
              {sinCalculo ? "quedará en" : "tendrá"} {p.fijada} titulares{p.calculada != null ? ` — la fórmula calculaba ${p.calculada}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
