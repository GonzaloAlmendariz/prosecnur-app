"use strict";

// Descargas de escritorio sin diálogo (ADR 0133, fase 3 de
// docs/qa/checklist-descargas-unificadas-2026-11-07.md). Lo que no quedó
// guardado junto al proyecto va a la carpeta de Descargas del sistema con el
// mismo nombre y sin sobrescribir; «Mostrar en la carpeta» y «Abrir» solo
// alcanzan entregables dentro de Descargas o de `<proyecto>/Entregables`.

const assert = require("node:assert/strict");
const EventEmitter = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

function loadDescargas() {
  // El módulo se crea con el fix. El require dentro de cada test deja un rojo
  // causal por caso mientras el seam aún no existe (mismo patrón que
  // security.test.cjs).
  return require("../descargas.cjs");
}

// Raíz temporal real. Se resuelve con realpath para que el `/var` →
// `/private/var` de macOS no confunda la comparación de contención: lo que se
// prueba aquí es la frontera, no la normalización del tmpdir del sistema.
function raizTemporal(t) {
  const raiz = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prosecnur-descargas-")));
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  return raiz;
}

function escribir(ruta, contenido = "x") {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, contenido);
  return ruta;
}

function symlinkOSaltar(t, destino, enlace) {
  try {
    fs.symlinkSync(destino, enlace);
    return true;
  } catch (error) {
    // Windows sin modo desarrollador no deja crear symlinks: el caso no se
    // puede montar, no es un verde.
    if (error && (error.code === "EPERM" || error.code === "EACCES")) {
      t.skip(`no se pueden crear symlinks aquí (${error.code})`);
      return false;
    }
    throw error;
  }
}

// Escenario: Descargas, un proyecto con su .pulso y su carpeta Entregables, una
// carpeta Entregables huérfana (sin .pulso al lado) y una carpeta ajena.
function escenario(t) {
  const raiz = raizTemporal(t);
  const descargas = path.join(raiz, "Descargas");
  const proyecto = path.join(raiz, "Estudios", "HSVG2026");
  const entregables = path.join(proyecto, "Entregables");
  const huerfana = path.join(raiz, "Suelta", "Entregables");
  const fuera = path.join(raiz, "Fuera");
  fs.mkdirSync(descargas, { recursive: true });
  fs.mkdirSync(entregables, { recursive: true });
  fs.mkdirSync(huerfana, { recursive: true });
  fs.mkdirSync(fuera, { recursive: true });
  escribir(path.join(proyecto, "hsvg2026.pulso"), "zip");
  return { raiz, descargas, proyecto, entregables, huerfana, fuera };
}

function permitida(ruta, descargas) {
  const { rutaPermitida } = loadDescargas();
  return rutaPermitida(ruta, { downloadsDir: () => descargas });
}

function assertRechazada(resultado, contexto) {
  assert.equal(resultado.ok, false, `debió rechazarse: ${contexto}`);
  assert.equal(typeof resultado.motivo, "string", `el rechazo trae motivo: ${contexto}`);
  assert.ok(resultado.motivo.length > 0, `el motivo no está vacío: ${contexto}`);
}

// ---------------------------------------------------------------------------
// nombreLibre
// ---------------------------------------------------------------------------

test("nombreLibre conserva el nombre cuando no choca con nada", () => {
  const { nombreLibre } = loadDescargas();
  const listar = () => ["otro.xlsx", "informe.pdf"];
  assert.equal(nombreLibre("/descargas", "informe.xlsx", { listar }), "informe.xlsx");
});

test("nombreLibre añade _2, _3… antes de la extensión sin sobrescribir", () => {
  const { nombreLibre } = loadDescargas();
  assert.equal(
    nombreLibre("/descargas", "informe.xlsx", { listar: () => ["informe.xlsx"] }),
    "informe_2.xlsx"
  );
  assert.equal(
    nombreLibre("/descargas", "informe.xlsx", {
      listar: () => ["informe.xlsx", "informe_2.xlsx"]
    }),
    "informe_3.xlsx"
  );
  // Un hueco en la serie se reutiliza: no hace falta ir al final.
  assert.equal(
    nombreLibre("/descargas", "informe.xlsx", {
      listar: () => ["informe.xlsx", "informe_3.xlsx"]
    }),
    "informe_2.xlsx"
  );
});

