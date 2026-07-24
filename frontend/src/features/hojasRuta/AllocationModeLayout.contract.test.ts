import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas allocation-mode layout", () => {
  test("stacks each card label above its description without breaking words", () => {
    const css = fs.readFileSync(path.join(__dirname, "hojasRuta.css"), "utf8");
    const buttonRule = css.match(/\.hojas-ruta-allocation-cards button\s*\{([^}]*)\}/)?.[1] ?? "";
    const titleRule = css.match(/\.hojas-ruta-allocation-cards strong\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(buttonRule).toContain("display: grid");
    expect(buttonRule).toContain("align-content: center");
    expect(titleRule).toContain("overflow-wrap: normal");
    expect(titleRule).not.toContain("overflow-wrap: anywhere");
  });
});
