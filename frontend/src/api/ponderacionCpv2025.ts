// ponderacionCpv2025.ts — metas de calibración desde el CPV 2025 (ADR 0131 paso 5).
//
// `GET  /api/analitica/ponderacion/cpv2025/distritos`: ámbitos que cubre el archivo.
// `POST /api/analitica/ponderacion/cpv2025/metas`: márgenes del ámbito pedido.
// Universo: población censada, sin la omisión censal estimada. El mapeo de las
// categorías de la base a las del censo vive en la UI (metasCpvModel.ts).
//
// No se reexporta desde el barrel `client.ts`.

import { apiFetch, handle, headers } from "./core";
import { lista, numeroONulo, registro, texto } from "./normalizarR";

export type CpvDistrito = {
  ubigeo: string;
  provinciaCodigo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  poblacion18: number;
};
export type CpvProvincia = { codigo: string; departamento: string; provincia: string; nDistritos: number };
export type CpvGrupoEdad = { etiqueta: string; min: number; max: number | null };
export type CpvCatalogo = {
  fuente: string;
  universo: string;
  consultado: string;
  distritos: CpvDistrito[];
  provincias: CpvProvincia[];
  agrupacionesEducacion: { codigo: string; etiqueta: string }[];
  gruposEdadDefault: CpvGrupoEdad[];
};
export type CpvCategoria = { codigo: string; etiqueta: string; poblacion: number };
export type CpvMargen = { variable: string; etiqueta: string; total: number; categorias: CpvCategoria[] };
export type CpvAviso = { level: "info" | "warn"; code: string; message: string };
export type CpvMetas = {
  fuente: string;
  universo: string;
  consultado: string;
  ambito: { nivel: string; nDistritos: number; ubigeos: string[]; provincias: string[] };
  total: number;
  margenes: CpvMargen[];
  avisos: CpvAviso[];
};
export type CpvMetasPedido = {
  distritos?: string[];
  provincias?: string[];
  grupos_edad?: CpvGrupoEdad[];
  agrupacion_educacion?: string;
  desagregacion?: "ninguna" | "distrito" | "provincia";
};

const num = (v: unknown) => numeroONulo(v) ?? 0;
const textos = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v == null ? [] : [v]).map(texto).filter((x) => x && x !== "NA");

function grupoEdad(x: unknown): CpvGrupoEdad {
  const r = registro(x);
  return { etiqueta: texto(r.etiqueta), min: num(r.min), max: numeroONulo(r.max) };
}

export function normalizarCpvCatalogo(raw: unknown): CpvCatalogo {
  const r = registro(raw);
  return {
    fuente: texto(r.fuente),
    universo: texto(r.universo),
    consultado: texto(r.consultado),
    distritos: lista(r.distritos).map((d) => ({
      ubigeo: texto(d.ubigeo),
      provinciaCodigo: texto(d.provincia_codigo),
      departamento: texto(d.departamento),
      provincia: texto(d.provincia),
      distrito: texto(d.distrito) || texto(d.ubigeo),
      poblacion18: num(d.poblacion_18),
    })).filter((d) => d.ubigeo),
    provincias: lista(r.provincias).map((p) => ({
      codigo: texto(p.provincia_codigo),
      departamento: texto(p.departamento),
      provincia: texto(p.provincia),
      nDistritos: num(p.n_distritos),
    })).filter((p) => p.codigo),
    agrupacionesEducacion: lista(r.agrupaciones_educacion).map((a) => ({ codigo: texto(a.codigo), etiqueta: texto(a.etiqueta) })),
    gruposEdadDefault: lista(r.grupos_edad_default).map(grupoEdad),
  };
}

export function normalizarCpvMetas(raw: unknown): CpvMetas {
  const r = registro(raw);
  const a = registro(r.ambito);
  return {
    fuente: texto(r.fuente),
    universo: texto(r.universo),
    consultado: texto(r.consultado),
    ambito: {
      nivel: texto(a.nivel),
      nDistritos: num(a.n_distritos),
      ubigeos: textos(a.ubigeos),
      provincias: textos(a.provincias),
    },
    total: num(r.total),
    margenes: lista(r.margenes).map((m) => ({
      variable: texto(m.variable),
      etiqueta: texto(m.etiqueta),
      total: num(m.total),
      categorias: lista(m.categorias).map((c) => ({
        codigo: texto(c.codigo), etiqueta: texto(c.etiqueta) || texto(c.codigo), poblacion: num(c.poblacion),
      })).filter((c) => c.codigo),
    })).filter((m) => m.variable),
    avisos: lista(r.avisos).map((x) => ({
      level: texto(x.level) === "warn" ? "warn" : "info",
      code: texto(x.code),
      message: texto(x.message),
    })),
  };
}

export async function getCpv2025Catalogo(): Promise<CpvCatalogo> {
  const raw = await handle<unknown>(
    await apiFetch("/api/analitica/ponderacion/cpv2025/distritos", { headers: headers() }),
  );
  return normalizarCpvCatalogo(raw);
}

export async function postCpv2025Metas(pedido: CpvMetasPedido): Promise<CpvMetas> {
  const raw = await handle<unknown>(
    await apiFetch("/api/analitica/ponderacion/cpv2025/metas", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(pedido),
    }),
  );
  return normalizarCpvMetas(raw);
}
