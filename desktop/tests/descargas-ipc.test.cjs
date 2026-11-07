"use strict";

// Handlers IPC de «Mostrar en la carpeta» / «Abrir», reserva de nombres entre
// descargas simultáneas y contrato de empaquetado de los módulos locales del
// main (ADR 0133, fase 3). Complementa desktop/tests/descargas.test.cjs.

const assert = require("node:assert/strict");
const EventEmitter = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  crearHandlersEntregable,
  instalarDescargas
} = require("../descargas.cjs");

const DESKTOP_DIR = path.join(__dirname, "..");

function raizTemporal(t) {
  const raiz = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prosecnur-descargas-ipc-")));
  t.after(() => fs.rmSync(raiz, { recursive: true, force: true }));
  return raiz;
}

function escribir(ruta, contenido = "x") {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, contenido);
  return ruta;
}

function shellDoble({ openPath = async () => "" } = {}) {
  const llamadas = { showItemInFolder: [], openPath: [] };
  return {
    llamadas,
    showItemInFolder(ruta) {
      llamadas.showItemInFolder.push(ruta);
    },
    async openPath(ruta) {
      llamadas.openPath.push(ruta);
      return openPath(ruta);
    }
  };
}

function assertRechazo(resultado, contexto) {
  assert.equal(resultado.ok, false, `debió rechazarse: ${contexto}`);
  assert.equal(typeof resultado.motivo, "string", `trae motivo: ${contexto}`);
  assert.ok(resultado.motivo.length > 0, `motivo no vacío: ${contexto}`);
}

// ---------------------------------------------------------------------------
// crearHandlersEntregable
// ---------------------------------------------------------------------------

test("una ruta inválida no llega a shell", async (t) => {
  const raiz = raizTemporal(t);
  const descargas = path.join(raiz, "Descargas");
  fs.mkdirSync(descargas);
  const fuera = escribir(path.join(raiz, "Fuera", "secreto.pdf"));
  const exe = escribir(path.join(descargas, "instalador.exe"));
  escribir(path.join(descargas, "informe.pdf"));
  const shell = shellDoble();
  const handlers = crearHandlersEntregable({ shell, downloadsDir: () => descargas });

  for (const [ruta, contexto] of [
    [undefined, "sin ruta"],
    [null, "null"],
    [{ ruta: path.join(descargas, "informe.pdf") }, "objeto en vez de cadena"],
    ["informe.pdf", "relativa"],
    [fuera, "fuera de Descargas"],
    [exe, "ejecutable en Descargas"],
    [`${descargas}${path.sep}..${path.sep}Fuera${path.sep}secreto.pdf`, "traversal"],
    [path.join(descargas, "fantasma.pdf"), "inexistente"]
  ]) {
    assertRechazo(handlers.mostrarEnCarpeta(ruta), `mostrarEnCarpeta: ${contexto}`);
    assertRechazo(await handlers.abrir(ruta), `abrir: ${contexto}`);
  }
  assert.deepEqual(shell.llamadas.showItemInFolder, []);
  assert.deepEqual(shell.llamadas.openPath, []);
});

test("una ruta válida llega a shell ya resuelta y devuelve { ok: true }", async (t) => {
  const raiz = raizTemporal(t);
  const descargas = path.join(raiz, "Descargas");
  const proyecto = path.join(raiz, "Estudio");
  escribir(path.join(proyecto, "estudio.pulso"));
  const enDescargas = escribir(path.join(descargas, "informe.xlsx"));
  const enModulo = escribir(path.join(proyecto, "Entregables", "Monitoreo", "avance.pdf"));
  const shell = shellDoble();
  const handlers = crearHandlersEntregable({ shell, downloadsDir: descargas });

  assert.deepEqual(handlers.mostrarEnCarpeta(enDescargas), { ok: true });
  assert.deepEqual(await handlers.abrir(enModulo), { ok: true });
  assert.deepEqual(shell.llamadas.showItemInFolder, [fs.realpathSync.native(enDescargas)]);
  assert.deepEqual(shell.llamadas.openPath, [fs.realpathSync.native(enModulo)]);
});

