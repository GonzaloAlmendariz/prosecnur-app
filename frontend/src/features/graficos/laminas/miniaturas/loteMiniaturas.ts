// Máquina de estados de las miniaturas en lote de la tira (F6 §5.3; contrato
// docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md §2.3–2.4 y §6). Pura: la orquesta `useMiniaturasLote`.
//
// Cada lámina tiene una entrada con la CLAVE con la que se pidió (lámina + antetítulo + estilo global + alcance, la misma
// que usa la vista previa). Reglas:
//  - Se piden las láminas sin entrada o cuya clave cambió (edición): el backend decide por huella si re-renderiza.
//  - Un lote nuevo reemplaza al anterior (`reemplazar = true` cancela el job viejo); por eso el pedido nuevo arrastra las
//    láminas que el anterior dejó pendientes — si no, quedarían en esqueleto para siempre. Las ya resueltas no viajan.
//  - Un estado del lote sólo actualiza la entrada si la clave con que ESE lote pidió la lámina sigue siendo la vigente:
//    un lote viejo nunca pisa una lámina editada después.
//  - Cuando el lote vigente termina (done/error/cancelled), lo que siga pendiente pasa a error reintentable.
//  - Los errores no se reintentan solos (evita un bucle contra un motor que falla): sólo con «Reintentar» o al editar.

import type { MiniaturaEstado, MiniaturasLote } from "../../../../api/graficosMiniaturas";

export type EntradaMiniatura = {
  estado: MiniaturaEstado;
  /** Clave con la que se pidió por última vez. */
  clave: string;
  /** Imagen lista (`ok`, o `sin_datos` con raster). */
  src: string | null;
  /** Imagen previa de esta lámina, para no vaciar la caja mientras se rehace (C2). */
  anterior: string | null;
  /** Mensaje legible del error (sin código). */
  error: string | null;
  /** Gráficos vacíos de una lámina que sí salió (parcial: «1 de 2 gráficos sin datos»); null si no aplica o no vino. */
  vacios?: { vacios: number; pedidos: number; motivo: string | null } | null;
};

export type Entradas = Record<string, EntradaMiniatura>;

export type LaminaClave = { id: string; clave: string };

/** Lote vigente: qué clave mandó por cada lámina. */
export type LoteVigente = { loteId: string; jobId: string; claves: Record<string, string> };

export const MENSAJE_INTERRUMPIDA = "La miniatura no llegó a dibujarse.";

/**
 * Láminas a pedir ahora, en este orden: primero las cambiadas (o sin entrada, o las forzadas por «Reintentar»), luego —
 * sólo si hay alguna de ésas o no hay lote corriendo— las que siguen pendientes. Vacío = no hace falta lote.
 */
export function laminasAPedir(laminas: readonly LaminaClave[], entradas: Entradas, opciones: { loteCorriendo: boolean; forzar?: ReadonlySet<string> }): LaminaClave[] {
  const forzar = opciones.forzar ?? new Set<string>();
  const cambiadas = laminas.filter((l) => {
    const e = entradas[l.id];
    return !e || e.clave !== l.clave || forzar.has(l.id);
  });
  const pendientes = laminas.filter((l) => {
    const e = entradas[l.id];
    return !!e && e.clave === l.clave && e.estado === "pendiente" && !forzar.has(l.id);
  });
  if (!cambiadas.length && (opciones.loteCorriendo || !pendientes.length)) return [];
  return [...cambiadas, ...pendientes];
}

/** Marca como pendientes las láminas recién pedidas, conservando su última imagen como «anterior». */
export function marcarPedidas(entradas: Entradas, pedidas: readonly LaminaClave[]): Entradas {
  if (!pedidas.length) return entradas;
  const sig: Entradas = { ...entradas };
  for (const p of pedidas) {
    const prev = entradas[p.id];
    sig[p.id] = { estado: "pendiente", clave: p.clave, src: null, anterior: prev?.src ?? prev?.anterior ?? null, error: null, vacios: null };
  }
  return sig;
}

/** Quita jerga del mensaje del backend: el código `E_*` y el prefijo técnico no se le muestran al analista. */
export function mensajeLegible(m: string | null | undefined): string {
  const limpio = (m ?? "").replace(/\s*·\s*E_[A-Z0-9_]+\s*$/u, "").replace(/\bE_[A-Z0-9_]+:?\s*/gu, "").trim();
  return limpio || "No se pudo dibujar la miniatura.";
}

/**
 * Funde el estado de un lote. `src` resuelve la URL de la imagen (con sesión). Devuelve las mismas entradas si nada
 * cambió (para no re-renderizar la tira en cada poll).
 */
