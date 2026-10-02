/**
 * Lógica pura de Muestra general › Marco (archivo) y › Selección (ADR 0090).
 *
 * Aquí viven los dos reducers de formulario —para no apilar `useState` en los
 * componentes—, la reconciliación del estudio tras declarar el marco y el
 * formateo de π y pesos. Nada de esto redondea un dato: sólo decide cómo se
 * PINTA. El valor exacto viaja intacto desde el normalizador.
 */
import type {
  CalcMuestraAulasFileInspection,
  CalcMuestraComponente,
  CalcMuestraEstudio,
  CalcMuestraTecnica,
} from "../../../api/calcMuestra";
import {
  CALC_MUESTRA_GENERAL_SEMILLA_DEFAULT,
  type CalcMuestraGeneralCorrida,
  type CalcMuestraGeneralErrorDetalle,
  type CalcMuestraGeneralMarco,
  type CalcMuestraGeneralMetodo,
  type CalcMuestraGeneralUnidad,
} from "../../../api/calcMuestraGeneral";
import { fmtDec, fmtInt, fmtPct } from "../sharedCore";
import { proponerColumnas } from "./propuestaColumnas";

// ---------------------------------------------------------------------------
// Error del motor, listo para pintar
// ---------------------------------------------------------------------------

export type ErrorGeneral = {
  /** «mensaje · CODIGO», tal como lo compone `ApiError`. */
  texto: string;
  /** El código `E_*`, o "" si el error no vino del motor. */
  codigo: string;
  detalle: CalcMuestraGeneralErrorDetalle | null;
};

export function errorGeneralDesde(e: unknown): ErrorGeneral {
  const texto = e instanceof Error ? e.message : typeof e === "string" ? e : "No se pudo completar.";
  const codigo = (e as { code?: unknown } | null)?.code;
  const detalle = (e as { detalle?: CalcMuestraGeneralErrorDetalle } | null)?.detalle ?? null;
  return { texto, codigo: typeof codigo === "string" ? codigo : "", detalle };
}

export const CODIGO_TECNICA_SIN_SORTEO = "E_CALC_MUESTRA_GENERAL_TECNICA";

/**
 * Qué hará el motor al sortear según la técnica del componente. Sólo orienta
 * la pantalla antes de pedir nada: si el motor responde otra cosa, manda él.
 */
export function modalidadDeTecnica(tecnica: CalcMuestraTecnica | undefined): "probabilistica" | "censo" | "sin_sorteo" {
  // Sin técnica todavía (componente a medio crear): decide el motor.
  if (!tecnica) return "probabilistica";
  if (tecnica === "intencion_censal" || tecnica === "barrido") return "censo";
  // La misma lista que `.CM_TECNICAS_DE_ELEMENTOS` del motor: el resto
  // recibe 409 E_CALC_MUESTRA_GENERAL_TECNICA.
  return TECNICAS_DE_ELEMENTOS.has(tecnica) ? "probabilistica" : "sin_sorteo";
}

const TECNICAS_DE_ELEMENTOS: ReadonlySet<CalcMuestraTecnica> = new Set<CalcMuestraTecnica>([
  "prob_aleatorio_simple",
  "prob_estratificado",
  "sistematico",
]);

/** La técnica se resuelve con la cadena de elementos y trae memoria sustituida. */
export function esTecnicaDeElementos(tecnica: CalcMuestraTecnica | undefined): boolean {
  return tecnica != null && TECNICAS_DE_ELEMENTOS.has(tecnica);
}

/** Probabilísticas que el sorteo de elementos no cubre (se sortean por etapas o en otra parte). */
const PROBABILISTICAS_FUERA_DEL_SORTEO: ReadonlySet<string> = new Set([
  "prob_conglomerado_multietapico",
  "prob_estratificado_independiente",
  "medicion_recurrente",
]);

export function motivoSinSorteo(tecnica: string): string {
  if (PROBABILISTICAS_FUERA_DEL_SORTEO.has(tecnica)) {
    return `La técnica «${tecnica}» no selecciona elementos de un marco único: esta selección no la cubre.`;
  }
  return `La técnica «${tecnica}» no selecciona unidades con probabilidad conocida: no hay selección ni probabilidad de selección (π) que publicar.`;
}

