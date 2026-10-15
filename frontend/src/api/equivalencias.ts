// equivalencias.ts — equivalencia declarada entre públicos (ADR 0062).
//
// La misma pregunta vive en cada público con otro nombre de variable, y el
// modelo no tenía dónde guardar esa tabla. Estos endpoints la declaran: la
// persona la arma en la app, fila por fila (ADR 0104: sin plantilla, sin subir
// Excel y sin emparejado automático), y al guardarla las etiquetas aterrizan en
// la configuración de CADA base — nunca en la global, que es lo que el ADR 0061
// dejó prohibido.

import { apiFetch, handle, headers } from "./core";

export type EquivalenciaFila = {
  /**
   * Identidad del bloque en la matriz del proyecto (contrato E4-E7). Sólo la
   * traen las filas importadas por bloques; la fusión al importar casa por ella.
   */
  id?: string;
  seccion: string;
  etiqueta_estandar: string;
  /** `base -> nombre de variable en esa base`. */
  variables: Record<string, string>;
  /** En cuántos públicos existe la pregunta. Derivado, no escrito por nadie. */
  cantidad: number;
  /**
   * Texto de la pregunta en cada medición, en la matriz por bloques de una serie: describe la pregunta, no la lámina.
   * ADR 0103: la matriz ya no lleva diapositiva, enunciado de lámina, gráfico, corte ni estilo.
   */
  enunciado?: string;
  /**
   * Propuesta sin confirmar. ADR 0104: la app ya no propone; sólo la trae una
   * matriz guardada por una versión anterior, que se conserva marcada hasta que
   * la persona la confirma. Sin la marca se vería igual que algo ya decidido.
   */
  sugerida?: boolean;
  /**
   * Armonización entre mediciones (contrato E4-E7, R3). Ausente conserva la
   * previa al guardar y `null` la borra.
   */
  armonizacion?: Armonizacion | null;
  /**
   * Indicador compuesto (ADR 0105): en cada base, las preguntas que lo forman y
   * los códigos que cuentan como «sí». El backend escribe en `variables[base]`
   * la expresión `alguna(V1,V2,...)`, que es la columna que se materializa.
   */
  derivada?: Derivada;
};

/** Componentes de un indicador compuesto en una base (ADR 0105). */
export type DerivadaBase = { variables: string[]; codigos: string[] };

/** ADR 0105: una sola regla, `alguna`. */
export type Derivada = {
  regla: "alguna";
  por_base: Record<string, DerivadaBase>;
};

/** Categoría de la escala común. Los códigos viajan siempre como texto. */
export type CategoriaEscalaComun = { codigo: string; etiqueta: string };

export type ArmonizacionBase = {
  comparable: boolean;
  nota?: string;
  /** `código de la base -> código de la escala`. Vacío es identidad. */
  mapa: Record<string, string>;
};

export type Armonizacion = {
  escala: CategoriaEscalaComun[];
  por_base: Record<string, ArmonizacionBase>;
};

export type EquivalenciaCoberturaBase = {
  n_declaradas: number;
  n_calzan: number;
  /** Variables que la matriz nombra y el instrumento de hoy ya no tiene. */
  huerfanas: string[];
  sello: string;
};

export type EquivalenciasEstado = {
  ok: boolean;
  /** Falso cuando el estudio no tiene bases separadas: la pestaña no aplica. */
  disponible: boolean;
  declarada: boolean;
  n_filas: number;
  n_sin_etiqueta?: number;
  bases: string[];
  importada_en?: string;
  cobertura: Record<string, EquivalenciaCoberturaBase>;
  /** Bases cuyo instrumento cambió después de importar la declaración. */
  desfasadas: string[];
  /** Huella del CONTENIDO de la declaración. ADR 0103: Gráficos ya no la graba ni la compara. */
  revision?: string;
  /** Orden de la serie de mediciones: nombres de base (contrato E4-E7). */
  armonizacion_periodos?: string[];
  filas?: EquivalenciaFila[];
};

