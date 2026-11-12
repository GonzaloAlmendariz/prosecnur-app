/**
 * Lo que la pestaña Hallazgos lee y guarda (plan de fidelidad, rebanada V3).
 *
 * Lee la cola (`GET /limpieza`) y, por su cuenta, el catálogo de reglas (M3:
 * frase, base, sentidos del salto, tratamiento previsto y límites); el
 * catálogo no detiene la mesa. Del hallazgo abierto lee sus casos (`POST
 * /instrumento/regla`) y, mientras se decide, el efecto previsto del borrador
 * (`POST /limpieza/decision/efecto`, M4), que no guarda nada.
 *
 * Lo que se guarda es lo mismo que guardaba el editor de antes
 * (`limpieza/EditorDeDecision.tsx` con `useMesaDeLimpieza`): el cuerpo lo arma
 * `buildDecisionPayload` con el mismo formulario. Lo nuevo es "Incluir casos
 * nuevos" (vuelve a guardar la decisión lista con `incluir_casos_nuevos`) y
 * "Volver a auditar", que lanza la auditoría completa (`POST /auditoria`) en
 * lugar de solo el plan del formulario. Después de guardar se vuelve a leer la
 * cola: lo que se ve es lo que el motor tiene.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  apiV2InstrumentoDrill,
  apiV2Limpieza,
  apiV2LimpiezaDecisionDelete,
  apiV2LimpiezaDecisionSave,
  type InstrumentoDrillResult,
} from "../../../api/client";
import {
  apiAuditar,
  apiCatalogoDeHallazgos,
  apiEfectoDeDecision,
  normalizarCifrasHallazgos,
  type CatalogoDeHallazgos,
  type EfectoDeDecision,
} from "../../../api/validacionAuditoria";
import { useJob } from "../../../hooks/useJob";
import { conModificador } from "../../../lib/teclado";
import { relationalBaseKey, useValidacionStore } from "../store";
import type { LimpiezaDecision, LimpiezaQueueItem, LimpiezaSummary } from "../types";
import {
  NEW_DECISION,
  buildDecisionPayload,
  buildEditorForm,
  emptyEditorForm,
  inferSourceType,
  isSystemColumn,
  uniqueStrings,
  type EditorForm,
} from "../limpieza/modeloLimpieza";
import { casosDelElegido, elementosDeCola, hallazgoElegido, siguientePorDecidir, type ElementoDeCola, type LecturaDeCasos } from "./modeloHallazgos";

export type LecturaDeLaCola =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; data: LimpiezaSummary };

export type { LecturaDeCasos } from "./modeloHallazgos";

export type EstadoDelEfecto =
  | { fase: "inactivo" }
  /** El borrador no se puede medir todavía; `causa` dice qué falta. */
  | { fase: "incompleto"; causa: string }
  | { fase: "midiendo"; anterior: EfectoDeDecision | null; id?: string }
  | { fase: "listo"; efecto: EfectoDeDecision; id?: string }
  | { fase: "error"; mensaje: string };

/**
 * Espera tras el último cambio del borrador antes de pedir el efecto. En las
 * pruebas es 0, para que los pedidos de la huella no dependan del reloj.
 */
export const ESPERA_DEL_EFECTO_MS = import.meta.env.MODE === "test" ? 0 : 350;

