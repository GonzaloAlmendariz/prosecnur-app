/**
 * Estado y acciones de la pestaña Cierre: lee `GET /limpieza` (con su campo
 * `cierre`, motor M5) y `GET /auditoria/estado`; cierra la base
 * (`useCierreLimpieza`, POST `/limpieza/finalize`), la reabre (POST
 * `/limpieza/revertir-promocion`) y genera el paquete metodológico
 * (`useEntregasInstrumento`). Cada acción que termina vuelve a leer el cierre,
 * que es quien dice el estado de cada archivo.
 *
 * Reemplaza, solo en Cierre, a `limpieza/useMesaDeLimpieza`: esa mesa además
 * elegía un hallazgo y leía sus casos, que en Cierre no se ven.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiV2Limpieza, apiV2LimpiezaRevertirPromocion } from "../../../api/validacion";
import { apiAuditoriaEstado, normalizarCifrasHallazgos, type AuditoriaEstado } from "../../../api/validacionAuditoria";
import { normalizarCierre, type CierreDeLimpieza } from "../../../api/validacionCierre";
import { errorLegible } from "../../../components/entregables/generacionModelo";
import { useCierreLimpieza } from "../entregas/useCierreLimpieza";
import { useEntregasInstrumento } from "../entregas/useEntregasInstrumento";
import { useValidacionStore } from "../store";
import type { LimpiezaSummary } from "../types";

export type LecturaDelCierre =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; data: LimpiezaSummary; cierre: CierreDeLimpieza | null };

export type AvisoDelCierre = { tono: "info" | "error"; texto: string } | null;

export function useCierre() {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const [lectura, setLectura] = useState<LecturaDelCierre>({ fase: "cargando" });
  const [auditoria, setAuditoria] = useState<AuditoriaEstado | null>(null);
  const [releyendo, setReleyendo] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);
  const [aviso, setAviso] = useState<AvisoDelCierre>(null);
  const turno = useRef(0);
  const cierreLimpieza = useCierreLimpieza(baseNombre);
  const entregas = useEntregasInstrumento(baseNombre);

  const leer = useCallback(async (opciones?: { quieta?: boolean }) => {
    const mio = ++turno.current;
    if (opciones?.quieta) setReleyendo(true);
    else setLectura({ fase: "cargando" });
    try {
      const data = await apiV2Limpieza(baseNombre);
      if (mio !== turno.current) return;
      setLectura({ fase: "lista", data, cierre: normalizarCierre(data.cierre) });
    } catch (e) {
      if (mio !== turno.current) return;
      setLectura({ fase: "error", mensaje: (e as Error).message });
    } finally {
      if (mio === turno.current) setReleyendo(false);
    }
    // El estado de la auditoría solo pone la fecha y "al día": si falla, la pestaña sigue sin él.
    try {
      const estado = await apiAuditoriaEstado(baseNombre);
      if (mio === turno.current) setAuditoria(estado);
    } catch {
      if (mio === turno.current) setAuditoria(null);
    }
  }, [baseNombre]);

  useEffect(() => {
    setAviso(null);
    void leer();
  }, [leer, version]);

  const cerrarLaBase = useCallback(async () => {
    setAviso(null);
    if (await cierreLimpieza.finalizar()) {
      setAviso({ tono: "info", texto: "La base quedó cerrada." });
      await leer({ quieta: true });
    }
  }, [cierreLimpieza, leer]);

  const reabrirLaBase = useCallback(async () => {
    setReabriendo(true);
    setAviso(null);
    try {
      await apiV2LimpiezaRevertirPromocion(baseNombre);
      setAviso({ tono: "info", texto: "La base del estudio volvió a la base cargada." });
      await leer({ quieta: true });
    } catch (e) {
      setAviso({ tono: "error", texto: errorLegible(e).causa });
    } finally {
      setReabriendo(false);
    }
  }, [baseNombre, leer]);

  const generarPaquete = useCallback(async () => {
    const r = await entregas.generarPaquete();
    if (r.ok) await leer({ quieta: true });
  }, [entregas, leer]);

  const casosAuditados = useMemo(
    () => (lectura.fase === "lista" ? normalizarCifrasHallazgos(lectura.data.cifras_hallazgos)?.n_casos_evaluados ?? null : null),
    [lectura],
  );

  return {
    baseNombre,
    lectura,
    auditoria,
    casosAuditados,
    releyendo,
    recargar: () => void leer(),
    aviso,
    cerrando: cierreLimpieza.cerrando,
    /** El fallo del último cierre, con su causa (o la fase "inactiva"). */
    estadoDelCierre: cierreLimpieza.estado,
    cerrarLaBase,
    reabriendo,
    reabrirLaBase,
    paquete: entregas.paquete,
    generarPaquete,
  };
}

export type Cierre = ReturnType<typeof useCierre>;
