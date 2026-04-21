import { useRef, useState } from "react";
import { CheckCircle2, Database, Download, Upload } from "lucide-react";
import { apiAnaliticaConfigExport, apiAnaliticaConfigImport } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { useAnaliticaStore } from "./store";

// Header global del módulo Analítica. Muestra:
// - Qué fuente de datos alimenta los reportes (data codificada vs
//   original) con toggle para forzar una u otra.
// - Export / Import de la configuración como JSON.
// - Indicador "Autoguardado activo".
// Aparece por encima del stepper de 5 reportes.

export function AnaliticaHeader({ prepBusy, prepError }: { prepBusy: boolean; prepError: string }) {
  const { state } = useSession();
  const fuentePreferida = useAnaliticaStore((s) => s.config.fuente_preferida);
  const setFuente = useAnaliticaStore((s) => s.setFuente);

  const fuenteActual = state?.analitica_fuente ?? "";
  const usandoAdaptados = fuenteActual === "adaptados";

  const [ioBusy, setIoBusy] = useState<"export" | "import" | null>(null);
  const [ioMsg, setIoMsg] = useState("");
  const [ioError, setIoError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onExport() {
    setIoError(""); setIoMsg(""); setIoBusy("export");
    try {
      const bundle = await apiAnaliticaConfigExport();
      const { ok: _ok, ...payload } = bundle;
      void _ok;
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pulso_analitica_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setIoMsg("Exportado ✓");
    } catch (e) {
      setIoError((e as Error).message);
    } finally {
      setIoBusy(null);
      setTimeout(() => setIoMsg(""), 2500);
    }
  }

  async function onImport(file?: File) {
    if (!file) return;
    setIoError(""); setIoMsg(""); setIoBusy("import");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await apiAnaliticaConfigImport(parsed);
      setIoMsg("Importado ✓ (recarga para aplicar)");
    } catch (e) {
      setIoError(`JSON inválido: ${(e as Error).message}`);
    } finally {
      setIoBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setIoMsg(""), 4000);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
      {/* Banner de fuente */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          padding: "10px 14px",
          background: usandoAdaptados ? "var(--tipo-sm-bg)" : "var(--pulso-surface)",
          border: `1px solid ${usandoAdaptados ? "var(--tipo-sm-border)" : "var(--pulso-border)"}`,
          borderRadius: 8,
        }}
      >
        {usandoAdaptados ? (
          <CheckCircle2 size={16} color="var(--tipo-sm-fg)" />
        ) : (
          <Database size={16} color="var(--pulso-text-soft)" />
        )}
        <div style={{ fontSize: 12, flex: 1, lineHeight: 1.5 }}>
          {prepBusy
            ? "Preparando datos…"
            : prepError
            ? <span style={{ color: "#b91c1c" }}>Error preparando: {prepError}</span>
            : usandoAdaptados ? (
              <>
                <strong style={{ color: "var(--tipo-sm-fg)" }}>Usando data codificada</strong>
                <span style={{ color: "var(--pulso-text-soft)" }}> · los reportes incluyen las variables <code>*_recod</code> de Fase 3.</span>
              </>
            ) : (
              <>
                <strong>Usando data original</strong>
                <span style={{ color: "var(--pulso-text-soft)" }}> · aún no hay codificación aplicada en Fase 3.</span>
              </>
            )}
        </div>
        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.4, marginRight: 2 }}>
            Fuente
          </span>
          {(["auto", "adaptados", "originales"] as const).map((f) => {
            const isActive = fuentePreferida === f;
            return (
              <label
                key={f}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 999,
                  border: `1px solid ${isActive ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                  background: isActive ? "var(--pulso-primary-soft)" : "white",
                  color: isActive ? "var(--pulso-primary)" : "var(--pulso-text)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 500,
                  transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
                }}
              >
                <input
                  type="radio"
                  checked={isActive}
                  onChange={() => setFuente(f)}
                  style={{ margin: 0, accentColor: "var(--pulso-primary)" }}
                />
                {f === "auto" ? "Auto" : f === "adaptados" ? "Codificada" : "Original"}
              </label>
            );
          })}
        </div>
      </div>

      {/* Persistencia */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          padding: "8px 12px",
          background: "var(--pulso-surface)",
          border: "1px solid var(--pulso-border)",
          borderRadius: 8,
        }}
      >
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            color: "#15803d", fontSize: 11, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.4,
          }}
        >
          <CheckCircle2 size={12} /> Autoguardado
        </span>
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", flex: 1, lineHeight: 1.4 }}>
          Tu configuración se guarda automáticamente. Exporta un JSON para respaldar o compartir.
        </span>
        <button
          type="button"
          onClick={onExport}
          disabled={ioBusy === "export"}
          style={{
            fontSize: 11, padding: "5px 10px",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}
        >
          <Download size={12} /> {ioBusy === "export" ? "Exportando…" : "Exportar JSON"}
        </button>
        <label
          style={{
            fontSize: 11, padding: "5px 10px",
            display: "inline-flex", alignItems: "center", gap: 5,
            cursor: ioBusy === "import" ? "wait" : "pointer",
            border: "1px solid var(--pulso-border)", borderRadius: 6, background: "white",
            transition: "background 120ms ease",
          }}
        >
          <Upload size={12} />
          {ioBusy === "import" ? "Importando…" : "Importar JSON"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={(e) => onImport(e.target.files?.[0])}
          />
        </label>
        {ioMsg && <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>{ioMsg}</span>}
        {ioError && <span style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>{ioError}</span>}
      </div>
    </div>
  );
}
