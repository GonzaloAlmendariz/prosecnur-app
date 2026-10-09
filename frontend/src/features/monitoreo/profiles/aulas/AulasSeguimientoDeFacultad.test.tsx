import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasSeguimientoDeFacultad } from "./AulasSeguimientoDeFacultad";
import type { SeguimientoDeFacultad } from "./seguimientoDeFacultad";

/**
 * Ítem 32: las siete preguntas que Gonzalo hizo de una tirada sobre una
 * facultad puesta en el selector.
 */
const base: SeguimientoDeFacultad = {
  facultad: "DERECHO",
  agendados: 6, aplicados: 2, sinAgendar: 5, ultimaFecha: "2026-09-22",
  relevosVivos: 12, extrasDisponibles: 3,
  cuotas: [
    { clave: "total", etiqueta: "En total", meta: 363, obtenidas: 136, proyectadas: 97, brecha: -130 },
    { clave: "hombres", etiqueta: "Hombres", meta: 126, obtenidas: 57, proyectadas: 42, brecha: -27 },
    { clave: "mujeres", etiqueta: "Mujeres", meta: 237, obtenidas: 79, proyectadas: 78, brecha: -80 },
  ],
  faltaAlguna: true,
};

describe("el seguimiento de una facultad", () => {
  it("contesta las tres primeras: agendadas, sin fecha y hasta cuándo", () => {
    const html = renderToStaticMarkup(<AulasSeguimientoDeFacultad seguimiento={base} />);
    expect(html).toContain("<strong>6</strong> cursos-horario agendados");
    expect(html).toContain("<strong>5</strong> sin fecha todavía");
    expect(html).toContain("22/09");
  });

  it("enseña las TRES metas, no sólo el total", () => {
    const html = renderToStaticMarkup(<AulasSeguimientoDeFacultad seguimiento={base} />);
    expect(html).toContain("Hombres");
    expect(html).toContain("Mujeres");
    expect((html.match(/aulas-segfac-carril/g) ?? []).length).toBe(3);
    expect(html).toContain("faltan 80");
  });

  it("antes de pedir aulas nuevas nombra lo que ya está sorteado", () => {
    const html = renderToStaticMarkup(<AulasSeguimientoDeFacultad seguimiento={base} />);
    expect(html).toContain("Con lo agendado no llega");
    expect(html).toContain("relevos de la cadena");
    expect(html).toContain("banco de extras");
  });

  it("sin relevos ni extras lo dice: cerrar exige aulas nuevas", () => {
    const html = renderToStaticMarkup(
      <AulasSeguimientoDeFacultad seguimiento={{ ...base, relevosVivos: 0, extrasDisponibles: 0 }} />,
    );
    expect(html).toContain("cerrar exige aulas nuevas");
  });

  it("una brecha que no se puede proyectar NO se pinta como que falta", () => {
    // Tratar la falta de dato como alarma es el defecto que este perfil lleva
    // media sesión desmontando.
    const html = renderToStaticMarkup(
      <AulasSeguimientoDeFacultad seguimiento={{
        ...base, faltaAlguna: false,
        cuotas: [{ clave: "total", etiqueta: "En total", meta: 363, obtenidas: 136, proyectadas: null, brecha: null }],
      }} />,
    );
    expect(html).toContain("sin proyección");
    expect(html).not.toContain("faltan");
  });

  it("sin cuota declarada lo dice, en vez de dibujar carriles vacíos", () => {
    const html = renderToStaticMarkup(
      <AulasSeguimientoDeFacultad seguimiento={{ ...base, cuotas: [], faltaAlguna: false }} />,
    );
    expect(html).toContain("no tiene cuota declarada");
    expect(html).not.toContain("aulas-segfac-carril");
  });

  it("sin facultad puesta no se monta", () => {
    expect(renderToStaticMarkup(<AulasSeguimientoDeFacultad seguimiento={null} />)).toBe("");
  });
});
