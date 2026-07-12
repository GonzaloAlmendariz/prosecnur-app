/**
 * Capa de dominio del recorrido muestral universitario — MOTOR.
 *
 * Funciones puras que reproducen el método HSyVBG documentado:
 *   - tamaño de muestra (poblaciones finitas + deff) — reutiliza motorPreview
 *     (paridad TS↔R blindada por paridad-motor.test.ts),
 *   - afijación proporcional facultad × sexo con ajuste de cuadratura
 *     determinístico (regla del .qmd: el faltante va a la facultad de mayor
 *     población, sexo mayoritario),
 *   - aulas por aplicar = CEIL(sobremuestra / estudiantes-por-aula), con
 *     estudiantes-por-aula = mín(mediana, media) por facultad (configurable),
 *   - bolsa operativa (+k aulas por facultad),
 *   - escenario 2 (escalones por tamaño, p por facultad, deff propio),
 *   - cobertura del cruce alumno × aula y factibilidad por facultad.
 *
 * Nada aquí importa React ni toca red: la capa visual consume estos cálculos.
 */
import { calcEPreview, calcNPreview, zFromConfidence } from "../didactica/motorPreview";
import type {
  ConfigEscenario2,
  CuotaFacultad,
  DecisionesRecorrido,
  FacultadDatos,
  FilaCobertura,
  FilaEscenario2,
  ParametrosMuestra,
  PerfilInstitucional,
  ResultadoEscenario1,
  ResultadoEscenario2,
  ResumenEstAula,
  TrazaCuadratura,
} from "./tipos";

/** Redondeo half-up (el de las plantillas del método), no banker's rounding. */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/** n de la fórmula de poblaciones finitas + deff, sin redondeo de diseño. */
export function nFormula(N: number, parametros: ParametrosMuestra): number | null {
  const z = zFromConfidence(parametros.confianza);
  return calcNPreview(N, parametros.proporcion, z, parametros.margenError, parametros.deff);
}

/** Margen de error implícito de un n dado (ej. el de la cifra de diseño). */
export function errorImplicito(n: number, N: number, parametros: ParametrosMuestra): number | null {
  const z = zFromConfidence(parametros.confianza);
  return calcEPreview(n, N, parametros.proporcion, z, parametros.deff);
}

/** Población total del perfil (suma de facultades). */
export function poblacionTotal(facultades: FacultadDatos[]): number {
  return facultades.reduce((acc, f) => acc + f.N, 0);
}

/** Estudiantes por aula de una facultad según el resumen configurado. */
export function estudiantesPorAula(facultad: FacultadDatos, resumen: ResumenEstAula): number | null {
  const { estAulaMediana: mediana, estAulaMedia: media } = facultad;
  if (resumen === "mediana") return mediana;
  if (resumen === "media") return media;
  if (mediana == null) return media;
  if (media == null) return mediana;
  return Math.min(mediana, media);
}

/**
 * Afijación proporcional facultad × sexo + ajuste de cuadratura.
 *
 * Paso 1: n_fac = round(n_total × N_fac / N).
 * Paso 2: n_mujeres = round(n_fac × mujeres_fac / N_fac); hombres toma el
 *         resto para preservar n_fac.
 * Paso 3: cuadratura determinística — el faltante (n_total − Σ) se asigna
 *         íntegro a la facultad de mayor población, en su sexo mayoritario.
 */
