// **Guardián del vocabulario de Recopiladores.**
//
// La jerga apareció en tres tandas: primero los cuatro subtítulos de sección,
// luego el interior de Accesos —«ejecuta el preflight»—, y luego Materiales y
// Entrega —«QR autoritativo del backend», «Deployment → Monitoreo», «recibo de
// artefacto renderizado»—. Traducir de tanda en tanda es esperar a que aparezca
// la siguiente; esto las cubre todas.
//
// Dos precisiones que hacen que el test sirva:
//
// - **Los comentarios quedan fuera.** Ahí SÍ deben usarse los nombres reales del
//   motor: son lo que permite seguir el rastro hasta el código que manda.
// - **Se buscan términos dentro del texto visible, no en el archivo.** Una
//   palabra suelta no distingue copy de código —`preflight` es también un estado
//   de React—, así que se extrae primero lo que se pinta.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** Términos de arquitectura: significan algo dentro del código y nada fuera. */
const JERGA = [
  "preflight", "deployment", "idempotente", "payload", "binding",
  "adapter", "backend", "artefacto renderizado", "fingerprint",
  "plantilla semántica", "recipient link", "autoritativo",
];

/** Lo que la pantalla pinta: literales JSX y atributos de copy. */
function textoVisible(archivo: string): string[] {
  const src = fs.readFileSync(path.join(aqui, archivo), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const jsx = [...src.matchAll(/>\s*([^<>{}\n][^<>{}]{6,160})\s*</g)].map((m) => m[1]);
  const attrs = [...src.matchAll(/(?:title|label|eyebrow|empty|lead|placeholder|aria-label)=["']([^"']{6,160})["']/g)]
    .map((m) => m[1]);
  return [...jsx, ...attrs]
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    // Fuera lo que es código: el JSX parte expresiones en varias líneas y el
    // extractor pescaba trozos como «{adapterId ===». Un falso positivo aquí
    // gasta el crédito del guardián.
    .filter((t) => !/[{}]|===|=>|\?\?|\|\|/.test(t));
}

const SECCIONES = [
  "RecopiladoresShell.tsx",
  "PlanSection.tsx",
  "AccessSection.tsx",
  "MaterialsSection.tsx",
  "DeliverySection.tsx",
];

describe("ninguna pantalla de Recopiladores habla en jerga", () => {
  it.each(SECCIONES)("%s", (archivo) => {
    const hallazgos = textoVisible(archivo).flatMap((linea) =>
      JERGA.filter((t) => linea.toLowerCase().includes(t)).map((t) => `«${t}» en: ${linea.slice(0, 80)}`));
    expect(hallazgos, hallazgos.join("\n")).toEqual([]);
  });

  it("el extractor encuentra texto de verdad", () => {
    // Sin esto, un extractor roto daría verde en las cinco por no mirar nada.
    expect(textoVisible("PlanSection.tsx").length).toBeGreaterThan(5);
    expect(textoVisible("AccessSection.tsx").length).toBeGreaterThan(5);
  });
});
