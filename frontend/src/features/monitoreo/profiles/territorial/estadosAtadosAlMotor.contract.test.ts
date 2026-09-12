import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * **Un estado que el frontend compara y el motor no publica nunca casa.**
 *
 * Es la clase más cara del repo, medida: en cursos-horario, el plan guardaba
 * «SIN CONTACTAR» y el motor comparaba `sin_contactar`, y eso rechazó 1.213 de
 * 1.218 reservas sin un solo rojo —todas las fixtures se escribían ya
 * normalizadas, así que ninguna lo veía—. Un `===` contra un estado inventado
 * no falla: devuelve `false` para siempre, y el panel publica su vacío bien
 * redactado.
 *
 * Territorial estaba a CERO contratos cuando se escribió esto. El barrido que
 * lo originó salió limpio: los 57 estados que compara están atados. Este guard
 * existe para que siga siéndolo, y para obligar a que el vocabulario que el
 * frontend se inventa **se declare como tal** en vez de quedar indistinguible
 * de uno que debería venir del motor.
 */

const territorialDir = path.dirname(fileURLToPath(import.meta.url));
const rDir = path.resolve(territorialDir, "../../../../../../api/R");

/**
 * Vocabulario que este perfil DERIVA por su cuenta y que por diseño no existe
 * en el motor. Cada entrada dice de dónde sale; una que no se pueda explicar
 * así no pertenece a esta lista, pertenece al motor.
 */
const VOCABULARIO_PROPIO: Record<string, string> = {
  // `geoDisposition()` los calcula desde `geo_estado` y las coordenadas.
  en_zona: "derivado en geoDisposition() desde el cruce espacial",
  en_distrito: "derivado en geoDisposition() desde el cruce espacial",
  fuera_distrito: "derivado en geoDisposition() desde ubigeo de ruta vs espacial",
  // Union type de SECCIONES de la vista, traducido desde geoDisposition.
  outside_frame: "TerritorialGeoDistrictSectionKind: tipo de sección, no estado del caso",
  without_cross: "TerritorialGeoDistrictSectionKind: tipo de sección, no estado del caso",
  without_gps: "TerritorialGeoDistrictSectionKind: tipo de sección, no estado del caso",
  // Derivados de booleanos que sí publica el motor.
  con_registro: "derivado de row.has_report",
  sin_conciliacion: "derivado de row.is_unreconciled",
  // Procedencia de la cifra dentro del propio componente.
  operational_quota: "etiqueta de procedencia del stack de avance",
};

/** Literales snake_case comparados: la forma de un estado, no de una clase CSS. */
const COMPARADO = /(?:===|!==|\.includes\(|\bcase\s+)\s*"([a-z][a-z0-9]*(?:_[a-z0-9]+)+)"/g;

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const fuenteDelMotor = () =>
  readdirSync(rDir)
    .filter((f) => f.endsWith(".R"))
    .map((f) => readFileSync(path.join(rDir, f), "utf8"))
    .join("\n");

function estadosComparados() {
  const usos = new Map<string, Set<string>>();
  for (const archivo of archivos(territorialDir)) {
    const fuente = readFileSync(archivo, "utf8");
    for (const [, estado] of fuente.matchAll(COMPARADO)) {
      if (!usos.has(estado)) usos.set(estado, new Set());
      usos.get(estado)!.add(path.relative(territorialDir, archivo));
    }
  }
  return usos;
}

describe("los estados que territorial compara existen donde dice", () => {
  const motor = fuenteDelMotor();
  const usos = estadosComparados();

  test("el barrido encuentra algo: si deja de ver estados, delata su propia avería", () => {
    // Sin esto, un regex roto daría «cero huérfanos» y pasaría por verde.
    expect(usos.size).toBeGreaterThan(40);
  });

  test("el motor se lee de verdad y no viene vacío", () => {
    // `sin_cruce` y `sin_gps` SÍ los publica R; si no aparecen, el que falla es
    // el lector, no el producto.
    expect(motor.length).toBeGreaterThan(100_000);
    expect(motor).toMatch(/\bsin_cruce\b/);
  });

  test("ninguno se compara contra algo que el motor no publica", () => {
    // En R los nombres de campo van SIN comillas (`outside_route = ...`), así
    // que se busca la palabra, no el literal entrecomillado: buscar `"x"` daba
    // huérfanos falsos —dos de este mismo barrido salieron así—.
    const sueltos = [...usos.keys()]
      .filter((estado) => !(estado in VOCABULARIO_PROPIO))
      .filter((estado) => !new RegExp(`\\b${estado}\\b`).test(motor))
      .map((estado) => `${estado} → ${[...usos.get(estado)!].join(", ")}`)
      .sort();

    expect(
      sueltos,
      "Este estado no existe en api/R: la comparación devuelve false para siempre y el " +
        "panel se queda vacío sin un solo error. Usa el nombre que publica el motor, o " +
        "—si el frontend lo deriva— decláralo en VOCABULARIO_PROPIO explicando de dónde sale.",
    ).toEqual([]);
  });

  test("el vocabulario propio no se infla: lo que el motor ya publica sale de la lista", () => {
    const sobran = Object.keys(VOCABULARIO_PROPIO)
      .filter((estado) => new RegExp(`\\b${estado}\\b`).test(motor))
      .sort();
    expect(
      sobran,
      "El motor ya publica estos estados: quítalos de VOCABULARIO_PROPIO y átalos al motor.",
    ).toEqual([]);
  });

  test("cada entrada del vocabulario propio explica de dónde sale", () => {
    const mudas = Object.entries(VOCABULARIO_PROPIO)
      .filter(([, razon]) => razon.trim().length < 20)
      .map(([estado]) => estado);
    expect(mudas, "Una razón vacía convierte la lista en un permiso general.").toEqual([]);
  });
});
