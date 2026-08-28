/**
 * El criterio de la rerandomización se construye desde el estudio, y lo que no
 * puede construirse se declara omitido en vez de rellenarse.
 */
import { describe, expect, it } from "vitest";
import type { CalcMuestraComponente, CalcMuestraSexoPorFacultad } from "../../../../../api/client";
import { conRerandomizacionDelEstudio, criterioRerandomizacionDesdeEstudio } from "../criterioRerandomizacion";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../../api/client";

const comp = (filas: Array<Record<string, unknown>>) =>
  ({ resultado: { aulas_por_estrato: filas } }) as unknown as CalcMuestraComponente;

const sexo = (filas: Array<Record<string, unknown>>) =>
  ({ schema: "calc_muestra_aulas_sexo_por_facultad_v1", filas }) as unknown as CalcMuestraSexoPorFacultad;

describe("criterioRerandomizacionDesdeEstudio", () => {
  it("reparte la cuota por sexo con la proporción del MARCO", () => {
    // DERECHO: cuota 363 con 55 % de mujeres en el marco → 199,65 y 163,35.
    // Se usa la del marco y no la de la muestra: el criterio compara contra lo
    // que el diseño pide, no contra lo que un sorteo produjo.
    const { criterio, omitidas } = criterioRerandomizacionDesdeEstudio(
      comp([{ estrato: "DERECHO", cuota: 363, tau: 0.5683 }]),
      sexo([{ faculty_key: "derecho", facultad: "DERECHO", marco_prop_mujeres: 0.55 }]),
    );
    expect(omitidas).toEqual([]);
    expect(criterio?.tipo).toBe("cobertura_celdas");
    expect(criterio?.umbral).toBe(1);
    expect(criterio?.celdas).toHaveLength(1);
    expect(criterio!.celdas[0].cuota_f).toBeCloseTo(199.65, 2);
    expect(criterio!.celdas[0].cuota_m).toBeCloseTo(163.35, 2);
    expect(criterio!.celdas[0].tau).toBeCloseTo(0.5683, 4);
    expect(criterio!.celdas[0].faculty_key).toBe("derecho");
  });

  it("una facultad sin τ NO entra, y se dice", () => {
    // Meterla con un τ inventado haría que el sorteo se aceptara o rechazara
    // por un número que nadie midió.
    const { criterio, omitidas } = criterioRerandomizacionDesdeEstudio(
      comp([
        { estrato: "DERECHO", cuota: 363, tau: 0.57 },
        { estrato: "PSICOLOGÍA", cuota: 75 },
      ]),
      sexo([
        { faculty_key: "derecho", facultad: "DERECHO", marco_prop_mujeres: 0.5 },
        { faculty_key: "psicologia", facultad: "PSICOLOGÍA", marco_prop_mujeres: 0.5 },
      ]),
    );
    expect(criterio?.celdas.map((c) => c.facultad)).toEqual(["DERECHO"]);
    expect(omitidas).toEqual([{ facultad: "PSICOLOGÍA", motivo: "sin_tau" }]);
  });

  it("una facultad sin reparto por sexo tampoco entra", () => {
    const { criterio, omitidas } = criterioRerandomizacionDesdeEstudio(
      comp([{ estrato: "DERECHO", cuota: 363, tau: 0.57 }]),
      sexo([]),
    );
    expect(criterio).toBeNull();
    expect(omitidas).toEqual([{ facultad: "DERECHO", motivo: "sin_reparto_sexo" }]);
  });

  it("empareja aunque la clave venga sólo en la etiqueta", () => {
    const { criterio } = criterioRerandomizacionDesdeEstudio(
      comp([{ estrato: "GESTIÓN Y ALTA DIRECCIÓN", cuota: 105, tau: 0.6 }]),
      sexo([{ faculty_key: "", facultad: "gestion y alta direccion", marco_prop_mujeres: 0.5 }]),
    );
    expect(criterio?.celdas).toHaveLength(1);
  });

  it("sin celdas devuelve null, que NO es un criterio laxo", () => {
    // Un criterio vacío aceptaría cualquier sorteo. El motor lo rechaza y aquí
    // se devuelve null para que la pantalla pueda decir por qué.
    expect(criterioRerandomizacionDesdeEstudio(comp([]), sexo([])).criterio).toBeNull();
    expect(criterioRerandomizacionDesdeEstudio(null, null).criterio).toBeNull();
    const cero = criterioRerandomizacionDesdeEstudio(
      comp([{ estrato: "X", cuota: 0, tau: 0.5 }]),
      sexo([{ faculty_key: "x", facultad: "X", marco_prop_mujeres: 0.5 }]),
    );
    expect(cero.criterio).toBeNull();
    expect(cero.omitidas).toEqual([{ facultad: "X", motivo: "sin_cuota" }]);
  });

  it("un τ fuera de dominio se trata como ausente, no se recorta", () => {
    const { omitidas } = criterioRerandomizacionDesdeEstudio(
      comp([{ estrato: "X", cuota: 10, tau: 1.4 }]),
      sexo([{ faculty_key: "x", facultad: "X", marco_prop_mujeres: 0.5 }]),
    );
    expect(omitidas).toEqual([{ facultad: "X", motivo: "sin_tau" }]);
  });
});

describe("conRerandomizacionDelEstudio", () => {
  const cfg = { schema: "calc_muestra_workspace_aulas_v1" } as unknown as CalcMuestraWorkspaceAulasConfig;
  const est = () => comp([{ estrato: "DERECHO", cuota: 363, tau: 0.5683 }]);
  const sx = () => sexo([{ faculty_key: "derecho", facultad: "DERECHO", marco_prop_mujeres: 0.55 }]);

  it("adjunta el criterio pero NO enciende la rerandomizacion", () => {
    // Adjuntarlo hace que el proyecto lo recuerde; encenderla cambia el diseño
    // y eso lo decide el analista, no el hecho de abrir una pantalla.
    const out = conRerandomizacionDelEstudio(cfg, est(), sx());
    expect(out.rerandomizacion?.criterio?.celdas).toHaveLength(1);
    expect(out.rerandomizacion?.activa).toBe(false);
    expect(out.rerandomizacion?.tope).toBe(50);
  });

  it("respeta lo que el analista ya habia declarado", () => {
    const previo = { ...cfg, rerandomizacion: { activa: true, tope: 200, criterio: null } };
    const out = conRerandomizacionDelEstudio(previo, est(), sx());
    expect(out.rerandomizacion?.activa).toBe(true);
    expect(out.rerandomizacion?.tope).toBe(200);
    // Y el criterio se refresca desde el estudio, no se conserva el viejo.
    expect(out.rerandomizacion?.criterio?.celdas[0].faculty_key).toBe("derecho");
  });

  it("sin criterio construible la apaga en vez de dejarla encendida en falso", () => {
    const previo = { ...cfg, rerandomizacion: { activa: true, tope: 50, criterio: null } };
    const out = conRerandomizacionDelEstudio(previo, comp([]), sexo([]));
    expect(out.rerandomizacion?.activa).toBe(false);
    expect(out.rerandomizacion?.criterio).toBeNull();
  });

  it("sin criterio y sin declaracion previa no toca la config", () => {
    expect(conRerandomizacionDelEstudio(cfg, comp([]), sexo([]))).toBe(cfg);
  });
});