export const TEXTO_COBERTURA_CENSAL = "Cobertura censal: el marco entero en orden aleatorio de contacto (π = 1).";

// ---------------------------------------------------------------------------
// Archivo del marco
// ---------------------------------------------------------------------------

export type HojaMarco = { nombre: string; columnas: string[] };

export type ArchivoMarco = {
  file_id: string;
  nombre: string;
  /** `workbook` exige hoja; `table` (CSV) no la envía. */
  esLibro: boolean;
  hojas: HojaMarco[];
};

export type ColumnasElegidas = { id: string; estrato: string; tamano: string };

export type ArchivoMarcoEstado = {
  fase: "inicial" | "subiendo" | "listo" | "declarando";
  /** El formulario está abierto aunque ya haya un marco declarado. */
  editando: boolean;
  archivo: ArchivoMarco | null;
  hoja: string;
  columnas: ColumnasElegidas;
  /** Lo que se propuso por el nombre de cada columna; el formulario lo señala. */
  propuestas: ColumnasElegidas;
  error: ErrorGeneral | null;
};

export type ArchivoMarcoAccion =
  | { tipo: "editar" }
  | { tipo: "cancelar" }
  | { tipo: "subiendo" }
  | { tipo: "subido"; archivo: ArchivoMarco; hoja: string }
  | { tipo: "hoja"; hoja: string }
  | { tipo: "columna"; rol: keyof ColumnasElegidas; valor: string }
  | { tipo: "declarando" }
  | { tipo: "declarado" }
  | { tipo: "fallo"; error: ErrorGeneral };

export const ARCHIVO_MARCO_INICIAL: ArchivoMarcoEstado = {
  fase: "inicial",
  editando: false,
  archivo: null,
  hoja: "",
  columnas: { id: "", estrato: "", tamano: "" },
  propuestas: { id: "", estrato: "", tamano: "" },
  error: null,
};

export function columnasDeHoja(archivo: ArchivoMarco | null, hoja: string): string[] {
  if (!archivo) return [];
  return archivo.hojas.find((h) => h.nombre === hoja)?.columnas ?? archivo.hojas[0]?.columnas ?? [];
}

/** La columna de id que se propone por su nombre (ver `proponerColumnas`). */
export function sugerirColumnaId(columnas: readonly string[]): string {
  return proponerColumnas(columnas).id;
}

function conPropuesta(columnas: readonly string[]): Pick<ArchivoMarcoEstado, "columnas" | "propuestas"> {
  const propuestas = proponerColumnas(columnas);
  return { columnas: { ...propuestas }, propuestas };
}

export function archivoMarcoReducer(estado: ArchivoMarcoEstado, accion: ArchivoMarcoAccion): ArchivoMarcoEstado {
  switch (accion.tipo) {
    case "editar":
      return { ...estado, editando: true, error: null };
    case "cancelar":
      return { ...ARCHIVO_MARCO_INICIAL };
    case "subiendo":
      return { ...estado, fase: "subiendo", editando: true, error: null };
    case "subido": {
      const columnas = columnasDeHoja(accion.archivo, accion.hoja);
      return {
        ...estado,
        fase: "listo",
        editando: true,
        archivo: accion.archivo,
        hoja: accion.hoja,
        ...conPropuesta(columnas),
        error: null,
      };
    }
    case "hoja": {
      const columnas = columnasDeHoja(estado.archivo, accion.hoja);
      return {
        ...estado,
        hoja: accion.hoja,
        ...conPropuesta(columnas),
        error: null,
      };
    }
    case "columna":
      return { ...estado, columnas: { ...estado.columnas, [accion.rol]: accion.valor }, error: null };
    case "declarando":
      return { ...estado, fase: "declarando", error: null };
    case "declarado":
      return { ...ARCHIVO_MARCO_INICIAL };
    case "fallo":
      return { ...estado, fase: estado.archivo ? "listo" : "inicial", error: accion.error };
  }
}

