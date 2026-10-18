// Fantasma del arrastre en la Estructura (C2, 2026-10-17): una copia de la fila que se levanta (sombra y escala
// 1,015, sin giro), sigue al puntero y al soltar se asienta en el hueco antes de desaparecer. Imperativo a
// propósito: moverlo en cada `pointermove` no debe repintar la lista con React.
//
// Va DENTRO del marco del editor (los tokens del perfil siguen llegando). Si un ancestro crea su propio bloque
// contenedor de `position: fixed`, la corrección se mide al montar.

import { FLIP_EASING, movimientoReducido } from "./useFlip";

export const ASENTAR_MS = 220;

export type Fantasma = {
  mover: (x: number, y: number) => void;
  asentar: (destino: DOMRect | null, alTerminar: () => void) => void;
  quitar: () => void;
};

export function crearFantasma(fila: HTMLElement, destino: HTMLElement, punto: { x: number; y: number }): Fantasma {
  const rect = fila.getBoundingClientRect();
  const offX = punto.x - rect.left;
  const offY = punto.y - rect.top;
  const el = document.createElement("div");
  el.className = "xfe-fantasma";
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("inert", "");
  el.style.width = `${rect.width}px`;
  const copia = fila.cloneNode(true) as HTMLElement;
  copia.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  copia.style.transform = "none";
  el.appendChild(copia);
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  destino.appendChild(el);
  const medido = el.getBoundingClientRect();
  const dx = rect.left - medido.left;
  const dy = rect.top - medido.top;
  let x = rect.left;
  let y = rect.top;
  const colocar = () => {
    el.style.left = `${x + dx}px`;
    el.style.top = `${y + dy}px`;
  };
  colocar();
  // Se levanta en el cuadro siguiente para que la transición de escala y sombra se vea.
  requestAnimationFrame(() => el.classList.add("is-alzado"));

  return {
    mover(px, py) {
      x = px - offX;
      y = py - offY;
      colocar();
    },
    asentar(hueco, alTerminar) {
      if (!hueco || movimientoReducido() || typeof el.animate !== "function") {
        alTerminar();
        return;
      }
      el.classList.remove("is-alzado");
      el.classList.add("is-asentando");
      const anim = el.animate(
        [
          { transform: `translate(0, 0) scale(1.015)` },
          { transform: `translate(${hueco.left - x}px, ${hueco.top - y}px) scale(1)` },
        ],
        { duration: ASENTAR_MS, easing: FLIP_EASING, fill: "forwards" },
      );
      anim.onfinish = () => alTerminar();
      anim.oncancel = () => alTerminar();
    },
    quitar() {
      el.remove();
    },
  };
}
