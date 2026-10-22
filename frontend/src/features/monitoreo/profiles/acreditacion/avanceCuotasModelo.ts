// Modelo puro de Avance › Cuotas (checklist T2, 2026-10-22).
//
// Todo lo que la vista decide sin DOM: fase y readiness, la lectura de cada
// cuota (con frecuencia y base), el orden y el filtro de sus categorías, la
// geometría de las barras y el borrador del panel de configuración. Las cifras
// las calcula el backend (`/api/monitoreo/cuotas`); aquí no se recalcula un
// avance que el motor publicó.

import type {
  MonitoreoCuota,
  MonitoreoCuotaCategoria,
  MonitoreoCuotaEntrada,
  MonitoreoCuotaEstadoCategoria,
  MonitoreoCuotaPropuesta,
  MonitoreoCuotaPublico,
  MonitoreoCuotasEstado,
} from "../../../../api/monitoreoCuotas";
import { formatoConteo, formatoDecimal, numeroFinito, SIN_CIFRA } from "../../../../lib/formatoNumero";

// ---------- Cifras ----------

export function cifra(valor: number | null | undefined): string {
  return formatoConteo(valor);
}

/** Proporción 0–1 como «57.9 %»; «—» sin dato. Un decimal; dos bajo 1 %. */
export function porcentaje(p: number | null | undefined): string {
  const n = numeroFinito(p);
  if (n == null) return SIN_CIFRA;
  const puntos = n * 100;
  if (puntos === 0) return "0 %";
  return `${formatoDecimal(puntos, Math.abs(puntos) < 1 ? 2 : 1)} %`;
}

/** «57.9 % · 350 de 605». */
export function conBase(n: number | null | undefined, base: number | null | undefined): string {
  const p = n != null && base ? n / base : null;
  return `${porcentaje(p)} · ${cifra(n)} de ${cifra(base)}`;
}

// ---------- Fases y readiness ----------

export type FaseCuotas = "cargando" | "error" | "preparando" | "sin-universo" | "sin-cuotas" | "listo";

export function faseCuotas(input: { estado: MonitoreoCuotasEstado | null; cargando: boolean; error: string }): FaseCuotas {
  if (input.cargando && !input.estado) return "cargando";
  if (input.error && !input.estado) return "error";
  const e = input.estado;
  if (!e) return "cargando";
  if (e.preparando) return "preparando";
  if (!e.publicos.length) return "sin-universo";
  if (!e.cuotas.length) return "sin-cuotas";
  return "listo";
}

/** `false` solo mientras carga; un terminal sin contenido publica `vacio:<motivo>`. */
export function marcaReadinessCuotas(fase: FaseCuotas): string {
  if (fase === "cargando") return "false";
  if (fase === "listo") return "monitoreo-cuotas";
  if (fase === "error") return "monitoreo-cuotas:error";
  return `vacio:${fase}`;
}

// ---------- Estado de la vista ----------

export type EstadoCuotas = {
  estado: MonitoreoCuotasEstado | null;
  cargando: boolean;
  error: string;
  guardando: boolean;
  proponiendo: boolean;
  errorPanel: string;
  aviso: string;
};

export const ESTADO_CUOTAS_INICIAL: EstadoCuotas = {
  estado: null,
  cargando: true,
  error: "",
  guardando: false,
  proponiendo: false,
  errorPanel: "",
  aviso: "",
};

export type AccionCuotas =
  | { tipo: "cargar" }
  | { tipo: "cargado"; estado: MonitoreoCuotasEstado }
  | { tipo: "fallo"; error: string }
  | { tipo: "proponer" }
  | { tipo: "propuesto" }
  | { tipo: "guardar" }
  | { tipo: "guardado"; estado: MonitoreoCuotasEstado; aviso: string }
  | { tipo: "fallo-panel"; error: string }
  | { tipo: "limpiar-panel" };

export function reducirCuotas(s: EstadoCuotas, a: AccionCuotas): EstadoCuotas {
  switch (a.tipo) {
    case "cargar":
      return { ...s, cargando: true, error: "" };
    case "cargado":
      return { ...s, estado: a.estado, cargando: false, error: "" };
    case "fallo":
      return { ...s, cargando: false, error: a.error };
    case "proponer":
      return { ...s, proponiendo: true, errorPanel: "" };
    case "propuesto":
      return { ...s, proponiendo: false };
    case "guardar":
      return { ...s, guardando: true, errorPanel: "", aviso: "" };
    case "guardado":
      return { ...s, estado: a.estado, guardando: false, errorPanel: "", aviso: a.aviso };
    case "fallo-panel":
      return { ...s, guardando: false, proponiendo: false, errorPanel: a.error };
    case "limpiar-panel":
      return { ...s, errorPanel: "" };
    default:
      return s;
  }
}

