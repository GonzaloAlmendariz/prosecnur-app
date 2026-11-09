// «Armar desde un plan sugerido» (`panel=armar-desde`, popover direccionable; contrato A5 rebanada 2b). Vive en la barra
// común de Láminas y Vista general y en la del Editor anterior. Aplicar es UN paso deshacible
// (`usePlanStore.aplicarPlanSugerido`), también en el informe compartido (ADR 0096 decisión 9). Las reglas puras viven en
// `armarDesde/aplicarPlanSugerido.ts`.

import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { BarChart3, Check, Download, GitMerge, LayoutTemplate, Loader2, Map, RefreshCw, Wand2 } from "../../vendor/lucide-react";
import {
  apiGraficosPlanSugerido,
  type GraficosSuggestedPlanResponse,
  type PlanJson,
  type Slide,
} from "../../api/client";
import { SLIDE_LABELS, usePlanStore } from "./store";
import { useVariables } from "./useVariables";
import { tituloQueSale } from "./laminas/tituloQueSale";
import { buildGraficosConfigFromStore } from "./configSnapshot";
import { usePptStyleProfiles } from "./usePptStyleProfiles";
import { useGraficosRegistry } from "./useGraficosRegistry";
import { useOptionalProjectShell } from "../project/ProjectShell";
import { buildSuggestedPlanRecipeMarkdown } from "./suggestedPlanRecipe";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { PANEL_ARMAR_DESDE } from "./panelesGraficos";
import { useGraficosReportScope } from "./reportScope";
import {
  debePedirPropuesta,
  textoAvisosPlan,
  identidadDelPlan,
  perfilResuelto,
  propuestaOtros,
  type ModoAplicarPlan,
} from "./armarDesde/aplicarPlanSugerido";
import { enfocarSinDesplazar } from "./laminas/enfocarSinDesplazar";
import "./armarDesde/armarDesde.css";
import { contenidoPropuesto, tituloPropuesto } from "./armarDesde/vistaPreviaPropuesta";
import { formatoConteo } from "../../lib/formatoNumero";
import { CabeceraPanel } from "../../components/CabeceraPanel";
import { PulsoButton } from "../../components/PulsoButton";
import { RadioSegmentado } from "./subpestanas/RadioSegmentado";

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
  const autoOtrosActual = usePlanStore((s) => s.autoOtrosSlides);
  const aplicarPlanSugerido = usePlanStore((s) => s.aplicarPlanSugerido);
  const { profiles: styleProfiles } = usePptStyleProfiles();
  const { registry } = useGraficosRegistry();
  // Abierto = la URL lo pide (`panel=armar-desde`): el enlace reproduce lo que se ve y cerrar borra el param.
  const panel = usePanelDireccionable(PANEL_ARMAR_DESDE);
  const open = panel.abierto;
  // ADR 0096: en el informe compartido la propuesta se pide con su alcance (la siembra desde la matriz).
  const alcance = useGraficosReportScope(useLocation().search);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GraficosSuggestedPlanResponse | null>(null);
  // ADR 0103: la matriz de equivalencias ya no es fuente del plan; ACNUR sigue activable (su PPT es distinto al de PULSO).
  const [profileId, setProfileId] = useState<"auto" | "acnur_kobo_cruncher_plus">("auto");
  const [acnurMode, setAcnurMode] = useState<"general" | "territorial">("general");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("paired_district");
  // Lo que el plan propone para «Otros» sólo se aplica si el analista lo acepta aquí (nunca sin avisar).
  const [aceptarOtros, setAceptarOtros] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const dialogoRef = useRef<HTMLDivElement>(null);
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

  const { variables } = useVariables();
  useEffect(() => {
    const isAcnur = /\b(?:ACNUR|UNHCR)\b/i.test(projectIdentity);
    setProfileId(isAcnur ? "acnur_kobo_cruncher_plus" : "auto");
    setAcnurMode("general");
    setComparisonMode("none");
    setResult(null);
  }, [projectIdentity]);

  const cerrarPanel = panel.cerrar;
  const cerrar = useRef(cerrarPanel);
  cerrar.current = cerrarPanel;
  /** Cerrar desde un control del diálogo (aplicar, «Cerrar», ✕): el foco vuelve al disparador, nunca a `<body>` (C4). */
  function cerrarDevolviendoFoco() {
    panel.cerrar();
    enfocarSinDesplazar(disparadorRef.current);
  }

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) cerrar.current();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      cerrar.current();
      enfocarSinDesplazar(disparadorRef.current);
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

  // Abrir (por clic o por enlace) pide la propuesta una vez, en la base activa y en el informe compartido.
  const generar = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (debePedirPropuesta(open)) generar.current();
  }, [open]);
  // Abierto desde la barra, desde el CTA de un vacío o por enlace, el foco entra al diálogo (sin mover el scroll).
  useEffect(() => {
    if (!open) return;
    const marco = requestAnimationFrame(() => enfocarSinDesplazar(dialogoRef.current));
    return () => cancelAnimationFrame(marco);
  }, [open]);

  async function generate() {
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
      }, alcance);
      setResult(next);
      setAceptarOtros(false);
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

  generar.current = () => { void generate(); };

  /**
   * UN paso deshacible (contrato A5 2b): plan, sello de la declaración (ADR 0063, ver `revisionAlAplicar`), perfil de
   * estilo, identidad en `scope_rules.global` y, si se aceptó, el «Otros» que propone el plan.
   */
  function aplicar(modo: ModoAplicarPlan, plan: PlanJson) {
    if (!result) return;
    const perfilId = perfilResuelto(result, profileId);
    const otros = propuestaOtros(result, autoOtrosActual);
    aplicarPlanSugerido({
      plan,
      perfil: styleProfiles.find((p) => p.name === perfilId) ?? null,
      identidad: identidadDelPlan(result, profileId),
      ...(otros !== null && aceptarOtros ? { autoOtrosSlides: otros } : {}),
    });
    cerrarDevolviendoFoco();
  }

  function replacePlan() {
    if (!result) return;
    aplicar("reemplazar", clonePlanWithFreshIds(result.plan));
  }

  function mergePlan() {
    if (!result) return;
    const suggested = clonePlanWithFreshIds(result.plan);
    aplicar("fusionar", { slides: [...currentPlan.slides, ...suggested.slides] });
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
  const propuesta = result ? propuestaOtros(result, autoOtrosActual) : null;

  return (
    <div className="pulso-gv2-suggest-root" ref={rootRef}>
      <button
        type="button"
        ref={disparadorRef}
        className="pulso-gv2-pill-button pulso-gv2-suggest-trigger"
        onClick={panel.alternar}
        disabled={busy}
        aria-label={PANEL_ARMAR_DESDE.label}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={PANEL_ARMAR_DESDE.label}
      >
        {busy ? <Loader2 size={13} className="pulso-spin" /> : <LayoutTemplate size={14} />}
        <span className="pulso-gv2-suggest-trigger-label">Armar desde…</span>
      </button>

      {open && (
        <div ref={dialogoRef} tabIndex={-1} className="pulso-gv2-suggest-popover" role="dialog" aria-label={PANEL_ARMAR_DESDE.label} {...panel.props}>
          {/* R9-7: la cabecera y la X del kit; «Cancelar» sale del pie (la X y Escape cierran). */}
          <CabeceraPanel
            className="pulso-gv2-suggest-cabecera"
            titulo="Armar desde un plan sugerido"
            subtitulo="Elige un plan base y previsualízalo antes de aplicarlo al plan actual."
            onCerrar={cerrarDevolviendoFoco}
            etiquetaCerrar="Cerrar plan sugerido"
          />


          <div className="pulso-gv2-suggest-options" aria-label="Opciones del plan sugerido">
            <RadioSegmentado
              etiqueta="Perfil de plantilla"
              ancho
              valor={profileId}
              onCambiar={(k) => { setProfileId(k); setResult(null); }}
              opciones={[
                { clave: "auto", rotulo: <><Wand2 aria-hidden="true" /> Automático</> , titulo: "Automático" },
                { clave: "acnur_kobo_cruncher_plus", rotulo: <><BarChart3 aria-hidden="true" /> ACNUR</>, titulo: "ACNUR" },
              ]}
            />

            {profileId === "acnur_kobo_cruncher_plus" && (
              <div className="pulso-gv2-suggest-acnur">
                <RadioSegmentado
                  etiqueta="Modo ACNUR"
                  ancho
                  valor={acnurMode}
                  onCambiar={(k) => {
                    setAcnurMode(k);
                    if (k === "territorial") setComparisonMode("paired_district");
                    setResult(null);
                  }}
                  opciones={[
                    { clave: "general", rotulo: <><BarChart3 aria-hidden="true" /> General</>, titulo: "General" },
                    { clave: "territorial", rotulo: <><Map aria-hidden="true" /> Territorial</>, titulo: !canIncludeCoverageMaps ? coverageDisabledReason : "Territorial", deshabilitada: !canIncludeCoverageMaps },
                  ]}
                />
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
                    <RadioSegmentado
                      etiqueta="Comparativo territorial"
                      ancho
                      valor={comparisonMode}
                      onCambiar={(k) => { setComparisonMode(k); setResult(null); }}
                      opciones={COMPARISON_MODE_OPTIONS.map((o) => ({ clave: o.value, rotulo: o.label, titulo: o.hint }))}
                    />
                  </div>
                )}
              </div>
            )}
            <PulsoButton variant="secondary" size="sm" className="pulso-f6-armar-regenerar" onClick={generate} disabled={busy}>
              {busy ? <Loader2 className="pulso-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              Actualizar propuesta
            </PulsoButton>
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
                  <strong>{formatoConteo(result.plan.slides.length)}</strong>
                  <span>{result.plan.slides.length === 1 ? "lámina propuesta" : "láminas propuestas"}</span>
                </div>
                <div>
                  <strong>{summary?.included_graphable ?? 0}/{summary?.graphable_variables ?? 0}</strong>
                  <span>graficables cubiertas</span>
                </div>
                <div>
                  <strong>{summary?.covered_by_recod ?? 0}</strong>
                  <span>cubiertas por recodificación</span>
                </div>
              </div>

              {result.warnings?.length ? (
                <div className="pulso-gv2-suggest-warning">
                  {textoAvisosPlan(result.warnings)}
                </div>
              ) : null}

              {result.report_inputs && (
                <section className="pulso-gv2-suggest-inputs" aria-label="Datos que usará el informe">
                  <div className="pulso-f6-armar-datos-cabeza">
                    <div>
                      <strong>Datos que usará el informe</strong>
                      <span>Revisa estos datos antes de aplicar el plan.</span>
                    </div>
                    <PulsoButton variant="ghost" size="sm" onClick={downloadRecipe}>
                      <Download aria-hidden="true" /> Descargar guía
                    </PulsoButton>
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
                          .filter(Boolean).join(", ") || "Sin variables asignadas"}
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
                    <strong>{index + 1}. {normalizeAcnurVisibleText(tituloPropuesto(slide.payload?.titulo, tituloQueSale(slide, variables, SLIDE_LABELS[slide.tipo] ?? slide.tipo)))}</strong>
                    <span>{contenidoPropuesto(slide.tipo)}</span>
                  </div>
                ))}
                {result.plan.slides.length > 10 && (
                  <div className="pulso-gv2-suggest-more">
                    +{result.plan.slides.length - 10} láminas más
                  </div>
                )}
              </div>

              {propuesta !== null && (
                <label className="pulso-f6-armar-otros">
                  <input type="checkbox" checked={aceptarOtros} onChange={(e) => setAceptarOtros(e.target.checked)} />
                  <span>
                    Este plan propone {propuesta ? "agregar" : "quitar"} las láminas de «Otros» en el PowerPoint
                    (hoy están {autoOtrosActual ? "puestas" : "quitadas"}). Aplicarlo también.
                  </span>
                </label>
              )}

              <div className="pulso-f6-armar-acciones">
                <PulsoButton variant="secondary" onClick={mergePlan}>
                  <GitMerge aria-hidden="true" /> Fusionar al final
                </PulsoButton>
                <PulsoButton variant="primary" onClick={replacePlan}>
                  <Check aria-hidden="true" /> Reemplazar plan actual
                </PulsoButton>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
