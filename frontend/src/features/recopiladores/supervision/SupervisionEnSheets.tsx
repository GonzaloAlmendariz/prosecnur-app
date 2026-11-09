// Entrega › la base del lote en su propio Sheets (Gonzalo: «Fórmula en el Sheets»). Nombre y teléfono llegan
// por fórmula desde el barrido; Material no los guarda. Monitoreo lee de aquí las tres columnas fijas.

import { useState } from "react";

import { apiSupervisionSheets, type SupervisionEnSheets as Resultado } from "../../../api/materialSupervision";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { ExternalLink, FileSpreadsheet } from "../../../vendor/lucide-react";

const ACCION = { sembrada: "creada", respetada: "ya existía, sin tocar" } as const;

export function SupervisionEnSheets({ campaignId, loteId }: { campaignId: string; loteId: string }) {
  const [enlace, setEnlace] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState<Resultado | null>(null);
  const construir = () => {
    setOcupado(true);
    setError("");
    apiSupervisionSheets(campaignId, enlace.trim())
      .then(setHecho)
      .catch((e: unknown) => setError(e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo construir la supervisión en el Sheets."))
      .finally(() => setOcupado(false));
  };
  return (
    <article className="rec-terr-tarjeta" data-qa-geometry-member>
      <h3><FileSpreadsheet size={15} aria-hidden /> En su propio Sheets</h3>
      <p className="rec-terr-nota">
        Crea la pestaña "Supervisión {loteId}" en un Sheets aparte del barrido, que ven sólo los supervisores. Nombre y teléfono
        llegan por fórmula desde el barrido, sin copiarse; la primera vez, abre la pestaña "Acceso al barrido" y pulsa "Permitir
        acceso". Monitoreo lee de aquí el veredicto. Si la pestaña ya existe, no se toca.
      </p>
      <div className="rec-terr-fila">
        <PulsoInput aria-label="Enlace del Sheets de supervisión" placeholder="Vacío: el que ya está recordado" value={enlace} onChange={(e) => setEnlace(e.target.value)} disabled={ocupado} />
        <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={construir}>{ocupado ? "Construyendo…" : "Construir en el Sheets"}</PulsoButton>
      </div>
      {hecho ? (
        <div className="rec-terr-nota" role="status">
          <ul className="rec-tel-lista">
            {hecho.hojas.map((h) => <li key={h.hoja}>{h.hoja} · {ACCION[h.accion]}{h.accion === "sembrada" && h.filas ? ` (${h.filas.toLocaleString("es-PE")} ${h.filas === 1 ? "fila" : "filas"})` : ""}</li>)}
          </ul>
          <a href={hecho.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} aria-hidden /> Abrir el Sheets</a>
        </div>
      ) : null}
      {error ? <p className="rec-terr-error" role="alert">{error}</p> : null}
    </article>
  );
}
