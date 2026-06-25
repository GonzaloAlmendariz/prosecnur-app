import { useEffect, useRef, useState } from "react";
import { Check, GitMerge, Loader2, Sparkles, X } from "lucide-react";
import {
  apiGraficosPlanSugerido,
  type GraficosSuggestedPlanResponse,
  type PlanJson,
  type Slide,
} from "../../api/client";
import { usePlanStore } from "./store";
import { buildGraficosConfigFromStore } from "./configSnapshot";

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

export function SuggestedPlanButton() {
  const currentPlan = usePlanStore((s) => s.plan);
  const loadPlan = usePlanStore((s) => s.loadPlan);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GraficosSuggestedPlanResponse | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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

  async function generate() {
    setOpen(true);
    setBusy(true);
    setError("");
    try {
      const next = await apiGraficosPlanSugerido(buildGraficosConfigFromStore());
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
    setOpen(false);
  }

  function mergePlan() {
    if (!result) return;
    const suggested = clonePlanWithFreshIds(result.plan);
    loadPlan({ slides: [...currentPlan.slides, ...suggested.slides] });
    setOpen(false);
  }

  const summary = result?.coverage?.summary;

  return (
    <div className="pulso-gv2-suggest-root" ref={rootRef}>
      <button
        type="button"
        className="pulso-gv2-pill-button pulso-gv2-suggest-trigger"
        onClick={generate}
        disabled={busy}
      >
        {busy ? <Loader2 size={12} className="pulso-spin" /> : <Sparkles size={12} />}
        Sugerir plan
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