export type EquivalenciasAplicacionBase = {
  aplicadas: number;
  /** Etiquetas editadas a mano que se conservaron en vez de pisarse. */
  conservadas: number;
};

export type EquivalenciasImportacion = {
  ok: boolean;
  estado: EquivalenciasEstado;
  aplicacion: Record<string, EquivalenciasAplicacionBase>;
  /** ADR 0103: lo que la declaración traía y la matriz ya no guarda, dicho. */
  avisos?: { code: string; message: string }[];
};

// ---- Normalizadores defensivos (contrato E4-E7) -----------------------------
//
// La armonización llega de R: un mapa vacío puede viajar como `[]`, un código
// como número y un arreglo de un elemento como escalar. Se normaliza en la
// frontera para que el editor nunca vea esas formas.

function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function texto(x: unknown): string {
  if (Array.isArray(x)) return x.length ? texto(x[0]) : "";
  if (typeof x === "string") return x;
  if (typeof x === "number" && Number.isFinite(x)) return String(x);
  return "";
}

function textoONulo(x: unknown): string | null {
  const t = texto(x).trim();
  return t ? t : null;
}

function entero(x: unknown): number {
  const v = Array.isArray(x) ? x[0] : x;
  const n = typeof v === "number" ? v : Number(texto(v));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function listaDeTextos(x: unknown): string[] {
  if (x === null || x === undefined) return [];
  const arr = Array.isArray(x) ? x : [x];
  return arr.map(texto).map((t) => t.trim()).filter(Boolean);
}

export function normalizarEscalaComun(x: unknown): CategoriaEscalaComun[] {
  if (!Array.isArray(x)) return [];
  const out: CategoriaEscalaComun[] = [];
  for (const e of x) {
    if (!esObjeto(e)) continue;
    const codigo = texto(e.codigo).trim();
    if (!codigo) continue;
    out.push({ codigo, etiqueta: texto(e.etiqueta).trim() || codigo });
  }
  return out;
}

export function normalizarArmonizacion(x: unknown): Armonizacion | null {
  if (!esObjeto(x)) return null;
  const escala = normalizarEscalaComun(x.escala);
  const por_base: Record<string, ArmonizacionBase> = {};
  if (esObjeto(x.por_base)) {
    for (const [base, valor] of Object.entries(x.por_base)) {
      if (!base || !esObjeto(valor)) continue;
      const mapa: Record<string, string> = {};
      if (esObjeto(valor.mapa)) {
        for (const [origen, destino] of Object.entries(valor.mapa)) {
          const d = texto(destino).trim();
          if (origen.trim() && d) mapa[origen.trim()] = d;
        }
      }
      const comparableCrudo = Array.isArray(valor.comparable) ? valor.comparable[0] : valor.comparable;
      const nota = textoONulo(valor.nota);
      por_base[base] = {
        comparable: comparableCrudo === undefined ? true : comparableCrudo === true,
        ...(nota ? { nota } : {}),
        mapa,
      };
    }
  }
  if (escala.length === 0 && Object.keys(por_base).length === 0) return null;
  return { escala, por_base };
}

/**
 * Indicador compuesto (ADR 0105). Un arreglo de un elemento puede llegar como
 * escalar. Devuelve `null` si no hay ninguna base con variables: sin ellas no
 * hay indicador que conservar. Una `regla` que esta versión no conoce se deja
 * pasar tal cual en la fila (ver `normalizarFila`), no se reescribe a `alguna`.
 */
export function normalizarDerivada(x: unknown): Derivada | null {
  if (!esObjeto(x) || texto(x.regla).trim() !== "alguna") return null;
  const por_base: Record<string, DerivadaBase> = {};
  if (esObjeto(x.por_base)) {
    for (const [base, valor] of Object.entries(x.por_base)) {
      if (!base || !esObjeto(valor)) continue;
      const variables = listaDeTextos(valor.variables);
      if (variables.length === 0) continue;
      por_base[base] = { variables, codigos: listaDeTextos(valor.codigos) };
    }
  }
  return Object.keys(por_base).length ? { regla: "alguna", por_base } : null;
}

function normalizarFila(x: unknown): EquivalenciaFila | null {
  if (!esObjeto(x)) return null;
  const variables: Record<string, string> = {};
  if (esObjeto(x.variables)) {
    for (const [base, v] of Object.entries(x.variables)) {
      const t = texto(v).trim();
      if (base && t) variables[base] = t;
    }
  }
  // Se conservan los demás campos tal cual: el editor los reescribe en el
  // guardado y perder uno aquí lo borraría del backend sin aviso.
  const fila = { ...(x as EquivalenciaFila) };
  const id = textoONulo(x.id);
  if (id) fila.id = id;
  else delete fila.id;
  fila.seccion = texto(x.seccion);
  fila.etiqueta_estandar = texto(x.etiqueta_estandar);
  fila.variables = variables;
  fila.cantidad = Object.keys(variables).length;
  if ("armonizacion" in x) {
    const arm = normalizarArmonizacion(x.armonizacion);
    if (arm) fila.armonizacion = arm;
    else delete fila.armonizacion;
  }
  // ADR 0105: la derivada viaja normalizada. Si no se reconoce, se conserva la
  // forma cruda que trajo el spread de arriba: borrarla aquí la quitaría del
  // backend en el próximo guardado sin que nadie lo decida.
  if ("derivada" in x) {
    const derivada = normalizarDerivada(x.derivada);
    if (derivada) fila.derivada = derivada;
    else if (x.derivada === null || x.derivada === undefined) delete fila.derivada;
  }
  return fila;
}

export function normalizarEstadoEquivalencias(raw: EquivalenciasEstado): EquivalenciasEstado {
  const crudo: unknown = raw;
  if (!esObjeto(crudo)) return raw;
  const filas = Array.isArray(crudo.filas)
    ? crudo.filas.map(normalizarFila).filter((f): f is EquivalenciaFila => f !== null)
    : undefined;
  return {
    ...raw,
    bases: listaDeTextos(crudo.bases),
    desfasadas: listaDeTextos(crudo.desfasadas),
    armonizacion_periodos: listaDeTextos(crudo.armonizacion_periodos),
    ...(filas ? { filas } : {}),
  };
}

function normalizarImportacion(raw: EquivalenciasImportacion): EquivalenciasImportacion {
  return { ...raw, estado: normalizarEstadoEquivalencias(raw.estado) };
}

export async function getEquivalencias(): Promise<EquivalenciasEstado> {
  return normalizarEstadoEquivalencias(
    await handle<EquivalenciasEstado>(
      await apiFetch("/api/carga/equivalencias", { headers: headers() }),
    ),
  );
}

/**
 * Guarda la declaración entera. `armonizacionPeriodos` ausente conserva el
 * orden de la serie que ya tenía el estudio.
 */
export async function guardarEquivalencias(
  filas: EquivalenciaFila[],
  armonizacionPeriodos?: string[],
): Promise<EquivalenciasImportacion> {
  return normalizarImportacion(
    await handle<EquivalenciasImportacion>(
      await apiFetch("/api/carga/equivalencias/declaracion", {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(
          armonizacionPeriodos
            ? { filas, armonizacion_periodos: armonizacionPeriodos }
            : { filas },
        ),
      }),
    ),
  );
}

// ---- Armonización: preview sobre los datos de una base --------------------

export type ArmonizacionPreviewCodigo = {
  codigo: string;
  etiqueta: string | null;
  /** Casos sin ponderar con ese código en la base. */
  n: number;
  /** Código de la escala al que cae hoy, según lo guardado. */
  armonizado: string | null;
};

export type ArmonizacionPreview = {
  ok: boolean;
  fila: string;
  id: string | null;
  base: string;
  variable: string;
  comparable: boolean;
  nota: string | null;
  n_total: number;
  n_sin_mapa: number;
  codigos: ArmonizacionPreviewCodigo[];
  escala: { codigo: string; etiqueta: string; n: number }[];
  /** ADR 0105: sólo en una fila compuesta. Casos en 1, en 0 y sin dato, con lo guardado. */
  derivada?: ArmonizacionPreviewDerivada;
};

export type ArmonizacionPreviewDerivada = {
  regla: string;
  variables: string[];
  codigos: string[];
  n_si: number;
  n_no: number;
  n_sin_dato: number;
};

export function normalizarPreviewDerivada(x: unknown): ArmonizacionPreviewDerivada | null {
  if (!esObjeto(x)) return null;
  return {
    regla: texto(x.regla).trim(),
    variables: listaDeTextos(x.variables),
    codigos: listaDeTextos(x.codigos),
    n_si: entero(x.n_si),
    n_no: entero(x.n_no),
    n_sin_dato: entero(x.n_sin_dato),
  };
}

/** R puede serializar `NA_character_` como el texto «NA»: en el preview es ausencia. */
function textoONuloR(x: unknown): string | null {
  const t = textoONulo(x);
  return t === "NA" ? null : t;
}

export function normalizarArmonizacionPreview(x: unknown): ArmonizacionPreview {
  const o = esObjeto(x) ? x : {};
  const codigos = Array.isArray(o.codigos)
    ? o.codigos.filter(esObjeto).map((c) => ({
      codigo: texto(c.codigo).trim(),
      etiqueta: textoONuloR(c.etiqueta),
      n: entero(c.n),
      armonizado: textoONuloR(c.armonizado),
    })).filter((c) => c.codigo !== "")
    : [];
  const escala = Array.isArray(o.escala)
    ? o.escala.filter(esObjeto).map((e) => ({
      codigo: texto(e.codigo).trim(),
      etiqueta: texto(e.etiqueta).trim(),
      n: entero(e.n),
    })).filter((e) => e.codigo !== "")
    : [];
  const comparable = Array.isArray(o.comparable) ? o.comparable[0] : o.comparable;
  const derivada = normalizarPreviewDerivada(o.derivada);
  return {
    ok: o.ok === true || (Array.isArray(o.ok) && o.ok[0] === true),
    fila: texto(o.fila),
    id: textoONuloR(o.id),
    base: texto(o.base),
    variable: texto(o.variable),
    comparable: comparable === true,
    nota: textoONuloR(o.nota),
    n_total: entero(o.n_total),
    n_sin_mapa: entero(o.n_sin_mapa),
    codigos,
    escala,
    ...(derivada ? { derivada } : {}),
  };
}

/**
 * Cómo cae el mapa GUARDADO sobre los datos reales de una base. `fila` es el
 * índice 0-based en `filas` del estado, el `id` del bloque o la etiqueta.
 */
export async function getArmonizacionPreview(
  fila: string,
  base: string,
): Promise<ArmonizacionPreview> {
  const q = new URLSearchParams({ fila, base });
  return normalizarArmonizacionPreview(
    await handle<unknown>(
      await apiFetch(`/api/carga/equivalencias/armonizacion/preview?${q.toString()}`, {
        headers: headers(),
      }),
    ),
  );
}

/**
 * Conteos de una fila compuesta en una base (ADR 0105). El 409
 * `E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE` no es un fallo aquí: dice qué
 * componente falta en los datos de esa base, y `handle()` descarta sus
 * `details`, así que se lee el cuerpo antes. Cualquier otro error se lanza.
 */
export type ConteosCompuesto =
  | { tipo: "conteos"; n_si: number; n_no: number; n_sin_dato: number }
  | { tipo: "ausente"; variables: string[] };

export async function getConteosCompuesto(fila: string, base: string): Promise<ConteosCompuesto | null> {
  const q = new URLSearchParams({ fila, base });
  const res = await apiFetch(`/api/carga/equivalencias/armonizacion/preview?${q.toString()}`, {
    headers: headers(),
  });
  if (res.status === 409) {
    const raw = await res.clone().text().catch(() => "");
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }
    const error = esObjeto(body) && esObjeto(body.error) ? body.error : null;
    const details = error && esObjeto(error.details) ? error.details : null;
    if (error && texto(error.code) === "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE") {
      const ausentes = details ? listaDeTextos(details.variables_ausentes) : [];
      const variable = details ? textoONulo(details.variable) : null;
      return { tipo: "ausente", variables: ausentes.length ? ausentes : variable ? [variable] : [] };
    }
  }
  const d = normalizarArmonizacionPreview(await handle<unknown>(res)).derivada;
  return d ? { tipo: "conteos", n_si: d.n_si, n_no: d.n_no, n_sin_dato: d.n_sin_dato } : null;
}

