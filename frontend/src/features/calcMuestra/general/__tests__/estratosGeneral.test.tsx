/**
 * G8 · Método › Estratos de Muestra general: la tabla lleva sólo lo que el
 * motor general usa, la p por estrato se escribe en `p_facultad` validada en
 * (0, 1), N_h es de solo lectura con marco declarado y la columna p existe
 * sólo en el estratificado.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente, CalcMuestraEstrato } from "../../../../api/calcMuestra";
import { defaultComponente } from "../../sharedCore";
import { EstratosGeneralVista } from "../EstratosGeneral";
import {
  filasDeEstratos,
  leerProporcion,
  patchAgregar,
  patchProporcion,
  patchQuitar,
  patchTamano,
  reglaEnPalabras,
  usaProporcionPorEstrato,
} from "../modeloEstratos";
import { TerritorialHandoff } from "../TerritorialHandoff";

function est(id: string, label: string, N: number, extra: Partial<CalcMuestraEstrato> = {}): CalcMuestraEstrato {
  return { id, label, N, N_a: 0, N_b: 0, sub_a_label: "Sub A", sub_b_label: "Sub B", promedio_conglomerado: 25, tau: 0.7, ...extra };
}

function comp(patch: Partial<CalcMuestraComponente> = {}): CalcMuestraComponente {
  const base = defaultComponente({ id: "c1", tecnica: "prob_estratificado" });
  return {
    ...base,
    marco: { ...base.marco, estratos: [est("e1", "Norte", 3000), est("e2", "Sur", 2000)] },
    ...patch,
  };
}

const noop = () => undefined;

describe("editar la p escribe p_facultad", () => {
  it("una p válida va al estrato editado y a ninguno más", () => {
    const patch = patchProporcion(comp(), 1, "0.3");
    expect(patch?.marco?.estratos?.map((e) => e.p_facultad)).toEqual([undefined, 0.3]);
    // Declarar una p no toca el N del marco.
    expect(patch?.marco).not.toHaveProperty("marco_validado");
  });

  it("acepta coma decimal", () => {
    expect(patchProporcion(comp(), 0, "0,1")?.marco?.estratos?.[0]?.p_facultad).toBe(0.1);
  });

  it("vacío borra la p: vuelve a la global", () => {
    const conP = comp({ marco: { ...comp().marco, estratos: [est("e1", "Norte", 3000, { p_facultad: 0.2 })] } });
    const patch = patchProporcion(conP, 0, "  ");
    expect(patch?.marco?.estratos?.[0]).not.toHaveProperty("p_facultad");
  });

  it("fuera de (0, 1) no escribe nada", () => {
    for (const texto of ["0", "1", "1.5", "-0.2", "abc"]) {
      expect(leerProporcion(texto).tipo).toBe("invalida");
      expect(patchProporcion(comp(), 0, texto)).toBeNull();
    }
  });

  it("editar N_h o quitar un estrato recompone el N del marco", () => {
    expect(patchTamano(comp(), 0, 1000.4)?.marco?.marco_validado).toBe(3000);
    expect(patchQuitar(comp(), 0).marco?.marco_validado).toBe(2000);
    expect(patchAgregar(comp()).marco?.estratos).toHaveLength(3);
  });
});

describe("columnas", () => {
  it("la p sólo en el estratificado", () => {
    expect(usaProporcionPorEstrato("prob_estratificado")).toBe(true);
    expect(usaProporcionPorEstrato("no_prob_cuotas")).toBe(false);
    const estratificado = renderToStaticMarkup(<EstratosGeneralVista comp={comp()} marcoDeclarado={false} onComponente={noop} />);
    expect(estratificado).toContain("p esperada");
    expect(estratificado).toContain("Neyman puede repartir mejor");
    const cuotas = renderToStaticMarkup(<EstratosGeneralVista comp={comp({ tecnica: "no_prob_cuotas" })} marcoDeclarado={false} onComponente={noop} />);
    expect(cuotas).not.toContain("p esperada");
    expect(cuotas).not.toContain("Proporción esperada de");
  });

  it("no pinta columnas de aulas", () => {
    const html = renderToStaticMarkup(<EstratosGeneralVista comp={comp()} marcoDeclarado={false} onComponente={noop} />);
    for (const col of ["Sub A", "Sub B", "Promedio unidad", "Tasa de la facultad", ">Total<"]) {
      expect(html).not.toContain(col);
    }
  });

  it("la p global es el placeholder", () => {
    const c = comp();
    const html = renderToStaticMarkup(<EstratosGeneralVista comp={{ ...c, parametros: { ...c.parametros, p: 0.4 } }} marcoDeclarado={false} onComponente={noop} />);
    expect(html).toMatch(/aria-label="Proporción esperada de Norte"[^>]*placeholder="0.4"/);
  });
});

describe("marco declarado", () => {
  it("N_h y rótulo de solo lectura, sin agregar ni quitar; la p sigue editable", () => {
    const html = renderToStaticMarkup(<EstratosGeneralVista comp={comp()} marcoDeclarado onComponente={noop} />);
    expect(html).not.toContain("N_h de Norte");
    expect(html).not.toContain("Nombre del estrato");
    expect(html).toContain("3,000");
    expect(html).not.toContain("Agregar estrato");
    expect(html).not.toContain("Quitar Norte");
    expect(html).toContain("Proporción esperada de Norte");
  });

  it("sin marco declarado todo se edita", () => {
    const html = renderToStaticMarkup(<EstratosGeneralVista comp={comp()} marcoDeclarado={false} onComponente={noop} />);
    expect(html).toContain("N_h de Norte");
    expect(html).toContain("Agregar estrato");
    expect(html).toContain("Quitar Sur");
  });

  it("sin estratos contiene su vacío", () => {
    const vacio = comp({ marco: { ...comp().marco, estratos: [] } });
    expect(renderToStaticMarkup(<EstratosGeneralVista comp={vacio} marcoDeclarado={false} onComponente={noop} />)).toContain("Sin estratos.");
  });
});

describe("resultado por estrato", () => {
  const conResultado = comp({
    resultado: {
      n_teorico: 226, n_objetivo: 226, n_operativo: 323, precision_alcanzada: 0.05, sobremuestra: 0,
      formula_n: "neyman",
      distribucion_estratos: [
        { estrato: "Norte", N: 3000, n: 110, n_campo: 157, precision_e: 0.05, regla: "proporcional" },
        { estrato: "Sur", N: 2000, n: 116, n_campo: 166, precision_e: 0.07, regla: "piso_30" },
      ],
    } as CalcMuestraComponente["resultado"],
  });

  it("se empareja por rótulo y dice la regla en palabras", () => {
    const filas = filasDeEstratos(conResultado);
    expect(filas.map((f) => f.reparto?.n)).toEqual([110, 116]);
    const html = renderToStaticMarkup(<EstratosGeneralVista comp={conResultado} marcoDeclarado onComponente={noop} />);
    expect(html).toContain(">157<");
    expect(html).toContain(">Neyman<");
    expect(html).toContain(">Piso de 30<");
  });

  it("un estrato renombrado no hereda el reparto de otro", () => {
    const renombrado = { ...conResultado, marco: { ...conResultado.marco, estratos: [est("e1", "Centro", 3000)] } };
    expect(filasDeEstratos(renombrado)[0]?.reparto).toBeNull();
  });

  it("reglas", () => {
    expect(reglaEnPalabras("censo_estrato", undefined)).toBe("Censo del estrato");
    expect(reglaEnPalabras("proporcional", "proporcional_por_estrato")).toBe("Proporcional");
    expect(reglaEnPalabras(undefined, undefined)).toBe("—");
  });
});

describe("mesa territorial", () => {
  it("abre Hojas de Ruta con el ícono de mapa, no el de casa", () => {
    const html = renderToStaticMarkup(<TerritorialHandoff onOpen={noop} onBack={noop} />);
    expect(html).toContain("Abrir Hojas de Ruta");
    expect(html).not.toMatch(/lucide-house|lucide-home/);
    expect(html).toMatch(/lucide-map-pinned/);
  });
});
