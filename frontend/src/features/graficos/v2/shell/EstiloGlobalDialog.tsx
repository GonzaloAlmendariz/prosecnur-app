import { useEffect, useRef, useState } from "react";
import { X, Sliders, FileText, Palette, Image as ImageIcon, Sparkles } from "lucide-react";
import { PaletasEditor } from "../../PaletasEditor";
import { IconosEditor } from "../../IconosEditor";
import { PresetsEditor } from "../../PresetsEditor";
import { OverridesEditor } from "../../OverridesEditor";
import PresetsModal from "../../PresetsModal";

// Popup unificado de "Estilo global". Reemplaza los 3 botones del header
// (Presets PPT, Presets Word, Configuración global de estilo) por un
// solo CTA. Adentro: tabs PPT (presets curados) / Word (overrides Word) /
// Paletas / Íconos / Modos.
//
// Cada tab simplemente monta el componente curado existente. Para Word,
// no existía UI curada — temporalmente reusamos el modal JSON crudo
// dentro del tab; en una iteración posterior se reemplazaría por UI
// curada equivalente al PresetsEditor.

type Tab = "ppt" | "word" | "paletas" | "iconos" | "modos";

const TABS: { key: Tab; label: string; Icon: typeof Sliders; hint: string }[] = [
  { key: "ppt",     label: "Presets PPT",  Icon: Sliders,    hint: "Estilos por tipo de gráfico para el PPT" },
  { key: "word",    label: "Word",         Icon: FileText,   hint: "Overrides solo para el reporte Word" },
  { key: "paletas", label: "Paletas",      Icon: Palette,    hint: "Colores por value-label de cada lista" },
  { key: "iconos",  label: "Íconos",       Icon: ImageIcon,  hint: "PNGs subidos para slides de población" },
  { key: "modos",   label: "Modos",        Icon: Sparkles,   hint: "Overrides reusables nombrados (compacto, narrativo, etc.)" },
];

export type EstiloGlobalDialogProps = {
  open: boolean;
  onClose: () => void;
  initialTab?: Tab;
};

export function EstiloGlobalDialog({ open, onClose, initialTab = "ppt" }: EstiloGlobalDialogProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Reset tab al abrir
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

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

  if (!open) return null;

  return (
    <div className="pulso-gv2-estilo-backdrop" role="dialog" aria-modal="true" aria-label="Estilo global">
      <div className="pulso-gv2-estilo-dialog" ref={dialogRef}>
        <header className="pulso-gv2-estilo-head">
          <div>
            <div className="pulso-gv2-estilo-title">Estilo global</div>
            <div className="pulso-gv2-estilo-sub">
              Configura presets, paletas, íconos y modos. Estos valores se heredan en todos los slides.
            </div>
          </div>
          <button
            type="button"
            className="pulso-gv2-estilo-close"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar (Esc)"
          >
            <X size={16} />
          </button>
        </header>

        <nav className="pulso-gv2-estilo-tabs" role="tablist">
          {TABS.map(({ key, label, Icon, hint }) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              className={`pulso-gv2-estilo-tab ${tab === key ? "is-active" : ""}`}
              onClick={() => setTab(key)}
              title={hint}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </nav>

        <div className="pulso-gv2-estilo-body">
          {tab === "ppt" && <PresetsEditor />}
          {tab === "word" && <WordTabContent onClose={onClose} />}
          {tab === "paletas" && <PaletasEditor />}
          {tab === "iconos" && <IconosEditor />}
          {tab === "modos" && <OverridesEditor />}
        </div>
      </div>
    </div>
  );
}

// Word: por ahora un placeholder con CTA al editor JSON viejo. La UI
// curada de Word (equivalente al PresetsEditor) es trabajo futuro —
// w_presets tiene menos args y son menos comunes.
function WordTabContent({ onClose }: { onClose: () => void }) {
  const [openJson, setOpenJson] = useState(false);
  return (
    <>
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 12, color: "var(--pulso-text)", marginBottom: 8, lineHeight: 1.5, fontWeight: 600 }}>
          Word usa los mismos valores que PPT por defecto.
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginBottom: 16, lineHeight: 1.5, maxWidth: 520 }}>
          Solo necesitas overrides Word si quieres títulos/bases con estilo distinto al PPT, dimensiones de imagen
          custom, o numeración de figuras. Estos campos viven en <code>w_presets</code>.
        </div>
        <button
          type="button"
          className="pulso-primary"
          onClick={() => setOpenJson(true)}
          style={{
            fontSize: 12, padding: "7px 14px",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          <FileText size={13} /> Editar overrides Word (JSON)
        </button>
      </div>
      {openJson && <PresetsModal kind="word" onClose={() => { setOpenJson(false); void onClose; }} />}
    </>
  );
}