test("Entregables admite una carpeta de módulo pero no más profundidad", async (t) => {
  const raiz = raizTemporal(t);
  const proyecto = path.join(raiz, "Estudio");
  escribir(path.join(proyecto, "estudio.pulso"));
  const profundo = escribir(path.join(proyecto, "Entregables", "Monitoreo", "viejo", "avance.pdf"));
  const shell = shellDoble();
  const handlers = crearHandlersEntregable({ shell, downloadsDir: path.join(raiz, "Descargas") });
  assertRechazo(await handlers.abrir(profundo), "tres niveles bajo Entregables");
  assert.deepEqual(shell.llamadas.openPath, []);
});

test("openPath con mensaje de error devuelve ok:false con ese motivo", async (t) => {
  const descargas = raizTemporal(t);
  const ruta = escribir(path.join(descargas, "base.sav"));
  const shell = shellDoble({ openPath: async () => "No hay aplicación asociada" });
  const handlers = crearHandlersEntregable({ shell, downloadsDir: () => descargas });
  assert.deepEqual(await handlers.abrir(ruta), { ok: false, motivo: "No hay aplicación asociada" });
  assert.equal(shell.llamadas.openPath.length, 1);
});

test("un fallo de shell no lanza: devuelve ok:false", async (t) => {
  const descargas = raizTemporal(t);
  const ruta = escribir(path.join(descargas, "base.sav"));
  const shell = {
    showItemInFolder() {
      throw new Error("sin explorador");
    },
    async openPath() {
      throw new Error("sin lanzador");
    }
  };
  const handlers = crearHandlersEntregable({ shell, downloadsDir: () => descargas });
  assertRechazo(handlers.mostrarEnCarpeta(ruta), "showItemInFolder lanza");
  assertRechazo(await handlers.abrir(ruta), "openPath rechaza");
});

// ---------------------------------------------------------------------------
// Reserva de nombres entre descargas simultáneas
// ---------------------------------------------------------------------------

function itemDoble(nombre) {
  const item = new EventEmitter();
  item.rutasFijadas = [];
  item.getFilename = () => nombre;
  item.setSavePath = (ruta) => item.rutasFijadas.push(ruta);
  item.getSavePath = () => item.rutasFijadas[item.rutasFijadas.length - 1] || "";
  return item;
}

function emitir(ses, nombre) {
  const item = itemDoble(nombre);
  ses.emit("will-download", { preventDefault() {} }, item, {});
  return item;
}

test("dos descargas simultáneas con el mismo nombre no se pisan", (t) => {
  const descargas = raizTemporal(t);
  const ses = new EventEmitter();
  instalarDescargas(ses, { downloadsDir: () => descargas, notificar: () => {} });

  const a = emitir(ses, "informe.xlsx");
  const b = emitir(ses, "informe.xlsx");
  const c = emitir(ses, "INFORME.xlsx");
  assert.deepEqual(a.rutasFijadas, [path.join(descargas, "informe.xlsx")]);
  assert.deepEqual(b.rutasFijadas, [path.join(descargas, "informe_2.xlsx")]);
  assert.deepEqual(c.rutasFijadas, [path.join(descargas, "INFORME_3.xlsx")]);
});

test("la reserva se libera al terminar y lo escrito en disco sigue ocupando", (t) => {
  const descargas = raizTemporal(t);
  const ses = new EventEmitter();
  instalarDescargas(ses, { downloadsDir: () => descargas, notificar: () => {} });

  const a = emitir(ses, "base.sav");
  const b = emitir(ses, "base.sav");
  // `a` se canceló: no dejó archivo y su nombre vuelve a estar libre.
  a.emit("done", {}, "cancelled");
  const c = emitir(ses, "base.sav");
  assert.deepEqual(c.rutasFijadas, [path.join(descargas, "base.sav")]);

  // `b` terminó y quedó en disco: su nombre sigue ocupado por el disco.
  escribir(path.join(descargas, "base_2.sav"));
  b.emit("done", {}, "completed");
  c.emit("done", {}, "cancelled");
  const d = emitir(ses, "base.sav");
  const e = emitir(ses, "base.sav");
  assert.deepEqual(d.rutasFijadas, [path.join(descargas, "base.sav")]);
  assert.deepEqual(e.rutasFijadas, [path.join(descargas, "base_3.sav")]);
});

