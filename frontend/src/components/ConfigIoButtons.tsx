import { useRef, useState } from "react";
import { AlertCircle, Check, Download, Upload } from "lucide-react";

// Botones "Exportar JSON" + "Importar JSON" compartidos.
//
// Antes estaban duplicados en AnaliticaHeader + GraficosHeader con el
// mismo shape (spinner, feedback, error inline, file input oculto).
// Este componente encapsula el patrón:
//   - Loading state por botón (exportando / importando).
//   - Mensaje de éxito transitorio ("Exportado ✓") con fade.
//   - Mensaje de error en chip rojo al lado.
//   - Hooks `onExport()` → Promise<Blob o string o payload> + filename,
//     `onImport(parsed)` → Promise que reporta algo que se muestra.
//
// El consumer pasa dos callbacks: uno que retorna el payload serializable
// (lo bajamos como JSON), y otro que recibe el objeto parseado del
// archivo importado (y hace lo que corresponda con su store / backend).

export type ConfigIoProps = {
  /**
   * Retorna el payload que se serializa a JSON y se descarga. Puede ser
   * un objeto arbitrario — `ConfigIoButtons` le hace JSON.stringify.
   */
  onExport: () => Promise<unknown>;
  /**
   * Recibe el objeto YA parseado de JSON del archivo que el usuario
   * subió. El caller decide qué hacer con él (enviar al backend,
   * cargar al store, etc.) y opcionalmente retorna un mensaje de éxito
   * que se muestra en el feedback transitorio.
   */
  onImport: (parsed: unknown) => Promise<string | void>;
  /**
   * Prefijo del filename de descarga. Se le pega `_${timestamp}.json`.
   * Default: "prosecnur_config".
   */
  filenamePrefix?: string;
  /**
   * Label del botón exportar en reposo (default "Exportar JSON").
   */
  exportLabel?: string;
  /**
   * Label del botón importar en reposo (default "Importar JSON").
   */
  importLabel?: string;
};

export function ConfigIoButtons({
  onExport,
  onImport,
  filenamePrefix = "prosecnur_config",
  exportLabel = "Exportar JSON",
  importLabel = "Importar JSON",
}: ConfigIoProps) {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setError(""); setMsg(""); setBusy("export");
    try {
      const payload = await onExport();
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${filenamePrefix}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg("Exportado ✓");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(""), 2500);
    }
  }

  async function handleImport(file?: File) {
    if (!file) return;
    setError(""); setMsg(""); setBusy("import");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const okMsg = await onImport(parsed);
      setMsg(okMsg ?? "Importado ✓");
    } catch (e) {
      setError(`JSON inválido: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setMsg(""), 3000);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleExport}
        disabled={busy === "export"}
        style={{
          fontSize: 11, padding: "5px 10px",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}
      >
        <Download size={12} /> {busy === "export" ? "Exportando…" : exportLabel}
      </button>

      <label
        style={{
          fontSize: 11, padding: "5px 10px",
          display: "inline-flex", alignItems: "center", gap: 5,
          cursor: busy === "import" ? "wait" : "pointer",
          border: "1px solid var(--pulso-border)",
          borderRadius: 6, background: "white",
          transition: "background 120ms ease",
        }}
      >
        <Upload size={12} />
        {busy === "import" ? "Importando…" : importLabel}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(e) => handleImport(e.target.files?.[0])}
        />
      </label>

      {msg && (
        <span
          role="status"
          style={{
            fontSize: 11, fontWeight: 600,
            color: "var(--pulso-success-fg)",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}
        >
          <Check size={11} /> {msg}
        </span>
      )}
      {error && (
        <span
          role="alert"
          style={{
            fontSize: 11, fontWeight: 500,
            padding: "3px 8px", borderRadius: 999,
            background: "var(--pulso-danger-bg)",
            color: "var(--pulso-danger-fg)",
            border: "1px solid var(--pulso-danger-border)",
            display: "inline-flex", alignItems: "center", gap: 4,
          }}
        >
          <AlertCircle size={11} /> {error}
        </span>
      )}
    </>
  );
}
