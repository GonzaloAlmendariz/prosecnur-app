// Una operación de Seguimiento (guardar, sortear, un job de Mailchimp): si
// corre, su avance, su error y su resultado, en un solo estado. Evita el racimo
// de `useState` por botón que tienen las tarjetas de Envíos.

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../../../api/core";
import { mensajeDeError } from "../correos/mailchimpPorApiModel";
import type { AvanceDeTrabajo } from "../correos/mailchimpTrabajo";

export type EstadoDeOperacion<T> = {
  corriendo: boolean;
  /** Avance de un job; `null` mientras no publica nada. */
  avance: AvanceDeTrabajo | null;
  error: string;
  /** Código `E_*` del error, para decidir qué ofrecer (p. ej. confirmar volver a sortear). */
  codigo: string;
  resultado: T | null;
};

export type Operacion<T> = EstadoDeOperacion<T> & {
  /** Corre `fn`; devuelve su resultado o `null` si falló (el error queda en `error`). */
  correr: (fn: (onAvance: (a: AvanceDeTrabajo) => void) => Promise<T>, porDefecto: string) => Promise<T | null>;
  limpiar: () => void;
};

const QUIETA = { corriendo: false, avance: null, error: "", codigo: "", resultado: null };

export function useOperacion<T>(): Operacion<T> {
  const [estado, setEstado] = useState<EstadoDeOperacion<T>>(QUIETA);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const correr = useCallback(async (fn: (onAvance: (a: AvanceDeTrabajo) => void) => Promise<T>, porDefecto: string) => {
    setEstado({ ...QUIETA, corriendo: true });
    try {
      const r = await fn((avance) => { if (vivo.current) setEstado((s) => ({ ...s, avance })); });
      if (vivo.current) setEstado({ ...QUIETA, resultado: r });
      return r;
    } catch (e) {
      if (vivo.current) setEstado({ ...QUIETA, error: mensajeDeError(e, porDefecto), codigo: e instanceof ApiError ? e.code : "" });
      return null;
    }
  }, []);

  const limpiar = useCallback(() => setEstado(QUIETA), []);

  return { ...estado, correr, limpiar };
}
