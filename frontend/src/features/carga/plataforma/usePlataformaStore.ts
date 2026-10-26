import { create } from "zustand";
import type { AsyncJobStart, JobSnapshot } from "../../../api/jobs";
import { apiJobCancel } from "../../../api/jobs";
import {
  apiCargaImportKoboAsync,
  apiCargaImportSurveyMonkeyAsync,
} from "../../../api/xlsformEditor";
import {
  apiCargaImportKoboSeparadaAsync,
  apiCargaImportSurveyMonkeySeparadaAsync,
} from "../../../api/cargaPlataforma";
import { iniciarJobPoll, type JobPollUpdate } from "../../../hooks/useJob";
import {
  claveImport,
  clasificarErrorLanzamiento,
  clasificarResultadoJob,
  cuerpoKoboSeparada,
  cuerpoKoboUnica,
  cuerpoSurveyMonkeySeparada,
  cuerpoSurveyMonkeyUnica,
  progresoDeImport,
  tituloDeError,
  type ClaveImport,
  type EstrategiaImport,
  type PeticionImport,
  type ProgresoImport,
  type ProveedorPlataforma,
  type ResultadoImport,
} from "./modeloPlataforma";

// =============================================================================
// Store de importación desde plataforma (Carga · L5a)
// =============================================================================
// El estado duro (bases, estudio) vive en el backend; acá solo vive el job:
// qué import corre por proveedor+estrategia, su progreso y su desenlace.
//
// Por qué el poll vive en el store y no en el componente: el backend aplica
// el diff del worker a la sesión DENTRO de `job_poll` (on_complete), o sea,
// cuando alguien pollea. Si el poll se atara al montaje (useJob), cambiar de
// pestaña o de módulo dejaría el import sin cosechar hasta volver. Se usa el
// mismo poller endurecido de la casa (`iniciarJobPoll`, el núcleo de useJob:
// reintentos, 404 → perdido, timeout con cancel) pero con vida de módulo.
// Al volver, el componente lee `vivos[clave]` y retoma el job sin relanzar.

export type ImportEnLanzamiento = {
  clave: ClaveImport;
  proveedor: ProveedorPlataforma;
  estrategia: EstrategiaImport;
  etiqueta: string;
  iniciadoEn: number;
  /** Cancelar pulsado antes de que el POST devolviera el job_id. */
  cancelSolicitado: boolean;
};

export type ImportVivo = ImportEnLanzamiento & {
  jobId: string;
  progreso: ProgresoImport | null;
  /** El poll reintenta tras un fallo transitorio (el job puede seguir vivo). */
  reintentando: boolean;
};

export type ImportTerminado = {
  clave: ClaveImport;
  proveedor: ProveedorPlataforma;
  estrategia: EstrategiaImport;
  etiqueta: string;
  /** null si falló el lanzamiento (nunca hubo job). */
  jobId: string | null;
  iniciadoEn: number;
  terminadoEn: number;
  resultado: ResultadoImport;
  /** El consumidor ya reaccionó (refrescó el estudio, avisó). */
  notificado: boolean;
};

type Mapa<T> = Partial<Record<ClaveImport, T>>;

export type PlataformaState = {
  lanzando: Mapa<ImportEnLanzamiento>;
  vivos: Mapa<ImportVivo>;
  terminados: Mapa<ImportTerminado>;

  /** Lanza el import con `async: true`; devuelve el job_id o null si no arrancó
   *  (el motivo queda en `terminados[clave]`). */
  importar: (peticion: PeticionImport) => Promise<string | null>;
  cancelar: (clave: ClaveImport) => Promise<void>;
  marcarNotificado: (clave: ClaveImport) => void;
  descartar: (clave: ClaveImport) => void;
  /** Detiene los polls y limpia. Solo para tests o cierre de sesión: un cambio
   *  de proyecto NO debe llamarlo (el job vivo debe terminar en sesión obsoleta). */
  reiniciar: () => void;
};

type Lanzador<B> = (body: B) => Promise<AsyncJobStart>;

export type DepsPlataforma = {
  surveymonkeyUnica: Lanzador<ReturnType<typeof cuerpoSurveyMonkeyUnica>>;
  surveymonkeySeparada: Lanzador<ReturnType<typeof cuerpoSurveyMonkeySeparada>>;
  koboUnica: Lanzador<ReturnType<typeof cuerpoKoboUnica>>;
  koboSeparada: Lanzador<ReturnType<typeof cuerpoKoboSeparada>>;
  poll: (jobId: string, onUpdate: (update: JobPollUpdate<unknown>) => void) => () => void;
  cancelarJob: (jobId: string) => Promise<unknown>;
  ahora: () => number;
};

