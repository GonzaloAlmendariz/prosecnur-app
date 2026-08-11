source("setup-load-all.R")

# G2-L0.1 — verticales reales del pipeline de plan y del endpoint preview.

.g2v_inst <- function() {
  list(
    survey = data.frame(
      name = c("p1", "segmento", "peso"),
      type = c("select_one lik", "select_one segmento", "decimal"),
      list_name = c("lik", "segmento", ""),
      label = c("Pregunta", "Segmento", "Peso"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("lik", 3), rep("segmento", 2)),
      name = c("1", "2", "3", "incluido", "fuera"),
      label = c("Negativa", "Neutral", "Positiva", "Incluido", "Fuera"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
}

.g2v_data <- function(valores) {
  out <- data.frame(
    p1 = valores,
    segmento = c("incluido", "incluido", rep("fuera", 4)),
    peso = 1,
    stringsAsFactors = FALSE
  )
  attr(out, "var_peso") <- "peso"
  out
}

.g2v_fixture <- function() {
  list(
    data = list(
      ola1 = .g2v_data(c("3", "1", "3", "3", "3", "3")),
      ola2 = .g2v_data(c("3", "3", "1", "1", "1", "1"))
    ),
    instrumento = list(ola1 = .g2v_inst(), ola2 = .g2v_inst())
  )
}

# Sustituye bindings solo durante una expresion y restaura incluso si el
# endpoint falla. Se usa porque setup-load-all.R carga los R en el entorno del
# test, sin requerir un proceso HTTP externo.
#
# El entorno destino puede ser un NAMESPACE SELLADO: el CI corre
# `R CMD INSTALL` antes de los tests (los workers callr de jobs deserializan
# closures contra el paquete instalado), y ahi `assign()` muere con
# "cannot change value of locked binding". Por eso cada binding se desbloquea
# antes de escribirlo y se vuelve a sellar al restaurar. Solo admite nombres
# que YA existen en el entorno: en un namespace sellado no se pueden crear.
.g2v_with_bindings <- function(bindings, code, env = environment(mount_graficos)) {
  expr <- substitute(code)
  caller <- parent.frame()
  nms <- names(bindings)
  presentes <- vapply(nms, exists, logical(1), envir = env, inherits = FALSE)
  if (!all(presentes)) {
    stop(
      "bindings inexistentes en el entorno destino: ",
      paste(nms[!presentes], collapse = ", "),
      ". Usa testthat::local_mocked_bindings() para funciones de otro paquete."
    )
  }
  anteriores <- mget(nms, envir = env, inherits = FALSE)
  sellado <- environmentIsLocked(env)

  escribir <- function(nm, valor) {
    if (sellado && bindingIsLocked(nm, env)) {
      unlockBinding(nm, env)
      on.exit(lockBinding(nm, env), add = TRUE)
    }
    assign(nm, valor, envir = env)
  }

  on.exit({
    for (nm in names(anteriores)) escribir(nm, anteriores[[nm]])
  }, add = TRUE)

  for (nm in nms) escribir(nm, bindings[[nm]])
  eval(expr, envir = caller)
}

test_that("el pipeline publico renderiza las cuatro familias con filtros y matriz completa", {
  skip_if_not_installed("ggplot2")
  fixture <- .g2v_fixture()
  filtro <- list(segmento = "incluido")

  plan <- p_plan(slides = list(
    p_slide_1_grafico(
      p_barras_divergentes(vars = "ola1$p1", n_negativas = 1),
      titulo = "Divergentes"
    ),
    p_slide_1_grafico(
      p_dumbbell(
        vars = list(Tema = c("ola1$p1", "ola2$p1")),
        corte = "3",
        filtros = filtro
      ),
      titulo = "Dumbbell"
    ),
    p_slide_1_grafico(
      p_lollipop(var = "ola1$p1", top_n = 2),
      titulo = "Lollipop"
    ),
    p_slide_1_grafico(
      p_serie_temporal(
        vars = list(Tema = c("ola1$p1", "ola2$p1")),
        corte = "3",
        filtros = filtro
      ),
      titulo = "Serie"
    )
  ))

  salida <- reporte_ppt_plan(
    data = fixture$data,
    instrumento = fixture$instrumento,
    plan = plan,
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(salida$rendered, 4L)
  expect_true(all(vapply(salida$rendered, inherits, logical(1), what = "ggplot")))

  # El filtro deja 50 % en ola1 y 100 % en ola2. Si los renderers no pasan
  # `el$filtros` al estimador, se obtienen 83.3 % y 33.3 %, justo al reves.
  dumbbell <- salida$rendered[[2]]
  expect_equal(dumbbell$layers[[1]]$data$.brecha, 50)

  serie <- salida$rendered[[4]]
  expect_equal(serie$data$.y, c(50, 100))
  expect_identical(levels(serie$data$.periodo), c("ola1", "ola2"))

  lollipop <- salida$rendered[[3]]
  expect_identical(lollipop$labels$caption, "Se muestran 2 de 3 categorías.")
})

test_that("preview-slide califica refs peladas igual que el job antes del rebuild", {
  skip_if_not_installed("plumber")
  captura <- new.env(parent = emptyenv())
  test_env <- environment(mount_graficos)
  fixture <- .g2v_fixture()
  slide <- list(
    tipo = "p_slide_1_grafico",
    payload = list(
      grafico = list(
        graficador = "p_lollipop",
        args = list(var = "p1")
      )
    )
  )

  bindings <- list(
    session_header = function(req) "sid-preview-g2",
    session_get = function(sid) list(dir = tempdir(), graficos_preview_cache = list()),
    .graficos_processing_sources = function(sid) list(
      data_sources = list(docentes = fixture$data$ola1),
      inst_sources = list(docentes = fixture$instrumento$ola1)
    ),
    .graficos_sources_usable = function(...) TRUE,
    .graficos_active_base_name = function(sid) "docentes",
    .graficos_effective_config = function(...) list(
      presets = list(), debug_ph = list(), paletas = list(), iconos = list()
    ),
    .graficos_delivery_options = function(...) list(
      profile_id = NULL, template_id = NULL, auto_otros_slides = FALSE
    ),
    .graficos_resolve_template_pptx = function(...) NA_character_,
    .enriquecer_presets = function(...) list(),
    .graficos_icon_registry = function(...) list(),
    .graficos_palette_env = function(...) new.env(parent = emptyenv()),
    reporte_ppt_plan = function(...) {
      captura$plan <- list(...)$plan
      invisible(NULL)
    },
    .register_output_file = function(...) list(file_id = "preview-g2", size = 1),
    session_set = function(...) invisible(NULL)
  )

  # `getExportedValue` es de base y no vive en el namespace del paquete: no se
  # puede crear ahi cuando esta sellado. Se mockea por la via canonica.
  testthat::local_mocked_bindings(
    getExportedValue = function(where, name) get(name, envir = test_env, inherits = TRUE),
    .package = "base"
  )

  respuesta <- .g2v_with_bindings(bindings, {
    pr <- mount_graficos(plumber::pr())
    endpoints <- unlist(pr$endpoints, recursive = FALSE)
    paths <- vapply(endpoints, function(endpoint) endpoint$path, character(1))
    endpoint <- endpoints[[which(paths == "/api/graficos/preview-slide")]]

    req <- new.env(parent = emptyenv())
    req$postBody <- jsonlite::toJSON(
      list(slide = slide, include_images = FALSE),
      auto_unbox = TRUE,
      null = "null"
    )
    req$HTTP_X_PULSO_SESSION <- "sid-preview-g2"
    res <- new.env(parent = emptyenv())
    res$status <- 200L
    res$setHeader <- function(...) invisible(NULL)

    endpoint$getFunc()(req, res)
  })

  expect_true(respuesta$ok)
  expect_identical(
    captura$plan[[1]]$slots$plot$var,
    "docentes$p1"
  )
})
