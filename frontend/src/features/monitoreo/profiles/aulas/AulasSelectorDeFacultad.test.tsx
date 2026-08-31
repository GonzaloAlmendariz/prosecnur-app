import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AulasSelectorDeFacultad } from "./AulasSelectorDeFacultad";
import type { FocoDeCuota } from "./AulasCuotasResumen";

/**
 * El selector que manda sobre toda la sección.
 *
 * Subió a la cabecera porque dentro de un panel se movía con el scroll y sólo
 * existía en la pestaña que lo montaba. Al hacerlo, los nombres de las nueve
 * listas dejaron de ser botones: este control es ahora el ÚNICO sitio desde el
 * que se pone el foco, así que lo que aquí falle no tiene otra puerta.
 */

const FACULTADES = ["ARTE Y DISEÑO", "DERECHO", "PSICOLOGÍA"];

function pintar(valor: string, onFoco: (f: FocoDeCuota) => void = () => {}) {
  return renderToStaticMarkup(
    <AulasSelectorDeFacultad facultades={FACULTADES} valor={valor} onFoco={onFoco} />,
  );
}

describe("AulasSelectorDeFacultad", () => {
  it("ofrece «todas» y una opción por facultad", () => {
    const html = pintar("");
    expect(html).toContain("Todas las facultades");
    for (const f of FACULTADES) expect(html).toContain(f);
  });

  it("marca «Todas» sólo cuando no hay facultad en foco", () => {
    expect(pintar("")).toContain("is-activa");
    // Con una elegida, «Todas» deja de estar activa: es el botón que la suelta,
    // y marcarlo siempre haría creer que se están viendo todas.
    expect(pintar("DERECHO")).not.toContain("is-activa");
  });

  it("sin facultades no se pinta", () => {
    // Un selector vacío en la cabecera ocuparía el sitio privilegiado para no
    // ofrecer nada. El caso es real: un estudio recién abierto, sin plan.
    const html = renderToStaticMarkup(
      <AulasSelectorDeFacultad facultades={[]} valor="" onFoco={() => {}} />,
    );
    expect(html).toBe("");
  });

  it("la opción en foco viene seleccionada, no sólo resaltada", () => {
    // Es lo que hace que la dirección de la URL y lo que se ve coincidan: al
    // llegar por enlace con `?foco=facultad:DERECHO`, el desplegable tiene que
    // abrir ya en Derecho.
    expect(pintar("DERECHO")).toMatch(/<select[^>]*>[\s\S]*DERECHO/);
  });
});
