import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OrigenExterno } from "../../api/cargaOrigenExterno";
import { OrigenExternoVista, type OrigenExternoCarga, type OrigenExternoEnvio } from "./OrigenExternoPanel";
import { BORRADOR_VACIO, borradorDesde, type OrigenExternoBorrador } from "./origenExternoModel";

const css = fs.readFileSync(fileURLToPath(new URL("./OrigenExternoPanel.css", import.meta.url)), "utf8");

const HSYVBG: OrigenExterno = {
  base: "hostigamiento",
  estado: "vigente",
  bloque: {
    script: "limpieza_hostigamiento.R",
    version: "v3",
    n_recibidas: 3327,
    n_recibidas_deducida: false,
    n_entregadas: 3318,
    n_excluidas: 9,
    data_file_id: "abc",
    declarado_at: "2026-10-13T15:00:00Z",
    enabled: true,
    variables_retiradas: [],
    n_variables_retiradas: 0,
  },
  resumen: {
    recibidas: 3327,
    excluidas: 9,
    entregadas: 3318,
    por_categoria: [{ categoria: "crítico", n: 3 }, { categoria: "ambiguo", n: 6 }],
    variables_retiradas: { total: 0, por_motivo: [] },
  },
  variables_faltantes: [],
  avisos: [],
  variables_excluidas_agregadas: [],
};

const FALTANTES: OrigenExterno["variables_faltantes"] = [
  { variable: "start", tipo: "start", motivo_sugerido: "metadato" },
  { variable: "p40", tipo: "text", motivo_sugerido: "" },
];

const SOLO_VARIABLES: OrigenExterno = {
  ...HSYVBG,
  bloque: {
    ...HSYVBG.bloque!,
    script: "",
    version: "",
    n_recibidas: 3318,
    n_excluidas: 0,
    variables_retiradas: [
      { variable: "start", tipo: "start", motivo: "metadato" },
      { variable: "p40", tipo: "text", motivo: "no_va_al_cliente" },
      { variable: "p41", tipo: "text", motivo: "otra" },
    ],
    n_variables_retiradas: 3,
  },
  resumen: {
    recibidas: 3318,
    excluidas: 0,
    entregadas: 3318,
    por_categoria: [],
    variables_retiradas: {
      total: 3,
      por_motivo: [
        { motivo: "metadato", n: 1 },
        { motivo: "no_va_al_cliente", n: 1 },
        { motivo: "otra", n: 1 },
      ],
    },
  },
  variables_faltantes: [...FALTANTES, { variable: "p41", tipo: "text", motivo_sugerido: "" }],
  avisos: [{ codigo: "variable_presente", mensaje: "p12 sí está en la base; no se declaró como retirada." }],
  variables_excluidas_agregadas: ["start", "p40"],
};

function render(
  carga: OrigenExternoCarga,
  envio: OrigenExternoEnvio = { tipo: "quieto" },
  borrador: OrigenExternoBorrador = BORRADOR_VACIO,
) {
  return renderToStaticMarkup(
    <OrigenExternoVista
      carga={carga}
      borrador={borrador}
      envio={envio}
      onBorrador={() => undefined}
      onDeclarar={() => undefined}
    />,
  );
}

