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

import { jergaVisibleEn, textoVisibleDe } from "../../lib/qa/textoVisible";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (archivo: string) => fs.readFileSync(path.join(aqui, archivo), "utf8");

/**
 * Las pantallas **y los modelos que producen su texto**.
 *
 * El guardián sólo miraba los `.tsx` y se le escapó «Falta preparar un
 * deployment», que vive en `handoffModel.ts`: el texto de usuario no siempre
 * está en el componente que lo pinta. Un guardián que sólo mira donde es cómodo
 * mirar da verde por no haber ido al sitio.
 */
const SECCIONES = [
  "RecopiladoresShell.tsx",
  "PlanSection.tsx",
  "AccessSection.tsx",
  "MaterialsSection.tsx",
  "DeliverySection.tsx",
  "handoffModel.ts",
  "providerRules.ts",
  "navegacion.ts",
];

describe("ninguna pantalla de Recopiladores habla en jerga", () => {
  it.each(SECCIONES)("%s", (archivo) => {
    const hallazgos = jergaVisibleEn(leer(archivo));
    expect(hallazgos, hallazgos.join("\n")).toEqual([]);
  });

  it("el extractor encuentra texto de verdad", () => {
    // Sin esto, un extractor roto daría verde en las cinco por no mirar nada.
    expect(textoVisibleDe(leer("PlanSection.tsx")).length).toBeGreaterThan(5);
    expect(textoVisibleDe(leer("AccessSection.tsx")).length).toBeGreaterThan(5);
  });
});
