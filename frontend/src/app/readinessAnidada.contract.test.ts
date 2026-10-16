import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  evaluarMarcas,
  viveBajoAncestroOculto,
  type MarcaLeida,
} from "../lib/navegacion/runtime";

/**
 * **Una vista está lista sólo si NINGUNA de sus marcas sigue en `false`.**
 *
 * `estadoListo()` leía la primera `[data-audit-ready]` del documento. En
 * Cálculo de muestra (cursos-horario) esa es la de `motor/ResumenDiseno`, fija
 * en verdadero, así que el Explorador se daba por listo con su propia marca en
 * `false` y la captura salía «Leyendo la base…» (E15/AD6). El fallback del
 * runner (`scripts/ui-quick-check.mjs`) tenía la misma ceguera.
 *
 * El contrato nuevo tiene un precio: `false` ya no puede significar «terminé y
 * no hay nada», porque bloquea. Significa sólo «todavía no». Un estado terminal
 * sin contenido publica `vacio:<motivo>`.
 */

const appDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(appDir, "..");
const repoRoot = path.resolve(srcDir, "../..");

const marca = (valor: string, extra: Partial<MarcaLeida> = {}): MarcaLeida => ({
  valor,
  inactiva: false,
  descripcion: `marca-${valor}`,
  ...extra,
});

describe("evaluarMarcas: el contrato sobre todas las marcas", () => {
  test("sin marcas no hay contrato que cumplir", () => {
    expect(evaluarMarcas([])).toEqual({ listo: false, motivo: "sin-marca-de-readiness" });
  });

  test("una marca exterior en true ya no tapa a una anidada en false (AD6)", () => {
    const estado = evaluarMarcas([
      marca("calc-muestra-motor"),
      marca("false", { descripcion: "cmv2-expb" }),
    ]);
    expect(estado).toEqual({
      listo: false,
      motivo: "marca-en-false",
      marca: "false",
      pendiente: "cmv2-expb",
    });
  });

  test("un false bajo un ancestro oculto no bloquea: es una pestaña que no se ve", () => {
    expect(evaluarMarcas([marca("calc-muestra"), marca("false", { inactiva: true })]))
      .toEqual({ listo: true, marca: "calc-muestra" });
  });

  test("un estado terminal clasificado cuenta como listo", () => {
    expect(evaluarMarcas([marca("calc-muestra"), marca("vacio:sin-referencia-historica")]).listo)
      .toBe(true);
  });

  test("la marca reportada al estar lista sigue siendo la exterior", () => {
    expect(evaluarMarcas([marca("monitoreo-aulas"), marca("true")]).marca).toBe("monitoreo-aulas");
  });
});

type NodoFalso = {
  parentElement: NodoFalso | null;
  atributos: string[];
  oculto?: boolean;
  hasAttribute: (nombre: string) => boolean;
};

function nodo(padre: NodoFalso | null, atributos: string[] = [], oculto = false): NodoFalso {
  return { parentElement: padre, atributos, oculto, hasAttribute: (n) => atributos.includes(n) };
}

describe("viveBajoAncestroOculto", () => {
  const porEstilo = (n: NodoFalso) => n.oculto === true;

  test("el hidden del PROPIO nodo no cuenta: Monitoreo publica su marca en un <span hidden>", () => {
    const raiz = nodo(null);
    expect(viveBajoAncestroOculto(nodo(raiz, ["hidden"]), porEstilo)).toBe(false);
  });

  test("un ancestro con hidden, inert o display:none vuelve inactiva la marca", () => {
    expect(viveBajoAncestroOculto(nodo(nodo(nodo(null), ["hidden"])), porEstilo)).toBe(true);
    expect(viveBajoAncestroOculto(nodo(nodo(null, ["inert"])), porEstilo)).toBe(true);
    expect(viveBajoAncestroOculto(nodo(nodo(nodo(null, [], true))), porEstilo)).toBe(true);
  });

  test("sin ancestros ocultos la marca está activa", () => {
    expect(viveBajoAncestroOculto(nodo(nodo(nodo(null))), porEstilo)).toBe(false);
  });
});

