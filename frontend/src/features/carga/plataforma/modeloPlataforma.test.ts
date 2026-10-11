import { describe, expect, it } from "vitest";
import { ApiError } from "../../../api/core";
import {
  KOBO_BASE_URL_ACNUR,
  KOBO_BASE_URL_PUBLICA,
  clasificarErrorLanzamiento,
  clasificarResultadoJob,
  construirPeticionImport,
  cuerpoKoboSeparada,
  cuerpoKoboUnica,
  cuerpoSurveyMonkeySeparada,
  cuerpoSurveyMonkeyUnica,
  filtrarCatalogo,
  formatoTranscurrido,
  indiceFase,
  normalizarAssetKobo,
  normalizarCatalogo,
  normalizarConexionPlataforma,
  normalizarFuenteKoboDetectada,
  progresoDeImport,
  resolverBaseUrlKobo,
} from "./modeloPlataforma";

const separadoOk = {
  ok: true,
  provider: "kobo",
  strategy: "separate",
  base_name: "percepcion_2026",
  base: { nombre: "percepcion_2026" },
  xlsform_file_id: "x1",
  data_file_id: "d1",
  n_filas: 1283,
  n_columnas: 141,
  source: {},
  child_bases: ["percepcion_2026__hogar"],
  active_base: "NA",
  n_bases: 2,
  estudio: { nombre: "e", n_bases: 2, bases: {}, max_bases: 10, active_base: "default" },
};

