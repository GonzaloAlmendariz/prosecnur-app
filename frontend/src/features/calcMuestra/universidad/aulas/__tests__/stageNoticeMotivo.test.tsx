import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FileText } from "lucide-react";

import { AulasStageNotice } from "../aulasSurfaceState";

/**
 * F38 · Un remedio apagado dice por qué.
 *
 * Medido en Titulares: el aviso ordenaba «regenera titulares sin relajar la
 * validación» y su botón estaba deshabilitado sin `title`, sin
 * `aria-describedby` y sin texto. La causa real —una comparación aún corriendo,
 * «Método 4 de 4 · 06:54»— no aparecía en ninguna parte de la pantalla, así que
 * el usuario no podía saber si esperar, volver atrás o si la app se había roto.
 */
const notice = {
  kind: "missing-selection" as const,
  icon: FileText,
  eyebrow: "Selección",
  title: "La selección almacenada no es vigente",
  detail: "Regenera titulares sin relajar la validación.",
  actionLabel: "Generar selección",
  localAction: "select" as const,
};

describe("AulasStageNotice — motivo del bloqueo", () => {
  it("publica la causa en pantalla y en el título del control", () => {
    const html = renderToStaticMarkup(
      <AulasStageNotice notice={notice} onAction={vi.fn()} disabled disabledReason="Corre «Comparando métodos»." />,
    );
    expect(html).toContain("cmv2-aulas-stage-blocked");
    expect(html).toContain("Corre «Comparando métodos».");
    expect(html).toMatch(/title="Corre/);
  });

  it("sin bloqueo no inventa un motivo", () => {
    const html = renderToStaticMarkup(
      <AulasStageNotice notice={notice} onAction={vi.fn()} disabledReason="no debería verse" />,
    );
    expect(html).not.toContain("cmv2-aulas-stage-blocked");
    expect(html).not.toContain("no debería verse");
  });
});
