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

/**
 * A1 (loop estética-aulas-sheets, 2026-09-07). Desde `732c4221` publicar LEE
 * las hojas del equipo antes de escribir y el recibo trae `lectura_previa`;
 * el día 1 de campo el encargado llevaba siete partes tecleados y la Base de
 * control publicada enseñaba uno, y nada en pantalla decía si se había leído.
 * El aviso cuenta esa lectura: qué trajo, o por qué no pudo y qué hacer.
 */
describe("avisoLibroPublicado: la lectura previa", () => {
  const hojas = [{ hoja: "Base de control", accion: "actualizada", filas: 9 }];

  it("cuenta lo que se leyó del equipo antes de escribir, delante de las hojas", () => {
    const { texto, tono } = avisoLibroPublicado({
      hojas,
      lectura_previa: {
        ok: true,
        omitida: false,
        error: "",
        resumen: { unidades: 174, partes_de_campo: 7, filas_de_control: 9 },
      },
    });
    expect(texto).toMatch(/^Antes de escribir se leyó lo del equipo: 7 partes de campo y 9 filas de control\./);
    expect(texto).toContain("Libro publicado:");
    expect(tono).toBe("ok");
  });

  it("uno va en singular", () => {
    const { texto } = avisoLibroPublicado({
      hojas,
      lectura_previa: { ok: true, resumen: { partes_de_campo: 1, filas_de_control: 1 } },
    });
    expect(texto).toContain("1 parte de campo y 1 fila de control");
  });

  it("si la lectura falló lo dice con su causa y la salida, y el libro se publicó igual", () => {
    const { texto, tono } = avisoLibroPublicado({
      hojas,
      lectura_previa: { ok: false, omitida: false, error: "HTTP 403", resumen: {} },
    });
    expect(texto).toContain("No se pudo leer el Sheets antes de publicar (HTTP 403)");
    expect(texto).toContain("se publicó con lo que la app ya tenía");
    expect(texto).toContain("Traer respuestas");
    expect(texto).toContain("Libro publicado:");
    expect(tono).toBe("atencion");
  });

  it("omitida (quien llamó ya había leído) o ausente (recibo viejo): no inventa una lectura", () => {
    const omitida = avisoLibroPublicado({ hojas, lectura_previa: { omitida: true } });
    expect(omitida.texto).not.toMatch(/ley[óo]|leer/);
    const ausente = avisoLibroPublicado({ hojas });
    expect(ausente.texto).not.toMatch(/ley[óo]|leer/);
    expect(omitida.tono).toBe("ok");
  });

  it("sin em dashes en el texto visible", () => {
    const { texto } = avisoLibroPublicado({
      hojas,
      lectura_previa: { ok: false, error: "HTTP 403", resumen: {} },
    });
    expect(texto).not.toContain("\u2014");
  });
});