describe("el puente y el runner aplican el mismo contrato", () => {
  test("estadoListo() ya no resuelve con la primera marca", () => {
    const runtime = readFileSync(path.join(srcDir, "lib/navegacion/runtime.ts"), "utf8");
    expect(runtime).not.toMatch(/document\.querySelector\(SELECTOR_READY\)/);
    expect(runtime).toMatch(/document\.querySelectorAll\(SELECTOR_READY\)/);
  });

  test("el fallback de ui-quick-check lee todas las marcas y sólo mira ancestros", () => {
    const runner = readFileSync(path.join(repoRoot, "scripts/ui-quick-check.mjs"), "utf8");
    const inicio = runner.indexOf("async function esperarListo(");
    const fin = runner.indexOf("async function clickNamedControl(", inicio);
    const fallback = runner.slice(inicio, fin);
    expect(fallback).not.toMatch(/document\.querySelector\("\[data-audit-ready\]"\)/);
    expect(fallback).toMatch(/document\.querySelectorAll\("\[data-audit-ready\]"\)/);
    expect(fallback).toMatch(/let node = el\.parentElement/);
  });
});

// ---------------------------------------------------------------------------
// Cada `false` declara que es transitorio
// ---------------------------------------------------------------------------

/**
 * Las superficies que pueden publicar `"false"`, y POR QUÉ ese `false` termina.
 *
 * Un `false` que no termina cuelga el QA hasta agotar el tope, y el runner
 * sugiere entonces subir el timeout: la pista opuesta a la correcta. Añadir un
 * archivo aquí exige comprobar que el `false` es una carga, no un vacío.
 */
const FALSE_TRANSITORIO: Record<string, string> = {
  "components/PageFrame.tsx":
    "`auditReady={false}` de la página: la página lo levanta al terminar su lectura (Carga › Revisión)",
  "features/carga/EquivalenciasEsqueleto.tsx":
    "esqueleto de Equivalencias: lo reemplaza la superficie al terminar la lectura de la declaración y el catálogo; en error publica true",
  "features/carga/FuentesEmparejamientoPanel.tsx":
    "panel «Ver preguntas»: cargando el endpoint o resolviendo la base; en error publica true",
  "features/analitica/panes/DataReviewPane.tsx":
    "`loading` de la revisión de datos; el error es terminal y publica true",
  "features/carga/MapaBasesPanel.tsx":
    "mapa de bases: sólo mientras lee lo que cada base tiene fuera de la matriz; al terminar (o fallar) publica true",
  "features/analitica/PanelUniverso.tsx":
    "panel «Qué casos cuentan»: sólo mientras lee el universo de las bases; el error es terminal y publica true",
  "features/analitica/PanelVariablesExcluidas.tsx":
    "panel «Variables excluidas»: config de Analítica sin hidratar, variables cargando o cambio de base en curso; en error publica true",
  "features/graficos/GraficosPage.tsx":
    "fallbacks de Suspense de las pestañas perezosas: los reemplaza el chunk al cargar",
  "features/graficos/estilo/PestanaEstilo.tsx": "listo al llegar las opciones o su error",
  "features/graficos/estiloInforme/PestanaEstiloInforme.tsx": "`cargando` de la lectura del estilo del informe",
  "features/graficos/indice/BibliotecaIconos.tsx": "listo al llegar los nombres de íconos o su error",
  "features/calcMuestra/CalcMuestraPage.tsx":
    "`calc-muestra-hidratando`: la rehidratación del estado del proyecto",
  "features/calcMuestra/general/ArchivoMarcoGeneral.tsx":
    "`cargado` del store de Muestra general, que se pone en true también si la lectura falla",
  "features/calcMuestra/general/SeleccionGeneral.tsx": "`cargado` del store (true también en error)",
  "features/calcMuestra/general/SeleccionActores.tsx": "`cargado` del store (true también en error)",
  "features/calcMuestra/general/PestanasMesa.tsx": "`listo={cargado}` del store (true también en error)",
  "features/calcMuestra/general/MetodoGeneral.tsx":
    "`metodoListo`: catálogo fuera de `cargando` y marco leído del store",
  "features/calcMuestra/universidad/definicion/ExploradorBasesTab.tsx":
    "`exploradorListo`: sólo mientras lee la base; error y marco son terminales en true (AD6)",
  "features/monitoreo/profiles/aulas/AulasMonitoreoPage.tsx": "`loading` de la página",
  "features/monitoreo/profiles/territorial/TerritorialMonitoreoPage.tsx": "`activeLoading` de la página",
  "features/monitoreo/profiles/telefonico/TelefonicoMonitoreoPage.tsx":
    "carga de la sección; un error de PÁGINA sigue en false por la política de página (Bitácora en auditReadyRoutes)",
  "features/monitoreo/profiles/acreditacion/AcreditacionMonitoreoPage.tsx":
    "carga de la sección; un error de PÁGINA sigue en false por la política de página (Bitácora en auditReadyRoutes)",
  "features/xlsformEditor/shell/FormsLibrary.tsx": "`loading` de la biblioteca de formularios",
  "features/xlsformEditor/choiceFilters/ChoiceFiltersView.tsx":
    "`model` sólo es null con el overlay cerrado, y cerrado no se monta",
};

