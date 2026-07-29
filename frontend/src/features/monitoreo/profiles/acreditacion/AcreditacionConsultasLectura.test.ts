import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

// A3 del plan: «Registros en plataforma» y «Estado de la base» se confundían.
//
// La causa no era falta de copy —cada pestaña ya tenía su encabezado, su icono
// y su tono— sino que `isTableOnlyTab` trataba las dos igual y APAGABA esa
// lectura para dar alto a la tabla. Quedaban dos tablas sin nada que dijera
// cuál era cuál, siendo inversas: una cuenta lo que llegó a plataforma, la otra
// a quién había que llegar del universo.
//
// El arreglo devuelve la lectura en una línea. Estas pruebas impiden que
// vuelva a apagarse, que es el movimiento que produjo la confusión.

const fuente = fs.readFileSync(
  path.resolve(__dirname, "AcreditacionMonitoreoPage.tsx"),
  "utf8",
);

describe("la lectura activa nunca se apaga por completo", () => {
  test("`mon-query-answer` no cuelga de una condición que la elimine", () => {
    // El patrón que hay que impedir es `{isTableOnlyTab ? null : (<section
    // className={...mon-query-answer...}`.
    expect(fuente).not.toMatch(/isTableOnlyTab \? null : \(\s*<section\s+className=\{`mon-query-answer/);
  });

  test("en las pestañas de tabla se muestra en su variante compacta", () => {
    expect(fuente).toMatch(/mon-query-answer is-\$\{queryAnswer\.tone\}\$\{isTableOnlyTab \? " is-compacta" : ""\}/);
  });

  test("las dos pestañas confundibles conservan icono y tono distintos", () => {
    // Es lo que las separa de un vistazo, antes de leer.
    // Anclado DENTRO de `acreditacionQueryAnswerCopy`: `if (tab === "…")`
    // aparece también en funciones de filtrado, y buscarlo suelto devolvía el
    // bloque equivocado.
    const copia = fuente.slice(fuente.indexOf("function acreditacionQueryAnswerCopy"));
    // Hasta el cierre del `return {…};`, no una ventana de N caracteres: la
    // primera versión usaba 420 y se rompió sola al añadir un comentario
    // dentro del bloque. Un test no puede depender de cuánto se comenta.
    const bloque = (tab: string) => {
      const inicio = copia.indexOf(`if (tab === "${tab}") {`);
      if (inicio < 0) return "";
      const fin = copia.indexOf("\n    };", inicio);
      return fin < 0 ? copia.slice(inicio) : copia.slice(inicio, fin);
    };
    const plataforma = bloque("plataforma");
    const base = bloque("base");

    // Se comprueba que sean DISTINTOS, no cuáles son: lo que separa las dos
    // pestañas de un vistazo es el contraste, y fijar el icono concreto rompía
    // el test cada vez que se reordena la iconografía (pasó al liberar
    // `QrCode` para que significara solo «Ficha QR»).
    const iconoDe = (bloque: string) => bloque.match(/icon:\s*(\w+)/)?.[1] ?? "";
    expect(iconoDe(plataforma)).not.toBe("");
    expect(iconoDe(base)).not.toBe("");
    expect(iconoDe(plataforma)).not.toBe(iconoDe(base));
    expect(plataforma).toContain('tone: "base"');
    // Ámbar contra azul. `pending` era otro azul casi idéntico al de la
    // pestaña vecina, así que el tono no cumplía su función de separarlas.
    expect(base).toContain('tone: "partial"');
    // Y encabezados que nombran denominadores distintos, no sinónimos.
    expect(plataforma).toContain("Registros recibidos");
    expect(base).toContain("Estado de la base");
  });

  test("el explorador declara una fila para la lectura, no solo para la tabla", () => {
    // El defecto que esto impide: `is-platform-table-only` declaraba UNA sola
    // fila (`minmax(0, 1fr)`) porque se escribió cuando la lectura estaba
    // oculta. Al devolverla quedaron dos hijos para una fila, la explícita
    // colapsó a 0 px y la tabla se subió encima — 9 px de solape medidos, con
    // el texto cortado por debajo del panel.
    const hoja = fs.readFileSync(
      path.resolve(__dirname, "acreditacionTelefono.css"),
      "utf8",
    );
    expect(hoja).toMatch(
      /\.mon-case-explorer\.is-platform-table-only\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)/,
    );
  });
});

describe("las cohortes se leen en orden cronológico", () => {
  test("una serie de años no se ordena por tamaño", () => {
    // Salía «2021, 2023, 2025, 2022» —por peso en el universo— y obligaba a
    // releer la columna para situarse en el tiempo.
    const bloque = fuente.slice(fuente.indexOf("function groupControlVariableRows"));
    expect(bloque).toContain("esSerieDeAnios(variableRows)");
  });

  test("solo aplica cuando TODAS las categorías son años", () => {
    // Una categoría suelta como «Sin dato» no debe volver alfabética la serie
    // ni decidir el orden del resto.
    const helper = fuente.slice(fuente.indexOf("function esSerieDeAnios"));
    expect(helper).toContain("rows.every(");
    expect(helper).toMatch(/\^\(19\|20\)/);
    expect(helper).toContain("rows.length < 2");
  });
});

