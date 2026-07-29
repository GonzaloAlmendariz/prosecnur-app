import { describe, expect, it } from "vitest";

import {
  compararPorPrioridad,
  llaveBreve,
  llaveDependeDeLaRespuesta,
  motivoDeNoCruce,
  resumenDeMotivos,
} from "./motivoDeNoCruce";

const vacio = {};

describe("motivoDeNoCruce", () => {
  it("distingue el caso sin llave del caso con llave que no está en la base", () => {
    const sinLlave = motivoDeNoCruce(vacio, "complete", "sin_llave");
    const fueraDeBase = motivoDeNoCruce(
      { primary_identity_value: "20191234" },
      "complete",
      "sin_cruce",
    );
    expect(sinLlave.clave).toBe("sin-llave");
    expect(fueraDeBase.clave).toBe("llave-fuera-de-base");
    // El defecto original: los dos mostraban exactamente la misma frase.
    expect(sinLlave.etiqueta).not.toBe(fueraDeBase.etiqueta);
    expect(sinLlave.queHacer).not.toBe(fueraDeBase.queHacer);
  });

  it("nombra la llave concreta que no encontró", () => {
    const motivo = motivoDeNoCruce(
      { primary_identity_value: "20191234" },
      "complete",
      "sin_cruce",
    );
    expect(motivo.etiqueta).toContain("20191234");
  });

  it("cuando solo llegó el dato auxiliar, dice cuál es y lo usa en la acción", () => {
    const motivo = motivoDeNoCruce(
      { secondary_identity_label: "Correo", secondary_identity_value: "ana@pucp.edu.pe" },
      "partial",
      "sin_cruce",
    );
    expect(motivo.clave).toBe("solo-auxiliar");
    expect(motivo.etiqueta).toBe("Solo dejó correo");
    expect(motivo.queHacer).toContain("ana@pucp.edu.pe");
  });

  it("una llave repetida se reporta con su número de respuestas", () => {
    const motivo = motivoDeNoCruce(
      { primary_identity_value: "20191234", duplicate_count: 3 },
      "complete",
      "sin_cruce",
    );
    expect(motivo.clave).toBe("duplicado");
    expect(motivo.etiqueta).toContain("3");
  });

  it("un duplicado declarado solo por group_size también se detecta", () => {
    const motivo = motivoDeNoCruce(
      { primary_identity_value: "20191234", duplicate_group_size: 2 },
      "complete",
      "sin_cruce",
    );
    expect(motivo.clave).toBe("duplicado");
  });

  it("no trata como duplicado un grupo de uno", () => {
    const motivo = motivoDeNoCruce(
      { primary_identity_value: "20191234", duplicate_count: 1, duplicate_group_size: 1 },
      "complete",
      "sin_cruce",
    );
    expect(motivo.clave).toBe("llave-fuera-de-base");
  });

  it("el estado de respuesta manda sobre la evidencia de llave", () => {
    expect(motivoDeNoCruce({ primary_identity_value: "X" }, "pending", "sin_cruce").clave)
      .toBe("sin-respuesta");
    expect(motivoDeNoCruce({ primary_identity_value: "X" }, "refusal", "sin_cruce").clave)
      .toBe("rechazo");
  });

  it("la base ausente se distingue del caso que no cruzó", () => {
    const motivo = motivoDeNoCruce({ primary_identity_value: "X" }, "complete", "sin_base");
    expect(motivo.clave).toBe("sin-base");
    expect(motivo.queHacer).toContain("base del actor");
  });

  it("un caso con llave y registro en base no inventa una causa", () => {
    const motivo = motivoDeNoCruce(
      { primary_identity_value: "20191234", base_record: "fila 42" },
      "complete",
      "sin_cruce",
    );
    expect(motivo.clave).toBe("sin-clasificar");
  });

  it("ningún motivo deja la etiqueta o la acción vacías", () => {
    const casos = [
      motivoDeNoCruce(vacio, "complete", "sin_llave"),
      motivoDeNoCruce(vacio, "pending", ""),
      motivoDeNoCruce(vacio, "refusal", ""),
      motivoDeNoCruce({ secondary_identity_value: "a@b.c" }, "complete", "sin_cruce"),
      motivoDeNoCruce({ primary_identity_value: "X", duplicate_count: 4 }, "complete", "sin_cruce"),
      motivoDeNoCruce({ primary_identity_value: "X" }, "complete", "sin_cruce"),
      motivoDeNoCruce({ primary_identity_value: "X", base_record: "f" }, "complete", "sin_cruce"),
    ];
    casos.forEach((motivo) => {
      expect(motivo.etiqueta.trim().length).toBeGreaterThan(0);
      expect(motivo.queHacer.trim().length).toBeGreaterThan(0);
    });
    // Y cada uno dice algo distinto: ese era el defecto.
    expect(new Set(casos.map((motivo) => motivo.etiqueta)).size).toBe(casos.length);
  });
});