/** El fuente sin comentarios: nombrar el atributo en prosa no es emitirlo. */
function codigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Valor de cada `data-audit-ready=`: el literal o la expresión entre llaves balanceadas. */
function valoresDeMarca(fuente: string): string[] {
  const valores: string[] = [];
  const atributo = "data-audit-ready=";
  for (let i = fuente.indexOf(atributo); i >= 0; i = fuente.indexOf(atributo, i + 1)) {
    const inicio = i + atributo.length;
    if (fuente[inicio] === '"') {
      valores.push(fuente.slice(inicio, fuente.indexOf('"', inicio + 1) + 1));
      continue;
    }
    if (fuente[inicio] !== "{") continue;
    let profundidad = 0;
    let fin = inicio;
    for (; fin < fuente.length; fin += 1) {
      if (fuente[fin] === "{") profundidad += 1;
      if (fuente[fin] === "}") profundidad -= 1;
      if (profundidad === 0) break;
    }
    valores.push(fuente.slice(inicio, fin + 1));
  }
  return valores;
}

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

/**
 * Una expresión booleana sin ternario: React renderiza `data-*={false}` como
 * `"false"`, y el barrido del literal no la ve. Era la forma de
 * `CriteriosRadiografiaCardDetalle` (`card.state === "v2" && i18bComplete`).
 */
function esBooleana(valor: string): boolean {
  // Con `undefined` la expresión BORRA la marca, no la vuelve booleana: eso lo
  // guarda readinessQueSeDeclara (`auditReady || undefined` de PageFrame).
  if (!valor.startsWith("{") || valor.includes("?") || /\bundefined\b/.test(valor)) return false;
  return /&&|\|\||===|!==|[<>]=?|^\{\s*!|\btrue\b|\bfalse\b|Boolean\(/.test(valor);
}

describe("cada false de readiness es transitorio", () => {
  const conFalse = archivos(srcDir)
    .map((f) => ({ relativo: path.relative(srcDir, f), valores: valoresDeMarca(codigo(readFileSync(f, "utf8"))) }))
    .filter(({ valores }) => valores.some((v) => v.includes('"false"')));

  test("el barrido ve los false que existen: si deja de verlos, lo dice", () => {
    expect(conFalse.length).toBeGreaterThan(5);
  });

  test("ninguna superficie publica false sin declarar por qué termina", () => {
    const sinDeclarar = conFalse
      .filter(({ relativo }) => !(relativo in FALSE_TRANSITORIO))
      .map(({ relativo, valores }) => `${relativo}: ${valores.filter((v) => v.includes('"false"')).join(" · ")}`);
    expect(
      sinDeclarar,
      "Desde E15/AD6 un `false` anidado bloquea la readiness de toda la vista. Si es un estado " +
        "terminal (vacío, error, marco no publicable, desactualizado) publica `vacio:<motivo>`; " +
        "si de verdad es una carga, decláralo en FALSE_TRANSITORIO con el motivo por el que termina.",
    ).toEqual([]);
  });

  test("ninguna marca es una expresión booleana: renderizaría \"false\" sin que el barrido lo vea", () => {
    const booleanas = archivos(srcDir).flatMap((f) =>
      valoresDeMarca(codigo(readFileSync(f, "utf8")))
        .filter(esBooleana)
        .map((v) => `${path.relative(srcDir, f)}: ${v}`));
    expect(
      booleanas,
      "Publica un string: `cond ? \"true\" : \"vacio:<motivo>\"` si el estado no es terminal, " +
        "o `\"false\"` declarado en FALSE_TRANSITORIO si es una carga.",
    ).toEqual([]);
  });

  test("el detector de booleanas reconoce la forma que se coló", () => {
    expect(esBooleana('{card.state === "v2" && i18bComplete}')).toBe(true);
    expect(esBooleana("{!cargando}")).toBe(true);
    expect(esBooleana('{ready ? "true" : "false"}')).toBe(false);
    expect(esBooleana("{auditReady}")).toBe(false);
    expect(esBooleana("{auditReady || undefined}")).toBe(false);
  });

  test("la lista no se infla con superficies que ya no publican false", () => {
    const vistos = new Set(conFalse.map(({ relativo }) => relativo));
    expect(Object.keys(FALSE_TRANSITORIO).filter((r) => !vistos.has(r))).toEqual([]);
  });
});
