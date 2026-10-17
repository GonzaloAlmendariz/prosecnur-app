/**
 * Unidades › Origen (E1e): las frases y el normalizador.
 *
 * Material de campo no decide las unidades: las cita de otro módulo. En
 * HSVG2026 el plan venía del sorteo del 1/8 y la selección vigente era del
 * 21/8, y la pantalla sólo decía «otra corrida». Aquí se prueba que la pestaña
 * dice QUÉ cambió, sin inventar un veredicto que el backend no dio.
 */
import { describe, expect, it } from "vitest";

import { normalizeCollectionOrigen } from "../../api/recopiladores";
import { ORIGEN_CAMBIO_CRUDO, origenAlDia, origenDe, origenSinFuente } from "./origen.fixture";
import {
  accionActualizar,
  avisoDeLaLista,
  avisoDeTruncado,
  detalleDeLaFuente,
  enlacesDeLaFuente,
  fechaDelSorteo,
  filasDeDiferencias,
  huellaCorta,
  huellaYVigencia,
  lineaDelConteo,
  opcionesDeFiltro,
  rotuloDelRol,
  tituloDeLaFuente,
  vacioDeLaLista,
  vigenciaDelOrigen,
} from "./origen";

describe("normalizeCollectionOrigen", () => {
  it("lee el contrato congelado campo por campo", () => {
    const o = origenDe();
    expect(o.estado).toBe("cambio");
    expect(o.stale).toBe(true);
    expect(o.fuente).toEqual({
      modulo: "calc-muestra",
      origen: "calc_muestra_aulas_selection",
      disponible: true,
      run_id: "sel_aulas_20260821160928_bf10d14c",
      fecha: "",
      unidades: 2616,
      error_id: null,
    });
    expect(o.plan.unidades).toBe(2468);
    expect(o.resumen.afectadas).toEqual({ unidades: 3, fichas: 1, unidades_con_ficha: 3, accesos: 3 });
    expect(o.resumen.fichas_cobertura).toEqual({ juegos: 1, unidades_cubiertas: 2468 });
    expect(o.veredicto).toBe("huella");
    expect(o.sorteo_vigente?.generado_at).toBe("2026-08-21T16:09:28Z");
    expect(o.cambios?.altas).toHaveLength(2);
    expect(o.cambios?.roles[0]).toMatchObject({ codigo: "R 14.1", antes: "chain_reserve", despues: "titular", sensible: false });
  });

  it("sin fuente: `afectadas` en null, el id del error y ningún veredicto", () => {
    const o = origenSinFuente();
    expect(o.estado).toBe("sin_fuente");
    expect(o.resumen.afectadas).toBeNull();
    expect(o.fuente.error_id).toBe("err_5c1e");
    expect(o.veredicto).toBeNull();
    expect(o.cambios).toBeNull();
    expect(vigenciaDelOrigen(o).tono).toBe("vacio");
  });

  it("un backend con sólo `fichas_total` no afirma unidades cubiertas", () => {
    const resumen: Record<string, unknown> = { ...ORIGEN_CAMBIO_CRUDO.resumen, fichas_total: 4 };
    delete resumen.fichas_cobertura;
    const o = origenDe({ resumen });
    expect(o.resumen.fichas_cobertura).toEqual({ juegos: 4, unidades_cubiertas: 0 });
  });

  it("rechaza un schema que no es el suyo", () => {
    expect(() => normalizeCollectionOrigen({ ...ORIGEN_CAMBIO_CRUDO, schema: "collection_state/v1" })).toThrow();
    expect(() => normalizeCollectionOrigen(null)).toThrow();
  });

  it("acepta escalares envueltos por R (`[x]`)", () => {
    const o = normalizeCollectionOrigen({ ...ORIGEN_CAMBIO_CRUDO, schema: ["collection_origen/v1"], stale: [true], estado: ["cambio"] });
    expect(o.stale).toBe(true);
    expect(o.estado).toBe("cambio");
  });

  it("lo sensible no llega a pantalla aunque el backend lo mande", () => {
    const o = origenDe({
      cambios: {
        ...ORIGEN_CAMBIO_CRUDO.cambios,
        campos: [{ clave: "k", unit_id: "u", codigo: "CH 1", campo: "docente", antes: "Ana Pérez", despues: "Luis Soto", sensible: true }],
      },
    });
    expect(o.cambios?.campos[0]).toMatchObject({ antes: null, despues: null, sensible: true });
  });

  it("un estado desconocido se deduce; nunca se afirma «al día» sin plan", () => {
    expect(origenDe({ estado: "otro", plan: { existe: false } }).estado).toBe("sin_plan");
    expect(origenDe({ estado: "", fuente: { disponible: false } }).estado).toBe("sin_fuente");
    expect(origenDe({ estado: undefined, stale: true }).estado).toBe("cambio");
  });

  it("nivel=resumen trae cambios en null", () => {
    const o = origenDe({ nivel: "resumen", cambios: null, fingerprint_actual: null });
    expect(o.nivel).toBe("resumen");
    expect(o.cambios).toBeNull();
    expect(o.fingerprint_actual).toBeNull();
    expect(filasDeDiferencias(o, "todas")).toEqual([]);
  });

  it("descarta filas sin clave en vez de pintar una fila vacía", () => {
    const o = origenDe({ cambios: { altas: [{ codigo: "CH 9" }, null], bajas: [], campos: [{ clave: "k" }], roles: [] } });
    expect(o.cambios?.altas).toEqual([]);
    expect(o.cambios?.campos).toEqual([]);
  });
});

