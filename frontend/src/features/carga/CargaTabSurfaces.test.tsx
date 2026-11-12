import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSibling(name: string) {
  const file = fileURLToPath(new URL(name, import.meta.url));
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

const revisionPestana = readSibling("./pestanas/PestanaRevision.tsx");
const hojaBase = readSibling("./pestanas/HojaBaseCarga.tsx");
const mesaDeRevision = readSibling("./pestanas/revision/MesaDeRevision.tsx");

describe("superficies conceptuales de Carga", () => {
  it("usa en Revisión la mesa de comprobaciones en lugar del tablero completo de Plan", () => {
    // P4b R4: Revisión es la mesa del prototipo (comprobaciones, detalle y decisión).
    expect(revisionPestana.includes('from "./revision/MesaDeRevision"')).toBe(true);
    expect(revisionPestana.includes("<MesaDeRevision")).toBe(true);
    expect(mesaDeRevision.includes('data-carga-surface="review"')).toBe(true);
    expect(mesaDeRevision.includes("CargaReadinessBoard")).toBe(false);
  });

  it("omite el selector redundante con una base y lo conserva con varias", () => {
    expect(
      /baseOptions\.length\s*>\s*1\s*&&\s*\([\s\S]{0,500}?pulso-carga-base-picker/u.test(
        hojaBase,
      ),
    ).toBe(true);
  });
});
