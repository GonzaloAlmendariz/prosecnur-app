import { useState } from "react";
import { AlertTriangle, Check, Database, EyeOff, Info, Loader2, X } from "../../vendor/lucide-react";
import type { ReconciliacionInfo } from "../../api/client";
import {
  dialogTitle,
  fillLabel,
  initialIncluidas,
  toggleIncluida,
} from "./reconciliacionModel";

// Diálogo de reconciliación de variables data ↔ XLSForm.
//
// Se muestra cuando la data trae variables que ya no existen en el formulario
// (típicamente de versiones anteriores del XLSForm). Por defecto NO se incluyen
// en la base; el analista marca las que quiera conservar. `onSave` persiste la
// decisión (POST) y devuelve el estado fresco; el diálogo maneja su propio
// estado de guardado y de error para que la página no cargue con eso.
export function ReconciliacionExtraDialog({
  info,
  onSave,
  onClose,
}: {
  info: ReconciliacionInfo;
  onSave: (incluidas: string[]) => Promise<ReconciliacionInfo>;
  onClose: () => void;
}) {
  const [incluidas, setIncluidas] = useState<string[]>(() => initialIncluidas(info));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const includedSet = new Set(incluidas);
  const nIncluidas = incluidas.length;

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(incluidas);
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message || "No se pudo guardar la decisión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pulso-recon-backdrop" role="presentation">
      <div
        className="pulso-recon-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pulso-recon-title"
      >
        <div className="pulso-recon-head">
          <span aria-hidden="true" className="pulso-recon-head-icon">
            <AlertTriangle size={18} />
          </span>
          <div className="pulso-recon-head-copy">
            <p className="pulso-recon-kicker">Reconciliación de variables</p>
            <h2 id="pulso-recon-title">{dialogTitle(info.n_extra)}</h2>
          </div>
          <button
            type="button"
            className="pulso-recon-close"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={saving}
          >
            <X size={16} />
          </button>
        </div>

        <div className="pulso-recon-explain">
          <Info size={16} aria-hidden="true" />
          <p>
            Estas variables vienen en tu data pero no están en el XLSForm actual, normalmente porque
            son de versiones anteriores del formulario. Por defecto no se incluyen en la base. Marca
            las que quieras conservar.
          </p>
        </div>

        <ul className="pulso-recon-list" aria-label="Variables extra detectadas">
          {info.extra.map((extra) => {
            const checked = includedSet.has(extra.name);
            const isEmpty = extra.kind === "vacia";
            const rowId = `pulso-recon-row-${extra.name}`;
            return (
              <li
                key={extra.name}
                className={`pulso-recon-row${isEmpty ? " is-empty" : ""}${checked ? " is-checked" : ""}`}
              >
                <label className="pulso-recon-row-label" htmlFor={rowId}>
                  <input
                    id={rowId}
                    type="checkbox"
                    className="pulso-recon-check"
                    checked={checked}
                    disabled={saving}
                    onChange={() =>
                      setIncluidas((prev) => toggleIncluida(info.extra, prev, extra.name))
                    }
                  />
                  <span className="pulso-recon-row-name">{extra.name}</span>
                  <span
                    className={`pulso-recon-badge${isEmpty ? " is-empty" : " is-data"}`}
                    title={
                      isEmpty
                        ? "Columna sin datos en esta base"
                        : `${extra.n_fill.toLocaleString("es-PE")} respuestas con dato`
                    }
                  >
                    {isEmpty ? (
                      <EyeOff size={12} aria-hidden="true" />
                    ) : (
                      <Database size={12} aria-hidden="true" />
                    )}
                    {fillLabel(extra)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {error && (
          <div className="pulso-recon-error" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="pulso-recon-actions">
          <span className="pulso-recon-count">
            {nIncluidas === 0
              ? "Ninguna variable se conservará"
              : `${nIncluidas} variable${nIncluidas === 1 ? "" : "s"} se conservará${nIncluidas === 1 ? "" : "n"} en la base`}
          </span>
          <div className="pulso-recon-buttons">
            <button
              type="button"
              className="pulso-recon-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Omitir
            </button>
            <button
              type="button"
              className="pulso-recon-primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 size={15} className="pulso-spin" aria-hidden="true" />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
