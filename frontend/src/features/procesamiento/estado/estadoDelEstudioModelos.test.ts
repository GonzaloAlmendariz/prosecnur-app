import { describe, expect, test } from "vitest";

import type { SessionState } from "../../../api/core";
import type { EstudioBase, EstudioPayload } from "../../../api/estudio";
import type { ProcessingReleaseCatalog } from "../../../api/xlsformEditor";
import { aprobacionesDelCatalogo } from "./aprobacionesModel";
import { archivosDelEstudio } from "./archivosDelEstudioModel";
import { basesDelEstudio } from "./basesDelEstudioModel";
import { cifrasDelEstudio, cifrasPendientesDelEstudio, estadoDelEstudio } from "./cabeceraDelEstudioModel";
import { cambiosRecientes, MAX_CAMBIOS } from "./cambiosRecientesModel";
import { causasDeBase } from "./causaDeFaseModel";
import { fechaCorta } from "./fechaDelEstudio";
import { porHacer } from "./porHacerModel";
import { queSigue } from "./queSigueModel";

const HOY = new Date(2026, 10, 12);

function base(parcial: Partial<EstudioBase> & { nombre: string }): EstudioBase {
  return {
    xlsform_file_id: "x",
    data_file_id: "d",
    data_ext: "xlsx",
    n_filas: 10,
    n_columnas: 5,
    added_at: "2026-11-01T15:00:00Z",
    status: { imported: true },
    ...parcial,
  };
}

function estudio(bases: EstudioBase[], activa: string | null = bases[0]?.nombre ?? null, modo = "multibase"): EstudioPayload {
  return {
    nombre: "E",
    processing_mode: modo,
    active_base: activa,
    n_bases: bases.length,
    bases: Object.fromEntries(bases.map((b) => [b.nombre, b])),
    max_bases: 16,
  };
}

function catalogo(entradas: Array<{ base: string; status: string; approved_at?: string }>): ProcessingReleaseCatalog {
  return {
    ok: true,
    schema: "processing_release_catalog/v1",
    detected: true,
    family_id: "f",
    active_base: entradas[0]?.base ?? "",
    all_approved: false,
    entries: entradas.map((e) => ({
      base: e.base, base_label: e.base, actor: e.base, entry_id: e.base, family_id: "f", instrument_revision_id: "",
      status: e.status, ready: e.status === "ready", approved: e.status === "approved", input_fingerprint: "h",
      blockers: [], pins: {},
      release: e.approved_at ? { schema: "processing_release/v1", release_id: "r", processing_intake_entry_id: e.base, input_fingerprint: "h", approved_at: e.approved_at } : null,
    })),
  };
}

const etiqueta = (n: string) => n.toUpperCase();

describe("fechaCorta", () => {
  test("día y mes en es-PE, con el año solo si no es el actual; un día sin hora no cambia de día", () => {
    expect(fechaCorta("2026-11-09T15:00:00Z", HOY)).toBe("9 nov");
    expect(fechaCorta("2026-09-02", HOY)).toBe("2 set");
    expect(fechaCorta("2025-11-01", HOY)).toBe("1 nov 2025");
    expect(fechaCorta("NA", HOY)).toBeNull();
    expect(fechaCorta("mañana", HOY)).toBeNull();
    expect(fechaCorta(null, HOY)).toBeNull();
  });
});

describe("aprobacionesDelCatalogo", () => {
  test("sin catálogo detectado no hay aprobación que mostrar", () => {
    expect(aprobacionesDelCatalogo(null)).toBeNull();
    expect(aprobacionesDelCatalogo({ ...catalogo([{ base: "a", status: "ready" }]), detected: false })).toBeNull();
    expect(aprobacionesDelCatalogo(catalogo([]))).toBeNull();
  });

  test("lee los cuatro estados del motor y cuenta cada uno; un estado desconocido queda pendiente", () => {
    const a = aprobacionesDelCatalogo(catalogo([
      { base: "a", status: "approved", approved_at: "2026-11-07T10:00:00Z" },
      { base: "b", status: "stale", approved_at: "2026-11-01T10:00:00Z" },
      { base: "c", status: "ready" },
      { base: "d", status: "algo_nuevo" },
    ]));
    expect(a && { total: a.total, aprobadas: a.aprobadas, desactualizadas: a.desactualizadas, listas: a.listas }).toEqual({
      total: 4, aprobadas: 1, desactualizadas: 1, listas: 1,
    });
    expect(a?.porBase.get("d")?.estado).toBe("pendiente");
    expect(a?.porBase.get("b")?.aprobadaEl).toBe("2026-11-01T10:00:00Z");
  });
});

