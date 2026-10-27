import { describe, expect, it } from "vitest";

import { normalizeMailTemplate, type MailTemplate } from "../../../api/materialMail";
import { camposNoDeclarados, clavesDeclaradas } from "./camposDeclarados";
import { conConstantes, nuevaConstante, usosDeConstante } from "./modeloConstantes";
import { rotulosDeCampos } from "./rotulosDeCampos";

const base = (extra: Partial<MailTemplate> = {}): MailTemplate => normalizeMailTemplate({
  schema: "collection_mail_template/v2", template_id: "c", revision: 1, subject: "Sorteo de {{premios}}", preheader: "",
  theme: { accent: "#004dac" }, header: { kind: "logos", logo_ids: ["pulso"], background: "dark" }, images: {},
  fields: [{ key: "enlace", tag: "ENLACE", label: "Enlace a la encuesta" }],
  blocks: [{ block_id: "p", type: "paragraph", text: "Toma {{duracion}} y sorteamos {{premios}}." }],
  ...extra,
});

describe("datos fijos de la campaña (L6)", () => {
  it("el normalizador los conserva: sin esto, guardar desde el editor los borraría", () => {
    const t = base({ constants: [{ key: "premios", label: "Premios", value: "una tablet" }] } as Partial<MailTemplate>);
    expect(t.constants).toEqual([{ key: "premios", label: "Premios", value: "una tablet" }]);
    expect(base()).not.toHaveProperty("constants");
  });

  it("sus claves cuentan como declaradas: la vista previa no se retiene", () => {
    const sin = base();
    expect(camposNoDeclarados(sin)).toEqual(["premios", "duracion"]);
    const con = conConstantes(sin, [{ key: "premios", label: "Premios", value: "x" }, { key: "duracion", label: "Duración", value: "10 minutos" }]);
    expect(camposNoDeclarados(con)).toEqual([]);
    expect(clavesDeclaradas(con).has("premios")).toBe(true);
    expect(rotulosDeCampos(con).ayudaDeCampo("premios")).toBe("Premios: igual para toda la campaña");
    expect(rotulosDeCampos(con).ayudaDeCampo("enlace")).toBe("Enlace a la encuesta: cambia con cada persona");
  });

  it("la clave sale del nombre y no repite un campo, otro dato ni una reservada; sin datos la clave no viaja", () => {
    const t = conConstantes(base(), [{ key: "premios", label: "Premios", value: "x" }]);
    expect(nuevaConstante("Premios", t).key).toBe("premios_2");
    expect(nuevaConstante("Enlace", t).key).toBe("enlace_2");
    expect(nuevaConstante("Nombre", t).key).toBe("nombre_2");
    expect(nuevaConstante("Duración", t)).toEqual({ key: "duracion", label: "Duración", value: "" });
    expect(conConstantes(t, [])).not.toHaveProperty("constants");
  });

  it("cuenta los usos en el asunto y en los bloques", () => {
    expect(usosDeConstante(base(), "premios")).toBe(2);
    expect(usosDeConstante(base(), "duracion")).toBe(1);
    expect(usosDeConstante(base(), "promocion")).toBe(0);
  });
});
