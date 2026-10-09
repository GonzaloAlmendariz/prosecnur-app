import { describe, expect, it } from "vitest";
import { embudoDelOperativo } from "./embudoDelOperativo";

/**
 * El embudo cuenta DOS cosas distintas: sus dos primeros peldaños son
 * cursos-horario y los dos últimos son respuestas.
 *
 * Con los datos reales del estudio eso hace que el flujo vaya
 * **174 → 152 → 2.817 → 2.668**: se multiplica por 18 en el tercer peldaño.
 * Quien lo lee de arriba abajo ve un embudo que crece. No es un error de
 * cálculo; es que ahí cambia la unidad, y hasta ahora nadie lo enunciaba.
 */
const cifras = {
  aulas_titulares: 174, aulas_aplicadas: 152,
  respuestas_total: 2817, respuestas_validas: 2668,
  filter_rejected: 149,
} as never;

describe("el embudo dice dónde deja de contar cursos-horario", () => {
  it("el peldaño donde sube la cifra explica que cambia la unidad", () => {
    const etapas = embudoDelOperativo(cifras);
    const recibidas = etapas.find((e) => e.id === "recibidas");
    expect(recibidas, "el peldaño de respuestas tiene que existir").toBeTruthy();
    expect(recibidas?.detalle ?? "").toMatch(/ya no cursos-horario/);
  });

  it("y ese peldaño es de verdad mayor que el anterior: sin eso no hay nada que explicar", () => {
    const etapas = embudoDelOperativo(cifras);
    const aplicadas = etapas.find((e) => e.id === "aplicadas");
    const recibidas = etapas.find((e) => e.id === "recibidas");
    // `valor` es un string ya formateado —«2,817»—, así que se compara por su
    // cifra, no por Number() directo, que daría NaN y una comparación vacía.
    const cifra = (v: string | undefined) => Number((v ?? "").replace(/\D/g, ""));
    expect(cifra(recibidas?.valor)).toBeGreaterThan(cifra(aplicadas?.valor));
    expect(cifra(recibidas?.valor)).toBe(2817);
  });

  it("entre unidades distintas no se resta merma", () => {
    const etapas = embudoDelOperativo(cifras);
    // La merma de una etapa es lo que se pierde camino a la SIGUIENTE. La de
    // `aplicadas` iría hacia `recibidas`, que ya son respuestas: restar ahí
    // daría un número sin significado.
    expect(etapas.find((e) => e.id === "aplicadas")?.merma).toBeUndefined();
  });
});
