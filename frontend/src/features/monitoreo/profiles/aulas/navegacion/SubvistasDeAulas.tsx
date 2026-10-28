import { subvistasDePestana, type DireccionAulas } from "./direccionAulas";
// Las clases del selector (`mon-tel-subvistas`, `mon-tel-subvista`) son el
// lenguaje común que estrenó Telefónico y ya usa Territorial; se usan tal cual
// para que los modos no diverjan.
import "../../telefonico/navegacion/chromeTelefonico.css";

/**
 * Selector de las vistas que una pestaña absorbe mientras no tiene contenido
 * propio (Control › Calidad: Controles, Base de control y Respuestas
 * abiertas). Cada una tiene dirección (`panel`), así que el selector no es una
 * navegación aparte: escribe la misma URL que un enlace. Sin sub-vistas no
 * pinta nada.
 */
export function SubvistasDeAulas({
  direccion,
  onElegir,
}: {
  direccion: DireccionAulas;
  onElegir: (panel: string | null) => void;
}) {
  const opciones = subvistasDePestana(direccion.seccion, direccion.pestana);
  if (opciones.length < 2) return null;
  return (
    <div className="mon-tel-subvistas" role="group" aria-label="Vista de la pestaña">
      {opciones.map((item) => {
        const elegida = (item.panel ?? null) === (direccion.panel ?? null);
        return (
          <button
            key={item.panel ?? "principal"}
            type="button"
            className={`mon-tel-subvista${elegida ? " is-active" : ""}`}
            aria-pressed={elegida}
            data-subvista={item.panel ?? "principal"}
            onClick={() => {
              if (!elegida) onElegir(item.panel);
            }}
          >
            {item.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
