/**
 * Botón "Exportar solicitud para DTI (XLSX)": descarga el Excel de estructura
 * de variables esperadas + criterios de la reunión del diseño muestral en
 * bullets, listo para adjuntar al correo con el que se pide la base. El
 * payload es puro (solicitudDti.ts) y la descarga usa el patrón blob de
 * apiCalcMuestraSolicitudDtiExportar.
 */
import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { apiCalcMuestraSolicitudDtiExportar } from "../../../../api/client";
import { solicitudDtiPayload } from "./solicitudDti";

export function SolicitudDtiButton() {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportar() {
    setError(null);
    setDescargando(true);
    try {
      const blob = await apiCalcMuestraSolicitudDtiExportar(solicitudDtiPayload());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `solicitud-base-dti-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar la solicitud para DTI.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="cmv2-defi-dti">
      <button
        type="button"
        className="cmv2-defi-dti-btn"
        onClick={() => void exportar()}
        disabled={descargando}
        title="Excel de estructura + criterios en bullets para el correo a DTI"
      >
        {descargando
          ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
          : <FileSpreadsheet size={14} aria-hidden="true" />}
        Exportar solicitud para DTI (XLSX)
      </button>
      <span className="cmv2-defi-dti-hint">
        ¿Aún no tienes la base? Este Excel lista las columnas esperadas por hoja y los criterios
        acordados, para pedirla con el formato correcto.
      </span>
      {error ? <span className="cmv2-defi-dti-error" role="alert">{error}</span> : null}
    </div>
  );
}
