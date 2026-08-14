source("setup-load-all.R")

# Un ícono que falta no puede costar el mazo.
#
# El PNG de un ícono vive en el tempdir de la sesión (`s$dir/icons`), así que
# basta con cerrar la app entre la subida y el guardado para perderlo: el
# `.pulso` conserva la entrada del catálogo y la referencia de las láminas, pero
# no el binario. A partir de ahí el proyecto arrastra una referencia rota y el
# export moría entero con «Icono no encontrado» — una lámina de 67 dejaba al
# usuario sin informe. Le pasó a ACRD CONTA el 2026-08-14.
#
# Ver `docs/qa/checklist-redondeo-decimales-2026-08-14.md` y la memoria
# `project_pulso_no_guarda_iconos`.

# Los avisos al analista se emiten con `message()` y el sello `[PULSO-AVISO]`
# (ver `.pulso_aviso()` en jobs.R), no con `warning()`: el job los recoge de su
# stderr. Los tests capturan ese canal, que es el que el usuario acaba viendo.
.avisos_de <- function(expr) {
  msgs <- character(0)
  withCallingHandlers(
    force(expr),
    message = function(m) {
      msgs <<- c(msgs, conditionMessage(m))
      invokeRestart("muffleMessage")
    }
  )
  msgs[grepl("[PULSO-AVISO]", msgs, fixed = TRUE)]
}

test_that("un icono que no esta en disco degrada en vez de matar el export", {
  skip_if_not_installed("ggplot2")
  res <- NULL
  avisos <- .avisos_de(res <- .graficos_rebuild_icon("id-que-no-existe", icon_registry = list()))
  expect_null(res)
  expect_true(any(grepl("no esta disponible", avisos)))
})

test_that("el aviso nombra el icono que falta, para poder reponerlo", {
  skip_if_not_installed("ggplot2")
  avisos <- .avisos_de(.graficos_rebuild_icon("318ecf24-perdido", icon_registry = list()))
  expect_true(any(grepl("318ecf24-perdido", avisos, fixed = TRUE)))
})

test_that("una lamina que EXIGE icono cae al integrado y no aborta", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("grid")
  # `p_slide_objetivo_icono` declara `icono` sin default: el constructor lo
  # exige. Antes eso era un `stop()` aunque el aviso de la UI dijera lo
  # contrario —«deja el campo en (ninguno) para exportar sin ícono»—, así que
  # los dos no podían tener razón.
  fn <- p_slide_objetivo_icono
  expect_true(.graficos_fn_requires_icon(fn))

  payload <- NULL
  avisos <- .avisos_de(
    payload <- .graficos_normalize_payload_icon(
      list(icono = NULL), fn, "p_slide_objetivo_icono", icon_registry = list()
    )
  )
  expect_true(any(grepl("se uso el integrado", avisos)))
  expect_false(is.null(payload$icono))
})

test_that("un icono que SI existe se usa tal cual", {
  skip_if_not_installed("ggplot2")
  skip_if_not_installed("png")
  # El control: si la degradación se tragara también los iconos buenos, el
  # arreglo sería peor que el problema.
  # PNG 1x1 válido escrito a mano: `grDevices::png()` sin dibujar nada deja un
  # archivo que `png::readPNG()` no acepta, y el test medía eso y no el arreglo.
  png_path <- tempfile(fileext = ".png")
  writeBin(jsonlite::base64_dec(paste0(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwACh",
    "wGA60e6kgAAAABJRU5ErkJggg=="
  )), png_path)
  on.exit(unlink(png_path), add = TRUE)

  res <- NULL
  avisos <- .avisos_de(res <- .graficos_rebuild_icon("ok", icon_registry = list(ok = png_path)))
  expect_length(avisos, 0L)
  expect_false(is.null(res))
})

# ---------------------------------------------------------------------------
# La poda del catálogo al abrir el proyecto
# ---------------------------------------------------------------------------

.iconos_state <- function(path_bueno, path_roto) {
  list(
    files = list(
      fid_ok = list(path = path_bueno),
      fid_roto = list(path = path_roto)
    ),
    graficos_config = list(iconos = list(
      list(id = "i-ok",   nombre = "Perfil", file_id = "fid_ok"),
      list(id = "i-roto", nombre = "Fantasma", file_id = "fid_roto")
    ))
  )
}

test_that("al abrir, el catalogo pierde los iconos sin PNG y conserva los buenos", {
  bueno <- tempfile(fileext = ".png")
  writeBin(as.raw(c(0x89, 0x50, 0x4E, 0x47)), bueno)
  on.exit(unlink(bueno), add = TRUE)
  roto <- file.path(tempdir(), "no-existe-jamas.png")

  s <- .iconos_state(bueno, roto)
  out <- NULL
  avisos <- .avisos_de(out <- .pulso_podar_iconos_huerfanos(s))
  expect_true(any(grepl("no traian su PNG", avisos)))

  ids <- vapply(out$graficos_config$iconos, function(x) x$id, character(1))
  expect_equal(ids, "i-ok")
})

test_that("sin iconos huerfanos no se avisa ni se toca el catalogo", {
  bueno <- tempfile(fileext = ".png")
  writeBin(as.raw(c(0x89, 0x50, 0x4E, 0x47)), bueno)
  on.exit(unlink(bueno), add = TRUE)

  s <- list(
    files = list(fid_ok = list(path = bueno)),
    graficos_config = list(iconos = list(
      list(id = "i-ok", nombre = "Perfil", file_id = "fid_ok")
    ))
  )
  out <- NULL
  avisos <- .avisos_de(out <- .pulso_podar_iconos_huerfanos(s))
  expect_length(avisos, 0L)
  expect_length(out$graficos_config$iconos, 1L)
})

test_that("la poda alcanza a las cuatro configs que guardan iconos", {
  roto <- file.path(tempdir(), "tampoco-existe.png")
  ico <- list(list(id = "x", nombre = "F", file_id = "fid_roto"))
  s <- list(
    files = list(fid_roto = list(path = roto)),
    graficos_config = list(iconos = ico),
    graficos_config_por_base = list(egresados = list(iconos = ico)),
    graficos_consolidado_draft = list(config = list(iconos = ico)),
    graficos_consolidado = list(config = list(iconos = ico))
  )
  out <- NULL
  invisible(.avisos_de(out <- .pulso_podar_iconos_huerfanos(s)))
  expect_length(out$graficos_config$iconos, 0L)
  expect_length(out$graficos_config_por_base$egresados$iconos, 0L)
  expect_length(out$graficos_consolidado_draft$config$iconos, 0L)
  expect_length(out$graficos_consolidado$config$iconos, 0L)
})

test_that("un estado sin iconos no revienta la poda", {
  for (s in list(list(), list(graficos_config = list()),
                 list(graficos_config = list(iconos = list())))) {
    expect_length(.avisos_de(.pulso_podar_iconos_huerfanos(s)), 0L)
  }
})
