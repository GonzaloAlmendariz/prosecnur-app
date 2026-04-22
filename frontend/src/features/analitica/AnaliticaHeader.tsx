import { CheckCircle2, Database } from "lucide-react";
import { apiAnaliticaConfigExport, apiAnaliticaConfigImport } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { ConfigIoButtons } from "../../components/ConfigIoButtons";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
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

  // Callbacks para ConfigIoButtons compartido.
  async function ioExport() {
    const bundle = await apiAnaliticaConfigExport();
    const { ok: _ok, ...payload } = bundle;
    void _ok;
    return payload;
  }

  async function ioImport(parsed: unknown) {
    await apiAnaliticaConfigImport(parsed as never);
    return "Importado ✓ (recarga para aplicar)";
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
            ? <span style={{ color: "var(--pulso-danger-fg)" }}>Error preparando: {prepError}</span>
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
        <SaveStatusIndicator state="saved" savedLabel="Autoguardado" />
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", flex: 1, lineHeight: 1.4 }}>
          Tu configuración se guarda automáticamente. Exporta un JSON para respaldar o compartir.
        </span>
        <ConfigIoButtons
          onExport={ioExport}
          onImport={ioImport}
          filenamePrefix="pulso_analitica"
        />
      </div>
    </div>
  );
}
