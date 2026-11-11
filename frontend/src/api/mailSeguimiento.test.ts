import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiActualizarTodas,
  apiAntesDeEnvio,
  apiBorradorDeGrupo,
  apiGuardarConfigSeguimiento,
  apiResultadosDeHorario,
  apiSortearHorario,
  normalizeBorradorDeGrupo,
  normalizeCargaCorreoPersonal,
  normalizeEfectoCorreoPersonal,
  normalizeEstadoSeguimiento,
  normalizeInicioDeActualizacion,
  normalizeLatido,
  normalizeResultadoDeActualizacion,
  normalizeResultadosDeHorario,
} from "./mailSeguimiento";

// Payloads con las mañas de jsonlite: vectores de largo uno como escalares,
// `{}` por lista vacía y NA como `null` o "NA". Ninguno trae correos.
const ESTADO = {
  ok: true,
  config: { list_id: "abc123", tag: "Respondió", archivar: true, antes_de_envio: { activo: false, minutos: 30 }, ultima_para: "", ultima_at: "" },
  campanas: [
    {
      campaign_id: "egresados", nombre: "Egresados", publico: "Egresados",
      recordatorios: [{ send_id: "r1", etiqueta: "Recordatorio 1" }],
      encuesta: "123456", contactos: true, personas: 812, con_enlace: 800, respondieron: 421, a_medias: 12,
      leido_en: "2026-11-11T15:00:00Z", archivados: true, grupos: { A: 400, B: 400 },
      segundo_correo: { personal: 80, control: 20, cargados: 78, rechazados: 2 },
    },
    {
      campaign_id: "docentes", nombre: "Docentes", publico: "Docentes",
      recordatorios: {}, encuesta: "", contactos: false, personas: 0, con_enlace: 0, respondieron: null, a_medias: "NA",
      leido_en: "", archivados: false, grupos: { A: 0, B: 0 }, segundo_correo: {},
    },
    { nombre: "sin id" },
  ],
  horario: {
    semilla: null, campanas: "egresados", oficina: {}, oficina_desde: "08:30", oficina_hasta: "17:00",
    etiquetas: { A: "Envío mañana", B: "Envío tarde" }, horizonte_h: 24, sorteado_en: "", etiquetado_en: "",
    rondas: [{ ronda: 1, etiqueta: "Recordatorio 1" }],
    plan: [
      { ronda: 1, campaign_id: "egresados", grupo: "A", programado: "2026-11-12T09:30", mailchimp_id: "", enviado: "", enviados: null, hora_txt: "9:30 a. m." },
      { ronda: 1, campaign_id: "egresados", grupo: "C", programado: "2026-11-12T20:00" },
    ],
    avisos: [{ tipo: "falta_hora", ronda: 1, campaign_id: "egresados", texto: "Recordatorio 1, Egresados: falta la hora de un grupo." }],
  },
  correo_personal: {
    semilla: null, proporcion: 0.8, etiqueta: "Correo personal", desde: "", sorteado_en: "", cargado_en: "",
    campanas: [{ campaign_id: "egresados", publico: "Egresados", columna: "", candidatas: [{ key: "correo_personal", label: "Correo personal" }] }],
  },
};

describe("estado de Seguimiento", () => {
  it("normaliza campañas, horario y correo personal sin inventar cifras", () => {
    const e = normalizeEstadoSeguimiento(ESTADO);
    expect(e.config).toMatchObject({ list_id: "abc123", archivar: true, antes_de_envio: { activo: false, minutos: 30 } });
    expect(e.campanas.map((c) => c.campaign_id)).toEqual(["egresados", "docentes"]);
    expect(e.campanas[0]).toMatchObject({ respondieron: 421, a_medias: 12, grupos: { A: 400, B: 400 } });
    // "Sin leer" no es cero.
    expect(e.campanas[1].respondieron).toBeNull();
    expect(e.campanas[1].a_medias).toBeNull();
    expect(e.campanas[1].recordatorios).toEqual([]);
    expect(e.campanas[1].segundo_correo).toEqual({ personal: 0, control: 0, cargados: 0, rechazados: 0 });
    // Un vector de largo uno llega como escalar; uno vacío como {}.
    expect(e.horario.campanas).toEqual(["egresados"]);
    expect(e.horario.oficina).toEqual([]);
    expect(e.horario.semilla).toBeNull();
    // La fila con un grupo que no existe se descarta.
    expect(e.horario.plan).toHaveLength(1);
    expect(e.horario.avisos[0].tipo).toBe("falta_hora");
    expect(e.correo_personal.campanas[0].candidatas).toEqual([{ key: "correo_personal", label: "Correo personal" }]);
  });

  it("tolera un payload vacío con valores por defecto", () => {
    const e = normalizeEstadoSeguimiento(null);
    expect(e.campanas).toEqual([]);
    expect(e.config.tag).toBe("Respondió");
    expect(e.horario.etiquetas).toEqual({ A: "Envío mañana", B: "Envío tarde" });
    expect(e.horario.horizonte_h).toBe(24);
    expect(e.correo_personal.proporcion).toBe(0.8);
  });
});

