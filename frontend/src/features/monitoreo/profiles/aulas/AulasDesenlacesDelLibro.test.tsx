import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasDesenlacesDelLibro } from "./AulasDesenlacesDelLibro";
import { desenlacesDelLibro } from "./desenlacesDelLibro";

/**
 * Reemplazo (A), complemento (B) y refuerzo (C). El corte del 2026-09-10:
 * cuatro tipo A en curso —dos de DERECHO— y ninguno declarado todavía en el
 * libro, porque el verbo se teclea al aplicar.
 */
const payload = {
  reemplazadas: {
    total: 4, declarados: 0, en_curso: 4,
    por_facultad: [
      { facultad: "DERECHO", aulas: 2 },
      { facultad: "ARTE Y DISEÑO", aulas: 1 },
      { facultad: "CIENCIAS E INGENIERIA", aulas: 1 },
    ],
    aulas: [],
  },
  complementadas: { total: 0, declarados: 0, en_curso: 0, por_facultad: [], aulas: [] },
  refuerzos: { total: 0, declarados: 0, en_curso: 0, por_facultad: [], aulas: [] },
  caidos_sin_relevo: 0,
  sin_aula_utilizada: 0,
  total: 4,
};

const pinta = (facultad?: string) =>
  renderToStaticMarkup(
    <AulasDesenlacesDelLibro desenlaces={desenlacesDelLibro(payload, facultad)} />,
  );

describe("los tres desenlaces del libro", () => {
  it("dibuja las TRES letras, también las que están en cero", () => {
    // Un tipo que desaparece cuando no ha pasado nunca deja al lector sin saber
    // que existe, y son las tres decisiones que el operativo puede tomar.
    const html = pinta();
    expect(html).toContain(">A<");
    expect(html).toContain(">B<");
    expect(html).toContain(">C<");
    expect((html.match(/es-cero/g) ?? []).length).toBe(2);
  });

  it("separa lo que el libro declara de lo que el campo ya vive", () => {
    const html = pinta();
    expect(html).toContain("el campo ya vive y el libro todavía no dice");
    expect(html).toContain("sin declarar");
  });

  it("con una facultad puesta cuenta los suyos", () => {
    // «Pero si ya han habido tipo A, en Derecho por ejemplo» (Gonzalo).
    const html = pinta("DERECHO");
    expect(html).toContain("<strong>2</strong>");
    expect(html).not.toContain("ARTE Y DISEÑO");
  });

  it("compara los nombres sin tildes ni mayúsculas, como todo el perfil", () => {
    expect(pinta("arte y diseno")).toContain("ARTE Y DISEÑO");
  });

  it("sin ningún relevo lo dice, en vez de enseñar tres ceros mudos", () => {
    const vacio = { ...payload, total: 0, reemplazadas: { total: 0, declarados: 0, en_curso: 0, por_facultad: [], aulas: [] } };
    expect(renderToStaticMarkup(<AulasDesenlacesDelLibro desenlaces={desenlacesDelLibro(vacio)} />))
      .toContain("Ningún curso-horario ha necesitado reemplazo");
  });

  it("un titular caído sin relevo se cuenta aparte: su hueco sigue abierto", () => {
    const html = renderToStaticMarkup(
      <AulasDesenlacesDelLibro desenlaces={desenlacesDelLibro({ ...payload, caidos_sin_relevo: 3 })} />,
    );
    expect(html).toContain("su hueco sigue abierto");
  });

  it("avisa de los que no dicen CON QUÉ se resolvieron", () => {
    const html = renderToStaticMarkup(
      <AulasDesenlacesDelLibro desenlaces={desenlacesDelLibro({ ...payload, sin_aula_utilizada: 2 })} />,
    );
    expect(html).toContain("no dicen con qué");
  });

  it("un tablero viejo sin el bloque declara la ausencia", () => {
    const html = renderToStaticMarkup(<AulasDesenlacesDelLibro desenlaces={desenlacesDelLibro(null)} />);
    expect(html).toContain("versión anterior del cálculo");
  });
});
