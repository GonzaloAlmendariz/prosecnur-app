import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { CargaFuentesEmparejamiento, EmparejamientoFila, EmparejamientoFuente } from "../../api/cargaFuentes";
import { FuentesEmparejamientoVista, type EmparejamientoCarga } from "./FuentesEmparejamientoVista";
import type { EmparejamientoFiltro } from "./fuentesEmparejamientoModel";

// Fixture local del contrato `GET /api/carga/fuentes/emparejamiento` (ítem 15).
function fila(parcial: Partial<EmparejamientoFila>): EmparejamientoFila {
  return { seccion: "Perfil", enunciado: "", etiqueta: "Pregunta", variable_base: "p1", variable_fuente: "p1", estado: "emparejada", ...parcial };
}

function fuente(parcial: Partial<EmparejamientoFuente>): EmparejamientoFuente {
  return {
    survey_id: "tel",
    titulo: "Egresados Telefónico",
    estado: "incorporada",
    n_emparejadas: 3,
    n_preguntas_base: 4,
    n_filas_incorporadas: 52,
    n_filas_excluidas: 0,
    detalle_disponible: true,
    filas: [],
    ...parcial,
  };
}

const MIXTA = fuente({
  filas: [
    fila({ etiqueta: "¿Cuál es su género?", variable_base: "p5", variable_fuente: "p5" }),
    fila({ etiqueta: "¿Cuántos años tiene?", variable_base: "p4", variable_fuente: "p3", estado: "otro_nombre" }),
    fila({ seccion: "Servicios", etiqueta: "¿Ha utilizado el servicio de salud?", variable_base: "p14_1", variable_fuente: "", estado: "sin_respuesta" }),
    fila({ seccion: "Servicios", etiqueta: "Servicio de salud", variable_base: "p15_1", variable_fuente: "", estado: "ambigua" }),
    fila({ seccion: "Solo en la fuente", etiqueta: "Indique su código PUCP", variable_base: "", variable_fuente: "p2", estado: "no_entro" }),
  ],
});

function datos(
  fuentes: EmparejamientoFuente[],
  equivalencias: CargaFuentesEmparejamiento["equivalencias"] = { disponible: false, motivo: "Equivalencias aparece cuando el estudio tiene dos o más bases separadas." },
): EmparejamientoCarga {
  return { tipo: "listo", datos: { base_nombre: "egresados", equivalencias, fuentes } };
}

function render(carga: EmparejamientoCarga, foco: string | null = "tel", filtro: EmparejamientoFiltro | null = null) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <FuentesEmparejamientoVista
        carga={carga}
        foco={foco}
        filtro={filtro}
        onFiltro={() => undefined}
        onElegirFuente={() => undefined}
        onCerrar={() => undefined}
        hrefEquivalencias="/procesamiento?seccion=carga&pestana=equivalencias"
      />
    </MemoryRouter>,
  );
}

function filasDeTabla(html: string): number {
  return (html.match(/<th scope="row"/g) ?? []).length;
}

