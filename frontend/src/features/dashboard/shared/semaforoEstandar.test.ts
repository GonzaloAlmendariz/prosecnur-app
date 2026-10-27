// P10 (Gonzalo, 2026-10-27): «usa el semáforo de Dimensiones como ppt.paletas.semaforo para todo». Los defaults de la
// Analítica y del dashboard son el semáforo del estándar; si el JSON cambia, este test obliga a cambiarlos juntos.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../analitica/store";
import { DEFAULT_DASHBOARD_CONFIG } from "../store";
import { semaforoFromConfig } from "./semaforo";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const sem = JSON.parse(readFileSync(resolve(raiz, "api/inst/estandar/estandar_pulso.json"), "utf8")).ppt.paletas.semaforo;

describe("semáforo del estándar", () => {
  it("Analítica › Dimensiones lo trae por defecto", () => {
    expect(DEFAULT_CONFIG.dimensiones?.semaforo?.colores).toEqual({ rojo: sem.rojo, ambar: sem.ambar, verde: sem.verde });
  });
  it("el dashboard lo trae por defecto y lo usa sin configuración", () => {
    expect([DEFAULT_DASHBOARD_CONFIG.semaforo_red_color, DEFAULT_DASHBOARD_CONFIG.semaforo_amber_color, DEFAULT_DASHBOARD_CONFIG.semaforo_green_color])
      .toEqual([sem.rojo, sem.ambar, sem.verde]);
    const s = semaforoFromConfig({});
    expect([s.red, s.amber, s.green]).toEqual([sem.rojo, sem.ambar, sem.verde]);
  });
});
