import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// «Avance > Resumen» decía «1 283 de 1 200 · meta superada, +83» y «Avance >
// Ritmo», sobre el mismo corte, «975 de 1 200 · brecha meta 225». Y 147 UMP
// completas contra 0. Dos pestañas de la misma sección contestando lo contrario
// sobre si el campo puede cerrarse.
//
// La causa: `buildDailyRows` filtra `row.date`, así que la serie diaria sólo
// acumula lo fechado. Su acumulado NO es el del corte y nunca podrá serlo — una
// serie diaria sólo puede hablar de días.
//
// Por eso no se toca el cálculo: se dice cuántas quedan fuera, que es lo que
// reconcilia las dos pantallas (975 + 308 = 1 283).
//
// Y el «0 UMP completas» era un cero fabricado: la serie no trae
// `new_complete_ump`, así que el acumulado se quedaba en 0 mientras el corte
// declaraba 147. Un 0 que sale de un campo ausente no es «ninguna»: es «no lo sé».

const fuente = fs.readFileSync(
  path.resolve(__dirname, "TerritorialAdvanceWorkbench.tsx"),
  "utf8",
);
const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("el ritmo declara lo que su serie no alcanza", () => {
  it("la serie sigue filtrando por fecha", () => {
    // Es la premisa: si dejara de filtrar, sobra todo lo demás.
    expect(codigo).toContain("filter((row) => row.date)");
  });

  it("recibe las válidas del corte para poder compararse", () => {
    expect(codigo).toContain("validasDelCorte={advance.validas}");
    expect(codigo).toContain("umpCompletasDelCorte={umpStack.complete}");
  });

  it("dice cuántas quedan fuera, sin afirmar por qué", () => {
    expect(codigo).toContain("const validasFueraDeLaSerie = Math.max(0, validasDelCorte - acumulado)");
    expect(codigo).toContain("válidas del corte quedan fuera de esta serie");
    // «sin fecha» es la causa probable, no lo probado: va en el subtítulo.
    expect(codigo).not.toContain("válidas sin fecha quedan fuera");
  });

  it("el subtítulo ya no promete todo el corte", () => {
    expect(codigo).toContain("sólo las respuestas con fecha");
    expect(codigo).not.toContain("acumulado contra meta · todo el corte");
  });

  it("un cero por campo ausente se muestra como S/D", () => {
    expect(codigo).toContain("const serieSinUmp = umpDeLaSerie === 0 && umpCompletasDelCorte > 0");
    expect(codigo).toContain('value={serieSinUmp ? "S/D" : formatMetric(umpDeLaSerie)}');
    expect(codigo).toContain("la serie diaria no las trae · el corte declara");
  });
});
