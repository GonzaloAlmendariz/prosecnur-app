import { describe, expect, test } from "vitest";
import type { ArgMetadata } from "../../api/graficos";
import { escalaVisualDeArg, seMuestraComoPorcentajeDeProporcion } from "./argEscalaVisual";
import { formatNumberInput, inferNumberStep } from "./argFieldNumberUtils";

const meta = (o: Partial<ArgMetadata>): ArgMetadata => ({
  name: "campo", label: "Campo", tipo_input: "number", grupo: "estilo", ...o,
});

describe("escalaVisualDeArg: la unidad declarada en el catálogo manda", () => {
  test("un umbral del Top 2 Box declarado en % se pinta 80 %, no 8000 %", () => {
    const umbralVerde = meta({ name: "barra_extra_umbral_alto", label: "Umbral verde del Top 2 Box", default: 80, unidad: "%" });
    const e = escalaVisualDeArg(umbralVerde);
    expect(e).toEqual({ escala: 1, unidad: "%" });
    expect(formatNumberInput(80, e.escala)).toBe("80");
    expect(formatNumberInput(70, escalaVisualDeArg({ ...umbralVerde, name: "barra_extra_umbral_medio" }).escala)).toBe("70");
    expect(inferNumberStep(umbralVerde, 80)).not.toBe(0.0001);
  });

  test("un umbral declarado en pp tampoco se escala", () => {
    expect(escalaVisualDeArg(meta({ name: "umbral_brecha", unidad: "pp" })).escala).toBe(1);
  });

  test("un umbral declarado en proporción se pinta como porcentaje aunque su nombre termine en _pct", () => {
    expect(escalaVisualDeArg(meta({ name: "umbral_etiqueta_pct", unidad: "proporción", max: 1 }))).toEqual({ escala: 100, unidad: "%" });
    expect(escalaVisualDeArg(meta({ name: "umbral_ocultar_etiqueta", unidad: "proporción" }))).toEqual({ escala: 100, unidad: "%" });
  });

  test("una proporción que no es umbral (lienzo) conserva su unidad y no se escala", () => {
    expect(escalaVisualDeArg(meta({ name: "canvas_w_bars", unidad: "proporción" }))).toEqual({ escala: 1, unidad: "proporción" });
  });

  test("sin unidad declarada rige la convención de nombres heredada, nunca la magnitud", () => {
    expect(escalaVisualDeArg(meta({ name: "umbral_etiqueta", default: 0.04 }))).toEqual({ escala: 100, unidad: "%" });
    expect(escalaVisualDeArg(meta({ name: "umbral_etiqueta_pct", default: 3 }))).toEqual({ escala: 1 });
    expect(escalaVisualDeArg(meta({ name: "size_leyenda", default: 8 }))).toEqual({ escala: 1 });
    expect(seMuestraComoPorcentajeDeProporcion(meta({ name: "umbral_x", default: 80 }))).toBe(true);
  });
});
