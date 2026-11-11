import { describe, expect, it } from "vitest";
import {
  acotarEntradas,
  ayudaDeEntradas,
  previstasVisibles,
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

describe("número previsto coherente con lo que se ve (oleada 15-B)", () => {
  it("con bases separadas no baja de las que hay más el lugar libre del asistente", () => {
    expect(previstasVisibles({ estrategia: "separate", previstas: 1, existentes: 1 })).toEqual({ valor: 2, minimo: 2 });
    expect(previstasVisibles({ estrategia: "separate", previstas: 4, existentes: 1 })).toEqual({ valor: 4, minimo: 2 });
    expect(previstasVisibles({ estrategia: "separate", previstas: 1, existentes: 0 })).toEqual({ valor: 1, minimo: 1 });
  });

  it("en una base integrada el piso son las fuentes que ya tiene", () => {
    expect(previstasVisibles({ estrategia: "integrated", previstas: 2, existentes: 2 })).toEqual({ valor: 2, minimo: 2 });
    expect(previstasVisibles({ estrategia: "independent", previstas: 1, existentes: 0 })).toEqual({ valor: 1, minimo: 1 });
  });

  it("la ayuda dice los topes y lo que resulta, con concordancia", () => {
    expect(ayudaDeEntradas("integrated", 2, 16, 2)).toBe("Entre 2 y 16; se unen en una base.");
    expect(ayudaDeEntradas("separate", 2, 16, 1)).toBe("Entre 2 y 16; 1 base ya está en el estudio.");
    expect(ayudaDeEntradas("separate", 4, 16, 3)).toBe("Entre 4 y 16; 3 bases ya están en el estudio.");
    expect(ayudaDeEntradas("independent", 1, 10, 0)).toBe("Entre 1 y 10.");
  });
});
