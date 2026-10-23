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
  // Desmontado el 2026-10-23 por el revamp de acreditación (Insumos › Fuentes,
  // ficha I2): el maestro de fuentes por público con su detalle reemplaza el
  // inventario por papel, enlace al servicio incluido. Es una MUDANZA, no un
  // borrado: retirar el archivo es decisión con doble confirmación.
  "FuentesResumen.tsx::FuentesResumen",
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
  // Desconectado de «Metas» el 2026-09-09 al montar el revamp, y NO borrado:
  // este panel («Qué metas van a cerrar y cuáles no») y el bloque nuevo «Metas
  // y aulas» discrepan en 28 de las 30 celdas facultad × sexo —DERECHO/F 152,9
  // contra 300,9— porque cuentan universos distintos: el nuevo proyecta sólo lo
  // AGENDADO y éste cuenta todos los cursos-horario en juego, y hay 33
  // titulares planificados sin fecha. Dos «proyectado» por celda con el doble
  // de diferencia en la misma pantalla no se puede quedar.
  //
  // Lo que este panel dice y el nuevo no es la CALIBRACIÓN —«el campo está
  // rindiendo un X % menos de lo previsto»—, y esa pieza merece volver como
  // lectura, no como un segundo panel de proyección. Esta entrada es la que
  // recuerda que hay que decidirlo con Gonzalo, no dejarlo pudrirse.
  "AulasSexoPorFacultadChart.tsx::AulasSexoPorFacultadChart",
  // Retirada de «Metas» el 2026-09-08, con decisión de Gonzalo. Su función era
  // dimensionar la magnitud de cada meta; hoy esa magnitud se lee en el carril
  // de «Cumplimiento de la cuota» —proporcional a la cuota de cada facultad— y
  // en «Qué metas van a cerrar y cuáles no», que publica las cifras absolutas
  // por facultad y sexo. Con cinco paneles en la pestaña, era tinta repetida.
  // Era «Dónde falta más» en Resumen, retirado el 2026-09-08: medía cada
  // facultad contra LA CUOTA DEL ESTUDIO, que es el denominador y la pregunta de
  // Metas, no el avance del operativo. Allá ya se contesta dos veces con más
  // detalle, y por un camino distinto del suyo (`avance_cuota` en vez de
  // `avance_por_facultad`), que es la forma más barata de que un día discrepen.
  "AulasPerfilPorFacultad.tsx::AulasPerfilPorFacultad",
  "AulasPiramideCuota.tsx::AulasPiramideCuota",
  // Retirado de «Rendimiento» el mismo día, y su propio comentario ya lo pedía:
  // «son la misma pregunta a dos escalas y conviene decidir si sobra uno».
  // Contaba efectivas del PARTE con el mismo nombre que «Ritmo de la
  // recolección» cuenta válidas de PLATAFORMA. Manda la plataforma: es el
  // numerador de la banda de KPIs y el de la meta.
  "AulasRitmoPorFacultad.tsx::AulasRitmoPorFacultad",
  "AulasAvanceProyectado.tsx::AulasAvanceProyectado",
  "AulasBrechaEstratoChart.tsx::AulasBrechaEstratoChart",
  // Retirado de Resumen el 2026-09-10 a pedido de Gonzalo: «Cursos-horario
  // vencidos sin aplicar se va porque no es necesario». Lo que contaba —fecha
  // pasada y sin parte— lo dice el reparto por rol del panel de agendación, que
  // separa agendadas de aplicadas. Se desmonta, no se borra.
  "AulasFrenteDelOperativo.tsx::AulasFrenteDelOperativo",
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

  it("sólo están los conocidos", () => {
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