test("nombreLibre compara sin distinguir mayúsculas (Windows y macOS no las distinguen)", () => {
  const { nombreLibre } = loadDescargas();
  assert.equal(
    nombreLibre("/descargas", "informe.xlsx", { listar: () => ["INFORME.XLSX"] }),
    "informe_2.xlsx"
  );
  assert.equal(
    nombreLibre("/descargas", "Informe.xlsx", {
      listar: () => ["informe.xlsx", "INFORME_2.xlsx"]
    }),
    "Informe_3.xlsx"
  );
});

test("nombreLibre respeta la doble extensión .pulso-graficos.zip", () => {
  const { nombreLibre } = loadDescargas();
  assert.equal(
    nombreLibre("/descargas", "mazo.pulso-graficos.zip", {
      listar: () => ["mazo.pulso-graficos.zip"]
    }),
    "mazo_2.pulso-graficos.zip"
  );
  assert.equal(
    nombreLibre("/descargas", "mazo.pulso-graficos.zip", {
      listar: () => ["mazo.pulso-graficos.zip", "MAZO_2.PULSO-GRAFICOS.ZIP"]
    }),
    "mazo_3.pulso-graficos.zip"
  );
});

test("nombreLibre solo toma la última extensión en nombres con puntos y numera los que no tienen", () => {
  const { nombreLibre } = loadDescargas();
  assert.equal(
    nombreLibre("/descargas", "informe.v2.pdf", { listar: () => ["informe.v2.pdf"] }),
    "informe.v2_2.pdf"
  );
  assert.equal(
    nombreLibre("/descargas", "LEEME", { listar: () => ["LEEME"] }),
    "LEEME_2"
  );
});

test("nombreLibre usa el disco por defecto y trata una carpeta inexistente como vacía", (t) => {
  const { nombreLibre } = loadDescargas();
  const raiz = raizTemporal(t);
  escribir(path.join(raiz, "base.sav"));
  assert.equal(nombreLibre(raiz, "base.sav"), "base_2.sav");
  assert.equal(nombreLibre(raiz, "otra.sav"), "otra.sav");
  assert.equal(nombreLibre(path.join(raiz, "no-existe"), "base.sav"), "base.sav");
});

// ---------------------------------------------------------------------------
// rutaPermitida
// ---------------------------------------------------------------------------

test("rutaPermitida acepta entregables dentro de Descargas", (t) => {
  const { descargas } = escenario(t);
  for (const nombre of [
    "informe.xlsx", "base.xls", "tabla.csv", "base.sav", "sintaxis.sps", "reporte.pdf",
    "informe.docx", "mazo.pptx", "mazo.pulso-graficos.zip", "tablero.html", "datos.json",
    "notas.md", "grafico.png", "log.txt", "replica.r"
  ]) {
    const ruta = escribir(path.join(descargas, nombre));
    assert.equal(permitida(ruta, descargas).ok, true, `debió permitirse ${nombre}`);
  }
});

test("rutaPermitida acepta extensiones en mayúsculas", (t) => {
  const { descargas } = escenario(t);
  const ruta = escribir(path.join(descargas, "REPORTE.PDF"));
  assert.equal(permitida(ruta, descargas).ok, true);
  const r = escribir(path.join(descargas, "Replica.R"));
  assert.equal(permitida(r, descargas).ok, true);
});

test("rutaPermitida acepta la carpeta Entregables de un proyecto con su .pulso", (t) => {
  const { descargas, entregables } = escenario(t);
  const ruta = escribir(path.join(entregables, "codebook.xlsx"));
  assert.equal(permitida(ruta, descargas).ok, true);
});

