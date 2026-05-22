import type { ReactNode } from "react";
import { useState } from "react";
import { CheckCircle2, Database, FileSpreadsheet, GitBranch } from "lucide-react";
import { apiAnaliticaConfigExport, apiAnaliticaConfigImport, apiAnaliticaConfigPut, apiAnaliticaPreparar } from "../../api/client";
import type { AnaliticaFuenteBase } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { ConfigIoButtons } from "../../components/ConfigIoButtons";
import { ContextBar } from "../../components/ContextBar";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import { useAnaliticaStore, type FuentePreferida } from "./store";

// Header global del módulo Analítica. Muestra:
// - Qué fuente de datos alimenta los reportes (data codificada vs
//   original) con toggle para forzar una u otra.
// - Export / Import de la configuración como JSON.
// - Indicador "Autoguardado activo".
// Aparece por encima del stepper de 5 reportes.

export function AnaliticaHeader({ prepBusy, prepError }: { prepBusy: boolean; prepError: string }) {
  const { state, refresh } = useSession();
  const config = useAnaliticaStore((s) => s.config);
  const setFuente = useAnaliticaStore((s) => s.setFuente);

  const fuenteActual = state?.analitica_fuente ?? "";
  const usandoAdaptados = fuenteActual === "adaptados";
  const detalle = state?.analitica_fuente_detalle;
  const codificadaDisponible = Boolean(detalle?.codificada.available || (!detalle && state?.codif_aplicado));
  const fuenteActiva: FuentePreferida = usandoAdaptados ? "adaptados" : "originales";
  const [switching, setSwitching] = useState(false);

  async function selectFuente(next: FuentePreferida) {
    if (switching || next === fuenteActiva || (next === "adaptados" && !codificadaDisponible)) return;
    setSwitching(true);
    setFuente(next);
    const nextConfig = { ...config, fuente_preferida: next };
    try {
      await apiAnaliticaConfigPut(nextConfig);
      await apiAnaliticaPreparar();
      await refresh();
      window.dispatchEvent(new Event("pulso:analitica-source-changed"));
    } finally {
      setSwitching(false);
    }
  }

  // Callbacks para ConfigIoButtons compartido.
  async function ioExport() {
    const bundle = await apiAnaliticaConfigExport();
    const { ok: _ok, ...payload } = bundle;
    void _ok;
    return payload;
  }

  async function ioImport(parsed: unknown) {
    await apiAnaliticaConfigImport(parsed as never);
    // Forzamos que el store re-hidrate desde backend inmediatamente
    // para que los cambios (ej. el subtab Dimensiones recién pre-llenado)
    // aparezcan sin que el usuario tenga que recargar la página. El
    // listener de `pulso:session-changed` en useAnaliticaAutosave hace
    // el GET /api/analitica/config y aplica el resultado al Zustand.
    window.dispatchEvent(new Event("pulso:session-changed"));
    return "Importado ✓";
  }

  const activeBases = fuenteActiva === "adaptados" ? detalle?.codificada.bases : detalle?.original.bases;
  const activeFirst = activeBases?.find((b) => b.available) ?? activeBases?.[0];
  const activeXls = activeFirst?.xlsform?.filename ?? "XLSForm no resuelto";
  const activeData = activeFirst?.data?.filename ?? "Data no resuelta";
  const guidance = prepBusy
    ? "Preparando datos..."
    : prepError
    ? `Error preparando: ${prepError}`
    : !codificadaDisponible
    ? "No hay codificación aplicada; se usa Original. Codificada se activa después de Fase 3."
    : usandoAdaptados
    ? "Recomendada: incluye recodificaciones, nuevas variables y categorías de Fase 3."
    : "Codificada está disponible y suele ser la opción recomendada para entregables finales.";

  return (
    <div style={{ marginBottom: 10 }}>
      <ContextBar
        ariaLabel="Fuente de datos de los reportes"
        density="compact"
        background={usandoAdaptados ? "var(--tipo-sm-bg)" : undefined}
        border={usandoAdaptados ? "1px solid var(--tipo-sm-border)" : undefined}
        style={{ gap: 10 }}
      >
        {usandoAdaptados ? (
          <CheckCircle2 size={16} color="var(--tipo-sm-fg)" />
        ) : (
          <Database size={16} color="var(--pulso-text-soft)" />
        )}
        <div style={{ fontSize: 12, flex: "1 1 420px", lineHeight: 1.35, minWidth: 260 }}>
          <strong style={{ color: usandoAdaptados ? "var(--tipo-sm-fg)" : "var(--pulso-text)" }}>
            Fuente analítica: {usandoAdaptados ? "Codificada" : "Original"}
          </strong>
          <span style={{ color: prepError ? "var(--pulso-danger-fg)" : "var(--pulso-text-soft)" }}> · {guidance}</span>
          <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--pulso-text-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            XLSForm: {activeXls} · Data: {activeData}
          </div>
        </div>
        <div style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <SourceButton
            source="originales"
            title="Original"
            icon={<FileSpreadsheet size={14} />}
            active={fuenteActiva === "originales"}
            disabled={prepBusy || switching}
            bases={detalle?.original.bases ?? []}
            description="Fase 1"
            onSelect={selectFuente}
          />
          <SourceButton
            source="adaptados"
            title="Codificada"
            icon={<GitBranch size={14} />}
            active={fuenteActiva === "adaptados"}
            disabled={prepBusy || switching || !codificadaDisponible}
            bases={detalle?.codificada.bases ?? []}
            description={codificadaDisponible ? "Fase 3" : "No disponible"}
            onSelect={selectFuente}
          />
        </div>
        <span style={{ flex: "1 1 auto" }} />
        <SaveStatusIndicator state="saved" savedLabel="Autoguardado" />
        <ConfigIoButtons
          onExport={ioExport}
          onImport={ioImport}
          filenamePrefix="prosecnur_analitica"
        />
      </ContextBar>
    </div>
  );
}

function SourceButton({
  source,
  title,
  icon,
  active,
  disabled,
  description,
  bases,
  onSelect,
}: {
  source: FuentePreferida;
  title: string;
  icon: ReactNode;
  active: boolean;
  disabled: boolean;
  description: string;
  bases: AnaliticaFuenteBase[];
  onSelect: (source: FuentePreferida) => Promise<void>;
}) {
  const first = bases.find((b) => b.available) ?? bases[0];
  const xls = first?.xlsform?.filename ?? "XLSForm no resuelto";
  const data = first?.data?.filename ?? "Data no resuelta";
  const titleAttr = bases.length > 1
    ? bases.map((b) => `${b.nombre}: ${b.xlsform?.filename ?? "sin XLSForm"} + ${b.data?.filename ?? "sin data"}`).join("\n")
    : `${xls}\n${data}`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void onSelect(source)}
      title={titleAttr}
      style={{
        border: `1px solid ${active ? "var(--pulso-primary)" : "var(--pulso-border)"}`,
        background: active ? "white" : "rgba(255,255,255,0.7)",
        color: disabled ? "var(--pulso-text-soft)" : "var(--pulso-text)",
        borderRadius: 999,
        padding: "5px 10px",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        textAlign: "center",
        opacity: disabled ? 0.65 : 1,
        minHeight: 30,
      }}
    >
      <span style={{ color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)", display: "inline-flex" }}>
        {icon}
      </span>
      <span style={{ fontSize: 12, fontWeight: 800 }}>{title}</span>
      <span style={{ fontSize: 10, color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)", fontWeight: 700 }}>
        {description}
      </span>
      {active ? <CheckCircle2 size={13} color="var(--pulso-primary)" /> : null}
    </button>
  );
}
