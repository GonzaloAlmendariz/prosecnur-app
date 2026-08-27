/**
 * El criterio de aceptación de la rerandomización, construido desde el estudio.
 *
 * ADR 0082 (aceptado 2026-08-27): rerandomizar es aceptar o rechazar contra un
 * criterio fijado ANTES de sortear, y ese criterio es **dato, no código**, para
 * que el `.pulso` lo persista y el sustento pueda citarlo. El motor lo recibe
 * en `selector.rerandomizacion` y devuelve la tasa de aceptación con la corrida.
 *
 * Los tres ingredientes ya existen y no hacía falta pedirle nada al usuario:
 *
 * - la **cuota** de cada facultad, en `aulas_por_estrato[].cuota`;
 * - **τ**, en `aulas_por_estrato[].tau` (lo que rinde un elegible);
 * - el **reparto por sexo**, en `marco_prop_mujeres` de `sexo_por_facultad`,
 *   que es la proporción del MARCO y no la de la muestra: el criterio compara
 *   contra lo que el diseño pide, no contra lo que un sorteo produjo.
 *
 * Una facultad sin τ o sin proporción de mujeres **no entra** al criterio. Es
 * deliberado: incluirla con un τ inventado haría que el sorteo se aceptara o
 * rechazara por un número que nadie midió.
 */
import type {
  CalcMuestraAulasEstrato,
  CalcMuestraComponente,
  CalcMuestraSexoPorFacultad,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { claveFacultad } from "../../dominio/rangosNivel";
import { safeNumber } from "../../sharedCore";

export type CriterioCelda = {
  faculty_key: string;
  facultad: string;
  cuota_f: number;
  cuota_m: number;
  tau: number;
};

export type CriterioRerandomizacion = {
  tipo: "cobertura_celdas";
  umbral: number;
  celdas: CriterioCelda[];
};

export type CriterioResumen = {
  criterio: CriterioRerandomizacion | null;
  /** Facultades que quedaron fuera y por qué. Sin esto, un criterio corto se
   *  lee como si cubriera todo. */
  omitidas: Array<{ facultad: string; motivo: "sin_tau" | "sin_reparto_sexo" | "sin_cuota" }>;
};

/** El umbral del ADR: toda celda alcanza su cuota. */
export const UMBRAL_COBERTURA_POR_DEFECTO = 1;

/** Cincuenta, que es lo que costó el diseño de HSVG 2026: 25 de 50 sorteos
 *  cerraban las 30 celdas. Con un criterio más duro la espera crece rápido. */
export const TOPE_SORTEOS_POR_DEFECTO = 50;

export function criterioRerandomizacionDesdeEstudio(
  componente: CalcMuestraComponente | null | undefined,
  sexoPorFacultad: CalcMuestraSexoPorFacultad | null | undefined,
  umbral: number = UMBRAL_COBERTURA_POR_DEFECTO,
): CriterioResumen {
  const filas = (componente?.resultado?.aulas_por_estrato ?? []) as CalcMuestraAulasEstrato[];
  const omitidas: CriterioResumen["omitidas"] = [];
  if (!filas.length) return { criterio: null, omitidas };

  const propPorClave = new Map<string, number>();
  for (const fila of sexoPorFacultad?.filas ?? []) {
    const prop = safeNumber(fila.marco_prop_mujeres, Number.NaN);
    const clave = fila.faculty_key || claveFacultad(fila.facultad);
    if (clave && Number.isFinite(prop) && prop >= 0 && prop <= 1) propPorClave.set(clave, prop);
  }

  const celdas: CriterioCelda[] = [];
  for (const fila of filas) {
    const facultad = String(fila.estrato ?? "");
    const clave = claveFacultad(facultad);
    if (!clave) continue;
    const cuota = safeNumber(fila.cuota, 0);
    if (!(cuota > 0)) { omitidas.push({ facultad, motivo: "sin_cuota" }); continue; }
    const tau = safeNumber((fila as { tau?: unknown }).tau, Number.NaN);
    if (!Number.isFinite(tau) || tau <= 0 || tau > 1) { omitidas.push({ facultad, motivo: "sin_tau" }); continue; }
    const prop = propPorClave.get(clave);
    if (prop == null) { omitidas.push({ facultad, motivo: "sin_reparto_sexo" }); continue; }
    celdas.push({
      faculty_key: clave,
      facultad,
      cuota_f: cuota * prop,
      cuota_m: cuota * (1 - prop),
      tau,
    });
  }

  // Un criterio sin celdas no es un criterio laxo: es la ausencia de criterio, y
  // el motor lo rechaza en vez de encender una rerandomización que no evalúa
  // nada. Se devuelve null para que la pantalla pueda decir por qué.
  if (!celdas.length) return { criterio: null, omitidas };
  return { criterio: { tipo: "cobertura_celdas", umbral, celdas }, omitidas };
}

/**
 * Adjunta el criterio a la config con la que se va a sortear.
 *
 * Mismo patrón que `conAfijacionDelEstudio`: la pantalla no inventa el dato, lo
 * deriva del estudio y lo cuelga de la config.
 *
 * **El criterio se adjunta siempre; encender la rerandomización es otra cosa.**
 * Adjuntarlo hace que el `.pulso` lo recuerde y que el sustento pueda citarlo,
 * como pide el ADR. Encenderla cambia el diseño —la muestra pasa a salir de la
 * condicional dado el criterio— y eso es una decisión del analista, no un
 * efecto colateral de abrir una pantalla: `activa` sólo se respeta si venía
 * declarada.
 */
export function conRerandomizacionDelEstudio(
  config: CalcMuestraWorkspaceAulasConfig,
  componente: CalcMuestraComponente | null | undefined,
  sexoPorFacultad: CalcMuestraSexoPorFacultad | null | undefined,
): CalcMuestraWorkspaceAulasConfig {
  const previo = config.rerandomizacion;
  const { criterio } = criterioRerandomizacionDesdeEstudio(
    componente,
    sexoPorFacultad,
    previo?.criterio?.umbral ?? UMBRAL_COBERTURA_POR_DEFECTO,
  );
  // Sin criterio construible no se toca la config: dejarla con un criterio
  // vacío encendería una rerandomización que no evalúa nada, y el motor la
  // apagaría igual pero sin que nadie supiera por qué.
  if (!criterio) {
    if (!previo) return config;
    return { ...config, rerandomizacion: { ...previo, activa: false, criterio: null } };
  }
  return {
    ...config,
    rerandomizacion: {
      activa: previo?.activa === true,
      tope: previo?.tope && previo.tope > 0 ? previo.tope : TOPE_SORTEOS_POR_DEFECTO,
      criterio: {
        tipo: criterio.tipo,
        umbral: criterio.umbral,
        celdas: criterio.celdas.map(({ faculty_key, cuota_f, cuota_m, tau }) => ({
          faculty_key, cuota_f, cuota_m, tau,
        })),
      },
    },
  };
}