/** Traduce la inspección del motor a lo que el formulario necesita. */
export function archivoDesdeInspeccion(
  file_id: string,
  nombre: string,
  inspection: CalcMuestraAulasFileInspection,
): { archivo: ArchivoMarco; hoja: string } {
  const hojas: HojaMarco[] = (inspection.sheets ?? [])
    .filter((s) => typeof s?.name === "string" && s.name)
    .map((s) => ({ nombre: s.name, columnas: (s.columns_sample ?? []).filter((c): c is string => typeof c === "string" && c !== "") }));
  const esLibro = inspection.type !== "table";
  // En un libro, la primera hoja con columnas; la sugerida del motor está
  // pensada para bases de aulas y no dice nada de un padrón general.
  const hoja = hojas.find((h) => h.columnas.length > 0)?.nombre ?? hojas[0]?.nombre ?? "";
  return { archivo: { file_id, nombre, esLibro, hojas }, hoja };
}

export function puedeDeclarar(estado: ArchivoMarcoEstado): boolean {
  return estado.fase === "listo" && Boolean(estado.archivo) && Boolean(estado.columnas.id);
}

/**
 * Tras declarar, el estudio de la respuesta es la verdad del backend. Si el
 * usuario editó mientras viajaba la petición, esas ediciones se conservan y
 * sólo se sustituye el componente declarado.
 */
export function reconciliarEstudio(args: {
  componenteId: string;
  actual: CalcMuestraEstudio;
  enviado: CalcMuestraEstudio;
  estudioRespuesta: CalcMuestraEstudio | null;
  componenteRespuesta: CalcMuestraComponente | null;
}): { estudio: CalcMuestraEstudio; limpio: boolean } | null {
  const { componenteId, actual, enviado, estudioRespuesta, componenteRespuesta } = args;
  if (actual === enviado && estudioRespuesta) return { estudio: estudioRespuesta, limpio: true };
  const componente = componenteRespuesta?.id === componenteId
    ? componenteRespuesta
    : estudioRespuesta?.componentes.find((c) => c.id === componenteId) ?? null;
  if (!componente || !actual.componentes.some((c) => c.id === componenteId)) return null;
  return {
    estudio: {
      ...actual,
      componentes: actual.componentes.map((c) => (c.id === componente.id ? componente : c)),
    },
    limpio: false,
  };
}

// ---------------------------------------------------------------------------
// Selección
// ---------------------------------------------------------------------------

export type FiltroUnidades = "todas" | "titular" | "reserva";

export type SeleccionEstado = {
  metodo: CalcMuestraGeneralMetodo;
  /** Texto del input: se valida al sortear, no al teclear. */
  semilla: string;
  ordenPor: string;
  reservas: string;
  sorteando: boolean;
  error: ErrorGeneral | null;
  filtro: FiltroUnidades;
  pagina: number;
  /** run_id con el que se precargó el formulario (evita pisar lo tecleado). */
  precargadoDe: string;
  /**
   * El motor rechazó la técnica (409 E_CALC_MUESTRA_GENERAL_TECNICA): su
   * mensaje y la técnica a la que se refiere. Sortear queda bloqueado hasta
   * que la técnica cambie.
   */
  bloqueo: { tecnica: string; texto: string } | null;
};

export type SeleccionAccion =
  | { tipo: "metodo"; metodo: CalcMuestraGeneralMetodo }
  | { tipo: "semilla"; valor: string }
  | { tipo: "ordenPor"; valor: string }
  | { tipo: "reservas"; valor: string }
  | { tipo: "sorteando" }
  | { tipo: "sorteado"; corrida: CalcMuestraGeneralCorrida }
  | { tipo: "fallo"; error: ErrorGeneral; tecnica: string }
  | { tipo: "filtro"; filtro: FiltroUnidades }
  | { tipo: "pagina"; pagina: number }
  | { tipo: "precargar"; corrida: CalcMuestraGeneralCorrida };

export const SELECCION_INICIAL: SeleccionEstado = {
  metodo: "mas",
  semilla: String(CALC_MUESTRA_GENERAL_SEMILLA_DEFAULT),
  ordenPor: "",
  reservas: "0",
  sorteando: false,
  error: null,
  filtro: "todas",
  pagina: 0,
  precargadoDe: "",
  bloqueo: null,
};

