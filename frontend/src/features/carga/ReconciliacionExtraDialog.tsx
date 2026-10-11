import { useState } from "react";
import { AlertTriangle, Check, Database, EyeOff, Info, Loader2 } from "../../vendor/lucide-react";
import { Dialog, type RetornoDeFoco } from "../../components/Dialog";
import type { PanelDeclarado } from "../../lib/navegacion/paneles";
import { PulsoButton } from "../../components/PulsoButton";
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
  panel,
  onClose,
  returnFocusTo,
}: {
  info: ReconciliacionInfo;
  onSave: (incluidas: string[]) => Promise<ReconciliacionInfo>;
  /** Panel declarado (`?panel=reconciliacion`): la dirección abre y cierra el diálogo. */
  panel: PanelDeclarado;
  /** Cierra el panel tras guardar o con Cancelar. */
  onClose: () => void;
  /**
   * Destino del foco al cerrar si lo enfocado al abrir ya no existe: abierto
   * por enlace no hay disparador y el foco caía en `body`.
   */
  returnFocusTo?: RetornoDeFoco;
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

  const conteo =
    nIncluidas === 0
      ? "Ninguna variable se conservará"
      : `${nIncluidas} variable${nIncluidas === 1 ? "" : "s"} se conservará${nIncluidas === 1 ? "" : "n"} en la base`;

  return (
    <Dialog
      panel={panel}
      returnFocusTo={returnFocusTo}
      size="md"
      alto="fijo"
      tono="aviso"
      icon={<AlertTriangle size={18} />}
      title={dialogTitle(info.n_extra)}
      subtitle="Reconciliación de variables"
      dismissible={!saving}
      closeOnOutside={false}
      footerStatus={<span className="pulso-recon-count">{conteo}</span>}
      footer={
        <>
          <PulsoButton variant="secondary" onClick={onClose} disabled={saving}>
            Omitir
          </PulsoButton>
          <PulsoButton variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <Loader2 size={15} className="pulso-spin" aria-hidden="true" />
            ) : (
              <Check size={15} aria-hidden="true" />
            )}
            Guardar
          </PulsoButton>
        </>
      }
    >
      <div className="pulso-recon-explain">
        <Info size={16} aria-hidden="true" />
        <p>
          Estas variables vienen en tu data pero no están en el XLSForm actual, normalmente porque
          son de versiones anteriores del formulario. Por defecto no se incluyen en la base. Marca
          las que quieras conservar.
        </p>
      </div>

      <ul
        className="pulso-recon-list"
        aria-label="Variables extra detectadas"
        data-qa-geometry-group="pulso-recon-list"
        data-qa-geometry-contract="intrinsic"
      >
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
    </Dialog>
  );
}
