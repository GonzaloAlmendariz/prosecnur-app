import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { SectionPillbar, type SectionPillbarItem } from "./SectionPillbar";

function pintar(items: SectionPillbarItem[]) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <SectionPillbar modulo="material-campo" ariaLabel="Secciones" seccionActiva="b" items={items} />
    </MemoryRouter>,
  );
}

describe("la marca de la píldora de sección (revamp de Material v5)", () => {
  it("con pendientes pinta el número en ámbar y lo dice al lector de pantalla", () => {
    const html = pintar([{ id: "a", label: "Unidades", href: "/a", pendientes: 16 }]);
    expect(html).toContain('data-estado="pendiente"');
    expect(html).toContain(">16<");
    expect(html).toContain('aria-label="Unidades. 16 pendientes"');
  });

  it("una sola pendiente va en singular", () => {
    expect(pintar([{ id: "a", label: "Entrega", href: "/a", pendientes: 1 }])).toContain('aria-label="Entrega. 1 pendiente"');
  });

  it("lista pinta ✓ y cede ante pendientes", () => {
    const lista = pintar([{ id: "a", label: "Catálogo", href: "/a", lista: true }]);
    expect(lista).toContain('data-estado="lista"');
    expect(lista).toContain('aria-label="Catálogo. lista"');
    const ambas = pintar([{ id: "a", label: "Paquetes", href: "/a", lista: true, pendientes: 2 }]);
    expect(ambas).toContain('data-estado="pendiente"');
    expect(ambas).not.toContain('data-estado="lista"');
  });

  it("desactualizada pinta un punto, manda sobre lista y cede ante pendientes", () => {
    const punto = pintar([{ id: "a", label: "Validación", href: "/a", lista: true, desactualizada: true, nota: "Cambiaron las respuestas" }]);
    expect(punto).toContain('data-estado="desactualizada"');
    expect(punto).not.toContain('data-estado="lista"');
    expect(punto).toContain('aria-label="Validación. Cambiaron las respuestas. desactualizada"');
    const ambas = pintar([{ id: "a", label: "Validación", href: "/a", desactualizada: true, pendientes: 1 }]);
    expect(ambas).toContain('data-estado="pendiente"');
    expect(ambas).not.toContain('data-estado="desactualizada"');
  });

  it("sin marca ni nota, la píldora queda como antes: sin badge y sin aria-label", () => {
    const html = pintar([{ id: "a", label: "Casos", href: "/a", pendientes: 0 }]);
    expect(html).not.toContain("pulso-phase-pill-badge");
    expect(html).not.toContain("aria-label=\"Casos");
  });

  it("la nota y la marca se suman en el texto accesible", () => {
    expect(pintar([{ id: "a", label: "Barrido", href: "/a", nota: "falta el Sheets", pendientes: 2 }]))
      .toContain('aria-label="Barrido. falta el Sheets. 2 pendientes"');
  });
});
