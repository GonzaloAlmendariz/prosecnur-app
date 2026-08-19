import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Las columnas de «A quién hay que agendar» tienen que alinearse entre filas.
 *
 * En esa lista **cada `li` es su propia grilla**, no hay una grilla común: las
 * columnas sólo coinciden si todas las filas resuelven el mismo reparto. Con la
 * última pista en `auto` cada fila se dimensionaba con SU texto, y al pasar la
 * columna «Cuándo» de una palabra fija a una fecha por facultad, la columna
 * «Pedir» quedó empezando en cuatro x distintas —736, 727, 756 y 703 px—: los
 * números dejaron de estar bajo su cabecera.
 *
 * El defecto era invisible mientras todas las filas decían lo mismo, que es
 * justo lo que hacía la versión anterior del detector. Por eso el guard mira la
 * CAUSA en la hoja y no el efecto: en jsdom no hay layout que medir.
 */

const css = readFileSync(
  fileURLToPath(new URL("./aulasMonitoreo.css", import.meta.url)),
  "utf-8",
);

describe("la lista de anticipación alinea sus columnas", () => {
  const regla = css.match(
    /\.aulas-anticipacion-lista li \{[^}]*grid-template-columns:([^;]+);/,
  );

  it("declara su reparto de columnas", () => {
    expect(regla).not.toBeNull();
  });

  it("ninguna pista se dimensiona con el contenido de su propia fila", () => {
    const pistas = regla![1].trim().split(/\s+(?![^(]*\))/);
    // `minmax(0, 1fr)` en el nombre sí es común a todas las filas: reparte el
    // sobrante, no mide el texto. Lo que rompe es `auto`, `min-content`,
    // `max-content` y `fit-content`.
    const culpables = pistas.filter((p) => /^(auto|min-content|max-content|fit-content)/.test(p));
    expect(culpables).toEqual([]);
  });

  it("la columna «Cuándo» cabe una fecha sin recortarla", () => {
    const pistas = regla![1].trim().split(/\s+(?![^(]*\))/);
    const ultima = Number.parseFloat(pistas[pistas.length - 1]);
    // «antes del 21/08» a 11.5px mide ~84px. Menos que eso recorta la fecha,
    // que es dato operativo y no etiqueta: C4 no admite elipsis ahí.
    expect(ultima).toBeGreaterThanOrEqual(88);
  });
});
