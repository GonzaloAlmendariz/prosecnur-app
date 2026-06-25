import { describe, expect, test } from "vitest";
import { ArgMetadata } from "../../api/client";
import { ARGUMENT_HINT_BY_NAME, resolveArgumentDescription, resolveDisplayFallback } from "./ArgField";

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

  test("explica orden y agrupación de barras con lenguaje de PPT", () => {
    const orderText = resolveArgumentDescription(
      baseMeta({
        name: "orden_barras",
        label: "Orden de barras",
        tipo_input: "choice",
        grupo: "estilo",
      }),
      { forText: true },
    );
    expect(orderText).toContain("orden del instrumento");
    expect(orderText).toContain("frecuencia");

    const maxText = resolveArgumentDescription(
      baseMeta({
        name: "max_categorias",
        label: "Máximo de categorías",
        tipo_input: "number",
        grupo: "filtro",
      }),
      { forNumber: true },
    );
    expect(maxText).toContain("evitar gráficos demasiado altos");
  });

  test("explica etiquetas pequeñas y Top 2 Box", () => {
    const thresholdText = resolveArgumentDescription(
      baseMeta({
        name: "umbral_posicion",
        label: "Ubicación de etiquetas pequeñas",
        tipo_input: "number",
        grupo: "filtro",
      }),
      { forNumber: true },
    );
    expect(thresholdText).toContain("etiqueta pequeña");
    expect(thresholdText).toContain("fuera de la barra");

    const top2Text = resolveArgumentDescription(
      baseMeta({
        name: "top2box",
        label: "Mostrar Top 2",
        tipo_input: "bool",
        grupo: "filtro",
      }),
      { forText: true },
    );
    expect(top2Text).toContain("dos categorías superiores");
  });
});

describe("resolveDisplayFallback", () => {
  const meta = (override: Partial<ArgMetadata>): ArgMetadata => ({
    name: "otros_al_final",
    label: "Otros al final",
    tipo_input: "bool",
    grupo: "estilo",
    ...override,
  });

  test("usa el valor heredado cuando existe", () => {
    expect(resolveDisplayFallback(meta({ default: true }), false)).toBe(false);
  });

  test("usa el default de metadata cuando no hay valor heredado", () => {
    expect(resolveDisplayFallback(meta({ default: true }), undefined)).toBe(true);
  });
});
