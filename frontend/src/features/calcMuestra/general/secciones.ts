/**
 * Lo que cada sección de Muestra general y Acreditación dice de sí misma
 * (C1), y los motivos que la mesa muestra cuando algo aún no se puede hacer.
 * Textos breves: la sección se declara, no se explica.
 */
import type { CalcMuestraComponente } from "../../../api/calcMuestra";
import { safeNumber } from "../sharedCore";

export type ModoMesa = "marco_disponible" | "acreditacion";

export type EncabezadoDeSeccion = { titulo: string; linea: string };

export const MODO_ETIQUETA: Record<ModoMesa, string> = {
  marco_disponible: "Muestra general",
  acreditacion: "Acreditación",
};

const ENCABEZADOS: Record<ModoMesa, Record<string, EncabezadoDeSeccion>> = {
  marco_disponible: {
    marco: { titulo: "Marco", linea: "Qué unidades hay, en qué archivo y con qué variables de control." },
    metodo: { titulo: "Método", linea: "La técnica, los parámetros que usa y cómo sale el n." },
    seleccion: { titulo: "Selección", linea: "Sorteo reproducible del marco, con π y peso por unidad." },
    resultados: { titulo: "Resultados", linea: "El n calculado, su reparto y la propuesta." },
  },
  acreditacion: {
    actores: { titulo: "Actores", linea: "Marco, canal y meta mínima de cada actor." },
    contexto: { titulo: "Contexto", linea: "Datos del estudio que van al reporte." },
    seleccion: { titulo: "Selección", linea: "Marco y sorteo de cada actor, con π y peso." },
    resultados: { titulo: "Resultados", linea: "Meta y n de cada actor." },
  },
};

export function encabezadoDeSeccion(modo: ModoMesa, seccion: string): EncabezadoDeSeccion {
  const secciones = ENCABEZADOS[modo];
  return secciones[seccion] ?? Object.values(secciones)[0];
}

/** Algún componente tiene un n calculado (lo mismo que habilita el reporte). */
export function hayResultado(componentes: readonly CalcMuestraComponente[]): boolean {
  return componentes.some((c) => Boolean(c.resultado) && safeNumber(c.resultado?.n_objetivo, 0) > 0);
}

/** Por qué el reporte está deshabilitado; `null` si se puede generar. */
export function motivoReporteDeshabilitado(resultados: number): string | null {
  return resultados > 0 ? null : "Calcula primero: el reporte necesita un n calculado.";
}

export type VacioDeResultados = {
  titulo: string;
  pista: string;
  accion: { etiqueta: string; seccion: string | null };
};

/**
 * El vacío de Resultados dice qué falta y a dónde ir (C3). Sin marco, a
 * Marco (o Actores); con marco, falta calcular.
 */
export function vacioDeResultados(modo: ModoMesa, componentes: readonly CalcMuestraComponente[]): VacioDeResultados {
  const conMarco = componentes.some((c) => safeNumber(c.marco?.marco_validado, 0) > 0);
  const motivo = "El reporte se habilita con el primer cálculo.";
  if (modo === "acreditacion") {
    return conMarco
      ? { titulo: "Falta calcular", pista: `Hay marcos declarados pero ningún actor calculado. ${motivo}`, accion: { etiqueta: "Calcular", seccion: null } }
      : { titulo: "Ningún actor tiene marco", pista: `Declara el N de cada actor en Actores y calcula. ${motivo}`, accion: { etiqueta: "Ir a Actores", seccion: "actores" } };
  }
  return conMarco
    ? { titulo: "Falta calcular", pista: `El marco está declarado; calcula el n con los parámetros de Método. ${motivo}`, accion: { etiqueta: "Calcular", seccion: null } }
    : { titulo: "Sin marco todavía", pista: `Declara el marco (N) y calcula el n en Método. ${motivo}`, accion: { etiqueta: "Ir a Marco", seccion: "marco" } };
}

export type OrigenDeTecnica = { etiqueta: string; detalle: string };

const REGLAS_SIN_INFERENCIA = new Set(["", "manual", "sin_inferencia"]);

/**
 * De dónde sale la técnica de un actor de Acreditación: el cuadro maestro
 * PULSO la infiere desde actor, canal y N; sin N o sin canal no hay inferencia
 * y el actor conserva la técnica con que se creó.
 */
export function origenDeTecnica(comp: CalcMuestraComponente): OrigenDeTecnica {
  const inferencia = comp.inferencia_acreditacion;
  const regla = inferencia?.regla ?? "";
  if (!REGLAS_SIN_INFERENCIA.has(regla)) {
    return { etiqueta: "Cuadro maestro", detalle: inferencia?.justificacion ?? "" };
  }
  if (regla === "sin_inferencia") {
    return { etiqueta: "Sin regla del cuadro", detalle: inferencia?.justificacion ?? "" };
  }
  if (!(safeNumber(comp.marco?.marco_validado, 0) > 0)) {
    return { etiqueta: "Sin N: técnica inicial", detalle: "Ingresa el marco para que el cuadro maestro infiera la técnica." };
  }
  if (comp.canal_recojo === "sin_definir") {
    return { etiqueta: "Sin canal: técnica inicial", detalle: "Define el canal para que el cuadro maestro infiera la técnica." };
  }
  if (comp.actor_categoria === "otros") {
    return { etiqueta: "Técnica manual", detalle: "El cuadro maestro no tiene regla para este actor." };
  }
  return { etiqueta: "Se infiere al calcular", detalle: "El cuadro maestro fija la técnica al calcular con este N y canal." };
}
