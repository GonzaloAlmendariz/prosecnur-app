import { describe, expect, it } from "vitest";
import { ATRIBUTO_LIENZO, ATRIBUTO_RANURA, destinoAlCerrarSelector } from "./focoAlCerrar";

// Un documento falso que responde a los selectores de atributo exactos que ponen el visor y las ranuras.
const raiz = (presentes: Record<string, string>) => ({
  pedidos: [] as string[],
  querySelector(sel: string) {
    this.pedidos.push(sel);
    return presentes[sel] ?? null;
  },
});

describe("destinoAlCerrarSelector (foco al cerrar un selector abierto por enlace)", () => {
  it("con ranura en el foco y a la vista: vuelve a esa ranura", () => {
    const r = raiz({ [`[${ATRIBUTO_RANURA}="2"]`]: "ranura-2", [`[${ATRIBUTO_LIENZO}]`]: "lienzo" });
    expect(destinoAlCerrarSelector(r, 2)).toBe("ranura-2");
  });
  it("sin la ranura a la vista (la lámina se está redibujando): a la lámina", () => {
    const r = raiz({ [`[${ATRIBUTO_LIENZO}]`]: "lienzo" });
    expect(destinoAlCerrarSelector(r, 2)).toBe("lienzo");
  });
  it("sin ranura en el foco: a la lámina, sin buscar ranuras", () => {
    const r = raiz({ [`[${ATRIBUTO_RANURA}="1"]`]: "ranura-1", [`[${ATRIBUTO_LIENZO}]`]: "lienzo" });
    expect(destinoAlCerrarSelector(r, null)).toBe("lienzo");
    expect(r.pedidos).toEqual([`[${ATRIBUTO_LIENZO}]`]);
  });
  it("sin lámina en pantalla (informe vacío): nada, y el diálogo usa su ancla", () => {
    expect(destinoAlCerrarSelector(raiz({}), 1)).toBeNull();
  });
});
