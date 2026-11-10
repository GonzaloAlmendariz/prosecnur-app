// Color propio de la franja de logos (L15): el contrato lo conserva y el editor
// avisa si el color no deja leer los logos en blanco.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeMailTemplate } from "../../../api/materialMail";
import { ColorDeLaFranja, lecturaDeLaFranja } from "./ColorDeLaFranja";

describe("color de la franja", () => {
  it("la cabecera de logos conserva su color propio (hex) y descarta lo que no es color", () => {
    const base = { schema: "collection_mail_template/v2", template_id: "t", revision: 1, subject: "S", preheader: "", fields: [], blocks: [], images: {}, theme: { accent: "#004dac" } };
    const con = normalizeMailTemplate({ ...base, header: { kind: "logos", logo_ids: ["pucp"], background: "dark", color: "#022051" } });
    expect(con.header).toMatchObject({ kind: "logos", color: "#022051" });
    const sin = normalizeMailTemplate({ ...base, header: { kind: "logos", logo_ids: ["pucp"], background: "dark", color: "azul" } });
    expect(sin.header).not.toHaveProperty("color");
  });

  it("un color claro avisa; uno oscuro se lee", () => {
    expect(lecturaDeLaFranja("#022051").tono).toBe("ok");
    expect(lecturaDeLaFranja("#f5d76e").tono).toBe("warning");
  });

  it("sin color propio sigue al acento; con color propio ofrece volver al acento", () => {
    const sigue = renderToStaticMarkup(<ColorDeLaFranja color={undefined} acento="#004dac" onColor={() => {}} />);
    expect(sigue).toContain('value="#004dac"');
    expect(sigue).toContain("Sigue el acento del correo");
    const propio = renderToStaticMarkup(<ColorDeLaFranja color="#022051" acento="#004dac" onColor={() => {}} />);
    expect(propio).toContain('value="#022051"');
    expect(propio).toContain("Usar el acento (#004DAC)");
  });
});
