import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { agendaPorFacultad } from "./agendaPorFacultad";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

describe("agendaPorFacultad", () => {
  it("dentro de la facultad, en el orden en que hay que ir", () => {
    const [f] = agendaPorFacultad([
      fila({ operational_code: "CH 2", faculty: "Derecho", scheduled_date: "2026-08-12", scheduled_time: "10:00" }),
      fila({ operational_code: "CH 1", faculty: "Derecho", scheduled_date: "2026-08-10", scheduled_time: "16:00" }),
      fila({ operational_code: "CH 3", faculty: "Derecho", scheduled_date: "2026-08-10", scheduled_time: "08:00" }),
    ]);
    expect(f.aulas.map((a) => a.codigo)).toEqual(["CH 3", "CH 1", "CH 2"]);
  });

  it("un aula sin fecha va al FINAL de su facultad, no al principio", () => {
    // Ordenando por cadena, «» es la menor y encabezaría el grupo: la vista
    // abriría por lo único que no se puede planificar.
    const [f] = agendaPorFacultad([
      fila({ operational_code: "SIN", faculty: "Letras" }),
      fila({ operational_code: "CON", faculty: "Letras", scheduled_date: "2026-08-11" }),
    ]);
    expect(f.aulas.map((a) => a.codigo)).toEqual(["CON", "SIN"]);
    expect(f.primeraFecha).toBe("2026-08-11");
  });

  it("las facultades por el día en que empiezan", () => {
    const salida = agendaPorFacultad([
      fila({ operational_code: "A", faculty: "Tarde", scheduled_date: "2026-08-20" }),
      fila({ operational_code: "B", faculty: "Temprano", scheduled_date: "2026-08-10" }),
    ]);
    expect(salida.map((f) => f.facultad)).toEqual(["Temprano", "Tarde"]);
  });

  it("una facultad entera sin fechas va al final", () => {
    const salida = agendaPorFacultad([
      fila({ operational_code: "A", faculty: "SinFecha" }),
      fila({ operational_code: "B", faculty: "ConFecha", scheduled_date: "2026-08-20" }),
    ]);
    expect(salida.map((f) => f.facultad)).toEqual(["ConFecha", "SinFecha"]);
  });

  it("«en marcha» son las que ya no están sólo planificadas", () => {
    const [f] = agendaPorFacultad([
      fila({ operational_code: "A", faculty: "X", operational_status: "aplicada" }),
      fila({ operational_code: "B", faculty: "X", operational_status: "planificada" }),
      // Sin estado declarado se cuenta como planificada, igual que en el resto
      // del perfil: es el valor por defecto del motor.
      fila({ operational_code: "C", faculty: "X" }),
    ]);
    expect(f.enMarcha).toBe(1);
    expect(f.aulas).toHaveLength(3);
  });
});
