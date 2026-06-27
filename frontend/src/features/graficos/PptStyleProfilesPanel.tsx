import { useState } from "react";
import { Check, Loader2, Palette, Sparkles } from "lucide-react";
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
        Cargando presets visuales de PPT...
      </section>
    );
  }

  if (error) {
    return (
      <section className="pulso-gv2-ppt-style-panel is-error">
        No se pudieron cargar los presets visuales: {error}
      </section>
    );
  }

  if (!profiles.length) return null;

  return (
    <section className="pulso-gv2-ppt-style-panel" aria-label="Presets visuales de presentación">
      <div className="pulso-gv2-ppt-style-intro">
        <span className="pulso-gv2-ppt-style-intro-icon"><Palette size={14} /></span>
        <div>
          <strong>Preset visual de presentación</strong>
          <span>Aplica una línea gráfica al plan actual sin cambiar los slides ni sus variables.</span>
        </div>
      </div>

      <div className="pulso-gv2-ppt-style-list">
        {profiles.map((profile) => {
          const Icon = resolveGraphLucideIcon(profile.icono_ui, "Sliders");
          const isApplied = applied === profile.name;
          return (
            <article className="pulso-gv2-ppt-style-card" key={profile.name}>
              <div className="pulso-gv2-ppt-style-card-head">
                <span className="pulso-gv2-ppt-style-card-icon"><Icon size={15} /></span>
                <div>
                  <strong>{profile.titulo_humano}</strong>
                  <span>{profile.descripcion}</span>
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

              <button
                type="button"
                className={isApplied ? "is-applied" : ""}
                onClick={() => {
                  applyPptStyleProfile(profile);
                  setApplied(profile.name);
                }}
              >
                {isApplied ? <Check size={12} /> : <Sparkles size={12} />}
                {isApplied ? "Aplicado" : "Aplicar preset"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