// ---- Importar la matriz de bloques del proyecto ----------------------------

export const TIPOS_ADVERTENCIA_BLOQUES = [
  "variable_pendiente",
  "variable_no_unica",
  "variable_inexistente",
  "sin_instrumento",
  "sin_codigos",
  "sin_variables",
  "fusion",
  "codigo_inexistente",
  "etiqueta_distinta",
  "codigo_sin_mapa",
  "sin_lista",
] as const;

export type TipoAdvertenciaBloques = (typeof TIPOS_ADVERTENCIA_BLOQUES)[number] | "otro";

export type AdvertenciaBloques = {
  id: string;
  /** `""` cuando la advertencia es del bloque y no de una base. */
  base: string;
  tipo: TipoAdvertenciaBloques;
  /** El tipo crudo, por si el backend agrega uno que esta versión no conoce. */
  tipo_crudo: string;
  mensaje: string;
};

export type ResumenBaseBloques = {
  anio: string;
  n_variables: number;
  n_pendientes: number;
  n_codigos_inexistentes: number;
};

export type ResumenBloques = {
  n_bloques: number;
  n_filas: number;
  n_sin_variables: number;
  bloques_sin_variables: string[];
  n_con_armonizacion: number;
  n_advertencias: number;
  hoja: string;
  nuevas: number;
  actualizadas: number;
  por_base: Record<string, ResumenBaseBloques>;
};

