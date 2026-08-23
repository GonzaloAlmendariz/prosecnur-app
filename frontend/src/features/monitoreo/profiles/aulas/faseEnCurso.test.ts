// Patrón 3 del catálogo: el recorrido de Cálculo marca con un badge en qué paso
// estás. Las cuatro tarjetas de «Preparación de campo» eran una rejilla al mismo
// nivel —tenían tono `current` y nadie lo leía como «aquí»—.
//
// La regla vive en el render y se lee del fuente, como `COLUMNAS_DE_PORCENTAJE`,
// para no abrir superficie pública sólo por un test.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fuente = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "AulasMonitoreoPage.tsx"),
  "utf8",
);

describe("la preparación de campo dice en qué paso está", () => {
  it("la fase en curso es la primera que no está lista", () => {
    expect(fuente).toContain('cards.findIndex((c) => c.tone !== "ready") === i');
  });

  it("el badge lo dice con palabras, no sólo con un tono", () => {
    expect(fuente).toContain("Estás aquí");
    expect(fuente).toContain('data-fase={enCurso ? "actual" : undefined}');
  });

  it("con todo listo no se marca ninguna", () => {
    // `findIndex` devuelve -1 y ningún índice coincide: el operativo ya pasó la
    // preparación y señalar una fase inventaría trabajo pendiente.
    expect(fuente).toContain("cards.findIndex");
  });

  it("el badge no entra en el flujo de la tarjeta", () => {
    // El grupo declara contrato `equal`: un renglón de más en una sola tarjeta
    // rompería el alto común de las cuatro, y el `article` es un grid con áreas
    // nombradas donde un hijo sin área descolocaría el resto.
    const css = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "aulasMonitoreo.css"),
      "utf8",
    );
    const regla = (css.match(/\.mon-aulas-fase-aqui \{[\s\S]*?\}/) ?? [])[0] ?? "";
    expect(regla).toContain("position: absolute");
  });
});
