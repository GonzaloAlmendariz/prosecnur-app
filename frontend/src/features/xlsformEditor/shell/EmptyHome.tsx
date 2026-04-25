// =============================================================================
// shell/EmptyHome.tsx — landing del editor cuando no hay workbook abierto
// =============================================================================
// Reemplaza al `ActionBand` aislado del monolito previo. Muestra 4 entradas
// posibles para arrancar:
//   1. "Empezar de cero" → workbook en blanco (createBlankWorkbook).
//   2. "Importar XLSForm" → file picker .xlsx.
//   3. "Importar SurveyMonkey" → file picker .sav.
//   4. "Plantillas" → CTA placeholder hasta el Sub-PR 8 (templates seeds).
//
// Estilo: tarjetas grandes con icono + título + descripción, hover sutil,
// stagger animation al montar (cada tarjeta entra con +60ms de delay).
//
// El EmptyHome no se monta cuando hay un `RestoreOfferBanner` arriba — el
// componente principal decide cuál renderizar.
// =============================================================================

import type { ReactNode } from "react";
import {
  FileSpreadsheet,
  Layers3,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";

export type EmptyHomeAction = {
  key: string;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  /** Acento del borde superior (color de la paleta categórica). */
  accent: string;
  /** Si true, la tarjeta queda visible pero deshabilitada con tag "Pronto". */
  comingSoon?: boolean;
};

export type EmptyHomeProps = {
  onNewBlank: () => void;
  onImportXls: () => void;
  onImportSurveyMonkey: () => void;
  /** Si la base ya tiene cosas y el usuario está en el modo "no hay workbook"
   *  (raro, pero pasa al montar tras refresh sin snapshot). */
  hint?: string;
};

export default function EmptyHome({
  onNewBlank,
  onImportXls,
  onImportSurveyMonkey,
  hint,
}: EmptyHomeProps) {
  const actions: EmptyHomeAction[] = [
    {
      key: "blank",
      title: "Empezar de cero",
      description:
        "Un formulario nuevo en blanco con la estructura mínima. Ideal cuando ya tienes claro qué preguntas vas a hacer.",
      icon: <Sparkles size={22} />,
      onClick: onNewBlank,
      accent: "#2457d6",
    },
    {
      key: "xlsform",
      title: "Importar XLSForm",
      description:
        "Abre un archivo .xlsx existente (formato ODK / KoBo). Se preserva todo: hojas, idiomas extra, columnas avanzadas.",
      icon: <Upload size={22} />,
      onClick: onImportXls,
      accent: "#0f766e",
    },
    {
      key: "surveymonkey",
      title: "Traducir SurveyMonkey",
      description:
        "Sube un .sav de SurveyMonkey y lo convertimos automáticamente a XLSForm editable.",
      icon: <Wand2 size={22} />,
      onClick: onImportSurveyMonkey,
      accent: "#7c3aed",
    },
    {
      key: "templates",
      title: "Plantillas listas",
      description:
        "Encuestas de hogar, calidad de servicio, censo simple. Pronto: arranca con un esqueleto probado.",
      icon: <Layers3 size={22} />,
      onClick: () => {
        /* placeholder hasta Sub-PR 8 */
      },
      accent: "#d97706",
      comingSoon: true,
    },
  ];

  return (
    <section
      aria-label="Empezar a editar un formulario"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "32px 28px",
        borderRadius: 16,
        background:
          "linear-gradient(180deg, var(--pulso-primary-soft) 0%, var(--pulso-surface) 60%)",
        border: "1px solid var(--pulso-primary-border)",
        boxShadow: "var(--pulso-shadow-low)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "white",
            border: "1px solid var(--pulso-primary-border)",
            color: "var(--pulso-primary)",
            flexShrink: 0,
          }}
        >
          <FileSpreadsheet size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: "var(--pulso-text)",
              letterSpacing: "-0.2px",
            }}
          >
            Constructor de XLSForms
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: "var(--pulso-text-soft)",
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            Diseña encuestas con una interfaz guiada — sin tocar Excel — y exporta
            a XLSForm cuando esté listo. Si ya tienes un instrumento, impórtalo
            y el editor lo abre con todo el contexto preservado.
          </p>
          {hint && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--pulso-text-soft)" }}>
              {hint}
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
          marginTop: 6,
        }}
      >
        {actions.map((action, idx) => (
          <ActionCard key={action.key} action={action} delayMs={idx * 60} />
        ))}
      </div>
    </section>
  );
}

function ActionCard({ action, delayMs }: { action: EmptyHomeAction; delayMs: number }) {
  const disabled = !!action.comingSoon;
  return (
    <button
      type="button"
      onClick={action.comingSoon ? undefined : action.onClick}
      disabled={disabled}
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
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
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
      {action.comingSoon && (
        <span
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            padding: "2px 8px",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: action.accent,
            background: hexToSoft(action.accent, 0.14),
            border: `1px solid ${hexToSoft(action.accent, 0.45)}`,
            borderRadius: 999,
          }}
        >
          Pronto
        </span>
      )}
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
