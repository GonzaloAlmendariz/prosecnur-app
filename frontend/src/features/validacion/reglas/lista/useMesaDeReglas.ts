/**
 * Lo que la mesa de Reglas lee y guarda (plan de fidelidad, rebanada V1).
 *
 * Lee de una vez el catálogo de reglas (M3), las reglas propias (para
 * editarlas en su panel), las sugeridas, la cola de Hallazgos (para la franja),
 * las preguntas fuera de la auditoría y el inventario de la base (las preguntas
 * del panel de regla). Después de guardar algo vuelve a leer todo: lo que se ve
 * es lo que el motor tiene, sin cambios optimistas que reconciliar.
 *
 * Lo que se guarda es lo mismo que guardaban las vistas anteriores
 * (`tabs/ReglasCustomTab.tsx`, `instrumento/useInstrumento.ts`), con los mismos
 * clientes y los mismos cuerpos. Lo nuevo es activar o desactivar una regla
 * del formulario desde la lista, por la ruta que ya existía (`PATCH
 * .../instrumento/regla/<id>/activa`), y "Auditar", que lanza la auditoría
 * completa (`POST /auditoria`) en lugar de solo las reglas propias.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiV2InstrumentoReglaToggleActiva,
  apiV2InstrumentoVariablesExcluidas,
  apiV2InstrumentoVariablesExcluidasSave,
  apiV2Limpieza,
  apiV2ReglasCustomCreate,
  apiV2ReglasCustomDelete,
  apiV2ReglasCustomList,
  apiV2ReglasCustomSemillas,
  apiV2ReglasCustomUpdate,
} from "../../../../api/client";
import { apiAuditar, normalizarCifrasHallazgos } from "../../../../api/validacionAuditoria";
import { pedirCatalogoCompleto, type CatalogoDeReglas } from "../../../../api/validacionCatalogo";
import { useJob } from "../../../../hooks/useJob";
import { pedirInventario } from "../../inventarioDeBase";
import { useValidacionStore } from "../../store";
import type {
  ExploradorVariablesList,
  InstrumentoVariablesExcluidas,
  LimpiezaSummary,
  ReglaCustom,
  ReglaSemilla,
} from "../../types";
import { comoCuerpoDelCliente } from "../tiposDelMotor";
import type { ReglaPropiaAGuardar } from "../tiposDelMotor";

import type { CatalogoCompleto, ReglaDelCatalogo } from "./modeloCatalogo";

export type LecturaDeReglas =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | {
      fase: "lista";
      catalogo: CatalogoCompleto;
      /** La lectura del catálogo que usa el panel de regla. */
      catalogoDelPanel: CatalogoDeReglas;
    };

/**
 * Lo que acompaña al catálogo y llega por su cuenta: `undefined` mientras no
 * llega, `null` si falló. Ninguna de estas lecturas detiene la mesa: sin la
 * cola, la franja se queda sin la parte de Hallazgos; sin las propias, no se
 * pueden editar; sin el inventario, el panel toma las preguntas del catálogo.
 */
export type ComplementosDeReglas = {
  propias?: ReglaCustom[] | null;
  semillas?: ReglaSemilla[] | null;
  limpieza?: LimpiezaSummary | null;
  excluidas?: InstrumentoVariablesExcluidas | null;
  /** `null` también sin respuestas (409 `E_NO_DATA_INST`). */
  inventario?: ExploradorVariablesList | null;
};

/** Quién lanzó la auditoría: desde el panel, al terminar lleva a Hallazgos. */
export type OrigenDeAuditoria = "cabecera" | "panel";

