// La campaña telefónica (P10): normalizador de la configuración y navegación canónica.
import { describe, expect, it } from "vitest";

import { resolverSeccionTelefonica } from "../features/recopiladores/telefonica/navegacionTelefonica";
import { partirLista } from "../features/recopiladores/telefonica/modeloTelefonico";
import { normalizarConfigTelefonica } from "./materialTelefonica";

describe("normalizarConfigTelefonica", () => {
  it("lee la configuración con escalares de R y descarta lo que no tiene forma", () => {
    const c = normalizarConfigTelefonica({
      campaign_id: ["telefonica.principal"],
      llave: "Código proGres",
      estratos: ["Periodo de Llegada"],
      telefonos: [3],
      reemplazo: [true],
      muestra: [400],
      backup: 400,
      responsables: {},
      status: [{ codigo: "efectivo", status: "Efectivo", clase: "efectiva" }, { codigo: "x", status: "", clase: "rara" }, { codigo: "y", status: "Raro", clase: "otra" }],
      status_propio: [false],
      revision: [2],
      lee_monitoreo: ["Código proGres", "Status"],
    });
    expect(c.telefonos).toBe(3);
    expect(c.reemplazo).toBe(true);
    expect(c.muestra + c.backup).toBe(800);
    expect(c.responsables).toEqual([]);
    expect(c.status).toEqual([{ codigo: "efectivo", status: "Efectivo", clase: "efectiva" }, { codigo: "y", status: "Raro", clase: "pendiente" }]);
    expect(c.revision).toBe(2);
  });

  it("un payload vacío cae en valores seguros", () => {
    expect(normalizarConfigTelefonica(null)).toMatchObject({ llave: "Código", telefonos: 2, muestra: 0, revision: 0, status: [] });
  });
});

describe("navegación y listas de la campaña telefónica", () => {
  it("la sección o pestaña desconocida cae en la primera de su nivel", () => {
    expect(resolverSeccionTelefonica("barrido", "status")).toEqual({ seccion: "barrido", pestana: "status" });
    expect(resolverSeccionTelefonica("barrido", "otra")).toEqual({ seccion: "barrido", pestana: "plantilla" });
    expect(resolverSeccionTelefonica("nada", null)).toEqual({ seccion: "casos", pestana: "configuracion" });
  });

  it("parte una lista por comas, sin vacíos ni repetidos", () => {
    expect(partirLista("Sede, Periodo de Llegada,, Sede\nComponente")).toEqual(["Sede", "Periodo de Llegada", "Componente"]);
  });
});
