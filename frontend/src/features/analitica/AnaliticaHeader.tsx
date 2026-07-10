import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  FileSpreadsheet,
  GitBranch,
  Loader2,
  Upload,
} from "lucide-react";
import {
  apiAnaliticaConfigExport,
  apiAnaliticaConfigImport,
  apiAnaliticaConfigPut,
  apiAnaliticaPreparar,
  apiAnaliticaVariables,
} from "../../api/client";
import type { AnaliticaFuenteBase, RepeatGrain } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { ConfigIoButtons } from "../../components/ConfigIoButtons";
import { ContextBar, ContextBarDivider } from "../../components/ContextBar";
import { RepeatBadge } from "../../components/RepeatBadge";
import { RepeatGrainNote } from "../../components/RepeatGrainNote";
import { SaveStatusIndicator } from "../../components/SaveStatusIndicator";
import { useAnaliticaStore, type FuentePreferida } from "./store";

// Header global del módulo Analítica. Muestra:
// - Qué fuente de datos alimenta los reportes (data codificada vs
//   original) con toggle para forzar una u otra.
// - Plantilla portable de Analitica como JSON.
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

type AnaliticaHeaderProps = {
  prepBusy: boolean;
  prepError: string;
  variant?: "bar" | "panel";
};

export function AnaliticaHeader({ prepBusy, prepError, variant = "bar" }: AnaliticaHeaderProps) {
  const { state, refresh } = useSession();
  const config = useAnaliticaStore((s) => s.config);
  const setFuente = useAnaliticaStore((s) => s.setFuente);
  const panelVariant = variant === "panel";

  const fuenteActual = state?.analitica_fuente ?? "";
  const usandoAdaptados = fuenteActual.startsWith("adaptados");
  const detalle = state?.analitica_fuente_detalle;
  const codificadaDisponible = Boolean(detalle?.codificada.available || state?.codif_aplicado);
  const fuenteActiva: FuentePreferida = usandoAdaptados ? "adaptados" : "originales";
  const [switching, setSwitching] = useState(false);

  // ADR 0030 Fase 5: si la base activa es una hija repeat, el backend anota el
  // grano de instancia en /api/analitica/variables. Lo consumimos para pintar
  // la identidad naranja (badge + indicador de grano) y advertir el clustering.
  // `null` en cualquier base normal o si la preparación aún no corrió.
  const [grain, setGrain] = useState<RepeatGrain | null>(null);
  const activeBase = state?.active_base ?? null;
  useEffect(() => {
    let alive = true;
    async function loadGrain() {
      try {
        const res = await apiAnaliticaVariables();
        if (alive) setGrain(res.grain);
      } catch {
        if (alive) setGrain(null);
      }
    }
    void loadGrain();
    const onChange = () => { void loadGrain(); };
    window.addEventListener("pulso:analitica-source-changed", onChange);
    window.addEventListener("pulso:session-changed", onChange);
    return () => {
      alive = false;
      window.removeEventListener("pulso:analitica-source-changed", onChange);
      window.removeEventListener("pulso:session-changed", onChange);
    };
  }, [activeBase, fuenteActual]);

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
    return "Plantilla aplicada";
  }

  const activeBases = fuenteActiva === "adaptados" ? detalle?.codificada.bases : detalle?.original.bases;
  const activeFirst = activeBases?.find((b) => b.available) ?? activeBases?.[0];
  const activeXls = activeFirst?.xlsform?.filename ?? "Formulario XLSForm no resuelto";
  const activeData = activeFirst?.data?.filename ?? "Base de datos no resuelta";
  const activeAvailableCount = activeBases?.filter((b) => b.available).length ?? 0;
  const sourceFilesSummary = activeAvailableCount > 1
    ? `${activeAvailableCount} bases disponibles · instrumento y datos vinculados`
    : "Instrumento y datos vinculados";
  const sourceTitle = panelVariant
    ? prepBusy
      ? "Preparando datos"
      : prepError
        ? "Revisar datos"
        : "Datos listos"
    : `Datos de trabajo: ${usandoAdaptados ? "codificados" : "originales"}`;
  const guidance = analiticaFuenteGuidance({
    prepBusy,
    prepError,
    codificadaDisponible,
    usandoAdaptados,
  });

  return (
    <>
    <ContextBar
      ariaLabel="Fuente de datos y configuración de analítica"
      density="compact"
      className={`pulso-analitica-sourcebar pulso-analitica-sourcebar--${variant}${usandoAdaptados ? " is-adapted" : ""}${prepError ? " has-error" : ""}`}
      elevated={!panelVariant}
    >
      <div className="pulso-analitica-source-status">
        <span aria-hidden="true" className="pulso-analitica-source-icon">
          {usandoAdaptados ? <CheckCircle2 size={16} /> : <Database size={16} />}
        </span>
        <div className="pulso-analitica-source-copy">
          <strong>{sourceTitle}</strong>{" "}
          {grain && (
            <RepeatBadge
              repeatGroup={grain.repeat_group}
              compact
              title={grain.parent_base
                ? `Base hija repeat · roster de ${grain.parent_base}`
                : "Base hija de una estructura repetida"}
            />
          )}{" "}
          <span>{guidance}</span>
          {!panelVariant && (
            <div className="pulso-analitica-source-files" title={`Formulario: ${activeXls} · Base de datos: ${activeData}`}>
              {sourceFilesSummary}
            </div>
          )}
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

      {!panelVariant && <ContextBarDivider />}

      <div className="pulso-analitica-source-actions">
        {!panelVariant && <SaveStatusIndicator state="saved" savedLabel="Autoguardado" />}
        {panelVariant ? (
          <AnaliticaTemplateMenu
            onExport={ioExport}
            onImport={ioImport}
            filenamePrefix="prosecnur_analitica"
            exportTitle="Guarda una plantilla JSON de Analítica. No incluye respuestas ni bases."
            importTitle="Aplica una plantilla JSON de Analítica sin reemplazar las respuestas del proyecto."
            exportSuccessLabel="Plantilla guardada"
            importSuccessLabel="Plantilla aplicada"
          />
        ) : (
          <ConfigIoButtons
            onExport={ioExport}
            onImport={ioImport}
            filenamePrefix="prosecnur_analitica"
            exportLabel="Guardar plantilla"
            importLabel="Aplicar plantilla..."
            exportTitle="Guarda una plantilla JSON de Analítica. No incluye respuestas ni bases."
            importTitle="Aplica una plantilla JSON de Analítica sin reemplazar las respuestas del proyecto."
            exportSuccessLabel="Plantilla guardada"
            importSuccessLabel="Plantilla aplicada"
          />
        )}
      </div>
    </ContextBar>
    <RepeatGrainNote grain={grain} className="pulso-analitica-repeat-grain" />
    </>
  );
}

