import { useState } from "react";
import { ApiError } from "../../api/core";
import { apiMonitoreoAulasPublicarDistribucion, apiMonitoreoAulasPublicarLibro } from "../../api/monitoreo";
import { apiMonitoreoAulasEntrega, apiMonitoreoAulasTraerEntrega } from "../../api/monitoreoAulasEntrega";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import { PulsoField } from "../../components/PulsoField";
import { PulsoInput } from "../../components/PulsoInput";
import { FileSpreadsheet, Loader2 } from "../../vendor/lucide-react";
import { construirTablasEnSheets, rotuloDeHoja, type ResultadoDeTablas } from "./tablasEnSheets";

/** Las tablas que Material construye sobre el motor de Monitoreo: cada una es un documento aparte. */
export const TABLAS = {
  libro: {
    titulo: "Las tablas que campo llena",
    nota: "Arma en el Sheets del estudio las hojas que llena el equipo; Monitoreo las lee para el seguimiento. Antes de escribir lee lo que el equipo ya tecleó y no pisa sus hojas.",
    campo: "Enlace del Sheets del operativo",
    accion: "Construir las tablas en Sheets",
    publicar: async (enlace?: string) => {
      const r = await apiMonitoreoAulasPublicarLibro(enlace);
      return { url: r.spreadsheet_url, hojas: r.hojas };
    },
  },
  distribucion: {
    titulo: "La distribución de aplicadores",
    // Lo que hace monitoreo_aulas_publicar_distribucion(): una pestaña por semana desde el reparto,
    // y una semana que ya tiene lo escrito por el coordinador no se reescribe.
    nota: "Arma el Sheets que se comparte con los aplicadores: una pestaña por semana con quién va a qué aula, según el reparto de Monitoreo. Una semana que el coordinador ya llenó no se toca.",
    campo: "Enlace del Sheets de la distribución",
    accion: "Construir la distribución en Sheets",
    publicar: async (enlace?: string) => {
      const r = await apiMonitoreoAulasPublicarDistribucion(enlace);
      return { url: r.url, hojas: r.hojas };
    },
  },
} as const;

export type TablaDeMaterial = keyof typeof TABLAS;

/**
 * R13 del mapa de responsabilidades (2 nov 2026, regla de Gonzalo): Material arma sobre el Sheets
 * del estudio las tablas que campo llena; Monitoreo las lee y supervisa. Escribir en un Sheets es
 * una acción con efecto fuera de la app, así que pide confirmarla (dos clics) y dice antes qué hace.
 */
export function ConstruirTablasEnSheets({ entregado, tabla = "libro" }: { entregado: boolean; tabla?: TablaDeMaterial }) {
  const t = TABLAS[tabla];
  const [enlace, setEnlace] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDeTablas | null>(null);

  const construir = async () => {
    setOcupado(true);
    setResultado(null);
    try {
      setResultado(await construirTablasEnSheets({ entrega: apiMonitoreoAulasEntrega, traer: apiMonitoreoAulasTraerEntrega, publicar: t.publicar }, enlace));
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudieron construir las tablas.";
      setResultado({ ok: false, motivo: err instanceof ApiError && err.code === "E_SHEETS_SPREADSHEET" ? "Falta el enlace del Sheets del operativo: pégalo una vez y queda recordado." : mensaje });
    } finally {
      setOcupado(false);
      setConfirmando(false);
    }
  };

  return (
    <Panel className="rec-tablas-sheets" eyebrow="Sheets del operativo" title={<><FileSpreadsheet size={18} aria-hidden /> {t.titulo}</>}>
      <div className="rec-tablas-sheets-cuerpo">
      <p className="rec-policy-note">{t.nota}</p>
      <PulsoField label={t.campo} hint="Vacío: se usa el que ya está recordado.">
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
            <FileSpreadsheet size={14} /> {t.accion}
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
