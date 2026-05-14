import { type CSSProperties, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import type { ModuleMeta } from "./HomePage";

type ModuleDetailProps = {
  mod: ModuleMeta;
  onClose: () => void;
};

export function ModuleDetail({ mod, onClose }: ModuleDetailProps) {
  const navigate = useNavigate();
  const Icon = mod.icon;
  const isActive = !!mod.to;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const accentStyle = {
    "--home-mod-accent": mod.iconFg,
    "--home-mod-accent-soft": mod.iconBg,
    "--home-mod-accent-border": mod.iconBorder,
  } as CSSProperties;

  // Cierre con ESC + foco inicial al botón cerrar para accesibilidad.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleEnter() {
    if (!isActive || !mod.to) return;
    const to = mod.to;
    onClose();
    window.setTimeout(() => navigate(to), 0);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return createPortal(
    <div
      className="home-detail-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="home-detail-panel"
        style={accentStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`detail-title-${mod.slug}`}
      >
        <button
          ref={closeRef}
          type="button"
          className="home-detail-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <div className="home-detail-left">
          <span className="home-detail-icon-wrap" aria-hidden="true">
            <Icon size={88} strokeWidth={1.5} />
          </span>
        </div>

        <div className="home-detail-right">
          <h2 id={`detail-title-${mod.slug}`} className="home-detail-title">
            {mod.title}
          </h2>
          <p className="home-detail-tagline">{mod.tagline}</p>
          <p className="home-detail-blurb">{mod.blurb}</p>

          <ul className="home-detail-features">
            {mod.features.map((feature) => (
              <li key={feature}>
                <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {isActive ? (
            <button
              type="button"
              className="home-detail-cta"
              onClick={handleEnter}
            >
              Entrar a {mod.title.toLowerCase()}
              <ArrowRight size={16} strokeWidth={2.2} />
            </button>
          ) : (
            <div className="home-detail-soon">
              <span className="home-detail-soon-badge">Próximamente</span>
              <span>Este módulo está en desarrollo.</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
