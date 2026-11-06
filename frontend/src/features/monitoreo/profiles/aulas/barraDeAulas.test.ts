import { describe, expect, it, vi } from "vitest";
import { construirBarraDeAulas } from "./barraDeAulas";

// L38: un solo «Actualizar ▾»; el viejo «Avance» y «Recalcular sin leer» en su menú.
const base = {
  registros: 3051,
  syncedAt: "2026-09-18T16:42:00",
  generationStatus: "",
  pendienteDeRecalcular: false,
  hayEstado: true,
  cargando: false,
  actualizando: false,
  error: "",
  ocupado: false,
  importado: true,
  tituloActualizar: "Pide las respuestas nuevas",
};

describe("barra de Cursos-horario", () => {
  it("un solo Actualizar que abre el panel, con Recalcular y Releer el avance en el menú", () => {
    const onActualizar = vi.fn();
    const barra = construirBarraDeAulas({ ...base, onActualizar, onRecalcular: vi.fn(), onReleerAvance: vi.fn() });
    expect(barra.actualizar.etiqueta).toBe("Actualizar");
    barra.actualizar.onElegir();
    expect(onActualizar).toHaveBeenCalledOnce();
    expect(barra.otrasActualizaciones?.map((a) => a.etiqueta)).toEqual(["Recalcular sin traer", "Releer el avance"]);
    expect(barra.indicadores[0]).toEqual({ etiqueta: "Registros", valor: "3,051" });
    expect(barra.estado).toEqual({ clave: "al-dia" });
  });

  it("sin plan importado, Actualizar y Recalcular se apagan; corriendo, la píldora lo dice", () => {
    const barra = construirBarraDeAulas({ ...base, importado: false, actualizando: true, onActualizar: vi.fn(), onRecalcular: vi.fn(), onReleerAvance: vi.fn() });
    expect(barra.actualizar.disabled).toBe(true);
    expect(barra.otrasActualizaciones?.[0].disabled).toBe(true);
    expect(barra.otrasActualizaciones?.[1].disabled).toBe(false);
    expect(barra.estado.clave).toBe("actualizando");
  });
});
