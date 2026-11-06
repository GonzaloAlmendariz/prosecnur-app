// U11: el interruptor de diferencias de la tarjeta respeta el `depende` del registro (multiapiladas sólo en «cruce»),
// lee `overrides` antes que el formal, como el motor, y al escribir deja un solo dueño.
import { describe, expect, it } from "vitest";
import type { ArgMetadata } from "../../../../api/graficos";
import { interruptorAplica, interruptorGuardado, parcheInterruptor } from "./interruptorDelGrafico";

const MODO: ArgMetadata = {
  name: "modo", label: "Qué es cada barra", tipo_input: "choice", grupo: "datos",
  choices: [{ value: "var", label: "Comparar preguntas" }, { value: "cruce", label: "Abrir una pregunta por grupos" }],
};
const SIG_MULTI: ArgMetadata = {
  name: "mostrar_significancia", label: "Marcar diferencias significativas", tipo_input: "bool", grupo: "datos",
  default: false, depende: { arg: "modo", valores: ["cruce"] },
};
const SIG_APILADAS: ArgMetadata = { name: "mostrar_significancia", label: "Marcar diferencias significativas", tipo_input: "bool", grupo: "datos", default: false };

describe("interruptorAplica", () => {
  it("multiapiladas: sólo en el modo «cruce»", () => {
    expect(interruptorAplica(SIG_MULTI, [MODO, SIG_MULTI], { modo: "cruce" })).toBe(true);
    expect(interruptorAplica(SIG_MULTI, [MODO, SIG_MULTI], { modo: "var" })).toBe(false);
    expect(interruptorAplica(SIG_MULTI, [MODO, SIG_MULTI], { modo: "var_cruce" })).toBe(false);
  });
  it("sin modo guardado vale el primero de sus valores, como `match.arg` en R: «Comparar preguntas», sin sección", () => {
    expect(interruptorAplica(SIG_MULTI, [MODO, SIG_MULTI], {})).toBe(false);
  });
  it("sin `depende` (apiladas) aplica siempre", () => {
    expect(interruptorAplica(SIG_APILADAS, [SIG_APILADAS], {})).toBe(true);
  });
});

describe("interruptorGuardado", () => {
  it("un `overrides.mostrar_significancia` viejo manda sobre el formal, como en el motor", () => {
    expect(interruptorGuardado({ mostrar_significancia: false, overrides: { mostrar_significancia: true } })).toBe(true);
    expect(interruptorGuardado({ mostrar_significancia: true })).toBe(true);
    expect(interruptorGuardado({})).toBeUndefined();
  });
});

describe("parcheInterruptor", () => {
  it("escribe el formal y quita el override viejo para que no lo tape", () => {
    expect(parcheInterruptor({ overrides: { mostrar_significancia: true, size_ejes: 12 } }, false))
      .toEqual({ mostrar_significancia: false, overrides: { size_ejes: 12 } });
    expect(parcheInterruptor({ overrides: { mostrar_significancia: true } }, false)).toEqual({ mostrar_significancia: false, overrides: null });
  });
  it("sin override viejo no toca `overrides`", () => {
    expect(parcheInterruptor({ overrides: { size_ejes: 12 } }, true)).toEqual({ mostrar_significancia: true });
  });
});
