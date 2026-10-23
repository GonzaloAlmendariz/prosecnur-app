import type { SeccionTelefonica, VistaInterna } from "./direccionTelefonica";
import { subvistasDePestana } from "./direccionTelefonica";

/**
 * Selector de las vistas que una pestaña absorbe mientras no tiene contenido
 * propio (Respuestas: Efectivas, Tiempos y Salvedades; Cuotas y calendario:
 * Cuotas y Calendario). Cada una tiene dirección (`panel`), así que el
 * selector no es una navegación aparte: escribe la misma URL que un enlace.
 *
 * `disponible` deja fuera las que este proyecto no tiene (Salvedades sólo
 * existe cuando hay efectivas no identificables): una opción que no lleva a
 * nada no se ofrece.
 */
export function SubvistasDePestana({
  seccion,
  pestana,
  activa,
  disponible,
  onElegir,
}: {
  seccion: SeccionTelefonica;
  pestana: string;
  activa: { seccion: string; pestana: string };
  disponible: (vista: VistaInterna) => boolean;
  onElegir: (vista: VistaInterna) => void;
}) {
  const opciones = subvistasDePestana(seccion, pestana).filter((item) => disponible(item.interna));
  if (opciones.length < 2) return null;
  return (
    <div className="mon-tel-subvistas" role="group" aria-label="Vista de la pestaña">
      {opciones.map((item) => {
        const elegida = item.interna.seccion === activa.seccion && item.interna.pestana === activa.pestana;
        return (
          <button
            key={item.panel ?? "principal"}
            type="button"
            className={`mon-tel-subvista${elegida ? " is-active" : ""}`}
            aria-pressed={elegida}
            data-subvista={item.panel ?? "principal"}
            onClick={() => {
              if (!elegida) onElegir(item.interna);
            }}
          >
            {item.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