test("rutaPermitida rechaza ejecutables y extensiones fuera de la lista, también en Descargas", (t) => {
  const { descargas, entregables } = escenario(t);
  for (const nombre of [
    "instalador.exe", "script.bat", "script.cmd", "viejo.com", "paquete.msi", "script.ps1",
    "script.sh", "Programa.app", "codigo.js", "macro.vbs", "acceso.lnk", "imagen.dmg",
    "paquete.pkg", "INSTALADOR.EXE", "documento.pdf.exe", "sin-extension", "pagina.htm",
    "libro.xlsm", "proyecto.pulso"
  ]) {
    for (const carpeta of [descargas, entregables]) {
      const ruta = escribir(path.join(carpeta, nombre));
      assertRechazada(permitida(ruta, descargas), `${nombre} en ${path.basename(carpeta)}`);
    }
  }
});

test("rutaPermitida rechaza rutas relativas", (t) => {
  const { descargas } = escenario(t);
  escribir(path.join(descargas, "informe.xlsx"));
  const previo = process.cwd();
  process.chdir(descargas);
  t.after(() => process.chdir(previo));
  assertRechazada(permitida("informe.xlsx", descargas), "relativa simple");
  assertRechazada(permitida(path.join(".", "informe.xlsx"), descargas), "relativa con ./");
});

test("rutaPermitida rechaza traversal con .. aunque el destino exista", (t) => {
  const { descargas, fuera, entregables } = escenario(t);
  escribir(path.join(fuera, "secreto.pdf"));
  escribir(path.join(descargas, "informe.pdf"));
  escribir(path.join(entregables, "informe.pdf"));
  // Sale de Descargas hacia una carpeta ajena.
  assertRechazada(
    permitida(`${descargas}${path.sep}..${path.sep}Fuera${path.sep}secreto.pdf`, descargas),
    "../Fuera desde Descargas"
  );
  // Sale de Entregables hacia la raíz del proyecto.
  escribir(path.join(path.dirname(entregables), "notas.md"));
  assertRechazada(
    permitida(`${entregables}${path.sep}..${path.sep}notas.md`, descargas),
    "../ desde Entregables"
  );
  // Un .. que vuelve a caer dentro también se rechaza: el contrato no acepta
  // segmentos de traversal en la ruta que llega del renderer.
  fs.mkdirSync(path.join(descargas, "sub"));
  assertRechazada(
    permitida(`${descargas}${path.sep}sub${path.sep}..${path.sep}informe.pdf`, descargas),
    "sub/.. que vuelve a Descargas"
  );
});

test("rutaPermitida rechaza un symlink dentro de Descargas que apunta fuera", (t) => {
  const { descargas, fuera } = escenario(t);
  const destino = escribir(path.join(fuera, "secreto.pdf"));
  const enlace = path.join(descargas, "inocente.pdf");
  if (!symlinkOSaltar(t, destino, enlace)) return;
  assertRechazada(permitida(enlace, descargas), "symlink a Fuera");

  // Un symlink con extensión permitida que apunta a un ejecutable ajeno.
  const exe = escribir(path.join(fuera, "malware.exe"));
  const disfrazado = path.join(descargas, "reporte.pdf");
  if (!symlinkOSaltar(t, exe, disfrazado)) return;
  assertRechazada(permitida(disfrazado, descargas), "symlink .pdf → .exe fuera");
});

test("rutaPermitida rechaza una carpeta Entregables enlazada fuera del proyecto", (t) => {
  const { descargas, raiz, fuera } = escenario(t);
  const otroProyecto = path.join(raiz, "Trampa");
  fs.mkdirSync(otroProyecto);
  escribir(path.join(otroProyecto, "trampa.pulso"));
  escribir(path.join(fuera, "secreto.xlsx"));
  const enlace = path.join(otroProyecto, "Entregables");
  if (!symlinkOSaltar(t, fuera, enlace)) return;
  assertRechazada(
    permitida(path.join(enlace, "secreto.xlsx"), descargas),
    "Entregables es symlink a una carpeta ajena"
  );
});

