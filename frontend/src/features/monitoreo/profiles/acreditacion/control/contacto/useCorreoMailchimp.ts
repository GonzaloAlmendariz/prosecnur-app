import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  getMonitoreoMailchimpAudiencias,
  getMonitoreoMailchimpEstado,
  postMonitoreoMailchimpConfig,
  postMonitoreoMailchimpSync,
} from "../../../../../../api/monitoreoMailchimp";
import { esperarResultadoImport } from "../../../../../carga/importEnSegundoPlano";
import type { AvanceCorreoVistaProps } from "../../AvanceCorreoVista";
import { cifra, ESTADO_CORREO_INICIAL, reducirCorreo } from "../../avanceCorreoModelo";

// Lectura de Mailchimp del estudio cruzada con el universo de Monitoreo:
// estado, audiencias, elegir audiencia y lanzar la lectura como job. Salió de
// `AvanceCorreo` sin cambiar lógica para que Control › Correo la comparta.

function mensajeDeError(e: unknown, respaldo: string) {
  return e instanceof Error && e.message ? e.message : respaldo;
}

export function useCorreoMailchimp(): AvanceCorreoVistaProps {
  const [s, despachar] = useReducer(reducirCorreo, ESTADO_CORREO_INICIAL);
  const [elegida, setElegida] = useState("");
  const [cambiando, setCambiando] = useState(false);
  // Reloj de «Leído hace N min»: avanza cada minuto sin volver a leer nada.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const vivo = useRef(true);
  // StrictMode desmonta y vuelve a montar: la marca se rearma en cada montaje.
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargarAudiencias = useCallback(async () => {
    try {
      const r = await getMonitoreoMailchimpAudiencias();
      if (!vivo.current) return;
      despachar({ tipo: "audiencias", audiencias: r.audiencias });
      // Con una sola audiencia en la cuenta no hay nada que elegir: queda
      // preseleccionada y basta confirmarla.
      if (r.audiencias.length === 1) setElegida((actual) => actual || r.audiencias[0].id);
    } catch {
      // El selector queda vacío y el estado ya dice si falta la conexión; un
      // fallo aquí no tapa los reportes ya leídos.
    }
  }, []);

  const cargar = useCallback(async () => {
    despachar({ tipo: "cargar" });
    try {
      const estado = await getMonitoreoMailchimpEstado();
      if (!vivo.current) return;
      despachar({ tipo: "cargado", estado });
      if (estado.conectado) void cargarAudiencias();
    } catch (e) {
      if (vivo.current) despachar({ tipo: "fallo", error: mensajeDeError(e, "No se pudo leer el estado de Mailchimp.") });
    }
  }, [cargarAudiencias]);

  useEffect(() => { void cargar(); }, [cargar]);

  // Mientras Monitoreo prepara el cruce, la vista vuelve a pedir sola.
  const preparando = s.estado?.preparando === true;
  useEffect(() => {
    if (!preparando) return undefined;
    const t = window.setTimeout(() => { void cargar(); }, 15000);
    return () => window.clearTimeout(t);
  }, [preparando, cargar, s.estado]);

  const guardarAudiencia = async () => {
    if (!elegida) return;
    despachar({ tipo: "guardar-audiencia" });
    try {
      const estado = await postMonitoreoMailchimpConfig({ list_id: elegida });
      if (!vivo.current) return;
      despachar({ tipo: "cargado", estado });
      setCambiando(false);
    } catch (e) {
      if (vivo.current) despachar({ tipo: "fallo", error: mensajeDeError(e, "No se pudo guardar la audiencia.") });
    }
  };

  const actualizar = async () => {
    despachar({ tipo: "lectura-inicio" });
    try {
      const { job_id } = await postMonitoreoMailchimpSync();
      await esperarResultadoImport<{ ok: boolean }>(job_id, {
        onProgress: (p) => { if (vivo.current) despachar({ tipo: "lectura-avance", avance: { percent: p.percent, message: p.message } }); },
      });
      const estado = await getMonitoreoMailchimpEstado();
      if (vivo.current) {
        despachar({ tipo: "lectura-fin", estado, aviso: `Lectura terminada: ${cifra(estado.envios.length)} envíos.` });
        setAhora(Date.now());
      }
    } catch (e) {
      if (vivo.current) despachar({ tipo: "fallo", error: mensajeDeError(e, "No se pudo leer Mailchimp. Reintenta.") });
    }
  };

  return {
    s,
    elegida,
    cambiando,
    ahora,
    onElegir: setElegida,
    onGuardarAudiencia: () => { void guardarAudiencia(); },
    onCambiar: () => { setElegida(s.estado?.list_id ?? ""); setCambiando(true); },
    onCancelarCambio: () => { setCambiando(false); setElegida(""); },
    onActualizar: () => { void actualizar(); },
    onReintentar: () => { void cargar(); },
    onPublico: (publico) => despachar({ tipo: "publico", publico }),
  };
}