describe("causasDeBase", () => {
  test("carga: lo que falta, la revisión que no coincide, la lectura con sus nuevas o la fecha de alta", () => {
    expect(causasDeBase(base({ nombre: "a", xlsform_file_id: "", data_file_id: "", status: { imported: false } }), etiqueta, undefined, HOY).carga)
      .toBe("Faltan el formulario y las respuestas");
    expect(causasDeBase(base({ nombre: "a", xlsform_file_id: "", status: { imported: false } }), etiqueta, undefined, HOY).carga)
      .toBe("Falta el formulario");
    expect(causasDeBase(base({ nombre: "a", instrument_revision_binding: "no_match", surveymonkey_refreshed_at: "2026-11-09T10:00:00Z" }), etiqueta, undefined, HOY).carga)
      .toBe("El formulario no coincide con ninguna revisión publicada");
    expect(causasDeBase(base({ nombre: "a", surveymonkey_last_refresh: { refreshed_at: "2026-11-09T15:00:00Z", n_new: 1 } }), etiqueta, undefined, HOY).carga)
      .toBe("Leída de SurveyMonkey el 9 nov, 1 respuesta nueva");
    expect(causasDeBase(base({ nombre: "a", surveymonkey_last_refresh: { refreshed_at: "2026-11-09T15:00:00Z", n_new: 0 } }), etiqueta, undefined, HOY).carga)
      .toBe("Leída de SurveyMonkey el 9 nov, sin respuestas nuevas");
    expect(causasDeBase(base({ nombre: "a", surveymonkey_refreshed_at: "2026-11-09T15:00:00Z" }), etiqueta, undefined, HOY).carga)
      .toBe("Leída de SurveyMonkey el 9 nov");
    expect(causasDeBase(base({ nombre: "a" }), etiqueta, undefined, HOY).carga).toBe("Agregada el 1 nov");
    // Una importación de SAV o de Excel escribe la misma marca con todas sus filas como "nuevas": se dice aparte.
    const sav = { refreshed_at: "2026-06-23T21:58:28Z", n_new: 182, sav_bundle_import: true };
    expect(causasDeBase(base({ nombre: "a", surveymonkey_last_refresh: sav }), etiqueta, undefined, HOY).carga)
      .toBe("Importada del SAV de SurveyMonkey el 23 jun");
    expect(causasDeBase(base({ nombre: "a", surveymonkey_last_refresh: { ...sav, sav_bundle_import: undefined, workbook_import: true } }), etiqueta, undefined, HOY).carga)
      .toBe("Importada del Excel de SurveyMonkey el 23 jun");
  });

  test("codificación copiada de otra base y Gráficos según la aprobación; lo demás no se inventa", () => {
    const c = causasDeBase(base({ nombre: "a", status: { imported: true, shared_logic_from: "b" } }), etiqueta, { base: "a", estado: "aprobada", aprobadaEl: "2026-11-07T15:00:00Z" }, HOY);
    expect(c).toEqual({ carga: "Agregada el 1 nov", validacion: null, codificacion: "Codificación copiada de B", analitica: null, graficos: "Aprobada para informe el 7 nov" });
    // La base que es su propia plantilla no se cita a sí misma.
    expect(causasDeBase(base({ nombre: "a", status: { imported: true, shared_logic_from: "a" } }), etiqueta).codificacion).toBeNull();
    expect(causasDeBase(base({ nombre: "a" }), etiqueta, { base: "a", estado: "desactualizada", aprobadaEl: "x" }).graficos)
      .toBe("Aprobación desactualizada: cambió un insumo");
    expect(causasDeBase(base({ nombre: "a" }), etiqueta, { base: "a", estado: "lista", aprobadaEl: null }).graficos).toBe("Lista para aprobar");
    expect(causasDeBase(base({ nombre: "a" }), etiqueta, { base: "a", estado: "pendiente", aprobadaEl: null }).graficos).toBeNull();
  });
});

