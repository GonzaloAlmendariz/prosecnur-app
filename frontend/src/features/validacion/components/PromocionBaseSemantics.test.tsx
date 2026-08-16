import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PromocionBase from "./PromocionBase";
import type { LimpiezaPromocion } from "../types";

const BASE: LimpiezaPromocion = {
  enabled: true,
  source_data_file_id: "DATA_CRUDA",
  effective_data_file_id: "DATA_LIMPIA",
  applied_at: "2026-08-15T15:01:35Z",
  n_casos_antes: 103,
  n_casos_despues: 101,
};

function render(promocion: LimpiezaPromocion | null | undefined) {
  return renderToStaticMarkup(<PromocionBase promocion={promocion} onRevertir={() => {}} />);
}

function texto(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("PromocionBase", () => {
  it("sin linaje no dibuja superficie", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
  });

  it("declara el hecho —el cambio de N— y no el archivo", () => {
    const html = render(BASE);
    expect(html).toContain('data-estado="rige"');
    expect(texto(html)).toContain("La base del estudio quedó depurada");
    // La superficie tiene que contestar sola de dónde salen los casos que
    // faltan: no se perdieron al cargar, los excluyó el analista al cerrar.
    expect(texto(html)).toContain("Tus decisiones de limpieza excluyeron 2 casos");
    expect(texto(html)).toContain("pasó de 103 a 101");
    expect(texto(html)).toContain("Revertir");
  });

  it("cuando la promoción se bloquea, dice que la exclusión no llegó", () => {
    // El caso que no puede quedar mudo: con grupos repetibles el motor no
    // promueve, y el analista creería que su exclusión rigió.
    const html = render({
      ...BASE,
      enabled: false,
      bloqueo: "La base tiene grupos repetibles: excluir casos de la madre exige podar sus filas hijas.",
    });
    const plano = texto(html);
    expect(html).toContain('data-estado="bloqueada"');
    expect(plano).toContain("La depuración no llegó a la base del estudio");
    expect(plano).toContain("grupos repetibles");
    expect(plano).toContain("la base del estudio sigue con 103 casos");
    // No se ofrece revertir lo que nunca rigió.
    expect(plano).not.toContain("Revertir");
  });

  it("tras revertir declara la vuelta atrás y que las decisiones siguen ahí", () => {
    const html = render({ ...BASE, enabled: false, reverted_at: "2026-08-15T16:10:00Z" });
    const plano = texto(html);
    expect(html).toContain('data-estado="revertida"');
    expect(plano).toContain("Volviste a la base anterior");
    expect(plano).toContain("Tus decisiones de limpieza siguen guardadas");
    expect(plano).not.toContain("Revertir");
  });

  it("un conteo ausente no inventa un número", () => {
    const plano = texto(render({ ...BASE, n_casos_despues: null }));
    expect(plano).toContain("pasó de 103 a —");
    // Sin el segundo conteo tampoco se puede afirmar cuántos se excluyeron.
    expect(plano).toContain("excluyeron —");
  });
});

describe("PromocionBase — sin respaldo", () => {
  const SIN_RESPALDO: LimpiezaPromocion = { ...BASE, sin_respaldo: true };

  it("declara que rige pero ya no puede explicarse, y no la da por buena", () => {
    const html = render(SIN_RESPALDO);
    expect(html).toContain('data-estado="sin-respaldo"');
    const t = texto(html);
    expect(t).toContain("ya no hay registro de por qué");
    // Y dice la causa, que es lo que el lector necesita para actuar.
    expect(t).toContain("Al recargar el formulario");
    // El control: el estado normal SÍ la da por buena, éste no.
    expect(texto(render(BASE))).toContain("Codificación, Analítica y los entregables ya usan esta versión");
    expect(t).not.toContain("Codificación, Analítica y los entregables ya usan esta versión");
    // Y sigue diciendo de cuántas a cuántas: el hecho no desaparece por avisar.
    expect(t).toContain("103");
    expect(t).toContain("101");
  });

  it("deja las dos salidas: rehacer el plan o revertir", () => {
    const t = texto(render(SIN_RESPALDO));
    expect(t).toContain("construir el plan");
    expect(t).toContain("revierte");
    expect(render(SIN_RESPALDO)).toContain("Revertir");
  });

  it("una promoción revertida o bloqueada no se disfraza de sin respaldo", () => {
    expect(render({ ...SIN_RESPALDO, enabled: false })).toContain('data-estado="revertida"');
    expect(render({ ...SIN_RESPALDO, bloqueo: "grupos repetibles" })).toContain('data-estado="bloqueada"');
  });

  it("no comparte tono con «bloqueada»: la pestaña ya tiene una banda ámbar rutinaria", () => {
    const sinRespaldo = render(SIN_RESPALDO);
    const bloqueada = render({ ...BASE, bloqueo: "La base tiene grupos repetibles." });
    expect(sinRespaldo).toContain("--pulso-danger-bg");
    expect(bloqueada).toContain("--pulso-warn-bg");
    expect(sinRespaldo).not.toContain("--pulso-warn-bg");
  });
});
