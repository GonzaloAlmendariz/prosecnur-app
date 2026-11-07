"use strict";

// =============================================================================
// descargas.cjs — descargas de escritorio sin diálogo (ADR 0133, fase 3)
// =============================================================================
// Lo que no quedó guardado junto al proyecto llega por una descarga del
// renderer (`<a download>`). Electron abriría el diálogo «Guardar como»; aquí
// se fija la ruta en la carpeta de Descargas del sistema con el mismo nombre y
// sin sobrescribir (`_2`, `_3`… antes de la extensión, como el §4 del ADR).
//
// «Mostrar en la carpeta» y «Abrir» reciben una ruta desde el renderer. Antes
// de llegar a `shell` pasa por `rutaPermitida`: absoluta, sin `..`, un archivo
// real con extensión de entregable y, ya resueltos los symlinks, dentro de
// Descargas o de `<carpeta del .pulso>/Entregables[/<Módulo>]`.
//
// El módulo no requiere `electron`: `shell` y la sesión llegan inyectados, de
// modo que se prueba con node:test (desktop/tests/descargas*.test.cjs).

const nodeFs = require("node:fs");
const path = require("node:path");

// Extensiones que un entregable puede tener. Fuera de la lista quedan los
// ejecutables y todo lo que el sistema abriría con un intérprete (.htm, .xlsm,
// .js, .lnk…), y el propio .pulso, que no es un entregable.
const EXTENSIONES_PERMITIDAS = new Set([
  ".xlsx", ".xls", ".csv", ".sav", ".sps", ".pdf", ".docx", ".pptx", ".zip",
  ".html", ".json", ".md", ".png", ".txt", ".r"
]);

// Extensiones compuestas: el sufijo numérico va antes de todo el bloque.
const EXTENSIONES_COMPUESTAS = [".pulso-graficos.zip"];

const CARPETA_ENTREGABLES = "Entregables";
// `Entregables/<archivo>` o `Entregables/<Módulo>/<archivo>` (ADR 0133 §4-§5).
const PROFUNDIDAD_MAXIMA_ENTREGABLES = 2;

// Windows y macOS (APFS por defecto) no distinguen mayúsculas.
const SISTEMA_SIN_MAYUSCULAS = process.platform === "win32" || process.platform === "darwin";

function separarExtension(nombre) {
  const minusculas = nombre.toLowerCase();
  for (const compuesta of EXTENSIONES_COMPUESTAS) {
    if (minusculas.endsWith(compuesta) && minusculas.length > compuesta.length) {
      const corte = nombre.length - compuesta.length;
      return { base: nombre.slice(0, corte), extension: nombre.slice(corte) };
    }
  }
  const extension = path.extname(nombre);
  return { base: nombre.slice(0, nombre.length - extension.length), extension };
}

function listarDisco(dir) {
  try {
    return nodeFs.readdirSync(dir);
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return [];
    throw error;
  }
}

/**
 * Nombre que no choca con nada de `dir` (sin distinguir mayúsculas). Conserva
 * `nombre` si está libre; si no, el primer `_N` libre desde 2.
 * `opciones.listar(dir)` devuelve los nombres ocupados (por defecto, el disco).
 */
function nombreLibre(dir, nombre, opciones = {}) {
  const listar = typeof opciones.listar === "function" ? opciones.listar : listarDisco;
  const ocupados = new Set((listar(dir) || []).map((n) => String(n).toLowerCase()));
  if (!ocupados.has(nombre.toLowerCase())) return nombre;
  const { base, extension } = separarExtension(nombre);
  for (let n = 2; ; n += 1) {
    const candidato = `${base}_${n}${extension}`;
    if (!ocupados.has(candidato.toLowerCase())) return candidato;
  }
}

// Reduce lo que Electron sugiere a un nombre de archivo plano: nunca una ruta.
function nombreSeguro(sugerido) {
  const crudo = typeof sugerido === "string" ? sugerido : "";
  const ultimo = crudo.split(/[\\/]/).pop() || "";
  const limpio = ultimo.replace(/[\u0000-\u001f]/g, "").trim();
  if (!limpio || limpio === "." || limpio === "..") return "descarga";
  return limpio;
}

function resolverDownloadsDir(downloadsDir) {
  const valor = typeof downloadsDir === "function" ? downloadsDir() : downloadsDir;
  return typeof valor === "string" && valor ? valor : "";
}

function claveComparable(ruta) {
  return SISTEMA_SIN_MAYUSCULAS ? ruta.toLowerCase() : ruta;
}

function estaDentro(base, ruta) {
  const relativa = path.relative(claveComparable(base), claveComparable(ruta));
  return Boolean(relativa) && !relativa.startsWith("..") && !path.isAbsolute(relativa);
}

