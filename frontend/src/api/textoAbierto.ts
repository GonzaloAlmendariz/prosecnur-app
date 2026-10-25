// textoAbierto.ts — diccionario del proyecto por pregunta abierta (TXT-6/7, plan-texto-abierto-ccss-2026-10-24).
//
//   GET /api/texto-abierto/diccionario?variable=&base=   el diccionario y las palabras reconocidas de la pregunta
//   PUT /api/texto-abierto/diccionario?variable=&base=   guarda el diccionario completo
//
// `base` vacía = la base activa. El diccionario lo leen la nube, la sugerencia de módulo y las citas; la sugerencia no
// se recalcula sola, así que quien guarda vuelve a pedirla. Los errores llegan como `ApiError` con su código `E_TXT_*`
// (422 si una palabra quedó en dos grupos o si la que se muestra no está entre las unidas).

import { apiFetch, handle, headers } from "./core";
import { booleano, enteroONulo, escalar, lista, registro, texto } from "./normalizarR";

export type EquivalenciaPalabras = { mostrar: string; formas: string[] };

export type DiccionarioPregunta = {
  equivalencias: EquivalenciaPalabras[];
  excluir: string[];
  frases: string[];
};

/** Una palabra reconocida en los comentarios. `clave` identifica la palabra con todas sus formas escritas. */
export type PalabraReconocida = {
  clave: string;
  /** La forma más usada: la que se muestra y la que se escribe al excluir o unir. */
  forma: string;
  formas: string[];
  personas: number;
  /** Palabra que se muestra por el grupo al que pertenece, o `null`. */
  grupo: string | null;
  excluida: boolean;
  /** Frases fijas que la contienen. */
  frases: string[];
  /** Términos excluidos de varias palabras que la contienen. */
  excluidaEn: string[];
};

export type GrupoPalabras = { mostrar: string; formas: string[]; personas: number };

export type FraseDetectada = { clave: string; forma: string; personas: number; fija: boolean; excluida: boolean };

export type TextoAbiertoDiccionario = {
  base: string;
  variable: string;
  diccionario: DiccionarioPregunta;
  palabras: PalabraReconocida[];
  grupos: GrupoPalabras[];
  frasesDetectadas: FraseDetectada[];
  resumen: { escribieron: number; conContenido: number; nPalabras: number };
};

/** Lista de textos: arreglo, escalar suelto o `{}` (NULL). Sin vacíos ni repetidos. */
function textos(value: unknown): string[] {
  const v = escalar(value);
  const crudo = Array.isArray(v) ? v : v === undefined || v === null || typeof v === "object" ? [] : [v];
  const out: string[] = [];
  for (const x of crudo) {
    const t = texto(x);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

function textoONulo(value: unknown): string | null {
  return texto(value) || null;
}

export function normalizeDiccionarioPregunta(raw: unknown): DiccionarioPregunta {
  const d = registro(raw);
  const equivalencias = lista(d.equivalencias)
    .map((g) => ({ mostrar: texto(g.mostrar), formas: textos(g.formas) }))
    .filter((g) => g.mostrar && g.formas.length > 0);
  return { equivalencias, excluir: textos(d.excluir), frases: textos(d.frases) };
}

export function normalizeTextoAbiertoDiccionario(raw: unknown): TextoAbiertoDiccionario {
  const r = registro(raw);
  const palabras: PalabraReconocida[] = lista(r.palabras)
    .map((x) => {
      const forma = texto(x.forma);
      const formas = textos(x.formas);
      return {
        clave: texto(x.raiz) || forma,
        forma,
        formas: formas.length ? formas : forma ? [forma] : [],
        personas: enteroONulo(x.personas) ?? 0,
        grupo: textoONulo(x.grupo),
        excluida: booleano(x.excluida),
        frases: textos(x.frases),
        excluidaEn: textos(x.excluida_en),
      };
    })
    .filter((x) => x.clave && x.forma);
  const grupos = lista(r.grupos)
    .map((g) => ({ mostrar: texto(g.mostrar), formas: textos(g.formas), personas: enteroONulo(g.personas) ?? 0 }))
    .filter((g) => g.mostrar);
  const frasesDetectadas = lista(r.frases_detectadas)
    .map((f) => {
      const forma = texto(f.forma);
      return {
        clave: texto(f.clave) || forma,
        forma,
        personas: enteroONulo(f.personas) ?? 0,
        fija: booleano(f.fija),
        excluida: booleano(f.excluida),
      };
    })
    .filter((f) => f.forma);
  const resumen = registro(r.resumen);
  return {
    base: texto(r.base),
    variable: texto(r.variable),
    diccionario: normalizeDiccionarioPregunta(r.diccionario),
    palabras,
    grupos,
    frasesDetectadas,
    resumen: {
      escribieron: enteroONulo(resumen.escribieron) ?? 0,
      conContenido: enteroONulo(resumen.con_contenido) ?? 0,
      nPalabras: enteroONulo(resumen.n_palabras) ?? palabras.length,
    },
  };
}

function consulta(variable: string, base?: string): string {
  const q = new URLSearchParams({ variable });
  if (base) q.set("base", base);
  return q.toString();
}

export async function apiTextoAbiertoDiccionario(variable: string, opts?: { base?: string }): Promise<TextoAbiertoDiccionario> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/texto-abierto/diccionario?${consulta(variable, opts?.base)}`, { headers: headers() }),
  );
  return normalizeTextoAbiertoDiccionario(raw);
}

/** Guarda el diccionario completo de la pregunta; devuelve el diccionario tal como quedó en el proyecto. */
export async function apiGuardarTextoAbiertoDiccionario(
  variable: string,
  diccionario: DiccionarioPregunta,
  opts?: { base?: string },
): Promise<DiccionarioPregunta> {
  const raw = await handle<unknown>(
    await apiFetch(`/api/texto-abierto/diccionario?${consulta(variable, opts?.base)}`, {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      // Sólo el diccionario: plumber pasa los campos del cuerpo como argumentos, y un `variable` en la query y en el
      // cuerpo a la vez choca («matched by multiple actual arguments», E_INTERNAL).
      body: JSON.stringify({ diccionario }),
    }),
  );
  return normalizeDiccionarioPregunta(registro(raw).diccionario);
}
