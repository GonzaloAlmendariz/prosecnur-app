import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AulasFinalesCard } from "../AulasFinalesCard";

/**
 * Una lista larga con un control por fila es una trampa de teclado.
 *
 * Medido: 646 filas × 1 conmutador = **646 paradas de tabulación** para pasar de
 * esta lista. El contenido era alcanzable sólo si nadie usa el teclado. Es el
 * mismo defecto que el vuelco de píxeles de la lista de sexo, en otro eje.
 *
 * La ventana se acota y la profundidad se declara; el buscador de la cabecera
 * llega a cualquier fila sin recorrerlas una a una.
 */
function aulas(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    classroomKey: `ch-${i}`,
    label: `Curso ${i}`,
    detalle: `Sección ${i}`,
    eligibleN: 100 - (i % 50),
  }));
}

function render(n: number) {
  return renderToStaticMarkup(
    <AulasFinalesCard
      aulas={aulas(n) as never}
      seleccion={{ mode: "include" } as never}
      facLabel="Derecho"
      onToggle={vi.fn()}
      onReactivarTodas={vi.fn()}
    />,
  );
}

describe("AulasFinalesCard · coste de teclado", () => {
  it("no renderiza cientos de conmutadores de una vez", () => {
    const filas = (render(646).match(/cmv2-aulas-finales-row/g) ?? []).length;
    expect(filas).toBeLessThanOrEqual(40);
    expect(filas).toBeGreaterThan(0);
  });

  it("declara cuántos hay y cómo llegar a uno concreto", () => {
    const html = render(646);
    expect(html).toContain("646");
    expect(html).toContain("usa el buscador para llegar a uno concreto");
    expect(html).toContain("Ver todos");
  });

  it("una lista que cabe no se recorta ni se anuncia", () => {
    const html = render(12);
    expect((html.match(/cmv2-aulas-finales-row/g) ?? []).length).toBe(12);
    expect(html).not.toContain("Ver todos");
  });
});
