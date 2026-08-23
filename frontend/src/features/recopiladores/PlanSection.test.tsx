import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CollectionPlan, CollectionStatePayload } from "../../api/recopiladores";
import { paginatePlanUnits, PlanSection, unitRoleLabel } from "./PlanSection";

function emptyPayload(seedAvailable: boolean): CollectionStatePayload {
  const state = {
    schema: "collection_state/v1" as const,
    state_revision: 0,
    plan: null,
    deployment: null,
  };
  return { ok: true, noop: true, seed_available: seedAvailable, ...state, state };
}

function payloadWithPlan(plan: CollectionPlan): CollectionStatePayload {
  const state = {
    schema: "collection_state/v1" as const,
    state_revision: 1,
    plan,
    deployment: null,
  };
  return { ok: true, noop: true, seed_available: false, ...state, state };
}

const BASE_PLAN: CollectionPlan = {
  schema: "collection_plan/v1",
  plan_id: "plan-1",
  adapter: { id: "aulas_v1", version: 1 },
  source_ref: { module: "calc-muestra-aulas", run_id: "run-1", fingerprint: "fp" },
  instrument_ref: { revision_id: "rev-1", sha256: "sha" },
  unit_type: "classroom_course_schedule",
  revision: 1,
  input_fingerprint: "fp",
  units: [
    { unit_id: "u1", label: "AUL01", role: "titular", group: "M1" },
    {
      unit_id: "u2", label: "AUL02", role: "chain_reserve", group: "M2",
      dimensions: { replacement_for: "AUL01" },
    },
    { unit_id: "u3", label: "AUL03", role: "extra_reserve_pool", group: "Extra" },
    { unit_id: "u4", label: "AUL04", role: "un_rol_futuro_no_mapeado", group: "M1" },
  ],
};

describe("adaptación del plan legacy", () => {
  it("no ofrece una acción que no puede producir un plan", () => {
    const markup = renderToStaticMarkup(
      <PlanSection payload={emptyPayload(false)} onState={() => undefined} />,
    );
    expect(markup).not.toContain("Adaptar fuente disponible");
    expect(markup).toContain("entrega una selección desde su módulo de origen");
  });

  it("ofrece adaptación solo cuando el backend declara una semilla", () => {
    const markup = renderToStaticMarkup(
      <PlanSection payload={emptyPayload(true)} onState={() => undefined} />,
    );
    expect(markup).toContain("Adaptar fuente disponible");
    expect(markup).toContain("selección o un plan de aulas compatible");
  });
});

describe("rol de cada unidad, traducido igual que la ficha impresa", () => {
  it("traduce las claves del motor y arma el «Reemplazo de» con el nombre de la unidad", () => {
    const markup = renderToStaticMarkup(
      <PlanSection payload={payloadWithPlan(BASE_PLAN)} onState={() => undefined} />,
    );
    // La columna «Rol» se fue: decía «Titular» en el 100% de las filas
    // principales —el código operativo «CH n» ya lo dice— y ese ancho hacía
    // falta para el curso y el docente, que es con lo que se agenda. Lo que
    // este test protege de verdad sigue en pie: que ninguna clave del motor
    // salga cruda, abajo.
    // Las reservas de cadena y el banco ya NO son filas de la tabla: la lista
    // primaria son las titulares y el plan B se cuenta —«1 reserva»— hasta que
    // alguien lo despliega. La traducción de sus roles sigue viva y se prueba
    // sobre el modelo en `lib/cadenaOperativa.test.ts` y al desplegar.
    expect(markup).toContain("1 reserva");
    // Un rol no mapeado se muestra tal cual y NO desaparece: no cuelga de
    // ninguna cadena, así que sale al final como huérfano en vez de perderse.
    expect(markup).toContain("un_rol_futuro_no_mapeado");
    expect(markup).toContain("sin titular en el plan");
    expect(markup).not.toContain("chain_reserve");
    expect(markup).not.toContain("extra_reserve_pool");
  });
});