describe("OrigenExternoVista", () => {
  it("sin declaración explica el vacío dentro de su zona y ofrece declarar", () => {
    const html = render({ tipo: "listo", datos: { ...HSYVBG, estado: "", bloque: null, resumen: null } });
    expect(html).toContain("Sin declarar");
    expect(html).toMatch(/data-qa-geometry-capacity="owned"[^>]*>\s*<div class="pulso-origen-externo-vacio">/u);
    expect(html).toContain("Base preparada fuera de la plataforma");
    expect(html).toContain("Si la base llega con menos casos o menos variables que el instrumento, declara qué se retiró y por qué.");
    expect(html).toContain("no declara una preparación externa");
    expect(html).not.toMatch(/burla/iu);
    expect(html).toContain(">Declarar<");
    expect(html).toContain('accept=".xlsx,.xls,.csv"');
  });

  it("declarada: muestra la cadena, las categorías y la procedencia", () => {
    const html = render({ tipo: "listo", datos: HSYVBG });
    expect(html).toContain('aria-label="Recibidas 3,327 → retiradas fuera 9 → cargadas 3,318"');
    expect(html).toContain('data-qa-geometry-group="carga-origen-externo-tramos"');
    expect(html).toContain('data-qa-geometry-contract="equal"');
    const tramos = html.slice(html.indexOf('data-qa-geometry-group="carga-origen-externo-tramos"'), html.indexOf("</ol>"));
    expect(tramos.match(/data-qa-geometry-member=""/gu)).toHaveLength(3);
    expect(html).toContain("<dt>crítico</dt><dd>3</dd>");
    expect(html).toContain("<dt>ambiguo</dt><dd>6</dd>");
    expect(html).toContain("limpieza_hostigamiento.R · versión v3 · declarada el 2026-10-13");
    expect(html).toContain(">Declarar<");
    expect(html).not.toContain("variables retiradas</strong>");
    expect(html).not.toContain("La declaración habla de una base anterior");
  });

  it("otra_base lo dice con la frase del contrato", () => {
    const html = render({ tipo: "listo", datos: { ...HSYVBG, estado: "otra_base" } });
    expect(html).toContain("Otra base");
    expect(html).toContain("La declaración habla de una base anterior; vuelve a declararla para esta base.");
  });

  it("pinta los avisos con su texto", () => {
    const html = render({
      tipo: "listo",
      datos: {
        ...HSYVBG,
        avisos: [
          { codigo: "siguen_en_la_base", mensaje: "2 encuesta(s) de la lista siguen en la base cargada." },
          { codigo: "no_cuadra", mensaje: "Se declararon 3330 recibidas." },
        ],
      },
    });
    expect(html).toContain('data-aviso="siguen_en_la_base"');
    expect(html).toContain("2 encuesta(s) de la lista siguen en la base cargada.");
    expect(html).toContain("Se declararon 3330 recibidas.");
  });

  it("leyendo y con error mantiene la misma zona de resultado", () => {
    const leyendo = render({ tipo: "leyendo" });
    expect(leyendo).toContain('role="status"');
    expect(leyendo).toContain("pulso-origen-externo-resultado");
    const error = render({ tipo: "error", mensaje: "E_BASE_NOT_FOUND" });
    expect(error).toContain('role="alert"');
    expect(error).toContain("pulso-origen-externo-resultado");
    const envio = render({ tipo: "listo", datos: HSYVBG }, { tipo: "error", mensaje: "E_BAD_FILE: falta _uuid" });
    expect(envio).toContain("E_BAD_FILE: falta _uuid");
  });

  it("el botón queda deshabilitado y dice por qué si no hay nada que declarar", () => {
    const html = render({ tipo: "listo", datos: { ...HSYVBG, variables_faltantes: FALTANTES } }, undefined, {
      ...BORRADOR_VACIO,
      motivos: { start: "", p40: "" },
    });
    expect(html).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/u);
    expect(html).toMatch(/<button(?=[^>]*aria-describedby=)/u);
    expect(html).toContain("No hay nada que declarar: elige la lista de casos retirados o el motivo de alguna variable.");
  });

  it("con faltantes: lista con tipo y selector precargado con la sugerencia", () => {
    const datos = { ...HSYVBG, variables_faltantes: FALTANTES };
    const html = render({ tipo: "listo", datos }, undefined, borradorDesde(datos));
    expect(html).toContain("Casos retirados");
    expect(html).toContain("Variables retiradas");
    expect(html).toContain('data-qa-geometry-group="carga-origen-externo-partes"');
    expect(html).toContain('data-qa-geometry-contract="intrinsic"');
    expect(html).toContain('data-qa-geometry-group="carga-origen-externo-variables"');
    expect(html).toContain("Faltan 2 variables del instrumento en la base.");
    expect(html).toContain("no salen en los entregables");
    expect(html).toContain("no salen en los entregables: bases,");
    // El tipo no se repite cuando es igual al nombre (QA 2026-10-13: «start / start»).
    expect(html).toContain("<code title=\"start\">start</code></span>");
    expect(html).toContain("<code title=\"p40\">p40</code><small>text</small>");
    expect(html).toContain('aria-label="Motivo de start"');
    // start viene con la sugerencia; p40 queda sin elegir.
    expect(html).toMatch(/aria-label="Motivo de start"[^]*?<option value="metadato" selected="">Metadato<\/option>/u);
    expect(html).toMatch(/aria-label="Motivo de p40"[^>]*><option value="" selected="">Sin elegir<\/option>/u);
    expect(html).toContain(">No va al cliente</option>");
    // La sugerencia ya basta para declarar.
    expect(html).not.toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/u);
  });

  it("sin faltantes: una línea corta y ningún «0 variables»", () => {
    const html = render({ tipo: "listo", datos: HSYVBG });
    expect(html).toContain("La base trae todas las variables del instrumento.");
    expect(html).not.toMatch(/\b0 variables?\b/u);
    expect(html).not.toContain("Motivo de");
  });

  it("muchas faltantes no cambian el marco: una fila por variable, sin scroll propio", () => {
    const muchas = Array.from({ length: 30 }, (_, i) => ({ variable: `p${i + 1}`, tipo: "text", motivo_sugerido: "" as const }));
    const html = render({ tipo: "listo", datos: { ...HSYVBG, variables_faltantes: muchas } });
    expect(html).toContain("Faltan 30 variables del instrumento en la base.");
    const lista = html.slice(html.indexOf('data-qa-geometry-group="carga-origen-externo-variables"'));
    expect(lista.match(/data-qa-geometry-member=""/gu)?.length).toBeGreaterThanOrEqual(30);
    const reglaLista = css.slice(css.indexOf(".pulso-origen-externo-variables {"), css.indexOf("}", css.indexOf(".pulso-origen-externo-variables {")));
    expect(reglaLista).not.toMatch(/overflow|max-height/u);
  });

  it("resultado de variables: total, desglose, excluidas y avisos; sin cadena de casos", () => {
    const html = render({ tipo: "listo", datos: SOLO_VARIABLES });
    expect(html).toContain("3 variables retiradas");
    expect(html).toContain('aria-label="Variables retiradas por motivo"');
    expect(html).toContain("<dt>Metadato</dt><dd>1</dd>");
    expect(html).toContain("<dt>No va al cliente</dt><dd>1</dd>");
    expect(html).toContain("<dt>Otra</dt><dd>1</dd>");
    expect(html).toContain("No salen en los entregables: start, p40.");
    expect(html).toContain('href="/analitica?pestana=datos&amp;panel=excluidas&amp;foco=');
    expect(html).toContain('data-aviso="variable_presente"');
    expect(html).toContain("p12 sí está en la base; no se declaró como retirada.");
    expect(html).not.toContain("carga-origen-externo-tramos");
  });

  it("casos y variables a la vez: las dos lecturas", () => {
    const html = render({
      tipo: "listo",
      datos: {
        ...SOLO_VARIABLES,
        bloque: { ...SOLO_VARIABLES.bloque!, n_excluidas: 9 },
        resumen: { ...SOLO_VARIABLES.resumen!, recibidas: 3327, excluidas: 9 },
      },
    });
    expect(html).toContain('aria-label="Recibidas 3,327 → retiradas fuera 9 → cargadas 3,318"');
    expect(html).toContain("3 variables retiradas");
  });

  it("el CSS solo usa tokens, sin hex propios", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
    expect(css).toMatch(/var\(--pulso-warn-bg\)/u);
  });
});
