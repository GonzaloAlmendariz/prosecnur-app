import { describe, expect, test } from "vitest";
import type { XlsformEditorSheet } from "../types";
import { parseBuilderStructure } from "./buildIndex";

describe("parseBuilderStructure", () => {
  test("preserva constraint_message en el nodo visual", () => {
    const survey: XlsformEditorSheet = {
      name: "survey",
      columns: ["type", "name", "label", "constraint", "constraint_message"],
      rows: [[
        "text",
        "correo",
        "Correo electrónico",
        "regex(., '^[^@\\\\s]+@[^@\\\\s]+\\\\.[^@\\\\s]+$')",
        "Ingresa un correo electrónico válido.",
      ]],
    };

    const structure = parseBuilderStructure(survey);

    expect(structure.outline[0]?.constraint).toContain("regex(");
    expect(structure.outline[0]?.constraint_message).toBe("Ingresa un correo electrónico válido.");
  });

  test("preserva multimedia de consigna en el nodo visual", () => {
    const survey: XlsformEditorSheet = {
      name: "survey",
      columns: ["type", "name", "label", "media::image", "media::audio", "media::video"],
      rows: [[
        "note",
        "ayuda_foto",
        "Revisa esta referencia antes de responder.",
        "referencia.png",
        "instruccion.mp3",
        "demo.mp4",
      ]],
    };

    const structure = parseBuilderStructure(survey);

    expect(structure.outline[0]?.mediaImage).toBe("referencia.png");
    expect(structure.outline[0]?.mediaAudio).toBe("instruccion.mp3");
    expect(structure.outline[0]?.mediaVideo).toBe("demo.mp4");
  });
});
