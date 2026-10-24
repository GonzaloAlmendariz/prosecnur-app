import { describe, expect, test } from "vitest";
import type { Slide } from "../../../api/graficos";
import { conBaseFijada } from "../fijarBase";
import { baseQueResuelve, laBase, relacionDeFuentes, type RelacionBases } from "../relacionBases";
import { validarPlan, type EntradaValidarPlan } from "../usePlanValidator";
import type { VarWithSource } from "../useVariables";

// CCSS Perfil 2026 (QA 2026-10-24): «Exportar» quedaba deshabilitado por 117 avisos «la pregunta «A3» existe en las
// bases «default» y «datos_crianza». Elige de cuál es» mientras «Previsualizar» dibujaba esas láminas sin problema. El
// motor lee una ref suelta de la base `default`; `datos_crianza` es un repeat que repite sus columnas.

const v = (name: string, label: string, source: string): VarWithSource => ({ name, label, tipo: "select_one", seccion: "", list_name: "l", source });

const ccss: VarWithSource[] = [
  ...["B8_1_1", "B8_1_2", "B8_1_3", "B8_1_4"].flatMap((n, i) => [
    v(n, ["WhatsApp", "Instagram", "TikTok", "Facebook"][i], "default"),
    v(n, ["WhatsApp", "Instagram", "TikTok", "Facebook"][i], "datos_crianza"),
  ]),
  v("A3", "<b>Sexo</b>", "default"),
  v("A3", "<b>Sexo</b>", "datos_crianza"),
];

const relacionCcss = relacionDeFuentes([
  { name: "default", source_role: "principal" },
  { name: "datos_crianza", source_role: "repeat", repeat_grain: { kind: "instancia", parent_base: "default" } },
]);

const multi = (vars: string[]) => ({ graficador: "p_barras_multiapiladas", args: { vars } });

function entrada(slides: Slide[], variables: VarWithSource[], relacionBases?: RelacionBases): EntradaValidarPlan {
  return {
    slides, presets: {}, wPresets: {}, overridesReusables: [], paletas: {}, iconos: [],
    slidesById: { p_slide_1_grafico: { titulo_humano: "Un gráfico", slots: ["grafico"], slot_specs: [{ name: "grafico", role: "chart", label: "Gráfico principal" } as never] } },
    graficadoresById: {}, presetsByName: {}, variables, multi: true, relacionBases,
  };
}

describe("relación entre bases", () => {
  test("el repeat apunta a su madre por el grano; `default` es la que lee el motor", () => {
    expect(relacionCcss).toEqual({ resolutora: "default", padreDe: { datos_crianza: "default" } });
  });

  test("resuelve sólo si las demás bases descienden de la resolutora", () => {
    expect(baseQueResuelve(["default", "datos_crianza"], relacionCcss)).toBe("default");
    expect(baseQueResuelve(["default"], relacionCcss)).toBe("default");
    expect(baseQueResuelve(["datos_crianza"], relacionCcss)).toBeNull();
    const hermanos = relacionDeFuentes([{ name: "default" }, { name: "estudiantes" }]);
    expect(baseQueResuelve(["default", "estudiantes"], hermanos)).toBeNull();
    expect(baseQueResuelve(["docentes", "estudiantes"], relacionDeFuentes([{ name: "docentes" }, { name: "estudiantes" }]))).toBeNull();
  });

  test("nombra la base sin jerga", () => {
    expect(laBase("default")).toBe("la base principal");
    expect(laBase("datos_crianza")).toBe("la base «Datos crianza»");
  });
});

