// Motor de lectura de reglas: parsea en modo lectura, normaliza y elige la voz según la columna.
// Si algo no se reconoce, la lectura es técnica (piezas vacías) y `depende`/`lista` se llenan igual.

import { lecturaRequired } from "../../parsing/parseType";
import type { ColumnaRegla, LecturaRegla, Pieza } from "../piezas";
import { etiquetaDe, type Contexto } from "./contexto";
import { capitalizar, t, type Frase } from "./frase";
import { esBooleana, leerCondicion } from "./condicion";
import { leerFiltro } from "./filtros";
import { normalizar, parsear, prepararTexto, referencias } from "./normalizar";
import { leerRestriccion } from "./restricciones";
import { leerValor } from "./valor";

/** Aviso de comillas tipográficas: la última pieza de la frase. Las vistas que pueden lo sacan aparte con `separarAviso`. */
export const AVISO_COMILLAS = "(con comillas tipográficas: ODK no las acepta)";

/** Texto del aviso de comillas como alerta: el mismo en `LecturaRegla.avisos` y en `separarAviso`. */
export const AVISO_COMILLAS_ALERTA = "Usa comillas tipográficas (‘ ’ “ ”), que ODK no acepta: cámbialas por comillas rectas.";

/** Separa el aviso de comillas de la frase, para mostrarlo como alerta y no dentro de la oración. */
export function separarAviso(piezas: readonly Pieza[]): { piezas: Pieza[]; aviso: string | null } {
  const ultima = piezas[piezas.length - 1];
  if (ultima?.tipo === "texto" && ultima.texto === AVISO_COMILLAS) {
    return { piezas: piezas.slice(0, -1), aviso: AVISO_COMILLAS_ALERTA };
  }
  return { piezas: [...piezas], aviso: null };
}


const CUANTAS: Record<number, string> = { 2: "dos", 3: "tres", 4: "cuatro" };

/** Un ${x} que nombra a varias preguntas es ambiguo: se avisa en vez de elegir la primera en silencio. */
function avisosDeAmbiguedad(nombres: string[], ctx: Contexto): string[] {
  return nombres.flatMap((name) => {
    const n = ctx.scope.variables.filter((x) => x.name === name).length;
    return n > 1 ? [`Hay ${CUANTAS[n] ?? n} preguntas con el código ${name}: la regla no dice a cuál se refiere.`] : [];
  });
}

export function leerConContexto(columna: ColumnaRegla, raw: string, ctx: Contexto, lista?: string): LecturaRegla {
  const expr = raw.trim();
  const base = { columna, raw: expr, lista: columna === "choice_filter" ? lista || undefined : undefined };
  if (!expr) return { ...base, piezas: [], tecnica: true, depende: [] };
  const constante = columna === "required" ? lecturaRequired(expr) : "expresion";
  if (constante !== "expresion") {
    return { ...base, piezas: [t(constante === "siempre" ? "Obligatoria" : "Opcional")], tecnica: false, depende: [] };
  }
  const { texto, comillas } = prepararTexto(expr);
  const ast = parsear(texto);
  const norm = ast && ast.kind !== "raw" ? normalizar(ast, ctx) : null;
  const depende = referencias(norm ?? ast, texto).map((name) => ({ name, etiqueta: etiquetaDe(name, ctx) }));
  const ambiguas = avisosDeAmbiguedad(depende.map((d) => d.name), ctx);
  const conAvisos = (extra: string[]) => (ambiguas.length || extra.length ? { avisos: [...extra, ...ambiguas] } : {});
  if (!norm) return { ...base, piezas: [], tecnica: true, depende, ...conAvisos([]) };

  let frase: Frase | null;
  switch (columna) {
    case "constraint":
      frase = leerRestriccion(norm, ctx);
      break;
    case "choice_filter":
      frase = leerFiltro(norm, ctx, lista ?? "");
      break;
    case "required": {
      const c = esBooleana(norm) ? leerCondicion(norm, ctx) : null;
      frase = c ? [t("obligatoria si"), ...c] : null;
      break;
    }
    case "relevant":
      frase = esBooleana(norm) ? leerCondicion(norm, ctx) : null;
      break;
    case "calculation":
      frase = esBooleana(norm) ? leerCondicion(norm, ctx) : leerValor(norm, ctx);
      break;
  }
  if (!frase || !frase.length) return { ...base, piezas: [], tecnica: true, depende, ...conAvisos([]) };
  const piezas = capitalizar(frase);
  // El aviso va en `avisos`; por compatibilidad sigue también como última pieza, corta y entre paréntesis (AVISO_COMILLAS).
  if (comillas) {
    piezas.push(t(AVISO_COMILLAS));
    return { ...base, piezas, tecnica: false, depende, ...conAvisos([AVISO_COMILLAS_ALERTA]) };
  }
  return { ...base, piezas, tecnica: false, depende, ...conAvisos([]) };
}

export { LECTURA_FILA_ROTA, esFilaRota, esRellenoDeFilaRota } from "./filaRota";
