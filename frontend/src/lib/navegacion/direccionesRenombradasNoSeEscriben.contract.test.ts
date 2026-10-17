/**
 * ADR 0108 §5: las direcciones renombradas se LEEN, nunca se ESCRIBEN.
 *
 * Recopiladores pasó a Material de campo (`/material-campo`) y la etapa
 * «Entrega» de Hojas de ruta pasó a «Selección». Los enlaces guardados siguen
 * resolviendo —`RedireccionConQuery`, `aliasDeModulo.ts` y los resolvedores de
 * cada módulo— pero ningún código de producción puede volver a emitir la forma
 * vieja: cada escritor nuevo alarga la vida del alias.
 *
 * El barrido es sobre literales de string del AST, así que los comentarios que
 * documentan el alias no cuentan como escritores.
 */
import ts from "typescript";
import { describe, expect, test } from "vitest";
import { lineLabel, parseSourcesContaining } from "../../test/contractSourceScan";

type Vieja = { marcador: string; patron: RegExp; lectores: readonly string[] };

const VIEJAS: readonly Vieja[] = [
  {
    marcador: "/recopiladores",
    // La RUTA del módulo, no el prefijo `/api/recopiladores/*`, que sigue vigente.
    patron: /^\/recopiladores(?:[?#]|$)/,
    lectores: [
      // La tabla de alias que la traduce.
      "lib/navegacion/aliasDeModulo.ts",
      // El `<Route>` que redirige con la query.
      "app/App.tsx",
      // El perfil de warmup que la reconoce mientras redirige.
      "app/ModuleWarmupBoundary.tsx",
    ],
  },
  {
    marcador: "seccion=entrega",
    patron: /hojas-ruta\?(?:.*&)?seccion=entrega(?:&|$)/,
    lectores: [],
  },
];

function escritoresDe({ marcador, patron, lectores }: Vieja): string[] {
  const hallazgos: string[] = [];
  for (const source of parseSourcesContaining(marcador, [".ts", ".tsx"])) {
    if (lectores.includes(source.relative.split("\\").join("/"))) continue;
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteralLike(node) && patron.test(node.text)) {
        hallazgos.push(`${lineLabel(source, node)} → ${node.text}`);
      }
      if (ts.isTemplateExpression(node)) {
        for (const parte of [node.head, ...node.templateSpans.map((span) => span.literal)]) {
          if (patron.test(parte.text)) hallazgos.push(`${lineLabel(source, parte)} → ${parte.text}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source.sourceFile);
  }
  return hallazgos;
}

describe("direcciones renombradas por el ADR 0108", () => {
  test.each(VIEJAS.map((vieja) => [vieja.marcador, vieja] as const))(
    "`%s` no se escribe en producción",
    (_marcador, vieja) => {
      expect(
        escritoresDe(vieja),
        "dirección de solo lectura; escribe `/material-campo` o `?seccion=seleccion`",
      ).toEqual([]);
    },
  );
});
