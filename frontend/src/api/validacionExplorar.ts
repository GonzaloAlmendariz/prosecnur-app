// validacionExplorar.ts — contrato del explorador de variables de Validación ›
// Explorar (checklist docs/qa/checklist-explorador-variables-2026-11-02.md).
//
// El motor suma tres piezas a lo que ya devolvía: `dist` en el univariado,
// `cruce` en el bivariado y la ficha de la pregunta (GET /explorar/ficha).
// Aquí viven sus tipos y sus normalizadores defensivos: Plumber serializa un
// escalar como vector de largo uno, una lista de uno como objeto suelto y
// `NULL` como `{}`. Un payload que no cumple la forma devuelve `null` y la
// interfaz cae al render anterior (Plotly / tarjetas KPI) en vez de romperse.
// La llamada HTTP (`apiV2ExplorarFicha`) vive en `validacion.ts`, junto a las
// demás del explorador.

import { booleano, codigo, enteroONulo, escalar, lista, numeroONulo, registro, texto } from "./normalizarR";

export type ExploradorTipo = "so" | "sm" | "num" | "fecha" | "texto" | "mixto";

const TIPOS: readonly ExploradorTipo[] = ["so", "sm", "num", "fecha", "texto", "mixto"];

function tipo(value: unknown): ExploradorTipo | null {
  const t = texto(value).toLowerCase();
  return (TIPOS as readonly string[]).includes(t) ? (t as ExploradorTipo) : null;
}

function textoONulo(value: unknown): string | null {
  const t = texto(value);
  return t ? t : null;
}

function entero(value: unknown): number {
  return enteroONulo(value) ?? 0;
}

function numero(value: unknown): number {
  return numeroONulo(value) ?? 0;
}

// --- Ficha -------------------------------------------------------------------

export type ExploradorFichaOpcion = { codigo: string; etiqueta: string; n: number };

export type ExploradorFichaDatos = {
  n_total: number;
  n_responden: number;
  n_sin_respuesta: number;
  n_fuera_de_lista: number;
  n_otro_textos: number | null;
};

export type ExploradorFicha = {
  var: string;
  label: string;
  hint: string | null;
  tipo: ExploradorTipo;
  tipo_xlsform: string | null;
  lista: string | null;
  grupo: { name: string; label: string } | null;
  relevant: string | null;
  constraint: string | null;
  constraint_message: string | null;
  required: boolean | null;
  choice_filter: string | null;
  appearance: string | null;
  abre: { var: string; label: string }[];
  version_formulario: string | null;
  opciones: ExploradorFichaOpcion[];
  datos: ExploradorFichaDatos;
};

export function normalizeExploradorFicha(raw: unknown): ExploradorFicha | null {
  const r = registro(raw);
  const nombre = texto(r.var);
  const t = tipo(r.tipo);
  if (!nombre || !t) return null;
  const g = registro(r.grupo);
  const grupoName = texto(g.name);
  const req = escalar(r.required);
  const d = registro(r.datos);
  return {
    var: nombre,
    label: texto(r.label) || nombre,
    hint: textoONulo(r.hint),
    tipo: t,
    tipo_xlsform: textoONulo(r.tipo_xlsform),
    lista: textoONulo(r.lista),
    grupo: grupoName ? { name: grupoName, label: texto(g.label) || grupoName } : null,
    relevant: textoONulo(r.relevant),
    constraint: textoONulo(r.constraint),
    constraint_message: textoONulo(r.constraint_message),
    required: req === null || req === undefined || (typeof req === "object") ? null : booleano(req),
    choice_filter: textoONulo(r.choice_filter),
    appearance: textoONulo(r.appearance),
    abre: lista(r.abre)
      .map((a) => ({ var: texto(a.var), label: texto(a.label) }))
      .filter((a) => a.var),
    version_formulario: textoONulo(r.version_formulario),
    opciones: lista(r.opciones).map((o) => ({
      codigo: codigo(o.codigo),
      etiqueta: texto(o.etiqueta) || codigo(o.codigo),
      n: entero(o.n),
    })),
    datos: {
      n_total: entero(d.n_total),
      n_responden: entero(d.n_responden),
      n_sin_respuesta: entero(d.n_sin_respuesta),
      n_fuera_de_lista: entero(d.n_fuera_de_lista),
      n_otro_textos: enteroONulo(d.n_otro_textos),
    },
  };
}

// --- Distribución univariada (`uni.dist`) ------------------------------------

