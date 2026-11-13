import { useState, type ReactNode } from "react";
import { CheckCircle2, Trash2, Upload, type LucideIcon } from "../../../vendor/lucide-react";

export function UploadCard({
  kind, icon: Icon, title, hint, whatIs, accept, acceptLabel, done, busy, disabled, disabledHint, resumen, alternativa, onPick, onRemove,
}: {
  kind: "xlsform" | "data";
  icon: LucideIcon;
  title: string;
  hint: ReactNode;
  /** Explicación adicional de qué ES este insumo (no qué hacer). */
  whatIs: ReactNode;
  accept: string;
  /** Etiqueta humana de formatos aceptados (ej. "Solo Excel (.xlsx)"). */
  acceptLabel: string;
  done: boolean;
  /** Si hay otra operación en curso globalmente, deshabilita Remove. */
  busy: boolean;
  disabled?: boolean;
  disabledHint?: string;
  resumen: ReactNode | null;
  /** Otra forma de obtener el insumo sin subir un archivo (el formulario del editor). */
  alternativa?: ReactNode;
  onPick: (file?: File) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className={`pulso-upload-card${done ? " is-done" : ""}${disabled && !done ? " is-disabled" : ""}`}>
      {/* Header del insumo */}
      <div className="pulso-upload-card-head">
        <span aria-hidden="true" className="pulso-upload-card-icon">
          {done ? <CheckCircle2 size={22} /> : <Icon size={22} />}
        </span>
        <div className="pulso-upload-card-copy">
          <h3 className="pulso-upload-card-title">
            {title}
          </h3>
          <span className="pulso-upload-card-hint">
            {hint}
          </span>
        </div>
        <span
          className={`pulso-upload-state${done ? " is-ready" : disabled && !done ? " is-blocked" : ""}`}
          aria-hidden="true"
        >
          {done ? "Listo" : disabled ? "En espera" : "Pendiente"}
        </span>
        {/* Botón Quitar — solo visible cuando el insumo ya está cargado. */}
        {done && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            title={`Quitar ${kind === "xlsform" ? "formulario" : "respuestas"}`}
            aria-label={`Quitar ${kind === "xlsform" ? "formulario" : "respuestas"}`}
            className="pulso-upload-remove"
          >
            <Trash2 size={11} /> Quitar
          </button>
        )}
      </div>

      {/* Qué es este archivo — explicación clara del concepto */}
      <div className="pulso-upload-note">
        {whatIs}
      </div>

      {/* Dropzone */}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          onPick(e.dataTransfer.files?.[0]);
        }}
        className={`pulso-upload-dropzone${dragOver ? " is-drag-over" : ""}${disabled ? " is-disabled" : ""}`}
        aria-disabled={disabled}
      >
        <Upload size={22} className="pulso-upload-dropzone-icon" />
        <span className="pulso-upload-dropzone-title">
          {disabled && !done
            ? "Carga el formulario primero"
            : done
            ? `Reemplazar ${kind === "xlsform" ? "formulario" : "respuestas"}`
            : "Arrastra o haz click para subir"}
        </span>
        <span className="pulso-upload-dropzone-formats">
          {disabled && disabledHint ? disabledHint : acceptLabel}
        </span>
        <input
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={(e) => onPick(e.target.files?.[0])}
          style={{ display: "none" }}
        />
      </label>

      {alternativa}

      {resumen && (
        <div className="pulso-upload-summary">
          {resumen}
        </div>
      )}
    </div>
  );
}
