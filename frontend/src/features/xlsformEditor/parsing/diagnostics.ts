// =============================================================================
// parsing/diagnostics.ts — chequeos estructurales sobre el workbook
// =============================================================================
// Genera la lista de `BuilderDiagnostic` que el panel del editor muestra como
// avisos al usuario. Cada diagnostic apunta a una fila o a un catálogo y trae
// un texto en español orientado a un usuario que NO sabe Excel.
//
// Los chequeos cubren:
//   - Settings: form_title / form_id vacíos.
//   - Survey: labels o names vacíos, names duplicados, listas huérfanas o
//     vacías para preguntas de selección, cálculos sin fórmula.
//   - Estructura: end_* sueltos, secciones sin cerrar.
//   - Choices: códigos vacíos o duplicados, labels vacíos, catálogos con
//     menos de 2 opciones.
//   - Lógica: referencias a variables inexistentes en relevant/constraint/
//     calculation/choice_filter.
//   - Filas rotas: todas las columnas de regla repiten el name de la fila.
// =============================================================================

import { COLUMNAS_EXPRESION, idComillas, tieneComillasTipograficas } from "./comillas";
import type {
  BuilderDiagnostic,
  BuilderNode,
  XlsformEditorWorkbook,
  XlsformIndex,
} from "../types";
import { rowToRecord } from "./sheetUtils";
import { LECTURA_FILA_ROTA, esFilaRota } from "../reglas/motor/filaRota";

/** Mismo patrón que el validador del servidor (`.xlsform_editor_name_is_valid`): el aviso sale igual con o sin él. */
const NOMBRE_VALIDO = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const SELECCION = /^(select_one|select_multiple|rank)$/;

export type EstadoLista = "no-aplica" | "ok" | "dinamica" | "sin-lista" | "sin-catalogo";

/**
 * Cómo está la lista de una pieza de selección, con la misma lectura que Opciones (`origenDeLista`):
 *  - `dinamica`: `select_one ${x}` (las respuestas de una repetición), `*_from_file` o una búsqueda `search(…)`;
 *    sus opciones no viven en choices.
 *  - `sin-lista`: selección sin lista ni en `type` ni en la columna `list_name` / `select_from_list_name`.
 *  - `sin-catalogo`: apunta a una lista que choices no tiene.
 * `catalogos` null: todavía no se sabe qué listas hay (no se afirma que falte ninguna).
 */
