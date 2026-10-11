// Estilo del cliente de Procesamiento › Gráficos (A6 R3; ADR 0094; contrato docs/qa/contrato-word-estilo-f6-2026-10-11.md
// §1 y §7). Espejo defensivo de `api/R/graficos_estilo_cliente.R`:
//
//   { version: 1, ambito: "proyecto" | "base",
//     logos: { portada_izquierda | portada_derecha | contraportada: { file_id, nombre } },
//     letra: { paso: "estandar" | "grande" | "muy_grande", roles: { titulos | preguntas | cifras | rotulos | base: paso } } }
//
// El backend guarda sólo las decisiones (diff contra recetario + perfil del catálogo) y el GET la devuelve completa, con
// el `ambito` siempre presente. Procedencia derivada (ADR 0094 §4): lo que no difiere del default es «Del recetario»;
// «Volver al recetario» borra la clave. Lo inválido se descarta aquí para no provocar el 400 E_BAD_ESTILO_CLIENTE; lo
// desconocido se conserva sin interpretar (el backend también lo conserva).

import { apiFetch, handle, headers } from "./core";

export const ESTILO_CLIENTE_VERSION = 1 as const;
export const ESTILO_AMBITOS = ["proyecto", "base"] as const;
export const ESTILO_PASOS = ["estandar", "grande", "muy_grande"] as const;
export const ESTILO_ROLES = ["titulos", "preguntas", "cifras", "rotulos", "base"] as const;
export const ESTILO_LUGARES_LOGO = ["portada_izquierda", "portada_derecha", "contraportada"] as const;

export type EstiloAmbito = (typeof ESTILO_AMBITOS)[number];
export type EstiloPaso = (typeof ESTILO_PASOS)[number];
export type EstiloRol = (typeof ESTILO_ROLES)[number];
export type EstiloLugarLogo = (typeof ESTILO_LUGARES_LOGO)[number];

export type EstiloLogoRef = { file_id: string; nombre?: string };

export type EstiloLetra = {
  paso?: EstiloPaso;
  roles?: Partial<Record<EstiloRol, EstiloPaso>>;
  /** Claves que este cliente no conoce: viajan tal cual. */
  [otra: string]: unknown;
};

export type EstiloCliente = {
  version?: typeof ESTILO_CLIENTE_VERSION;
  ambito?: EstiloAmbito;
  logos?: Partial<Record<EstiloLugarLogo, EstiloLogoRef>>;
  letra?: EstiloLetra;
  [otra: string]: unknown;
};

type Dict = Record<string, unknown>;

