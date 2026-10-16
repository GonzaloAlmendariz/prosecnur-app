import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeMaterialCatalogPreset, type MaterialCatalogPreview } from "../../../api/materialCatalog";
import { CatalogoTipos } from "./CatalogoTipos";
import type { VistaDePagina } from "./estadoCatalogo";
import { InspectorDeTipo } from "./InspectorDeTipo";
import { TarjetaDeTipo } from "./TarjetaDeTipo";

const CROQUIS = normalizeMaterialCatalogPreset({
  preset_id: "croquis",
  title: "Ficha de campo con croquis",
  family: "identifica_unidad",
  pages_per_unit: 2,
  orientation: "portrait",
  faces: 2,
  copies_per: "unit",
  paper: "A4",
  compatible_unit_types: ["classroom_course_schedule"],
  compatible: true,
  active: false,
})!;

const VISTA: VistaDePagina = {
  estado: "lista",
  vista: { preset_id: "croquis", page: 1, pages: 2, width: 10, height: 14, png_base64: "QUJD" } satisfies MaterialCatalogPreview,
};

describe("TarjetaDeTipo", () => {
  it("pinta la página real, el dorso detrás y los chips; la selección es aria-pressed", () => {
    const html = renderToStaticMarkup(
      <TarjetaDeTipo preset={CROQUIS} seleccionado frente={VISTA} dorso={VISTA} motivo={null} onSelect={() => {}} />,
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("is-selected");
    expect(html).toContain("data:image/png;base64,QUJD");
    expect(html).toContain("con-dorso");
    expect(html).toContain("rec-cat-hoja--detras");
    expect(html).toContain("A4");
    expect(html).toContain("2 páginas");
    expect(html).toContain("1 por unidad");
    expect(html).toContain("data-qa-geometry-member");
  });

  it("un tipo que no aplica se atenúa y dice por qué", () => {
    const html = renderToStaticMarkup(
      <TarjetaDeTipo
        preset={{ ...CROQUIS, faces: 1 }}
        seleccionado={false}
        frente={undefined}
        dorso={undefined}
        motivo="Es para viviendas; el plan tiene cursos-horario."
        onSelect={() => {}}
      />,
    );
    expect(html).toContain("is-incompatible");
    expect(html).toContain("Es para viviendas; el plan tiene cursos-horario.");
    expect(html).not.toContain("con-dorso");
    expect(html).toContain("cargando");
  });
});

describe("InspectorDeTipo", () => {
  const base = {
    preset: CROQUIS,
    paginas: 2,
    vistaDe: () => VISTA,
    motivo: null,
    usando: false,
    bloqueoUsar: null,
    error: "",
    onUsar: () => {},
    onAbrirEditor: () => {},
  };

  it("enseña las páginas, las cuatro filas y las dos acciones", () => {
    const html = renderToStaticMarkup(<InspectorDeTipo {...base} />);
    expect(html).toContain("Frente");
    expect(html).toContain("Dorso");
    for (const rotulo of ["Formato", "Cuántos", "Lee de", "Impresión"]) expect(html).toContain(rotulo);
    expect(html).toContain("A4 · vertical");
    expect(html).toContain("Cursos-horario");
    expect(html).toContain("Frente y dorso");
    expect(html).toContain("Usar este tipo");
    expect(html).toContain("Abrir en el editor");
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>.*Usar este tipo/);
  });

  it("las páginas mandan el ancho: una sola a todo el inspector, dos lado a lado", () => {
    // Con `auto-fill` y 124 px una página sola quedaba en media columna
    // (~128 px). El número de páginas decide la rejilla, no un mínimo.
    const una = renderToStaticMarkup(<InspectorDeTipo {...base} paginas={1} />);
    expect(una).toContain('data-paginas="1"');
    const dos = renderToStaticMarkup(<InspectorDeTipo {...base} />);
    expect(dos).toContain('data-paginas="2"');
    expect(dos).toContain('data-qa-geometry-group="material-campo/catalogo/tipos-inspector-paginas"');
  });

  it("el tipo en uso o incompatible no se puede volver a fijar y dice por qué", () => {
    const enUso = renderToStaticMarkup(<InspectorDeTipo {...base} preset={{ ...CROQUIS, active: true }} />);
    expect(enUso).toContain('title="Es la plantilla en uso."');
    const noAplica = renderToStaticMarkup(<InspectorDeTipo {...base} motivo="Es para viviendas." />);
    expect(noAplica).toContain('title="Es para viviendas."');
    expect(noAplica).toMatch(/<button[^>]*disabled=""[^>]*title="Es para viviendas\."/);
  });
});

describe("CatalogoTipos", () => {
  it("mientras lee el catálogo lo dice dentro de su caja", () => {
    const html = renderToStaticMarkup(
      <CatalogoTipos payload={null} onStateRefresh={async () => {}} />,
    );
    expect(html).toContain("Leyendo el catálogo…");
    expect(html).toContain('data-qa-geometry-capacity="owned"');
  });
});