describe("de quién es reemplazo cada reserva", () => {
  it("nombra al titular por su código operativo, no por el código interno", () => {
    // `replacement_for` guarda el NOMBRE académico del aula —«urb209_0601»— y
    // la reserva se anunciaba «Reemplazo de urb209_0601» en la misma pantalla
    // que ya llama a esa aula «CH 1». Medido en HSVG2026 el 2026-08-23.
    const plan: CollectionPlan = {
      ...BASE_PLAN,
      units: [
        {
          unit_id: "t1", label: "urb209_0601", role: "titular", group: "M1",
          dimensions: { legacy_ref: "CH 1", operational_sequence: 1, replacement_order: 0 },
        },
        {
          unit_id: "r1", label: "1arc66_0601", role: "chain_reserve", group: "M1",
          dimensions: {
            legacy_ref: "R 1.1", operational_sequence: 1, replacement_order: 1,
            replacement_for: "urb209_0601",
          },
        },
      ],
    };
    const markup = renderToStaticMarkup(
      <PlanSection payload={payloadWithPlan(plan)} onState={() => undefined} />,
    );
    expect(markup).not.toContain("Reemplazo de urb209_0601");

    // La reserva está colapsada en la tabla, así que el `not.toContain` de
    // arriba pasaría igual sin arreglar nada: la regla se comprueba en
    // positivo sobre el helper, que es donde vive.
    const titular = plan.units[0];
    const reserva = plan.units[1];
    expect(unitRoleLabel(reserva, titular)).toBe("Reemplazo de CH 1");
    // Y sin el titular a mano, el comportamiento viejo: el nombre interno.
    expect(unitRoleLabel(reserva)).toBe("Reemplazo de urb209_0601");
  });

  it("cae al nombre del aula sólo si no hay código operativo del titular", () => {
    // Sin `legacy_ref` no se puede traducir; decir «Reemplazo» a secas perdería
    // de quién es, que es lo único que la reserva necesita declarar.
    const plan: CollectionPlan = {
      ...BASE_PLAN,
      units: [
        { unit_id: "t1", label: "AUL01", role: "titular", group: "M1",
          dimensions: { operational_sequence: 1, replacement_order: 0 } },
        { unit_id: "r1", label: "AUL02", role: "chain_reserve", group: "M1",
          dimensions: { operational_sequence: 1, replacement_order: 1, replacement_for: "AUL01" } },
      ],
    };
    const markup = renderToStaticMarkup(
      <PlanSection payload={payloadWithPlan(plan)} onState={() => undefined} />,
    );
    expect(markup).not.toContain("chain_reserve");
    const [titular, reserva] = plan.units;
    expect(unitRoleLabel(reserva, titular)).toBe("Reemplazo de AUL01");
    // Un titular nunca se anuncia como reemplazo de nadie.
    expect(unitRoleLabel(titular, titular)).toBe("Titular");
    // Y el banco no cuelga de ninguna cadena.
    expect(unitRoleLabel({ role: "extra_reserve_pool", dimensions: {} })).toBe("Reserva adicional");
  });
});

describe("revisión del instrumento en la cabecera del plan", () => {
  it("traduce el centinela de instrumento no fijado, no lo muestra crudo", () => {
    const plan: CollectionPlan = {
      ...BASE_PLAN,
      instrument_ref: { revision_id: "legacy-instrument-unpinned", sha256: "sha" },
    };
    const markup = renderToStaticMarkup(
      <PlanSection payload={payloadWithPlan(plan)} onState={() => undefined} />,
    );
    expect(markup).toContain("sin instrumento fijado");
    expect(markup).not.toContain("legacy-instrument-unpinned");
  });

  it("una revisión real se muestra tal cual, no se inventa una etiqueta", () => {
    const markup = renderToStaticMarkup(
      <PlanSection payload={payloadWithPlan(BASE_PLAN)} onState={() => undefined} />,
    );
    expect(markup).toContain("rev-1");
  });
});

describe("paginación del plan", () => {
  it("acota un plan realista sin perder el conteo total", () => {
    const units = Array.from({ length: 2373 }, (_, index) => index + 1);
    const first = paginatePlanUnits(units, 0);
    const last = paginatePlanUnits(units, 47);

    expect(first.items).toHaveLength(50);
    expect(first.start).toBe(0);
    expect(first.end).toBe(50);
    expect(first.totalPages).toBe(48);
    expect(last.items).toHaveLength(23);
    expect(last.start).toBe(2350);
    expect(last.end).toBe(2373);
  });

  it("normaliza páginas fuera de rango", () => {
    const page = paginatePlanUnits(["a", "b"], 99, 1);
    expect(page.page).toBe(1);
    expect(page.items).toEqual(["b"]);
  });
});
