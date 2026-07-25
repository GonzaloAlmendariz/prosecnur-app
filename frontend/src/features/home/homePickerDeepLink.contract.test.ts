import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  panelAbiertoEn,
  searchConPanel,
  searchSinPanel,
} from "../../lib/navegacion/paneles";
import { PANEL_CONFIGURACION, PANEL_MODULOS } from "./panelesHome";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

// El selector de módulos es un overlay global (ModulePickerHost, montado en el
// Layout) y desde la gramática canónica es un PANEL: el quinto nivel de
// `modulo/modo/seccion/pestana/panel`. Se alcanza con `?panel=modulos` sobre la
// ruta ACTUAL — abrirlo desde dentro de un módulo y cerrarlo debe preservar el
// pathname, no devolver al home.
describe("selector de módulos como panel direccionable", () => {
  it("se abre con la dirección canónica", () => {
    expect(panelAbiertoEn("?panel=modulos", PANEL_MODULOS)).toBe(true);
    expect(panelAbiertoEn("?panel=configuracion", PANEL_MODULOS)).toBe(false);
    expect(panelAbiertoEn("", PANEL_MODULOS)).toBe(false);
  });

  it("sigue entendiendo el `?agregar=1` de los enlaces guardados", () => {
    expect(panelAbiertoEn("?agregar=1", PANEL_MODULOS)).toBe(true);
    expect(panelAbiertoEn("?agregar=0", PANEL_MODULOS)).toBe(false);
  });

  it("al abrir escribe la forma canónica y descarta el alias", () => {
    expect(searchConPanel("?agregar=1", PANEL_MODULOS)).toBe("?panel=modulos");
  });

  it("preserva el resto del estado de la vista al abrir y cerrar", () => {
    const conPanel = searchConPanel(
      "?seccion=avance&pestana=ump",
      PANEL_MODULOS,
    );
    expect(conPanel).toBe("?seccion=avance&pestana=ump&panel=modulos");
    expect(searchSinPanel(conPanel, PANEL_MODULOS)).toBe(
      "?seccion=avance&pestana=ump",
    );
  });

  it("cerrar limpia también el alias legacy, sin dejar la URL a medias", () => {
    expect(searchSinPanel("?agregar=1&panel=modulos", PANEL_MODULOS)).toBe("");
  });

  it("configuración acepta cualquier valor de su alias `?settings=`", () => {
    expect(panelAbiertoEn("?settings=connections", PANEL_CONFIGURACION)).toBe(true);
    expect(panelAbiertoEn("?settings=configuracion", PANEL_CONFIGURACION)).toBe(true);
    expect(panelAbiertoEn("?settings=", PANEL_CONFIGURACION)).toBe(false);
  });

  it("el host delega en el hook y no reimplementa el manejo de params", () => {
    const host = fs.readFileSync(
      path.join(featureDir, "ModulePickerHost.tsx"),
      "utf8",
    );

    expect(host).toMatch(/usePanelDireccionable\(PANEL_MODULOS\)/);
    expect(host).toMatch(/createPortal\(/);
    // Si alguien vuelve a leer los params a mano aquí, la dirección canónica y
    // el overlay pueden divergir otra vez.
    expect(host).not.toMatch(/URLSearchParams/);
    expect(host).not.toMatch(/pathname: "\/"/);
  });

  it("HomePage no vuelve a hospedar el overlay", () => {
    const page = fs.readFileSync(path.join(featureDir, "HomePage.tsx"), "utf8");

    expect(page).not.toContain("ModulePickerDialog");
    expect(page).not.toMatch(/pickerOpen/);
  });
});
