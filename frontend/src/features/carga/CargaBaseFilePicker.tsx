import { Database, FileSpreadsheet } from "../../vendor/lucide-react";

export function CargaBaseFilePicker({
  kind,
  file,
  disabled = false,
  onPick,
}: {
  kind: "xlsform" | "data";
  file: File | null;
  disabled?: boolean;
  onPick: (file: File | null) => void;
}) {
  const isForm = kind === "xlsform";
  const Icon = isForm ? FileSpreadsheet : Database;
  const label = isForm ? "Formulario XLSForm" : "Respuestas";
  const formats = isForm ? "Excel .xlsx" : ".xlsx · .csv · .sav · .zip";

  return (
    <label className={`pulso-carga-base-picker${file ? " is-ready" : ""}${disabled ? " is-disabled" : ""}`}>
      <span className="pulso-carga-base-picker-icon" aria-hidden="true"><Icon size={15} /></span>
      <span className="pulso-carga-base-picker-copy">
        <strong>{label}</strong>
        <small>{file?.name || formats}</small>
      </span>
      <span className="pulso-carga-base-picker-action">{file ? "Cambiar…" : "Elegir…"}</span>
      <input
        type="file"
        accept={isForm
          ? ".xlsx,.xls"
          : ".xlsx,.xls,.csv,.sav,.zip,application/x-spss-sav,application/octet-stream,application/zip,application/x-zip-compressed"}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.files?.[0] ?? null;
          event.target.value = "";
          onPick(next);
        }}
      />
    </label>
  );
}