describe("de dónde salen", () => {
  it("nombra la fuente en el idioma de quien la usa", () => {
    const o = origenDe();
    expect(tituloDeLaFuente(o)).toBe("Selección de cursos-horario · Cálculo de muestra");
    expect(detalleDeLaFuente(o)).toBe("2,616 unidades · sorteo del 21/8/2026 · la lista no se edita aquí".replace("2,616", (2616).toLocaleString("es-PE")));
  });

  it("si manda Monitoreo, lleva a su agenda", () => {
    const o = origenDe({ fuente: { ...ORIGEN_CAMBIO_CRUDO.fuente, modulo: "monitoreo", origen: "monitoreo_aulas_plan" } });
    expect(tituloDeLaFuente(o)).toBe("Agenda de cursos-horario · Monitoreo");
    expect(enlacesDeLaFuente(o).modulo?.to).toBe("/monitoreo?seccion=modelo");
  });

  it("fecha corta y huella corta", () => {
    expect(fechaDelSorteo("sel_aulas_20260815093000_ab")).toBe("15/8/2026");
    expect(fechaDelSorteo("sel_aulas_20260801211224_e3", false)).toBe("1/8");
    expect(fechaDelSorteo("legacy-monitoreo-aulas")).toBe("");
    expect(fechaDelSorteo("sel_20261301000000")).toBe("");
    expect(fechaDelSorteo("2026-08-21")).toBe("21/8/2026");
    expect(fechaDelSorteo("2026-08-21", false)).toBe("21/8");
    expect(huellaCorta("sha256:a3f2000000000000000000000000ce19")).toBe("a3f2…19");
    expect(huellaCorta("")).toBe("");
  });
});

describe("vigencia", () => {
  it("al día: verde, una frase, sin acción primaria", () => {
    const o = origenAlDia();
    const v = vigenciaDelOrigen(o);
    expect(v.tono).toBe("al-dia");
    expect(v.titulo).toBe("Al día con la fuente");
    expect(accionActualizar(o)).toMatchObject({ primaria: false, deshabilitada: false });
  });

  it("cambio: dice qué entra, qué cambia, qué se desactualiza", () => {
    const o = origenDe();
    const v = vigenciaDelOrigen(o);
    expect(v.tono).toBe("cambio");
    expect(v.frases).toEqual([
      "2 unidades entran a la lista.",
      "2 datos cambiaron en la fuente.",
      "1 unidad cambia de rol.",
      "3 fichas generadas quedan desactualizadas.",
    ]);
    expect(accionActualizar(o)).toMatchObject({ primaria: true, deshabilitada: false });
  });

  it("sólo cambió la corrida: lo dice sin inventar diferencias", () => {
    const o = origenDe({
      solo_corrida: true,
      resumen: { ...ORIGEN_CAMBIO_CRUDO.resumen, altas: 0, bajas: 0, campos: 0, roles: 0, unidades_con_cambios: 0, afectadas: { unidades: 0, fichas: 0, unidades_con_ficha: 0, accesos: 0 } },
      cambios: { altas: [], bajas: [], campos: [], roles: [] },
    });
    expect(vigenciaDelOrigen(o).frases).toEqual(["Hay un sorteo más reciente con las mismas unidades."]);
    expect(vacioDeLaLista(o, "todas")).toContain("sólo cambió la corrida");
  });

  it("entregado: lo dice aparte", () => {
    const o = origenDe({ resumen: { ...ORIGEN_CAMBIO_CRUDO.resumen, entregado: true } });
    expect(vigenciaDelOrigen(o).frases).toContain("El plan ya se entregó a Monitoreo.");
  });

  it("fuente intermedia desfasada: botón deshabilitado con motivo y enlace a Monitoreo", () => {
    const a = accionActualizar(origenDe({ fuente_intermedia_desfasada: true }));
    expect(a?.deshabilitada).toBe(true);
    expect(a?.motivo).toContain("Monitoreo");
    expect(a?.resolver?.to).toBe("/monitoreo?seccion=modelo");
  });

  it("sin plan no hay acción; sin fuente, deshabilitada", () => {
    expect(accionActualizar(origenDe({ estado: "sin_plan", plan: { existe: false } }))).toBeNull();
    expect(accionActualizar(origenDe({ estado: "sin_fuente", stale: false, fuente: { disponible: false } }))?.deshabilitada).toBe(true);
  });
});

