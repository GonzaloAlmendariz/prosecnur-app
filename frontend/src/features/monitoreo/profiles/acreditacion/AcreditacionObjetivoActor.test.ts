import { describe, expect, it } from "vitest";
import {
  ACREDITACION_UNIVERSO_BARRIBLE,
  acreditacionLecturaObjetivo,
  acreditacionObjetivoDeGoals,
  acreditacionObjetivoSugerido,
  acreditacionTitularObjetivo,
} from "./AcreditacionObjetivoActor";

describe("objetivo sugerido por tamaño de universo", () => {
  it("propone barrido para universos chicos y mínimo para los grandes", () => {
    expect(acreditacionObjetivoSugerido(16)).toBe("barrido");
    expect(acreditacionObjetivoSugerido(ACREDITACION_UNIVERSO_BARRIBLE)).toBe("barrido");
    expect(acreditacionObjetivoSugerido(ACREDITACION_UNIVERSO_BARRIBLE + 1)).toBe("minimo");
  });

  it("sin universo no propone barrido", () => {
    expect(acreditacionObjetivoSugerido(0)).toBe("minimo");
  });
});

describe("lectura de los actores reales de acrconta", () => {
  // Los tres primeros están a 1, 1 y 7 respuestas de barrer todo y la UI los
  // daba por cerrados con un badge verde de "Meta cubierta".
  it("Administrativos: mínimo cubierto pero universo pendiente", () => {
    const l = acreditacionLecturaObjetivo({ universo: 16, efectivas: 15, minimo: 15 });
    expect(l.objetivo).toBe("barrido");
    expect(l.minimoCubierto).toBe(true);
    expect(l.cumplido).toBe(false);
    expect(l.faltan).toBe(1);
    expect(l.universoPendiente).toBe(1);
  });

  it("Docentes: 52 de 53", () => {
    const l = acreditacionLecturaObjetivo({ universo: 53, efectivas: 52, minimo: 38 });
    expect(l.objetivo).toBe("barrido");
    expect(l.faltan).toBe(1);
    expect(l.minimoCubierto).toBe(true);
  });

  it("Estudiantes: 173 de 180", () => {
    const l = acreditacionLecturaObjetivo({ universo: 180, efectivas: 173, minimo: 126 });
    expect(l.objetivo).toBe("barrido");
    expect(l.faltan).toBe(7);
    expect(Math.round(l.avancePct ?? 0)).toBe(96);
  });

  it("Egresados: universo grande, el mínimo es el acuerdo", () => {
    const l = acreditacionLecturaObjetivo({ universo: 270, efectivas: 178, minimo: 108 });
    expect(l.objetivo).toBe("minimo");
    expect(l.cumplido).toBe(true);
    expect(l.faltan).toBe(0);
    // La otra lectura NO desaparece: quedan 92 del universo por trabajar.
    expect(l.universoPendiente).toBe(92);
  });
});

describe("la declaración manda sobre la sugerencia", () => {
  it("un universo grande declarado como barrido se mide contra el universo", () => {
    const l = acreditacionLecturaObjetivo({ universo: 270, efectivas: 178, minimo: 108, objetivoDeclarado: "barrido" });
    expect(l.objetivo).toBe("barrido");
    expect(l.sugerido).toBe(false);
    expect(l.faltan).toBe(92);
    expect(l.cumplido).toBe(false);
    expect(l.minimoCubierto).toBe(true);
  });

  it("un universo chico declarado como mínimo se mide contra el mínimo", () => {
    const l = acreditacionLecturaObjetivo({ universo: 16, efectivas: 15, minimo: 15, objetivoDeclarado: "minimo" });
    expect(l.objetivo).toBe("minimo");
    expect(l.cumplido).toBe(true);
    expect(l.universoPendiente).toBe(1);
  });

  it("un valor de objetivo inválido cae a la sugerencia", () => {
    const l = acreditacionLecturaObjetivo({ universo: 16, efectivas: 15, minimo: 15, objetivoDeclarado: "cualquiera" });
    expect(l.objetivo).toBe("barrido");
    expect(l.sugerido).toBe(true);
  });

  it("declarar barrido sin universo no inventa un denominador", () => {
    const l = acreditacionLecturaObjetivo({ universo: 0, efectivas: 4, minimo: 10, objetivoDeclarado: "barrido" });
    expect(l.objetivo).toBe("minimo");
    expect(l.denominador).toBe(10);
  });
});

describe("titular", () => {
  it("bajo barrido habla de lo que falta del universo", () => {
    const l = acreditacionLecturaObjetivo({ universo: 180, efectivas: 173, minimo: 126 });
    expect(acreditacionTitularObjetivo(l, 126, 173)).toBe("Faltan 7 de 180");
  });

  it("bajo mínimo habla del mínimo y del porcentaje logrado", () => {
    const l = acreditacionLecturaObjetivo({ universo: 270, efectivas: 178, minimo: 108 });
    expect(acreditacionTitularObjetivo(l, 108, 178)).toBe("Mínimo 108 · 178 logradas (165%)");
  });

  it("universo cubierto lo dice explícitamente", () => {
    const l = acreditacionLecturaObjetivo({ universo: 16, efectivas: 16, minimo: 15 });
    expect(acreditacionTitularObjetivo(l, 15, 16)).toBe("Universo cubierto (16)");
  });
});

describe("lectura del objetivo declarado en las metas", () => {
  const goals = [
    { filters: { dim_actor: "Egresados" }, meta: 108, objetivo: "barrido" as const },
    { filters: { dim_actor: "Docentes" }, meta: 38 },
  ];

  it("encuentra el objetivo declarado ignorando tildes y capitalización", () => {
    expect(acreditacionObjetivoDeGoals(goals, "egresados")).toBe("barrido");
    expect(acreditacionObjetivoDeGoals(goals, "EGRESADOS")).toBe("barrido");
  });

  it("devuelve null cuando el actor no declara objetivo", () => {
    expect(acreditacionObjetivoDeGoals(goals, "Docentes")).toBeNull();
    expect(acreditacionObjetivoDeGoals(goals, "Empleadores")).toBeNull();
    expect(acreditacionObjetivoDeGoals(goals, "")).toBeNull();
  });
});
