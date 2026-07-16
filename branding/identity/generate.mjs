#!/usr/bin/env node
/**
 * generate.mjs — compilador determinista de la identidad de Prosecnur.
 *
 * Lee branding/identity.json (CONGELADO) y genera los derivados declarados en
 * `outputs`:
 *   · tokens.css               (target react — namespace --prosecnur-*)
 *   · identity-reference.html  (target documentation — referencia técnica)
 *   · generation-manifest.json (registro de generación del artifact contract)
 *
 * Determinismo: sin timestamps, sin aleatoriedad, orden de iteración = orden
 * del manifiesto, hex en minúsculas, line endings LF, UTF-8. El identificador
 * de la corrida es el input digest (sha256 del identity.json), no la hora.
 *
 * Uso: node generate.mjs [--manifest /ruta/identity.json] [--out /ruta/salida]
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { validateIdentity } from "./validate-identity.mjs";

const GENERATOR_NAME = "prosecnur-identity-compiler";
const GENERATOR_VERSION = "1.0.0";
const EXT_KEY = "pe.pucp.pulso.prosecnur";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- utilidades

const sha256 = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const hexLower = (v) => v.replace(/#[0-9A-Fa-f]{6}/g, (h) => h.toLowerCase());
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** kebab-case ASCII mecánico: minúsculas, sin diacríticos, espacios y "/" a guion */
function slugAscii(label) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[/\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function fail(msg) {
  throw new Error(`[${GENERATOR_NAME}] parse del manifiesto falló: ${msg}`);
}

function findRule(rules, startsWith) {
  const r = rules.find((x) => x.startsWith(startsWith));
  if (!r) fail(`no se encontró la regla que empieza con "${startsWith}"`);
  return r;
}

// -------------------------------------------------- parsers de reglas (fail-loud)

/** "Radios: control 10 · tarjeta 14 · panel 16 · lens 20 · chip 999" */
function parseRadii(geometryRules) {
  const rule = findRule(geometryRules, "Radios: ");
  return rule
    .slice("Radios: ".length)
    .split(" · ")
    .map((pair) => {
      const m = pair.match(/^(.+) (\d+)$/);
      if (!m) fail(`radio ilegible: "${pair}"`);
      return { label: m[1], slug: slugAscii(m[1]), px: Number(m[2]) };
    });
}

function parseHeights(geometryRules) {
  const rule = findRule(geometryRules, "Alturas de control");
  const def = rule.match(/: (\d+) default/);
  const toolbar = rule.match(/(\d+) reservado a toolbar\/CTA/);
  const checkbox = rule.match(/checkbox (\d+)/);
  if (!def || !toolbar || !checkbox) fail("alturas de control ilegibles");
  return { default: Number(def[1]), toolbar: Number(toolbar[1]), checkbox: Number(checkbox[1]) };
}

function parseWeights(geometryRules) {
  const rule = findRule(geometryRules, "Peso de trabajo de controles");
  const m = rule.match(/: (\d+) en macOS, (\d+) en Windows/);
  if (!m) fail("pesos de control ilegibles");
  return { macos: Number(m[1]), windows: Number(m[2]) };
}

function parseRail(geometryRules) {
  const rule = findRule(geometryRules, "Rail lateral canónico");
  const m = rule.match(/canónico (\d+)px con filas de (\d+)\/(\d+)(?: \((\d+) en densos\))?/);
  if (!m) fail("rail ilegible");
  return { width: Number(m[1]), row: Number(m[2]), rowLg: Number(m[3]), rowDense: m[4] ? Number(m[4]) : null };
}

function parseMinimums(geometryRules) {
  const rule = findRule(geometryRules, "Mínimos operativos: ");
  return rule
    .slice("Mínimos operativos: ".length)
    .split(" · ")
    .map((pair) => {
      const m = pair.match(/^(.+) (\d+)px$/);
      if (!m) fail(`mínimo ilegible: "${pair}"`);
      return { label: m[1], slug: slugAscii(m[1]), px: Number(m[2]) };
    });
}

/** "low (reposo): 0 1px 2px rgba(0,36,87,0.04)" → { name, note, value } */
function parseElevation(elevationRules) {
  const shadows = [];
  const prose = [];
  for (const rule of elevationRules) {
    const m = rule.match(/^([a-z]+) \(([^)]+)\): (.+)$/);
    if (m) shadows.push({ name: m[1], note: m[2], value: m[3] });
    else prose.push(rule);
  }
  if (shadows.length === 0) fail("sin sombras parseables en foundations.elevation.rules");
  return { shadows, prose };
}

/** familia tipográfica: separa el stack de la anotación final "( … )" */
function parseFamily(family) {
  const m = family.match(/^(.*?)( \(([^()]*)\))?$/);
  return { stack: m[1], note: m[3] || "" };
}

// ------------------------------------------------------------- carga y derivación

function deriveModel(manifest) {
  const ext = manifest.extensions[EXT_KEY];
  const geo = manifest.foundations.geometry.rules;
  const colorTokens = manifest.foundations.color.tokens;
  const byRole = (role) => colorTokens.filter((t) => t.role === role);

  return {
    identity: manifest.identity,
    colors: {
      structural: byRole("structural"),
      accent: byRole("accent"),
      semantic: byRole("semantic"),
      data: byRole("data"),
    },
    colorUsageRules: manifest.foundations.color.usage_rules,
    interaction: ext.interaction_alphas,
    moduleSpectrum: ext.module_spectrum,
    families: manifest.foundations.typography.families.map(parseFamily),
    typeScale: manifest.foundations.typography.scale,
    spacing: manifest.foundations.spacing,
    radii: parseRadii(geo),
    heights: parseHeights(geo),
    weights: parseWeights(geo),
    rail: parseRail(geo),
    minimums: parseMinimums(geo),
    geometryRules: geo,
    elevation: parseElevation(manifest.foundations.elevation.rules),
    elevationPrinciple: manifest.foundations.elevation.principle,
    focus: manifest.foundations.focus,
    responsive: manifest.foundations.responsive,
    motion: ext.motion_tokens,
    motionSystem: manifest.systems.motion,
    materials: ext.materials,
    xlsx: ext.xlsx_question_type_colors,
    voice: manifest.systems.voice,
    verbal: ext.verbal_formats_es_pe,
    brand: manifest.systems.brand,
    iconography: manifest.systems.iconography,
    dataviz: manifest.systems.data_visualization,
    navigation: manifest.architecture.navigation,
    navVocabulary: ext.navigation_vocabulary,
    layouts: manifest.architecture.layouts,
    surfaces: manifest.architecture.surfaces,
    recipes: manifest.architecture.component_recipes,
    governance: manifest.governance,
    outputs: manifest.outputs,
  };
}

