// La tabla del plan enseñaba el nombre académico del aula —«1ges08_0601»— con el
// `unit_id` debajo —«unit-aulas-aula-1-5524e6773d»—, y una columna «Grupo» que
// decía «M1» para todas las titulares.
//
// Ninguno de esos tres es el código con el que se habla del aula: en campo, en el
// libro de agendación y en las fichas QR es «CH 1» y «R 1.2». El código estaba
// desde el principio en `dimensions.legacy_ref` —el `operational_code` del que
// sale el propio `unit_id`— y no se pintaba.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CollectionPlan, CollectionStatePayload } from "../../api/recopiladores";
import { PlanSection } from "./PlanSection";

const plan = (units: CollectionPlan["units"]): CollectionStatePayload => {
  const state = {
    schema: "collection_state/v1" as const,
    state_revision: 1,
    plan: {
      schema: "collection_plan/v1",
      plan_id: "plan-1",
      adapter: { id: "aulas_v1", version: 1 },
      source_ref: { module: "calc-muestra-aulas", run_id: "run-1", fingerprint: "fp" },
      instrument_ref: { revision_id: "rev-1", sha256: "sha" },
      unit_type: "classroom_course_schedule",
      revision: 1,
      input_fingerprint: "fp",
      units,
    } as CollectionPlan,
    deployment: null,
  };
  return { ok: true, noop: true, seed_available: false, ...state, state };
};

const render = (units: CollectionPlan["units"]) =>
  renderToStaticMarkup(<PlanSection payload={plan(units)} onState={() => undefined} />);

describe("la tabla del plan habla en códigos de campo", () => {
  it("enseña el código operativo y deja el hash fuera", () => {
    const html = render([
      { unit_id: "unit-aulas-aula-1-5524e6773d", label: "1ges08_0601", role: "titular",
        group: "M1", dimensions: { legacy_ref: "CH 1" } },
    ]);
    expect(html).toContain("<strong>CH 1</strong>");
    // El nombre académico se conserva de apoyo: identifica el aula en el sistema.
    expect(html).toContain("1ges08_0601");
    // El hash no: es infraestructura para juntar registros.
    expect(html).not.toContain("unit-aulas-aula-1-5524e6773d");
  });

  it("la columna de cadena agrupa titular y reserva, en vez de decir M1 y M2", () => {
    const html = render([
      { unit_id: "u1", label: "AUL01", role: "titular", group: "M1",
        dimensions: { legacy_ref: "CH 1" } },
      { unit_id: "u2", label: "AUL02", role: "chain_reserve", group: "M2",
        dimensions: { legacy_ref: "R 1.2", replacement_for: "CH 1" } },
    ]);
    expect(html).toContain("Cadena");
    expect(html).toContain("<strong>R 1.2</strong>");
    // Las dos filas se leen como una misma cadena: el titular es cabeza de la
    // suya y la reserva declara de quién es.
    expect(html.match(/CH 1/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain(">M2<");
  });

  it("el banco se declara como banco, no como una cadena", () => {
    const html = render([
      { unit_id: "u3", label: "AUL03", role: "extra_reserve_pool", group: "Extra",
        dimensions: { legacy_ref: "EXTRA 7" } },
    ]);
    expect(html).toContain("Banco");
  });

  it("sin código operativo la fila no se queda muda", () => {
    // Un plan viejo, anterior a que `legacy_ref` viajara: se comporta como antes.
    const html = render([
      { unit_id: "u9", label: "AUL09", role: "titular", group: "M1" },
    ]);
    expect(html).toContain("<strong>AUL09</strong>");
    expect(html).toContain("u9");
  });
});
