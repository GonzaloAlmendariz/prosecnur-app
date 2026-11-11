import { describe, expect, it } from "vitest";

import { normalizeOpciones, normalizeResultado } from "../../../api/mailchimpSync";
import { puedeActualizar, resumenDeSincronizacion, segmentoEnMailchimp } from "./sincronizacionModel";

const base = normalizeResultado({
  recipients: 7, recipients_with_token: 7, responses: 5, completed: 4, partial: 1, without_token: 1,
  from_other_campaign: 1, respondents: 2, pending: 5, tagged: 2, not_in_audience: 0, tag: "Respondió",
  dry_run: false, synced_at: "2026-10-21T16:00:00-0500", partial_people: 1,
});

describe('resumen de "Actualizar quién respondió"', () => {
  it("dice cuántos respondieron y cuántos faltan, y solo las líneas con algo", () => {
    const r = resumenDeSincronizacion(base);
    expect(r.titulo).toBe("2 de 7 ya respondieron; faltan 5.");
    expect(r.lineas).toEqual([
      'En Mailchimp quedaron con la etiqueta "Respondió".',
      "1 persona dejó la encuesta a medias: sigue recibiendo recordatorios.",
      "1 respuesta llegó por un enlace que no es de esta campaña.",
      "1 respuesta entró sin enlace personal y no se puede atribuir.",
    ]);
  });

  it("avisa a quién no se pudo etiquetar porque no está en la audiencia", () => {
    const r = resumenDeSincronizacion({ ...base, tagged: 1, not_in_audience: 1, partial: 0, partial_people: 0, from_other_campaign: 0, without_token: 0 });
    expect(r.lineas).toEqual([
      '1 persona quedó con la etiqueta "Respondió" en Mailchimp.',
      "1 persona no está en esa audiencia de Mailchimp: no se pudo etiquetar.",
    ]);
  });

  it("sin respuestas no dice que alguien quedó etiquetado", () => {
    const r = resumenDeSincronizacion({ ...base, respondents: 0, tagged: 0, pending: 7, partial: 0, partial_people: 0, from_other_campaign: 0, without_token: 0 });
    expect(r.titulo).toBe("0 de 7 ya respondieron; faltan 7.");
    expect(r.lineas).toEqual([]);
  });

  it("cuenta personas a medias, no respuestas parciales", () => {
    // Dos respuestas parciales de una misma persona que después completó: nadie quedó a medias.
    const r = resumenDeSincronizacion({ ...base, partial: 2, partial_people: 0, from_other_campaign: 0, without_token: 0 });
    expect(r.lineas.some((l) => l.includes("a medias"))).toBe(false);
  });

  it("dice qué se archivó y a quién no se tocó por estar inactivo", () => {
    const r = resumenDeSincronizacion({
      ...base, archive: true, archived: 2, archived_second: 1, inactive: 1, partial_people: 0, from_other_campaign: 0, without_token: 0,
    });
    expect(r.lineas).toEqual([
      'En Mailchimp quedaron con la etiqueta "Respondió".',
      "Archivados en Mailchimp: 2 correos de la lista y 1 correo personal.",
      "1 persona que respondió ya no está activa en la audiencia: no se etiqueta ni se archiva.",
    ]);
  });

  it("sin pedir archivar no menciona el archivado", () => {
    const r = resumenDeSincronizacion({ ...base, archive: false, archived: 0, partial_people: 0, from_other_campaign: 0, without_token: 0 });
    expect(r.lineas.some((l) => l.startsWith("Archivados"))).toBe(false);
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
    const r = normalizeResultado({ archive: true, archived: 3, archived_second: 1, inactive: 2, partial_people: 4 });
    expect([r.archive, r.archived, r.archived_second, r.inactive, r.partial_people]).toEqual([true, 3, 1, 2, 4]);
  });
});

describe("avisos del recordatorio", () => {
  it("avisa si el asunto repite el de la invitación o si falta apertura", async () => {
    const { avisosDeRecordatorio } = await import("./sincronizacionModel");
    expect(avisosDeRecordatorio("Prueba: Reacreditación", "prueba:  reacreditación", "")).toHaveLength(2);
    expect(avisosDeRecordatorio("Recordatorio: Prueba", "Prueba", "Le recordamos…")).toEqual([]);
  });
});

describe("cuándo se puede actualizar quién respondió", () => {
  const listo = { mailchimpListo: true, surveymonkeyConectado: true, encuesta: "528820204", audiencia: "lst1" };
  it("la encuesta que no recibe la variable de la campaña bloquea; sin veredicto, no", () => {
    expect(puedeActualizar({ ...listo, coincide: true })).toBe(true);
    expect(puedeActualizar({ ...listo, coincide: null })).toBe(true);
    expect(puedeActualizar({ ...listo, coincide: false })).toBe(false);
  });
  it("faltando una conexión, la encuesta o la audiencia, tampoco", () => {
    expect(puedeActualizar({ ...listo, mailchimpListo: false, coincide: true })).toBe(false);
    expect(puedeActualizar({ ...listo, surveymonkeyConectado: false, coincide: true })).toBe(false);
    expect(puedeActualizar({ ...listo, encuesta: "", coincide: true })).toBe(false);
    expect(puedeActualizar({ ...listo, audiencia: "", coincide: true })).toBe(false);
  });
});
