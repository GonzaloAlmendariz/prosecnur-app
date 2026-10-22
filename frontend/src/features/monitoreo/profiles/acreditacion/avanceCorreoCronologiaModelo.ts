// Cronología de envíos de Avance › Correo: un carril por público, un nodo por
// envío. Puro: posiciones en porcentaje del ancho y tamaños en píxeles, para
// que la vista solo los pinte.

import type { MonitoreoMailchimpCifrasEnvio, MonitoreoMailchimpEnvio } from "../../../../api/monitoreoMailchimp";
import { fechaCorta } from "./avanceCorreoMatriz";
import { rotuloDeTramo, tramosDelPublico } from "./avanceCorreoEmbudoModelo";

export type NodoDeEnvio = {
  clave: string;
  publico: string;
  envio: MonitoreoMailchimpEnvio;
  cifras: MonitoreoMailchimpCifrasEnvio;
  parcial: boolean;
  posicion: number;
  rotulo: string;
  tipo: "invitacion" | "recordatorio";
  /** 0–100 sobre el ancho del carril. */
  x: number;
  /** Diámetro en px. */
  tamano: number;
};

export type Carril = { publico: string; nodos: NodoDeEnvio[] };

export type MarcaDeFecha = { clave: string; rotulo: string; x: number };

export type Cronologia = { carriles: Carril[]; fechas: MarcaDeFecha[]; nodos: NodoDeEnvio[] };

const MARGEN = 5;
const SEPARACION_MINIMA = 3.2;
export const TAMANO_MIN = 14;
export const TAMANO_MAX = 34;

function ms(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Públicos con al menos un envío, mayoritario o en el desglose. */
function publicosConEnvio(envios: readonly MonitoreoMailchimpEnvio[]): string[] {
  const vistos = new Set<string>();
  for (const e of envios) {
    if (e.por_actor.length) for (const a of e.por_actor) vistos.add(a.actor);
    else if (e.actor) vistos.add(e.actor);
  }
  return [...vistos];
}

export function cronologiaDeEnvios(envios: readonly MonitoreoMailchimpEnvio[]): Cronologia {
  const tiempos = envios.map((e) => ms(e.enviado_at)).filter((t): t is number => t != null);
  const min = tiempos.length ? Math.min(...tiempos) : 0;
  const max = tiempos.length ? Math.max(...tiempos) : 0;
  const xDe = (iso: string): number => {
    const t = ms(iso);
    if (t == null) return 100 - MARGEN;
    if (max === min) return 50;
    return MARGEN + ((t - min) / (max - min)) * (100 - 2 * MARGEN);
  };

  const crudos = publicosConEnvio(envios).map((publico) => ({ publico, tramos: tramosDelPublico(envios, publico) }));
  const maxResp = Math.max(0, ...crudos.flatMap((c) => c.tramos.map((t) => t.cifras.respuestas ?? 0)));
  const tamanoDe = (r: number | null) => {
    if (r == null || r <= 0 || maxResp <= 0) return TAMANO_MIN;
    return Math.round(TAMANO_MIN + Math.sqrt(r / maxResp) * (TAMANO_MAX - TAMANO_MIN));
  };

  const carriles: Carril[] = crudos
    .map(({ publico, tramos }) => {
      let previo = Number.NEGATIVE_INFINITY;
      const nodos = tramos.map((t, i): NodoDeEnvio => {
        // Dos envíos del mismo día en un carril no se montan: el segundo se corre.
        const x = Math.min(100 - MARGEN / 2, Math.max(xDe(t.envio.enviado_at), previo + SEPARACION_MINIMA));
        previo = x;
        return {
          clave: `${t.envio.campaign_id}::${publico}`,
          publico,
          envio: t.envio,
          cifras: t.cifras,
          parcial: t.parcial,
          posicion: i + 1,
          rotulo: rotuloDeTramo(i + 1),
          tipo: i === 0 ? "invitacion" : "recordatorio",
          x,
          tamano: tamanoDe(t.cifras.respuestas),
        };
      });
      return { publico, nodos };
    })
    .sort((a, b) => {
      const pa = ms(a.nodos[0]?.envio.enviado_at ?? "") ?? Number.POSITIVE_INFINITY;
      const pb = ms(b.nodos[0]?.envio.enviado_at ?? "") ?? Number.POSITIVE_INFINITY;
      return pa - pb || a.publico.localeCompare(b.publico, "es");
    });

  const fechas = new Map<string, MarcaDeFecha>();
  for (const e of envios) {
    const rotulo = fechaCorta(e.enviado_at);
    if (!rotulo || fechas.has(rotulo)) continue;
    fechas.set(rotulo, { clave: rotulo, rotulo, x: xDe(e.enviado_at) });
  }
  return {
    carriles,
    fechas: [...fechas.values()].sort((a, b) => a.x - b.x),
    nodos: carriles.flatMap((c) => c.nodos),
  };
}

/** El nodo que se muestra al entrar: el último envío (el que decide el ritmo). */
export function nodoInicial(c: Cronologia): NodoDeEnvio | null {
  let elegido: NodoDeEnvio | null = null;
  for (const n of c.nodos) {
    if (!elegido) { elegido = n; continue; }
    const a = ms(n.envio.enviado_at) ?? 0;
    const b = ms(elegido.envio.enviado_at) ?? 0;
    if (a > b || (a === b && (n.cifras.respuestas ?? 0) > (elegido.cifras.respuestas ?? 0))) elegido = n;
  }
  return elegido;
}
