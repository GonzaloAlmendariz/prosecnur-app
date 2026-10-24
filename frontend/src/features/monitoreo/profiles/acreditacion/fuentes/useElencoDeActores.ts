import { useEffect, useMemo, useState } from "react";
import type { MonitoreoActorUnit, MonitoreoSource, MonitoreoState } from "../../../../../api/client";
import { apiMonitoreoActorRename, apiMonitoreoActores } from "../../../../../api/monitoreo";
import { claveDeActor, cuentasPorActor, elencoVisible } from "../../../fuentes/rosterDeActores";

/**
 * Borrador y guardado del elenco de actores (públicos) del estudio. Salió de
 * `ActoresDelEstudio` sin cambiar lógica para que Insumos › Públicos (A6) edite
 * con los mismos llamados: renombrar arrastra las fuentes del actor y después
 * se guarda el elenco entero.
 */

export type Borrador = {
  /** Identidad estable de la fila mientras se edita, no el nombre. */
  key: string;
  actor: string;
  /** El nombre con el que este actor está guardado hoy, "" si es nuevo. */
  guardadoComo: string;
  phone: boolean;
};

export function borradorDesde(unit: MonitoreoActorUnit): Borrador {
  return {
    key: unit.id || claveDeActor(unit.actor),
    actor: unit.actor,
    guardadoComo: unit.actor,
    phone: Boolean(unit.phone?.enabled),
  };
}

export function useElencoDeActores({
  sources,
  unidades,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  unidades?: MonitoreoActorUnit[];
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const elenco = useMemo(() => elencoVisible(unidades, sources), [unidades, sources]);
  const cuentas = useMemo(() => cuentasPorActor(sources), [sources]);

  const [borradores, setBorradores] = useState<Borrador[]>(() => elenco.map(borradorDesde));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // El elenco del servidor manda mientras no haya edición en curso. Sin esta
  // sincronización, conectar una fuente nueva en otra pestaña dejaba aquí una
  // lista vieja que al guardar habría borrado al actor recién aparecido.
  const firmaServidor = elenco.map((unit) => `${unit.actor}:${unit.phone?.enabled}`).join("|");
  useEffect(() => {
    setBorradores(elenco.map(borradorDesde));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaServidor]);

  const sucio = useMemo(() => {
    if (borradores.length !== elenco.length) return true;
    return borradores.some((fila, i) => (
      fila.actor.trim() !== elenco[i].actor || fila.phone !== Boolean(elenco[i].phone?.enabled)
    ));
  }, [borradores, elenco]);

  const duplicados = useMemo(() => {
    const vistos = new Set<string>();
    const repetidos = new Set<string>();
    for (const fila of borradores) {
      const clave = claveDeActor(fila.actor);
      if (!clave) continue;
      if (vistos.has(clave)) repetidos.add(fila.key);
      vistos.add(clave);
    }
    return repetidos;
  }, [borradores]);

  const vacios = borradores.filter((fila) => !claveDeActor(fila.actor)).length;
  const puedeGuardar = sucio && !guardando && duplicados.size === 0 && vacios === 0;

  function editar(key: string, cambios: Partial<Borrador>) {
    setBorradores((actual) => actual.map((fila) => (fila.key === key ? { ...fila, ...cambios } : fila)));
  }

  function agregar(nombre = "") {
    const key = `nuevo-${borradores.length}-${nombre || "actor"}`;
    setBorradores((actual) => [...actual, { key, actor: nombre, guardadoComo: "", phone: false }]);
  }

  function quitar(key: string) {
    setBorradores((actual) => actual.filter((fila) => fila.key !== key));
  }

  /**
   * Guardar es dos operaciones, y el orden importa.
   *
   * Los renombrados van primero y uno por uno, porque cada uno tiene que
   * arrastrar las fuentes del actor. Si se guardara el elenco de golpe, el
   * nombre nuevo entraría como un actor más y el viejo seguiría vivo en sus
   * fuentes: exactamente la partición que este bloque viene a impedir.
   */
  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      let ultimoEstado: MonitoreoState | null = null;
      for (const fila of borradores) {
        const nombre = fila.actor.trim();
        if (!fila.guardadoComo || !nombre) continue;
        if (claveDeActor(nombre) === claveDeActor(fila.guardadoComo)) continue;
        const result = await apiMonitoreoActorRename(fila.guardadoComo, nombre);
        ultimoEstado = result.state;
      }
      const result = await apiMonitoreoActores(borradores
        .filter((fila) => claveDeActor(fila.actor))
        .map((fila) => ({
          actor: fila.actor.trim(),
          label: fila.actor.trim(),
          phone: { enabled: fila.phone, role: fila.phone ? "target" : "none" },
        })));
      ultimoEstado = result.state;
      if (ultimoEstado) onStateChange?.(ultimoEstado);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return { elenco, borradores, guardando, error, sucio, duplicados, vacios, puedeGuardar, cuentas, editar, agregar, quitar, guardar };
}
