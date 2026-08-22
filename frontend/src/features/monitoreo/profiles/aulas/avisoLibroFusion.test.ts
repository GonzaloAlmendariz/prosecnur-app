// Qué defiende este archivo: que importar un libro de OTRO sorteo no se anuncie
// igual que importar el que corresponde.
//
// `aulas_libro_fusionar_plan` mete tal cual las aulas que el plan no tiene —bien
// pensado: alguien pudo añadir una fila a mano en campo—, pero trataba igual 1
// aula añadida a mano que 190 de otro sorteo. El aviso decía «Entraron 190
// aulas» en los dos casos, y el plan quedaba con dos sorteos mezclados.
//
// Es la misma forma de defecto que el cruce parte↔plataforma ya resuelve con su
// umbral: unos pocos casos son casos; casi todos son otro problema.
import { describe, expect, it } from "vitest";
import { avisoLibroImportado } from "./avisoLibroImportado";

const base = { resumen: { unidades: 190, titulares: 190 } };

describe("el aviso del libro lee la fusión", () => {
  it("ninguna coincidencia con un plan previo delata otro sorteo", () => {
    const r = avisoLibroImportado({
      ...base,
      fusion: { actualizadas: 0, nuevas: 190, intactas: 190 },
    });
    expect(r.texto).toContain("Ninguna de las 190 aulas del libro estaba en el plan");
    expect(r.texto).toContain("es de otro sorteo");
    expect(r.tono).toBe("atencion");
  });

  it("unas pocas nuevas junto a actualizaciones es lo normal y no alarma", () => {
    const r = avisoLibroImportado({
      ...base,
      fusion: { actualizadas: 188, nuevas: 2, intactas: 0 },
    });
    expect(r.texto).toContain("188 aulas del plan se actualizaron y 2 no estaban en él");
    expect(r.texto).not.toContain("otro sorteo");
    expect(r.tono).toBe("ok");
  });

  it("un primer libro sin plan previo no se acusa de nada", () => {
    // `intactas: 0` es la prueba de que no había plan: ahí «ninguna coincidió»
    // sólo significa que es el primero.
    const r = avisoLibroImportado({
      ...base,
      fusion: { actualizadas: 0, nuevas: 190, intactas: 0 },
    });
    expect(r.texto).not.toContain("otro sorteo");
    expect(r.tono).toBe("ok");
  });

  it("sin fusión el aviso queda como estaba", () => {
    const r = avisoLibroImportado(base);
    expect(r.texto).toContain("Entraron 190 aulas");
    expect(r.tono).toBe("ok");
  });

  it("los campos que la hoja no bautiza también se anuncian", () => {
    const r = avisoLibroImportado({ ...base, agenda_campos_ausentes: ["teacher_phone"] });
    expect(r.texto).toContain("no bautiza 1 campo");
    expect(r.tono).toBe("atencion");
  });
});
