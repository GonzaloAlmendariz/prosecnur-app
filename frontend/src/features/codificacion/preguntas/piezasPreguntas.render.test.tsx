// Preguntas como lista de unidades con inspector (etapa P3a). Se pinta el marcado de las piezas con los
// datos de `unidadesDePrueba` y se comprueba lo que promete cada una.
import { DndContext } from "@dnd-kit/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarraPreguntas } from "./BarraPreguntas";
import { DecisionNoCodificar } from "./DecisionNoCodificar";
import { InspectorUnidad, type InspectorUnidadProps } from "./InspectorUnidad";
import { ListaUnidades, type ListaUnidadesProps } from "./ListaUnidades";
import { armarUnidades, contarFiltros, seccionesVisibles, type Unidad } from "./modeloUnidades";
import { FORMULARIO, pregunta } from "./unidadesDePrueba";

const unidades = armarUnidades(FORMULARIO);
const una = (id: string): Unidad => {
  const u = unidades.find((x) => x.id === id);
  if (!u) throw new Error(`sin unidad ${id}`);
  return u;
};
const nada = () => undefined;

function lista(extra: Partial<ListaUnidadesProps> = {}): string {
  return renderToStaticMarkup(
    <DndContext>
      <ListaUnidades
        secciones={seccionesVisibles(unidades, "todas", "")}
        hayUnidades
        buscando={false}
        seleccion={null}
        ocupada=""
        recienUnida=""
        levantada={null}
        onSeleccionar={nada}
        onEmparejar={nada}
        onVerTodas={nada}
        {...extra}
      />
    </DndContext>,
  );
}

function inspector(unidad: Unidad | null, extra: Partial<InspectorUnidadProps> = {}): string {
  return renderToStaticMarkup(
    <InspectorUnidad
      unidad={unidad}
      ocupada={false}
      incluir={null}
      onEmparejar={nada}
      onCambiar={nada}
      onDesemparejar={nada}
      onElegirModo={nada}
      onElegirOtros={nada}
      {...extra}
    />,
  );
}

/** El marcado de la fila de una unidad. */
function fila(html: string, id: string): string {
  const inicio = html.indexOf(`data-unidad="${id}"`);
  expect(inicio, `fila ${id}`).toBeGreaterThan(-1);
  const fin = html.indexOf("</li>", inicio);
  return html.slice(inicio, fin);
}

const bloques = (html: string) => html.split('class="pulso-bloque-pregunta"').length - 1;

