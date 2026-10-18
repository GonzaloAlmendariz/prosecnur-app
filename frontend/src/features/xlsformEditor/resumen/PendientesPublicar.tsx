// «Qué falta para publicar e imprimir»: lo que el editor ya sabe del formulario (lógica por revisar, escalas
// repetidas, avisos, preguntas sin lista, previa del impreso), con su estado y un enlace al lugar donde se resuelve.

import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Info } from "../../../vendor/lucide-react";
import type { AccionPendiente, Pendiente } from "./modeloResumen";

const ICONO = {
  listo: CheckCircle2,
  aviso: AlertTriangle,
  error: AlertCircle,
  neutro: Info,
} as const;

export function PendientesPublicar({ items, onAccion }: {
  items: readonly Pendiente[];
  onAccion: (destino: AccionPendiente) => void;
}) {
  const abiertos = items.filter((i) => i.estado === "aviso" || i.estado === "error").length;
  return (
    <section className="pulso-xf-res-panel pulso-xf-res-pendientes" aria-labelledby="xf-res-pendientes-titulo" data-qa-geometry-member=""
      data-qa-geometry-capacity="owned">
      <header className="pulso-xf-res-panel-cabeza">
        <h3 id="xf-res-pendientes-titulo">Qué falta para publicar e imprimir</h3>
        <span className={`pulso-xf-res-contador${abiertos ? " is-aviso" : " is-listo"}`}>
          {abiertos ? `${abiertos} ${abiertos === 1 ? "tarea pendiente" : "tareas pendientes"}` : "Todo en orden"}
        </span>
      </header>
      <ul className="pulso-xf-res-pendientes-lista" data-qa-geometry-group="xlsform/resumen-pendientes" data-qa-geometry-contract="equal">
        {items.map((item) => {
          const Icono = ICONO[item.estado];
          return (
            <li key={item.clave} className={`pulso-xf-res-pendiente is-${item.estado}`} data-qa-geometry-member="">
              <span className="pulso-xf-res-pendiente-icono" aria-hidden="true"><Icono size={16} /></span>
              <span className="pulso-xf-res-pendiente-texto">
                <strong>{item.titulo}</strong>
                <span title={item.detalle}>{item.detalle}</span>
              </span>
              {item.accion ? (
                <button type="button" className="pulso-xf-res-enlace" data-accion="ir-a-pendiente" onClick={() => onAccion(item.accion!.destino)}>
                  {item.accion.rotulo} <ArrowRight size={13} aria-hidden="true" />
                </button>
              ) : <span aria-hidden="true" />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
