import { describe, expect, it } from "vitest";

import { interpretarEntrada, tieneContenido } from "./gramatica";

describe("interpretarEntrada", () => {
  it("sin tokens guarda una nota del proyecto", () => {
    // El tipo se SUGIERE, nunca bloquea: escribir y dar Enter tiene que
    // funcionar sin aprender ninguna sintaxis.
    const out = interpretarEntrada("Se cayó el enlace de Kobo");
    expect(out.titulo).toBe("Se cayó el enlace de Kobo");
    expect(out.tono).toBe("nota");
    expect(out.moduloId).toBe("diseno-estudio");
    expect(out.etiquetas).toEqual([]);
  });

  it("reconoce tono, módulo y etiquetas en línea", () => {
    const out = interpretarEntrada("Se cayó el enlace !bloqueo @monitoreo #campo");
    expect(out.tono).toBe("bloqueo");
    expect(out.moduloId).toBe("monitoreo");
    expect(out.etiquetas).toEqual(["campo"]);
    expect(out.titulo).toBe("Se cayó el enlace");
  });

  it("los tokens pueden ir en cualquier posición", () => {
    const out = interpretarEntrada("!riesgo La cuota de Ate no cierra @carga");
    expect(out.tono).toBe("riesgo");
    expect(out.moduloId).toBe("carga");
    expect(out.titulo).toBe("La cuota de Ate no cierra");
  });

  it("acepta alias y acentos", () => {
    expect(interpretarEntrada("x !decisión").tono).toBe("decision");
    expect(interpretarEntrada("x !incidencia").tono).toBe("riesgo");
    expect(interpretarEntrada("x @tablero").moduloId).toBe("dashboard");
    expect(interpretarEntrada("x @muestra").moduloId).toBe("calc-muestra");
  });

  it("un token desconocido se queda en el texto en vez de desaparecer", () => {
    // Tragarse en silencio lo que el usuario escribió es peor que ignorar el
    // atajo: la entrada guardada diría algo distinto de lo que se tecleó.
    const out = interpretarEntrada("Reunión con el cliente !urgentisimo");
    expect(out.tono).toBe("nota");
    expect(out.titulo).toBe("Reunión con el cliente !urgentisimo");
  });

  it("un módulo desconocido tampoco se traga", () => {
    const out = interpretarEntrada("Nota @inventado");
    expect(out.moduloId).toBe("diseno-estudio");
    expect(out.titulo).toContain("@inventado");
  });

  it("cualquier etiqueta vale y se deduplica", () => {
    const out = interpretarEntrada("Nota #campo #Campo #ate");
    expect(out.etiquetas).toEqual(["campo", "ate"]);
  });

  it("las etiquetas se acotan", () => {
    const out = interpretarEntrada("Nota " + Array.from({ length: 20 }, (_, i) => `#e${i}`).join(" "));
    expect(out.etiquetas).toHaveLength(8);
  });

  it("la primera línea es el título y el resto el cuerpo", () => {
    const out = interpretarEntrada("Cuota en rojo\nFaltan 40 encuestas en Ate.\nSe habló con la UMP.");
    expect(out.titulo).toBe("Cuota en rojo");
    expect(out.cuerpo).toBe("Faltan 40 encuestas en Ate.\nSe habló con la UMP.");
  });

  it("una sola línea deja el cuerpo vacío sin obligar a llenarlo", () => {
    const out = interpretarEntrada("Se destrabó el permiso");
    expect(out.cuerpo).toBe("");
  });

  it("el último tono declarado gana", () => {
    expect(interpretarEntrada("x !nota y !bloqueo").tono).toBe("bloqueo");
  });

  it("informa los tokens reconocidos para pintarlos como chips", () => {
    const out = interpretarEntrada("Nota !avance @carga #datos");
    expect(out.reconocidos.map((r) => r.tipo).sort()).toEqual(["etiqueta", "modulo", "tono"]);
  });

  it("un texto vacío da el título por defecto en vez de una entrada muda", () => {
    expect(interpretarEntrada("").titulo).toBe("Nota de bitácora");
  });

  it("colapsa los espacios que dejan los tokens al retirarse", () => {
    const out = interpretarEntrada("Antes !avance  después");
    expect(out.titulo).toBe("Antes después");
  });
});

describe("tieneContenido", () => {
  it.each([
    ["", false],
    ["   ", false],
    ["!avance @carga #x", false],
    ["Algo", true],
    ["!avance Algo", true],
  ])("%s => %s", (crudo, esperado) => {
    expect(tieneContenido(crudo)).toBe(esperado);
  });
});
