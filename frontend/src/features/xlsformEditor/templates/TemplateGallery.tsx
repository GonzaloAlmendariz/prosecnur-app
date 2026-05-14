// =============================================================================
// templates/TemplateGallery.tsx — galería de plantillas seed
// =============================================================================
// Muestra los 4 templates como tarjetas grandes con:
//   - Acento superior (color del seed).
//   - Título + descripción.
//   - 3-4 highlights (bullets cortitos).
//   - Stats rápidos: cantidad de filas survey, catálogos.
//
// Click en una tarjeta → invoca `onPick(seed.id)`. El monolito materializa
// el workbook con `buildWorkbookFromSeed(seed)` y lo carga.
// =============================================================================

import {
  Award,
  Building2,
  CalendarDays,
  Layers3,
  LayoutTemplate,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TemplateId, TemplateSeed } from "./seedHelper";
import { TEMPLATES } from "./index";

const ICON_BY_ID: Record<TemplateId, LucideIcon> = {
  blank: Plus,
  household: Building2,
  "service-quality": Award,
  census: CalendarDays,
};

export type TemplateGalleryProps = {
  onPick: (template: TemplateSeed) => void;
  /** Si true, oculta la card "Empezar de cero" (blank) por ya estar en el
   *  EmptyHome como acción primaria. */
  hideBlank?: boolean;
};

export function TemplateGallery({ onPick, hideBlank }: TemplateGalleryProps) {
  const visible = hideBlank ? TEMPLATES.filter((t) => t.id !== "blank") : TEMPLATES;

  return (
    <div className="pulso-template-gallery">
      <header className="pulso-template-gallery-header">
        <Layers3 size={18} />
        <div>
          <strong>Plantillas listas para personalizar</strong>
          <span>Empieza con un esqueleto probado y adapta los textos a tu instrumento.</span>
        </div>
      </header>

      <div className="pulso-template-gallery-grid">
        {visible.map((seed, idx) => {
          const Icon = ICON_BY_ID[seed.id] ?? LayoutTemplate;
          return (
            <button
              key={seed.id}
              type="button"
              className="pulso-template-card"
              onClick={() => onPick(seed)}
              style={{
                ["--seed-accent" as string]: seed.accent,
                animationDelay: `${idx * 70}ms`,
              }}
            >
              <span className="pulso-template-card-acc" />
              <span className="pulso-template-card-icon" style={{ color: seed.accent }}>
                <Icon size={20} />
              </span>
              <div className="pulso-template-card-meta">
                <strong>{seed.title}</strong>
                <p>{seed.description}</p>
              </div>
              <ul className="pulso-template-card-highlights">
                {seed.highlights.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <div className="pulso-template-card-stats">
                <span>{countQuestions(seed)} preguntas</span>
                <span>·</span>
                <span>
                  {seed.catalogs.length} {seed.catalogs.length === 1 ? "catálogo" : "catálogos"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function countQuestions(seed: TemplateSeed): number {
  let count = 0;
  for (const row of seed.surveyRows) {
    const type = (row.type ?? "").trim().split(/\s+/)[0] ?? "";
    if (
      type === "begin_group" ||
      type === "end_group" ||
      type === "begin_repeat" ||
      type === "end_repeat" ||
      type === "start" ||
      type === "end" ||
      type === "today" ||
      type === "deviceid" ||
      type === "username"
    ) {
      continue;
    }
    count += 1;
  }
  return count;
}
