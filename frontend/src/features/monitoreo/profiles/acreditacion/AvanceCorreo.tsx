import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  getMonitoreoMailchimpAudiencias,
  getMonitoreoMailchimpEstado,
  postMonitoreoMailchimpConfig,
  postMonitoreoMailchimpSync,
} from "../../../../api/monitoreoMailchimp";
import { esperarResultadoImport } from "../../../carga/importEnSegundoPlano";
import { AvanceCorreoVista } from "./AvanceCorreoVista";
import { cifra, ESTADO_CORREO_INICIAL, reducirCorreo } from "./avanceCorreoModelo";

// Monitoreo › Acreditación › Avance › Correo (checklist T3, 2026-10-22).
//
// Muestra los reportes de Mailchimp del estudio cruzados con el universo de
// Monitoreo: por público, por envío y los correos inválidos. Todo lo calcula
// el backend (`/api/monitoreo/mailchimp/*`); esta vista lee, elige la
// audiencia y lanza la lectura como job. El panel es el dueño del scroll.

function mensajeDeError(e: unknown, respaldo: string) {
  return e instanceof Error && e.message ? e.message : respaldo;
}

export function AvanceCorreo() {
  const [s, despachar] = useReducer(reducirCorreo, ESTADO_CORREO_INICIAL);
  const [elegida, setElegida] = useState("");
  const [cambiando, setCambiando] = useState(false);
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
      }
    } catch (e) {
      if (vivo.current) despachar({ tipo: "fallo", error: mensajeDeError(e, "No se pudo leer Mailchimp. Reintenta.") });
    }
  };

  return (
    <AvanceCorreoVista
      s={s}
      elegida={elegida}
      cambiando={cambiando}
      onElegir={setElegida}
      onGuardarAudiencia={() => { void guardarAudiencia(); }}
      onCambiar={() => { setElegida(s.estado?.list_id ?? ""); setCambiando(true); }}
      onCancelarCambio={() => { setCambiando(false); setElegida(""); }}
      onActualizar={() => { void actualizar(); }}
      onReintentar={() => { void cargar(); }}
    />
  );
}

export default AvanceCorreo;