export function seleccionReducer(estado: SeleccionEstado, accion: SeleccionAccion): SeleccionEstado {
  switch (accion.tipo) {
    case "metodo":
      return { ...estado, metodo: accion.metodo, error: null };
    case "semilla":
      return { ...estado, semilla: accion.valor, error: null };
    case "ordenPor":
      return { ...estado, ordenPor: accion.valor, error: null };
    case "reservas":
      return { ...estado, reservas: accion.valor, error: null };
    case "sorteando":
      return { ...estado, sorteando: true, error: null };
    case "sorteado":
      return {
        ...estado,
        sorteando: false,
        error: null,
        pagina: 0,
        semilla: String(accion.corrida.corrida.semilla),
        precargadoDe: accion.corrida.corrida.run_id,
        bloqueo: null,
      };
    case "fallo":
      return accion.error.codigo === CODIGO_TECNICA_SIN_SORTEO
        ? { ...estado, sorteando: false, error: null, bloqueo: { tecnica: accion.tecnica, texto: accion.error.texto } }
        : { ...estado, sorteando: false, error: accion.error };
    case "filtro":
      return { ...estado, filtro: accion.filtro, pagina: 0 };
    case "pagina":
      return { ...estado, pagina: Math.max(0, accion.pagina) };
    case "precargar":
      if (estado.precargadoDe === accion.corrida.corrida.run_id) return estado;
      return {
        ...estado,
        metodo: accion.corrida.corrida.metodo,
        semilla: String(accion.corrida.corrida.semilla),
        precargadoDe: accion.corrida.corrida.run_id,
      };
  }
}

export const SEMILLA_MAXIMA = 2147483646;

/** Semilla válida (entero 1..2³¹−2) o `null`. */
export function semillaValida(texto: string): number | null {
  const t = texto.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n >= 1 && n <= SEMILLA_MAXIMA ? n : null;
}

export function nuevaSemilla(aleatorio: () => number = Math.random): number {
  return 1 + Math.floor(aleatorio() * SEMILLA_MAXIMA);
}

export function reservasValidas(texto: string): number | null {
  const t = texto.trim();
  if (t === "") return 0;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= 10000 ? n : null;
}

export type OpcionMetodo = {
  id: CalcMuestraGeneralMetodo;
  label: string;
  detalle: string;
  motivoDeshabilitado: string | null;
};

export function opcionesMetodo(marco: CalcMuestraGeneralMarco | null): OpcionMetodo[] {
  const sinTamano = !marco?.columnas.tamano;
  // Con estratos declarados el sorteo es dentro de cada estrato: la π es la
  // del estrato (n_h/N_h), no la del marco entero.
  const pi = marco?.columnas.estrato ? "π = n_h/N_h en cada estrato." : "π = n/N.";
  return [
    { id: "mas", label: "MAS", detalle: `Aleatorio simple sin reemplazo. ${pi}`, motivoDeshabilitado: null },
    { id: "sistematico", label: "Sistemático", detalle: `Intervalo fraccional sobre el marco ordenado. ${pi}`, motivoDeshabilitado: null },
    {
      id: "pps",
      label: "PPS",
      detalle: "Probabilidad proporcional al tamaño, con certezas.",
      motivoDeshabilitado: sinTamano ? "Declara una columna de tamaño en Marco para usar PPS." : null,
    },
  ];
}

export const MOTIVO_SIN_RESERVAS_PPS = "Con PPS no se seleccionan reemplazos: su probabilidad de selección (π) al liberarlos no sería exacta.";

export function etiquetaMetodo(metodo: CalcMuestraGeneralMetodo): string {
  return metodo === "sistematico" ? "Sistemático" : metodo === "pps" ? "PPS" : "MAS";
}

export function filtrarUnidades(
  unidades: readonly CalcMuestraGeneralUnidad[],
  filtro: FiltroUnidades,
): CalcMuestraGeneralUnidad[] {
  return filtro === "todas" ? [...unidades] : unidades.filter((u) => u.estado === filtro);
}

export const FILAS_POR_PAGINA = 50;

export function paginar<T>(lista: readonly T[], pagina: number, tam = FILAS_POR_PAGINA) {
  const paginas = Math.max(1, Math.ceil(lista.length / tam));
  const actual = Math.min(Math.max(0, pagina), paginas - 1);
  const desde = actual * tam;
  return {
    filas: lista.slice(desde, desde + tam),
    pagina: actual,
    paginas,
    desde: lista.length ? desde + 1 : 0,
    hasta: Math.min(lista.length, desde + tam),
  };
}