describe("prioridad: no todo no cruce pesa igual", () => {
  it("una completa sin cruce es recuperable, que es lo que mueve el avance", () => {
    const motivo = motivoDeNoCruce(
      { primary_identity_value: "20191234" },
      "complete",
      "sin_cruce",
    );
    expect(motivo.prioridad).toBe("recuperable");
  });

  it("un rechazo o una no respuesta son esperables: resolverlos no suma efectivas", () => {
    expect(motivoDeNoCruce(vacio, "refusal", "sin_llave").prioridad).toBe("esperable");
    expect(motivoDeNoCruce(vacio, "pending", "sin_llave").prioridad).toBe("esperable");
  });

  it("una parcial temprana por teléfono cortó antes de la pregunta de código", () => {
    const motivo = motivoDeNoCruce(
      { channel_key_strategy: "telefono_enlace_y_codigo_final", partial_completion_pct: 20 },
      "partial",
      "sin_llave",
    );
    expect(motivo.prioridad).toBe("esperable");
    expect(motivo.etiqueta).toBe("Cortó antes de la pregunta de código");
  });

  it("una parcial por correo sin llave sí es revisable: la metadata debía traerla", () => {
    const motivo = motivoDeNoCruce(
      { channel_key_strategy: "correo_envio", partial_completion_pct: 20 },
      "partial",
      "sin_llave",
    );
    expect(motivo.prioridad).toBe("revisable");
    expect(motivo.etiqueta).toBe("No dejó ningún dato de identidad");
  });

  it("una parcial ya avanzada por WhatsApp vuelve a ser revisable", () => {
    const temprana = motivoDeNoCruce(
      { channel_key_strategy: "pregunta_pucp_whatsapp", partial_completion_pct: 30 },
      "partial",
      "sin_llave",
    );
    const avanzada = motivoDeNoCruce(
      { channel_key_strategy: "pregunta_pucp_whatsapp", partial_completion_pct: 85 },
      "partial",
      "sin_llave",
    );
    expect(temprana.prioridad).toBe("esperable");
    expect(avanzada.prioridad).toBe("revisable");
  });

  it("una completa nunca se explica por el canal, aunque la llave fuera pregunta", () => {
    const motivo = motivoDeNoCruce(
      { channel_key_strategy: "pregunta_pucp_qr" },
      "complete",
      "sin_llave",
    );
    expect(motivo.prioridad).toBe("recuperable");
    expect(motivo.etiqueta).toBe("No dejó ningún dato de identidad");
  });

  it("ordena lo recuperable antes que lo esperable", () => {
    const casos = [
      motivoDeNoCruce(vacio, "refusal", "sin_llave"),
      motivoDeNoCruce({ primary_identity_value: "A" }, "complete", "sin_cruce"),
      motivoDeNoCruce({ channel_key_strategy: "correo_envio" }, "partial", "sin_llave"),
    ];
    const orden = [...casos].sort(compararPorPrioridad).map((motivo) => motivo.prioridad);
    expect(orden).toEqual(["recuperable", "revisable", "esperable"]);
  });
});

describe("llaveDependeDeLaRespuesta", () => {
  it("distingue los canales que preguntan la llave de los que la traen en el envío", () => {
    expect(llaveDependeDeLaRespuesta("telefono_enlace_y_codigo_final")).toBe(true);
    expect(llaveDependeDeLaRespuesta("pregunta_pucp_qr")).toBe(true);
    expect(llaveDependeDeLaRespuesta("pregunta_pucp_whatsapp")).toBe(true);
    expect(llaveDependeDeLaRespuesta("correo_envio")).toBe(false);
    expect(llaveDependeDeLaRespuesta("llave_configurada")).toBe(false);
    expect(llaveDependeDeLaRespuesta("")).toBe(false);
    expect(llaveDependeDeLaRespuesta(undefined)).toBe(false);
  });
});

describe("llaveBreve", () => {
  it("deja intacta una llave corta", () => {
    expect(llaveBreve("20191234")).toBe("20191234");
  });

  it("conserva el final al recortar, que es donde se distinguen las llaves", () => {
    const breve = llaveBreve("2019123400000000009876", 12);
    expect(breve).toContain("…");
    expect(breve.length).toBe(12);
    expect(breve.endsWith("9876")).toBe(true);
  });
});

describe("resumenDeMotivos", () => {
  it("agrupa por motivo y ordena por frecuencia", () => {
    const resumen = resumenDeMotivos([
      motivoDeNoCruce({ primary_identity_value: "A" }, "complete", "sin_cruce"),
      motivoDeNoCruce({ primary_identity_value: "B" }, "complete", "sin_cruce"),
      motivoDeNoCruce(vacio, "complete", "sin_llave"),
    ]);
    expect(resumen[0].clave).toBe("llave-fuera-de-base");
    expect(resumen[0].total).toBe(2);
    expect(resumen[1].clave).toBe("sin-llave");
    expect(resumen[1].total).toBe(1);
  });

  it("sin casos no devuelve grupos", () => {
    expect(resumenDeMotivos([])).toEqual([]);
  });
});
