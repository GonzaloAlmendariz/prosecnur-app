/**
 * Unidades › Lista no llama hooks después de un `return` (React #310).
 *
 * `PlanSection` tiene una guarda de «sin plan» que devuelve el vacío. Si un
 * `useMemo`/`useState` queda debajo, el número de hooks cambia cuando el plan
 * se siembra en el mismo montaje («Adaptar fuente disponible») y React tira
 * #310. Ya mordió en esta app al cambiar de pestaña, y un test de render
 * estático no lo ve: pinta un solo render. Este entorno de Vitest no tiene DOM
 * (sin jsdom), así que se fija en el código fuente: ningún `use*(` ni `use*<…>(` después del
 * primer `return` del componente.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fuente = readFileSync(fileURLToPath(new URL("./PlanSection.tsx", import.meta.url)), "utf8");

/** El cuerpo de `export function <nombre>`, hasta su `}` de columna 0. */
function cuerpoDe(codigo: string, nombre: string): string {
  const ini = codigo.indexOf(`export function ${nombre}(`);
  if (ini < 0) throw new Error(`no encuentro ${nombre}`);
  const fin = codigo.indexOf("\n}\n", ini);
  return codigo.slice(ini, fin < 0 ? undefined : fin);
}

/** Los hooks llamados después del primer `return` del cuerpo. */
export function hooksTrasElPrimerReturn(cuerpo: string): string[] {
  const sinComentarios = cuerpo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const m = /^\s*return\b/m.exec(sinComentarios);
  if (!m) return [];
  const despues = sinComentarios.slice(m.index);
  return [...despues.matchAll(/\b(use[A-Z]\w*)\s*[<(]/g)].map((x) => x[1]);
}

describe("PlanSection respeta el orden de los hooks", () => {
  it("ningún hook después de la guarda de «sin plan»", () => {
    expect(hooksTrasElPrimerReturn(cuerpoDe(fuente, "PlanSection"))).toEqual([]);
  });

  it("la guarda existe y la sonda la ve (si no, el test de arriba pasaría por ceguera)", () => {
    const cuerpo = cuerpoDe(fuente, "PlanSection");
    expect(cuerpo).toMatch(/if \(!plan\) \{[\s\S]*?return \(/);
    // El patrón que ya mordió, reconstruido: la sonda tiene que detectarlo.
    const roto = "export function X() {\n  const a = useState(0);\n  if (!a) {\n    return null;\n  }\n  const b = useMemo(() => 1, []);\n  const c = useState<Set<string>>(() => new Set());\n}\n";
    expect(hooksTrasElPrimerReturn(cuerpoDe(roto, "X"))).toEqual(["useMemo", "useState"]);
  });
});
