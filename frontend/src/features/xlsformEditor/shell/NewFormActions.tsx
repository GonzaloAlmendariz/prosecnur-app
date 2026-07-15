// =============================================================================
// shell/NewFormActions.tsx — las tres vías para crear un formulario nuevo
// =============================================================================
// Las tres puertas de entrada del hub: empezar de cero, importar un XLSForm o
// traducir una encuesta de SurveyMonkey. Se reusa en dos superficies:
//   - `variant="cards"` (default): tres tarjetas grandes lado a lado, para el
//     protagonismo del estado vacío / hero.
//   - `variant="menu"`: tres filas compactas apiladas, para la expansión inline
//     de la tarjeta "＋ Nuevo formulario" en el estado poblado.
//
// Los acentos por acción salen de los tokens de módulo de theme.css
// (--pulso-module-*); nada de hex hardcodeado. Se inyectan como custom
// properties (--xf-action-accent / --xf-action-accent-soft) que consume
// xf-home.css.
// =============================================================================

import type { CSSProperties, ReactNode } from "react";
import { Upload } from "../../../vendor/lucide-react";
import { IconNew } from "../../../lib/icons";
import smMonkey from "../../../assets/sm-monkey.png";

export type NewFormActionsProps = {
  onNewBlank: () => void;
  onImportXls: () => void;
  onImportSurveyMonkey: () => void;
  /** Disposición: tarjetas grandes (default) o filas compactas para popover. */
  variant?: "cards" | "menu";
};

type ActionSpec = {
  key: string;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  /** Token de acento (color y soft) de la paleta de módulos. */
  accent: string;
  accentSoft: string;
};

export function NewFormActions({
  onNewBlank,
  onImportXls,
  onImportSurveyMonkey,
  variant = "cards",
}: NewFormActionsProps) {
  const actions: ActionSpec[] = [
    {
      key: "blank",
      title: "Empezar de cero",
      description: "Un formulario en blanco para construir pregunta por pregunta.",
      icon: <IconNew size={variant === "menu" ? 18 : 22} />,
      onClick: onNewBlank,
      accent: "var(--pulso-module-editor)",
      accentSoft: "var(--pulso-module-editor-soft)",
    },
    {
      key: "xlsform",
      title: "Importar XLSForm",
      description: "Abre un archivo .xlsx existente y mantiene su estructura.",
      icon: <Upload size={variant === "menu" ? 18 : 22} />,
      onClick: onImportXls,
      accent: "var(--pulso-module-processing)",
      accentSoft: "var(--pulso-module-processing-soft)",
    },
    {
      key: "surveymonkey",
      title: "Traducir SurveyMonkey",
      description:
        "Conecta una encuesta de SurveyMonkey por API y la convierte a XLSForm.",
      icon: (
        <img
          src={smMonkey}
          alt=""
          width={variant === "menu" ? 22 : 28}
          height={variant === "menu" ? 22 : 28}
          className="pulso-xf-home-action-monkey"
        />
      ),
      onClick: onImportSurveyMonkey,
      accent: "var(--pulso-module-sample)",
      accentSoft: "var(--pulso-module-sample-soft)",
    },
  ];

  return (
    <div className={`pulso-xf-home-actions pulso-xf-home-actions--${variant}`}>
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          className="pulso-xf-home-action"
          style={{
            "--xf-action-accent": action.accent,
            "--xf-action-accent-soft": action.accentSoft,
          } as CSSProperties}
        >
          <span className="pulso-xf-home-action-icon" aria-hidden="true">
            {action.icon}
          </span>
          <span className="pulso-xf-home-action-body">
            <span className="pulso-xf-home-action-title">{action.title}</span>
            <span className="pulso-xf-home-action-desc">{action.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