test("un nombre sugerido con separadores se queda dentro de Descargas", (t) => {
  const descargas = raizTemporal(t);
  const ses = new EventEmitter();
  instalarDescargas(ses, { downloadsDir: () => descargas, notificar: () => {} });
  const a = emitir(ses, `..${path.sep}..${path.sep}fuera.pdf`);
  const b = emitir(ses, "..\\..\\otra.pdf");
  const c = emitir(ses, "..");
  assert.deepEqual(a.rutasFijadas, [path.join(descargas, "fuera.pdf")]);
  assert.deepEqual(b.rutasFijadas, [path.join(descargas, "otra.pdf")]);
  assert.deepEqual(c.rutasFijadas, [path.join(descargas, "descarga")]);
});

test("sin carpeta de Descargas se deja el comportamiento por defecto y un notificar que lanza no rompe", (t) => {
  const ses = new EventEmitter();
  instalarDescargas(ses, { downloadsDir: () => "", notificar: () => {} });
  const a = emitir(ses, "informe.pdf");
  assert.deepEqual(a.rutasFijadas, [], "sin ruta fijada, Electron decide");

  const descargas = raizTemporal(t);
  const otra = new EventEmitter();
  instalarDescargas(otra, {
    downloadsDir: () => descargas,
    notificar: () => {
      throw new Error("ventana cerrada");
    }
  });
  const b = emitir(otra, "informe.pdf");
  assert.doesNotThrow(() => b.emit("done", {}, "completed"));
});

test("Descargas ilegible (EPERM de macOS) deja el diálogo y avisa igual con la ruta elegida", (t) => {
  // Medido en Electron real el 2026-11-07: con la protección de carpetas de
  // macOS sin conceder, readdir(~/Downloads) da EPERM. La descarga cae al
  // diálogo de Electron y, sin este enganche, nunca llegaba «descarga:terminada».
  const descargas = raizTemporal(t);
  const ses = new EventEmitter();
  const avisos = [];
  const lineas = [];
  instalarDescargas(ses, {
    downloadsDir: () => descargas,
    listar: () => {
      const error = new Error("operation not permitted");
      error.code = "EPERM";
      throw error;
    },
    notificar: (d) => avisos.push(d),
    registrar: (linea) => lineas.push(linea)
  });

  const elegido = emitir(ses, "informe.xlsx");
  assert.deepEqual(elegido.rutasFijadas, [], "no fija ruta: decide el diálogo");
  const rutaDialogo = path.join(raizTemporal(t), "elegida.xlsx");
  elegido.setSavePath(rutaDialogo); // lo que hace el diálogo de Electron
  elegido.emit("done", {}, "completed");

  const cancelado = emitir(ses, "otro.xlsx");
  cancelado.emit("done", {}, "cancelled");

  assert.deepEqual(avisos, [
    { estado: "completed", nombre: "elegida.xlsx", ruta: rutaDialogo }
  ], "avisa la descarga elegida y calla el diálogo cancelado, que no dejó ruta");
  assert.ok(lineas.length >= 1 && lineas.every((l) => l.includes("EPERM")), "registra el motivo");
  assert.ok(lineas.every((l) => !l.includes(descargas)), "el log no lleva rutas");
});

// ---------------------------------------------------------------------------
// Contrato de empaquetado: todo módulo local que carga el main viaja en el
// paquete. Un require("./x.cjs") que falta en build.files arranca en dev y
// revienta solo en la app instalada.
// ---------------------------------------------------------------------------

