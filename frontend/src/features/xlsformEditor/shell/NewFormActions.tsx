// =============================================================================
// shell/NewFormActions.tsx — las tres vías para crear un formulario nuevo
// =============================================================================
// Las tres puertas de entrada del hub: empezar de cero, importar un XLSForm o
// traducir una encuesta de SurveyMonkey. Tres filas compactas apiladas dentro
// de la tarjeta "＋ Nuevo formulario" cuando se expande.
//
// Antes había una segunda disposición (`cards`: tarjetas grandes lado a lado)
// para el hero del estado vacío. Al unificar el homepage en una sola grilla,
// ese hero desapareció y con él su disposición: la creación se ve igual con 0
// formularios que con 5.
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
}: NewFormActionsProps) {
  const actions: ActionSpec[] = [
    {
      key: "blank",
      title: "Empezar de cero",
      description: "Un formulario en blanco para construir pregunta por pregunta.",
      icon: <IconNew size={18} />,
      onClick: onNewBlank,
      accent: "var(--pulso-module-editor)",
      accentSoft: "var(--pulso-module-editor-soft)",
    },
    {
      key: "xlsform",
      title: "Importar como nuevo",
      description: "Crea un borrador nuevo desde un .xlsx; publicación y público se revisan en este proyecto.",
      icon: <Upload size={18} />,
      onClick: onImportXls,
      accent: "var(--pulso-module-editor)",
      accentSoft: "var(--pulso-module-editor-soft)",
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
          width={22}
          height={22}
          className="pulso-xf-home-action-monkey"
        />
      ),
      onClick: onImportSurveyMonkey,
      accent: "var(--pulso-module-editor)",
      accentSoft: "var(--pulso-module-editor-soft)",
    },
  ];

  return (
    <div className="pulso-xf-home-actions pulso-xf-home-actions--menu">
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
