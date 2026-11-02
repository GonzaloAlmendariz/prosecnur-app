import { useState } from "react";
import { ApiError } from "../../api/core";
import { apiMonitoreoAulasPublicarLibro } from "../../api/monitoreo";
import { apiMonitoreoAulasEntrega, apiMonitoreoAulasTraerEntrega } from "../../api/monitoreoAulasEntrega";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import { PulsoField } from "../../components/PulsoField";
import { PulsoInput } from "../../components/PulsoInput";
import { FileSpreadsheet, Loader2 } from "../../vendor/lucide-react";
import { construirTablasEnSheets, rotuloDeHoja, type ResultadoDeTablas } from "./tablasEnSheets";

const DEPS = { entrega: apiMonitoreoAulasEntrega, traer: apiMonitoreoAulasTraerEntrega, publicar: apiMonitoreoAulasPublicarLibro };

/**
 * R13 del mapa de responsabilidades (2 nov 2026, regla de Gonzalo): Material arma sobre el Sheets
 * del estudio las tablas que campo llena; Monitoreo las lee y supervisa. Escribir en un Sheets es
 * una acción con efecto fuera de la app, así que pide confirmarla (dos clics) y dice antes qué hace.
 */
export function ConstruirTablasEnSheets({ entregado }: { entregado: boolean }) {
  const [enlace, setEnlace] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDeTablas | null>(null);

  const construir = async () => {
    setOcupado(true);
    setResultado(null);
    try {
      setResultado(await construirTablasEnSheets(DEPS, enlace));
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudieron construir las tablas.";
      setResultado({ ok: false, motivo: err instanceof ApiError && err.code === "E_SHEETS_SPREADSHEET" ? "Falta el enlace del Sheets del operativo: pégalo una vez y queda recordado." : mensaje });
    } finally {
      setOcupado(false);
      setConfirmando(false);
    }
  };

  return (
    <Panel className="rec-tablas-sheets" eyebrow="Sheets del operativo" title={<><FileSpreadsheet size={18} aria-hidden /> Las tablas que campo llena</>}>
      <div className="rec-tablas-sheets-cuerpo">
      <p className="rec-policy-note">
        Arma en el Sheets del estudio las hojas que llena el equipo; Monitoreo las lee para el seguimiento. Antes de escribir lee lo
        que el equipo ya tecleó y no pisa sus hojas.
      </p>
      <PulsoField label="Enlace del Sheets del operativo" hint="Vacío: se usa el que ya está recordado.">
        <PulsoInput size="sm" value={enlace} placeholder="https://docs.google.com/spreadsheets/d/…" disabled={ocupado} onChange={(e) => setEnlace(e.currentTarget.value)} />
      </PulsoField>
      <div className="rec-tablas-sheets-acciones">
        {confirmando ? (
          <>
            <PulsoButton variant="primary" size="sm" disabled={ocupado} onClick={() => { void construir(); }}>
              {ocupado ? <Loader2 size={14} className="pulso-spin" /> : <FileSpreadsheet size={14} />} {ocupado ? "Escribiendo…" : "Sí, escribir en el Sheets"}
            </PulsoButton>
            <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => setConfirmando(false)}>Cancelar</PulsoButton>
          </>
        ) : (
          <PulsoButton
            variant="secondary"
            size="sm"
            disabled={!entregado}
            title={entregado ? undefined : "Primero entrega a Monitoreo: las tablas se arman con lo entregado."}
            onClick={() => setConfirmando(true)}
          >
            <FileSpreadsheet size={14} /> Construir las tablas en Sheets
          </PulsoButton>
        )}
      </div>
      {resultado?.ok === false ? <p className="rec-inline-error" role="alert">{resultado.motivo}</p> : null}
      {resultado?.ok ? (
        <div role="status">
          <p className="rec-policy-note">
            Tablas listas{resultado.trajo ? " (Monitoreo trajo antes esta entrega)" : ""}.{" "}
            {resultado.url ? <a href={resultado.url} target="_blank" rel="noreferrer">Abrir el Sheets</a> : null}
          </p>
          <ul className="rec-tablas-sheets-hojas">
            {resultado.hojas.map((h) => <li key={h.hoja}>{rotuloDeHoja(h)}</li>)}
          </ul>
        </div>
      ) : null}
      </div>
    </Panel>
  );
}
