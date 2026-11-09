// Mata: un payload vacío o con campos faltantes que tumba la UI, un veredicto o estado desconocido que se dibuja como
// marca, una regla con valores fuera de rango que se envía al backend, y la forma real de columnas y cambios_tablas.
import { describe, expect, it } from "vitest";
import {
  normalizeCambiosTablas,
  normalizeDiferenciasColumnas,
  normalizeDiferenciasInforme,
  normalizeDiferenciasLamina,
  normalizeDiferenciasLaminaRespuesta,
  normalizeDiferenciasRegla,
  normalizeDiferenciasReglaRespuesta,
  normalizeVistaPreviaRegla,
  REGLA_DIFERENCIAS_POR_DEFECTO,
} from "./graficosDiferencias";

describe("normalizeDiferenciasRegla", () => {
  it("vacío → la regla por defecto (z con Bonferroni por fila)", () => {
    expect(normalizeDiferenciasRegla(undefined)).toEqual(REGLA_DIFERENCIAS_POR_DEFECTO);
    expect(normalizeDiferenciasRegla("basura")).toEqual(REGLA_DIFERENCIAS_POR_DEFECTO);
  });
  it("valores desconocidos o fuera de rango caen a la base; conglomerado null se respeta", () => {
    const r = normalizeDiferenciasRegla({ prueba: "chi2", correccion: "holm", alfa: 3, fragiles: "x", conglomerado: null, umbral_puntos: "15" });
    expect(r.prueba).toBe("z");
    expect(r.correccion).toBe("bonferroni_fila");
    expect(r.alfa).toBe(0.05);
    expect(r.fragiles).toBe("contorno");
    expect(r.conglomerado).toBeNull();
    expect(r.umbral_puntos).toBe(15);
  });
  it("la regla guardada hereda de la propuesta lo que no trae", () => {
    const resp = normalizeDiferenciasReglaRespuesta({
      regla: { alfa: 0.01 },
      propuesta: { prueba: "rao_scott", correccion: "bh_informe", conglomerado: "aula_x" },
      origen: "propuesta",
      columnas: [{ name: "aula_x", n_valores: 12, conocida: true }, "otra"],
      familia: 300,
    });
    expect(resp.regla).toMatchObject({ prueba: "rao_scott", correccion: "bh_informe", alfa: 0.01, conglomerado: "aula_x" });
    expect(resp.origen).toBe("propuesta");
    expect(resp.familia).toBe(300);
    expect(resp.columnas.conglomerado.map((c) => c.valor)).toEqual(["aula_x", "otra"]);
    expect(resp.columnas.conglomerado[0].etiqueta).toBe("aula_x (12 valores)");
  });
});

describe("columnas y cambios de las tablas", () => {
  it("objeto con dos listas o una sola lista para ambas; sin duplicados ni vacíos", () => {
    expect(normalizeDiferenciasColumnas({ conglomerado: ["a", "a", ""], estrato: [{ value: "e", label: "Estrato" }] }))
      .toEqual({ conglomerado: [{ valor: "a", etiqueta: "a" }], estrato: [{ valor: "e", etiqueta: "Estrato" }] });
    expect(normalizeDiferenciasColumnas(null)).toEqual({ conglomerado: [], estrato: [] });
  });
  it("cambios_tablas con la forma del backend, un número suelto o nada", () => {
    expect(normalizeCambiosTablas({ celdas_total: 900, celdas_cambian: 6, ganan_marca: 2, pierden_marca: 3, cambian_letras: 1 }))
      .toEqual({ cambian: 6, total: 900, ganan_marca: 2, pierden_marca: 3, cambian_letras: 1 });
    expect(normalizeCambiosTablas(4)).toMatchObject({ cambian: 4, total: null });
    expect(normalizeCambiosTablas(undefined)).toMatchObject({ cambian: 0, total: null });
  });
  it("vista previa vacía no revienta", () => {
    expect(normalizeVistaPreviaRegla({})).toMatchObject({ nota: "", origen: null, familia: null, cambios_tablas: { cambian: 0 } });
  });
});