export type ImportacionBloques = {
  ok: boolean;
  modo: "previsualizar" | "aplicar";
  filas_importadas: EquivalenciaFila[];
  advertencias: AdvertenciaBloques[];
  resumen: ResumenBloques;
  /** Sólo al aplicar. */
  estado?: EquivalenciasEstado;
  aplicacion?: Record<string, EquivalenciasAplicacionBase>;
};

function tipoAdvertencia(t: string): TipoAdvertenciaBloques {
  return (TIPOS_ADVERTENCIA_BLOQUES as readonly string[]).includes(t)
    ? (t as TipoAdvertenciaBloques)
    : "otro";
}

export function normalizarImportacionBloques(x: unknown): ImportacionBloques {
  const o = esObjeto(x) ? x : {};
  const r = esObjeto(o.resumen) ? o.resumen : {};
  const porBase: Record<string, ResumenBaseBloques> = {};
  if (esObjeto(r.por_base)) {
    for (const [base, v] of Object.entries(r.por_base)) {
      if (!esObjeto(v)) continue;
      porBase[base] = {
        anio: texto(v.anio),
        n_variables: entero(v.n_variables),
        n_pendientes: entero(v.n_pendientes),
        n_codigos_inexistentes: entero(v.n_codigos_inexistentes),
      };
    }
  }
  const advertencias = Array.isArray(o.advertencias)
    ? o.advertencias.filter(esObjeto).map((a) => {
      const crudo = texto(a.tipo).trim();
      return {
        id: texto(a.id),
        base: texto(a.base),
        tipo: tipoAdvertencia(crudo),
        tipo_crudo: crudo,
        mensaje: texto(a.mensaje),
      };
    })
    : [];
  const filas = Array.isArray(o.filas_importadas)
    ? o.filas_importadas.map(normalizarFila).filter((f): f is EquivalenciaFila => f !== null)
    : [];
  const modo = texto(o.modo) === "aplicar" ? "aplicar" : "previsualizar";
  const estado = esObjeto(o.estado)
    ? normalizarEstadoEquivalencias(o.estado as EquivalenciasEstado)
    : undefined;
  return {
    ok: o.ok === true || (Array.isArray(o.ok) && o.ok[0] === true),
    modo,
    filas_importadas: filas,
    advertencias,
    resumen: {
      n_bloques: entero(r.n_bloques),
      n_filas: entero(r.n_filas),
      n_sin_variables: entero(r.n_sin_variables),
      bloques_sin_variables: listaDeTextos(r.bloques_sin_variables),
      n_con_armonizacion: entero(r.n_con_armonizacion),
      n_advertencias: entero(r.n_advertencias),
      hoja: texto(r.hoja),
      nuevas: entero(r.nuevas),
      actualizadas: entero(r.actualizadas),
      por_base: porBase,
    },
    ...(estado ? { estado } : {}),
    ...(esObjeto(o.aplicacion)
      ? { aplicacion: o.aplicacion as Record<string, EquivalenciasAplicacionBase> }
      : {}),
  };
}