export function afijacion(
  facultades: FacultadDatos[],
  nTotal: number,
): { cuotas: Omit<CuotaFacultad, "sobremuestra" | "estAula" | "aulas">[]; cuadratura: TrazaCuadratura } {
  const N = poblacionTotal(facultades);
  const cuotas = facultades.map((f) => {
    const n = N > 0 ? roundHalfUp((nTotal * f.N) / N) : 0;
    const nMujeres = f.N > 0 ? roundHalfUp((n * f.mujeres) / f.N) : 0;
    return {
      facultadId: f.id,
      nombre: f.nombre,
      N: f.N,
      n,
      nMujeres,
      nHombres: n - nMujeres,
      ajuste: 0,
    };
  });

  const suma = cuotas.reduce((acc, c) => acc + c.n, 0);
  const faltante = nTotal - suma;
  const cuadratura: TrazaCuadratura = {
    sumaRedondeada: suma,
    objetivo: nTotal,
    faltante,
    facultadAjustada: null,
    sexoAjustado: null,
  };

  if (faltante !== 0 && cuotas.length > 0) {
    const mayor = facultades.reduce((a, b) => (b.N > a.N ? b : a));
    const cuota = cuotas.find((c) => c.facultadId === mayor.id)!;
    const sexo = mayor.hombres > mayor.mujeres ? "hombres" : "mujeres";
    cuota.n += faltante;
    if (sexo === "hombres") cuota.nHombres += faltante;
    else cuota.nMujeres += faltante;
    cuota.ajuste = faltante;
    cuadratura.facultadAjustada = mayor.id;
    cuadratura.sexoAjustado = sexo;
  }
  return { cuotas, cuadratura };
}

/** Aulas por aplicar de una facultad: CEIL(sobremuestra / estudiantes-por-aula). */
export function aulasFacultad(sobremuestra: number, estAula: number | null): number | null {
  if (estAula == null || estAula <= 0) return null;
  return Math.ceil(sobremuestra / estAula);
}

/** Escenario 1 completo: fórmula → cifra de diseño → afijación → aulas → bolsa. */
export function escenario1(
  perfil: PerfilInstitucional,
  decisiones: Pick<DecisionesRecorrido, "parametros" | "bolsaExtraPorFacultad">,
): ResultadoEscenario1 {
  const { parametros, bolsaExtraPorFacultad } = decisiones;
  const N = poblacionTotal(perfil.facultades);
  const formula = nFormula(N, parametros) ?? 0;
  const nDiseno = parametros.nDiseno ?? formula;
  const { cuotas: cuotasBase, cuadratura } = afijacion(perfil.facultades, nDiseno);

  const cuotas: CuotaFacultad[] = cuotasBase.map((cuota) => {
    const facultad = perfil.facultades.find((f) => f.id === cuota.facultadId)!;
    const sobremuestra = roundHalfUp(cuota.n * parametros.factorSobremuestra);
    const estAula = estudiantesPorAula(facultad, perfil.resumenEstAula);
    const base = aulasFacultad(sobremuestra, estAula);
    return {
      ...cuota,
      sobremuestra,
      estAula,
      aulas: base == null ? null : base + bolsaExtraPorFacultad,
    };
  });

  const aulasBase = cuotas.reduce((acc, c) => acc + Math.max((c.aulas ?? 0) - bolsaExtraPorFacultad, 0), 0);
  return {
    N,
    nFormula: formula,
    nDiseno,
    errorImplicito: errorImplicito(nDiseno, N, parametros),
    cuotas,
    cuadratura,
    totalMujeres: cuotas.reduce((acc, c) => acc + c.nMujeres, 0),
    totalHombres: cuotas.reduce((acc, c) => acc + c.nHombres, 0),
    sobremuestraTotal: cuotas.reduce((acc, c) => acc + c.sobremuestra, 0),
    aulasBase,
    aulasConBolsa: cuotas.reduce((acc, c) => acc + (c.aulas ?? 0), 0),
  };
}

/** Escalón del E2 que corresponde a una facultad según su población. */
export function escalonPara(config: ConfigEscenario2, N: number) {
  const ordenados = [...config.escalones].sort((a, b) => b.nDesde - a.nDesde);
  return ordenados.find((esc) => N >= esc.nDesde) ?? ordenados[ordenados.length - 1];
}

/**
 * Escenario 2: cada facultad como estrato propio. Recomputa n con la fórmula
 * (escalón por tamaño + p propia + deff del E2) y, si el perfil trae la tabla
 * oficial, la expone al lado — la UI enseña ambas cifras, como 2,500 vs 2,353.
 */
