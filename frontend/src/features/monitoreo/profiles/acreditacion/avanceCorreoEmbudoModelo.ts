// Embudo del correo y series por público (Avance › Correo). Puro.
//
// Las cifras son las que publica el backend por envío; aquí solo se recortan
// por público y se suman. Nada se estima: si una cifra falta en algún tramo,
// la suma se publica `null` («sin dato»), no como cero.

import type {
  MonitoreoMailchimpCifrasEnvio,
  MonitoreoMailchimpEnvio,
} from "../../../../api/monitoreoMailchimp";

/** El tramo de un envío que tocó a un público, con su posición en la serie del público. */
export type TramoDeEnvio = {
  envio: MonitoreoMailchimpEnvio;
  /** Cifras del público en ese envío (o del envío entero si no hay filtro). */
  cifras: MonitoreoMailchimpCifrasEnvio;
  /** `true` si las cifras son una parte del envío (desglose `por_actor`). */
  parcial: boolean;
};

/**
 * Las cifras de un envío para un público. Sin público: el envío entero.
 *
 * Un envío con `por_actor` vacío tocó a un solo público, su `actor`. Con
 * desglose, el tramo es la fila de ese público; ahí Mailchimp no separa las
 * aperturas automáticas de Apple (`aperturas_sin_proxy` llega `null`).
 */
export function tramoDelPublico(envio: MonitoreoMailchimpEnvio, publico: string): TramoDeEnvio | null {
  if (!publico) return { envio, cifras: envio, parcial: false };
  if (envio.por_actor.length) {
    const fila = envio.por_actor.find((a) => a.actor === publico);
    return fila ? { envio, cifras: fila, parcial: true } : null;
  }
  return envio.actor === publico ? { envio, cifras: envio, parcial: false } : null;
}

