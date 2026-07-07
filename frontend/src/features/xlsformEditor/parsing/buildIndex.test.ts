import { describe, expect, test } from "vitest";
import type { XlsformEditorSheet, XlsformEditorWorkbook } from "../types";
import { buildXlsformIndex, parseBuilderStructure } from "./buildIndex";

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

  test("distingue una sección vacía de las preguntas que quedan fuera del cierre", () => {
    const survey: XlsformEditorSheet = {
      name: "survey",
      columns: ["type", "name", "label"],
      rows: [
        ["begin_group", "hogar", "Datos del hogar"],
        ["end_group", "", ""],
        ["text", "nombre", "Nombre"],
      ],
    };

    const structure = parseBuilderStructure(survey);
    const section = structure.sections.get("section-0");

    expect(section?.itemCount).toBe(0);
    expect(section?.endRowIndex).toBe(1);
    expect(structure.outline.find((node) => node.name === "nombre")?.sectionId).toBe("root");
  });

  test("cuenta preguntas dentro cuando el cierre de sección queda después de ellas", () => {
    const survey: XlsformEditorSheet = {
      name: "survey",
      columns: ["type", "name", "label"],
      rows: [
        ["begin_group", "hogar", "Datos del hogar"],
        ["text", "nombre", "Nombre"],
        ["integer", "edad", "Edad"],
        ["end_group", "", ""],
      ],
    };

    const structure = parseBuilderStructure(survey);
    const section = structure.sections.get("section-0");

    expect(section?.itemCount).toBe(2);
    expect(section?.endRowIndex).toBe(3);
    expect(structure.outline.find((node) => node.name === "nombre")?.sectionId).toBe("section-0");
    expect(structure.outline.find((node) => node.name === "edad")?.sectionId).toBe("section-0");
  });
});

describe("buildXlsformIndex", () => {
  test("expone catálogos vacíos referenciados por preguntas de selección", () => {
    const workbook: XlsformEditorWorkbook = {
      survey: {
        name: "survey",
        columns: ["type", "name", "label"],
        rows: [["select_one lista_vacia", "pregunta_1", "Pregunta"]],
      },
      choices: {
        name: "choices",
        columns: ["list_name", "name", "label"],
        rows: [],
      },
      settings: {
        name: "settings",
        columns: ["form_title", "form_id", "version", "default_language"],
        rows: [["Demo", "demo", "1", "es"]],
      },
    };

    const index = buildXlsformIndex(workbook);

    expect(index.catalogs).toEqual([
      {
        listName: "lista_vacia",
        title: "lista_vacia",
        items: [],
      },
    ]);
    expect(index.catalogsByName.get("lista_vacia")?.items).toEqual([]);
    expect(index.questionsByCatalog.get("lista_vacia")?.[0]?.name).toBe("pregunta_1");
  });
});