describe("quién respondió en todas las campañas", () => {
  it("lee el arranque con sus saltadas y el resultado por campaña", () => {
    const inicio = normalizeInicioDeActualizacion({ ok: true, job_id: "j1", campanas: 2, saltadas: { campaign_id: "docentes", publico: "Docentes", motivo: "no tiene contactos" } });
    expect(inicio).toEqual({ job_id: "j1", campanas: 2, saltadas: [{ campaign_id: "docentes", publico: "Docentes", motivo: "no tiene contactos" }] });
    const r = normalizeResultadoDeActualizacion({
      campanas: [
        { campaign_id: "egresados", ok: true, respondents: 421, tagged: 420, archived: 410, archived_second: 5, partial_people: 12, inactive: 1 },
        { campaign_id: "otra", ok: false, error: { message: "SurveyMonkey no respondió." } },
      ],
      saltadas: [],
      totales: { respondieron: 421, etiquetados: 420, archivados: 410, a_medias: 12 },
    });
    expect(r.campanas[0]).toMatchObject({ respondents: 421, archived: 410, archived_second: 5, partial_people: 12, inactive: 1, error: "" });
    expect(r.campanas[1]).toMatchObject({ ok: false, error: "SurveyMonkey no respondió." });
    expect(r.totales.a_medias).toBe(12);
  });

  it("sin job_id no hay trabajo que seguir", () => {
    expect(() => normalizeInicioDeActualizacion({ ok: true })).toThrow();
  });
});

describe("antes de cada envío", () => {
  it("lee el próximo envío o su ausencia", () => {
    expect(normalizeLatido({ ok: true, activo: false, lanzado: false, proximo: null })).toEqual({ activo: false, lanzado: false, job_id: "", proximo: null, minutos: null });
    const l = normalizeLatido({ activo: true, lanzado: true, job_id: "j9", minutos: 30, proximo: { titulo: "Recordatorio 2", send_time: "2026-11-12T14:30:00+00:00", destinatarios: 3800 } });
    expect(l.proximo).toEqual({ titulo: "Recordatorio 2", send_time: "2026-11-12T14:30:00+00:00", destinatarios: 3800 });
    expect(normalizeLatido({ activo: true, proximo: {} }).proximo).toBeNull();
  });
});

describe("prueba de horarios", () => {
  it("el borrador sólo acepta un enlace de Mailchimp", () => {
    expect(normalizeBorradorDeGrupo({ mailchimp_campaign_id: "abc123", edit_url: "https://us1.admin.mailchimp.com/campaigns/edit?id=1" }).edit_url).toMatch(/^https:/);
    expect(normalizeBorradorDeGrupo({ edit_url: "javascript:alert(1)" }).edit_url).toBe("");
  });

  it("normaliza los resultados por recordatorio, con NA como ausencia", () => {
    const r = normalizeResultadosDeHorario({
      rondas: [
        {
          ronda: 1, etiqueta: "Recordatorio 1", comparable: true, en_curso: false, horizonte_h: 24, horaA: "9:30 a. m.", horaB: "8:00 p. m.",
          fecha: "jueves 12 de noviembre",
          publicos: { publico: "Egresados", nA: 380, xA: 40, pctA: 10.53, nB: 390, xB: 22, pctB: 5.64, dif_pp: 4.89, dif_li: 0.9, dif_ls: 8.9, veredicto: "A", pocos_casos: false },
          total: { publico: "", nA: 380, xA: 40, pctA: 10.53, nB: 390, xB: 22, pctB: 5.64, dif_pp: 4.89, dif_li: 0.9, dif_ls: 8.9, veredicto: "A" },
          cmh: { or: 1.9, or_li: 1.1, or_ls: 3.3, p: 0.012, p_txt: "p = 0.012" },
          ganador: "A", excluidos: [], curvas: [{ horas: 0, pctA: 0, pctB: 0 }], lectura: "Ganaron las 9:30 a. m.",
        },
        { ronda: 2, etiqueta: "Recordatorio 2", comparable: false, publicos: {}, total: {}, cmh: {}, excluidos: { publico: "Egresados", motivo: "falta la hora de un grupo" }, lectura: "Sin públicos que comparar todavía." },
      ],
      cruce: { confirmado: false, texto: "" },
      semilla: 20261111, personas: 800, con_completa: 300, respuestas_leidas_en: "", horas_de_mailchimp: 2, horas_del_plan: 0,
    });
    expect(r.rondas[0].publicos).toHaveLength(1);
    expect(r.rondas[0].total?.veredicto).toBe("A");
    expect(r.rondas[0].cmh?.p_txt).toBe("p = 0.012");
    expect(r.rondas[1].total).toBeNull();
    expect(r.rondas[1].cmh).toBeNull();
    expect(r.rondas[1].excluidos).toEqual([{ publico: "Egresados", motivo: "falta la hora de un grupo" }]);
    expect(r.semilla).toBe(20261111);
  });
});

