// «Regla de preguntas» pintada (ADR 0135 §2, §4 y §8): el rótulo con su «?», los tipos como radios, la cifra, el conteo
// visible («2 de 47») con el texto de la nota tal cual, la lista con un interruptor por fila (sin casillas) y «Volver a la
// regla» sólo con la lista ajustada. Espera, error y vacío salen con las piezas del kit.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ConteoEnVivo } from "./useConteoRegla";

const estado = vi.hoisted(() => ({ actual: null as ConteoEnVivo | null }));
vi.mock("./useConteoRegla", () => ({ useConteoRegla: () => estado.actual }));

import { ReglaPreguntas } from "./ReglaPreguntas";

const CONTEO: ConteoEnVivo = {
  cargando: false, error: null, codigo: null,
  conteo: {
    total: 47, seleccionadas: ["p1", "p2"],
    candidatas: [
      { tema: "p1", etiqueta: "Reglamentos se aplican", metrica: 27, seleccionada: true },
      { tema: "p2", etiqueta: "Docentes actualizados", metrica: 26, seleccionada: true },
      { tema: "p3", etiqueta: "Bienestar psicológico", metrica: 2, seleccionada: false },
    ],
    texto_regla: "Se muestran las 2 de mayor diferencia, de 47 preguntas comunes.",
    avisos: ["3 preguntas quedan fuera: no forman un par comparable en las dos bases."],
  },
};

const pintar = (valor: unknown, conteo: ConteoEnVivo | null = CONTEO, graficador = "p_dumbbell") => {
  estado.actual = conteo ?? { conteo: null, cargando: false, error: null, codigo: null };
  return renderToStaticMarkup(
    <ReglaPreguntas rotulo="Regla de preguntas" ayuda="Regla con que se eligen los temas." graficador={graficador}
      args={{ estilo: "resumen", regla: valor }} valor={valor} scope="active" onCambio={() => undefined} />,
  );
};

