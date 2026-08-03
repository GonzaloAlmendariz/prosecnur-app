/**
 * Disclosure para configuración genuinamente secundaria.
 *
 * F103 · Este comentario decía «sin esconder nada — un clic y está todo». Un
 * clic **es** esconder: describe el coste, no lo elimina. La frase venía
 * justificando dos usos que no le correspondían — la semilla y los pesos del
 * objetivo, que determinan la muestra, y un historial cuya propia etiqueta pide
 * «elige dos para compararlas»—. Ambos abren por defecto desde F103.
 *
 * Criterio para usarlo: se pliega lo que **no** es el trabajo ni la evidencia
 * con la que se decide. Renombrar hojas de salida, sí. Nada que entre en la
 * cadena que hace defendible la selección.
 */
import type { ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import "./ui.css";

export function PanelAvanzado({
  titulo,
  descripcion,
  children,
  defaultOpen = false,
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="cmv2-uni-avanzado" open={defaultOpen || undefined}>
      <summary>
        <SlidersHorizontal size={13} aria-hidden="true" />
        {titulo}
        {descripcion && <span className="cmv2-uni-avanzado-desc">{descripcion}</span>}
        <ChevronDown size={14} className="cmv2-uni-avanzado-chevron" aria-hidden="true" />
      </summary>
      <div className="cmv2-uni-avanzado-body">{children}</div>
    </details>
  );
}