describe("la lista de diferencias", () => {
  it("todas, en orden: altas, bajas, cambios, roles", () => {
    const filas = filasDeDiferencias(origenDe(), "todas");
    expect(filas.map((f) => f.rotulo)).toEqual(["Entra", "Entra", "Cambia", "Cambia", "Rol"]);
    expect(filas[0]).toMatchObject({ codigo: "CH 191", que: "Banco · Cálculo I · Ingeniería" });
    expect(filas[2]).toMatchObject({ codigo: "CH 19", que: "Aula", antes: "H-105", despues: "H-110" });
  });

  it("el docente cambia sin decir a quién", () => {
    const docente = filasDeDiferencias(origenDe(), "cambios")[1];
    expect(docente).toMatchObject({ que: "Docente (no se muestra)", antes: "", despues: "" });
  });

  it("el rol se traduce", () => {
    const [rol] = filasDeDiferencias(origenDe(), "roles");
    expect(rol).toMatchObject({ antes: "Reserva", despues: "Titular" });
    expect(rotuloDelRol("extra_reserve_pool")).toBe("Banco");
    expect(rotuloDelRol("otra_cosa")).toBe("otra_cosa");
  });

  it("los conteos del filtro son los del resumen, no los de la página", () => {
    const opciones = opcionesDeFiltro(origenDe());
    expect(opciones.map((o) => [o.value, o.count])).toEqual([
      ["todas", 5], ["altas", 2], ["bajas", 0], ["cambios", 2], ["roles", 1],
    ]);
  });

  it("un filtro vacío dice por qué", () => {
    expect(vacioDeLaLista(origenDe(), "bajas")).toBe("No sale ninguna unidad.");
    expect(vacioDeLaLista(origenAlDia(), "todas")).toBe("La lista coincide con la fuente.");
  });

  it("avisa si el backend cortó una lista, sólo para el filtro que la muestra", () => {
    const o = origenDe({ truncado: { altas: true, bajas: false, campos: false, roles: false } });
    expect(avisoDeTruncado(o, "todas")).toContain("primeras 200");
    expect(avisoDeTruncado(o, "altas")).toContain("primeras 200");
    expect(avisoDeTruncado(o, "roles")).toBe("");
    expect(avisoDeTruncado(origenDe(), "todas")).toBe("");
  });

  it("conteo en una línea", () => {
    expect(lineaDelConteo({ altas: 2, bajas: 0, campos: 1, roles: 0 })).toBe("Entran 2, salen 0, cambian 1");
    expect(lineaDelConteo({ altas: 0, bajas: 1, campos: 0, roles: 3 })).toBe("Entran 0, salen 1, cambian 0, 3 de rol");
  });
});

describe("huella y vigencia en una línea", () => {
  it("usa la fecha del plan cuando la trae", () => {
    const o = origenDe({ plan: { ...ORIGEN_CAMBIO_CRUDO.plan, fecha: "2026-08-01" } });
    expect(huellaYVigencia(o)).toEqual({ huella: "a3f2…19", cuando: "sorteo del 1/8/2026" });
  });

  it("si el plan no la trae y es del sorteo vigente, la de generación de la selección", () => {
    const o = origenAlDia();
    expect(huellaYVigencia(o).cuando).toBe("sorteo del 1/8/2026");
    const sinRun = origenDe({
      plan: { ...ORIGEN_CAMBIO_CRUDO.plan, run_id: "sel_qa" },
      sorteo_vigente: { run_id: "sel_qa", generado_at: "2026-09-03 10:15:00", desfasado: false },
    });
    expect(huellaYVigencia(sinRun).cuando).toBe("sorteo del 3/9/2026");
  });

  it("no presta la fecha de otro sorteo", () => {
    const o = origenDe({
      plan: { ...ORIGEN_CAMBIO_CRUDO.plan, run_id: "sel_qa" },
      sorteo_vigente: { run_id: "sel_otro", generado_at: "2026-09-03T10:15:00Z", desfasado: true },
    });
    expect(huellaYVigencia(o).cuando).toBe("");
  });
});

describe("el aviso de Unidades › Lista", () => {
  it("otro sorteo: lo dice con su fecha y manda a Origen", () => {
    expect(avisoDeLaLista({ selection_run_id: "sel_aulas_20260821160928_bf", desfasado: true }, null)).toEqual({
      texto: "La selección vigente es de otro sorteo (del 21 ago 2026, 16:09).",
      enlace: { label: "Ver qué cambió", to: "/material-campo?seccion=unidades&pestana=origen" },
    });
  });

  it("mismo sorteo pero la huella cambió: avisa igual", () => {
    const aviso = avisoDeLaLista({ selection_run_id: "x", desfasado: false }, origenDe());
    expect(aviso?.texto).toBe("La fuente cambió desde que se armó esta lista.");
    expect(aviso?.enlace.label).toBe("Ver qué cambió");
  });

  it("al día o sin leer: nada", () => {
    expect(avisoDeLaLista({ selection_run_id: "x", desfasado: false }, origenAlDia())).toBeNull();
    expect(avisoDeLaLista(null, null)).toBeNull();
    expect(avisoDeLaLista(null, origenSinFuente())).toBeNull();
  });
});
