import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalcMuestraReferenciaAsistencia } from "../../../../api/calcMuestra";
import type { CalcMuestraWorkspaceSourceBinding } from "../../../../api/client";
import { ensureUniversitySourceBindings } from "./categorias";

type ReferenciaNormalizer = (value: unknown) => CalcMuestraReferenciaAsistencia | null;

const referenciaBinding: CalcMuestraWorkspaceSourceBinding = {
  id: "src-referencia-asistencia",
  role: "referencia_asistencia",
  label: "Referencia de asistencia",
  status: "cargada",
  file_id: "file-referencia-asistencia",
  sheet_name: "Base de control",
};

function celda(overrides: Record<string, unknown> = {}) {
  return {
    celda_key: "base",
    celda_label: "Base sintética",
    orden: 1,
    k: 12,
    matriculados: 120,
    asistentes: 0,
    tasa: 0,
    estimador: "razon_agregada",
    media_ch: 0,
    sd_ch: 0,
    ic_low: 0,
    ic_high: 0,
    metodo_ic: "bootstrap_percentil",
    suficiencia: "delgada",
    tasa_publicada: 0,
    k_publicada: 12,
    fuente_publicada: "celda",
    ...overrides,
  };
}

function payloadValido(): Record<string, unknown> {
  const tramo = (key: string, label: string, numerador: number, denominador: number) => ({
    key,
    label,
    k: 12,
    numerador,
    denominador,
    tasa: denominador === 0 ? null : numerador / denominador,
    ic_low: denominador === 0 ? null : 0,
    ic_high: denominador === 0 ? null : 0,
    metodo_ic: denominador === 0 ? "no_aplica" : "bootstrap_percentil",
  });
  return {
    schema: "calc_muestra_referencia_asistencia_v2",
    owner: "estudio_historico_externo",
    momento: "post_hoc_estudio_previo",
    transferible: "modelo_por_celda",
    modelo: "marginales_independientes",
    combinable: false,
    unidad: "encuentro_en_curso_horario_aplicado",
    denominador: "matriculados_totales",
    estudio: {
      id: "estudio-sintetico",
      label: "Estudio histórico sintético",
      periodo: "2026-I",
      fuente: "fixture_sintetico",
    },
    cobertura: {
      agendados: 12,
      aplicados: 12,
      observados: 12,
      glosario_completo: false,
      columnas_glosario: [], columnas_criterio: [],
    },
    identidad: {
      regla: "A = E + no_respondieron",
      verificada: true,
      verificables: 12,
      inconsistentes: 0,
      residuales_negativos: null,
    },
    umbrales: {
      insuficiente_max: 11,
      delgada_min: 12,
      solida_min: 30,
      bootstrap_n: 2000,
      nivel_ic: 0.95,
      quantile_type: 7,
    },
    cadena: {
      asistencia: tramo("asistencia", "Asistencia", 0, 120),
      apertura: tramo("apertura", "Apertura", 0, 0),
      efectividad: tramo("efectividad", "Efectividad", 0, 0),
      rendimiento: tramo("rendimiento", "Rendimiento", 0, 120),
    },
    global: {
      k: 12,
      matriculados: 120,
      asistentes: 0,
      enviadas: 0,
      validas: 0,
      no_respondieron: 0,
      tasa: 0,
      media_ch: 0,
      sd_ch: 0,
      ic_low: 0,
      ic_high: 0,
      metodo_ic: "bootstrap_percentil",
    },
    dimensiones: [
      { dimension_key: "tamano", dimension_label: "Tamaño", orden: 1, filas: [celda()] },
      {
        dimension_key: "rango_horario",
        dimension_label: "Rango horario",
        orden: 2,
        filas: [celda({
          celda_key: "sin_dato",
          celda_label: "Sin dato",
          k: 0,
          matriculados: null,
          asistentes: null,
          tasa: null,
          media_ch: null,
          sd_ch: null,
          ic_low: null,
          ic_high: "NA",
          metodo_ic: "no_aplica",
          suficiencia: "vacia",
          tasa_publicada: "NA",
          k_publicada: null,
          fuente_publicada: "sin_publicacion",
        })],
      },
      { dimension_key: "facultad", dimension_label: "Facultad", orden: 3, filas: [celda()] },
      { dimension_key: "tipo_sesion", dimension_label: "Tipo de sesión", orden: 4, filas: [celda()] },
    ],
    advertencias: ["marginales_no_combinables"],
  };
}

