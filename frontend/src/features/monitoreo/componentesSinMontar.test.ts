import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Un componente definido y nunca referenciado no lo ve nadie: ni el typecheck
// —`noUnusedLocals` no alcanza a las funciones de módulo—, ni los tests, ni el
// gate visual, que sólo mira lo que se dibuja.
//
// Salió buscando por qué cuatro avisos de recorte recién puestos no aparecían en
// pantalla: estaban dentro de `RouteView`, que no monta nadie. El barrido de los
// 474 componentes de Monitoreo encontró seis, cinco de ellos en territorial —
// restos de un layout anterior conviviendo con el actual.
//
// Este guard no borra nada: borrar una vista es decisión con doble confirmación.
// Fija la lista para que ninguno NUEVO se cuele, y para que quitar uno de la
// lista sea un acto deliberado.

const RAIZ = path.resolve(__dirname);

/**
 * Los seis medidos el 2026-08-19, más el de aulas que quedó suelto el
 * 2026-08-29 y la proyección que se desmontó el 2026-09-08. Cada uno marcado en
 * su archivo.
 */
const SIN_MONTAR_CONOCIDOS = [
  // Salió de la pestaña «Metas» el 2026-09-08 con el resto de la predicción.
  // Gonzalo: «lo nada que tenga que ver con predicción porque eso le pertenece a
  // otra pestaña» — es una MUDANZA pendiente, no un borrado, y por eso el
  // componente y su view-model (`avanceProyectado.ts`) siguen en el árbol. Si la
  // pestaña de predicción no llega a existir, esta entrada es la que recuerda
  // que hay que decidir entre montarlo allí o retirarlo.
  // Sustituido el 2026-09-08 por las cinco tablas que sirve el motor
  // (`AulasTablasDeAvance`). Gonzalo, sobre la tabla que enseñaba: «está súper
  // pobre y no refleja el avance real». Se queda en el árbol porque su
  // view-model —`avanceParaCliente.ts`, con la regla de no netear los
  // faltantes— sigue documentando decisiones que las tablas nuevas heredan; si
  // dentro de unas semanas nadie lo ha reclamado, se retira con su test.
  "AulasAvanceParaCliente.tsx::AulasAvanceParaCliente",
  "AulasAvanceProyectado.tsx::AulasAvanceProyectado",
  "AulasBrechaEstratoChart.tsx::AulasBrechaEstratoChart",
  "TelefonicoMonitoreoPage.tsx::TelefonicoPendingOperationalTable",
  "TerritorialFieldOccurrencesWorkbench.tsx::OccurrenceAlertLine",
  "TerritorialModelWorkbench.tsx::RouteSheetStrip",
  "TerritorialMonitoreoPage.tsx::AdvanceView",
  "TerritorialMonitoreoPage.tsx::RouteView",
  "TerritorialMonitoreoPage.tsx::SourceView",
];

function archivos(dir: string, acc: string[] = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) archivos(ruta, acc);
    else if (/\.tsx?$/.test(entrada.name) && !entrada.name.includes(".test.")) acc.push(ruta);
  }
  return acc;
}

const sinComentarios = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const fuentes = new Map(
  archivos(RAIZ).map((ruta) => [ruta, sinComentarios(fs.readFileSync(ruta, "utf8"))]),
);

function sinMontar() {
  const hallazgos: string[] = [];
  for (const [ruta, texto] of fuentes) {
    if (!ruta.endsWith(".tsx")) continue;
    const definidos = new Set([...texto.matchAll(/^(?:export )?function ([A-Z]\w+)\(/gm)].map((m) => m[1]));
    for (const nombre of definidos) {
      let usos = 0;
      for (const otro of fuentes.values()) {
        usos += (otro.match(new RegExp(`\\b${nombre}\\b`, "g")) ?? []).length;
      }
      // 1 = sólo su propia definición.
      if (usos <= 1) hallazgos.push(`${path.basename(ruta)}::${nombre}`);
    }
  }
  return hallazgos.sort();
}

describe("ningún componente nuevo queda sin montar", () => {
  it("el barrido mira algo", () => {
    // Si el recorrido se rompe, la lista sale vacía y el test de abajo pasaría
    // por la razón equivocada.
    expect(fuentes.size).toBeGreaterThan(60);
  });

  it("sólo están los seis conocidos", () => {
    expect(sinMontar()).toEqual([...SIN_MONTAR_CONOCIDOS].sort());
  });

  it("cada uno lleva su marca en el archivo", () => {
    const sinMarca = SIN_MONTAR_CONOCIDOS.filter((clave) => {
      const [archivo, nombre] = clave.split("::");
      const ruta = [...fuentes.keys()].find((r) => path.basename(r) === archivo);
      if (!ruta) return true;
      const crudo = fs.readFileSync(ruta, "utf8");
      const i = crudo.indexOf(`function ${nombre}(`);
      // La marca va en el bloque de comentario justo antes de la definición.
      // La ventana es generosa —una de ellas explica el caso en cinco líneas—
      // pero se corta en la definición anterior para no capturar la marca del
      // componente de arriba.
      const previo = crudo.slice(0, i);
      const desde = Math.max(previo.lastIndexOf("\n}\n"), 0);
      return !/⚠ SIN MONTAR/.test(previo.slice(desde));
    });
    expect(sinMarca).toEqual([]);
  });
});
