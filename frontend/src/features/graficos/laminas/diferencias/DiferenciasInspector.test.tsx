// Mata: un estado del inspector que no se distingue de otro (sin `data-estado`), un `false` de readiness fuera de
// «calculando» (colgaría el QA), el error sin su código ni su id, y el vacío sin la acción que lo resuelve.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeDiferenciasLamina, REGLA_DIFERENCIAS_POR_DEFECTO } from "../../../../api/graficosDiferencias";
import { DiferenciasInspectorVista } from "./DiferenciasInspector";
import type { EstadoInspector } from "./modeloDiferencias";

const nada = () => undefined;

const LAMINA = normalizeDiferenciasLamina({
  slide_id: "s1", estado: "con_marcas", cruce: "grupo",
  grupos: [
    { letra: "A", etiqueta: "Norte", n: 120, comparable: true },
    { letra: "B", etiqueta: "Sur", n: 95, comparable: true },
    { letra: "C", etiqueta: "Isla", n: 8, comparable: false, motivo: "n = 8 · no se compara" },
  ],
  pares: [
    { fila: "Sí", a: "B", b: "A", p_a: 40, p_b: 22, dif: 18, p_ajustado: 0.0004, veredicto: "marcada", redaccion: "Sur dice sí más." },
    { fila: "No", a: "A", b: "B", dif: 4, veredicto: "bajo_umbral" },
  ],
});

function pintar(estado: EstadoInspector, extra: Partial<Parameters<typeof DiferenciasInspectorVista>[0]> = {}) {
  return renderToStaticMarkup(
    <DiferenciasInspectorVista
      estado={estado}
      encendido={estado !== "apagado" && estado !== "sin_cruce"}
      lamina={null}
      regla={null}
      errorCarga={null}
      etiquetaCruce="Zona"
      onAlternar={nada}
      onAgregarCruce={nada}
      onQuitarCruce={nada}
      onReintentar={nada}
      onAbrirRegla={nada}
      onVerPorQue={nada}
      {...extra}
    />,
  );
}

describe("los seis estados del inspector de diferencias", () => {
  it("con marcas: resumen en vivo, bases, trama del grupo chico y «Ver por qué»", () => {
    const html = pintar("con_marcas", { lamina: LAMINA, regla: { ...REGLA_DIFERENCIAS_POR_DEFECTO } });
    expect(html).toContain('data-estado="con_marcas"');
    expect(html).toContain('data-audit-ready="graficos-diferencias"');
    expect(html).toContain("1 marcada");
    expect(html).toContain("0 frágiles");
    expect(html).toContain("1 bajo el umbral");
    expect(html).toContain("Compara los 3 grupos de Zona entre sí · bases 120, 95 y 8.");
    expect(html).toContain("Isla: n = 8 · no se compara");
    expect(html).toContain("Ver por qué");
    expect(html).toContain("Regla del informe: Prueba z · Bonferroni");
  });
  it("sin cruce: el vacío explica y ofrece «Agregar cruce»", () => {
    const html = pintar("sin_cruce");
    expect(html).toContain('data-estado="sin_cruce"');
    expect(html).toContain("Agregar cruce");
    expect(html).toContain('data-audit-ready="graficos-diferencias"');
  });
  it("calculando: esqueleto y la única marca en false", () => {
    const html = pintar("calculando");
    expect(html).toContain('data-estado="calculando"');
    expect(html).toContain('data-audit-ready="false"');
    expect(html).toContain('aria-busy="true"');
  });
  it("ninguna diferencia: propone quitar el cruce", () => {
    const html = pintar("ninguna", { lamina: { ...LAMINA, estado: "ninguna", pares: [], nota: "Ninguna diferencia entre grupos es significativa." } });
    expect(html).toContain('data-estado="ninguna"');
    expect(html).toContain("Quitar el cruce");
    expect(html).toContain("Ninguna diferencia entre grupos es significativa.");
    expect(html).not.toContain("frágiles");
  });
  it("abstención: el motivo en tono de aviso", () => {
    const html = pintar("abstencion", { lamina: { ...LAMINA, estado: "abstencion", motivo: "Cada persona aporta varias respuestas." } });
    expect(html).toContain('data-estado="abstencion"');
    expect(html).toContain("is-aviso");
    expect(html).toContain("Cada persona aporta varias respuestas.");
  });
  it("error: código E_* e id, con salida acotada (reintentar o revisar la regla)", () => {
    const html = pintar("error", {
      lamina: { ...LAMINA, estado: "error", error: { code: "E_SIG_SIN_CONGLOMERADO", message: "Falta la columna de conglomerado.", error_id: "id42" } },
    });
    expect(html).toContain('data-estado="error"');
    expect(html).toContain("E_SIG_SIN_CONGLOMERADO");
    expect(html).toContain("id42");
    expect(html).toContain("Reintentar");
    expect(html).toContain("Revisar la regla");
    expect(html).toContain('data-audit-ready="graficos-diferencias"');
  });
  it("error de la llamada misma (sin lámina) también muestra su código", () => {
    const html = pintar("error", { errorCarga: { code: "E_SIG_SIN_LAMINA", message: "No existe la lámina.", error_id: null } });
    expect(html).toContain("E_SIG_SIN_LAMINA");
  });
  it("apagado no pide nada y lo dice", () => {
    const html = pintar("apagado");
    expect(html).toContain('data-estado="apagado"');
    expect(html).toContain("no marca diferencias");
  });
});