/** var(--pulso-*) del manifiesto → var(--prosecnur-*) del namespace generado */
const PULSO_TO_PROSECNUR = {
  "--pulso-surface": "--prosecnur-surface-paper",
  "--pulso-primary-border": "--prosecnur-primary-border",
  "--pulso-border": "--prosecnur-border",
};

function remapPulsoVars(value) {
  const out = value.replace(/--pulso-[a-z0-9-]+/g, (v) => {
    if (!PULSO_TO_PROSECNUR[v]) fail(`var ${v} sin mapeo --prosecnur-* declarado`);
    return PULSO_TO_PROSECNUR[v];
  });
  return out;
}

// ---------------------------------------------------------------- tokens.css

function buildTokensCss(model, inputDigest) {
  const { identity } = model;
  const L = [];
  const push = (...xs) => L.push(...xs);
  const section = (title, source) => {
    push("", `  /* --- ${title}`, `   * fuente: ${source}`, "   * ------------------------------------------------------------ */");
  };
  const decl = (name, value, comment) =>
    push(`  --prosecnur-${name}: ${value};${comment ? ` /* ${comment} */` : ""}`);

  push(
    "/* ============================================================",
    " * Prosecnur — tokens.css (GENERADO — no editar a mano)",
    " * ------------------------------------------------------------",
    ` * Generador : ${GENERATOR_NAME} v${GENERATOR_VERSION} (branding/identity/generate.mjs)`,
    " * Fuente    : branding/identity.json",
    ` * Identidad : ${identity.id} v${identity.version} (${identity.status})`,
    ` * Manifest  : ${identity.manifest_hash}`,
    ` * Input     : sha256:${inputDigest} (digest del archivo identity.json)`,
    " * ------------------------------------------------------------",
    " * Derivado determinista del manifiesto congelado. El identificador",
    " * de generación es el input digest (sin timestamp, a propósito).",
    " * Namespace --prosecnur-* para piezas fuera de la app; dentro de la",
    " * app la fuente operativa siguen siendo los --pulso-* de theme.css.",
    " * Compatible con el mirror manual branding/tokens/prosecnur-brand.css:",
    " * los nombres coincidentes tienen valores idénticos.",
    " * ============================================================ */",
    "",
    ":root {"
  );

  section("Color · estructural (tinta, superficies, bordes)", "foundations.color.tokens[role=structural]");
  for (const t of model.colors.structural) decl(t.name, hexLower(t.value));

  section("Color · acentos (marca, espectro modular, acentos de sistema)", "foundations.color.tokens[role=accent]");
  for (const t of model.colors.accent) decl(t.name, hexLower(t.value));

  section("Color · semánticos (triadas bg/border/fg + marcador repeat)", "foundations.color.tokens[role=semantic]");
  for (const t of model.colors.semantic) decl(t.name, hexLower(t.value));
  push("  /* info: navy translúcido — bg rgba(0,36,87,0.04), border = primary-border, fg = primary (regla de uso 5) */");

  section("Color · datos (paleta de visualización de once roles + secuencial)", "foundations.color.tokens[role=data]");
  for (const t of model.colors.data) decl(t.name, hexLower(t.value));

  section("Interacción · alphas del navy e info", "extensions." + EXT_KEY + ".interaction_alphas");
  for (const [k, v] of Object.entries(model.interaction)) {
    if (k === "module_soft_alpha" || k === "module_border_alpha") continue;
    decl(k.replace(/_/g, "-"), v);
  }
  push(
    `  /* Variantes por módulo: soft alpha ${model.interaction.module_soft_alpha}, border alpha ${model.interaction.module_border_alpha}`,
    "   * (rangos definidos operativamente en frontend/src/app/theme.css; no se fijan aquí) */"
  );

  section("Espectro modular · alias por slug de módulo", "extensions." + EXT_KEY + ".module_spectrum");
  for (const [slug, spec] of Object.entries(model.moduleSpectrum)) {
    decl(`mod-${slug}`, hexLower(spec.accent), `${spec.titulo} — operativo: ${spec.css}`);
  }

  section("Tipografía · familias «Voz nativa»", "foundations.typography.families");
  decl("font-sans", model.families[0].stack, model.families[0].note);
  decl("font-mono", model.families[1].stack, model.families[1].note);

  section("Tipografía · escala", "foundations.typography.scale");
  for (const s of model.typeScale) {
    const v = s.value;
    decl(`type-${s.name}-size`, `${v.size_px}px`);
    decl(`type-${s.name}-line`, String(v.line_height));
    decl(`type-${s.name}-weight`, String(v.weight));
    if (v.transform) decl(`type-${s.name}-transform`, v.transform);
    if (v.letter_spacing_em) decl(`type-${s.name}-tracking`, `${v.letter_spacing_em}em`);
  }

  section(`Espaciado · retícula de ${model.spacing.base}`, "foundations.spacing");
  decl("space-base", `${model.spacing.base}px`);
  model.spacing.scale.forEach((v, i) => decl(`space-${i + 1}`, `${v}px`));

  section("Geometría · radios", "foundations.geometry.rules (Radios)");
  for (const r of model.radii) decl(`radius-${r.slug}`, `${r.px}px`);

  section("Geometría · controles y rail", "foundations.geometry.rules (Alturas/Peso/Rail/Mínimos)");
  decl("control-h", `${model.heights.default}px`, "default de content area (slots sm y md coinciden hoy en 28)");
  decl("control-h-toolbar", `${model.heights.toolbar}px`, "reservado a toolbar/CTA");
  decl("control-checkbox", `${model.heights.checkbox}px`);
  decl("control-weight", String(model.weights.macos), `macOS; ${model.weights.windows} en Windows vía data-platform`);
  decl("rail-w", `${model.rail.width}px`);
  decl("rail-row", `${model.rail.row}px`);
  decl("rail-row-lg", `${model.rail.rowLg}px`);
  if (model.rail.rowDense !== null) decl("rail-row-dense", `${model.rail.rowDense}px`);
  for (const m of model.minimums) decl(`min-${m.slug}`, `${m.px}px`, m.label);

  section("Elevación · seis niveles de sombra fría", "foundations.elevation.rules");
  for (const s of model.elevation.shadows) decl(`shadow-${s.name}`, s.value, s.note);
  for (const p of model.elevation.prose) push(`  /* ${p} */`);

  section("Motion · Física Pulso — duraciones", "extensions." + EXT_KEY + ".motion_tokens.durations_ms");
  for (const [k, v] of Object.entries(model.motion.durations_ms)) decl(`dur-${k}`, `${v}ms`);

  section("Motion · Física Pulso — easings", "extensions." + EXT_KEY + ".motion_tokens.easings");
  for (const [k, v] of Object.entries(model.motion.easings)) decl(`ease-${k}`, v);

  section("Motion · offsets de ruta", "extensions." + EXT_KEY + ".motion_tokens.route_offsets_px");
  decl("route-enter-y", `${model.motion.route_offsets_px.enter_y}px`);
  decl("route-forward-x", `${model.motion.route_offsets_px.forward_x}px`);
  decl("route-back-x", `${model.motion.route_offsets_px.back_x}px`);

  section("Motion · firmas", "extensions." + EXT_KEY + ".motion_tokens.signatures");
  const sig = model.motion.signatures;
  decl("sig-pageframe-body", `${sig.pageframe.body_ms}ms`, `easing ${sig.pageframe.easing}`);
  decl("sig-pageframe-header", `${sig.pageframe.header_ms}ms`);
  decl("sig-pageframe-toolbar", `${sig.pageframe.toolbar_ms}ms`);
  decl("sig-brand-stagger", `${sig.brand_stagger.per_bar_ms}ms`, `por pastilla; duración ${sig.brand_stagger.duration} + easing ${sig.brand_stagger.easing}`);
  decl("sig-diagram-nodes", `${sig.orbit_edge_draw.nodes_ms}ms`, `excepción gobernada ${sig.orbit_edge_draw.governed_exception}`);
  decl("sig-diagram-edges", `${sig.orbit_edge_draw.edges_ms}ms`, `alcance: ${sig.orbit_edge_draw.scope}`);
  push(`  /* Tope de la escala de tokens: ${model.motion.durations_ms.slow}ms; máximo gobernado: ${model.motionSystem.max_duration_ms}ms.`,
       "   * Toda animación respeta prefers-reduced-motion (systems.motion.reduced_motion=true). */");

  section("Materiales · vibrancy simulada Windows-safe", "extensions." + EXT_KEY + ".materials");
  decl("material-base", remapPulsoVars(model.materials.base.mix), model.materials.base.uso);
  decl("material-strong", remapPulsoVars(model.materials.strong.mix), model.materials.strong.uso);
  decl("material-chrome", remapPulsoVars(model.materials.chrome.mix), model.materials.chrome.uso);
  model.materials.blur_px.forEach((v, i) => decl(`material-blur-${i + 1}`, `${v}px`));
  decl("material-saturate", String(model.materials.saturate));
  decl("material-border", remapPulsoVars(model.materials.border));
  decl("material-shadow", model.materials.shadow);

  section("Entregables · XLSX, colores canónicos por tipo de pregunta", "extensions." + EXT_KEY + ".xlsx_question_type_colors");
  for (const [tipo, c] of Object.entries(model.xlsx)) {
    decl(`xlsx-${tipo}-bg`, hexLower(c.bg));
    decl(`xlsx-${tipo}-border`, hexLower(c.border));
    decl(`xlsx-${tipo}-fg`, hexLower(c.fg));
  }

  push("}", "");
  push(
    "/* Peso de trabajo de controles en Windows (Segoe UI renderiza Medium más",
    " * liviano que SF Pro) — platforms.windows.adaptations */",
    ':root[data-platform="windows"] {',
    `  --prosecnur-control-weight: ${model.weights.windows};`,
    "}",
    ""
  );
  return L.join("\n");
}

