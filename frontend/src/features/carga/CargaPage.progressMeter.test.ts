import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  fileURLToPath(new URL("./CargaPage.tsx", import.meta.url)),
  "utf8",
);

function functionBlock(name: string): string {
  const start = source.indexOf(`function ${name}(`);
  expect(start, `No se encontró ${name}`).toBeGreaterThan(-1);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

describe("medidor de preparación de Carga", () => {
  it("vive solo en el resumen persistente de la toolbar", () => {
    const owners = ["CargaCommandSummary", "CargaSuiteBar"].filter((name) =>
      functionBlock(name).includes("<CargaProgressMeter"),
    );

    expect(owners).toEqual(["CargaCommandSummary"]);
  });
});
