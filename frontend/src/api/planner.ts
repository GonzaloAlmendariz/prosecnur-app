// planner.ts — el estudio declarado una sola vez (ADR 0122).
//
// `GET /api/planner` es de lectura pura: devuelve lo declarado y, en lo que no
// se declaró, lo que el Planner proyecta desde los lugares viejos. Cada sección
// dice su `origen`. Escribir una sección exige la revisión vigente (409
// `E_PLANNER_DESACTUALIZADO` si cambió).

import { apiFetch, handle, headers } from "./core";

export const PLANNER_TIPOS_PERFIL = ["territorial", "aulas", "telefonico", "acreditacion"] as const;
export type PlannerTipoPerfil = (typeof PLANNER_TIPOS_PERFIL)[number];
export type PlannerSeccion = "estudio" | "perfiles" | "equipo" | "codigos" | "insumos" | "etapa" | "ventana";
export type PlannerDiseno = "calc-muestra" | "hojas-ruta" | "cliente" | "cuotas";
export type PlannerSeleccionAulas = "conglomerados" | "marco";
/** Territorial: por UMP aleatoria con hoja de ruta (acogida) o por conveniencia o cuotas (Ser Adolescente). */
export type PlannerSeleccionTerritorial = "ump_aleatoria" | "conveniencia";
/** `vacio`: la sección no se declaró; el Planner no la siembra de otros módulos (ADR 0123 §5). */
export type PlannerOrigen = "declarado" | "vacio";
/** Los modos se deducen de lo que guardan los módulos mientras los perfiles no se declaren. */
export type PlannerOrigenModos = "declarado" | "deducido";

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
  seleccion: PlannerSeleccionAulas | PlannerSeleccionTerritorial | null;
  diseno: PlannerDiseno;
  canales: string[];
  poblaciones: PlannerPoblacion[];
};

export type PlannerPersona = { codigo: string; nombre: string; rol: string; perfiles: string[]; activo: boolean };
export type PlannerEquipo = { code_format: string; personas: PlannerPersona[] };

export type PlannerCodigo = {
  codigo: string;
  rotulo: string;
  /** Resultado de la visita: efectiva · no_aplicada · manzana · otro. Status del barrido: las cinco clases del RMS. */
  grupo: PlannerGrupoCodigo;
  retirado_en_version: number | null;
  /** Sólo de ida: pide retirarlo; la versión la pone el servidor. */
  retirar?: boolean;
};
export const PLANNER_GRUPOS_RESULTADO = ["efectiva", "no_aplicada", "manzana", "otro"] as const;
export const PLANNER_CLASES_BARRIDO = ["efectiva", "pendiente", "no_contacto", "rechazo", "invalido"] as const;
export type PlannerGrupoCodigo = (typeof PLANNER_GRUPOS_RESULTADO)[number] | (typeof PLANNER_CLASES_BARRIDO)[number];

export type PlannerCodigos = { version: number; resultado: PlannerCodigo[]; status_barrido: PlannerCodigo[] };

export type PlannerInsumo = {
  id: string;
  tipo: string;
  etiqueta: string;
  /** `file_id` de un archivo del proyecto, o vacío si el insumo está fuera (Drive, correo). */
  archivo: string;
  origen: string;
  registrado_en: string;
  /** Sólo de lectura: lo resuelve el backend; no se guarda. */
  archivo_nombre?: string;
  archivo_estado?: "en_proyecto" | "externo" | "falta";
};

export type PlannerArchivo = { file_id: string; nombre: string; tipo: string; subido_en: string };

export type PlannerAviso = { codigo: string; mensaje: string; fuente?: string | null };

export type PlannerEstado = {
  revision: number;
  planner: {
    estudio: { nombre: string; codigo: string; cliente: string };
    perfiles: PlannerPerfil[];
    equipo: PlannerEquipo;
    codigos: PlannerCodigos;
    insumos: PlannerInsumo[];
    /** Etapa operativa del estudio; `null` si nadie la declaró. */
    etapa: { valor: "piloto" | "campo" | null };
    /** Ventana de campo que PROPONE el Planner (AAAA-MM-DD; vacío si nadie dice nada). */
    ventana: PlannerVentanaRango;
  };
  origen: Record<PlannerSeccion, PlannerOrigen>;
  declaradoEn: Partial<Record<PlannerSeccion, string>>;
  escribibles: PlannerSeccion[];
  avisos: PlannerAviso[];
  conflictos: PlannerAviso[];
  /** Archivos del proyecto (`files/`) a los que un insumo puede apuntar. */
  archivos: PlannerArchivo[];
};