// ------------------------------------------------------- identity-reference.html

function buildReferenceHtml(model, tokensCss, inputDigest) {
  const { identity } = model;
  const swatch = (hex, name, extra = "") => `
      <div class="sw">
        <div class="sw-chip" style="background:${hexLower(hex)}"></div>
        <div class="sw-meta"><code>${esc(name)}</code><span>${hexLower(hex)}</span>${extra ? `<em>${esc(extra)}</em>` : ""}</div>
      </div>`;
  const ruleList = (rules) => `<ul class="rules">${rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>`;
  const colorGrid = (tokens) => `<div class="swgrid">${tokens.map((t) => swatch(t.value, `--prosecnur-${t.name}`)).join("")}</div>`;

  const typeRows = model.typeScale
    .map((s) => {
      const v = s.value;
      const style = `font-size:${v.size_px}px;line-height:${v.line_height};font-weight:${v.weight};${v.transform ? `text-transform:${v.transform};` : ""}${v.letter_spacing_em ? `letter-spacing:${v.letter_spacing_em}em;` : ""}`;
      return `<tr><td><code>${esc(s.name)}</code></td><td>${v.size_px}px / ${v.line_height} / ${v.weight}${v.transform ? " / " + esc(v.transform) : ""}${v.letter_spacing_em ? ` / ${v.letter_spacing_em}em` : ""}</td><td><span style="${style}">La señal ordenada 0123456789</span></td></tr>`;
    })
    .join("\n");

  const spacingBars = model.spacing.scale
    .map((v, i) => `<div class="sp"><code>space-${i + 1}</code><div class="sp-bar" style="width:${v * 4}px"></div><span>${v}px</span></div>`)
    .join("");

  const shadowCards = model.elevation.shadows
    .map((s) => `<div class="elev" style="box-shadow:${esc(s.value)}"><code>shadow-${esc(s.name)}</code><span>${esc(s.note)}</span><em>${esc(s.value)}</em></div>`)
    .join("");

  const durRows = Object.entries(model.motion.durations_ms)
    .map(([k, v]) => `<tr><td><code>--prosecnur-dur-${k}</code></td><td>${v}ms</td></tr>`)
    .join("");
  const easeRows = Object.entries(model.motion.easings)
    .map(([k, v]) => `<tr><td><code>--prosecnur-ease-${k}</code></td><td><code>${esc(v)}</code></td></tr>`)
    .join("");
  const sig = model.motion.signatures;

  const moduleGrid = Object.entries(model.moduleSpectrum)
    .map(([slug, spec]) => swatch(spec.accent, `--prosecnur-mod-${slug}`, `${spec.titulo} · ${spec.css}`))
    .join("");

  const xlsxChips = Object.entries(model.xlsx)
    .map(
      ([tipo, c]) =>
        `<span class="chip" style="background:${hexLower(c.bg)};border:1px solid ${hexLower(c.border)};color:${hexLower(c.fg)}">${esc(tipo)}</span>`
    )
    .join(" ");

  const seq = model.colors.data.filter((t) => t.name.startsWith("seq-step-"));
  const seqRamp = seq.map((t) => `<div class="seq" style="background:${hexLower(t.value)}" title="${esc(t.name)}"></div>`).join("");

  const recipes = model.recipes.rules.map((r) => `<li>${esc(r)}</li>`).join("\n");

  const outputsRows = model.outputs
    .map((o) => `<tr><td><code>${esc(o.id)}</code></td><td>${esc(o.target)}</td><td><code>${esc(o.path)}</code></td><td>${esc(o.ownership)}</td><td>${esc(o.status)}</td></tr>`)
    .join("");

  const radiiRows = model.radii.map((r) => `<tr><td><code>--prosecnur-radius-${r.slug}</code></td><td>${r.px}px</td></tr>`).join("");
  const minRows = model.minimums.map((m) => `<tr><td><code>--prosecnur-min-${m.slug}</code></td><td>${m.px}px</td><td>${esc(m.label)}</td></tr>`).join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prosecnur — referencia técnica de identidad v${esc(identity.version)}</title>
<meta name="generator" content="${GENERATOR_NAME} v${GENERATOR_VERSION}">
<style>
${tokensCss}
/* --- estilos de la página de referencia (consumen los tokens generados) --- */
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--prosecnur-bg-canvas); color: var(--prosecnur-ink);
  font-family: var(--prosecnur-font-sans);
  font-size: var(--prosecnur-type-body-size); line-height: var(--prosecnur-type-body-line);
}
main { max-width: 980px; margin: 0 auto; padding: 40px 24px 64px; }
header.doc {
  background: var(--prosecnur-brand-navy); color: var(--prosecnur-surface-paper);
  padding: 28px 24px; border-radius: var(--prosecnur-radius-panel); margin-bottom: 32px;
}
header.doc h1 { margin: 0 0 6px; font-size: var(--prosecnur-type-title-size); font-weight: var(--prosecnur-type-title-weight); }
header.doc p { margin: 2px 0; opacity: .85; font-size: var(--prosecnur-type-note-size); }
header.doc code { font-family: var(--prosecnur-font-mono); font-size: 12px; word-break: break-all; }
section { background: var(--prosecnur-surface-paper); border: 1px solid var(--prosecnur-border);
  border-radius: var(--prosecnur-radius-tarjeta); padding: 20px 24px; margin-bottom: 20px;
  box-shadow: var(--prosecnur-shadow-low); }
