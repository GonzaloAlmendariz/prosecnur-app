// ADR 0104 (P22): Carga › Equivalencias se maneja entera en la app, por la persona.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function sinComentarios(nombre: string): string {
  return fs.readFileSync(fileURLToPath(new URL(nombre, import.meta.url)), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("la pestaña ya no ofrece plantilla, subida ni emparejado automático (ADR 0104)", () => {
  // La pestaña es el panel (esqueleto y paneles) más la mesa que monta (pestanas/equivalencias).
  const panel = sinComentarios("./EquivalenciasPanel.tsx") + sinComentarios("./pestanas/equivalencias/MesaDeEquivalencias.tsx");
  const bloques = sinComentarios("./ImportarBloquesDialog.tsx");

  it('sin "Generar plantilla", "Subir matriz" ni "Proponer emparejados", ni confirmación en bloque', () => {
    for (const quitado of ["Generar plantilla", "Descargar plantilla", "Subir matriz", "Proponer emparejados", "propuestas", "Sparkles", "apiUpload"]) {
      expect(panel).not.toContain(quitado);
    }
    expect(panel).toContain("Añadir pregunta equivalente");
    expect(panel).toContain("ImportarBloquesBoton");
  });

  it('"Importar por bloques" se presenta sólo como vía de series de mediciones', () => {
    expect(bloques).toContain("Traer una serie de mediciones ya armada");
    expect(bloques).not.toContain("Subir matriz");
  });
});
