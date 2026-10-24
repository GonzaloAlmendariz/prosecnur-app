// Barra del bloque elegido en el lienzo (L10): duplicar, cambiar por y estilo.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MailBlock, MailTemplate } from "../../../api/materialMail";
import { AccionesDeSeccion, botonesDeSeccion } from "./AccionesDeSeccion";
import { duplicarBloque, MAXIMO_DE_BLOQUES } from "./estructuraCorreo";
import { bloqueNuevo } from "./modeloCorreo";
import { useCorreosStore } from "./store";

const plantilla = (blocks: MailBlock[]) => ({ blocks, images: {}, fields: [] }) as unknown as MailTemplate;
const pasos = bloqueNuevo("steps", "steps-1");
const pie: MailBlock = { block_id: "pie", type: "footer_legal" };

describe("duplicar", () => {
  it("la copia va justo debajo, idéntica y con su propio id; tocar la copia no toca el original", () => {
    const t = plantilla([pasos, pie]);
    const out = duplicarBloque(t, "steps-1");
    expect(out?.block_id).toBe("steps-2");
    expect(out?.template.blocks.map((b) => b.block_id)).toEqual(["steps-1", "steps-2", "pie"]);
    const copia = out!.template.blocks[1] as typeof pasos & { entries: { title: string }[] };
    expect({ ...copia, block_id: "steps-1" }).toEqual(pasos);
    copia.entries[0].title = "Otro";
    expect((pasos as { entries: { title: string }[] }).entries[0].title).toBe("Abre tu enlace");
  });

  it("no duplica el pie legal, un bloque desconocido ni pasa del tope de bloques", () => {
    expect(duplicarBloque(plantilla([pasos, pie]), "pie")).toBeNull();
    const opaco = { block_id: "x", type: "__no_reconocido", original_type: "futuro", raw: {} } as MailBlock;
    expect(duplicarBloque(plantilla([opaco]), "x")).toBeNull();
    const lleno = plantilla(Array.from({ length: MAXIMO_DE_BLOQUES }, (_, i) => ({ ...pasos, block_id: `s-${i}` })));
    expect(duplicarBloque(lleno, "s-0")).toBeNull();
  });
});

describe("barra", () => {
  it("una sección suma duplicar, cambiar por y estilo; el pie, nada", () => {
    const t = plantilla([pasos, pie]);
    expect(botonesDeSeccion(t, pasos)).toBe(3);
    expect(botonesDeSeccion(t, pie)).toBe(0);
    const parrafo = bloqueNuevo("paragraph", "p");
    expect(botonesDeSeccion(plantilla([parrafo]), parrafo)).toBe(2);
    const html = renderToStaticMarkup(
      <AccionesDeSeccion template={t} block={pasos} onDuplicar={() => {}} onEditarBloque={() => {}} onEstilo={() => {}} />,
    );
    expect(html).toContain('aria-label="Duplicar el bloque (⌘D)"');
    expect(html).toContain('aria-label="Cambiar por otra sección"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Estilo del bloque"');
  });

  it("«Estilo» queda pedido para el bloque elegido y otro bloque vuelve a abrir en su contenido", () => {
    const s = useCorreosStore.getState();
    s.seleccionar("steps-1");
    s.setVistaDelBloque("estilo");
    useCorreosStore.getState().seleccionar("steps-1");
    expect(useCorreosStore.getState().vistaDelBloque).toBe("estilo");
    useCorreosStore.getState().seleccionar("otro");
    expect(useCorreosStore.getState().vistaDelBloque).toBe("contenido");
  });
});
