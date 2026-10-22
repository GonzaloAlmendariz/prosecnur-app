import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getMonitoreoMailchimpAudiencias,
  getMonitoreoMailchimpEstado,
  normalizeMonitoreoMailchimpAudiencias,
  normalizeMonitoreoMailchimpEstado,
  normalizeMonitoreoMailchimpSync,
  postMonitoreoMailchimpConfig,
  postMonitoreoMailchimpSync,
} from "./monitoreoMailchimp";

// Payload con la forma exacta del contrato congelado
// (docs/qa/checklist-monitoreo-mailchimp-t3-2026-10-22.md, «Payload de estado»).
const ESTADO_CONTRATO = {
  ok: true,
  conectado: true,
  list_id: "e1a9ab97a5",
  leido_at: "2026-10-22T16:00:00Z",
  umbrales: { baja_espaciar: 0.005, queja_espaciar: 0.001, queja_detener: 0.003 },
  avisos: ["2 destinatarios no están en el universo de Monitoreo."],
  publicos: [{
    actor: "Estudiantes de pregrado", universo: 22820, invitados: 22820, invalidos: 41, alcanzable: 22779,
    efectivas: 3120, tasa_universo: 0.1367, tasa_alcanzable: 0.137, bajas: 12, quejas: 1, envios: 2,
    ultimo: { campaign_id: "c2", entregados: 19500, bajas: 9, quejas: 1, respuestas: 610, tasa_baja: 0.00046, tasa_queja: 0.00005 },
    ritmo: "seguir", ritmo_motivo: "Bajas 0.05 % y quejas 0.01 % del último envío, bajo los umbrales.",
  }],
  envios: [{
    campaign_id: "c1", titulo: "Invitación · Pregrado", asunto: "Reacreditación institucional PUCP 2026",
    enviado_at: "2026-10-27T13:00:00Z", etiqueta: "Estudiantes de pregrado", tipo: "invitacion", orden: 1,
    actor: "Estudiantes de pregrado", enviados: 22820, entregados: 22779, rebotes_duros: 38, rebotes_blandos: 3,
    aperturas: 11800, aperturas_sin_proxy: 9100, clics: 3300, bajas: 3, quejas: 0, respuestas: 2510,
    tasa_apertura: 0.3995, tasa_clic: 0.1449, tasa_baja: 0.00013, tasa_queja: 0, por_actor: [],
  }],
  invalidos: {
    total: 41,
    por_actor: [{ actor: "Estudiantes de pregrado", n: 41 }],
    filas: [{ token: "ab12cd34ef", actor: "Estudiantes de pregrado", motivo: "rebote_duro", campaign_id: "c1", fecha: "2026-10-27T13:05:00Z" }],
  },
};

