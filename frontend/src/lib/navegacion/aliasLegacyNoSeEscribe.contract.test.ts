/**
 * ADR 0044: los alias legacy de navegación se LEEN, nunca se ESCRIBEN.
 *
 * `direccion.ts` mantiene la tabla de lectura (`ALIAS_LEGACY`) para que los
 * deep-links viejos sigan resolviendo, pero ningún código de producción puede
 * volver a emitir una URL con esos params: cada escritor nuevo alarga la vida
 * del alias y reintroduce la ambigüedad que la gramática canónica cerró
 * (`tab` nombraba una SECCIÓN en Bitácora y Monitoreo pero una PESTAÑA en
 * Hojas de ruta).
 *
 * Este contrato congela los alias que ya alcanzaron cero escritores. El
 * barrido es sobre literales de string del AST, así los comentarios que
 * documentan el alias («`?tab=` se lee, no se escribe») no cuentan como
 * escritores. Si un alias más llega a cero escritores, se agrega a la lista
 * y queda congelado también.
 */
import ts from "typescript";
import { describe, expect, test } from "vitest";
import { lineLabel, parseSourcesContaining } from "../../test/contractSourceScan";

/** Alias con cero escritores en producción; escribirlos vuelve rojo el gate. */
const ALIAS_CONGELADOS = ["tab", "mesa"] as const;

function escritoresDe(alias: string): string[] {
  const patron = new RegExp(`[?&]${alias}=`);
  const hallazgos: string[] = [];

  for (const source of parseSourcesContaining(`${alias}=`, [".ts", ".tsx"])) {
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteralLike(node) && patron.test(node.text)) {
        hallazgos.push(`${lineLabel(source, node)} → ${node.text}`);
      }
      if (ts.isTemplateExpression(node)) {
        const partes = [node.head, ...node.templateSpans.map((span) => span.literal)];
        for (const parte of partes) {
          if (patron.test(parte.text)) {
            hallazgos.push(`${lineLabel(source, parte)} → ${parte.text}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source.sourceFile);
  }

  return hallazgos;
}

describe("alias legacy de navegación (ADR 0044)", () => {
  test.each(ALIAS_CONGELADOS)("`%s=` no se escribe en producción", (alias) => {
    expect(
      escritoresDe(alias),
      `\`?${alias}=\` es alias de solo lectura; escribe el param canónico ` +
        "(`modo`/`seccion`/`pestana`, ver lib/navegacion/direccion.ts)",
    ).toEqual([]);
  });
});