function realpath(fs, ruta) {
  const nativo = fs.realpathSync && fs.realpathSync.native;
  return typeof nativo === "function" ? nativo(ruta) : fs.realpathSync(ruta);
}

// Busca, subiendo como mucho dos niveles, una carpeta `Entregables` cuya
// carpeta padre tenga un `.pulso`. Se evalúa sobre la ruta ya resuelta.
function dentroDeEntregables(fs, real) {
  let dir = path.dirname(real);
  for (let nivel = 0; nivel < PROFUNDIDAD_MAXIMA_ENTREGABLES; nivel += 1) {
    if (path.basename(dir) === CARPETA_ENTREGABLES) {
      const proyecto = path.dirname(dir);
      let entradas = [];
      try {
        entradas = fs.readdirSync(proyecto, { withFileTypes: true });
      } catch (_error) {
        return false;
      }
      return entradas.some(
        (entrada) => entrada.isFile() && entrada.name.toLowerCase().endsWith(".pulso")
      );
    }
    const padre = path.dirname(dir);
    if (padre === dir) return false;
    dir = padre;
  }
  return false;
}

// Motivos que escribe este módulo. Cualquier otro viene del sistema (p. ej. el
// texto de error de shell.openPath, que puede traer el nombre del archivo) y no
// se copia al log.
const MOTIVOS_PROPIOS = new Set();

function rechazo(motivo) {
  MOTIVOS_PROPIOS.add(motivo);
  return { ok: false, motivo };
}

function esMotivoPropio(motivo) {
  return typeof motivo === "string" && MOTIVOS_PROPIOS.has(motivo);
}

function extensionPermitida(ruta) {
  return EXTENSIONES_PERMITIDAS.has(path.extname(ruta).toLowerCase());
}

/**
 * ¿Puede «Mostrar en la carpeta» / «Abrir» tocar esta ruta?
 * Devuelve `{ ok: true, ruta: <ruta resuelta> }` o `{ ok: false, motivo }`.
 * Nunca lanza.
 */
function rutaPermitida(ruta, opciones = {}) {
  const fs = opciones.fs || nodeFs;
  try {
    if (typeof ruta !== "string" || !ruta) return rechazo("La ruta no es válida.");
    if (ruta.includes("\u0000")) return rechazo("La ruta no es válida.");
    if (!path.isAbsolute(ruta)) return rechazo("La ruta no es absoluta.");
    // Namespaces de dispositivo de Windows (\\?\, \\.\): nunca son un entregable.
    if (/^[\\/]{2}[?.][\\/]/.test(ruta)) return rechazo("La ruta no es válida.");
    // Rutas de red (UNC, \\servidor\recurso): se rechazan antes de tocar disco,
    // porque resolverlas ya abre una conexión SMB. Una unidad mapeada (Z:\) sí pasa.
    if (/^[\\/]{2}/.test(ruta)) return rechazo("Las rutas de red no se abren desde la app.");
    // Flujos alternos de NTFS (archivo.exe:x.pdf): ningún entregable lleva «:»
    // fuera de la letra de unidad.
    if (ruta.replace(/^[A-Za-z]:/, "").includes(":")) return rechazo("La ruta no es válida.");
    if (ruta.split(/[\\/]/).some((segmento) => segmento === "..")) {
      return rechazo("La ruta contiene segmentos «..».");
    }
    if (!extensionPermitida(ruta)) return rechazo("El tipo de archivo no es un entregable.");

    const descargas = resolverDownloadsDir(opciones.downloadsDir);

    let real;
    try {
      real = realpath(fs, ruta);
    } catch (_error) {
      return rechazo("El archivo no existe.");
    }
    let info;
    try {
      info = fs.statSync(real);
    } catch (_error) {
      return rechazo("El archivo no existe.");
    }
    if (!info.isFile()) return rechazo("La ruta no es un archivo.");
    // Un symlink con extensión de entregable puede apuntar a otra cosa.
    if (!extensionPermitida(real)) return rechazo("El tipo de archivo no es un entregable.");

    if (descargas) {
      let descargasReal = "";
      try {
        descargasReal = realpath(fs, descargas);
      } catch (_error) {
        descargasReal = "";
      }
      if (descargasReal && estaDentro(descargasReal, real)) return { ok: true, ruta: real };
    }
    if (dentroDeEntregables(fs, real)) return { ok: true, ruta: real };
    return rechazo("El archivo no está en Descargas ni en la carpeta Entregables de un proyecto.");
  } catch (_error) {
    return rechazo("No se pudo comprobar la ruta.");
  }
}

/**
 * Engancha `will-download` en la sesión: cada descarga se guarda sin diálogo en
 * `downloadsDir()` (se lee en cada descarga) con un nombre libre, y al terminar
 * se llama `notificar({ estado, nombre, ruta })` una sola vez.
 *
 * Dos descargas simultáneas con el mismo nombre no se pisan: el nombre asignado
 * queda reservado en memoria hasta su `done`, porque el archivo aún no está
 * completo en disco cuando llega la segunda.
 */
