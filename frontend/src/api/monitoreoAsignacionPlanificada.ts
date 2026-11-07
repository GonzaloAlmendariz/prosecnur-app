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
import { enteroONulo, lista, numeroONulo, registro, texto } from "./normalizarR";

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
  /** P2: efectivas que campo transcribe del consolidado; `null` si no transcribió nada. */
  efectivasDeclaradas: number | null;
  /** Efectivas válidas que llegaron a Kobo para esa UMP. */
  efectivasKobo: number;
  /** 2h: efectivas que declara coordinación en su registro (§1C); `null` sin registro. Nunca se suman a Kobo. */
  efectivasCoordinacion: number | null;
  /** Coordinación menos Kobo; `null` sin registro. */
  diferenciaCoordinacion: number | null;
  /** 2h parte 2: lo que declara coordinación por celda de cada marginal, sin sumar. */
  coordinacionPorSexo: Array<{ celda: string; valor: number }>;
  coordinacionPorEdad: Array<{ celda: string; valor: number }>;
  fechaVisita: string;
  supervisionAprobadas: number | null;
  supervisionNoAprobadas: number | null;
};

/** 2h: el control por encuestador (el planificado de cada UMP). */
export type EncuestadorControlado = {
  codigo: string;
  nombre: string;
  ump: number;
  conRespuestas: number;
  efectivasKobo: number;
  efectivasCoordinacion: number | null;
  umpQueNoCuadran: number;
  intentosDeclarados: number | null;
  /** Efectivas de Kobo sobre intentos declarados, 0–1; `null` sin intentos. */
  rendimiento: number | null;
  supervisionAprobadas: number | null;
  supervisionNoAprobadas: number | null;
};

/** 2h: el Reporte por región (la llave de las pestañas del registro del coordinador). */
export type RegionControlada = Omit<EncuestadorControlado, "codigo" | "nombre"> & { region: string };

export type AsignacionPlanificada = {
  estado: EstadoDeAsignacionPlanificada;
  motivo: string;
  porUmp: UmpPlanificada[];
  porEncuestador: EncuestadorControlado[];
  porRegion: RegionControlada[];
  resumen: {
    asignadas: number;
    coinciden: number;
    coincidenConOtros: number;
    otroEncuestador: number;
    sinRespuestas: number;
    sinPlanificar: number;
    conEstadoDeclarado: number;
    contrastes: number;
    conConteos: number;
    conteosDistintos: number;
    conRegistroCoordinacion: number;
    coordinacionDistinta: number;
    supervisionAprobadas: number | null;
    supervisionNoAprobadas: number | null;
  };
};

const ESTADOS: EstadoDeAsignacionPlanificada[] = ["comparable", "otra_muestra", "sin_asignacion", "sin_envio", "sin_campana"];
const LECTURAS: LecturaDeAsignacion[] = ["coincide", "coincide_con_otros", "otro_encuestador", "sin_respuestas"];

// Las cifras del control de un grupo de UMP (un encuestador o una región).
function cifrasDelControl(e: Record<string, unknown>): Omit<EncuestadorControlado, "codigo" | "nombre"> {
  const entero = (v: unknown) => enteroONulo(v) ?? 0;
  return {
    ump: entero(e.ump),
    conRespuestas: entero(e.con_respuestas),
    efectivasKobo: entero(e.efectivas_kobo),
    efectivasCoordinacion: enteroONulo(e.efectivas_coordinacion),
    umpQueNoCuadran: entero(e.ump_que_no_cuadran),
    intentosDeclarados: enteroONulo(e.intentos_declarados),
    rendimiento: numeroONulo(e.rendimiento),
    supervisionAprobadas: enteroONulo(e.supervision_aprobadas),
    supervisionNoAprobadas: enteroONulo(e.supervision_no_aprobadas),
  };
}

function celdas(v: unknown): Array<{ celda: string; valor: number }> {
  return Object.entries(registro(v))
    .map(([celda, x]) => ({ celda, valor: enteroONulo(x) }))
    .filter((c): c is { celda: string; valor: number } => Boolean(c.celda) && c.valor != null);
}

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
        efectivasDeclaradas: enteroONulo(u.efectivas_declaradas),
        efectivasKobo: entero(u.efectivas_kobo),
        efectivasCoordinacion: enteroONulo(u.efectivas_coordinacion),
        diferenciaCoordinacion: enteroONulo(u.diferencia_coordinacion),
        coordinacionPorSexo: celdas(u.efectivas_por_sexo),
        coordinacionPorEdad: celdas(u.efectivas_por_edad),
        fechaVisita: texto(u.fecha_visita),
        supervisionAprobadas: enteroONulo(u.supervision_aprobadas),
        supervisionNoAprobadas: enteroONulo(u.supervision_no_aprobadas),
      };
    }),
    porEncuestador: lista(r.por_encuestador).map((e) => ({
      codigo: texto(e.codigo),
      nombre: texto(e.nombre),
      ...cifrasDelControl(e),
    })).filter((e) => e.codigo),
    porRegion: lista(r.por_region).map((e) => ({ region: texto(e.region), ...cifrasDelControl(e) })).filter((e) => e.region),
    resumen: {
      asignadas: entero(resumen.asignadas),
      coinciden: entero(resumen.coinciden),
      coincidenConOtros: entero(resumen.coinciden_con_otros),
      otroEncuestador: entero(resumen.otro_encuestador),
      sinRespuestas: entero(resumen.sin_respuestas),
      sinPlanificar: entero(resumen.sin_planificar),
      conEstadoDeclarado: entero(resumen.con_estado_declarado),
      contrastes: entero(resumen.contrastes),
      conConteos: entero(resumen.con_conteos),
      conteosDistintos: entero(resumen.conteos_distintos),
      conRegistroCoordinacion: entero(resumen.con_registro_coordinacion),
      coordinacionDistinta: entero(resumen.coordinacion_distinta),
      supervisionAprobadas: enteroONulo(resumen.supervision_aprobadas),
      supervisionNoAprobadas: enteroONulo(resumen.supervision_no_aprobadas),
    },
  };
}

export async function getMonitoreoTerritorialAsignacionPlanificada(): Promise<AsignacionPlanificada> {
  return normalizeAsignacionPlanificada(
    await handle<unknown>(await apiFetch("/api/monitoreo/territorial/asignacion-planificada", { headers: headers() })),
  );
}