/**
 * Importa la matriz de correspondencias por bloques. `mapaPeriodos` lleva cada
 * año detectado en el archivo a una base del estudio.
 */
export async function importarBloquesEquivalencias(payload: {
  fileId: string;
  mapaPeriodos: Record<string, string>;
  modo: "previsualizar" | "aplicar";
  hoja?: string;
}): Promise<ImportacionBloques> {
  return normalizarImportacionBloques(
    await handle<unknown>(
      await apiFetch("/api/carga/equivalencias/importar-bloques", {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          file_id: payload.fileId,
          mapa_periodos: payload.mapaPeriodos,
          modo: payload.modo,
          ...(payload.hoja ? { hoja: payload.hoja } : {}),
        }),
      }),
    ),
  );
}

export type VariableDeBase = {
  name: string;
  label: string;
  seccion: string;
  /**
   * Firma de escala: códigos y etiquetas de su lista, en orden. Es lo que se
   * COMPARA para las invariantes E1/E2 del ADR 0064.
   */
  firma?: string;
  /**
   * Opciones de esa escala, enteras y con la caja original del instrumento. Es
   * lo que se MUESTRA; nunca se compara, porque dos listas distintas pueden
   * verse iguales una vez resumidas. Viajan completas a propósito: cuánto cabe
   * en pantalla lo decide la superficie, que es quien sabe cuánto espacio tiene.
   */
  opciones?: OpcionDeEscala[];
};

