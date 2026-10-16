// Carga › Fuentes (una base): lo que se sabe del archivo de respuestas ya
// cargado. Una línea de cifras, cómo calza con el formulario, qué preparó la
// app, las descargas de la base preparada en una fila y el detalle plegado. Si
// se acaba de reemplazar, arriba va qué cambió y el paso que sigue.

import type { CambiosDeRespuestas } from "../../api/estudio";
import type { apiCargaData, NormalizedExportFormat } from "../../api/xlsformEditor";
import { formatoConteo } from "../../lib/formatoNumero";
import { ArrowRightLeft, Download } from "../../vendor/lucide-react";
import { CambiosDeRespuestasAviso } from "./fuentes/CambiosDeRespuestasAviso";
import { partesPreparacion, textoCompatibilidad } from "./respuestasResumenModel";
import "./fuentes/basesDelEstudio.css";

export type DataPreview = Awaited<ReturnType<typeof apiCargaData>>["preview"];

export function RespuestasResumen({
  preview,
  cambios,
  onCerrarCambios,
  mapeo,
  detallesNormalizacion,
  exportar,
}: {
  preview: DataPreview;
  cambios: CambiosDeRespuestas | null;
  onCerrarCambios: () => void;
  /** Mapeo de códigos: `null` si no aplica. */
  mapeo: { pendiente: boolean; onRevisar: () => void } | null;
  detallesNormalizacion: string[];
  /** Descargas de la base preparada: `null` si aún no se pueden ofrecer. */
  exportar: { busy: boolean; onExport: (format: NormalizedExportFormat) => void } | null;
}) {
  const compat = textoCompatibilidad(preview.compatibilidad);
  const preparacion = partesPreparacion(preview.normalizacion);
  return (
    <div className="pulso-resp-resumen">
      {cambios ? <CambiosDeRespuestasAviso cambios={cambios} onCerrar={onCerrarCambios} /> : null}

      <p className="pulso-resp-cifras">
        <strong>{formatoConteo(preview.n_filas)}</strong> respuestas
        <span aria-hidden="true">·</span>
        <strong>{formatoConteo(preview.n_columnas)}</strong> columnas
      </p>

      {compat ? <p className={`pulso-resp-linea ${compat.ok ? "is-ok" : "is-bad"}`}>{compat.texto}</p> : null}
      <p className="pulso-resp-linea">
        {preview.normalizacion?.applied
          ? preparacion.length ? `Preparada: ${preparacion.join(" · ")}` : "Preparada sin cambios"
          : "La preparación se hace después de cargar el formulario"}
      </p>

      {mapeo ? (
        <div className={`pulso-choice-map-inline${mapeo.pendiente ? " needs-review" : ""}`}>
          <span aria-hidden="true" className="pulso-choice-map-inline-icon"><ArrowRightLeft size={13} /></span>
          <span>
            {mapeo.pendiente
              ? "Las mismas etiquetas vienen con códigos distintos. Confirma cómo ajustarlas antes de validar."
              : "Mapeo de códigos confirmado para estas respuestas."}
          </span>
          <button type="button" className="pulso-choice-map-inline-button" onClick={mapeo.onRevisar}>
            {mapeo.pendiente ? "Revisar" : "Ver mapeo"}
          </button>
        </div>
      ) : null}

      {exportar ? (
        <p className="pulso-resp-descargas">
          <span>Descargar la base preparada</span>
          {(["xlsx", "csv", "sav"] as NormalizedExportFormat[]).map((format) => (
            <button key={format} type="button" disabled={exportar.busy} onClick={() => exportar.onExport(format)}>
              <Download size={12} aria-hidden="true" />.{format}
            </button>
          ))}
        </p>
      ) : null}

      {detallesNormalizacion.length > 0 ? (
        <details className="pulso-resp-detalle">
          <summary>Qué se preparó</summary>
          <ul>{detallesNormalizacion.map((row, i) => <li key={i}>{row}</li>)}</ul>
        </details>
      ) : null}
      {preview.columnas.length > 0 ? (
        <details className="pulso-resp-detalle">
          <summary>Ver las {formatoConteo(preview.columnas.length)} columnas</summary>
          <ul>
            {preview.columnas.map((c, i) => (
              <li key={i}>
                <code>{c.nombre}</code> <em>({c.tipo})</em>
                {c.origen === "extra" ? <span className="pulso-column-extra">no es del formulario</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
