import { describe, expect, test } from "vitest";
import { ArgMetadata } from "../../api/client";
import { ARGUMENT_HINT_BY_NAME, resolveArgumentDescription } from "./ArgField";

describe("resolveArgumentDescription", () => {
  const baseMeta = (override: Partial<ArgMetadata>): ArgMetadata => ({
    name: "campo_base",
    label: "Campo base",
    tipo_input: "string",
    grupo: "estilo",
    ...override,
  });

  test("usa descripción explícita cuando existe", () => {
    const text = resolveArgumentDescription(
      baseMeta({
        descripcion: "Texto descriptivo personalizado del backend.",
      }),
      { forText: true },
    );

    expect(text).toBe("Texto descriptivo personalizado del backend.");
  });

  test("genera pista útil para título sin descripción", () => {
    const text = resolveArgumentDescription(
      baseMeta({
        name: "titulo",
        label: "Título del slide",
        tipo_input: "string",
        grupo: "textos",
      }),
      { forText: true },
    );

    expect(text).toContain("Texto principal del bloque");
    expect(text).toContain("mensaje que ve el lector");
  });

  test("genera explicación de rango para numéricos sin descripción", () => {
  const text = resolveArgumentDescription(
      baseMeta({
        name: "size_titulo",
        label: "Tamaño de título",
        tipo_input: "number",
        grupo: "lectura",
        min: 8,
        max: 40,
        unidad: "px",
      }),
      { forNumber: true },
    );

    expect(text).toContain("Ajusta un valor numérico");
    expect(text).toContain("Rango permitido");
    expect(text).toContain("px");
  });

  test("no rompe al recibir tipo bool y devolver texto humano", () => {
    const text = resolveArgumentDescription(
      baseMeta({
        name: "mostrar_valores",
        label: "Mostrar valores",
        tipo_input: "bool",
      }),
      { forText: true },
    );

    expect(text).toContain("Activa o desactiva");
    expect(text).toContain("bloque");
  });

  test("usa copy específica para espacio de etiquetas", () => {
  const text = resolveArgumentDescription(
      baseMeta({
        name: "canvas_w_etiquetas",
        label: "Ancho de etiquetas",
        tipo_input: "number",
        grupo: "canvas",
      }),
      { forNumber: true },
    );

    expect(text).toContain("Espacio destinado a etiquetas");
    expect(text).toContain("Ajusta un valor numérico");
  });

  test("explica claramente el control de barras extra", () => {
    const text = resolveArgumentDescription(
      baseMeta({
        name: "mostrar_barras_extra",
        label: "Mostrar barras extra",
        tipo_input: "bool",
      }),
      { forText: true },
    );

    expect(text).toContain("Activa o desactiva");
    expect(text).toContain("Muestra");
  });

  test("explica un argumento nuevo de configuración numérica", () => {
    const text = resolveArgumentDescription(
      baseMeta({
        name: "donut_hole",
        label: "Apertura del donut",
        tipo_input: "number",
        grupo: "espacio",
        min: 0,
        max: 1,
      }),
      { forNumber: true },
    );

    expect(text).toContain("Ajusta el tamaño del centro vacío en donuts");
    expect(text).toContain("Rango permitido");
  });

  test("explica un argumento de texto nuevo con nombre técnico", () => {
    const text = resolveArgumentDescription(
      baseMeta({
        name: "pos_titulo",
        label: "Posición del título",
        tipo_input: "string",
        grupo: "lectura",
      }),
      { forText: true },
    );

    expect(text).toContain("Ajusta la posición/espaciado");
  });

  test("explica el control de negritas para textos importantes", () => {
    const text = resolveArgumentDescription(
      baseMeta({
        name: "textos_negrita",
        label: "Textos negrita",
        tipo_input: "multiflag",
      }),
      { forText: true },
    );

    expect(text).toContain("resalten en negrita");
    expect(text).toContain("guiar la atención");
  });

  test("aplica contexto humano cuando no hay nombre explícito, usando label", () => {
    const text = resolveArgumentDescription(
      baseMeta({
        name: "campo_personalizado",
        label: "Texto de pie",
        tipo_input: "string",
        grupo: "textos",
      }),
      { forText: true },
    );

    expect(text).toContain("Texto de apoyo");
  });

  test("recuerda explicar de forma humanizada un argumento sin mapeo explícito", () => {
    const text = resolveArgumentDescription(
      baseMeta({
        name: "ajuste_no_catalogado",
        label: "Ajuste manual avanzado",
        tipo_input: "number",
        grupo: "estilo",
      }),
      { forNumber: true },
    );

    expect(text).toContain("Ajusta el valor numérico");
    expect(text).toContain("Ajuste manual avanzado");
  });
});
