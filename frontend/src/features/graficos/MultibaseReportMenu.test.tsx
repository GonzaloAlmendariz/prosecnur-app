// H5 (contrato A7-1): el paquete por bases guarda lo pendiente antes de lanzarse y muestra los avisos del motor.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AvisosPaqueteBases, avisosDelPaquete, iniciarPaqueteBases } from "./MultibaseReportMenu";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

describe("paquete por bases", () => {
  it("guarda lo pendiente ANTES de pedir /ppt-all", async () => {
    const orden: string[] = [];
    const flush = vi.fn(async () => { orden.push("flush"); return true; });
    const pptAll = vi.fn(async () => { orden.push("ppt-all"); return { job_id: "job-7" }; });

    await expect(iniciarPaqueteBases({ flush, pptAll })).resolves.toBe("job-7");
    expect(orden).toEqual(["flush", "ppt-all"]);
  });

  it("si el guardado falla, no lanza el paquete", async () => {
    const pptAll = vi.fn(async () => ({ job_id: "job-8" }));
    await expect(iniciarPaqueteBases({
      flush: async () => { throw new Error("guardado fallido"); },
      pptAll,
    })).rejects.toThrow("guardado fallido");
    expect(pptAll).not.toHaveBeenCalled();
  });

  it("el menú usa el flush del editor, que respeta el alcance hidratado", () => {
    const source = fs.readFileSync(path.join(featureDir, "MultibaseReportMenu.tsx"), "utf8");
    expect(source).toContain(
      "iniciarPaqueteBases({ flush: flushGraficosConfigIfHydrated, pptAll: apiGraficosPptAll })",
    );
    expect(source.match(/apiGraficosPptAll\(/g)).toBeNull();
  });

  it("toma los avisos del resultado y descarta lo que no es texto", () => {
    expect(avisosDelPaquete({
      ok: true, file_id: "f", size: 1, n_bases: 2, bases: [],
      avisos: ["Lámina 3 de «docentes» · salió en 2 partes", "", "  "],
    })).toEqual(["Lámina 3 de «docentes» · salió en 2 partes"]);
    expect(avisosDelPaquete({ ok: true, file_id: "f", size: 1, n_bases: 2, bases: [] })).toEqual([]);
  });

  it("muestra los avisos como estado legible y no pinta nada sin avisos", () => {
    const html = renderToStaticMarkup(createElement(AvisosPaqueteBases, {
      avisos: ["Lámina 3 de «docentes» · salió en 2 partes", "2 títulos pasan de dos líneas: 4, 9."],
    }));
    expect(html).toContain('role="status"');
    expect(html).toContain("2 avisos del paquete");
    expect(html).toContain("salió en 2 partes");
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(renderToStaticMarkup(createElement(AvisosPaqueteBases, { avisos: [] }))).toBe("");
  });

  it("el resultado del job conserva los avisos hasta la superficie", () => {
    const source = fs.readFileSync(path.join(featureDir, "MultibaseReportMenu.tsx"), "utf8");
    expect(source).toContain("avisos: avisosDelPaquete(result)");
    expect(source).toContain("<AvisosPaqueteBases avisos={allBases.avisos} />");
  });
});