export type OpcionDeEscala = { codigo: string; etiqueta: string };

export async function getVariablesEquivalencias(): Promise<{
  ok: boolean;
  variables: Record<string, VariableDeBase[]>;
}> {
  return handle(
    await apiFetch("/api/carga/equivalencias/variables", { headers: headers() }),
  );
}

/**
 * Años que la hoja de bloques trae como columnas.
 *
 * El backend no tiene un modo «detectar»: los años se conocen al parsear la
 * hoja, y el único camino que los devuelve es el 400 `E_EQUIV_BLOQUES_PERIODOS`
 * con `details.anios`, que el motor emite cuando `mapa_periodos` nombra un año
 * que la hoja no tiene. Esta sonda pide justo eso con un año imposible. Es un
 * puente: cuando exista el modo, se reemplaza aquí sin tocar la superficie.
 */
export async function detectarAniosBloques(
  fileId: string,
  baseCualquiera: string,
  hoja?: string,
): Promise<string[]> {
  const res = await apiFetch("/api/carga/equivalencias/importar-bloques", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      file_id: fileId,
      mapa_periodos: { "0000": baseCualquiera },
      modo: "previsualizar",
      ...(hoja ? { hoja } : {}),
    }),
  });
  if (res.ok) return [];
  const raw = await res.clone().text().catch(() => "");
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  const error = esObjeto(body) && esObjeto(body.error) ? body.error : null;
  const code = error ? texto(error.code) : "";
  const details = error && esObjeto(error.details) ? error.details : null;
  if (code === "E_EQUIV_BLOQUES_PERIODOS" && details) {
    return listaDeTextos(details.anios);
  }
  // Cualquier otro error (hoja ausente, formato, archivo) se lanza con el
  // mensaje y el código de siempre.
  return handle<string[]>(res);
}
