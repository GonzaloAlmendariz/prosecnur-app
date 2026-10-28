import { describe, expect, test } from "vitest";
import { conModificador, esMac, nombreDeAtajo, rotuloDeAtajo, teclaMod } from "./teclado";

describe("teclado en macOS y Windows", () => {
  test("reconoce la plataforma", () => {
    expect(esMac({ platform: "MacIntel" })).toBe(true);
    expect(esMac({ userAgentData: { platform: "Windows" } })).toBe(false);
    expect(esMac({})).toBe(false);
  });

  test("rotula con la tecla de cada sistema, Mayús incluida", () => {
    expect(teclaMod(true)).toBe("⌘");
    expect(teclaMod(false)).toBe("Ctrl");
    expect(rotuloDeAtajo("Deshacer", "Z", true)).toBe("Deshacer (⌘Z)");
    expect(rotuloDeAtajo("Deshacer", "Z", false)).toBe("Deshacer (Ctrl+Z)");
    expect(rotuloDeAtajo("Rehacer", "⇧Z", false)).toBe("Rehacer (Ctrl+Shift+Z)");
    expect(nombreDeAtajo("Z", false)).toBe("Ctrl+Z");
    expect(nombreDeAtajo("D", true)).toBe("⌘D");
  });

  test("escucha el modificador del sistema y no el del otro", () => {
    expect(conModificador({ metaKey: false, ctrlKey: true }, false)).toBe(true);
    expect(conModificador({ metaKey: true, ctrlKey: false }, false)).toBe(false);
    expect(conModificador({ metaKey: true, ctrlKey: false }, true)).toBe(true);
  });
});
