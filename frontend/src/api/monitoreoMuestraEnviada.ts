// monitoreoMuestraEnviada.ts — la muestra viva de Hojas de ruta contra la foto
// que se envió a Material (I4, Monitoreo › Territorial › Insumos › Conexiones).
//
// Contrato: GET /api/monitoreo/territorial/muestra-enviada
// (`api/R/monitoreo_territorial_muestra_enviada.R`). Solo lectura: Monitoreo
// sigue leyendo la viva y aquí sólo se entera de si difiere de la enviada. La
// viva no guarda la fecha de su sorteo, así que lo que se fecha es el envío.
//
// Normalizador defensivo: Plumber serializa con auto_unbox (lista de uno como
// valor suelto, escalar como vector de largo uno, NA como null).

import { apiFetch, handle, headers } from "./core";
import { enteroONulo, registro, texto } from "./normalizarR";

export type EstadoDeMuestraEnviada = "igual" | "distinta" | "sin_envio" | "sin_muestra";

export type MuestraEnviada = {
  estado: EstadoDeMuestraEnviada;
  phase: string;
  enviadoAt: string;
  semillaEnviada: number | null;
  semillaViva: number | null;
  umpEnviadas: number;
  umpVivas: number;
  entran: string[];
  salen: string[];
  /** Manzanas que siguen en la muestra pero cambiaron de papel (titular ↔ reemplazo). */
  cambianRol: string[];
  /** UMP afectadas: las que entran, las que salen y las que cambian de papel. */
  cambian: number;
  texto: string;
};

const ESTADOS: readonly EstadoDeMuestraEnviada[] = ["igual", "distinta", "sin_envio", "sin_muestra"];

function ids(value: unknown): string[] {
  const valores = Array.isArray(value) ? value : value == null || typeof value === "object" ? [] : [value];
  return valores.map(texto).filter(Boolean);
}

export function normalizeMuestraEnviada(raw: unknown): MuestraEnviada {
  const r = registro(raw);
  const estado = texto(r.estado) as EstadoDeMuestraEnviada;
  return {
    estado: ESTADOS.includes(estado) ? estado : "sin_envio",
    phase: texto(r.phase),
    enviadoAt: texto(r.enviado_at),
    semillaEnviada: enteroONulo(r.semilla_enviada),
    semillaViva: enteroONulo(r.semilla_viva),
    umpEnviadas: enteroONulo(r.ump_enviadas) ?? 0,
    umpVivas: enteroONulo(r.ump_vivas) ?? 0,
    entran: ids(r.entran),
    salen: ids(r.salen),
    cambianRol: ids(r.cambian_rol),
    cambian: enteroONulo(r.cambian) ?? 0,
    texto: texto(r.texto),
  };
}

export async function getMonitoreoTerritorialMuestraEnviada(): Promise<MuestraEnviada> {
  return normalizeMuestraEnviada(
    await handle<unknown>(await apiFetch("/api/monitoreo/territorial/muestra-enviada", { headers: headers() })),
  );
}
