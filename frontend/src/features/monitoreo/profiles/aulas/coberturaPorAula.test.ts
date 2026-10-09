import { describe, expect, it } from "vitest";

import { coberturaPorAula } from "./coberturaPorAula";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const aula = (validas: number, meta: number) =>
  ({ respuestas_validas: validas, expected_valid: meta }) as unknown as MonitoreoAulasPlanRow;

/**
 * **Por clave, nunca por índice.** Estos tests indexaban `tramos[4]`, así que
 * recortar las bandas los hacía fallar con un mensaje sobre etiquetas en vez de
 * sobre lo que se mide, y —peor— un recorte que dejara el mismo número de
 * bandas habría pasado en verde con los números cambiados de sitio.
 */
const por = (r: ReturnType<typeof coberturaPorAula>, clave: string) =>
  r.tramos.find((t) => t.clave === clave);

describe("cobertura por curso-horario", () => {
  it("separa «sin respuestas» de «poquísimas»", () => {
    // Es la distinción que decide si el aula ni siquiera se abrió. Con un
    // reparto puramente proporcional, 0 y 1 de 20 caerían en el mismo tramo.
    const r = coberturaPorAula([aula(0, 20), aula(1, 20)]);
    expect(por(r, "nulo")).toMatchObject({ etiqueta: "Sin respuestas", aulas: 1 });
    expect(por(r, "critico")?.aulas).toBe(1);
  });

  it("la meta cumplida incluye pasarse de ella", () => {
    // Un aula puede superar su meta: entra en el mismo tramo que la cumple
    // exacta, porque operativamente ya no hay nada que hacer allí.
    const r = coberturaPorAula([aula(20, 20), aula(25, 20)]);
    expect(por(r, "pleno")?.aulas).toBe(2);
  });

  it("un aula sin meta se cuenta aparte, no se fuerza a un tramo", () => {
    // Meterla en 0 % o en 100 % serían dos mentiras distintas.
    const r = coberturaPorAula([aula(5, 0), aula(5, 10)]);
    expect(r.sinMeta).toBe(1);
    expect(r.tramos.reduce((a, t) => a + t.aulas, 0)).toBe(1);
  });

  it("la forma distingue dos avances globales idénticos", () => {
    // 60 al 50 % y 60 al 100 % promedian lo mismo que 120 al 75 %, y piden
    // decisiones opuestas. El gráfico existe para que eso se vea.
    const mitad = Array.from({ length: 60 }, () => aula(10, 20));
    const llenas = Array.from({ length: 60 }, () => aula(20, 20));
    const medias = Array.from({ length: 120 }, () => aula(15, 20));

    const a = coberturaPorAula([...mitad, ...llenas]);
    const b = coberturaPorAula(medias);
    // 10/20 = 0,50 cae en «crítico»; 15/20 = 0,75 en «insuficiente». El corte
    // anterior metía las dos en la misma banda: ésa era la forma que el gráfico
    // no dejaba ver.
    expect(por(a, "critico")?.aulas).toBe(60);
    expect(por(a, "pleno")?.aulas).toBe(60);
    expect(por(b, "insuficiente")?.aulas).toBe(120);
    expect(por(b, "pleno")?.aulas).toBe(0);
    expect(por(b, "critico")?.aulas).toBe(0);
  });

  it("sin aulas no inventa tramos con contenido", () => {
    const r = coberturaPorAula([]);
    expect(r.total).toBe(0);
    expect(r.tramos.every((t) => t.aulas === 0)).toBe(true);
  });

  it("las claves son las del motor R, en orden y completas", () => {
    // El motor publica `course_status_cobertura` con estas seis claves y el
    // gráfico empareja por ellas. Si una de las dos definiciones cambia sin la
    // otra, la barra queda en cero sin que nada falle: este test es el único
    // punto donde las dos listas se miran a la cara.
    expect(coberturaPorAula([]).tramos.map((t) => t.clave)).toEqual([
      "nulo", "critico", "insuficiente", "parcial", "satisfactorio", "pleno",
    ]);
  });
});