h2 { font-size: var(--prosecnur-type-section-size); font-weight: var(--prosecnur-type-section-weight);
  margin: 0 0 4px; color: var(--prosecnur-brand-navy); }
h3 { font-size: var(--prosecnur-type-note-size); text-transform: uppercase; letter-spacing: .06em;
  color: var(--prosecnur-ink-soft); margin: 18px 0 8px; }
p.src { margin: 0 0 14px; font-size: var(--prosecnur-type-caption-size); color: var(--prosecnur-ink-faint); }
p.src code { font-family: var(--prosecnur-font-mono); }
.swgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
.sw { display: flex; gap: 10px; align-items: center; border: 1px solid var(--prosecnur-border);
  border-radius: var(--prosecnur-radius-control); padding: 8px; background: var(--prosecnur-surface-ice); }
.sw-chip { width: 40px; height: 40px; border-radius: var(--prosecnur-radius-control);
  border: 1px solid var(--prosecnur-border-strong); flex: none; }
.sw-meta { min-width: 0; display: flex; flex-direction: column; }
.sw-meta code { font-family: var(--prosecnur-font-mono); font-size: 11px; overflow-wrap: anywhere; }
.sw-meta span { font-size: 11px; color: var(--prosecnur-ink-soft); font-family: var(--prosecnur-font-mono); }
.sw-meta em { font-size: 10.5px; color: var(--prosecnur-ink-faint); font-style: normal; }
ul.rules { margin: 8px 0; padding-left: 20px; }
ul.rules li { margin: 6px 0; font-size: var(--prosecnur-type-note-size); }
table { border-collapse: collapse; width: 100%; font-size: var(--prosecnur-type-note-size); }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--prosecnur-border); vertical-align: top; }
th { background: var(--prosecnur-header-row); font-size: var(--prosecnur-type-caption-size);
  text-transform: uppercase; letter-spacing: .05em; color: var(--prosecnur-ink-soft); }
td code, li code { font-family: var(--prosecnur-font-mono); font-size: 12px; }
.sp { display: flex; align-items: center; gap: 10px; margin: 4px 0; font-size: 12px; }
.sp code { width: 80px; font-family: var(--prosecnur-font-mono); }
.sp-bar { height: 12px; background: var(--prosecnur-signal-blue); border-radius: 3px; }
.sp span { color: var(--prosecnur-ink-soft); }
.elevgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; }
.elev { background: var(--prosecnur-surface-paper); border-radius: var(--prosecnur-radius-tarjeta);
  padding: 14px; display: flex; flex-direction: column; gap: 3px; }
