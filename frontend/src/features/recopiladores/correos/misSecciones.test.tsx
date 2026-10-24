// «Mis secciones» (L9, ADR 0113): contrato del cliente, insertar una copia,
// el nombre sugerido, la biblioteca y el store con la revisión encadenada.

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MailBlock, MailTemplate } from "../../../api/materialMail";
import { normalizeMailSavedSection, type MailSavedSection } from "../../../api/materialMailMisSecciones";
import { BibliotecaDeBloques, ListaDeMisSecciones } from "./BibliotecaDeBloques";
import { insertarSeccionGuardada } from "./estructuraCorreo";
import { nombreSugerido } from "./GuardarSeccion";
import { bloqueNuevo } from "./modeloCorreo";
import { fotosParaGuardar, useMisSecciones } from "./misSeccionesStore";
import { useCorreosStore } from "./store";

vi.mock("../../../api/materialMailMisSecciones", async (importOriginal) => {
  const real = await importOriginal<typeof import("../../../api/materialMailMisSecciones")>();
  return { ...real, apiMailSections: vi.fn(), apiMailSectionCreate: vi.fn(), apiMailSectionDelete: vi.fn() };
});
const api = await import("../../../api/materialMailMisSecciones");

const destacado: MailBlock = {
  block_id: "feature-1", type: "feature", title: "Sorteo de audífonos", text: "Sorteamos 5.", image_ref: "premio", alt: "Audífonos",
  layout: "derecha", box: { bg: "tinte" },
};
const plantilla = (blocks: MailBlock[], images: MailTemplate["images"] = {}) => ({ blocks, images, fields: [] }) as unknown as MailTemplate;
const guardada: MailSavedSection = {
  section_id: "sorteo", name: "Sorteo de audífonos", block: { ...destacado, block_id: "seccion-guardada" },
  images: { premio: { alt: "Audífonos", url: "https://x.pe/p.png" } }, created_at: "2026-10-24T10:00:00Z",
};

describe("contrato del cliente", () => {
  it("lee una sección del backend; sin bloque legible, la descarta", () => {
    const s = normalizeMailSavedSection({ section_id: "s", name: "S", block: { type: "steps", title: "T", entries: [{ title: "A" }] }, images: { x: { alt: "X" } }, created_at: "2026-10-24" });
    expect(s).toMatchObject({ section_id: "s", block: { type: "steps", block_id: "seccion-guardada", entries: [{ title: "A" }] }, images: { x: { alt: "X" } } });
    expect(normalizeMailSavedSection({ section_id: "s", name: "S" })).toBeNull();
  });
});

describe("usar una sección guardada", () => {
  it("inserta una copia con id nuevo en el hueco, y suma la foto sólo si el correo no la tiene", () => {
    const pie: MailBlock = { block_id: "pie", type: "footer_legal" };
    const t = plantilla([destacado, pie], { premio: { alt: "La del correo" } });
    const out = insertarSeccionGuardada(t, guardada, { hueco: 1 });
    expect(out?.block_id).toBe("feature-2");
    expect(out?.template.blocks.map((b) => b.block_id)).toEqual(["feature-1", "feature-2", "pie"]);
    expect(out?.template.images.premio).toEqual({ alt: "La del correo" });
    const vacia = insertarSeccionGuardada(plantilla([pie]), guardada, { despuesDe: null });
    expect(vacia?.template.blocks.map((b) => b.type)).toEqual(["feature", "footer_legal"]);
    expect(vacia?.template.images.premio).toEqual({ alt: "Audífonos", url: "https://x.pe/p.png" });
    // Cambiar la copia no toca la sección guardada.
    (out!.template.blocks[1] as { title: string }).title = "Otro";
    expect((guardada.block as { title: string }).title).toBe("Sorteo de audífonos");
  });

  it("guardar toma la descripción y la URL de sus fotos, nada más", () => {
    const t = plantilla([destacado], { premio: { alt: "Audífonos", url: "https://x.pe/p.png", trae_logos: true }, otra: { alt: "No" } });
    expect(fotosParaGuardar(destacado, t)).toEqual({ premio: { alt: "Audífonos", url: "https://x.pe/p.png" } });
  });

  it("sugiere un nombre con el tipo y lo que dice, sin corchetes de relleno", () => {
    expect(nombreSugerido(destacado)).toBe("Destacado · Sorteo de audífonos");
    expect(nombreSugerido(bloqueNuevo("quote", "q"))).toBe("Cita · Escribe aquí lo que dice, entre una y tres líneas.");
    expect(nombreSugerido({ ...destacado, title: "x".repeat(200) } as MailBlock).length).toBeLessThanOrEqual(80);
  });
});

