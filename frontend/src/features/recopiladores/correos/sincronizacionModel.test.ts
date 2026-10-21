import { describe, expect, it } from "vitest";

import { normalizeOpciones, normalizeResultado } from "../../../api/mailchimpSync";
import { resumenDeSincronizacion, segmentoEnMailchimp } from "./sincronizacionModel";

const base = normalizeResultado({
  recipients: 7, recipients_with_token: 7, responses: 5, completed: 4, partial: 1, without_token: 1,
  from_other_campaign: 1, respondents: 2, pending: 5, tagged: 2, not_in_audience: 0, tag: "Respondió",
  dry_run: false, synced_at: "2026-10-21T16:00:00-0500",
});

describe("resumen de «Actualizar quién respondió»", () => {
  it("dice cuántos respondieron y cuántos faltan, y solo las líneas con algo", () => {
    const r = resumenDeSincronizacion(base);
    expect(r.titulo).toBe("2 de 7 ya respondieron; faltan 5.");
    expect(r.lineas).toEqual([
      "En Mailchimp quedaron con la etiqueta «Respondió».",
      "1 persona dejó la encuesta a medias: sigue recibiendo recordatorios.",
      "1 respuesta trae un token que no es de esta campaña.",
      "1 respuesta entró sin token y no se puede atribuir.",
    ]);
  });

  it("avisa a quién no se pudo etiquetar porque no está en la audiencia", () => {
    const r = resumenDeSincronizacion({ ...base, tagged: 1, not_in_audience: 1, partial: 0, from_other_campaign: 0, without_token: 0 });
    expect(r.lineas).toEqual([
      "1 persona quedó con la etiqueta «Respondió» en Mailchimp.",
      "1 persona no está en esa audiencia de Mailchimp: no se pudo etiquetar.",
    ]);
  });

  it("sin respuestas no dice que alguien quedó etiquetado", () => {
    const r = resumenDeSincronizacion({ ...base, respondents: 0, tagged: 0, pending: 7, partial: 0, from_other_campaign: 0, without_token: 0 });
    expect(r.titulo).toBe("0 de 7 ya respondieron; faltan 7.");
    expect(r.lineas).toEqual([]);
  });

  it("usa separador de miles peruano", () => {
    const r = resumenDeSincronizacion({ ...base, respondents: 4542, recipients_with_token: 22820, pending: 18278 });
    expect(r.titulo).toBe("4,542 de 22,820 ya respondieron; faltan 18,278.");
  });

  it("nombra el segmento como lo muestra Mailchimp", () => {
    expect(segmentoEnMailchimp("Respondió")).toBe("Tags › contact is not tagged › Respondió");
  });
});

describe("normalizadores defensivos", () => {
  it("toleran payloads incompletos", () => {
    const o = normalizeOpciones({ mailchimp: { connected: true, audiences: [{ id: "a1", name: "Acreditación", member_count: 8 }, { name: "sin id" }] } });
    expect(o.surveymonkey.connected).toBe(false);
    expect(o.mailchimp.audiences).toEqual([{ id: "a1", name: "Acreditación", member_count: 8 }]);
    expect(normalizeResultado(null).tag).toBe("Respondió");
  });
});

describe("avisos del recordatorio", () => {
  it("avisa si el asunto repite el de la invitación o si falta apertura", async () => {
    const { avisosDeRecordatorio } = await import("./sincronizacionModel");
    expect(avisosDeRecordatorio("Prueba: Reacreditación", "prueba:  reacreditación", "")).toHaveLength(2);
    expect(avisosDeRecordatorio("Recordatorio: Prueba", "Prueba", "Le recordamos…")).toEqual([]);
  });
});
