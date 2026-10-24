import { describe, expect, it } from "vitest";
import { mergeSlotArgsPatch } from "../../store";
import { leerTwoBox } from "./twoBox";
import { CLAVE_SOLO_WORD, leerBarraExtraWord, patchBarraExtraWord } from "./twoBoxWord";

type R = Record<string, unknown>;

const APILADAS = "p_barras_apiladas";
const MULTI = "p_barras_multiapiladas";

function aplicar(graficador: string, args: R, presets: Record<string, R>, valor: Parameters<typeof patchBarraExtraWord>[3]): R {
  return JSON.parse(JSON.stringify(mergeSlotArgsPatch(args, patchBarraExtraWord(graficador, args, presets, valor)))) as R;
}

describe("barra extra en el Word: hereda la del PPT salvo que el gráfico la cambie", () => {
  it("la clave sólo-Word es word_barra_extra (no la vieja)", () => {
    expect(CLAVE_SOLO_WORD).toBe("word_barra_extra");
  });

  it("sin la clave el Word usa la misma barra extra que el PPT, sea la del recetario, la del informe o la del gráfico", () => {
    expect(leerBarraExtraWord(APILADAS, {}, {})).toEqual({ propia: false, valor: ["top2box"], ppt: ["top2box"] });
    expect(leerBarraExtraWord(APILADAS, {}, { barras_apiladas: { barra_extra: ["conteos"] } })).toMatchObject({ propia: false, valor: ["conteos"] });
    expect(leerBarraExtraWord(MULTI, { modo: "var", overrides: { barra_extra: false } }, {})).toMatchObject({ propia: false, valor: false });
  });

  it("pedir otra distinta escribe overrides.word_barra_extra y no toca la lámina", () => {
    const args = { var: "p1", overrides: { barra_extra: ["top2box"] } };
    const out = aplicar(APILADAS, args, {}, ["conteos"]);
    expect(out.overrides).toEqual({ barra_extra: ["top2box"], word_barra_extra: ["conteos"] });
    expect(leerBarraExtraWord(APILADAS, out, {})).toEqual({ propia: true, valor: ["conteos"], ppt: ["top2box"] });
    expect(leerTwoBox(APILADAS, out, {})?.valor).toEqual(["top2box"]);
  });

  it("false apaga sólo el Word", () => {
    const out = aplicar(APILADAS, { var: "p1" }, {}, false);
    expect(out.overrides).toEqual({ word_barra_extra: false });
    expect(leerBarraExtraWord(APILADAS, out, {})).toMatchObject({ propia: true, valor: false });
  });

  it("pedir lo mismo que el PPT borra la clave: el Word vuelve a seguir al PPT", () => {
    const propio = aplicar(APILADAS, { var: "p1" }, {}, ["conteos"]);
    const igual = aplicar(APILADAS, propio, {}, ["top2box"]);
    expect(igual).toEqual({ var: "p1" });
    expect(leerBarraExtraWord(APILADAS, igual, {})?.propia).toBe(false);
  });

  it("si el PPT cambia después, el Word que no se tocó cambia con él", () => {
    const base = aplicar(APILADAS, { var: "p1" }, {}, ["top2box"]);
    expect(leerBarraExtraWord(APILADAS, { ...base, overrides: { barra_extra: ["conteos"] } }, {})?.valor).toEqual(["conteos"]);
  });

  it("combinaciones inválidas se normalizan; los graficadores sin barra extra no se tocan", () => {
    const presets = { barras_apiladas: { barra_extra: false } };
    expect(aplicar(APILADAS, {}, presets, ["conteos", "top2box"]).overrides).toEqual({ word_barra_extra: ["top2box"] });
    expect(leerBarraExtraWord("p_pie", {}, {})).toBeNull();
    expect(patchBarraExtraWord("p_pie", {}, {}, ["conteos"])).toEqual({});
  });
});