describe("lista de unidades", () => {
  it("declara su geometría (C1) y una fila por unidad, sin acordeones", () => {
    const html = lista();
    expect(html).toContain('data-qa-geometry-group="codificacion/unidades"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html.split("data-qa-geometry-member").length - 1).toBe(unidades.length);
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("<details");
    // El texto de una pareja no hace fila propia.
    expect(html).not.toContain('data-unidad="p3_otro"');
  });

  it("las secciones del formulario son encabezados, no controles", () => {
    const html = lista();
    expect(html).toMatch(/<h4 id="[^"]+" class="pulso-preg-seccion-rotulo">Datos generales<\/h4>/);
    expect(html).toMatch(/<h4 id="[^"]+" class="pulso-preg-seccion-rotulo">Situación laboral<\/h4>/);
  });

  it("una pareja son dos bloques con su tipo, el nodo de enlace en medio, las respuestas y el estado", () => {
    const p3 = fila(lista(), "p3");
    expect(p3).toContain('data-forma="pareja"');
    expect(bloques(p3)).toBe(2);
    expect(p3).toMatch(/data-tipo="unica" data-ancho="lado">.*?<code[^>]*>p3<\/code><span[^>]*>Única<\/span>/);
    expect(p3).toMatch(/data-tipo="texto" data-ancho="lado">.*?<code[^>]*>p3_otro<\/code><span[^>]*>Texto<\/span>/);
    expect(p3).toMatch(/<span class="pulso-preg-lazo" data-lazo="unido"/);
    expect(p3).toContain("emparejada con");
    expect(p3).toContain('pulso-bloque-pregunta-detalle">23 respuestas, 14 únicas<');
    expect(p3).toContain("Codificada");
    // El nodo de una pareja es un dibujo, no un sitio donde soltar.
    expect(p3).not.toContain('data-lazo="suelto"');
  });

  it("una pareja cuya columna de texto no está en la lista la muestra como bloque de texto", () => {
    const d1 = fila(lista(), "D1");
    expect(bloques(d1)).toBe(2);
    expect(d1).toMatch(/data-tipo="texto"[^>]*>.*?title="D1_otro"/);
  });

  it("una abierta sin pareja es un solo bloque a todo el ancho, con el nodo punteado para emparejarla", () => {
    const p10otro = fila(lista(), "p10_otro");
    expect(p10otro).toContain('data-forma="abierta"');
    expect(bloques(p10otro)).toBe(1);
    expect(p10otro).toContain('data-tipo="texto" data-ancho="completo"');
    expect(p10otro).toContain('pulso-bloque-pregunta-detalle">18 respuestas, 15 únicas<');
    expect(p10otro).toMatch(/<button[^>]*class="pulso-preg-lazo" data-lazo="suelto"[^>]*aria-label="Emparejar p10_otro con otra pregunta"/);
  });

  it("una cerrada sin texto es su bloque en su lado, con el nodo punteado y el asa para levantarla", () => {
    const p10 = fila(lista(), "p10");
    expect(p10).toContain('data-forma="cerrada"');
    expect(bloques(p10)).toBe(1);
    expect(p10).toContain('data-tipo="unica" data-ancho="lado"');
    expect(p10).not.toContain("pulso-bloque-pregunta-detalle");
    expect(p10).toMatch(/<button[^>]*class="pulso-preg-lazo" data-lazo="suelto"/);
    expect(p10).toContain('aria-label="Arrastrar p10 sobre otra pregunta para emparejarlas"');
  });

  it("una pareja y una desactivada no se levantan ni reciben", () => {
    const html = lista();
    expect(fila(html, "p3")).not.toContain("Arrastrar");
    expect(fila(html, "p30")).not.toContain("Arrastrar");
    expect(fila(html, "p30")).not.toContain("pulso-preg-lazo");
    expect(fila(html, "p30")).toContain("Desactivada");
  });

  it('a una pareja de opción múltiple sin su opción "Otros" se le avisa bajo el estado', () => {
    const d1 = fila(lista(), "D1");
    expect(d1).toMatch(/Sin decidir.*Falta la opción &quot;Otros&quot;/s);
  });

  it("el estado va en su propia columna en todas las filas, también cuando no hay nada que decir", () => {
    const html = lista();
    for (const u of unidades) expect(fila(html, u.id), u.id).toContain('class="pulso-preg-fila-estado"');
    expect(fila(html, "p10")).toContain('<span class="pulso-preg-fila-estado"></span>');
  });

  it("la fila seleccionada lo dice a la vista y al lector de pantalla", () => {
    const html = lista({ seleccion: "p9" });
    expect(fila(html, "p9")).toContain('data-seleccionada=""');
    expect(fila(html, "p9")).toContain('aria-current="true"');
    expect(fila(html, "p10")).not.toContain("aria-current");
  });

  it("la lista es una sola parada del tabulador: la fila seleccionada o, sin selección, la primera", () => {
    const paradas = (html: string) => [...html.matchAll(/data-fila-boton="([^"]+)" tabindex="0"/g)].map((m) => m[1]);
    expect(paradas(lista())).toEqual(["p3"]);
    expect(paradas(lista({ seleccion: "p9" }))).toEqual(["p9"]);
    // Una selección que el filtro dejó fuera no deja la lista sin entrada.
    expect(paradas(lista({ seleccion: "p10", secciones: seccionesVisibles(unidades, "con-texto", "") }))).toEqual(["p3"]);
    // El asa de las demás filas no es parada, y el nodo punteado tampoco: con teclado se empareja desde el inspector.
    expect(fila(lista({ seleccion: "p9" }), "p10")).toMatch(/tabindex="-1"[^>]*class="pulso-preg-asa"/);
    expect(fila(lista({ seleccion: "p9" }), "p9")).toMatch(/tabindex="0"[^>]*class="pulso-preg-asa"/);
    expect(fila(lista({ seleccion: "p9" }), "p9")).toMatch(/class="pulso-preg-lazo" data-lazo="suelto" tabindex="-1"/);
  });

  it("al levantar un texto se marcan sus destinos y lo demás queda fuera", () => {
    const html = lista({ levantada: una("p10_otro") });
    expect(fila(html, "p10_otro")).toContain('data-arrastre="origen"');
    expect(fila(html, "p10")).toContain('data-arrastre="directo"');
    expect(fila(html, "p9")).toContain('data-arrastre="con-dialogo"');
    expect(fila(html, "p3")).toContain('data-arrastre="fuera"');
    expect(fila(html, "p30")).toContain('data-arrastre="fuera"');
  });

  it("sin filas por el filtro o la búsqueda, el vacío lo dice y ofrece volver a todas", () => {
    const porFiltro = lista({ secciones: [] });
    expect(porFiltro).toContain("Sin preguntas en esta vista");
    expect(porFiltro).toContain("Ninguna pregunta cumple este filtro.");
    expect(porFiltro).toContain("Ver todas");
    expect(lista({ secciones: [], buscando: true })).toContain("Ninguna pregunta coincide con la búsqueda.");
  });

  it("una base sin preguntas lo dice sin ofrecer un filtro", () => {
    const html = lista({ secciones: [], hayUnidades: false });
    expect(html).toContain("Sin preguntas en esta base");
    expect(html).not.toContain("Ver todas");
  });
});

describe("barra de filtros", () => {
  it("lleva los filtros en su orden, con su conteo y el buscador, y marca el activo", () => {
    const html = renderToStaticMarkup(
      <BarraPreguntas filtro="con-texto" conteos={contarFiltros(unidades)} consulta="" onFiltro={nada} onBuscar={nada} />,
    );
    const rotulos = [...html.matchAll(/<button[^>]*aria-pressed="(?:true|false)"[^>]*>.*?<span>([^<]+)<\/span><span[^>]*>(\d+)<\/span>/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(rotulos).toEqual(["Con texto 6", "Sin decidir 2", "Codificadas 1", "Todas 7"]);
    expect(html).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>).)*Con texto/s);
    expect(html.split('aria-pressed="true"').length - 1).toBe(1);
    expect(html).not.toContain("Emparejadas");
    expect(html).toContain('aria-label="Buscar preguntas por nombre, etiqueta o sección"');
    expect(html).not.toContain("Limpiar búsqueda");
  });

  it("con texto en el buscador aparece cómo limpiarlo", () => {
    const html = renderToStaticMarkup(
      <BarraPreguntas filtro="todas" conteos={contarFiltros(unidades)} consulta="otro" onFiltro={nada} onBuscar={nada} />,
    );
    expect(html).toContain('aria-label="Limpiar búsqueda"');
  });
});