function isObj(x: unknown): x is Dict {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

// jsonlite serializa una lista R vacía con nombres como `[]`: en un bloque que es objeto significa «vacío».
function comoObjeto(x: unknown): Dict | null {
  if (isObj(x)) return x;
  if (Array.isArray(x) && x.length === 0) return {};
  return null;
}

// Un escalar puede llegar como vector de largo 1.
function escalar(x: unknown): unknown {
  return Array.isArray(x) && x.length === 1 ? x[0] : x;
}

function texto(x: unknown): string {
  const v = escalar(x);
  return typeof v === "string" ? v.trim() : "";
}

function enumDe<T extends string>(x: unknown, admitidos: readonly T[]): T | undefined {
  const v = texto(x);
  return (admitidos as readonly string[]).includes(v) ? v as T : undefined;
}

const CLAVES_CONOCIDAS = new Set(["version", "ambito", "logos", "letra"]);

function normalizeLogos(x: unknown): Partial<Record<EstiloLugarLogo, EstiloLogoRef>> | undefined {
  const obj = comoObjeto(x);
  if (!obj) return undefined;
  const out: Partial<Record<EstiloLugarLogo, EstiloLogoRef>> = {};
  for (const lugar of ESTILO_LUGARES_LOGO) {
    const e = obj[lugar];
    if (!isObj(e)) continue;
    const fileId = texto(e.file_id);
    if (!fileId) continue;
    // Nunca rutas: sólo `file_id` y el nombre que ve el usuario.
    const nombre = texto(e.nombre);
    out[lugar] = nombre ? { file_id: fileId, nombre } : { file_id: fileId };
  }
  return out;
}

function normalizeLetra(x: unknown): EstiloLetra | undefined {
  const obj = comoObjeto(x);
  if (!obj) return undefined;
  const out: EstiloLetra = {};
  for (const [k, v] of Object.entries(obj)) if (k !== "paso" && k !== "roles") out[k] = v;
  const paso = enumDe(obj.paso, ESTILO_PASOS);
  if (paso) out.paso = paso;
  const roles = comoObjeto(obj.roles);
  if (roles) {
    const r: Partial<Record<EstiloRol, EstiloPaso>> = {};
    for (const rol of ESTILO_ROLES) {
      const p = enumDe(roles[rol], ESTILO_PASOS);
      if (p) r[rol] = p;
    }
    out.roles = r;
  }
  return out;
}

/**
 * Lee un `estilo_cliente` (del GET, de un import o del propio store). Ausente o malformado → `{}`. Idempotente: pasar su
 * salida otra vez devuelve lo mismo.
 */
export function normalizeEstiloCliente(input: unknown): EstiloCliente {
  const obj = comoObjeto(input);
  if (!obj) return {};
  const out: EstiloCliente = {};
  for (const [k, v] of Object.entries(obj)) if (!CLAVES_CONOCIDAS.has(k)) out[k] = v;
  if (Number(escalar(obj.version)) === ESTILO_CLIENTE_VERSION) out.version = ESTILO_CLIENTE_VERSION;
  const ambito = enumDe(obj.ambito, ESTILO_AMBITOS);
  if (ambito) out.ambito = ambito;
  const logos = normalizeLogos(obj.logos);
  if (logos) out.logos = logos;
  const letra = normalizeLetra(obj.letra);
  if (letra) out.letra = letra;
  return out;
}

/** Espejo de `.graficos_estilo_cliente_default()` sin perfil: lo que manda el recetario cuando el GET no trae defaults. */
export function estiloClienteRecetario(): EstiloCliente {
  return { version: ESTILO_CLIENTE_VERSION, logos: {}, letra: { paso: "estandar", roles: {} } };
}

/** `defaults.estilo_cliente` de la respuesta de `GET /api/graficos/config`; `null` si no viene o no es objeto. */
export function normalizeEstiloClienteDefaults(response: unknown): EstiloCliente | null {
  if (!isObj(response) || !isObj(response.defaults)) return null;
  const raw = response.defaults.estilo_cliente;
  return isObj(raw) ? normalizeEstiloCliente(raw) : null;
}

/**
 * Pide los defaults del estilo (recetario + perfil del catálogo + ámbito por defecto) que declara el GET de la config.
 * Lo usa la pestaña Estilo del cliente cuando el store todavía no los tiene: el embudo de hidratación sólo guarda los del
 * Word (`graficosConfigDefaults.ts`).
 */
export async function apiGraficosEstiloDefaults(): Promise<EstiloCliente | null> {
  const r = await handle<unknown>(await apiFetch("/api/graficos/config", { headers: headers() }));
  return normalizeEstiloClienteDefaults(r);
}

// --- Opciones (`GET /api/graficos/estilo/opciones`) ----------------------------------------------------------------------

export type EstiloOpcionPaso = { id: EstiloPaso; desplazamientoPt: number };
/** Tamaño del recetario por token del estándar (`titulo_1: 18`, …). */
export type EstiloTamanos = Record<string, number>;
export type EstiloOpcionRol = { id: EstiloRol; ppt: EstiloTamanos; word: EstiloTamanos };
export type EstiloOpcionLogo = { lugar: EstiloLugarLogo; logo: string; nombre: string };
export type EstiloOpciones = {
  ambitos: EstiloAmbito[];
  pasos: EstiloOpcionPaso[];
  roles: EstiloOpcionRol[];
  logos: EstiloOpcionLogo[];
};

const DESPLAZAMIENTO_RECETARIO: Record<EstiloPaso, number> = { estandar: 0, grande: 2, muy_grande: 4 };

function listaDe(x: unknown): Dict[] {
  return (Array.isArray(x) ? x : isObj(x) ? [x] : []).filter(isObj);
}

function tamanos(x: unknown): EstiloTamanos {
  const obj = comoObjeto(x) ?? {};
  const out: EstiloTamanos = {};
  for (const [k, v] of Object.entries(obj)) {
    const n = Number(escalar(v));
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

/** Normalizador defensivo de las opciones: lo que falte cae al catálogo conocido (pasos con su desplazamiento). */
export function normalizeEstiloOpciones(raw: unknown): EstiloOpciones {
  const r = isObj(raw) ? raw : {};
  const ambitosLeidos = (Array.isArray(r.ambitos) ? r.ambitos : [])
    .map((a) => enumDe(a, ESTILO_AMBITOS))
    .filter((a): a is EstiloAmbito => !!a);
  const pasosLeidos = new Map<EstiloPaso, number>();
  for (const p of listaDe(r.pasos)) {
    const id = enumDe(p.id, ESTILO_PASOS);
    const d = Number(escalar(p.desplazamiento_pt));
    if (id && Number.isFinite(d)) pasosLeidos.set(id, d);
  }
  const rolesLeidos = new Map<EstiloRol, EstiloOpcionRol>();
  for (const x of listaDe(r.roles)) {
    const id = enumDe(x.id, ESTILO_ROLES);
    if (id) rolesLeidos.set(id, { id, ppt: tamanos(x.ppt), word: tamanos(x.word) });
  }
  const logos: EstiloOpcionLogo[] = [];
  for (const x of listaDe(r.logos)) {
    const lugar = enumDe(x.lugar, ESTILO_LUGARES_LOGO);
    if (lugar) logos.push({ lugar, logo: texto(x.logo), nombre: texto(x.nombre) });
  }
  return {
    ambitos: ambitosLeidos.length > 0 ? ambitosLeidos : [...ESTILO_AMBITOS],
    pasos: ESTILO_PASOS.map((id) => ({ id, desplazamientoPt: pasosLeidos.get(id) ?? DESPLAZAMIENTO_RECETARIO[id] })),
    roles: ESTILO_ROLES.map((id) => rolesLeidos.get(id) ?? { id, ppt: {}, word: {} }),
    logos,
  };
}

export async function apiGraficosEstiloOpciones(): Promise<EstiloOpciones> {
  return normalizeEstiloOpciones(
    await handle<unknown>(await apiFetch("/api/graficos/estilo/opciones", { headers: headers() })),
  );
}

// --- Subida de logos (`POST /api/graficos/estilo/logos`) -----------------------------------------------------------------

/** Tope del backend (`.ESTILO_CLIENTE_LOGO_MAX_BYTES`). */
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

export type LogoSubido = {
  fileId: string;
  nombre: string;
  lugar: EstiloLugarLogo | null;
  sha256: string;
  anchoPx: number;
  altoPx: number;
  aspecto: number;
  uploadedAt: string;
};

export function normalizeLogoSubido(raw: unknown): LogoSubido {
  const r = isObj(raw) ? raw : {};
  const num = (v: unknown) => {
    const n = Number(escalar(v));
    return Number.isFinite(n) ? n : 0;
  };
  const fileId = texto(r.file_id);
  if (!fileId) throw new Error("El backend no devolvió el identificador del logo.");
  return {
    fileId,
    nombre: texto(r.nombre),
    lugar: enumDe(r.lugar, ESTILO_LUGARES_LOGO) ?? null,
    sha256: texto(r.sha256),
    anchoPx: num(r.ancho_px),
    altoPx: num(r.alto_px),
    aspecto: num(r.aspecto),
    uploadedAt: texto(r.uploaded_at),
  };
}

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** ¿Los primeros bytes son la firma PNG? Misma comprobación que hace el backend (`.ec_png_firma`). */
export function esFirmaPng(bytes: Uint8Array): boolean {
  return bytes.length >= FIRMA_PNG.length && FIRMA_PNG.every((b, i) => bytes[i] === b);
}

/**
 * Motivo por el que un archivo no se puede subir como logo, o `null` si pasa el filtro del cliente. Sólo PNG (por tipo,
 * extensión y firma) y hasta 5 MB: así el usuario se entera antes de esperar el 400 `E_BAD_LOGO`.
 */
export function motivoLogoInvalido(archivo: { name: string; type: string; size: number }, cabecera?: Uint8Array): string | null {
  // El tipo declarado manda; sin tipo (algunos sistemas no lo informan) decide la extensión.
  const esPngDeclarado = archivo.type ? archivo.type === "image/png" : /\.png$/i.test(archivo.name);
  if (!esPngDeclarado) return "El logo debe ser un PNG.";
  if (archivo.size <= 0) return "El archivo está vacío.";
  if (archivo.size > LOGO_MAX_BYTES) return "El logo supera los 5 MB.";
  if (cabecera && !esFirmaPng(cabecera)) return "El archivo no es un PNG válido.";
  return null;
}

function aBase64(bytes: Uint8Array): string {
  let binario = "";
  const bloque = 0x8000;
  for (let i = 0; i < bytes.length; i += bloque) {
    binario += String.fromCharCode(...bytes.subarray(i, i + bloque));
  }
  return btoa(binario);
}

/**
 * Sube un PNG como logo del cliente. No toca la config: quien llama pone el `file_id` en `estilo_cliente.logos.<lugar>`
 * y el autosave lo guarda. Rechaza en el cliente lo que no es PNG (lanza con el motivo, sin llamar al backend).
 */
export async function apiGraficosSubirLogo(archivo: File, lugar: EstiloLugarLogo, nombre?: string): Promise<LogoSubido> {
  const previo = motivoLogoInvalido(archivo);
  if (previo) throw new Error(previo);
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const motivo = motivoLogoInvalido(archivo, bytes.subarray(0, 8));
  if (motivo) throw new Error(motivo);
  const etiqueta = (nombre ?? "").trim() || archivo.name.replace(/\.png$/i, "").trim() || "Logo del cliente";
  return normalizeLogoSubido(await handle<unknown>(await apiFetch("/api/graficos/estilo/logos", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ nombre: etiqueta, data_base64: aBase64(bytes), lugar }),
  })));
}
