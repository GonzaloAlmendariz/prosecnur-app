import { describe, expect, it } from "vitest";
import {
  decisionesPorDefecto,
  PERFIL_EJEMPLO,
  PLANTILLA_UNIVERSIDAD,
} from "../../dominio";
import {
  MOTOR_RECORRIDO_SCHEMA,
  motorRecorridoIgual,
  normalizarMotorRecorrido,
  serializarMotorRecorrido,
  type MotorRecorridoSlice,
} from "../persistencia";

function sliceDefault(): MotorRecorridoSlice {
  return {
    fuente: "proyecto",
    perfil: structuredClone(PLANTILLA_UNIVERSIDAD),
    decisiones: decisionesPorDefecto(PLANTILLA_UNIVERSIDAD),
    tocado: false,
  };
}

describe("serializarMotorRecorrido", () => {
  it("emite el schema v1 con timestamp ISO", () => {
    const mr = serializarMotorRecorrido(sliceDefault());
    expect(mr.schema).toBe(MOTOR_RECORRIDO_SCHEMA);
    expect(mr.fuente).toBe("proyecto");
    expect(mr.tocado).toBe(false);
    expect(typeof mr.actualizado_at).toBe("string");
    expect(Number.isNaN(Date.parse(mr.actualizado_at ?? ""))).toBe(false);
  });
});

describe("round-trip serializar → normalizar", () => {
  it("el estado default del motor sobrevive semánticamente igual", () => {
    const slice = sliceDefault();
    const vuelta = normalizarMotorRecorrido(serializarMotorRecorrido(slice));
    expect(vuelta).not.toBeNull();
    expect(vuelta?.fuente).toBe("proyecto");
    expect(vuelta?.tocado).toBe(false);
    expect(vuelta?.perfil.id).toBe(PLANTILLA_UNIVERSIDAD.id);
    expect(vuelta?.perfil).toEqual(slice.perfil);
    expect(vuelta?.decisiones).toEqual(slice.decisiones);
  });

  it("decisiones movidas (c7, bolsa 2, e2, margen cambiado) sobreviven", () => {
    const slice = sliceDefault();
    slice.fuente = "manual";
    slice.tocado = true;
    slice.decisiones = {
      ...slice.decisiones,
      parametros: { ...slice.decisiones.parametros, margenError: 0.031 },
      opcionalesActivos: ["c7"],
      bolsaExtraPorFacultad: 2,
      escenario: "e2",
    };
    const vuelta = normalizarMotorRecorrido(serializarMotorRecorrido(slice));
    expect(vuelta?.fuente).toBe("manual");
    expect(vuelta?.tocado).toBe(true);
    expect(vuelta?.decisiones.parametros.margenError).toBe(0.031);
    expect(vuelta?.decisiones.opcionalesActivos).toEqual(["c7"]);
    expect(vuelta?.decisiones.bolsaExtraPorFacultad).toBe(2);
    expect(vuelta?.decisiones.escenario).toBe("e2");
  });

  it("un perfil editado (unidades manuales) sobrevive con sus facultades", () => {
    const slice = sliceDefault();
    slice.perfil.esEjemplo = false;
    slice.perfil.facultades = [
      { id: "fac-a", nombre: "Facultad A", N: 1200, mujeres: 700, hombres: 500, estAulaMediana: 32, estAulaMedia: 30.5, alcanzables: null, pExito: null },
    ];
    const vuelta = normalizarMotorRecorrido(serializarMotorRecorrido(slice));
    expect(vuelta?.perfil.facultades).toEqual(slice.perfil.facultades);
  });

  it("un perfil de preset (ejemplo) conserva su id y sus criterios", () => {
    const slice: MotorRecorridoSlice = {
      fuente: "manual",
      perfil: structuredClone(PERFIL_EJEMPLO),
      decisiones: decisionesPorDefecto(PERFIL_EJEMPLO),
      tocado: false,
    };
    const vuelta = normalizarMotorRecorrido(serializarMotorRecorrido(slice));
    expect(vuelta?.perfil.id).toBe(PERFIL_EJEMPLO.id);
    expect(vuelta?.perfil).toEqual(slice.perfil);
  });
});

