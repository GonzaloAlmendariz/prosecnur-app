/**
 * Unidades › Origen (E1e), pintada.
 *
 * C1: el grupo geométrico se declara en el markup. C2: el marco —fuente, lista
 * y panel— es el mismo al día, con cambios o sin plan. C3/C5: el vacío dice
 * por qué está vacío. La acción vive aquí y su botón no escribe: abre el panel.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { CollectionOrigen } from "../../api/recopiladores";
import { ORIGEN_CAMBIO_CRUDO, origenAlDia, origenDe } from "./origen.fixture";
import { OrigenSection, OrigenVista } from "./OrigenSection";

function pintar(origen: CollectionOrigen, filtro: "todas" | "altas" | "bajas" | "cambios" | "roles" = "todas") {
  return renderToStaticMarkup(
    <MemoryRouter>
      <OrigenVista
        origen={origen}
        filtro={filtro}
        onFiltro={() => undefined}
        onActualizar={() => undefined}
        dialogoAbierto={false}
        errorAlReleer=""
      />
    </MemoryRouter>,
  );
}

describe("Origen con la fuente cambiada", () => {
  const html = pintar(origenDe());

  it("declara su grupo geométrico (C1)", () => {
    expect(html).toContain('data-qa-geometry-group="material-campo/unidades/origen"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html).toContain('data-qa-geometry-capacity="owned"');
  });

  it("dice de dónde salen y que la lista no se edita aquí", () => {
    expect(html).toContain("De dónde salen");
    expect(html).toContain("Selección de cursos-horario · Cálculo de muestra");
    expect(html).toContain("la lista no se edita aquí");
    expect(html).toContain("Abrir en Cálculo de muestra");
  });

  it("pinta las diferencias con su filtro y el recuadro ámbar", () => {
    expect(html).toContain('role="radiogroup"');
    for (const rotulo of ["Todas", "Altas", "Bajas", "Cambios", "Roles"]) expect(html).toContain(rotulo);
    expect(html).toContain("CH 191");
    expect(html).toContain("H-105");
    expect(html).toContain("H-110");
    expect(html).toContain('data-tono="cambio"');
    expect(html).toContain("La fuente cambió");
  });

  it("el docente no aparece por nombre", () => {
    expect(html).toContain("Docente (no se muestra)");
  });

  it("la acción es primaria, abre un diálogo y la selección se enlaza", () => {
    const boton = /<button[^>]*>(?:(?!<\/button>).)*Actualizar desde la fuente/.exec(html)?.[0] ?? "";
    expect(boton).toContain("pulso-button--primary");
    expect(boton).toContain('aria-haspopup="dialog"');
    expect(html).toContain("Abrir la selección");
    expect(html).toContain("Qué entrega");
    expect(html).toContain("Huella y vigencia");
    expect(html).toContain("a3f2…19");
    expect(html).toContain("sorteo del 1/8/2026");
    expect(html).toContain("Si la fuente cambia");
    expect(html).toContain("Y del otro lado");
  });
});

describe("Origen al día", () => {
  const html = pintar(origenAlDia());

  it("verde, sin acción primaria y con un vacío que dice por qué", () => {
    expect(html).toContain("Al día con la fuente");
    expect(html).toContain("Vigente");
    expect(html).toContain("Sin diferencias");
    expect(html).toContain("La lista coincide con la fuente.");
    expect(html).not.toContain("pulso-button--primary");
    expect(html).toContain("Actualizar desde la fuente");
  });

  it("conserva el mismo marco que con cambios (C2)", () => {
    const conCambios = pintar(origenDe());
    for (const clase of ["rec-origen-fuente", "rec-origen-lista", "rec-origen-conexion", "rec-origen-conexion-pie"]) {
      expect(html).toContain(clase);
      expect(conCambios).toContain(clase);
    }
  });
});

describe("Origen bloqueado o vacío", () => {
  it("fuente intermedia desfasada: botón deshabilitado con motivo y enlace", () => {
    const html = pintar(origenDe({ fuente_intermedia_desfasada: true }));
    expect(html).toMatch(/disabled=""[^>]*aria-describedby="rec-origen-motivo"|aria-describedby="rec-origen-motivo"[^>]*disabled=""/);
    expect(html).toContain("Actualízala allí primero");
    expect(html).toContain('href="/monitoreo?seccion=modelo"');
  });

  it("sin plan: vacío con acción que lleva a la Lista, sin botón de actualizar", () => {
    const html = pintar(origenDe({
      estado: "sin_plan",
      stale: false,
      plan: { existe: false, run_id: "", unidades: 0, huella_registrada: "" },
      cambios: null,
    }));
    expect(html).toContain("Todavía no hay plan");
    expect(html).toContain("pestana=lista");
    expect(html).not.toContain("Actualizar desde la fuente");
    expect(html).not.toContain('role="radiogroup"');
  });

  it("un filtro sin filas dice qué falta", () => {
    expect(pintar(origenDe(), "bajas")).toContain("No sale ninguna unidad.");
  });

  it("lista cortada por el backend: lo dice al pie", () => {
    const html = pintar(origenDe({ truncado: { ...ORIGEN_CAMBIO_CRUDO.truncado, campos: true } }));
    expect(html).toContain("Se muestran las primeras 200");
  });
});

describe("OrigenSection mientras lee", () => {
  it("no pinta un marco vacío: dice que está comparando", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <OrigenSection payload={null} onState={() => undefined} />
      </MemoryRouter>,
    );
    expect(html).toContain("Comparando la lista con su fuente");
    expect(html).not.toContain("Al día con la fuente");
  });
});
