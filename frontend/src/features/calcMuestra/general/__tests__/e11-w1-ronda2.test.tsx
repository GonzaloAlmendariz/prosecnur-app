/**
 * E11 · W1 ronda 2 — lo que la QA independiente rechazó de la ronda 1:
 * «sorteado» contado con dos definiciones (C5), paneles estirados sin
 * contenido (V8), cabecera alta en 1024 × 600, la fila de cifras de Selección
 * descuadrada, «Recalcular» que no pedía nada, la columna Ajuste de
 * Acreditación, nombres de actor recortados sin nombre completo, el tooltip
 * del reparto sólo con mouse y el scroll anidado de la sección.
 */
import fs from "node:fs";
import path from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { CalcMuestraComponente, CalcMuestraEstudio, CalcMuestraWorkspace } from "../../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../../api/calcMuestraGeneral";
import { defaultComponente } from "../../sharedCore";
import {
  ajusteDeResultado,
  cifrasDisenoAcreditacion,
  cifrasDisenoGeneral,
  estadoMesaAcreditacion,
  estadoMesaGeneral,
  faltaMemoria,
  vigenciaSorteo,
} from "../bandaDisenoModelo";
import { FichaCorrida } from "../FichaCorrida";
import { MemoriaCalculoGeneral } from "../MemoriaCalculoGeneral";
import { MesaAcreditacion } from "../MesaAcreditacion";
import { MesaGeneral } from "../MesaGeneral";

type Resultado = NonNullable<CalcMuestraComponente["resultado"]>;

const MEMORIA = [{ paso: "Tamaño base", formula: "n0 = z² · p · (1 − p) / e²", sustitucion: "1.96² · 0.25 / 0.05²", resultado: "384.2" }];

function actor(patch: Partial<CalcMuestraComponente> & { id: string }): CalcMuestraComponente {
  return { ...defaultComponente({ id: patch.id, actor: patch.actor ?? patch.id }), ...patch };
}

function calculado(id: string, nombre: string, nOperativo: number, extra: Partial<CalcMuestraComponente> = {}): CalcMuestraComponente {
  const base = defaultComponente();
  return actor({
    id,
    actor: nombre,
    tecnica: "prob_aleatorio_simple",
    naturaleza: "prob",
    actor_categoria: "docentes",
    marco: { ...base.marco, marco_validado: 600 },
    parametros: { ...base.parametros, e: 0.05, tasa_respuesta: 0.6, cobertura_objetivo: 0.5 },
    resultado: { n_objetivo: 234, n_operativo: nOperativo, precision_alcanzada: 0.05, memoria_calculo: MEMORIA } as unknown as Resultado,
    ...extra,
  });
}

function corrida(componenteId: string, nFuente: number | null, patch: Partial<CalcMuestraGeneralCorrida["corrida"]> = {}): CalcMuestraGeneralCorrida {
  return {
    corrida: {
      run_id: `r-${componenteId}`, semilla: 20260924, rng_kind: "Mersenne-Twister", r_version: "R 4.5.1",
      metodo: "mas", modalidad: "probabilistica", marco_hash: "hash-viejo", config_hash: "c0ffee",
      N: 600, n_titulares: nFuente ?? 0, n_reservas: 10, piso_incumplible: false, reservas_omitidas_pps: false,
      ...patch,
    },
    estratos: [],
    unidades: null,
    n_fuente: nFuente,
    componente_id: componenteId,
    sorteado_at: "2026-09-20T10:00:00Z",
  };
}

const MARCO_NUEVO: CalcMuestraGeneralMarco = {
  file_id: "f1", hoja: "padron", columnas: { id: "dni", estrato: "", tamano: "" },
  marco_hash: "hash-nuevo", N: 600, estratos: [], declarado_at: "2026-09-24T06:00:00Z",
};