export function useHallazgos({ foco, onElegir }: {
  /** El hallazgo de la dirección (`foco`), o el último elegido mientras el caso está abierto. */
  foco: string | null;
  /** Elegir un hallazgo escribe su foco en la dirección. */
  onElegir: (id: string) => void;
}) {
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const version = useValidacionStore((s) => s.version);
  const controlesSinAplicar = useValidacionStore((s) => !!s.controlesSinAplicar[relationalBaseKey(s.baseNombre)]);

  const [lectura, setLectura] = useState<LecturaDeLaCola>({ fase: "cargando" });
  const [releyendo, setReleyendo] = useState(false);
  const [catalogo, setCatalogo] = useState<CatalogoDeHallazgos | null | undefined>(undefined);
  const [casos, setCasos] = useState<LecturaDeCasos>({ fase: "inactiva" });
  const [reintentoCasos, setReintentoCasos] = useState(0);
  const [form, setForm] = useState<EditorForm>(() => emptyEditorForm());
  const [decisionAbierta, setDecisionAbierta] = useState<string>(NEW_DECISION);
  const [efecto, setEfecto] = useState<EstadoDelEfecto>({ fase: "inactivo" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [trabajo, setTrabajo] = useState<string | null>(null);
  const secuencia = useRef(0);

  const recargar = useCallback(
    async (opciones: { silenciosa?: boolean } = {}) => {
      const pedido = ++secuencia.current;
      if (opciones.silenciosa) setReleyendo(true);
      apiCatalogoDeHallazgos(baseNombre).then(
        (c) => { if (pedido === secuencia.current) setCatalogo(c); },
        () => { if (pedido === secuencia.current) setCatalogo(null); },
      );
      try {
        const data = await apiV2Limpieza(baseNombre);
        if (pedido === secuencia.current) setLectura({ fase: "lista", data });
      } catch (e) {
        if (pedido === secuencia.current) setLectura({ fase: "error", mensaje: (e as Error).message });
      } finally {
        if (pedido === secuencia.current) setReleyendo(false);
      }
    },
    [baseNombre],
  );

  useEffect(() => {
    setLectura({ fase: "cargando" });
    setCatalogo(undefined);
    setCasos({ fase: "inactiva" });
    setTrabajo(null);
    setError("");
    setAviso("");
    void recargar();
  }, [recargar, version]);

  const data = lectura.fase === "lista" ? lectura.data : null;
  const cifras = useMemo(() => normalizarCifrasHallazgos(data?.cifras_hallazgos), [data]);
  const elementos = useMemo(() => elementosDeCola(data), [data]);
  const elegido = useMemo(() => hallazgoElegido(elementos, foco), [elementos, foco]);
  const elegidoId = elegido?.id ?? null;
  const item = useMemo(() => data?.decision_queue.find((q) => q.source_id === elegidoId) ?? null, [data, elegidoId]);
  const reglaDelCatalogo = useMemo(
    () => (elegidoId && catalogo ? catalogo.completo.reglas.find((r) => r.id_motor === elegidoId || r.id === elegidoId) ?? null : null),
    [catalogo, elegidoId],
  );
  const decisiones = useMemo<LimpiezaDecision[]>(
    () => (data && elegidoId
      ? data.decision_draft
          .filter((d) => d.source_id === elegidoId)
          .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
      : []),
    [data, elegidoId],
  );

  // Al elegir otro hallazgo se abre su decisión más reciente (lista o borrador), o una nueva.
  useEffect(() => {
    setDecisionAbierta(decisiones[0]?.id ?? NEW_DECISION);
  }, [elegidoId, decisiones]);
  const decision = decisiones.find((d) => d.id === decisionAbierta) ?? null;

  // Los casos del hallazgo abierto.
  useEffect(() => {
    if (!elegidoId || !data?.progreso.auditoria_corrida) {
      setCasos({ fase: "inactiva" });
      return undefined;
    }
    let vigente = true;
    setCasos({ fase: "cargando" });
    apiV2InstrumentoDrill(elegidoId, baseNombre).then(
      (drill) => { if (vigente) setCasos({ fase: "lista", id: elegidoId, drill }); },
      (e) => { if (vigente) setCasos({ fase: "error", id: elegidoId, mensaje: (e as Error).message }); },
    );
    return () => { vigente = false; };
  }, [baseNombre, data?.progreso.auditoria_corrida, elegidoId, reintentoCasos]);

  // Solo los casos de la regla elegida: los del hallazgo anterior no se muestran mientras llegan los nuevos.
  const casosVigentes = casosDelElegido(casos, elegidoId);
  const drill = casosVigentes.fase === "lista" ? casosVigentes.drill : null;

  // Las preguntas que una acción puede tocar: las de la regla y las de la primera fila.
  const variables = useMemo(() => {
    const primera = drill?.casos?.length ? Object.keys(drill.casos[0] ?? {}) : [];
    return uniqueStrings([
      ...(item?.variables ?? []),
      ...(drill?.regla.variables ?? []),
      ...primera.filter((k) => !isSystemColumn(k) && k !== (drill?.uuid_col ?? "")),
    ]);
  }, [drill, item]);

  // El tratamiento previsto: el de la cola o, si la cola no lo trae, el del catálogo.
  const prevista = item?.planned_action_type || reglaDelCatalogo?.tratamiento.accion || null;

  useEffect(() => {
    if (!elegidoId) {
      setForm(emptyEditorForm());
      return;
    }
    const conPrevista = item && !item.planned_action_type && prevista
      ? { ...item, planned_action_type: prevista as LimpiezaQueueItem["planned_action_type"] }
      : item;
    setForm(buildEditorForm(elegidoId, conPrevista, decision, variables));
  }, [decision, elegidoId, item, prevista, variables]);

  // El efecto previsto del borrador: se mide cuando deja de cambiar. El motivo
  // no cambia el efecto: escribirlo no vuelve a medir.
  const medible = useMemo((): { cuerpo: Record<string, unknown>; clave: string } | { causa: string } | null => {
    if (!elegidoId || !data?.progreso.auditoria_corrida) return null;
    try {
      const cuerpo = buildDecisionPayload({
        form: { ...form, rationale: "" },
        status: "draft",
        sourceId: elegidoId,
        sourceType: item?.source_type ?? inferSourceType(elegidoId),
      });
      return { cuerpo, clave: JSON.stringify(cuerpo) };
    } catch (e) {
      return { causa: (e as Error).message };
    }
  }, [data?.progreso.auditoria_corrida, elegidoId, form, item?.source_type]);
  const claveDelEfecto = medible === null ? "" : "clave" in medible ? medible.clave : `causa:${medible.causa}`;
  const medibleRef = useRef(medible);
  medibleRef.current = medible;

  // Al cambiar de hallazgo el efecto del anterior no se arrastra al pie del nuevo (ronda 2, H2).
  useEffect(() => {
    setEfecto({ fase: "inactivo" });
  }, [elegidoId]);

  useEffect(() => {
    const actual = medibleRef.current;
    if (actual === null) {
      setEfecto({ fase: "inactivo" });
      return undefined;
    }
    if (!("cuerpo" in actual)) {
      setEfecto({ fase: "incompleto", causa: actual.causa });
      return undefined;
    }
    const control = new AbortController();
    const id = String(actual.cuerpo.source_id ?? "");
    setEfecto((previo) => ({
      fase: "midiendo",
      id,
      anterior: previo.fase === "listo" && previo.id === id ? previo.efecto : previo.fase === "midiendo" && previo.id === id ? previo.anterior : null,
    }));
    const espera = window.setTimeout(() => {
      apiEfectoDeDecision(actual.cuerpo, baseNombre, { signal: control.signal }).then(
        (e) => { if (!control.signal.aborted) setEfecto({ fase: "listo", efecto: e, id }); },
        (e) => { if (!control.signal.aborted) setEfecto({ fase: "error", mensaje: (e as Error).message }); },
      );
    }, ESPERA_DEL_EFECTO_MS);
    return () => {
      window.clearTimeout(espera);
      control.abort();
    };
  }, [baseNombre, claveDelEfecto]);

  const omitir = useCallback(() => {
    const siguiente = siguientePorDecidir(elementos, elegidoId);
    if (siguiente) onElegir(siguiente.id);
  }, [elementos, elegidoId, onElegir]);

  const guardar = useCallback(
    async (estado: "ready" | "draft", { avanzar = true }: { avanzar?: boolean } = {}) => {
      if (!elegidoId) return;
      setGuardando(true);
      setError("");
      setAviso("");
      try {
        const cuerpo = buildDecisionPayload({
          form,
          status: estado,
          sourceId: elegidoId,
          sourceType: item?.source_type ?? inferSourceType(elegidoId),
        });
        const respuesta = await apiV2LimpiezaDecisionSave(cuerpo, baseNombre);
        setDecisionAbierta(respuesta.decision.id);
        const siguiente = estado === "ready" && avanzar ? siguientePorDecidir(elementos, elegidoId) : null;
        await recargar({ silenciosa: true });
        if (estado === "draft") setAviso("Borrador guardado.");
        else if (siguiente) onElegir(siguiente.id);
        else if (estado === "ready") setAviso("Decisión guardada. No quedan hallazgos por decidir.");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setGuardando(false);
      }
    },
    [baseNombre, elegidoId, elementos, form, item?.source_type, onElegir, recargar],
  );

  /** Vuelve a guardar una decisión lista sumando los casos que la regla marca hoy (D-F2). */
  const incluirCasosNuevos = useCallback(
    async (d: LimpiezaDecision) => {
      setGuardando(true);
      setError("");
      setAviso("");
      try {
        const cuerpo = {
          id: d.id,
          source_id: d.source_id,
          source_type: d.source_type,
          scope: d.scope,
          target_case_ids: d.target_case_ids ?? [],
          ...(d.target_variable ? { target_variable: d.target_variable } : {}),
          action_type: d.action_type,
          action_params: d.action_params && !Array.isArray(d.action_params) ? d.action_params : {},
          rationale: d.rationale,
          status: "ready" as const,
          incluir_casos_nuevos: true,
        };
        await apiV2LimpiezaDecisionSave(cuerpo, baseNombre);
        await recargar({ silenciosa: true });
        setAviso("La decisión ahora cubre los casos nuevos.");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setGuardando(false);
      }
    },
    [baseNombre, recargar],
  );

  const eliminar = useCallback(
    async (d: LimpiezaDecision) => {
      setGuardando(true);
      setError("");
      setAviso("");
      try {
        await apiV2LimpiezaDecisionDelete(d.id, baseNombre);
        setDecisionAbierta(NEW_DECISION);
        await recargar({ silenciosa: true });
        setAviso("Decisión eliminada.");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setGuardando(false);
      }
    },
    [baseNombre, recargar],
  );

  const auditar = useCallback(async () => {
    setError("");
    setAviso("");
    try {
      const lanzada = await apiAuditar(baseNombre);
      setTrabajo(lanzada.job_id);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [baseNombre]);

  // Al terminar la auditoría se vuelve a leer la mesa entera (cola, catálogo y casos).
  const job = useJob<unknown>(trabajo);
  const estadoDelTrabajo = job.snapshot?.status ?? null;
  const fallaDelTrabajo = job.error;
  useEffect(() => {
    if (!trabajo) return;
    if (estadoDelTrabajo === "done") {
      setTrabajo(null);
      setReintentoCasos((n) => n + 1);
      void recargar({ silenciosa: true });
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

  // Cmd (macOS) o Ctrl (Windows) + Enter: guardar y seguir. Con Mayúsculas: guardar sin dejarla lista (D-F7f).
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;
  useEffect(() => {
    if (!elegidoId) return undefined;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key !== "Enter" || !conModificador(evento) || guardando) return;
      evento.preventDefault();
      void guardarRef.current(evento.shiftKey ? "draft" : "ready");
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [elegidoId, guardando]);

  return {
    baseNombre,
    lectura,
    data,
    releyendo,
    cifras,
    catalogo,
    elementos,
    elegido: elegido as ElementoDeCola | null,
    item,
    reglaDelCatalogo,
    limites: elegidoId && catalogo ? catalogo.limites[elegidoId] ?? null : null,
    casos: casosVigentes,
    drill,
    reintentarCasos: () => setReintentoCasos((n) => n + 1),
    variables,
    prevista,
    decisiones,
    decision,
    abrirDecision: setDecisionAbierta,
    form,
    setForm,
    // El efecto de otro hallazgo no se muestra ni un cuadro (ronda 2, H2).
    efecto: (efecto.fase === "listo" || efecto.fase === "midiendo") && efecto.id !== elegidoId
      ? ({ fase: "midiendo", anterior: null } as EstadoDelEfecto)
      : efecto,
    guardando,
    error,
    aviso,
    guardar,
    incluirCasosNuevos,
    eliminar,
    omitir,
    auditar,
    auditando: !!trabajo,
    cancelarAuditoria: job.cancel,
    controlesSinAplicar,
    recargar,
  };
}

export type Hallazgos = ReturnType<typeof useHallazgos>;