// ---------- Lectura de una cuota ----------

export type TonoCuota = "cumplida" | "en_curso" | "sin_avance" | "sin_meta";

export const ESTADO_CATEGORIA: Record<MonitoreoCuotaEstadoCategoria, { etiqueta: string }> = {
  cumplida: { etiqueta: "Cumplida" },
  en_curso: { etiqueta: "En curso" },
  sin_avance: { etiqueta: "Sin avance" },
  sin_meta: { etiqueta: "Sin meta" },
};

export type ResumenCuota = {
  id: string;
  actor: string;
  variable: string;
  /** Efectivas que cuentan para la meta: las de categorías con meta. */
  efectivas: number;
  meta: number;
  /** Avance real (puede pasar de 1). */
  avance: number | null;
  /** 0–1 para el anillo (tope 1); el texto conserva el dato real. */
  relleno: number;
  avanceTexto: string;
  cumplidas: string;
  cobertura: string;
  tono: TonoCuota;
};

export function resumenCuota(q: MonitoreoCuota): ResumenCuota {
  const conMeta = q.categorias.filter((c) => (c.meta ?? 0) > 0);
  const efectivas = conMeta.length ? conMeta.reduce((n, c) => n + (c.efectivas ?? 0), 0) : q.efectivas ?? 0;
  const meta = q.meta ?? conMeta.reduce((n, c) => n + (c.meta ?? 0), 0);
  const avance = q.avance ?? (meta > 0 ? efectivas / meta : null);
  const total = q.categorias_total ?? conMeta.length;
  const cumplidas = q.categorias_cumplidas ?? q.categorias.filter((c) => c.estado === "cumplida").length;
  const tono: TonoCuota = meta <= 0 ? "sin_meta" : avance != null && avance >= 1 ? "cumplida" : efectivas > 0 ? "en_curso" : "sin_avance";
  return {
    id: q.id,
    actor: q.actor,
    variable: q.variable,
    efectivas,
    meta,
    avance,
    relleno: avance == null ? 0 : Math.max(0, Math.min(1, avance)),
    avanceTexto: meta > 0 ? `${porcentaje(avance)} · ${cifra(efectivas)} de ${cifra(meta)}` : "Sin metas",
    cumplidas: `${cifra(cumplidas)} de ${cifra(total)} ${total === 1 ? "categoría cumplida" : "categorías cumplidas"}`,
    cobertura: q.cobertura != null ? `cobertura ${porcentaje(q.cobertura)}` : "metas escritas a mano",
    tono,
  };
}

/** Cuota elegida: la del `foco` si existe; si no, la primera. */
export function cuotaElegida(cuotas: readonly MonitoreoCuota[], foco: string): MonitoreoCuota | null {
  return cuotas.find((q) => q.id === foco) ?? cuotas[0] ?? null;
}

// ---------- Categorías: orden, filtro y barra ----------

export type OrdenCategorias = "brecha" | "universo" | "nombre";

export const ORDENES_CATEGORIAS: readonly { valor: OrdenCategorias; etiqueta: string }[] = [
  { valor: "brecha", etiqueta: "Brecha" },
  { valor: "universo", etiqueta: "Universo" },
  { valor: "nombre", etiqueta: "Nombre" },
];

