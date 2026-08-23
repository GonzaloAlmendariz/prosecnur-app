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

// «No estaría en orden del primer curso-horario al último y los reemplazos así
// como los extras deberían estar en ese orden de importancia.»
//
// El orden se arregló también en el productor, pero eso sólo alcanza a los
// planes que se creen desde ahora: un plan ya congelado conserva el orden con
// el que se guardó, y el plan es justamente un objeto que se congela. Por eso la
// vista ordena siempre.
describe("la vista ordena el plan como se recorre el operativo", () => {
  const u = (code: string, role: string, seq?: number, ord?: number) => ({
    unit_id: code, label: code, role, group: "M1",
    dimensions: { legacy_ref: code, operational_sequence: seq, replacement_order: ord },
  });

  const codigosEnPantalla = (html: string) =>
    [...html.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1])
      .filter((t) => /^(CH|R|EXTRA)\s/.test(t));

  it("cada titular con sus reservas detrás y las cadenas en orden", () => {
    const html = render([
      u("CH 2", "titular", 2), u("R 1.2", "chain_reserve", 1, 2),
      u("CH 1", "titular", 1), u("R 2.1", "chain_reserve", 2, 1),
      u("R 1.1", "chain_reserve", 1, 1),
    ]);
    expect(codigosEnPantalla(html)).toEqual(["CH 1", "R 1.1", "R 1.2", "CH 2", "R 2.1"]);
  });

  it("el banco va al final, detrás de todas las cadenas", () => {
    const html = render([
      u("EXTRA 1", "extra_reserve_pool", 1),
      u("CH 1", "titular", 1),
      u("R 1.1", "chain_reserve", 1, 1),
    ]);
    expect(codigosEnPantalla(html)).toEqual(["CH 1", "R 1.1", "EXTRA 1"]);
  });

  it("sin secuencia declarada nadie se va a un sitio arbitrario", () => {
    // Un plan viejo, anterior a que `operational_sequence` viajara: conserva su
    // orden de entrada en vez de barajarse.
    const html = render([
      u("CH 1", "titular"), u("CH 2", "titular"), u("CH 3", "titular"),
    ]);
    expect(codigosEnPantalla(html)).toEqual(["CH 1", "CH 2", "CH 3"]);
  });
});

// Un plan anterior a que `operational_sequence` viajara —el del estudio real—
// sigue sabiendo de quién es cada reserva: `replacement_for` está desde antes.
// Sin usarlo, la tabla las enseñaba barajadas (R1.6, R3.6, R2.6…) aunque cada
// una declarara su titular.
describe("un plan sin secuencia se ordena por su titular", () => {
  const titular = (code: string) => ({
    unit_id: code, label: code, role: "titular", group: "M1",
    dimensions: { legacy_ref: code },
  });
  const reserva = (code: string, de: string, orden: number) => ({
    unit_id: code, label: code, role: "chain_reserve", group: "M2",
    dimensions: { legacy_ref: code, replacement_for: de, replacement_order: orden },
  });
  const codigos = (html: string) =>
    [...html.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1])
      .filter((t) => /^(AULA|R)\s?\d/.test(t));

  it("agrupa cada reserva con su titular, en el orden de los titulares", () => {
    const html = render([
      titular("AULA 1"), titular("AULA 2"), titular("AULA 3"),
      reserva("R1.6", "AULA 1", 6), reserva("R3.6", "AULA 3", 6),
      reserva("R2.6", "AULA 2", 6), reserva("R1.1", "AULA 1", 1),
    ]);
    expect(codigos(html)).toEqual(["AULA 1", "R1.1", "R1.6", "AULA 2", "R2.6", "AULA 3", "R3.6"]);
  });

  it("una reserva huérfana no se cuela en medio de las cadenas", () => {
    // Su titular no está en el plan: va al final de las cadenas, no entre ellas.
    const html = render([
      titular("AULA 1"), reserva("R9.1", "AULA 9", 1), reserva("R1.1", "AULA 1", 1),
    ]);
    expect(codigos(html)).toEqual(["AULA 1", "R1.1", "R9.1"]);
  });
});