describe("normalizarMotorRecorrido (defensivo)", () => {
  it("null / undefined / no-objeto → null (retrocompat: workspaces viejos)", () => {
    expect(normalizarMotorRecorrido(null)).toBeNull();
    expect(normalizarMotorRecorrido(undefined)).toBeNull();
    expect(normalizarMotorRecorrido("hola")).toBeNull();
    expect(normalizarMotorRecorrido(42)).toBeNull();
    expect(normalizarMotorRecorrido([])).toBeNull();
  });

  it("sin perfil utilizable → null", () => {
    expect(normalizarMotorRecorrido({ fuente: "manual", perfil: null, decisiones: null, tocado: true })).toBeNull();
    expect(normalizarMotorRecorrido({ perfil: "x" })).toBeNull();
  });

  it("basura mixta cae a defaults sanos sin NaN", () => {
    const vuelta = normalizarMotorRecorrido({
      perfil: { id: "no-existe", facultades: "x" },
      decisiones: { escenario: "x9", bolsaExtraPorFacultad: Number.NaN, opcionalesActivos: [1, "c7"] },
    });
    expect(vuelta).not.toBeNull();
    // id desconocido → base plantilla; facultades corruptas → las de la base.
    expect(vuelta?.perfil.facultades).toEqual(PLANTILLA_UNIVERSIDAD.facultades);
    expect(vuelta?.perfil.parametros).toEqual(PLANTILLA_UNIVERSIDAD.parametros);
    expect(vuelta?.decisiones.escenario).toBe("e1");
    // Bolsa default del canon: bolsaOpciones[bolsaSugerida] de la plantilla.
    expect(vuelta?.decisiones.bolsaExtraPorFacultad).toBe(
      decisionesPorDefecto(PLANTILLA_UNIVERSIDAD).bolsaExtraPorFacultad,
    );
    expect(Number.isFinite(vuelta?.decisiones.bolsaExtraPorFacultad)).toBe(true);
    expect(vuelta?.decisiones.opcionalesActivos).toEqual(["c7"]);
    expect(vuelta?.tocado).toBe(false);
  });

  it("filtra NaN/Infinity en parámetros y facultades", () => {
    const vuelta = normalizarMotorRecorrido({
      fuente: "manual",
      perfil: {
        id: PLANTILLA_UNIVERSIDAD.id,
        parametros: { margenError: Number.NaN, deff: Number.POSITIVE_INFINITY, proporcion: 0.4 },
        facultades: [
          { id: "ok", nombre: "OK", N: 500, mujeres: Number.NaN, hombres: 200 },
          { id: "rota", N: Number.NaN },
          { nombre: "sin id", N: 100 },
          "basura",
        ],
      },
      decisiones: null,
      tocado: "sí",
    });
    expect(vuelta?.perfil.parametros.margenError).toBe(PLANTILLA_UNIVERSIDAD.parametros.margenError);
    expect(vuelta?.perfil.parametros.deff).toBe(PLANTILLA_UNIVERSIDAD.parametros.deff);
    expect(vuelta?.perfil.parametros.proporcion).toBe(0.4);
    expect(vuelta?.perfil.facultades).toHaveLength(1);
    expect(vuelta?.perfil.facultades[0]).toMatchObject({ id: "ok", N: 500, mujeres: 0, hombres: 200 });
    expect(vuelta?.tocado).toBe(false);
    expect(vuelta?.fuente).toBe("manual");
  });

  it("fuente desconocida cae a proyecto", () => {
    const vuelta = normalizarMotorRecorrido({ fuente: "otro", perfil: { id: PLANTILLA_UNIVERSIDAD.id } });
    expect(vuelta?.fuente).toBe("proyecto");
  });
});

describe("motorRecorridoIgual (guardia anti-bucle)", () => {
  it("ignora actualizado_at: dos serializaciones del mismo estado son iguales", () => {
    const slice = sliceDefault();
    const a = { ...serializarMotorRecorrido(slice), actualizado_at: "2026-01-01T00:00:00Z" };
    const b = { ...serializarMotorRecorrido(slice), actualizado_at: "2026-07-11T12:00:00Z" };
    expect(motorRecorridoIgual(a, b)).toBe(true);
  });

  it("detecta cambios reales de decisiones", () => {
    const a = serializarMotorRecorrido(sliceDefault());
    const slice = sliceDefault();
    slice.decisiones = { ...slice.decisiones, escenario: "e2" };
    const b = serializarMotorRecorrido(slice);
    expect(motorRecorridoIgual(a, b)).toBe(false);
  });

  it("null solo es igual a null/undefined", () => {
    const a = serializarMotorRecorrido(sliceDefault());
    expect(motorRecorridoIgual(null, null)).toBe(true);
    expect(motorRecorridoIgual(null, undefined)).toBe(true);
    expect(motorRecorridoIgual(a, null)).toBe(false);
    expect(motorRecorridoIgual(null, a)).toBe(false);
  });
});
