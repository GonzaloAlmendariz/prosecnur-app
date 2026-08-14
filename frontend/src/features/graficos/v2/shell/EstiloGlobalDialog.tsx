import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sliders, FileText, Palette, Image as ImageIcon, Layers3, Sparkles, CheckCircle2, Calculator } from "lucide-react";
import { IconModes } from "../../../../lib/icons";
import { PaletasEditor } from "../../PaletasEditor";
import { PptStyleProfilesPanel } from "../../PptStyleProfilesPanel";
import { IconosEditor } from "../../IconosEditor";
import { PresetsEditor } from "../../PresetsEditor";
import { CalculosEditor } from "../../CalculosEditor";
import { OverridesEditor } from "../../OverridesEditor";
import { WordPresetsEditor } from "../../WordPresetsEditor";
import { GlidingTabList } from "../../../../components/GlidingTabList";

// Popup unificado de "Estilo global". Reemplaza los 3 botones del header
// (Presets PPT, Presets Word, Configuración global de estilo) por un
// solo CTA. Adentro: tabs PPT (presets curados) / Word (overrides Word) /
// Paletas / Íconos / Variantes.
//
// Cada tab monta una superficie visual. Los ajustes que todavía no tienen
// catálogo curado no se editan desde acá para evitar campos crudos.

type Tab = "ppt" | "word" | "calculos" | "paletas" | "lineas" | "iconos" | "modos";

const TABS: { key: Tab; label: string; eyebrow: string; Icon: typeof Sliders; hint: string; summary: string }[] = [
  {
    key: "ppt",
    label: "Base PPT",
    eyebrow: "Valor por defecto",
    Icon: Sliders,
    hint: "Apariencia global por tipo de gráfico para el PowerPoint",
    summary: "Define cómo se ven los gráficos cuando no hay cambios propios.",
  },
  {
    key: "word",
    label: "Base Word",
    eyebrow: "Hereda de PPT",
    Icon: FileText,
    hint: "Ajustes globales para gráficos del reporte Word",
    summary: "Mantén Word alineado al PPT y ajusta solo lo que necesite otra lectura.",
  },
  {
    key: "calculos",
    label: "Cálculos",
    eyebrow: "Cifras",
    Icon: Calculator,
    hint: "Cómo se redondean los porcentajes y con cuántos decimales",
    summary: "La única pestaña que no es estética: decide las cifras de todo el mazo.",
  },
  {
    key: "paletas",
    label: "Color e identidad",
    eyebrow: "Paletas",
    Icon: Palette,
    hint: "Línea visual y colores por etiqueta de respuesta",
    summary: "Aplica identidades visuales y fija colores por categorías del instrumento.",
  },
  {
    key: "lineas",
    label: "Líneas visuales",
    eyebrow: "Identidad",
    Icon: Layers3,
    hint: "Identidades completas (ACNUR, institucional) aplicables al plan",
    summary: "Aplica una identidad completa —color, portada y bases PPT— solo cuando la necesites.",
  },
  {
    key: "iconos",
    label: "Íconos",
    eyebrow: "Recursos",
    Icon: ImageIcon,
    hint: "PNGs subidos para slides de población",
    summary: "Administra recursos visuales usados en láminas de población.",
  },
  {
    key: "modos",
    label: "Estilos guardados",
    eyebrow: "Reutilizables",
    Icon: IconModes,
    hint: "Apariencias reutilizables como compacto, narrativo o alta densidad",
    summary: "Crea estilos que puedes aplicar a varios gráficos sin repetir ajustes.",
  },
];

const STYLE_FLOW: Array<{
  key: "base" | "mode" | "manual";
  label: string;
  detail: string;
}> = [
  { key: "base", label: "Valor por defecto", detail: "No marca cambios" },
  { key: "mode", label: "Estilo guardado", detail: "Reusable" },
  { key: "manual", label: "Ajustes adicionales", detail: "Solo el gráfico activo" },
];

export type EstiloGlobalDialogProps = {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
};