describe("pregunta sin base que el motor resuelve", () => {
  const slides: Slide[] = [
    { id: "s40", tipo: "p_slide_1_grafico", payload: { titulo: "Redes", grafico: multi(["B8_1_1", "B8_1_2", "B8_1_3", "B8_1_4"]) } },
    { id: "s41", tipo: "p_slide_1_grafico", payload: { titulo: "Sexo", grafico: { graficador: "p_barras_simples", args: { var: "A3" } } } },
  ];

  test("no bloquea: baja a aviso y la exportación queda habilitada", () => {
    const r = validarPlan(entrada(slides, ccss, relacionCcss));
    expect(r.errors).toEqual([]);
    expect(r.canExport).toBe(true);
    expect(r.warnings.filter((w) => w.code.startsWith("var-")).map((w) => w.code)).toEqual(["var-base-implicita", "var-base-implicita"]);
  });

  test("un aviso por gráfico, con las preguntas por su texto y sin «default» ni «datos_crianza»", () => {
    const [cuatro, una] = validarPlan(entrada(slides, ccss, relacionCcss)).warnings.filter((w) => w.code === "var-base-implicita");
    expect(cuatro.message).toBe("Lámina 1 · “Redes” (Un gráfico), espacio «Gráfico principal»: 4 preguntas («WhatsApp», «Instagram» y 2 más) se leen de la base principal.");
    expect(cuatro.detalle).toBe("4 preguntas («WhatsApp», «Instagram» y 2 más) se leen de la base principal.");
    expect(una.message).toBe("Lámina 2 · “Sexo” (Un gráfico), espacio «Gráfico principal»: la pregunta «Sexo» se lee de la base principal.");
    for (const w of [cuatro, una]) expect(w.message).not.toMatch(/default|datos_crianza|B8_1|A3/);
  });

  test("sin la relación de bases sigue el error de siempre", () => {
    const r = validarPlan(entrada(slides, ccss));
    expect(r.canExport).toBe(false);
    expect(r.errors.every((e) => e.code === "var-sin-base")).toBe(true);
  });

  test("entre públicos hermanos sigue siendo error", () => {
    const hermanos = [v("sexo", "Sexo", "default"), v("sexo", "Sexo", "estudiantes")];
    const rel = relacionDeFuentes([{ name: "default" }, { name: "estudiantes" }]);
    const r = validarPlan(entrada([{ id: "s1", tipo: "p_slide_1_grafico", payload: { titulo: "Sexo", grafico: { graficador: "p_barras_simples", args: { var: "sexo" } } } }], hermanos, rel));
    expect(r.canExport).toBe(false);
    expect(r.errors[0].code).toBe("var-sin-base");
  });
});

describe("fijar la base en todas las láminas", () => {
  test("escribe `default$` donde resuelve y deja lo ambiguo y lo ya fijado", () => {
    const vars = [...ccss, v("sexo", "Sexo", "default"), v("sexo", "Sexo", "estudiantes")];
    const rel = relacionDeFuentes([
      { name: "default" },
      { name: "datos_crianza", parent_base: "default" },
      { name: "estudiantes" },
    ]);
    const slides: Slide[] = [
      { id: "a", tipo: "p_slide_1_grafico", payload: { grafico: { graficador: "p_barras_simples", args: { var: "A3", cruce: "sexo" } } } },
      { id: "b", tipo: "p_slide_1_grafico", payload: { grafico: { graficador: "p_barras_multiapiladas", args: { vars: { tema_1: ["B8_1_1", "default$B8_1_2"] }, bloques: [{ vars: ["B8_1_3"] }] } } } },
      { id: "c", tipo: "p_slide_portada", payload: { titulo: "Portada" } },
    ];
    const r = conBaseFijada(slides, vars, rel);
    expect(r).toMatchObject({ laminas: 2, preguntas: 3, base: "default" });
    expect((r.slides[0].payload as { grafico: { args: unknown } }).grafico.args).toEqual({ var: "default$A3", cruce: "sexo" });
    expect((r.slides[1].payload as { grafico: { args: unknown } }).grafico.args).toEqual({
      vars: { tema_1: ["default$B8_1_1", "default$B8_1_2"] },
      bloques: [{ vars: ["default$B8_1_3"] }],
    });
    expect(r.slides[2]).toBe(slides[2]);
    const despues = validarPlan(entrada(r.slides.slice(0, 1), vars, rel));
    expect(despues.issues.filter((i) => i.code === "var-base-implicita")).toEqual([]);
  });
});