export function estadoLista(
  node: Pick<BuilderNode, "kind" | "typeInfo" | "appearance">,
  catalogos: { has: (nombre: string) => boolean } | null,
): EstadoLista {
  const base = node.typeInfo.base;
  if (/_from_file$/.test(base) && /^select_/.test(base)) return "dinamica";
  if (!SELECCION.test(base)) return "no-aplica";
  // `select_one yn or_other`: la lista es `yn`; `or_other` sólo agrega la opción «Otro».
  const lista = node.typeInfo.listName.replace(/\s+or_other$/, "").trim();
  if (/^\$\{/.test(lista) || /search\(/.test(node.appearance ?? "")) return "dinamica";
  if (!lista) return "sin-lista";
  if (catalogos && !catalogos.has(lista)) return "sin-catalogo";
  return "ok";
}

export function buildDiagnostics(
  workbook: XlsformEditorWorkbook | null,
  index: XlsformIndex | null,
): BuilderDiagnostic[] {
  if (!workbook || !index) return [];
  const diagnostics: BuilderDiagnostic[] = [];
  const { structure, catalogs } = index;
  // El índice agrega una lista vacía por cada nombre que el survey cita (para que Opciones la muestre): una lista
  // EXISTE si choices le da al menos una opción.
  const catalogNames = new Set(catalogs.filter((catalog) => catalog.items.length > 0).map((catalog) => catalog.listName));
  const nameCounts = new Map<string, number>();
  const firstRowByName = new Map<string, number>();
  structure.outline.forEach((node) => {
    const name = (node.name ?? "").trim();
    if (!name) return;
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    if (!firstRowByName.has(name)) firstRowByName.set(name, node.rowIndex);
  });

  // Settings
  const settings = rowToRecord(workbook.settings, 0);
  if (!(settings.form_title ?? "").trim()) {
    diagnostics.push({
      id: "settings-title",
      level: "warn",
      title: "Falta el título del formulario",
      detail: "Conviene definir un título visible antes de exportar el instrumento.",
    });
  }
  if (!(settings.form_id ?? "").trim()) {
    diagnostics.push({
      id: "settings-id",
      level: "warn",
      title: "Falta el ID interno del formulario",
      detail: "El XLSForm debería tener un form_id claro para publicarlo luego en ODK o KoBo.",
    });
  }

  // Nombres inválidos: en TODAS las filas del survey, también las de cierre que traen nombre (el ACNUR tiene
  // «S1.child_edu_group» en un end_group), igual que el validador del servidor.
  const colNombre = workbook.survey.columns.indexOf("name");
  if (colNombre >= 0) {
    workbook.survey.rows.forEach((row, rowIndex) => {
      const nombre = (row[colNombre] ?? "").trim();
      if (!nombre || NOMBRE_VALIDO.test(nombre)) return;
      diagnostics.push({
        id: `name-invalid-${rowIndex}`,
        level: "error",
        rowIndex,
        title: `Nombre inválido: "${nombre}"`,
        detail: "Usa solo letras, números y guion bajo. Empieza con letra.",
      });
    });
  }

  // Survey rows
  structure.outline.forEach((node) => {
    if (!(node.label ?? "").trim()) {
      diagnostics.push({
        id: `label-${node.rowIndex}`,
        level: "warn",
        rowIndex: node.rowIndex,
        title: "Hay una pieza sin texto visible",
        detail:
          "Añade una etiqueta legible para que el formulario no quede opaco al momento de usarlo.",
      });
    }
    if (!(node.name ?? "").trim()) {
      diagnostics.push({
        id: `name-${node.rowIndex}`,
        level: "warn",
        rowIndex: node.rowIndex,
        title: "Hay una pieza sin nombre interno",
        detail:
          "El nombre interno ayuda a exportar, validar y reutilizar la información sin ambigüedad.",
      });
    } else if (
      (nameCounts.get(node.name) ?? 0) > 1 &&
      firstRowByName.get(node.name) === node.rowIndex
    ) {
      diagnostics.push({
        id: `duplicate-name-${node.name}`,
        level: "error",
        rowIndex: node.rowIndex,
        title: `El nombre interno "${node.name}" está repetido`,
        detail: `Aparece ${nameCounts.get(node.name)} veces. Conviene que cada pregunta o pieza tenga un nombre interno único.`,
      });
    }
    // La lista se lee como en el resto del editor: `node.typeInfo.listName` ya entiende la lista en `type` y en una
    // columna `list_name` / `select_from_list_name` aparte (Tipo 1). Una lista dinámica (respuestas de una
    // repetición, un archivo, una búsqueda) no vive en choices y no es un aviso (I1, 2026-10-17).
    const lista = estadoLista(node, catalogNames);
    if (lista === "sin-lista") {
      diagnostics.push({
        id: `catalog-missing-${node.rowIndex}`,
        level: "error",
        rowIndex: node.rowIndex,
        title: "La pregunta no tiene lista asignada",
        detail:
          "Asigna una lista de opciones para que esta pregunta de selección quede completa.",
      });
    } else if (lista === "sin-catalogo") {
      diagnostics.push({
        id: `catalog-empty-${node.rowIndex}`,
        level: "error",
        rowIndex: node.rowIndex,
        catalogName: node.typeInfo.listName,
        title: "La lista asignada todavía no tiene opciones",
        detail: `La pregunta apunta a la lista "${node.typeInfo.listName}", pero esa lista aún no tiene opciones definidas.`,
      });
    }
    for (const columna of COLUMNAS_EXPRESION) {
      const valor = columna === "choice_filter" ? node.choiceFilter : node[columna];
      if (valor && tieneComillasTipograficas(valor)) {
        diagnostics.push({
          id: idComillas(columna, node.rowIndex),
          level: "error",
          rowIndex: node.rowIndex,
          title: `Comillas tipográficas en ${columna}`,
          detail: "La expresión usa “ ” o ‘ ’ (las pone Word o Excel al escribir). ODK no las reconoce: hay que cambiarlas por comillas rectas.",
        });
      }
    }
    if (node.kind === "calculate" && !node.calculation) {
      diagnostics.push({
        id: `calculate-${node.rowIndex}`,
        level: "warn",
        rowIndex: node.rowIndex,
        title: "El cálculo está vacío",
        detail:
          "La variable está marcada como cálculo, pero todavía no tiene una fórmula definida.",
      });
    }
    // Fila rota: todas las columnas de regla repiten el nombre de la fila (caso real REG02_Other_recod del Tipo 3,
    // un relleno hacia la derecha en Excel). Ninguna de esas «reglas» significa nada para ODK.
    const nombre = (node.name ?? "").trim();
    if (nombre) {
      const record = rowToRecord(workbook.survey, node.rowIndex);
      // Misma regla que el motor de lectura (reglas/motor/filaRota.ts): una sola fuente para decir que está rota.
      if (esFilaRota(node, [record.required])) {
        diagnostics.push({
          id: `fila-rota-${node.rowIndex}`,
          level: "warn",
          rowIndex: node.rowIndex,
          title: "Fila rota: las reglas repiten el nombre",
          detail: `${LECTURA_FILA_ROTA} («${nombre}»). Parece un relleno de Excel: revisa la fila en la vista Hojas.`,
        });
      }
    }
    // Diagnostic INFO: pregunta requerida con relevant condicional.
    // No es error — ODK sólo aplica `required` cuando `relevant` es
    // verdadero, así que la pregunta puede no ser obligatoria si la
    // condición no se cumple. Pero conviene avisarlo porque se
    // confunde con frecuencia: el autor cree que es siempre
    // obligatoria, y termina con envíos sin ese campo cuando la
    // condición fue falsa.
    if (
      node.kind === "question" &&
      node.required &&
      (node.relevant ?? "").trim() !== ""
    ) {
      diagnostics.push({
        id: `required-with-relevant-${node.rowIndex}`,
        level: "info",
        rowIndex: node.rowIndex,
        title: "Obligatoria solo cuando se muestra",
        detail:
          "Esta pregunta es obligatoria y tiene una condición de visibilidad. ODK la pedirá únicamente cuando la condición sea verdadera; si es falsa, la pregunta se omite del envío sin marcarla como faltante.",
      });
    }
    if (node.kind === "repeat") {
      diagnostics.push({
        id: `repeat-${node.rowIndex}`,
        level: "info",
        rowIndex: node.rowIndex,
        title: "Hay un bloque repeat importado",
        detail:
          "Por ahora el constructor expone los repeats de forma parcial; si necesitas revisar la fila cruda, usa la vista Hojas.",
      });
    }
  });

  // Estructura: cierres sueltos / secciones sin cerrar
  structure.unmatchedEndRows.forEach((rowIndex) => {
    diagnostics.push({
      id: `unmatched-end-${rowIndex}`,
      level: "warn",
      rowIndex,
      title: "Hay un cierre de sección sin apertura previa",
      detail:
        "Se detectó un end_group/end_repeat suelto. Conviene revisarlo antes de exportar.",
    });
  });

  structure.unclosedSectionIds.forEach((id) => {
    const section = structure.sections.get(id);
    if (!section || section.rowIndex == null) return;
    diagnostics.push({
      id: `unclosed-${id}`,
      level: "warn",
      rowIndex: section.rowIndex,
      title: `La sección "${section.label}" quedó abierta`,
      detail: "Parece que esta sección se abrió pero no se cerró. Revísala antes de exportar el formulario.",
    });
  });

  // Anidamiento de secciones — aviso informativo (no es error). Una
  // sección cuyo padre es OTRA sección/repeat (no la raíz) queda anidada.
  // A veces es intencional, pero es una causa frecuente de estructuras
  // enredadas: se avisa para que el autor confirme que fue a propósito.
  structure.sections.forEach((section) => {
    if (section.kind === "root" || section.rowIndex == null) return;
    if (!section.parentId) return;
    const parent = structure.sections.get(section.parentId);
    if (!parent || parent.kind === "root") return;
    diagnostics.push({
      id: `nested-section-${section.id}`,
      level: "info",
      rowIndex: section.rowIndex,
      title: `La sección "${section.label}" está anidada dentro de "${parent.label}"`,
      detail:
        "Esta sección vive dentro de otra sección. Si el anidamiento no fue intencional, cierra la sección anterior antes de abrir esta para dejarlas al mismo nivel.",
    });
  });

  // Choices
  catalogs.forEach((catalog) => {
    const codes = new Map<string, number>();
    catalog.items.forEach((item) => {
      const code = (item.name ?? "").trim();
      if (code) codes.set(code, (codes.get(code) ?? 0) + 1);
    });
    // Una lista sin ninguna opción en choices es una cita (dinámica, o rota y ya avisada en su pregunta).
    if (catalog.items.length > 0 && catalog.items.length < 2) {
      diagnostics.push({
        id: `catalog-short-${catalog.listName}`,
        level: "info",
        catalogName: catalog.listName,
        title: `El catálogo "${catalog.listName}" tiene pocas opciones`,
        detail:
          "Si lo vas a usar en una pregunta de selección, normalmente conviene definir al menos dos opciones.",
      });
    }
    catalog.items.forEach((item) => {
      if (!(item.name ?? "").trim()) {
        diagnostics.push({
          id: `catalog-code-${item.rowIndex}`,
          level: "warn",
          catalogName: catalog.listName,
          title: `Hay una opción sin código en "${catalog.listName}"`,
          detail: "Cada opción necesita un código interno estable para guardar respuestas y analizar datos.",
        });
      } else if ((codes.get(item.name) ?? 0) > 1) {
        diagnostics.push({
          id: `catalog-duplicate-${item.rowIndex}`,
          level: "warn",
          catalogName: catalog.listName,
          title: `El código "${item.name}" está repetido`,
          detail: `Dentro del catálogo "${catalog.listName}", los códigos deberían ser únicos.`,
        });
      }
      if (!(item.label ?? "").trim()) {
        diagnostics.push({
          id: `catalog-label-${item.rowIndex}`,
          level: "warn",
          catalogName: catalog.listName,
          title: `Hay una opción sin texto visible en "${catalog.listName}"`,
          detail: "El texto visible es lo que verá la persona encuestada en el formulario.",
        });
      }
    });
  });

  // Referencias rotas
  index.missingReferences.forEach((dependency) => {
    diagnostics.push({
      id: `missing-ref-${dependency.fromRowIndex}-${dependency.kind}-${dependency.toName}`,
      level: "warn",
      rowIndex: dependency.fromRowIndex,
      title: `La lógica usa "${dependency.toName}", pero esa variable no existe`,
      detail: `Revisa la expresión de ${dependency.kind}. El índice no encontró una pregunta con ese nombre interno.`,
    });
  });

  // Referencias circulares — DFS sobre el grafo de dependencias.
  // Para cada nombre `A` con dependencias salientes, exploramos el
  // grafo siguiendo las flechas; si llegamos de vuelta a `A`, es un
  // ciclo. Reportamos cada ciclo una sola vez (canonalizando por la
  // permutación que arranca con el name lexicográficamente menor).
  const reportedCycles = new Set<string>();
  const detectCyclesFrom = (start: string) => {
    // DFS iterativo con stack de paths para captuar el ciclo completo.
    const stack: Array<{ node: string; path: string[] }> = [
      { node: start, path: [start] },
    ];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const { node, path } = stack.pop()!;
      const deps = index.dependenciesByName.get(node) ?? [];
      for (const dep of deps) {
        const next = dep.toName;
        if (next === start) {
          // Ciclo cerrado.
          const cycle = [...path, next];
          // Canonicalizar: rotar para que arranque con el menor.
          let minIdx = 0;
          for (let i = 1; i < cycle.length - 1; i += 1) {
            if (cycle[i]! < cycle[minIdx]!) minIdx = i;
          }
          const rotated = [
            ...cycle.slice(minIdx, -1),
            ...cycle.slice(0, minIdx),
          ];
          const key = rotated.join("→");
          if (!reportedCycles.has(key)) {
            reportedCycles.add(key);
            const fromNode = structure.outline.find(
              (n) => n.name === rotated[0],
            );
            diagnostics.push({
              id: `cycle-${key}`,
              level: "warn",
              rowIndex: fromNode?.rowIndex,
              title: "Ciclo detectado en la lógica",
              detail: `Las variables se condicionan unas a otras formando un bucle: ${rotated.join(" → ")} → ${rotated[0]}. ODK no puede resolver dependencias circulares — alguna de estas referencias debe quitarse.`,
            });
          }
          continue;
        }
        if (visited.has(next)) continue;
        if (path.includes(next)) continue; // ya en el path actual
        visited.add(next);
        stack.push({ node: next, path: [...path, next] });
      }
    }
  };
  for (const name of index.dependenciesByName.keys()) {
    detectCyclesFrom(name);
  }

  return diagnostics;
}

// -----------------------------------------------------------------------------
// Fusión con el validador del servidor
// -----------------------------------------------------------------------------

/**
 * Junta los diagnósticos locales con los del servidor (`/api/xlsform-editor/validate`) en UNA lista: la que pintan
 * el punto de la Estructura, el filtro «Con aviso» y el contador de la cabecera (I1, 2026-10-17).
 *
 * Lo que el servidor dice y el editor ya calcula (con la lectura correcta) sale de la lista local: así el conteo es
 * el mismo antes y después de que llegue la respuesta, y no se cuenta dos veces lo mismo con dos ids.
 *  - Listas (`select-no-list-*`, `select-missing-list-*`): el servidor sólo lee la lista en `type` (no la columna
 *    `list_name`) y no conoce las listas dinámicas; manda la lectura local.
 *  - Nombres vacíos, inválidos, repetidos, cierres sueltos, secciones abiertas, form_id vacío y referencias a
 *    variables que no existen: los calcula el editor con el mismo criterio.
 *  - Referencias rotas en un filtro de opciones: el servidor toma las columnas de choices por variables.
 *  - «No se pudo interpretar» (`ast-unparseable-*`) no es un defecto del formulario: la expresión es válida para ODK,
 *    sólo el editor visual no la descompone. Pasa a informativo.
 */
export function fusionarDiagnosticos(
  locales: readonly BuilderDiagnostic[],
  remotos: readonly BuilderDiagnostic[],
): BuilderDiagnostic[] {
  const ids = new Set(locales.map((d) => d.id));
  const filasCon = (prefijo: string) =>
    new Set(locales.filter((d) => d.id.startsWith(prefijo) && d.rowIndex != null).map((d) => d.rowIndex as number));
  const sinNombre = filasCon("name-");
  const cierresSueltos = filasCon("unmatched-end-");
  const abiertas = filasCon("unclosed-");
  const refs = new Set<string>();
  for (const d of locales) {
    const m = d.id.match(/^missing-ref-(\d+)-[^-]+-(.+)$/);
    if (m) refs.add(`${m[1]}:${m[2]}`);
  }

  const out: BuilderDiagnostic[] = [...locales];
  // Si el servidor dice lo mismo como `error` (bloquea la publicación) y el editor lo tenía como `warn`, el local
  // hereda el nivel: descartar el duplicado no puede bajar la severidad.
  const subir = (coincide: (local: BuilderDiagnostic) => boolean, remoto: BuilderDiagnostic) => {
    if (remoto.level !== "error") return;
    for (let i = 0; i < out.length; i++) if (coincide(out[i]!)) out[i] = { ...out[i]!, level: "error" };
  };
  const enFila = (prefijo: string, fila: number | null | undefined) => (l: BuilderDiagnostic) =>
    l.id.startsWith(prefijo) && l.rowIndex === fila;
  for (const d of remotos) {
    if (ids.has(d.id)) continue;
    const id = d.id;
    if (id.startsWith("select-no-list-") || id.startsWith("select-missing-list-")) continue;
    if (id.startsWith("name-empty-") && d.rowIndex != null && sinNombre.has(d.rowIndex)) {
      subir(enFila("name-", d.rowIndex), d);
      continue;
    }
    if (id.startsWith("name-duplicate-") && ids.has(`duplicate-name-${id.slice("name-duplicate-".length)}`)) continue;
    if (id.startsWith("orphan-end-") && d.rowIndex != null && cierresSueltos.has(d.rowIndex)) {
      subir(enFila("unmatched-end-", d.rowIndex), d);
      continue;
    }
    if (/^unclosed-\d+$/.test(id) && d.rowIndex != null && abiertas.has(d.rowIndex)) {
      subir(enFila("unclosed-", d.rowIndex), d);
      continue;
    }
    if (id === "settings-form-id-empty" && ids.has("settings-id")) {
      subir((l) => l.id === "settings-id", d);
      continue;
    }
    // En un filtro de opciones, un nombre suelto es una COLUMNA de choices (`filter = ${x}`, `REF02CO = 'kk'`), no
    // una variable: el servidor lo lee como referencia rota. Las `${x}` rotas ya las ve el índice local.
    if (id.startsWith("ast-missing-ref-choice_filter-")) continue;
    const ref = id.match(/^ast-missing-ref-[a-z_]+-(\d+)-(.+)$/);
    if (ref && refs.has(`${ref[1]}:${ref[2]}`)) continue;
    out.push(id.startsWith("ast-unparseable-") ? { ...d, level: "info" } : d);
  }
  return out;
}
