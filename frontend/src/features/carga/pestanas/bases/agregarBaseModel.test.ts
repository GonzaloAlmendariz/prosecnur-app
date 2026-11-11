import { describe, expect, it } from "vitest";
import {
  acotarEntradas,
  entradasPrevistasDe,
  focoDelInspector,
  origenDeLaDireccion,
  origenesDeAlta,
  searchConAgregarBase,
  searchConAgregarFuente,
  searchConInspector,
  searchConRelacion,
  searchSinPanelNiFoco,
} from "./agregarBaseModel";

const ids = (o: { id: string }[]) => o.map((x) => x.id);

describe("origenesDeAlta", () => {
  it("con una base ofrece los cuatro orígenes de la carga simple", () => {
    expect(ids(origenesDeAlta({ varias: false, estrategia: "separate", hayPublicados: true }))).toEqual(["archivos", "surveymonkey", "kobo", "monitoreo"]);
  });

  it("con bases separadas ofrece los seis de Bases del estudio y el formulario publicado solo si hay alguno", () => {
    expect(ids(origenesDeAlta({ varias: true, estrategia: "separate", hayPublicados: false }))).toEqual(["surveymonkey", "kobo", "archivos", "sav", "monitoreo", "varias"]);
    expect(ids(origenesDeAlta({ varias: true, estrategia: "separate", hayPublicados: true }))[0]).toBe("formulario");
  });

  it("con integrada o independientes, el asistente de varias a la vez va primero y lleva su nombre", () => {
    const integrada = origenesDeAlta({ varias: true, estrategia: "integrated", hayPublicados: true });
    expect(ids(integrada)).toEqual(["varias", "monitoreo", "sav"]);
    expect(integrada[0].rotulo).toBe("Varias fuentes en una base");
    expect(origenesDeAlta({ varias: true, estrategia: "independent", hayPublicados: false })[0].rotulo).toBe("Varias encuestas a la vez");
  });
});

describe("dirección del recorrido y del inspector", () => {
  it("el origen vive en el foco solo mientras el recorrido de alta está abierto", () => {
    expect(origenDeLaDireccion("?pestana=bases&panel=agregar-base&foco=kobo")).toBe("kobo");
    expect(origenDeLaDireccion("?pestana=bases&panel=agregar-base")).toBeNull();
    expect(origenDeLaDireccion("?pestana=bases&panel=agregar-base&foco=docentes")).toBeNull();
    expect(origenDeLaDireccion("?pestana=bases&foco=kobo")).toBeNull();
  });

  it("el foco del recorrido no abre el inspector", () => {
    expect(focoDelInspector("agregar-base", "kobo")).toBeNull();
    expect(focoDelInspector("agregar-fuente", "docentes")).toBe("docentes");
    expect(focoDelInspector(null, "docentes")).toBe("docentes");
    expect(focoDelInspector(null, " ")).toBeNull();
  });

  it("escribe las direcciones canónicas y conserva lo demás", () => {
    expect(searchConAgregarBase("?pestana=bases&foco=docentes", null)).toBe("?pestana=bases&panel=agregar-base");
    expect(searchConAgregarBase("?pestana=bases", "sav")).toBe("?pestana=bases&panel=agregar-base&foco=sav");
    expect(searchConInspector("?pestana=bases&panel=agregar-base&foco=sav", "docentes")).toBe("?pestana=bases&foco=docentes");
    expect(searchConInspector("?pestana=bases&panel=relacion", "docentes")).toBe("?pestana=bases&panel=relacion&foco=docentes");
    expect(searchConInspector("?pestana=bases&foco=docentes", null)).toBe("?pestana=bases");
    expect(searchSinPanelNiFoco("?pestana=bases&panel=agregar-base&foco=sav")).toBe("?pestana=bases");
    expect(searchConAgregarFuente("?pestana=bases&foco=docentes", "docentes")).toBe("?pestana=bases&foco=docentes&panel=agregar-fuente");
    expect(searchConRelacion("?pestana=bases&foco=docentes")).toBe("?pestana=bases&foco=docentes&panel=relacion");
  });
});

describe("número previsto y foco con Comparar abierto", () => {
  it("nombra lo que se prevé según el asistente y acota lo tecleado", () => {
    expect(entradasPrevistasDe("integrated")).toEqual({ rotulo: "Fuentes previstas", maximo: 16 });
    expect(entradasPrevistasDe("independent")).toEqual({ rotulo: "Bases previstas", maximo: 10 });
    expect(entradasPrevistasDe("separate")).toEqual({ rotulo: "Bases previstas", maximo: 16 });
    expect(acotarEntradas(3, 2, 16)).toBe(3);
    expect(acotarEntradas(0, 2, 16)).toBe(2);
    expect(acotarEntradas(40, 1, 10)).toBe(10);
    expect(acotarEntradas(Number.NaN, 2, 16)).toBe(2);
    expect(acotarEntradas(2.7, 1, 16)).toBe(2);
  });

  it("con Comparar abierto el inspector es el de la base enfocada al abrir", () => {
    expect(focoDelInspector("comparar-fuentes", "docentes~estudiantes", { focoAlCerrar: "docentes" })).toBe("docentes");
    expect(focoDelInspector("comparar-fuentes", "docentes~estudiantes", null)).toBeNull();
  });
});
