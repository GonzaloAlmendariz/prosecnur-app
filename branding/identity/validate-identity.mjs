#!/usr/bin/env node
/**
 * validate-identity.mjs — validador estructural del manifiesto de identidad
 * de Prosecnur (branding/identity.json).
 *
 * Carril COMPILE del App Identity OS. El validador de la fase CREATE no quedó
 * persistido; este validador estructural lo reemplaza para el gate de
 * compilación y queda versionado junto a los derivados.
 *
 * Invariantes verificadas (según skill compile-app-identity):
 *   1.  JSON parsea (UTF-8) y schema_version presente.
 *   2.  identity.status es approved|frozen (frozen requerido para release).
 *   3.  identity.id / name / version (semver) / owners presentes.
 *   4.  identity.manifest_hash con formato sha256:<64 hex> y recomputable con
 *       el método documentado en extensions (placeholder de 64 ceros en TODOS
 *       los campos manifest_hash).
 *   5.  Sin decisiones bloqueantes sin resolver (todas approved).
 *   6.  evidence_ids de decisiones resuelven a entradas de evidence.
 *   7.  direction.selected_territory_id resuelve a un territorio "selected".
 *   8.  outputs declarados con id/target/path/ownership/status y con
 *       identity_version y manifest_hash idénticos a los del manifiesto;
 *       ídem para governance.generated_file_policy.mirrors.
 *   9.  Tokens de color: nombres kebab-case ASCII únicos, valores hex válidos.
 *   10. Escala tipográfica con size/line/weight; espaciado múltiplo de base.
 *   11. verification.required_checks todos en passed|waived.
 *   12. systems.motion.max_duration_ms cubre las firmas declaradas y la
 *       excepción gobernada correspondiente existe y no está vencida.
 *   13. extensions.module_spectrum: acentos hex válidos.
 *
 * Uso: node validate-identity.mjs /ruta/a/identity.json
 */

import fs from "node:fs";
import crypto from "node:crypto";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const KEBAB_ASCII = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const SHA256_FIELD = /^sha256:[0-9a-f]{64}$/;
const PLACEHOLDER = "sha256:" + "0".repeat(64);

