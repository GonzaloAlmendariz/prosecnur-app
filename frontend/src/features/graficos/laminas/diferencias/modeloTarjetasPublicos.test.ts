// Mata (ADR 0138): «Entre públicos» ofrecido donde el motor no lo calcula (brecha de dos grupos, radar por grupos, lámina
// de dos gráficos), un cambio de modo que borra la opción guardada y un interruptor que enciende entre grupos un gráfico
// que sólo compara públicos.
import { describe, expect, it } from "vitest";
import {
  admiteEntrePublicos,
  modoTarjetas,
  modoVigente,
  ofreceModo,
  opcionAlternada,
  opcionConModo,
  opcionesModo,
} from "./modeloTarjetas";

const DOS_BASES = { cruce: null, vars: { tema_1: ["docentes$p1", "estudiantes$p1"] } };

describe("admiteEntrePublicos", () => {
  it("contraste de dos bases sin cruce, radar por públicos y panorama, en la lámina de un gráfico", () => {
    expect(admiteEntrePublicos("p_slide_1_grafico", "p_dumbbell", DOS_BASES)).toBe(true);
    expect(admiteEntrePublicos("p_slide_1_grafico", "p_radar", { modo: "publicos" })).toBe(true);
    expect(admiteEntrePublicos("p_slide_1_grafico", "p_panorama", {})).toBe(true);
  });
  it("no aplica a la brecha de dos grupos, al radar por grupos, a otros gráficos ni a la lámina de dos", () => {
    expect(admiteEntrePublicos("p_slide_1_grafico", "p_dumbbell", { cruce: "estudiantes$sexo", grupos: ["1", "2"] })).toBe(false);
    expect(admiteEntrePublicos("p_slide_1_grafico", "p_radar", { modo: "grupos" })).toBe(false);
    expect(admiteEntrePublicos("p_slide_1_grafico", "p_barras_agrupadas", {})).toBe(false);
    expect(admiteEntrePublicos("p_slide_1_grafico", "p_divergentes", {})).toBe(false);
    expect(admiteEntrePublicos("p_slide_2_graficos", "p_panorama", {})).toBe(false);
  });
});

describe("modo de las tarjetas", () => {
  it("entre públicos sólo con `entre_publicos: true`", () => {
    expect(modoTarjetas(undefined)).toBe("grupos");
    expect(modoTarjetas(true)).toBe("grupos");
    expect(modoTarjetas({ activo: true, entre_publicos: true })).toBe("publicos");
  });
  it("cambiar de modo conserva el resto de la opción y la deja encendida", () => {
    const v = { activo: false, max: 3, cortos: { docentes: "Doc." } };
    expect(opcionConModo(v, "publicos")).toEqual({ max: 3, cortos: { docentes: "Doc." }, activo: true, entre_publicos: true });
    expect(opcionConModo({ ...v, entre_publicos: true }, "grupos")).toEqual({ max: 3, cortos: { docentes: "Doc." }, activo: true });
  });
  it("en un gráfico que sólo compara públicos, encender las pide entre públicos; apagar conserva la opción", () => {
    expect(opcionAlternada(undefined, true, true)).toEqual({ activo: true, entre_publicos: true });
    expect(opcionAlternada(undefined, true)).toBe(true);
    expect(opcionAlternada({ activo: true, entre_publicos: true, max: 2 }, false, true)).toEqual({ activo: false, entre_publicos: true, max: 2 });
  });
  it("el selector sólo se ofrece donde aplica; «Entre grupos» deshabilitada si no hay grupos", () => {
    expect(ofreceModo({ grupos: true, publicos: false })).toBe(false);
    expect(ofreceModo({ grupos: false, publicos: true })).toBe(true);
    const ops = opcionesModo({ grupos: false, publicos: true });
    expect(ops.map((o) => [o.clave, o.rotulo, o.deshabilitada === true])).toEqual([["grupos", "Entre grupos", true], ["publicos", "Entre públicos", false]]);
    expect(opcionesModo({ grupos: true, publicos: true })[0].deshabilitada).toBe(false);
  });
  it("un modo públicos guardado en un gráfico que ya no lo admite se pinta entre grupos", () => {
    expect(modoVigente({ entre_publicos: true }, { grupos: true, publicos: false })).toBe("grupos");
    expect(modoVigente({ entre_publicos: true }, { grupos: false, publicos: true })).toBe("publicos");
  });
});
