import { describe, expect, it, vi } from "vitest";
import { construirTablasEnSheets, rotuloDeHoja } from "./tablasEnSheets";

const publicado = { spreadsheet_url: "https://docs.google.com/spreadsheets/d/x", hojas: [{ hoja: "Base de control", accion: "actualizada", filas: 193 }] };

function deps(estado: "sin_entrega" | "desactualizada" | "por_traer" | "aplicada") {
  return { entrega: vi.fn(async () => ({ estado })), traer: vi.fn(async () => ({})), publicar: vi.fn(async () => publicado) };
}

describe("construir las tablas en Sheets desde Material (R13)", () => {
  it("sin entrega o con la entrega vieja no escribe nada", async () => {
    for (const estado of ["sin_entrega", "desactualizada"] as const) {
      const d = deps(estado);
      expect((await construirTablasEnSheets(d, "")).ok).toBe(false);
      expect(d.traer).not.toHaveBeenCalled();
      expect(d.publicar).not.toHaveBeenCalled();
    }
  });

  it("con la entrega por traer, la trae y después publica; ya aplicada, sólo publica", async () => {
    const porTraer = deps("por_traer");
    expect(await construirTablasEnSheets(porTraer, "  https://docs.google.com/x  ")).toMatchObject({ ok: true, trajo: true });
    expect(porTraer.traer).toHaveBeenCalledTimes(1);
    expect(porTraer.publicar).toHaveBeenCalledWith("https://docs.google.com/x");
    const aplicada = deps("aplicada");
    expect(await construirTablasEnSheets(aplicada, "")).toMatchObject({ ok: true, trajo: false });
    expect(aplicada.traer).not.toHaveBeenCalled();
    // Sin enlace se usa el que Monitoreo ya recuerda.
    expect(aplicada.publicar).toHaveBeenCalledWith(undefined);
  });

  it("cada hoja dice qué le pasó, y la del equipo que no se tocó", () => {
    expect(rotuloDeHoja({ hoja: "Base de control", accion: "actualizada", filas: 193 })).toBe("Base de control · actualizada (193 filas)");
    expect(rotuloDeHoja({ hoja: "Aulas Aplicadas (Campo)", accion: "respetada", filas: 1 })).toBe("Aulas Aplicadas (Campo) · del equipo, sin tocar (1 fila)");
  });
});
