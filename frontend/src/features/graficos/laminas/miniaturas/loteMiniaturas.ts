// Máquina de estados de las miniaturas en lote de la tira (F6 §5.3; contrato
// docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md §2.3–2.4 y §6). Pura: la orquesta `useMiniaturasLote`.
//
// Cada lámina tiene una entrada con la CLAVE con la que se pidió (lámina + antetítulo + estilo global + alcance, la misma
// que usa la vista previa). Reglas:
//  - Se piden las láminas sin entrada o cuya clave cambió (edición): el backend decide por huella si re-renderiza.
//  - Pueden correr varios lotes a la vez (hasta `MAX_LOTES_SIMULTANEOS`). Una lámina NUEVA (sin entrada: la Vista general
//    la acaba de ver al desplazarse) va en un lote propio con `reemplazar = false`: NO cancela el lote en curso ni vuelve
//    a pedir lo que ése ya tiene pendiente (cancelarlo tiraba la lámina a medio dibujar y obligaba a otro arranque del
//    worker, ~40 s en la nube). En el tope, espera a que uno termine.
//  - Un «Reintentar» cuenta como lámina nueva (la reintentada no está en ningún lote vivo).
//  - Una EDICIÓN (clave cambiada) sí reemplaza (`reemplazar = true`, contrato §6.4): el backend
//    cancela TODOS los lotes de miniaturas de la sesión, así que el pedido arrastra una sola vez las pendientes de todos
//    — si no, quedarían en esqueleto para siempre. Las ya resueltas no viajan y lo ya dibujado por el lote cancelado está
//    en la caché del backend (vuelve al instante).
//  - Un estado del lote sólo actualiza la entrada si la clave con que ESE lote pidió la lámina sigue siendo la vigente:
//    un lote viejo nunca pisa una lámina editada después.
//  - Cuando el lote vigente termina (done/error), lo que siga pendiente pasa a error reintentable. Si se CANCELA, lo
//    pendiente vuelve a «sin pedir» y se pide en el siguiente plan: nadie intentó dibujarlo, así que no «falló».
//  - Los errores no se reintentan solos (evita un bucle contra un motor que falla): sólo con «Reintentar» o al editar.

import type { MiniaturaEstado, MiniaturasLote } from "../../../../api/graficosMiniaturas";

