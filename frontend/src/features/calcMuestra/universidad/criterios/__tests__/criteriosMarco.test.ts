/**
 * Los criterios del MARCO en una tabla.
 *
 * La tarjeta que ya existía compara el DISEÑO —muestra, sobremuestra, τ, deff—.
 * Lo que decide qué aulas entran no estaba en ninguna pantalla junta, y es lo
 * que Gonzalo pidió como «comparativo no sólo de números sino de método».
 */
import { describe, expect, it } from "vitest";
import { criteriosMarcoDeEstudio } from "../criteriosMarcoModel";

const busca = (fs: ReturnType<typeof criteriosMarcoDeEstudio>, c: string) =>
  fs.find((f) => f.concepto === c)?.hoy;

const SEL = {
  byVariable: {
    modality: { categories: "presencial" },
    session_type: { categories: "teorico" },
    teacher_type: { categories: [] },
  },
  courseLevelRanges: {
    derecho: [{ min: 2, max: 10 }],
    estudios_generales_letras: [{ exenta: true }],
    estudios_generales_ciencias: [{ exenta: true }],
  },
  minEligible: { threshold: 15, byFaculty: { artes_escenicas: 10, derecho: 20 } },
};

describe("criterios del marco", () => {
  it("resume el nivel sin enumerar las quince facultades", () => {
    // Una tabla que lista quince rangos iguales no se lee.
    expect(busca(criteriosMarcoDeEstudio(SEL, {}), "Nivel del curso"))
      .toBe("niveles 2–10 · 2 facultades exentas");
  });

  it("el mínimo dice el general Y cuántas tienen el suyo", () => {
    expect(busca(criteriosMarcoDeEstudio(SEL, {}), "Mínimo por curso-horario"))
      .toBe("15 elegibles · 2 facultades con mínimo propio");
  });

  it("un criterio sin declarar dice «no se aplica», no desaparece", () => {
    // Omitir la fila haría que un criterio ausente y uno inactivo se vean igual.
    const fs = criteriosMarcoDeEstudio(SEL, {});
    expect(busca(fs, "Tipo de docente")).toBe("no se aplica");
    expect(busca(fs, "Condición del curso")).toBe("no se aplica");
    expect(fs.map((f) => f.concepto)).toContain("Condición del curso");
  });

  it("las facultades excluidas se nombran, y «ninguna» es una respuesta", () => {
    expect(busca(criteriosMarcoDeEstudio(SEL, { excluded_faculties: ["ESCUELA DE POSGRADO"] }), "Facultades excluidas"))
      .toBe("ESCUELA DE POSGRADO");
    expect(busca(criteriosMarcoDeEstudio(SEL, {}), "Facultades excluidas")).toBe("ninguna");
  });

  it("distingue una excepción que SUMA de una que SUSTITUYE", () => {
    const con = criteriosMarcoDeEstudio({
      ...SEL,
      byVariable: {
        ...SEL.byVariable,
        session_type: {
          categories: "teorico",
          exceptions: {
            arte_y_diseno: { categories: ["taller"], op: "add" },
            artes_escenicas: { categories: ["taller"], op: "replace" },
          },
        },
      },
    }, {});
    const v = busca(con, "Tipo de sesión") ?? "";
    expect(v).toContain("arte y diseno: además taller");
    expect(v).toContain("artes escenicas: sólo taller");
  });

  it("CONTROL: sin config no inventa criterios", () => {
    const fs = criteriosMarcoDeEstudio(null, null);
    expect(fs.filter((f) => f.hoy !== "no se aplica" && f.hoy !== "ninguna")).toHaveLength(0);
  });
});