.elev code { font-family: var(--prosecnur-font-mono); font-size: 12px; font-weight: 600; }
.elev span { font-size: 11.5px; color: var(--prosecnur-ink-soft); }
.elev em { font-size: 10.5px; color: var(--prosecnur-ink-faint); font-style: normal; font-family: var(--prosecnur-font-mono); }
.chip { display: inline-block; border-radius: var(--prosecnur-radius-chip); padding: 3px 12px;
  font-size: 12px; font-weight: 600; margin: 2px; }
.seqrow { display: flex; gap: 0; border-radius: var(--prosecnur-radius-control); overflow: hidden;
  border: 1px solid var(--prosecnur-border-strong); width: fit-content; }
.seq { width: 90px; height: 34px; }
.note { font-size: var(--prosecnur-type-caption-size); color: var(--prosecnur-ink-faint); }
footer { text-align: center; font-size: 11.5px; color: var(--prosecnur-ink-faint); padding-top: 8px; }
footer code { font-family: var(--prosecnur-font-mono); word-break: break-all; }
</style>
</head>
<body>
<main>
  <header class="doc">
    <h1>${esc(identity.name)}</h1>
    <p>Referencia técnica generada del manifiesto — ${esc(identity.id)} · v${esc(identity.version)} · status ${esc(identity.status)}</p>
    <p><code>manifest_hash: ${esc(identity.manifest_hash)}</code></p>
    <p><code>input sha256: ${inputDigest}</code> · ${GENERATOR_NAME} v${GENERATOR_VERSION}</p>
    <p class="note" style="opacity:.7">Documento GENERADO (no editar): el mirror rico es branding/manual-identidad.html; la norma es branding/identity.json + branding/direccion-creativa.md. La marca se reproduce solo desde branding/logo/.</p>
  </header>

  <section>
    <h2>Marca</h2>
    <p class="src">fuente: <code>systems.brand</code> — ${esc(model.brand.principle)}</p>
    ${ruleList(model.brand.rules)}
  </section>

  <section>
    <h2>Color</h2>
    <p class="src">fuente: <code>foundations.color.tokens</code> (58 tokens) + <code>usage_rules</code></p>
    <h3>Estructural</h3>${colorGrid(model.colors.structural)}
    <h3>Acentos</h3>${colorGrid(model.colors.accent)}
    <h3>Semánticos</h3>${colorGrid(model.colors.semantic)}
    <h3>Datos (visualización)</h3>${colorGrid(model.colors.data)}
    <h3>Secuencial (intensidad del navy)</h3>
    <div class="seqrow">${seqRamp}</div>
    <h3>Reglas de uso</h3>
    ${ruleList(model.colorUsageRules)}
  </section>

  <section>
    <h2>Interacción</h2>
    <p class="src">fuente: <code>extensions.${EXT_KEY}.interaction_alphas</code> + <code>foundations.focus</code></p>
    <table><thead><tr><th>token</th><th>valor</th></tr></thead><tbody>
    ${Object.entries(model.interaction)
      .filter(([k]) => k !== "module_soft_alpha" && k !== "module_border_alpha")
      .map(([k, v]) => `<tr><td><code>--prosecnur-${k.replace(/_/g, "-")}</code></td><td><code>${esc(v)}</code></td></tr>`)
      .join("")}
    <tr><td class="note">alphas por módulo</td><td class="note">soft ${esc(model.interaction.module_soft_alpha)} · border ${esc(model.interaction.module_border_alpha)} (operativos en theme.css)</td></tr>
    </tbody></table>
    <h3>Foco</h3>
    ${ruleList(model.focus.rules)}
  </section>

  <section>
    <h2>Espectro modular</h2>
    <p class="src">fuente: <code>extensions.${EXT_KEY}.module_spectrum</code> — el acento tiñe el chrome del módulo, nunca el contenido</p>
    <div class="swgrid">${moduleGrid}</div>
  </section>

  <section>
    <h2>Tipografía «Voz nativa»</h2>
    <p class="src">fuente: <code>foundations.typography</code></p>
    <table><thead><tr><th>familia</th><th>stack</th></tr></thead><tbody>
      <tr><td><code>--prosecnur-font-sans</code></td><td><code>${esc(model.families[0].stack)}</code> <span class="note">${esc(model.families[0].note)}</span></td></tr>
      <tr><td><code>--prosecnur-font-mono</code></td><td><code>${esc(model.families[1].stack)}</code> <span class="note">${esc(model.families[1].note)}</span></td></tr>
    </tbody></table>
    <h3>Escala</h3>
    <table><thead><tr><th>paso</th><th>size / line / weight</th><th>muestra</th></tr></thead><tbody>
