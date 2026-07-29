import { describe, expect, test } from "vitest";
import {
  actorQueContradiceElNombre,
  contar,
  sinTildes,
  textoDeActualizacion,
  textoDeAlias,
  textoDeCanalPorDefecto,
  textoDeHerencia,
} from "./vocabulario";

// Cada caso reemplaza una cadena literal medida en `acrconta`
// (docs/plan-fuentes-legibles-2026-07.md §1.1, hallazgo A5).

describe("textoDeHerencia", () => {
  test("reemplaza «20 heredan · 0 excepciones»", () => {
    expect(textoDeHerencia(20, 0)).toBe("20 recopiladores usan este canal · ninguno con excepción");
  });

  test("mantiene la excepción visible cuando la hay", () => {
    expect(textoDeHerencia(4, 1)).toBe("4 recopiladores usan este canal · 1 con excepción");
    expect(textoDeHerencia(4, 3)).toBe("4 recopiladores usan este canal · 3 con excepción");
  });

  test("singular y estado vacío", () => {
    expect(textoDeHerencia(1, 0)).toBe("1 recopilador usa este canal · ninguno con excepción");
    expect(textoDeHerencia(0, 0)).toBe("Sin recopiladores");
  });
});

describe("textoDeCanalPorDefecto", () => {
  test("reemplaza «Base Ficha QR»", () => {
    expect(textoDeCanalPorDefecto("Ficha QR")).toBe("Canal por defecto: Ficha QR");
    expect(textoDeCanalPorDefecto("")).toBe("Sin canal por defecto");
  });
});

describe("textoDeAlias", () => {
  test("reemplaza «Sin alias operativo» por lo que el usuario realmente ve", () => {
    expect(textoDeAlias("", "Email Invitation 10")).toBe("Usa el nombre de la plataforma");
    expect(textoDeAlias("Docentes ronda 2", "Email Invitation 10")).toBe("Docentes ronda 2");
    expect(textoDeAlias("", "")).toBe("Sin nombre");
  });
});

describe("textoDeActualizacion", () => {
  test("dice cuándo, no «Snapshot local listo»", () => {
    expect(textoDeActualizacion("2026-07-23T18:09:00Z")).toMatch(/^Actualizada /);
  });

  test("sin fecha o con fecha ilegible no inventa una", () => {
    expect(textoDeActualizacion(null)).toBe("Sin actualizar");
    expect(textoDeActualizacion("")).toBe("Sin actualizar");
    expect(textoDeActualizacion("no es una fecha")).toBe("Sin actualizar");
  });
});

describe("contar (R3)", () => {
  test("un cero se lee como estado, no como dato", () => {
    expect(contar(0, "encuesta", "encuestas")).toBe("Sin encuestas");
    expect(contar(1, "encuesta", "encuestas")).toBe("1 encuesta");
    expect(contar(7, "encuesta", "encuestas")).toBe("7 encuestas");
  });

  test("los miles se separan como en el resto de la app", () => {
    expect(contar(1277, "registro", "registros")).toBe("1,277 registros");
  });
});

// El defecto que motiva esto: al conectar una fuente el actor se elige en el
// paso 1 —antes de ver de qué encuesta se trata— y el paso 3 afirmaba
// «respuestas de Administrativos» sobre una encuesta llamada «…Estudiantes».
// Nada fallaba: el corte repartía las respuestas al actor equivocado y solo se
// notaba al revisar denominadores.

describe("sinTildes", () => {
  test("iguala lo que escribe una persona con lo que trae la plataforma", () => {
    expect(sinTildes("Egresados")).toBe(sinTildes("egresados"));
    expect(sinTildes("  Administración  ")).toBe("administracion");
  });
});

describe("actorQueContradiceElNombre", () => {
  const ACTORES = ["Estudiantes", "Docentes", "Egresados", "Administrativos"];

  test("avisa cuando el nombre menciona otro actor del estudio", () => {
    expect(actorQueContradiceElNombre("Acreditación 2026 — Estudiantes", "Administrativos", ACTORES))
      .toBe("Estudiantes");
  });

  test("no avisa cuando coinciden, aunque difieran tildes y mayúsculas", () => {
    expect(actorQueContradiceElNombre("Encuesta EGRESADOS 2026", "egresados", ACTORES)).toBeNull();
  });

  test("no avisa cuando el nombre no menciona a ningún actor conocido", () => {
    // Una palabra suelta no basta: buscar cualquier término daría avisos falsos
    // sobre nombres genéricos como «Formulario final v3».
    expect(actorQueContradiceElNombre("Formulario final v3", "Docentes", ACTORES)).toBeNull();
  });

  test("no avisa cuando el nombre menciona a los dos", () => {
    // «Docentes y Estudiantes» no desmiente que se declare para Docentes.
    expect(actorQueContradiceElNombre("Base Docentes y Estudiantes", "Docentes", ACTORES)).toBeNull();
  });

  test("calla mientras no haya actor declarado o nombre que leer", () => {
    // En el paso 3 el nombre ya está, pero el actor puede haberse vaciado para
    // corregirlo: avisar mientras se escribe sería ruido.
    expect(actorQueContradiceElNombre("Acreditación — Estudiantes", "", ACTORES)).toBeNull();
    expect(actorQueContradiceElNombre("", "Docentes", ACTORES)).toBeNull();
  });
});
