import { describe, expect, it } from "vitest";
import previa from "./cargaActualizar.fixture.json";
import { normalizarActualizacion, normalizarDecisiones, normalizarRespaldo, normalizarVistaPrevia } from "./cargaActualizar";

// `cargaActualizar.fixture.json` es la respuesta real de
// `POST /api/estudio/base/respuestas/vista-previa` (sin `base`) sobre el fixture
// de `helper-base-variables.R`: 40 casos, la versión nueva trae 31 y cambia q3 de u05.

describe("normalizarVistaPrevia", () => {
  it("lee la respuesta real del motor", () => {
    const v = normalizarVistaPrevia(previa);
    expect(v.casos).toMatchObject({ antes: 40, despues: 31, nuevos: 1, yaNoVienen: 10, editados: 1, sinCambios: 29, celdasCambiadas: 1, causa: null });
    expect(v.casos.ejemplos.nuevos).toEqual(["u41"]);
    expect(v.identificador).toEqual({ columnas: ["_uuid"], metodo: "columna_candidata" });
    expect(v.columnas.conCambios).toEqual([{ columna: "q3", nCasos: 1 }]);
    expect(v.versionVigente).toEqual({ archivo: "data_2026.xlsx", es: "vigente" });
    expect(v.formulario.cambia).toBe(false);
    expect(v.fases.map((f) => f.fase)).toEqual(["carga", "validacion", "codificacion", "analitica", "graficos"]);
    const validacion = v.fases[1];
    expect(validacion.hayQueRehacer).toEqual([{ clave: "auditoria", que: "Volver a auditar", n: 2, causa: "Casos nuevos y editados." }]);
    expect(validacion.sePierde[0]?.n).toBe(1);
    expect(v.decisiones.map((d) => d.destino)).toEqual(["conserva", "se_pierde"]);
    expect(v.respaldo).toBeNull();
  });

  it("un conteo ausente queda null, nunca cero", () => {
    const v = normalizarVistaPrevia({ casos: { antes: 40, despues: 31, nuevos: null, causa: "Las dos versiones no comparten una columna que identifique a los casos." } });
    expect(v.casos.nuevos).toBeNull();
    expect(v.casos.sinCambios).toBeNull();
    expect(v.casos.causa).toMatch(/no comparten/);
  });

  it("acepta escalares envueltos en arreglos de Plumber", () => {
    const v = normalizarVistaPrevia({ casos: { antes: [40], nuevos: [3] }, formulario: { cambia: [false], causa: ["x"] } });
    expect(v.casos.antes).toBe(40);
    expect(v.casos.nuevos).toBe(3);
    expect(v.formulario.causa).toBe("x");
  });
});

describe("normalizarDecisiones", () => {
  it("un destino desconocido se lee como pérdida, no como conservado", () => {
    expect(normalizarDecisiones([{ id: "1", destino: "otro" }])[0]?.destino).toBe("se_pierde");
  });
});

describe("normalizarRespaldo y normalizarActualizacion", () => {
  it("lee la copia legible y la dañada", () => {
    expect(normalizarRespaldo({ creado_en: "2026-11-12T12:59:29Z", archivo: "data_2026.xlsx", n_filas: 40, legible: true, causa: null }))
      .toEqual({ creadoEn: "2026-11-12T12:59:29Z", archivo: "data_2026.xlsx", nFilas: 40, legible: true, causa: null });
    expect(normalizarRespaldo({ legible: false, causa: "La copia anterior está dañada y no se puede leer." })?.legible).toBe(false);
    expect(normalizarRespaldo(null)).toBeNull();
  });

  it("lee los cambios de la respuesta de actualizar", () => {
    const a = normalizarActualizacion({ ok: true, archivo: "v2.xlsx", cambios: { casos: { nuevos: 1 } }, respaldo: { legible: true, archivo: "data_2026.xlsx", n_filas: 40 } });
    expect(a.archivo).toBe("v2.xlsx");
    expect(a.cambios.casos.nuevos).toBe(1);
    expect(a.respaldo?.legible).toBe(true);
  });
});
