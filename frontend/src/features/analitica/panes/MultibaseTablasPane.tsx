import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, GitBranch, Info, Percent, Rows3, Table2 } from "lucide-react";
import {
  AnaliticaMultibaseKey,
  apiAnaliticaMultibaseInfo,
  apiAnaliticaMultibaseTablas,
} from "../../../api/client";
import { Panel } from "../../../components/Panel";
import { useAnaliticaStore } from "../store";
import { Section, GenerateFooter } from "../PaneKit";
import { useReporteRun } from "../useReporteRun";

export function MultibaseTablasPane() {
  const cfg = useAnaliticaStore((s) => s.config.multibase);
  const frec = useAnaliticaStore((s) => s.config.frecuencias);
  const setMultibase = useAnaliticaStore((s) => s.setMultibase);
  const setFrecuencias = useAnaliticaStore((s) => s.setFrecuencias);
  const run = useReporteRun();
  const [info, setInfo] = useState<{
    available: boolean;
    base_name?: string;
    origin_key_name?: string;
    keys: AnaliticaMultibaseKey[];
    has_metadata?: boolean;
  } | null>(null);
  const [infoError, setInfoError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInfoError("");
      try {
        const out = await apiAnaliticaMultibaseInfo();
        if (!cancelled) {
          setInfo({
            available: out.available,
            base_name: out.base_name,
            origin_key_name: out.origin_key_name,
            keys: out.keys ?? [],
            has_metadata: out.has_metadata,
          });
        }
      } catch (e) {
        if (!cancelled) setInfoError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onGenerate() {
    await run.runAsync(() => apiAnaliticaMultibaseTablas());
  }

  const totalN = useMemo(
    () => (info?.keys ?? []).reduce((sum, key) => sum + (key.n ?? 0), 0),
    [info],
  );
  const ordenLabel = frec.orden === "asc" ? "Ascendente" : frec.orden === "desc" ? "Descendente" : "Instrumento";

  return (
    <Panel
      eyebrow="Reporte"
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><GitBranch size={16} /> Tablas multibase</span>}
      hint="Genera una hoja global por llave y hojas independientes por valor de la llave, usando el mismo instrumento integrado."
    >
      <div className="analitica-report-shell">
        <div className="analitica-report-overview">
          <Metric label="Base" value={info?.base_name ?? "Integrada"} compact />
          <Metric label="Llave" value={info?.origin_key_name ?? "Detectando"} compact />
          <Metric label="Valores" value={info?.keys.length ?? 0} suffix="hojas" />
          <Metric label="Casos" value={totalN} suffix="filas" />
        </div>

        <div className="analitica-report-note">
          <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            La salida queda en un solo Excel: una hoja global cruzada por la llave y una hoja simple para cada valor seleccionado.
          </div>
        </div>

        {info?.keys.length ? (
          <div className="analitica-token-list">
            {info.keys.map((key) => (
              <span key={key.value} className="analitica-token">
                <strong>{key.label}</strong>
                <small>{key.n} casos</small>
              </span>
            ))}
          </div>
        ) : null}

        <Section
          title="Hojas del Excel"
          subtitle="Define si cada tipo de hoja muestra porcentajes además del conteo."
        >
          <div className="analitica-control-grid">
            <OutputScopeCard
              title="Hoja global"
              copy="Cruza cada variable contra la llave detectada."
              icon={<GitBranch size={15} />}
              pct={cfg.global.incluir_porcentajes}
              sections={cfg.global.incluir_secciones}
              onPct={(next) => setMultibase({ global: { ...cfg.global, incluir_porcentajes: next } })}
              onSections={(next) => setMultibase({ global: { ...cfg.global, incluir_secciones: next } })}
            />
            <OutputScopeCard
              title="Hojas por llave"
              copy="Genera tablas simples dentro de cada valor de origen."
              icon={<Table2 size={15} />}
              pct={cfg.origenes.incluir_porcentajes}
              sections={cfg.origenes.incluir_secciones}
              onPct={(next) => setMultibase({ origenes: { ...cfg.origenes, incluir_porcentajes: next } })}
              onSections={(next) => setMultibase({ origenes: { ...cfg.origenes, incluir_secciones: next } })}
            />
          </div>
        </Section>

        <Section
          title="Orden de categorías"
          subtitle="El mismo orden se aplica a la hoja global y a las hojas por llave."
        >
          <div className="analitica-segmented" role="group" aria-label="Orden de categorias">
            {[
              { value: "original", label: "Instrumento" },
              { value: "desc", label: "Mayor N" },
              { value: "asc", label: "Menor N" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={frec.orden === opt.value ? "is-on" : undefined}
                onClick={() => setFrecuencias({ orden: opt.value as typeof frec.orden })}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="analitica-control-grid" style={{ marginTop: 10 }}>
            <label className={`analitica-control-card ${frec.mostrar_todo ? "is-active" : ""}`} style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={frec.mostrar_todo}
                onChange={(e) => setFrecuencias({ mostrar_todo: e.target.checked })}
                style={{ marginTop: 6, accentColor: "var(--pulso-primary)" }}
              />
              <span className="analitica-control-icon">
                {frec.mostrar_todo ? <CheckCircle2 size={15} /> : <Rows3 size={15} />}
              </span>
              <span>
                <span className="analitica-control-title">Mostrar catálogo completo</span>
                <span className="analitica-control-copy">Incluye categorías definidas aunque no tengan casos.</span>
              </span>
            </label>
            <div className="analitica-control-card">
              <span className="analitica-control-icon"><Rows3 size={15} /></span>
              <span>
                <span className="analitica-control-title">Orden actual: {ordenLabel}</span>
                <span className="analitica-control-copy">Se respeta al generar todas las hojas del archivo.</span>
              </span>
            </div>
          </div>
        </Section>

        <GenerateFooter
          label="Generar tablas multibase"
          busy={run.busy}
          jobId={run.jobId}
          fileId={run.fileId}
          downloadName={run.filename ?? "tablas_multibase.xlsx"}
          error={run.error || infoError}
          onGenerate={onGenerate}
          disabled={!info?.available}
          disabledHint={!info?.available ? "Este reporte se activa cuando la base integrada tiene una llave con dos o más valores." : undefined}
          perBase={run.perBase}
          onJobDone={run.onJobDone}
          onJobError={run.onJobError}
          onJobCancelled={run.onJobCancelled}
        />
      </div>
    </Panel>
  );
}

function OutputScopeCard({
  title,
  copy,
  icon,
  pct,
  sections,
  onPct,
  onSections,
}: {
  title: string;
  copy: string;
  icon: ReactNode;
  pct: boolean;
  sections: boolean;
  onPct: (next: boolean) => void;
  onSections: (next: boolean) => void;
}) {
  return (
    <div className="analitica-control-card" style={{ flexDirection: "column", minHeight: 148 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span className="analitica-control-icon">{icon}</span>
        <span>
          <span className="analitica-control-title">{title}</span>
          <span className="analitica-control-copy">{copy}</span>
        </span>
      </div>
      <div style={{ display: "grid", gap: 8, width: "100%" }}>
        <SwitchRow
          label="Mostrar porcentajes"
          icon={<Percent size={13} />}
          checked={pct}
          onChange={onPct}
        />
        <SwitchRow
          label="Mostrar secciones"
          icon={<Rows3 size={13} />}
          checked={sections}
          onChange={onSections}
        />
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--pulso-text)", fontSize: 12, fontWeight: 650 }}>
        {icon}
        {label}
      </span>
      <button
        type="button"
        className="pulso-switch"
        aria-checked={checked}
        role="switch"
        onClick={() => onChange(!checked)}
      >
        <span className="pulso-switch-thumb" />
      </button>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  compact,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  compact?: boolean;
}) {
  return (
    <div className="analitica-stat">
      <span className="analitica-stat-label">{label}</span>
      <span className="analitica-stat-value" style={compact ? { fontSize: 13, paddingTop: 2 } : undefined}>
        {value}
        {suffix && <small>{suffix}</small>}
      </span>
    </div>
  );
}