function primeraCelda(payload: Record<string, unknown>): Record<string, unknown> {
  const dimensiones = payload.dimensiones as Array<{
    filas: Array<Record<string, unknown>>;
  }>;
  return dimensiones[0]!.filas[0]!;
}

function agregaAdvertenciaDinamica(payload: Record<string, unknown>) {
  payload.advertencias = [
    ...(payload.advertencias as string[]),
    "asistentes_mayor_matriculados:1",
  ];
}

function storageVacio() {
  return {
    length: 0,
    clear: vi.fn(),
    getItem: vi.fn(() => null),
    key: vi.fn(() => null),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ensureUniversitySourceBindings — referencia de asistencia", () => {
  it("conserva el binding opcional sin cambiar los insumos obligatorios", () => {
    const defaults = ensureUniversitySourceBindings("base_madre", []);
    const bindings = ensureUniversitySourceBindings("base_madre", [referenciaBinding]);
    const obligatoriosPorDefecto = defaults.filter(
      (binding) => binding.role !== "referencia_asistencia",
    );
    const referenciasPorDefecto = defaults.filter(
      (binding) => binding.role === "referencia_asistencia",
    );
    const referenciasCargadas = bindings.filter(
      (binding) => binding.role === "referencia_asistencia",
    );

    expect(obligatoriosPorDefecto.map((binding) => binding.role)).toEqual(["base_madre"]);
    expect(referenciasPorDefecto).toHaveLength(1);
    expect(referenciasCargadas).toHaveLength(1);
    expect(referenciasCargadas[0], "Debe fusionar y preservar la referencia cargada")
      .toMatchObject(referenciaBinding);
  });
});

