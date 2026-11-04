import { describe, expect, test } from "vitest";
import type { CpvMargen } from "../../../api/ponderacionCpv2025";
import { normalizarCpvMetas } from "../../../api/ponderacionCpv2025";
import { avisosDelMapeo, metasDesdeMapeo, sugerirMapeo, validarGruposEdad } from "./metasCpvModel";

const SEXO: CpvMargen = {
  variable: "sexo", etiqueta: "Sexo", total: 1000,
  categorias: [{ codigo: "Hombre", etiqueta: "Hombre", poblacion: 480 }, { codigo: "Mujer", etiqueta: "Mujer", poblacion: 520 }],
};
const EDU: CpvMargen = {
  variable: "educacion", etiqueta: "Nivel educativo", total: 100,
  categorias: [
    { codigo: "hasta_primaria", etiqueta: "Hasta primaria", poblacion: 20 },
    { codigo: "secundaria", etiqueta: "Secundaria", poblacion: 40 },
    { codigo: "superior", etiqueta: "Superior o posgrado", poblacion: 40 },
  ],
};

describe("mapeo base → CPV 2025", () => {
  test("sugiere por rótulo y sinónimos de sexo, sin inventar", () => {
    const base = [{ value: "1", label: "Masculino" }, { value: "2", label: "Femenino" }, { value: "99", label: "No responde" }];
    expect(sugerirMapeo(base, SEXO)).toEqual({ "1": ["Hombre"], "2": ["Mujer"] });
  });

  test("la meta es la población censada mapeada y lo sin mapear se avisa", () => {
    const base = [{ value: "1", label: "Primaria" }, { value: "2", label: "Secundaria" }, { value: "3", label: "Técnica" }];
    const r = metasDesdeMapeo(base, EDU, { "1": ["hasta_primaria"], "2": ["secundaria"] });
    expect(r.targets).toEqual({ "1": 20, "2": 40 });
    expect(r.baseSinMapear).toEqual(["3"]);
    expect(r.cpvSinMapear).toEqual(["superior"]);
    const avisos = avisosDelMapeo(r, base, EDU).map((a) => a.message);
    expect(avisos[0]).toMatch(/Sin meta: Técnica/);
    expect(avisos[1]).toMatch(/Superior o posgrado \(40\.0 %/);
  });

  test("varias categorías del censo suman en una de la base; repetidas se avisan", () => {
    const base = [{ value: "a", label: "Hasta secundaria" }, { value: "b", label: "Superior" }];
    const r = metasDesdeMapeo(base, EDU, { a: ["hasta_primaria", "secundaria"], b: ["superior", "secundaria"] });
    expect(r.targets).toEqual({ a: 60, b: 80 });
    expect(r.cpvRepetidas).toEqual(["secundaria"]);
    expect(avisosDelMapeo(r, base, EDU).some((x) => /dos veces/.test(x.message))).toBe(true);
  });

  test("mapeo completo: sin avisos", () => {
    const base = [{ value: "1", label: "Hombre" }, { value: "2", label: "Mujer" }];
    const r = metasDesdeMapeo(base, SEXO, sugerirMapeo(base, SEXO));
    expect(avisosDelMapeo(r, base, SEXO)).toEqual([]);
    expect(r.cubierta).toBe(1000);
  });

  test("grupos de edad: superpuestos e invertidos se rechazan", () => {
    expect(validarGruposEdad([{ etiqueta: "", min: 18, max: 30 }, { etiqueta: "", min: 30, max: null }])).toMatch(/superponen/);
    expect(validarGruposEdad([{ etiqueta: "", min: 40, max: 30 }])).toMatch(/menor/);
    expect(validarGruposEdad([{ etiqueta: "", min: 18, max: 29 }, { etiqueta: "", min: 30, max: null }])).toBeNull();
  });

  test("normalizador: escalares de R, NULL como {} y lista de uno", () => {
    const m = normalizarCpvMetas({
      fuente: ["INEI"], universo: "Población censada", total: [10],
      ambito: { nivel: "distritos", n_distritos: 1, ubigeos: "150101", provincias: "1501" },
      margenes: { variable: "sexo", etiqueta: "Sexo", total: 10, categorias: [{ codigo: "Hombre", etiqueta: "Hombre", poblacion: 4 }] },
      avisos: {},
    });
    expect(m.ambito.ubigeos).toEqual(["150101"]);
    expect(m.margenes).toHaveLength(1);
    expect(m.avisos).toEqual([]);
    expect(m.total).toBe(10);
  });
});
