// El pie con dirección escrita (Acreditación 2026): en Mailchimp no va la dirección de la lista.
import { describe, expect, it } from "vitest";

import { comoSaleEnLaPlataforma } from "./comoSaleEnLaPlataforma";

const TPL = { fields: [], images: {} } as never;

describe("cómo sale el pie en Mailchimp", () => {
  it("sin dirección escrita lleva la de la lista y la baja", () => {
    const r = comoSaleEnLaPlataforma({ block_id: "pie", type: "footer_legal" }, TPL, "mailchimp");
    expect(r.lineas.find((l) => l.rotulo === "Baja y dirección")?.plataforma).toContain("*|LIST:ADDRESSLINE|*");
  });
  it("con dirección escrita sólo agrega la baja y lo dice", () => {
    const r = comoSaleEnLaPlataforma({ block_id: "pie", type: "footer_legal", address: "Av. Universitaria 1801, Lima, Perú" }, TPL, "mailchimp");
    const baja = r.lineas.find((l) => l.rotulo === "Baja");
    expect(baja?.plataforma).not.toContain("ADDRESSLINE");
    expect(baja?.plataforma).toContain("*|UNSUB|*");
    expect(r.notas.join(" ")).toContain("dirección escrita en el pie");
  });
});
