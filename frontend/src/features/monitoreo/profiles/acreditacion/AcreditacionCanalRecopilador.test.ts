import { describe, expect, test } from "vitest";
import type { MonitoreoLinkCollector, MonitoreoSource } from "../../../../api/client";
import { acreditacionCollectorsForSource } from "./AcreditacionSourcesModel";

// Regresión del 2026-07-28, reproducida en `acrconta`.
//
// La encuesta «Acreditación Contabilidad PUCP Estudiantes» tiene canal base
// Ficha QR. Sus 20 recopiladores salían TODOS como «Presencial (Ficha QR)»,
// incluidos los 10 que la plataforma reporta como `email`. Y la tarjeta lo
// presentaba como «20 recopiladores usan este canal · ninguno con excepción»:
// una clasificación que nadie confirmó, mostrada como si estuviera confirmada.
//
// Causa: el orden de los fallbacks en `acreditacionCollectorsForSource`,
//
//     saved?.channel || sourceChannel || platform?.channel || "Sin clasificar"
//
// donde el canal de la ENCUESTA gana sobre el del propio recopilador, así que
// `platform.channel` nunca se alcanzaba —toda encuesta tiene canal—. Es el
// mismo patrón de fallbacks `||` que ya cambió denominadores bajo una misma
// etiqueta en este módulo.

function encuesta(patch: Partial<MonitoreoSource> = {}): MonitoreoSource {
  return {
    id: "src_estudiantes",
    kind: "surveymonkey",
    label: "Acreditación Contabilidad PUCP Estudiantes",
    enabled: true,
    survey_id: "527327742",
    dimensions: { actor: "Estudiantes", canal: "Presencial (Ficha QR)" },
    collectors: [],
    ...patch,
  };
}

function recopilador(id: string, tipo: string, extra: Record<string, unknown> = {}) {
  return { collector_id: id, collector_name: `Recopilador ${id}`, collector_type: tipo, ...extra };
}

describe("canal de un recopilador sin confirmar", () => {
  test("un recopilador de correo NO hereda el canal presencial de su encuesta", () => {
    const source = encuesta({
      collectors: [recopilador("c1", "email"), recopilador("c2", "weblink")],
    });
    const filas = acreditacionCollectorsForSource(source, []);
    const porId = Object.fromEntries(filas.map((fila) => [fila.collectorId, fila.channel]));

    expect(porId.c1).toBe("Correo");
    // El weblink sí hereda: una ficha QR ES un enlace web, así que el canal de
    // la encuesta es la mejor información disponible para ese tipo.
    expect(porId.c2).toBe("Presencial (Ficha QR)");
  });

  test("el `channel` del recopilador NO gana al de la encuesta: es un campo blando", () => {
    // Lo comprueba también `AcreditacionMonitoreoPage.test.ts` con el caso que
    // le dio origen: recopiladores `weblink` llamados «Correo institucional
    // historico» cuyo `channel` dice «Correo» aunque la encuesta se aplique por
    // WhatsApp. Ese campo arrastra nombres heredados, así que el canal
    // declarado en la encuesta le gana.
    const source = encuesta({
      collectors: [recopilador("c3", "weblink", { channel: "Correo" })],
    });
    const [fila] = acreditacionCollectorsForSource(source, []);
    expect(fila.channel).toBe("Presencial (Ficha QR)");
  });

  test("pero el TIPO sí lo contradice: `collector_type` es dato duro", () => {
    const source = encuesta({
      collectors: [recopilador("c3b", "email", { channel: "Presencial (Ficha QR)" })],
    });
    const [fila] = acreditacionCollectorsForSource(source, []);
    expect(fila.channel).toBe("Correo");
  });

  test("lo confirmado por el usuario manda sobre todo lo demás", () => {
    const source = encuesta({
      collectors: [recopilador("c4", "email", { channel: "Enlace personalizado (Whatsapp)" })],
    });
    const guardado = [{
      id: "lc1",
      source_id: "src_estudiantes",
      source_label: "",
      survey_id: "527327742",
      collector_id: "c4",
      collector_name: "",
      collector_type: "email",
      channel: "Presencial (Ficha QR)",
      operational_use: "presencial_qr",
      modality: "presencial",
      roster_required: false,
    }] as MonitoreoLinkCollector[];
    const [fila] = acreditacionCollectorsForSource(source, guardado);
    expect(fila.channel).toBe("Presencial (Ficha QR)");
  });

  test("sms tampoco se vuelve presencial", () => {
    const source = encuesta({ collectors: [recopilador("c5", "sms")] });
    const [fila] = acreditacionCollectorsForSource(source, []);
    expect(fila.channel).not.toBe("Presencial (Ficha QR)");
  });

  test("sin tipo ni canal propio, hereda el de la encuesta", () => {
    const source = encuesta({ collectors: [recopilador("c6", "")] });
    const [fila] = acreditacionCollectorsForSource(source, []);
    expect(fila.channel).toBe("Presencial (Ficha QR)");
  });

  test("el caso real: 10 email de 20 dejan de contarse como Ficha QR", () => {
    const source = encuesta({
      collectors: [
        ...Array.from({ length: 10 }, (_, i) => recopilador(`mail${i}`, "email")),
        ...Array.from({ length: 10 }, (_, i) => recopilador(`link${i}`, "weblink")),
      ],
    });
    const filas = acreditacionCollectorsForSource(source, []);
    const qr = filas.filter((fila) => fila.channel === "Presencial (Ficha QR)").length;
    expect(filas).toHaveLength(20);
    expect(qr).toBe(10);
  });
});