function AnaliticaTemplateMenu({
  onExport,
  onImport,
  filenamePrefix,
  exportTitle,
  importTitle,
  exportSuccessLabel,
  importSuccessLabel,
}: {
  onExport: () => Promise<unknown>;
  onImport: (parsed: unknown) => Promise<string | void>;
  filenamePrefix: string;
  exportTitle: string;
  importTitle: string;
  exportSuccessLabel: string;
  importSuccessLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleExport() {
    setError("");
    setMsg("");
    setBusy("export");
    try {
      const payload = await onExport();
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${filenamePrefix}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg(exportSuccessLabel);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      window.setTimeout(() => setMsg(""), 2500);
    }
  }

  async function handleImport(file?: File) {
    if (!file) return;
    setError("");
    setMsg("");
    setBusy("import");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const okMsg = await onImport(parsed);
      setMsg(okMsg ?? importSuccessLabel);
      setOpen(false);
    } catch (e) {
      setError(`JSON inválido: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      window.setTimeout(() => setMsg(""), 3000);
    }
  }

  const busyLabel = busy === "export" ? "Guardando..." : busy === "import" ? "Aplicando..." : "Plantilla";

  return (
    <div className="pulso-analitica-template-menu" ref={rootRef}>
      <button
        type="button"
        className="pulso-analitica-template-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Guardar o aplicar plantilla de Analítica"
        onClick={() => setOpen((value) => !value)}
        disabled={busy !== null}
      >
        {busy ? <Loader2 size={12} className="pulso-spin" /> : <Download size={12} />}
        <span>{busyLabel}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open && (
        <div className="pulso-analitica-template-popover" role="menu" aria-label="Plantilla de Analítica">
          <button type="button" role="menuitem" onClick={() => void handleExport()} disabled={busy !== null} title={exportTitle}>
            <Download size={13} />
            <span>
              <strong>Guardar plantilla</strong>
              <small>No incluye respuestas ni bases.</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy !== null}
            title={importTitle}
          >
            <Upload size={13} />
            <span>
              <strong>Aplicar plantilla...</strong>
              <small>Actualiza solo la configuración.</small>
            </span>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="pulso-sr-only"
        onChange={(e) => void handleImport(e.target.files?.[0])}
      />

      {msg && (
        <span role="status" className="pulso-analitica-template-feedback is-ok">
          <Check size={11} />
          {msg}
        </span>
      )}
      {error && (
        <span role="alert" className="pulso-analitica-template-feedback is-error">
          <AlertCircle size={11} />
          {error}
        </span>
      )}
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