// --- Normalizador defensivo ------------------------------------------------
// R serializa listas de un elemento como escalares y listas vacías como `{}`:
// todo se lee como arreglo o texto, y lo que no tiene forma cae al vacío.

type Crudo = Record<string, unknown>;

export type PlannerVentanaRango = { inicio: string; fin: string };
const DIA = /^\d{4}-\d{2}-\d{2}$/;
function rango(x: unknown): PlannerVentanaRango {
  const r = obj(x);
  const dia = (v: unknown) => (DIA.test(txt(v).slice(0, 10)) ? txt(v).slice(0, 10) : "");
  return { inicio: dia(r.inicio), fin: dia(r.fin) };
}

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
    seleccion: (["marco", "conglomerados", "ump_aleatoria", "conveniencia"] as const).find((v) => v === seleccion) ?? null,
    diseno: (["hojas-ruta", "cliente", "cuotas"] as const).find((v) => v === diseno) ?? "calc-muestra",
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
    grupo: ([...PLANNER_GRUPOS_RESULTADO, ...PLANNER_CLASES_BARRIDO] as readonly string[]).includes(grupo)
      ? (grupo as PlannerGrupoCodigo)
      : "otro",
    retirado_en_version: num(k.retirado_en_version),
  };
}

const SECCIONES: PlannerSeccion[] = ["estudio", "perfiles", "equipo", "codigos", "insumos", "etapa", "ventana"];

export function normalizarPlannerEstado(raw: unknown): PlannerEstado {
  const r = obj(raw);
  const pl = obj(r.planner);
  const est = obj(pl.estudio);
  const eq = obj(pl.equipo);
  const cod = obj(pl.codigos);
  const origenCrudo = obj(r.origen);
  const declCrudo = obj(r.declarado_en);
  const origen = Object.fromEntries(
    SECCIONES.map((s) => [s, txt(origenCrudo[s]) === "declarado" ? "declarado" : "vacio"]),
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
        const estado = txt(k.archivo_estado);
        return {
          id: txt(k.id), tipo: txt(k.tipo), etiqueta: txt(k.etiqueta), archivo: txt(k.archivo), origen: txt(k.origen), registrado_en: txt(k.registrado_en),
          archivo_nombre: txt(k.archivo_nombre),
          archivo_estado: estado === "en_proyecto" || estado === "falta" ? estado : "externo",
        } satisfies PlannerInsumo;
      }).filter((k) => k.id),
      etapa: { valor: txt(obj(pl.etapa).valor) === "piloto" || txt(obj(pl.etapa).valor) === "campo" ? (txt(obj(pl.etapa).valor) as "piloto" | "campo") : null },
      ventana: rango(pl.ventana),
    },
    origen,
    declaradoEn,
    escribibles: textos(r.escribibles).filter((s): s is PlannerSeccion => (SECCIONES as string[]).includes(s)),
    avisos: arr(r.avisos).map(aviso).filter((a) => a.mensaje),
    conflictos: arr(r.conflictos).map(aviso).filter((a) => a.mensaje),
    archivos: arr(r.archivos).map((x) => {
      const f = obj(x);
      return { file_id: txt(f.file_id), nombre: txt(f.nombre), tipo: txt(f.tipo), subido_en: txt(f.subido_en) };
    }).filter((f) => f.file_id),
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

// --- Modos que los perfiles fijan en cada módulo (ADR 0122 §4, fase P2) -------

export type PlannerModos = {
  perfiles: PlannerTipoPerfil[];
  calc: { modo: string | null; perfil: PlannerTipoPerfil | null; macroFamilia: string | null; delCliente: PlannerTipoPerfil[] };
  monitoreo: { modos: string[]; familias: string[]; modo: string | null; familia: string | null };
  material: { campanas: string[] };
  hojasRuta: { aplica: boolean };
  /** Variante del perfil territorial, si hay uno. */
  territorial: { seleccion: PlannerSeleccionTerritorial | null };
  origen: PlannerOrigenModos;
  revision: number;
};

