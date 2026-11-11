// "Actualizar antes de cada envío programado": mientras la app está abierta
// con un proyecto, cada dos minutos se le pregunta al backend
// (`POST .../antes-de-envio`) si falta poco para la próxima campaña programada
// en Mailchimp. El backend decide y, si toca, lanza "Quién respondió" en todas
// las campañas una sola vez por hora de envío; aquí sólo se sigue ese job para
// que sus marcas queden guardadas. La app no programa ni envía nada.
//
// Con la opción apagada hay un solo latido al abrir el proyecto (para saber si
// está encendida); después, nada hasta que alguien la encienda.

import { useCallback, useEffect, useRef } from "react";

import { apiAntesDeEnvio } from "../../../api/mailSeguimiento";
import { mensajeDeError } from "../correos/mailchimpPorApiModel";
import { esperarTrabajo } from "../correos/mailchimpTrabajo";
import { useSeguimientoStore } from "./store";

export const LATIDO_MS = 2 * 60_000;
/** Un latido reciente no se repite al encender la opción (evita dos seguidos al abrir). */
const LATIDO_RECIENTE_MS = 30_000;

export function useAntesDeCadaEnvio({ habilitado, sesion }: { habilitado: boolean; sesion: string }) {
  const activo = useSeguimientoStore((s) => s.fondo.activo);
  const enCurso = useRef(false);
  const ultimo = useRef(0);

  const latir = useCallback(async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    ultimo.current = Date.now();
    const { setFondo } = useSeguimientoStore.getState();
    try {
      const latido = await apiAntesDeEnvio();
      setFondo({ activo: latido.activo, ultimo: latido, error: "" });
      if (latido.lanzado && latido.job_id) {
        setFondo({ corriendo: true });
        try {
          await esperarTrabajo(latido.job_id, () => undefined);
        } catch (e) {
          setFondo({ error: mensajeDeError(e, "La actualización automática no terminó.") });
        } finally {
          setFondo({ corriendo: false });
          const st = useSeguimientoStore.getState();
          if (st.estado) void st.cargar({ silencioso: true });
        }
      }
    } catch (e) {
      setFondo({ error: mensajeDeError(e, "No se pudo consultar la próxima campaña programada.") });
    } finally {
      enCurso.current = false;
    }
  }, []);

  // Al abrir el proyecto (o cambiar de sesión): ¿la opción está encendida?
  useEffect(() => {
    if (!habilitado || !sesion) return;
    ultimo.current = 0;
    void latir();
  }, [habilitado, latir, sesion]);

  // Encendida: un latido ahora (si no hubo uno reciente) y cada dos minutos.
  useEffect(() => {
    if (!habilitado || !sesion || activo !== true) return undefined;
    if (Date.now() - ultimo.current > LATIDO_RECIENTE_MS) void latir();
    const id = window.setInterval(() => { void latir(); }, LATIDO_MS);
    return () => window.clearInterval(id);
  }, [activo, habilitado, latir, sesion]);
}