// Envoltorios perezosos: resuelven la función en cada llamada (mockeable).
const DEPS_REALES: DepsPlataforma = {
  surveymonkeyUnica: (body) => apiCargaImportSurveyMonkeyAsync(body),
  surveymonkeySeparada: (body) => apiCargaImportSurveyMonkeySeparadaAsync(body),
  koboUnica: (body) => apiCargaImportKoboAsync(body),
  koboSeparada: (body) => apiCargaImportKoboSeparadaAsync(body),
  poll: (jobId, onUpdate) => iniciarJobPoll<unknown>(jobId, onUpdate),
  cancelarJob: (jobId) => apiJobCancel(jobId),
  ahora: () => Date.now(),
};

function lanzar(deps: DepsPlataforma, p: PeticionImport): Promise<AsyncJobStart> {
  if (p.proveedor === "kobo") {
    return p.estrategia === "separada" ? deps.koboSeparada(cuerpoKoboSeparada(p)) : deps.koboUnica(cuerpoKoboUnica(p));
  }
  return p.estrategia === "separada"
    ? deps.surveymonkeySeparada(cuerpoSurveyMonkeySeparada(p))
    : deps.surveymonkeyUnica(cuerpoSurveyMonkeyUnica(p));
}

function sin<T>(mapa: Mapa<T>, clave: ClaveImport): Mapa<T> {
  const copia = { ...mapa };
  delete copia[clave];
  return copia;
}

export function hayJobEnCurso(state: Pick<PlataformaState, "lanzando" | "vivos">): boolean {
  return Object.keys(state.lanzando).length > 0 || Object.keys(state.vivos).length > 0;
}

