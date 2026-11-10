/**
 * Los normalizadores de Material de campo conservan el meta del entregable
 * (ADR 0133 §1): peso, módulo, rótulo, copia junto al proyecto y su aviso. Sin
 * eso el kit descarga lo que el backend ya guardó en `Entregables\<Módulo>` y el
 * contenedor dice «Descargado» en vez de «Guardado».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const red = vi.hoisted(() => ({ cuerpo: {} as unknown }));

vi.mock("./core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./core")>()),
  headers: (extra?: Record<string, string>) => ({ ...(extra ?? {}) }),
  apiFetch: async () => new Response(JSON.stringify(red.cuerpo), { status: 200, headers: { "Content-Type": "application/json" } }),
}));

const { camposDeEntregable } = await import("./jobs");
const { archivoDesdeRespuesta } = await import("../components/entregables/archivoDesdeRespuesta");
const { apiMaterialAulasPlantilla } = await import("./materialAulasEntrega");
const { apiMaterialTelefonicaPlantilla } = await import("./materialTelefonica");
const { apiSupervisionExcel } = await import("./materialSupervision");
const { apiMaterialTerritorialExcelAsignacion, apiMaterialTerritorialPapel } = await import("./materialTerritorial");
const { apiMailRevision, apiMailTextosWord, normalizeMailExport } = await import("./materialMail");

const GUARDADO = "C:\\Users\\ana\\Estudios\\HSVG2026\\Entregables\\Material de campo\\HSVG2026_Plantilla_de_barrido_10_11_26.xlsx";
const META = { modulo: "Material de campo", rotulo: "Plantilla de barrido", guardado_en: GUARDADO, aviso_guardado: null };

beforeEach(() => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("camposDeEntregable", () => {
  it("lee el peso de size o de size_bytes y sólo las claves con valor, con escalares de R", () => {
    expect(camposDeEntregable({ size_bytes: [2048], modulo: ["Material de campo"], guardado_en: {}, aviso_guardado: [] }))
      .toEqual({ size: 2048, modulo: "Material de campo" });
    expect(camposDeEntregable({ size: 10, size_bytes: 99 })).toEqual({ size: 10 });
    expect(camposDeEntregable(null)).toEqual({});
    expect(camposDeEntregable({ size: -1, rotulo: "  " })).toEqual({});
  });
});

describe("las funciones de Material conservan el meta del entregable", () => {
  const casos: [string, () => Promise<unknown>][] = [
    ["plantilla del equipo de aulas", () => apiMaterialAulasPlantilla("libro")],
    ["plantilla del barrido", () => apiMaterialTelefonicaPlantilla("telefonica.principal")],
    ["base de supervisión", () => apiSupervisionExcel("supervision.ronda-1")],
    ["Excel de asignación", () => apiMaterialTerritorialExcelAsignacion("territorial.principal")],
    ["hoja de papel", () => apiMaterialTerritorialPapel("territorial.principal", "ruteo", { unidad: "u1" })],
  ];

  it.each(casos)("%s: guardado_en, módulo, rótulo y peso llegan al kit", async (_nombre, llamar) => {
    red.cuerpo = { ok: true, file_id: "f1", filename: "HSVG2026_Plantilla_de_barrido_10_11_26.xlsx", size: 4096, ...META };
    const r = await llamar();
    expect(r).toMatchObject({ file_id: "f1", filename: "HSVG2026_Plantilla_de_barrido_10_11_26.xlsx", size: 4096, guardado_en: GUARDADO, modulo: "Material de campo" });
    expect(archivoDesdeRespuesta(r)[0]).toMatchObject({ fileId: "f1", tamano: 4096, guardadoEn: GUARDADO, rotulo: "Plantilla de barrido", avisoGuardado: null });
  });

  it("sin el meta (backend anterior) responde como antes, sin claves vacías", async () => {
    red.cuerpo = { ok: true, file_id: "f2", filename: "Base.xlsx", casos: [3] };
    expect(await apiSupervisionExcel("supervision.ronda-1")).toEqual({ file_id: "f2", filename: "Base.xlsx", casos: 3 });
  });
});

describe("Correos", () => {
  it("la vista para revisión y los textos en Word leen el meta del archivo o de la raíz", async () => {
    red.cuerpo = { ok: true, file: { file_id: "r1", filename: "Revision.html", size_bytes: 512 }, ...META };
    const revision = await apiMailRevision({ campaign_ids: ["c1"] });
    expect(revision).toMatchObject({ file_id: "r1", size_bytes: 512, size: 512, guardado_en: GUARDADO });
    red.cuerpo = { ok: true, file: { file_id: "w1", size_bytes: 900, guardado_en: GUARDADO } };
    const word = await apiMailTextosWord({ campaign_ids: ["c1"] });
    expect(word).toMatchObject({ file_id: "w1", filename: "textos.docx", size: 900, guardado_en: GUARDADO });
  });

  it("el ZIP de la exportación lleva su copia junto al proyecto, venga en el artefacto o en la raíz", () => {
    const zip = { file_id: "z1", role: "deliverable", filename: "Correo.zip", media_type: "application/zip", size_bytes: 3000, sha256: "s", audience: "client", sensitivity: "personal_data" };
    const enLaRaiz = normalizeMailExport({ platform: "mailchimp", zip, ...META });
    expect(enLaRaiz.zip).toMatchObject({ file_id: "z1", size: 3000, guardado_en: GUARDADO });
    expect(archivoDesdeRespuesta(enLaRaiz)[0]).toMatchObject({ fileId: "z1", tamano: 3000, guardadoEn: GUARDADO });
    const enElZip = normalizeMailExport({ platform: "mailchimp", zip: { ...zip, guardado_en: "D:\\otro.zip" }, guardado_en: GUARDADO });
    expect(enElZip.zip?.guardado_en).toBe("D:\\otro.zip");
    expect(normalizeMailExport({ platform: "mailchimp" }).zip).toBeNull();
  });
});
