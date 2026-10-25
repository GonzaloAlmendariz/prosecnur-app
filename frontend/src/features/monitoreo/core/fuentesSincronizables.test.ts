import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { fuentesSincronizables, motivoSinFuentes } from "./fuentesSincronizables";
import type { MonitoreoSource } from "../../../api/monitoreo";

function fuente(parcial: Partial<MonitoreoSource> & Pick<MonitoreoSource, "id" | "kind">): MonitoreoSource {
  return { label: parcial.id, enabled: true, ...parcial } as MonitoreoSource;
}

const UNIVERSO = fuente({ id: "universo", kind: "google_sheets", role: "universo" });
const BARRIDO = fuente({ id: "barrido", kind: "google_sheets", role: "barrido" });
const KOBO = fuente({ id: "kobo", kind: "kobo", role: "respuestas" });
const APAGADA = fuente({ id: "apagada", kind: "kobo", role: "respuestas", enabled: false });

const ids = (sources: MonitoreoSource[]) => sources.map((source) => source.id);

describe("fuentesSincronizables", () => {
  it("«todo» toma lo activo y sólo lo activo", () => {
    expect(ids(fuentesSincronizables([UNIVERSO, BARRIDO, KOBO, APAGADA], "full", "telefonico")))
      .toEqual(["universo", "barrido", "kobo"]);
  });

  it("el avance telefónico lee las hojas del modelo y la encuesta", () => {
    expect(ids(fuentesSincronizables([UNIVERSO, BARRIDO, KOBO], "advance", "telefonico")))
      .toEqual(["universo", "barrido", "kobo"]);
  });

  it("el avance de acreditación sólo lee respuestas de plataforma", () => {
    const sheets = fuente({ id: "sheets", kind: "google_sheets", role: "universo" });
    const sm = fuente({ id: "sm", kind: "surveymonkey", role: "respuestas" });
    expect(ids(fuentesSincronizables([sheets, sm, KOBO], "advance", "acreditacion")))
      .toEqual(["sm", "kobo"]);
  });

  // Una fuente conectada antes de que el papel existiera no tiene rol guardado.
  // Dejarla fuera del avance sería perder datos por una migración.
  it("una fuente sin rol declarado no queda fuera del avance", () => {
    const sinRol = fuente({ id: "vieja", kind: "kobo" });
    expect(ids(fuentesSincronizables([sinRol], "advance", "telefonico"))).toEqual(["vieja"]);
    expect(ids(fuentesSincronizables([sinRol], "advance", "acreditacion"))).toEqual(["vieja"]);
  });

  it("sin nada conectado no hay nada que sincronizar, en los dos modos", () => {
    expect(fuentesSincronizables([], "full", "telefonico")).toEqual([]);
    expect(fuentesSincronizables([APAGADA], "advance", "telefonico")).toEqual([]);
  });

  it("el motivo distingue los dos botones", () => {
    expect(motivoSinFuentes("full")).not.toBe(motivoSinFuentes("advance"));
    expect(motivoSinFuentes("advance")).toContain("avance");
  });
});

// El defecto no era el filtro sino que el botón no lo conocía: se ofrecía con
// cero fuentes y, al pulsarlo, escribía en `setError` —el casillero de «la vista
// falló»—, con lo que el banner rojo aparecía por una acción que sólo no
// aplicaba y la readiness se caía (`auditReady` exige `!error`). Lo que hay que
// sostener es que la afordancia y la acción lean la misma cuenta.
describe("la afordancia de sincronizar no puede discrepar de la acción", () => {
  const PERFILES = [
    ["telefonico", resolve(__dirname, "..", "profiles", "telefonico", "TelefonicoMonitoreoPage.tsx")],
    ["acreditacion", resolve(__dirname, "..", "profiles", "acreditacion", "AcreditacionMonitoreoPage.tsx")],
  ] as const;

  // Desde el control único «Actualizar ▾» (L38), la afordancia y la acción
  // salen de la MISMA entrada de `sync/menuDeActualizar.ts`: `disabled` y
  // `peticion` se calculan juntos con `fuentesSincronizables`, y la página ya
  // no arma su propia lista de ids (ver `sync/menuDeActualizar.test.ts`).
  it.each(PERFILES)("%s lanza los syncs sólo por el control común", (label, ruta) => {
    const fuenteTsx = readFileSync(ruta, "utf8");

    expect(fuenteTsx, `${label}: el control sale del hook compartido`)
      .toContain("useActualizarDelModo({");
    expect(fuenteTsx, `${label}: la barra usa sus acciones`)
      .toContain("actualizar: actualizarDelModo.actualizar,");
    expect(fuenteTsx, `${label}: la página no lanza un sync por su cuenta`)
      .not.toMatch(/apiMonitoreoSync\(|apiMonitoreoSheetsSyncAsync\(/);
  });
});
