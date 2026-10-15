import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ListaPartes } from "./ListaPartes";
import {
  anchoDeSlot,
  destinoDeTecla,
  nombreAccesibleDeParte,
  partesNavegables,
  reservaSlotDeEstado,
  type GrupoDePartes,
} from "./listaPartesModelo";

// Sin DOM de pruebas en el repo: el render se afirma sobre el markup estático y el teclado sobre su lógica pura
// (`destinoDeTecla`, `partesNavegables`), que es la que decide a qué fila va el foco.

const noop = () => undefined;

const GRUPOS: GrupoDePartes<"formato" | "logica" | "matrices" | "suelta-1" | "suelta-2">[] = [
  {
    id: "documento",
    titulo: "Documento",
    partes: [
      { clave: "formato", rotulo: "Formato", detalle: "Dos columnas · con N.º" },
      { clave: "logica", rotulo: "Lógica", detalle: "Saltos", estado: { tono: "aviso", texto: "Sin consentimiento" } },
      { clave: "matrices", rotulo: "Matrices", detalle: "4 de 6 como tabla", estado: { tono: "conteo", texto: "6" } },
    ],
  },
  {
    id: "sueltas",
    titulo: "Preguntas sueltas con escala (2)",
    plegable: {},
    partes: [
      { clave: "suelta-1", rotulo: "p1", detalle: "Una pregunta" },
      { clave: "suelta-2", rotulo: "p2", detalle: "Una pregunta", estado: { tono: "listo", texto: "Listo" } },
    ],
  },
];

describe("ListaPartes · render", () => {
  test("un panel con filas, la elegida con aria-current y una sola fila tabulable", () => {
    const html = renderToStaticMarkup(
      <ListaPartes etiqueta="Partes del impreso" grupos={GRUPOS} actual="logica" onElegir={noop} idPanel="detalle" prefijoId="impreso" />,
    );
    expect(html).toContain('aria-label="Partes del impreso"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*id="impreso-logica"[^>]*aria-current="true"/);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*id="impreso-logica"[^>]*tabindex="0"/);
    expect(html).toContain('aria-controls="detalle"');
    // Encabezado en versalitas del grupo con título.
    expect(html).toContain('<h3 class="pulso-lista-partes-encabezado">Documento</h3>');
  });

  test("si una fila lleva estado, todas reservan el slot (también las que no lo llevan)", () => {
    const html = renderToStaticMarkup(<ListaPartes etiqueta="x" grupos={GRUPOS} actual="formato" onElegir={noop} />);
    const filasVisibles = html.match(/class="pulso-lista-partes-fila(?: [^"]*)?"/g) ?? [];
    expect(filasVisibles).toHaveLength(3); // el grupo plegable está cerrado
    expect(filasVisibles.every((c) => c.includes("con-estado"))).toBe(true);
    expect(html).toContain('pulso-lista-partes-estado is-aviso');
    expect(html).toContain('pulso-lista-partes-estado is-conteo');
    // La fila sin estado reserva el hueco vacío.
    expect(html).toMatch(/id="lista-partes-formato"[\s\S]*?<span class="pulso-lista-partes-estado" aria-hidden="true"><\/span>/);
  });

  test("sin estado en ninguna fila, no se reserva slot", () => {
    const sinEstado: GrupoDePartes<"a" | "b">[] = [{ id: "g", partes: [{ clave: "a", rotulo: "A" }, { clave: "b", rotulo: "B" }] }];
    const html = renderToStaticMarkup(<ListaPartes etiqueta="x" grupos={sinEstado} actual="a" onElegir={noop} />);
    expect(html).not.toContain("con-estado");
    expect(html).not.toContain("pulso-lista-partes-estado");
  });

  test("rótulo y detalle se truncan con title completo; el estado va aparte del rótulo", () => {
    const largo: GrupoDePartes<"a">[] = [{
      id: "g",
      partes: [{ clave: "a", rotulo: "Un rótulo muy largo que no cabe", detalle: "Los colores de cada escala de respuesta", estado: { tono: "neutro", texto: "Por defecto" } }],
    }];
    const html = renderToStaticMarkup(<ListaPartes etiqueta="x" grupos={largo} actual="a" onElegir={noop} />);
    expect(html).toContain('class="pulso-lista-partes-rotulo" title="Un rótulo muy largo que no cabe"');
    expect(html).toContain('class="pulso-lista-partes-detalle" title="Los colores de cada escala de respuesta"');
    expect(html).toMatch(/<\/span><\/span><span class="pulso-lista-partes-estado is-neutro"/);
  });

  test("detalle en dos líneas: la clase va en el panel (todas las filas crecen igual); por defecto, una", () => {
    const una = renderToStaticMarkup(<ListaPartes etiqueta="x" grupos={GRUPOS} actual="formato" onElegir={noop} />);
    expect(una).not.toContain("is-detalle-2");
    const dos = renderToStaticMarkup(<ListaPartes etiqueta="x" grupos={GRUPOS} actual="formato" onElegir={noop} detalleLineas={2} />);
    expect(dos).toMatch(/class="pulso-lista-partes[^"]* is-detalle-2"/);
    expect(dos.match(/is-detalle-2/g)).toHaveLength(1);
  });

  test("el grupo plegable arranca cerrado, salvo que contenga la parte elegida", () => {
    const cerrado = renderToStaticMarkup(<ListaPartes etiqueta="x" grupos={GRUPOS} actual="formato" onElegir={noop} />);
    expect(cerrado).toMatch(/class="pulso-lista-partes-plegable" aria-expanded="false"/);
    expect(cerrado).not.toContain('data-parte="suelta-1"');

    const conElegida = renderToStaticMarkup(<ListaPartes etiqueta="x" grupos={GRUPOS} actual="suelta-2" onElegir={noop} />);
    expect(conElegida).toMatch(/class="pulso-lista-partes-plegable" aria-expanded="true"/);
    expect(conElegida).toContain('data-parte="suelta-1"');
  });

  test("si la elegida no existe, la primera fila visible es la tabulable", () => {
    const html = renderToStaticMarkup(
      <ListaPartes etiqueta="x" grupos={GRUPOS} actual={"nada" as "formato"} onElegir={noop} />,
    );
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*id="lista-partes-formato"[^>]*tabindex="0"/);
  });
});

