import { describe, expect, it, vi } from "vitest";
import { reintentarConFoco, SELECTOR_MINIATURA } from "./reintentarConFoco";

describe("reintentarConFoco", () => {
  it("pasa el foco a la miniatura de la lámina ANTES de pedir el reintento (que desmonta el botón), sin desplazar", () => {
    const orden: string[] = [];
    const focus = vi.fn((_o?: FocusOptions) => { orden.push("foco"); });
    const querySelector = vi.fn((_s: string) => ({ focus }));
    const ok = reintentarConFoco({ querySelector }, () => orden.push("reintentar"));
    expect(ok).toBe(true);
    expect(querySelector).toHaveBeenCalledWith(SELECTOR_MINIATURA);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(orden).toEqual(["foco", "reintentar"]);
  });

  it("sin ítem (o sin miniatura) igual reintenta", () => {
    const reintentar = vi.fn();
    expect(reintentarConFoco(null, reintentar)).toBe(false);
    expect(reintentarConFoco({ querySelector: () => null }, reintentar)).toBe(false);
    expect(reintentar).toHaveBeenCalledTimes(2);
  });
});
