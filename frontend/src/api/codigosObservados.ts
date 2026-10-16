// codigosObservados.ts — los valores que una variable trae en la data de una
// base, con su etiqueta y su conteo sin ponderar.
//
// `GET /api/carga/codigos-observados?base=&variable=`. Lee la base pedida sin
// cambiar la activa e incluye las columnas propias y las calculadas (ADR 0106).
// Una variable de texto libre no devuelve valores (`tipo: "texto"`), y una que
// parece un identificador —valores casi únicos o de 7 dígitos o más— tampoco
// (`tipo: "identificador"`, por privacidad). Un tipo que esta versión no
// conoce se lee como no listable (`"desconocido"`), nunca como categórica. Lo
// consumen los editores que mapean códigos a una escala: los segmentos de
// cruce (ADR 0107) y «Recodificar una pregunta».
//
// No se reexporta desde el barrel `client.ts`: el código nuevo importa de su
// módulo de dominio.

import { apiFetch, handle, headers } from "./core";
import { booleano, codigo, enteroONulo, lista, registro, texto } from "./normalizarR";

export type TipoCodigosObservados = "categorica" | "numerica" | "texto" | "identificador" | "desconocido";

/** Sólo las categóricas y las numéricas traen sus valores; el resto llega sin códigos. */
export function codigosListables(tipo: TipoCodigosObservados): boolean {
  return tipo === "categorica" || tipo === "numerica";
}

export type CodigoObservado = {
  codigo: string;
  /** Etiqueta del instrumento o del .sav; `""` si no tiene. */
  etiqueta: string;
  /** Casos sin ponderar. */
  n: number;
};

export type CodigosObservados = {
  base: string;
  variable: string;
  tipo: TipoCodigosObservados;
  codigos: CodigoObservado[];
  n_validos: number;
  n_sin_dato: number;
  /** Hay más valores de los que el backend devuelve. */
  truncado: boolean;
};

function tipoDe(value: unknown): TipoCodigosObservados {
  const t = texto(value);
  // Un tipo que esta versión no conoce no se lista: leerlo como categórica
  // pintaría valores que el backend quizá no quiso mostrar.
  return t === "categorica" || t === "numerica" || t === "texto" || t === "identificador" ? t : "desconocido";
}

/** R puede serializar `NA_character_` como «NA»: es etiqueta ausente. */
function etiquetaDe(value: unknown): string {
  const t = texto(value);
  return t === "NA" ? "" : t;
}

export function normalizarCodigosObservados(raw: unknown): CodigosObservados {
  const r = registro(raw);
  const tipo = tipoDe(r.tipo);
  const vistos = new Set<string>();
  const codigos: CodigoObservado[] = [];
  if (codigosListables(tipo)) {
    for (const fila of lista(r.codigos)) {
      const c = codigo(fila.codigo);
      if (!c || vistos.has(c)) continue;
      vistos.add(c);
      codigos.push({ codigo: c, etiqueta: etiquetaDe(fila.etiqueta), n: enteroONulo(fila.n) ?? 0 });
    }
  }
  return {
    base: texto(r.base),
    variable: texto(r.variable),
    tipo,
    codigos,
    n_validos: enteroONulo(r.n_validos) ?? codigos.reduce((s, c) => s + c.n, 0),
    n_sin_dato: enteroONulo(r.n_sin_dato) ?? 0,
    truncado: booleano(r.truncado),
  };
}

export async function getCodigosObservados(base: string, variable: string): Promise<CodigosObservados> {
  const q = new URLSearchParams({ base, variable }).toString();
  const raw = await handle<unknown>(await apiFetch(`/api/carga/codigos-observados?${q}`, { headers: headers() }));
  return normalizarCodigosObservados(raw);
}
