import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_KEY } from "./core";
import { apiRecopiladoresMaterialPruebas } from "./recopiladores";

/**
 * Entrar a Materiales expulsaba del proyecto.
 *
 * `apiRecopiladoresMaterialPruebas()` era la única llamada del cliente de
 * Recopiladores que salía sin `{ headers: headers() }`, así que viajaba sin
 * `X-Pulso-Session`. El backend contesta `E_NO_SESSION` a eso, y `handle()` en
 * `core.ts` trata ese código como "el backend ya no reconoce mi sid": borra el
 * sid de `localStorage` y emite `pulso:session-lost`. La sesión se rehacía en
 * blanco y el proyecto abierto se cerraba.
 *
 * La llamada la dispara el `useEffect` de montaje de MaterialsSection, de modo
 * que el ciclo se repetía en cuanto se volvía a entrar: montar, 404, perder el
 * proyecto, remontar.
 *
 * Por eso la prueba mira la cabecera de la petición y también el efecto
 * colateral: que un `E_NO_SESSION` sí desaloja. Comprobar sólo la cabecera
 * dejaría pasar el día en que otro GET repita el olvido; comprobar sólo el
 * desalojo no explicaría por qué ocurría.
 */

const almacen = new Map<string, string>();

function respuesta(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  almacen.clear();
  almacen.set(SESSION_KEY, "sid-de-la-sesion");
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => { almacen.set(k, v); },
    removeItem: (k: string) => { almacen.delete(k); },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("histórico de fichas de prueba", () => {
  it("manda el sid de la sesión en la petición", async () => {
    const espia = vi.fn(async () => respuesta({ ok: true, pruebas: [], state_revision: 0 }));
    vi.stubGlobal("fetch", espia);

    await apiRecopiladoresMaterialPruebas();

    expect(espia).toHaveBeenCalledTimes(1);
    const [url, init] = espia.mock.calls[0] as unknown as [string, RequestInit | undefined];
    expect(url).toContain("/api/recopiladores/materials/pruebas");
    const enviadas = (init?.headers ?? {}) as Record<string, string>;
    expect(enviadas["X-Pulso-Session"]).toBe("sid-de-la-sesion");
  });

  it("un E_NO_SESSION desaloja la sesión y avisa de la pérdida", async () => {
    // El desalojo vive tras `typeof window !== "undefined"` en `core.ts`; sin
    // esta ventana mínima la rama no corre y la prueba pasaría por el camino
    // equivocado.
    const avisos: string[] = [];
    vi.stubGlobal("window", {
      dispatchEvent: (evento: Event) => { avisos.push(evento.type); return true; },
    });
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(
      { error: { code: "E_NO_SESSION", message: "Missing X-Pulso-Session header." } },
      404,
    )));

    await expect(apiRecopiladoresMaterialPruebas()).rejects.toThrow();
    expect(almacen.get(SESSION_KEY)).toBeUndefined();
    expect(avisos).toContain("pulso:session-lost");
  });
});