export function normalizarPlannerModos(raw: unknown): PlannerModos {
  const r = obj(raw);
  const calc = obj(r.calc);
  const mon = obj(r.monitoreo);
  const tiposDe = (x: unknown) => textos(x).filter(esTipo);
  return {
    perfiles: tiposDe(r.perfiles),
    calc: {
      modo: txt(calc.modo) || null,
      perfil: esTipo(txt(calc.perfil)) ? (txt(calc.perfil) as PlannerTipoPerfil) : null,
      macroFamilia: txt(calc.macro_familia) || null,
      delCliente: tiposDe(calc.del_cliente),
    },
    monitoreo: { modos: textos(mon.modos), familias: textos(mon.familias), modo: txt(mon.modo) || null, familia: txt(mon.familia) || null },
    material: { campanas: textos(obj(r.material).campanas) },
    hojasRuta: { aplica: obj(r.hojas_ruta).aplica === true || txt(obj(r.hojas_ruta).aplica) === "true" },
    territorial: { seleccion: (["ump_aleatoria", "conveniencia"] as const).find((v) => v === txt(obj(r.territorial).seleccion)) ?? null },
    origen: txt(r.origen) === "declarado" ? "declarado" : "deducido",
    revision: num(r.revision) ?? 0,
  };
}

export async function apiPlannerModos(): Promise<PlannerModos> {
  return normalizarPlannerModos(await handle<unknown>(await apiFetch("/api/planner/modos", { headers: headers() })));
}

// --- Cronograma y etapa operativa (ADR 0122 §2, 0123 §6) -------------------------

export type PlannerEtapa = "piloto" | "campo";
/** La ventana de campo: la PROPUESTA del Planner. Sin declarar, la fase Campo del cronograma (ADR 0123 §6). */
export type PlannerVentana = PlannerVentanaRango & {
  /** De dónde sale: `planner` si se declaró; `cronograma` si sale de su fase Campo; vacío si de ninguno. */
  fuente: "planner" | "cronograma" | "";
  origen: PlannerOrigen;
};
export type PlannerCalendario = {
  hoy: string;
  campo: { inicio: string; fin: string };
  ventana: PlannerVentana;
  etapa: { valor: PlannerEtapa | null; origen: PlannerOrigen };
  avisos: PlannerAviso[];
};

const etapaDe = (x: unknown): PlannerEtapa | null => (txt(x) === "piloto" || txt(x) === "campo" ? (txt(x) as PlannerEtapa) : null);

export function normalizarPlannerCalendario(raw: unknown): PlannerCalendario {
  const r = obj(raw);
  const v = obj(r.ventana);
  const fuenteVentana = txt(v.fuente);
  const campo = obj(r.campo);
  const etapa = obj(r.etapa);
  return {
    hoy: txt(r.hoy),
    campo: { inicio: txt(campo.inicio), fin: txt(campo.fin) },
    ventana: {
      ...rango(v),
      fuente: fuenteVentana === "cronograma" || fuenteVentana === "planner" ? fuenteVentana : "",
      origen: txt(v.origen) === "declarado" ? "declarado" : "vacio",
    },
    etapa: { valor: etapaDe(etapa.valor), origen: txt(etapa.origen) === "declarado" ? "declarado" : "vacio" },
    avisos: arr(r.avisos).map((x) => ({ codigo: txt(obj(x).codigo), mensaje: txt(obj(x).mensaje) })).filter((a) => a.mensaje),
  };
}

export async function apiPlannerCalendario(): Promise<PlannerCalendario> {
  return normalizarPlannerCalendario(await handle<unknown>(await apiFetch("/api/planner/calendario", { headers: headers() })));
}

// --- Equipo de un perfil, para Material y Monitoreo (ADR 0122 §10) ------------

export type PlannerEquipoDePerfil = {
  perfil: PlannerTipoPerfil;
  origen: PlannerOrigen;
  /** Con códigos que son DNI no se entrega a nadie (misma regla que Material). */
  bloqueado: boolean;
  motivo: string;
  personas: { codigo: string; nombre: string; rol: string; activo: boolean }[];
};

export function normalizarPlannerEquipoDe(raw: unknown, perfil: PlannerTipoPerfil): PlannerEquipoDePerfil {
  const r = obj(raw);
  return {
    perfil,
    origen: txt(r.origen) === "declarado" ? "declarado" : "vacio",
    bloqueado: r.bloqueado === true,
    motivo: txt(r.motivo),
    personas: arr(r.personas).map((x) => {
      const p = obj(x);
      return { codigo: txt(p.codigo), nombre: txt(p.nombre), rol: txt(p.rol), activo: p.activo !== false };
    }).filter((p) => p.codigo || p.nombre),
  };
}

export async function apiPlannerEquipoDe(perfil: PlannerTipoPerfil): Promise<PlannerEquipoDePerfil> {
  return normalizarPlannerEquipoDe(
    await handle<unknown>(await apiFetch(`/api/planner/equipo/${perfil}`, { headers: headers() })),
    perfil,
  );
}
