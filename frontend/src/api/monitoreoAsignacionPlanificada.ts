// monitoreoAsignacionPlanificada.ts — asignado (Material) contra observado
// (Kobo) por UMP (B3, Monitoreo › Territorial › Avance › UMP).
//
// Contrato: GET /api/monitoreo/territorial/asignacion-planificada
// (`api/R/monitoreo_territorial_asignacion_planificada.R`). Solo lectura: la
// asignación es de Material y Monitoreo sólo la consulta. Sólo se compara si es
// de la misma muestra que está en campo; si no, `estado` lo dice.
//
// Normalizador defensivo: Plumber serializa con auto_unbox (lista de uno como
// objeto suelto, escalar como vector de largo uno).

import { apiFetch, handle, headers } from "./core";
import { enteroONulo, lista, registro, texto } from "./normalizarR";

export type EstadoDeAsignacionPlanificada = "comparable" | "otra_muestra" | "sin_asignacion" | "sin_envio" | "sin_campana";

export type LecturaDeAsignacion = "coincide" | "coincide_con_otros" | "otro_encuestador" | "sin_respuestas";

export type UmpPlanificada = {
  idManzana: string;
  label: string;
  role: string;
  /** El código vino del titular (reemplazo sin código propio). */
  heredada: boolean;
  codigoPlanificado: string;
  nombrePlanificado: string;
  observados: Array<{ codigo: string; nombre: string; respuestas: number }>;
  respuestas: number;
  lectura: LecturaDeAsignacion;
  /** C7: el Estado que declara campo en el Excel (Pendiente, En campo, Finalizada…). Declarado, no avance. */
  estadoDeclarado: string;
  fechaSalida: string;
  fechaEntrega: string;
  /** Lo declarado contradice lo que llegó a Kobo. */
  contraste: "" | "finalizada_sin_respuestas" | "pendiente_con_respuestas";
};

export type AsignacionPlanificada = {
  estado: EstadoDeAsignacionPlanificada;
  motivo: string;
  porUmp: UmpPlanificada[];
  resumen: {
    asignadas: number;
    coinciden: number;
    coincidenConOtros: number;
    otroEncuestador: number;
    sinRespuestas: number;
    sinPlanificar: number;
    conEstadoDeclarado: number;
    contrastes: number;
  };
};

const ESTADOS: EstadoDeAsignacionPlanificada[] = ["comparable", "otra_muestra", "sin_asignacion", "sin_envio", "sin_campana"];
const LECTURAS: LecturaDeAsignacion[] = ["coincide", "coincide_con_otros", "otro_encuestador", "sin_respuestas"];

export function normalizeAsignacionPlanificada(raw: unknown): AsignacionPlanificada {
  const r = registro(raw);
  const estadoCrudo = texto(r.estado) as EstadoDeAsignacionPlanificada;
  const resumen = registro(r.resumen);
  const entero = (v: unknown) => enteroONulo(v) ?? 0;
  return {
    estado: ESTADOS.includes(estadoCrudo) ? estadoCrudo : "sin_asignacion",
    motivo: texto(r.motivo),
    porUmp: lista(r.por_ump).map((u) => {
      const lecturaCruda = texto(u.lectura) as LecturaDeAsignacion;
      return {
        idManzana: texto(u.id_manzana),
        label: texto(u.label),
        role: texto(u.role),
        heredada: texto(u.origen) === "heredada",
        codigoPlanificado: texto(u.codigo_planificado),
        nombrePlanificado: texto(u.nombre_planificado),
        observados: lista(u.observados).map((o) => ({ codigo: texto(o.codigo), nombre: texto(o.nombre), respuestas: entero(o.respuestas) })),
        respuestas: entero(u.respuestas),
        lectura: LECTURAS.includes(lecturaCruda) ? lecturaCruda : "sin_respuestas",
        estadoDeclarado: texto(u.estado_declarado),
        fechaSalida: texto(u.fecha_salida),
        fechaEntrega: texto(u.fecha_entrega),
        contraste: (["finalizada_sin_respuestas", "pendiente_con_respuestas"] as const).find((c) => c === texto(u.contraste)) ?? "",
      };
    }),
    resumen: {
      asignadas: entero(resumen.asignadas),
      coinciden: entero(resumen.coinciden),
      coincidenConOtros: entero(resumen.coinciden_con_otros),
      otroEncuestador: entero(resumen.otro_encuestador),
      sinRespuestas: entero(resumen.sin_respuestas),
      sinPlanificar: entero(resumen.sin_planificar),
      conEstadoDeclarado: entero(resumen.con_estado_declarado),
      contrastes: entero(resumen.contrastes),
    },
  };
}

export async function getMonitoreoTerritorialAsignacionPlanificada(): Promise<AsignacionPlanificada> {
  return normalizeAsignacionPlanificada(
    await handle<unknown>(await apiFetch("/api/monitoreo/territorial/asignacion-planificada", { headers: headers() })),
  );
}
