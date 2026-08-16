/**
 * Cuando el motor anula la precisión, la tarjeta no la inventa.
 *
 * `calc_muestra_validar_inferencia` bloquea el margen de error formal —marco
 * sin validar, deff < 1, τ fuera de (0,1]— y entonces el motor devuelve
 * `precision_alcanzada: null` y llena `advertencia` con el porqué.
 *
 * La tarjeta hacía `resultado.precision_alcanzada ?? calcEPreview(...)`, así
 * que el null caía a una estimación calculada en el cliente: pintaba «precisión
 * estimada con este n: 4,8%» sobre un resultado que el motor había declarado
 * sin precisión formal. Y la advertencia que lo explica no se mostraba en
 * ninguna superficie de Cálculo de muestra —está en el contrato desde siempre y
 * no la leía nadie—.
 *
 * Las dos mitades son el mismo defecto: la cifra inventada tapa el hueco que la
 * advertencia venía a nombrar.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EscenarioCard } from "../CalculoPropuestasTab";
import type { CalcMuestraComponente } from "../../../../../api/client";

const ADVERTENCIA =
  "Resultado calculado sin habilitar margen de error formal. deff es 0.8 y debe ser >= 1 para conglomerados.";

function componente(resultado: Record<string, unknown>): CalcMuestraComponente {
  return {
    id: "cmp-1",
    actor: "Estudiantes",
    actor_id: "estudiantes_universidad",
    actor_categoria: "otros",
    canal_recojo: "aula_qr",
    tecnica: "prob_conglomerado_multietapico",
    marco: { estado: "validado", marco_validado: 1000, estratos: [] },
    parametros: { p: 0.5, z: 1.96, e: 0.05, deff: 2, tau: 0.8, oversample_pct: 0 },
    resultado,
  } as unknown as CalcMuestraComponente;
}

function pintar(resultado: Record<string, unknown>): string {
  return renderToStaticMarkup(
    <EscenarioCard
      comp={componente(resultado)}
      redondeoMultiplo={10}
      draft={400}
      onDraftTarget={() => {}}
      onApplyTarget={() => {}}
      calculando={false}
    />,
  );
}

const CON_ADVERTENCIA = {
  n_teorico: 380, n_objetivo: 400, n_operativo: 400,
  precision_alcanzada: null, origen_tamano: "formula",
  advertencia: ADVERTENCIA,
};

const SIN_ADVERTENCIA = {
  n_teorico: 380, n_objetivo: 400, n_operativo: 400,
  precision_alcanzada: 0.048, origen_tamano: "formula",
};

describe("resultado sin margen de error formal", () => {
  it("publica la advertencia del motor, con su causa", () => {
    const html = pintar(CON_ADVERTENCIA);
    expect(html).toContain("no tiene margen de error formal");
    // La causa concreta viaja entera, incluido el valor que la produjo.
    expect(html).toContain("deff es 0.8");
  });

  it("no pinta una precisión estimada donde el motor no la da", () => {
    // EL defecto: el `??` caía al preview del cliente y publicaba una cifra que
    // el motor había anulado.
    const html = pintar(CON_ADVERTENCIA);
    expect(html).not.toContain("precisión estimada con este n");
  });

  it("un resultado normal conserva su precisión y no muestra el aviso", () => {
    // Control: el cambio no puede apagar la lectura de siempre.
    const html = pintar(SIN_ADVERTENCIA);
    expect(html).toContain("precisión estimada con este n");
    expect(html).not.toContain("no tiene margen de error formal");
  });

  it("una advertencia en blanco no dispara el aviso", () => {
    // `""` y `"   "` son ausencia, no advertencia: tratarlas como aviso pondría
    // un cartel vacío sobre un resultado sano.
    for (const vacia of ["", "   "]) {
      const html = pintar({ ...SIN_ADVERTENCIA, advertencia: vacia });
      expect(html).not.toContain("no tiene margen de error formal");
      expect(html).toContain("precisión estimada con este n");
    }
  });
});
