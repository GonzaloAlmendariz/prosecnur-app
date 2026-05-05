// =============================================================================
// SaveEntregableButton — botón unificado para descargar/guardar entregables
// =============================================================================
// Reemplaza al patrón actual `<a href={downloadUrl(file_id)} download="x">`.
// Comportamiento dual según el estado del proyecto:
//
//   - HAY proyecto .pulso abierto → muestra un mini-popover con
//     FilenameInput. Al confirmar, copia el archivo al directorio del
//     .pulso vía POST /api/fs/save-to-project con el nombre user-elegido.
//
//   - NO hay proyecto → fallback al comportamiento clásico: ancla
//     <a href={downloadUrl(...)} download="..."> para que el browser
//     baje a ~/Downloads con el nombre default.
//
// Uso:
//   <SaveEntregableButton
//     fileId={r.file_id}
//     defaultName="codebook"
//     extension="xlsx"
//     label="codebook.xlsx"
//     icon={<Download size={14}/>}
//   />

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, X } from "lucide-react";
import {
  apiListProjectDir,
  apiSaveEntregable,
  downloadUrl,
} from "../../api/client";
import FilenameInput from "./FilenameInput";
import { useProjectShell } from "./ProjectShell";

type Props = {
  fileId: string;
  defaultName: string;        // sin extensión
  extension: string;          // sin punto
  label?: string;             // texto del botón (default: "Descargar")
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
};

export default function SaveEntregableButton({
  fileId,
  defaultName,
  extension,
  label,
  icon,
  className,
  style,
  disabled,
}: Props) {
  const { project } = useProjectShell();
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState(defaultName);
  const [valid, setValid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [existing, setExisting] = useState<string[]>([]);

  // Cuando se abre el popover, cargar la lista de archivos existentes
  // del proyecto para detección de colisiones.
  useEffect(() => {
    if (!open) return;
    void apiListProjectDir().then((r) => {
      setExisting(r.files ?? []);
    }).catch(() => setExisting([]));
  }, [open]);

  // Caso fallback: SIN proyecto activo → ancla nativa.
  if (!project.status.has_project) {
    return (
      <a
        href={downloadUrl(fileId)}
        className={className}
        style={style}
        aria-disabled={disabled}
      >
        {icon ?? <Download size={14} />}
        {label ?? `${defaultName}.${extension}`}
      </a>
    );
  }

  // Caso proyecto: botón → popover con FilenameInput → POST save-to-project
  async function handleSave() {
    setBusy(true);
    setError("");
    setSuccess(null);
    try {
      const r = await apiSaveEntregable(fileId, filename);
      setSuccess(`Guardado como ${r.filename}`);
      setOpen(false);
      // Toast quick-fade
      setTimeout(() => setSuccess(null), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || busy}
        className={className}
        style={style}
      >
        {icon ?? <Download size={14} />}
        {label ?? `${defaultName}.${extension}`}
      </button>

      {success && !open && (
        <span style={{
          marginLeft: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: "var(--pulso-success-fg)",
          fontSize: 11,
        }}>
          <CheckCircle2 size={12} /> {success}
        </span>
      )}

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              minWidth: 320,
              background: "white",
              border: "1px solid var(--pulso-border)",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              padding: 12,
              zIndex: 201,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <strong style={{ fontSize: 12, color: "var(--pulso-text)" }}>
                Guardar en el proyecto
              </strong>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent", border: "none",
                  cursor: "pointer", padding: 2, color: "var(--pulso-text-soft)",
                }}
              >
                <X size={14} />
              </button>
            </div>
            <FilenameInput
              defaultValue={defaultName}
              extension={extension}
              existingFiles={existing}
              autoFocus
              onValidChange={(v, finalName) => {
                setValid(v);
                if (v) {
                  // El input valida y devuelve "name.ext"; nosotros mandamos
                  // solo el "name" sin extensión al backend, que la inferirá.
                  setFilename(finalName.replace(new RegExp(`\\.${extension}$`), ""));
                }
              }}
              hint={`Se guardará junto al .pulso del proyecto.`}
            />
            {error && (
              <div style={{
                padding: "6px 10px",
                borderRadius: 4,
                background: "var(--pulso-danger-bg)",
                color: "var(--pulso-danger-fg)",
                fontSize: 11,
              }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  fontSize: 12,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--pulso-border)",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!valid || busy}
                className="pulso-primary"
                style={{
                  fontSize: 12,
                  padding: "6px 12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {busy ? <Loader2 size={12} className="pulso-spin" /> : <Download size={12} />}
                Guardar
              </button>
            </div>
          </div>
        </>
      )}
    </span>
  );
}