describe("C5 · una sola definición de sorteo vigente", () => {
  const docentes = calculado("doc", "Docentes", 390);

  it("vigente sólo con el mismo marco, el cálculo en pie y el mismo n a campo", () => {
    expect(vigenciaSorteo({ comp: docentes, corrida: null }).estado).toBe("sin-sorteo");
    expect(vigenciaSorteo({ comp: docentes, corrida: corrida("doc", 390) }).estado).toBe("vigente");
    expect(vigenciaSorteo({ comp: docentes, corrida: corrida("doc", 350) })).toMatchObject({ estado: "desactualizado", motivo: "n", nCampo: 390 });
    expect(vigenciaSorteo({ comp: docentes, corrida: corrida("doc", 390), marco: MARCO_NUEVO })).toMatchObject({ estado: "desactualizado", motivo: "marco" });
    const sinCalculo = { ...docentes, resultado: null } as unknown as CalcMuestraComponente;
    expect(vigenciaSorteo({ comp: sinCalculo, corrida: corrida("doc", 390) })).toMatchObject({ estado: "desactualizado", motivo: "calculo" });
    const censal = calculado("adm", "Personal administrativo", 320, { tecnica: "intencion_censal", marco: { ...docentes.marco, marco_validado: 320 } });
    expect(vigenciaSorteo({ comp: censal, corrida: corrida("adm", null, { modalidad: "censo", N: 320 }) }).estado).toBe("vigente");
    expect(vigenciaSorteo({ comp: censal, corrida: corrida("adm", null, { modalidad: "censo", N: 300 }) })).toMatchObject({ motivo: "marco" });
  });

  it("un actor con corrida desactualizada no suma como sorteado en la tarjeta, la cadena ni su ficha", () => {
    const egresados = calculado("egr", "Egresados", 200);
    const componentes = [docentes, egresados];
    const corridas = { doc: corrida("doc", 350), egr: corrida("egr", 200) };
    const { totales, actores, cadena } = cifrasDisenoAcreditacion({ componentes, corridas });
    expect(totales.find((c) => c.clave === "sorteo")).toMatchObject({ value: "1 de 2", detalle: "1 selección desactualizada", tono: "alerta" });
    expect(actores.map((a) => a.fase)).toEqual(["desactualizado", "sorteado"]);
    expect(cadena.at(-1)).toBe("1 de 2 seleccionados");
    expect(estadoMesaAcreditacion({ componentes, corridas, cargado: true })).toMatchObject({ clave: "desactualizado", tono: "alerta" });
  });

  it("corridas de actores ya sin cálculo: nada «sorteado» mientras la cadena dice «0 calculados»", () => {
    const base = defaultComponente();
    const adm = actor({ id: "adm", actor: "Personal administrativo", tecnica: "intencion_censal", marco: { ...base.marco, marco_validado: 320 } });
    const est = actor({ id: "est", actor: "Estudiantes pregrado", tecnica: "intencion_censal", marco: { ...base.marco, marco_validado: 2800 } });
    const corridas = {
      adm: corrida("adm", null, { modalidad: "censo", N: 320 }),
      est: corrida("est", null, { modalidad: "censo", N: 2800 }),
    };
    const { totales, actores, cadena } = cifrasDisenoAcreditacion({ componentes: [adm, est], corridas });
    expect(totales.find((c) => c.clave === "sorteo")?.value).toBe("0 de 2");
    expect(actores.every((a) => a.fase === "sin-calculo")).toBe(true);
    expect(cadena).toEqual(["2 actores", "2 con N", "0 calculados", "0 de 2 seleccionados"]);
  });

  it("Selección (la ficha de la corrida) dice lo mismo que la banda", () => {
    const html = renderToStaticMarkup(<FichaCorrida corrida={corrida("doc", 390)} componente={{ ...docentes, resultado: null } as unknown as CalcMuestraComponente} />);
    expect(html).toContain("La selección quedó desactualizada");
    expect(html).toContain("cálculo que ya no existe");
  });
});

describe("V2 · «Diseño completo» sólo con memoria y resultado", () => {
  it("un n guardado sin memoria pide recalcular en vez de declarar el diseño completo", () => {
    const sinMemoria = calculado("c1", "Usuarios", 390, {
      resultado: { n_objetivo: 234, n_operativo: 390 } as unknown as Resultado,
    });
    expect(faltaMemoria(sinMemoria)).toBe(true);
    const e = estadoMesaGeneral({ comp: sinMemoria, marco: null, corrida: null, cargado: true });
    expect(e).toMatchObject({ clave: "sin-memoria", accion: { tipo: "calcular", etiqueta: "Recalcular" } });
    expect(e.etiqueta).not.toBe("Diseño completo");
  });
});

/** Recorre un árbol de elementos (sin DOM) y devuelve el primer <button>. */
function primerBoton(nodo: ReactNode): ReactElement<{ onClick?: (e: unknown) => void }> | null {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const b = primerBoton(hijo);
      if (b) return b;
    }
    return null;
  }
  if (!isValidElement(nodo)) return null;
  const el = nodo as ReactElement<Record<string, unknown>>;
  if (el.type === "button") return el as ReactElement<{ onClick?: (e: unknown) => void }>;
  for (const valor of Object.values(el.props)) {
    const b = primerBoton(valor as ReactNode);
    if (b) return b;
  }
  return null;
}

describe("«Recalcular» de la memoria vacía pide el cálculo", () => {
  it("llama al handler sin reenviarle el evento del clic", () => {
    const onCalcular = vi.fn();
    const comp = calculado("c1", "Usuarios", 390, { resultado: { n_objetivo: 234, n_operativo: 390 } as unknown as Resultado });
    const arbol = MemoriaCalculoGeneral({ comp, calculando: false, onCalcular });
    const boton = primerBoton(arbol);
    expect(boton).not.toBeNull();
    boton?.props.onClick?.({ type: "click" });
    expect(onCalcular).toHaveBeenCalledTimes(1);
    expect(onCalcular).toHaveBeenCalledWith();
  });

  it("las mesas no pasan el `onCalcular` de la página a los hijos tal cual", () => {
    for (const archivo of ["MesaGeneral.tsx", "MesaAcreditacion.tsx"]) {
      const fuente = fs.readFileSync(path.join(__dirname, "..", archivo), "utf8");
      expect(fuente).toContain("const calcular = () => onCalcular();");
      expect(fuente).not.toContain("onCalcular={onCalcular}");
    }
  });
});

