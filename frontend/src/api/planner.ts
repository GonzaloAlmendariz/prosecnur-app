// planner.ts — el estudio declarado una sola vez (ADR 0122).
//
// `GET /api/planner` es de lectura pura: devuelve lo declarado y, en lo que no
// se declaró, lo que el Planner proyecta desde los lugares viejos. Cada sección
// dice su `origen`. Escribir una sección exige la revisión vigente (409
// `E_PLANNER_DESACTUALIZADO` si cambió).

import { apiFetch, handle, headers } from "./core";

export const PLANNER_TIPOS_PERFIL = ["territorial", "aulas", "telefonico", "acreditacion"] as const;
export type PlannerTipoPerfil = (typeof PLANNER_TIPOS_PERFIL)[number];
export type PlannerSeccion = "estudio" | "perfiles" | "equipo" | "codigos" | "insumos";
export type PlannerDiseno = "calc-muestra" | "hojas-ruta" | "cliente";
export type PlannerSeleccionAulas = "conglomerados" | "marco";
export type PlannerOrigen = "declarado" | "proyectado";

export type PlannerVariable = { clave: string; etiqueta?: string; plural?: string };
export type PlannerRepresentatividad = {
  schema?: string;
  universo?: { nivel?: string; valor?: string | null; etiqueta?: string; poblacion?: number | null };
  variables?: PlannerVariable[];
};

export type PlannerPoblacion = {
  id: string;
  etiqueta: string;
  bases: string[];
  representatividad: PlannerRepresentatividad | null;
};

export type PlannerPerfil = {
  tipo: PlannerTipoPerfil;
  seleccion: PlannerSeleccionAulas | null;
  diseno: PlannerDiseno;
  canales: string[];
  poblaciones: PlannerPoblacion[];
};

export type PlannerPersona = { codigo: string; nombre: string; rol: string; perfiles: string[]; activo: boolean };
export type PlannerEquipo = { code_format: string; personas: PlannerPersona[] };

export type PlannerCodigo = {
  codigo: string;
  rotulo: string;
  grupo: "efectiva" | "no_aplicada" | "manzana" | "otro";
  retirado_en_version: number | null;
  /** Sólo de ida: pide retirarlo; la versión la pone el servidor. */
  retirar?: boolean;
};
export type PlannerCodigos = { version: number; resultado: PlannerCodigo[]; status_barrido: PlannerCodigo[] };

export type PlannerInsumo = { id: string; tipo: string; etiqueta: string; archivo: string; origen: string; registrado_en: string };

export type PlannerAviso = { codigo: string; mensaje: string; fuente?: string | null };

export type PlannerEstado = {
  revision: number;
  planner: {
    estudio: { nombre: string; codigo: string; cliente: string };
    perfiles: PlannerPerfil[];
    equipo: PlannerEquipo;
    codigos: PlannerCodigos;
    insumos: PlannerInsumo[];
  };
  origen: Record<PlannerSeccion, PlannerOrigen>;
  declaradoEn: Partial<Record<PlannerSeccion, string>>;
  escribibles: PlannerSeccion[];
  avisos: PlannerAviso[];
  conflictos: PlannerAviso[];
};

// --- Normalizador defensivo ------------------------------------------------
// R serializa listas de un elemento como escalares y listas vacías como `{}`:
// todo se lee como arreglo o texto, y lo que no tiene forma cae al vacío.

type Crudo = Record<string, unknown>;

const obj = (x: unknown): Crudo => (x && typeof x === "object" && !Array.isArray(x) ? (x as Crudo) : {});
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : x == null || (typeof x === "object" && Object.keys(x as object).length === 0) ? [] : [x]);
const txt = (x: unknown): string => (Array.isArray(x) ? txt(x[0]) : x == null ? "" : String(x));
const num = (x: unknown): number | null => {
  const v = Number(Array.isArray(x) ? x[0] : x);
  return Number.isFinite(v) ? v : null;
};
const textos = (x: unknown): string[] => arr(x).map(txt).filter(Boolean);

function esTipo(x: string): x is PlannerTipoPerfil {
  return (PLANNER_TIPOS_PERFIL as readonly string[]).includes(x);
}

function normalizarRepresentatividad(x: unknown): PlannerRepresentatividad | null {
  const r = obj(x);
  if (!Object.keys(r).length) return null;
  const u = obj(r.universo);
  return {
    schema: txt(r.schema),
    universo: { nivel: txt(u.nivel), valor: txt(u.valor) || null, etiqueta: txt(u.etiqueta), poblacion: num(u.poblacion) },
    variables: arr(r.variables).map((v) => {
      const o = obj(v);
      return { clave: txt(o.clave), etiqueta: txt(o.etiqueta), plural: txt(o.plural) };
    }).filter((v) => v.clave),
  };
}

