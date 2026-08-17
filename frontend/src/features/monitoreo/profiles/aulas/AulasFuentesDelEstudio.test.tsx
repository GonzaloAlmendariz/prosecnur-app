import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoSource } from "../../../../api/monitoreo";
import { AulasFuentesDelEstudio } from "./AulasFuentesDelEstudio";

/**
 * Fuentes tiene que decir de dónde salen los datos.
 *
 * Lo que había era una tabla campo/valor con la corrida y el marco —que ya son
 * tarjetas de «Operación del plan», justo arriba— y dos celdas en blanco.
 * Mientras tanto, qué formulario se está leyendo sólo aparecía en el `title` de
 * un botón: la sección no entregaba lo que su nombre promete (C5).
 */

function fuente(extra: Partial<MonitoreoSource> = {}): MonitoreoSource {
  return {
    id: "src-kobo-aulas",
    kind: "kobo",
    label: "Aplicación en aulas",
    role: "respuestas",
    enabled: true,
    last_sync_at: "",
    ...extra,
  } as unknown as MonitoreoSource;
}

describe("las fuentes del estudio de aulas", () => {
  it("nombran la fuente, su servicio y su papel", () => {
    const html = renderToStaticMarkup(
      <AulasFuentesDelEstudio fuentes={[fuente()]} anonimas={false} />,
    );
    expect(html).toContain("Aplicación en aulas");
    expect(html).toContain("Kobo");
    expect(html).toContain("Respuestas de campo");
  });

  it("dicen por qué no hay enlace en vez de dejar el hueco", () => {
    // Un renglón vacío parecería una fila incompleta sin decir de quién es la
    // falta; el motivo es accionable: falta elegir el formulario.
    const html = renderToStaticMarkup(
      <AulasFuentesDelEstudio fuentes={[fuente()]} anonimas={false} />,
    );
    expect(html).toContain("formulario de Kobo");
    expect(html).toContain("Sin actualizar");
  });

  it("una fuente apagada sigue declarada", () => {
    // No se esconde: el gate es «verde por conformidad, no por ausencia», y una
    // fuente que alguien apagó explica por qué falta un pedazo del dato.
    const html = renderToStaticMarkup(
      <AulasFuentesDelEstudio fuentes={[fuente({ enabled: false })]} anonimas={false} />,
    );
    expect(html).toContain("apagada");
    expect(html).toContain("Aplicación en aulas");
  });

  it("la regla de atribución sólo aparece si las respuestas son anónimas", () => {
    const conRegla = renderToStaticMarkup(
      <AulasFuentesDelEstudio fuentes={[fuente()]} anonimas />,
    );
    expect(conRegla).toContain("por curso-horario, origen y enlace");

    const sinRegla = renderToStaticMarkup(
      <AulasFuentesDelEstudio fuentes={[fuente()]} anonimas={false} />,
    );
    expect(sinRegla).not.toContain("por curso-horario, origen y enlace");
  });

  it("sin fuentes dice qué falta conectar", () => {
    const html = renderToStaticMarkup(<AulasFuentesDelEstudio fuentes={[]} anonimas />);
    expect(html).toContain("todavía no tiene fuentes conectadas");
  });
});
