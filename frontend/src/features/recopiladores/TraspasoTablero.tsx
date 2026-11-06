// Aulas › Entrega › Traspaso con el kit (pasada de diseño, 2 nov 2026; Gonzalo aprobó
// la vara de la vista faro: «Sí, extiéndelo»). Era el n.º 3 del ranking: dos vacíos de
// letra grande que decían lo mismo y cuatro filas de «—». Aquí el traspaso se lee
// como un recorrido —qué paso está hecho y cuál falta, con su acción— y el recibo
// pendiente enseña lo que va a llevar en vez de un hueco.

import type { ReactNode } from "react";

import { CheckCircle2, Circle } from "../../vendor/lucide-react";
import "./styles/traspasoTablero.css";

export type PasoDelTraspaso = {
  id: string;
  titulo: string;
  hecho: boolean;
  detalle: ReactNode;
  accion?: ReactNode;
};

export function RecorridoDelTraspaso({ pasos }: { pasos: readonly PasoDelTraspaso[] }) {
  return (
    <ol className="rec-tras-pasos">
      {pasos.map((p, i) => (
        <li key={p.id} data-hecho={p.hecho || undefined}>
          <span className="rec-tras-marca" aria-hidden>
            {p.hecho ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            {i < pasos.length - 1 ? <span className="rec-tras-hilo" /> : null}
          </span>
          <span className="rec-tras-texto">
            <strong>{p.titulo}</strong>
            <span>{p.detalle}</span>
          </span>
          <span className="rec-tras-accion">
            {p.accion ?? <span className="rec-tras-estado" data-hecho={p.hecho || undefined}>{p.hecho ? "Hecho" : "Pendiente"}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Antes de entregar: el recibo que se va a firmar, con sus campos todavía por llenar. */
export function ReciboPendiente({ motivo }: { motivo: string }) {
  return (
    <article className="rec-tras-recibo" role="status">
      <header>
        <strong>Aún no se entrega a Monitoreo</strong>
        <span>{motivo}</span>
      </header>
      <dl>
        {["Fecha", "Revisión", "Plan", "Accesos"].map((campo) => (
          <div key={campo}>
            <dt>{campo}</dt>
            <dd>al entregar</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
