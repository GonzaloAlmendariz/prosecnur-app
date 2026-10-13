import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OrigenExterno } from "../../api/cargaOrigenExterno";
import { OrigenExternoVista, type OrigenExternoCarga, type OrigenExternoEnvio } from "./OrigenExternoPanel";
import { BORRADOR_VACIO } from "./origenExternoModel";

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
  },
  resumen: {
    recibidas: 3327,
    excluidas: 9,
    entregadas: 3318,
    por_categoria: [{ categoria: "crítico", n: 3 }, { categoria: "ambiguo", n: 6 }],
  },
  avisos: [],
};

function render(carga: OrigenExternoCarga, envio: OrigenExternoEnvio = { tipo: "quieto" }) {
  return renderToStaticMarkup(
    <OrigenExternoVista
      carga={carga}
      borrador={BORRADOR_VACIO}
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
    expect(html).toContain("no declara una depuración externa");
    expect(html).toContain(">Declarar<");
    expect(html).toContain('accept=".xlsx,.xls,.csv"');
  });

  it("declarada: muestra la cadena, las categorías y la procedencia", () => {
    const html = render({ tipo: "listo", datos: HSYVBG });
    expect(html).toContain('aria-label="Recibidas 3,327 → retiradas fuera 9 → cargadas 3,318"');
    expect(html).toContain('data-qa-geometry-group="carga-origen-externo-tramos"');
    expect(html).toContain('data-qa-geometry-contract="equal"');
    expect(html.match(/data-qa-geometry-member=""/gu)).toHaveLength(3);
    expect(html).toContain("<dt>crítico</dt><dd>3</dd>");
    expect(html).toContain("<dt>ambiguo</dt><dd>6</dd>");
    expect(html).toContain("limpieza_hostigamiento.R · versión v3 · declarada el 2026-10-13");
    expect(html).toContain("Volver a declarar");
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

  it("el botón queda deshabilitado y dice qué falta mientras no hay archivo", () => {
    const html = render({ tipo: "listo", datos: HSYVBG });
    expect(html).toMatch(/<button(?=[^>]*type="submit")(?=[^>]*disabled="")/u);
    expect(html).toContain("Elige la lista de exclusiones (xlsx o csv).");
  });

  it("el CSS solo usa tokens, sin hex propios", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/iu);
    expect(css).toMatch(/var\(--pulso-warn-bg\)/u);
  });
});
