import { describe, expect, it } from "vitest";
import { conSlideMeta, leerSlideMeta } from "./slideMeta";

const lamina = { id: "s1", tipo: "p_slide_seccion" as const, payload: { titulo: "Misión" } };

describe("canal meta de la lámina (F6.0b.3)", () => {
  it("escribe y lee sin tocar el resto del payload ni mutar la lámina", () => {
    const s = conSlideMeta(lamina, { nivel: "subcapitulo", numero: "2.1" });
    expect(leerSlideMeta(s)).toEqual({ nivel: "subcapitulo", numero: "2.1" });
    expect(s.payload.titulo).toBe("Misión");
    expect(leerSlideMeta(lamina)).toEqual({});
  });

  it("un valor vacío borra la clave y sin claves la meta sale del payload", () => {
    const s = conSlideMeta(conSlideMeta(lamina, { antetitulo: "MÍO", actores: ["Docentes"] }), { antetitulo: "" });
    expect(leerSlideMeta(s)).toEqual({ actores: ["Docentes"] });
    const vacia = conSlideMeta(s, { actores: [] });
    expect("meta" in vacia.payload).toBe(false);
  });

  it("una meta que no es objeto se lee como vacía", () => {
    expect(leerSlideMeta({ payload: { meta: ["x"] } })).toEqual({});
    expect(leerSlideMeta({ payload: { meta: null } })).toEqual({});
  });
});
