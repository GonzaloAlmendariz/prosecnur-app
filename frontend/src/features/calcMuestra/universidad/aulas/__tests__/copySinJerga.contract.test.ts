/**
 * Método y Simulación se entienden sin saber muestreo.
 *
 * Es la vara que Gonzalo fijó el 2026-08-22 para este loop: «se entiende sin
 * saber muestreo — ninguna sigla ni término técnico sin glosa». Medido al abrir:
 * CV de pesos, estabilidad, sistemático, balance, pivotal, cube, engine, post
 * hoc. Medido al cerrar el barrido: cero.
 *
 * El test mira el COPY, no los comentarios: documentar un defecto exige nombrar
 * el término que lo causaba, y prohibirlo también ahí obligaría a escribir la
 * historia en clave. Esa distinción no es teórica: un test de esta sesión se
 * commiteó en rojo por encontrar su propia cadena dentro del comentario que la
 * explicaba.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ARCHIVOS = [
  "../AulasMetodoTab.tsx",
  "../AulasSimulacionTab.tsx",
  "../DescuentoRepetidosControl.tsx",
  "../ClassroomMethodStories.tsx",
  "../ClassroomMethodComparator.tsx",
  "../ClassroomLabCommandBar.tsx",
  // El copy accesible es copy: los cuatro esquemas describían la ANIMACIÓN
  // («vibran», «tirantes», «cluster») con los nombres de método viejos, y no
  // aparece en ningún screenshot. El contrato no lo miraba.
  "../../../didactica/MetodoGooEsquema.tsx",
  // Los avisos de etapa: no se ven con un proyecto completo, así que el barrido
  // de pantalla no los alcanza. Traían «probabilidades Monte Carlo» en DOS
  // ramas casi idénticas; reparar sólo la que se encuentra primero deja viva la
  // otra, que es como se han escapado la mitad de los defectos de esta jornada.
  "../aulasSurfaceState.tsx",
];

/** Fuera comentarios de bloque, de línea y JSX. */
function soloCopy(fuente: string) {
  return fuente
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

// Términos que exigen saber muestreo de antemano. No incluye los que la UI
// glosa en el sitio (peso, n efectivo, balance): esos se explican donde salen.
const JERGA = [
  /\bcube\b/i, /\bpivotal\b/i, /\bengine\b/i, /post[ -]hoc/i, /\bPPS\b/,
  /\bMonte Carlo\b/i, /afijaci[oó]n/i, /winsoriz/i, /\bdeff\b/i, /\bMOS\b/,
];

describe("el copy de Método y Simulación no da por sabido el muestreo", () => {
  for (const rel of ARCHIVOS) {
    it(`${rel.replace("../", "")} está limpio`, () => {
      const copy = soloCopy(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));
      for (const patron of JERGA) {
        expect(copy, `reintroduce ${patron} fuera de un comentario`).not.toMatch(patron);
      }
    });
  }

  it("el barrido mira archivos que existen y tienen copy", () => {
    // Sin esto, un archivo renombrado dejaría el contrato en verde sin mirar nada.
    for (const rel of ARCHIVOS) {
      const fuente = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
      expect(fuente.length, `${rel} vacío`).toBeGreaterThan(400);
    }
  });
});