/**
 * π para leer: cuatro cifras significativas, sin notación científica y sin
 * ceros de relleno. 3.71e-5 se lee «0.0000371», no «0». El valor exacto va en
 * el `title` de la celda.
 */
export function formatearPi(pi: number | null): string {
  if (pi == null || !Number.isFinite(pi)) return "—";
  if (pi >= 1) return "1";
  if (pi <= 0) return "0";
  const exponente = Math.floor(Math.log10(pi));
  const decimales = Math.min(20, Math.max(0, 3 - exponente));
  return pi.toFixed(decimales).replace(/\.?0+$/, "");
}

/** Peso base con dos decimales; separador de miles de es-PE (coma). */
export function formatearPeso(peso: number | null): string {
  if (peso == null || !Number.isFinite(peso)) return "—";
  return fmtDec(peso, 2);
}

/**
 * @deprecated Usa `fmtInt` de `../sharedCore`: un solo formato es-PE en todo
 * Cálculo de muestra. Se conserva como alias para los consumidores que aún lo
 * importan.
 */
export function formatearEntero(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return fmtInt(n);
}

export function hashCorto(hash: string, largo = 10): string {
  return hash ? hash.slice(0, largo) : "—";
}

/**
 * «2026-09-27 08:25» en la hora local del equipo, a partir del ISO UTC que
 * publica el motor. Pintaba «13:25 UTC» a las 08:25 de Lima (L8, 2026-09-27);
 * el ISO sigue entero en el `title` y en el libro de entrega, que son registro.
 */
