import { describe, expect, it } from "vitest";

import type { AsignacionTerritorial, ZonaDeCuotas } from "../../../api/materialTerritorial";
import { filasDeZonas } from "./ZonasAsignadas";

const zona = (id: string, nombre: string): ZonaDeCuotas => ({ id_zona: id, nombre, ubigeo: id, n: 200, cuotas: [] } as unknown as ZonaDeCuotas);

describe("quién cubre cada zona (cuotas, revamp v5)", () => {
  it("junta a los encuestadores de una zona y deja primero las que no tienen", () => {
    const asignacion = {
      equipo: [{ codigo: "E03", nombre: "Rosa Quispe" }, { codigo: "E04", nombre: "Mery Flores" }],
      asignacion: [
        { id_manzana: "150103", codigo: "E03" },
        { id_manzana: "150135", codigo: "E04" },
        { id_manzana: "150135", codigo: "E12" },
        { id_manzana: "150108", codigo: "" },
      ],
    } as unknown as AsignacionTerritorial;
    const filas = filasDeZonas([zona("150103", "Ate"), zona("150108", "Chorrillos"), zona("150135", "San Martín de Porres")], asignacion);
    expect(filas.map((f) => f.zona.nombre)).toEqual(["Chorrillos", "Ate", "San Martín de Porres"]);
    expect(filas[2].encuestadores).toEqual(["Mery Flores (E04)", "E12"]);
  });

  it("sin asignación todas quedan sin encuestador", () => {
    expect(filasDeZonas([zona("1", "A")], null)[0].encuestadores).toEqual([]);
  });
});
