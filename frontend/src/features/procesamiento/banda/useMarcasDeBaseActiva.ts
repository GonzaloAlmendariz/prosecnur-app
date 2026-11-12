// Lee el estado por fase de la base activa para la banda (`marcasDeBaseActiva`).
// Vive en el shell, que no se remonta al cambiar de sección: se relee al cambiar
// de base, de sesión o de sección, igual que la cifra de casos que cuentan.

import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { apiEstudioGet } from "../../../api/estudio";
import { useSession } from "../../../lib/SessionContext";
import { marcasDeBaseActiva, type MarcasDeBaseActiva } from "./fasesDeBaseActivaModel";

export function useMarcasDeBaseActiva(habilitado: boolean): MarcasDeBaseActiva | null {
  const { state } = useSession();
  const { pathname } = useLocation();
  const [marcas, setMarcas] = useState<MarcasDeBaseActiva | null>(null);
  const [version, setVersion] = useState(0);
  const turno = useRef(0);
  const conEstudio = Boolean(state?.has_estudio);
  const baseActiva = state?.active_base ?? null;

  useEffect(() => {
    const releer = () => setVersion((v) => v + 1);
    window.addEventListener("pulso:active-base-changed", releer);
    window.addEventListener("pulso:session-changed", releer);
    return () => {
      window.removeEventListener("pulso:active-base-changed", releer);
      window.removeEventListener("pulso:session-changed", releer);
    };
  }, []);

  useEffect(() => {
    const mio = ++turno.current;
    if (!habilitado || !conEstudio) {
      setMarcas(null);
      return;
    }
    void (async () => {
      try {
        const estudio = await apiEstudioGet();
        if (mio === turno.current) setMarcas(marcasDeBaseActiva(estudio));
      } catch {
        // Sin estudio legible la banda no marca ninguna sección.
        if (mio === turno.current) setMarcas(null);
      }
    })();
  }, [habilitado, conEstudio, baseActiva, pathname, version]);

  return marcas;
}