function marcaDeTiempo(e: MonitoreoMailchimpEnvio): number {
  const ms = Date.parse(e.enviado_at);
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

/** Tramos del público en orden de salida. */
export function tramosDelPublico(envios: readonly MonitoreoMailchimpEnvio[], publico: string): TramoDeEnvio[] {
  return [...envios]
    .sort((a, b) => marcaDeTiempo(a) - marcaDeTiempo(b))
    .map((e) => tramoDelPublico(e, publico))
    .filter((t): t is TramoDeEnvio => t !== null);
}

/** «Invitación», «Recordatorio 1»… por la posición del envío en la serie del público. */
export function rotuloDeTramo(posicion: number): string {
  return posicion <= 1 ? "Invitación" : `Recordatorio ${posicion - 1}`;
}

/** Rótulo corto para ejes: «Inv.», «R1», «R2»… */
export function rotuloCortoDeTramo(posicion: number): string {
  return posicion <= 1 ? "Inv." : `R${posicion - 1}`;
}

/** Suma que se vuelve `null` si algún sumando falta. Sin sumandos, `null`. */
function sumaEstricta(valores: readonly (number | null)[]): number | null {
  if (!valores.length) return null;
  let total = 0;
  for (const v of valores) {
    if (v == null) return null;
    total += v;
  }
  return total;
}

// ---------- Embudo ----------

export type ClavePaso = "enviados" | "entregados" | "abrieron" | "clic" | "respondieron";

export type PasoEmbudo = {
  clave: ClavePaso;
  etiqueta: string;
  valor: number | null;
  /** Proporción sobre el paso anterior (0–1); `null` en el primero o sin base. */
  sobreAnterior: number | null;
  /** Proporción sobre los enviados. */
  sobreInicio: number | null;
  /** Base nombrada del paso anterior, para escribir «de 22,779 entregados». */
  baseAnterior: { valor: number | null; nombre: string } | null;
  /** Lo que se perdió desde el paso anterior; `null` si no hubo pérdida medible. */
  perdida: { etiqueta: string; valor: number } | null;
};

export type Embudo = {
  publico: string;
  envios: number;
  pasos: PasoEmbudo[];
  /** Las aperturas incluyen las automáticas de Apple (no hay cifra sin proxy para el filtro). */
  aperturasConApple: boolean;
};

const BASE_NOMBRE: Record<ClavePaso, string> = {
  enviados: "enviados",
  entregados: "entregados",
  abrieron: "que abrieron",
  clic: "con clic",
  respondieron: "que respondieron",
};

const PERDIDA: Record<ClavePaso, string> = {
  enviados: "",
  entregados: "rebotaron",
  abrieron: "no abrieron",
  clic: "no hicieron clic",
  respondieron: "no respondieron",
};

function proporcion(n: number | null, base: number | null): number | null {
  if (n == null || base == null || base <= 0) return null;
  return n / base;
}

/**
 * Enviados → entregados → abrieron → clic en la encuesta → respondieron.
 *
 * Las cifras son por correo enviado: una persona que recibió invitación y dos
 * recordatorios cuenta tres veces en «enviados», y una vez en «respondieron»
 * (cada efectiva se atribuye a un solo envío).
 */
export function embudoCorreo(envios: readonly MonitoreoMailchimpEnvio[], publico: string): Embudo {
  const tramos = tramosDelPublico(envios, publico);
  const c = tramos.map((t) => t.cifras);
  const sinProxy = sumaEstricta(c.map((x) => x.aperturas_sin_proxy));
  const aperturasConApple = sinProxy == null && tramos.length > 0;
  const valores: Record<ClavePaso, number | null> = {
    enviados: sumaEstricta(c.map((x) => x.enviados)),
    entregados: sumaEstricta(c.map((x) => x.entregados)),
    abrieron: sinProxy ?? sumaEstricta(c.map((x) => x.aperturas)),
    clic: sumaEstricta(c.map((x) => x.clics)),
    respondieron: sumaEstricta(c.map((x) => x.respuestas)),
  };
  const etiquetas: Record<ClavePaso, string> = {
    enviados: "Enviados",
    entregados: "Entregados",
    abrieron: aperturasConApple ? "Abrieron (con Apple)" : "Abrieron",
    clic: "Clic en la encuesta",
    respondieron: "Respondieron",
  };
  const orden: ClavePaso[] = ["enviados", "entregados", "abrieron", "clic", "respondieron"];
  const pasos = orden.map((clave, i): PasoEmbudo => {
    const valor = valores[clave];
    const anterior = i > 0 ? orden[i - 1] : null;
    const vAnterior = anterior ? valores[anterior] : null;
    const caida = valor != null && vAnterior != null && vAnterior > valor ? vAnterior - valor : null;
    return {
      clave,
      etiqueta: etiquetas[clave],
      valor,
      sobreAnterior: anterior ? proporcion(valor, vAnterior) : null,
      sobreInicio: i > 0 ? proporcion(valor, valores.enviados) : null,
      baseAnterior: anterior ? { valor: vAnterior, nombre: BASE_NOMBRE[anterior] } : null,
      perdida: caida != null && caida > 0 ? { etiqueta: PERDIDA[clave], valor: caida } : null,
    };
  });
  return { publico, envios: tramos.length, pasos, aperturasConApple };
}

/** Ancho relativo de la barra de un paso (0–100), con un piso visible si hay dato. */
export function anchoDePaso(valor: number | null, maximo: number | null): number {
  if (valor == null || !maximo || maximo <= 0) return 0;
  if (valor <= 0) return 0;
  return Math.max(0.6, Math.min(100, (valor / maximo) * 100));
}

// ---------- Serie por público (sparkline) ----------

export type PuntoDeSerie = {
  campaign_id: string;
  posicion: number;
  rotulo: string;
  rotuloCorto: string;
  fecha: string;
  respuestas: number | null;
};

/** Respuestas atribuidas por envío del público, en orden de salida. */
export function serieDeRespuestas(envios: readonly MonitoreoMailchimpEnvio[], publico: string): PuntoDeSerie[] {
  return tramosDelPublico(envios, publico).map((t, i) => ({
    campaign_id: t.envio.campaign_id,
    posicion: i + 1,
    rotulo: rotuloDeTramo(i + 1),
    rotuloCorto: rotuloCortoDeTramo(i + 1),
    fecha: t.envio.enviado_at,
    respuestas: t.cifras.respuestas,
  }));
}
