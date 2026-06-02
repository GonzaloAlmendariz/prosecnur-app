import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

// Drawer lateral derecho con el historial de release notes. Reemplaza al
// panel inline anterior — el handoff del diseño lo movió a un drawer
// porque el listado completo no debería ocupar espacio en el flujo del
// Home cuando el usuario no lo está mirando.
//
// Animación: slide-in desde la derecha (transform: translateX) +
// backdrop semi-transparente. Escape cierra. Click en el backdrop cierra.

export type ReleaseNote = {
  version: string;
  date: string;
  highlights: string[];
};

export type ReleaseNotesDrawerProps = {
  open: boolean;
  notes: ReleaseNote[];
  onClose: () => void;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-PE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ReleaseNotesDrawer({
  open,
  notes,
  onClose,
}: ReleaseNotesDrawerProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="home-drawer-backdrop is-open"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="home-drawer is-open"
        role="dialog"
        aria-label="Notas de versión"
      >
        <div className="home-drawer-head">
          <div>
            <span className="home-drawer-eyebrow">Historial</span>
            <h3 className="home-drawer-title">Notas de versión</h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="home-drawer-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="home-drawer-body">
          {notes.map((note, idx) => (
            <section
              key={note.version}
              className={`home-release ${idx === 0 ? "is-latest" : ""}`}
            >
              <header className="home-release-head">
                <span className="home-release-pill">v{note.version}</span>
                <span className="home-release-date">{formatDate(note.date)}</span>
                {idx === 0 && <span className="home-release-now">Actual</span>}
              </header>
              <ul className="home-release-notes">
                {note.highlights.map((h, i) => (
                  <li key={i}>
                    <Check size={13} />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
