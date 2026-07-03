import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sliders, FileText, Palette, Image as ImageIcon, Layers3, Sparkles } from "lucide-react";
import { IconModes } from "../../../../lib/icons";
import { PaletasEditor } from "../../PaletasEditor";
import { IconosEditor } from "../../IconosEditor";
import { PresetsEditor } from "../../PresetsEditor";
import { OverridesEditor } from "../../OverridesEditor";
import { WordPresetsEditor } from "../../WordPresetsEditor";

// Popup unificado de "Estilo global". Reemplaza los 3 botones del header
// (Presets PPT, Presets Word, Configuración global de estilo) por un
// solo CTA. Adentro: tabs PPT (presets curados) / Word (overrides Word) /
// Paletas / Íconos / Modos.
//
// Cada tab monta una superficie visual. Los ajustes que todavía no tienen
// catálogo curado no se editan desde acá para evitar campos crudos.

type Tab = "ppt" | "word" | "paletas" | "iconos" | "modos";

const TABS: { key: Tab; label: string; eyebrow: string; Icon: typeof Sliders; hint: string }[] = [
  { key: "ppt",     label: "Base PPT",     eyebrow: "Presets",      Icon: Sliders,    hint: "Estilos base por tipo de gráfico para el PPT" },
  { key: "word",    label: "Base Word",    eyebrow: "Reporte",      Icon: FileText,   hint: "Overrides solo para el reporte Word" },
  { key: "paletas", label: "Paletas",      eyebrow: "Color",        Icon: Palette,    hint: "Colores por value-label de cada lista" },
  { key: "iconos",  label: "Íconos",       eyebrow: "Assets",       Icon: ImageIcon,  hint: "PNGs subidos para slides de población" },
  { key: "modos",   label: "Modos por slot", eyebrow: "Reutilizable", Icon: IconModes, hint: "Overrides reusables nombrados (compacto, narrativo, etc.)" },
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
                Base PPT y Word, paletas, íconos y modos reutilizables para slots.
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

        <nav className="pulso-gv2-estilo-tabs" role="tablist">
          {TABS.map(({ key, label, eyebrow, Icon, hint }) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
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
        </nav>

        <div className={`pulso-gv2-estilo-body is-${tab}`}>
          {tab === "ppt" && <PresetsEditor />}
          {tab === "word" && <WordTabContent onClose={onClose} />}
          {tab === "paletas" && <PaletasEditor />}
          {tab === "iconos" && <IconosEditor />}
          {tab === "modos" && <OverridesEditor />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function WordTabContent({ onClose: _onClose }: { onClose: () => void }) {
  return <WordPresetsEditor />;
}
