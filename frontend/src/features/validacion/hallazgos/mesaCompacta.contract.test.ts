import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Hallazgos a 1024 de ventana (mesa de menos de 980 px, ítem 16 del checklist
// de Validación usada por un practicante). La mesa del kit pasa a dos columnas,
// baja la tercera a todo el ancho y deja que la pestaña se desplace con cada
// contenedor de hasta 520 px y su propio scroll. En Hallazgos eso dejaba la
// Decisión entera bajo el borde (la pestaña se desplazaba 861 px a 1024x600) y
// la cola y el hallazgo se desplazaban dentro de una pestaña que también se
// desplazaba: scroll dentro de scroll (C4). Hallazgos conserva las tres
// columnas con el alto de la pestaña y un dueño de scroll por columna.

const aqui = path.dirname(fileURLToPath(import.meta.url));
const hoja = fs.readFileSync(path.join(aqui, "hallazgos.css"), "utf8");

function bloqueCompacto(): string {
  const inicio = hoja.indexOf("@container mesa-pestana (max-width: 979px)");
  if (inicio < 0) return "";
  let profundidad = 0;
  for (let i = hoja.indexOf("{", inicio); i < hoja.length; i += 1) {
    if (hoja[i] === "{") profundidad += 1;
    if (hoja[i] === "}") {
      profundidad -= 1;
      if (profundidad === 0) return hoja.slice(inicio, i + 1);
    }
  }
  return "";
}

function regla(bloque: string, selector: string): string {
  const i = bloque.indexOf(`${selector} {`);
  if (i < 0) return "";
  return bloque.slice(i, bloque.indexOf("}", i));
}

describe("Hallazgos a 1024: la Decisión al lado, sin scroll dentro de scroll", () => {
  const compacto = bloqueCompacto();
  const mesa = '.pulso-validacion-pestana-hallazgos .pulso-mesa-pestana[data-columnas="3"]';

  test("las tres columnas siguen lado a lado con el alto de la pestaña", () => {
    const columnas = regla(compacto, mesa);
    expect(columnas).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)/);
    const pistas = /grid-template-columns:\s*([^;]+);/.exec(columnas)?.[1] ?? "";
    expect(pistas.trim().split(/\s+(?![^(]*\))/)).toHaveLength(3);
    expect(regla(compacto, `${mesa} > :nth-child(3)`)).toMatch(/grid-column:\s*auto/);
  });

  test("la mesa ocupa el alto de la pestaña y ningún contenedor se corta a 520 px", () => {
    expect(regla(compacto, ".pulso-validacion-pestana-hallazgos .pulso-mesa-pestana")).toMatch(/flex:\s*1 1 auto/);
    expect(compacto).toMatch(
      /\.pulso-validacion-pestana-hallazgos \.pulso-mesa-pestana > \.pulso-panel-de-mesa,[^{]*\{\s*max-block-size:\s*none/,
    );
  });

  test("la Decisión no vuelve a medir su contenido para empujar la pestaña", () => {
    expect(compacto).not.toMatch(/pulso-panel-de-mesa--decision > \.pulso-panel-de-mesa-cuerpo\s*\{\s*overflow:\s*visible/);
  });
});
