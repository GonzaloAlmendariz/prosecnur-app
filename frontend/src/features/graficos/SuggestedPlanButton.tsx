import { useEffect, useRef, useState } from "react";
import { BarChart3, Check, Download, GitMerge, LayoutTemplate, Loader2, Map, RefreshCw, Wand2, X } from "lucide-react";
import {
  apiGraficosPlanSugerido,
  type GraficosSuggestedPlanResponse,
  type PlanJson,
  type Slide,
} from "../../api/client";
import { usePlanStore } from "./store";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { usePptStyleProfiles } from "./usePptStyleProfiles";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { useOptionalProjectShell } from "../project/ProjectShell";
import { buildSuggestedPlanRecipeMarkdown } from "./suggestedPlanRecipe";

function newSlideId(prefix = "sug") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const VISIBLE_PAYLOAD_TEXT_KEYS = new Set([
  "titulo",
  "subtitulo",
  "texto",
  "bullets",
  "base",
  "pie",
  "etiqueta",
  "subtexto",
  "introduccion_word",
]);

function normalizeAcnurVisibleText(value: string): string {
  return value
    .replace(/ACNUR\s+KOICA\s*[-–]\s*/gi, "ACNUR territorial - ")
    .replace(/ACNUR\s+KOICA/gi, "ACNUR territorial")
    .replace(/ACNUR\/KOICA/gi, "ACNUR territorial")
    .replace(/Overview territorial\s+KOICA/gi, "Overview territorial")
    .replace(/diseño\s+KOICA/gi, "diseño territorial")
    .replace(/diseno\s+KOICA/gi, "diseño territorial")
    .replace(/\bKOICA\b/gi, "territorial");
}

function normalizeVisiblePayloadValue(value: unknown): unknown {
  if (typeof value === "string") return normalizeAcnurVisibleText(value);
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? normalizeAcnurVisibleText(item) : item));
  return value;
}

function cloneSuggestedPayload(payload: Slide["payload"]): Slide["payload"] {
  const cloned = JSON.parse(JSON.stringify(payload ?? {})) as Record<string, unknown>;
  for (const key of VISIBLE_PAYLOAD_TEXT_KEYS) {
    if (key in cloned) cloned[key] = normalizeVisiblePayloadValue(cloned[key]);
  }
  return cloned as Slide["payload"];
}

function clonePlanWithFreshIds(plan: PlanJson): PlanJson {
  return {
    slides: (plan.slides ?? []).map((slide): Slide => ({
      ...slide,
      id: newSlideId("sug"),
      payload: cloneSuggestedPayload(slide.payload),
    })),
  };
}

type ComparisonMode = "paired_district" | "district" | "none";

const COMPARISON_MODE_OPTIONS: Array<{ value: ComparisonMode; label: string; hint: string }> = [
  { value: "paired_district", label: "Por pares", hint: "Compara Lima Norte, Lima Este y Lima Sur con sus dos distritos correspondientes." },
  { value: "district", label: "Seis distritos", hint: "Muestra los seis distritos en una misma lectura territorial." },
  { value: "none", label: "Sin comparativo", hint: "Genera el plan territorial sin cruces adicionales." },
];

function reportSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    manual: "Definido manualmente",
    observed: "Calculado desde la base",
    data: "Calculado desde la base",
    metadata: "Metadatos del proyecto",
    project: "Configuración del proyecto",
  };
  return labels[source] ?? source.replaceAll("_", " ");
}

function comparisonLabel(mode: string): string {
  return COMPARISON_MODE_OPTIONS.find((option) => option.value === mode)?.label
    ?? (mode ? mode.replaceAll("_", " ") : "Sin comparación");
}

