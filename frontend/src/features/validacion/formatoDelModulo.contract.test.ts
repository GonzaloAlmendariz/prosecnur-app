import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Pasada de formato de Validación (4 nov 2026), con meta 0.**
 *
 * Misma receta que Codificación, Carga, Cálculo y Gráficos
 * (`docs/qa/formato-validacion-2026-11-04.md`):
 *
 * - P1: la letra va por rol (`var(--pulso-type-<rol>-size)` de `app/tipografia.css`), en las
 *   hojas y en los estilos en línea del JSX. Había 105 `font-size` en px y 225 `fontSize`
 *   numéricos (ReglaDrillPanel 46, LimpiezaTab 39, ReglaEditor 33, InstrumentoTab 25…).
 * - P3: una lista se une con coma o con «y» (`lib/enumerar`); una precisión va entre
 *   paréntesis; un aviso con punto y coma; un separador visual es una línea fina. Había 57
 *   líneas con « · » en el código. Los que quedan están en comentarios, incluido el formato
 *   del backend («… · E_NO_DATA_INST»), que se cita pero no se pinta.
 * - P4: las cifras visibles van por `lib/formatoNumero` (o `fmtN` del explorador, que delega
 *   en él). Ningún `toLocaleString`, y ningún conteo `.length` crudo en el texto: la cola de
 *   Limpieza o los casos de una regla pasan de mil. Los `toFixed(1)` de porcentaje se quedan
 *   (nunca llegan a mil y conservan el «.0»).
 * - P5: el vacío es `EstadoVacio` y la espera `LoadingBlock`. Había 5 vacíos con clase propia
 *   (`crossbar-vacio`, `pulso-option-picker-empty` ×3, `pulso-rel-empty`, `pulso-criterios-empty`)
 *   y 5 esperas escritas como texto. Se declara la pantalla de preparación del explorador
 *   (`pulso-validacion-explorar-loading*`): enseña los pasos y una silueta, como la de Codificación.
 * - P6: un estado con tono es `EstadoChip`: el de cada regla de coherencia (`pulso-rel-status`) y
 *   los del encabezado de controles operativos (`pulso-operational-chip`). Las píldoras que son
 *   botones (`pulso-vv2-pill`) y las fichas de datos (`pulso-cvm-chip`) no son estados. Tampoco
 *   vuelven las píldoras de estado escritas en línea (`StatusPill`, `StatusBadge`, `SeverityBadge`
 *   pintaban fondo, borde y tono a mano); las de categoría o conteo (`SourceBadge`,
 *   `CategoryBadge`, `CaseBadge`) son datos y se quedan.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo, ext);
    return ext.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");

/** Líneas de código, sin comentarios de bloque ni de línea. */
function lineas(fuente: string): string[] {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""));
}

function hallazgos(ext: RegExp, cuenta: (l: string) => string[]): string[] {
  return archivos(aqui, ext).flatMap((f) =>
    lineas(readFileSync(f, "utf8")).flatMap((l, i) => cuenta(l).map((x) => `${rel(f)}:${i + 1} ${x}`)),
  );
}

const PX_EN_HOJA = /font-size\s*:\s*\d+(?:\.\d+)?px/g;
const PX_EN_LINEA = /fontSize\s*:\s*\d/g;
const PUNTO = /·/g;
/** Un `toLocaleString` sin opciones de fecha: una cifra formateada a mano. */
const TO_LOCALE = /toLocaleString\((?:"es-PE")?\)/g;
/** `{x.length}` en el texto o `${x.length}` en una plantilla; una prop `={x.length}` no se pinta. */
const RECETA =
  /\b(?:pulso-(?:validacion|rel|criterios|option-picker|cvm|operational|val)|crossbar|vx)(?:-[a-z0-9]+)*-(?:empty|vacio|loading|cargando)(?:(?:-|__)[a-z0-9]+)*\b/g;
const DECLARADAS = /^pulso-validacion-explorar-loading(?=$|-)/;
/** Una espera con objeto («Leyendo las columnas…») escrita como texto; el rótulo de LoadingBlock
 * (`label=`) y el rótulo ocupado de un botón (`? "…"`) no cuentan. */
const ESPERA_A_MANO = /(Leyendo|Cargando|Calculando|Preparando|Generando|Validando) [^"'`<>{}]*…/;
const ESPERA_PERMITIDA = /\blabel=|\?\s*"(Leyendo|Cargando|Calculando|Preparando|Generando|Validando)/;
const PILDORA = /\bpulso-(?:rel-status|operational-chip)\b/g;
/** Un componente de píldora de estado que vuelve a pintar el tono a mano. */
const PILDORA_EN_LINEA = /function (?:StatusPill|StatusBadge|SeverityBadge)\b[\s\S]*?\n\}/g;
const CONTEO_CRUDO = /(?<![=\w])\{[A-Za-z_][\w.?]*\.length\}|\$\{[A-Za-z_][\w.?]*\.length\}/g;

const todas = (re: RegExp) => (l: string) => [...l.matchAll(re)].map((m) => m[0]);

