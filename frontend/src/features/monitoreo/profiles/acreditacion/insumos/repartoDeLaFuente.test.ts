import { describe, expect, it } from "vitest";
import type { MonitoreoSource } from "../../../../../api/client";
import { sourcePayloadFromExisting } from "../../telefonico/fuentes/payloadDeFuente";
import { claveDeValor, mapaGuardado } from "./RepartoDeLaFuente";

const padron = (actor_map: MonitoreoSource["actor_map"]): MonitoreoSource => ({
  id: "universo-profesores", kind: "google_sheets", label: "Universo · Profesores", enabled: true, role: "universo",
  dimensions: { actor: "Profesores" }, actor_var: "Modalidad docente (cuota)", actor_map, actor_por_padron: false,
});

describe("reparto del padrón", () => {
  it("el mapa que devuelve el motor (claves normalizadas) vuelve a marcar el valor de los datos", () => {
    expect(mapaGuardado(padron({ centrum: "Docentes CENTRUM" }))).toEqual({ centrum: "Docentes CENTRUM" });
    expect(claveDeValor("CENTRUM")).toBe("centrum");
    expect(claveDeValor("Tiempo Parcial  Asignaturas")).toBe("tiempo parcial asignaturas");
    expect(mapaGuardado(padron([]))).toEqual({});
  });

  it("guardar otro campo de la fuente conserva el reparto", () => {
    const payload = sourcePayloadFromExisting(padron({ centrum: "Docentes CENTRUM" }), { label: "Universo · Profesores (2026)" });
    expect(payload.actor_var).toBe("Modalidad docente (cuota)");
    expect(payload.actor_map).toEqual({ centrum: "Docentes CENTRUM" });
    expect(payload.actor_por_padron).toBe(false);
    expect(sourcePayloadFromExisting(padron([]), {}).actor_map).toBeUndefined();
  });
});