export function crearStorePlataforma(depsParciales: Partial<DepsPlataforma> = {}) {
  const deps: DepsPlataforma = { ...DEPS_REALES, ...depsParciales };
  const paradas = new Map<string, () => void>();

  return create<PlataformaState>()((set, get) => {
    const terminar = (base: ImportEnLanzamiento, jobId: string | null, resultado: ResultadoImport) => {
      if (jobId) {
        const stop = paradas.get(jobId);
        paradas.delete(jobId);
        // Diferido: el poller puede estar dentro de su propio callback.
        if (stop) queueMicrotask(stop);
      }
      const terminado: ImportTerminado = {
        clave: base.clave,
        proveedor: base.proveedor,
        estrategia: base.estrategia,
        etiqueta: base.etiqueta,
        jobId,
        iniciadoEn: base.iniciadoEn,
        terminadoEn: deps.ahora(),
        resultado,
        notificado: false,
      };
      set((s) => ({
        lanzando: sin(s.lanzando, base.clave),
        vivos: sin(s.vivos, base.clave),
        terminados: { ...s.terminados, [base.clave]: terminado },
      }));
    };

    const seguir = (clave: ClaveImport, jobId: string) => {
      const onUpdate = (update: JobPollUpdate<unknown>) => {
        const vivo = get().vivos[clave];
        if (!vivo || vivo.jobId !== jobId) return;
        const snap: JobSnapshot<unknown> | undefined = update.snapshot;
        const resultado = clasificarResultadoJob({
          estrategia: vivo.estrategia,
          status: snap?.status ?? null,
          resultData: snap?.result_data,
          error: snap?.error,
          falloPoll: update.failure ?? null,
          cancelSolicitado: vivo.cancelSolicitado,
        });
        if (resultado) {
          terminar(vivo, jobId, resultado);
          return;
        }
        set((s) => {
          const actual = s.vivos[clave];
          if (!actual || actual.jobId !== jobId) return s;
          return {
            vivos: {
              ...s.vivos,
              [clave]: {
                ...actual,
                progreso: snap ? progresoDeImport(snap.progress) : actual.progreso,
                reintentando: update.retrying ?? actual.reintentando,
              },
            },
          };
        });
      };
      paradas.set(jobId, deps.poll(jobId, onUpdate));
    };

    return {
      lanzando: {},
      vivos: {},
      terminados: {},

      importar: async (peticion) => {
        const clave = claveImport(peticion.proveedor, peticion.estrategia);
        const base: ImportEnLanzamiento = {
          clave,
          proveedor: peticion.proveedor,
          estrategia: peticion.estrategia,
          etiqueta: peticion.titulo,
          iniciadoEn: deps.ahora(),
          cancelSolicitado: false,
        };
        // El backend admite UN import de plataforma por sesión
        // (E_CARGA_JOB_RUNNING); se corta antes de gastar el POST.
        if (hayJobEnCurso(get())) {
          // Si el que corre es este mismo proveedor+estrategia, su tarjeta ya
          // está a la vista: no se pisa nada. Si es otro, se explica acá.
          const mismo = get().lanzando[clave] || get().vivos[clave];
          if (!mismo) {
            const bloqueado: ImportTerminado = {
              clave,
              proveedor: base.proveedor,
              estrategia: base.estrategia,
              etiqueta: base.etiqueta,
              jobId: null,
              iniciadoEn: base.iniciadoEn,
              terminadoEn: base.iniciadoEn,
              resultado: {
                tipo: "error",
                codigo: "E_CARGA_JOB_RUNNING",
                titulo: tituloDeError("E_CARGA_JOB_RUNNING"),
                mensaje: "Espera a que termine la importación en curso antes de lanzar otra.",
              },
              notificado: false,
            };
            set((s) => ({ terminados: { ...s.terminados, [clave]: bloqueado } }));
          }
          return null;
        }
        set((s) => ({
          lanzando: { ...s.lanzando, [clave]: base },
          terminados: sin(s.terminados, clave),
        }));
        let start: AsyncJobStart;
        try {
          start = await lanzar(deps, peticion);
        } catch (e) {
          terminar(base, null, clasificarErrorLanzamiento(e));
          return null;
        }
        const jobId = typeof start?.job_id === "string" ? start.job_id.trim() : "";
        if (!jobId) {
          terminar(base, null, {
            tipo: "error",
            codigo: "E_CARGA_JOB_CONTRATO",
            titulo: tituloDeError("E_CARGA_JOB_CONTRATO"),
            mensaje: "El backend no devolvió el identificador del trabajo en segundo plano. Revisa las bases del estudio antes de reintentar.",
          });
          return null;
        }
        const cancelPendiente = get().lanzando[clave]?.cancelSolicitado === true;
        const vivo: ImportVivo = {
          ...base,
          cancelSolicitado: cancelPendiente,
          jobId,
          progreso: null,
          reintentando: false,
        };
        set((s) => ({ lanzando: sin(s.lanzando, clave), vivos: { ...s.vivos, [clave]: vivo } }));
        seguir(clave, jobId);
        if (cancelPendiente) {
          try {
            await deps.cancelarJob(jobId);
          } catch {
            // Best-effort: el poll dirá si terminó, se canceló o se importó igual.
          }
        }
        return jobId;
      },

      cancelar: async (clave) => {
        const enLanzamiento = get().lanzando[clave];
        if (enLanzamiento) {
          set((s) => ({ lanzando: { ...s.lanzando, [clave]: { ...enLanzamiento, cancelSolicitado: true } } }));
          return;
        }
        const vivo = get().vivos[clave];
        if (!vivo || vivo.cancelSolicitado) return;
        set((s) => ({ vivos: { ...s.vivos, [clave]: { ...vivo, cancelSolicitado: true } } }));
        try {
          await deps.cancelarJob(vivo.jobId);
        } catch {
          // Si el cancel no llega (el job ya terminó), el poll trae el desenlace
          // real: «cancelé y aun así se importó» incluido.
        }
      },

      marcarNotificado: (clave) => {
        set((s) => {
          const t = s.terminados[clave];
          if (!t || t.notificado) return s;
          return { terminados: { ...s.terminados, [clave]: { ...t, notificado: true } } };
        });
      },

      descartar: (clave) => {
        set((s) => (s.terminados[clave] ? { terminados: sin(s.terminados, clave) } : s));
      },

      reiniciar: () => {
        paradas.forEach((stop) => stop());
        paradas.clear();
        set({ lanzando: {}, vivos: {}, terminados: {} });
      },
    };
  });
}

/** Instancia de la app: sobrevive a desmontajes de pestaña, sección y módulo. */
export const usePlataformaStore = crearStorePlataforma();
