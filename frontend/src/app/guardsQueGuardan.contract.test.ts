import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/**
 * **Un guard que deja de encontrar su objeto se queda en verde para siempre.**
 *
 * La forma es siempre la misma: el guard enumera un directorio, filtra por algo
 * —una extensión, un nombre, un patrón— y afirma que la lista de culpables está
 * vacía. Si el filtro deja de casar —un renombre, una carpeta que se mueve, un
 * símbolo que cambia de nombre— la lista sale vacía **porque no se miró nada**,
 * y el guard pasa. Ya ocurrió en este repo con un guard anclado a un símbolo por
 * su nombre: siguió verde después de que el símbolo dejara de existir.
 *
 * Es la avería más cara de todas las que persigue el loop de robustez, porque
 * apaga la infraestructura que sostiene a las demás y no deja rastro: no hay
 * rojo, no hay aviso, sólo deja de proteger.
 *
 * **La vacuna es una línea**: afirmar que el barrido encontró algo antes de
 * afirmar que no encontró nada malo. `expect(fuentes.length).toBeGreaterThan(N)`.
 *
 * Este meta-guard cuenta los que aún no la tienen y no deja que crezcan. El
 * tope baja conforme se van poniendo; NO se sube.
 */

const SRC = path.resolve(__dirname, "..");

/**
 * Medido el 2026-09-12: eran **26**. Con los seis puestos en el perfil de
 * cursos-horario —`cifrasConFormato` incluido, que valida TODAS las cifras
 * visibles— quedan **7** con enumeración real del árbol. Baja conforme se pongan; NO se sube.
 */
const TOPE_SIN_CENTINELA = 7;

function tests(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return tests(completo);
    return e.name.endsWith(".test.ts") ? [completo] : [];
  });
}

/**
 * **Enumeración REAL del sistema de archivos.** La primera versión contaba
 * también `.filter(` y `.flatMap(`, y eso marcaba guards que sólo iteran una
 * lista LITERAL de archivos —`auditReadyRoutes`, por ejemplo, recorre dos
 * shells escritos a mano—. Ésos no pueden quedarse mudos: si el archivo no
 * está, `readFileSync` revienta, que es fallar cerrado.
 *
 * El riesgo sólo existe cuando el guard pregunta al sistema de archivos QUÉ hay
 * y filtra el resultado: ahí, cero coincidencias pasa por «todo bien». Afinarlo
 * bajó la cifra de 18 a 11 — siete eran falsos positivos de este mismo barrido,
 * que es justo la trampa que el GOAL tiene anotada.
 */
const ENUMERA = /(readdirSync|globSync)/;
/** Afirma que no hay culpables. */
const AFIRMA_VACIO = /(toEqual\(\[\]\)|toHaveLength\(0\))/;
/**
 * **El centinela, en sus DOS formas.**
 *
 * La directa es contar lo que encontró el barrido (`toBeGreaterThan`). La otra
 * —mejor, cuando se puede— es declarar la lista de archivos a vigilar y
 * comprobar que TODOS siguen existiendo: `capacidadDeclarada` lo hace así y su
 * comentario ya decía por qué («si uno se renombra, el guard dejaría de
 * vigilarlo en silencio»). Este meta-guard la acusaba por no usar la forma
 * directa: cuarto falso positivo suyo, y la lección es la misma de siempre —lo
 * que se mide es el efecto, no la sintaxis—.
 */
const CENTINELA = /(toBeGreaterThan|length\)\.toBe\([1-9])/;
/** La segunda forma: «los archivos que declaro vigilar siguen ahí». */
const CENTINELA_POR_LISTA = /!?\w+\.has\(/;

describe("guards que podrían dejar de guardar", () => {
  test("no crecen los guards que afirman «vacío» sin comprobar que buscaron", () => {
    const sinCentinela: string[] = [];
    for (const archivo of tests(SRC)) {
      const fuente = readFileSync(archivo, "utf8");
      if (!/readFileSync/.test(fuente)) continue;
      if (!ENUMERA.test(fuente) || !AFIRMA_VACIO.test(fuente)) continue;
      if (CENTINELA.test(fuente) || CENTINELA_POR_LISTA.test(fuente)) continue;
      sinCentinela.push(path.relative(SRC, archivo));
    }
    expect(
      sinCentinela.length,
      `Estos guards enumeran el árbol y afirman que no hay culpables, pero no comprueban ` +
        `haber encontrado nada que mirar: si su filtro deja de casar, pasan en verde sin ` +
        `guardar. La vacuna es una línea —expect(fuentes.length).toBeGreaterThan(N)—. ` +
        `Si vienes de poner una, BAJA el tope:\n${sinCentinela.join("\n")}`,
    ).toBeLessThanOrEqual(TOPE_SIN_CENTINELA);
  });

  test("el meta-guard encuentra guards de verdad, o él mismo está mudo", () => {
    // El chiste se cuenta solo: un meta-guard de la no-mudez que se queda mudo.
    expect(tests(SRC).length).toBeGreaterThan(200);
  });
});