export function SuggestedPlanButton() {
  const projectShell = useOptionalProjectShell();
  const currentPlan = usePlanStore((s) => s.plan);
  const loadPlan = usePlanStore((s) => s.loadPlan);
  const applyPptStyleProfile = usePlanStore((s) => s.applyPptStyleProfile);
  const setScopeRules = usePlanStore((s) => s.setScopeRules);
  const { profiles: styleProfiles } = usePptStyleProfiles();
  const { registry } = useGraficosRegistry();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GraficosSuggestedPlanResponse | null>(null);
  const [profileId, setProfileId] = useState<"auto" | "acnur_kobo_cruncher_plus">("auto");
  const [acnurMode, setAcnurMode] = useState<"general" | "territorial">("general");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("paired_district");
  const rootRef = useRef<HTMLDivElement>(null);
  const territorialCoverageMeta = registry?.graficadores.find(
    (g) => g.feature_kind === "territorial_coverage" || g.requisito === "territorial_coverage",
  );
  const canIncludeCoverageMaps = territorialCoverageMeta?.available === true;
  const coverageDisabledReason =
    territorialCoverageMeta?.disabled_reason ||
    "Disponible cuando el proyecto tenga Hojas de Ruta y Monitoreo territorial.";
  const projectIdentity = [
    projectShell?.project.status.name,
    projectShell?.project.status.path,
  ].filter(Boolean).join(" ");

  useEffect(() => {
    const isAcnur = /\b(?:ACNUR|UNHCR)\b/i.test(projectIdentity);
    setProfileId(isAcnur ? "acnur_kobo_cruncher_plus" : "auto");
    setAcnurMode("general");
    setComparisonMode("none");
    setResult(null);
  }, [projectIdentity]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (territorialCoverageMeta && !canIncludeCoverageMaps && acnurMode === "territorial") {
      setAcnurMode("general");
      setResult(null);
    }
  }, [acnurMode, canIncludeCoverageMaps, territorialCoverageMeta]);

  async function generate() {
    setOpen(true);
    setBusy(true);
    setError("");
    try {
      const config = buildGraficosConfigFromStore();
      const next = await apiGraficosPlanSugerido({
        ...config,
        ...(profileId === "acnur_kobo_cruncher_plus"
          ? {
              profile_id: profileId,
              acnur_mode: acnurMode,
              include_coverage_maps: acnurMode === "territorial" && canIncludeCoverageMaps,
              comparison_mode: acnurMode === "territorial" ? comparisonMode : "none",
            }
          : {}),
      });
      setResult(next);
    } catch (e) {
      setResult(null);
      const raw = (e as Error).message || "";
      // "Failed to fetch" (o timeouts de red) no significan un error del plan:
      // suelen ser una conexión que se cae mientras el backend aún trabaja.
      // Mostramos una guía accionable en vez del mensaje técnico crudo.
      const isNetwork = /failed to fetch|networkerror|load failed|fetch|timeout|timed out|aborted/i.test(raw);
      setError(
        isNetwork
          ? "No se pudo completar la generación (la conexión se interrumpió). Vuelve a intentar con «Actualizar propuesta»."
          : raw,
      );
    } finally {
      setBusy(false);
    }
  }

  function replacePlan() {
    if (!result) return;
    loadPlan(clonePlanWithFreshIds(result.plan));
    applySelectedStyleProfile();
    setOpen(false);
  }

  function mergePlan() {
    if (!result) return;
    const suggested = clonePlanWithFreshIds(result.plan);
    loadPlan({ slides: [...currentPlan.slides, ...suggested.slides] });
    applySelectedStyleProfile();
    setOpen(false);
  }

  function applySelectedStyleProfile() {
    if (!result) return;
    const resolvedProfileId = result.profile_id || (profileId === "auto" ? "" : profileId);
    const profile = styleProfiles.find((p) => p.name === resolvedProfileId);
    if (profile) applyPptStyleProfile(profile);

    const identity: Record<string, unknown> = {};
    if (resolvedProfileId) identity.profile_id = resolvedProfileId;
    if (result.template_id) identity.template_id = result.template_id;
    if (result.acnur_mode) identity.acnur_mode = result.acnur_mode;
    if (result.report_scope) identity.report_scope = result.report_scope;
    if (result.meta) identity.meta = result.meta;
    if (!Object.keys(identity).length) return;

    const currentScopeRules = usePlanStore.getState().scopeRules;
    const currentGlobal = currentScopeRules.global;
    setScopeRules({
      ...currentScopeRules,
      global: {
        ...(currentGlobal && typeof currentGlobal === "object" && !Array.isArray(currentGlobal)
          ? currentGlobal as Record<string, unknown>
          : {}),
        ...identity,
      },
    });
  }

  function downloadRecipe() {
    if (!result?.report_inputs) return;
    const markdown = buildSuggestedPlanRecipeMarkdown(result.report_inputs, {
      acnurMode: result.acnur_mode ?? acnurMode,
      profileLabel: "ACNUR",
    });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "guia-informe-acnur.md";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const summary = result?.coverage?.summary;

  return (
    <div className="pulso-gv2-suggest-root" ref={rootRef}>
      <button
        type="button"
        className="pulso-gv2-pill-button pulso-gv2-suggest-trigger"
        onClick={generate}
        disabled={busy}
        aria-label="Planes predeterminados de gráficos"
        title="Planes predeterminados de gráficos"
      >
        {busy ? <Loader2 size={13} className="pulso-spin" /> : <LayoutTemplate size={14} />}
        <span className="pulso-gv2-suggest-trigger-label">Planes</span>
      </button>

      {open && (
        <div className="pulso-gv2-suggest-popover" role="dialog" aria-label="Plan de gráficos sugerido">
          <div className="pulso-gv2-suggest-head">
            <div>
              <strong>Planes predeterminados</strong>
              <span>Elige un plan base y previsualízalo antes de aplicarlo al plan actual.</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">
              <X size={13} />
            </button>
          </div>

          <div className="pulso-gv2-suggest-options" aria-label="Opciones del plan sugerido">
            <div className="pulso-gv2-suggest-profile" role="radiogroup" aria-label="Perfil de plantilla">
              <button
                type="button"
                className={profileId === "auto" ? "is-active" : ""}
                aria-pressed={profileId === "auto"}
                onClick={() => {
                  setProfileId("auto");
                  setResult(null);
                }}
              >
                <Wand2 size={13} /> Automático
              </button>
              <button
                type="button"
                className={profileId === "acnur_kobo_cruncher_plus" ? "is-active" : ""}
                aria-pressed={profileId === "acnur_kobo_cruncher_plus"}
                onClick={() => {
                  setProfileId("acnur_kobo_cruncher_plus");
                  setResult(null);
                }}
              >
                <BarChart3 size={13} /> ACNUR
              </button>
            </div>

            {profileId === "acnur_kobo_cruncher_plus" && (
              <div className="pulso-gv2-suggest-acnur">
                <div className="pulso-gv2-suggest-mode" role="radiogroup" aria-label="Modo ACNUR">
                  <button
                    type="button"
                    className={acnurMode === "general" ? "is-active" : ""}
                    aria-pressed={acnurMode === "general"}
                    onClick={() => {
                      setAcnurMode("general");
                      setResult(null);
                    }}
                  >
                    <BarChart3 size={13} /> General
                  </button>
                  <button
                    type="button"
                    className={acnurMode === "territorial" ? "is-active" : ""}
                    aria-pressed={acnurMode === "territorial"}
                    disabled={!canIncludeCoverageMaps}
                    title={!canIncludeCoverageMaps ? coverageDisabledReason : undefined}
                    onClick={() => {
                      setAcnurMode("territorial");
                      setComparisonMode("paired_district");
                      setResult(null);
                    }}
                  >
                    <Map size={13} /> Territorial
                  </button>
                </div>
                {acnurMode === "general" ? (
                  <div className="pulso-gv2-suggest-option-text">
                    <strong>ACNUR general</strong>
                    <small>Usa la identidad ACNUR, sin mapas territoriales ni comparativos.</small>
                  </div>
                ) : (
                  <div className="pulso-gv2-suggest-comparison">
                    <span className="pulso-gv2-suggest-option-text">
                      <strong>ACNUR territorial</strong>
                      <small>Agrega mapas al inicio. Puedes activar o quitar el comparativo.</small>
                    </span>
                    <div className="pulso-gv2-suggest-comparison-segment" role="radiogroup" aria-label="Comparativo territorial">
                      {COMPARISON_MODE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={comparisonMode === option.value ? "is-active" : ""}
                          aria-pressed={comparisonMode === option.value}
                          title={option.hint}
                          onClick={() => {
                            setComparisonMode(option.value);
                            setResult(null);
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="pulso-gv2-suggest-regenerate"
              onClick={generate}
              disabled={busy}
            >
              {busy ? <Loader2 size={12} className="pulso-spin" /> : <RefreshCw size={12} />}
              Actualizar propuesta
            </button>
          </div>

          {busy && (
            <div className="pulso-gv2-suggest-state">
              <Loader2 size={15} className="pulso-spin" />
              <span>
                Revisando variables, recodificadas y secciones del instrumento…
                <small>En estudios grandes puede tardar unos segundos.</small>
              </span>
            </div>
          )}

          {error && <div className="pulso-gv2-suggest-error">{error}</div>}

          {result && (
            <>
              <div className="pulso-gv2-suggest-kpis">
                <div>
                  <strong>{result.plan.slides.length}</strong>
                  <span>slides propuestos</span>
                </div>
                <div>
                  <strong>{summary?.included_graphable ?? 0}/{summary?.graphable_variables ?? 0}</strong>
                  <span>graficables cubiertas</span>
                </div>
                <div>
                  <strong>{summary?.covered_by_recod ?? 0}</strong>
                  <span>cubiertas por recod</span>
                </div>
              </div>

              {result.warnings?.length ? (
                <div className="pulso-gv2-suggest-warning">
                  {result.warnings.join(" · ")}
                </div>
              ) : null}

              {result.report_inputs && (
                <section className="pulso-gv2-suggest-inputs" aria-label="Datos que usará el informe">
                  <div className="pulso-gv2-suggest-inputs-head">
                    <div>
                      <strong>Datos que usará el informe</strong>
                      <span>Revise estos datos antes de aplicar el plan.</span>
                    </div>
                    <button type="button" onClick={downloadRecipe}>
                      <Download size={12} /> Descargar guía
                    </button>
                  </div>

                  <dl className="pulso-gv2-suggest-inputs-summary">
                    <div>
                      <dt>Periodo</dt>
                      <dd>{result.report_inputs.period || "No indicado"}</dd>
                      <small>{reportSourceLabel(result.report_inputs.period_source)}</small>
                    </div>
                    <div>
                      <dt>Perfil</dt>
                      <dd>{result.report_inputs.profile?.available ? "Incluido" : "No incluido"}</dd>
                      <small>
                        {[result.report_inputs.profile?.sex_variable, result.report_inputs.profile?.age_variable]
                          .filter(Boolean).join(" · ") || "Sin variables asignadas"}
                      </small>
                    </div>
                    <div>
                      <dt>Mapa</dt>
                      <dd>{result.report_inputs.map_included ? "Incluido" : "No incluido"}</dd>
                      <small>{comparisonLabel(result.report_inputs.comparison_mode)}</small>
                    </div>
                  </dl>

                  <div className="pulso-gv2-suggest-inputs-block">
                    <strong>Ficha técnica</strong>
                    <div className="pulso-gv2-suggest-technical-summary">
                      {result.report_inputs.technical_rows.slice(0, 4).map((row, index) => (
                        <span key={`${row.criterio}-${index}`}>
                          <b>{row.criterio || `Fila ${index + 1}`}</b>
                          <em>{row.detalle || "Sin detalle"}</em>
                        </span>
                      ))}
                      {result.report_inputs.technical_rows.length === 0 && <span>Sin filas definidas.</span>}
                      {result.report_inputs.technical_rows.length > 4 && (
                        <span>+{result.report_inputs.technical_rows.length - 4} filas en el plan</span>
                      )}
                    </div>
                  </div>

                  {result.report_inputs.derived_variables.length > 0 && (
                    <div className="pulso-gv2-suggest-inputs-block">
                      <strong>Variables calculadas</strong>
                      <div className="pulso-gv2-suggest-derived-list">
                        {result.report_inputs.derived_variables.map((variable) => (
                          <span key={`${variable.source ?? ""}-${variable.name}`} title={variable.origin}>
                            <b>{variable.label}</b>
                            <code>{variable.name}</code>
                            <em>Derivada del informe</em>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              <div className="pulso-gv2-suggest-preview">
                {(result.plan.slides ?? []).slice(0, 10).map((slide, index) => (
                  <div key={`${slide.id}-${index}`}>
                    <strong>{index + 1}. {normalizeAcnurVisibleText(String(slide.payload?.titulo || slide.tipo))}</strong>
                    <span>{slide.tipo}</span>
                  </div>
                ))}
                {result.plan.slides.length > 10 && (
                  <div className="pulso-gv2-suggest-more">
                    +{result.plan.slides.length - 10} slides más
                  </div>
                )}
              </div>

              <div className="pulso-gv2-suggest-actions">
                <button type="button" onClick={replacePlan} className="is-primary">
                  <Check size={12} /> Reemplazar plan actual
                </button>
                <button type="button" onClick={mergePlan}>
                  <GitMerge size={12} /> Fusionar al final
                </button>
                <button type="button" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
