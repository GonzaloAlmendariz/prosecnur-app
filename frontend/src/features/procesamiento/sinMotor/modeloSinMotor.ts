// Reglas de la vista "sin motor" de Procesamiento (ADR 0142, etapa P7;
// `procesamiento-sin-motor` del prototipo): cada cuánto se vuelve a probar el
// motor, cómo se dice la espera y qué sección se nombra en la cabecera.

import { seccionesDeProcesamiento } from "../estado/seccionesDeProcesamiento";

/** Segundos de espera antes de cada intento: el primero a los 4 s, luego más espaciado. */
export const ESPERAS_DEL_MOTOR_S = [4, 8, 15, 30] as const;

/** Con la app quieta nadie pide nada y la caída no se nota: cada tanto se toca /api/system/health. */
export const LATIDO_DEL_MOTOR_MS = 20_000;

export function esperaDelIntento(intento: number): number {
  const i = Math.max(0, Math.floor(intento));
  return ESPERAS_DEL_MOTOR_S[Math.min(i, ESPERAS_DEL_MOTOR_S.length - 1)];
}

export function textoDeEspera(segundos: number, probando: boolean): string {
  if (probando) return "Reintentando";
  return `Reintenta en ${Math.max(1, Math.ceil(segundos))} s`;
}

/** El nombre de la sección abierta, para la cabecera; la entrada del módulo es Estado del estudio. */
export function seccionSinMotor(pathname: string): string {
  const seccion = seccionesDeProcesamiento(null).find(
    (s) => pathname === s.to || pathname.startsWith(`${s.to}/`),
  );
  return seccion?.label ?? "Estado del estudio";
}
