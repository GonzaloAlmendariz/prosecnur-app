import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Todo CSS del frontend tiene que sobrevivir a la CONCATENACIÓN del bundle.
 *
 * El bug que este contrato clava (2026-09-03, «se ve horrible» del escritorio):
 * en DEV cada hoja se parsea sola y el navegador perdona un bloque sin cerrar
 * a fin de archivo, un `}` suelto o un cierre de comentario huérfano — los
 * descarta y nadie lo nota. En el BUNDLE las hojas se concatenan y ese mismo
 * defecto DESINCRONIZA el parseo: el bloque abierto se traga la hoja
 * siguiente y todo el CSS posterior muere. Cuatro archivos llevaban semanas
 * envenenados (aulasReemplazos y aulasTextoAbierto truncados a EOF, un `}` de
 * más en la hoja congelada, y un comentario con la secuencia de cierre dentro
 * de su propio texto en distribucionElegibles): el desktop entero se veía sin
 * estilos mientras el dev se veía perfecto.
 *
 * Tres invariantes por archivo, fuera de comentarios:
 * 1. ningún cierre de comentario sin su apertura;
 * 2. ningún comentario sin cerrar al terminar el archivo;
 * 3. llaves balanceadas y nunca negativas.
 */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function* archivosCss(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* archivosCss(p);
    else if (e.name.endsWith(".css")) yield p;
  }
}

type Veredicto = {
  cierresSueltos: number[];
  comentarioAbierto: boolean;
  llaveDeMas: number[];
  bloqueSinCerrar: number | null;
};

function analizar(css: string): Veredicto {
  const v: Veredicto = { cierresSueltos: [], comentarioAbierto: false, llaveDeMas: [], bloqueSinCerrar: null };
  let i = 0;
  let linea = 1;
  let dentro = false;
  const abiertas: number[] = [];
  while (i < css.length) {
    const c = css[i];
    if (c === "\n") linea += 1;
    if (!dentro && css.startsWith("/*", i)) { dentro = true; i += 2; continue; }
    if (dentro && css.startsWith("*/", i)) { dentro = false; i += 2; continue; }
    if (!dentro && css.startsWith("*/", i)) v.cierresSueltos.push(linea);
    if (!dentro && c === "{") abiertas.push(linea);
    if (!dentro && c === "}") {
      if (abiertas.length === 0) v.llaveDeMas.push(linea);
      else abiertas.pop();
    }
    i += 1;
  }
  v.comentarioAbierto = dentro;
  v.bloqueSinCerrar = abiertas.length ? abiertas[abiertas.length - 1] : null;
  return v;
}

describe("los CSS del frontend son concatenables sin veneno", () => {
  const archivos = [...archivosCss(RAIZ)];

  it("hay hojas que auditar", () => {
    expect(archivos.length).toBeGreaterThan(30);
  });

  for (const archivo of archivos) {
    it(path.relative(RAIZ, archivo), () => {
      const v = analizar(fs.readFileSync(archivo, "utf8"));
      expect(v.cierresSueltos, "cierre de comentario sin apertura (línea)").toEqual([]);
      expect(v.comentarioAbierto, "comentario sin cerrar al final del archivo").toBe(false);
      expect(v.llaveDeMas, "llave de cierre de más (línea)").toEqual([]);
      expect(v.bloqueSinCerrar, "bloque abierto sin cerrar (línea de apertura)").toBeNull();
    });
  }
});
