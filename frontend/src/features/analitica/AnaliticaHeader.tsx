import type { ReactNode } from "react";
import { useState } from "react";
import { CheckCircle2, Database, FileSpreadsheet, GitBranch } from "lucide-react";
import {
  apiAnaliticaConfigExport,
  apiAnaliticaConfigImport,
  apiAnaliticaConfigPut,
  apiAnaliticaPreparar,
} from "../../api/client";
import type { AnaliticaFuenteBase } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { ConfigIoButtons } from "../../components/ConfigIoButtons";
import { ContextBar, ContextBarDivider } from "../../components/ContextBar";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import { useAnaliticaStore, type FuentePreferida } from "./store";

// Header global del módulo Analítica. Muestra:
// - Qué fuente de datos alimenta los reportes (data codificada vs
//   original) con toggle para forzar una u otra.
// - Export / Import de la configuración como JSON.
// - Indicador "Autoguardado activo".
// Aparece como command bar por encima del split view de reportes.

export function analiticaFuenteGuidance({
  prepBusy,
  prepError,
  codificadaDisponible,
  usandoAdaptados,
}: {
  prepBusy: boolean;
  prepError: string;
  codificadaDisponible: boolean;
  usandoAdaptados: boolean;
}) {
  if (prepBusy) return "Preparando datos...";
  if (prepError) return `Error preparando: ${prepError}`;
  if (!codificadaDisponible) {
    return "Original: datos e instrumento de Fase 1. Codificada aparece después de aplicar Fase 3.";
  }
  if (usandoAdaptados) {
    return "Codificada: datos e instrumento de Fase 3, con recodificaciones, nuevas variables y categorías.";
  }
  return "Original: datos e instrumento de Fase 1, sin recodificaciones de Codificación.";
}

export function AnaliticaHeader({ prepBusy, prepError }: { prepBusy: boolean; prepError: string }) {
  const { state, refresh } = useSession();
  const config = useAnaliticaStore((s) => s.config);
  const setFuente = useAnaliticaStore((s) => s.setFuente);

  const fuenteActual = state?.analitica_fuente ?? "";
  const usandoAdaptados = fuenteActual.startsWith("adaptados");
  const detalle = state?.analitica_fuente_detalle;
  const codificadaDisponible = Boolean(detalle?.codificada.available || state?.codif_aplicado);
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
  const guidance = analiticaFuenteGuidance({
    prepBusy,
    prepError,
    codificadaDisponible,
    usandoAdaptados,
  });

  return (
    <ContextBar
      ariaLabel="Fuente de datos y configuración de analítica"
      density="compact"
      className={`pulso-analitica-sourcebar${usandoAdaptados ? " is-adapted" : ""}${prepError ? " has-error" : ""}`}
      elevated
    >
      <div className="pulso-analitica-source-status">
        <span aria-hidden="true" className="pulso-analitica-source-icon">
          {usandoAdaptados ? <CheckCircle2 size={16} /> : <Database size={16} />}
        </span>
        <div className="pulso-analitica-source-copy">
          <strong>
            Fuente analítica: {usandoAdaptados ? "Codificada" : "Original"}
          </strong>{" "}
          <span>{guidance}</span>
          <div className="pulso-analitica-source-files" title={`XLSForm: ${activeXls} · Data: ${activeData}`}>
            XLSForm: {activeXls} · Data: {activeData}
          </div>
        </div>
      </div>

      <div className="pulso-analitica-source-switch" role="group" aria-label="Fuente analítica">
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

      <ContextBarDivider />

      <div className="pulso-analitica-source-actions">
        <SaveStatusIndicator state="saved" savedLabel="Autoguardado" />
        <ConfigIoButtons
          onExport={ioExport}
          onImport={ioImport}
          filenamePrefix="prosecnur_analitica"
        />
      </div>
    </ContextBar>
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
      aria-pressed={active}
      className={`pulso-analitica-source-option${active ? " is-active" : ""}`}
    >
      <span className="pulso-analitica-source-option-icon">
        {icon}
      </span>
      <span className="pulso-analitica-source-option-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      {active ? <CheckCircle2 size={13} /> : null}
    </button>
  );
}
