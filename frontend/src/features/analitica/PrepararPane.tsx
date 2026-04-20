import { useState } from "react";
import { Play, CheckCircle2, Database } from "lucide-react";
import { apiAnaliticaPreparar } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Panel } from "../../components/Panel";
import { Alert } from "../../components/Alert";
import { useAnaliticaStore } from "./store";
import { SeccionesEditor } from "./SeccionesEditor";

// Paso 1 — Preparar.
// En B1 (commit actual) solo expone el botón de preparar datos + muestra
// qué fuente se está usando (originales vs data adaptada post-Fase 3).
// En B2 aquí vive el SeccionesEditor para que el analista pueda renombrar
// / reordenar / fusionar secciones del XLSForm.

export function PrepararPane() {
  const { state, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prep, setPrep] = useState<{ fuente: string; n_filas: number; n_columnas: number } | null>(null);
  const fuentePreferida = useAnaliticaStore((s) => s.config.fuente_preferida);

  const setFuente = useAnaliticaStore((s) => s.setFuente);
  const prepOk = !!state?.analitica_prep_ok;
  const fuenteActual = state?.analitica_fuente ?? prep?.fuente ?? "desconocida";
  const usandoAdaptados = fuenteActual === "adaptados";

  async function onPreparar() {
    setError("");
    setBusy(true);
    try {
      const r = await apiAnaliticaPreparar();
      setPrep({ fuente: r.fuente, n_filas: r.n_filas, n_columnas: r.n_columnas });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Banner bridge: comunica claramente qué data está alimentando los
          reportes. Verde cuando venimos de Fase 3 con data codificada. */}
      {prepOk && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
            padding: "12px 14px",
            background: usandoAdaptados ? "var(--tipo-sm-bg)" : "var(--pulso-surface)",
            border: `1px solid ${usandoAdaptados ? "var(--tipo-sm-border)" : "var(--pulso-border)"}`,
            borderRadius: 8,
          }}
        >
          {usandoAdaptados ? (
            <CheckCircle2 size={18} color="var(--tipo-sm-fg)" />
          ) : (
            <Database size={18} color="var(--pulso-text-soft)" />
          )}
          <div style={{ fontSize: 13, flex: 1 }}>
            {usandoAdaptados ? (
              <>
                <strong style={{ color: "var(--tipo-sm-fg)" }}>Usando data codificada</strong>
                <span style={{ color: "var(--pulso-text-soft)" }}> — los reportes incluirán las variables <code>*_recod</code> generadas en Fase 3.</span>
              </>
            ) : (
              <>
                <strong>Usando data original</strong>
                <span style={{ color: "var(--pulso-text-soft)" }}> — aún no se aplicó codificación en Fase 3.</span>
              </>
            )}
          </div>
          {prep && (
            <span style={{ fontSize: 12, color: "var(--pulso-text-soft)" }}>
              <strong style={{ color: "var(--pulso-text)" }}>{prep.n_filas}</strong> filas · <strong style={{ color: "var(--pulso-text)" }}>{prep.n_columnas}</strong> columnas
            </span>
          )}
        </div>
      )}

      <Panel
        eyebrow="Preparar"
        title="Cargar data en memoria"
        hint={<>Procesa el instrumento y los datos aplicando etiquetas, value-labels y medidas SPSS. El resultado alimenta todos los reportes del paso siguiente.</>}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="pulso-primary"
            disabled={busy}
            onClick={onPreparar}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Play size={14} /> {prepOk ? "Volver a preparar" : "Preparar datos"}
          </button>

          <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.3 }}>Fuente</span>
            {(["auto", "adaptados", "originales"] as const).map((f) => (
              <label
                key={f}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 10px", borderRadius: 999,
                  border: `1px solid ${fuentePreferida === f ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
                  background: fuentePreferida === f ? "var(--pulso-primary-soft)" : "white",
                  cursor: "pointer", fontSize: 11,
                }}
              >
                <input
                  type="radio"
                  checked={fuentePreferida === f}
                  onChange={() => setFuente(f)}
                  style={{ margin: 0 }}
                />
                {f === "auto" ? "Automática" : f === "adaptados" ? "Data codificada" : "Data original"}
              </label>
            ))}
          </div>
        </div>
      </Panel>

      {prepOk && <SeccionesEditor />}

      {error && <Alert kind="error">{error}</Alert>}
    </section>
  );
}
