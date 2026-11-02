import type { SeccionTelefonica, VistaInterna } from "./direccionTelefonica";
import { subvistasDePestana } from "./direccionTelefonica";
import { SelectorDeSubvistas } from "../../../core/selectorDeSubvistas/SelectorDeSubvistas";

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
  return (
    <SelectorDeSubvistas
      opciones={opciones.map((item) => ({ clave: item.panel ?? "principal", etiqueta: item.etiqueta, valor: item.interna }))}
      esActiva={(vista) => vista.seccion === activa.seccion && vista.pestana === activa.pestana}
      onElegir={onElegir}
    />
  );
}