describe("inspector de la unidad", () => {
  it("sin selección dice qué seleccionar", () => {
    const html = inspector(null);
    expect(html).toContain("Sin pregunta seleccionada");
    expect(html).toContain("Selecciona una fila de la lista");
    expect(html).not.toContain("Emparejar con");
  });

  it("una pareja de opción única: identidad de las dos, su modo, cambiar y desemparejar", () => {
    const html = inspector(una("p3"));
    expect(html).toContain("Pregunta emparejada");
    expect(html).toContain("Etiqueta de p3");
    expect(html).toContain("Etiqueta de p3_otro");
    expect(html).toContain("<span>Única</span><span>Se recodifica con sus opciones</span>");
    expect(html).toContain("<span>Texto</span><span>Aporta categorías nuevas</span>");
    expect(html).toContain('aria-label="Modo de codificación para p3"');
    expect(html).toContain("Codificar pregunta original");
    expect(html).toContain("Cambiar texto");
    expect(html).toContain("Desemparejar");
    expect(html).not.toContain("Emparejar con");
  });

  it("los títulos de sección van en castellano normal, sin la clase de versalitas del kit", () => {
    const conEjemplos = armarUnidades([
      pregunta("p3", "select_one", { modo_so: "padre", pareja: { child_col: "p3_otro", modo_so: "padre", dummy_col: "" } }),
      pregunta("p3_otro", "text", { col_efectiva: "p3_otro", preview: ["Minería"] }),
    ])[0];
    const html = inspector(conEjemplos, { incluir: <span>interruptor</span> });
    for (const titulo of ["Ejemplos de respuestas", "Modo de codificación", "Codificación"]) {
      expect(html, titulo).toContain(`<h4 class="pulso-preg-insp-rotulo">${titulo}</h4>`);
    }
    expect(html).not.toContain("pulso-section-eyebrow");
  });

  describe('opción "Otros" de una pareja de opción múltiple', () => {
    const opciones = [
      { codigo: "1", label: "En la radio", col_dummy: "D1/1", existe_en_data: true, es_otros_sugerido: false },
      { codigo: "99", label: "Otro lugar", col_dummy: "D1/99", existe_en_data: true, es_otros_sugerido: true },
      { codigo: "5", label: "Sin columna", col_dummy: "", existe_en_data: false, es_otros_sugerido: false },
    ];
    const con = (dummy: string) =>
      inspector(
        armarUnidades([
          pregunta("D1", "select_multiple", { preview: ["5", "2 96"], pareja: { child_col: "D1_otro", modo_so: "", dummy_col: dummy }, opciones_sm: opciones }),
          pregunta("D1_otro", "text", { col_efectiva: "D1_otro", preview: ["En el mercado"] }),
        ])[0],
        { incluir: <span>interruptor</span> },
      );
    const orden = (html: string, ...trozos: string[]) => trozos.map((t) => html.indexOf(t));

    it("es una sección con título normal, lista todas las opciones y no ofrece modo", () => {
      const html = con("");
      expect(html).toContain('<h4 class="pulso-preg-insp-rotulo">Opción &quot;Otros, especifique&quot;</h4>');
      expect(html.split('class="pulso-preg-otros-opcion"').length - 1).toBe(3);
      expect(html).not.toContain("Modo de codificación");
      expect(html).not.toMatch(/max-height|overflow-y/);
    });

    it('sin elegir lo dice, y la opción que el motor reconoce va con el chip "Sugerida"', () => {
      const html = con("");
      expect(html).toContain("Sin elegir");
      expect(html).toMatch(/Otro lugar<\/span><span[^>]*pulso-estado-chip[^>]*>.*?Sugerida/);
      expect(html.split("Sugerida").length - 1).toBe(1);
      expect(html).not.toMatch(/PROBABLE|Probable/);
      expect(html).not.toContain('aria-pressed="true"');
    });

    it("con una elegida queda compacta: solo esa opción, marcada, y cómo cambiarla; sin sugerencia ni aviso", () => {
      const html = con("D1/99");
      expect(html.split('class="pulso-preg-otros-opcion"').length - 1).toBe(1);
      expect(html).toMatch(/aria-pressed="true"[^>]*title="Quitar la selección"[^>]*>(?:(?!<\/button>).)*Otro lugar/s);
      expect(html).toContain(">Cambiar<");
      expect(html).not.toContain("En la radio");
      expect(html).not.toContain("Sugerida");
      expect(html).not.toContain("Sin elegir");
    });

    it("sin elegir es lo que falta decidir: va antes de los ejemplos; ya elegida, después", () => {
      const [otros, ejemplos, codificacion] = orden(con(""), "Opción &quot;Otros, especifique&quot;", "Ejemplos de respuestas", ">Codificación<");
      expect(otros).toBeGreaterThan(-1);
      expect(otros).toBeLessThan(ejemplos);
      expect(ejemplos).toBeLessThan(codificacion);
      const [otros2, ejemplos2, codificacion2] = orden(con("D1/99"), "Opción &quot;Otros, especifique&quot;", "Ejemplos de respuestas", ">Codificación<");
      expect(ejemplos2).toBeGreaterThan(-1);
      expect(ejemplos2).toBeLessThan(otros2);
      expect(otros2).toBeLessThan(codificacion2);
    });

    it("los ejemplos son los del texto de la pareja, no los códigos de la cerrada", () => {
      const html = con("");
      expect(html).toContain("<li>En el mercado</li>");
      expect(html).not.toContain("<li>5</li>");
      expect(html).not.toContain("<li>2 96</li>");
    });

    it("el rótulo de una opción en dos idiomas se lee limpio, con el texto completo en el title", () => {
      const bilingue = inspector(
        armarUnidades([
          pregunta("D1", "select_multiple", {
            pareja: { child_col: "D1_otro", modo_so: "", dummy_col: "" },
            opciones_sm: [{ codigo: "96", label: "Otro motivo Other reason", col_dummy: "D1/96", existe_en_data: true, es_otros_sugerido: true }],
          }),
        ])[0],
      );
      expect(bilingue).toContain('<span class="pulso-preg-otros-texto" title="Otro motivo Other reason">Otro motivo</span>');
    });

    it("una opción sin columna en la base no se puede elegir", () => {
      expect(con("")).toMatch(/<button[^>]*disabled=""[^>]*title="Esta opción no puede marcarse con la base actual"[^>]*>(?:(?!<\/button>).)*Sin columna/s);
    });
  });

  it("una pareja en la que recibe un texto se ve entera y se puede desemparejar, sin el selector de columna de una cerrada", () => {
    // Lo que devuelve el motor cuando el texto recibe a la cerrada: la pareja va en la fila del texto.
    const recibeTexto = armarUnidades([
      pregunta("transport", "select_one", { parent_label: "Medio de transporte" }),
      pregunta("transport_other", "text", {
        parent_label: "Otro medio", col_efectiva: "transport", marcada: true, marcada_auto: true, preview: ["1", "2"],
        pareja: { child_col: "transport", modo_so: "", dummy_col: "" },
      }),
    ]);
    expect(recibeTexto.map((u) => u.id)).toEqual(["transport_other"]);
    const html = inspector(recibeTexto[0]);
    expect(html).toContain("Pregunta emparejada");
    expect(html).toContain("<span>Texto</span><span>Recibe los códigos</span>");
    expect(html).toContain("<span>Única</span><span>Aporta las respuestas</span>");
    expect(html).toContain("Desemparejar");
    expect(html).not.toContain("Cambiar texto");
    expect(html).not.toContain("Ejemplos de respuestas");
    const filaHtml = fila(lista({ secciones: seccionesVisibles(recibeTexto, "todas", "") }), "transport_other");
    expect(filaHtml).toContain('data-forma="pareja"');
    expect(bloques(filaHtml)).toBe(2);
    expect(filaHtml).toMatch(/data-tipo="texto".*data-tipo="unica"/s);
    expect(filaHtml).not.toContain("pulso-bloque-pregunta-detalle");
  });

  it("una pareja de opción única sin modo lo pide antes de los ejemplos y sin ninguna opción marcada", () => {
    const sinModo = armarUnidades([
      pregunta("p5", "select_one", { pareja: { child_col: "p5_otro", modo_so: "", dummy_col: "" } }),
      pregunta("p5_otro", "text", { col_efectiva: "p5_otro", preview: ["Otro"] }),
    ])[0];
    const html = inspector(sinModo);
    expect(html.indexOf("Modo de codificación")).toBeLessThan(html.indexOf("Ejemplos de respuestas"));
    expect(html).not.toContain('aria-pressed="true"');
    // Con el modo ya puesto, la sección baja después de los ejemplos.
    const conModo = inspector(armarUnidades([
      pregunta("p5", "select_one", { modo_so: "hijo", pareja: { child_col: "p5_otro", modo_so: "hijo", dummy_col: "" } }),
      pregunta("p5_otro", "text", { col_efectiva: "p5_otro", preview: ["Otro"] }),
    ])[0]);
    expect(conModo.indexOf("Ejemplos de respuestas")).toBeLessThan(conModo.indexOf("Modo de codificación"));
    expect(conModo).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>).)*Codificar texto aparte/s);
  });

  it("una suelta se empareja sin arrastrar, con el botón del inspector", () => {
    const html = inspector(una("p10_otro"));
    expect(html).toContain("Pregunta suelta");
    expect(html).toContain("Emparejar con");
    expect(html).not.toContain("Desemparejar");
  });

  it("una desactivada no ofrece emparejar", () => {
    expect(inspector(una("p30"))).toContain("Pregunta desactivada");
    expect(inspector(una("p30"))).not.toContain("Emparejar con");
  });

  it("muestra ejemplos de respuestas cuando la pregunta los trae, y la sección falta cuando no", () => {
    const conEjemplos = armarUnidades([pregunta("p9", "text", { preview: ["Minería", "Consultoría ambiental"] })])[0];
    const html = inspector(conEjemplos);
    expect(html).toContain("Ejemplos de respuestas");
    expect(html).toContain("<li>Minería</li>");
    expect(inspector(una("p10"))).not.toContain("Ejemplos de respuestas");
  });

  it("el control de incluir va en su sección solo cuando la unidad lo admite", () => {
    expect(inspector(una("p9"), { incluir: <span>interruptor</span> })).toContain("interruptor");
    expect(inspector(una("p9"))).not.toContain(">Codificación<");
  });
});

describe("decisión de no codificar", () => {
  const pinta = (decision: Parameters<typeof DecisionNoCodificar>[0]["decision"], motivo?: string) =>
    renderToStaticMarkup(<DecisionNoCodificar decision={decision} motivo={motivo} onRegistrar={nada} onRevertir={nada} />);

  it("sobre una pregunta abierta se ofrece con su nombre, sin puntos suspensivos", () => {
    for (const decision of ["pendiente", "pendiente_parcial"] as const) {
      const html = pinta(decision);
      expect(html).toContain("Registrar que no se codifica");
      expect(html).not.toContain("…");
    }
  });

  it("ya registrada muestra el motivo y cómo volver atrás", () => {
    const html = pinta("no_categorizar", "Dato personal");
    expect(html).toContain("Motivo registrado: Dato personal");
    expect(html).toContain("Volver a pendiente");
    expect(html).not.toContain("Registrar que no se codifica");
  });

  it("una codificada, una sin respuestas o una sin incluir no la ofrecen", () => {
    for (const decision of ["categorizada", "sin_material", "sin_marcar", "requiere_config"] as const) expect(pinta(decision)).toBe("");
  });
});
