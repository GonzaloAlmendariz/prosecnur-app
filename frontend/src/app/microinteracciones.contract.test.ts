import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **Microinteracciones: dos presiones con nombre** (5 nov 2026; pedido de Gonzalo: «¿y qué hay de las
 * animaciones al pasar por un botón, apretarlo y todo eso?»).
 *
 * Ese día había 296 reglas `:active` con 11 escalas distintas (0.94 a 0.995). El estándar vive en
 * `app/movimiento.css`: `--mov-press` (0.97, controles) y `--mov-press-tarjeta` (0.985, superficies), más una
 * regla base que hace ceder a todo botón que no declare su presión. Este ratchet cuenta, por hoja, las escalas
 * LITERALES que quedan en reglas `:active` (las compuestas, como `translateY(0) scale(.97)`, y las de las zonas
 * de otras sesiones) y sólo deja que bajen. Una presión nueva se escribe con el token.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Foto del 5 nov 2026, tras migrar 162 escalas en 41 hojas. Sólo baja. */
const SNAPSHOT: Record<string, number> = {
  "app/boot.css": 6,
  "app/theme.css": 2,
  "components/recent-project-card.css": 1,
  "features/calcMuestra/didactica/didactica.css": 1,
  "features/dashboard/customize/customize.css": 2,
  "features/dashboard/tabs/BaseDatosTab/baseDatos.css": 1,
  "features/dashboard/tabs/DimensionesTab/dimensiones.css": 3,
  "features/dashboard/theme/tokens.css": 4,
  "features/graficos/v2/styles/editor-v2.css": 6,
  "features/monitoreo/MonitoreoShell.css": 1,
  "features/monitoreo/monitoreo.css": 10,
  "features/monitoreo/profiles/profilePage.css": 9,
  "features/monitoreo/profiles/telefonico/telefonicoProfile.css": 3,
  "features/monitoreo/profiles/territorial/territorialProfile.css": 3,
  "features/monitoreo/salidas/outputsWorkbench.css": 1,
  "features/monitoreo/shell/monitoreoShell.css": 1,
  "features/validacion/validacion-v2.css": 3,
};

/**
 * Hover que levanta o agranda FUERA de `@media (hover: hover)`: en pantalla táctil el «hover» queda pegado
 * tras tocar. Foto del 6 nov 2026, tras mover 49 a su guarda; sólo queda Monitoreo (zona de otra sesión).
 */
const SNAPSHOT_HOVER_SIN_GUARDA: Record<string, number> = {
  "features/monitoreo/MonitoreoShell.css": 1,
  "features/monitoreo/monitoreo.css": 8,
  "features/monitoreo/profiles/acreditacion/AvanceCorreo.css": 1,
  "features/monitoreo/profiles/acreditacion/avance/avance.css": 1,
  "features/monitoreo/profiles/profilePage.css": 3,
  "features/monitoreo/profiles/territorial/territorialProfile.css": 2,
  "features/monitoreo/salidas/outputsWorkbench.css": 1,
  "features/monitoreo/shell/monitoreoShell.css": 1,
};

const GESTO_DE_HOVER = /^(translateY\(-\d+(\.\d+)?px\)|scale\(1\.\d+\)|translateY\(-\d+px\)\s+scale\(1\.\d+\))$/;

/** Reglas hoja (sin bloques dentro) con su selector y si viven dentro de un `@media (hover: hover)`. */
function reglasConGuarda(css: string): { sel: string; cuerpo: string; guardada: boolean }[] {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const pila: { cabeza: string; inicio: number; conHijos: boolean }[] = [];
  const reglas: { sel: string; cuerpo: string; guardada: boolean }[] = [];
  let ultimo = 0;
  for (const m of limpio.matchAll(/[{}]/g)) {
    const i = m.index ?? 0;
    if (m[0] === "{") {
      const tramo = limpio.slice(ultimo, i);
      const corte = Math.max(tramo.lastIndexOf(";"), tramo.lastIndexOf("}"));
      pila.push({ cabeza: tramo.slice(corte + 1).trim(), inicio: i + 1, conHijos: false });
    } else {
      const bloque = pila.pop();
      if (bloque && !bloque.conHijos) {
        const guardada = pila.some((p) => /hover:\s*hover/.test(p.cabeza));
        reglas.push({ sel: bloque.cabeza, cuerpo: limpio.slice(bloque.inicio, i), guardada });
      }
      if (pila.length) pila[pila.length - 1].conHijos = true;
    }
    ultimo = i + 1;
  }
  return reglas;
}

function hoverSinGuarda(css: string): number {
  return reglasConGuarda(css).filter(({ sel, cuerpo, guardada }) => {
    if (guardada || !sel.includes(":hover")) return false;
    const t = /(?<![-\w])transform:\s*([^;]+);/.exec(cuerpo);
    return Boolean(t && GESTO_DE_HOVER.test(t[1].trim()));
  }).length;
}

function hojas(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return hojas(completo);
    return e.name.endsWith(".css") ? [completo] : [];
  });
}

