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
  return (
    <section className="cmv2-docente-unico" aria-label="Fijaciones pendientes de recalcular">
      <header>
        <Pin size={14} aria-hidden="true" />
        <strong>
          {pendientes.length} fijación{pendientes.length === 1 ? "" : "es"} pendiente{pendientes.length === 1 ? "" : "s"} de recalcular
        </strong>
        <span>recalcula la propuesta y vuelve a seleccionar para aplicarlas</span>
      </header>
      <ul>
        {pendientes.map((p) => (
          <li key={p.facultad}>
            <b>{p.facultad}</b>
            <span className="cmv2-docente-unico-swap">
              fijada en {p.fijada}{p.calculada != null ? ` (el cálculo vigente decía ${p.calculada})` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
