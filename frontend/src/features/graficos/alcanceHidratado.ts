// De qué alcance viene lo que el store de Gráficos tiene hidratado ahora (contrato A7-1, H1).
//
// El store es uno solo para los dos informes: el plan de la base activa (`/graficos/config`) y el borrador del informe
// compartido (`/graficos/consolidado/draft`, ADR 0040 §6.1). Quien guarda desde fuera del editor —guardar, guardar
// como y duplicar proyecto, vía `flushGraficosConfigIfHydrated`— no sabe cuál de los dos tiene delante, y escribir el
// borrador compartido como config de la base activa copia un plan sobre otro en silencio. Este registro lo dice.
//
// Lo escribe `useGraficosAutosave` cada vez que hidrata el store (GET de la base activa, GET del borrador compartido y
// siembra del plan compartido). Cada registro reemplaza al anterior: rehidratar la base activa es lo que «olvida» el
// alcance compartido. El persistidor del compartido viaja con el registro porque la revisión optimista
// (`expected_revision`) vive en el hook y no en el store.

import type { GraficosReportScope } from "./reportScope";

export type PersistidorConsolidado = (config: unknown) => Promise<number>;

export type AlcanceHidratado = {
  scope: GraficosReportScope;
  /** Sesión en la que se hidrató; un flush en otra sesión no escribe con este persistidor. */
  sid: string | null;
  /** Sólo en `consolidated`: guarda el borrador compartido con su revisión optimista. */
  persistirConsolidado?: PersistidorConsolidado;
};

let actual: AlcanceHidratado | null = null;

export function registrarAlcanceHidratado(alcance: AlcanceHidratado): void {
  actual = { ...alcance };
}

export function leerAlcanceHidratado(): AlcanceHidratado | null {
  return actual ? { ...actual } : null;
}

/** Vuelve al estado sin registro (sin hidratación conocida). Uso: reinicio entre pruebas. */
export function olvidarAlcanceHidratado(): void {
  actual = null;
}
