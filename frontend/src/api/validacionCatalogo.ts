// Catálogo de reglas de Validación (contrato M3, `GET /api/validacion/v2/reglas/catalogo`).
//
// Esta primera entrega lee solo lo que usa el panel de regla (rebanada V2):
//   - cuántas reglas del formulario quedaron sin evaluar ("2 reglas del
//     formulario sin evaluar"), por familia y origen;
//   - las preguntas que nombran las frases del catálogo (código, etiqueta y
//     tipo), para armar una regla cuando la base todavía no tiene respuestas y
//     el inventario de Explorar no responde.
// El normalizador es defensivo: una cifra ausente queda en `null`, no en 0.

import { apiFetch, handle, headers } from "./core";
import { booleano, enteroONulo, lista, registro, texto } from "./normalizarR";

export type TipoDeFichaDelCatalogo = "unica" | "multiple" | "numerica" | "texto";

export type FamiliaDelCatalogo = {
  origen: string;
  familia: string;
  nombre: string;
  n: number | null;
  n_sin_evaluar: number | null;
};

export type PreguntaDelCatalogo = { codigo: string; etiqueta: string | null; tipo: TipoDeFichaDelCatalogo };

export type CatalogoDeReglas = {
  plan_construido: boolean;
  n_total: number | null;
  n_sin_evaluar: number | null;
  familias: FamiliaDelCatalogo[];
  /** Las preguntas de las frases, sin repetir, en el orden en que aparecen. */
  preguntas: PreguntaDelCatalogo[];
};

const TIPOS: readonly TipoDeFichaDelCatalogo[] = ["unica", "multiple", "numerica", "texto"];

export function normalizarCatalogoDeReglas(value: unknown): CatalogoDeReglas {
  const r = registro(value);
  const preguntas = new Map<string, PreguntaDelCatalogo>();
  for (const regla of lista(r.reglas)) {
    for (const ficha of lista(regla.frase)) {
      const codigo = texto(ficha.pregunta);
      if (!codigo || preguntas.has(codigo)) continue;
      const etiqueta = texto(ficha.etiqueta);
      const tipo = texto(ficha.tipo);
      preguntas.set(codigo, {
        codigo,
        etiqueta: etiqueta && etiqueta !== codigo ? etiqueta : null,
        tipo: (TIPOS as readonly string[]).includes(tipo) ? (tipo as TipoDeFichaDelCatalogo) : "texto",
      });
    }
  }
  return {
    plan_construido: booleano(r.plan_construido),
    n_total: enteroONulo(r.n_total),
    n_sin_evaluar: enteroONulo(r.n_sin_evaluar),
    familias: lista(r.familias).map((f) => ({
      origen: texto(f.origen),
      familia: texto(f.familia),
      nombre: texto(f.nombre),
      n: enteroONulo(f.n),
      n_sin_evaluar: enteroONulo(f.n_sin_evaluar),
    })),
    preguntas: [...preguntas.values()],
  };
}

/** Las reglas del formulario sin evaluar; `null` si el catálogo no trae la cifra de ninguna familia del formulario. */
export function sinEvaluarDelFormulario(catalogo: CatalogoDeReglas): number | null {
  const delFormulario = catalogo.familias.filter((f) => f.origen === "formulario" && f.n_sin_evaluar !== null);
  if (!delFormulario.length) return null;
  return delFormulario.reduce((suma, f) => suma + (f.n_sin_evaluar ?? 0), 0);
}

export async function apiCatalogoDeReglas(baseNombre?: string | null): Promise<CatalogoDeReglas> {
  const h = headers();
  if (baseNombre) h["X-Base-Nombre"] = baseNombre;
  const crudo = await handle<unknown>(await apiFetch("/api/validacion/v2/reglas/catalogo", { headers: h }));
  return normalizarCatalogoDeReglas(crudo);
}