describe("correo personal", () => {
  it("lee la carga con sus motivos de rechazo y el efecto", () => {
    const c = normalizeCargaCorreoPersonal({ campanas: { campaign_id: "egresados", cargados: 78, rechazados: 2, motivos: { ERROR_INVALID_EMAIL: 2 } } });
    expect(c.campanas[0]).toEqual({ campaign_id: "egresados", cargados: 78, rechazados: 2, motivos: [{ code: "ERROR_INVALID_EMAIL", n: 2 }] });
    const e = normalizeEfectoCorreoPersonal({ publicos: [], total: { nA: 80, xA: 10, nB: 20, xB: 1, veredicto: "empate" }, cmh: { p: 0.3, p_txt: "p = 0.30" }, dias: 4.5, rechazados: 2, lectura: "Sin diferencia clara." });
    expect(e.total).toMatchObject({ nA: 80, xA: 10, pctA: null, veredicto: "empate" });
    expect(e.dias).toBe(4.5);
  });
});

describe("llamadas", () => {
  afterEach(() => vi.unstubAllGlobals());

  function conRespuesta(cuerpo: unknown, status = 200) {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => (
      new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } })
    ));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "sid-test"), setItem: vi.fn(), removeItem: vi.fn() });
    return fetchMock;
  }

  it("cada operación va a su ruta y con su método", async () => {
    const f = conRespuesta(ESTADO);
    await apiGuardarConfigSeguimiento({ archivar: false });
    expect(String(f.mock.calls[0][0])).toContain("/api/recopiladores/mail-seguimiento/config");
    expect((f.mock.calls[0][1] ?? {}).method).toBe("PUT");
    expect(JSON.parse(String((f.mock.calls[0][1] ?? {}).body))).toEqual({ archivar: false });

    conRespuesta({ ok: true, job_id: "j1", campanas: 1, saltadas: [] });
    expect((await apiActualizarTodas({ archivar: true })).job_id).toBe("j1");

    const latido = conRespuesta({ activo: false, lanzado: false });
    await apiAntesDeEnvio();
    expect(String(latido.mock.calls[0][0])).toContain("/antes-de-envio");
    expect((latido.mock.calls[0][1] ?? {}).method).toBe("POST");

    const res = conRespuesta({ rondas: [] });
    await apiResultadosDeHorario(48);
    expect(String(res.mock.calls[0][0])).toContain("/horario/resultados?horizonte_h=48");

    const borr = conRespuesta({ mailchimp_campaign_id: "abc123", edit_url: "" });
    await apiBorradorDeGrupo({ campaign_id: "egresados", ronda: 1, grupo: "A", from_name: " PULSO ", reply_to: "a@b.pe " });
    expect(JSON.parse(String((borr.mock.calls[0][1] ?? {}).body))).toEqual({ campaign_id: "egresados", ronda: 1, grupo: "A", from_name: "PULSO", reply_to: "a@b.pe" });
  });

  it("un sorteo repetido sin confirmar llega como error con su código", async () => {
    conRespuesta({ error: { code: "E_COLLECTION_MAIL_PRUEBA_SORTEADA", message: "Los grupos ya se sortearon." } }, 409);
    await expect(apiSortearHorario({ semilla: 1 })).rejects.toMatchObject({ code: "E_COLLECTION_MAIL_PRUEBA_SORTEADA" });
  });
});
