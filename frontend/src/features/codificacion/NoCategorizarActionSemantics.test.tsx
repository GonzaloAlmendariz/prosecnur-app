import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NoCategorizarAction from "./NoCategorizarAction";
import type { CodifDecision } from "../../api/codificacion";

// Vara V7. Los tres estados de esta acción viven sólo en el componente —no hay
// módulo puro detrás— así que sin test de render no había nada que los
// distinguiera del vecino.

function render(decision: CodifDecision, motivo?: string) {
  return renderToStaticMarkup(
    <NoCategorizarAction
      parent="NowSalary"
      decision={decision}
      motivo={motivo}
      onRegistrar={() => {}}
      onRevertir={() => {}}
    />,
  );
}

function texto(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("NoCategorizarAction", () => {
  it("ofrece registrar la decisión sobre lo que sigue abierto", () => {
    expect(texto(render("pendiente"))).toContain("No categorizar…");
    expect(texto(render("pendiente_parcial"))).toContain("No categorizar…");
  });

  it("no aparece donde no hay decisión que tomar", () => {
    // El control: una categorizada no necesita esta salida y una sin
    // respuestas ya se cerró sola. Si el botón saliera igual, invitaría a
    // «decidir» sobre algo que no está abierto.
    expect(render("categorizada")).toBe("");
    expect(render("sin_material")).toBe("");
    expect(render("sin_marcar")).toBe("");
    expect(render("requiere_config")).toBe("");
  });

  it("una vez registrada ofrece volver atrás y conserva el motivo", () => {
    const html = render("no_categorizar", "n insuficiente (4 respuestas)");
    expect(texto(html)).toContain("Volver a pendiente");
    expect(texto(html)).not.toContain("No categorizar…");
    // El motivo va en el title: es lo que permite recordar por qué sin
    // tener que ir al chip.
    expect(html).toContain("n insuficiente (4 respuestas)");
  });

  it("la acción se nombra por su variable, para el lector de pantalla", () => {
    expect(render("pendiente")).toContain("NowSalary");
    expect(render("no_categorizar")).toContain("NowSalary");
  });
});
