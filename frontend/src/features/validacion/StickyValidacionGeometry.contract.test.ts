import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// El encabezado de sección de Validación y las bandas sticky de cada pestaña
// viven en el MISMO contenedor de scroll (`.pulso-validacion-content`). Si las
// dos pegan en `top: 0`, la de la pestaña gana por z-index y tapa el
// encabezado al hacer scroll: se pierde de vista en qué pestaña estás.
//
// La altura del head y el offset de las bandas salen de la misma variable
// justamente para que no puedan divergir cuando alguien cambie el padding del
// encabezado.

const aqui = path.dirname(fileURLToPath(import.meta.url));
const theme = fs.readFileSync(path.join(aqui, "../../app/theme.css"), "utf8");
const limpieza = fs.readFileSync(path.join(aqui, "tabs/LimpiezaTab.tsx"), "utf8");

function bloque(selector: string): string {
  const i = theme.indexOf(selector + " {");
  if (i < 0) return "";
  return theme.slice(i, theme.indexOf("}", i));
}

describe("Validación: el sticky de la pestaña no tapa el encabezado", () => {
  test("el scroller declara la altura del head y el offset derivado de ella", () => {
    const scroller = bloque(".pulso-validacion-content");
    expect(scroller).toMatch(/--pulso-validacion-head-h:\s*48px/);
    expect(scroller).toMatch(
      /--pulso-validacion-sticky-top:\s*var\(--pulso-validacion-head-h\)/,
    );
  });

  test("el encabezado toma su altura de la misma variable", () => {
    // El control: si el head volviera a un `min-height` literal, podría crecer
    // sin que el offset lo siga y el solapamiento reaparecería en silencio.
    expect(bloque(".pulso-validacion-panel-head")).toMatch(
      /min-height:\s*var\(--pulso-validacion-head-h/,
    );
  });

  test("la banda de la pestaña se pega debajo, no en cero", () => {
    expect(limpieza).toContain('top: "var(--pulso-validacion-sticky-top, 0px)"');
    // La forma vieja, que es la que producía el solapamiento.
    expect(limpieza).not.toMatch(/position: "sticky",\s*\n\s*top: 0,/);
  });

  test("donde el encabezado deja de ser sticky, el offset vuelve a cero", () => {
    // A ≤900px el head pasa a `static`: si el offset siguiera en 48px, la
    // banda quedaría flotando con un hueco encima.
    //
    // Se busca desde la regla hacia atrás y no por el nombre del media query:
    // `@media (max-width: 900px)` aparece más de una vez en theme.css y el
    // primero no es el que contiene esta regla.
    const regla = theme.search(
      /\.pulso-validacion-panel-head\s*\{[^}]*position:\s*static/,
    );
    expect(regla).toBeGreaterThan(-1);
    const aperturaMedia = theme.lastIndexOf("@media", regla);
    expect(aperturaMedia).toBeGreaterThan(-1);
    const cierreMedia = theme.indexOf("@media", regla);
    const bloque = theme.slice(
      aperturaMedia,
      cierreMedia > 0 ? cierreMedia : theme.length,
    );
    expect(bloque).toMatch(/--pulso-validacion-sticky-top:\s*0px/);
  });
});
