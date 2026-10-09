import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasComoVaCadaFacultad } from "./AulasComoVaCadaFacultad";

/**
 * **Sin tasa prevista no hay con qué comparar, y eso no es aprobar.**
 *
 * Medido el 2026-09-18 en la app, sobre CCSS Perfil 2026-II con las 64
 * respuestas del simulacro. Su τ prevista es `null` —el motor de efectividad se
 * niega a afirmarla sin cuota del diseño, y hace bien— y esta tarjeta hacía dos
 * cosas con ese hueco:
 *
 * 1. Escribía «5,2 % **de — previsto**», una frase con un agujero donde va la
 *    cifra.
 * 2. Lo pintaba de VERDE. `f.prevista ?? 0` convierte «no se sabe» en cero, y
 *    cualquier observado supera el cero. Un 5,2 % en verde por no tener contra
 *    qué compararse es verde por ausencia.
 */

const bloque = (previsto: number | null) => ({
  facultades: [{
    facultad: "CIENCIAS SOCIALES", faculty_key: "ciencias_sociales",
    aulas_aplicadas: 50, tau_observado: 0.052, tau_previsto: previsto,
  }],
} as never);

const porSexo = [
  { faculty_key: "ciencias_sociales", sexo: "F", diferencia: -343 },
  { faculty_key: "ciencias_sociales", sexo: "M", diferencia: -362 },
];

const pinta = (previsto: number | null) => renderToStaticMarkup(
  <AulasComoVaCadaFacultad
    bloque={bloque(previsto)}
    porSexo={porSexo}
    facultadEnFoco=""
    onRefuerzo={() => {}}
    partes={[] as never}
    plan={[] as never}
  />,
);

describe("Cómo va cada facultad: sin tasa prevista no se aprueba ni se deja un hueco", () => {
  it("sin previsto, ni «de — previsto» ni verde", () => {
    const html = pinta(null);
    expect(html).toContain("sin tasa prevista");
    expect(html).not.toContain("de — previsto");
    // El color dice «cumple» y aquí no hay nada que cumplir.
    expect(html).not.toContain("es-ok");
  });

  it("con previsto, el color y la frase siguen diciendo lo de siempre", () => {
    // 5,2 % observado contra 63,6 % previsto: va por debajo, y se ve.
    const bajo = pinta(0.636);
    expect(bajo).toContain("previsto");
    expect(bajo).toContain("es-bajo");
    expect(bajo).not.toContain("sin tasa prevista");
    // Y por encima sigue siendo verde: el cambio no apaga el color, sólo lo
    // quita donde no hay comparación.
    expect(pinta(0.01)).toContain("es-ok");
  });
});
