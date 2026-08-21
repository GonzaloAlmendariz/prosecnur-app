import { beforeEach, describe, expect, it } from "vitest";
import { leerJobEnCurso, olvidarJobEnCurso, recordarJobEnCurso } from "../jobsEnCurso";

/**
 * Medido en el recorrido del usuario nuevo: lancé «Comparar métodos» —el paso
 * más lento, más de diez minutos con este marco—, recargué la página y la app
 * volvió diciendo «Falta comparar los métodos» mientras el servidor seguía
 * respondiendo `status: "running", 6%` por ese mismo job. Quien recibe la app
 * vuelve a pulsar y lanza un segundo job encima del primero.
 *
 * Este módulo es la memoria mínima que faltaba: qué job largo quedó en curso,
 * para poder retomarlo al volver.
 */
/** Almacén de mentira: el repo no trae jsdom, y este módulo no lo necesita. */
function almacenFalso() {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v); },
    removeItem: (k: string) => { datos.delete(k); },
  };
}

describe("memoria de jobs en curso", () => {
  let store = almacenFalso();
  beforeEach(() => {
    store = almacenFalso();
  });

  it("recuerda el job de una sesión y lo devuelve", () => {
    recordarJobEnCurso("sid-1", "comparar", "job-abc", store);
    expect(leerJobEnCurso("sid-1", "comparar", store)).toBe("job-abc");
  });

  it("no mezcla sesiones ni tipos de trabajo", () => {
    recordarJobEnCurso("sid-1", "comparar", "job-abc", store);
    expect(leerJobEnCurso("sid-2", "comparar", store)).toBeNull();
    expect(leerJobEnCurso("sid-1", "seleccionar", store)).toBeNull();
  });

  it("olvida cuando el trabajo termina", () => {
    recordarJobEnCurso("sid-1", "comparar", "job-abc", store);
    olvidarJobEnCurso("sid-1", "comparar", store);
    expect(leerJobEnCurso("sid-1", "comparar", store)).toBeNull();
  });

  it("sin sesión no recuerda nada: un job sin dueño no se retoma", () => {
    recordarJobEnCurso("", "comparar", "job-abc", store);
    expect(leerJobEnCurso("", "comparar", store)).toBeNull();
  });
});
