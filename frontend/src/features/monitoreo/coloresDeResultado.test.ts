import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { COLORES_DE_RESULTADO_EXCLUSIVOS, COLOR_RESULTADO } from "./coloresDeResultado";

// Este archivo es un contrato, no una prueba de comportamiento: impide que los
// colores de resultado vuelvan a escribirse a mano en una vista.
//
// El defecto que lo motiva: el mismo trío verde / ámbar / granate estaba
// repetido en 26 literales sobre 9 archivos entre Acreditación y Telefónico, y
// cambiar el verde de «efectiva» obligaba a encontrarlos todos. Una vista que se
// quedara atrás pintaba dos cosas distintas del mismo color sin fallar.

const RAIZ = join(__dirname, "profiles");

// Excepciones deliberadas, cada una por una razón distinta:
//
// - `ritmoDiario.ts` no pinta resultados: pinta el semáforo de cumplimiento de
//   una cuota (va bien / atención / riesgo). Coincide en color por ahora, y
//   unificarlo acoplaría dos escalas que pueden divergir.
// - `familiasDeLlamada.ts` es la fuente de los estados de LLAMADA, que
//   el usuario declara por estudio; sus valores de fábrica son suyos.
const EXCEPCIONES = ["ritmoDiario.ts", "familiasDeLlamada.ts"];

function archivosDeVista(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivosDeVista(ruta);
    if (!/\.tsx?$/.test(nombre)) return [];
    if (/\.test\.tsx?$/.test(nombre)) return [];
    if (EXCEPCIONES.includes(nombre)) return [];
    return [ruta];
  });
}

describe("colores de resultado", () => {
  // Solo los cromáticos: el gris de «revisión» y el del acumulado coinciden con
  // el color del texto de los ejes, así que su literal aparece por motivos
  // legítimos. Ver `COLORES_DE_RESULTADO_EXCLUSIVOS`.
  const literales = COLORES_DE_RESULTADO_EXCLUSIVOS;

  it("no se escriben a mano en ninguna vista de perfil", () => {
    const infractores: string[] = [];
    for (const ruta of archivosDeVista(RAIZ)) {
      const contenido = readFileSync(ruta, "utf-8");
      for (const color of literales) {
        // Se busca el literal entre comillas: mencionarlo en un comentario, para
        // explicar de dónde viene una decisión, es legítimo.
        if (contenido.includes(`"${color}"`)) {
          infractores.push(`${ruta.replace(RAIZ, "profiles")} → ${color}`);
        }
      }
    }
    expect(infractores).toEqual([]);
  });

  it("cada desenlace tiene su color y no hay dos iguales", () => {
    // Dos desenlaces del mismo color son indistinguibles en el gráfico, que es
    // exactamente el defecto que ya apareció con dos azules casi idénticos.
    const valores = Object.values(COLOR_RESULTADO);
    expect(new Set(valores).size).toBe(valores.length);
  });
});
