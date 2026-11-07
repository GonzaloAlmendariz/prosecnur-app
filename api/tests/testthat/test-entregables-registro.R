# ADR 0133 §1 (un registro) y §4 (una carpeta).
#
# `entregable_registrar(sid, path, kind, base = NULL, detalle = NULL, original_name = NULL)` registra
# el archivo en `s$files` con los campos de siempre más `modulo`, `rotulo`, `guardado_en` y
# `aviso_guardado`; con un .pulso guardado y fuera del modo público copia el archivo, sin diálogo, a
# `<carpeta del .pulso>/Entregables/<Módulo>/<nombre>`. Nunca sobrescribe (comparando sin distinguir
# mayúsculas, como Windows), no copia si la ruta pasa de 240 y una copia fallida no hace fallar la
# generación. `.register_output_file()` queda como envoltorio que delega en él.
#
# Los kinds se eligen del catálogo por su `guardar`, no por nombre: qué kind se guarda puede cambiar
# mientras los flujos del front migran (Consecuencias del ADR), y el contrato aquí es la carpeta.

.er_catalogo <- function() {
  cat <- entregables_catalogo()
  if (is.data.frame(cat)) return(cat)
  data.frame(
    kind = names(cat),
    rotulo = vapply(cat, function(e) as.character(e$rotulo %||% NA_character_)[1], character(1)),
    modulo = vapply(cat, function(e) as.character(e$modulo %||% NA_character_)[1], character(1)),
    guardar = vapply(cat, function(e) isTRUE(e$guardar), logical(1)),
    stringsAsFactors = FALSE
  )
}

# Un kind que se guarda junto al proyecto, con su módulo y rótulo.
.er_kind_guardable <- function() {
  cat <- .er_catalogo()
  guardables <- cat[as.logical(cat$guardar) %in% TRUE, , drop = FALSE]
  testthat::expect_gt(nrow(guardables), 0L)
  as.list(guardables[1L, c("kind", "rotulo", "modulo")])
}

.er_sesion <- function(proyecto_dir = NULL, codigo = "HSVG2026", envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  if (!is.null(proyecto_dir)) {
    dir.create(proyecto_dir, recursive = TRUE, showWarnings = FALSE)
    pulso <- file.path(proyecto_dir, "estudio.pulso")
    writeBin(as.raw(0), pulso)
    s <- session_get(sid)
    s$project_path <- pulso
    .session_env[[sid]] <- s
  }
  if (!is.null(codigo)) .planner_declarar(sid, "estudio", list(nombre = "Estudio", codigo = codigo), 0L)
  sid
}

# Un archivo recién generado en downloads/ de la sesión, como lo deja un motor.
.er_archivo <- function(sid, contenido = "generado", ext = "xlsx") {
  path <- file.path(session_get(sid)$dir, "downloads",
                    paste0(uuid::UUIDgenerate(), "__salida.", ext))
  writeLines(contenido, path)
  path
}

.er_entregables <- function(proyecto_dir) {
  list.files(file.path(proyecto_dir, "Entregables"), recursive = TRUE, all.files = TRUE)
}

test_that("§1: el meta conserva sus campos, agrega módulo/rótulo/guardado y queda en s$files", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  k <- .er_kind_guardable()
  dir <- withr::local_tempdir()
  sid <- .er_sesion(dir)
  path <- .er_archivo(sid)

  meta <- entregable_registrar(sid, path, k$kind)
  expect_true(all(c("file_id", "kind", "original_name", "path", "size", "ext", "uploaded_at",
                    "modulo", "rotulo", "guardado_en", "aviso_guardado") %in% names(meta)))
  expect_identical(meta$kind, k$kind)
  expect_identical(meta$path, path)
  expect_identical(meta$ext, "xlsx")
  expect_identical(meta$modulo, k$modulo)
  expect_identical(meta$rotulo, k$rotulo)
  expect_identical(session_get(sid)$files[[meta$file_id]]$file_id, meta$file_id)
  # Sin original_name, el nombre es el del §3 (no el basename con el UUID interno).
  expect_identical(meta$original_name, entregable_nombre(sid, k$rotulo, "xlsx"))
  expect_false(grepl("[0-9a-fA-F-]{36}", meta$original_name))
})

