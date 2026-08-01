import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const profilesDir = path.dirname(fileURLToPath(import.meta.url));
const profiles = [
  ["Acreditación", "acreditacion/AcreditacionMonitoreoPage.tsx"],
  ["Telefónico", "telefonico/TelefonicoMonitoreoPage.tsx"],
] as const;

function profileAst(relativePath: string) {
  const source = fs.readFileSync(path.join(profilesDir, relativePath), "utf8");
  return ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function findNode<T extends ts.Node>(root: ts.Node, predicate: (node: ts.Node) => node is T): T | undefined {
  let found: T | undefined;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (predicate(node)) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

function variableInitializer(ast: ts.SourceFile, name: string): ts.Expression | undefined {
  return findNode(ast, (node): node is ts.VariableDeclaration => (
    ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name
  ))?.initializer;
}

function resolveCallback(ast: ts.SourceFile, expression: ts.Expression | undefined): ts.FunctionLikeDeclaration | undefined {
  if (!expression) return undefined;
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return expression;
  if (ts.isIdentifier(expression)) return resolveCallback(ast, variableInitializer(ast, expression.text));
  if (ts.isCallExpression(expression) && expression.arguments.length) {
    return resolveCallback(ast, expression.arguments[0]);
  }
  return undefined;
}

function callbackCalls(callback: ts.FunctionLikeDeclaration, callee: string, firstArgument: string) {
  return Boolean(findNode(callback, (node): node is ts.CallExpression => (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === callee &&
    node.arguments[0]?.getText() === firstArgument
  )));
}

function readinessDependencyText(ast: ts.SourceFile, root: ts.Expression) {
  const fragments: string[] = [];
  const pending: ts.Node[] = [root];
  const visited = new Set<string>();

  while (pending.length) {
    const node = pending.pop()!;
    fragments.push(node.getText());
    const names = new Set<string>();
    const collect = (candidate: ts.Node) => {
      if (ts.isIdentifier(candidate) && !(
        ts.isPropertyAccessExpression(candidate.parent) && candidate.parent.name === candidate
      )) names.add(candidate.text);
      ts.forEachChild(candidate, collect);
    };
    collect(node);

    for (const name of names) {
      if (visited.has(name)) continue;
      visited.add(name);
      const initializer = variableInitializer(ast, name);
      if (initializer) pending.push(initializer);
      const declaration = findNode(ast, (candidate): candidate is ts.FunctionDeclaration => (
        ts.isFunctionDeclaration(candidate) && candidate.name?.text === name
      ));
      if (declaration?.body) pending.push(declaration.body);
    }
  }

  return fragments.join("\n");
}

describe("Perfiles de monitoreo: navegación y readiness ligados al scope activo", () => {
  test.each(profiles)("%s hidrata la sección pedida desde una navegación externa", (label, relativePath) => {
    const ast = profileAst(relativePath);
    const directionCall = findNode(ast, (node): node is ts.CallExpression => (
      ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useMonitoreoDireccion"
    ));
    const options = directionCall?.arguments[3];
    const handlerProperty = options && ts.isObjectLiteralExpression(options)
      ? options.properties.find((property): property is ts.PropertyAssignment => (
          ts.isPropertyAssignment(property) && property.name.getText() === "onSeccionPedida"
        ))
      : undefined;
    const callback = resolveCallback(ast, handlerProperty?.initializer);

    expect(callback, `${label}: onSeccionPedida no puede ser el setter crudo; debe llamar loadView para la sección solicitada`).toBeDefined();
    if (!callback) return;
    const requestedView = callback.parameters[0]?.name.getText() ?? "";
    expect(callbackCalls(callback, "setActiveView", requestedView), `${label}: la navegación externa debe activar la sección pedida`).toBe(true);
    expect(callbackCalls(callback, "loadView", requestedView), `${label}: la navegación externa debe cargar el scope de la sección pedida`).toBe(true);
    expect(callback.getText(), `${label}: la referencia activa debe cambiar antes de que resuelva la petición anterior`).toContain(`activeViewRef.current = ${requestedView}`);
  });

  test.each(profiles)("%s no apaga loading desde una petición de otra vista", (label, relativePath) => {
    const ast = profileAst(relativePath);
    const loadView = resolveCallback(ast, variableInitializer(ast, "loadView"));
    const guardedFinally = loadView && findNode(loadView, (node): node is ts.Block => (
      ts.isTryStatement(node.parent) && node.parent.finallyBlock === node
    ));
    const finallyText = guardedFinally?.getText() ?? "";

    expect(finallyText, `${label}: loadView debe conservar su cleanup en finally`).toContain("setLoading(false)");
    expect(finallyText, `${label}: una petición vieja no puede publicar readiness para la nueva sección`).toContain("activeViewRef.current");
    expect(finallyText, `${label}: el guard de finally debe comparar la vista que originó la petición`).toContain("view");
  });

  // La decisión ya no es un booleano sino tres estados, y por eso no se
  // comprueba aquí a fondo: qué cuenta como cubierto vive en
  // `core/coberturaDelCorte`, con su propio test. Un proyecto sin corte no tiene
  // scope que comparar y publica readiness —si no, la pantalla del primer día
  // no la publicaría nunca—; un corte de OTRA sección no es esta sección
  // cargada y deja la vista trabajando en vez de callada.
  //
  // Lo que sigue siendo de este archivo es que el perfil delegue esa decisión
  // en vez de reinventarla, que es como se separaron los dos perfiles la última
  // vez.
  test.each(profiles)("%s delega la cobertura del corte en el módulo compartido", (label, relativePath) => {
    const ast = profileAst(relativePath);
    const cobertura = variableInitializer(ast, "cobertura");

    expect(cobertura, `${label}: falta la cobertura del corte`).toBeDefined();
    expect(cobertura?.getText(), `${label}: la cobertura la decide \`coberturaDelCorte\`, no el perfil`)
      .toContain("coberturaDelCorte(");
    expect(cobertura?.getText(), `${label}: se compara el scope cargado contra el de la sección activa`)
      .toContain("scopeForView(seccionActiva");

    const carga = variableInitializer(ast, "seccionCargando");
    expect(carga, `${label}: falta el estado de carga de la sección`).toBeDefined();
    expect(carga?.getText(), `${label}: el corte de otra sección cuenta como carga en curso`)
      .toContain('cobertura === "otra-seccion"');
    expect(carga?.getText(), `${label}: y sigue contando la carga de red`).toContain("loading");
  }, 30_000);

  test.each(profiles)("%s publica readiness sólo con estado del scope requerido", (label, relativePath) => {
    const ast = profileAst(relativePath);
    const readiness = findNode(ast, (node): node is ts.JsxAttribute => (
      ts.isJsxAttribute(node) && node.name.getText() === "data-audit-ready"
    ));
    const expression = readiness?.initializer && ts.isJsxExpression(readiness.initializer)
      ? readiness.initializer.expression
      : undefined;
    expect(expression, `${label}: falta la expresión semántica de readiness`).toBeDefined();
    if (!expression) return;
    const dependencies = readinessDependencyText(ast, expression);

    expect.soft(dependencies, `${label}: readiness debe seguir ausente mientras carga`).toContain("loading");
    expect.soft(dependencies, `${label}: loading=false no basta sin estado hidratado`).toContain("state");
    expect.soft(dependencies, `${label}: readiness debe invalidarse cuando cambia la sección activa`).toContain("seccionActiva");
    expect.soft(dependencies, `${label}: readiness debe comprobar el scope devuelto por el backend`).toContain("report_scope");
    expect.soft(dependencies, `${label}: Teléfono requiere phone_summary`).toContain("phone_summary");
    // «Un payload `full` también cubre» se comprobaba aquí buscando el literal
    // dentro de la expresión. La regla no desapareció: se mudó a
    // `core/coberturaDelCorte`, que la declara en un sitio para los dos perfiles
    // y la tiene cubierta con su propio caso. Este walker resuelve nombres
    // dentro de UN archivo, así que no puede seguirla, y buscar el literal aquí
    // sólo obligaría a duplicar la regla para que el test la encuentre.
    expect.soft(dependencies, `${label}: la cobertura del corte debe delegarse, no reescribirse`).toContain("coberturaDelCorte");
  // `readinessDependencyText` resuelve identificadores de forma transitiva y
  // cada nombre nuevo dispara un recorrido del AST completo, así que sobre los
  // page-files de perfil el caso cuesta ~3.5 s (Acreditación) y ~3.6 s
  // (Telefónico). Con el presupuesto por defecto de 5 s pasa aislado y se cae
  // en la suite completa por contención. Este límite mide lo que el caso hace
  // de verdad; lo que se verifica aquí es estructura, no velocidad.
  }, 30_000);
});
