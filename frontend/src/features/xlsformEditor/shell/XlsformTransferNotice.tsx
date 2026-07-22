import { Info } from "../../../vendor/lucide-react";
import "../styles/xf-surveymonkey-dialog.css";

export type XlsformTransferNoticeProps = {
  variant?: "translation" | "export" | "import";
  compact?: boolean;
};

const NOTICE_COPY = {
  translation: {
    title: "De SurveyMonkey a un borrador XLSForm",
    detail:
      "Prosecnur traduce estructura, matrices, saltos y validaciones a un borrador editable. Este paso no publica el instrumento y no confirma la lógica: revísalo y publica una revisión desde la biblioteca cuando esté listo.",
  },
  export: {
    title: "Qué viaja en el .xlsx",
    detail:
      "El archivo contiene el formulario. La revisión publicada, el público asignado y la confirmación metodológica permanecen en el proyecto .pulso y no viajan en el .xlsx.",
  },
  import: {
    title: "Se importará como un borrador nuevo",
    detail:
      "El .xlsx recupera el formulario, pero no la revisión publicada, el público ni la confirmación del proyecto de origen. Revísalos antes de publicar.",
  },
} as const;

export function XlsformTransferNotice({
  variant = "translation",
  compact = false,
}: XlsformTransferNoticeProps) {
  const copy = NOTICE_COPY[variant];
  return (
    <aside
      className={`pulso-xf-transfer-notice${compact ? " is-compact" : ""}`}
      role="note"
      aria-label={copy.title}
    >
      <Info size={16} aria-hidden="true" />
      <span>
        <strong>{copy.title}</strong>
        <span>{copy.detail}</span>
      </span>
    </aside>
  );
}
