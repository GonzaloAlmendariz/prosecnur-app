import { describe, expect, it } from "vitest";
import type { MonitoreoActorUnit, MonitoreoSource } from "../../../api/client";
import {
  claveDeActor,
  conflictoDeCardinalidad,
  cuentaDelActor,
  cuentasPorActor,
  elencoVisible,
  faltantesDelActor,
  nombreDisponible,
  tieneCanalTelefonico,
} from "./rosterDeActores";

function fuente(id: string, role: string, actor: string): MonitoreoSource {
  return { id, kind: "google_sheets", label: id, enabled: true, role, dimensions: { actor, segmento: actor } } as unknown as MonitoreoSource;
}

function unidad(actor: string, opts: Partial<MonitoreoActorUnit> = {}): MonitoreoActorUnit {
  return {
    id: claveDeActor(actor),
    type: "actor",
    actor,
    label: actor,
    segment: "",
    group: "",
    origin: "declarado",
    phone: { enabled: false, role: "none" },
    ...opts,
  };
}

describe("claveDeActor", () => {
  it("colapsa mayúsculas, espacios y tildes en la misma clave", () => {
    expect(claveDeActor("Egresados")).toBe(claveDeActor(" egresados "));
    expect(claveDeActor("Administrativós")).toBe(claveDeActor("administrativos"));
  });

  it("deja vacía la ausencia de actor en vez de inventar un nombre", () => {
    // El backend cayó justo aquí: su `safe_name("")` devuelve «campo», así que
    // una fuente sin actor entraba al elenco como un actor llamado «campo».
    expect(claveDeActor("")).toBe("");
    expect(claveDeActor("   ")).toBe("");
    expect(claveDeActor(null)).toBe("");
  });
});

describe("cuentasPorActor", () => {
  it("separa universo, respuestas y barrido por actor", () => {
    const cuentas = cuentasPorActor([
      fuente("s1", "universo", "Egresados"),
      fuente("s2", "respuestas", "Egresados"),
      fuente("s3", "respuestas", "Egresados"),
      fuente("s4", "barrido", "Egresados"),
      fuente("s5", "universo", "Docentes"),
    ]);

    expect(cuentas.get("egresados")).toEqual({ actor: "Egresados", universo: 1, respuestas: 2, barrido: 1 });
    expect(cuentas.get("docentes")?.universo).toBe(1);
  });

  it("no crea una entrada para una fuente sin actor", () => {
    const cuentas = cuentasPorActor([fuente("s1", "universo", "")]);
    expect(cuentas.size).toBe(0);
  });

  it("agrupa el mismo actor escrito distinto", () => {
    const cuenta = cuentaDelActor(
      [fuente("s1", "universo", "Egresados"), fuente("s2", "respuestas", "egresados ")],
      "EGRESADOS",
    );
    expect(cuenta.universo).toBe(1);
    expect(cuenta.respuestas).toBe(1);
  });
});

describe("conflictoDeCardinalidad", () => {
  const elenco = [unidad("Egresados", { phone: { enabled: true, role: "target" } }), unidad("Docentes")];
  const sources = [fuente("s1", "universo", "Egresados"), fuente("s2", "barrido", "Egresados")];

  it("corta el segundo universo del mismo actor", () => {
    const conflicto = conflictoDeCardinalidad({ sources, elenco, papel: "universo", actor: "Egresados" });
    expect(conflicto?.code).toBe("E_MONITOREO_ACTOR_UNIVERSO_DUPLICADO");
  });

  it("corta el segundo barrido del mismo actor", () => {
    const conflicto = conflictoDeCardinalidad({ sources, elenco, papel: "barrido", actor: "Egresados" });
    expect(conflicto?.code).toBe("E_MONITOREO_ACTOR_BARRIDO_DUPLICADO");
  });

  it("exige canal telefónico declarado para el barrido", () => {
    const conflicto = conflictoDeCardinalidad({ sources: [], elenco, papel: "barrido", actor: "Docentes" });
    expect(conflicto?.code).toBe("E_MONITOREO_ACTOR_SIN_CANAL_TELEFONICO");
  });

  it("permite reeditar la misma fuente", () => {
    // Guardar dos veces el mismo padrón reemplaza por id; sin esta salvedad la
    // segunda vez sería un error y el usuario no podría corregir su propia hoja.
    expect(conflictoDeCardinalidad({
      sources, elenco, papel: "universo", actor: "Egresados", idExcluido: "s1",
    })).toBeNull();
  });

  it("permite el primer padrón de otro actor y no limita las respuestas", () => {
    expect(conflictoDeCardinalidad({ sources, elenco, papel: "universo", actor: "Docentes" })).toBeNull();
    // acrconta tiene tres encuestas para Egresados: el boceto pide AL MENOS
    // una, no exactamente una.
    expect(conflictoDeCardinalidad({ sources, elenco, papel: "respuestas", actor: "Egresados" })).toBeNull();
  });

  it("no bloquea a un actor que todavía no está en el elenco", () => {
    expect(conflictoDeCardinalidad({ sources: [], elenco, papel: "barrido", actor: "Empleadores" })).toBeNull();
  });
});

describe("elencoVisible", () => {
  it("pone lo declarado primero y anexa lo que solo vive en fuentes", () => {
    const visible = elencoVisible(
      [unidad("Egresados"), unidad("Empleadores")],
      [fuente("s1", "universo", "Estudiantes")],
    );

    expect(visible.map((unit) => unit.actor)).toEqual(["Egresados", "Empleadores", "Estudiantes"]);
    expect(visible[2].origin).toBe("fuentes");
  });

  it("no duplica un declarado que además tiene fuentes", () => {
    const visible = elencoVisible([unidad("Egresados")], [fuente("s1", "universo", "egresados")]);
    expect(visible).toHaveLength(1);
    expect(visible[0].origin).toBe("declarado");
  });

  it("sobrevive sin unidades declaradas", () => {
    const visible = elencoVisible(undefined, [fuente("s1", "universo", "Docentes")]);
    expect(visible.map((unit) => unit.actor)).toEqual(["Docentes"]);
  });
});

describe("nombreDisponible", () => {
  const elenco = [unidad("Egresados"), unidad("Docentes")];

  it("rechaza un nombre que ya existe, sin importar cómo se escriba", () => {
    expect(nombreDisponible(elenco, "egresados")).toBe(false);
    expect(nombreDisponible(elenco, "Ex alumnos")).toBe(true);
  });

  it("rechaza el vacío y permite renombrarse a sí mismo", () => {
    expect(nombreDisponible(elenco, "  ")).toBe(false);
    expect(nombreDisponible(elenco, "Egresados", "egresados")).toBe(true);
  });
});

describe("faltantesDelActor y tieneCanalTelefonico", () => {
  it("nombra primero la falta de padrón, que es la que impide medir avance", () => {
    expect(faltantesDelActor({ actor: "X", universo: 0, respuestas: 0, barrido: 0 }, false))
      .toEqual(["sin padrón", "sin encuesta"]);
  });

  it("solo reclama barrido a los actores con canal telefónico", () => {
    expect(faltantesDelActor({ actor: "X", universo: 1, respuestas: 1, barrido: 0 }, false)).toEqual([]);
    expect(faltantesDelActor({ actor: "X", universo: 1, respuestas: 1, barrido: 0 }, true)).toEqual(["sin barrido"]);
  });

  it("un actor fuera del elenco no se trata como sin teléfono", () => {
    expect(tieneCanalTelefonico([unidad("Egresados")], "Egresados")).toBe(false);
    expect(tieneCanalTelefonico([unidad("Egresados")], "Empleadores")).toBe(true);
  });
});
