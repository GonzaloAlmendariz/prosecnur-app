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
  // ADR 0111: el correo dejó de ser Catálogo › Correos y es una campaña propia
  // (`?modo=correo&campana=correo.<id>&seccion=correo&pestana=editor`). El
  // enlace viejo lo lee `campanas/redirecciones.ts` por sus palabras, no por
  // esta URL.
  {
    marcador: "pestana=correos",
    patron: /(?:^|[?&])pestana=correos(?:&|$)/,
    lectores: [],
  },
  // Revamp de Monitoreo (2026-10-23): Telefónico pasó al esqueleto común
  // Insumos · Modelo · Control · Avance. Sus secciones viejas las lee como alias
  // `profiles/telefonico/navegacion/direccionTelefonica.ts`, sin escribirlas.
  {
    marcador: "modo=telefonico&seccion=",
    patron: /modo=telefonico&seccion=(?:fuentes|telefonico|consultas)(?:&|$)/,
    lectores: [],
  },
  // Una sección del modo aulas sin `modo=`: sólo la lee la redirección.
  {
    marcador: "/material-campo?seccion=",
    patron: /^\/material-campo\?seccion=/,
    lectores: [],
  },
  // ADR 0142 (2026-11-11): las pestañas de Carga `plan`, `fuentes`, `estructura`
  // y `datos` pasaron a `bases`, `formulario` y `respuestas`. Las lee como alias
  // `features/carga/pestanaCarga.ts`. Los patrones van acotados a Carga porque
  // `pestana=plan` existe en Material de campo y `pestana=datos` en Analítica.
  {
    marcador: "/carga?",
    patron: /^\/carga\?(?:.*&)?pestana=(?:plan|fuentes|estructura|datos)(?:&|$)/,
    lectores: [],
  },
  {
    marcador: "seccion=carga",
    patron: /seccion=carga&(?:.*&)?pestana=(?:plan|fuentes|estructura|datos)(?:&|$)/,
    lectores: [],
  },
  // ADR 0142, rebanada V2 de P6 (2026-11-11): las pestañas de Validación
  // `instrumento`, `reglas_custom` y `limpieza` pasaron a `reglas` y
  // `hallazgos`. Las lee como alias `features/validacion/pestanaValidacion.ts`.
  // Acotados a Validación porque `instrumento` y `limpieza` existen en otros
  // módulos.
  {
    marcador: "/validacion?",
    patron: /^\/validacion\?(?:.*&)?pestana=(?:instrumento|reglas_custom|reglas-custom|limpieza)(?:&|$)/,
    lectores: [],
  },
  {
    marcador: "seccion=validacion",
    patron: /seccion=validacion&(?:.*&)?pestana=(?:instrumento|reglas_custom|reglas-custom|limpieza)(?:&|$)/,
    lectores: [],
  },
  // ADR 0144 (2026-11-12): Base final, Bases e instrumentos, Libro de códigos y
  // Ficha técnica de Analítica pasaron a Entrega. Las lee como alias
  // `features/analitica/pestanaAnalitica.ts`. Acotados a Analítica porque
  // `bases` es pestaña de Carga y `ficha` de Monitoreo.
  {
    marcador: "/analitica?",
    patron: /^\/analitica\?(?:.*&)?pestana=(?:base_final|base-final|bases|codebook|ficha)(?:&|$)/,
    lectores: [],
  },
  {
    marcador: "seccion=analitica",
    patron: /seccion=analitica&(?:.*&)?pestana=(?:base_final|base-final|bases|codebook|ficha)(?:&|$)/,
    lectores: [],
  },
  // ADR 0142 y 0144: Matrices de Codificación se retiró; la lee como alias de
  // Codificar `features/codificacion/CodificacionPage.tsx`.
  {
    marcador: "/codificacion?",
    patron: /^\/codificacion\?(?:.*&)?pestana=matrices(?:&|$)/,
    lectores: [],
  },
];

/** Claves viejas de Validación (ADR 0142, rebanada V2 de P6). */
const CLAVES_VIEJAS_VALIDACION = new Set(["instrumento", "reglas_custom", "reglas-custom", "limpieza"]);

/** Claves viejas de Carga (ADR 0142). */
const CLAVES_VIEJAS_CARGA = new Set(["plan", "fuentes", "estructura", "datos"]);

/**
 * Escritores de Carga que todavía arman la dirección con una clave vieja en un
 * archivo que esta rebanada no podía tocar. Cada entrada es deuda con dueño: la
 * dirección funciona porque el alias la lee, pero alarga su vida.
 */
type PendienteCarga = { archivo: string; constante: string };

/**
 * La excepción nombra la constante, no el archivo entero: cualquier otra
 * dirección vieja del mismo archivo sigue en rojo.
 */
const PENDIENTES_CARGA: readonly PendienteCarga[] = [
  // Vacía: `DIRECCION_FUENTES` de Analítica pasó a `DIRECCION_BASES_DE_CARGA` (`pestana: "bases"`).
];

/** La declaración `const <nombre> = …` exceptuada en este archivo. */
function esPendiente(relativo: string, node: ts.Node): boolean {
  return ts.isVariableDeclaration(node)
    && ts.isIdentifier(node.name)
    && PENDIENTES_CARGA.some((p) => p.archivo === relativo && p.constante === (node.name as ts.Identifier).text);
}

