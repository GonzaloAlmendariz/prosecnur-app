// Estado por base y por fase del motor (M8): normalizador, celdas de "Estado del
// estudio" y marcas de la banda de la base activa.
import { describe, expect, it } from "vitest";

import type { EstudioBase, EstudioPayload } from "../../../api/estudio";
import { normalizarCarpetaDeEntregables, normalizarFasesDeBase } from "../../../api/estudioFases";
import { marcasDeBaseActiva } from "../banda/fasesDeBaseActivaModel";
import { basesDelEstudio } from "./basesDelEstudioModel";

const HOY = new Date(2026, 10, 12);

const fase = (estado: string, extra: Record<string, unknown> = {}) => ({
  estado, motivo: "x", causa: null, actualizado_en: null, sin_fecha: "Sin fecha.", ...extra,
});

const fasesMotor = (sobre: Record<string, unknown> = {}) => ({
  fuente: { plataforma: null, leida_en: null, sin_fecha: "Las respuestas no se leyeron de una plataforma." },
  fases: {
    carga: fase("hecha", { motivo: "cargada", actualizado_en: "2026-11-01T10:00:00Z" }),
    validacion: fase("hecha", { motivo: "cerrada", actualizado_en: "2026-11-06T10:00:00Z" }),
    codificacion: fase("sin_iniciar"),
    analitica: fase("sin_iniciar"),
    graficos: fase("sin_iniciar"),
    ...sobre,
  },
});

const base = (nombre: string, fases: unknown): EstudioBase => ({
  nombre, xlsform_file_id: "f", data_file_id: "d", n_filas: 10,
  status: { imported: true, validacion: true }, fases,
} as EstudioBase);

const estudio = (bases: EstudioBase[], activa: string): EstudioPayload => ({
  nombre: "E", active_base: activa, n_bases: bases.length, max_bases: 9,
  bases: Object.fromEntries(bases.map((b) => [b.nombre, b])),
});

describe("normalizarFasesDeBase", () => {
  it("un estado fuera de la lista no se traga: la fase queda null y se conserva lo recibido", () => {
    const n = normalizarFasesDeBase(fasesMotor({ validacion: fase("terminada") }));
    expect(n?.fases.validacion).toBeNull();
    expect(n?.fueraDeLista.validacion).toBe("terminada");
    expect(n?.fases.carga?.estado).toBe("hecha");
  });

  it("sin fases o con forma inválida devuelve null", () => {
    expect(normalizarFasesDeBase(undefined)).toBeNull();
    expect(normalizarFasesDeBase({ fases: [] })).toBeNull();
  });

  it("la carpeta de entregables o su causa", () => {
    expect(normalizarCarpetaDeEntregables({ ruta: "/p/Entregables", sin_ruta: null })).toEqual({ ruta: "/p/Entregables", sinRuta: null });
    expect(normalizarCarpetaDeEntregables({ ruta: null, sin_ruta: "El proyecto no se ha guardado." })?.sinRuta).toMatch("no se ha guardado");
  });
});

describe("Estado del estudio con el estado del motor", () => {
  it("Validación desactualizada se dice con su causa; cerrada lleva la fecha del cierre", () => {
    const motor = fasesMotor({
      validacion: fase("desactualizada", {
        motivo: "respuestas_actualizadas",
        causa: "Las respuestas se actualizaron después de cerrar la limpieza: falta volver a auditar y a cerrar la base.",
        actualizado_en: "2026-11-09T10:00:00Z",
      }),
    });
    const filas = basesDelEstudio(estudio([base("A", motor), base("B", fasesMotor())], "A"), null, HOY).filas;
    const valA = filas[0].fases?.find((f) => f.fase === "validacion");
    expect(valA).toMatchObject({ estado: "Desactualizada", tono: "warn", desactualizada: true, causaPendiente: null });
    expect(valA?.causa).toMatch("se actualizaron después de cerrar");
    const valB = filas[1].fases?.find((f) => f.fase === "validacion");
    expect(valB).toMatchObject({ estado: "Cerrada", tono: "success", causa: "Cierre del 6 nov", desactualizada: false });
  });

  it("Analítica con archivos sin registro de versión no se declara al día", () => {
    const motor = fasesMotor({ analitica: fase("en_curso", { motivo: "sin_registro_de_version", causa: "Hay archivos generados." }) });
    const ana = basesDelEstudio(estudio([base("A", motor)], "A"), null, HOY).filas[0].fases?.find((f) => f.fase === "analitica");
    expect(ana?.estado).toBe("Con archivos");
    expect(ana?.estado).not.toBe("Al día");
  });

  it("sin estado del motor, la fila sigue leyendo los indicadores", () => {
    const val = basesDelEstudio(estudio([base("A", undefined)], "A"), null, HOY).filas[0].fases?.find((f) => f.fase === "validacion");
    expect(val).toMatchObject({ estado: "Iniciada", desactualizada: false });
  });
});

describe("marcasDeBaseActiva", () => {
  it("las marcas son de la base activa, no de la hermana", () => {
    const desact = fasesMotor({ validacion: fase("desactualizada", { causa: "Cambió." }) });
    const e = estudio([base("A", fasesMotor()), base("B", desact)], "A");
    expect(marcasDeBaseActiva(e)?.porSeccion.validacion).toEqual({ hecha: true, desactualizada: false, causa: null });
    const enB = marcasDeBaseActiva({ ...e, active_base: "B" });
    expect(enB?.porSeccion.validacion).toEqual({ hecha: false, desactualizada: true, causa: "Cambió." });
  });

  it("sin estado del motor no hay marcas", () => {
    expect(marcasDeBaseActiva(estudio([base("A", undefined)], "A"))).toBeNull();
    expect(marcasDeBaseActiva(null)).toBeNull();
  });
});