describe("normalizeCalcMuestraReferenciaAsistencia", () => {
  it("valida el schema completo y preserva ceros y NA/null", async () => {
    const api = await import("../../../../api/calcMuestra") as unknown as Record<string, unknown>;
    const candidate = api.normalizeCalcMuestraReferenciaAsistencia;
    expect(
      candidate,
      "Falta export público normalizeCalcMuestraReferenciaAsistencia en src/api/calcMuestra.ts",
    ).toBeTypeOf("function");
    if (typeof candidate !== "function") return;
    const normalize = candidate as ReferenciaNormalizer;

    expect(normalize(null)).toBeNull();
    expect(normalize({ schema: "schema_desconocido" })).toBeNull();
    expect(normalize({ schema: "calc_muestra_referencia_asistencia_v2" })).toBeNull();

    const obligatorios = [
      "owner", "momento", "transferible", "modelo", "combinable",
      "unidad", "denominador", "dimensiones",
    ];
    for (const field of obligatorios) {
      const incompleto = payloadValido();
      delete incompleto[field];
      expect(normalize(incompleto), `Debe rechazar contrato sin ${field}`).toBeNull();
    }
    const sinCelda = payloadValido();
    const dimensiones = sinCelda.dimensiones as Array<Record<string, unknown>>;
    dimensiones[0] = { ...dimensiones[0], filas: [{ celda_key: "incompleta" }] };
    expect(normalize(sinCelda)).toBeNull();

    const normalized = normalize(payloadValido());
    expect(normalized).not.toBeNull();
    if (!normalized) return;
    expect(normalized.schema).toBe("calc_muestra_referencia_asistencia_v2");
    expect(normalized.owner).toBe("estudio_historico_externo");
    expect(normalized.combinable).toBe(false);
    expect(normalized.dimensiones.map((dimension) => dimension.dimension_key)).toEqual([
      "tamano", "rango_horario", "facultad", "tipo_sesion",
    ]);
    expect(normalized.global.tasa).toBe(0);
    expect(normalized.dimensiones[0].filas[0].tasa).toBe(0);
    expect(normalized.dimensiones[0].filas[0].ic_low).toBe(0);
    expect(normalized.dimensiones[1].filas[0].ic_low).toBeNull();
    expect(normalized.dimensiones[1].filas[0].ic_high).toBeNull();
    expect(normalized.dimensiones[1].filas[0].tasa_publicada).toBeNull();
  });

  it("rechaza suficiencia incompatible con k", async () => {
    const api = await import("../../../../api/calcMuestra");
    const payload = payloadValido();
    Object.assign(primeraCelda(payload), {
      k: 2,
      suficiencia: "delgada",
    });

    expect(api.normalizeCalcMuestraReferenciaAsistencia(payload)).toBeNull();
  });

  it("rechaza publicación incompatible con k, tasa o intervalo", async () => {
    const api = await import("../../../../api/calcMuestra");

    const insuficienteComoCelda = payloadValido();
    Object.assign(primeraCelda(insuficienteComoCelda), {
      k: 9,
      suficiencia: "insuficiente",
      ic_low: null,
      ic_high: null,
      metodo_ic: "no_aplica",
      k_publicada: 9,
      fuente_publicada: "celda",
    });
    expect(api.normalizeCalcMuestraReferenciaAsistencia(insuficienteComoCelda))
      .toBeNull();

    const publicadaDistinta = payloadValido();
    primeraCelda(publicadaDistinta).tasa_publicada = 0.25;
    expect(api.normalizeCalcMuestraReferenciaAsistencia(publicadaDistinta)).toBeNull();

    const intervaloEnKInsuficiente = payloadValido();
    Object.assign(primeraCelda(intervaloEnKInsuficiente), {
      k: 9,
      suficiencia: "insuficiente",
      tasa_publicada: 0,
      k_publicada: 12,
      fuente_publicada: "global",
    });
    expect(api.normalizeCalcMuestraReferenciaAsistencia(intervaloEnKInsuficiente))
      .toBeNull();
  });

  it("rechaza tasas de cadena que no nacen de sus conteos", async () => {
    const api = await import("../../../../api/calcMuestra");

    const tramoIncoherente = payloadValido();
    const cadenaTramo = tramoIncoherente.cadena as Record<string, Record<string, unknown>>;
    cadenaTramo.asistencia!.tasa = 0.5;
    expect(api.normalizeCalcMuestraReferenciaAsistencia(tramoIncoherente)).toBeNull();

    const productoIncoherente = payloadValido();
    const cadenaProducto = productoIncoherente.cadena as Record<string, Record<string, unknown>>;
    cadenaProducto.rendimiento!.tasa = 0.25;
    expect(api.normalizeCalcMuestraReferenciaAsistencia(productoIncoherente)).toBeNull();
  });

  it("rechaza toda tasa_publicada fuera del rango de probabilidad", async () => {
    const api = await import("../../../../api/calcMuestra");
    const payload = payloadValido();
    primeraCelda(payload).tasa_publicada = 1.01;

    expect(api.normalizeCalcMuestraReferenciaAsistencia(payload)).toBeNull();
  });

  it("rechaza sin_publicacion para k insuficiente cuando existe global valida", async () => {
    const api = await import("../../../../api/calcMuestra");
    const payload = payloadValido();
    Object.assign(primeraCelda(payload), {
      k: 9,
      ic_low: null,
      ic_high: null,
      metodo_ic: "no_aplica",
      suficiencia: "insuficiente",
      tasa_publicada: null,
      k_publicada: null,
      fuente_publicada: "sin_publicacion",
    });

    expect(api.normalizeCalcMuestraReferenciaAsistencia(payload)).toBeNull();
  });

  it("rechaza toda tasa fuera de rango, con o sin advertencia del backend", async () => {
    // Contrato viejo (retirado por el ADR 0060, fix D5): una tasa > 1 se
    // aceptaba como "diagnóstico" si viajaba la advertencia dinámica
    // `asistentes_mayor_matriculados:N` y la publicación degradaba a global sin
    // clamp. Hoy una tasa imposible es un defecto de fórmula y el normalizador
    // falla cerrado siempre; el contrato nuevo lo congela
    // src/api/__tests__/calcMuestra.tasa-imposible-fail-closed.test.ts.
    const api = await import("../../../../api/calcMuestra");
    const prepararDiagnostico = () => {
      const payload = payloadValido();
      Object.assign(primeraCelda(payload), {
        matriculados: 100,
        asistentes: 150,
        tasa: 1.5,
        tasa_publicada: 0,
        k_publicada: 12,
        fuente_publicada: "global",
      });
      return payload;
    };

    const sinAdvertencia = prepararDiagnostico();
    expect(api.normalizeCalcMuestraReferenciaAsistencia(sinAdvertencia)).toBeNull();

    const conClamp = prepararDiagnostico();
    agregaAdvertenciaDinamica(conClamp);
    Object.assign(primeraCelda(conClamp), {
      tasa_publicada: 1,
      k_publicada: 12,
      fuente_publicada: "celda",
    });
    expect(api.normalizeCalcMuestraReferenciaAsistencia(conClamp)).toBeNull();

    const degradadoGlobal = prepararDiagnostico();
    agregaAdvertenciaDinamica(degradadoGlobal);
    expect(
      api.normalizeCalcMuestraReferenciaAsistencia(degradadoGlobal),
      "La advertencia dinámica ya no habilita tasas > 1: fallo cerrado",
    ).toBeNull();

    const sinPublicacion = prepararDiagnostico();
    agregaAdvertenciaDinamica(sinPublicacion);
    Object.assign(primeraCelda(sinPublicacion), {
      tasa_publicada: null,
      k_publicada: null,
      fuente_publicada: "sin_publicacion",
    });
    const normalizadoSinPublicacion = api.normalizeCalcMuestraReferenciaAsistencia(
      sinPublicacion,
    );
    expect(normalizadoSinPublicacion).toBeNull();
  });

  it("acepta la salida sancionada del desborde: tasa null + conteos + residual_negativo + no_aplica", async () => {
    // B1 (ADR 0060): la forma que el backend emite ante un conteo de campo que
    // no cierra —congelada por test-calc-muestra-asistencia-referencia.R— es
    // numerador 15, denominador 10, tasa NA, `residual_negativo = true` y
    // `metodo_ic = "no_aplica"`. La marca es la ÚNICA llave que habilita tasa
    // null con conteos poblados; el fail-closed del contrato D5 sigue intacto
    // (tasa 1.3 explícita se rechaza en calcMuestra.tasa-imposible-fail-closed).
    const api = await import("../../../../api/calcMuestra");
    const payloadResidual = () => {
      const payload = payloadValido();
      const cadena = payload.cadena as Record<string, Record<string, unknown>>;
      Object.assign(cadena.asistencia!, {
        numerador: 15,
        denominador: 10,
        tasa: null,
        residual_negativo: true,
        ic_low: null,
        ic_high: null,
        metodo_ic: "no_aplica",
      });
      // Coherencia de encadenamiento sin glosario: apertura se mide sobre los
      // asistentes (15) y el rendimiento sobre los mismos elegibles (10).
      Object.assign(cadena.apertura!, {
        numerador: 0,
        denominador: 15,
        tasa: 0,
        ic_low: 0,
        ic_high: 0,
        metodo_ic: "bootstrap_percentil",
      });
      Object.assign(cadena.rendimiento!, { numerador: 0, denominador: 10, tasa: 0 });
      // El global comparte los conteos desbordados, así que publica el mismo
      // patrón sancionado (reparación paralela del backend).
      Object.assign(payload.global as Record<string, unknown>, {
        matriculados: 10,
        asistentes: 15,
        tasa: null,
        residual_negativo: true,
        ic_low: null,
        ic_high: null,
        metodo_ic: "no_aplica",
      });
      // Sin tasa global publicable, las celdas degradan a sin_publicacion.
      const dimensiones = payload.dimensiones as Array<{
        filas: Array<Record<string, unknown>>;
      }>;
      for (const dimension of dimensiones) {
        for (const fila of dimension.filas) {
          if (fila.fuente_publicada !== "celda") continue;
          Object.assign(fila, {
            matriculados: 10,
            asistentes: 15,
            tasa: null,
            residual_negativo: true,
            ic_low: null,
            ic_high: null,
            metodo_ic: "no_aplica",
            tasa_publicada: null,
            k_publicada: null,
            fuente_publicada: "sin_publicacion",
          });
        }
      }
      agregaAdvertenciaDinamica(payload);
      return payload;
    };

    const normalizado = api.normalizeCalcMuestraReferenciaAsistencia(payloadResidual());
    expect(normalizado, "El tramo residual legítimo debe aceptarse").not.toBeNull();
    expect(normalizado?.cadena.asistencia).toMatchObject({
      numerador: 15,
      denominador: 10,
      tasa: null,
      residual_negativo: true,
      metodo_ic: "no_aplica",
    });
    expect(normalizado?.global).toMatchObject({
      matriculados: 10,
      asistentes: 15,
      tasa: null,
      residual_negativo: true,
    });
    expect(normalizado?.dimensiones[0]?.filas[0]).toMatchObject({
      tasa: null,
      residual_negativo: true,
      fuente_publicada: "sin_publicacion",
    });

    // Sin la marca, la misma forma (tasa null con conteos poblados) sigue
    // siendo payload defectuoso: el fail-closed no se relajó.
    const sinMarca = payloadResidual();
    const cadenaSinMarca = sinMarca.cadena as Record<string, Record<string, unknown>>;
    cadenaSinMarca.asistencia!.residual_negativo = false;
    expect(
      api.normalizeCalcMuestraReferenciaAsistencia(sinMarca),
      "Tasa null con conteos poblados y sin marca = payload defectuoso",
    ).toBeNull();

    // La marca tampoco habilita publicar la magnitud imposible: residual true
    // con tasa poblada es contradictorio y falla cerrado.
    const marcaConTasa = payloadResidual();
    const cadenaConTasa = marcaConTasa.cadena as Record<string, Record<string, unknown>>;
    cadenaConTasa.asistencia!.tasa = 1.5;
    expect(
      api.normalizeCalcMuestraReferenciaAsistencia(marcaConTasa),
      "residual_negativo con tasa poblada es contradictorio: fallo cerrado",
    ).toBeNull();
  });

  it("acepta una celda residual que degrada su publicación a la global válida", async () => {
    // B1 · path de celdas de dimensiones: el desborde vive en UNA celda; la
    // global sigue sana y la celda publica por degradación (tasa_publicada =
    // global.tasa), exactamente como cualquier celda sin tasa propia.
    const api = await import("../../../../api/calcMuestra");
    const payload = payloadValido();
    Object.assign(primeraCelda(payload), {
      matriculados: 120,
      asistentes: 156,
      tasa: null,
      residual_negativo: true,
      ic_low: null,
      ic_high: null,
      metodo_ic: "no_aplica",
      tasa_publicada: 0,
      k_publicada: 12,
      fuente_publicada: "global",
    });
    agregaAdvertenciaDinamica(payload);

    const normalizado = api.normalizeCalcMuestraReferenciaAsistencia(payload);
    expect(normalizado, "La celda residual legítima debe aceptarse").not.toBeNull();
    expect(normalizado?.dimensiones[0]?.filas[0]).toMatchObject({
      matriculados: 120,
      asistentes: 156,
      tasa: null,
      residual_negativo: true,
      metodo_ic: "no_aplica",
      tasa_publicada: 0,
      fuente_publicada: "global",
    });

    // La misma celda sin la marca vuelve al fail-closed original.
    const sinMarca = api.normalizeCalcMuestraReferenciaAsistencia({
      ...payload,
      dimensiones: (payload.dimensiones as Array<Record<string, unknown>>).map(
        (dimension, index) => index === 0
          ? {
              ...dimension,
              filas: [{
                ...(dimension.filas as Array<Record<string, unknown>>)[0],
                residual_negativo: false,
              }],
            }
          : dimension,
      ),
    });
    expect(sinMarca, "Celda con tasa null sin marca = payload defectuoso").toBeNull();
  });

  it("el wrapper rechaza si la respuesta directa difiere del sibling de state", async () => {
    const directa = payloadValido();
    const sibling = payloadValido();
    (sibling.estudio as Record<string, unknown>).label = "Sibling sintetico distinto";
    vi.stubGlobal("localStorage", storageVacio());
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      referencia_asistencia: directa,
      state: { referencia_asistencia: sibling },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
    const api = await import("../../../../api/calcMuestra");

    await expect(api.apiCalcMuestraAsistenciaReferencia({
      referencia_asistencia_file_id: "file-sintetico",
      estudio: {
        id: "estudio-sintetico",
        label: "Estudio sintetico",
        periodo: "2026-I",
        fuente: "fixture_sintetico",
      },
    })).rejects.toThrow();
  });

  it("acepta el payload sin la dimensión de tamaño, que es opcional", async () => {
    const api = await import("../../../../api/calcMuestra") as unknown as Record<string, unknown>;
    const normalizeCalcMuestraReferenciaAsistencia =
      api.normalizeCalcMuestraReferenciaAsistencia as ReferenciaNormalizer;

    // Los tramos de tamaño los declara el estudio en Marco. Sin grupos
    // declarados el motor omite esa dimensión y las tres restantes conservan
    // sus órdenes 2, 3 y 4.
    //
    // Este test existe porque el defecto se escapó dos veces: el motor cambió
    // el contrato y el normalizador siguió exigiendo cuatro dimensiones con
    // `orden === índice + 1`. El payload llegaba entero, el cliente lo
    // descartaba en silencio y la pestaña quedaba en blanco sin decir por qué.
    const base = payloadValido();
    const todas = base.dimensiones as Array<Record<string, unknown>>;
    const sinTamano = {
      ...base,
      dimensiones: todas.filter((d) => d.dimension_key !== "tamano"),
    };

    const normalizado = normalizeCalcMuestraReferenciaAsistencia(sinTamano);
    expect(normalizado).not.toBeNull();
    expect(normalizado?.dimensiones.map((d) => d.dimension_key)).toEqual([
      "rango_horario",
      "facultad",
      "tipo_sesion",
    ]);

    // Con las cuatro sigue funcionando: quitarla es opcional, no obligatorio.
    expect(normalizeCalcMuestraReferenciaAsistencia(base)).not.toBeNull();

    // Lo que sí invalida el payload es perder una dimensión que describe el
    // marco, o que los órdenes dejen de ser crecientes.
    expect(normalizeCalcMuestraReferenciaAsistencia({
      ...base,
      dimensiones: todas.filter((d) => d.dimension_key !== "facultad"),
    })).toBeNull();
    expect(normalizeCalcMuestraReferenciaAsistencia({
      ...base,
      dimensiones: [...todas].reverse(),
    })).toBeNull();
  });
});
