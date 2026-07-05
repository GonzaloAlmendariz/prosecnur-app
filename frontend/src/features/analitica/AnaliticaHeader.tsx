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
// - Descarga/carga de ajustes como JSON.
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
    return "Trabaja con la base cargada. La fuente codificada aparecerá cuando termines Codificación.";
  }
  if (usandoAdaptados) {
    return "Incluye recodificaciones, nuevas variables y categorías creadas en Codificación.";
  }
  return "Usa la base original, sin recodificaciones ni variables nuevas de Codificación.";
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
    return "Ajustes cargados";
  }

  const activeBases = fuenteActiva === "adaptados" ? detalle?.codificada.bases : detalle?.original.bases;
  const activeFirst = activeBases?.find((b) => b.available) ?? activeBases?.[0];
  const activeXls = activeFirst?.xlsform?.filename ?? "Formulario XLSForm no resuelto";
  const activeData = activeFirst?.data?.filename ?? "Base de datos no resuelta";
  const activeAvailableCount = activeBases?.filter((b) => b.available).length ?? 0;
  const sourceFilesSummary = activeAvailableCount > 1
    ? `${activeAvailableCount} bases disponibles · instrumento y datos vinculados`
    : "Instrumento y datos vinculados";
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
            Datos de trabajo: {usandoAdaptados ? "codificados" : "originales"}
          </strong>{" "}
          <span>{guidance}</span>
          <div className="pulso-analitica-source-files" title={`Formulario: ${activeXls} · Base de datos: ${activeData}`}>
            {sourceFilesSummary}
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
          description="Carga"
          onSelect={selectFuente}
        />
        <SourceButton
          source="adaptados"
          title="Codificada"
          icon={<GitBranch size={14} />}
          active={fuenteActiva === "adaptados"}
          disabled={prepBusy || switching || !codificadaDisponible}
          bases={detalle?.codificada.bases ?? []}
          description={codificadaDisponible ? "Codificación" : "Pendiente"}
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
          exportLabel="Descargar ajustes"
          importLabel="Cargar ajustes..."
          exportTitle="Descargar una copia JSON de los ajustes de Analítica"
          importTitle="Cargar ajustes de Analítica desde un archivo JSON"
          exportSuccessLabel="Ajustes descargados"
          importSuccessLabel="Ajustes cargados"
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
  const xls = first?.xlsform?.filename ?? "Formulario XLSForm no resuelto";
  const data = first?.data?.filename ?? "Base de datos no resuelta";
  const titleAttr = bases.length > 1
    ? `${title} - ${description}\n${bases.map((b) => `${b.nombre}: ${b.xlsform?.filename ?? "sin formulario XLSForm"} + ${b.data?.filename ?? "sin base de datos"}`).join("\n")}`
    : `${title} - ${description}\n${xls}\n${data}`;

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
