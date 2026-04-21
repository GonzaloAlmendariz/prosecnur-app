import { useState } from "react";
import { ChevronDown, ChevronRight, Palette, Image, Sliders, Layers3 } from "lucide-react";
import { usePlanStore } from "./store";
import { PaletasEditor } from "./PaletasEditor";
import { IconosEditor } from "./IconosEditor";
import { PresetsEditor } from "./PresetsEditor";
import { OverridesEditor } from "./OverridesEditor";

// Panel global colapsable que vive arriba del layout de 3 columnas.
// Análogo a `DefinicionGlobal` de Analítica. Contiene 4 tabs con la
// configuración de estilo que alimenta a TODOS los gráficos del plan:
//   - Paletas: colores por value-label de cada lista del XLSForm.
//   - Iconos:  PNGs subidos para slides de población.
//   - Presets: estilos tipo-de-graficador (colores, canvas, tamaños).
//   - Overrides reutilizables: mini-presets nombrados para reusar en slides.
//
// Cada tab es un componente aparte para mantener este archivo manejable.

type Tab = "paletas" | "iconos" | "presets" | "overrides";

const TABS: { key: Tab; label: string; icon: typeof Palette }[] = [
  { key: "paletas",   label: "Paletas",   icon: Palette },
  { key: "iconos",    label: "Iconos",    icon: Image },
  { key: "presets",   label: "Presets",   icon: Sliders },
  { key: "overrides", label: "Overrides", icon: Layers3 },
];

export function ConfiguracionGlobal() {
  const hydrated = usePlanStore((s) => s.hydrated);
  const nPaletas = usePlanStore((s) => Object.keys(s.paletas).length);
  const nIconos = usePlanStore((s) => s.iconos.length);
  const nPresets = usePlanStore((s) => Object.keys(s.presets).length);
  const nOverrides = usePlanStore((s) => s.overridesReusables.length);

  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [tab, setTab] = useState<Tab>("paletas");

  if (!hydrated) return null;

  // Resumen textual que se muestra cuando el bloque está cerrado.
  const summaryBits: string[] = [
    `${nPaletas} ${nPaletas === 1 ? "paleta" : "paletas"}`,
    `${nIconos} ${nIconos === 1 ? "ícono" : "iconos"}`,
    `${nPresets} presets`,
    `${nOverrides} overrides`,
  ];

  return (
    <div
      style={{
        background: "white",
        border: "1px solid var(--pulso-border)",
        borderRadius: 10,
        marginBottom: 12,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-expanded={open}
        style={{
          width: "100%", textAlign: "left",
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          background: hover || open ? "var(--pulso-surface)" : "white",
          border: "none", cursor: "pointer",
          borderRadius: open ? "9px 9px 0 0" : 9,
          transition: "background 120ms ease",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "var(--pulso-text)" }}>
          <Palette size={14} />
          Configuración global de estilo
        </span>
        <span style={{ fontSize: 11, color: "var(--pulso-text-soft)", flex: 1, lineHeight: 1.4 }}>
          {summaryBits.join(" · ")}
        </span>
        <span style={{ color: "var(--pulso-text-soft)" }}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--pulso-border)" }}>
          {/* Tab bar */}
          <div
            style={{
              display: "flex", gap: 0,
              borderBottom: "1px solid var(--pulso-border)",
              padding: "0 14px",
              background: "var(--pulso-surface-2)",
            }}
          >
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: "10px 14px",
                    border: "none",
                    borderBottom: `2px solid ${active ? "var(--pulso-primary)" : "transparent"}`,
                    background: "transparent",
                    color: active ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
                    fontWeight: active ? 700 : 500,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 6,
                    transition: "color 120ms ease, border-color 120ms ease",
                  }}
                >
                  <Icon size={13} /> {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab body */}
          <div style={{ padding: 14 }}>
            {tab === "paletas"   && <PaletasEditor />}
            {tab === "iconos"    && <IconosEditor />}
            {tab === "presets"   && <PresetsEditor />}
            {tab === "overrides" && <OverridesEditor />}
          </div>
        </div>
      )}
    </div>
  );
}