function textoLiteral(nodo: ts.Node | undefined): string | null {
  return nodo && ts.isStringLiteralLike(nodo) ? nodo.text : null;
}

/**
 * Las otras dos formas de escribir una pestaña de Carga: un objeto de dirección
 * (`{ seccion: "carga", pestana: "fuentes" }`, lo que recibe
 * `serializarDireccion`) y una escritura de nivel dentro de Carga
 * (`irA("pestana", "fuentes")`, `conNivel(search, "pestana", "datos")`).
 */
function escritoresDeCargaPorNivel(): string[] {
  return escritoresPorNivel("carga", "features/carga/", CLAVES_VIEJAS_CARGA);
}

/**
 * Lo mismo para Validación, más la tercera forma que solo existe allí:
 * `irAPestana("limpieza", …)` (`features/validacion/pestanaDireccionable.ts`).
 */
function escritoresDeValidacionPorNivel(): string[] {
  const hallazgos = escritoresPorNivel("validacion", "features/validacion/", CLAVES_VIEJAS_VALIDACION);
  for (const source of parseSourcesContaining("irAPestana", [".ts", ".tsx"])) {
    const relativo = source.relative.split("\\").join("/");
    if (!relativo.startsWith("features/validacion/")) continue;
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && node.expression.text === "irAPestana"
      ) {
        const primera = textoLiteral(node.arguments[0]);
        if (primera && CLAVES_VIEJAS_VALIDACION.has(primera)) {
          hallazgos.push(`${lineLabel(source, node)} → irAPestana("${primera}")`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source.sourceFile);
  }
  return hallazgos;
}

function escritoresPorNivel(seccion: string, carpeta: string, viejas: ReadonlySet<string>): string[] {
  const hallazgos: string[] = [];
  for (const source of parseSourcesContaining("pestana", [".ts", ".tsx"])) {
    const relativo = source.relative.split("\\").join("/");
    const enCarpeta = relativo.startsWith(carpeta);
    const visit = (node: ts.Node) => {
      if (esPendiente(relativo, node)) return;
      if (ts.isObjectLiteralExpression(node)) {
        const valor = (clave: string) => {
          const prop = node.properties.find(
            (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === clave,
          );
          return textoLiteral(prop?.initializer);
        };
        const pestana = valor("pestana");
        if (valor("seccion") === seccion && pestana && viejas.has(pestana)) {
          hallazgos.push(`${lineLabel(source, node)} → { seccion: "${seccion}", pestana: "${pestana}" }`);
        }
      }
      if (enCarpeta && ts.isCallExpression(node)) {
        const args = node.arguments;
        args.forEach((arg, i) => {
          const siguiente = textoLiteral(args[i + 1]);
          if (textoLiteral(arg) === "pestana" && siguiente && viejas.has(siguiente)) {
            hallazgos.push(`${lineLabel(source, node)} → (..., "pestana", "${siguiente}")`);
          }
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source.sourceFile);
  }
  return hallazgos;
}

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

describe("pestañas de Carga renombradas por el ADR 0142", () => {
  test("ningún objeto de dirección ni escritura de nivel usa una clave vieja de Carga", () => {
    expect(
      escritoresDeCargaPorNivel(),
      "clave de solo lectura; escribe `bases`, `formulario` o `respuestas`",
    ).toEqual([]);
  });

  test("cada pendiente sigue escribiendo una clave vieja (si no, se borra de la lista)", () => {
    for (const { archivo, constante } of PENDIENTES_CARGA) {
      const fuente = parseSourcesContaining("pestana", [".ts", ".tsx"])
        .find((s) => s.relative.split("\\").join("/") === archivo);
      expect(fuente, `${archivo} ya no existe`).toBeDefined();
      let declaracion = "";
      const buscar = (node: ts.Node) => {
        if (fuente && esPendiente(archivo, node) && (node as ts.VariableDeclaration).name.getText(fuente.sourceFile) === constante) {
          declaracion = node.getText(fuente.sourceFile);
        }
        ts.forEachChild(node, buscar);
      };
      if (fuente) buscar(fuente.sourceFile);
      expect(declaracion, `${archivo} ya no declara ${constante}`).not.toBe("");
      expect(declaracion).toMatch(/seccion: "carga",\s*pestana: "(?:plan|fuentes|estructura|datos)"/);
    }
  });
});

describe("pestañas de Validación renombradas por el ADR 0142 (rebanada V2 de P6)", () => {
  test("ningún objeto de dirección, escritura de nivel ni irAPestana usa una clave vieja de Validación", () => {
    expect(
      escritoresDeValidacionPorNivel(),
      "clave de solo lectura; escribe `reglas`, `hallazgos` o `cierre`",
    ).toEqual([]);
  });
});

describe("direcciones renombradas por el ADR 0108", () => {
  test.each(VIEJAS.map((vieja) => [vieja.marcador, vieja] as const))(
    "`%s` no se escribe en producción",
    (_marcador, vieja) => {
      expect(
        escritoresDe(vieja),
        "dirección de solo lectura; escribe la forma nueva que dice el comentario de su entrada",
      ).toEqual([]);
    },
  );
});
