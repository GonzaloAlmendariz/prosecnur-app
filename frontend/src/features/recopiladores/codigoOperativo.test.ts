import { describe, expect, it } from "vitest";
import { codigoOperativoDe, mapaDeCodigosDelPlan, titularesDelPlan } from "./codigoOperativo";
import type { CollectionPlan } from "../../api/recopiladores";

const plan = (units: CollectionPlan["units"]): Pick<CollectionPlan, "units"> => ({ units });

describe("codigoOperativoDe", () => {
  it("saca el código de donde viaja de verdad", () => {
    expect(codigoOperativoDe({ dimensions: { legacy_ref: "CH 1" } })).toBe("CH 1");
    expect(codigoOperativoDe({ dimensions: { legacy_ref: "  R 1.2  " } })).toBe("R 1.2");
  });

  it("devuelve vacío en vez de inventar cuando no hay", () => {
    expect(codigoOperativoDe({ dimensions: {} })).toBe("");
    expect(codigoOperativoDe(null)).toBe("");
    expect(codigoOperativoDe(undefined)).toBe("");
    // Un número no es un código: se descarta en vez de pintarse como texto.
    expect(codigoOperativoDe({ dimensions: { legacy_ref: 3 as unknown as string } })).toBe("");
  });
});

describe("mapaDeCodigosDelPlan", () => {
  it("traduce el hash de infraestructura al código de campo", () => {
    const m = mapaDeCodigosDelPlan(plan([
      { unit_id: "unit-aulas-urb209-5524e6773d", label: "urb209_0601", dimensions: { legacy_ref: "CH 1" } },
      { unit_id: "unit-aulas-1arc66-aa11bb22cc", label: "1arc66_0601", dimensions: { legacy_ref: "R 1.1" } },
    ]));
    expect(m.get("unit-aulas-urb209-5524e6773d")).toBe("CH 1");
    expect(m.get("unit-aulas-1arc66-aa11bb22cc")).toBe("R 1.1");
    expect(m.size).toBe(2);
  });

  it("no mete entradas vacías: sin código, no hay traducción que ofrecer", () => {
    // Una entrada con valor "" haria que el consumidor pintara una celda en
    // blanco creyendo que tradujo, en vez de caer al identificador que tiene.
    const m = mapaDeCodigosDelPlan(plan([
      { unit_id: "u1", label: "x", dimensions: {} },
      { unit_id: "u2", label: "y", dimensions: { legacy_ref: "CH 9" } },
    ]));
    expect(m.has("u1")).toBe(false);
    expect(m.get("u2")).toBe("CH 9");
  });

  it("un plan ausente da un mapa vacío, no revienta", () => {
    expect(mapaDeCodigosDelPlan(null).size).toBe(0);
    expect(mapaDeCodigosDelPlan(undefined).size).toBe(0);
  });
});

describe("titularesDelPlan", () => {
  it("cuenta las visitas, no las unidades", () => {
    // 193 titulares + 507 reservas + 1.916 extras son 2.616 unidades y 193
    // visitas. Decir «2.616 aulas» prometeria catorce veces el operativo real.
    const p = plan([
      { unit_id: "a", label: "a", role: "titular" },
      { unit_id: "b", label: "b", role: "chain_reserve" },
      { unit_id: "c", label: "c", role: "extra_reserve_pool" },
      { unit_id: "d", label: "d", role: "titular" },
    ]);
    expect(titularesDelPlan(p)).toBe(2);
  });

  it("tolera el rol escrito con guiones o espacios", () => {
    expect(titularesDelPlan(plan([{ unit_id: "a", label: "a", role: "Titular" }]))).toBe(1);
  });

  it("sin plan devuelve cero, no NaN", () => {
    expect(titularesDelPlan(null)).toBe(0);
  });
});