describe("ReglaPreguntas", () => {
  it("rótulo con «?», tipos como radios, cifra, conteo y texto de la nota", () => {
    const html = pintar({ tipo: "mayor_diferencia", n: 2 });
    expect(html).toContain("Regla de preguntas");
    expect(html).toContain("Qué es “Regla de preguntas”");
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(4);
    expect(html).toMatch(/aria-checked="true"[^>]*>(<[^>]+>)*Las de mayor diferencia/);
    expect(html).toContain("Cuántas");
    expect(html).toContain("2 de 47");
    expect(html).toContain("Se muestran las 2 de mayor diferencia, de 47 preguntas comunes.");
    expect(html).toContain("no forman un par comparable");
    expect(html).toContain("Diferencia");
    expect(html).not.toContain("Volver a la regla");
  });

  it("la lista lleva un interruptor por fila y ninguna casilla; es dueña de su scroll", () => {
    const html = pintar({ tipo: "mayor_diferencia", n: 2 });
    expect(html.match(/role="switch"/g)).toHaveLength(3);
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("<table");
    expect(html).toContain('data-qa-scroll-owner="regla-preguntas"');
    expect(html).toContain("Bienestar psicológico");
  });

  it("con la lista ajustada a mano ofrece volver a la regla", () => {
    expect(pintar({ tipo: "mayor_diferencia", n: 2, quitar: ["p1"] })).toContain("Volver a la regla");
    expect(pintar({ tipo: "a_mano", agregar: ["p1"] })).not.toContain("Volver a la regla");
  });

  it("sin regla no pide conteo y lo dice en una línea", () => {
    const html = pintar(undefined, null, "p_panorama");
    expect(html).toContain("Sin regla salen las preguntas declaradas.");
    expect(html).not.toContain('aria-checked="true"');
    expect(html).not.toContain('role="switch"');
  });

  it("espera, error y vacío con las piezas del kit", () => {
    expect(pintar({ tipo: "todas" }, { conteo: null, cargando: true, error: null, codigo: null }, "p_panorama")).toContain("Contando las preguntas");
    const error = pintar({ tipo: "comunes" }, { conteo: null, cargando: false, error: "La regla «comunes» compara grupos y la lámina tiene uno solo.", codigo: "E_REGLA_PREGUNTAS_INVALIDA" }, "p_panorama");
    expect(error).toContain('role="alert"');
    expect(error).toContain("compara grupos");
    const vacio = pintar({ tipo: "todas" }, { ...CONTEO, conteo: { ...CONTEO.conteo!, total: 0, seleccionadas: [], candidatas: [] } }, "p_panorama");
    expect(vacio).toContain("Sin preguntas candidatas");
    expect(vacio).toContain("0 de 0");
  });

  it("la cifra es un slider con su valor escrito, sobre el reparto con la línea del corte", () => {
    const html = pintar({ tipo: "mayor_diferencia", n: 2 });
    expect(html).toMatch(/<input[^>]*type="range"[^>]*min="0"[^>]*max="3"[^>]*value="2"/);
    expect(html).toMatch(/<input[^>]*type="range"[^>]*aria-labelledby="[^"]+-cifra-rotulo"/);
    expect(html).toMatch(/<input[^>]*class="pulso-f6-input pulso-f6-regla-numero"[^>]*value="2"/);
    expect(html).toContain('role="img"');
    expect(html).toMatch(/class="pulso-f6-regla-reparto-corte" data-corte="2"/);
    expect(html.match(/pulso-f6-regla-reparto-barra is-entra/g)).toHaveLength(2);
    expect(html).toContain("data-qa-geometry-member");
    expect(html.match(/class="pulso-f6-regla-minibarra( is-entra)?"/g)).toHaveLength(3);
    expect(html).toContain("Corte en 26 pts");   // R2: con su unidad, para que no se lea como un conteo
    expect(html).toMatch(/<input[^>]*type="range"[^>]*step="any"/);   // R1: el pulgar sigue al valor exacto
    expect(html).toContain(">1.º<");
    expect(html).toContain(">3.º<");
    expect(html).not.toContain("La lámina nativa admite");   // sin tope_filas no hay límite
  });

  it("por umbral el reparto va sobre 0–100 con el corte en el umbral; el límite de la lámina va junto al corte", () => {
    const aviso = "3 preguntas bajo 60%; la lámina nativa admite 2 y la escala sale como imagen.";
    const html = pintar({ tipo: "bajo_umbral", umbral: 60 }, { ...CONTEO, conteo: { ...CONTEO.conteo!, seleccionadas: ["p3", "p2", "p1"], avisos: [aviso], tope_filas: 2 } }, "p_barras_divergentes");
    expect(html).toMatch(/<input[^>]*type="range"[^>]*min="0"[^>]*max="100"[^>]*value="60"/);
    expect(html).toMatch(/class="pulso-f6-regla-reparto-corte" data-corte="60"[^>]*x1="60\.000%"/);
    expect(html.match(/<circle class="pulso-f6-regla-reparto-punto/g)).toHaveLength(3);
    const corte = html.slice(html.indexOf("pulso-f6-regla-corte"), html.indexOf("pulso-f6-regla-resultado"));
    // Entran 3 y el límite es 2: pasa a aviso.
    expect(corte).toMatch(/class="pulso-f6-regla-tope is-excedido"[^>]*title="3 preguntas bajo 60%/);
    expect(corte).toMatch(/La lámina nativa admite (<!-- -->)?2</);
    expect(html).toContain("pulso-f6-regla-reparto-tope");
    expect(html.split(aviso)).toHaveLength(2);   // sólo en el título del chip: no se repite en la lista de avisos
  });

  it("98/99 con 3 filas: el chip pasa a aviso con la causa del motor y su aviso no se repite en la lista", () => {
    const motivo = "Hay dos opciones sin información; la lámina nativa admite una y la escala sale como imagen.";
    const html = pintar({ tipo: "bajo_umbral", umbral: 10 }, { ...CONTEO, conteo: { ...CONTEO.conteo!, avisos: [motivo], tope_filas: 20, cabe_nativa: false, motivo_imagen: motivo } }, "p_barras_divergentes");
    expect(html).toMatch(/class="pulso-f6-regla-tope is-excedido"[^>]*title="Hay dos opciones sin información/);
    expect(html).toContain('data-causa="sin-informacion"');
    expect(html.split(motivo)).toHaveLength(3);   // el título y el texto del chip; ninguno en la lista de avisos
    expect(html).not.toContain("pulso-f6-regla-reparto-tope");   // el tope por filas no se pasa
  });

  it("el límite se ve en tono neutro mientras la selección cabe", () => {
    const html = pintar({ tipo: "bajo_umbral", umbral: 10 }, { ...CONTEO, conteo: { ...CONTEO.conteo!, avisos: [], tope_filas: 20 } }, "p_barras_divergentes");
    expect(html).toMatch(/class="pulso-f6-regla-tope"/);
    expect(html).not.toContain("is-excedido");
    expect(html).not.toContain("pulso-f6-regla-reparto-tope");
  });

  it("C3: con ninguna candidata dentro, la línea del corte va arriba de la lista", () => {
    const todo = pintar({ tipo: "bajo_umbral", umbral: 0 }, CONTEO, "p_barras_divergentes");
    const lista = todo.slice(todo.indexOf("pulso-f6-regla-filas"));
    expect(lista.indexOf(">Corte<")).toBeGreaterThan(-1);
    expect(lista.indexOf(">Corte<")).toBeLessThan(lista.indexOf("data-tema="));
  });

  it("las filas siguen el orden de la lámina, con la línea del corte y los empates rotulados", () => {
    const conteo: ConteoEnVivo = { ...CONTEO, conteo: { ...CONTEO.conteo!, seleccionadas: ["p1", "p2"], candidatas: [
      { tema: "p3", etiqueta: "Bienestar psicológico", metrica: 2, seleccionada: false },
      { tema: "p2", etiqueta: "Docentes actualizados", metrica: 20, seleccionada: true },
      { tema: "p1", etiqueta: "Reglamentos se aplican", metrica: 27, seleccionada: true },
      { tema: "p4", etiqueta: "Trámites claros", metrica: 20, seleccionada: false },
    ] } };
    const todo = pintar({ tipo: "mayor_diferencia", n: 2 }, conteo);
    const html = todo.slice(todo.indexOf("pulso-f6-regla-filas"));
    const pos = (t: string) => html.indexOf(t);
    expect(pos("Reglamentos se aplican")).toBeLessThan(pos("Docentes actualizados"));
    expect(pos("Docentes actualizados")).toBeLessThan(pos(">Corte<"));
    expect(pos(">Corte<")).toBeLessThan(pos("Trámites claros"));
    expect(pos("Trámites claros")).toBeLessThan(pos("Bienestar psicológico"));
    expect(html.match(/>Empate</g)).toHaveLength(2);
  });
  it("R6-13: con un tipo nuevo y el conteo en camino, carga en vez de un número falso", () => {
    // useConteoRegla ya no presta el conteo del tipo anterior: llega `conteo: null` con `cargando`.
    const html = pintar({ tipo: "mayor_sin_info", n: 5 }, { conteo: null, cargando: true, error: null, codigo: null });
    expect(html).toContain("Contando las preguntas");
    expect(html).not.toMatch(/\d+ de \d+/);
    expect(html).not.toContain("Sin dato");
  });

  it("R8-1: la brecha guardada sin preguntas no promete «N de M en la lámina»", () => {
    estado.actual = CONTEO;
    const regla = { tipo: "mayor_diferencia", n: 2 };
    const html = renderToStaticMarkup(
      <ReglaPreguntas rotulo="Regla de preguntas" ayuda="" graficador="p_dumbbell"
        args={{ estilo: "resumen", regla, cruce: "docentes$p6", grupos: ["1", "2"], vars: [] }} valor={regla} scope="active" onCambio={() => undefined} />,
    );
    expect(html).toContain("La lámina sale vacía: faltan sus preguntas.");
    expect(html).not.toContain("</strong><span> en la lámina");
  });
});
