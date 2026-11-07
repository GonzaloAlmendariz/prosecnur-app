import type { ReactNode } from "react";
import { CheckCircle2, Route } from "lucide-react";

import { Panel } from "../../../components/Panel";
import "./mesa.css";

/**
 * Resultados › Propuesta y traspaso: las notas de la propuesta (con rótulo
 * visible, no sólo `aria-label`), cerrar la propuesta y enviarla a Monitoreo.
 * Cada botón deshabilitado dice por qué a la vista.
 */
export function PropuestaTraspaso({
  notas,
  cerrada,
  monitoreoListo,
  onNotas,
  onCerrar,
  onMonitoreo,
  children,
}: {
  notas: string;
  cerrada: boolean;
  monitoreoListo: boolean;
  onNotas: (notas: string) => void;
  onCerrar: () => void;
  onMonitoreo: () => void;
  /** El reporte del diseño (SalidaReporte), que también es salida. */
  children?: ReactNode;
}) {
  return (
    <Panel
      className="cmg-propuesta"
      aria-labelledby="cmg-propuesta-titulo"
      data-qa-geometry-member
      eyebrow="Salida"
      title={<span id="cmg-propuesta-titulo">Propuesta y traspaso</span>}
      actions={cerrada ? (
        <span className="cmg-estado-chip" data-tono="ok">
          <CheckCircle2 size={13} aria-hidden="true" /> Cerrada
        </span>
      ) : undefined}
    >
      <div className="cmg-propuesta-campo">
        <label htmlFor="cmg-propuesta-notas">Notas de la propuesta</label>
        <textarea
          id="cmg-propuesta-notas"
          value={notas}
          placeholder="Supuestos, acuerdos con el cliente y salvedades"
          onChange={(e) => onNotas(e.currentTarget.value)}
          rows={5}
        />
      </div>
      <div className="cmv2-inline-actions cmg-propuesta-acciones">
        <button type="button" className="cmv2-ghost" onClick={onCerrar}>
          <CheckCircle2 size={14} aria-hidden="true" /> {cerrada ? "Propuesta cerrada" : "Marcar propuesta cerrada"}
        </button>
        <button
          type="button"
          className="cmv2-ghost"
          onClick={onMonitoreo}
          disabled={!monitoreoListo}
          aria-describedby={monitoreoListo ? undefined : "cmg-monitoreo-motivo"}
        >
          <Route size={14} aria-hidden="true" /> Enviar a Monitoreo
        </button>
        {!monitoreoListo && <small id="cmg-monitoreo-motivo" className="cmg-motivo">Se habilita con un n calculado.</small>}
      </div>
      {children}
    </Panel>
  );
}
