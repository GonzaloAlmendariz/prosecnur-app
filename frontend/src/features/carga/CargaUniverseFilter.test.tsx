import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  fileURLToPath(new URL("./CargaUniverseFilter.tsx", import.meta.url)),
  "utf8",
);

describe("mensaje legacy del filtro de universo", () => {
  it("explica una base no registrada sin afirmar que faltan respuestas", () => {
    expect(source).toMatch(/E_UNIVERSE_FILTER_BASE[\s\S]*?setSinBase\(true\)/u);

    const start = source.indexOf("sinBase && !state");
    const end = source.indexOf(": error && !state", start);
    expect(start, "No se encontró el estado sin base").toBeGreaterThan(-1);
    expect(end, "No se encontró el límite del estado sin base").toBeGreaterThan(start);

    const messageBranch = source.slice(start, end);
    expect(messageBranch).toMatch(/(?:base|proyecto)[\s\S]*?registrad/iu);
    expect(messageBranch).not.toMatch(/respuestas/iu);
  });
});
