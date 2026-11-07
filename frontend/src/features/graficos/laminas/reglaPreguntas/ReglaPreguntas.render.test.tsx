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
});