export function useMesaDeReglas({ alTerminarAuditoriaDelPanel }: { alTerminarAuditoriaDelPanel: () => void }) {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const [lectura, setLectura] = useState<LecturaDeReglas>({ fase: "cargando" });
  const [complementos, setComplementos] = useState<ComplementosDeReglas>({});
  const [ocupado, setOcupado] = useState("");
  const [error, setError] = useState("");
  const [trabajo, setTrabajo] = useState<{ id: string; origen: OrigenDeAuditoria } | null>(null);
  const secuencia = useRef(0);
  const alTerminarRef = useRef(alTerminarAuditoriaDelPanel);
  alTerminarRef.current = alTerminarAuditoriaDelPanel;

  const recargar = useCallback(async () => {
    const pedido = ++secuencia.current;
    // Cada complemento entra cuando llega, si sigue siendo de esta lectura.
    const complemento = <K extends keyof ComplementosDeReglas>(clave: K, promesa: Promise<ComplementosDeReglas[K]>) => {
      promesa.then(
        (valor) => {
          if (pedido === secuencia.current) setComplementos((c) => ({ ...c, [clave]: valor }));
        },
        () => {
          if (pedido === secuencia.current) setComplementos((c) => ({ ...c, [clave]: null }));
        },
      );
    };
    complemento("propias", apiV2ReglasCustomList(baseNombre).then((l) => l.reglas));
    complemento("semillas", apiV2ReglasCustomSemillas(baseNombre).then((r) => r.semillas ?? []));
    complemento("limpieza", apiV2Limpieza(baseNombre));
    complemento("excluidas", apiV2InstrumentoVariablesExcluidas(baseNombre));
    complemento("inventario", pedirInventario(baseNombre));
    try {
      const catalogo = await pedirCatalogoCompleto(baseNombre);
      if (pedido !== secuencia.current) return;
      setLectura({ fase: "lista", catalogo: catalogo.completo, catalogoDelPanel: catalogo.ligero });
    } catch (e) {
      if (pedido !== secuencia.current) return;
      setLectura({ fase: "error", mensaje: (e as Error).message });
    }
  }, [baseNombre]);

  useEffect(() => {
    setLectura({ fase: "cargando" });
    setComplementos({});
    setTrabajo(null);
    void recargar();
  }, [recargar, version]);

  /** Corre una escritura con su rótulo de espera y, al terminar, vuelve a leer la mesa. */
  const escribir = useCallback(
    async (rotulo: string, accion: () => Promise<unknown>) => {
      setOcupado(rotulo);
      setError("");
      try {
        await accion();
        await recargar();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setOcupado("");
      }
    },
    [recargar],
  );

  /** Activa o desactiva una regla: las propias por su PUT, las del formulario y del operativo por su PATCH. */
  const alternarActiva = useCallback(
    (regla: ReglaDelCatalogo, activa: boolean, motivo?: string) => {
      if (regla.origen === "propia") {
        return escribir(activa ? "Activando la regla" : "Desactivando la regla", () =>
          apiV2ReglasCustomUpdate(regla.id, { activa }, baseNombre));
      }
      const id = regla.id_motor;
      if (!id) return Promise.resolve();
      return escribir(activa ? "Activando la regla" : "Desactivando la regla", () =>
        apiV2InstrumentoReglaToggleActiva(id, activa, baseNombre, motivo));
    },
    [baseNombre, escribir],
  );

  const eliminarPropia = useCallback(
    (id: string) => escribir("Eliminando la regla", () => apiV2ReglasCustomDelete(id, baseNombre)),
    [baseNombre, escribir],
  );

  /** Excluir pide el motivo y lo manda solo para la que se agrega; reponer no lo pide (vara V5). */
  const excluirPregunta = useCallback(
    (variable: string, excluir: boolean, motivo?: string) => {
      const actuales = complementos.excluidas?.variables ?? [];
      const siguientes = excluir
        ? [...new Set([...actuales, variable])]
        : actuales.filter((v) => v !== variable);
      return escribir(excluir ? "Dejando la pregunta fuera de la auditoría" : "Devolviendo la pregunta a la auditoría", () =>
        apiV2InstrumentoVariablesExcluidasSave(siguientes, baseNombre, excluir && motivo ? { [variable]: motivo } : undefined));
    },
    [baseNombre, complementos.excluidas, escribir],
  );

  const auditar = useCallback(
    async (origen: OrigenDeAuditoria = "cabecera") => {
      setError("");
      try {
        const lanzada = await apiAuditar(baseNombre);
        setTrabajo({ id: lanzada.job_id, origen });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [baseNombre],
  );

  /** Guardar desde el panel de regla: el mismo PUT o POST de antes y, si se pide, la auditoría. */
  const guardarDesdeElPanel = useCallback(
    async (cuerpo: ReglaPropiaAGuardar, { auditar: conAuditoria }: { auditar: boolean }) => {
      const payload = comoCuerpoDelCliente(cuerpo);
      setOcupado("Guardando la regla");
      try {
        if (payload.id) await apiV2ReglasCustomUpdate(payload.id, payload, baseNombre);
        else await apiV2ReglasCustomCreate(payload, baseNombre);
        if (conAuditoria) {
          const lanzada = await apiAuditar(baseNombre);
          setTrabajo({ id: lanzada.job_id, origen: "panel" });
        }
        await recargar();
      } finally {
        setOcupado("");
      }
    },
    [baseNombre, recargar],
  );

  // El trabajo de la auditoría: al terminar se vuelve a leer la mesa (o, desde el panel, se va a Hallazgos).
  const job = useJob<unknown>(trabajo?.id ?? null);
  const estadoDelTrabajo = job.snapshot?.status ?? null;
  const fallaDelTrabajo = job.error;
  useEffect(() => {
    if (!trabajo) return;
    if (estadoDelTrabajo === "done") {
      const origen = trabajo.origen;
      setTrabajo(null);
      if (origen === "panel") alTerminarRef.current();
      else void recargar();
      return;
    }
    if (estadoDelTrabajo === "error" || estadoDelTrabajo === "cancelled" || fallaDelTrabajo) {
      setTrabajo(null);
      if (estadoDelTrabajo === "error") {
        const detalle = job.snapshot?.error;
        setError(typeof detalle === "string" && detalle ? detalle : "La auditoría no terminó.");
      } else if (fallaDelTrabajo) {
        setError(fallaDelTrabajo);
      }
    }
  }, [estadoDelTrabajo, fallaDelTrabajo, job.snapshot?.error, recargar, trabajo]);

  const nCasosAuditados = normalizarCifrasHallazgos(complementos.limpieza?.cifras_hallazgos)?.n_casos_evaluados ?? null;

  return {
    baseNombre,
    lectura,
    complementos,
    ocupado,
    error,
    setError,
    recargar,
    alternarActiva,
    eliminarPropia,
    excluirPregunta,
    auditar,
    guardarDesdeElPanel,
    trabajo,
    cancelarAuditoria: job.cancel,
    nCasosAuditados,
  };
}

export type MesaDeReglas = ReturnType<typeof useMesaDeReglas>;
