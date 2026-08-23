// El mismo guardián que Recopiladores, sobre el perfil de aulas de Monitoreo.
//
// Aquí el censo salió **limpio** —el único hallazgo era código partido por el
// JSX, que el extractor ahora filtra—, y por eso el test existe: para que siga
// estándolo. Un módulo limpio hoy es exactamente el que nadie vigila mañana.
//
// La lista de términos y el extractor viven en `lib/qa/textoVisible`, compartidos
// con Recopiladores: dos copias de la misma regla acabarían divergiendo, y la
// que se quedara atrás daría verde sin mirar lo mismo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { jergaVisibleEn, textoVisibleDe } from "../../../../lib/qa/textoVisible";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (archivo: string) => fs.readFileSync(path.join(aqui, archivo), "utf8");

/** Las pantallas del perfil que pintan texto propio. */
const PANTALLAS = [
  "AulasMonitoreoPage.tsx",
  "AulasFuentesDelEstudio.tsx",
  "AulasOperationsPanel.tsx",
  "AulasAgendaPorDia.tsx",
  "AulasFrenteDelOperativo.tsx",
  "AulasCambioDeAula.tsx",
  "AulasParteContraPlataforma.tsx",
  "AulasOrigenDesfasado.tsx",
];

describe("ninguna pantalla del perfil de aulas habla en jerga", () => {
  it.each(PANTALLAS)("%s", (archivo) => {
    const hallazgos = jergaVisibleEn(leer(archivo));
    expect(hallazgos, hallazgos.join("\n")).toEqual([]);
  });

  it("el extractor encuentra texto de verdad", () => {
    // Sin esto, un extractor roto aprobaría las ocho por no mirar nada.
    expect(textoVisibleDe(leer("AulasMonitoreoPage.tsx")).length).toBeGreaterThan(10);
    expect(textoVisibleDe(leer("AulasFuentesDelEstudio.tsx")).length).toBeGreaterThan(5);
  });
});