export function formatearFechaLocal(iso: string): string {
  if (!iso) return "—";
  const d = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return iso;
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/**
 * El n del componente cambió después de sortear: la corrida sigue siendo la
 * vigente, pero ya no responde al cálculo actual.
 */
export function nDesfasado(
  corrida: CalcMuestraGeneralCorrida | null,
  componente: CalcMuestraComponente | null,
): number | null {
  const actual = componente?.resultado?.n_operativo;
  if (!corrida || corrida.n_fuente == null || actual == null || !Number.isFinite(actual)) return null;
  return Math.round(actual) !== corrida.n_fuente ? Math.round(actual) : null;
}

// ---------------------------------------------------------------------------
// Libro de entrega
// ---------------------------------------------------------------------------

export type ExportEstado = { exportando: boolean; error: ErrorGeneral | null; ultimo: string };

export type ExportAccion =
  | { tipo: "exportando" }
  | { tipo: "exportado"; filename: string }
  | { tipo: "fallo"; error: ErrorGeneral };

export const EXPORT_INICIAL: ExportEstado = { exportando: false, error: null, ultimo: "" };

export function exportReducer(estado: ExportEstado, accion: ExportAccion): ExportEstado {
  switch (accion.tipo) {
    case "exportando":
      return { ...estado, exportando: true, error: null };
    case "exportado":
      return { exportando: false, error: null, ultimo: accion.filename };
    case "fallo":
      return { ...estado, exportando: false, error: accion.error };
  }
}

export const MOTIVO_SIN_CORRIDA_EXPORT = "Selecciona primero: el libro sale de la selección vigente.";

// ---------------------------------------------------------------------------
// Por qué un botón no se puede usar (E11 · V7)
// ---------------------------------------------------------------------------

/**
 * Por qué «Sortear» está deshabilitado, en una línea visible junto al botón.
 * El bloqueo de la técnica tiene su propio bloque y no pasa por aquí; mientras
 * se sortea el botón ya lo dice con su spinner.
 */
export function motivoNoSortear(args: {
  semillaValida: boolean;
  /** `false` en PPS y en cobertura censal: no llevan reservas. */
  usaReservas: boolean;
  reservasValidas: boolean;
}): string | null {
  if (!args.semillaValida) return "Falta una semilla válida para seleccionar.";
  if (args.usaReservas && !args.reservasValidas) return "Los reemplazos deben ser un entero de 0 a 10,000.";
  return null;
}

/** Por qué «Declarar marco» está deshabilitado; `null` si se puede declarar. */
export function motivoNoDeclarar(estado: ArchivoMarcoEstado): string | null {
  if (estado.fase === "subiendo" || estado.fase === "declarando") return null;
  if (!estado.archivo) return "Sube primero el archivo del marco.";
  if (!estado.columnas.id) return "Elige la columna de Id de la unidad.";
  return null;
}

// ---------------------------------------------------------------------------
// Acreditación › Actores: el campo de meta de cada fila (E11 · V11, V16)
// ---------------------------------------------------------------------------

/**
 * `detalle` es la frase entera (título y lector de pantalla); `piezas` son
 * sus unidades visibles: cada una cabe en una línea de la columna «Meta
 * mínima» a 1024 px y el salto sólo cae entre piezas, nunca dentro (V15).
 */
export type CampoMetaDelActor =
  /** Cuotas: el n que fija el usuario; vacío, el que sugiere el motor. */
  | { tipo: "cuota"; rotulo: string }
  /** Conveniencia o cobertura: la fracción del marco a cubrir. */
  | { tipo: "cobertura"; clave: "cobertura_objetivo"; rotulo: string; detalle: string; piezas: readonly string[] }
  /**
   * Muestra de elementos (MAS, estratificado, sistemático): el n completo se
   * infla por la respuesta esperada; lo que se lee es esa tasa y el margen,
   * no una sobremuestra que el cuadro deja en 0 % (ADR 0091).
   */
  | { tipo: "respuesta"; clave: "tasa_respuesta"; rotulo: string; detalle: string; piezas: readonly string[] }
  /** Conglomerados: la sobremuestra de aulas sí es el ajuste operativo. */
  | { tipo: "sobremuestra"; clave: "oversample_pct"; rotulo: string; detalle: string; piezas: readonly string[] };

const TECNICAS_DE_RESPUESTA: ReadonlySet<CalcMuestraTecnica> = new Set([
  "prob_aleatorio_simple",
  "prob_estratificado",
  "sistematico",
]);

export function campoMetaDelActor(comp: Pick<CalcMuestraComponente, "tecnica" | "parametros">): CampoMetaDelActor {
  const p = comp.parametros;
  if (comp.tecnica === "no_prob_cuotas") return { tipo: "cuota", rotulo: "Cuota" };
  if (comp.tecnica === "no_prob_conveniencia") {
    const piso = `Piso ${fmtInt(p.n_minimo_estrato)}`;
    const tope = `tope ${fmtInt(p.tope_operativo)}`;
    return {
      tipo: "cobertura",
      clave: "cobertura_objetivo",
      rotulo: "Cobertura",
      detalle: `${piso} · ${tope}`,
      piezas: [piso, tope],
    };
  }
  if (TECNICAS_DE_RESPUESTA.has(comp.tecnica)) {
    const margen = Number.isFinite(p.e) && p.e > 0 ? fmtPct(p.e) : "";
    const extra = Number.isFinite(p.oversample_pct) && p.oversample_pct > 0 ? fmtPct(p.oversample_pct) : "";
    const cifras = margen && extra ? `±${margen} · +${extra}` : margen ? `margen ±${margen}` : extra ? `+${extra}` : "";
    return {
      tipo: "respuesta",
      clave: "tasa_respuesta",
      rotulo: "Respuesta esperada",
      detalle: [
        "Respuesta esperada",
        margen ? `margen ±${margen}` : "",
        extra ? `sobremuestra ${extra}` : "",
      ].filter(Boolean).join(" · "),
      piezas: ["Respuesta", cifras].filter(Boolean),
    };
  }
  if (comp.tecnica === "prob_conglomerado_multietapico") {
    return { tipo: "sobremuestra", clave: "oversample_pct", rotulo: "Sobremuestra", detalle: "Sobremuestra", piezas: ["Sobremuestra"] };
  }
  return { tipo: "cobertura", clave: "cobertura_objetivo", rotulo: "Cobertura", detalle: "Cobertura", piezas: ["Cobertura"] };
}

/** Pie de la cuota: frase entera y sus piezas cortas (V15). */
export function pieDeCuota(sugerido: number | null): { detalle: string; piezas: readonly string[] } {
  if (sugerido == null) return { detalle: "Cuota", piezas: ["Cuota"] };
  return {
    detalle: `Cuota · vacía, el motor aplica ${fmtInt(sugerido)}`,
    piezas: ["Cuota vacía", `motor: ${fmtInt(sugerido)}`],
  };
}