export type ExploradorDistFila = { codigo: string; etiqueta: string; n: number; pct: number };
export type ExploradorDistCuantas = { k: "1" | "2" | "3+"; n: number; pct: number };
export type ExploradorDistNum = {
  bins: { desde: number; hasta: number; n: number }[];
  min: number;
  p25: number;
  mediana: number;
  p75: number;
  max: number;
  media: number;
  n_atipicos: number;
};

export type ExploradorDist = {
  tipo: ExploradorTipo;
  ordinal: boolean;
  base_n: number;
  filas?: ExploradorDistFila[];
  cuantas_marca?: ExploradorDistCuantas[];
  num?: ExploradorDistNum;
  fecha?: { dias: { fecha: string; n: number }[] };
  texto?: { grupos: { texto: string; n: number }[] };
};

function filasDist(value: unknown): ExploradorDistFila[] {
  return lista(value).map((f) => ({
    codigo: codigo(f.codigo),
    etiqueta: texto(f.etiqueta) || codigo(f.codigo),
    n: entero(f.n),
    pct: numero(f.pct),
  }));
}

function numDist(value: unknown): ExploradorDistNum | undefined {
  const n = registro(value);
  if (!Object.keys(n).length) return undefined;
  const mediana = numeroONulo(n.mediana);
  if (mediana === null) return undefined;
  return {
    bins: lista(n.bins).map((b) => ({ desde: numero(b.desde), hasta: numero(b.hasta), n: entero(b.n) })),
    min: numero(n.min),
    p25: numero(n.p25),
    mediana,
    p75: numero(n.p75),
    max: numero(n.max),
    media: numero(n.media),
    n_atipicos: entero(n.n_atipicos),
  };
}

export function normalizeExploradorDist(raw: unknown): ExploradorDist | null {
  const r = registro(raw);
  const t = tipo(r.tipo);
  if (!t) return null;
  const out: ExploradorDist = {
    tipo: t,
    ordinal: booleano(r.ordinal),
    base_n: entero(r.base_n),
  };
  if (r.filas !== undefined) out.filas = filasDist(r.filas);
  if (r.cuantas_marca !== undefined) {
    out.cuantas_marca = lista(r.cuantas_marca)
      .map((c) => ({ k: texto(c.k), n: entero(c.n), pct: numero(c.pct) }))
      .filter((c): c is ExploradorDistCuantas => c.k === "1" || c.k === "2" || c.k === "3+");
  }
  const num = numDist(r.num);
  if (num) out.num = num;
  const fecha = registro(r.fecha);
  if (Object.keys(fecha).length) {
    out.fecha = {
      dias: lista(fecha.dias)
        .map((d) => ({ fecha: texto(d.fecha), n: entero(d.n) }))
        .filter((d) => d.fecha),
    };
  }
  const txt = registro(r.texto);
  if (Object.keys(txt).length) {
    out.texto = {
      grupos: lista(txt.grupos)
        .map((g) => ({ texto: texto(g.texto), n: entero(g.n) }))
        .filter((g) => g.texto),
    };
  }
  // Una distribución sin la pieza de su tipo no se puede dibujar: se cae al
  // gráfico anterior en vez de pintar un marco vacío.
  const tienePieza =
    ((t === "so" || t === "sm") && !!out.filas) ||
    (t === "num" && !!out.num) ||
    (t === "fecha" && !!out.fecha) ||
    (t === "texto" && !!out.texto);
  return tienePieza ? out : null;
}

// --- Cruce bivariado (`biv.cruce`) -------------------------------------------

export type ExploradorCruceForma = "tabla" | "cajas" | "dispersion" | "serie" | "lista";

export type ExploradorCruceTabla = {
  /** `n`: casos de la base en la fila (no la suma de sus celdas: con una múltiple, un caso está en varias); null en un payload viejo. */
  filas: { codigo: string; etiqueta: string; n: number | null }[];
  columnas: { codigo: string; etiqueta: string; n: number }[];
  /** n[fila][columna] */
  n: number[][];
};

export type ExploradorCruceCaja = {
  etiqueta: string;
  n: number;
  min: number;
  p25: number;
  mediana: number;
  p75: number;
  max: number;
  n_atipicos: number;
};

export type ExploradorCrucePunto = {
  fecha: string;
  valor: number;
  baja: number | null;
  alta: number | null;
  serie: string | null;
};

export type ExploradorCruce = {
  tipo_x: ExploradorTipo;
  tipo_y: ExploradorTipo;
  grafico: string;
  forma: ExploradorCruceForma;
  base_n: number;
  /** Casos que responden cada variable con los mismos filtros; null en un payload viejo. */
  n_x: number | null;
  n_y: number | null;
  tabla?: ExploradorCruceTabla;
  cajas?: { grupos: ExploradorCruceCaja[] };
  dispersion?: {
    puntos: [number, number][];
    tendencia: { pendiente: number; intercepto: number } | null;
    n: number;
  };
  serie?: { puntos: ExploradorCrucePunto[] };
  lista?: { grupos: { etiqueta: string; respuestas: { texto: string; n: number }[] }[] };
};

