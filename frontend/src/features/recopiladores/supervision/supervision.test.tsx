import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { normalizarRegistroDeCampanas } from "../../../api/materialCampanas";
import { normalizarColumnasDeSupervision } from "../../../api/materialSupervision";
import { direccionDeApertura } from "../campanas/direccionDeCampanas";
import { ponerEnRegistro } from "../campanas/modeloRegistro";
import { resolverVistaDeCampanas } from "../campanas/redirecciones";
import { ColumnasSupervision, EntregaSupervision } from "./SeccionesSupervision";

const COLUMNAS = normalizarColumnasDeSupervision({
  campaign_id: "supervision.ronda-1", llave: "Código",
  disponibles: { barrido: ["Nombre", "Teléfono 1", "Responsable", "Status"], resultados: [{ nombre: "recibio", etiqueta: "¿Recibió la ayuda?" }] },
  elegidas: { barrido: ["Responsable", "Status"], resultados: {} },
  fijas: ["Observaciones del supervisor", "Estatus de la llamada de supervisión", "Veredicto"],
  veredictos: ["Confirmada", "No confirmada", "No contactado"], revision: [0],
});

const REGISTRO = normalizarRegistroDeCampanas({
  schema: "material_campaigns/v1", registry_revision: 2, state_revision: 0,
  campaigns: [{ id: "supervision.ronda-1", tipo: "supervision", name: "Supervisión ronda 1", archived: false, persisted: true,
    ref: { store: "monitoreo_supervision_lotes", lote_id: "ronda-1" },
    estado: { lote_id: "ronda-1", casos: 2, sin_lote: false, criterio: "10 % de 20 efectivas nuevas" } }],
  tipos: [{ tipo: "supervision", disponible: true, lotes_libres: [{ lote_id: "ronda-2", criterio: "2 casos", casos: 2 }] }],
});

describe("campaña de supervisión", () => {
  it("el registro la lee con su estado y los lotes libres", () => {
    const c = REGISTRO.campaigns[0];
    expect(c.tipo).toBe("supervision");
    expect(c.estado).toEqual({ tipo: "supervision", lote_id: "ronda-1", casos: 2, sin_lote: false, criterio: "10 % de 20 efectivas nuevas" });
    expect(REGISTRO.tipos.find((t) => t.tipo === "supervision")?.lotes_libres?.map((l) => l.lote_id)).toEqual(["ronda-2"]);
  });

  it("se abre en Columnas y una dirección incompleta cae en la canónica", () => {
    expect(direccionDeApertura({ id: "supervision.ronda-1", tipo: "supervision" })).toEqual({ modo: "supervision", campana: "supervision.ronda-1", seccion: "columnas", pestana: "seleccion" });
    const r = resolverVistaDeCampanas({ campana: "supervision.ronda-1", seccion: "inventada" }, REGISTRO);
    expect(r.vista).toMatchObject({ vista: "campana", modo: "supervision" });
    expect(r.reescribir).toMatchObject({ modo: "supervision", seccion: "columnas", pestana: "seleccion" });
  });

  it("crear una supervisión toma su lote y, sin lotes libres, cierra el tipo", () => {
    const nueva = { ...REGISTRO.campaigns[0], id: "supervision.ronda-2", name: "Supervisión ronda 2" };
    const tipo = ponerEnRegistro(REGISTRO, nueva, 3).tipos.find((t) => t.tipo === "supervision");
    expect(tipo?.lotes_libres).toEqual([]);
    expect(tipo?.disponible).toBe(false);
  });

  it("Columnas ofrece barrido y resultados con el selector del kit, y las tres fijas siempre", () => {
    expect(COLUMNAS.elegidas.resultados).toEqual([]);
    const html = renderToStaticMarkup(<ColumnasSupervision columnas={COLUMNAS} guardando={false} onGuardar={() => undefined} />);
    for (const t of ["Del barrido", "Teléfono 1", "recibio · ¿Recibió la ayuda?", "De la supervisión", "Veredicto: Confirmada, No confirmada, No contactado"]) {
      expect(html).toContain(t);
    }
    expect(html).not.toContain("<select");
  });

  it("Entrega muestra el orden de la base y, sin lote, lo dice en vez de generar", () => {
    const html = renderToStaticMarkup(<MemoryRouter><EntregaSupervision campaignId="supervision.ronda-1" columnas={COLUMNAS} casos={2} sinLote={false} /></MemoryRouter>);
    expect(html).toContain("2 casos");
    expect(html).toContain("Excel de la supervisión");
    expect(html).toContain("En su propio Sheets");
    expect(html).toContain("Permitir");
    const sin = renderToStaticMarkup(<MemoryRouter><EntregaSupervision campaignId="supervision.ronda-1" columnas={COLUMNAS} casos={0} sinLote /></MemoryRouter>);
    expect(sin).toContain("Monitoreo ya no tiene este lote");
    expect(sin).toContain("seccion=control");
  });
});

describe("acreditación (ADR 0125 A4)", () => {
  it("el registro lee el propósito de la campaña", () => {
    const r = normalizarRegistroDeCampanas({
      schema: "material_campaigns/v1", registry_revision: 1, state_revision: 0,
      campaigns: [
        { id: "telefonica.principal", tipo: "telefonica", name: "Acreditación telefónica", proposito: ["acreditacion"], estado: {} },
        { id: "aulas.principal", tipo: "aulas", name: "Campo en aulas", estado: {} },
      ],
      tipos: [],
    });
    expect(r.campaigns.map((c) => c.proposito)).toEqual(["acreditacion", null]);
  });

  it("en acreditación la telefónica trae sus rondas libres y crear una no cierra el tipo mientras quede otra", () => {
    const r = normalizarRegistroDeCampanas({
      schema: "material_campaigns/v1", registry_revision: 1, state_revision: 0,
      campaigns: [],
      tipos: [{ tipo: "telefonica", disponible: true, rondas_libres: [
        { publico: "Egresados", etiqueta: "Egresados", ronda: 2, id: "telefonica.egresados-r2", viene_de: null },
        { publico: "Egresados", etiqueta: "Egresados", ronda: [3], id: "telefonica.egresados-r3", viene_de: "telefonica.egresados-r2" },
      ] }],
    });
    const tel = (reg: typeof r) => reg.tipos.find((x) => x.tipo === "telefonica")!;
    expect(tel(r).rondas_libres?.map((x) => x.ronda)).toEqual([2, 3]);
    const creada = normalizarRegistroDeCampanas({
      schema: "material_campaigns/v1", registry_revision: 2, state_revision: 0, tipos: [],
      campaigns: [{ id: "telefonica.egresados-r2", tipo: "telefonica", name: "R2", proposito: "acreditacion",
        relacion: { publico: "Egresados", ronda: 2, viene_de: null }, estado: {} }],
    }).campaigns[0];
    expect(creada.relacion).toEqual({ publico: "Egresados", ronda: 2, viene_de: null });
    const tras = tel(ponerEnRegistro(r, creada, 2));
    expect(tras.disponible).toBe(true);
    expect(tras.rondas_libres?.map((x) => x.id)).toEqual(["telefonica.egresados-r3"]);
    const ultima = tel(ponerEnRegistro({ ...r, tipos: r.tipos.map((x) => (x.tipo === "telefonica" ? { ...x, rondas_libres: [x.rondas_libres![0]] } : x)) }, creada, 3));
    expect(ultima.disponible).toBe(false);
  });
});