describe("normalizeDiferenciasLamina", () => {
  it("payload vacío → error visible, sin pares ni marcas", () => {
    const l = normalizeDiferenciasLamina(undefined);
    expect(l.estado).toBe("error");
    expect(l.error?.message).toBeTruthy();
    expect(l.pares).toEqual([]);
    expect(l.activo).toBe(false);
  });
  it("estado desconocido → error que lo nombra; veredicto desconocido → no_comparable", () => {
    const l = normalizeDiferenciasLamina({
      slide_id: "s1", estado: "raro",
      pares: [{ fila: "Sí", a: "B", b: "A", veredicto: "superclaro", p_a: "44", p_b: 17, ic: [1] }],
    });
    expect(l.estado).toBe("error");
    expect(l.error?.message).toContain("raro");
    expect(l.pares[0]).toMatchObject({ veredicto: "no_comparable", p_a: 44, p_b: 17, ic: null, n_a: null, redaccion: "" });
  });
  it("lámina completa con nulls donde no hay valor", () => {
    const l = normalizeDiferenciasLamina({
      slide_id: "s2", titulo: "T", estado: "con_marcas", activo: true, motivo: null, error: null, variable: "p1", cruce: "g",
      modo_letras: "frente_al_resto",
      grupos: [{ letra: "A", codigo: "1", etiqueta: "Grupo uno", n: 120, conglomerados: 14, comparable: true, motivo: null }, { etiqueta: "Chico", n: 9 }],
      pares: [{ fila: "Sí", a: "A", b: "resto", p_a: 40, p_b: 20, n_a: 120, n_b: 300, dif: 20, p: null, p_ajustado: 0.002, deff: null, ic: [10, 30], veredicto: "marcada", redaccion: null }],
      nota: null, revisar: ["base_chica", "base_chica", "nuevo_codigo"],
    });
    expect(l.error).toBeNull();
    expect(l.activo).toBe(true);
    expect(l.modo_letras).toBe("frente_al_resto");
    expect(l.grupos[0].codigo).toBe("1");
    expect(l.grupos[1]).toMatchObject({ letra: "B", comparable: false });
    expect(l.pares[0]).toMatchObject({ b: "resto", n_b: 300, ic: [10, 30], deff: null, redaccion: "" });
    expect(l.nota).toBe("");
    expect(l.revisar).toEqual(["base_chica", "nuevo_codigo"]);
  });
  it("el error de la prueba viaja con su código e id", () => {
    const r = normalizeDiferenciasLaminaRespuesta({ lamina: { estado: "error", error: { code: "E_SIG_PRUEBA_FALLO", message: "falló", error_id: "ab12" } } });
    expect(r.lamina.error).toEqual({ code: "E_SIG_PRUEBA_FALLO", message: "falló", error_id: "ab12" });
    expect(r.regla).toEqual(REGLA_DIFERENCIAS_POR_DEFECTO);
  });
});

describe("normalizeDiferenciasInforme", () => {
  it("sin resumen, los conteos se derivan de las láminas: `marcadas` son las firmes y las frágiles van aparte, como el backend", () => {
    const inf = normalizeDiferenciasInforme({
      laminas: [
        { estado: "con_marcas", pares: [{ veredicto: "marcada" }, { veredicto: "fragil" }], revisar: ["titulo_afirma_fragil"] },
        { estado: "ninguna", pares: [{ veredicto: "bajo_umbral" }], revisar: ["sin_diferencias"] },
      ],
    });
    expect(inf.resumen).toEqual({ cruces: 2, marcadas: 1, fragiles: 1, ninguna: 1, bases_chicas: 0, sin_prueba: 0, familia: 0 });
  });
  it("el resumen del backend manda", () => {
    expect(normalizeDiferenciasInforme({ laminas: [], resumen: { cruces: 33, marcadas: 41, familia: 412 } }).resumen)
      .toMatchObject({ cruces: 33, marcadas: 41, familia: 412, fragiles: 0 });
  });
});

