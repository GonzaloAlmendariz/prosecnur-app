import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bootApiSystemBootstrap } from "./bootClient";

/**
 * El `.pulso` precargado por el launcher tiene que llegar a la pantalla.
 *
 * `PULSO_BOOTSTRAP_PROJECT` carga el proyecto en el backend y `/api/system/bootstrap`
 * entrega el `sid` de esa sesión **en el cuerpo** — no en la cabecera
 * `X-Pulso-Session`, que es de donde `handle()` adopta sesión. Nadie guardaba ese
 * `sid`: la llamada siguiente salía sin sesión, `project/status` contestaba
 * `has_project: false` y el arranque terminaba en el selector de proyecto con el
 * estudio ya cargado del otro lado.
 *
 * No se veía en Electron porque ahí el proyecto entra por `getLaunchProject()`,
 * que abre por ruta; se veía al mirar la app en un navegador contra el 8787.
 *
 * Y el backend **consume** el bootstrap al entregarlo (a propósito: una recarga
 * posterior no debe reimponer el mismo proyecto), así que el `sid` descartado no
 * se podía volver a pedir. Por eso la adopción se prueba, y no sólo la llamada.
 */

const almacen = new Map<string, string>();

function respuesta(body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

beforeEach(() => {
  almacen.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => { almacen.set(k, v); },
    removeItem: (k: string) => { almacen.delete(k); },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("arranque con proyecto precargado", () => {
  it("guarda el sid que el bootstrap manda en el cuerpo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ sid: "sid-bootstrap" })));

    const body = await bootApiSystemBootstrap();

    expect(body.sid).toBe("sid-bootstrap");
    expect(almacen.get("pulso.sessionId")).toBe("sid-bootstrap");
  });

  it("no inventa sesión cuando no hay proyecto precargado", async () => {
    // Sin bootstrap pendiente la ruta contesta `{sid: null}`, y jsonlite puede
    // serializar ese NULL como `{}`: ninguno de los dos es una sesión.
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ sid: null })));
    await bootApiSystemBootstrap();
    expect(almacen.has("pulso.sessionId")).toBe(false);

    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ sid: {} })));
    await bootApiSystemBootstrap();
    expect(almacen.has("pulso.sessionId")).toBe(false);
  });
});
