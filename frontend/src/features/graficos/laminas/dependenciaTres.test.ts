// Dependencia en la lámina de tres gráficos en fila (contrato docs/qa/contrato-ui-mapas-dependientes-2026-11-03.md, §2).
import { describe, expect, it } from "vitest";
import type { Slide } from "../../../api/graficos";
import { alternarRespuesta, conDependiente, dependenciaTresDe, dependientesPosibles } from "./dependenciaTres";

const lamina = (dependencia: unknown, tipo = "p_slide_3_graficos_fila"): Slide =>
  ({ id: "s1", tipo, payload: { meta: { dependencia } } }) as unknown as Slide;

describe("dependenciaTresDe", () => {
  it("lee las respuestas de cada ranura dependiente, con la respuesta suelta como lista", () => {
    const d = dependenciaTresDe(lamina({ de: "izquierda", habilita: { centro: ["En Lima Metropolitana", "En Callao"], derecha: "En otra región del Perú" } }));
    expect(d).toEqual({ de: "izquierda", habilita: { centro: ["En Lima Metropolitana", "En Callao"], derecha: ["En otra región del Perú"] } });
  });
  it("descarta la ranura filtro y las que no son de la lámina", () => {
    expect(dependenciaTresDe(lamina({ de: "izquierda", habilita: { izquierda: ["x"], otra: ["y"], centro: ["Sí"] } }))?.habilita).toEqual({ centro: ["Sí"] });
  });
  it("sólo en la lámina de tres gráficos y con un filtro válido", () => {
    expect(dependenciaTresDe(lamina({ de: "izquierda", habilita: ["Sí"] }, "p_slide_2_graficos"))).toBeNull();
    expect(dependenciaTresDe(lamina({ de: "arriba", habilita: {} }))).toBeNull();
    expect(dependenciaTresDe(lamina(undefined))).toBeNull();
  });
});

describe("edición", () => {
  const base = { de: "izquierda", habilita: {} };
  it("las dependientes posibles son las otras dos ranuras, en orden de lectura", () => {
    expect(dependientesPosibles("p_slide_3_graficos_fila", "centro")).toEqual(["izquierda", "derecha"]);
  });
  it("encender una ranura la agrega sin respuestas; apagarla la quita (no depende)", () => {
    const on = conDependiente(base, "derecha", true);
    expect(on.habilita).toEqual({ derecha: [] });
    expect(conDependiente(on, "derecha", false).habilita).toEqual({});
  });
  it("las respuestas marcadas siguen el orden del cuestionario", () => {
    const orden = ["En Lima Metropolitana", "En Callao", "En otra región del Perú"];
    let d = conDependiente(base, "centro", true);
    d = alternarRespuesta(d, "centro", "En Callao", orden);
    d = alternarRespuesta(d, "centro", "En Lima Metropolitana", orden);
    expect(d.habilita.centro).toEqual(["En Lima Metropolitana", "En Callao"]);
    expect(alternarRespuesta(d, "centro", "En Callao", orden).habilita.centro).toEqual(["En Lima Metropolitana"]);
  });
});