export function normalizarBusqueda(texto: string): string {
  return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const ES_SIN_DATO = (c: { categoria: string }) => normalizarBusqueda(c.categoria) === "sin dato";

/**
 * Orden y filtro de las categorías. «Sin dato» va siempre al final: es una
 * categoría propia del contrato, no una más que compita por la brecha.
 */
export function categoriasVisibles(
  categorias: readonly MonitoreoCuotaCategoria[],
  orden: OrdenCategorias,
  filtro: string,
): MonitoreoCuotaCategoria[] {
  const f = normalizarBusqueda(filtro);
  const filtradas = f ? categorias.filter((c) => normalizarBusqueda(c.categoria).includes(f)) : [...categorias];
  const porNombre = (a: MonitoreoCuotaCategoria, b: MonitoreoCuotaCategoria) => a.categoria.localeCompare(b.categoria, "es", { numeric: true });
  return filtradas.sort((a, b) => {
    const sa = ES_SIN_DATO(a) ? 1 : 0;
    const sb = ES_SIN_DATO(b) ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (orden === "nombre") return porNombre(a, b);
    const d = orden === "brecha"
      ? (b.falta ?? 0) - (a.falta ?? 0)
      : (b.universo ?? 0) - (a.universo ?? 0);
    return d || (b.universo ?? 0) - (a.universo ?? 0) || porNombre(a, b);
  });
}

/**
 * Barra tipo bullet de una categoría: la pista mide lo mayor entre la meta y
 * las efectivas, el relleno son las efectivas y la marca la meta. Así la
 * barra de una categoría chica a medias se ve igual de legible que la de una
 * grande, y pasarse de la meta se ve como relleno que cruza la marca.
 */
export function barraDeCategoria(c: Pick<MonitoreoCuotaCategoria, "meta" | "efectivas">): {
  relleno: number;
  marca: number | null;
  pasada: boolean;
} {
  const meta = c.meta ?? 0;
  const ef = c.efectivas ?? 0;
  const escala = Math.max(meta, ef);
  if (escala <= 0) return { relleno: 0, marca: null, pasada: false };
  return {
    relleno: (ef / escala) * 100,
    marca: meta > 0 ? (meta / escala) * 100 : null,
    pasada: meta > 0 && ef > meta,
  };
}

/** «faltan 255», «sobran 12», «al día», «sin meta». */
export function restoDeCategoria(c: Pick<MonitoreoCuotaCategoria, "meta" | "efectivas" | "falta">): string {
  const meta = c.meta ?? 0;
  const ef = c.efectivas ?? 0;
  if (meta <= 0) return "sin meta";
  if (ef > meta) return `sobran ${cifra(ef - meta)}`;
  const falta = c.falta ?? Math.max(0, meta - ef);
  return falta > 0 ? `faltan ${cifra(falta)}` : "al día";
}

// ---------- Borrador del panel ----------

export type FilaBorrador = { categoria: string; universo: number | null; meta: string };

export type BorradorCuota = {
  /** `""` = cuota nueva. */
  id: string;
  actor: string;
  variable: string;
  /** Porcentaje como lo escribe la persona («31.2»); `""` = sin cobertura. */
  cobertura: string;
  filas: FilaBorrador[];
};

/** Cobertura por defecto del público: meta / universo. */
export function coberturaPorDefecto(p: MonitoreoCuotaPublico | undefined): number | null {
  if (!p || p.meta == null || !p.universo) return null;
  return p.meta / p.universo;
}

/** Proporción → texto editable en puntos porcentuales con un decimal («31.2»). */
export function coberturaATexto(c: number | null): string {
  if (c == null || !Number.isFinite(c)) return "";
  return String(Math.round(c * 1000) / 10);
}

/** «31.2», «31,2» o «31.2 %» → 0.312; vacío o inválido → `null`. */
export function textoACobertura(texto: string): number | null {
  const limpio = String(texto ?? "").replace("%", "").replace(",", ".").trim();
  if (!limpio) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n / 100;
}

/** Meta escrita → entero no negativo; vacío o inválido → 0. */
export function textoAMeta(texto: string): number {
  const n = Number(String(texto ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function borradorNuevo(publicos: readonly MonitoreoCuotaPublico[], actor = ""): BorradorCuota {
  const p = publicos.find((x) => x.actor === actor) ?? publicos[0];
  return { id: "", actor: p?.actor ?? "", variable: "", cobertura: coberturaATexto(coberturaPorDefecto(p)), filas: [] };
}

export function borradorDeCuota(q: MonitoreoCuota): BorradorCuota {
  return {
    id: q.id,
    actor: q.actor,
    variable: q.variable,
    cobertura: coberturaATexto(q.cobertura),
    filas: q.categorias.map((c) => ({ categoria: c.categoria, universo: c.universo, meta: c.meta != null ? String(c.meta) : "" })),
  };
}

export type AccionBorrador =
  | { tipo: "iniciar"; borrador: BorradorCuota }
  | { tipo: "publico"; actor: string; publicos: readonly MonitoreoCuotaPublico[] }
  | { tipo: "variable"; variable: string }
  | { tipo: "cobertura"; cobertura: string }
  | { tipo: "meta"; categoria: string; meta: string }
  | { tipo: "propuesta"; propuesta: MonitoreoCuotaPropuesta };

export function reducirBorrador(b: BorradorCuota, a: AccionBorrador): BorradorCuota {
  switch (a.tipo) {
    case "iniciar":
      return a.borrador;
    case "publico": {
      // Otro público: otra base, otras variables y otra cobertura por defecto.
      const p = a.publicos.find((x) => x.actor === a.actor);
      return { ...b, actor: a.actor, variable: "", cobertura: coberturaATexto(coberturaPorDefecto(p)), filas: [] };
    }
    case "variable":
      return a.variable === b.variable ? b : { ...b, variable: a.variable, filas: [] };
    case "cobertura":
      return { ...b, cobertura: a.cobertura };
    case "meta":
      return { ...b, filas: b.filas.map((f) => (f.categoria === a.categoria ? { ...f, meta: a.meta } : f)) };
    case "propuesta":
      return {
        ...b,
        cobertura: a.propuesta.cobertura != null ? coberturaATexto(a.propuesta.cobertura) : b.cobertura,
        filas: a.propuesta.categorias.map((c) => ({ categoria: c.categoria, universo: c.universo, meta: c.meta != null ? String(c.meta) : "0" })),
      };
    default:
      return b;
  }
}

export function sumaDeMetas(b: BorradorCuota): number {
  return b.filas.reduce((n, f) => n + textoAMeta(f.meta), 0);
}

/** Por qué no se puede guardar el borrador; `""` si se puede. */
export function problemaDelBorrador(b: BorradorCuota, cuotas: readonly MonitoreoCuota[]): string {
  if (!b.actor) return "Elige el público.";
  if (!b.variable) return "Elige la variable de la cuota.";
  if (!b.filas.length) return "Propón las metas o escríbelas por categoría.";
  if (b.cobertura.trim() && textoACobertura(b.cobertura) == null) return "La cobertura es un porcentaje entre 0 y 100.";
  if (cuotas.some((q) => q.id !== b.id && q.actor === b.actor && q.variable === b.variable)) {
    return `Ya hay una cuota de ${b.actor} por ${b.variable}.`;
  }
  return "";
}

function entradaDeCuota(q: MonitoreoCuota): MonitoreoCuotaEntrada {
  const metas: Record<string, number> = {};
  for (const c of q.categorias) metas[c.categoria] = c.meta ?? 0;
  return { id: q.id, actor: q.actor, variable: q.variable, cobertura: q.cobertura, metas };
}

function entradaDeBorrador(b: BorradorCuota): MonitoreoCuotaEntrada {
  const metas: Record<string, number> = {};
  for (const f of b.filas) metas[f.categoria] = textoAMeta(f.meta);
  return { ...(b.id ? { id: b.id } : {}), actor: b.actor, variable: b.variable, cobertura: textoACobertura(b.cobertura), metas };
}

/** La configuración completa con el borrador puesto (reemplaza o agrega). */
export function entradasConBorrador(cuotas: readonly MonitoreoCuota[], b: BorradorCuota): MonitoreoCuotaEntrada[] {
  const otras = cuotas.filter((q) => !b.id || q.id !== b.id).map(entradaDeCuota);
  const propia = entradaDeBorrador(b);
  if (!b.id) return [...otras, propia];
  const i = cuotas.findIndex((q) => q.id === b.id);
  if (i < 0) return [...otras, propia];
  otras.splice(i, 0, propia);
  return otras;
}

/** La configuración sin la cuota `id`. */
export function entradasSinCuota(cuotas: readonly MonitoreoCuota[], id: string): MonitoreoCuotaEntrada[] {
  return cuotas.filter((q) => q.id !== id).map(entradaDeCuota);
}

/** El id de la cuota recién guardada: por id o, si era nueva, por público y variable. */
export function idGuardado(estado: MonitoreoCuotasEstado, b: BorradorCuota): string {
  if (b.id && estado.cuotas.some((q) => q.id === b.id)) return b.id;
  return estado.cuotas.find((q) => q.actor === b.actor && q.variable === b.variable)?.id ?? "";
}
