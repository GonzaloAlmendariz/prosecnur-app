import { describe, expect, it } from "vitest";
import type { SelectedBlock } from "../../../api/hojasRuta";
import { revisarSeleccion } from "./revisionMarco";
import { alcanzaManzana, visitasCap, visitasPorRuta } from "./visitas";

describe("visitas de una ruta (ADR 0116, espejo de R)", () => {
  it("la media es ceil(k/(r·e))", () => {
    expect(visitasPorRuta(8, { respuesta: 0.5 })).toBe(16);
    expect(visitasPorRuta(8, { respuesta: 0.5, ocupacion: 0.8 })).toBe(20);
    expect(visitasPorRuta(0, { respuesta: 0.5 })).toBe(0);
  });

  it("el tope del 90 % coincide con k + qnbinom(0.9, k, r·e) de R", () => {
    // Valores de R: 8+qnbinom(.9,8,.5)=21; 8+qnbinom(.9,8,.72)=14; 12+qnbinom(.9,12,.3)=53.
    expect(visitasCap(8, { respuesta: 0.5 })).toBe(21);
    expect(visitasCap(8, { respuesta: 0.9, ocupacion: 0.8 })).toBe(14);
    expect(visitasCap(12, { respuesta: 0.3 })).toBe(53);
    expect(visitasCap(8, { respuesta: 1 })).toBe(8);
  });

  it("una manzana alcanza con V ≥ v_cap(r·e), sin descontar la ocupación dos veces; con salto manual, V ≥ s·v_cap", () => {
    expect(alcanzaManzana(21, 8, { respuesta: 0.5 })).toBe(true);
    expect(alcanzaManzana(20, 8, { respuesta: 0.5 })).toBe(false);
    expect(alcanzaManzana(14, 8, { respuesta: 0.9, ocupacion: 0.8 })).toBe(true);
    expect(alcanzaManzana(13, 8, { respuesta: 0.9, ocupacion: 0.8 })).toBe(false);
    expect(alcanzaManzana(21, 8, { respuesta: 0.5, modoSalto: "manual", saltoManual: 2 })).toBe(false);
    expect(alcanzaManzana(42, 8, { respuesta: 0.5, modoSalto: "manual", saltoManual: 2 })).toBe(true);
  });

  it("estable con respuesta muy baja y k grande (R: 200 + qnbinom(.9, 200, .01) = 21823)", () => {
    expect(visitasCap(200, { respuesta: 0.01 })).toBe(21823);
  });

  it("con supuestos la revisión mide en visitas y no dice que la ruta sigue por las vecinas", () => {
    const b = (id: string, viv: number) => ({ id_manzana: id, ubigeo: "150103", distrito: "ATE", zona: "001", viviendas: viv, entrevistas: 8, hoja_num: 1, tipo_manzana: "titular" }) as unknown as SelectedBlock;
    const sin = revisarSeleccion([b("a", 12)], []);
    expect(sin.grupos.some((g) => g.tipo === "titular-corta")).toBe(false);
    const con = revisarSeleccion([b("a", 12)], [], { respuesta: 0.5 });
    const corta = con.grupos.find((g) => g.tipo === "titular-corta");
    expect(corta?.titulo).toBe("1 UMP no alcanza para sus visitas");
    for (const g of [...sin.grupos, ...con.grupos]) expect(g.detalle).not.toMatch(/vecinas/);
  });
});
