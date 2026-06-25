import {
  apiHojasRutaBlockMap,
  apiHojasRutaContextMap,
  apiHojasRutaZoneMap,
  type HojasRutaBlockMap,
  type HojasRutaContextMap,
  type HojasRutaStreetMap,
  type HojasRutaZoneMap,
} from "../../../api/client";

type TerritorialRouteCartographyBundle = {
  blockMap: HojasRutaBlockMap | null;
  zoneMap: HojasRutaZoneMap | null;
  streetMap: HojasRutaStreetMap | null;
  contextMap: HojasRutaContextMap | null;
  partial: boolean;
};

const IDB_NAME = "prosecnur-territorial-route-cartography";
const IDB_STORE = "bundles";
const IDB_VERSION = 1;
const CACHE_VERSION = "route-cartography-v3-essential";
const BATCH_SIZE = 2;
const MEMORY_CACHE = new Map<string, TerritorialRouteCartographyBundle>();
const INFLIGHT = new Map<string, Promise<TerritorialRouteCartographyBundle>>();

function normalizeTerritorialBlockCode(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

async function settleCartography<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
  try {
    return { status: "fulfilled", value: await promise };
  } catch (reason) {
    return { status: "rejected", reason };
  }
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function cacheKey(ubigeo: string) {
  return `${CACHE_VERSION}:${normalizeTerritorialBlockCode(ubigeo)}`;
}

async function readCache(ubigeo: string): Promise<TerritorialRouteCartographyBundle | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    const request = store.get(cacheKey(ubigeo));
    request.onsuccess = () => {
      const entry = request.result as { version?: string; bundle?: TerritorialRouteCartographyBundle } | undefined;
      resolve(entry?.version === CACHE_VERSION && entry.bundle ? entry.bundle : null);
    };
    request.onerror = () => resolve(null);
  });
}

async function writeCache(ubigeo: string, bundle: TerritorialRouteCartographyBundle) {
  if (bundle.partial) return;
  if (!bundle.blockMap && !bundle.zoneMap && !bundle.contextMap) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
    tx.objectStore(IDB_STORE).put({
      version: CACHE_VERSION,
      created_at: Date.now(),
      bundle,
    }, cacheKey(ubigeo));
  });
}

function loadCartography(ubigeo: string): Promise<TerritorialRouteCartographyBundle> {
  const normalized = normalizeTerritorialBlockCode(ubigeo);
  if (!normalized) {
    return Promise.resolve({ blockMap: null, zoneMap: null, streetMap: null, contextMap: null, partial: true });
  }
  const cached = MEMORY_CACHE.get(normalized);
  if (cached) return Promise.resolve(cached);
  const inflight = INFLIGHT.get(normalized);
  if (inflight) return inflight;
  const request = (async () => {
    const persisted = await readCache(normalized);
    if (persisted) {
      MEMORY_CACHE.set(normalized, persisted);
      INFLIGHT.delete(normalized);
      return persisted;
    }
    const [blockResult, zoneResult, contextResult] = await Promise.all([
      settleCartography(apiHojasRutaBlockMap(normalized, 0, false)),
      settleCartography(apiHojasRutaZoneMap(normalized)),
      settleCartography(apiHojasRutaContextMap(normalized)),
    ]);
    const bundle: TerritorialRouteCartographyBundle = {
      blockMap: settledValue(blockResult),
      zoneMap: settledValue(zoneResult),
      streetMap: null,
      contextMap: settledValue(contextResult),
      partial: [blockResult, zoneResult, contextResult].some((item) => item.status === "rejected"),
    };
    MEMORY_CACHE.set(normalized, bundle);
    void writeCache(normalized, bundle);
    INFLIGHT.delete(normalized);
    return bundle;
  })().catch((error) => {
    INFLIGHT.delete(normalized);
    throw error;
  });
  INFLIGHT.set(normalized, request);
  return request;
}

export async function warmupTerritorialRouteCartography(ubigeos: string[]) {
  const entries: Array<readonly [string, TerritorialRouteCartographyBundle]> = [];
  let rejected = false;
  const uniqueUbigeos = Array.from(new Set(ubigeos.map(normalizeTerritorialBlockCode).filter(Boolean)));
  for (let index = 0; index < uniqueUbigeos.length; index += BATCH_SIZE) {
    const batch = uniqueUbigeos.slice(index, index + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(async (ubigeo) => (
      [ubigeo, await loadCartography(ubigeo)] as const
    )));
    results.forEach((result) => {
      if (result.status === "fulfilled") entries.push(result.value);
      else rejected = true;
    });
  }
  return { entries, rejected };
}
