import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Cinco tablas de este perfil cortaban con `.slice(0, N)` bajo un encabezado que
// declaraba el TOTAL —«N registros locales», «N casos», «N distritos»— y no lo
// avisaban en ninguna parte. Quien contara las filas veía 40 donde el título
// prometía cientos, sin saber si faltaban o si el dato era ése.
//
// Los otros perfiles ya lo declaran: acreditación dice «Mostrando 160 de 488
// registros». La regla de la casa es que un corte de cobertura se dice.

const fuente = fs.readFileSync(
  path.resolve(__dirname, "TerritorialMonitoreoPage.tsx"),
  "utf8",
);

/** Cada `rows={X.slice(0, N)}` con el nombre de su colección y su tope. */
const cortes = [...fuente.matchAll(/rows=\{(\w+)\.slice\(0,\s*(\d+)\)\}/g)]
  .map((m) => ({ coleccion: m[1], tope: m[2] }));

describe("ningún corte de tabla es silencioso", () => {
  it("se encontraron los cortes", () => {
    // Si el markup cambia y la lista queda vacía, el test de abajo pasaría sin
    // comprobar nada.
    expect(cortes.length).toBeGreaterThanOrEqual(4);
  });

  it.each(cortes)("$coleccion cortada en $tope lo declara", ({ coleccion, tope }) => {
    const aviso = new RegExp(
      `<TerritorialRecorte visibles=\\{Math\\.min\\(${tope}, ${coleccion}\\.length\\)\\} total=\\{${coleccion}\\.length\\}`,
    );
    expect(fuente).toMatch(aviso);
  });

  it("el aviso calla cuando no hay recorte", () => {
    // Un «Mostrando 12 de 12» sería ruido: sólo aparece si de verdad falta algo.
    const cuerpo = fuente.slice(fuente.indexOf("function TerritorialRecorte"));
    expect(cuerpo.slice(0, 400)).toContain("if (total <= visibles) return null;");
  });
});