describe("biblioteca y store", () => {
  beforeEach(() => {
    vi.mocked(api.apiMailSections).mockResolvedValue({ state_revision: 7, sections: [guardada] });
    useMisSecciones.setState({ secciones: [guardada], estado: "lista", error: null, sesion: null });
  });

  it("la biblioteca ofrece «Mis secciones» primero cuando el editor sabe usarlas", () => {
    const html = renderToStaticMarkup(<BibliotecaDeBloques template={plantilla([])} onElegir={() => {}} onElegirGuardada={() => {}} onCerrar={() => {}} />);
    expect(html.indexOf("Mis secciones")).toBeLessThan(html.indexOf("Secciones</h4>"));
    const sin = renderToStaticMarkup(<BibliotecaDeBloques template={plantilla([])} onElegir={() => {}} onCerrar={() => {}} />);
    expect(sin).not.toContain("Mis secciones");
  });

  it("la lista muestra cada sección con su tipo y su ✕; vacía, dice cómo guardar una", () => {
    const html = renderToStaticMarkup(<ListaDeMisSecciones secciones={[guardada]} cargando={false} error={null} onElegir={() => {}} onBorrar={() => {}} />);
    expect(html).toContain('data-guardada="sorteo"');
    expect(html).toContain("Destacado · 24 oct");
    expect(html).toContain("Borrar «Sorteo de audífonos» de Mis secciones");
    const vacia = renderToStaticMarkup(<ListaDeMisSecciones secciones={[]} cargando={false} error={null} onElegir={() => {}} onBorrar={() => {}} />);
    expect(vacia).toContain("Aún no hay.");
  });

  it("guardar y borrar mandan la revisión vigente y anotan la nueva en el store del correo", async () => {
    useCorreosStore.setState({ stateRevision: 7 });
    vi.mocked(api.apiMailSectionCreate).mockResolvedValue({ state_revision: 8, section: { ...guardada, section_id: "otra" } });
    const nueva = await useMisSecciones.getState().guardar("Otra", destacado, plantilla([destacado], { premio: { alt: "A" } }), "recuperacion");
    expect(nueva?.section_id).toBe("otra");
    expect(vi.mocked(api.apiMailSectionCreate).mock.calls[0][0]).toMatchObject({ expected_revision: 7, name: "Otra", campaign_id: "recuperacion", images: { premio: { alt: "A" } } });
    expect(useCorreosStore.getState().stateRevision).toBe(8);
    vi.mocked(api.apiMailSectionDelete).mockResolvedValue({ state_revision: 9 });
    expect(await useMisSecciones.getState().borrar("otra")).toBe(true);
    expect(vi.mocked(api.apiMailSectionDelete).mock.calls[0][0]).toEqual({ expected_revision: 8, section_id: "otra" });
    expect(useMisSecciones.getState().secciones.map((s) => s.section_id)).toEqual(["sorteo"]);
    expect(useCorreosStore.getState().stateRevision).toBe(9);
  });

  it("si guardar falla, el error queda a la vista y nada se agrega", async () => {
    useCorreosStore.setState({ stateRevision: 9 });
    vi.mocked(api.apiMailSectionCreate).mockRejectedValue(new Error("El nombre de la sección no puede llevar una dirección de correo."));
    expect(await useMisSecciones.getState().guardar("de a@b.pe", destacado, plantilla([destacado]))).toBeNull();
    expect(useMisSecciones.getState().error).toContain("dirección de correo");
    expect(useMisSecciones.getState().secciones).toHaveLength(1);
  });

  it("al releer, del mismo proyecto se sigue viendo lo que había; de otro, se vacía", async () => {
    let soltar: () => void = () => {};
    vi.mocked(api.apiMailSections).mockImplementation(() => new Promise((ok) => { soltar = () => ok({ state_revision: 7, sections: [guardada] }); }));
    const core = await import("../../../api/core");
    const sesion = vi.spyOn(core, "getSession").mockReturnValue("proyecto-a");
    useMisSecciones.setState({ secciones: [guardada], estado: "lista", sesion: "proyecto-a" });
    const p = useMisSecciones.getState().cargar();
    expect(useMisSecciones.getState().secciones).toHaveLength(1);
    soltar(); await p;
    sesion.mockReturnValue("proyecto-b");
    const q = useMisSecciones.getState().cargar();
    expect(useMisSecciones.getState().secciones).toHaveLength(0);
    soltar(); await q;
    expect(useMisSecciones.getState().sesion).toBe("proyecto-b");
    sesion.mockRestore();
  });
});
