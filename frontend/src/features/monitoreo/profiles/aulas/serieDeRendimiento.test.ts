import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { PESO_DEL_PRIOR } from "./rendimientoPorFacultad";
import { serieDeRendimiento } from "./serieDeRendimiento";

const parte = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

describe("serieDeRendimiento", () => {
  it("mide lo que deja cada visita, no cuánto produjo la facultad", () => {
    // El caso que separa rendimiento de producción: Grande aplica 6 aulas y saca
    // 120; Chica aplica 2 y saca 44. Grande produce más y rinde menos.
    const partes = [
      ...Array.from({ length: 6 }, () => parte({ faculty: "Grande", applied_at: "2026-08-10", effective_surveys: 20 })),
      ...Array.from({ length: 2 }, () => parte({ faculty: "Chica", applied_at: "2026-08-10", effective_surveys: 22 })),
    ];
    const { facultades } = serieDeRendimiento(partes);
    const grande = facultades.find((f) => f.facultad === "Grande")!;
    const chica = facultades.find((f) => f.facultad === "Chica")!;
    expect(grande.efectivas).toBe(120);
    expect(chica.efectivas).toBe(44);
    expect(grande.observadoFinal).toBe(20);
    expect(chica.observadoFinal).toBe(22);
  });

  it("el esperado encoge hacia la media del estudio cuando hay poca evidencia", () => {
    // Una sola aula con 40 encuestas en un estudio cuya media es 20: el
    // observado dice 40 y el esperado NO, porque una observación no manda.
    const partes = [
      parte({ faculty: "Nueva", applied_at: "2026-08-10", effective_surveys: 40 }),
      ...Array.from({ length: 19 }, () => parte({ faculty: "Vieja", applied_at: "2026-08-10", effective_surveys: 19 })),
    ];
    const { facultades, mediaDelEstudio } = serieDeRendimiento(partes);
    const nueva = facultades.find((f) => f.facultad === "Nueva")!;
    expect(nueva.observadoFinal).toBe(40);
    expect(nueva.esperadoFinal).toBeLessThan(40);
    expect(nueva.esperadoFinal).toBeGreaterThan(mediaDelEstudio);
    // La fórmula, explícita: (40 + 5×media) / (1 + 5).
    const esperado = (40 + PESO_DEL_PRIOR * mediaDelEstudio) / (1 + PESO_DEL_PRIOR);
    expect(nueva.esperadoFinal).toBeCloseTo(Math.round(esperado * 10) / 10, 1);
  });

  it("con mucha evidencia el esperado se acerca a lo observado", () => {
    const muchas = Array.from({ length: 40 }, () => parte({ faculty: "Firme", applied_at: "2026-08-10", effective_surveys: 30 }));
    const otras = Array.from({ length: 40 }, () => parte({ faculty: "Otra", applied_at: "2026-08-10", effective_surveys: 10 }));
    const { facultades } = serieDeRendimiento([...muchas, ...otras]);
    const firme = facultades.find((f) => f.facultad === "Firme")!;
    expect(firme.observadoFinal).toBe(30);
    expect(Math.abs(firme.esperadoFinal - 30)).toBeLessThan(1.5);
  });

  it("el prior de cada día es la media HASTA ese día, no la final", () => {
    // Si usara la media final, el esperado del día 1 conocería el día 2 y la
    // línea de ayer cambiaría al llegar la de hoy.
    const partes = [
      parte({ faculty: "A", applied_at: "2026-08-10", effective_surveys: 10 }),
      parte({ faculty: "B", applied_at: "2026-08-11", effective_surveys: 40 }),
    ];
    const { facultades } = serieDeRendimiento(partes);
    const a = facultades.find((f) => f.facultad === "A")!;
    // Día 1: sólo existe A con 10, así que la media del estudio es 10 y el
    // esperado de A es exactamente 10 —no lo mueve el 40 que llega mañana—.
    expect(a.dias[0].esperado).toBe(10);
  });

  it("un día sin aulas no inventa un rendimiento de cero", () => {
    const partes = [
      parte({ faculty: "A", applied_at: "2026-08-10", effective_surveys: 20 }),
      parte({ faculty: "B", applied_at: "2026-08-11", effective_surveys: 20 }),
    ];
    const { facultades } = serieDeRendimiento(partes);
    const a = facultades.find((f) => f.facultad === "A")!;
    expect(a.dias).toHaveLength(2);
    expect(a.dias[1].aulas).toBe(0);
    // `null` y no 0: ese día no rindió cero, es que no fue a ninguna aula.
    expect(a.dias[1].porAula).toBeNull();
    // El acumulado, en cambio, no se pierde.
    expect(a.dias[1].aulasAcumuladas).toBe(1);
  });

  it("ordena por lo que decide mañana: el esperado", () => {
    const partes = [
      ...Array.from({ length: 10 }, () => parte({ faculty: "Baja", applied_at: "2026-08-10", effective_surveys: 8 })),
      ...Array.from({ length: 10 }, () => parte({ faculty: "Alta", applied_at: "2026-08-10", effective_surveys: 28 })),
    ];
    const { facultades } = serieDeRendimiento(partes);
    expect(facultades.map((f) => f.facultad)).toEqual(["Alta", "Baja"]);
  });

  it("una fila sin fecha no entra en la serie", () => {
    const { facultades, fechas } = serieDeRendimiento([
      parte({ faculty: "A", applied_at: "", effective_surveys: 99 }),
    ]);
    expect(fechas).toEqual([]);
    expect(facultades).toEqual([]);
  });
});
