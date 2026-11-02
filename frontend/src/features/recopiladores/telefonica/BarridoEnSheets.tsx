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
      <h3><FileSpreadsheet size={15} aria-hidden /> En su propio Sheets</h3>
      <p className="rec-terr-nota">
        La base de barrido es un documento propio, el que se comparte con los enumeradores: crea un Sheets nuevo para ella, aparte
        de la base de control de Monitoreo, que los enumeradores no ven. Aquí se crean sus pestañas «Barrido», «Listas» y «Léeme»
        con estas columnas y sus desplegables; de los datos personales, el analista pega ahí sólo nombre y teléfono, y lo demás
        que la plantilla marca sensible (documento, correo) no va. Si una pestaña
        ya existe, no se toca, y si el enlace es un Sheets de control, no se construye. Si el estudio tiene varias campañas
        telefónicas, todas van en ese mismo documento, cada una en su pestaña.
        {sensibles.length ? ` Las columnas sensibles (${sensibles.join(", ")}) no se copian.` : ""}
      </p>
      <div className="rec-terr-fila">
        <PulsoInput
          aria-label="Enlace del Sheets del barrido"
          placeholder="Vacío: el documento de barrido del estudio"
          value={enlace}
          onChange={(e) => setEnlace(e.target.value)}
          disabled={ocupado}
        />
        <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={construir}>
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
