// Ítems 2 y 3 de docs/qa/checklist-inspector-correo-2026-10-23.md: los puntos
// de un Recuadro o de una Lista se editan uno por fila, y el inspector ya no
// muestra «Qué hace» ni el código de la plataforma.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MailTemplate } from "../../../api/materialMail";
import { ListaDePuntos } from "./ListaDePuntos";
import {
  MAX_PUNTOS,
  agregar,
  alBorrarVacio,
  alPulsarEnter,
  cursorEnLosPuntos,
  filasDe,
  mover,
  puntosDe,
  quitar,
  reconciliar,
  type FilaDePunto,
} from "./listaDePuntosModel";
import { PanelDeBloque } from "./PanelDeBloque";

function ids() {
  let n = 0;
  return () => `n${++n}`;
}

const tres = (): FilaDePunto[] => [
  { id: "a", texto: "uno" },
  { id: "b", texto: "dos" },
  { id: "c", texto: "tres" },
];

describe("listaDePuntosModel · agregar, quitar y mover", () => {
  it("filasDe deja al menos una fila; puntosDe recorta y descarta las vacías", () => {
    expect(filasDe([], ids())).toEqual([{ id: "n1", texto: "" }]);
    expect(puntosDe([{ id: "a", texto: "  uno " }, { id: "b", texto: "  " }, { id: "c", texto: "dos" }])).toEqual(["uno", "dos"]);
  });

  it("agregar inserta una vacía debajo y le da el foco; al tope no agrega", () => {
    const paso = agregar(tres(), 0, ids());
    expect(paso?.filas.map((f) => f.texto)).toEqual(["uno", "", "dos", "tres"]);
    expect(paso?.foco).toEqual({ id: "n1", alFinal: true });
    expect(agregar(tres(), 99, ids())?.filas.map((f) => f.texto)).toEqual(["uno", "dos", "tres", ""]);
    const llenas = Array.from({ length: MAX_PUNTOS }, (_, i) => ({ id: `f${i}`, texto: `p${i}` }));
    expect(agregar(llenas, 2, ids())).toBeNull();
  });

  it("quitar enfoca la anterior; la única fila no se quita", () => {
    const paso = quitar(tres(), 1);
    expect(paso?.filas.map((f) => f.id)).toEqual(["a", "c"]);
    expect(paso?.foco).toEqual({ id: "a", alFinal: true });
    expect(quitar(tres(), 0)?.foco?.id).toBe("b");
    expect(quitar([{ id: "a", texto: "" }], 0)).toBeNull();
  });

  it("mover sube y baja dentro de los bordes", () => {
    expect(mover(tres(), 2, -1)?.filas.map((f) => f.id)).toEqual(["a", "c", "b"]);
    expect(mover(tres(), 0, 1)?.filas.map((f) => f.id)).toEqual(["b", "a", "c"]);
    expect(mover(tres(), 0, -1)).toBeNull();
    expect(mover(tres(), 2, 1)).toBeNull();
  });
});

describe("listaDePuntosModel · Enter y Backspace", () => {
  it("Enter crea el siguiente debajo y lo enfoca", () => {
    const paso = alPulsarEnter(tres(), 1, ids());
    expect(paso?.filas.map((f) => f.texto)).toEqual(["uno", "dos", "", "tres"]);
    expect(paso?.foco?.id).toBe("n1");
  });

  it("Backspace borra sólo un punto vacío y enfoca el anterior", () => {
    const filas = [...tres().slice(0, 2), { id: "v", texto: " " }];
    const paso = alBorrarVacio(filas, 2);
    expect(paso?.filas.map((f) => f.id)).toEqual(["a", "b"]);
    expect(paso?.foco).toEqual({ id: "b", alFinal: true });
    expect(alBorrarVacio(tres(), 1)).toBeNull();
    expect(alBorrarVacio([{ id: "v", texto: "" }], 0)).toBeNull();
  });
});

