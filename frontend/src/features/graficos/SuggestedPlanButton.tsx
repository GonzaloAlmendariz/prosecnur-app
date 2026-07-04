import { useEffect, useRef, useState } from "react";
import { BarChart3, Check, GitMerge, Loader2, Map, Sparkles, X } from "lucide-react";
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

function newSlideId(prefix = "sug") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clonePlanWithFreshIds(plan: PlanJson): PlanJson {
  return {
    slides: (plan.slides ?? []).map((slide): Slide => ({
      ...slide,
      id: newSlideId("sug"),
      payload: JSON.parse(JSON.stringify(slide.payload ?? {})),
    })),
  };
}

type ComparisonMode = "koica_group" | "district" | "none";

const COMPARISON_MODE_OPTIONS: Array<{ value: ComparisonMode; label: string; hint: string }> = [
  { value: "koica_group", label: "Comparativo", hint: "Cruza los gráficos por la variable territorial comparativa." },
  { value: "district", label: "Distrito", hint: "Usa distrito como lectura territorial." },
  { value: "none", label: "Sin comparativo", hint: "Genera el plan territorial sin cruces adicionales." },
];

export function SuggestedPlanButton() {
  const currentPlan = usePlanStore((s) => s.plan);
  const loadPlan = usePlanStore((s) => s.loadPlan);
  const applyPptStyleProfile = usePlanStore((s) => s.applyPptStyleProfile);
  const { profiles: styleProfiles } = usePptStyleProfiles();
  const { registry } = useGraficosRegistry();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GraficosSuggestedPlanResponse | null>(null);
  const [profileId, setProfileId] = useState<"auto" | "acnur_kobo_cruncher_plus">("auto");
  const [acnurMode, setAcnurMode] = useState<"general" | "territorial">("general");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("koica_group");
  const rootRef = useRef<HTMLDivElement>(null);
  const territorialCoverageMeta = registry?.graficadores.find(
    (g) => g.feature_kind === "territorial_coverage" || g.requisito === "territorial_coverage",
  );
  const canIncludeCoverageMaps = territorialCoverageMeta?.available === true;
  const coverageDisabledReason =
    territorialCoverageMeta?.disabled_reason ||
    "Disponible cuando el proyecto tenga Hojas de Ruta y Monitoreo territorial.";

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
      setError((e as Error).message);
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
    if (profileId !== "acnur_kobo_cruncher_plus") return;
    const profile = styleProfiles.find((p) => p.name === profileId);
    if (profile) applyPptStyleProfile(profile);
  }

  const summary = result?.coverage?.summary;

  return (
    <div className="pulso-gv2-suggest-root" ref={rootRef}>
      <button
        type="button"
        className="pulso-gv2-pill-button pulso-gv2-suggest-trigger"
        onClick={generate}
        disabled={busy}
        aria-label="Sugerir plan de gráficos"
        title="Sugerir plan de gráficos"
      >
        {busy ? <Loader2 size={12} className="pulso-spin" /> : <Sparkles size={12} />}
        <span className="pulso-gv2-suggest-trigger-label">Sugerir</span>
      </button>

      {open && (
        <div className="pulso-gv2-suggest-popover" role="dialog" aria-label="Plan de gráficos sugerido">
          <div className="pulso-gv2-suggest-head">
            <div>
              <strong>Plan de gráficos sugerido</strong>
              <span>Previsualiza la propuesta antes de aplicarla al plan actual.</span>
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
                <Sparkles size={13} /> Automático
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
                <BarChart3 size={13} /> ACNUR azul
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
                      setComparisonMode("koica_group");
                      setResult(null);
                    }}
                  >
                    <Map size={13} /> Territorial
                  </button>
                </div>
                {acnurMode === "general" ? (
                  <div className="pulso-gv2-suggest-option-text">
                    <strong>ACNUR normal</strong>
                    <small>Usa el azul ACNUR, sin mapas territoriales ni comparativos.</small>
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
              {busy ? <Loader2 size={12} className="pulso-spin" /> : <Sparkles size={12} />}
              Actualizar propuesta
            </button>
          </div>

          {busy && (
            <div className="pulso-gv2-suggest-state">
              <Loader2 size={15} className="pulso-spin" />
              Revisando variables, recodificadas y secciones del instrumento…
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

              <div className="pulso-gv2-suggest-preview">
                {(result.plan.slides ?? []).slice(0, 10).map((slide, index) => (
                  <div key={`${slide.id}-${index}`}>
                    <strong>{index + 1}. {String(slide.payload?.titulo || slide.tipo)}</strong>
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