describe("normalizeMonitoreoMailchimpEstado", () => {
  it("conserva la forma del contrato", () => {
    const e = normalizeMonitoreoMailchimpEstado(ESTADO_CONTRATO);
    expect(e.conectado).toBe(true);
    expect(e.list_id).toBe("e1a9ab97a5");
    expect(e.umbrales).toEqual({ baja_espaciar: 0.005, queja_espaciar: 0.001, queja_detener: 0.003 });
    expect(e.publicos[0]).toMatchObject({ actor: "Estudiantes de pregrado", alcanzable: 22779, ritmo: "seguir" });
    expect(e.publicos[0].ultimo).toMatchObject({ campaign_id: "c2", tasa_queja: 0.00005 });
    expect(e.envios[0]).toMatchObject({ campaign_id: "c1", tipo: "invitacion", orden: 1, aperturas: 11800, aperturas_sin_proxy: 9100 });
    expect(e.invalidos.filas[0]).toEqual({
      token: "ab12cd34ef", actor: "Estudiantes de pregrado", motivo: "rebote_duro", campaign_id: "c1", fecha: "2026-10-27T13:05:00Z",
    });
  });

  it("acepta las mañas de auto_unbox: escalares en arreglo, listas de uno sueltas y avisos escalares", () => {
    const e = normalizeMonitoreoMailchimpEstado({
      ok: [true],
      conectado: [true],
      list_id: ["abc"],
      leido_at: ["2026-10-22T16:00:00Z"],
      umbrales: [{ baja_espaciar: [0.005], queja_espaciar: 0.001, queja_detener: 0.003 }],
      avisos: "Cruce de Monitoreo aún no calculado.",
      publicos: { actor: ["Docentes"], universo: [120], ritmo: ["detener"], ultimo: {} },
      envios: {
        campaign_id: "c9", tipo: "recordatorio", orden: [3], actor: "Docentes", entregados: 100,
        por_actor: { actor: "Docentes", aperturas: 40, aperturas_sin_proxy: null },
      },
      invalidos: { total: 0, por_actor: {}, filas: {} },
    });
    expect(e.list_id).toBe("abc");
    expect(e.umbrales.baja_espaciar).toBe(0.005);
    expect(e.avisos).toEqual(["Cruce de Monitoreo aún no calculado."]);
    expect(e.publicos).toHaveLength(1);
    expect(e.publicos[0]).toMatchObject({ actor: "Docentes", universo: 120, ritmo: "detener", ultimo: null });
    expect(e.envios).toHaveLength(1);
    expect(e.envios[0]).toMatchObject({ orden: 3, tipo: "recordatorio" });
    expect(e.envios[0].por_actor).toEqual([expect.objectContaining({ actor: "Docentes", aperturas: 40, aperturas_sin_proxy: null })]);
    expect(e.invalidos).toEqual({ total: 0, por_actor: [], filas: [] });
  });

  it("una cifra ausente o nula es «sin dato», no cero", () => {
    const e = normalizeMonitoreoMailchimpEstado({
      conectado: true,
      publicos: [{ actor: "Egresados", tasa_alcanzable: null, alcanzable: {} }],
      envios: [{ campaign_id: "c1", tasa_apertura: null, entregados: "NA" }],
    });
    expect(e.publicos[0].tasa_alcanzable).toBeNull();
    expect(e.publicos[0].alcanzable).toBeNull();
    expect(e.publicos[0].efectivas).toBeNull();
    expect(e.envios[0].tasa_apertura).toBeNull();
    expect(e.envios[0].entregados).toBeNull();
  });

  it("un ritmo desconocido cae en «sin envíos» y un tipo ausente se deduce del orden", () => {
    const e = normalizeMonitoreoMailchimpEstado({
      publicos: [{ actor: "A", ritmo: "otra-cosa" }],
      envios: [{ campaign_id: "c1", orden: 2 }, { campaign_id: "c2" }],
    });
    expect(e.publicos[0].ritmo).toBe("sin_envios");
    expect(e.envios.map((x) => x.tipo)).toEqual(["recordatorio", "invitacion"]);
  });

  it("sin payload devuelve un estado vacío y desconectado", () => {
    const e = normalizeMonitoreoMailchimpEstado({});
    expect(e).toMatchObject({ conectado: false, list_id: "", leido_at: "", publicos: [], envios: [], avisos: [] });
    expect(e.invalidos).toEqual({ total: null, por_actor: [], filas: [] });
    expect(normalizeMonitoreoMailchimpEstado(null).conectado).toBe(false);
  });
});

describe("audiencias y sync", () => {
  it("normaliza audiencias y descarta las que no traen id", () => {
    const r = normalizeMonitoreoMailchimpAudiencias({
      ok: true,
      conectado: true,
      audiencias: [{ id: "e1", name: "PULSO PUCP", member_count: 22820 }, { id: "", name: "Rota" }, { id: "e2", name: "Otra", member_count: null }],
    });
    expect(r.audiencias).toEqual([
      { id: "e1", name: "PULSO PUCP", member_count: 22820 },
      { id: "e2", name: "Otra", member_count: null },
    ]);
    expect(normalizeMonitoreoMailchimpAudiencias({ conectado: true, audiencias: { id: "x", name: "Sola" } }).audiencias).toHaveLength(1);
  });

  it("el sync exige job_id", () => {
    expect(normalizeMonitoreoMailchimpSync({ ok: true, job_id: ["j1"] })).toEqual({ job_id: "j1" });
    expect(() => normalizeMonitoreoMailchimpSync({ ok: true })).toThrow(/trabajo en segundo plano/);
  });
});

describe("rutas", () => {
  const fetchMock = vi.fn();
  const responde = (body: unknown) => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "sid-test"), setItem: vi.fn(), removeItem: vi.fn() });
  };
  afterEach(() => { vi.unstubAllGlobals(); });

  it("GET estado y audiencias", async () => {
    responde(ESTADO_CONTRATO);
    const e = await getMonitoreoMailchimpEstado();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/monitoreo/mailchimp/estado");
    expect(e.envios).toHaveLength(1);

    responde({ ok: true, conectado: true, audiencias: [{ id: "e1", name: "PULSO PUCP", member_count: 3 }] });
    const a = await getMonitoreoMailchimpAudiencias();
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/monitoreo/mailchimp/audiencias");
    expect(a.audiencias[0].name).toBe("PULSO PUCP");
  });

  it("POST config manda el list_id y devuelve el estado", async () => {
    responde(ESTADO_CONTRATO);
    const e = await postMonitoreoMailchimpConfig({ list_id: "e1a9ab97a5" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/monitoreo/mailchimp/config");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ list_id: "e1a9ab97a5" });
    expect(e.list_id).toBe("e1a9ab97a5");
  });

  it("POST sync devuelve el job", async () => {
    responde({ ok: true, job_id: "job-7" });
    expect(await postMonitoreoMailchimpSync()).toEqual({ job_id: "job-7" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/monitoreo/mailchimp/sync");
    expect(init.method).toBe("POST");
  });
});
