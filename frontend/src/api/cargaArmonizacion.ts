// cargaArmonizacion.ts — lo que quedó de la armonización de una base nacida de
// un formulario publicado (ADR 0102) y la comparación de dos fuentes ligadas a
// la misma revisión.
//
// - `GET /api/carga/bases/<base>/armonizacion`: la vista previa que se vio al
//   crear la base, guardada. Solo lectura; `disponible: false` cuando la base
//   no la tiene (se creó por otra vía o antes de que se guardara).
// - `POST /api/carga/comparar-fuentes {base_a, base_b}`: distribución por
//   variable de las dos bases, en las variables de la revisión común. Con dos
//   revisiones distintas responde 409 `E_COMPARAR_OTRA_REVISION`.
//
// No se reexporta desde el barrel `client.ts`. Los normalizadores aceptan las
// tres formas en que R serializa (escalar como arreglo de uno, lista de uno como
// objeto suelto, NULL como `{}`) y toleran campos que falten.

import { apiFetch, handle, headers } from "./core";
import { normalizeVistaPreviaFormularioPublicado, type VistaPreviaFormularioPublicado } from "./cargaFormularioPublicado";
import { booleano, codigo, enteroONulo, lista, numeroONulo, registro, texto } from "./normalizarR";

// ---------------------------------------------------------------------------
// Armonización guardada de una base
// ---------------------------------------------------------------------------

export type FormularioDeBase = {
  form_id: string;
  form_name: string;
  revision_id: string;
  revision_no: number | null;
};

export type ArmonizacionBase = {
  base: string;
  disponible: boolean;
  formulario: FormularioDeBase | null;
  /** Tipo de fuente: «surveymonkey», «sav», «excel»; vacío si no se guardó. */
  fuente: string;
  /** ISO 8601 tal como lo guarda el backend; vacío si no se guardó. */
  importado_at: string;
  /** Mismos campos que la vista previa: se pintan con el mismo componente. */
  detalle: VistaPreviaFormularioPublicado;
};

export function normalizeArmonizacionBase(raw: unknown, baseSolicitada = ""): ArmonizacionBase {
  const r = registro(raw);
  const f = registro(r.formulario);
  const revision_id = texto(f.revision_id);
  const formulario: FormularioDeBase | null = revision_id || texto(f.form_name)
    ? {
        form_id: texto(f.form_id),
        form_name: texto(f.form_name) || texto(f.form_id) || "Formulario publicado",
        revision_id,
        revision_no: enteroONulo(f.revision_no),
      }
    : null;
  // `disponible` ausente: hay armonización si trae algo que mostrar.
  const disponible = r.disponible === undefined
    ? Boolean(formulario) || enteroONulo(r.n_variables_instrumento) != null
    : booleano(r.disponible);
  return {
    base: texto(r.base) || baseSolicitada,
    disponible,
    formulario,
    fuente: texto(r.fuente),
    importado_at: texto(r.importado_at),
    detalle: { ...normalizeVistaPreviaFormularioPublicado(r), bloqueo: null },
  };
}

