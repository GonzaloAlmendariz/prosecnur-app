import { beforeEach, describe, expect, it } from "vitest";
import type { ProjectOverview } from "../../api/client";
import { textoDelCambio } from "./BloqueHoy";
import {
  aperturaAnteriorDeLaSesion,
  aperturaDe,
  claveDelProyecto,
  haceCuanto,
  leerApertura,
  leerHoy,
  olvidarSesionDeAperturas,
} from "./desdeUltimaApertura";

function overview(valid: number, alerts = 0): ProjectOverview {
  return {
    project: { name: "acnur", project_file: "acnur.pulso" },
    metrics: { records_count: 1283 },
    modules: [{ id: "carga", state: "ready" }, { id: "validacion", state: "pending" }],
    facts: {
      bitacora: { entries_count: 2 },
      editor: { questions_count: 66 },
      monitoreo: { valid, alerts, valid_label: "validadas" },
    },
  } as unknown as ProjectOverview;
}

class Memoria {
  datos = new Map<string, string>();
  getItem(k: string) { return this.datos.get(k) ?? null; }
  setItem(k: string, v: string) { this.datos.set(k, v); }
}

const AHORA = new Date("2026-11-01T15:00:00Z");

beforeEach(() => olvidarSesionDeAperturas());

describe("desde tu última apertura (L31)", () => {
  it("la primera apertura en el equipo lo dice y guarda la de ahora", () => {
    const almacen = new Memoria();
    const clave = claveDelProyecto(overview(100))!;
    expect(aperturaAnteriorDeLaSesion(clave, overview(100), almacen, AHORA)).toBeNull();
    expect(leerHoy(null, overview(100))).toEqual({ tipo: "primera" });
    expect(leerApertura(clave, almacen)?.cifras["monitoreo.validas"]).toBe(100);
  });

  it("compara contra la apertura anterior y nombra cada cambio con su módulo", () => {
    const anterior = aperturaDe(overview(100, 5), new Date("2026-10-30T15:00:00Z"));
    const lectura = leerHoy(anterior, overview(345, 2));
    expect(lectura.tipo).toBe("cambios");
    if (lectura.tipo !== "cambios") return;
    expect(lectura.cambios.map(textoDelCambio)).toEqual([
      "+245 validadas en Monitoreo",
      "−3 casos por revisar en Monitoreo",
    ]);
    expect(haceCuanto(lectura.desde, AHORA)).toBe("hace 2 días");
  });

  it("una diferencia de uno se dice en singular", () => {
    const anterior = aperturaDe(overview(99, 1), AHORA);
    const lectura = leerHoy(anterior, overview(100, 0));
    if (lectura.tipo !== "cambios") throw new Error("esperaba cambios");
    expect(lectura.cambios.map(textoDelCambio)).toEqual([
      "+1 validada en Monitoreo",
      "−1 caso por revisar en Monitoreo",
    ]);
  });

  it("sin cambios lo dice, y una cifra que antes no existía no se lee como subida", () => {
    const anterior = aperturaDe(overview(100), AHORA);
    delete anterior.cifras["editor.preguntas"];
    expect(leerHoy(anterior, overview(100))).toEqual({ tipo: "sin-cambios", desde: anterior.en });
  });

  it("dentro de la misma sesión mide siempre contra la misma apertura anterior", () => {
    const almacen = new Memoria();
    const clave = claveDelProyecto(overview(100))!;
    almacen.setItem(clave, JSON.stringify(aperturaDe(overview(50), new Date("2026-10-31T15:00:00Z"))));
    const primera = aperturaAnteriorDeLaSesion(clave, overview(100), almacen, AHORA);
    const segunda = aperturaAnteriorDeLaSesion(clave, overview(120), almacen, AHORA);
    expect(segunda).toBe(primera);
    expect(primera?.cifras["monitoreo.validas"]).toBe(50);
  });

  it("un almacenamiento bloqueado o roto no tumba el Home", () => {
    const bloqueado = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceeded"); },
    };
    expect(aperturaAnteriorDeLaSesion("k", overview(1), bloqueado, AHORA)).toBeNull();
    const roto = new Memoria();
    roto.setItem("k2", "{no es json");
    expect(leerApertura("k2", roto)).toBeNull();
  });
});
