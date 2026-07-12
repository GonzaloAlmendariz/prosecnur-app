/**
 * Candado del puente id-canónico → rationale metodológico. La suite del marco
 * (marco-categorias) pliega el "¿Por qué así?" de cada criterio a partir de los
 * ids canónicos que emite el motor R; este test fija ese mapeo y que el texto
 * salga de los presets (fuente única), no de literales duplicados.
 */
import { describe, expect, it } from "vitest";
import { PLANTILLA_UNIVERSIDAD } from "../presets";
import { ELEGIBLES_POR_AULA_ID, rationaleParaCriterio } from "../criteriosRationale";

describe("rationaleParaCriterio", () => {
  it("mapea las variables de alumno a su criterio de preset (incluye/excluye + porqué)", () => {
    const formacion = PLANTILLA_UNIVERSIDAD.criteriosAlumno.find((c) => c.id === "formacion");
    const r = rationaleParaCriterio("formation", "alumno");
    expect(r).not.toBeNull();
    expect(r?.incluye).toBe(formacion?.incluye);
    expect(r?.excluye).toBe(formacion?.excluye);
    expect(r?.porQue).toBe(formacion?.porQue);
  });

  it("mapea faculty → unidad (estratifica)", () => {
    const unidad = PLANTILLA_UNIVERSIDAD.criteriosAlumno.find((c) => c.id === "unidad");
    expect(rationaleParaCriterio("faculty", "alumno")?.porQue).toBe(unidad?.porQue);
  });

  it("mapea level → ciclo aunque su capa por defecto sea el instrumento", () => {
    const ciclo = PLANTILLA_UNIVERSIDAD.criteriosAlumno.find((c) => c.id === "ciclo");
    expect(rationaleParaCriterio("level", "alumno")?.porQue).toBe(ciclo?.porQue);
  });

  it("mapea las variables de aula a su criterio de preset (regla como incluye)", () => {
    const presencial = PLANTILLA_UNIVERSIDAD.criteriosAula.find((c) => c.id === "presencial");
    const r = rationaleParaCriterio("modality", "aula");
    expect(r?.incluye).toBe(presencial?.regla);
    expect(r?.porQue).toBe(presencial?.porQue);
    expect(r?.excluye).toBeUndefined();
  });

  it("mapea la tarjeta 'Elegibles por aula' (enrolled_total) a min-elegibles", () => {
    const minEleg = PLANTILLA_UNIVERSIDAD.criteriosAula.find((c) => c.id === "min-elegibles");
    const r = rationaleParaCriterio(ELEGIBLES_POR_AULA_ID, "aula");
    expect(r?.porQue).toBe(minEleg?.porQue);
  });

  it("devuelve null para ids sin criterio documentado (p. ej. campus)", () => {
    expect(rationaleParaCriterio("campus", "aula")).toBeNull();
    expect(rationaleParaCriterio("desconocido", "alumno")).toBeNull();
  });

  it("no cruza scopes: un id de aula no resuelve como alumno y viceversa", () => {
    expect(rationaleParaCriterio("modality", "alumno")).toBeNull();
    expect(rationaleParaCriterio("formation", "aula")).toBeNull();
  });
});
