// «Armar desde un plan sugerido» (`panel=armar-desde`, popover direccionable; contrato A5 rebanada 2b). Vive en la barra
// común de Láminas y Vista general y en la del Editor anterior. Aplicar es UN paso deshacible
// (`usePlanStore.aplicarPlanSugerido`); en el informe compartido queda `aria-disabled` con su motivo y no pide nada al
// backend (decisión 17 de Gonzalo, provisional). Las reglas puras viven en `armarDesde/aplicarPlanSugerido.ts`.

import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { BarChart3, Check, Download, GitMerge, LayoutTemplate, Loader2, Map, RefreshCw, Wand2, X } from "../../vendor/lucide-react";
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
import { esEquivalente, sincronizarEquivalentes } from "./sincronizarEquivalentes";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { PANEL_ARMAR_DESDE } from "./panelesGraficos";
import { useGraficosReportScope } from "./reportScope";
import {
  debePedirPropuesta,
  identidadDelPlan,
  motivoArmarDesdeDeshabilitado,
  perfilResuelto,
  propuestaOtros,
  revisionAlAplicar,
  type ModoAplicarPlan,
} from "./armarDesde/aplicarPlanSugerido";
import { enfocarSinDesplazar } from "./laminas/enfocarSinDesplazar";
import "./armarDesde/armarDesde.css";
import { contenidoPropuesto, textoFueraDelMazo, tituloPropuesto } from "./armarDesde/vistaPreviaPropuesta";

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
  const motivo = motivoArmarDesdeDeshabilitado(alcance);
  const motivoId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GraficosSuggestedPlanResponse | null>(null);
  const [profileId, setProfileId] = useState<"auto" | "acnur_kobo_cruncher_plus" | "equivalencias">("auto");
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
    if (debePedirPropuesta(open, motivo)) generar.current();
  }, [open, motivo]);
  // Abierto desde la barra, desde el CTA de un vacío o por enlace, el foco entra al diálogo (sin mover el scroll).
  useEffect(() => {
    if (!open) return;
    const marco = requestAnimationFrame(() => enfocarSinDesplazar(dialogoRef.current));
    return () => cancelAnimationFrame(marco);
  }, [open]);

  async function generate() {
    if (!debePedirPropuesta(true, motivo)) return;
    setBusy(true);
    setError("");
    try {
      const config = buildGraficosConfigFromStore();
      const next = await apiGraficosPlanSugerido({
        ...config,
        // ADR 0063: el mazo declarado entra por este mismo endpoint como una
        // fuente mas, no por un generador aparte.
        ...(profileId === "equivalencias" ? { fuente: "equivalencias" } : {}),
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
      revision: revisionAlAplicar(modo, result),
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

  /**
   * Pone al día SOLO el bloque que deriva la matriz de equivalencias. Ni
   * «Reemplazar» —que borra el perfil sociodemográfico y todo lo hecho a mano—
   * ni «Fusionar» —que al regenerar deja el bloque por duplicado— sirven cuando
   * el mazo mezcla lo derivado con lo construido a mano.
   */
  function sincronizarPlan() {
    if (!result) return;
    // ADR 0096: en el compartido la propuesta es compuesta (matriz + láminas por fuente); sólo entra el bloque de la
    // matriz, si no las láminas por fuente quedarían marcadas como derivadas y duplicadas.
    const suggested = clonePlanWithFreshIds(result.plan);
    const bloque = suggested.slides.filter(esEquivalente);
    aplicar("sincronizar", sincronizarEquivalentes(currentPlan, bloque).plan);
  }

  const derivadasEnPlan = currentPlan.slides.filter(esEquivalente).length;
  const puedeSincronizar =
    (result?.fuente === "equivalencias" || result?.contiene_equivalencias === true)
    && (result?.plan.slides.some(esEquivalente) ?? false);
  const ayudaSincronizar = derivadasEnPlan > 0
    ? `Reemplaza las ${derivadasEnPlan} diapositivas que salieron de la matriz y deja el resto del mazo intacto.`
    : "Añade las diapositivas de la matriz como un bloque propio, que podrás actualizar sin tocar el resto.";

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
      {/* `aria-disabled` y no `disabled` en el compartido: sigue en el orden de foco y su clic explica el motivo. */}
      <button
        type="button"
        ref={disparadorRef}
        className={`pulso-gv2-pill-button pulso-gv2-suggest-trigger${motivo ? " is-deshabilitado" : ""}`}
        onClick={panel.alternar}
        disabled={busy}
        aria-label={PANEL_ARMAR_DESDE.label}
        aria-haspopup="dialog"
        aria-expanded={open}
        {...(motivo ? { "aria-disabled": true, "aria-describedby": motivoId } : {})}
        title={motivo ?? PANEL_ARMAR_DESDE.label}
      >
        {busy ? <Loader2 size={13} className="pulso-spin" /> : <LayoutTemplate size={14} />}
        <span className="pulso-gv2-suggest-trigger-label">Armar desde…</span>
      </button>
      {motivo && <span id={motivoId} className="pulso-sr-only">{motivo}</span>}

      {open && (
        <div ref={dialogoRef} tabIndex={-1} className="pulso-gv2-suggest-popover" role="dialog" aria-label={PANEL_ARMAR_DESDE.label} {...panel.props}>
          <div className="pulso-gv2-suggest-head">
            <div>
              <strong>Armar desde un plan sugerido</strong>
              <span>{motivo ?? "Elige un plan base y previsualízalo antes de aplicarlo al plan actual."}</span>
            </div>
            <button type="button" onClick={cerrarDevolviendoFoco} aria-label="Cerrar">
              <X size={13} />
            </button>
          </div>

          {!motivo && (<>

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
              <button
                type="button"
                className={profileId === "equivalencias" ? "is-active" : ""}
                aria-pressed={profileId === "equivalencias"}
                onClick={() => {
                  setProfileId("equivalencias");
                  setResult(null);
                }}
                title="Arma el mazo con las diapositivas declaradas en Carga → Equivalencias"
              >
                <GitMerge size={13} /> Equivalencias
              </button>
            </div>

            {profileId === "equivalencias" && (
              // `editor-v2.css` esta congelado a crecimiento, asi que se reusa la
              // clase que ya existe para texto de apoyo en este popover.
              <div className="pulso-gv2-suggest-option-text">
                <small>
                  {result?.declarada === false
                    ? "Este estudio todavía no declara equivalencias. Decláralas en Carga → Equivalencias para poder derivar el mazo."
                    : "Una diapositiva por cada una declarada en la matriz, con su enunciado como título y una barra por público. Las preguntas sin diapositiva asignada no entran."}
                </small>
              </div>
            )}

            {profileId === "equivalencias" && (result?.fuera?.length ?? 0) > 0 && (
              <div className="pulso-gv2-suggest-option-text">
                <small>{textoFueraDelMazo(result?.fuera ?? [])}</small>
              </div>
            )}

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
                  <span>{result.plan.slides.length === 1 ? "lámina propuesta" : "láminas propuestas"}</span>
                </div>
                {/* El mazo de equivalencias no mide cobertura de variables: «0/0 graficables» decía que no había nada. */}
                {profileId !== "equivalencias" && (<>
                <div>
                  <strong>{summary?.included_graphable ?? 0}/{summary?.graphable_variables ?? 0}</strong>
                  <span>graficables cubiertas</span>
                </div>
                <div>
                  <strong>{summary?.covered_by_recod ?? 0}</strong>
                  <span>cubiertas por recodificación</span>
                </div>
                </>)}
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
                    <strong>{index + 1}. {normalizeAcnurVisibleText(tituloPropuesto(slide.payload?.titulo, profileId === "equivalencias"))}</strong>
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

              <div className="pulso-gv2-suggest-actions">
                <button type="button" onClick={replacePlan} className="is-primary">
                  <Check size={12} /> Reemplazar plan actual
                </button>
                <button type="button" onClick={mergePlan}>
                  <GitMerge size={12} /> Fusionar al final
                </button>
                {/* Sólo cuando el estudio declara equivalencias CON plan: sin un
                    bloque derivado que sincronizar, el botón no tendría qué
                    hacer y competiría con los otros dos por atención. */}
                {puedeSincronizar && (
                  <button type="button" onClick={sincronizarPlan} title={ayudaSincronizar}>
                    <RefreshCw size={12} /> Actualizar diapositivas equivalentes
                  </button>
                )}
                <button type="button" onClick={cerrarDevolviendoFoco}>
                  Cancelar
                </button>
              </div>
            </>
          )}
          </>)}
        </div>
      )}
    </div>
  );
}
