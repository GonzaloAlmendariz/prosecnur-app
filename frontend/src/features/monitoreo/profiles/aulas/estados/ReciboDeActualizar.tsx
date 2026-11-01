import { CheckCircle2, Info, X } from "lucide-react";

import { fmt } from "../kpisDeAulas";
import type { ReciboDeActualizar as Recibo } from "./useReciboDeActualizar";
import "./estados.css";

const NO_TOCA = [
  "No publica las hojas de la app",
  "No escribe en las hojas del equipo",
  "No toca la hoja de los aplicadores",
  "No cambia relevos ni refuerzos",
];

/** P1c · el recibo de Actualizar: los pasos reales, lo que cambió y lo que no se tocó. */
export function ReciboDeActualizar({ recibo, onCerrar }: { recibo: Recibo; onCerrar: () => void }) {
  return (
    <section className="aulas-recibo" role="status" aria-label="Recibo de Actualizar">
      <header>
        <b>Actualizado en {recibo.segundos.toFixed(1)} s</b>
        <button type="button" className="aulas-recibo-cerrar" aria-label="Cerrar el recibo" onClick={onCerrar}><X size={14} aria-hidden="true" /></button>
      </header>
      <ol className="aulas-recibo-pasos">
        {recibo.pasos.map((p) => (
          <li key={p.clave} data-tono={p.tono}>
            {p.tono === "ok" ? <CheckCircle2 size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}
            <span><b>{p.rotulo}</b> · {p.detalle}</span>
          </li>
        ))}
      </ol>
      <dl className="aulas-recibo-cambios">
        {recibo.cambios.map((c) => {
          const delta = c.antes != null && c.despues != null ? c.despues - c.antes : null;
          return (
            <div key={c.rotulo}>
              <dt>{c.rotulo}</dt>
              <dd>
                {c.despues == null ? "—" : fmt(c.despues)}
                {delta ? <small> ({delta > 0 ? "+" : "−"}{fmt(Math.abs(delta))})</small> : <small> (sin cambio)</small>}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="aulas-recibo-notoca">{NO_TOCA.join(" · ")}.</p>
    </section>
  );
}
