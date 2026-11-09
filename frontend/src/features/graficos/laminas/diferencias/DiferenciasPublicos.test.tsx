// Mata (ADR 0138): un par frágil o desconocido pintado como marca firme, el intervalo de Newcombe usado como marca, una
// abstención sin su motivo, un tema sin equivalencia sin decir dónde declararla, un panorama sin matriz mudo y una
// readiness que se queda en `false` fuera del cálculo.
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { normalizeDiferenciasLamina } from "../../../../api/graficosDiferencias";
import { DiferenciasPublicosVista } from "./DiferenciasPublicos";
import { estadoPublicos, marcaDe, rotuloVeredicto } from "./modeloDiferenciasPublicos";

const nada = () => undefined;
const NOTA = "Diferencias entre públicos (muestras independientes): prueba z, corrección de Bonferroni, al menos 10 puntos y 30 casos por público.";

const grupos = [
  { base: "docentes", etiqueta: "Docentes", p: 78, n: 120, comparable: true },
  { base: "estudiantes", etiqueta: "Estudiantes", p: 64, n: 410, comparable: true },
  { base: "egresados", etiqueta: "Egresados", p: 70, n: 22, comparable: false, motivo: "menos de 30 casos" },
];

const LAMINA = normalizeDiferenciasLamina({
  estado: "con_marcas",
  modo_letras: "entre_publicos",
  nota: NOTA,
  familia: { m: 6, local: false },
  temas: [
    {
      fila: "Satisfacción con la biblioteca", estado: "evaluable", equivalencia: "matriz", indicador: "Top Two Box", grupos,
      pares: [
        { a: "docentes", b: "estudiantes", p_a: 78, p_b: 64, dif_pp: 14, p: 0.0004, p_ajustado: 0.0012, veredicto: "marcada", ic_newcombe: [6.2, 21.3] },
        { a: "egresados", b: "estudiantes", p_a: 70, p_b: 64, dif_pp: 6, p: 0.04, p_ajustado: 0.12, veredicto: "no_comparable" },
      ],
    },
    {
      fila: "Trato del personal", estado: "evaluable", equivalencia: "emparejado", grupos: grupos.slice(0, 2),
      pares: [
        { a: "docentes", b: "estudiantes", p_a: 60, p_b: 48, dif_pp: 12, p: 0.03, p_ajustado: 0.04, veredicto: "fragil" },
      ],
    },
    {
      fila: "Infraestructura", estado: "evaluable", equivalencia: "matriz", grupos: grupos.slice(0, 2),
      pares: [
        { a: "docentes", b: "estudiantes", p_a: 55, p_b: 50, dif_pp: 5, p: 0.2, p_ajustado: 0.4, veredicto: "bajo_umbral" },
        { a: "estudiantes", b: "docentes", p_a: 50, p_b: 55, dif_pp: -5, p: 0.2, p_ajustado: 0.4, veredicto: "algo_nuevo" },
      ],
    },
    { fila: "Clima laboral", estado: "sin_equivalencia", motivo: "sin equivalencia declarada entre públicos, no se compara", equivalencia: null, grupos: [], pares: [] },
    { fila: "Satisfacción general", estado: "escalas_distintas", motivo: "escalas distintas, no se compara", equivalencia: "matriz", grupos: [], pares: [] },
  ],
  tarjetas: [],
});

const pintar = (lamina = LAMINA, donde: "matriz" | "temas" = "temas", estado = estadoPublicos({ estado: "listo", datos: { lamina } })) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <DiferenciasPublicosVista estado={estado} lamina={lamina} errorCarga={null} donde={donde}
        onReintentar={nada} onAbrirRegla={nada} onIrAlEmparejado={nada} />
    </MemoryRouter>,
  );