function instalarDescargas(ses, opciones = {}) {
  const notificar = typeof opciones.notificar === "function" ? opciones.notificar : () => {};
  // Diagnóstico opcional (main.cjs pasa writeLog). Nunca recibe rutas.
  const registrar = (linea) => {
    if (typeof opciones.registrar !== "function") return;
    try {
      opciones.registrar(`${linea}\n`);
    } catch (_error) {
      // El log no puede tumbar una descarga.
    }
  };
  const listarEnDisco = typeof opciones.listar === "function" ? opciones.listar : listarDisco;
  // dir comparable → Set de nombres en minúsculas reservados.
  const reservas = new Map();

  function reservar(dir, nombre) {
    const clave = claveComparable(path.resolve(dir));
    if (!reservas.has(clave)) reservas.set(clave, new Set());
    reservas.get(clave).add(nombre.toLowerCase());
    return () => {
      const conjunto = reservas.get(clave);
      if (!conjunto) return;
      conjunto.delete(nombre.toLowerCase());
      if (!conjunto.size) reservas.delete(clave);
    };
  }

  function ocupados(dir) {
    const reservados = reservas.get(claveComparable(path.resolve(dir)));
    const enDisco = listarEnDisco(dir) || [];
    return reservados ? [...enDisco, ...reservados] : enDisco;
  }

  ses.on("will-download", (_event, item) => {
    let dir = "";
    try {
      dir = resolverDownloadsDir(opciones.downloadsDir);
    } catch (_error) {
      dir = "";
    }
    // Sin carpeta de Descargas utilizable (desconocida, o ilegible: EPERM de la
    // protección de carpetas de macOS, EACCES) se deja el comportamiento por
    // defecto de Electron, el diálogo: mejor preguntar que perder el archivo.
    // El aviso de `done` se engancha igual, con la ruta que eligió el usuario.
    let rutaFijada = "";
    let liberar = () => {};
    if (dir) {
      try {
        const nombre = nombreLibre(dir, nombreSeguro(item.getFilename()), { listar: ocupados });
        liberar = reservar(dir, nombre);
        try {
          nodeFs.mkdirSync(dir, { recursive: true });
        } catch (_error) {
          // Si no se puede crear, la descarga terminará `interrupted` y se avisa.
        }
        rutaFijada = path.join(dir, nombre);
        item.setSavePath(rutaFijada);
      } catch (error) {
        liberar();
        liberar = () => {};
        rutaFijada = "";
        registrar(`[descargas] sin ruta automática, queda el diálogo (${(error && error.code) || "error"})`);
      }
    } else {
      registrar("[descargas] sin carpeta de Descargas, queda el diálogo");
    }

    let avisado = false;
    item.once("done", (_doneEvent, estado) => {
      liberar();
      if (avisado) return;
      avisado = true;
      const ruta = (typeof item.getSavePath === "function" && item.getSavePath()) || rutaFijada;
      // Un diálogo cancelado no deja ruta: no hay nada que abrir ni mostrar.
      if (!ruta) return;
      try {
        notificar({ estado: String(estado), nombre: path.basename(ruta), ruta });
      } catch (_error) {
        // La ventana pudo cerrarse; el archivo ya está en disco.
      }
    });
  });
}

/**
 * Handlers de «Mostrar en la carpeta» y «Abrir». Validan con `rutaPermitida`
 * antes de tocar `shell` y devuelven `{ ok: true }` o `{ ok: false, motivo }`.
 */
function crearHandlersEntregable({ shell, downloadsDir, fs } = {}) {
  const opciones = { downloadsDir, fs: fs || nodeFs };

  function validar(ruta) {
    return rutaPermitida(ruta, opciones);
  }

  return {
    mostrarEnCarpeta(ruta) {
      const decision = validar(ruta);
      if (!decision.ok) return { ok: false, motivo: decision.motivo };
      try {
        shell.showItemInFolder(decision.ruta);
        return { ok: true };
      } catch (_error) {
        return { ok: false, motivo: "No se pudo mostrar el archivo en su carpeta." };
      }
    },
    async abrir(ruta) {
      const decision = validar(ruta);
      if (!decision.ok) return { ok: false, motivo: decision.motivo };
      try {
        const error = await shell.openPath(decision.ruta);
        if (typeof error === "string" && error) return { ok: false, motivo: error };
        return { ok: true };
      } catch (_error) {
        return { ok: false, motivo: "No se pudo abrir el archivo." };
      }
    }
  };
}

module.exports = {
  EXTENSIONES_PERMITIDAS,
  crearHandlersEntregable,
  esMotivoPropio,
  instalarDescargas,
  nombreLibre,
  rutaPermitida
};
