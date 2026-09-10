import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * **Ningún hook después de la guarda que hace `return null`.**
 *
 * Las seis pestañas del perfil comparten el mismo molde: un
 * `if (pestana !== "<la suya>") return null;` cerca del principio y el render
 * debajo. Un `useMemo` colocado DESPUÉS de esa línea se llama en unos renders y
 * en otros no, y eso es React #310 —«rendered more hooks than during the
 * previous render»—: no falla en la pestaña donde se escribió, falla al CAMBIAR
 * de pestaña, tumba la app entera y el error boundary tapa además las pestañas
 * siguientes, así que parece que se rompieron tres.
 *
 * Pasó el 2026-09-09 en `AulasPestanaRendimiento.tsx` y **la suite entera siguió
 * en verde**: 3 535 tests entonces, incluido uno recién escrito para ese mismo
 * panel. No lo vio porque un test de render pinta siempre con su pestaña
 * activa, y el conteo de hooks sólo cambia cuando el mismo componente se vuelve
 * a pintar con OTRA. Lo encontró el barrido en pantalla.
 *
 * Se mira el fuente y no el render porque el defecto es estructural: está o no
 * está, y verlo cuesta un `readFileSync` en vez de montar seis pestañas y
 * navegar entre ellas.
 */

const aulasDir = path.resolve(__dirname);
/** `useMemo(`, `useState(`, `useCallback(`… en llamada, no en un import. */
const LLAMADA_A_HOOK = /(?<![\w.])use[A-Z]\w*\s*\(/g;

/**
 * **Sin comentarios, o el guard grita en falso y acaba borrado.**
 *
 * La primera versión de este test acusó a `AulasPestanaCuotas.tsx` de llamar
 * `useTablasDeAvance` bajo su guarda. No lo llama: la línea 125 es un COMENTARIO
 * que lo menciona —«tabla `diario` con su propio `useTablasDeAvance()`»—. Este
 * perfil ya tiene un guard que aprendió lo mismo por su cuenta
 * (`cifrasConFormato.test.ts` separa prosa de código por el determinante), y un
 * detector que cría lobos es un detector que alguien silencia.
 */
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function hooksTrasLaGuarda(fuenteCruda: string): string[] {
  const fuente = sinComentarios(fuenteCruda);
  // La guarda canónica del molde: `if (pestana !== "x") return null;`
  const guarda = fuente.search(/if\s*\(\s*pestana\s*!==[^)]*\)\s*return null;/);
  if (guarda < 0) return [];
  const despues = fuente.slice(guarda);
  return [...despues.matchAll(LLAMADA_A_HOOK)].map((m) => m[0].replace(/\s*\($/, ""));
}

/**
 * **La misma avería, en la otra forma que tiene.**
 *
 * La guarda de arriba mira un molde concreto —el `if (pestana !== …) return
 * null;` de las seis pestañas— y por eso no vio el 2026-09-10 el mismo defecto
 * en `AulasCoberturaChart.tsx`: allí la salida temprana es el VACÍO del panel
 * («el plan todavía no trae cursos-horario») y el `useState` del tramo
 * desplegado vivía doscientas líneas más abajo, pegado a la tabla que lo usa.
 * Mientras la cobertura siempre tuviera filas nadie lo notó; al filtrar por
 * facultad, una sin reparto entró por el vacío y la aplicación entera cayó con
 * React #300.
 *
 * Ésa es la forma COMÚN en este perfil: cada panel tiene su vacío declarado y su
 * `return` temprano. Así que la regla se aplica a todos los componentes del
 * perfil, no sólo a las pestañas, y con la salida temprana genérica: dentro de
 * cada función de nivel superior, después del primer `return` con sangría de dos
 * espacios no puede haber ninguna llamada a hook.
 */
/**
 * Como `sinComentarios`, pero **conservando los saltos de línea**.
 *
 * La primera versión de este segundo guard reusó `sinComentarios`, que colapsa
 * cada bloque `/* … *\/` en UN espacio. En un perfil donde cada decisión lleva su
 * párrafo encima, eso funde decenas de líneas en una y desplaza todo lo de
 * abajo: los anclajes `^` dejan de caer donde deben y el guard acusó a dos
 * archivos que no tienen el defecto —`AulasMonitoreoPage` y
 * `AulasSerieDeRendimiento`—. Un detector que cría lobos acaba silenciado, que
 * es justo lo que este archivo ya se había dicho a sí mismo una vez.
 */
function sinComentariosPorLinea(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (bloque) => bloque.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function hooksTrasUnaSalidaTemprana(fuenteCruda: string): string[] {
  const lineas = sinComentariosPorLinea(fuenteCruda).split("\n");
  // Los límites de cada función de nivel superior: `function X(`, `const X = (`,
  // `export function X(`… en la columna cero.
  // `export default function X(` incluido: sin el `default` el guard creía que
  // el componente de abajo seguía dentro de la función de arriba y acusaba a
  // `AulasMonitoreoPage` de treinta y siete hooks bajo una guarda ajena.
  const esFrontera = (l: string) =>
    /^(export\s+)?(default\s+)?(async\s+)?function\s+\w+|^(export\s+)?(default\s+)?const\s+\w+\s*[:=]/.test(l);
  const culpables: string[] = [];
  let salida = -1;
  lineas.forEach((linea, i) => {
    if (esFrontera(linea)) salida = -1;
    // `  return` a dos espacios: el cuerpo de la función, no un `return` anidado
    // dentro de un callback ni el de un `map`.
    if (salida < 0 && /^ {2}return[\s(;]/.test(linea)) { salida = i; return; }
    if (salida < 0) return;
    for (const m of linea.matchAll(LLAMADA_A_HOOK)) {
      culpables.push(`${m[0].replace(/\s*\($/, "")} (línea ${i + 1}, bajo el return de la ${salida + 1})`);
    }
  });
  return culpables;
}

describe("ningún componente del perfil llama hooks bajo una salida temprana", () => {
  const componentes = readdirSync(aulasDir).filter(
    (f) => f.startsWith("Aulas") && f.endsWith(".tsx") && !f.includes(".test."),
  );

  test("hay componentes que revisar", () => {
    expect(componentes.length).toBeGreaterThanOrEqual(20);
  });

  test("ninguno declara un hook por debajo de su primer `return`", () => {
    const culpables = componentes.flatMap((archivo) => {
      const hooks = hooksTrasUnaSalidaTemprana(readFileSync(path.join(aulasDir, archivo), "utf8"));
      return hooks.length ? [`${archivo}: ${hooks.join(" · ")}`] : [];
    });
    expect(culpables).toEqual([]);
  });
});

describe("las pestañas del perfil no llaman hooks después de su guarda", () => {
  const archivos = readdirSync(aulasDir).filter(
    (f) => f.startsWith("AulasPestana") && f.endsWith(".tsx") && !f.includes(".test."),
  );

  test("hay pestañas que revisar", () => {
    // Si el molde se renombra, este guard se apaga en silencio. Que falle.
    expect(archivos.length).toBeGreaterThanOrEqual(5);
  });

  test("ninguna llama un hook por debajo del `return null` de su guarda", () => {
    const culpables = archivos.flatMap((archivo) => {
      const hooks = hooksTrasLaGuarda(readFileSync(path.join(aulasDir, archivo), "utf8"));
      return hooks.length ? [`${archivo}: ${[...new Set(hooks)].join(", ")}`] : [];
    });
    expect(culpables).toEqual([]);
  });
});
