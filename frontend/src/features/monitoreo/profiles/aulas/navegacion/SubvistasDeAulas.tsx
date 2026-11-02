import { subvistasDePestana, type DireccionAulas } from "./direccionAulas";
// El selector es el común de Monitoreo (L14): el mismo control en todos los modos.
import { SelectorDeSubvistas } from "../../../core/selectorDeSubvistas/SelectorDeSubvistas";

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
  return (
    <SelectorDeSubvistas
      opciones={opciones.map((item) => ({ clave: item.panel ?? "principal", etiqueta: item.etiqueta, valor: item.panel ?? null }))}
      esActiva={(panel) => panel === (direccion.panel ?? null)}
      onElegir={onElegir}
    />
  );
}
