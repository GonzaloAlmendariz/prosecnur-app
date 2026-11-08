// Ronda 5: «después de ésta» va sin tilde (el demostrativo ya no la lleva): «Insertar una lámina nueva después de esta».
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fuente = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "VisorLamina.tsx"), "utf8");

describe("rótulos del visor", () => {
  it("el demostrativo va sin tilde", () => {
    expect(fuente).toContain('ayuda="Insertar una lámina nueva después de esta"');
    expect(fuente).not.toMatch(/(?<!\p{L})(ésta|éste|éstas|éstos)(?!\p{L})/u);
  });
});