describe("cabecera del estudio", () => {
  const dos = [
    base({ nombre: "a", n_filas: 100, status: { imported: true, graficos: true } }),
    base({ nombre: "b", n_filas: 50, status: { imported: true } }),
  ];

  test("estado en palabra: sin bases, carga incompleta, en curso o con informe", () => {
    expect(estadoDelEstudio(basesDelEstudio(estudio([])), null)).toEqual({ tono: "neutro", texto: "Sin bases" });
    expect(estadoDelEstudio(basesDelEstudio(estudio([base({ nombre: "a", status: { imported: false } })])), null)?.texto).toBe("Carga incompleta");
    expect(estadoDelEstudio(basesDelEstudio(estudio(dos)), null)).toEqual({ tono: "parcial", texto: "En curso" });
    expect(estadoDelEstudio(basesDelEstudio(estudio([dos[0]])), null)).toEqual({ tono: "listo", texto: "Con informe" });
    // Sin el estado de una base no se afirma nada del estudio.
    expect(estadoDelEstudio(basesDelEstudio(estudio([base({ nombre: "a", status: null })])), null)).toBeNull();
  });

  test("cifras: bases, respuestas sumadas solo si se conocen todas, y con informe sobre las bases", () => {
    expect(cifrasDelEstudio(basesDelEstudio(estudio(dos)), null).map((c) => [c.rotulo, c.valor, c.base ?? null, c.tono ?? "neutral"])).toEqual([
      ["bases", "2", null, "neutral"],
      ["respuestas", "150", null, "neutral"],
      ["con informe", "1", "2", "ok"],
    ]);
    const unoSinTamano = [dos[0], base({ nombre: "b", n_filas: null })];
    expect(cifrasDelEstudio(basesDelEstudio(estudio(unoSinTamano)), null).map((c) => c.clave)).toEqual(["bases", "con-informe"]);
    // Ninguna con informe: el punto verde no se pinta sobre un cero.
    expect(cifrasDelEstudio(basesDelEstudio(estudio([dos[1]])), null).find((c) => c.clave === "con-informe")?.tono).toBe("neutral");
    expect(cifrasPendientesDelEstudio(null)).toMatch(/M8/);
  });

  test("con aprobación: aprobadas y desactualizadas sobre el total, estado aprobado solo con todas", () => {
    const ap = aprobacionesDelCatalogo(catalogo([{ base: "a", status: "approved", approved_at: "2026-11-07T10:00:00Z" }, { base: "b", status: "stale", approved_at: "2026-11-01T10:00:00Z" }]));
    const b = basesDelEstudio(estudio(dos), ap);
    expect(cifrasDelEstudio(b, ap).map((c) => [c.clave, c.valor, c.base ?? null, c.rotulo])).toEqual([
      ["bases", "2", null, "bases"],
      ["respuestas", "150", null, "respuestas"],
      ["aprobadas", "1", "2", "aprobada para informe"],
      ["desactualizadas", "1", "2", "aprobación desactualizada"],
    ]);
    expect(estadoDelEstudio(b, ap)?.texto).toBe("En curso");
    expect(cifrasPendientesDelEstudio(ap)).toBeUndefined();
    const todas = aprobacionesDelCatalogo(catalogo([{ base: "a", status: "approved" }, { base: "b", status: "approved" }]));
    expect(estadoDelEstudio(basesDelEstudio(estudio(dos), todas), todas)).toEqual({ tono: "listo", texto: "Aprobado para informe" });
  });
});

describe("archivosDelEstudio", () => {
  test("sin sesión leída la base activa tampoco tiene dato de Analítica", () => {
    const filas = archivosDelEstudio(basesDelEstudio(estudio([base({ nombre: "a", status: { imported: true, graficos: true } })])), null);
    expect(filas[0].celdas.map((c) => c.estado)).toEqual(["sin-dato", "sin-dato", "sin-dato", "sin-dato", "sin-dato", "generado"]);
  });

  test("informe de la activa con sus formatos; un indicador apagado es Por generar", () => {
    const state = { analitica_spss_ok: true, graficos_ppt_ok: true, graficos_word_ok: true } as SessionState;
    const filas = archivosDelEstudio(basesDelEstudio(estudio([base({ nombre: "a" })])), state);
    expect(filas[0].celdas.map((c) => [c.estado, c.detalle])).toEqual([
      ["generado", null], ["por-generar", null], ["por-generar", null], ["por-generar", null], ["por-generar", null],
      ["generado", "PowerPoint y Word"],
    ]);
  });
});

