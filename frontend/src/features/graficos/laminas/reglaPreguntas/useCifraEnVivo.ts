// La cifra de la regla mientras se arrastra: el borrador mueve el corte y el conteo local en cada cuadro, y se confirma
// al soltar (o tras una espera, para el teclado y la escritura). El borrador cae cuando el valor guardado lo alcanza, o
// cuando cambia el tipo de regla. Un cambio pendiente se confirma también al desmontar: soltar fuera de la tarjeta no
// pierde el valor.

import { useCallback, useEffect, useRef, useState } from "react";

export const ESPERA_CIFRA_MS = 400;

export type CifraEnVivo = {
  /** Lo que se muestra: el borrador o, sin él, lo guardado. */
  valor: number;
  /** Hay un borrador sin confirmar o sin respuesta del plan. */
  enVivo: boolean;
  mover: (v: number) => void;
  soltar: () => void;
};

export function useCifraEnVivo(guardado: number, clave: string, onConfirmar: (v: number) => void): CifraEnVivo {
  const [borrador, setBorrador] = useState<number | null>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendiente = useRef<number | null>(null);
  const confirmar = useRef(onConfirmar);
  confirmar.current = onConfirmar;

  const limpiar = () => {
    if (espera.current !== null) clearTimeout(espera.current);
    espera.current = null;
  };
  const enviar = useCallback(() => {
    limpiar();
    const v = pendiente.current;
    pendiente.current = null;
    if (v !== null) confirmar.current(v);
  }, []);

  useEffect(() => { setBorrador((b) => (b === guardado ? null : b)); }, [guardado]);
  useEffect(() => { limpiar(); pendiente.current = null; setBorrador(null); }, [clave]);
  useEffect(() => () => enviar(), [enviar]);

  const mover = useCallback((v: number) => {
    setBorrador(v);
    pendiente.current = v === guardado ? null : v;
    limpiar();
    if (pendiente.current !== null) espera.current = setTimeout(enviar, ESPERA_CIFRA_MS);
  }, [guardado, enviar]);

  return { valor: borrador ?? guardado, enVivo: borrador !== null, mover, soltar: enviar };
}
