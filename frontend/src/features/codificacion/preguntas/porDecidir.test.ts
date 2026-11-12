// Preguntas: un estudio sin decisiones está "por decidir" (caso acnur_pdm recién abierto: decía "Decididas"
// y "18/18 no se codifican") y el filtro del prototipo "Cerradas con Otro" existe.
import { describe, expect, it } from "vitest";
import { armarUnidades, cifrasDePreguntas, contarFiltros, unidadEnFiltro } from "./modeloUnidades";
import { pregunta } from "./unidadesDePrueba";

const SIN_DECISIONES = armarUnidades([
  pregunta("t1", "text", { n_respuestas: 10, n_unicas: 8 }),
  pregunta("t2", "text", { n_respuestas: 4, n_unicas: 4 }),
  pregunta("c1", "select_one", { candidatos_texto: [{ col: "c1_otro", score: 1 } as never] }),
  pregunta("c2", "select_one"),
]);

describe("por decidir y cerradas con Otro", () => {
  it("sin decisiones, todo lo que tiene texto está por decidir y nada se codifica ni deja de codificarse", () => {
    expect(cifrasDePreguntas(SIN_DECISIONES)).toMatchObject({ conTexto: 2, seCodifican: 0, noSeCodifican: 0, porDecidir: 2 });
  });

  it("incluir una la saca de por decidir; registrar que no se codifica también", () => {
    const u = armarUnidades([
      pregunta("t1", "text", { marcada: true }),
      pregunta("t2", "text", { no_categorizar: { motivo: "Dato personal", decidido_en: "" } }),
      pregunta("t3", "text"),
    ]);
    expect(cifrasDePreguntas(u)).toMatchObject({ conTexto: 3, seCodifican: 1, noSeCodifican: 1, porDecidir: 1 });
  });

  it('"Cerradas con Otro" cuenta las cerradas que tienen un texto de "Otro" (pareja o candidato)', () => {
    const conteos = contarFiltros(SIN_DECISIONES);
    expect(conteos["cerradas-otro"]).toBe(1);
    expect(SIN_DECISIONES.filter((x) => unidadEnFiltro(x, "cerradas-otro")).map((x) => x.id)).toEqual(["c1"]);
    expect(conteos["por-decidir"]).toBe(2);
  });
});