describe("cambiosRecientes", () => {
  test("hechos con fecha de cada base, del más reciente al más antiguo; sin marca no hay hecho", () => {
    const e = estudio([
      base({ nombre: "a", source_alias: "Civil", added_at: "2026-11-01T10:00:00Z" }),
      base({
        nombre: "b",
        source_alias: "Minas",
        added_at: "NA",
        surveymonkey_last_refresh: { refreshed_at: "2026-11-09T10:00:00Z", n_new: 11 },
        logic_template_base: "a",
        logic_template_applied_at: "2026-11-06T10:00:00Z",
      }),
    ]);
    const ap = aprobacionesDelCatalogo(catalogo([{ base: "a", status: "approved", approved_at: "2026-11-07T10:00:00Z" }]));
    expect(cambiosRecientes(e, ap, HOY).map((c) => `${c.fecha} ${c.base}: ${c.hecho}`)).toEqual([
      "9 nov Minas: lectura de SurveyMonkey, 11 respuestas nuevas",
      "7 nov Civil: aprobada para informe",
      "6 nov Minas: se aplicó la lógica del formulario de Civil",
      "1 nov Civil: base agregada al estudio",
    ]);
  });

  test("una importación no son respuestas nuevas, y la lógica de otro proyecto no se nombra por su archivo", () => {
    const e = estudio([
      base({
        nombre: "a",
        source_alias: "Civil",
        added_at: "NA",
        surveymonkey_last_refresh: { refreshed_at: "2026-06-23T21:58:28Z", n_new: 182, sav_bundle_import: true },
        logic_template_base: "ING_MECA.pulso",
        logic_template_applied_at: "2026-06-02T20:13:52Z",
      }),
      base({ nombre: "b", source_alias: "Minas", added_at: "NA", logic_template_base: "desconocida", logic_template_applied_at: "2026-06-03T20:13:52Z" }),
    ]);
    expect(cambiosRecientes(e, null, HOY).map((c) => `${c.fecha} ${c.base}: ${c.hecho}`)).toEqual([
      "23 jun Civil: importación del SAV de SurveyMonkey, 182 respuestas",
      "2 jun Civil: se aplicó la lógica del formulario de otro proyecto",
    ]);
  });

  test("se queda con los más recientes", () => {
    const muchas = Array.from({ length: MAX_CAMBIOS + 5 }, (_, i) => base({ nombre: `b${i}`, added_at: `2026-10-${String(i + 1).padStart(2, "0")}T10:00:00Z` }));
    const lista = cambiosRecientes(estudio(muchas), null, HOY);
    expect(lista).toHaveLength(MAX_CAMBIOS);
    expect(lista[0].base).toBe(`b${MAX_CAMBIOS + 4}`);
  });
});

describe("porHacer", () => {
  test("el paso del estudio, las aprobaciones por hacer en orden de base y lo bloqueado", () => {
    const state = { xlsform: true, data: true, auditoria_run: false, n_bases: 2 } as SessionState;
    const e = estudio([base({ nombre: "a", source_alias: "Civil" }), base({ nombre: "b", source_alias: "Minas" })]);
    const ap = aprobacionesDelCatalogo(catalogo([{ base: "b", status: "stale", approved_at: "2026-11-01T10:00:00Z" }, { base: "a", status: "approved" }]));
    const tareas = porHacer(queSigue(state), ap, basesDelEstudio(e, ap).filas);
    expect(tareas.map((t) => [t.titulo, t.detalle, t.to, t.bloqueada, t.base])).toEqual([
      ["Auditar las respuestas", "Todavía no se ha ejecutado la auditoría.", "/validacion", false, null],
      ["Volver a aprobar para informe", "Minas: cambió un insumo después de aprobarla", "/analitica", false, "b"],
      ["Gráficos", "Prepara Analítica.", "/graficos", true, null],
    ]);
  });
});
