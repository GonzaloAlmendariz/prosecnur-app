import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PlugZap, Users } from "../vendor/lucide-react";
import {
  TabHeading,
  densidadPorAncho,
  detalleUtil,
  repartirChips,
  textoEyebrow,
  type TabHeadingChip,
} from "./TabHeading";

// Sin jsdom en este repo: se renderiza con `renderToStaticMarkup`. En el
// servidor el ResizeObserver no corre y la densidad es `normal`.

const CHIPS: TabHeadingChip[] = [
  { id: "fuentes", label: "fuentes", valor: 2 },
  { id: "recibidas", label: "recibidas", valor: "1,693", rank: 3 },
  { id: "validas", label: "válidas", valor: "1,283", base: "1,693", tono: "ok", rank: 1 },
  { id: "meta", label: "meta", valor: "1,200" },
  { id: "extra", label: "reemplazos", valor: 14, rank: 3 },
];

describe("TabHeading — render", () => {
  test("el h2 es el nombre de la pestaña y el estado va como palabra fuera del h2", () => {
    const html = renderToStaticMarkup(
      <TabHeading eyebrow="Avance territorial" titulo="Resumen" icono={PlugZap} estado="parcial" />,
    );
    expect(html).toMatch(/<h2>Resumen<\/h2>/);
    expect(html).toContain('class="pulso-tab-heading-estado" data-estado="parcial">Parcial</span>');
    expect(html).not.toMatch(/<h2>[^<]*Parcial/);
    expect(html).toContain('data-qa-geometry-group="tab-heading"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html).toContain('data-variante="estandar"');
  });

  test.each([
    ["listo", "Listo"],
    ["parcial", "Parcial"],
    ["bloqueado", "Bloqueado"],
  ] as const)("estado %s se dice «%s»", (estado, palabra) => {
    const html = renderToStaticMarkup(
      <TabHeading eyebrow="Carga" titulo="Fuentes" icono={PlugZap} estado={estado} />,
    );
    expect(html).toContain(`>${palabra}</span>`);
  });

  test("sin estado no pinta pastilla de estado", () => {
    const html = renderToStaticMarkup(<TabHeading eyebrow="Carga" titulo="Fuentes" icono={PlugZap} />);
    expect(html).not.toContain("pulso-tab-heading-estado");
  });

  test("el detalle se pinta y se omite si repite el título", () => {
    const con = renderToStaticMarkup(
      <TabHeading eyebrow="Carga" titulo="Fuentes" icono={PlugZap} detalle="Formulario y respuestas de cada base" />,
    );
    expect(con).toContain(">Formulario y respuestas de cada base</p>");
    const repetido = renderToStaticMarkup(
      <TabHeading eyebrow="Fuentes" titulo="Universo y barrido" icono={PlugZap} detalle="  universo y  BARRIDO " />,
    );
    expect(repetido).not.toContain("pulso-tab-heading-detalle");
  });

  test("«pestaña n de m» solo con ambos props", () => {
    const ambos = renderToStaticMarkup(
      <TabHeading eyebrow="Carga" titulo="Fuentes" icono={PlugZap} pestanaN={2} pestanaDe={5} />,
    );
    expect(ambos).toContain("Carga · pestaña 2 de 5");
    const soloN = renderToStaticMarkup(<TabHeading eyebrow="Carga" titulo="Fuentes" icono={PlugZap} pestanaN={2} />);
    expect(soloN).not.toContain("pestaña");
    const soloDe = renderToStaticMarkup(<TabHeading eyebrow="Carga" titulo="Fuentes" icono={PlugZap} pestanaDe={5} />);
    expect(soloDe).not.toContain("pestaña");
  });

  test("variante compacta: sin detalle y eyebrow solo para lectores de pantalla", () => {
    const html = renderToStaticMarkup(
      <TabHeading
        eyebrow="Acreditación"
        titulo="Actores"
        icono={Users}
        estado="parcial"
        detalle="Quién responde por cada actor"
        compacta
      />,
    );
    expect(html).toContain('data-variante="compacta"');
    expect(html).not.toContain("pulso-tab-heading-detalle");
    expect(html).not.toContain("Quién responde por cada actor");
    expect(html).toContain('<span class="pulso-sr-only">Acreditación</span>');
    expect(html).toMatch(/<h2>Actores<\/h2>/);
  });

  test("chips con cifra tabular y su base", () => {
    const html = renderToStaticMarkup(
      <TabHeading
        eyebrow="Acreditación"
        titulo="Actores"
        icono={Users}
        chips={[
          { id: "fuentes", label: "fuentes", valor: 13, base: 13, tono: "ok" },
          { id: "actores", label: "actores", valor: 4 },
        ]}
      />,
    );
    expect(html).toContain('role="group" aria-label="Contexto de la pestaña"');
    expect(html).toContain(
      '<b class="pulso-tab-heading-chip-valor">13<span class="pulso-tab-heading-chip-base">/13</span></b>',
    );
    expect(html).toContain('title="13/13 fuentes"');
    expect(html).toContain('data-tono="ok"');
    expect(html).toContain('<b class="pulso-tab-heading-chip-valor">4</b>');
    expect(html).not.toContain("Más datos de la pestaña");
  });

  test("control de sección en su propia zona", () => {
    const html = renderToStaticMarkup(
      <TabHeading
        eyebrow="Cursos-horario · Avance"
        titulo="Rendimiento"
        icono={PlugZap}
        control={<select aria-label="Facultad"><option>Todas las facultades</option></select>}
      />,
    );
    expect(html).toContain('data-con-control="true"');
    expect(html).toMatch(/<div class="pulso-tab-heading-control"><select aria-label="Facultad">/);
  });

  test("densidad tight recoge los chips opcionales a un menú con nombre, nunca el rank 1", () => {
    const html = renderToStaticMarkup(
      <TabHeading eyebrow="Avance" titulo="Resumen" icono={PlugZap} chips={CHIPS} densidad="tight" />,
    );
    expect(html).toContain('data-densidad="tight"');
    expect(html).toContain('title="1,283/1,693 válidas"');
    expect(html).not.toContain('title="2 fuentes"');
    expect(html).toContain('aria-label="Más datos de la pestaña (4)"');
  });
});

describe("TabHeading — lógica pura", () => {
  test("detalleUtil", () => {
    expect(detalleUtil("Fuentes", undefined)).toBeNull();
    expect(detalleUtil("Fuentes", "   ")).toBeNull();
    expect(detalleUtil("Fuentes", "fuentes")).toBeNull();
    expect(detalleUtil("Fuentes", "Cada base")).toBe("Cada base");
  });

  test("textoEyebrow rechaza numeraciones incoherentes", () => {
    expect(textoEyebrow("Carga", 2, 5)).toBe("Carga · pestaña 2 de 5");
    expect(textoEyebrow("Carga", 6, 5)).toBe("Carga");
    expect(textoEyebrow("Carga", 0, 5)).toBe("Carga");
    expect(textoEyebrow("", 1, 3)).toBe("Pestaña 1 de 3");
  });

  test("repartirChips: rank decide quién sobrevive, el orden de lectura se conserva", () => {
    const normal = repartirChips(CHIPS, "normal");
    expect(normal.visibles.map((c) => c.id)).toEqual(["fuentes", "recibidas", "validas", "meta"]);
    expect(normal.recogidos.map((c) => c.id)).toEqual(["extra"]);

    const compact = repartirChips(CHIPS, "compact");
    expect(compact.visibles.map((c) => c.id)).toEqual(["fuentes", "validas"]);
    expect(compact.recogidos.map((c) => c.id)).toEqual(["meta", "recibidas", "extra"]);

    const tight = repartirChips(CHIPS, "tight");
    expect(tight.visibles.map((c) => c.id)).toEqual(["validas"]);
    expect(tight.recogidos).toHaveLength(4);
    // Nada se pierde: fila + menú = todos.
    expect(tight.visibles.length + tight.recogidos.length).toBe(CHIPS.length);
  });

  test("densidadPorAncho deja sitio al control", () => {
    expect(densidadPorAncho(1200, false)).toBe("normal");
    expect(densidadPorAncho(1000, true)).toBe("compact");
    expect(densidadPorAncho(700, false)).toBe("compact");
    expect(densidadPorAncho(600, false)).toBe("tight");
  });
});
