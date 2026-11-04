import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Ratchet de cajas propias en Monitoreo (P2 de la pasada de formato, 4 nov 2026).**
 *
 * Un bloque con marco es el `Panel` del kit, vía `core/BloqueDeMonitoreo.tsx`. La medición del 2 nov
 * contó 375 `h2–h4` sueltos frente a 7 `Panel`: cada vista armaba su caja con un `h3` propio y la
 * cabecera `mon-profile-panel-head`. Esta guarda cuenta, por perfil, los títulos sueltos y las
 * cabeceras propias, y falla si alguno CRECE. Cuando una tanda los baja, se baja la línea base aquí
 * en el mismo commit; la meta es cero cabeceras propias.
 *
 * Los `h4` que rotulan un sub-bloque dentro de un bloque con título cuentan igual: también son una
 * jerarquía armada a mano, y la meta es que el sub-bloque sea un `Panel` anidado o una sección del kit.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function contar(perfil: string) {
  let titulos = 0;
  let cabeceras = 0;
  for (const archivo of archivos(path.join(aqui, "profiles", perfil))) {
    const fuente = sinComentarios(readFileSync(archivo, "utf8"));
    titulos += (fuente.match(/<h[234][\s>]/g) ?? []).length;
    cabeceras += (fuente.match(/mon-profile-panel-head/g) ?? []).length;
  }
  return { titulos, cabeceras };
}

/** Línea base: sólo baja. */
const LINEA_BASE: Record<string, { titulos: number; cabeceras: number }> = {
  acreditacion: { titulos: 106, cabeceras: 26 },
  aulas: { titulos: 80, cabeceras: 12 },
  territorial: { titulos: 94, cabeceras: 0 },
  telefonico: { titulos: 44, cabeceras: 26 },
};

describe("cajas propias en Monitoreo (P2): los títulos sueltos sólo bajan", () => {
  for (const [perfil, base] of Object.entries(LINEA_BASE)) {
    it(`${perfil}: no crecen los h2–h4 sueltos ni las cabeceras propias`, () => {
      const hoy = contar(perfil);
      expect(hoy.titulos, `${perfil}: ${hoy.titulos} h2–h4 sueltos (línea base ${base.titulos})`).toBeLessThanOrEqual(base.titulos);
      expect(hoy.cabeceras, `${perfil}: ${hoy.cabeceras} cabeceras mon-profile-panel-head (línea base ${base.cabeceras})`).toBeLessThanOrEqual(base.cabeceras);
    });
  }
});
