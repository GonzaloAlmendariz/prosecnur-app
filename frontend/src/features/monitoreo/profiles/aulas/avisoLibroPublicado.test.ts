import { describe, expect, it } from "vitest";
import { avisoLibroPublicado } from "./avisoLibroPublicado";

/**
 * Qué pasó con cada hoja al publicar el libro en el Sheets del operativo.
 *
 * La regla de dueño de Gonzalo —«sin sobreescribir las dos primeras hojas, que
 * las llenan desde el sheets»— se cumple en el motor, pero si la UI no la
 * CUENTA, una hoja `respetada` se lee como una hoja que falló. El aviso es la
 * regla hecha visible.
 *
 * Números chicos a propósito: `fmt` usa es-PE y el runner sin ICU degrada el
 * separador de miles; por debajo de 1.000 el texto es igual en ambos.
 */

describe("avisoLibroPublicado", () => {
  it("cuenta la hoja de la app con su acción y sus filas", () => {
    const { texto, tono } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 174 }],
    });
    expect(texto).toContain("«Base de control» actualizada (174 filas)");
    expect(tono).toBe("ok");
  });

  it("una hoja respetada SIEMPRE lleva su motivo: es la regla de dueño, no un fallo", () => {
    const { texto } = avisoLibroPublicado({
      hojas: [
        { hoja: "Aulas Agendadas", accion: "respetada", filas: 45 },
        { hoja: "Aulas Aplicadas (Campo)", accion: "respetada", filas: 12 },
      ],
    });
    expect(texto).toContain("«Aulas Agendadas» respetada (45 filas): la llena el equipo");
    expect(texto).toContain("«Aulas Aplicadas (Campo)» respetada (12 filas): la llena el equipo");
  });

  it("una fila va en singular", () => {
    const { texto } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 1 }],
    });
    expect(texto).toContain("(1 fila)");
    expect(texto).not.toContain("(1 filas)");
  });

  it("sembrada y sin_cambios se dicen en la voz del operativo", () => {
    const { texto } = avisoLibroPublicado({
      hojas: [
        { hoja: "Aulas Agendadas", accion: "sembrada", filas: 196 },
        { hoja: "Base de control", accion: "sin_cambios", filas: 174 },
      ],
    });
    expect(texto).toContain("«Aulas Agendadas» sembrada (196 filas)");
    expect(texto).toContain("«Base de control» sin cambios");
    // `sin_cambios` es el nombre del motor, no copy: el guion bajo no sale.
    expect(texto).not.toContain("sin_cambios");
  });

  it("una acción desconocida viaja con su nombre: la lista es abierta", () => {
    // La lección de las listas cerradas: si mañana el motor declara una acción
    // nueva, el aviso la enseña en vez de tragársela.
    const { texto } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "reescrita", filas: 174 }],
    });
    expect(texto).toContain("«Base de control» reescrita (174 filas)");
  });

  it("cuando el enlace se acaba de recordar, lo dice", () => {
    const { texto } = avisoLibroPublicado({
      hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 3 }],
      destino_guardado: true,
    });
    expect(texto).toMatch(/enlace qued[óo] guardado/);
  });

  it("sin resumen por hoja no finge un verde: lo declara en tono de atención", () => {
    const { texto, tono } = avisoLibroPublicado({ hojas: [] });
    expect(tono).toBe("atencion");
    expect(texto.length).toBeGreaterThan(0);
  });
});
