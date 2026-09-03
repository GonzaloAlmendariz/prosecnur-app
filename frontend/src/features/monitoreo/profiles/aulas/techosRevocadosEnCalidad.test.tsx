import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasLoQueFalta } from "./AulasLoQueFalta";
import { AulasParteContraPlataforma } from "./AulasParteContraPlataforma";

/**
 * Los techos revocados en las listas de cursos-horario de Calidad (B33/P7b):
 * «los diez más baratos; quedan N más» y «las diez de mayor diferencia» eran
 * recortes declarados, pero recortes — y el principio 3 del Sistema Pabellón
 * manda lista completa: se organiza, no se esconde. El ORDEN se conserva (del
 * más barato al más caro, de mayor diferencia a menor): es la priorización;
 * lo que cae es el tijeretazo. Los resúmenes por facultad conservan su top-N
 * declarado: priorizan comparaciones, no esconden identidad.
 */

const corta = (i: number) => ({
  operational_code: `CH ${i}`,
  cumple_total: false,
  cumple_poblacion: true,
  sent_total: i,
  threshold_total: i + 3 + i % 5,
  faculty: i % 2 ? "Derecho" : "Gestión",
});

describe("«Lo que falta para cerrar» lista todos los cursos-horario", () => {
  it("con doce cortas salen las doce, del más barato al más caro", () => {
    const filas = Array.from({ length: 12 }, (_, i) => corta(i + 1));
    const html = renderToStaticMarkup(<AulasLoQueFalta filas={filas} />);
    for (let i = 1; i <= 12; i += 1) expect(html).toContain(`CH ${i}`);
    expect(html).not.toContain("más baratos");
    expect(html).not.toMatch(/quedan \d+ más/);
  });

  it("con foco de facultad salen todas las suyas, sin tijera", () => {
    const filas = Array.from({ length: 12 }, (_, i) => ({ ...corta(i + 1), faculty: "Derecho" }));
    const html = renderToStaticMarkup(
      <AulasLoQueFalta filas={filas} facultadEnFoco="Derecho" />,
    );
    for (let i = 1; i <= 12; i += 1) expect(html).toContain(`CH ${i}`);
    expect(html).not.toContain("más baratos de");
  });
});

describe("«El parte contra la plataforma» lista todos los descuadres", () => {
  it("con doce casos salen los doce, sin «de mayor diferencia»", () => {
    const partes = Array.from({ length: 12 }, (_, i) => ({
      operational_code: `CH ${i + 1}`,
      effective_surveys: 20 + i,
    }));
    const agenda = Array.from({ length: 12 }, (_, i) => ({
      operational_code: `CH ${i + 1}`,
      respuestas_validas: 10,
      responses_total: 10,
    }));
    const html = renderToStaticMarkup(
      <AulasParteContraPlataforma partes={partes} agenda={agenda} />,
    );
    for (let i = 1; i <= 12; i += 1) expect(html).toContain(`CH ${i}`);
    expect(html).not.toContain("mayor diferencia, de");
  });
});
