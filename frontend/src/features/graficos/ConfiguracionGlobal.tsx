import { useState } from "react";
import { ChevronDown, ChevronRight, Palette, Image, Sliders, Layers3, Settings2 } from "lucide-react";
import { usePlanStore } from "./store";
import { PaletasEditor } from "./PaletasEditor";
import { IconosEditor } from "./IconosEditor";
import { PresetsEditor } from "./PresetsEditor";
import { OverridesEditor } from "./OverridesEditor";
import { DefaultsModal } from "./DefaultsModal";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [defaultsModal, setDefaultsModal] = useState<null | "presets" | "overrides">(null);

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
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex", alignItems: "center",
          background: hover || open ? "var(--pulso-surface)" : "white",
          borderRadius: open ? "9px 9px 0 0" : 9,
          transition: "background 120ms ease",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            flex: 1, textAlign: "left",
            padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
            background: "transparent",
            border: "none", cursor: "pointer",
            borderRadius: open ? "9px 0 0 0" : "9px 0 0 9px",
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

        {/* Engranaje: acciones sobre los DEFAULTS de la app. Popover
            con opciones para modificar los valores que sirven de base
            (factory) al Restaurar default. Aislado del toggle de
            apertura del box. */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          title="Configurar defaults de la app"
          aria-label="Configurar defaults"
          style={{
            padding: "10px 14px",
            background: "transparent",
            border: "none", borderLeft: "1px solid var(--pulso-border)",
            cursor: "pointer",
            color: menuOpen ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
            transition: "color 120ms ease",
          }}
        >
          <Settings2 size={15} />
        </button>
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 20 }}
            />
            <div
              style={{
                position: "absolute", top: "calc(100% + 2px)", right: 0,
                zIndex: 21,
                minWidth: 220,
                background: "white",
                border: "1px solid var(--pulso-border)",
                borderRadius: 8,
                boxShadow: "var(--pulso-shadow-med)",
                padding: 4,
                display: "flex", flexDirection: "column", gap: 1,
              }}
            >
              <MenuItem
                label="Modificar defaults de presets"
                hint="Editar los valores base que sirven de arranque a cualquier estudio."
                onClick={() => { setMenuOpen(false); setDefaultsModal("presets"); }}
              />
              <MenuItem
                label="Modificar defaults de overrides"
                hint="Editar / añadir overrides reusables (reducido, compacto…)."
                onClick={() => { setMenuOpen(false); setDefaultsModal("overrides"); }}
              />
            </div>
          </>
        )}
      </div>

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

      {defaultsModal && (
        <DefaultsModal
          mode={defaultsModal}
          onClose={() => setDefaultsModal(null)}
        />
      )}
    </div>
  );
}

function MenuItem({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", gap: 2,
        padding: "8px 10px", borderRadius: 5,
        border: "1px solid transparent",
        background: "transparent",
        textAlign: "left", cursor: "pointer", width: "100%",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--pulso-surface)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pulso-text)" }}>{label}</span>
      {hint && <span style={{ fontSize: 10, color: "var(--pulso-text-soft)", lineHeight: 1.4 }}>{hint}</span>}
    </button>
  );
}