describe("listaDePuntosModel · el cursor y los cambios por fuera", () => {
  it("el cursor de una fila se cuenta en los puntos unidos por saltos de línea", () => {
    const filas = [{ id: "a", texto: "uno" }, { id: "v", texto: "" }, { id: "b", texto: " dos" }];
    // "uno\ndos": la «d» está en 4.
    expect(cursorEnLosPuntos(filas, 2, 1)).toBe(4);
    expect(cursorEnLosPuntos(filas, 0, 2)).toBe(2);
    // La fila vacía apunta al final del punto anterior.
    expect(cursorEnLosPuntos(filas, 1, 0)).toBe(3);
    expect(cursorEnLosPuntos(filas, 0, null)).toBeNull();
  });

  it("lo que ya dicen las filas no las toca: las vacías se quedan", () => {
    const filas = [{ id: "a", texto: "uno" }, { id: "v", texto: "" }];
    const out = reconciliar(filas, ["uno"], null, ids());
    expect(out.filas).toEqual(filas);
    expect(out.corregidos).toBeNull();
  });

  it("un campo insertado para una fila vacía va a esa fila y corrige los puntos", () => {
    const filas = [{ id: "a", texto: "uno" }, { id: "v", texto: "" }];
    const pendiente = { filaId: "v", base: "uno", desplazamiento: 3 };
    const out = reconciliar(filas, ["uno{{nombre}}"], pendiente, ids());
    expect(out.filas.map((f) => f.texto)).toEqual(["uno", "{{nombre}}"]);
    expect(out.corregidos).toEqual(["uno", "{{nombre}}"]);
  });

  it("deshacer con los mismos puntos actualiza en su lugar; con otros, rehace las filas", () => {
    const filas = [{ id: "a", texto: "uno" }, { id: "v", texto: "" }, { id: "b", texto: "dos" }];
    expect(reconciliar(filas, ["UNO", "dos"], null, ids()).filas).toEqual([
      { id: "a", texto: "UNO" }, { id: "v", texto: "" }, { id: "b", texto: "dos" },
    ]);
    expect(reconciliar(filas, ["solo"], null, ids()).filas).toEqual([{ id: "a", texto: "solo" }]);
    expect(reconciliar(filas, [], null, ids()).filas).toEqual([{ id: "n1", texto: "" }]);
  });
});

const OPCIONES = { rotuloDeCampo: (k: string) => k };

describe("ListaDePuntos · una fila por punto", () => {
  it("numerada: 1., 2., y cada fila con su campo y sus botones con nombre", () => {
    const html = renderToStaticMarkup(
      <ListaDePuntos label="Puntos" items={["Primero", "Segundo"]} numerada opciones={OPCIONES} onCambio={() => undefined} />,
    );
    expect(html).toContain(">1.</span>");
    expect(html).toContain(">2.</span>");
    expect(html.match(/role="textbox"/g)).toHaveLength(2);
    for (const accion of ["Subir el punto 1", "Bajar el punto 2", "Quitar el punto 2"]) expect(html).toContain(`aria-label="${accion}"`);
    expect(html).toContain("Agregar punto");
    expect(html).not.toContain("Enter empieza otro punto");
  });

  it("sin numerar lleva viñeta; con un solo punto no se puede quitar", () => {
    const html = renderToStaticMarkup(<ListaDePuntos label="Puntos" items={["Único"]} opciones={OPCIONES} onCambio={() => undefined} />);
    expect(html).toContain(">•</span>");
    expect(html).toMatch(/aria-label="Quitar el punto 1"[^>]*disabled=""|disabled=""[^>]*aria-label="Quitar el punto 1"/);
  });
});

const PLANTILLA: MailTemplate = {
  schema: "collection_mail_template/v2",
  template_id: "correo",
  revision: 1,
  subject: "Asunto",
  preheader: "",
  theme: { accent: "#0b1f54" },
  header: { kind: "logos", logo_ids: [], background: "dark" },
  images: {},
  fields: [],
  blocks: [
    { block_id: "lista", type: "list", items: ["uno", "dos"], ordered: true },
    { block_id: "recuadro", type: "callout", title: "Importante:", items: ["Primer punto."], variant: "box" },
  ],
};

const SIN_PROBLEMAS = { porBloque: {}, sobre: [], cabecera: [], campos: [], otros: [] };

function panel(seleccion: string): string {
  return renderToStaticMarkup(
    <PanelDeBloque
      template={PLANTILLA}
      seleccion={seleccion}
      problemas={SIN_PROBLEMAS}
      persona={null}
      explicaciones
      onEditar={() => undefined}
      onEditarBloque={() => undefined}
      onDestino={() => undefined}
      onMover={() => undefined}
      onQuitar={() => undefined}
      onAbrirIdentidad={() => undefined}
    />,
  );
}

describe("PanelDeBloque · sin la tarjeta didáctica y con los puntos en filas", () => {
  it("ni «Qué hace» ni el código de la plataforma, aun con explicaciones", () => {
    for (const id of ["lista", "recuadro"]) {
      const html = panel(id);
      expect(html).not.toContain("Qué hace");
      expect(html).not.toContain("Ver el código");
      expect(html).not.toContain("Cómo sale en");
    }
  });

  it("la Lista y el Recuadro editan sus puntos uno por fila", () => {
    const lista = panel("lista");
    expect(lista).toContain('class="rec-mail-puntos"');
    expect(lista).toContain(">2.</span>");
    const recuadro = panel("recuadro");
    expect(recuadro).toContain('class="rec-mail-puntos"');
    expect(recuadro).toContain(">•</span>");
  });
});