test("rutaPermitida rechaza archivos fuera de Descargas y de Entregables", (t) => {
  const { descargas, fuera, proyecto, huerfana } = escenario(t);
  assertRechazada(
    permitida(escribir(path.join(fuera, "informe.xlsx")), descargas),
    "carpeta ajena"
  );
  assertRechazada(
    permitida(escribir(path.join(proyecto, "informe.xlsx")), descargas),
    "raíz del proyecto, fuera de Entregables"
  );
  assertRechazada(
    permitida(escribir(path.join(huerfana, "informe.xlsx")), descargas),
    "Entregables sin .pulso en la carpeta padre"
  );
  // Una carpeta que solo se parece a Descargas por prefijo no es Descargas.
  const vecina = `${descargas}-copia`;
  fs.mkdirSync(vecina);
  assertRechazada(
    permitida(escribir(path.join(vecina, "informe.xlsx")), descargas),
    "prefijo de Descargas"
  );
  // Una carpeta llamada Entregables-viejos no es Entregables.
  const parecida = path.join(proyecto, "Entregables-viejos");
  assertRechazada(
    permitida(escribir(path.join(parecida, "informe.xlsx")), descargas),
    "Entregables-viejos"
  );
});

test("rutaPermitida rechaza lo que no existe y lo que no es un archivo", (t) => {
  const { descargas } = escenario(t);
  assertRechazada(permitida(path.join(descargas, "fantasma.xlsx"), descargas), "inexistente");
  const carpeta = path.join(descargas, "carpeta.zip");
  fs.mkdirSync(carpeta);
  assertRechazada(permitida(carpeta, descargas), "carpeta con extensión de entregable");
});

test("rutaPermitida no lanza ante entradas que no son cadenas", (t) => {
  const { descargas } = escenario(t);
  for (const valor of [undefined, null, 42, {}, ""]) {
    assertRechazada(permitida(valor, descargas), `entrada ${JSON.stringify(valor)}`);
  }
});

test("rutaPermitida acepta downloadsDir como función o como cadena", (t) => {
  // instalarDescargas lo recibe como función (`downloadsDir()`); aquí se
  // aceptan las dos formas para que main.cjs pase el mismo valor a ambos.
  const { rutaPermitida } = loadDescargas();
  const { descargas } = escenario(t);
  const ruta = escribir(path.join(descargas, "informe.xlsx"));
  assert.equal(rutaPermitida(ruta, { downloadsDir: () => descargas }).ok, true);
  assert.equal(rutaPermitida(ruta, { downloadsDir: descargas }).ok, true);
});

// ---------------------------------------------------------------------------
// instalarDescargas
// ---------------------------------------------------------------------------

function itemDoble(nombre) {
  const item = new EventEmitter();
  item.rutasFijadas = [];
  item.getFilename = () => nombre;
  item.setSavePath = (ruta) => {
    item.rutasFijadas.push(ruta);
  };
  item.getSavePath = () => item.rutasFijadas[item.rutasFijadas.length - 1] || "";
  return item;
}

function eventoDoble() {
  const evento = { prevenido: false };
  evento.preventDefault = () => {
    evento.prevenido = true;
  };
  return evento;
}

test("instalarDescargas registra will-download y guarda sin diálogo en Descargas con nombre libre", (t) => {
  const { instalarDescargas } = loadDescargas();
  const descargas = raizTemporal(t);
  escribir(path.join(descargas, "informe.xlsx"));
  const ses = new EventEmitter();
  const avisos = [];
  instalarDescargas(ses, { downloadsDir: () => descargas, notificar: (d) => avisos.push(d) });

  assert.equal(ses.listenerCount("will-download"), 1, "debe escuchar will-download");

  const item = itemDoble("informe.xlsx");
  const evento = eventoDoble();
  ses.emit("will-download", evento, item, {});

  assert.equal(evento.prevenido, false, "no debe cancelar la descarga");
  assert.deepEqual(item.rutasFijadas, [path.join(descargas, "informe_2.xlsx")]);
  assert.deepEqual(avisos, [], "no avisa hasta que la descarga termina");
});