${typeRows}
    </tbody></table>
  </section>

  <section>
    <h2>Espaciado</h2>
    <p class="src">fuente: <code>foundations.spacing</code> — retícula de ${model.spacing.base}, ópticamente verificada</p>
    ${spacingBars}
  </section>

  <section>
    <h2>Geometría</h2>
    <p class="src">fuente: <code>foundations.geometry</code> — radios y alturas como slots semánticos, no valores ad hoc</p>
    <h3>Radios</h3>
    <table><thead><tr><th>token</th><th>valor</th></tr></thead><tbody>${radiiRows}</tbody></table>
    <h3>Controles y rail</h3>
    <table><thead><tr><th>token</th><th>valor</th></tr></thead><tbody>
      <tr><td><code>--prosecnur-control-h</code></td><td>${model.heights.default}px (default de content area)</td></tr>
      <tr><td><code>--prosecnur-control-h-toolbar</code></td><td>${model.heights.toolbar}px (toolbar/CTA)</td></tr>
      <tr><td><code>--prosecnur-control-checkbox</code></td><td>${model.heights.checkbox}px</td></tr>
      <tr><td><code>--prosecnur-control-weight</code></td><td>${model.weights.macos} macOS · ${model.weights.windows} Windows (data-platform)</td></tr>
      <tr><td><code>--prosecnur-rail-w</code></td><td>${model.rail.width}px</td></tr>
      <tr><td><code>--prosecnur-rail-row</code> / <code>-lg</code>${model.rail.rowDense !== null ? " / <code>-dense</code>" : ""}</td><td>${model.rail.row}px / ${model.rail.rowLg}px${model.rail.rowDense !== null ? ` / ${model.rail.rowDense}px` : ""}</td></tr>
    </tbody></table>
    <h3>Mínimos operativos</h3>
    <table><thead><tr><th>token</th><th>valor</th><th>alcance</th></tr></thead><tbody>${minRows}</tbody></table>
    <h3>Reglas completas</h3>
    ${ruleList(model.geometryRules)}
  </section>

  <section>
    <h2>Elevación</h2>
    <p class="src">fuente: <code>foundations.elevation</code> — ${esc(model.elevationPrinciple)}</p>
    <div class="elevgrid">${shadowCards}</div>
    ${model.elevation.prose.length ? `<h3>Notas</h3>${ruleList(model.elevation.prose)}` : ""}
  </section>

  <section>
    <h2>Motion — Física Pulso</h2>
    <p class="src">fuente: <code>extensions.${EXT_KEY}.motion_tokens</code> + <code>systems.motion</code></p>
    <h3>Duraciones</h3>
    <table><thead><tr><th>token</th><th>valor</th></tr></thead><tbody>${durRows}</tbody></table>
    <h3>Easings</h3>
    <table><thead><tr><th>token</th><th>curva</th></tr></thead><tbody>${easeRows}</tbody></table>
    <h3>Offsets de ruta</h3>
    <p>enter y+${model.motion.route_offsets_px.enter_y}px · forward x+${model.motion.route_offsets_px.forward_x}px · back x${model.motion.route_offsets_px.back_x}px</p>
    <h3>Firmas</h3>
    <table><thead><tr><th>firma</th><th>spec</th></tr></thead><tbody>
      <tr><td>PageFrame (toda ruta)</td><td>cuerpo ${sig.pageframe.body_ms}ms · header ${sig.pageframe.header_ms}ms · toolbar ${sig.pageframe.toolbar_ms}ms · easing ${esc(sig.pageframe.easing)}</td></tr>
      <tr><td>Marca (BootBrandMark)</td><td>stagger de pastillas ${sig.brand_stagger.per_bar_ms}ms · duración ${esc(sig.brand_stagger.duration)} · easing ${esc(sig.brand_stagger.easing)}</td></tr>
      <tr><td>Diagramas y árboles</td><td>orbit-in ${sig.orbit_edge_draw.nodes_ms}ms + edge-draw ${sig.orbit_edge_draw.edges_ms}ms — excepción gobernada <code>${esc(sig.orbit_edge_draw.governed_exception)}</code></td></tr>
    </tbody></table>
    <p class="note">Tope de la escala de tokens: ${model.motion.durations_ms.slow}ms · máximo gobernado: ${model.motionSystem.max_duration_ms}ms · prefers-reduced-motion obligatorio.</p>
    ${ruleList(model.motionSystem.rules)}
  </section>

  <section>
    <h2>Materiales</h2>
    <p class="src">fuente: <code>extensions.${EXT_KEY}.materials</code> + <code>architecture.surfaces</code> — ${esc(model.surfaces.principle)}</p>
    <table><thead><tr><th>token</th><th>receta</th><th>uso</th></tr></thead><tbody>
      <tr><td><code>--prosecnur-material-base</code></td><td><code>${esc(remapPulsoVars(model.materials.base.mix))}</code></td><td>${esc(model.materials.base.uso)}</td></tr>
      <tr><td><code>--prosecnur-material-strong</code></td><td><code>${esc(remapPulsoVars(model.materials.strong.mix))}</code></td><td>${esc(model.materials.strong.uso)}</td></tr>
      <tr><td><code>--prosecnur-material-chrome</code></td><td><code>${esc(remapPulsoVars(model.materials.chrome.mix))}</code></td><td>${esc(model.materials.chrome.uso)}</td></tr>
      <tr><td><code>--prosecnur-material-blur-1/2/3</code></td><td>${model.materials.blur_px.join("px / ")}px · saturate(${model.materials.saturate})</td><td>blur progresivo según jerarquía</td></tr>
      <tr><td><code>--prosecnur-material-border</code></td><td><code>${esc(remapPulsoVars(model.materials.border))}</code></td><td>teñido con el acento del módulo en command bars</td></tr>
      <tr><td><code>--prosecnur-material-shadow</code></td><td><code>${esc(model.materials.shadow)}</code></td><td>sombra de material</td></tr>
    </tbody></table>
    ${ruleList(model.surfaces.rules)}
  </section>

  <section>
    <h2>Visualización de datos</h2>
    <p class="src">fuente: <code>systems.data_visualization</code> — ${esc(model.dataviz.principle)}</p>
    ${ruleList(model.dataviz.rules)}
  </section>

  <section>
    <h2>Iconografía</h2>
    <p class="src">fuente: <code>systems.iconography</code> — ${esc(model.iconography.principle)}</p>
    ${ruleList(model.iconography.rules)}
  </section>

  <section>
    <h2>Patrones maestros</h2>
    <p class="src">fuente: <code>architecture.component_recipes</code> — ${esc(model.recipes.principle)}</p>
    <ul class="rules">