export function escenario2(perfil: PerfilInstitucional): ResultadoEscenario2 | null {
  const config = perfil.escenario2;
  if (!config) return null;
  const filas: FilaEscenario2[] = perfil.facultades.map((f) => {
    const escalon = escalonPara(config, f.N);
    const p = f.pExito ?? config.proporcionFallback;
    const parametros: ParametrosMuestra = {
      confianza: escalon.confianza,
      margenError: escalon.margenError,
      proporcion: p,
      deff: config.deff,
      factorSobremuestra: config.factorSobremuestra,
      nDiseno: null,
    };
    const oficial = config.tablaOficial?.[f.id] ?? null;
    return {
      facultadId: f.id,
      nombre: f.nombre,
      N: f.N,
      p,
      confianza: escalon.confianza,
      margenError: escalon.margenError,
      nFormula: nFormula(f.N, parametros) ?? 0,
      nOficial: oficial?.n ?? null,
      W: oficial?.W ?? null,
      aulasOficial: oficial?.aulas ?? null,
    };
  });
  const totalOficial = config.tablaOficial
    ? filas.reduce((acc, f) => acc + (f.nOficial ?? 0), 0)
    : null;
  const referencia = config.totalDiseno ?? totalOficial ?? filas.reduce((acc, f) => acc + f.nFormula, 0);
  return {
    filas,
    totalFormula: filas.reduce((acc, f) => acc + f.nFormula, 0),
    totalOficial,
    totalDiseno: config.totalDiseno,
    aulasOficial: config.tablaOficial
      ? filas.reduce((acc, f) => acc + (f.aulasOficial ?? 0), 0)
      : null,
    sobremuestraTotal: config.sobremuestraOficial ?? roundHalfUp(referencia * config.factorSobremuestra),
  };
}

/**
 * Cobertura del cruce alumno × aula por facultad: elegibles alcanzables y
 * factibilidad (la población alcanzable debe superar la sobremuestra).
 */
export function cobertura(
  perfil: PerfilInstitucional,
  cuotas: CuotaFacultad[],
): { filas: FilaCobertura[]; totalElegibles: number; totalAlcanzables: number | null; pctGlobal: number | null } {
  const filas: FilaCobertura[] = perfil.facultades.map((f) => {
    const cuota = cuotas.find((c) => c.facultadId === f.id);
    const sobremuestra = cuota?.sobremuestra ?? 0;
    return {
      facultadId: f.id,
      nombre: f.nombre,
      elegibles: f.N,
      alcanzables: f.alcanzables,
      pct: f.alcanzables == null || f.N === 0 ? null : f.alcanzables / f.N,
      sobremuestra,
      factible: f.alcanzables == null ? null : f.alcanzables >= sobremuestra,
    };
  });
  const totalElegibles = filas.reduce((acc, f) => acc + f.elegibles, 0);
  const conDato = filas.filter((f) => f.alcanzables != null);
  const totalAlcanzables = conDato.length === filas.length
    ? conDato.reduce((acc, f) => acc + (f.alcanzables ?? 0), 0)
    : null;
  return {
    filas,
    totalElegibles,
    totalAlcanzables,
    pctGlobal: totalAlcanzables == null || totalElegibles === 0 ? null : totalAlcanzables / totalElegibles,
  };
}

/** Salto sistemático: k = tamaño del marco / aulas a seleccionar. */
export function saltoK(marcoAulas: number | null, aulas: number): number | null {
  if (marcoAulas == null || marcoAulas <= 0 || aulas <= 0) return null;
  return marcoAulas / aulas;
}

/** Decisiones por defecto para un perfil (el canon del preset). */
export function decisionesPorDefecto(perfil: PerfilInstitucional): DecisionesRecorrido {
  return {
    parametros: { ...perfil.parametros },
    opcionalesActivos: [],
    bolsaExtraPorFacultad: perfil.bolsaOpciones[perfil.bolsaSugerida] ?? 0,
    escenario: "e1",
  };
}
