import { describe, expect, it } from "vitest";
import type { Slide } from "../../../../api/graficos";
import { composicionDe } from "../../iconos/composicion";
import { lugaresPorPosicion, ranurasDispuestas } from "../../iconos/disposicionRanuras";
import { RANURAS_ESTANDAR } from "../../iconos/ranurasEstandar.generated";
import { nombreSlot } from "../selectores/etiquetas";
import { cambioDeDisposicion, disposicionDe, disposicionesDe, lugarDispuesto, lugarEnLamina, rotuloDeRanura } from "./modeloDisposicion";

const CINCO = "p_slide_5_graficos_poblacion";
const SLOTS = ["grafico_superior_1", "grafico_superior_2", "grafico_superior_3", "grafico_inferior_1", "grafico_inferior_2"];
const lamina = (payload: Record<string, unknown> = {}, tipo = CINCO) => ({ tipo, payload } as Pick<Slide, "tipo" | "payload">);

describe("disposición de la lámina de cinco gráficos", () => {
  it("el catálogo la ofrece sólo donde la declara, con «3+2» por defecto", () => {
    expect(disposicionesDe(CINCO)?.default).toBe("3+2");
    expect(disposicionesDe("p_slide_6_graficos_poblacion")).toBeNull();
    expect(disposicionDe(lamina({}, "p_slide_6_graficos_poblacion"))).toBeNull();
  });

  it("se lee de la meta; un valor fuera del catálogo es la de por defecto; el argumento suelto manda, como en el motor", () => {
    expect(disposicionDe(lamina())).toBe("3+2");
    expect(disposicionDe(lamina({ meta: { disposicion: "2+3" } }))).toBe("2+3");
    expect(disposicionDe(lamina({ meta: { disposicion: "4+1" } }))).toBe("3+2");
    expect(disposicionDe(lamina({ disposicion: "3+2", meta: { disposicion: "2+3" } }))).toBe("3+2");
  });

  it("elegir escribe la meta y borra el argumento suelto que la taparía", () => {
    expect(cambioDeDisposicion(lamina({ meta: { antetitulo: "A" } }), "2+3")).toEqual({ meta: { antetitulo: "A", disposicion: "2+3" } });
    const conSuelto = cambioDeDisposicion(lamina({ disposicion: "3+2" }), "2+3");
    expect(conSuelto).toHaveProperty("disposicion", undefined);
    expect(conSuelto.meta).toEqual({ disposicion: "2+3" });
    expect(cambioDeDisposicion(lamina(), "9+9")).toEqual({});
  });

  it("«2+3» sube la fila ancha y baja la de tres, con la misma calle y el mismo fin (espejo del motor)", () => {
    const base = RANURAS_ESTANDAR[CINCO].ranuras;
    const r = ranurasDispuestas(CINCO, base, "2+3");
    expect(r.map((q) => q.w)).toEqual([base[3].w, base[4].w, base[0].w, base[1].w, base[2].w]);
    expect(r[0].y).toBe(base[0].y);
    expect(r[1].y).toBe(base[0].y);
    const calle = base[3].y - (base[0].y + base[0].h);
    expect(r[2].y).toBeCloseTo(base[0].y + base[3].h + calle, 3);
    expect(r[2].y + r[2].h).toBeCloseTo(base[3].y + base[3].h, 3);
    expect(ranurasDispuestas(CINCO, base, "3+2")).toEqual([...base]);
    expect(ranurasDispuestas("p_slide_6_graficos_poblacion", base, "2+3")).toEqual([...base]);
  });

  it("la composición asigna las ranuras en orden de lectura", () => {
    const comp = composicionDe(CINCO, SLOTS, "2+3");
    const arriba = comp.ranuras.filter((q) => q.y === comp.ranuras[0].y).map((q) => q.slot);
    expect(arriba).toEqual(["grafico_superior_1", "grafico_superior_2"]);
  });

  it("los lugares salen de la posición", () => {
    const comp = composicionDe(CINCO, SLOTS, "2+3").ranuras;
    expect(lugaresPorPosicion(comp)).toEqual(["Superior izquierda", "Superior derecha", "Inferior izquierda", "Inferior centro", "Inferior derecha"]);
  });

  it("con «2+3» la tercera ranura ya no es «Superior derecha»; con la de por defecto manda el rótulo del catálogo", () => {
    const dosTres = lamina({ meta: { disposicion: "2+3" } });
    expect(lugarDispuesto(dosTres, "grafico_superior_3")).toBe("Inferior izquierda");
    expect(lugarDispuesto(dosTres, "grafico_superior_2")).toBe("Superior derecha");
    expect(lugarDispuesto(lamina(), "grafico_superior_3")).toBeNull();
    const meta = { slot_specs: [{ name: "grafico_superior_3", label: "Superior derecha" }] } as unknown as Parameters<typeof nombreSlot>[1];
    expect(nombreSlot("grafico_superior_3", meta, dosTres)).toBe("Inferior izquierda");
    expect(nombreSlot("grafico_superior_3", meta, lamina())).toBe("Superior derecha");
  });

  it("ronda 19 (F4): el rótulo sigue la geometría cuando el del catálogo no la describe", () => {
    const dosTexto = { tipo: "p_slide_2_graficos_texto_izquierda", payload: {} } as unknown as Parameters<typeof lugarEnLamina>[0];
    expect(lugarEnLamina(dosTexto, "grafico_1")).toBe("Izquierda");
    expect(lugarEnLamina(dosTexto, "grafico_2")).toBe("Derecha");
    const meta = { name: "p_slide_2_graficos_texto_izquierda", slot_specs: [{ name: "grafico_1", label: "Gráfico superior" }] } as unknown as Parameters<typeof nombreSlot>[1];
    expect(nombreSlot("grafico_1", meta, dosTexto)).toBe("Izquierda");
    // Sin la lámina, el tipo del registro basta.
    expect(nombreSlot("grafico_1", meta)).toBe("Izquierda");
    // Un rótulo que ya describe el lugar se conserva.
    expect(rotuloDeRanura(dosTexto, "grafico_1", "Gráfico izquierdo")).toBe("Gráfico izquierdo");
    expect(rotuloDeRanura(dosTexto, "grafico_2", "Gráfico inferior")).toBe("Derecha");
    // Con un solo gráfico no hay lugar que distinguir.
    expect(lugarEnLamina({ tipo: "p_slide_1_grafico", payload: {} } as unknown as Parameters<typeof lugarEnLamina>[0], "grafico")).toBeNull();
  });
});
