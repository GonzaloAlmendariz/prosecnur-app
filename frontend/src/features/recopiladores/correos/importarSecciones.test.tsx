// «Importar de otro estudio…» (L9, ADR 0113): contrato del cliente, lo que dice
// cada sección del otro estudio, el resumen y el store con la revisión encadenada.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { normalizeMailSectionsImportPeek, type MailSectionsImportResult } from "../../../api/materialMailMisSecciones";
import { ListaDeMisSecciones } from "./BibliotecaDeBloques";
import { detalleImportable, ImportarSecciones, resumenDeImportacion } from "./ImportarSecciones";
import { useMisSecciones } from "./misSeccionesStore";
import { useCorreosStore } from "./store";

vi.mock("../../../api/materialMailMisSecciones", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../api/materialMailMisSecciones")>();
  return { ...real, apiMailSectionsImport: vi.fn() };
});
const api = await import("../../../api/materialMailMisSecciones");

const peekCrudo = {
  project_name: ["Estudio de origen"], same_project: [false], room: [48],
  sections: [
    { section_id: "sorteo", name: "Sorteo", block: { type: "feature", title: "T", image_ref: "premio" }, images: { premio: { alt: "A" } },
      importable: [true], already_here: [false], photos: [1], photos_missing: [0] },
    { section_id: "pasos", name: "Pasos", block: { type: "steps", title: "P", entries: [{ title: "A" }] }, images: [],
      importable: [true], already_here: [true], photos: [0], photos_missing: [0] },
    { section_id: "rota", name: "Rota", block: { type: "otro" }, importable: [false], already_here: [false], photos: [0], photos_missing: [0] },
    { section_id: "sin", name: "Sin foto", block: { type: "contact", name: "Ana" }, importable: [true], already_here: [false], photos: [1], photos_missing: [1] },
  ],
};

const resultado = (over: Partial<MailSectionsImportResult> = {}): MailSectionsImportResult => ({
  state_revision: 5, sections: [], project_name: "Estudio de origen", imported: 2, already_here: 0, not_readable: 0,
  photos_renamed: 0, photos_missing: 0, ...over,
});

describe("contrato del cliente", () => {
  it("lee el peek con escalares en arreglo; una sección de tipo desconocido queda sin poder elegirse", () => {
    const p = normalizeMailSectionsImportPeek(peekCrudo);
    expect(p).toMatchObject({ project_name: "Estudio de origen", same_project: false, room: 48 });
    expect(p.sections.map((s) => s.section_id)).toEqual(["sorteo", "pasos", "rota", "sin"]);
    expect(p.sections[0]).toMatchObject({ importable: true, already_here: false, photos: 1, images: { premio: { alt: "A" } } });
    expect(p.sections[2].importable).toBe(false);
  });
});

describe("lo que dice cada sección", () => {
  const p = normalizeMailSectionsImportPeek(peekCrudo);
  it("su tipo, sus fotos y por qué no se puede elegir", () => {
    expect(p.sections.map(detalleImportable)).toEqual([
      "Destacado · con su foto",
      "Pasos · ya está en este estudio",
      "No se puede leer en esta versión",
      "Contacto · le falta su foto",
    ]);
  });

  it("el resumen cuenta lo importado, lo que ya estaba y las fotos renombradas o faltantes", () => {
    expect(resumenDeImportacion(resultado({ imported: 1 }))).toBe("Se importó 1 sección de «Estudio de origen».");
    expect(resumenDeImportacion(resultado({ already_here: 1, photos_renamed: 1 }))).toBe(
      "Se importaron 2 secciones de «Estudio de origen». 1 ya estaba. Una foto entró con otro nombre: aquí ya había una distinta con el suyo.",
    );
    expect(resumenDeImportacion(resultado({ imported: 0, already_here: 3 }))).toBe("No se importó nada de «Estudio de origen». 3 ya estaban.");
  });
});

describe("panel y store", () => {
  it("la lista ofrece «Importar de otro estudio…» sólo si sabe importar", () => {
    const con = renderToStaticMarkup(<ListaDeMisSecciones secciones={[]} cargando={false} error={null} onElegir={() => {}} onBorrar={() => {}} onImportar={async () => null} />);
    expect(con).toContain("Importar de otro estudio…");
    const sin = renderToStaticMarkup(<ListaDeMisSecciones secciones={[]} cargando={false} error={null} onElegir={() => {}} onBorrar={() => {}} />);
    expect(sin).not.toContain("Importar de otro estudio");
  });

  it("sin la app de escritorio, el panel pide la ruta del .pulso", () => {
    const html = renderToStaticMarkup(<ImportarSecciones onImportar={async () => null} onListo={() => {}} onCerrar={() => {}} />);
    expect(html).toContain("Ruta del .pulso");
    expect(html).toContain("Leer");
  });

  it("importar manda la revisión vigente, reemplaza la lista y anota la nueva revisión", async () => {
    useCorreosStore.setState({ stateRevision: 4 });
    const s = { section_id: "sorteo", name: "Sorteo", block: { block_id: "seccion-guardada", type: "heading", text: "T" }, images: {}, created_at: "" } as const;
    vi.mocked(api.apiMailSectionsImport).mockResolvedValue(resultado({ sections: [s as never] }));
    const out = await useMisSecciones.getState().importar("/x/origen.pulso", ["sorteo"]);
    expect(out?.imported).toBe(2);
    expect(vi.mocked(api.apiMailSectionsImport).mock.calls[0][0]).toEqual({ expected_revision: 4, path: "/x/origen.pulso", section_ids: ["sorteo"] });
    expect(useMisSecciones.getState().secciones.map((x) => x.section_id)).toEqual(["sorteo"]);
    expect(useCorreosStore.getState().stateRevision).toBe(5);
    vi.mocked(api.apiMailSectionsImport).mockRejectedValue(new Error("Un estudio guarda hasta 50 secciones: caben 1 más."));
    expect(await useMisSecciones.getState().importar("/x/origen.pulso", ["a", "b"])).toBeNull();
    expect(useMisSecciones.getState().error).toContain("caben 1 más");
  });
});
