// Motor de lectura de reglas: parsea en modo lectura, normaliza y elige la voz según la columna.
// Si algo no se reconoce, la lectura es técnica (piezas vacías) y `depende`/`lista` se llenan igual.

import { lecturaRequired } from "../../parsing/parseType";
import type { ColumnaRegla, LecturaRegla } from "../piezas";
import { etiquetaDe, type Contexto } from "./contexto";
import { capitalizar, t, type Frase } from "./frase";
import { esBooleana, leerCondicion } from "./condicion";
import { leerFiltro } from "./filtros";
import { normalizar, parsear, prepararTexto, referencias } from "./normalizar";
import { leerRestriccion } from "./restricciones";
import { leerValor } from "./valor";


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
  if (!norm) return { ...base, piezas: [], tecnica: true, depende };

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
  if (!frase || !frase.length) return { ...base, piezas: [], tecnica: true, depende };
  const piezas = capitalizar(frase);
  if (comillas) piezas.push(t("(escrita con comillas tipográficas, que ODK no acepta)"));
  return { ...base, piezas, tecnica: false, depende };
}
