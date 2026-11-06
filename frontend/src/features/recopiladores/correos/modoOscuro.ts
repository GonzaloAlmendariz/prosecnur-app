// =============================================================================
// modoOscuro.ts — la vista «Modo oscuro» del editor como la pinta Gmail en el
// teléfono (loop editor de correos, L21)
// =============================================================================
// Antes se oscurecían tres blancos fijos y se forzaba todo el texto a claro: un
// tinte claro (#ebf1f8, la tarjeta del sorteo de Acreditación 2026) quedaba
// claro con su texto claro encima, y los enlaces seguían en el acento sobre el
// fondo oscuro (2,3:1). Ningún cliente hace esa mezcla. Aquí se decide por
// luminancia: todo fondo claro pasa a la paleta oscura, y el texto o el enlace
// que sobre su fondo nuevo no se lee se aclara. Los colores de marca (el
// acento de una franja, el botón) y las imágenes no se tocan. Sólo la vista:
// el HTML que se exporta no cambia.

import type { PaletaOscura } from "./modeloCorreo";

export type Rgb = { r: number; g: number; b: number; a: number };

/** Fondo a partir del cual el cliente lo trata como «claro» y lo oscurece. */
export const UMBRAL_FONDO_CLARO = 0.7;
/** Fondo que, ya oscuro, pide texto claro. */
export const UMBRAL_FONDO_OSCURO = 0.3;
export const CONTRASTE_LEGIBLE = 4.5;

export function leerColor(valor: string | null | undefined): Rgb | null {
  const m = (valor ?? "").match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  const h = (valor ?? "").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!h) return null;
  const x = h[1].length === 3 ? h[1].split("").map((c) => c + c).join("") : h[1];
  return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: 1 };
}

/** Luminancia relativa WCAG (0 negro, 1 blanco). */
export function luminancia({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contraste(a: Rgb, b: Rgb): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** ¿El cliente oscurece este fondo? Sólo los claros y opacos; el acento y el botón quedan. */
export function oscureceElFondo(fondo: Rgb | null): boolean {
  return !!fondo && fondo.a > 0.5 && luminancia(fondo) > UMBRAL_FONDO_CLARO;
}

/** Mezcla con blanco: el enlace conserva su tono pero se lee sobre lo oscuro. */
export function aclarar(c: Rgb, cuanto = 0.6): string {
  const m = (v: number) => Math.round(v + (255 - v) * cuanto);
  return `rgb(${m(c.r)}, ${m(c.g)}, ${m(c.b)})`;
}

/** Un color con tono (el acento de un título o un enlace), no un gris. */
export function tieneTono({ r, g, b }: Rgb): boolean {
  return Math.max(r, g, b) - Math.min(r, g, b) > 40;
}

/**
 * El color nuevo de un texto sobre su fondo ya transformado, o `null` si se
 * deja: sólo cambia cuando el fondo quedó oscuro y el texto no se lee. Un
 * enlace o un texto con tono se aclara en su propio color (el título del sorteo
 * sigue azul); un gris pasa a la tinta clara.
 */
export function colorDelTextoEnOscuro(texto: Rgb | null, fondo: Rgb | null, esEnlace: boolean, tinta: string): string | null {
  if (!texto || !fondo || luminancia(fondo) >= UMBRAL_FONDO_OSCURO) return null;
  if (contraste(texto, fondo) >= CONTRASTE_LEGIBLE) return null;
  return esEnlace || tieneTono(texto) ? aclarar(texto) : tinta;
}

function fondoEfectivo(el: Element | null, vista: Window): Rgb | null {
  for (let n = el; n; n = n.parentElement) {
    const c = leerColor(vista.getComputedStyle(n).backgroundColor);
    if (c && c.a > 0.5) return c;
  }
  return null;
}

function tieneTextoPropio(el: Element): boolean {
  return Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
}

/** Aplica el modo oscuro al documento del iframe. Primero los fondos, después el texto. */
export function aplicarModoOscuro(doc: Document, paleta: PaletaOscura): void {
  const vista = doc.defaultView;
  if (!vista || !doc.body) return;
  const todos = [doc.body, ...Array.from(doc.body.querySelectorAll("*"))];
  for (const el of todos) {
    if (el instanceof vista.HTMLImageElement) continue;
    const cs = vista.getComputedStyle(el);
    if (oscureceElFondo(leerColor(cs.backgroundColor))) {
      (el as HTMLElement).style.setProperty("background-color", paleta.papel, "important");
    }
    // Un borde claro (los filetes #d6d6d6 de la hoja) brillaría sobre lo oscuro.
    for (const lado of ["top", "right", "bottom", "left"] as const) {
      const color = leerColor(cs.getPropertyValue(`border-${lado}-color`));
      if (parseFloat(cs.getPropertyValue(`border-${lado}-width`)) > 0 && color && luminancia(color) > UMBRAL_FONDO_CLARO) {
        (el as HTMLElement).style.setProperty(`border-${lado}-color`, paleta.suave, "important");
      }
    }
  }
  for (const el of todos) {
    if (!tieneTextoPropio(el)) continue;
    const esEnlace = el.closest("a") !== null;
    const nuevo = colorDelTextoEnOscuro(leerColor(vista.getComputedStyle(el).color), fondoEfectivo(el, vista), esEnlace, paleta.tinta);
    if (nuevo) (el as HTMLElement).style.setProperty("color", nuevo, "important");
  }
}