describe("ListaPartes · teclado y modelo", () => {
  const claves = ["formato", "logica", "matrices"] as const;

  test("flechas recorren con vuelta; Inicio y Fin van a los extremos; otra tecla no es de la lista", () => {
    expect(destinoDeTecla("ArrowDown", claves, "formato")).toBe("logica");
    expect(destinoDeTecla("ArrowDown", claves, "matrices")).toBe("formato");
    expect(destinoDeTecla("ArrowUp", claves, "formato")).toBe("matrices");
    expect(destinoDeTecla("ArrowUp", claves, "matrices")).toBe("logica");
    expect(destinoDeTecla("Home", claves, "matrices")).toBe("formato");
    expect(destinoDeTecla("End", claves, "formato")).toBe("matrices");
    expect(destinoDeTecla("ArrowDown", claves, null)).toBe("formato");
    expect(destinoDeTecla("Enter", claves, "formato")).toBeNull();
    expect(destinoDeTecla("ArrowDown", [], null)).toBeNull();
  });

  test("las filas de un grupo plegado cerrado no se recorren", () => {
    expect(partesNavegables(GRUPOS, (g) => g.id !== "sueltas")).toEqual(["formato", "logica", "matrices"]);
    expect(partesNavegables(GRUPOS, () => true)).toEqual(["formato", "logica", "matrices", "suelta-1", "suelta-2"]);
  });

  test("el slot es angosto si sólo hay números o checks, ancho si hay palabras", () => {
    const soloCuentas: GrupoDePartes[] = [{ id: "g", partes: [
      { clave: "a", rotulo: "A", estado: { tono: "conteo", texto: "13" } },
      { clave: "b", rotulo: "B", estado: { tono: "listo", texto: "Listo" } },
      { clave: "c", rotulo: "C" },
    ] }];
    expect(anchoDeSlot(soloCuentas)).toBe("angosto");
    expect(anchoDeSlot(GRUPOS)).toBe("ancho");
    expect(renderToStaticMarkup(<ListaPartes etiqueta="x" grupos={soloCuentas} actual="a" onElegir={noop} />))
      .toContain('class="pulso-lista-partes is-slot-angosto"');
  });

  test("reserva de slot y nombre accesible", () => {
    expect(reservaSlotDeEstado(GRUPOS)).toBe(true);
    expect(reservaSlotDeEstado([{ id: "g", partes: [{ clave: "a", rotulo: "A" }] }])).toBe(false);
    expect(nombreAccesibleDeParte({ clave: "a", rotulo: "Lógica", detalle: "Saltos", estado: { tono: "aviso", texto: "Sin consentimiento" } }))
      .toBe("Lógica. Saltos. Sin consentimiento");
  });
});
