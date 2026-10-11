import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
import type { PanelDeclarado } from "../lib/navegacion/paneles";
import { panelAbiertoEn, searchSinPanel } from "../lib/navegacion/paneles";
import { Dialog, moduloDeDialogo, type DialogProps } from "./Dialog";
import { Sideover } from "./Sideover";

// El entorno global de Vitest no tiene DOM: aquí se renderiza con
// `renderToStaticMarkup`, donde Dialog dibuja en línea en vez de por portal.
// Lo que depende de eventos reales —Escape, focus trap, foco de vuelta— vive
// en `Dialog.interaccion.test.tsx`, el único archivo con `happy-dom`.

const PANEL_DEMO: PanelDeclarado = {
  id: "demo",
  label: "Demo",
  clase: "dialogo",
  alias: [{ param: "settings", valor: "demo" }],
};

function enRuta(entrada: string, nodo: JSX.Element): string {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[entrada]}>{nodo}</MemoryRouter>);
}

describe("Dialog — semántica", () => {
  test("abierto: role=dialog, aria-modal y nombre/descripcion desde la cabecera", () => {
    const html = renderToStaticMarkup(
      <Dialog open onOpenChange={() => undefined} title="Publicar" subtitle="Sube el proyecto">
        <p>cuerpo</p>
      </Dialog>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const labelledby = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    const describedby = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(labelledby).toBeTruthy();
    expect(describedby).toBeTruthy();
    expect(html).toContain(`id="${labelledby}"`);
    expect(html).toMatch(new RegExp(`<h2[^>]*id="${labelledby}"[^>]*>Publicar</h2>`));
    expect(html).toMatch(new RegExp(`<p[^>]*id="${describedby}"[^>]*>Sube el proyecto</p>`));
  });

  test("sin subtítulo no declara aria-describedby colgante", () => {
    const html = renderToStaticMarkup(
      <Dialog open onOpenChange={() => undefined} title="Solo título">
        <p>cuerpo</p>
      </Dialog>,
    );
    expect(html).not.toContain("aria-describedby");
  });

  test("cerrado no dibuja nada", () => {
    const html = renderToStaticMarkup(
      <Dialog open={false} onOpenChange={() => undefined} title="Oculto">
        <p>cuerpo</p>
      </Dialog>,
    );
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Oculto");
  });

  test("botón cerrar: PulsoButton de ícono con nombre accesible", () => {
    const html = renderToStaticMarkup(
      <Dialog open onOpenChange={() => undefined} title="T">
        <p>cuerpo</p>
      </Dialog>,
    );
    expect(html).toMatch(/<button[^>]*class="[^"]*pulso-button--icon[^"]*"[^>]*aria-label="Cerrar"|<button[^>]*aria-label="Cerrar"[^>]*class="[^"]*pulso-button--icon/);
  });

  test("dismissible=false deshabilita el cierre y quita la ayuda «Esc»", () => {
    const html = renderToStaticMarkup(
      <Dialog
        open
        onOpenChange={() => undefined}
        title="Guardando"
        dismissible={false}
        footer={<button type="button">Guardar</button>}
      >
        <p>cuerpo</p>
      </Dialog>,
    );
    expect(html).toMatch(/<button[^>]*aria-label="Cerrar"[^>]*disabled=""|<button[^>]*disabled=""[^>]*aria-label="Cerrar"/);
    expect(html).not.toContain("pulso-dialog__kbd");
  });

  test("pie: acciones a la derecha y ayuda de teclado por defecto a la izquierda", () => {
    const html = renderToStaticMarkup(
      <Dialog open onOpenChange={() => undefined} title="T" footer={<button type="button">Siguiente</button>}>
        <p>cuerpo</p>
      </Dialog>,
    );
    const hint = html.indexOf("pulso-dialog__hint");
    const acciones = html.indexOf("pulso-dialog__actions");
    expect(hint).toBeGreaterThan(-1);
    expect(acciones).toBeGreaterThan(hint);
    expect(html).toContain('<kbd class="pulso-dialog__kbd">Esc</kbd>');
  });

  test("tamaños sm/md/lg y stepper opcional", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      const html = renderToStaticMarkup(
        <Dialog open onOpenChange={() => undefined} title="T" size={size} stepper={<ol>pasos</ol>}>
          <p>cuerpo</p>
        </Dialog>,
      );
      expect(html).toContain(`pulso-dialog--${size}`);
      expect(html).toContain("pulso-dialog__stepper");
    }
  });
});