export async function apiCargaArmonizacionBase(base: string): Promise<ArmonizacionBase> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/carga/bases/${encodeURIComponent(base)}/armonizacion`, { headers: headers() }),
  );
  return normalizeArmonizacionBase(raw, base);
}

// ---------------------------------------------------------------------------
// Comparar dos fuentes de la misma revisión
// ---------------------------------------------------------------------------

export type DatosFuente = "cruda" | "depurada" | "";

export type FuenteComparada = {
  nombre: string;
  n_filas: number | null;
  /** «surveymonkey», «sav», «excel»… */
  fuente: string;
  /** Si la base viene sin limpiar o ya depurada; vacío si no se informa. */
  datos: DatosFuente;
};

export type EstadoVariable = "igual" | "distinta" | "solo_a" | "solo_b";

export const ESTADOS_VARIABLE: readonly EstadoVariable[] = ["igual", "distinta", "solo_a", "solo_b"];

export type CategoriaComparada = {
  codigo: string;
  etiqueta: string;
  n_a: number | null;
  n_b: number | null;
  /** Puntos porcentuales (0–100) sobre válidos no-NA, especiales incluidos. */
  pct_a: number | null;
  pct_b: number | null;
  /** Código especial (SIN INF 99, No aplica 90, No sabe 98). */
  especial: boolean;
  /** El código no está en el formulario. */
  fuera_de_lista: boolean;
};

export type CategoriaExclusiva = { codigo: string; etiqueta: string };

export type VariableComparada = {
  variable: string;
  etiqueta: string;
  tipo: string;
  estado: EstadoVariable;
  n_validos_a: number | null;
  n_validos_b: number | null;
  categorias: CategoriaComparada[];
  diferencia_max_pp: number | null;
  categorias_solo_a: CategoriaExclusiva[];
  categorias_solo_b: CategoriaExclusiva[];
};

export type ResumenComparacion = {
  n_iguales: number;
  n_distintas: number;
  /** Variables (no etiquetas) con al menos una categoría que la otra fuente no tiene. */
  n_con_categorias_exclusivas: number;
  diferencia_filas: number | null;
};

export type CasosComparados = {
  clave: string;
  solo_a: number | null;
  solo_b: number | null;
  en_ambas: number | null;
};

export type PerdidaEnCarga = { variable: string; etiqueta: string; n: number };

export type ComparacionFuentes = {
  base_a: FuenteComparada;
  base_b: FuenteComparada;
  revision_id: string;
  n_variables: number | null;
  variables: VariableComparada[];
  resumen: ResumenComparacion;
  /** `null` cuando no hay clave común para cruzar casos. */
  casos: CasosComparados | null;
  perdidas_en_carga_a: PerdidaEnCarga[];
  perdidas_en_carga_b: PerdidaEnCarga[];
};

export const E_COMPARAR_OTRA_REVISION = "E_COMPARAR_OTRA_REVISION";

function datosFuente(value: unknown): DatosFuente {
  const v = texto(value).toLowerCase();
  return v === "cruda" || v === "depurada" ? v : "";
}

function fuenteComparada(raw: unknown, nombrePorDefecto: string): FuenteComparada {
  const r = registro(raw);
  return {
    nombre: texto(r.nombre) || nombrePorDefecto,
    n_filas: enteroONulo(r.n_filas),
    fuente: texto(r.fuente),
    datos: datosFuente(r.datos),
  };
}

function estadoVariable(value: unknown): EstadoVariable {
  const v = texto(value);
  // Un estado desconocido se muestra como distinto: nunca se esconde entre las iguales.
  return (ESTADOS_VARIABLE as readonly string[]).includes(v) ? (v as EstadoVariable) : "distinta";
}

/** Porcentaje en puntos; si falta, se deriva de la frecuencia y los válidos. */
function pct(valor: unknown, n: number | null, validos: number | null): number | null {
  const p = numeroONulo(valor);
  if (p != null) return Math.max(0, Math.min(100, p));
  if (n != null && validos != null && validos > 0) return (n / validos) * 100;
  return null;
}

/** Categorías exclusivas: códigos sueltos, `{codigo, etiqueta}` o una mezcla. */
function exclusivas(value: unknown): CategoriaExclusiva[] {
  const crudos = Array.isArray(value) ? value : value == null ? [] : [value];
  const out: CategoriaExclusiva[] = [];
  for (const item of crudos) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const r = registro(item);
      const c = codigo(r.codigo);
      const e = texto(r.etiqueta);
      if (c || e) out.push({ codigo: c, etiqueta: e });
    } else {
      const c = codigo(item);
      if (c) out.push({ codigo: c, etiqueta: "" });
    }
  }
  return out;
}

function variableComparada(r: Record<string, unknown>): VariableComparada | null {
  const variable = texto(r.variable);
  if (!variable) return null;
  const n_validos_a = enteroONulo(r.n_validos_a);
  const n_validos_b = enteroONulo(r.n_validos_b);
  const categorias = lista(r.categorias).map((c): CategoriaComparada => {
    const n_a = enteroONulo(c.n_a);
    const n_b = enteroONulo(c.n_b);
    return {
      codigo: codigo(c.codigo),
      etiqueta: texto(c.etiqueta),
      n_a,
      n_b,
      pct_a: pct(c.pct_a, n_a, n_validos_a),
      pct_b: pct(c.pct_b, n_b, n_validos_b),
      especial: booleano(c.especial),
      fuera_de_lista: booleano(c.fuera_de_lista),
    };
  }).filter((c) => c.codigo || c.etiqueta);
  const dif = numeroONulo(r.diferencia_max_pp);
  return {
    variable,
    etiqueta: texto(r.etiqueta),
    tipo: texto(r.tipo),
    estado: estadoVariable(r.estado),
    n_validos_a,
    n_validos_b,
    categorias,
    diferencia_max_pp: dif == null ? null : Math.abs(dif),
    categorias_solo_a: exclusivas(r.categorias_solo_a),
    categorias_solo_b: exclusivas(r.categorias_solo_b),
  };
}

function perdidas(value: unknown): PerdidaEnCarga[] {
  return lista(value)
    .map((p) => ({ variable: texto(p.variable), etiqueta: texto(p.etiqueta), n: enteroONulo(p.n) ?? 0 }))
    .filter((p) => p.variable && p.etiqueta);
}

export function normalizeComparacionFuentes(raw: unknown, pedido: { base_a: string; base_b: string } = { base_a: "", base_b: "" }): ComparacionFuentes {
  const r = registro(raw);
  const variables = lista(r.variables)
    .map(variableComparada)
    .filter((v): v is VariableComparada => v !== null);
  const res = registro(r.resumen);
  const contar = (estado: EstadoVariable) => variables.filter((v) => v.estado === estado).length;
  const conExclusivas = variables.filter((v) => v.categorias_solo_a.length || v.categorias_solo_b.length).length;
  const base_a = fuenteComparada(r.base_a, pedido.base_a);
  const base_b = fuenteComparada(r.base_b, pedido.base_b);
  const casosRaw = registro(r.casos);
  const clave = texto(casosRaw.clave);
  const filasDerivadas = base_a.n_filas != null && base_b.n_filas != null ? base_a.n_filas - base_b.n_filas : null;
  return {
    base_a,
    base_b,
    revision_id: texto(r.revision_id),
    n_variables: enteroONulo(r.n_variables) ?? (variables.length || null),
    variables,
    resumen: {
      n_iguales: enteroONulo(res.n_iguales) ?? contar("igual"),
      n_distintas: enteroONulo(res.n_distintas) ?? contar("distinta"),
      n_con_categorias_exclusivas: enteroONulo(res.n_con_categorias_exclusivas) ?? conExclusivas,
      // Con signo: A tiene más filas que B si es positiva.
      diferencia_filas: numeroONulo(res.diferencia_filas) ?? filasDerivadas,
    },
    casos: clave
      ? {
          clave,
          solo_a: enteroONulo(casosRaw.solo_a),
          solo_b: enteroONulo(casosRaw.solo_b),
          en_ambas: enteroONulo(casosRaw.en_ambas),
        }
      : null,
    perdidas_en_carga_a: perdidas(r.perdidas_en_carga_a),
    perdidas_en_carga_b: perdidas(r.perdidas_en_carga_b),
  };
}

export async function apiCargaCompararFuentes(baseA: string, baseB: string): Promise<ComparacionFuentes> {
  const pedido = { base_a: baseA, base_b: baseB };
  const raw = await handle<unknown>(
    await apiFetch("/api/carga/comparar-fuentes", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(pedido),
    }),
  );
  return normalizeComparacionFuentes(raw, pedido);
}