function normalizarPerfil(x: unknown): PlannerPerfil | null {
  const p = obj(x);
  const tipo = txt(p.tipo);
  if (!esTipo(tipo)) return null;
  const seleccion = txt(p.seleccion);
  const diseno = txt(p.diseno);
  return {
    tipo,
    seleccion: seleccion === "marco" || seleccion === "conglomerados" ? seleccion : null,
    diseno: diseno === "hojas-ruta" || diseno === "cliente" ? diseno : "calc-muestra",
    canales: textos(p.canales),
    poblaciones: arr(p.poblaciones).map((y) => {
      const o = obj(y);
      return { id: txt(o.id), etiqueta: txt(o.etiqueta), bases: textos(o.bases), representatividad: normalizarRepresentatividad(o.representatividad) };
    }).filter((o) => o.id),
  };
}

function normalizarCodigo(x: unknown): PlannerCodigo | null {
  const k = obj(x);
  const codigo = txt(k.codigo);
  if (!codigo) return null;
  const grupo = txt(k.grupo);
  return {
    codigo,
    rotulo: txt(k.rotulo),
    grupo: grupo === "efectiva" || grupo === "no_aplicada" || grupo === "manzana" ? grupo : "otro",
    retirado_en_version: num(k.retirado_en_version),
  };
}

const SECCIONES: PlannerSeccion[] = ["estudio", "perfiles", "equipo", "codigos", "insumos"];

export function normalizarPlannerEstado(raw: unknown): PlannerEstado {
  const r = obj(raw);
  const pl = obj(r.planner);
  const est = obj(pl.estudio);
  const eq = obj(pl.equipo);
  const cod = obj(pl.codigos);
  const origenCrudo = obj(r.origen);
  const declCrudo = obj(r.declarado_en);
  const origen = Object.fromEntries(
    SECCIONES.map((s) => [s, txt(origenCrudo[s]) === "declarado" ? "declarado" : "proyectado"]),
  ) as Record<PlannerSeccion, PlannerOrigen>;
  const declaradoEn: Partial<Record<PlannerSeccion, string>> = {};
  for (const s of SECCIONES) if (txt(declCrudo[s])) declaradoEn[s] = txt(declCrudo[s]);
  const aviso = (x: unknown): PlannerAviso => ({ codigo: txt(obj(x).codigo), mensaje: txt(obj(x).mensaje), fuente: txt(obj(x).fuente) || null });
  return {
    revision: num(r.revision) ?? 0,
    planner: {
      estudio: { nombre: txt(est.nombre), codigo: txt(est.codigo), cliente: txt(est.cliente) },
      perfiles: arr(pl.perfiles).map(normalizarPerfil).filter((p): p is PlannerPerfil => p !== null),
      equipo: {
        code_format: txt(eq.code_format),
        personas: arr(eq.personas).map((x) => {
          const p = obj(x);
          return { codigo: txt(p.codigo), nombre: txt(p.nombre), rol: txt(p.rol), perfiles: textos(p.perfiles), activo: p.activo !== false };
        }),
      },
      codigos: {
        version: num(cod.version) ?? 1,
        resultado: arr(cod.resultado).map(normalizarCodigo).filter((k): k is PlannerCodigo => k !== null),
        status_barrido: arr(cod.status_barrido).map(normalizarCodigo).filter((k): k is PlannerCodigo => k !== null),
      },
      insumos: arr(pl.insumos).map((x) => {
        const k = obj(x);
        return { id: txt(k.id), tipo: txt(k.tipo), etiqueta: txt(k.etiqueta), archivo: txt(k.archivo), origen: txt(k.origen), registrado_en: txt(k.registrado_en) };
      }).filter((k) => k.id),
    },
    origen,
    declaradoEn,
    escribibles: textos(r.escribibles).filter((s): s is PlannerSeccion => (SECCIONES as string[]).includes(s)),
    avisos: arr(r.avisos).map(aviso).filter((a) => a.mensaje),
    conflictos: arr(r.conflictos).map(aviso).filter((a) => a.mensaje),
  };
}

export async function apiPlannerEstado(): Promise<PlannerEstado> {
  return normalizarPlannerEstado(await handle<unknown>(await apiFetch("/api/planner", { headers: headers() })));
}

export async function apiPlannerDeclarar(seccion: PlannerSeccion, valor: unknown, expectedRevision: number): Promise<PlannerEstado> {
  return normalizarPlannerEstado(
    await handle<unknown>(
      await apiFetch(`/api/planner/${seccion}`, {
        method: "PUT",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ valor, expected_revision: expectedRevision }),
      }),
    ),
  );
}
