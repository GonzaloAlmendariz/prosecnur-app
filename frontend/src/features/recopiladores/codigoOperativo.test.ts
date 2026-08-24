import { describe, expect, it } from "vitest";
import { codigoOperativoDe, composicionDelPlan, mapaDeCodigosDelPlan, titularesDelPlan, unidadesDelPlan } from "./codigoOperativo";
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

/**
 * **El denominador de las fichas es lo que el botón va a crear.**
 *
 * Medido en pantalla el 2026-08-23 sobre el estudio de 193: Materiales decía
 * «Fichas 0 de **193**» y `createInstances`, en el botón de al lado, manda
 * `plan.units.map(...)` entero — **2.616**. El rótulo prometía una cosa y la
 * acción hacía otra.
 *
 * Y crearlas todas es lo correcto: una reserva encadenada necesita su ficha el
 * día que su titular cae, y un extra cuando cierra una cuota. Por eso el
 * paquete las reparte en tres cajones por facultad.
 */
describe("unidadesDelPlan · el denominador de las fichas", () => {
  const plan = {
    units: [
      ...Array.from({ length: 3 }, (_, i) => ({ unit_id: `t${i}`, role: "titular" })),
      ...Array.from({ length: 5 }, (_, i) => ({ unit_id: `r${i}`, role: "chain_reserve" })),
      ...Array.from({ length: 7 }, (_, i) => ({ unit_id: `e${i}`, role: "extra_reserve_pool" })),
    ],
  } as unknown as Parameters<typeof unidadesDelPlan>[0];

  it("cuenta TODAS las unidades, no sólo las que se van a visitar", () => {
    expect(unidadesDelPlan(plan)).toBe(15);
    // Y el control que lo separa del contador viejo, que sigue existiendo para
    // el desglose: si los dos dieran lo mismo, este test no probaría nada.
    expect(titularesDelPlan(plan)).toBe(3);
  });

  it("la composición reparte el total en los tres cajones del paquete", () => {
    const c = composicionDelPlan(plan);
    expect(c).toEqual({ titulares: 3, reemplazos: 5, adicionales: 7 });
    expect(c.titulares + c.reemplazos + c.adicionales).toBe(unidadesDelPlan(plan));
  });

  it("sin plan no inventa un total", () => {
    expect(unidadesDelPlan(null)).toBe(0);
    expect(composicionDelPlan(undefined)).toEqual({ titulares: 0, reemplazos: 0, adicionales: 0 });
  });
});