describe("Dialog — alto, tono, estado del pie y geometría (C1/C2)", () => {
  type Extra = Partial<Pick<DialogProps, "alto" | "tono" | "icon" | "stepper" | "footerStatus">>;
  const abrir = (extra: Extra = {}) =>
    renderToStaticMarkup(
      <Dialog open onOpenChange={() => undefined} title="T" footer={<button type="button">Ok</button>} {...extra}>
        <p>cuerpo</p>
      </Dialog>,
    );

  test("por defecto el alto es «contenido»: sin clase de alto fijo ni capacidad declarada", () => {
    const html = abrir();
    expect(html).toContain('data-alto="contenido"');
    expect(html).not.toContain("pulso-dialog--alto-fijo");
    expect(html).not.toContain("data-qa-geometry-capacity");
  });

  test("alto=\"fijo\": clase de marco fijo y el cuerpo posee el vacío", () => {
    const html = abrir({ alto: "fijo" });
    expect(html).toContain("pulso-dialog--alto-fijo");
    expect(html).toContain('data-alto="fijo"');
    expect(html).toMatch(/class="pulso-dialog__body[^"]*"[^>]*data-qa-geometry-capacity="owned"/);
  });

  test("alto=\"fijo\" + flush: el cuerpo no se declara dueño del vacío (lo son sus columnas)", () => {
    const html = renderToStaticMarkup(
      <Dialog open onOpenChange={() => undefined} title="T" alto="fijo" flush>
        <div data-qa-geometry-capacity="owned">columna</div>
      </Dialog>,
    );
    expect(html).toContain("pulso-dialog--alto-fijo");
    expect(html).not.toMatch(/class="pulso-dialog__body[^"]*"[^>]*data-qa-geometry-capacity/);
    expect((html.match(/data-qa-geometry-capacity="owned"/g) ?? []).length).toBe(1);
  });

  test("C1: el marco declara grupo intrinsic y sus secciones como miembros", () => {
    const html = abrir({ stepper: <ol>pasos</ol> });
    expect(html).toContain('data-qa-geometry-group="pulso-dialog"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect((html.match(/data-qa-geometry-member=""/g) ?? []).length).toBe(4);
  });

  test("tono del tile: módulo por defecto, aviso y peligro con su clase", () => {
    expect(abrir({ icon: <svg /> })).toContain('data-tono="modulo"');
    expect(abrir({ icon: <svg />, tono: "aviso" })).toContain("pulso-dialog__tile--aviso");
    expect(abrir({ icon: <svg />, tono: "peligro" })).toContain("pulso-dialog__tile--peligro");
  });

  test("footerStatus convive con la ayuda «Esc cierra» y se anuncia", () => {
    const html = abrir({ footerStatus: <span>3 variables</span> });
    expect(html).toContain('<kbd class="pulso-dialog__kbd">Esc</kbd>');
    expect(html).toMatch(/<span class="pulso-dialog__status" aria-live="polite"><span>3 variables<\/span><\/span>/);
    expect(html.indexOf("pulso-dialog__kbd")).toBeLessThan(html.indexOf("pulso-dialog__status"));
  });
});

describe("Dialog — acento del módulo en el portal", () => {
  test("resuelve el módulo desde la ruta con la gramática canónica", () => {
    expect(moduloDeDialogo("/monitoreo")?.slug).toBe("monitoreo");
    expect(moduloDeDialogo("/tablero")?.slug).toBe("dashboard");
    expect(moduloDeDialogo("/carga")?.slug).toBe("procesamiento");
    expect(moduloDeDialogo("/")).toBeNull();
  });

  test("re-inyecta moduleChromeVars del módulo activo en la raíz", () => {
    const html = enRuta(
      "/monitoreo",
      <Dialog open onOpenChange={() => undefined} title="T">
        <p>cuerpo</p>
      </Dialog>,
    );
    expect(html).toContain('data-module="monitoreo"');
    expect(html).toContain("--module-accent:var(--pulso-module-monitoring)");
  });

  test("`module={null}` deja el acento global", () => {
    const html = enRuta(
      "/monitoreo",
      <Dialog open onOpenChange={() => undefined} title="T" module={null}>
        <p>cuerpo</p>
      </Dialog>,
    );
    expect(html).not.toContain("data-module=");
    expect(html).not.toContain("--module-accent");
  });
});

describe("Dialog — apertura por ?panel=", () => {
  const dialogo = (
    <Dialog panel={PANEL_DEMO} title="Panel demo">
      <p>cuerpo</p>
    </Dialog>
  );

  test("?panel=<id> lo abre y marca la raíz con data-pulso-panel", () => {
    const html = enRuta("/tablero?panel=demo", dialogo);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('data-pulso-panel="demo"');
    expect(html).toContain("Panel demo");
  });

  test("sin el param queda cerrado", () => {
    expect(enRuta("/tablero", dialogo)).not.toContain('role="dialog"');
    expect(enRuta("/tablero?panel=otro", dialogo)).not.toContain('role="dialog"');
  });

  test("un alias legacy también lo abre", () => {
    expect(enRuta("/tablero?settings=demo", dialogo)).toContain('data-pulso-panel="demo"');
  });

  test("cerrar escribe la dirección sin el panel y conserva el resto", () => {
    // `Dialog` cierra con `usePanelDireccionable().cerrar`, que navega a esta
    // dirección con `replace`.
    const siguiente = searchSinPanel("?seccion=resumen&panel=demo&settings=demo", PANEL_DEMO);
    expect(siguiente).toBe("?seccion=resumen");
    expect(panelAbiertoEn(siguiente, PANEL_DEMO)).toBe(false);
    expect(enRuta(`/tablero${siguiente}`, dialogo)).not.toContain('role="dialog"');
  });

  test("Sideover comparte el modo direccionable", () => {
    const html = enRuta(
      "/tablero?panel=demo",
      <Sideover panel={PANEL_DEMO} title="Lateral">
        <p>cuerpo</p>
      </Sideover>,
    );
    expect(html).toContain("pulso-sideover");
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('data-pulso-panel="demo"');
  });
});