export type EntradaMiniatura = {
  estado: MiniaturaEstado;
  /** Clave con la que se pidió por última vez. */
  clave: string;
  /** Imagen lista (`ok`, o `sin_datos` con raster). */
  src: string | null;
  /** La lámina en tamaño completo, para el visor (sin pedir otra vista previa). */
  imagen?: string | null;
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

/** Lotes de miniaturas que pueden correr a la vez (cada uno es un worker `callr`). */
export const MAX_LOTES_SIMULTANEOS = 2;

/** Pedido a lanzar: qué láminas, en orden, y si reemplaza (cancela) los lotes en curso. */
export type PlanPedido = { laminas: LaminaClave[]; reemplazar: boolean };

/**
 * Qué pedir ahora. `lotesCorriendo`: lotes vivos de esta tira/vista. Reglas (cabecera del archivo):
 *  - edición → reemplaza: [editadas, nuevas, pendientes de los lotes que cancela];
 *  - sólo nuevas → lote aparte sin reemplazar, sólo con las nuevas (las pendientes ya están en un lote vivo); con el tope
 *    de lotes alcanzado, espera (null);
 *  - sin lote vivo → retoma también las pendientes huérfanas.
 * null = no hace falta lote ahora.
 */
export function planPedido(
  laminas: readonly LaminaClave[],
  entradas: Entradas,
  opciones: { lotesCorriendo: number; forzar?: ReadonlySet<string>; maxSimultaneos?: number },
): PlanPedido | null {
  const forzar = opciones.forzar ?? new Set<string>();
  const max = opciones.maxSimultaneos ?? MAX_LOTES_SIMULTANEOS;
  const editadas: LaminaClave[] = [];
  const nuevas: LaminaClave[] = [];
  const pendientes: LaminaClave[] = [];
  for (const l of laminas) {
    const e = entradas[l.id];
    if (e && e.clave !== l.clave) editadas.push(l);
    // «Reintentar» de una lámina resuelta o en error: no está en ningún lote vivo, así que va como nueva.
    else if (!e || (forzar.has(l.id) && e.estado !== "pendiente")) nuevas.push(l);
    else if (e.estado === "pendiente") pendientes.push(l);
  }
  const corriendo = opciones.lotesCorriendo > 0;
  if (editadas.length) return { laminas: [...editadas, ...nuevas, ...pendientes], reemplazar: true };
  if (!corriendo) {
    const todas = [...nuevas, ...pendientes];
    // Sin lote propio vivo, `reemplazar` sólo limpia restos de la sesión: no hay progreso nuestro que perder.
    return todas.length ? { laminas: todas, reemplazar: true } : null;
  }
  if (!nuevas.length || opciones.lotesCorriendo >= max) return null;
  return { laminas: nuevas, reemplazar: false };
}

/** Lotes vivos vistos como uno (lo que leen el anuncio y el avance de la tira): unión de claves; id/job del último. */
export function agregarVigente(lotes: readonly LoteVigente[]): LoteVigente | null {
  if (!lotes.length) return null;
  if (lotes.length === 1) return lotes[0];
  const ultimo = lotes[lotes.length - 1];
  return { loteId: ultimo.loteId, jobId: ultimo.jobId, claves: Object.assign({}, ...lotes.map((l) => l.claves)) };
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
  const quitar = (id: string) => {
    if (!(id in (sig ?? entradas))) return;
    sig = sig ?? { ...entradas };
    delete sig[id];
  };
  const poner = (id: string, e: EntradaMiniatura) => {
    const prev = (sig ?? entradas)[id];
    if (prev && prev.estado === e.estado && prev.src === e.src && prev.error === e.error && prev.clave === e.clave && prev.anterior === e.anterior && (prev.imagen ?? null) === (e.imagen ?? null)
      && (prev.vacios?.vacios ?? 0) === (e.vacios?.vacios ?? 0) && (prev.vacios?.pedidos ?? 0) === (e.vacios?.pedidos ?? 0)
      && (prev.vacios?.motivo ?? null) === (e.vacios?.motivo ?? null)) return;
    sig = sig ?? { ...entradas };
    sig[id] = e;
  };
  const terminado = lote.status !== "running";
  const cancelado = lote.status === "cancelled";
  const vistas = new Set<string>();
  for (const l of lote.laminas) {
    const clave = vigente.claves[l.slide_id];
    const actual = entradas[l.slide_id];
    if (clave === undefined || !actual || actual.clave !== clave) continue;
    vistas.add(l.slide_id);
    if (l.estado === "pendiente") {
      if (cancelado) quitar(l.slide_id);
      else if (terminado) poner(l.slide_id, { ...actual, estado: "error", error: MENSAJE_INTERRUMPIDA });
      continue;
    }
    const imagen = l.miniatura ? src(l.miniatura.url) : null;
    if (l.estado === "error") {
      poner(l.slide_id, { ...actual, estado: "error", src: null, error: mensajeLegible(l.error?.message) });
    } else {
      const g = l.graficos;
      const vacios = g && g.vacios > 0 ? { vacios: g.vacios, pedidos: g.pedidos, motivo: g.motivo } : null;
      const grande = l.imagen && l.estado !== "sin_imagen" ? src(l.imagen.url) : null;
      poner(l.slide_id, { estado: l.estado, clave, src: l.estado === "sin_imagen" ? null : imagen, imagen: grande, anterior: null, error: null, vacios });
    }
  }
  if (terminado) {
    // Láminas del pedido que el estado final ni nombra: también quedan reintentables.
    for (const [id, clave] of Object.entries(vigente.claves)) {
      const actual = entradas[id];
      if (vistas.has(id) || !actual || actual.clave !== clave || actual.estado !== "pendiente") continue;
      if (cancelado) quitar(id);
      else poner(id, { ...actual, estado: "error", error: MENSAJE_INTERRUMPIDA });
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

/** Avance del lote vigente (o de la unión de los vivos, `agregarVigente`) para la línea de estado de la tira. */
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
