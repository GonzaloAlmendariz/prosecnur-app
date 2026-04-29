// Bridge entre el frontend del Dashboard y un runtime R en el browser
// (WebR + WebAssembly), para servir el dashboard como HTML autosuficiente
// SIN backend Plumber.
//
// Se activa cuando `window.PULSO_STANDALONE_PAYLOAD` está presente al
// cargar la página (lo inyecta el HTML exportado). El payload trae
// `rp_data`, `rp_inst` y `dashboard_config` ya serializados.
//
// Flujo:
//   1. `initWebR(payload)` — singleton: arranca WebR, instala paquetes,
//      inyecta el payload en globalEnv R y evalúa `webrRuntime.r` que
//      define la función dispatcher `pulso_handle(endpoint, body_json)`.
//   2. `callR(endpoint, body)` — llama al dispatcher con el body
//      serializado y devuelve el JSON parseado.
//
// El cliente HTTP (`api/client.ts`) detecta el modo standalone y rutea
// los `apiX` que aplican al bridge en vez de a la red.

import type { WebR as WebRClass } from "@r-wasm/webr";
import { PULSO_R_RUNTIME } from "./webrRuntime";

export type StandalonePayload = {
  // El XLSForm parseado (objeto retornado por `reporte_instrumento()` en R).
  rp_inst: unknown;
  // El dataframe de respuestas, serializado como `Record<colName, valor[]>`.
  rp_data: Record<string, unknown[]>;
  // El config del dashboard tal como vive en el .pulso.
  dashboard_config: Record<string, unknown>;
  // Opcional: state de codificación serializado (grupos_recod por base).
  codif_por_base?: Record<string, unknown>;
};

declare global {
  interface Window {
    PULSO_STANDALONE_PAYLOAD?: StandalonePayload;
  }
}

export function isStandaloneMode(): boolean {
  return typeof window !== "undefined" && !!window.PULSO_STANDALONE_PAYLOAD;
}

export function getStandalonePayload(): StandalonePayload | null {
  if (typeof window === "undefined") return null;
  return window.PULSO_STANDALONE_PAYLOAD ?? null;
}

// Singleton: WebR pesa ~25MB de descarga inicial; iniciarlo una sola vez
// por página. La promesa se resuelve cuando el runtime está listo para
// recibir llamadas a `callR()`.
let webRInstance: WebRClass | null = null;
let initPromise: Promise<WebRClass> | null = null;

export function initWebR(payload: StandalonePayload): Promise<WebRClass> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // Lazy import — solo cargamos WebR si realmente estamos en standalone.
    const { WebR } = await import("@r-wasm/webr");
    const webR = new WebR();
    await webR.init();

    // Drena la consola de R en background para que stderr/stdout no se
    // acumulen en el buffer interno (puede bloquear evaluaciones).
    void (async () => {
      for (;;) {
        try {
          const out = await webR.read();
          if (out.type === "stderr" && typeof out.data === "string") {
            // eslint-disable-next-line no-console
            console.warn("[R]", out.data);
          }
        } catch {
          return;
        }
      }
    })();

    // Paquetes mínimos para el runtime.
    await webR.installPackages(["jsonlite", "dplyr"]);

    // Inyectar payload como variables globales en R.
    await webR.objs.globalEnv.bind("rp_inst_raw", payload.rp_inst as never);
    await webR.objs.globalEnv.bind("rp_data_raw", payload.rp_data as never);
    await webR.objs.globalEnv.bind("dashboard_config_raw", payload.dashboard_config as never);

    // Convertir a tipos R utilizables (data.frame para rp_data, list para
    // rp_inst). Hacemos esto en R, no en JS, para evitar pasar metadata.
    await webR.evalRVoid(`
      suppressMessages({ library(jsonlite); library(dplyr) })
      rp_data <- as.data.frame(rp_data_raw, stringsAsFactors = FALSE)
      rp_inst <- rp_inst_raw
      # En R, los data.frames del XLSForm vienen serializados como listas
      # de columnas — convertirlos si hace falta.
      if (is.list(rp_inst$survey) && !is.data.frame(rp_inst$survey)) {
        rp_inst$survey <- as.data.frame(rp_inst$survey, stringsAsFactors = FALSE)
      }
      if (is.list(rp_inst$choices) && !is.data.frame(rp_inst$choices)) {
        rp_inst$choices <- as.data.frame(rp_inst$choices, stringsAsFactors = FALSE)
      }
      dashboard_config <- dashboard_config_raw
      # Liberar las copias raw para no duplicar memoria.
      rm(rp_inst_raw, rp_data_raw, dashboard_config_raw)
    `);

    // Cargar el runtime de funciones del dashboard.
    await webR.evalRVoid(PULSO_R_RUNTIME);

    webRInstance = webR;
    return webR;
  })();
  return initPromise;
}

// Llama al dispatcher R `pulso_handle(endpoint, body_json)` y parsea
// el JSON resultante. `endpoint` es uno de los slugs definidos en
// `webrRuntime.ts` (manifest, secciones, resumen_seccion, etc.) — NO
// es una URL HTTP. El cliente HTTP traduce sus rutas a slugs.
export async function callR<T = unknown>(
  endpoint: string,
  body: unknown = {},
): Promise<T> {
  const webR = await (webRInstance ? Promise.resolve(webRInstance) : initPromise);
  if (!webR) throw new Error("WebR no está inicializado");
  const bodyJson = JSON.stringify(body ?? {}).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const code = `pulso_handle("${endpoint}", "${bodyJson}")`;
  const result = await webR.evalRString(code);
  return JSON.parse(result) as T;
}

// Mapeo de path HTTP → slug del dispatcher R. El cliente HTTP consulta
// esto: si la ruta está, ejecuta vía bridge; si no, la deja pasar (o
// devuelve un error "no soportado offline").
const ROUTE_MAP: Record<string, string> = {
  "GET /api/dashboard/manifest": "manifest",
  "GET /api/dashboard/config": "config",
  "GET /api/dashboard/secciones": "secciones",
  "POST /api/dashboard/resumen/seccion": "resumen_seccion",
  "POST /api/dashboard/resumen/kpis": "resumen_kpis",
};

export function lookupOfflineRoute(method: string, url: string): string | null {
  // Normalizar la URL: quitar query string y prefijo de origin.
  const path = url.replace(/^(?:https?:\/\/[^/]+)?/, "").split("?")[0];
  return ROUTE_MAP[`${method.toUpperCase()} ${path}`] ?? null;
}