test_that("§4: con proyecto guardado, copia a Entregables/<Módulo>/<nombre> sin diálogo", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  k <- .er_kind_guardable()
  dir <- withr::local_tempdir()
  sid <- .er_sesion(dir)
  meta <- entregable_registrar(sid, .er_archivo(sid, "uno"), k$kind)

  esperado <- file.path(dir, "Entregables", k$modulo, meta$original_name)
  expect_false(is.null(meta$guardado_en))
  expect_true(file.exists(meta$guardado_en))
  expect_identical(normalizePath(meta$guardado_en), normalizePath(esperado))
  expect_identical(basename(meta$guardado_en), meta$original_name)
  expect_identical(readLines(meta$guardado_en), "uno")
  expect_null(meta$aviso_guardado)
})

test_that("§4: nunca sobrescribe; el repetido sale con _2 y luego _3", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  k <- .er_kind_guardable()
  dir <- withr::local_tempdir()
  sid <- .er_sesion(dir)

  m1 <- entregable_registrar(sid, .er_archivo(sid, "uno"), k$kind)
  m2 <- entregable_registrar(sid, .er_archivo(sid, "dos"), k$kind)
  m3 <- entregable_registrar(sid, .er_archivo(sid, "tres"), k$kind)
  expect_identical(basename(m2$guardado_en), sub("\\.xlsx$", "_2.xlsx", basename(m1$guardado_en)))
  expect_identical(basename(m3$guardado_en), sub("\\.xlsx$", "_3.xlsx", basename(m1$guardado_en)))
  expect_identical(readLines(m1$guardado_en), "uno")
  expect_identical(readLines(m2$guardado_en), "dos")
  expect_identical(readLines(m3$guardado_en), "tres")
})

test_that("§4: un archivo que difiere sólo en mayúsculas cuenta como repetido (Windows)", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  k <- .er_kind_guardable()
  dir <- withr::local_tempdir()
  sid <- .er_sesion(dir)
  nombre <- entregable_nombre(sid, k$rotulo, "xlsx")
  carpeta <- file.path(dir, "Entregables", k$modulo)
  dir.create(carpeta, recursive = TRUE)
  ajeno <- file.path(carpeta, tolower(nombre))
  writeLines("del usuario", ajeno)

  meta <- entregable_registrar(sid, .er_archivo(sid, "nuevo"), k$kind)
  expect_identical(basename(meta$guardado_en), sub("\\.xlsx$", "_2.xlsx", nombre))
  expect_identical(readLines(ajeno), "del usuario")
})

test_that("§4: ruta de más de 240 caracteres no se copia y lo dice aviso_guardado", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  k <- .er_kind_guardable()
  raiz <- withr::local_tempdir()
  tramo <- strrep("carpeta_de_proyecto_", 3L)
  dir <- file.path(raiz, tramo, tramo, tramo, tramo)
  sid <- .er_sesion(dir)
  nombre <- entregable_nombre(sid, k$rotulo, "xlsx")
  expect_gt(nchar(file.path(dir, "Entregables", k$modulo, nombre)), 240L)

  meta <- entregable_registrar(sid, .er_archivo(sid), k$kind)
  expect_null(meta$guardado_en)
  expect_type(meta$aviso_guardado, "character")
  expect_true(nzchar(meta$aviso_guardado))
  expect_length(.er_entregables(dir), 0L)
  # El archivo se sigue sirviendo por la descarga.
  expect_false(is.null(session_get(sid)$files[[meta$file_id]]))
})

test_that("§4: una copia fallida no hace fallar la generación y queda en aviso_guardado", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  k <- .er_kind_guardable()
  dir <- withr::local_tempdir()
  sid <- .er_sesion(dir)
  # «Entregables» ya existe, pero como archivo: no se puede crear la carpeta del módulo.
  writeLines("no soy carpeta", file.path(dir, "Entregables"))

  meta <- NULL
  expect_no_error(meta <- entregable_registrar(sid, .er_archivo(sid), k$kind))
  expect_null(meta$guardado_en)
  expect_true(nzchar(meta$aviso_guardado %||% ""))
  expect_false(is.null(session_get(sid)$files[[meta$file_id]]))
})

