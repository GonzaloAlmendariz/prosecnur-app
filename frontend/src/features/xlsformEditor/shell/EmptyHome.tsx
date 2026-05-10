// =============================================================================
// shell/EmptyHome.tsx — landing del editor cuando no hay workbook abierto
// =============================================================================
// Hub minimalista con 3 puntos de entrada y, opcionalmente, un banner de
// "continuar editando" cuando hay un snapshot guardado. Antes tenía una
// galería de plantillas (Encuesta de hogar / Calidad de servicio / Censo)
// pero el usuario reportó que no aportaban — la mayoría empezaba "de cero"
// o importando un XLSForm real. Eliminada para no abrumar.
// =============================================================================

import type { ReactNode } from "react";
import { Sparkles, Upload } from "lucide-react";
import smMonkey from "../../../assets/sm-monkey.png";
import type { TemplateSeed } from "../templates/seedHelper";
import { HubFlowDiagram } from "./HubFlowDiagram";

export type EmptyHomeAction = {
  key: string;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  /** Acento del borde superior (color de la paleta categórica). */
  accent: string;
};

export type EmptyHomeProps = {
  onNewBlank: () => void;
  onImportXls: () => void;
  onImportSurveyMonkey: () => void;
  /** Carga un template seed concreto. Mantenido para compatibilidad de la
   *  prop, pero ya no se usa desde aquí — el hub no expone plantillas. */
  onPickTemplate?: (template: TemplateSeed) => void;
  /** Aviso persistente de "formulario en construcción" para continuar edición. */
  resumeBanner?: ReactNode;
};

export default function EmptyHome({
  onNewBlank,
  onImportXls,
  onImportSurveyMonkey,
  resumeBanner,
}: EmptyHomeProps) {
  const actions: EmptyHomeAction[] = [
    {
      key: "blank",
      title: "Empezar de cero",
      description:
        "Un formulario en blanco para construir pregunta por pregunta.",
      icon: <Sparkles size={22} />,
      onClick: onNewBlank,
      accent: "#2457d6",
    },
    {
      key: "xlsform",
      title: "Importar XLSForm",
      description:
        "Abre un archivo .xlsx existente y mantiene su estructura.",
      icon: <Upload size={22} />,
      onClick: onImportXls,
      accent: "#0f766e",
    },
    {
      key: "surveymonkey",
      title: "Traducir SurveyMonkey",
      description:
        "Conecta una encuesta de SurveyMonkey por API y la convierte a XLSForm.",
      icon: <img src={smMonkey} alt="" width={28} height={28} style={{ objectFit: "contain" }} />,
      onClick: onImportSurveyMonkey,
      accent: "#7c3aed",
    },
  ];

  return (
    <section
      aria-label="Empezar a editar un formulario"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: "26px 24px",
        borderRadius: 16,
        background:
          "linear-gradient(180deg, var(--pulso-primary-soft) 0%, var(--pulso-surface) 70%)",
        border: "1px solid var(--pulso-primary-border)",
        boxShadow: "var(--pulso-shadow-low)",
      }}
    >
      {/* 1. Pregunta directa — sin lead que distraiga. La acción primaria
             es elegir un punto de partida; las cards de abajo se explican
             solas. */}
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          color: "var(--pulso-text)",
          letterSpacing: "-0.3px",
          lineHeight: 1.2,
          maxWidth: 720,
        }}
      >
        ¿Cómo quieres armar tu formulario?
      </h2>

      {/* 2. Las 3 acciones — el camino que el usuario va a tomar. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        {actions.map((action, idx) => (
          <ActionCard key={action.key} action={action} delayMs={idx * 60} />
        ))}
      </div>

      {/* 3. Banner "continuar editando" — atajo para usuarios recurrentes,
             debajo de las acciones porque suele cubrirse con el snapshot
             persistido del workbook anterior. */}
      {resumeBanner ? <div>{resumeBanner}</div> : null}

      {/* 4. Guía: qué pasa después de elegir uno de los caminos. Esto es
             contexto educativo, no parte del flujo de decisión — por eso
             va al final, después de las acciones. */}
      <div
        style={{
          marginTop: 4,
          paddingTop: 18,
          borderTop: "1px dashed var(--pulso-primary-border)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: "var(--pulso-primary)",
          }}
        >
          Cómo funciona
        </span>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--pulso-text-soft)",
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          Cada formulario sigue estos cuatro pasos. El editor guarda los
          cambios automáticamente y exporta como XLSForm o PDF cuando
          esté listo.
        </p>
        <HubFlowDiagram />
      </div>
    </section>
  );
}

function ActionCard({ action, delayMs }: { action: EmptyHomeAction; delayMs: number }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      className="pulso-empty-home-card"
      style={{
        position: "relative",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        padding: "18px 18px 16px",
        borderRadius: 14,
        background: "white",
        border: "1px solid var(--pulso-border)",
        borderTop: `3px solid ${action.accent}`,
        cursor: "pointer",
        animation: `pulso-empty-home-in 360ms cubic-bezier(0.2, 0, 0, 1) ${delayMs}ms both`,
        transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: 10,
          background: hexToSoft(action.accent, 0.12),
          color: action.accent,
        }}
      >
        {action.icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "var(--pulso-text)",
            letterSpacing: "-0.1px",
          }}
        >
          {action.title}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--pulso-text-soft)",
            lineHeight: 1.55,
          }}
        >
          {action.description}
        </span>
      </div>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Helper local — convertir hex a rgba con alpha bajo
// -----------------------------------------------------------------------------

function hexToSoft(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return `rgba(36, 87, 214, ${alpha})`;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
