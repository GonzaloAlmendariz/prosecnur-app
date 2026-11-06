import { describe, expect, it } from "vitest";
import { importEnCursoDe } from "./importEnCurso";
import type { ImportEnLanzamiento, ImportVivo } from "../carga/plataforma/usePlataformaStore";

const base = { proveedor: "surveymonkey", estrategia: "separada", cancelSolicitado: false } as const;

function vivo(etiqueta: string, iniciadoEn: number, fase: 0 | 1 | 2 | 3, percent: number | null): ImportVivo {
  return {
    ...base,
    clave: `surveymonkey:separada:${etiqueta}` as ImportVivo["clave"],
    etiqueta,
    iniciadoEn,
    jobId: `job-${etiqueta}`,
    progreso: { fase, percent, actual: null, total: null, mensaje: "" },
    reintentando: false,
  };
}

describe("import en curso para la tarjeta de Procesamiento (L31b)", () => {
  it("sin jobs no hay barra", () => {
    expect(importEnCursoDe({ lanzando: {}, vivos: {} })).toBeNull();
  });

  it("muestra el job vivo con su fase y su avance acotado a 0–100", () => {
    const r = importEnCursoDe({ lanzando: {}, vivos: { a: vivo("Profesores", 10, 1, 140.4) } as never });
    expect(r).toEqual({ etiqueta: "Profesores", fase: "Descargar respuestas", percent: 100, otros: 0 });
  });

  it("con varios, el más antiguo y cuántos más hay", () => {
    const r = importEnCursoDe({
      lanzando: {},
      vivos: { a: vivo("Nuevo", 20, 2, null), b: vivo("Antiguo", 5, 3, 80) } as never,
    });
    expect(r).toMatchObject({ etiqueta: "Antiguo", fase: "Materializar base", percent: 80, otros: 1 });
  });

  it("uno que todavía se lanza (sin job_id) ya cuenta, en la primera fase", () => {
    const lanzando: ImportEnLanzamiento = { ...base, clave: "x" as ImportEnLanzamiento["clave"], etiqueta: "Egresados", iniciadoEn: 1 };
    expect(importEnCursoDe({ lanzando: { x: lanzando } as never, vivos: {} })).toEqual({
      etiqueta: "Egresados", fase: "Conectar", percent: null, otros: 0,
    });
  });
});
