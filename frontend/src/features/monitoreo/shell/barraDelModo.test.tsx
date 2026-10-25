/**
 * La barra del modo con el control único «Actualizar ▾» (L38) y la píldora del
 * estándar §2a. Sin DOM: se renderiza el marcado y se lee.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HerramientasDelModo, MenuDeActualizar, etiquetaDeEstado, estadoConProgreso, type AccionDeActualizar, type BarraDelModo } from "./BarraDelModo";

const nada = () => {};
const acciones: AccionDeActualizar[] = [
  { clave: "fuente:u", etiqueta: "Universo", detalle: "Google Sheets · universo", grupo: "fuentes", onElegir: nada },
  { clave: "fuente:k", etiqueta: "PDM Kobo", detalle: "Kobo · respuestas", grupo: "fuentes", onElegir: nada },
  { clave: "todo", etiqueta: "Traer todo de nuevo", onElegir: nada },
  { clave: "recalcular", etiqueta: "Recalcular", detalle: "Hay cambios sin recalcular", onElegir: nada },
];
const barra = (estado: BarraDelModo["estado"]): BarraDelModo => ({
  indicadores: [],
  corte: "25/10/26 09:04",
  estado,
  actualizar: { etiqueta: "Actualizar", onElegir: nada },
  otrasActualizaciones: acciones,
});

describe("la píldora usa los cuatro estados del estándar", () => {
  it("Al día, Actualizando paso N de M, Falló y Preparando", () => {
    expect(etiquetaDeEstado({ clave: "al-dia" })).toBe("Al día");
    expect(etiquetaDeEstado({ clave: "actualizando", paso: 2, pasos: 4 })).toBe("Actualizando, paso 2 de 4");
    expect(etiquetaDeEstado({ clave: "actualizando" })).toBe("Actualizando");
    expect(etiquetaDeEstado({ clave: "fallo" })).toBe("Falló");
    expect(etiquetaDeEstado({ clave: "preparando" })).toBe("Preparando");
  });

  it("el paso que publica el job llega a la píldora", () => {
    const html = renderToStaticMarkup(
      <HerramientasDelModo barra={barra({ clave: "actualizando" })} ocupado progreso={{ paso: 3, pasos: 4 }} />,
    );
    expect(html).toContain("Actualizando, paso 3 de 4");
    expect(estadoConProgreso({ clave: "al-dia" }, { paso: 1, pasos: 2 })).toEqual({ clave: "al-dia" });
  });

  it("no repite la fecha del corte en la píldora", () => {
    const html = renderToStaticMarkup(<HerramientasDelModo barra={barra({ clave: "al-dia" })} ocupado={false} />);
    expect(html).toMatch(/role="status"[^>]*>Al día</);
  });
});

describe("un sync a la vez", () => {
  it("mientras corre, el cuerpo y el desplegable quedan apagados", () => {
    const html = renderToStaticMarkup(<HerramientasDelModo barra={barra({ clave: "actualizando" })} ocupado />);
    expect(html).toMatch(/class="mon-modo-actualizar-principal" disabled/);
    expect(html).toMatch(/aria-label="Más formas de actualizar"[^>]*disabled/);
  });

  it("y cada entrada del menú también", () => {
    const html = renderToStaticMarkup(<MenuDeActualizar id="m" acciones={acciones} ocupado />);
    expect((html.match(/role="menuitem" disabled/g) ?? []).length).toBe(acciones.length);
  });
});

describe("el menú de Actualizar", () => {
  const html = renderToStaticMarkup(<MenuDeActualizar id="m" acciones={acciones} ocupado={false} />);

  it("pone arriba Traer todo de nuevo y Recalcular, y debajo «Por fuente»", () => {
    expect(html).toContain('role="menu"');
    expect(html).toContain('role="group" aria-labelledby="m-fuentes"');
    expect(html).toContain(">Por fuente<");
    expect(html).toContain('role="separator"');
    // Las dos acciones más usadas van arriba; las fuentes, abajo y con su propio scroll.
    expect(html.indexOf("Traer todo de nuevo")).toBeLessThan(html.indexOf("Recalcular"));
    expect(html.indexOf("Recalcular")).toBeLessThan(html.indexOf('role="separator"'));
    expect(html.indexOf('role="separator"')).toBeLessThan(html.indexOf("Por fuente"));
    expect(html).toMatch(/class="mon-modo-actualizar-fuentes"><button[^>]*role="menuitem"[^>]*><span>Universo/);
  });

  it("cada entrada es un botón real con su detalle", () => {
    expect((html.match(/<button type="button" role="menuitem"/g) ?? []).length).toBe(4);
    expect(html).toContain("<small>Google Sheets · universo</small>");
    expect(html).toContain("<span>Recalcular</span><small>Hay cambios sin recalcular</small>");
    expect(html).not.toContain(">Todo<");
  });
});
