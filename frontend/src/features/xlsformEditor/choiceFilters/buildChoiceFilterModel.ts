// =============================================================================
// choiceFilters/buildChoiceFilterModel.ts — modelo de datos de «Filtros de opciones»
// =============================================================================
// Lógica de dominio pura (sin React) que traduce cada `choice_filter` del
// instrumento a una "ficha" legible: sección, pregunta, una frase en lenguaje
// natural, y —cuando se puede deducir con certeza— la correspondencia 1:1
// entre la respuesta previa (antecedente) y la opción que habilita.
//
// Principio rector (spec §2): el lenguaje humano precede al meta-texto. Este
// módulo NO decide presentación; solo produce etiquetas resueltas y decide si
// la correspondencia es derivable. Cuando NO lo es (spec §9), degrada con
// honestidad: enuncia los antecedentes y deja la expresión cruda para la
// "regla técnica", sin inventar parejas.
//
// El caso canónico es el instrumento HSyVbG PUCP: P21 filtra `expresion_vbg`
// por P14–P20 (matriz OR 1:1 de 7 opciones) y P50 filtra `expresion_hs` por
// P34–P49 (16 opciones). Ver buildChoiceFilterModel.test.ts.
// =============================================================================

import type { BuilderNode, BuilderStructure } from "../types";
import { stripMarkdown } from "../helpers/markdown";

/**
 * Convierte una etiqueta cruda del instrumento en texto humano plano.
 * Reutiliza el `stripMarkdown` compartido (maneja `**`, `*`, `####`,
 * `<span style="color:…">`, links) y lo compone con el patrón ya establecido
 * en el editor (`stripMarkdown(x).replace(/\s+/g, " ").trim()`), más un saneo
 * extra para encabezados de cualquier nivel (`######`) y cualquier etiqueta
 * HTML residual. El principio rector §2 del spec exige que ningún meta-texto
 * (HTML/markdown) llegue al primer plano de la vista.
 */
export function humanizeLabel(raw: string | null | undefined): string {
  if (!raw) return "";
  return stripMarkdown(raw)
    .replace(/<[^>]+>/g, "") // etiquetas HTML residuales (p.ej. <span> sin color)
    .replace(/^#+[ \t]*/gm, "") // encabezados markdown de cualquier nivel
    .replace(/\s+/g, " ")
    .trim();
}

/** Una pregunta previa (respuesta antecedente) resuelta a lenguaje humano. */
export type ChoiceFilterAntecedent = {
  /** Nombre técnico de la variable (`P14`). Segundo plano. */
  varName: string;
  /** Etiqueta humana de la pregunta antecedente; cae al `name` si no hay. */
  label: string;
  /** Fila del survey para el deep-link al editor (null si no se resolvió). */
  rowIndex: number | null;
};

/** Una fila de la correspondencia antecedente → opción habilitada. */
export type ChoiceFilterPair = {
  antecedent: ChoiceFilterAntecedent;
  /** Código de la opción en la hoja `choices`. Segundo plano. */
  optionName: string;
  /** Etiqueta humana de la opción habilitada. */
  optionLabel: string;
};

/**
 * Cómo se resolvió el filtro:
 *  - `matrix`  → matriz OR 1:1 derivable (hay parejas).
 *  - `simple`  → un solo antecedente (`region=${region}`): sin parejas.
 *  - `opaque`  → forma no reconocida o no inferible con certeza: sin parejas.
 */
export type ChoiceFilterMode = "matrix" | "simple" | "opaque";

export type ChoiceFilterCard = {
  /** Fila del survey de la pregunta filtrada (identidad + deep-link). */
  rowIndex: number;
  /** Contexto: sección a la que pertenece la pregunta. */
  sectionLabel: string;
  /** Etiqueta humana de la pregunta (título de la ficha). */
  questionLabel: string;
  /** Código técnico de la pregunta (`P21`). Segundo plano. */
  questionCode: string;
  /** Lista de opciones que la pregunta usa (`expresion_vbg`). */
  listName: string;
  /** Frase explicativa en lenguaje natural. */
  explanation: string;
  /** Antecedentes en orden de aparición (deduplicados). */
  antecedents: ChoiceFilterAntecedent[];
  /** Correspondencia 1:1 cuando es derivable; vacío al degradar. */
  pairs: ChoiceFilterPair[];
  /** Si la correspondencia 1:1 pudo deducirse con certeza. */
  derivable: boolean;
  mode: ChoiceFilterMode;
  /** Expresión cruda para el desplegable "Ver regla técnica". */
  rawExpression: string;
};

export type ChoiceFilterModel = {
  cards: ChoiceFilterCard[];
};

export type BuildChoiceFilterInput = {
  structure: BuilderStructure | null;
  /** Columnas crudas de la hoja `choices` (incluye las `filter_*`). */
  choicesColumns: string[];
  /** Filas crudas de la hoja `choices` (paralelas a `choicesColumns`). */
  choicesRows: string[][];
};

const VAR_RE = /\$\{([^}]+)\}/g;