describe("ranuras de la lámina (ADR 0128 «Familia por base»)", () => {
  const ranura = (extra: Record<string, unknown>) => ({
    estado: "con_marcas", cruce: "sexo", variable: "p1", activo: true,
    grupos: [{ letra: "A", etiqueta: "Mujer", n: 80, comparable: true }, { letra: "B", etiqueta: "Hombre", n: 70, comparable: true }],
    pares: [{ fila: "Sí", a: "A", b: "B", dif: 20, p_ajustado: 0.001, veredicto: "marcada" }],
    ...extra,
  });

  it("con `ranuras`: una por ranura, en el orden del payload, heredando slide_id y título", () => {
    const l = normalizeDiferenciasLamina({
      slide_id: "s4", titulo: "Cuatro", ...ranura({}),
      ranuras: [
        ranura({ ranura: "grafico_1", indice: 1, graficador: "p_barras_agrupadas", base: "estudiantes" }),
        ranura({ ranura: "grafico_3", indice: 3, graficador: "p_barras_apiladas", base: "docentes", estado: "ninguna", pares: [] }),
      ],
    });
    expect(l.ranuras.map((r) => [r.ranura, r.indice, r.graficador, r.base, r.estado])).toEqual([
      ["grafico_1", 1, "p_barras_agrupadas", "estudiantes", "con_marcas"],
      ["grafico_3", 3, "p_barras_apiladas", "docentes", "ninguna"],
    ]);
    expect(l.ranuras[1]).toMatchObject({ slide_id: "s4", titulo: "Cuatro" });
  });

  it("sin `ranuras` (backend anterior): la primera ranura armada con los campos de la lámina", () => {
    const l = normalizeDiferenciasLamina({ slide_id: "s1", ...ranura({}) });
    expect(l.ranuras).toHaveLength(1);
    expect(l.ranuras[0]).toMatchObject({ ranura: "", indice: 1, base: null, estado: "con_marcas", cruce: "sexo" });
    expect(l.ranuras[0].pares).toHaveLength(1);
  });

  it("sin cruce ni `ranuras`, y entre públicos: ninguna ranura", () => {
    expect(normalizeDiferenciasLamina({ slide_id: "s1", estado: "sin_cruce" }).ranuras).toEqual([]);
    expect(normalizeDiferenciasLamina({ slide_id: "s1", modo_letras: "entre_publicos", estado: "ninguna", ranuras: [ranura({})] }).ranuras).toEqual([]);
  });

  it("una ranura en error conserva su motivo y su código; un estado desconocido es error, nunca marca", () => {
    const l = normalizeDiferenciasLamina({
      slide_id: "s4", ...ranura({}),
      ranuras: [
        ranura({ ranura: "grafico_2", indice: 2, base: null, estado: "error", pares: [], motivo: "La base de la ranura es ambigua.", error: { code: "E_SIG_BASE_AMBIGUA", message: "La base de la ranura es ambigua." } }),
        ranura({ ranura: "grafico_4", estado: "marcadas" }),
        "basura",
      ],
    });
    expect(l.ranuras[0]).toMatchObject({ estado: "error", base: null, error: { code: "E_SIG_BASE_AMBIGUA", message: "La base de la ranura es ambigua." } });
    expect(l.ranuras[1].estado).toBe("error");
    expect(l.ranuras[1].error?.message).toMatch(/marcadas/);
    expect(l.ranuras[2]).toMatchObject({ ranura: "3", indice: 3, estado: "error" });
  });

  it("el resumen que falta se deriva de todas las ranuras, no sólo de la primera", () => {
    const inf = normalizeDiferenciasInforme({
      laminas: [{
        slide_id: "s4", ...ranura({}),
        ranuras: [ranura({ ranura: "grafico_1" }), ranura({ ranura: "grafico_2", estado: "ninguna", pares: [] }), ranura({ ranura: "grafico_3", estado: "abstencion", pares: [], revisar: ["sin_prueba"] })],
      }],
    });
    expect(inf.resumen).toMatchObject({ cruces: 3, ninguna: 1, sin_prueba: 1, marcadas: 1 });
  });
});
