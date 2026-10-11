// La composición de cada tipo de lámina asigna sus slots a las ranuras del estándar (F6.2).
import { describe, expect, it } from "vitest";
import type { SlideType } from "../../../api/graficos";
import { SLIDE_GRAF_SLOTS } from "../store";
import { BASE_DERIVADA, composicionDe, esSlotCifra, numeroDeRanura } from "./composicion";
import { RANURAS_ESTANDAR } from "./ranurasEstandar.generated";

const TIPOS = Object.keys(SLIDE_GRAF_SLOTS) as SlideType[];

describe("composicionDe", () => {
  it("cada slot de gráfico o de cifra cae en exactamente una ranura", () => {
    for (const tipo of TIPOS) {
      const slots = SLIDE_GRAF_SLOTS[tipo];
      const comp = composicionDe(tipo, slots);
      if (comp.fuente === "estructura") {
        expect(slots, tipo).toEqual([]);
        continue;
      }
      const asignados = comp.ranuras.map((r) => r.slot).filter((s): s is string => s !== null);
      expect([...asignados].sort(), tipo).toEqual([...slots].sort());
    }
  });

  it("las ranuras de gráfico del estándar coinciden con los slots de gráfico; las de cifras, con los slots cifra_*", () => {
    for (const tipo of TIPOS) {
      const comp = composicionDe(tipo, SLIDE_GRAF_SLOTS[tipo]);
      if (comp.fuente === "estructura") continue;
      for (const r of comp.ranuras) {
        if (r.tipo === "grafico") expect(r.slot && !esSlotCifra(r.slot), `${tipo}: ${r.slot}`).toBe(true);
        if (r.tipo === "cifras") expect(r.slot && esSlotCifra(r.slot), `${tipo}: ${r.slot}`).toBe(true);
        if (r.tipo === "texto") expect(r.slot).toBeNull();
      }
    }
  });

  it("todo tipo del estándar se dibuja desde sus propias ranuras", () => {
    for (const id of Object.keys(RANURAS_ESTANDAR)) {
      expect(composicionDe(id, SLIDE_GRAF_SLOTS[id as SlideType] ?? []).fuente, id).toBe("estandar");
    }
  });

  it("en la de cifras lateral, el gráfico alto de la derecha es «derecha» y los apilados van al centro", () => {
    const comp = composicionDe("p_slide_3_graficos_poblacion_cifras", SLIDE_GRAF_SLOTS.p_slide_3_graficos_poblacion_cifras);
    const de = (slot: string) => comp.ranuras.find((r) => r.slot === slot)!;
    expect(de("derecha").x).toBeGreaterThan(de("superior_izquierda").x);
    expect(de("derecha").h).toBeGreaterThan(de("superior_izquierda").h);
    expect(de("inferior_izquierda").y).toBeGreaterThan(de("superior_izquierda").y);
    // La columna de cifras se reparte apilada entre sus dos slots.
    expect(de("cifra_inferior").y).toBeGreaterThan(de("cifra_superior").y);
    expect(de("cifra_superior").x).toBe(de("cifra_inferior").x);
  });

  it("la banda de cifras se reparte en fila entre sus tres slots, sin solaparse", () => {
    const comp = composicionDe("p_slide_cifras_y_graficos", SLIDE_GRAF_SLOTS.p_slide_cifras_y_graficos);
    const cifras = comp.ranuras.filter((r) => r.tipo === "cifras");
    expect(cifras.map((r) => r.slot)).toEqual(["cifra_izquierda", "cifra_centro", "cifra_derecha"]);
    for (let i = 1; i < cifras.length; i += 1) expect(cifras[i].x).toBeGreaterThan(cifras[i - 1].x + cifras[i - 1].w);
  });

  it("las de población antiguas se dibujan con el reparto de su base y el ícono del público", () => {
    for (const [tipo, base] of Object.entries(BASE_DERIVADA)) {
      const comp = composicionDe(tipo, SLIDE_GRAF_SLOTS[tipo as SlideType]);
      expect(comp).toMatchObject({ fuente: "derivada", base, poblacion: true });
    }
  });

  it("numera las ranuras como el foco (1-based por SLIDE_GRAF_SLOTS)", () => {
    const slots = SLIDE_GRAF_SLOTS.p_slide_2_graficos;
    expect(numeroDeRanura(slots, "derecha")).toBe(2);
    expect(numeroDeRanura(slots, "otra")).toBeNull();
    expect(numeroDeRanura(slots, null)).toBeNull();
  });
});