test("instalarDescargas avisa al terminar con estado, nombre y ruta", (t) => {
  const { instalarDescargas } = loadDescargas();
  const descargas = raizTemporal(t);
  const ses = new EventEmitter();
  const avisos = [];
  instalarDescargas(ses, { downloadsDir: () => descargas, notificar: (d) => avisos.push(d) });

  for (const [nombre, estado] of [
    ["base.sav", "completed"],
    ["mazo.pptx", "cancelled"],
    ["reporte.pdf", "interrupted"]
  ]) {
    const item = itemDoble(nombre);
    ses.emit("will-download", eventoDoble(), item, {});
    item.emit("done", {}, estado);
    // `done` llega una sola vez; un segundo emit no debe duplicar el aviso.
    item.emit("done", {}, estado);
  }

  assert.deepEqual(avisos, [
    { estado: "completed", nombre: "base.sav", ruta: path.join(descargas, "base.sav") },
    { estado: "cancelled", nombre: "mazo.pptx", ruta: path.join(descargas, "mazo.pptx") },
    { estado: "interrupted", nombre: "reporte.pdf", ruta: path.join(descargas, "reporte.pdf") }
  ]);
});

test("instalarDescargas avisa con el nombre ya desambiguado, incluida la doble extensión", (t) => {
  const { instalarDescargas } = loadDescargas();
  const descargas = raizTemporal(t);
  escribir(path.join(descargas, "MAZO.pulso-graficos.zip"));
  const ses = new EventEmitter();
  const avisos = [];
  instalarDescargas(ses, { downloadsDir: () => descargas, notificar: (d) => avisos.push(d) });

  const item = itemDoble("mazo.pulso-graficos.zip");
  ses.emit("will-download", eventoDoble(), item, {});
  item.emit("done", {}, "completed");

  const esperada = path.join(descargas, "mazo_2.pulso-graficos.zip");
  assert.deepEqual(item.rutasFijadas, [esperada]);
  assert.deepEqual(avisos, [
    { estado: "completed", nombre: "mazo_2.pulso-graficos.zip", ruta: esperada }
  ]);
});

test("instalarDescargas lee la carpeta de Descargas en cada descarga", (t) => {
  const { instalarDescargas } = loadDescargas();
  const primera = raizTemporal(t);
  const segunda = raizTemporal(t);
  let actual = primera;
  const ses = new EventEmitter();
  instalarDescargas(ses, { downloadsDir: () => actual, notificar: () => {} });

  const a = itemDoble("a.csv");
  ses.emit("will-download", eventoDoble(), a, {});
  actual = segunda;
  const b = itemDoble("b.csv");
  ses.emit("will-download", eventoDoble(), b, {});

  assert.deepEqual(a.rutasFijadas, [path.join(primera, "a.csv")]);
  assert.deepEqual(b.rutasFijadas, [path.join(segunda, "b.csv")]);
});

test("el módulo se carga sin Electron (testeable con node:test)", () => {
  const modulo = loadDescargas();
  for (const nombre of ["nombreLibre", "rutaPermitida", "instalarDescargas"]) {
    assert.equal(typeof modulo[nombre], "function", `exporta ${nombre}`);
  }
  const fuente = fs.readFileSync(path.join(__dirname, "..", "descargas.cjs"), "utf8");
  const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const nivelSuperior = sinComentarios
    .split("\n")
    .filter((linea) => /^\S/.test(linea));
  assert.ok(
    !nivelSuperior.some((linea) => /require\(\s*["']electron["']\s*\)/.test(linea)),
    "no requiere electron en el nivel superior"
  );
});
