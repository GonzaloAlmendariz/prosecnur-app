import { describe, expect, test } from "vitest";
import type { ArgMetadata } from "../../api/graficos";
import type { WordFijado } from "../../api/graficosWordFijado";
import {
  SIN_EFECTO_EN_WORD,
  decisionesSinFijados,
  notaValorGuardado,
  partirArgsPorFijado,
  textoValorFijado,
} from "./wordFijado";

const motivo = (d: string) => `Lo fija el recetario en el Word: ${d}.`;
const f = (o: Partial<WordFijado> & { arg: string }): WordFijado => ({ motivo: motivo(o.arg), aplica_si_marco: true, ...o });
const meta = (o: Partial<ArgMetadata> & { name: string }): ArgMetadata => ({ label: o.name, tipo_input: "number", grupo: "valores", ...o });

describe("decisionesSinFijados (5a): un ajuste fijado no cuenta como Modificado", () => {
  const fijados = { barras_apiladas: [f({ arg: "size_leyenda", valor: 8, unidad: "pt" }), f({ arg: "grosor_modo" })] };

  test("un tipo cuya única decisión es un arg fijado vuelve a heredar", () => {
    expect(decisionesSinFijados({ barras_apiladas: { size_leyenda: 12 } }, fijados)).toEqual({});
  });

  test("conserva las decisiones que sí llegan al Word y las de tipos sin candado", () => {
    expect(decisionesSinFijados(
      { barras_apiladas: { size_leyenda: 12, grosor_modo: "fijo", decimales: 1 }, torta: { size_leyenda: 12 } },
      fijados,
    )).toEqual({ barras_apiladas: { decimales: 1 }, torta: { size_leyenda: 12 } });
  });
});

describe("partirArgsPorFijado", () => {
  test("separa editables, fijados del preset y fijados que no son args del preset", () => {
    const args = [meta({ name: "size_leyenda" }), meta({ name: "decimales" })];
    const r = partirArgsPorFijado(args, [f({ arg: "size_leyenda", valor: 8, unidad: "pt" }), f({ arg: "textos_negrita" })]);
    expect(r.editables.map((a) => a.name)).toEqual(["decimales"]);
    expect(r.fijadosDelPreset.map((x) => x.meta.name)).toEqual(["size_leyenda"]);
    expect(r.fijadosSueltos.map((x) => x.arg)).toEqual(["textos_negrita"]);
  });

  test("sin word_fijado todo es editable", () => {
    const r = partirArgsPorFijado([meta({ name: "a" })], undefined);
    expect(r.editables).toHaveLength(1);
    expect(r.fijadosDelPreset).toEqual([]);
    expect(r.fijadosSueltos).toEqual([]);
  });
});

describe("textoValorFijado: lo que sale, con su unidad", () => {
  test("sin valor = Sin efecto en el Word", () => {
    expect(textoValorFijado(f({ arg: "barra_extra_umbral_alto" }))).toBe(SIN_EFECTO_EN_WORD);
  });

  test("un umbral 0–1 declarado en proporción se lee como porcentaje (escalaVisualDeArg)", () => {
    expect(textoValorFijado(f({ arg: "umbral_mostrar_etiqueta", valor: 0.07, unidad: "proporción" }))).toBe("7 %");
    expect(textoValorFijado(f({ arg: "umbral_ocultar_etiqueta", valor: 0, unidad: "proporción" }))).toBe("0 %");
  });

  test("una proporción que no es umbral conserva su unidad", () => {
    expect(textoValorFijado(f({ arg: "grosor_barras", valor: 0.58, unidad: "proporción" }))).toBe("0,58 (proporción)");
  });

  test("pt, cm, lógicos y choices", () => {
    expect(textoValorFijado(f({ arg: "size_leyenda", valor: 8, unidad: "pt" }))).toBe("8 pt");
    expect(textoValorFijado(f({ arg: "legend_key_cm", valor: 0.282, unidad: "cm" }))).toBe("0,282 cm");
    expect(textoValorFijado(f({ arg: "mostrar_leyenda", valor: true }))).toBe("Sí");
    expect(textoValorFijado(f({ arg: "mostrar_n_en_etiquetas", valor: false }))).toBe("No");
    const posicion = meta({ name: "leyenda_posicion", tipo_input: "choice", choices: [{ value: "abajo", label: "Abajo" }] });
    expect(textoValorFijado(f({ arg: "leyenda_posicion", valor: "abajo" }), posicion)).toBe("Abajo");
  });
});

describe("notaValorGuardado: el proyecto guarda otro valor y no se borra", () => {
  test("decisión distinta del fijado → nota con los dos valores", () => {
    expect(notaValorGuardado(f({ arg: "size_leyenda", valor: 8, unidad: "pt" }), 12, meta({ name: "size_leyenda", unidad: "pt" })))
      .toBe("Este proyecto guarda 12 pt, pero el Word usa 8 pt.");
  });

  test("umbral 0–1: guardado y fijado en la misma escala visual", () => {
    expect(notaValorGuardado(
      f({ arg: "umbral_mostrar_etiqueta", valor: 0.07, unidad: "proporción" }),
      0.04,
      meta({ name: "umbral_mostrar_etiqueta", unidad: "proporción" }),
    )).toBe("Este proyecto guarda 4 %, pero el Word usa 7 %.");
  });

  test("ajuste sin efecto → la nota dice que no tiene efecto", () => {
    expect(notaValorGuardado(f({ arg: "barra_extra_umbral_alto" }), 80)).toBe("Este proyecto guarda 80, pero en el Word no tiene efecto.");
  });

  test("fijado suelto (sin metadatos) con unidad: guardado y fijado en la misma escala", () => {
    expect(notaValorGuardado(f({ arg: "umbral_etiqueta_normal", valor: 0.07, unidad: "proporción" }), 0.1))
      .toBe("Este proyecto guarda 10 %, pero el Word usa 7 %.");
  });

  test("sin decisión o igual al fijado → sin nota", () => {
    expect(notaValorGuardado(f({ arg: "size_leyenda", valor: 8, unidad: "pt" }), undefined)).toBeNull();
    expect(notaValorGuardado(f({ arg: "size_leyenda", valor: 8, unidad: "pt" }), 8)).toBeNull();
    expect(notaValorGuardado(f({ arg: "leyenda_posicion", valor: "abajo" }), "abajo")).toBeNull();
  });
});
