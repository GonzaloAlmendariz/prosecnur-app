import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  apiMaterialCampanaCrear,
  apiMaterialCampanaMeta,
  apiMaterialCampanas,
  avisoDelRegistro,
  hayQueReleerElRegistro,
  type CampanaMaterial,
  type RegistroDeCampanas,
} from "../../../api/materialCampanas";
import { apiRecopiladoresState, type CollectionStatePayload } from "../../../api/recopiladores";
import { useCorreosStore } from "../correos/store";
import { registroDerivado } from "./derivacionTemporal";
import { conCorreosVivos, conExportacion, ponerEnRegistro } from "./modeloRegistro";

export type FuenteDelRegistro = "registro" | "derivada";

export type ResultadoDelRegistro =
  | { ok: true; campana: CampanaMaterial }
  | { ok: false; mensaje: string };

/**
 * El registro de campañas del proyecto (ADR 0111).
 *
 * La fuente es `GET /api/recopiladores/campaigns`. Si el backend responde 404 de
 * RUTA —una versión anterior al registro— se deriva en el cliente con
 * `derivacionTemporal.ts`, y lo dice `fuente: "derivada"`.
 *
 * Las campañas de correo se proyectan de `mail_campaigns`, que también lee el
 * store del correo: la lista viva de ese store manda sobre la existencia de un
 * correo (`conCorreosVivos`), así crear, duplicar o borrar un correo se ve en
 * el acto aunque el registro todavía no se haya vuelto a leer.
 */
export function useRegistroDeCampanas() {
  const [delBackend, setDelBackend] = useState<RegistroDeCampanas | null>(null);
  const [estadoDerivado, setEstadoDerivado] = useState<CollectionStatePayload | null>(null);
  const [fuente, setFuente] = useState<FuenteDelRegistro | null>(null);
  const [carga, setCarga] = useState<"cargando" | "lista" | "error">("cargando");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const vivo = useRef(true);
  const turno = useRef(0);
  const correos = useCorreosStore((s) => s.campanas);
  const correosCarga = useCorreosStore((s) => s.campanasCarga);
  const revisionDeCorreos = useCorreosStore((s) => s.stateRevision);

  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  /** Lee el registro; `silenciosa` no vuelve a «cargando» (la vista no se desmonta). */
  const recargar = useCallback(async (silenciosa = true) => {
    const pedido = ++turno.current;
    if (!silenciosa) setCarga("cargando");
    try {
      const registro = await apiMaterialCampanas();
      if (!vivo.current || pedido !== turno.current) return;
      if (registro) {
        setDelBackend(registro);
        setFuente("registro");
      } else {
        // Respaldo: backend sin registro. El estado dice si hay plan de aulas.
        const estado = await apiRecopiladoresState();
        if (!vivo.current || pedido !== turno.current) return;
        setEstadoDerivado(estado);
        setFuente("derivada");
      }
      setError("");
      setCarga("lista");
    } catch (causa) {
      if (!vivo.current || pedido !== turno.current) return;
      setError(avisoDelRegistro(causa, "No se pudo leer la lista de campañas."));
      setCarga("error");
    }
  }, []);

  useEffect(() => {
    void recargar(false);
    const alCambiarDeSesion = () => {
      setDelBackend(null);
      setEstadoDerivado(null);
      void recargar(false);
    };
    window.addEventListener("pulso:session-changed", alCambiarDeSesion);
    return () => window.removeEventListener("pulso:session-changed", alCambiarDeSesion);
  }, [recargar]);

  const correosListos = correosCarga === "lista" || correosCarga === "error";
  const registro = useMemo((): RegistroDeCampanas | null => {
    if (carga === "cargando" && !delBackend && !estadoDerivado) return null;
    if (fuente === "registro" && delBackend) {
      return correosCarga === "lista" ? conCorreosVivos(delBackend, correos) : delBackend;
    }
    if (fuente === "derivada" && correosListos) {
      return registroDerivado({ estado: estadoDerivado, correos, revisionDeCorreos });
    }
    return null;
  }, [carga, correos, correosCarga, correosListos, delBackend, estadoDerivado, fuente, revisionDeCorreos]);

  const poner = useCallback((campana: CampanaMaterial, registryRevision: number | null) => {
    setDelBackend((previo) => (previo ? ponerEnRegistro(previo, campana, registryRevision) : previo));
  }, []);

  /** Una exportación registrada (`export_recorded`) sube el avance de la tarjeta sin releer todo. */
  const marcarExportacion = useCallback((campanaId: string, envio: Parameters<typeof conExportacion>[2]) => {
    setDelBackend((previo) => (previo ? conExportacion(previo, campanaId, envio) : previo));
  }, []);

  const fallo = useCallback((causa: unknown, porDefecto: string): ResultadoDelRegistro => {
    if (hayQueReleerElRegistro(causa)) void recargar();
    return { ok: false, mensaje: avisoDelRegistro(causa, porDefecto) };
  }, [recargar]);

  /** Crea la campaña de aulas (una por proyecto). Sin registro en el backend no hay nada que escribir. */
  const crearAulas = useCallback(async (name: string): Promise<ResultadoDelRegistro> => {
    setOcupado(true);
    try {
      const out = await apiMaterialCampanaCrear({
        tipo: "aulas",
        name: name.trim(),
        expected_registry_revision: delBackend?.registry_revision ?? null,
      });
      if (!out) return { ok: false, mensaje: "Esta versión del backend no registra campañas: abre la de aulas desde la lista." };
      poner(out.campaign, out.registry_revision);
      return { ok: true, campana: out.campaign };
    } catch (causa) {
      return fallo(causa, "No se pudo crear la campaña de aulas.");
    } finally {
      if (vivo.current) setOcupado(false);
    }
  }, [delBackend?.registry_revision, fallo, poner]);

  /** Renombra, archiva o reabre la campaña de aulas (las de correo se renombran por su engine). */
  const cambiarAulas = useCallback(async (id: string, cambio: { name?: string; archived?: boolean }): Promise<ResultadoDelRegistro> => {
    setOcupado(true);
    try {
      const out = await apiMaterialCampanaMeta({
        id,
        ...(cambio.name !== undefined ? { name: cambio.name.trim() } : {}),
        ...(cambio.archived !== undefined ? { archived: cambio.archived } : {}),
        expected_registry_revision: delBackend?.registry_revision ?? null,
      });
      if (!out) return { ok: false, mensaje: "Esta versión del backend no registra campañas: no se puede archivar ni renombrar." };
      poner(out.campaign, out.registry_revision);
      return { ok: true, campana: out.campaign };
    } catch (causa) {
      return fallo(causa, "No se pudo guardar el cambio de la campaña.");
    } finally {
      if (vivo.current) setOcupado(false);
    }
  }, [delBackend?.registry_revision, fallo, poner]);

  return { registro, carga, error, fuente, ocupado, recargar, crearAulas, cambiarAulas, marcarExportacion };
}

export type RegistroVivo = ReturnType<typeof useRegistroDeCampanas>;
