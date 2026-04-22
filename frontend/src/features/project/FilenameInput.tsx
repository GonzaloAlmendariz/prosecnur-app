// =============================================================================
// FilenameInput — input con validación y preview para nombrar entregables
// =============================================================================
// Reglas:
//   - 1 a 60 caracteres.
//   - Solo letras (sin tildes), dígitos, guion (-), underscore (_).
//   - Sin espacios, puntos, slashes, ni símbolos.
//   - Detecta colisión contra `existingFiles` (si se proveen).
//
// Preview muestra cómo quedará el nombre final con su extensión. El user
// solo escribe el "nombre limpio"; el sufijo se concatena automáticamente.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const NAME_REGEX = /^[A-Za-z0-9_-]{1,60}$/;

type Props = {
  defaultValue?: string;
  extension: string;        // ej. "xlsx", "html", "pptx" (sin punto)
  existingFiles?: string[]; // nombres en el dir destino, para detectar colisión
  onValidChange?: (valid: boolean, finalName: string) => void;
  autoFocus?: boolean;
  label?: string;
  hint?: string;
};

export type FilenameValidation = {
  value: string;
  finalName: string;
  isValid: boolean;
  collides: boolean;
  errorMsg: string | null;
};

export function useFilenameValidation(
  initial: string,
  extension: string,
  existingFiles: string[] = []
): [FilenameValidation, (v: string) => void] {
  const [value, setValue] = useState<string>(initial);

  const result = useMemo<FilenameValidation>(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      return {
        value, finalName: "", isValid: false, collides: false,
        errorMsg: "Escribe un nombre.",
      };
    }
    if (!NAME_REGEX.test(trimmed)) {
      return {
        value, finalName: "", isValid: false, collides: false,
        errorMsg: "Solo letras, dígitos, '-' y '_'. Sin espacios, puntos ni tildes.",
      };
    }
    const finalName = `${trimmed}.${extension}`;
    const collides = existingFiles.includes(finalName);
    return {
      value,
      finalName,
      isValid: !collides,
      collides,
      errorMsg: collides ? `Ya existe '${finalName}' en el proyecto.` : null,
    };
  }, [value, extension, existingFiles]);

  return [result, setValue];
}

export default function FilenameInput({
  defaultValue = "",
  extension,
  existingFiles = [],
  onValidChange,
  autoFocus = false,
  label,
  hint,
}: Props) {
  const [validation, setValue] = useFilenameValidation(defaultValue, extension, existingFiles);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  useEffect(() => {
    onValidChange?.(validation.isValid, validation.finalName);
  }, [validation.isValid, validation.finalName, onValidChange]);

  const showError = validation.errorMsg && validation.value.length > 0;
  const showOk = validation.isValid && validation.value.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-text)" }}>
          {label}
        </label>
      )}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        border: `1px solid ${showError ? "var(--pulso-danger-border)" : "var(--pulso-border)"}`,
        borderRadius: 6,
        background: "white",
        padding: "0 8px",
      }}>
        <input
          ref={inputRef}
          type="text"
          value={validation.value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="nombre_del_archivo"
          spellCheck={false}
          autoComplete="off"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            padding: "8px 0",
            fontSize: 13,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            background: "transparent",
            color: "var(--pulso-text)",
          }}
        />
        <span style={{
          fontSize: 11,
          color: "var(--pulso-text-soft)",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}>
          .{extension}
        </span>
        {showOk && <CheckCircle2 size={14} color="var(--pulso-success-fg)" />}
        {showError && <AlertCircle size={14} color="var(--pulso-danger-fg)" />}
      </div>
      {hint && !showError && (
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
      {showError && (
        <span style={{ fontSize: 11, color: "var(--pulso-danger-fg)", lineHeight: 1.4 }}>
          {validation.errorMsg}
        </span>
      )}
      {showOk && validation.finalName && (
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>
          Se guardará como{" "}
          <code style={{
            fontFamily: "ui-monospace, monospace",
            background: "var(--pulso-surface-2)",
            padding: "1px 5px",
            borderRadius: 3,
          }}>
            {validation.finalName}
          </code>
        </span>
      )}
    </div>
  );
}