export function EstiloGlobalDialog({ open, onClose, initialTab = "ppt" }: EstiloGlobalDialogProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  // Reset tab al abrir
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  // El diálogo se monta en un portal para no quedar atrapado por el header
  // ni por contenedores con stacking/overflow propios.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Esc + click outside
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    function onMouseDown(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="pulso-gv2-estilo-backdrop" role="dialog" aria-modal="true" aria-label="Estilo global">
      <div className="pulso-gv2-estilo-dialog" ref={dialogRef}>
        <header className="pulso-gv2-estilo-head">
          <div className="pulso-gv2-estilo-identity">
            <span className="pulso-gv2-estilo-mark" aria-hidden="true">
              <Sparkles size={17} />
            </span>
            <div className="pulso-gv2-estilo-copy">
              <div className="pulso-gv2-estilo-eyebrow">Suite visual</div>
              <div className="pulso-gv2-estilo-title">Estilo global</div>
              <div className="pulso-gv2-estilo-sub">
                Ordena la identidad visual completa del reporte sin mezclarla con los ajustes manuales del slide.
              </div>
            </div>
          </div>
          <div className="pulso-gv2-estilo-context" aria-label={`Sección activa: ${activeTab.label}`}>
            <span className="pulso-gv2-estilo-context-icon" aria-hidden="true">
              <activeTab.Icon size={14} />
            </span>
            <span className="pulso-gv2-estilo-context-copy">
              <strong>{activeTab.label}</strong>
              <span>{activeTab.eyebrow}</span>
            </span>
            <span className="pulso-gv2-estilo-context-pill">
              <Layers3 size={12} />
              Global
            </span>
          </div>
          <button
            type="button"
            className="pulso-gv2-estilo-close"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            aria-label="Cerrar"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </header>

        <div className="pulso-gv2-estilo-workbench">
          <aside className="pulso-gv2-estilo-rail" aria-label="Secciones de estilo global">
            <div className="pulso-gv2-estilo-rail-head">
              <span>Estructura visual</span>
              <strong>Base, color y estilos</strong>
              <small>Fija la base; guarda variaciones solo cuando necesites reutilizarlas.</small>
            </div>

            <div className="pulso-gv2-estilo-flow" aria-label="Cómo se aplican los estilos">
              <span className="pulso-gv2-estilo-flow-label">Prioridad de estilo</span>
              {STYLE_FLOW.map((step, index) => {
                const isActive = step.key === "mode" ? tab === "modos" : step.key === "base" ? tab !== "modos" : false;
                return (
                  <span
                    key={step.key}
                    className={`pulso-gv2-estilo-flow-step is-${step.key}${isActive ? " is-active" : ""}`}
                  >
                    <CheckCircle2 size={12} />
                    <span>
                      <strong>{step.label}</strong>
                      <small>{step.detail}</small>
                    </span>
                    {index < STYLE_FLOW.length - 1 && <i aria-hidden="true" />}
                  </span>
                );
              })}
            </div>

            <GlidingTabList as="nav" activeKey={tab} className="pulso-gv2-estilo-tabs" role="tablist" aria-label="Secciones de estilo global">
              {TABS.map(({ key, label, eyebrow, Icon, hint }) => (
                <button
                  key={key}
                  id={`pulso-gv2-estilo-tab-${key}`}
                  role="tab"
                  type="button"
                  aria-selected={tab === key}
                  aria-controls={`pulso-gv2-estilo-panel-${key}`}
                  data-gliding-key={key}
                  className={`pulso-gv2-estilo-tab ${tab === key ? "is-active" : ""}`}
                  onClick={() => setTab(key)}
                  aria-label={`${label}. ${hint}`}
                >
                  <span className="pulso-gv2-estilo-tab-icon" aria-hidden="true">
                    <Icon size={13} />
                  </span>
                  <span className="pulso-gv2-estilo-tab-copy">
                    <span className="pulso-gv2-estilo-tab-label">{label}</span>
                    <span className="pulso-gv2-estilo-tab-eyebrow">{eyebrow}</span>
                  </span>
                </button>
              ))}
            </GlidingTabList>
          </aside>

          <section
            className="pulso-gv2-estilo-panel"
            role="tabpanel"
            id={`pulso-gv2-estilo-panel-${tab}`}
            aria-labelledby={`pulso-gv2-estilo-tab-${tab}`}
          >
            <div className="pulso-gv2-estilo-sectionbar">
              <span className="pulso-gv2-estilo-section-icon" aria-hidden="true">
                <activeTab.Icon size={14} />
              </span>
              <div>
                <strong>{activeTab.label}</strong>
                <span>{activeTab.summary}</span>
              </div>
              <em>{activeTab.eyebrow}</em>
            </div>

            <div className={`pulso-gv2-estilo-body is-${tab}`}>
              {tab === "ppt" && <PresetsEditor />}
              {tab === "word" && <WordTabContent onClose={onClose} />}
              {tab === "calculos" && <CalculosEditor />}
              {tab === "paletas" && <PaletasEditor />}
              {tab === "lineas" && <PptStyleProfilesPanel />}
              {tab === "iconos" && <IconosEditor />}
              {tab === "modos" && <OverridesEditor />}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function WordTabContent({ onClose: _onClose }: { onClose: () => void }) {
  return <WordPresetsEditor />;
}
