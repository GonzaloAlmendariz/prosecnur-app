import { describe, expect, it } from "vitest";
import type { Active, Over } from "@dnd-kit/core";
import { anunciosArrastre, instruccionesArrastre } from "./anunciosArrastre";

const nombres: Record<string, string> = { panorama: "Panorama de públicos", contraste: "Contraste de públicos", cobertura: "Cobertura" };
const a = anunciosArrastre({ que: "la lámina", ids: ["cobertura", "panorama", "contraste"], nombre: (id) => nombres[id] ?? id });
const act = (id: string) => ({ id }) as unknown as Active;
const sobre = (id: string) => ({ id }) as unknown as Over;

describe("anuncios del arrastre en español, con el nombre y el lugar", () => {
  it("tomar, pasar, soltar y cancelar", () => {
    expect(a.onDragStart({ active: act("contraste") })).toBe('Tomaste "Contraste de públicos", lugar 3 de 3.');
    expect(a.onDragOver({ active: act("contraste"), over: sobre("cobertura") })).toBe('"Contraste de públicos" pasa al lugar 1 de 3.');
    expect(a.onDragEnd({ active: act("contraste"), over: sobre("cobertura") })).toBe('Soltaste "Contraste de públicos" en el lugar 1 de 3.');
    expect(a.onDragEnd({ active: act("panorama"), over: null })).toContain("queda donde estaba");
    expect(a.onDragCancel({ active: act("panorama"), over: null })).toBe('Se canceló. "Panorama de públicos" vuelve al lugar 2 de 3.');
  });

  it("nunca el id crudo ni inglés", () => {
    const todo = [a.onDragStart({ active: act("panorama") }), instruccionesArrastre("el público").draggable].join(" ");
    expect(todo).not.toMatch(/draggable|picked/i);
    expect(todo).not.toContain("panorama");
    expect(instruccionesArrastre("el público").draggable).toContain("Escape");
  });
});
