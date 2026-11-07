// Barrido › Plantilla: la base construida en el Sheets del estudio (decisión de Gonzalo 2 nov 2026,
// «Sí, en el Sheets»). Material crea las pestañas que faltan con las columnas de la plantilla; el analista
// pega ahí los casos y campo la llena. Una pestaña que ya existe es del equipo y no se toca: la respuesta lo dice.
// Un enlace que es el Sheets de control de Monitoreo se rechaza en el backend (409) con su motivo.

import { useState } from "react";

import { apiMaterialTelefonicaSheets, type BarridoEnSheets as Resultado } from "../../../api/materialTelefonica";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoInput } from "../../../components/PulsoInput";

const ACCION = { sembrada: "creada", respetada: "ya existía, sin tocar" } as const;

type Props = {
  campaignId: string;
  sensibles: string[];
  /** Ya hay pestaña de esta campaña: el control pasa a «crear las que falten». */
  construido?: boolean;
  /** Tras construir, la campaña se relee para que los pasos digan el estado nuevo. */
  onHecho?: () => void;
};

export function BarridoEnSheets({ campaignId, sensibles, construido = false, onHecho }: Props) {
  const [enlace, setEnlace] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState<Resultado | null>(null);
  const construir = () => {
    setOcupado(true);
    setError("");
    apiMaterialTelefonicaSheets(campaignId, enlace.trim())
      .then((r) => { setHecho(r); onHecho?.(); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : "No se pudo construir el barrido en el Sheets."))
      .finally(() => setOcupado(false));
  };
  return (
    <div className="rec-tel-construir">
      <div className="rec-terr-fila">
        <PulsoInput
          aria-label="Enlace del Sheets del barrido"
          placeholder={construido ? "El mismo documento del barrido" : "Enlace de un Sheets nuevo, sólo para el barrido"}
          value={enlace}
          onChange={(e) => setEnlace(e.target.value)}
          disabled={ocupado}
          invalid={Boolean(error)}
        />
        <PulsoButton variant={construido ? "secondary" : "primary"} size="sm" disabled={ocupado} onClick={construir}>
          {ocupado ? "Construyendo…" : construido ? "Crear las pestañas que falten" : "Construir en el Sheets"}
        </PulsoButton>
      </div>
      {sensibles.length && !construido ? <p className="rec-terr-nota">Las columnas sensibles ({sensibles.join(", ")}) no se copian.</p> : null}
      {hecho ? (
        <ul className="rec-tel-lista" role="status">
          {hecho.hojas.map((h) => (
            <li key={h.hoja}>{h.hoja}: {ACCION[h.accion]}{h.accion === "sembrada" && h.filas ? ` (${h.filas.toLocaleString("es-PE")} ${h.filas === 1 ? "fila" : "filas"})` : ""}</li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="rec-terr-error" role="alert">{error}</p> : null}
    </div>
  );
}