test_that("§4: sin proyecto, en modo público o con guardar = FALSE no se copia nada", {
  k <- .er_kind_guardable()

  withr::with_envvar(c(PULSO_PUBLIC_MODE = ""), {
    sid_sin <- .er_sesion(NULL)
    meta <- entregable_registrar(sid_sin, .er_archivo(sid_sin), k$kind)
    expect_null(meta$guardado_en)
    expect_identical(meta$modulo, k$modulo)
  })

  dir_pub <- withr::local_tempdir()
  sid_pub <- .er_sesion(dir_pub)
  withr::with_envvar(c(PULSO_PUBLIC_MODE = "1"), {
    expect_true(is_public_mode())
    meta <- entregable_registrar(sid_pub, .er_archivo(sid_pub), k$kind)
    expect_null(meta$guardado_en)
  })
  expect_length(.er_entregables(dir_pub), 0L)

  # Las vistas previas y miniaturas se sirven pero no se copian (§2).
  cat <- .er_catalogo()
  for (kind in c("graficos_miniatura", "graficos_preview")) {
    expect_false(isTRUE(as.logical(cat$guardar[cat$kind == kind])), info = kind)
  }
  dir_prev <- withr::local_tempdir()
  sid_prev <- .er_sesion(dir_prev)
  withr::with_envvar(c(PULSO_PUBLIC_MODE = ""), {
    meta <- entregable_registrar(sid_prev, .er_archivo(sid_prev, ext = "png"), "graficos_miniatura")
    expect_null(meta$guardado_en)
  })
  expect_length(.er_entregables(dir_prev), 0L)
})

test_that("§2: un kind sin entrada en el catálogo cae a un rótulo derivado y no se guarda", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  dir <- withr::local_tempdir()
  sid <- .er_sesion(dir)
  meta <- NULL
  expect_no_error(meta <- entregable_registrar(sid, .er_archivo(sid), "kind_que_nadie_cataloga"))
  expect_type(meta$rotulo, "character")
  expect_true(nzchar(meta$rotulo))
  expect_null(meta$guardado_en)
  expect_length(.er_entregables(dir), 0L)
})

test_that("§1: un original_name explícito se conserva en el meta", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  k <- .er_kind_guardable()
  sid <- .er_sesion(NULL)
  meta <- entregable_registrar(sid, .er_archivo(sid, ext = "pdf"), k$kind, original_name = "nombre_elegido.pdf")
  expect_identical(meta$original_name, "nombre_elegido.pdf")
})

test_that("§1: .register_output_file() delega en entregable_registrar()", {
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  k <- .er_kind_guardable()
  dir <- withr::local_tempdir()
  sid <- .er_sesion(dir)
  meta <- .register_output_file(sid, k$kind, .er_archivo(sid, "por el envoltorio"))
  expect_identical(meta$modulo, k$modulo)
  expect_identical(meta$rotulo, k$rotulo)
  expect_false(is.null(meta$guardado_en))
  expect_true(startsWith(normalizePath(meta$guardado_en),
                         normalizePath(file.path(dir, "Entregables", k$modulo))))
  expect_identical(readLines(meta$guardado_en), "por el envoltorio")
})

test_that("§1: el meta de .register_output_file() ya trae los campos del registro único", {
  # Sin pasar por el catálogo: aunque el kind no se guarde, los cuatro campos viajan en el meta.
  withr::local_envvar(PULSO_PUBLIC_MODE = "")
  sid <- .er_sesion(NULL)
  meta <- .register_output_file(sid, "frecuencias", .er_archivo(sid))
  expect_true(all(c("modulo", "rotulo", "guardado_en", "aviso_guardado") %in% names(meta)),
              info = paste(names(meta), collapse = ", "))
  expect_true(nzchar(meta$modulo %||% ""))
  expect_true(nzchar(meta$rotulo %||% ""))
})