${recipes}
    </ul>
  </section>

  <section>
    <h2>Navegación y layouts</h2>
    <p class="src">fuente: <code>architecture.navigation</code> + <code>architecture.layouts</code> + <code>foundations.responsive</code></p>
    <table><thead><tr><th>nivel</th><th>definición</th></tr></thead><tbody>
      ${Object.entries(model.navVocabulary).map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v)}</td></tr>`).join("")}
    </tbody></table>
    ${ruleList(model.navigation.rules)}
    <h3>Economía del chrome</h3>
    ${ruleList(model.layouts.rules)}
    <h3>Responsive</h3>
    ${ruleList(model.responsive.rules)}
  </section>

  <section>
    <h2>Voz</h2>
    <p class="src">fuente: <code>systems.voice</code> + <code>extensions.${EXT_KEY}.verbal_formats_es_pe</code> — ${esc(model.voice.principle)}</p>
    ${ruleList(model.voice.rules)}
    <p class="note">Formatos es-PE: miles con ${esc(model.verbal.miles)} · decimales con ${esc(model.verbal.decimales)} · horas ${esc(model.verbal.horas)} · columnas ${esc(model.verbal.numeros_en_columnas)} · trato: ${esc(model.verbal.tratamiento)}.</p>
  </section>

  <section>
    <h2>Entregables — XLSX por tipo de pregunta</h2>
    <p class="src">fuente: <code>extensions.${EXT_KEY}.xlsx_question_type_colors</code></p>
    <p>${xlsxChips}</p>
  </section>

  <section>
    <h2>Gobernanza</h2>
    <p class="src">fuente: <code>governance</code></p>
    <h3>Excepciones vigentes</h3>
    <table><thead><tr><th>id</th><th>vence</th><th>motivo</th></tr></thead><tbody>
      ${model.governance.exceptions.map((e) => `<tr><td><code>${esc(e.id)}</code></td><td>${esc(e.expires)}</td><td>${esc(e.reason)}</td></tr>`).join("")}
    </tbody></table>
    <h3>Condiciones de revisión</h3>
    ${ruleList(model.governance.review_conditions)}
    <h3>Outputs declarados</h3>
    <table><thead><tr><th>id</th><th>target</th><th>path</th><th>ownership</th><th>status</th></tr></thead><tbody>${outputsRows}</tbody></table>
  </section>

  <footer>
    Derivado determinista de <code>branding/identity.json</code> · ${esc(identity.id)} v${esc(identity.version)} ·
    <code>${esc(identity.manifest_hash)}</code> · ${GENERATOR_NAME} v${GENERATOR_VERSION}
  </footer>
</main>
</body>
</html>
`;
}

// ------------------------------------------------- validaciones de los artefactos

function validateArtifacts(manifestRaw, tokensCss, html) {
  const results = [];
  const ok = (id, detail) => results.push({ id, status: "passed", detail });
  const bad = (id, detail) => {
    results.push({ id, status: "failed", detail });
    throw new Error(`validación de artefactos falló — ${id}: ${detail}`);
  };

  // CSS: llaves balanceadas
  const open = (tokensCss.match(/{/g) || []).length;
  const close = (tokensCss.match(/}/g) || []).length;
  open === close ? ok("css-braces", `${open} bloques balanceados`) : bad("css-braces", `${open} vs ${close}`);

  // CSS: nombres de custom property únicos dentro de :root
  const names = [...tokensCss.matchAll(/^\s{2}(--prosecnur-[a-z0-9-]+):/gm)].map((m) => m[1]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i && n !== "--prosecnur-control-weight");
  dup.length === 0
    ? ok("css-unique-names", `${new Set(names).size} tokens únicos (control-weight con override de plataforma)`)
    : bad("css-unique-names", `duplicados: ${[...new Set(dup)].join(", ")}`);

  // CSS+HTML: toda referencia var(--prosecnur-*) resuelve a un token definido
  const defined = new Set(names);
  for (const [artifact, text] of [["tokens.css", tokensCss], ["identity-reference.html", html]]) {
    const refs = [...text.matchAll(/var\((--prosecnur-[a-z0-9-]+)/g)].map((m) => m[1]);
    const missing = [...new Set(refs.filter((r) => !defined.has(r)))];
    missing.length === 0
      ? ok(`vars-resolve-${artifact}`, `${new Set(refs).size} referencias var() resueltas`)
      : bad(`vars-resolve-${artifact}`, `sin definir: ${missing.join(", ")}`);
  }

  // Sin valores de color no declarados: todo literal hex/rgba de los outputs
  // debe existir en el manifiesto fuente (case-insensitive para hex)
  const manifestLower = manifestRaw.toLowerCase();
  for (const [artifact, text] of [["tokens.css", tokensCss], ["identity-reference.html", html]]) {
    const hexes = [...new Set([...text.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()))];
    const rgbas = [...new Set([...text.matchAll(/rgba?\([^)]*\)/g)].map((m) => m[0]))];
    const badHex = hexes.filter((h) => !manifestLower.includes(h));
    const badRgba = rgbas.filter((r) => !manifestRaw.includes(r));
    badHex.length === 0 && badRgba.length === 0
      ? ok(`no-undeclared-colors-${artifact}`, `${hexes.length} hex + ${rgbas.length} rgba, todos trazables al manifiesto`)
      : bad(`no-undeclared-colors-${artifact}`, `hex: ${badHex.join(",") || "—"} rgba: ${badRgba.join(",") || "—"}`);
  }

  // HTML: versión y manifest_hash presentes (contrato de documentation)
  const m = JSON.parse(manifestRaw);
  html.includes(m.identity.version) && html.includes(m.identity.manifest_hash)
    ? ok("html-provenance", "identity.version y manifest_hash embebidos")
    : bad("html-provenance", "falta versión o manifest_hash en el HTML");

  // HTML: sin referencias externas (autocontenido)
  const external = [...html.matchAll(/\b(?:src|href)="(?!#)[^"]+"/g)].map((m) => m[0]);
  external.length === 0
    ? ok("html-self-contained", "sin src/href externos")
    : bad("html-self-contained", external.join(", "));

  return results;
}

// ------------------------------------------------------------ generation manifest

function buildGenerationManifest(manifest, manifestRaw, inputDigest, artifacts, validations) {
  const record = {
    record: "generation-manifest",
    contract: "app-identity-os/compile-app-identity/artifact-contract",
    contract_version: "1.0.0",
    generator: {
      name: GENERATOR_NAME,
      version: GENERATOR_VERSION,
      path: "branding/identity/generate.mjs",
      sha256: sha256(fs.readFileSync(path.join(HERE, "generate.mjs"), "utf8")),
    },
    tools: [
      {
        name: "validate-identity",
        role: "validador estructural pre-compilación",
        path: "branding/identity/validate-identity.mjs",
        sha256: sha256(fs.readFileSync(path.join(HERE, "validate-identity.mjs"), "utf8")),
      },
    ],
    input: {
      path: "branding/identity.json",
      schema_version: manifest.schema_version,
      identity_id: manifest.identity.id,
      identity_version: manifest.identity.version,
      identity_status: manifest.identity.status,
      manifest_hash: manifest.identity.manifest_hash,
      file_sha256: inputDigest,
      manifest_hash_method:
        "sha256 del archivo con todos los campos manifest_hash en placeholder de 64 ceros (extensions." + EXT_KEY + ".manifest_hash_method)",
    },
    determinism: {
      policy:
        "sin timestamps ni aleatoriedad; orden de iteración = orden del manifiesto; hex minúsculas; LF; UTF-8. El input digest identifica la corrida.",
      volatile_fields: ["environment.node (registrado, no afecta los bytes de los artefactos)"],
      reproducibility_check: "dos corridas limpias con byte-igualdad exigida (ver reporte del carril COMPILE)",
    },
    environment: {
      node: process.version,
    },
    transformations: [
      "foundations.color.tokens[name,value] → --prosecnur-<name> con hex en minúsculas, agrupado por role",
      "extensions.interaction_alphas → --prosecnur-<clave con _ → ->; rangos por módulo solo como comentario",
      "extensions.module_spectrum[slug].accent → --prosecnur-mod-<slug>",
      "foundations.typography.families → stack sin anotación parentética final (anotación como comentario)",
      "foundations.typography.scale → --prosecnur-type-<name>-{size,line,weight[,transform,tracking]}",
      "foundations.spacing → --prosecnur-space-base + --prosecnur-space-<indice 1..n>",
      "foundations.geometry.rules (Radios/Alturas/Peso/Rail/Mínimos): parse anclado fail-loud → tokens con slug ASCII mecánico de la etiqueta española",
      "foundations.elevation.rules 'name (nota): value' → --prosecnur-shadow-<name>; reglas prosa como comentario",
      "extensions.motion_tokens → --prosecnur-dur-*/--prosecnur-ease-*/--prosecnur-route-*/--prosecnur-sig-*",
      "extensions.materials: var(--pulso-surface)→var(--prosecnur-surface-paper), var(--pulso-primary-border)→var(--prosecnur-primary-border), var(--pulso-border)→var(--prosecnur-border)",
      "extensions.xlsx_question_type_colors → --prosecnur-xlsx-<tipo>-{bg,border,fg}",
      "platforms.windows / regla de peso → bloque :root[data-platform=\"windows\"]",
    ],
    artifacts,
    validations,
    result: "success",
    notes: [
      "Los outputs NO son canónicos: branding/identity.json manda; ante drift se regenera con node branding/identity/generate.mjs",
      "Este registro (generation-manifest.json) es el provenance record del artifact contract; no puede contener su propio digest",
      "Mirrors manuales no tocados por este compilador: branding/manual-identidad.html, branding/tokens/prosecnur-brand.css",
    ],
  };
  return JSON.stringify(record, null, 2) + "\n";
}

// --------------------------------------------------------------------- main

function parseArgs(argv) {
  const args = { manifest: path.resolve(HERE, "..", "identity.json"), out: HERE };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--manifest") args.manifest = path.resolve(argv[++i]);
    else if (argv[i] === "--out") args.out = path.resolve(argv[++i]);
    else fail(`argumento desconocido: ${argv[i]}`);
  }
  return args;
}

