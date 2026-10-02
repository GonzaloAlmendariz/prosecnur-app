/**
 * E15 · W-B — P6: una corrida vieja no vuelve «Sorteado» a un actor cuya
 * técnica actual no se sortea (banda, fichas, tarjeta, Selección y ficha de
 * la corrida dicen lo mismo). P7: Resultados abre con su veredicto.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../../api/calcMuestraGeneral";
import { defaultComponente } from "../../sharedCore";
import {
  cifrasDisenoAcreditacion,
  estadoMesaAcreditacion,
  veredictoResultados,
  vigenciaSorteo,
} from "../bandaDisenoModelo";
import { FichaCorrida } from "../FichaCorrida";
import { ResultadosComponentes } from "../ResultadosComponentes";
import { actoresDelSelector } from "../SeleccionActores";

type Resultado = NonNullable<CalcMuestraComponente["resultado"]>;

function calculado(
  id: string,
  nombre: string,
  extra: Partial<CalcMuestraComponente> = {},
  resultado: Partial<Resultado> = {},
): CalcMuestraComponente {
  const base = defaultComponente({ id, actor: nombre });
  return {
    ...base,
    id,
    actor: nombre,
    tecnica: "prob_aleatorio_simple",
    naturaleza: "prob",
    marco: { ...base.marco, marco_validado: 600 },
    parametros: { ...base.parametros, e: 0.05 },
    resultado: { n_objetivo: 234, n_operativo: 390, precision_alcanzada: 0.05, ...resultado } as unknown as Resultado,
    ...extra,
  };
}

function corrida(id: string, patch: Partial<CalcMuestraGeneralCorrida["corrida"]> = {}): CalcMuestraGeneralCorrida {
  return {
    corrida: {
      run_id: `r-${id}`, semilla: 20260924, rng_kind: "Mersenne-Twister", r_version: "R 4.5.1",
      metodo: "mas", modalidad: "probabilistica", marco_hash: "h", config_hash: "c",
      N: 600, n_titulares: 390, n_reservas: 10, piso_incumplible: false, reservas_omitidas_pps: false,
      ...patch,
    },
    estratos: [],
    unidades: null,
    n_fuente: 390,
    componente_id: id,
    sorteado_at: "2026-09-20T10:00:00Z",
  };
}

const MARCO: CalcMuestraGeneralMarco = {
  file_id: "f1", hoja: "padron", columnas: { id: "dni", estrato: "", tamano: "" },
  marco_hash: "h", N: 600, estratos: [], declarado_at: "2026-09-24T06:00:00Z",
};

describe("P6 · técnica sin π con una corrida vieja", () => {
  const pregrado = calculado("est", "Estudiantes pregrado", { tecnica: "prob_conglomerado_multietapico" });
  const docentes = calculado("doc", "Docentes");
  const corridas = { est: corrida("est"), doc: corrida("doc") };

  it("no es un sorteo vigente ni un «selección desactualizada»: es «Sin selección», con la corrida señalada", () => {
    const v = vigenciaSorteo({ comp: pregrado, corrida: corridas.est });
    expect(v.estado).toBe("sin-sorteo");
    expect(v.estado === "sin-sorteo" ? v.huerfana : null).toMatch(/no admite selección aleatoria.*no cuenta/);
    expect(vigenciaSorteo({ comp: pregrado, corrida: null })).toEqual({ estado: "sin-sorteo", huerfana: null });
  });

  it("banda, tarjeta, cadena, estado y Selección dicen lo mismo", () => {
    const { totales, actores, cadena } = cifrasDisenoAcreditacion({ componentes: [pregrado, docentes], corridas });
    expect(actores.map((a) => a.fase)).toEqual(["sin-sorteo", "sorteado"]);
    expect(totales.find((c) => c.clave === "sorteo")).toMatchObject({ value: "1 de 1" });
    expect(cadena.at(-1)).toBe("1 de 1 seleccionados");
    expect(estadoMesaAcreditacion({ componentes: [pregrado, docentes], corridas, cargado: true }).clave).toBe("listo");
    const selector = actoresDelSelector([pregrado, docentes], { cargado: true, marcos: { est: MARCO, doc: MARCO }, corridas });
    expect(selector.map((a) => a.estado.etiqueta)).toEqual(["Sin selección", "Seleccionado"]);
  });

  it("otra modalidad (censo ↔ probabilística) sí es un selección desactualizada, y la ficha lo dice", () => {
    const censal = calculado("adm", "Administrativos", { tecnica: "intencion_censal" });
    const v = vigenciaSorteo({ comp: censal, corrida: corrida("adm") });
    expect(v).toMatchObject({ estado: "desactualizado", motivo: "tecnica" });
    const { actores } = cifrasDisenoAcreditacion({ componentes: [censal], corridas: { adm: corrida("adm") } });
    expect(actores[0].fase).toBe("desactualizado");
    const html = renderToStaticMarkup(<FichaCorrida corrida={corrida("adm")} componente={censal} />);
    expect(html).toContain("La selección quedó desactualizada");
    expect(html).toContain("cobertura censal");
  });
});

describe("P7 · Resultados abre con su veredicto", () => {
  it("Muestra general: margen alcanzado frente al pedido, con tono y título", () => {
    const ok = veredictoResultados({ modo: "marco_disponible", componentes: [calculado("g", "General")] });
    expect(ok).toMatchObject({ tono: "ok", titulo: "El n cumple el margen pedido" });
    expect(ok?.detalle).toBe("234 completas · 390 a contactar · margen ±5.0% frente a ±5.0% pedido");
    const corto = veredictoResultados({
      modo: "marco_disponible",
      componentes: [calculado("g", "General", {}, { precision_alcanzada: 0.07 })],
    });
    expect(corto).toMatchObject({ tono: "alerta", titulo: "El n no alcanza el margen pedido" });
    expect(veredictoResultados({ modo: "marco_disponible", componentes: [{ ...calculado("g", "G"), resultado: null }] })).toBeNull();
  });

  it("Acreditación: calculados y seleccionados frente al total, nombrando al que falta", () => {
    const base = defaultComponente();
    const sinN = { ...calculado("egr", "Egresados"), resultado: null, marco: { ...base.marco, marco_validado: 0 } };
    const docentes = calculado("doc", "Docentes");
    const admin = calculado("adm", "Administrativos");
    const v1 = veredictoResultados({ modo: "acreditacion", componentes: [docentes, sinN], corridas: {}, cargado: true });
    expect(v1).toMatchObject({ tono: "alerta", titulo: "Falta 1 de 2 actores por calcular", falta: "Falta: Egresados (sin N)." });
    expect(v1?.detalle).toBe("1 de 2 calculados · 0 de 1 seleccionados");
    const v2 = veredictoResultados({
      modo: "acreditacion",
      componentes: [docentes, admin],
      corridas: { doc: corrida("doc"), adm: corrida("adm", {}) },
      marcos: {},
      cargado: true,
    });
    expect(v2).toMatchObject({ tono: "ok", titulo: "Todos los actores calculados y seleccionados", falta: null });
    const v3 = veredictoResultados({ modo: "acreditacion", componentes: [docentes, admin], corridas: { doc: corrida("doc") }, cargado: true });
    expect(v3).toMatchObject({ tono: "alerta", titulo: "Falta seleccionar 1 de 2 actores con π", falta: "Falta: Administrativos (sin seleccionar)." });
  });

  it("la franja se pinta antes de la tabla, como status y con texto (no sólo color)", () => {
    // El render estático lee el estado inicial del store (sin sorteos leídos):
    // el veredicto lo decide el actor sin calcular.
    const egresados = { ...calculado("egr", "Egresados"), resultado: null };
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ResultadosComponentes modo="acreditacion" componentes={[calculado("doc", "Docentes"), egresados]} calculando={false} onCalcular={() => {}} />
      </MemoryRouter>,
    );
    const franja = html.indexOf('class="cmg-avisos-vivos cmg-veredicto"');
    expect(franja).toBeGreaterThan(-1);
    expect(franja).toBeLessThan(html.indexOf("<table"));
    expect(html).toMatch(/class="cmg-avisos-vivos cmg-veredicto" data-tono="alerta"><div class="cmv2-aviso" data-tone="warn" role="status"/);
    expect(html).toContain("Falta 1 de 2 actores por calcular");
    expect(html).toContain("Falta: Egresados (por calcular).");
  });
});