export function fusionarLote(entradas: Entradas, lote: MiniaturasLote, vigente: LoteVigente, src: (url: string) => string): Entradas {
  let sig: Entradas | null = null;
  const poner = (id: string, e: EntradaMiniatura) => {
    const prev = (sig ?? entradas)[id];
    if (prev && prev.estado === e.estado && prev.src === e.src && prev.error === e.error && prev.clave === e.clave && prev.anterior === e.anterior
      && (prev.vacios?.vacios ?? 0) === (e.vacios?.vacios ?? 0) && (prev.vacios?.pedidos ?? 0) === (e.vacios?.pedidos ?? 0)
      && (prev.vacios?.motivo ?? null) === (e.vacios?.motivo ?? null)) return;
    sig = sig ?? { ...entradas };
    sig[id] = e;
  };
  const terminado = lote.status !== "running";
  const vistas = new Set<string>();
  for (const l of lote.laminas) {
    const clave = vigente.claves[l.slide_id];
    const actual = entradas[l.slide_id];
    if (clave === undefined || !actual || actual.clave !== clave) continue;
    vistas.add(l.slide_id);
    if (l.estado === "pendiente") {
      if (terminado) poner(l.slide_id, { ...actual, estado: "error", error: MENSAJE_INTERRUMPIDA });
      continue;
    }
    const imagen = l.miniatura ? src(l.miniatura.url) : null;
    if (l.estado === "error") {
      poner(l.slide_id, { ...actual, estado: "error", src: null, error: mensajeLegible(l.error?.message) });
    } else {
      const g = l.graficos;
      const vacios = g && g.vacios > 0 ? { vacios: g.vacios, pedidos: g.pedidos, motivo: g.motivo } : null;
      poner(l.slide_id, { estado: l.estado, clave, src: l.estado === "sin_imagen" ? null : imagen, anterior: null, error: null, vacios });
    }
  }
  if (terminado) {
    // Láminas del pedido que el estado final ni nombra: también quedan reintentables.
    for (const [id, clave] of Object.entries(vigente.claves)) {
      const actual = entradas[id];
      if (vistas.has(id) || !actual || actual.clave !== clave || actual.estado !== "pendiente") continue;
      poner(id, { ...actual, estado: "error", error: MENSAJE_INTERRUMPIDA });
    }
  }
  return sig ?? entradas;
}

/** Cuando el pedido o el poll del lote falla entero: sus pendientes vigentes pasan a error con ese mensaje. */
export function fallarLote(entradas: Entradas, vigente: LoteVigente | { claves: Record<string, string> }, mensaje: string): Entradas {
  let sig: Entradas | null = null;
  for (const [id, clave] of Object.entries(vigente.claves)) {
    const actual = entradas[id];
    if (!actual || actual.clave !== clave || actual.estado !== "pendiente") continue;
    sig = sig ?? { ...entradas };
    sig[id] = { ...actual, estado: "error", error: mensajeLegible(mensaje) };
  }
  return sig ?? entradas;
}

/** Avance del lote vigente para la línea de estado de la tira. */
export function avanceLote(entradas: Entradas, vigente: LoteVigente | null): { listas: number; total: number } | null {
  if (!vigente) return null;
  const ids = Object.keys(vigente.claves);
  const listas = ids.filter((id) => {
    const e = entradas[id];
    return !e || e.clave !== vigente.claves[id] || e.estado !== "pendiente";
  }).length;
  return { listas, total: ids.length };
}

/** Olvida las entradas pendientes de un lote soltado: el próximo pedido las vuelve a incluir (las ya resueltas quedan). */
export function olvidarPendientes(entradas: Entradas, claves: Record<string, string>): Entradas {
  let sig: Entradas | null = null;
  for (const [id, clave] of Object.entries(claves)) {
    const e = entradas[id];
    if (!e || e.clave !== clave || e.estado !== "pendiente") continue;
    sig = sig ?? { ...entradas };
    delete sig[id];
  }
  return sig ?? entradas;
}

/** Aviso discreto de una lámina con parte de sus gráficos vacíos («1 de 2 gráficos sin datos»); null si no aplica. */
export function avisoVacios(e: EntradaMiniatura | undefined): string | null {
  const v = e?.vacios;
  if (!e || !v || v.vacios <= 0 || v.pedidos <= 0 || (e.estado !== "ok" && e.estado !== "sin_imagen")) return null;
  return `${v.vacios} de ${v.pedidos} gráfico${v.pedidos === 1 ? "" : "s"} sin datos`;
}