describe("FuentesEmparejamientoVista", () => {
  it("fuente mixta: título, regla, cifras, insignias con texto y solo diferencias por defecto", () => {
    const html = render(datos([MIXTA]));
    expect(html).toContain("Cómo se emparejaron las preguntas de Egresados Telefónico");
    expect(html).toContain("Cada pregunta se empareja con la de la base por su texto y su escala, la misma regla que usa Equivalencias.");
    // Las cinco cifras, siempre, en su grupo de geometría igual.
    expect(html).toContain('data-qa-geometry-group="emparejamiento-cifras"');
    for (const rotulo of ["Emparejadas", "Con otro nombre", "No entraron", "Sin respuesta en esta fuente", "Ambiguas"]) {
      expect(html).toContain(rotulo);
    }
    expect(html).toContain("3 de 4 preguntas de la base tienen par en esta fuente.");
    // Por defecto «Solo diferencias»: la emparejada no se lista.
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>Solo diferencias/);
    expect(filasDeTabla(html)).toBe(4);
    expect(html).not.toContain(">¿Cuál es su género?<");
    // El nombre distinto se resalta y el estado lleva texto.
    expect(html).toContain('<code class="pulso-emparejamiento-var is-distinto">p3</code>');
    expect(html).toContain(">Ambigua<");
    expect(html).toContain(">No entró<");
    // Cabeceras semánticas, con la columna nombrada por la fuente.
    expect(html).toContain('<th scope="col">Pregunta</th>');
    expect(html).toContain("En Egresados Telefónico");
    expect(html).toContain('scope="colgroup"');
    // «Solo en la fuente» va al final.
    expect(html.indexOf("Solo en la fuente")).toBeGreaterThan(html.indexOf("Servicios"));
    // Texto completo con title.
    expect(html).toContain('title="Indique su código PUCP"');
  });

  it("«Todas» lista también las emparejadas", () => {
    const html = render(datos([MIXTA]), "tel", "todas");
    expect(filasDeTabla(html)).toBe(5);
    expect(html).toContain("¿Cuál es su género?");
  });

  it("sin diferencias, el filtro arranca en «Todas»; si se pide diferencias, el vacío vive en la tabla", () => {
    const limpia = fuente({ filas: [fila({}), fila({ variable_base: "p2", variable_fuente: "p2" })] });
    const porDefecto = render(datos([limpia]));
    expect(porDefecto).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>Todas/);
    expect(filasDeTabla(porDefecto)).toBe(2);
    const vacia = render(datos([limpia]), "tel", "diferencias");
    expect(filasDeTabla(vacia)).toBe(0);
    expect(vacia).toContain("Todas las preguntas se emparejaron con el mismo nombre.");
  });

  it("fuente excluida: el encabezado lo dice primero, con cuántas respuestas quedaron fuera", () => {
    const html = render(datos([fuente({ estado: "excluida", n_filas_excluidas: 37, n_emparejadas: 12, n_preguntas_base: 80, filas: MIXTA.filas })]));
    const aviso = "Esta fuente no entró a la base: 37 respuestas quedaron fuera porque solo coinciden 12 de 80 preguntas.";
    expect(html).toContain(aviso);
    expect(html.indexOf(aviso)).toBeLessThan(html.indexOf("Cada pregunta se empareja"));
  });

  it("sin detalle: pide volver a traer las respuestas y no inventa cifras", () => {
    const html = render(datos([fuente({ detalle_disponible: false, filas: [] })]));
    expect(html).toContain("Vuelve a traer las respuestas para ver el detalle de esta fuente.");
    expect(html).not.toContain("emparejamiento-cifras");
    expect(html).not.toContain("<table");
  });

  it("con Equivalencias disponible enlaza a la pestaña; sin ella dice por qué", () => {
    const con = render(datos([MIXTA], { disponible: true, motivo: "" }));
    expect(con).toContain("¿Y Equivalencias?");
    expect(con).toContain("Las fuentes son canales de un mismo público");
    expect(con).toContain("Equivalencias relaciona públicos distintos");
    expect(con).toContain('href="/procesamiento?seccion=carga&amp;pestana=equivalencias"');
    expect(con).toContain("Ir a Equivalencias");

    const sin = render(datos([MIXTA]));
    expect(sin).not.toContain("Ir a Equivalencias");
    expect(sin).toContain("Equivalencias aparece cuando el estudio tiene dos o más bases separadas.");
  });

  it("cargando, error, base sin fuentes y foco ajeno quedan dentro del marco", () => {
    const cargando = render({ tipo: "cargando" });
    expect(cargando).toContain("Leyendo cómo se emparejaron las preguntas");
    expect(cargando).toContain("pulso-emparejamiento-cuerpo");

    const error = render({ tipo: "error", mensaje: "Sin conexión [E_INTERNAL]" });
    expect(error).toContain("No se pudo leer el emparejamiento de las preguntas");
    expect(error).toContain('role="alert"');

    expect(render(datos([]))).toContain("Esta base no junta encuestas");

    const ajeno = render(datos([MIXTA, fuente({ survey_id: "web", titulo: "Web" })]), "zzz");
    expect(ajeno).toContain("Esa fuente ya no forma parte de esta base");
    expect(ajeno).toContain("<select");
  });

  it("120 filas: el marco es el mismo y todas se listan", () => {
    const muchas = Array.from({ length: 120 }, (_, i) => fila({
      seccion: `Sección ${Math.floor(i / 20) + 1}`,
      etiqueta: `Pregunta ${i + 1}`,
      variable_base: `p${i + 1}`,
      variable_fuente: i % 3 === 0 ? `q${i + 1}` : `p${i + 1}`,
      estado: i % 3 === 0 ? "otro_nombre" : "emparejada",
    }));
    const html = render(datos([fuente({ filas: muchas })]), "tel", "todas");
    expect(filasDeTabla(html)).toBe(120);
    expect((html.match(/scope="colgroup"/g) ?? []).length).toBe(6);
    // Mismo marco que con tres filas: cabecera fuera del cuerpo que scrollea.
    for (const clase of ["pulso-emparejamiento-cabecera", "pulso-emparejamiento-cuerpo", "pulso-emparejamiento-barra"]) {
      expect(html).toContain(clase);
    }
  });

  it("matriz: el enunciado encabeza sus filas, que muestran solo su texto con sangría", () => {
    const madre = "¿Ha utilizado los siguientes servicios de la facultad durante el último semestre?";
    const html = render(datos([fuente({
      filas: [
        fila({ etiqueta: "Edad", variable_base: "p4", variable_fuente: "p3", estado: "otro_nombre" }),
        fila({ seccion: "Servicios", enunciado: madre, etiqueta: "Servicio de salud", variable_base: "p11_1", variable_fuente: "p11_1" }),
        fila({ seccion: "Servicios", enunciado: madre, etiqueta: "Comunicación visual", variable_base: "p11_2", variable_fuente: "p12_2", estado: "otro_nombre" }),
      ],
    })]), "tel", "todas");
    // Una sola subcabecera, con el texto completo, como cabecera de su grupo de filas.
    expect((html.match(/scope="rowgroup"/g) ?? []).length).toBe(1);
    expect(html).toContain(`<th scope="rowgroup" colSpan="4" title="${madre}">${madre}</th>`);
    // Cada fila de la matriz trae solo su texto y la marca de sangría.
    expect((html.match(/is-en-matriz/g) ?? []).length).toBe(2);
    expect(html).toMatch(/is-en-matriz"><th scope="row" class="pulso-emparejamiento-pregunta" title="Servicio de salud">Servicio de salud<\/th>/);
    // La subcabecera va después de la sección y antes de sus filas.
    expect(html.indexOf(madre)).toBeGreaterThan(html.indexOf(">Servicios<"));
    expect(html.indexOf(madre)).toBeLessThan(html.indexOf(">Servicio de salud<"));
  });

  it("una fila sin enunciado se ve como siempre: sin subcabecera ni sangría", () => {
    const html = render(datos([MIXTA]), "tel", "todas");
    expect(html).not.toContain('scope="rowgroup"');
    expect(html).not.toContain("is-en-matriz");
  });

  it("una fuente sin respuestas lo dice en el encabezado; con respuestas da el dato", () => {
    const vacia = render(datos([fuente({ n_filas_incorporadas: 0, filas: MIXTA.filas })]));
    expect(vacia).toContain("Todavía no tiene respuestas.");
    expect(vacia.indexOf("Todavía no tiene respuestas.")).toBeLessThan(vacia.indexOf("pulso-emparejamiento-cuerpo"));
    const llena = render(datos([MIXTA]));
    expect(llena).toContain("52 respuestas de esta fuente están en la base.");
    expect(llena).not.toContain("Todavía no tiene respuestas.");
  });
});
