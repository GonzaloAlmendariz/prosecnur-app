/**
 * Barrido compartido del árbol de fuentes para los contract tests.
 *
 * Varios contratos (tablists con indicador compartido, rutas con
 * `data-audit-ready`, lectores de dirección, decks de toasts) comprueban
 * invariantes que ningún tipo puede expresar, y para eso leen `src/` entero.
 * El árbol crece: parsear los ~456 `.tsx` con `ts.createSourceFile` costaba
 * ~4 s por barrido, y con la máquina ocupada esos tests se pasaban del timeout
 * de 5 s de vitest y ponían roja la suite completa sin que nada del contrato
 * estuviera mal.
 *
 * El barrido de aquí lee cada archivo una sola vez por archivo de test, y
 * reserva el parse para los archivos cuyo texto crudo contiene el marcador.
 * Un marcador es una condición NECESARIA del literal que se busca: si el
 * atributo se arma concatenando o con escapes unicode, ni este filtro ni el
 * análisis de literales que hacen los tests lo verían.
 *
 * Solo para tests: importa `node:fs`, así que no debe entrar en ningún camino
 * alcanzable desde `main.tsx`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_EXTENSIONS = [".tsx"] as const;

export type SourceText = {
  /** Ruta absoluta, la que recibe `ts.createSourceFile`. */
  readonly file: string;
  /** Ruta relativa a `src/`, la que se cita en los mensajes de fallo. */
  readonly relative: string;
  readonly text: string;
};

export type ParsedSource = SourceText & { readonly sourceFile: ts.SourceFile };

function walk(dir: string, extensions: readonly string[]): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" || entry.name === "test" ? [] : walk(entryPath, extensions);
    }
    if (!extensions.some((extension) => entry.name.endsWith(extension))) return [];
    if (/\.(?:test|spec)\.tsx?$/.test(entry.name)) return [];
    return [entryPath];
  });
}

const readCache = new Map<string, readonly SourceText[]>();

/** Los archivos de producción bajo `src/`, leídos una sola vez por proceso. */
export function readSources(
  extensions: readonly string[] = DEFAULT_EXTENSIONS,
): readonly SourceText[] {
  const key = [...extensions].sort().join("|");
  const cached = readCache.get(key);
  if (cached) return cached;

  const sources = walk(SRC, extensions).map((file) => ({
    file,
    relative: path.relative(SRC, file),
    text: fs.readFileSync(file, "utf8"),
  }));
  readCache.set(key, sources);
  return sources;
}

const parseCache = new Map<string, ts.SourceFile>();

/** Parsea una fuente ya leída; el mismo archivo no se parsea dos veces. */
export function parseSource(source: SourceText): ts.SourceFile {
  const cached = parseCache.get(source.file);
  if (cached) return cached;

  const sourceFile = ts.createSourceFile(
    source.file,
    source.text,
    ts.ScriptTarget.Latest,
    true,
    source.file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  parseCache.set(source.file, sourceFile);
  return sourceFile;
}

/**
 * Los archivos cuyo texto crudo contiene `marker`, ya parseados. El marcador
 * evita pagar el parse de todo el árbol; elige uno que sea imposible de omitir
 * en el código que buscas (por ejemplo `"tablist"` para `role="tablist"`).
 */
export function parseSourcesContaining(
  marker: string,
  extensions: readonly string[] = DEFAULT_EXTENSIONS,
): readonly ParsedSource[] {
  return readSources(extensions)
    .filter((source) => source.text.includes(marker))
    .map((source) => ({ ...source, sourceFile: parseSource(source) }));
}

/** Todas las etiquetas JSX de apertura de un archivo, en orden de aparición. */
export function jsxTags(sourceFile: ts.SourceFile): ts.JsxOpeningLikeElement[] {
  const tags: ts.JsxOpeningLikeElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) tags.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return tags;
}

/** `features/graficos/GraficosHeader.tsx:214`, para citar el hallazgo. */
export function lineLabel(source: ParsedSource, node: ts.Node): string {
  const line = source.sourceFile.getLineAndCharacterOfPosition(node.getStart(source.sourceFile)).line;
  return `${source.relative}:${line + 1}`;
}