describe("inspector entre públicos: veredictos", () => {
  it("cada par con su veredicto: ▲ la marcada, △ punteada la frágil, sin marca lo demás", () => {
    const html = pintar();
    expect(html).toContain('data-estado="con_marcas"');
    expect(html).toContain('data-audit-ready="graficos-diferencias-publicos"');
    expect(html).toMatch(/class="pulso-sig-pub-par is-marcada" data-veredicto="marcada"/);
    expect(html).toMatch(/class="pulso-sig-pub-par is-fragil" data-veredicto="fragil"/);
    expect(html).toMatch(/class="pulso-sig-pub-par" data-veredicto="bajo_umbral"/);
    expect(html).toMatch(/class="pulso-sig-pub-par" data-veredicto="no_comparable"/);
    expect(html).toMatch(/class="pulso-sig-pub-par" data-veredicto="desconocido"/);
    expect(html).toContain("Docentes 78% frente a Estudiantes 64%");
    expect(html).toContain("+14 pp");
    expect(html).toContain("Bajo el umbral");
    expect(html).toContain("No comparable");
    expect(html).toContain("Veredicto &quot;algo_nuevo&quot;");
  });

  it("el intervalo de Newcombe es un dato secundario, nunca la marca", () => {
    const html = pintar();
    expect(html).toMatch(/<span class="pulso-sig-pub-par-dato">p &lt; 0.001, p ajustado 0.001, intervalo de Newcombe 6.2 a 21.3 pp<\/span>/);
    expect(marcaDe("no_significativa")).toBeNull();
    expect(marcaDe("fuera_de_familia")).toBeNull();
    expect(marcaDe("desconocido")).toBeNull();
    expect(rotuloVeredicto({ veredicto: "fuera_de_familia", veredicto_crudo: null })).toBe("Fuera de la familia");
  });

  it("públicos con p y n; el que no entra a la prueba dice por qué", () => {
    const html = pintar();
    expect(html).toContain("Docentes: 78%, n 120");
    expect(html).toContain("Egresados: 70%, n 22 (menos de 30 casos)");
  });

  it("estado y motivo de cada tema, la equivalencia, la familia y el pie", () => {
    const html = pintar();
    expect(html).toContain("Fila de la matriz de equivalencias");
    expect(html).toContain("Par confirmado en el emparejado");
    expect(html).toContain("Escalas distintas");
    expect(html).toContain("escalas distintas, no se compara");
    expect(html).toContain("Familia entre públicos: 6 comparaciones del informe.");
    expect(html).toContain(NOTA);
    // Resumen: 3 de 5 comparados, 2 pares marcados (uno frágil), 1 sin equivalencia.
    expect(html).toContain("3 de 5 temas comparados");
    expect(html).toContain("2 pares marcados");
    expect(html).toContain("1 frágil");
    expect(html).toContain("1 sin equivalencia declarada");
  });
});

describe("inspector entre públicos: sin equivalencia y abstenciones", () => {
  it("un tema sin equivalencia apunta a los temas por público y a la matriz", () => {
    const html = pintar();
    const bloque = html.slice(html.indexOf('data-estado="sin_equivalencia"'));
    expect(bloque).toContain("Sin equivalencia declarada");
    expect(bloque).toContain("Ir a los temas por público");
    expect(bloque).toMatch(/<a[^>]*href="[^"]*pestana=equivalencias[^"]*"[^>]*>Matriz de equivalencias/);
  });

  it("abstención: dice el motivo y no marca nada", () => {
    const lamina = normalizeDiferenciasLamina({
      estado: "abstencion", modo_letras: "entre_publicos", motivo: "menos de dos públicos con datos para comparar",
      temas: [{ fila: "Tema", estado: "abstencion", motivo: "menos de dos públicos con datos para comparar", equivalencia: "emparejado", grupos: [], pares: [] }],
    });
    const html = pintar(lamina);
    expect(html).toContain('data-estado="abstencion"');
    expect(html).toContain("No se compara ningún tema: menos de dos públicos con datos para comparar.");
    expect(html).not.toContain("is-marcada\" data-veredicto");
  });

  it("panorama sin matriz: abstención con temas vacíos que pide declarar la matriz", () => {
    const lamina = normalizeDiferenciasLamina({ estado: "abstencion", modo_letras: "entre_publicos", temas: [], tarjetas: [] });
    const html = pintar(lamina, "matriz");
    expect(html).toContain('data-estado="sin_temas"');
    expect(html).toContain('data-vacio="sin-matriz"');
    expect(html).toContain("Declara la matriz para comparar.");
    expect(html).toMatch(/href="[^"]*pestana=equivalencias/);
    expect(html).not.toContain("Ir a los temas por público");
  });

  it("calculando publica `false`; error dice el código y deja reintentar", () => {
    const cargando = pintar(LAMINA, "temas", "calculando");
    expect(cargando).toContain('data-audit-ready="false"');
    expect(cargando).toContain("Comparando los públicos");
    expect(pintar()).not.toContain('data-audit-ready="false"');
    const conError = normalizeDiferenciasLamina({ estado: "error", modo_letras: "entre_publicos", error: { code: "E_SIG_PRUEBA_FALLO", message: "La prueba no pudo ejecutarse en esta lámina.", error_id: "ab12cd34" } });
    const html = pintar(conError);
    expect(html).toContain('data-estado="error"');
    expect(html).toContain("E_SIG_PRUEBA_FALLO");
    expect(html).toContain("Reintentar");
  });
});