const { manifest: manifestPath, out: outDir } = parseArgs(process.argv);

// 1. Validación estructural obligatoria antes de compilar
const v = validateIdentity(manifestPath);
if (!v.valid) {
  console.error("INVALID — se rehúsa la compilación:");
  for (const e of v.errors) console.error("  ✗ " + e);
  process.exit(1);
}
if (v.manifest.identity.status !== "frozen") {
  console.error(`se rehúsa: identity.status=${v.manifest.identity.status}, se requiere frozen para output release-grade`);
  process.exit(1);
}

const manifest = v.manifest;
const manifestRaw = v.raw;
const inputDigest = sha256(manifestRaw);

// 2. Derivación y generación
const model = deriveModel(manifest);
const tokensCss = buildTokensCss(model, inputDigest);
const html = buildReferenceHtml(model, tokensCss, inputDigest);

// 3. Validación de artefactos (falla en seco ante cualquier problema)
const validations = validateArtifacts(manifestRaw, tokensCss, html);

// 4. Registro de generación (artifact contract)
const artifacts = [
  {
    id: "identity-tokens-css",
    target_id: "identity-tokens-css",
    path: "branding/identity/tokens.css",
    format: "text/css",
    ownership: "generated",
    source_fields: [
      "foundations.color", "foundations.typography", "foundations.spacing", "foundations.geometry",
      "foundations.elevation", `extensions.${EXT_KEY}.interaction_alphas`, `extensions.${EXT_KEY}.module_spectrum`,
      `extensions.${EXT_KEY}.motion_tokens`, `extensions.${EXT_KEY}.materials`,
      `extensions.${EXT_KEY}.xlsx_question_type_colors`, "systems.motion", "platforms.windows",
    ],
    sha256: sha256(tokensCss),
    bytes: Buffer.byteLength(tokensCss, "utf8"),
  },
  {
    id: "identity-reference-doc",
    target_id: "identity-reference-doc",
    path: "branding/identity/identity-reference.html",
    format: "text/html",
    ownership: "generated",
    source_fields: [
      "identity", "foundations", "systems", "architecture", "governance", "outputs", `extensions.${EXT_KEY}`,
    ],
    sha256: sha256(html),
    bytes: Buffer.byteLength(html, "utf8"),
  },
];
const genManifest = buildGenerationManifest(manifest, manifestRaw, inputDigest, artifacts, validations);

// 5. Escritura
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "tokens.css"), tokensCss, "utf8");
fs.writeFileSync(path.join(outDir, "identity-reference.html"), html, "utf8");
fs.writeFileSync(path.join(outDir, "generation-manifest.json"), genManifest, "utf8");

console.log(`${GENERATOR_NAME} v${GENERATOR_VERSION} — OK`);
console.log(`  input : ${manifestPath}`);
console.log(`  input sha256: ${inputDigest}`);
console.log(`  manifest_hash: ${manifest.identity.manifest_hash}`);
for (const a of artifacts) console.log(`  ${a.path.split("/").pop().padEnd(28)} sha256:${a.sha256} (${a.bytes} bytes)`);
console.log(`  generation-manifest.json     sha256:${sha256(genManifest)} (${Buffer.byteLength(genManifest, "utf8")} bytes)`);
console.log(`  validaciones: ${validations.length} passed`);
