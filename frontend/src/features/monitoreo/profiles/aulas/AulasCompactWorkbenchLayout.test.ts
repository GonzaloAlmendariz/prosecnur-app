import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const aulasDir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(aulasDir, "..", "profilePage.css"), "utf8");
const aulasCss = fs.readFileSync(path.join(aulasDir, "aulasMonitoreo.css"), "utf8");
const aulasPage = fs.readFileSync(path.join(aulasDir, "AulasMonitoreoPage.tsx"), "utf8");
const aulasOperations = fs.readFileSync(path.join(aulasDir, "AulasOperationsPanel.tsx"), "utf8");

function compactRuleBody(selector: string): string {
  const marker = "@media (max-width: 1180px) and (max-height: 760px)";
  const start = css.indexOf(marker);
  const section = css.slice(start, css.indexOf("@media ", start + marker.length));
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return section.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

function shortAulasRuleBody(selector: string): string {
  const marker = "@media (max-height: 760px)";
  const start = aulasCss.indexOf(marker);
  const section = aulasCss.slice(start);
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return section.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("Aulas: workbench compacto sin fila fantasma", () => {
  test("entrega toda la única fila disponible al contenido cuando el sidebar está oculto", () => {
    const genericWorkbench = compactRuleBody(".mon-profile-workbench");
    const aulasWorkbench = compactRuleBody(".mon-profile-page.is-aulas-flow .mon-profile-workbench");

    expect(genericWorkbench).toMatch(/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/);
    expect(aulasWorkbench).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\);/);
    expect(aulasWorkbench).not.toMatch(/auto\s+minmax\(0,\s*1fr\)/);
  });

  test("mantiene Fuentes intrínseca y estabiliza el marco de Agenda en altura corta", () => {
    const view = shortAulasRuleBody(".mon-profile-page.is-aulas-flow .aulas-mon-view");
    const sourceStack = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .aulas-mon-view > .mon-profile-stack.aulas-fuentes-stack",
    );
    const agendaStack = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .aulas-mon-view > .mon-profile-stack:has(.mon-aulas-handoff-panel)",
    );
    const dataPanel = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .aulas-mon-view > .mon-profile-stack > .mon-profile-panel:last-child",
    );
    const table = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .aulas-mon-view > .mon-profile-stack > .mon-profile-panel:last-child .mon-profile-table-wrap",
    );

    expect(view).toMatch(/overflow:\s*visible;/);
    expect(sourceStack).toMatch(/grid-template-rows:\s*auto\s+auto;/);
    expect(agendaStack).toMatch(/grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/);
    expect(agendaStack).toMatch(/align-content:\s*stretch;/);
    expect(agendaStack).toMatch(/overflow:\s*hidden;/);
    expect(dataPanel).toMatch(/min-height:\s*180px;/);
    expect(table).toMatch(/min-height:\s*128px;/);
    expect(table).toMatch(/height:\s*100%;/);
    expect(table).not.toMatch(/(?:^|[;\n])\s*height:\s*128px;/);
  });

  test("convierte el flujo repetido en una banda de proceso cuando falta altura", () => {
    const flow = shortAulasRuleBody(".mon-profile-page.is-aulas-flow .aulas-flow");
    const flowGrid = shortAulasRuleBody(".mon-profile-page.is-aulas-flow .aulas-flow-grid");
    const flowCopy = shortAulasRuleBody(".mon-profile-page.is-aulas-flow .aulas-flow-copy");
    const flowStep = shortAulasRuleBody(".mon-profile-page.is-aulas-flow .aulas-flow-steps li");
    const flowStepDetail = shortAulasRuleBody(".mon-profile-page.is-aulas-flow .aulas-flow-steps li small");

    expect(flow).toMatch(/margin:\s*0;/);
    expect(flowGrid).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/);
    expect(flowCopy).toMatch(/display:\s*none;/);
    expect(flowStep).toMatch(/min-height:\s*36px;/);
    expect(flowStepDetail).toMatch(/display:\s*none;/);
  });

  test("declara los KPI repetidos como un grupo de geometría equivalente", () => {
    expect(aulasPage).toContain('data-qa-geometry-group="monitoring-aulas-kpis"');
    expect(aulasPage).toContain('data-qa-geometry-contract="equal"');
  });

  test("limita la capacidad vacía deliberada al viewport visible de cada tabla", () => {
    expect(aulasPage).toMatch(
      /<div\s+className="mon-profile-table-wrap"\s+data-qa-geometry-capacity="owned"\s+data-qa-geometry-member/,
    );
    // UNO desde que el panel de preparación dejó de declarar su grupo en el
    // `section`: con el grupo puesto ahí, la CABECERA entraba como miembro y
    // sus 5 px de holgura salían como `capacity-drift` del panel —el gate lo
    // reportó en cinco paneles del perfil—. Su rejilla de tarjetas sigue
    // declarando su propio grupo y su capacidad; lo que se retiró es la
    // declaración sobrante, no una superficie.
    expect(aulasPage.match(/data-qa-geometry-member/g)).toHaveLength(1);
    // Se cuenta la RELACIÓN, no el nombre del grupo: todo panel de datos declara
    // su contrato. Amarrar el test a `monitoring-aulas-table` con un número fijo
    // lo hacía fallar al separar Avance y Consultas en paneles propios —un
    // cambio que AÑADE superficies declaradas— y no habría visto un panel nuevo
    // bautizado con otro nombre y sin declarar, que es lo que de verdad importa.
    // `mon-profile-panel"` con la comilla de cierre contaba SOLO los paneles sin
    // clases extra, asi que los tres que llevan modificador —handoff, registro
    // y operacion— quedaban fuera del balance y su falta de declaracion no se
    // veia. El limite de clase evita casar `mon-profile-panel-head`.
    // Igualar los dos CONTEOS daba por hecho que todo contrato pertenece a un
    // panel, y no es cierto: el envoltorio que agrupa Cobertura y Brechas
    // declara `intrinsic` sin ser un panel —son dos secciones independientes
    // que comparten fila por composición—. El guard se ponía rojo por un
    // contrato de más que estaba bien puesto. Lo que hay que exigir es lo otro:
    // que NINGÚN panel se quede sin declarar. Se comprueba panel por panel, así
    // que un contrato sobrante ya no puede tapar a un panel que falte.
    const paneles = [...aulasPage.matchAll(/className="mon-profile-panel[ "]/g)];
    expect(paneles.length).toBeGreaterThan(0);
    const sinDeclarar = paneles.filter((panel) => {
      const desde = panel.index ?? 0;
      // La apertura de la etiqueta: hasta el `>` que la cierra, nunca más allá,
      // para no adoptar el contrato del elemento siguiente.
      const apertura = aulasPage.slice(desde, aulasPage.indexOf(">", desde));
      return !apertura.includes("data-qa-geometry-contract=");
    });
    expect(sinDeclarar).toHaveLength(0);
    expect(aulasPage).not.toContain('if (!rows.length) return <p className="mon-profile-muted">');
    expect(aulasCss).toMatch(
      /\.aulas-mon-view \.mon-profile-table-wrap > \.mon-profile-muted\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;/s,
    );
    expect(aulasPage).not.toMatch(
      /<section[^>]+data-qa-geometry-capacity="owned"/,
    );
  });

  test("mantiene completo el traspaso operativo antes de la agenda en altura corta", () => {
    const handoff = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .aulas-mon-view .mon-aulas-handoff-panel",
    );
    const handoffHead = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .mon-aulas-handoff-panel > .mon-profile-panel-head",
    );
    const handoffCard = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .mon-aulas-handoff-grid article",
    );
    const handoffDetail = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .mon-aulas-handoff-grid article p",
    );

    expect(handoff).toMatch(/grid-template-rows:\s*auto;/);
    expect(handoffHead).toMatch(/display:\s*none;/);
    expect(handoffCard).toMatch(/min-height:\s*40px;/);
    expect(handoffDetail).toMatch(/display:\s*none;/);
    expect(aulasPage).toContain('data-qa-geometry-group="monitoring-aulas-handoff"');
  });

  test("reserva el diagrama general para Fuentes y entrega las demás secciones a sus datos", () => {
    expect(aulasPage).toMatch(/seccionActiva\s*===\s*"fuentes"\s*\?\s*\(\s*<AulasApplicationFlow/);
    // La clase la aplica ahora el chrome compartido por `contentClassName`: el
    // mecanismo cambió al mover las pestañas al rail lateral, la intención no
    // —el modificador sigue siendo exclusivo de Fuentes—.
    expect(aulasPage).toContain('contentClassName={`mon-profile-content${seccionActiva === "fuentes" ? " has-aulas-flow" : ""}`}');
    // Y el contenido dejó de contar filas: el chrome puede anteponer un hijo
    // —el bloque de calidad de campo— y con `auto minmax(0,1fr)` ese hijo se
    // llevaba la fila del banner de KPIs. En columna flexible el número de hijos
    // deja de importar, que es justo lo que este test tiene que proteger.
    expect(aulasCss).toMatch(
      /\.mon-profile-page\.is-aulas-flow \.mon-profile-content\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
    );
    expect(aulasCss).toMatch(
      /\.mon-profile-page\.is-aulas-flow \.mon-profile-content > \.aulas-mon-view\s*\{[^}]*flex:\s*1 1 auto;/s,
    );
  });

  test("presenta la operación de Fuentes como estados y acciones completos en una sola banda", () => {
    const panel = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .aulas-mon-view .aulas-ops-panel",
    );
    const head = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .aulas-ops-panel > .mon-profile-panel-head",
    );
    const card = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .aulas-ops-grid article",
    );
    const hint = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .aulas-ops-grid article small",
    );
    const actionsMeta = shortAulasRuleBody(
      ".mon-profile-page.is-aulas-flow .aulas-ops-actions em",
    );

    expect(panel).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/);
    expect(panel).toMatch(/grid-template-rows:\s*auto;/);
    expect(head).toMatch(/display:\s*none;/);
    expect(card).toMatch(/min-height:\s*40px;/);
    expect(hint).toMatch(/display:\s*none;/);
    expect(actionsMeta).toMatch(/display:\s*none;/);
    expect(aulasOperations).toContain('data-qa-geometry-group="monitoring-aulas-operations"');
    expect(aulasOperations).toContain('data-qa-geometry-contract="equal"');
  });
  test("el registro de campo da su alto al contenido en vez de repartirlo", () => {
    // Medido a 1024x600 antes de la regla: el stack recibia 87 px y sus cuatro
    // paneles quedaban en `0px 26px 26px 180px`, con dos reducidos a su
    // encabezado. A 1440x1000 el mismo defecto se veia al reves y peor: los
    // paneles se dibujaban ENCIMA del titulo del siguiente. Por eso la regla no
    // vive dentro de ninguna media query.
    const reglaDe = (selector: string): string => {
      const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return aulasCss.match(new RegExp(`${escapado}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    };

    expect(reglaDe(".mon-profile-page.is-aulas-flow .aulas-mon-view:has(.registro-campo)"))
      .toMatch(/flex:\s*1 0 auto;/);
    expect(reglaDe(".mon-profile-page.is-aulas-flow .mon-profile-stack:has(.registro-campo)"))
      .toMatch(/grid-auto-rows:\s*min-content;/);

    // Y no queda encerrada en el bloque de viewport bajo, que es donde estuvo
    // primero y donde solo reparaba la mitad del defecto. El helper de arriba
    // no sirve para comprobarlo —lee desde el marcador hasta el final del
    // archivo—, asi que aqui se delimita el bloque contando llaves.
    const inicioMedia = aulasCss.indexOf("@media (max-height: 760px) {");
    let profundidad = 0;
    let finMedia = inicioMedia;
    for (let i = aulasCss.indexOf("{", inicioMedia); i < aulasCss.length; i += 1) {
      if (aulasCss[i] === "{") profundidad += 1;
      else if (aulasCss[i] === "}") {
        profundidad -= 1;
        if (profundidad === 0) { finMedia = i; break; }
      }
    }
    const posRegla = aulasCss.indexOf(
      ".mon-profile-page.is-aulas-flow .mon-profile-stack:has(.registro-campo) {",
    );
    expect(posRegla).toBeGreaterThan(-1);
    expect(posRegla > inicioMedia && posRegla < finMedia).toBe(false);

    // Ni se generaliza a la seccion: las otras pestanas de Validacion viven de
    // la fila `minmax(0, 1fr)` para el scroll interno de sus tablas.
    expect(aulasCss).not.toMatch(
      /\.mon-workbench-content--calidad[^{]*\.mon-profile-stack\s*\{[^}]*grid-auto-rows:\s*min-content;/s,
    );
  });
});
