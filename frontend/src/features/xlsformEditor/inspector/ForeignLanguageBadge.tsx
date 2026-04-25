// =============================================================================
// inspector/ForeignLanguageBadge.tsx — banner de idiomas extra preservados
// =============================================================================
// Aparece arriba del inspector (o del constructor) cuando el workbook
// importado tiene columnas label::*, hint::* o media::*::* con idiomas
// distintos al base. La regla de la Fase 1 del revamp:
//
//   "Solo edita `es`. Si el .xlsx importado trae otros idiomas, se
//    preservan en memoria y al exportar, pero no se editan visualmente."
//
// El banner avisa al usuario para que sepa que su trabajo no se está
// "perdiendo" — y que si quiere editarlo, puede hacerlo en el .xlsx.
// =============================================================================

import { Globe2 } from "lucide-react";
import type { ForeignLanguageNotice } from "../parsing/languageScan";

export type ForeignLanguageBadgeProps = {
  notice: ForeignLanguageNotice | null;
};

export function ForeignLanguageBadge({ notice }: ForeignLanguageBadgeProps) {
  if (!notice) return null;

  const languageList = notice.languages.slice(0, 4).join(", ");
  const extra =
    notice.languages.length > 4 ? ` y ${notice.languages.length - 4} más` : "";

  return (
    <aside className="pulso-foreign-banner" role="note" aria-label="Idiomas extra detectados">
      <span className="pulso-foreign-banner-icon">
        <Globe2 size={14} />
      </span>
      <div className="pulso-foreign-banner-meta">
        <strong>Idiomas extra preservados</strong>
        <span>
          Este formulario trae traducciones en {languageList}{extra}. Pulso las
          conserva al exportar, pero la edición visual de otros idiomas llega
          en una próxima iteración. Para editarlos ahora, modifica el archivo
          .xlsx directamente.
        </span>
      </div>
    </aside>
  );
}
