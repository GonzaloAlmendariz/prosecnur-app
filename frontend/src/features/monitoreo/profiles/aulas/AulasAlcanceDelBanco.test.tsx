import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasAlcanceDelBanco } from "./AulasAlcanceDelBanco";

const banco = {
  total: 4, disponibles: 4, elegibles: 400, mujeres: 200, hombres: 200,
  por_facultad: [
    { faculty: "Derecho", extras: 2, elegibles: 200, mujeres: 100, hombres: 100 },
    { faculty: "Letras", extras: 2, elegibles: 200, mujeres: 100, hombres: 100 },
  ],
  extras: [],
};

/** Tasa exacta del 50 % y dispersión cero: la banda no enturbia los asertos. */
const control = [
  { sent_total: 5, eligible_n: 10 },
  { sent_total: 10, eligible_n: 20 },
  { sent_total: 20, eligible_n: 40 },
];

const cuota = (filas: Array<[string, number, number]>) =>
  filas.map(([faculty, target, observed]) => ({ faculty, sex: "F", target, observed }));

describe("AulasAlcanceDelBanco", () => {
  it("dice que no alcanza y enseña la cuenta optimista al lado", () => {
    // Derecho rinde 100 y le faltan 20 —le sobra—; Letras rinde 100 y le faltan
    // 300. Por facultad faltan 200; restando totales, 120. La diferencia entre
    // las dos cuentas es justo lo que el panel existe para no dejar pasar.
    const html = renderToStaticMarkup(
      <AulasAlcanceDelBanco banco={banco} control={control} agenda={[]} partes={[]} quotas={cuota([["Derecho", 20, 0], ["Letras", 300, 0]])} />,
    );
    expect(html).toContain("El banco no alcanza para cerrar la cuota");
    // Sobre el TEXTO, no sobre el markup: `<strong>200</strong>` aparece también
    // en «rinde 200 encuestas» de la lectura de arriba, así que buscarlo suelto
    // no distinguía el déficit por facultad de la cifra optimista. Un mutante
    // que intercambiaba las dos sobrevivió a ese aserto.
    const texto = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    expect(texto).toContain("faltarían 200 encuestas tras vaciar el banco");
    expect(texto).toContain("restando totales saldrían 120");
    // Sólo Letras tiene déficit; Derecho no debe aparecer como problema.
    expect(html).toContain("Letras");
    expect(html).not.toContain("Derecho");
  });

  it("cuando cubre, lo dice sin lista de problemas", () => {
    const html = renderToStaticMarkup(
      <AulasAlcanceDelBanco banco={banco} control={control} agenda={[]} partes={[]} quotas={cuota([["Derecho", 20, 0], ["Letras", 30, 0]])} />,
    );
    expect(html).toContain("El banco alcanza para cerrar la cuota");
    expect(html).toContain("Ninguna facultad se queda corta");
    expect(html).not.toContain("aulas-alcance-lista");
  });

  it("la frase dice que el denominador es la agenda acabada, no lo de hoy", () => {
    // El reparto por facultad se prueba en `faltaTrasLaAgenda`, que es donde
    // vive y donde se puede sembrar sin montar la maquinaria de la proyección.
    // Aquí se fija lo que la pantalla promete: que esa cifra NO es «lo que
    // falta hoy», porque el banco se abre cuando la agenda se acaba.
    const html = renderToStaticMarkup(
      <AulasAlcanceDelBanco banco={banco} control={control} agenda={[]} partes={[]}
        quotas={cuota([["Letras", 300, 0]])} />,
    );
    expect(html).toContain("cuando se acabe la agenda");
    expect(html.replace(/<[^>]+>/g, "")).not.toContain("y faltan 300");
  });

  it("con pocos desenlaces no descuenta caída: sería ruido, no una tasa", () => {
    // Con tres titulares resueltos, «se cae el 33 %» es un accidente, y meterlo
    // en la proyección mueve el veredicto por azar. El panel prefiere quedarse
    // corto a inventar un descuento.
    const titular = (i: number, caido: boolean) => ({
      operational_code: `CH ${i}`, sample_role: "titular",
      sample_status: caido ? "reemplazada" : "aplicada",
      operational_status: "aplicada", faculty: "Letras",
    });
    const pocos = [titular(1, true), titular(2, false), titular(3, false)] as never;
    const html = renderToStaticMarkup(
      <AulasAlcanceDelBanco banco={banco} control={control} agenda={pocos} partes={[]}
        quotas={cuota([["Letras", 300, 0]])} />,
    );
    expect(html).not.toContain("que se cae");

    // El control: con desenlaces suficientes SÍ descuenta, así que el aserto de
    // arriba distingue las dos ramas y no pasa por vacío.
    const muchos = Array.from({ length: 30 }, (_, i) => titular(i + 1, i < 6)) as never;
    const conTasa = renderToStaticMarkup(
      <AulasAlcanceDelBanco banco={banco} control={control} agenda={muchos} partes={[]}
        quotas={cuota([["Letras", 300, 0]])} />,
    );
    expect(conTasa).toContain("que se cae");
  });

  it("sin Base de control no proyecta: dice qué falta y de dónde sale", () => {
    // C5 categoría 1. Inventar una tasa para poder pintar el panel sería
    // exactamente lo que el contrato prohíbe.
    const html = renderToStaticMarkup(
      <AulasAlcanceDelBanco banco={banco} control={[]} agenda={[]} partes={[]} quotas={cuota([["Letras", 300, 0]])} />,
    );
    expect(html).toContain("hace falta la hoja «Base de control»");
    expect(html).not.toContain("aulas-alcance-titular");
  });

  it("la tasa y su dispersión se declaran, no se esconden", () => {
    const html = renderToStaticMarkup(
      <AulasAlcanceDelBanco banco={banco} control={control} agenda={[]} partes={[]} quotas={cuota([["Letras", 300, 0]])} />,
    );
    expect(html).toContain("50,0 %");
    expect(html).toContain("medida en 3 aulas");
  });
});