function globARegex(glob) {
  let fuente = "";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") {
      fuente += ".*";
      i += 1;
      if (glob[i + 1] === "/") i += 1;
    } else if (ch === "*") {
      fuente += "[^/]*";
    } else if (ch === "?") {
      fuente += "[^/]";
    } else if (ch === "{") {
      const cierre = glob.indexOf("}", i);
      const opciones = glob.slice(i + 1, cierre).split(",").map((o) => o.replace(/[.+^$()|[\]\\]/g, "\\$&"));
      fuente += `(?:${opciones.join("|")})`;
      i = cierre;
    } else {
      fuente += ch.replace(/[.+^$()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${fuente}$`);
}

function empaquetado(relativo, patrones) {
  let incluido = false;
  for (const patron of patrones) {
    if (patron.startsWith("!")) {
      if (globARegex(patron.slice(1)).test(relativo)) incluido = false;
    } else if (globARegex(patron).test(relativo)) {
      incluido = true;
    }
  }
  return incluido;
}

function requiresLocales(archivo) {
  const fuente = fs.readFileSync(archivo, "utf8");
  const encontrados = [];
  const patron = /require\(\s*["'](\.\/[^"']+)["']\s*\)/g;
  let m;
  while ((m = patron.exec(fuente)) !== null) encontrados.push(m[1]);
  return encontrados;
}

test("globARegex del contrato reconoce los globs de build.files", () => {
  assert.equal(empaquetado("assets/icono.png", ["assets/**/*"]), true);
  assert.equal(empaquetado("assets/sub/icono.png", ["assets/**/*"]), true);
  assert.equal(empaquetado("otra.cjs", ["main.cjs", "assets/**/*"]), false);
  assert.equal(empaquetado("a/README.md", ["**/*", "!**/*.{md,map}"]), false);
});

test("todo require local de main.cjs (y de lo que carga) está en build.files", () => {
  const paquete = JSON.parse(fs.readFileSync(path.join(DESKTOP_DIR, "package.json"), "utf8"));
  const patrones = paquete.build && paquete.build.files;
  assert.ok(Array.isArray(patrones) && patrones.length, "build.files existe");

  const pendientes = ["main.cjs"];
  const vistos = new Set();
  while (pendientes.length) {
    const relativo = pendientes.pop();
    if (vistos.has(relativo)) continue;
    vistos.add(relativo);
    assert.ok(
      fs.existsSync(path.join(DESKTOP_DIR, relativo)),
      `${relativo} existe en desktop/`
    );
    assert.ok(empaquetado(relativo, patrones), `${relativo} está en build.files de desktop/package.json`);
    for (const req of requiresLocales(path.join(DESKTOP_DIR, relativo))) {
      pendientes.push(path.posix.normalize(path.posix.join(path.posix.dirname(relativo), req)));
    }
  }
  assert.ok(vistos.has("descargas.cjs"), "main.cjs carga descargas.cjs");
  // preload.cjs no se carga con require: el main lo pasa por ruta.
  assert.ok(empaquetado("preload.cjs", patrones), "preload.cjs está en build.files");
});

test("rutas de red UNC y flujos alternos de NTFS no llegan a disco ni a shell", async (t) => {
  const descargas = raizTemporal(t);
  const shell = shellDoble({});
  let tocoDisco = false;
  const fsEspia = new Proxy(fs, {
    get(objetivo, prop) {
      if (prop === "realpathSync" || prop === "statSync" || prop === "lstatSync") tocoDisco = true;
      return objetivo[prop];
    }
  });
  const { rutaPermitida } = require("../descargas.cjs");
  for (const ruta of [
    "\\\\servidor\\recurso\\proy\\Entregables\\x.pdf",
    "//servidor/recurso/proy/Entregables/x.pdf",
    path.join(descargas, "a.exe:x.pdf"),
    "C:\\Users\\u\\Downloads\\a.exe:x.pdf"
  ]) {
    const r = rutaPermitida(ruta, { downloadsDir: () => descargas, fs: fsEspia });
    assert.equal(r.ok, false, ruta);
    assert.ok(r.motivo, ruta);
  }
  assert.equal(tocoDisco, false);
  const handlers = crearHandlersEntregable({ shell, downloadsDir: () => descargas });
  assert.equal((await handlers.abrir("\\\\servidor\\recurso\\x.pdf")).ok, false);
  assert.deepEqual(shell.llamadas.openPath, []);
});

test("el log distingue los motivos propios de los textos del sistema", () => {
  const { esMotivoPropio, rutaPermitida } = require("../descargas.cjs");
  const r = rutaPermitida("relativa/x.pdf", { downloadsDir: () => os.tmpdir() });
  assert.equal(esMotivoPropio(r.motivo), true);
  assert.equal(esMotivoPropio("No se encontró «informe secreto.pdf»"), false);
  assert.equal(esMotivoPropio(undefined), false);
});
