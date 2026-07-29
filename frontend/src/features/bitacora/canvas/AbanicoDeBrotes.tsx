import { ChevronRight } from "../../../vendor/lucide-react";

import { identidadDeDestino } from "../identidadDeFase";
import { ALTO_BROTE, type Brote } from "./brotes";
import { ANCHO_NODO } from "./ramificacion";

/**
 * Abanico de ramas de un cuadro (ADR 0047).
 *
 * Sale del costado derecho del nodo —hacia donde crece la jerarquía en este
 * lienzo— y se despliega escalonado: cada brote entra 28 ms después del
 * anterior, así el ojo sigue el orden en que están y no ve seis cosas
 * apareciendo de golpe.
 *
 * Cada brote se dibuja EXACTAMENTE donde nacerá su nodo. Eso es lo que hace que
 * elegirlo se lea como que el brote se convierte en tarjeta, en vez de como que
 * una tarjeta aparece en otro lado.
 *
 * Vive dentro del mundo transformado, así que la cámara lo mueve y lo escala
 * con el resto del mapa sin cálculo extra.
 */
export function AbanicoDeBrotes({
  brotes,
  onElegir,
  onCerrar,
}: {
  brotes: Brote[];
  onElegir: (brote: Brote) => void;
  onCerrar: () => void;
}) {
  if (!brotes.length) return null;

  return (
    <div className="bcanvas-abanico" role="menu" aria-label="Ramas de este cuadro">
      {brotes.map((brote, i) => {
        const identidad = identidadDeDestino(brote.clave);
        const Icono = identidad.icono;
        return (
          <button
            key={brote.clave}
            type="button"
            role="menuitem"
            className="bcanvas-brote"
            style={{
              translate: `${brote.x}px ${brote.y}px`,
              width: ANCHO_NODO,
              height: ALTO_BROTE,
              // El escalonado va en una custom property y no en `animation-delay`
              // suelto para que la regla de movimiento reducido pueda anularlo
              // entero desde el CSS.
              ["--brote-retraso" as string]: `${i * 28}ms`,
              ...(identidad.vars ?? {}),
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onElegir(brote)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Escape") onCerrar();
            }}
          >
            <span className="bcanvas-brote-sello" aria-hidden="true">
              {Icono ? <Icono size={12} /> : null}
            </span>
            <span className="bcanvas-brote-label">{brote.label}</span>
            <ChevronRight size={12} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