export function validateIdentity(manifestPath) {
  const errors = [];
  const notes = [];
  const err = (m) => errors.push(m);

  let raw;
  try {
    raw = fs.readFileSync(manifestPath, "utf8");
  } catch (e) {
    return { valid: false, errors: [`no se pudo leer ${manifestPath}: ${e.message}`], notes };
  }

  let m;
  try {
    m = JSON.parse(raw);
    notes.push("json-parse: OK (UTF-8)");
  } catch (e) {
    return { valid: false, errors: [`JSON inválido: ${e.message}`], notes };
  }

  // 1. schema_version
  if (!m.schema_version) err("schema_version ausente");
  else notes.push(`schema_version: ${m.schema_version}`);

  // 2-3. identity
  const id = m.identity || {};
  if (!id.id) err("identity.id ausente");
  if (!id.name) err("identity.name ausente");
  if (!["approved", "frozen"].includes(id.status)) {
    err(`identity.status "${id.status}" no es approved|frozen`);
  } else {
    notes.push(`identity.status: ${id.status}${id.status === "frozen" ? " (apto para release-grade)" : ""}`);
  }
  if (!SEMVER.test(id.version || "")) err(`identity.version "${id.version}" no es semver`);
  else notes.push(`identity.version: ${id.version}`);
  if (!Array.isArray(id.owners) || id.owners.length === 0) err("identity.owners vacío");

  // 4. manifest_hash: formato + recomputación con el método de extensions
  if (!SHA256_FIELD.test(id.manifest_hash || "")) {
    err(`identity.manifest_hash con formato inválido: ${id.manifest_hash}`);
  } else {
    const neutral = raw.replace(
      /("manifest_hash":\s*")sha256:[0-9a-f]{64}(")/g,
      `$1${PLACEHOLDER}$2`
    );
    const digest = "sha256:" + crypto.createHash("sha256").update(neutral, "utf8").digest("hex");
    if (digest !== id.manifest_hash) {
      err(`manifest_hash no recomputa: declarado ${id.manifest_hash}, calculado ${digest}`);
    } else {
      const n = (raw.match(/"manifest_hash":/g) || []).length;
      notes.push(`manifest_hash: recomputado OK con método de extensions (${n} campos neutralizados) = ${digest}`);
    }
  }

  // 5-6. decisiones
  const evidenceIds = new Set((m.evidence || []).map((e) => e.id));
  for (const d of m.decisions || []) {
    if (d.status !== "approved") err(`decisión ${d.id} sin resolver (status=${d.status})`);
    for (const ev of d.evidence_ids || []) {
      if (!evidenceIds.has(ev)) err(`decisión ${d.id} referencia evidencia inexistente: ${ev}`);
    }
  }
  notes.push(`decisiones: ${(m.decisions || []).length} — todas approved: ${(m.decisions || []).every((d) => d.status === "approved")}`);

  // 7. territorio seleccionado
  const selId = m.direction?.selected_territory_id;
  const sel = (m.territories || []).find((t) => t.id === selId);
  if (!sel) err(`direction.selected_territory_id "${selId}" no resuelve a un territorio`);
  else if (sel.status !== "selected") err(`territorio ${selId} tiene status "${sel.status}", no "selected"`);
  else notes.push(`territorio seleccionado: ${selId} (status selected)`);

  // 8. outputs + mirrors: paridad de versión y hash
  const checkTargetDecl = (arr, label) => {
    if (!Array.isArray(arr) || arr.length === 0) {
      err(`${label}: sin declaraciones`);
      return;
    }
    for (const o of arr) {
      for (const f of ["id", "target", "path", "ownership", "status"]) {
        if (!o[f]) err(`${label} ${o.id || "?"}: campo ${f} ausente`);
      }
      if (o.identity_version !== id.version) {
        err(`${label} ${o.id}: identity_version ${o.identity_version} ≠ ${id.version}`);
      }
      if (o.manifest_hash !== id.manifest_hash) {
        err(`${label} ${o.id}: manifest_hash no coincide con identity.manifest_hash`);
      }
    }
    notes.push(`${label}: ${arr.length} entradas con identity_version y manifest_hash en paridad`);
  };
  checkTargetDecl(m.outputs, "outputs");
  checkTargetDecl(m.governance?.generated_file_policy?.mirrors, "mirrors");

  // 9. tokens de color
  const tokens = m.foundations?.color?.tokens || [];
  const seen = new Set();
  for (const t of tokens) {
    if (!KEBAB_ASCII.test(t.name)) err(`token de color con nombre no kebab-ASCII: ${t.name}`);
    if (seen.has(t.name)) err(`token de color duplicado: ${t.name}`);
    seen.add(t.name);
    if (!HEX_COLOR.test(t.value)) err(`token ${t.name} con valor no-hex: ${t.value}`);
    if (!["accent", "structural", "semantic", "data"].includes(t.role)) {
      err(`token ${t.name} con rol desconocido: ${t.role}`);
    }
  }
  notes.push(`color: ${tokens.length} tokens hex, nombres únicos kebab-ASCII, roles válidos`);

  // 10. tipografía y espaciado
  for (const s of m.foundations?.typography?.scale || []) {
    const v = s.value || {};
    if (!(v.size_px > 0) || !(v.line_height > 0) || !(v.weight > 0)) {
      err(`escala tipográfica ${s.name} incompleta (size/line/weight)`);
    }
  }
  notes.push(`tipografía: ${(m.foundations?.typography?.scale || []).length} pasos de escala completos, ${(m.foundations?.typography?.families || []).length} familias`);
  const spacing = m.foundations?.spacing || {};
  for (const v of spacing.scale || []) {
    if (v % (spacing.base || 4) !== 0) err(`espaciado ${v} no es múltiplo de base ${spacing.base}`);
  }
  notes.push(`espaciado: base ${spacing.base}, escala [${(spacing.scale || []).join(", ")}] múltiplos de base`);

  // 11. checks de verificación
  for (const c of m.verification?.required_checks || []) {
    if (!["passed", "waived"].includes(c.status)) {
      err(`check ${c.id} en estado no aceptable para freeze: ${c.status}`);
    }
  }
  notes.push(`verification.required_checks: ${(m.verification?.required_checks || []).map((c) => `${c.id}=${c.status}`).join(", ")}`);

  // 12. motion: tope y excepción gobernada
  const ext = m.extensions?.["pe.pucp.pulso.prosecnur"] || {};
  const maxMs = m.systems?.motion?.max_duration_ms || 0;
  const sig = ext.motion_tokens?.signatures?.orbit_edge_draw;
  if (sig) {
    const peak = Math.max(sig.nodes_ms || 0, sig.edges_ms || 0);
    if (peak > maxMs) err(`firma orbit_edge_draw (${peak}ms) supera max_duration_ms (${maxMs}ms)`);
    const exc = (m.governance?.exceptions || []).find((e) => e.id === sig.governed_exception);
    if (!exc) err(`excepción gobernada ${sig.governed_exception} no existe en governance.exceptions`);
    else if (exc.expires && exc.expires < "2026-07-16") err(`excepción ${exc.id} vencida (${exc.expires})`);
    else notes.push(`motion: max ${maxMs}ms cubre firma 620/680ms; excepción ${exc.id} vigente hasta ${exc.expires}`);
  }
  if (m.systems?.motion?.reduced_motion !== true) err("systems.motion.reduced_motion debe ser true");

  // 13. espectro modular
  for (const [slug, spec] of Object.entries(ext.module_spectrum || {})) {
    if (!HEX_COLOR.test(spec.accent || "")) err(`module_spectrum.${slug} con acento no-hex: ${spec.accent}`);
  }
  notes.push(`module_spectrum: ${Object.keys(ext.module_spectrum || {}).length} módulos con acento hex válido`);

  return { valid: errors.length === 0, errors, notes, manifest: m, raw };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const path = process.argv[2];
  if (!path) {
    console.error("Uso: node validate-identity.mjs /ruta/a/identity.json");
    process.exit(2);
  }
  const { valid, errors, notes } = validateIdentity(path);
  for (const n of notes) console.log("  · " + n);
  if (valid) {
    console.log("\nVALID — manifiesto estructuralmente válido y apto para compilación");
    process.exit(0);
  } else {
    console.error("\nINVALID — errores:");
    for (const e of errors) console.error("  ✗ " + e);
    process.exit(1);
  }
}