describe("Ajuste de Resultados en Acreditación", () => {
  const docentes = calculado("doc", "Docentes", 390);

  it("una muestra de elementos lee la respuesta esperada y el margen, no la cobertura", () => {
    expect(ajusteDeResultado(docentes, "acreditacion")).toEqual({ texto: "Respuesta esperada 60.0%", nota: "margen ±5.0%" });
    expect(ajusteDeResultado(docentes, "marco_disponible").texto).not.toContain("Respuesta");
  });

  const workspace = {
    notas_diseno: "", fuente_marco: "", marco_disponible: "", unidad_observacion: "", unidad_muestreo: "",
    variables_control: [], escenarios: [],
  } as unknown as CalcMuestraWorkspace;
  const estudio = {
    titulo: "Estudio", modo_trabajo: "estimacion_preliminar",
    contexto: { cliente: "", tipo_cliente: "", descripcion_libre: "" },
    componentes: [docentes],
  } as unknown as CalcMuestraEstudio;
  const noop = () => {};

  function acreditacion(seccion: string, componentes: CalcMuestraComponente[]) {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/calc-muestra?modo=acreditacion&seccion=${seccion}`]}>
        <MesaAcreditacion
          estudio={{ ...estudio, componentes }} workspace={workspace} activeSection={seccion}
          onTitulo={noop} onContexto={noop} onWorkspace={noop} onComponente={noop} onCalcular={noop} calculando={false} reporte={{ resultados: 0, enCurso: false, disponible: false, verUrl: null, onGenerar: noop }} onCambiarTipo={noop}
        />
      </MemoryRouter>,
    );
  }

  it("la tabla de Resultados lo pinta así", () => {
    const html = acreditacion("resultados", [docentes]);
    expect(html).toContain("Respuesta esperada 60.0%<small>margen ±5.0%</small>");
    expect(html).not.toContain("Cobertura 50.0%");
  });

  it("fichas por actor con nombre completo accesible; en Actores no se pintan", () => {
    const largo = calculado("adm", "Personal administrativo y de servicios", 120);
    const resultados = acreditacion("resultados", [largo]);
    expect(resultados).toMatch(/class="cmg-banda-actor-enlace" aria-label="Personal administrativo y de servicios: Calculado, n 234 de 600/);
    expect(resultados).toContain('title="Personal administrativo y de servicios"');
    expect(acreditacion("actores", [largo])).not.toContain("cmg-banda-actores");
  });

  it("ninguna sección se estira al alto disponible", () => {
    expect(acreditacion("contexto", [docentes])).not.toContain("cmg-mesa-llena");
    const general = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/calc-muestra?modo=marco-disponible&seccion=resultados"]}>
        <MesaGeneral
          estudio={estudio} workspace={workspace} activeSection="resultados"
          onTitulo={noop} onContexto={noop} onPatchEstudio={noop} onWorkspace={noop} onComponente={noop}
          onReplaceComponente={noop} onEnsureKind={noop} onCalcular={noop} onMonitoreo={noop}
          calculando={false} reporteListo={false} reporte={{ resultados: 0, enCurso: false, disponible: false, verUrl: null, onGenerar: noop }} onCambiarTipo={noop}
        />
      </MemoryRouter>,
    );
    expect(general).not.toContain("cmg-mesa-llena");
  });
});

describe("Selección · la fila de cifras no se descuadra", () => {
  it("el rótulo del sorteo es de una palabra y el detalle explica principales + reemplazos", () => {
    const docentes = calculado("doc", "Docentes", 390);
    const cifras = cifrasDisenoGeneral({ comp: docentes, marco: null, corrida: corrida("doc", 390), seccion: "seleccion" });
    const sorteo = cifras.find((c) => c.clave === "sorteo");
    expect(sorteo?.label).toBe("Selección");
    expect(sorteo?.detalle).toContain("principales + reemplazos");
  });
});

describe("CSS · alto intrínseco, un dueño de scroll y compacto", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "mesa.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const regla = (selector: string) => {
    const i = css.indexOf(`${selector} {`);
    return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
  };

  it("sin paneles estirados ni scroll anidado", () => {
    expect(css).not.toContain("cmg-mesa-llena");
    expect(regla(".cmg-resultados-grid")).toContain("align-items: start");
    expect(regla(".cmg-contexto-grid")).toContain("align-items: start");
    expect(regla(".cmg-propuesta-campo textarea")).not.toContain("flex");
    expect(regla(".cmg-mesa .cmv2-tab-panel")).toContain("overflow: visible");
  });

  it("la banda va en una sola fila y el compacto recoge detalle y fichas", () => {
    expect(regla(".cmg-banda-cifras .cmv2-uni-cifra-fila")).toContain("grid-auto-flow: column");
    const compacto = css.slice(css.indexOf("@media (max-width: 1100px), (max-height: 800px)"));
    expect(compacto).toMatch(/\.cmg-banda-cifras \.cmv2-uni-cifra-detalle,\s*\.cmg-banda-actores \{\s*display: none;/);
    expect(css).toContain(".cmg-reparto-fila:focus-visible");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
