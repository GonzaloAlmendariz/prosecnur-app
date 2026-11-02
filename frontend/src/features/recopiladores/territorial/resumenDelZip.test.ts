import { describe, expect, test } from "vitest";
import { resumenDelZip } from "./resumenDelZip";

describe("la línea del ZIP del paquete (P9 de la paridad)", () => {
  test("dice hojas de zona, reemplazos y la versión del marco", () => {
    expect(resumenDelZip({ n_pdfs: 300, n_zone_pdfs: 282, n_replacement_blocks: 150, total_entrevistas: 1200, frame_version: "inei2017-lima-callao-manzanas-full-v1" }, "12 MB")).toBe(
      "300 PDF · 282 hojas de zona · 150 reemplazos · 1,200 entrevistas · marco inei2017-lima-callao-manzanas-full-v1 · 12 MB",
    );
  });
  test("un job sin esos datos no inventa nada", () => {
    expect(resumenDelZip({ n_pdfs: 2, total_entrevistas: 10, frame_version: "" }, "1 MB")).toBe("2 PDF · 10 entrevistas · 1 MB");
    expect(resumenDelZip({ n_pdfs: 2, n_zone_pdfs: 1, total_entrevistas: 10, frame_version: "NA" }, "1 MB")).toBe("2 PDF · 1 hoja de zona · 10 entrevistas · 1 MB");
  });
});
