import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { avanceDeRespuestas } from "./avanceRespuestas";

const lista = ["cola larga", "mal trato", "sin sillas", "horario corto"].map((texto_normalizado) => ({ texto_normalizado }));

describe("avance de la codificación de una pregunta", () => {
  test("cuenta las respuestas de la lista que tienen código", () => {
    const grupos = [{ respuestas: ["cola larga", "mal trato"] }, { respuestas: [] }];
    expect(avanceDeRespuestas(lista, grupos)).toEqual({ codificadas: 2, pendientes: 2, total: 4, huerfanas: 0 });
  });

  test("un código guardado para un texto que la base ya no trae no cuenta como avance", () => {
    // El caso real: 27 respuestas en la lista, 4 sin código, y el contador decía "27 de 27".
    const grupos = [{ respuestas: ["cola larga", "texto que ya no existe", "otro que tampoco"] }];
    const avance = avanceDeRespuestas(lista, grupos);
    expect(avance).toEqual({ codificadas: 1, pendientes: 3, total: 4, huerfanas: 2 });
    expect(avance.codificadas).toBeLessThanOrEqual(avance.total);
  });

  test("una respuesta con dos códigos cuenta una vez", () => {
    const grupos = [{ respuestas: ["cola larga"] }, { respuestas: ["cola larga", "mal trato"] }];
    expect(avanceDeRespuestas(lista, grupos)).toMatchObject({ codificadas: 2, pendientes: 2 });
  });

  test("codificadas y pendientes siempre suman el total y ninguna es negativa", () => {
    const grupos = [{ respuestas: ["a", "b", "c", "d", "e", "f", "cola larga"] }];
    const avance = avanceDeRespuestas(lista, grupos);
    expect(avance.codificadas + avance.pendientes).toBe(avance.total);
    expect(avance.pendientes).toBeGreaterThanOrEqual(0);
  });

  test("sin lista todavía, todo en cero", () => {
    expect(avanceDeRespuestas(null, [{ respuestas: ["x"] }])).toEqual({ codificadas: 0, pendientes: 0, total: 0, huerfanas: 1 });
  });
});

describe("la pantalla de Codificar usa esa única cuenta", () => {
  const leer = (archivo: string) => readFileSync(fileURLToPath(new URL(archivo, import.meta.url)), "utf8");
  const mesa = leer("./RespuestasCodificador.tsx");
  const cifras = leer("./codificar/CifrasDeCodificar.tsx");

  test("el contador no vuelve a contar todas las claves asignadas contra la lista", () => {
    expect(mesa).toMatch(/avanceDeCodificacion\(respuestas \?\? SIN_RESPUESTAS, grupos\)/);
    expect(mesa).not.toMatch(/asignaciones\.size/);
    // La cifra va en la cabecera de la pestaña, en respuestas (casos): número y base de la misma cuenta.
    expect(mesa).toMatch(/valor: formatoConteo\(avanceCod\.casosConCodigo\),\s*base: formatoConteo\(avanceCod\.casos\),\s*rotulo: "respuestas con código"/);
    // Junto a la barra solo van los casos: la cifra en respuestas no se repite.
    expect(cifras).not.toMatch(/respuestas con código/);
  });

  test("en una múltiple la cifra en casos dice que cuenta casos, no respuestas", () => {
    // La primera cifra cuenta respuestas distintas; la de casos lleva su propia palabra.
    expect(leer("./codificar/modeloDeCodificar.ts")).toMatch(/plural: "casos con código"/);
  });
});