describe("formato de Validación", () => {
  it("el barrido ve el feature (centinela)", () => {
    expect(archivos(aqui, /\.(tsx|ts|css)$/).length).toBeGreaterThan(70);
  });

  it("P1: ninguna hoja ni plantilla escribe font-size en px", () => {
    expect(hallazgos(/\.(css|tsx)$/, todas(PX_EN_HOJA))).toEqual([]);
  });

  it("P1: ningún estilo en línea escribe fontSize con un número", () => {
    expect(hallazgos(/\.tsx$/, todas(PX_EN_LINEA)), 'Usa fontSize: "var(--pulso-type-<rol>-size)".').toEqual([]);
  });

  it("P3: el punto medio no se pinta como separador", () => {
    expect(hallazgos(/\.tsx?$/, todas(PUNTO)), 'Une con coma o "y" (lib/enumerar); un separador es una línea fina.').toEqual([]);
  });

  it("P4: ninguna cifra se formatea con toLocaleString suelto", () => {
    expect(hallazgos(/\.tsx?$/, todas(TO_LOCALE)), "Usa lib/formatoNumero.").toEqual([]);
  });

  it("P4: ningún conteo .length se pinta sin separador de miles", () => {
    expect(hallazgos(/\.tsx$/, todas(CONTEO_CRUDO)), "Usa formatoConteo(x.length).").toEqual([]);
  });

  it("P5: ningún vacío ni carga con receta propia", () => {
    const propias = hallazgos(/\.(tsx|ts|css)$/, (l) => todas(RECETA)(l).filter((c) => !DECLARADAS.test(c)));
    expect(propias, "Usa EstadoVacio, LoadingBlock o ErrorBlock del kit.").toEqual([]);
  });

  it("P5: una espera va por LoadingBlock, no como texto suelto", () => {
    const sueltas = archivos(aqui, /\.tsx$/).flatMap((f) =>
      lineas(readFileSync(f, "utf8"))
        .map((l, i) => (ESPERA_A_MANO.test(l) && !ESPERA_PERMITIDA.test(l) ? `${rel(f)}:${i + 1}: ${l.trim()}` : null))
        .filter((x): x is string => x !== null),
    );
    expect(sueltas).toEqual([]);
  });

  it("P6: un estado con tono es EstadoChip", () => {
    expect(hallazgos(/\.(tsx|css)$/, todas(PILDORA))).toEqual([]);
  });

  it("P6: una píldora de estado no se pinta a mano en línea", () => {
    const aMano = archivos(aqui, /\.tsx$/).flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(PILDORA_EN_LINEA)]
        .filter((m) => /background:|border:/.test(m[0]))
        .map((m) => `${rel(f)}: ${m[0].split("(")[0]}`),
    );
    expect(aMano, "Usa EstadoChip.").toEqual([]);
  });

  it("los detectores reconocen lo que prohíben (no son guards que no guardan)", () => {
    expect(todas(PX_EN_HOJA)("a { font-size: 11.5px; }")).toHaveLength(1);
    expect(todas(PX_EN_LINEA)("{ fontSize: 12, color }")).toHaveLength(1);
    expect(todas(PX_EN_LINEA)('{ fontSize: "var(--pulso-type-body-size)" }')).toHaveLength(0);
    expect(todas(PUNTO)("{a} · {b}")).toHaveLength(1);
    expect(todas(TO_LOCALE)('n.toLocaleString("es-PE")')).toHaveLength(1);
    expect(todas(TO_LOCALE)('d.toLocaleString("es-PE", { dateStyle: "medium" })')).toHaveLength(0);
    expect(todas(CONTEO_CRUDO)("<span>{casos.length} casos</span>")).toHaveLength(1);
    expect(todas(CONTEO_CRUDO)("`Ver las ${filas.length} opciones`")).toHaveLength(1);
    expect(todas(CONTEO_CRUDO)("total={casos.length}")).toHaveLength(0);
    expect(todas(RECETA)('<div className="pulso-rel-empty">')).toEqual(["pulso-rel-empty"]);
    expect(todas(RECETA)('<p className="crossbar-vacio">')).toEqual(["crossbar-vacio"]);
    expect(todas(RECETA)('color: var(--pulso-status-empty)')).toEqual([]);
    expect(DECLARADAS.test("pulso-validacion-explorar-loading-step")).toBe(true);
    expect(ESPERA_A_MANO.test("<p>Leyendo el formulario…</p>")).toBe(true);
    expect(ESPERA_PERMITIDA.test('<LoadingBlock label="Leyendo el formulario…" />')).toBe(true);
    expect(todas(PILDORA)('<span className="pulso-rel-status is-cases">')).toHaveLength(1);
    expect(todas(PILDORA)('<span className="pulso-operational-chips">')).toHaveLength(0);
    const vieja = 'function StatusBadge({ a }) {\n  return <span style={{ background: "x" }} />;\n}';
    expect([...vieja.matchAll(PILDORA_EN_LINEA)]).toHaveLength(1);
    expect(lineas("// a · b\nconst x = 1;")).toEqual(["", "const x = 1;"]);
  });
});
