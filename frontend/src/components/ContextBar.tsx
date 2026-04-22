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
  /**
   * ARIA label para lectores de pantalla. Ej. "Estado del autosave y
   * acciones de configuración".
   */
  ariaLabel?: string;
  /** Ref al div. Útil para medir o scrollar hacia él. */
  style?: React.CSSProperties;
};

export function ContextBar({
  children,
  background,
  border,
  elevated = false,
  density = "normal",
  ariaLabel,
  style,
}: Props) {
  const pad = density === "compact" ? "8px 12px" : "10px 14px";
  return (
    <div
      aria-label={ariaLabel}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        flexWrap: "wrap",
        padding: pad,
        background: background ?? "var(--pulso-surface)",
        border: border ?? "1px solid var(--pulso-border)",
        borderRadius: 8,
        boxShadow: elevated ? "var(--pulso-shadow-low)" : undefined,
        ...style,
      }}
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
      style={{
        width: 1, height: 22,
        background: "var(--pulso-border)",
        margin: "0 4px",
        flexShrink: 0,
      }}
    />
  );
}