const FORMAS: readonly ExploradorCruceForma[] = ["tabla", "cajas", "dispersion", "serie", "lista"];

function matriz(value: unknown, nFilas: number, nCols: number): number[][] | null {
  if (!Array.isArray(value)) return null;
  const filas = value.map((fila) => (Array.isArray(fila) ? fila : [fila]).map((x) => entero(x)));
  if (filas.length !== nFilas) return null;
  if (filas.some((fila) => fila.length !== nCols)) return null;
  return filas;
}

function tablaCruce(value: unknown): ExploradorCruceTabla | undefined {
  const t = registro(value);
  const filas = lista(t.filas).map((f) => ({
    codigo: codigo(f.codigo),
    etiqueta: texto(f.etiqueta) || codigo(f.codigo),
    n: enteroONulo(f.n),
  }));
  const columnas = lista(t.columnas).map((c) => ({
    codigo: codigo(c.codigo),
    etiqueta: texto(c.etiqueta) || codigo(c.codigo),
    n: entero(c.n),
  }));
  if (!filas.length || !columnas.length) return undefined;
  const n = matriz(t.n, filas.length, columnas.length);
  return n ? { filas, columnas, n } : undefined;
}

function punto(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = numeroONulo(value[0]);
  const y = numeroONulo(value[1]);
  return x === null || y === null ? null : [x, y];
}

export function normalizeExploradorCruce(raw: unknown): ExploradorCruce | null {
  const r = registro(raw);
  const tx = tipo(r.tipo_x);
  const ty = tipo(r.tipo_y);
  const forma = texto(r.forma) as ExploradorCruceForma;
  if (!tx || !ty || !(FORMAS as readonly string[]).includes(forma)) return null;
  const out: ExploradorCruce = {
    tipo_x: tx,
    tipo_y: ty,
    grafico: texto(r.grafico),
    forma,
    base_n: entero(r.base_n),
    n_x: enteroONulo(r.n_x),
    n_y: enteroONulo(r.n_y),
  };
  const tabla = tablaCruce(r.tabla);
  if (tabla) out.tabla = tabla;
  const cajas = registro(r.cajas);
  if (Object.keys(cajas).length) {
    out.cajas = {
      grupos: lista(cajas.grupos).map((g) => ({
        etiqueta: texto(g.etiqueta),
        n: entero(g.n),
        min: numero(g.min),
        p25: numero(g.p25),
        mediana: numero(g.mediana),
        p75: numero(g.p75),
        max: numero(g.max),
        n_atipicos: entero(g.n_atipicos),
      })),
    };
  }
  const disp = registro(r.dispersion);
  if (Object.keys(disp).length) {
    const puntos = Array.isArray(disp.puntos)
      ? disp.puntos.map(punto).filter((p): p is [number, number] => p !== null)
      : [];
    const tend = registro(disp.tendencia);
    const pendiente = numeroONulo(tend.pendiente);
    const intercepto = numeroONulo(tend.intercepto);
    out.dispersion = {
      puntos,
      tendencia: pendiente !== null && intercepto !== null ? { pendiente, intercepto } : null,
      n: enteroONulo(disp.n) ?? puntos.length,
    };
  }
  const serie = registro(r.serie);
  if (Object.keys(serie).length) {
    out.serie = {
      puntos: lista(serie.puntos)
        .map((p) => ({
          fecha: texto(p.fecha),
          valor: numeroONulo(p.valor),
          baja: numeroONulo(p.baja),
          alta: numeroONulo(p.alta),
          serie: textoONulo(p.serie),
        }))
        .filter((p): p is ExploradorCrucePunto => !!p.fecha && p.valor !== null),
    };
  }
  const lst = registro(r.lista);
  if (Object.keys(lst).length) {
    out.lista = {
      grupos: lista(lst.grupos).map((g) => ({
        etiqueta: texto(g.etiqueta),
        respuestas: lista(g.respuestas)
          .map((x) => ({ texto: texto(x.texto), n: entero(x.n) }))
          .filter((x) => x.texto),
      })),
    };
  }
  // La forma declarada tiene que traer su pieza; si no, cae al `view` de Plotly.
  const pieza = {
    tabla: out.tabla,
    cajas: out.cajas,
    dispersion: out.dispersion,
    serie: out.serie,
    lista: out.lista,
  }[forma];
  return pieza ? out : null;
}
