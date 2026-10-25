import { describe, expect, it } from "vitest";
import { reciboDeFallo, reciboDeHojas, reciboDeRecalcular, reciboDeSync } from "./reciboDelSync";

const ok = { ok: true } as const;

describe("el recibo dice qué se trajo de cada fuente", () => {
  it("filas nuevas en las incrementales, leídas en las completas, y que recalculó", () => {
    const recibo = reciboDeSync({
      sync_summary: {
        a: { source_label: "PDM Kobo", mode: "incremental", rows: 41 },
        b: { source_label: "Universo", mode: "full", rows: 1009 },
      },
      errors: [],
    }, ok);
    expect(recibo).toEqual({ tono: "exito", mensaje: "Actualizado", detalle: "PDM Kobo: 41 nuevas · Universo: 1,009 leídas · Recalculado" });
  });

  it("una incremental sin nada nuevo lo dice", () => {
    expect(reciboDeSync({ sync_summary: [{ source_label: "Kobo", mode: "incremental", rows: 0 }] }, ok).detalle)
      .toBe("Kobo: sin nuevas · Recalculado");
  });

  it("una fuente que falla vuelve el recibo un aviso", () => {
    const recibo = reciboDeSync({
      sync_summary: { a: { source_label: "Universo", mode: "full", rows: 2 } },
      errors: [{ source_label: "Barrido", message: "sin acceso" }],
    }, ok);
    expect(recibo.tono).toBe("aviso");
    expect(recibo.mensaje).toBe("Actualizado en parte");
    expect(recibo.detalle).toContain("Barrido: falló");
  });

  it("si fallan todas, es un error", () => {
    const recibo = reciboDeSync({ sync_summary: [], errors: [{ source_id: "k1", message: "x" }] }, ok);
    expect(recibo).toEqual({ tono: "error", mensaje: "No se pudo actualizar", detalle: "k1: falló" });
  });

  it("si se trajo pero no se pudo releer el estado, lo dice", () => {
    const recibo = reciboDeSync({ sync_summary: { a: { source_label: "Kobo", mode: "incremental", rows: 3 } } }, { ok: false, mensaje: "Timeout" });
    expect(recibo.tono).toBe("error");
    expect(recibo.detalle).toBe("Kobo: 3 nuevas · Timeout");
  });

  it("hojas, recalcular y fallo", () => {
    expect(reciboDeHojas({ n_rows: 2296 }, 2, ok).detalle).toBe("2 hojas de Sheets: 2,296 registros · Recalculado");
    expect(reciboDeRecalcular(ok)).toEqual({ tono: "exito", mensaje: "Tablero recalculado", detalle: "Sin traer nada" });
    expect(reciboDeRecalcular({ ok: false, mensaje: "E" }).tono).toBe("error");
    expect(reciboDeFallo("Sin token").tono).toBe("error");
  });
});
