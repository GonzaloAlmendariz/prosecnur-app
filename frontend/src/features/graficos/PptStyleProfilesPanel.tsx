import { useState } from "react";
import { Check, Layers3, Loader2, Palette, Sparkles } from "lucide-react";
import type { PptStyleProfileMeta } from "../../api/client";
import { usePlanStore } from "./store";
import { usePptStyleProfiles } from "./usePptStyleProfiles";
import { resolveGraphLucideIcon } from "./lucideRegistry";

export function PptStyleProfilesPanel() {
  const { profiles, loading, error } = usePptStyleProfiles();
  const applyPptStyleProfile = usePlanStore((s) => s.applyPptStyleProfile);
  const [applied, setApplied] = useState<string | null>(null);

  if (loading) {
    return (
      <section className="pulso-gv2-ppt-style-panel is-loading">
        <Loader2 size={14} className="pulso-spin" />
        Cargando líneas visuales...
      </section>
    );
  }

  if (error) {
    return (
      <section className="pulso-gv2-ppt-style-panel is-error">
        No se pudieron cargar las líneas visuales: {error}
      </section>
    );
  }

  if (!profiles.length) return null;

  const appliedProfile = profiles.find((profile) => profile.name === applied) ?? null;
  const appliedProfileTitle = appliedProfile ? profileDisplayTitle(appliedProfile) : "";

  return (
    <section className="pulso-gv2-ppt-style-panel" aria-label="Líneas visuales de presentación">
      <div className="pulso-gv2-ppt-style-intro">
        <span className="pulso-gv2-ppt-style-intro-icon"><Palette size={14} /></span>
        <div>
          <strong>Líneas visuales</strong>
          <span>Aplica color, portada, bases PPT y estilos guardados sin mover slides ni variables.</span>
        </div>
        <span className={`pulso-gv2-ppt-style-session ${appliedProfile ? "is-applied" : "is-base"}`}>
          {appliedProfile ? <Check size={12} /> : <Layers3 size={12} />}
          <span>
            <strong>{appliedProfile ? appliedProfileTitle : "Valor por defecto"}</strong>
            <small>{appliedProfile ? "Aplicada en esta sesión" : "Sin línea aplicada"}</small>
          </span>
        </span>
      </div>

      <div className="pulso-gv2-ppt-style-list">
        {profiles.map((profile) => {
          const Icon = resolveGraphLucideIcon(profile.icono_ui, "Sliders");
          const isApplied = applied === profile.name;
          const impact = profileImpactLabel(profile);
          const colorCount = profile.preview_colors?.length ?? 0;
          const displayTitle = profileDisplayTitle(profile);
          const displayDescription = profileDisplayDescription(profile);
          return (
            <article className={`pulso-gv2-ppt-style-card ${isApplied ? "is-applied" : ""}`} key={profile.name}>
              <div className="pulso-gv2-ppt-style-card-head">
                <span className="pulso-gv2-ppt-style-card-icon"><Icon size={15} /></span>
                <div>
                  <strong>{displayTitle}</strong>
                  <span>{displayDescription}</span>
                </div>
              </div>

              <div className="pulso-gv2-ppt-style-swatches" aria-hidden="true">
                {(profile.preview_colors ?? []).map((color, index) => (
                  <span
                    key={`${profile.name}-${color}-${index}`}
                    style={{ background: color }}
                  />
                ))}
              </div>

              <div className="pulso-gv2-ppt-style-card-meta">
                <span>{colorCount} color{colorCount === 1 ? "" : "es"}</span>
                <span>{impact}</span>
                <span>No mueve slides</span>
              </div>

              <button
                type="button"
                className={isApplied ? "is-applied" : ""}
                aria-pressed={isApplied}
                title={isApplied ? "Línea visual aplicada en esta sesión" : `Aplicar línea visual ${displayTitle}`}
                onClick={() => {
                  applyPptStyleProfile(profile);
                  setApplied(profile.name);
                }}
              >
                {isApplied ? <Check size={12} /> : <Sparkles size={12} />}
                {isApplied ? "Línea activa" : "Aplicar línea"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function profileImpactLabel(profile: PptStyleProfileMeta): string {
  const presetCount = Object.keys(profile.presets ?? {}).length;
  const paletteCount = Object.keys(profile.paletas ?? {}).length;
  const modeCount = profile.overrides_reusables?.length ?? 0;
  const parts: string[] = [];
  if (presetCount > 0) parts.push(`${presetCount} base${presetCount === 1 ? "" : "s"} PPT`);
  if (paletteCount > 0) parts.push(`${paletteCount} paleta${paletteCount === 1 ? "" : "s"}`);
  if (modeCount > 0) parts.push(`${modeCount} estilo${modeCount === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(" · ") : "Sin ajustes catalogados";
}

function profileDisplayTitle(profile: PptStyleProfileMeta): string {
  return profile.titulo_humano
    .replace(/ACNUR\s+KOICA\s*[-–]\s*/gi, "ACNUR territorial - ")
    .replace(/\bKOICA\b/gi, "territorial");
}

function profileDisplayDescription(profile: PptStyleProfileMeta): string {
  return profile.descripcion
    .replace(/El modo territorial KOICA agrega mapas y comparativos solo cuando corresponde\./gi, "La variante territorial agrega mapas y permite comparativos solo cuando corresponde.")
    .replace(/ACNUR\/KOICA/gi, "ACNUR territorial")
    .replace(/ACNUR\s+KOICA/gi, "ACNUR territorial")
    .replace(/diseño\s+KOICA/gi, "diseño territorial")
    .replace(/\bKOICA\b/gi, "territorial");
}