describe("catálogo unificado", () => {
  it("normaliza el catálogo de SurveyMonkey y descarta ítems sin id o repetidos", () => {
    const items = normalizarCatalogo("surveymonkey", {
      surveys: [
        { id: "512", title: "Percepción", nickname: "NA", date_modified: "2026-07-09", response_count: 1900 },
        { id: "512", title: "duplicada" },
        { title: "sin id" },
        null,
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ proveedor: "surveymonkey", id: "512", alias: null, respuestas: 1900, origen: "catalogo" });
  });

  it("unifica los dos payloads de Kobo: catálogo (uid/name) y fuente detectada (asset_uid/base_url)", () => {
    const delCatalogo = normalizarAssetKobo({ uid: "aX", name: "PDM", deployment_active: true, version_id: "NA" });
    const detectada = normalizarFuenteKoboDetectada({
      ok: true,
      detected: true,
      asset_uid: "aX",
      name: "PDM territorial",
      base_url: "https://kobo.unhcr.org/",
      connection_profile_id: "acnur",
      total_remote: 426,
      phase: "fase_1",
    });
    expect(delCatalogo).toMatchObject({ id: "aX", titulo: "PDM", activo: true, versionId: null, baseUrl: null, origen: "catalogo" });
    expect(detectada).toMatchObject({
      id: "aX",
      titulo: "PDM territorial",
      baseUrl: "https://kobo.unhcr.org",
      perfilId: "acnur",
      respuestas: 426,
      origen: "detectado",
      fase: "fase_1",
    });
    expect(normalizarFuenteKoboDetectada({ ok: false, detected: false })).toBeNull();
  });

  it("filtra por título, alias o id", () => {
    const items = normalizarCatalogo("kobo", { assets: [{ uid: "a1", name: "Docentes" }, { uid: "b2", name: "Estudiantes" }] });
    expect(filtrarCatalogo(items, "doc").map((i) => i.id)).toEqual(["a1"]);
    expect(filtrarCatalogo(items, "B2").map((i) => i.id)).toEqual(["b2"]);
    expect(filtrarCatalogo(items, " ")).toHaveLength(2);
  });
});

describe("conexión y servidor Kobo", () => {
  const connections = [
    {
      provider: "kobo",
      has_token: true,
      active_profile_id: "p2",
      active_profile_base_url: "https://kobo.unhcr.org/",
      profiles: [
        { id: "p1", alias: "Público", has_token: true, base_url: "", is_default: false },
        { id: "p2", alias: "ACNUR", has_token: true, base_url: "https://kobo.unhcr.org", is_default: true },
        { id: "p3", alias: "Sin token", has_token: false, base_url: "https://x.org" },
      ],
    },
  ];

  it("solo cuenta perfiles con token y elige el pedido, luego el default", () => {
    const c = normalizarConexionPlataforma(connections, "kobo");
    expect(c.conectado).toBe(true);
    expect(c.perfiles.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(c.perfilActivo?.id).toBe("p2");
    expect(normalizarConexionPlataforma(connections, "kobo", "p1").perfilActivo?.id).toBe("p1");
  });

  it("sintetiza el perfil legado cuando la conexión tiene token pero no perfiles", () => {
    const c = normalizarConexionPlataforma(
      [{ provider: "surveymonkey", has_token: true, active_profile_id: "", active_profile_alias: "", profiles: [] }],
      "surveymonkey",
    );
    expect(c.conectado).toBe(true);
    expect(c.perfilActivo).toMatchObject({ id: "", alias: "Principal", esDefault: true });
  });

  it("sin has_token no hay conexión", () => {
    const c = normalizarConexionPlataforma([{ provider: "kobo", has_token: false, profiles: [] }], "kobo");
    expect(c.conectado).toBe(false);
    expect(c.perfilActivo).toBeNull();
    expect(normalizarConexionPlataforma(null, "kobo").conectado).toBe(false);
  });

  it("resuelve el servidor: ítem → perfil → conexión → respaldo según origen", () => {
    const sinNada = { perfilActivo: null, baseUrlConexion: "" };
    expect(resolverBaseUrlKobo({ baseUrl: null, origen: "catalogo" }, sinNada)).toBe(KOBO_BASE_URL_PUBLICA);
    expect(resolverBaseUrlKobo({ baseUrl: null, origen: "detectado" }, sinNada)).toBe(KOBO_BASE_URL_ACNUR);
    expect(resolverBaseUrlKobo({ baseUrl: null, origen: "catalogo" }, { perfilActivo: null, baseUrlConexion: "https://k.org/" })).toBe("https://k.org");
    expect(resolverBaseUrlKobo(
      { baseUrl: "https://propio.org", origen: "detectado" },
      { perfilActivo: { id: "p", alias: "", baseUrl: "https://perfil.org", esDefault: true }, baseUrlConexion: "" },
    )).toBe("https://propio.org");
  });
});

describe("cuerpos de petición", () => {
  const conexion = normalizarConexionPlataforma(
    [{ provider: "surveymonkey", has_token: true, profiles: [{ id: "pucp", alias: "PUCP", has_token: true, is_default: true }] }],
    "surveymonkey",
  );
  const encuesta = normalizarCatalogo("surveymonkey", { surveys: [{ id: "512", title: "Percepción", nickname: "Acogida" }] })[0];

  it("base única de SurveyMonkey conserva el cuerpo vigente de CargaPage", () => {
    const p = construirPeticionImport({ estrategia: "unica", item: encuesta, conexion, baseNombre: "ignorado", incluirParciales: true });
    expect(cuerpoSurveyMonkeyUnica(p)).toEqual({
      survey_id: "512",
      title: "Percepción",
      connection_profile_id: "pucp",
      source_alias: "Acogida",
      response_statuses: ["completed", "partial"],
      keep_missing_status: false,
    });
  });

  it("separada solo manda base_name si se pidió uno", () => {
    const sinNombre = construirPeticionImport({ estrategia: "separada", item: encuesta, conexion });
    expect(cuerpoSurveyMonkeySeparada(sinNombre)).not.toHaveProperty("base_name");
    const conNombre = construirPeticionImport({ estrategia: "separada", item: encuesta, conexion, baseNombre: " acogida " });
    expect(cuerpoSurveyMonkeySeparada(conNombre)).toMatchObject({ survey_id: "512", base_name: "acogida", response_statuses: ["completed"] });
  });

  it("Kobo usa el servidor y perfil de la fuente detectada", () => {
    const detectada = normalizarFuenteKoboDetectada({ detected: true, asset_uid: "aX", name: "PDM", base_url: "", connection_profile_id: "" });
    if (!detectada) throw new Error("detección esperada");
    const p = construirPeticionImport({ estrategia: "unica", item: detectada, conexion: null });
    expect(cuerpoKoboUnica(p)).toEqual({ asset_uid: "aX", title: "PDM", base_url: KOBO_BASE_URL_ACNUR, connection_profile_id: "" });
    const s = construirPeticionImport({ estrategia: "separada", item: detectada, conexion: null, baseNombre: "pdm" });
    expect(cuerpoKoboSeparada(s)).toEqual({ asset_uid: "aX", base_name: "pdm", base_url: KOBO_BASE_URL_ACNUR, connection_profile_id: "" });
  });
});

describe("fases y progreso", () => {
  it("mapea los hitos del worker a las cuatro fases", () => {
    expect(indiceFase("prepare")).toBe(0);
    expect(indiceFase("fetch")).toBe(1);
    expect(indiceFase("normalize")).toBe(2);
    expect(indiceFase("write")).toBe(3);
    expect(indiceFase("finalize")).toBe(3);
    expect(indiceFase("diff")).toBe(3);
    expect(indiceFase(undefined)).toBe(0);
  });

  it("lee el progreso defensivamente ({} del unboxed-JSON incluido)", () => {
    expect(progresoDeImport({})).toEqual({ fase: 0, percent: null, actual: null, total: null, mensaje: "" });
    expect(progresoDeImport({ phase: "fetch", current: 1183, total: 1900, percent: 140, message: "Kobo: descargando..." }))
      .toEqual({ fase: 1, percent: 100, actual: 1183, total: 1900, mensaje: "descargando..." });
  });

  it("formatea el tiempo transcurrido", () => {
    expect(formatoTranscurrido(48_000)).toBe("0:48");
    expect(formatoTranscurrido(725_000)).toBe("12:05");
    expect(formatoTranscurrido(3_729_000)).toBe("1:02:09");
    expect(formatoTranscurrido(-5)).toBe("0:00");
  });
});

describe("clasificación del desenlace", () => {
  it("running o sin snapshot ⇒ todavía nada", () => {
    expect(clasificarResultadoJob({ estrategia: "separada", status: "running", cancelSolicitado: false })).toBeNull();
    expect(clasificarResultadoJob({ estrategia: "separada", status: null, cancelSolicitado: false })).toBeNull();
    // Un estado fuera del contrato termina en error: no deja el import colgado.
    const raro = clasificarResultadoJob({ estrategia: "separada", status: "raro" as never, cancelSolicitado: false });
    expect(raro?.tipo).toBe("error");
  });

  it("done con payload separado ⇒ importado con nombre de base e hijas", () => {
    const r = clasificarResultadoJob({ estrategia: "separada", status: "done", resultData: separadoOk, cancelSolicitado: false });
    expect(r).toMatchObject({ tipo: "importado", baseNombre: "percepcion_2026", nFilas: 1283, nBases: 2, basesHijas: ["percepcion_2026__hogar"] });
    if (r?.tipo === "importado") expect(r.separado?.active_base).toBeNull();
  });

  it("cancelé pero el job se cosechó como done ⇒ cancelado-importado", () => {
    const r = clasificarResultadoJob({ estrategia: "separada", status: "done", resultData: separadoOk, cancelSolicitado: true });
    expect(r?.tipo).toBe("cancelado-importado");
  });

  it("cancelled ⇒ cancelado", () => {
    expect(clasificarResultadoJob({ estrategia: "unica", status: "cancelled", cancelSolicitado: true })).toEqual({ tipo: "cancelado" });
  });

  it("E_CARGA_JOB_STALE_SESSION ⇒ sesión obsoleta", () => {
    const r = clasificarResultadoJob({
      estrategia: "separada",
      status: "done",
      resultData: { ok: false, error: { code: "E_CARGA_JOB_STALE_SESSION", message: "cambió" } },
      cancelSolicitado: false,
    });
    expect(r?.tipo).toBe("sesion-obsoleta");
  });

  it("error de dominio ⇒ error con su código y título", () => {
    const r = clasificarResultadoJob({
      estrategia: "separada",
      status: "done",
      resultData: { ok: false, error: { code: "E_BASE_DUP", message: "Ya existe una base con nombre 'x'." } },
      cancelSolicitado: false,
    });
    expect(r).toEqual({ tipo: "error", codigo: "E_BASE_DUP", titulo: "Ya existe una base con ese nombre", mensaje: "Ya existe una base con nombre 'x'." });
  });

  it("payload irreconocible ⇒ error de contrato, nunca éxito", () => {
    const r = clasificarResultadoJob({ estrategia: "separada", status: "done", resultData: { ok: true }, cancelSolicitado: false });
    expect(r).toMatchObject({ tipo: "error", codigo: "E_CARGA_JOB_CONTRATO" });
  });

  it("base única toma el nombre de estudio.active_base y conteos del preview", () => {
    const r = clasificarResultadoJob({
      estrategia: "unica",
      status: "done",
      resultData: { ok: true, provider: "surveymonkey", preview: { n_filas: 10, n_columnas: 4 }, estudio: { active_base: "default", n_bases: 1 } },
      cancelSolicitado: false,
    });
    expect(r).toMatchObject({ tipo: "importado", baseNombre: "default", nFilas: 10, nColumnas: 4, nBases: 1 });
  });

  it("worker muerto y fallos del poll ⇒ error legible", () => {
    expect(clasificarResultadoJob({ estrategia: "unica", status: "error", error: {}, cancelSolicitado: false }))
      .toMatchObject({ tipo: "error", codigo: "E_CARGA_JOB_FAILED" });
    expect(clasificarResultadoJob({
      estrategia: "unica",
      status: null,
      falloPoll: { kind: "lost", message: "El backend se reinició" },
      cancelSolicitado: false,
    })).toMatchObject({ tipo: "error", codigo: null, mensaje: "El backend se reinició" });
  });

  it("errores de lanzamiento: ApiError conserva el código sin duplicarlo en el mensaje", () => {
    expect(clasificarErrorLanzamiento(new ApiError("E_CARGA_JOB_RUNNING", "Ya hay un import"))).toEqual({
      tipo: "error",
      codigo: "E_CARGA_JOB_RUNNING",
      titulo: "Ya hay una importación en curso",
      mensaje: "Ya hay un import",
    });
    expect(clasificarErrorLanzamiento(new ApiError("E_CARGA_JOB_STALE_SESSION", "x")).tipo).toBe("sesion-obsoleta");
    expect(clasificarErrorLanzamiento(new TypeError("Failed to fetch"))).toMatchObject({ tipo: "error", codigo: null, mensaje: "Failed to fetch" });
  });
});