function escalasLiteralesEnActive(css: string): number {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let n = 0;
  for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!m[1].includes(":active")) continue;
    n += [...m[2].matchAll(/scale\([0-9.]+\)/g)].length;
  }
  return n;
}

describe("microinteracciones · presión con nombre", () => {
  const conteo = Object.fromEntries(
    hojas(SRC)
      .map((f) => [path.relative(SRC, f).split(path.sep).join("/"), escalasLiteralesEnActive(fs.readFileSync(f, "utf8"))] as const)
      .filter(([, n]) => n > 0),
  );

  test("el censo encuentra lo que vigila (si el filtro deja de casar, no pasa en verde sin mirar)", () => {
    expect(hojas(SRC).length).toBeGreaterThan(300);
    expect(Object.keys(conteo).length).toBeGreaterThan(5);
  });

  test("ninguna hoja suma escalas de presión literales ni aparece una nueva", () => {
    const regresiones = Object.entries(conteo)
      .filter(([archivo, n]) => n > (SNAPSHOT[archivo] ?? 0))
      .map(([archivo, n]) => `${archivo}: ${SNAPSHOT[archivo] ?? 0} → ${n}`);
    expect(regresiones, "Usa scale(var(--mov-press, 0.97)) o scale(var(--mov-press-tarjeta, 0.985)).").toEqual([]);
  });

  test("el snapshot no guarda conteos que ya bajaron", () => {
    const viejos = Object.entries(SNAPSHOT)
      .filter(([archivo, n]) => (conteo[archivo] ?? 0) < n)
      .map(([archivo, n]) => `${archivo}: ${n} → ${conteo[archivo] ?? 0}`);
    expect(viejos).toEqual([]);
  });

  test("ningún hover que levanta o agranda queda fuera de (hover: hover) — en táctil queda pegado", () => {
    const actual = Object.fromEntries(
      hojas(SRC)
        .map((f) => [path.relative(SRC, f).split(path.sep).join("/"), hoverSinGuarda(fs.readFileSync(f, "utf8"))] as const)
        .filter(([, n]) => n > 0),
    );
    const regresiones = Object.entries(actual)
      .filter(([archivo, n]) => n > (SNAPSHOT_HOVER_SIN_GUARDA[archivo] ?? 0))
      .map(([archivo, n]) => `${archivo}: ${SNAPSHOT_HOVER_SIN_GUARDA[archivo] ?? 0} → ${n}`);
    expect(regresiones, "Pon el transform del hover dentro de @media (hover: hover) and (pointer: fine), con var(--mov-hover-lift).").toEqual([]);
    const viejos = Object.entries(SNAPSHOT_HOVER_SIN_GUARDA)
      .filter(([archivo, n]) => (actual[archivo] ?? 0) < n)
      .map(([archivo, n]) => `${archivo}: ${n} → ${actual[archivo] ?? 0}`);
    expect(viejos).toEqual([]);
    // Vacuna (guardsQueGuardan): el detector sí encuentra reglas guardadas que mirar.
    const guardadas = hojas(SRC).reduce((n, f) => n + reglasConGuarda(fs.readFileSync(f, "utf8")).filter((r) => r.guardada).length, 0);
    expect(guardadas).toBeGreaterThan(100);
  });

  test("ningún foco se dibuja con --pulso-primary-focus (navy al 15 %: invisible) — se usa --mov-foco", () => {
    // Foto del 6 nov 2026: 70 focos usaban ese token; tras migrar 153 anillos genéricos sólo queda uno en
    // Monitoreo (zona de otra sesión). Sólo baja.
    const PERMITIDOS: Record<string, number> = { "features/monitoreo/estados/paletaDeFamilias.css": 1 };
    let focosVistos = 0;
    const regresiones: string[] = [];
    for (const f of hojas(SRC)) {
      const rel = path.relative(SRC, f).split(path.sep).join("/");
      const limpio = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      let n = 0;
      for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!m[1].includes(":focus")) continue;
        focosVistos += 1;
        if (/(?<![-\w])outline:[^;]*--pulso-primary-focus/.test(m[2])) n += 1;
      }
      if (n > (PERMITIDOS[rel] ?? 0)) regresiones.push(`${rel}: ${PERMITIDOS[rel] ?? 0} → ${n}`);
    }
    expect(focosVistos, "vacuna: el censo encuentra reglas de foco").toBeGreaterThan(500);
    expect(regresiones, "outline: var(--mov-foco, 2px solid var(--pulso-primary))").toEqual([]);
  });

  test("los tokens y la regla base existen", () => {
    const mov = fs.readFileSync(path.join(SRC, "app/movimiento.css"), "utf8");
    expect(mov).toMatch(/--mov-press:\s*0\.97/);
    expect(mov).toMatch(/--mov-foco:\s*2px solid var\(--module-accent, var\(--pulso-primary\)\)/);
    expect(mov).toMatch(/--mov-press-tarjeta:\s*0\.985/);
    expect(mov).toMatch(/:where\(button[^)]*\)[\s\S]*?:active\s*\{\s*transform: scale\(var\(--mov-press\)\)/);
  });
});