/** Extrae los `name` de todas las variables `${…}` de una expresión, en orden
 *  de aparición y sin duplicados. */
export function extractFilterVariables(expression: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  VAR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VAR_RE.exec(expression)) !== null) {
    const name = match[1]?.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** ¿Es el token la cláusula placeholder `name='0'` (la opción "Selecciona una
 *  respuesta")? Se ignora al derivar la matriz. */
function isPlaceholderTerm(token: string): boolean {
  return /^name\s*=\s*['"]?0['"]?$/i.test(token);
}

type MatrixTerm = { col: string; varName: string };

/**
 * Intenta leer la expresión como una disyunción (`or`) limpia de términos
 * `columna=${VAR}` (más el placeholder `name='0'`, que se descarta). Devuelve
 * los términos si TODA la expresión encaja en ese patrón; `null` si aparece
 * cualquier otra construcción (funciones, `and`, comparaciones con literales…),
 * en cuyo caso la ficha degrada.
 */
export function parseMatrixTerms(expression: string): MatrixTerm[] | null {
  // Los paréntesis no aportan a esta forma; quitarlos simplifica el split.
  // Si hubiera un `selected(${x}, 'a')`, al quitar paréntesis el token deja de
  // encajar en `col=${var}` y la función retorna null → degrada. Correcto.
  const cleaned = expression.replace(/[()]/g, " ");
  const tokens = cleaned.split(/\bor\b/i);
  const terms: MatrixTerm[] = [];
  for (const raw of tokens) {
    const token = raw.trim();
    if (token === "") continue;
    if (isPlaceholderTerm(token)) continue;
    const parsed = token.match(/^([A-Za-z_][\w.]*)\s*=\s*\$\{([^}]+)\}$/);
    if (!parsed) return null;
    terms.push({ col: parsed[1]!, varName: parsed[2]!.trim() });
  }
  return terms;
}

function buildExplanation(mode: ChoiceFilterMode, antecedents: ChoiceFilterAntecedent[]): string {
  if (mode === "matrix") {
    return "Cada opción aparece únicamente si la persona la indicó en la pregunta que le corresponde.";
  }
  if (mode === "simple" && antecedents[0]) {
    return `Las opciones se limitan según lo que la persona respondió en «${antecedents[0].label}».`;
  }
  if (antecedents.length === 1 && antecedents[0]) {
    return `Las opciones disponibles dependen de lo que la persona respondió en «${antecedents[0].label}».`;
  }
  return "Las opciones disponibles dependen de respuestas que la persona dio antes.";
}

/**
 * Construye el modelo completo: una ficha por cada pregunta select cuyo
 * `choice_filter` no esté vacío.
 */
export function buildChoiceFilterModel(input: BuildChoiceFilterInput): ChoiceFilterModel {
  const { structure, choicesColumns, choicesRows } = input;
  if (!structure) return { cards: [] };

  // name → nodo (para resolver antecedentes a etiqueta + fila).
  const byName = new Map<string, BuilderNode>();
  for (const node of structure.outline) {
    if (node.name && !byName.has(node.name)) byName.set(node.name, node);
  }
  const resolveAntecedent = (varName: string): ChoiceFilterAntecedent => {
    const node = byName.get(varName);
    const label = humanizeLabel(node?.label);
    return {
      varName,
      label: label.length > 0 ? label : varName,
      rowIndex: node?.rowIndex ?? null,
    };
  };

  const listNameIdx = choicesColumns.indexOf("list_name");
  const nameIdx = choicesColumns.indexOf("name");
  const labelIdx = choicesColumns.indexOf("label");

  const cards: ChoiceFilterCard[] = [];

  for (const node of structure.outline) {
    const expression = node.choiceFilter?.trim();
    if (!expression) continue;
    const listName = node.typeInfo?.listName?.trim() ?? "";

    const antecedents = extractFilterVariables(expression).map(resolveAntecedent);
    const sectionLabel = humanizeLabel(structure.sections.get(node.sectionId)?.label);

    // ── Intento de matriz OR 1:1 ─────────────────────────────────────────
    let pairs: ChoiceFilterPair[] = [];
    let mode: ChoiceFilterMode = "opaque";
    let derivable = false;

    const terms = parseMatrixTerms(expression);
    if (terms && terms.length === 1) {
      // Filtro simple (`region=${region}`): un solo antecedente, sin parejas.
      mode = "simple";
    } else if (terms && terms.length >= 2 && listName && listNameIdx >= 0 && nameIdx >= 0) {
      // Candidata a matriz: columna → variable antecedente.
      const colToVar = new Map<string, string>();
      for (const term of terms) colToVar.set(term.col, term.varName);
      // Todas las columnas del filtro deben existir en la hoja choices; si no,
      // no podemos leer qué opción activa cada columna → degrada.
      const colIdx = new Map<string, number>();
      let allColsExist = true;
      for (const col of colToVar.keys()) {
        const idx = choicesColumns.indexOf(col);
        if (idx < 0) {
          allColsExist = false;
          break;
        }
        colIdx.set(col, idx);
      }

      if (allColsExist) {
        // Deduplicar por opción: la hoja `choices` trae cada opción repetida
        // una vez por valor de frecuencia (p.ej. filter_P14 = 2,3,4,5 → 4 filas
        // con el mismo `name`/`label`). Agrupamos por `optionName` y unimos las
        // columnas de filtro activas de TODAS sus filas — la opción se habilita
        // si cualquiera de sus filas tiene la columna seteada. Así colapsa a un
        // solo par antecedente→opción por opción distinta.
        type OptionAgg = { label: string; activeCols: Set<string> };
        const options = new Map<string, OptionAgg>();
        for (const row of choicesRows) {
          if ((row[listNameIdx] ?? "").trim() !== listName) continue;
          const optionName = (row[nameIdx] ?? "").trim();
          if (optionName === "" || optionName === "0") continue; // placeholder
          let agg = options.get(optionName);
          if (!agg) {
            const rawLabel = labelIdx >= 0 ? (row[labelIdx] ?? "").trim() : "";
            agg = { label: humanizeLabel(rawLabel) || optionName, activeCols: new Set() };
            options.set(optionName, agg);
          }
          for (const [col, idx] of colIdx) {
            if ((row[idx] ?? "").trim() !== "") agg.activeCols.add(col);
          }
        }

        const candidate: ChoiceFilterPair[] = [];
        let clean = true;
        for (const [optionName, agg] of options) {
          if (agg.activeCols.size !== 1) {
            // 0 columnas o ambigüedad (varias columnas): no es 1:1 limpia.
            clean = false;
            break;
          }
          const col = agg.activeCols.values().next().value as string;
          const varName = colToVar.get(col)!;
          candidate.push({
            antecedent: resolveAntecedent(varName),
            optionName,
            optionLabel: agg.label,
          });
        }
        if (clean && candidate.length > 0) {
          pairs = candidate;
          mode = "matrix";
          derivable = true;
        }
      }
    }
    // terms === null (forma no reconocida) o matriz que no cerró → opaque.

    cards.push({
      rowIndex: node.rowIndex,
      sectionLabel,
      questionLabel: humanizeLabel(node.label) || node.name,
      questionCode: node.name,
      listName,
      explanation: buildExplanation(mode, antecedents),
      antecedents,
      pairs,
      derivable,
      mode,
      rawExpression: expression,
    });
  }

  return { cards };
}
