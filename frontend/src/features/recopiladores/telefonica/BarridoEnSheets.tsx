// Barrido › Plantilla: la base construida en el Sheets del estudio (decisión de Gonzalo 2 nov 2026,
// «Sí, en el Sheets»). Material crea las pestañas que faltan con las columnas de la plantilla; el analista
// pega ahí los casos y campo la llena. Una pestaña que ya existe es del equipo y no se toca: la respuesta lo dice.

import { useState } from "react";

import { apiMaterialTelefonicaSheets, type BarridoEnSheets as Resultado } from "../../../api/materialTelefonica";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";
import { ExternalLink, FileSpreadsheet } from "../../../vendor/lucide-react";

const ACCION = { sembrada: "creada", respetada: "ya existía, sin tocar" } as const;

export function BarridoEnSheets({ campaignId, sensibles }: { campaignId: string; sensibles: string[] }) {
  const [enlace, setEnlace] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState<Resultado | null>(null);
  const construir = () => {
    setOcupado(true);
    setError("");
    apiMaterialTelefonicaSheets(campaignId, enlace.trim())
      .then(setHecho)
      .catch((e: unknown) => setError(e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo construir el barrido en el Sheets."))
      .finally(() => setOcupado(false));
  };
  return (
    <article className="rec-terr-tarjeta" data-qa-geometry-member>
      <h3><FileSpreadsheet size={15} aria-hidden /> En el Sheets del estudio</h3>
      <p className="rec-terr-nota">
        Crea en el Sheets del operativo las pestañas «Barrido», «Listas» y «Léeme» con estas columnas y sus desplegables. Ahí
        pega el analista la base del cliente, con nombres y teléfonos: compártelo sólo con el equipo. Si una pestaña ya existe,
        no se toca.
        {sensibles.length ? ` Las columnas sensibles (${sensibles.join(", ")}) no se copian.` : ""}
      </p>
      <div className="rec-terr-fila">
        <PulsoInput
          aria-label="Enlace del Sheets del estudio"
          placeholder="https://docs.google.com/spreadsheets/d/…"
          value={enlace}
          onChange={(e) => setEnlace(e.target.value)}
          disabled={ocupado}
        />
        <PulsoButton variant="secondary" size="sm" disabled={ocupado || !enlace.trim()} onClick={construir}>
          {ocupado ? "Construyendo…" : "Construir en el Sheets"}
        </PulsoButton>
      </div>
      {hecho ? (
        <div className="rec-terr-nota" role="status">
          <ul className="rec-tel-lista">
            {hecho.hojas.map((h) => (
              <li key={h.hoja}>{h.hoja} · {ACCION[h.accion]}{h.accion === "sembrada" && h.filas ? ` (${h.filas.toLocaleString("es-PE")} ${h.filas === 1 ? "fila" : "filas"})` : ""}</li>
            ))}
          </ul>
          <a href={hecho.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} aria-hidden /> Abrir el Sheets</a>
        </div>
      ) : null}
      {error ? <p className="rec-terr-error" role="alert">{error}</p> : null}
    </article>
  );
}
