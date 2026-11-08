// Acabado de Láminas, oleada W2-A (2026-11-08): la ESTRUCTURA de la superficie. Guardas de fuente para que no vuelvan
// los botones hechos a mano (F1/F2), la X en tres dialectos, «Previsualizar» lleno ni el «Ajustar» nativo sin chevron.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));
const leer = (rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const listar = (sub: string, ext: RegExp) => fs.readdirSync(path.join(dir, sub))
  .filter((f) => ext.test(f) && !/\.test\./.test(f))
  .map((f) => path.join(sub, f));

/** Los TSX de la estructura de la superficie (los de W2-A). Las tarjetas (W2-B) quedan fuera a propósito. */
const PROPIOS = [
  "VisorLamina.tsx",
  "BarraLaminas.tsx",
  "InspectorLamina.tsx",
  "PanelAvisos.tsx",
  "AvisosLamina.tsx",
  "EditorAmplio.tsx",
  "LaminasWorkbench.tsx",
  "EstructuraInforme.tsx",
  "TiraMiniaturas.tsx",
  ...listar("guias", /\.tsx$/),
  ...listar("selectores", /\.tsx$/),
];

describe("W2-A: sin botones F1/F2 en la estructura de Láminas", () => {
  it.each(PROPIOS)("%s no usa .pulso-f6-boton, .pulso-f6-icono-boton ni .pulso-f6-texto-boton", (archivo) => {
    const src = sinComentarios(leer(archivo));
    expect(src).not.toMatch(/pulso-f6-(boton|icono-boton|texto-boton)\b/);
    expect(src).not.toMatch(/\bis-primario\b/);
  });
});

/** Todos los TSX de laminas/, en cualquier profundidad (W2-B: las tarjetas también). */
const todo = (sub = ""): string[] => fs.readdirSync(path.join(dir, sub), { withFileTypes: true }).flatMap((e) => {
  const rel = path.join(sub, e.name);
  if (e.isDirectory()) return todo(rel);
  return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [rel] : [];
});

describe("W2-B: sin botones F1/F2 en todo laminas/", () => {
  const archivos = todo();
  it("recorre el árbol entero", () => {
    expect(archivos.length).toBeGreaterThan(150);
    expect(archivos).toContain(path.join("tarjetaGrafico", "IndicePlegables.tsx"));
  });
  it.each(archivos)("%s no usa F1/F2, is-primario ni un botón de ícono con caja", (archivo) => {
    const src = sinComentarios(leer(archivo));
    expect(src).not.toMatch(/pulso-f6-(boton|icono-boton|texto-boton)\b/);
    expect(src).not.toMatch(/\bis-primario\b/);
    expect(src).not.toMatch(/variant="icon"(?![^>]*tone="quiet")[^>]*>/);
    expect(src).not.toMatch(/subpestanas\/Segmentado"/);
  });
  it("las hojas de laminas/ no definen F1/F2 (sólo el bloque heredado de laminasWorkbench.css, para fuera de Láminas)", () => {
    const hojas = (sub = ""): string[] => fs.readdirSync(path.join(dir, sub), { withFileTypes: true }).flatMap((e) => {
      const rel = path.join(sub, e.name);
      return e.isDirectory() ? hojas(rel) : e.name.endsWith(".css") && rel !== "laminasWorkbench.css" ? [rel] : [];
    });
    for (const h of hojas()) expect(sinComentarios(leer(h)), h).not.toMatch(/pulso-f6-(boton|icono-boton|texto-boton)\b/);
  });
});

describe("W2-B: cierre y acabado de las tarjetas", () => {
  it.each(["diferencias/PorQuePopover.tsx", "diferencias/RevisionDiferenciasPanel.tsx", "mazoResumen/EdicionReglaMazo.tsx", "propuestaResumen/PropuestaResumen.tsx"])(
    "%s cierra con CabeceraPanel y no pinta una X de cierre propia", (archivo) => {
      const src = sinComentarios(leer(archivo));
      expect(src).toMatch(/<CabeceraPanel\b/);
      // La X de «no cumple» de una condición es un ícono de estado, no un cierre: se mira la X dentro de un botón.
      expect(src).not.toMatch(/<PulsoButton[^>]*aria-label="Cerrar[^>]*>\s*<X\b/);
      expect(src).not.toMatch(/aria-label=\{?["`]Cerrar[^>]*>\s*<X\b/);
    });
  it("la propuesta cierra con Escape", () => {
    expect(sinComentarios(leer("propuestaResumen/PropuestaResumen.tsx"))).toMatch(/e\.key !== "Escape"[\s\S]{0,80}cerrar\(\)/);
  });
  it("la tarjeta abierta no lleva anillo de 2 px y el antetítulo del grupo no va en el acento", () => {
    const insp = sinComentarios(leer("inspectorLamina.css"));
    const abierta = insp.slice(insp.indexOf(".pulso-f6-ranura.is-abierta {"), insp.indexOf("}", insp.indexOf(".pulso-f6-ranura.is-abierta {")));
    expect(abierta).toContain("var(--module-accent-border)");
    expect(abierta).not.toMatch(/box-shadow/);
    const datos = sinComentarios(leer("datosGrafico.css"));
    const titulo = datos.slice(datos.indexOf(".pulso-f6-grupo-titulo {"), datos.indexOf("}", datos.indexOf(".pulso-f6-grupo-titulo {")));
    expect(titulo).toContain("var(--pulso-text-faint)");
    expect(titulo).not.toContain("--module-accent");
  });
  it("«Usar» de la comparación es secundario", () => {
    const src = sinComentarios(leer("selectores/VistaComparar.tsx"));
    const i = src.indexOf("data-usar-comparada");
    expect(src.slice(src.lastIndexOf("<PulsoButton", i), i)).toContain('variant="secondary"');
  });
});

describe("W2-A: jerarquía de la barra del visor", () => {
  const visor = sinComentarios(leer("VisorLamina.tsx"));
  const barra = visor.slice(visor.indexOf('<header ref={barraRef} className="pulso-f6-visor-barra"'), visor.indexOf("</header>"));

  it("«+ Lámina» es el único primario de la barra", () => {
    expect(barra.match(/variant="primary"/g)).toHaveLength(1);
    expect(barra).toMatch(/variant="primary" className="pulso-f6-visor-insertar"/);
  });

  it("Estructura, Previsualizar y Ajustes son secundarios con aria-pressed", () => {
    for (const nombre of ['aria-label="Estructura"', 'className="pulso-f6-previsualizar"', 'aria-label="Ajustes"']) {
      const i = barra.indexOf(nombre);
      expect(i).toBeGreaterThan(-1);
      const boton = barra.slice(barra.lastIndexOf("<PulsoButton", i), barra.indexOf(">", i));
      expect(boton).toContain('variant="secondary"');
      expect(boton).toContain("aria-pressed=");
    }
  });

  it("‹ › y miniaturas son íconos quietos; «Ajustar» es PulsoSelect, no un select nativo", () => {
    for (const nombre of ["Lámina anterior", "Lámina siguiente", "Miniaturas"]) {
      const i = barra.indexOf(`aria-label="${nombre}"`);
      const boton = barra.slice(barra.lastIndexOf("<PulsoButton", i), i);
      expect(boton).toContain('variant="icon"');
      expect(boton).toContain('tone="quiet"');
    }
    expect(barra).toMatch(/<PulsoSelect[\s\S]*ariaLabel="Zoom de la lámina"/);
    expect(visor).not.toMatch(/<select\b/);
  });

  it("«Previsualizar» ya no se pinta lleno con el acento", () => {
    expect(sinComentarios(leer("visorLamina.css"))).not.toMatch(/pulso-f6-previsualizar\[aria-pressed="true"\]/);
  });
});

describe("W2-A: una sola gramática de cierre", () => {
  it.each(["InspectorLamina.tsx", "PanelAvisos.tsx", "EstructuraInforme.tsx", "EditorAmplio.tsx", "guias/BotonGuias.tsx"])(
    "%s usa CabeceraPanel y no pinta una X propia",
    (archivo) => {
      const src = sinComentarios(leer(archivo));
      expect(src).toMatch(/<CabeceraPanel\b/);
      expect(src).not.toMatch(/<X\b/);
    },
  );

  it("el selector cierra con BotonCerrar dentro de Dialog.Close, alineado a la línea del título", () => {
    const src = sinComentarios(leer("selectores/DialogoSelector.tsx"));
    expect(src).toMatch(/<Dialog\.Close asChild>\s*<BotonCerrar className="pulso-f6-selector-cerrar"/);
    const css = sinComentarios(leer("selectores/selectores.css"));
    expect(css).toMatch(/\.pulso-f6-selector-cabecera > \.pulso-f6-selector-cerrar \{[^}]*margin-top: calc\(var\(--pulso-f6-selector-antetitulo-lh\)/);
  });

  it("«Listo» y la X no conviven en el editor amplio: queda la X", () => {
    const src = sinComentarios(leer("EditorAmplio.tsx"));
    expect(src).not.toMatch(/>Listo</);
    expect(src).toMatch(/onCerrar=\{cerrar\}/);
  });

  it("«Cambiar lámina» se distingue del «Cambiar» del gráfico", () => {
    expect(leer("InspectorLamina.tsx")).toMatch(/>\s*Cambiar lámina\s*</);
  });
});

describe("W2-A: acabado común de controles", () => {
  const css = sinComentarios(leer("laminasWorkbench.css"));

  it("un solo lenguaje de pulsado: tinte del acento con su borde", () => {
    const i = css.indexOf('.pulso-button.pulso-button--secondary:is([aria-pressed="true"]');
    expect(i).toBeGreaterThan(-1);
    const cuerpo = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
    expect(cuerpo).toContain("var(--module-accent-border)");
    expect(cuerpo).toContain("var(--module-accent-soft)");
  });

  it("deshabilitado honesto: surface-3, text-faint y borde, sin opacidad", () => {
    const i = css.indexOf(":is(:disabled, [aria-disabled=\"true\"])");
    expect(i).toBeGreaterThan(-1);
    const cuerpo = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
    expect(cuerpo).toContain("opacity: 1");
    expect(cuerpo).toContain("var(--pulso-surface-3)");
    expect(cuerpo).toContain("var(--pulso-text-faint)");
    expect(cuerpo).toContain("var(--pulso-border)");
  });

  it("un solo anillo de foco y sin halo", () => {
    const i = css.indexOf(".pulso-button--link):focus-visible");
    const cuerpo = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
    expect(cuerpo).toContain("outline: var(--mov-foco)");
    expect(cuerpo).toContain("box-shadow: none");
  });
});

/** R9-1: los árboles de graficos/ que se abren desde Láminas (editor amplio de multiapiladas, índice, barra extra, …). */
const ALCANZADOS = [
  "../MultiApiladasBuilder.tsx",
  "../BarraExtraControl.tsx",
  "../BarraExtraBloque.tsx",
  ...todo("../multiapiladas"),
  ...todo("../indice"),
  ...todo("../temasEquivalentes"),
  ...todo("../armarDesde"),
  ...todo("../subpestanas"),
];

describe("R9-1: sin F1/F2 en lo que Láminas abre fuera de laminas/", () => {
  it("recorre multiapiladas/, indice/ y los demás", () => {
    expect(ALCANZADOS).toContain(path.join("../multiapiladas", "TemasPorPublico.tsx"));
    expect(ALCANZADOS).toContain(path.join("../indice", "EditorIndice.tsx"));
  });
  it.each(ALCANZADOS)("%s no usa F1/F2, is-primario, .pulso-icon ni un botón de ícono con caja", (archivo) => {
    const src = sinComentarios(leer(archivo));
    expect(src).not.toMatch(/pulso-f6-(boton|icono-boton|texto-boton)\b/);
    expect(src).not.toMatch(/\bis-primario\b/);
    expect(src).not.toMatch(/className="pulso-icon\b/);
    expect(src).not.toMatch(/variant="icon"(?![^>]*tone="quiet")[^>]*>/);
    expect(src).not.toMatch(/subpestanas\/Segmentado"/);
    expect(src).not.toMatch(/ButtonStyle\b/);
  });
  it("multiapiladas.css no trae su segmentado propio ni deshabilita con opacidad", () => {
    const css = sinComentarios(leer("../multiapiladas/multiapiladas.css"));
    expect(css).not.toMatch(/pulso-mapi-segmento/);
    expect(css).not.toMatch(/opacity:\s*\.\d/);
    expect(css).not.toMatch(/border-radius:\s*(6|7|10|12)px/);
  });
  it("«Qué compara» y el tipo de bloque son RadioSegmentado; cada pregunta elegida dice su público", () => {
    expect(sinComentarios(leer("../multiapiladas/QueCompara.tsx"))).toMatch(/<RadioSegmentado\b[\s\S]*ancho/);
    const builder = sinComentarios(leer("../MultiApiladasBuilder.tsx"));
    expect(builder).toMatch(/<RadioSegmentado<Intent>/);
    expect(builder).toMatch(/className="pulso-mapi-fila-publico"/);
  });
});

describe("R9-5: los títulos de las cabeceras no se recortan por sus acciones", () => {
  it("Estructura lleva la cuenta de subtítulo y «Cerrar todo» en la fila de la búsqueda", () => {
    const src = sinComentarios(leer("EstructuraInforme.tsx"));
    const cabecera = src.slice(src.indexOf("<CabeceraPanel"), src.indexOf("/>", src.indexOf("<CabeceraPanel")));
    expect(cabecera).toContain("subtitulo=");
    expect(cabecera).not.toContain("acciones=");
    const busca = src.slice(src.indexOf('className="pulso-f6-estructura-busca"'), src.indexOf("{acciones}"));
    expect(busca).toMatch(/Cerrar todo/);
  });
  it("Avisos deja «Siguiente sin título» en un ícono con nombre", () => {
    const src = sinComentarios(leer("PanelAvisos.tsx"));
    expect(src).toMatch(/variant="icon" tone="quiet" className="pulso-f6-avisos-sin-titulo" aria-label="Siguiente lámina sin título"/);
  });
});

describe("R9-7: «Armar desde un plan sugerido» en el dialecto del kit", () => {
  const src = sinComentarios(leer("../SuggestedPlanButton.tsx"));
  const popover = src.slice(src.indexOf('className="pulso-gv2-suggest-popover"'));
  it("cabecera del kit con la X; sin «Cancelar» al pie", () => {
    expect(popover).toMatch(/<CabeceraPanel\b[\s\S]*onCerrar=\{cerrarDevolviendoFoco\}/);
    expect(popover).not.toMatch(/>\s*Cancelar\s*</);
    expect(popover).not.toMatch(/<X\b/);
  });
  it("los tres segmentados son RadioSegmentado y las acciones PulsoButton con un solo primario", () => {
    expect(popover.match(/<RadioSegmentado\b/g)).toHaveLength(3);
    expect(popover).not.toMatch(/role="radiogroup"/);
    expect(popover.match(/variant="primary"/g)).toHaveLength(1);
    expect(popover).not.toMatch(/<button\b/);
  });
});

describe("R9-8: la maqueta no muestra un título generado como real", () => {
  it("sin título escrito pinta el marcador «Título» atenuado, nunca el enunciado", () => {
    const src = sinComentarios(leer("MaquetaLamina.tsx"));
    expect(src).toMatch(/const tituloVisible = tituloDeLamina\(slide\.payload\) \|\| <span className="is-vacio">Título<\/span>;/);
    expect(src).not.toMatch(/\btituloQueSale\(/);
  });
  it("el recorte a dos renglones no deja asomar el tercero por el relleno", () => {
    const css = sinComentarios(leer("maquetaLamina.css"));
    expect(css).toMatch(/\.pulso-f6-maqueta-zona\.pulso-f6-maqueta-titulo \{\s*padding-block: 0;/);
  });
});

describe("R9-10: el mazo del resumen, en lo que se resuelve dentro de Láminas", () => {
  it("el deshabilitado honesto y el anillo único alcanzan al mazo (portal fuera del host)", () => {
    const css = sinComentarios(leer("laminasWorkbench.css"));
    const i = css.indexOf(':is(:disabled, [aria-disabled="true"])');
    expect(css.slice(css.lastIndexOf("\n", i), i)).toContain(".pulso-f6-mazo");
  });
  it("sin «Cancelar» junto a la X; el asa mide 28 con el radio de control", () => {
    expect(sinComentarios(leer("mazoResumen/MazoResumen.tsx"))).not.toMatch(/>Cancelar</);
    const css = sinComentarios(leer("mazoResumen/mazoResumen.css"));
    const asa = css.slice(css.indexOf(".pulso-f6-mazo-asa {"), css.indexOf("}", css.indexOf(".pulso-f6-mazo-asa {")));
    expect(asa).toContain("height: var(--pulso-control-height-sm)");
    expect(asa).toContain("border-radius: var(--pulso-control-radius)");
    expect(css).not.toMatch(/border-radius:\s*5px/);
  });
});

describe("R9-13: el antetítulo «Lámina de resumen» no va en el acento", () => {
  it.each(["selectores/selectores.css", "inspectorLamina.css"])("%s no pinta la clase «resumen» con --module-accent", (hoja) => {
    const css = sinComentarios(leer(hoja));
    expect(css).not.toMatch(/\[data-clase-tarjeta="resumen"\][^{]*\{[^}]*--module-accent/);
  });
});

describe("R9-14: el vacío del informe tiene un solo primario", () => {
  it("«Armar desde un plan sugerido» es el primario; insertar y el resumen son secundarios", () => {
    const src = sinComentarios(leer("LaminasWorkbench.tsx"));
    const acciones = src.slice(src.indexOf('<div className="pulso-f6-vacio-acciones">'), src.indexOf("</div>", src.indexOf('<div className="pulso-f6-vacio-acciones">')));
    expect(acciones).toContain("<BotonArmarDesdeVacio />");
    expect(acciones).not.toMatch(/variant="primary"/);
  });
});

describe("R9-15: el cuerpo del inspector vuelve arriba al cambiar de lámina", () => {
  it("un efecto sobre slide.id lleva el scroll a 0", () => {
    const src = sinComentarios(leer("InspectorLamina.tsx"));
    expect(src).toMatch(/useLayoutEffect\(\(\) => \{\s*if \(cuerpoRef\.current\) cuerpoRef\.current\.scrollTop = 0;\s*\}, \[slide\.id\]\);/);
    expect(src).toMatch(/ref=\{cuerpoRef\}\s*className="pulso-f6-inspector-cuerpo"/);
  });
});

describe("R9-16: una acción, una vez", () => {
  it("«Cambiar de lámina…» sale de Composición; queda «Cambiar lámina» en la cabecera", () => {
    expect(sinComentarios(leer("SeccionComposicion.tsx"))).not.toMatch(/Cambiar de lámina/);
    expect(leer("InspectorLamina.tsx")).toMatch(/>\s*Cambiar lámina\s*</);
  });
  it("con el enlace «Lámina N» el aviso no repite su rótulo", () => {
    const src = sinComentarios(leer("PanelAvisos.tsx"));
    expect(src).toMatch(/posicionDe\.has\(i\.slideId\) \? avisoDentroDeLamina\(i\.message\) : i\.message/);
    expect(src).toMatch(/avisoDentroDeLamina\(avisoConLaminaActual\(a, posicionDe\.get\(m\.slideId\)\)\)/);
  });
  it("la falta de «Dividir por» con regla se dice una vez (en la regla)", () => {
    expect(sinComentarios(leer("brecha/BrechaEntreGrupos.tsx"))).toMatch(/faltaEnTarjeta === FALTA_CRUCE && conReglaDePreguntas \? null : faltaEnTarjeta/);
  });
});

describe("R9-18: el segmentado del selector lleva el radio único de control", () => {
  it("controlModo.css: radio 8, riel surface-3, pulgar con filete text-faint y sin sombra", () => {
    const css = sinComentarios(leer("selectores/controlModo.css"));
    const raiz = css.slice(css.indexOf(".pulso-f6-modo.pulso-gliding-tab-list {"), css.indexOf("}", css.indexOf(".pulso-f6-modo.pulso-gliding-tab-list {")));
    expect(raiz).toContain("border-radius: var(--pulso-control-radius)");
    expect(raiz).toContain("background: var(--pulso-surface-3)");
    expect(raiz).toContain("--pulso-gliding-indicator-border: var(--pulso-text-faint)");
    expect(raiz).toContain("--pulso-gliding-indicator-shadow: none");
    expect(css).not.toContain("var(--pulso-radius-card)");
  });
});
