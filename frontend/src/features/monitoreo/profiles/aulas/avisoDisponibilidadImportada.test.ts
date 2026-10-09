import { describe, expect, it } from "vitest";

import { AVISOS_VISIBLES, avisoDisponibilidadImportada } from "./avisoDisponibilidadImportada";

describe("avisoDisponibilidadImportada", () => {
  it("una importación limpia se anuncia en verde y sin contar nada", () => {
    const a = avisoDisponibilidadImportada({ aplicadores: 8, avisos: [] });
    expect(a.tono).toBe("ok");
    expect(a.texto).toContain("8 aplicadores");
    expect(a.texto).not.toContain("aviso");
  });

  it("enseña el TEXTO de cada aviso, que es donde está la fila del excel", () => {
    // El contador solo dejaba al coordinador sabiendo que algo iba mal y sin
    // poder ir a tocarlo.
    const a = avisoDisponibilidadImportada({
      aplicadores: 7,
      avisos: ["«ANA QUISPE» sale en las filas 3 y 9: se toman como la misma persona y sus horas se suman."],
    });
    expect(a.tono).toBe("atencion");
    expect(a.texto).toContain("filas 3 y 9");
  });

  it("no llama «celdas ilegibles» a lo que no es una celda", () => {
    const a = avisoDisponibilidadImportada({
      aplicadores: 7,
      avisos: ["La fila 10 declara 4 franjas disponibles pero no trae nombre: se omite."],
    });
    expect(a.texto).not.toContain("celdas ilegibles");
    expect(a.texto).toContain("1 aviso");
  });

  it("con muchos avisos enseña los primeros enteros y dice cuántos quedan", () => {
    const avisos = Array.from({ length: AVISOS_VISIBLES + 3 }, (_, i) => `Aviso número ${i + 1}.`);
    const a = avisoDisponibilidadImportada({ aplicadores: 5, avisos });
    expect(a.texto).toContain("Aviso número 1.");
    expect(a.texto).toContain(`Aviso número ${AVISOS_VISIBLES}.`);
    expect(a.texto).not.toContain(`Aviso número ${AVISOS_VISIBLES + 1}.`);
    expect(a.texto).toContain("3 avisos más");
    // Y el total sigue siendo el total, no los que caben.
    expect(a.texto).toContain(`${AVISOS_VISIBLES + 3} avisos.`);
  });

  it("cero aplicadores no es «importado con matices»: es que no entró nadie", () => {
    const a = avisoDisponibilidadImportada({ aplicadores: 0, avisos: [] });
    expect(a.tono).toBe("atencion");
    expect(a.texto).toContain("ningún aplicador");
    // Y dice dónde mirar, no solo que está vacío.
    expect(a.texto).toContain("Nombres");
  });

  it("avisos ausentes o con huecos no fabrican un conteo", () => {
    expect(avisoDisponibilidadImportada({ aplicadores: 3 }).tono).toBe("ok");
    expect(avisoDisponibilidadImportada({ aplicadores: 3, avisos: ["", "   "] }).tono).toBe("ok");
  });

  it("el singular no se dice en plural", () => {
    const a = avisoDisponibilidadImportada({ aplicadores: 1, avisos: ["Uno solo."] });
    expect(a.texto).toContain("1 aplicador,");
    expect(a.texto).toContain("1 aviso.");
  });
});
