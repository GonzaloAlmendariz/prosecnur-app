import { useEffect } from "react";

export type CreditsDrawerProps = {
  open: boolean;
  pulsoName: string;
  onClose: () => void;
};

export function CreditsDrawer({ open, pulsoName, onClose }: CreditsDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`home-drawer-backdrop ${open ? "is-open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`home-drawer ${open ? "is-open" : ""}`}
        role="dialog"
        aria-label="Créditos de Prosecnur"
        aria-hidden={!open}
      >
        <div className="home-drawer-head">
          <div>
            <span className="home-drawer-eyebrow">Proyecto</span>
            <h3 className="home-drawer-title">Créditos</h3>
          </div>
          <button
            type="button"
            className="home-drawer-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="home-drawer-body home-credits-body">
          <section className="home-credit-section">
            <span className="home-credit-label">Para quién fue hecho</span>
            <p>
              Prosecnur fue construido para el {pulsoName}, como una herramienta
              de trabajo para estudios con cuestionarios, bases, validación,
              codificación, muestreo y reportes.
            </p>
          </section>

          <section className="home-credit-section">
            <span className="home-credit-label">Cómo nació</span>
            <p>
              El proyecto empezó como una forma de ordenar tareas repetitivas
              del flujo de investigación aplicada: revisar instrumentos,
              normalizar datos, documentar decisiones y convertir análisis en
              entregables claros. Con el tiempo fue creciendo hasta convertirse
              en una suite interna, pensada para cuidar tanto la rigurosidad
              metodológica como el ritmo real del trabajo de campo y gabinete.
            </p>
          </section>

          <section className="home-credit-section">
            <span className="home-credit-label">Construcción</span>
            <p>
              Gonzalo Almendáriz viene diseñando y desarrollando Prosecnur en
              diálogo con las necesidades cotidianas del equipo. La intención es
              sencilla: que más tiempo y atención puedan volver a lo importante,
              entender mejor la evidencia y comunicarla con cuidado.
            </p>
          </section>
        </div>
      </aside>
    </>
  );
}
