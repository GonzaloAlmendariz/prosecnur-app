// Hallazgo 13 (auditoría de Arte): los atajos de Láminas quedan registrados y se ven; ⌘ en macOS, Ctrl en Windows.
import { describe, expect, it, vi } from "vitest";
import { accionDeTecla, ariaDeAccion, ATAJOS_VISOR, atenderAtajoVisor, teclaDeAccion, type AccionesVisor } from "./atajosVisor";

const ev = (key: string, o: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; defaultPrevented: boolean }> = {}) => ({
  key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, defaultPrevented: false, preventDefault: vi.fn(), ...o,
});

describe("atajos del visor de láminas", () => {
  it("registra los cuatro: Estructura, Ajustes, Insertar y Siguiente sin título", () => {
    expect(Object.keys(ATAJOS_VISOR).sort()).toEqual(["ajustes", "estructura", "insertar", "siguienteSinTitulo"]);
    expect(accionDeTecla(ev("1", { metaKey: true }), true)).toBe("estructura");
    expect(accionDeTecla(ev(".", { metaKey: true }), true)).toBe("ajustes");
    expect(accionDeTecla(ev("k", { metaKey: true }), true)).toBe("insertar");
    expect(accionDeTecla(ev("Enter", { metaKey: true }), true)).toBe("siguienteSinTitulo");
  });

  it("escucha el modificador de cada sistema y nada más", () => {
    expect(accionDeTecla(ev("k", { ctrlKey: true }), false)).toBe("insertar");
    expect(accionDeTecla(ev("k", { ctrlKey: true }), true)).toBeNull();
    expect(accionDeTecla(ev("k"), true)).toBeNull();
    expect(accionDeTecla(ev("k", { metaKey: true, shiftKey: true }), true)).toBeNull();
    expect(accionDeTecla(ev("1", { metaKey: true, altKey: true }), true)).toBeNull();
  });

  it("rotula la tecla del sistema para el globo y aria-keyshortcuts", () => {
    expect(teclaDeAccion("estructura", false)).toBe("Ctrl+1");
    expect(teclaDeAccion("insertar", false)).toBe("Ctrl+K");
    expect(ariaDeAccion("siguienteSinTitulo", true)).toBe("Meta+Enter");
    expect(ariaDeAccion("ajustes", false)).toBe("Control+.");
  });

  it("actúa y consume; con un diálogo encima o la tecla ya usada, no", () => {
    const a: AccionesVisor = { activo: true, estructura: vi.fn(), ajustes: vi.fn(), insertar: vi.fn(), siguienteSinTitulo: vi.fn() };
    const e = ev("k", { ctrlKey: true });
    expect(atenderAtajoVisor(e, a, false)).toBe(true);
    expect(a.insertar).toHaveBeenCalledOnce();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(atenderAtajoVisor(ev("k", { ctrlKey: true }), { ...a, activo: false }, false)).toBe(false);
    expect(atenderAtajoVisor(ev("Enter", { ctrlKey: true, defaultPrevented: true }), a, false)).toBe(false);
    expect(a.siguienteSinTitulo).not.toHaveBeenCalled();
  });
});
