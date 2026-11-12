// Lectura de Analítica › Datos: las variables de la base (`/api/analitica/data-review`)
// y la estructura de secciones del formulario (P-M11). Salió de
// `panes/DataReviewPane.tsx` sin cambiar su comportamiento:
//
// - la lectura de la estructura se ESCRIBE en la config solo si la pidió el
//   usuario o si ya hay secciones declaradas que actualizar (cambio de fuente);
//   la automática de una config sin secciones queda como vista de lo detectado;
// - hay una sola lectura automática por montaje, y solo con la config hidratada;
// - una decisión del usuario sobre una sección necesita secciones declaradas:
//   `materializarSecciones` escribe primero lo detectado.

import { useEffect, useRef, useState } from "react";

import { apiAnaliticaDataReview, apiAnaliticaDetectSecciones, type DataReviewVariable } from "../../../api/analitica";
import {
  PLAZO_DETECCION_MS,
  conPlazo,
  fundirSeccionesDetectadas,
  seccionesAMaterializar,
} from "../estructuraDeSecciones";
import { useAnaliticaStore, type SeccionConfig } from "../store";

export type LecturaDeEstructura =
  | { estado: "inactiva" }
  | { estado: "leyendo"; silenciosa: boolean }
  | { estado: "error"; silenciosa: boolean; mensaje: string };

export type RevisionDeDatos = {
  variables: DataReviewVariable[];
  cargando: boolean;
  error: string;
  deteccion: LecturaDeEstructura;
  seccionesDetectadas: SeccionConfig[] | null;
  recargar: () => void;
  detectarSecciones: () => void;
  materializarSecciones: () => void;
};

export function useRevisionDeDatos(): RevisionDeDatos {
  const [lectura, setLectura] = useState<{ variables: DataReviewVariable[]; cargando: boolean; error: string }>({
    variables: [],
    cargando: true,
    error: "",
  });
  const [deteccion, setDeteccion] = useState<LecturaDeEstructura>({ estado: "inactiva" });
  const [seccionesDetectadas, setSeccionesDetectadas] = useState<SeccionConfig[] | null>(null);
  const intentoAutomatico = useRef(false);
  const lecturaVigente = useRef(0);
  const hidratada = useAnaliticaStore((s) => s.hydrated);
  const nSecciones = useAnaliticaStore((s) => s.config.secciones.length);
  const setSecciones = useAnaliticaStore((s) => s.setSecciones);

  async function cargar() {
    setLectura((previa) => ({ ...previa, cargando: true, error: "" }));
    try {
      const r = await apiAnaliticaDataReview();
      setLectura({ variables: r.variables, cargando: false, error: "" });
    } catch (e) {
      setLectura((previa) => ({ ...previa, cargando: false, error: (e as Error).message }));
    }
  }

  async function detectar(silenciosa: boolean) {
    const vigente = ++lecturaVigente.current;
    setDeteccion({ estado: "leyendo", silenciosa });
    try {
      const r = await conPlazo(
        apiAnaliticaDetectSecciones(),
        PLAZO_DETECCION_MS,
        `La lectura de las secciones no respondió en ${Math.round(PLAZO_DETECCION_MS / 1000)} s. Vuelve a intentarlo con "Detectar secciones".`,
      );
      if (vigente !== lecturaVigente.current) return;
      const declaradas = useAnaliticaStore.getState().config.secciones;
      const fundidas = fundirSeccionesDetectadas(r.secciones, declaradas);
      if (!silenciosa || declaradas.length > 0) setSecciones(fundidas);
      else setSeccionesDetectadas(fundidas);
      setDeteccion({ estado: "inactiva" });
    } catch (e) {
      if (vigente !== lecturaVigente.current) return;
      setDeteccion({ estado: "error", silenciosa, mensaje: (e as Error).message });
    }
  }

  useEffect(() => {
    void cargar();
    function alCambiarLaFuente() {
      intentoAutomatico.current = false;
      setSeccionesDetectadas(null);
      void cargar();
      void detectar(true);
    }
    window.addEventListener("pulso:analitica-source-changed", alCambiarLaFuente);
    return () => window.removeEventListener("pulso:analitica-source-changed", alCambiarLaFuente);
    // Una sola suscripción por montaje: `cargar` y `detectar` leen el store al correr.
  }, []);

  useEffect(() => {
    if (!hidratada || lectura.cargando || intentoAutomatico.current) return;
    if (lectura.variables.length === 0 || nSecciones > 0) return;
    intentoAutomatico.current = true;
    void detectar(true);
  }, [hidratada, lectura.cargando, lectura.variables.length, nSecciones]);

  return {
    variables: lectura.variables,
    cargando: lectura.cargando,
    error: lectura.error,
    deteccion,
    seccionesDetectadas,
    recargar: () => void cargar(),
    detectarSecciones: () => void detectar(false),
    materializarSecciones: () => {
      const aEscribir = seccionesAMaterializar(useAnaliticaStore.getState().config.secciones, seccionesDetectadas);
      if (aEscribir) setSecciones(aEscribir);
    },
  };
}
