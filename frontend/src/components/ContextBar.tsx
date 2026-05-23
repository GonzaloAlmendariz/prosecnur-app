// ContextBar — wrapper unificado para las "bandas" de toolbar que
// aparecen arriba del contenido en varias fases del app.
//
// Antes cada fase definía su propio `<div style={{ padding, background,
// border, borderRadius }}>` para envolver los controles (save indicator
// + context + export/import + acciones). El contenido varía, pero el
// marco visual debería ser idéntico para que el ojo reconozca "esto
// es la barra de contexto" sin pensar.
//
// Diseñado para NO forzar estructura interna — el consumer pone su
// contenido como children. Las únicas reglas son:
//   - padding 10px 14px (coherente con el resto del sistema).
//   - background `--pulso-surface` + border `--pulso-border`.
//   - border-radius 8px + shadow-low opcional.
//   - `display: flex` + gap 10 + flex-wrap.
//
// Para bandas con variantes (ej. AnaliticaHeader tiene una banda que
// cambia de color según "usando adaptados vs originales"), se pueden
// pasar `background` y `border` custom via props — sobrescriben los
// defaults sin romper el resto del layout.

type Props = {
  children: React.ReactNode;
  /** Background custom. Default: `var(--pulso-surface)`. */
  background?: string;
  /** Border custom. Default: `1px solid var(--pulso-border)`. */
  border?: string;
  /**
   * Elevación sutil. Default `false` (solo border). `true` añade
   * `var(--pulso-shadow-low)` — útil para destacar la banda principal
   * de una fase (ej. el stepper).
   */
  elevated?: boolean;
  /**
   * Altura/densidad del padding interno. "normal" (default) = `10px 14px`.
   * "compact" = `8px 12px` para bandas secundarias.
   */
  density?: "normal" | "compact";
  /** Tratamiento de superficie. `material` se reserva para command bars/nav. */
  variant?: "solid" | "material";
  /**
   * ARIA label para lectores de pantalla. Ej. "Estado del autosave y
   * acciones de configuración".
   */
  ariaLabel?: string;
  className?: string;
  /** Ref al div. Útil para medir o scrollar hacia él. */
  style?: React.CSSProperties;
};

export function ContextBar({
  children,
  background,
  border,
  elevated = false,
  density = "normal",
  variant = "material",
  ariaLabel,
  className,
  style,
}: Props) {
  const cssVars = {
    "--pulso-context-bg": background,
    "--pulso-context-border": border,
  } as React.CSSProperties;
  const classes = [
    "pulso-context-bar",
    `pulso-context-bar--${density}`,
    `pulso-context-bar--${variant}`,
    elevated ? "is-elevated" : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <div
      aria-label={ariaLabel}
      role={ariaLabel ? "toolbar" : undefined}
      className={classes}
      style={{ ...cssVars, ...style }}
    >
      {children}
    </div>
  );
}

// Divider vertical sutil para separar grupos dentro de un mismo
// ContextBar (ej. separar "acciones de config" de "acciones de export").
// Pixel-perfect 1px centrado verticalmente.
export function ContextBarDivider() {
  return (
    <span
      aria-hidden="true"
      className="pulso-context-bar-divider"
    />
  );
}
