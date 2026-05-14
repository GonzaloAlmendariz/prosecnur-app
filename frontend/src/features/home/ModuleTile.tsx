import { type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import type { ModuleMeta } from "./HomePage";

type ModuleTileProps = {
  mod: ModuleMeta;
  meta: string | null;
  onOpen: () => void;
};

export function ModuleTile({ mod, meta, onOpen }: ModuleTileProps) {
  const Icon = mod.icon;
  const isActive = !!mod.to;
  const accentStyle = {
    "--home-mod-accent": mod.iconFg,
    "--home-mod-accent-soft": mod.iconBg,
    "--home-mod-accent-border": mod.iconBorder,
  } as CSSProperties;

  // Spotlight cursor: actualiza vars CSS --mx/--my con la posición relativa
  // del cursor. El gradient radial del ::before sigue al mouse. Sin libs.
  function handleMouseMove(e: ReactMouseEvent<HTMLButtonElement>) {
    if (!isActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  // Mostrar el meta solo cuando es estado "Próximamente" — para módulos
  // activos el detalle vive en el modal, no en la card (mantener la card
  // simple: solo ícono + nombre).
  const showMeta = !isActive && meta === "Próximamente";

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseMove={handleMouseMove}
      className={`home-tile-card ${isActive ? "is-active" : "is-soon"}`}
      style={accentStyle}
      aria-label={`${mod.title}: ${mod.tagline}`}
    >
      <span className="home-tile-icon-wrap" aria-hidden="true">
        <Icon size={40} strokeWidth={1.7} />
      </span>
      <span className="home-tile-title">{mod.title}</span>
      {showMeta && <span className="home-tile-meta">{meta}</span>}
    </button>
  );
}
