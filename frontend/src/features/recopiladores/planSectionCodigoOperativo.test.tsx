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

  it("la cabecera habla de cursos-horario y reservas, no de «Grupo»", () => {
    // «Grupo M1/M2» era la ola de muestra, que no ubica a nadie. Y la reserva ya
    // no ocupa fila: cuelga de su titular, contada.
    const html = render([
      { unit_id: "u1", label: "AUL01", role: "titular", group: "M1",
        dimensions: { legacy_ref: "CH 1" } },
      { unit_id: "u2", label: "AUL02", role: "chain_reserve", group: "M2",
        dimensions: { legacy_ref: "R 1.2", replacement_for: "CH 1" } },
    ]);
    expect(html).toContain("Curso-horario");
    expect(html).toContain("Reservas");
    expect(html).toContain("1 reserva");
    expect(html).not.toContain(">M2<");
  });

  it("un plan que sólo trae banco no finge tener aulas que visitar", () => {
    // El banco es reserva de capacidad, no trabajo pendiente.
    const html = render([
      { unit_id: "u3", label: "AUL03", role: "extra_reserve_pool", group: "Extra",
        dimensions: { legacy_ref: "EXTRA 7" } },
    ]);
    expect(html).not.toContain("<strong>EXTRA 7</strong>");
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
// **La tabla ya no lista las reservas.** Gonzalo: «primordialmente las aulas
// titulares, por favor; los reemplazos son esos reemplazos que aparecen EN CASO
// que no se llegue a lo esperado». Antes eran 700 filas —193 titulares y 507
// reservas al mismo nivel—; ahora son 193, cada una con su plan B contado.
//
// El ORDEN de las cadenas y el agrupado se prueban donde viven, en
// `lib/cadenaOperativa.test.ts`: aquí se prueba lo que la tabla enseña.
describe("la tabla lista titulares y cuenta sus reservas", () => {
  const u = (code: string, role: string, seq?: number, ord?: number, de?: string) => ({
    unit_id: code, label: code, role, group: "M1",
    dimensions: { legacy_ref: code, operational_sequence: seq, replacement_order: ord,
                  replacement_for: de },
  });
  const codigos = (html: string) =>
    [...html.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1])
      .filter((t) => /^(CH|R|EXTRA|AULA)\s?\d/.test(t));

  it("las reservas no ocupan una fila: se cuentan", () => {
    const html = render([
      u("CH 1", "titular", 1),
      u("R 1.1", "chain_reserve", 1, 1, "CH 1"),
      u("R 1.2", "chain_reserve", 1, 2, "CH 1"),
      u("CH 2", "titular", 2),
    ]);
    expect(codigos(html)).toEqual(["CH 1", "CH 2"]);
    expect(html).toContain("2 reservas");
  });

  it("una titular sin reservas lo dice, en vez de dejar la celda muda", () => {
    const html = render([u("CH 1", "titular", 1)]);
    expect(html).toContain("sin reservas");
  });

  it("el singular es singular", () => {
    const html = render([
      u("CH 1", "titular", 1), u("R 1.1", "chain_reserve", 1, 1, "CH 1"),
    ]);
    expect(html).toContain("1 reserva");
    expect(html).not.toContain("1 reservas");
  });

  it("el banco tampoco es una fila de trabajo", () => {
    // Reserva de capacidad, no aulas que visitar.
    const html = render([
      u("CH 1", "titular", 1), u("EXTRA 1", "extra_reserve_pool", 1),
    ]);
    expect(codigos(html)).toEqual(["CH 1"]);
  });

  it("la cadena se puede desplegar: el botón declara que está cerrada", () => {
    const html = render([
      u("CH 1", "titular", 1), u("R 1.1", "chain_reserve", 1, 1, "CH 1"),
    ]);
    expect(html).toContain('aria-expanded="false"');
  });
});
