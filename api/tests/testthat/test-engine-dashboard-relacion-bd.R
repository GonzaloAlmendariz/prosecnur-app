# =============================================================================
# Tests de los módulos dashboard_relacion.R y dashboard_base_datos.R.
# Foco: helpers puros que computan cruce, expansión SM, modo códigos vs
# etiquetas y diccionario. Sin Plumber ni I/O.
# =============================================================================

# Fixture: un instrumento con begin_group + 1 SO + 1 SM + 1 numérica;
# data con dummies SM expandidas.
.fx_inst <- function() {
  list(
    survey = data.frame(
      type = c("begin_group", "select_one sn", "select_multiple gusto",
               "integer", "end_group"),
      name = c("sec1", "sexo", "preferencias", "edad", ""),
      label = c("Sección 1", "Sexo del informante", "Preferencias", "Edad", ""),
      list_name = c(NA, "sn", "gusto", NA, NA),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("sn", "sn", "gusto", "gusto", "gusto"),
      name = c("M", "F", "rojo", "azul", "verde"),
      label = c("Masculino", "Femenino", "Rojo", "Azul", "Verde"),
      stringsAsFactors = FALSE
    )
  )
}

.fx_data <- function() {
  data.frame(
    sexo = c("M", "F", "M", "F", "M", "F"),
    preferencias.rojo = c(1, 0, 1, 1, 0, 1),
    preferencias.azul = c(0, 1, 1, 0, 1, 0),
    preferencias.verde = c(1, 1, 0, 0, 0, 1),
    edad = c(20, 25, 30, 35, 40, 22),
    stringsAsFactors = FALSE
  )
}

.fx_session <- function(rp_inst, rp_data) {
  list(
    dashboard_rp_inst = rp_inst,
    dashboard_rp_data = rp_data,
    dashboard_curacion = list(
      confirmed = TRUE,
      exclude_sections = character(0),
      exclude_vars = character(0)
    )
  )
}

# ----- Relaciones -----------------------------------------------------------

test_that("dashboard_relacion_payload calcula cruce SO×SO", {
  inst <- .fx_inst()
  data <- .fx_data()
  s <- .fx_session(inst, data)

  out <- .dashboard_relacion_payload(s, "sexo", "sexo", filtros = list())
  expect_true(out$n_total > 0L)
  expect_false(isTRUE(out$iterado))
  expect_length(out$cruces, 1L)

  cr <- out$cruces[[1]]
  expect_length(cr$filas, 2L)        # M, F
  expect_length(cr$columnas, 2L)
  expect_equal(cr$n_total, nrow(data))
  # Diagonal: M×M y F×F llenan todo. Off-diagonal = 0.
  expect_equal(cr$celdas[[1]][[1]]$n + cr$celdas[[2]][[2]]$n, nrow(data))
  expect_equal(cr$celdas[[1]][[2]]$n, 0L)
})

test_that("dashboard_relacion_payload soporta cruce SO×SM", {
  inst <- .fx_inst()
  data <- .fx_data()
  s <- .fx_session(inst, data)

  out <- .dashboard_relacion_payload(s, "sexo", "preferencias", filtros = list())
  expect_length(out$cruces, 1L)

  cr <- out$cruces[[1]]
  # Filas = niveles SO (M/F), columnas = dummies SM (rojo/azul/verde).
  expect_length(cr$filas, 2L)
  expect_length(cr$columnas, 3L)
  # Suma fila M = total respuestas que escogieron al menos una opción.
  # No tiene que ser igual a n_total porque SM permite múltiples
  # selecciones; pero las celdas individuales son válidas.
  for (i in seq_along(cr$filas)) {
    for (j in seq_along(cr$columnas)) {
      expect_true(cr$celdas[[i]][[j]]$n >= 0L)
    }
  }
})

test_that("dashboard_relacion_payload itera por tercera variable", {
  inst <- .fx_inst()
  data <- .fx_data()
  s <- .fx_session(inst, data)

  out <- .dashboard_relacion_payload(
    s, "sexo", "sexo",
    filtros = list(),
    iterar = list(var = "sexo")
  )
  expect_true(isTRUE(out$iterado))
  expect_equal(out$iter_var, "sexo")
  # Dos niveles M/F → dos cruces.
  expect_length(out$cruces, 2L)
  expect_true(all(vapply(out$cruces,
                         function(c) is.character(c$nivel) && nzchar(c$nivel),
                         logical(1))))
})

test_that("dashboard_relacion_payload aplica filtros antes de cruzar", {
  inst <- .fx_inst()
  data <- .fx_data()
  s <- .fx_session(inst, data)

  out_full <- .dashboard_relacion_payload(s, "sexo", "sexo", filtros = list())
  out_filt <- .dashboard_relacion_payload(
    s, "sexo", "sexo",
    filtros = list(list(var = "sexo", valores = list("M")))
  )
  expect_lt(out_filt$n_total, out_full$n_total)
  expect_equal(out_filt$cruces[[1]]$n_total, sum(data$sexo == "M"))
})

# ----- Base de datos --------------------------------------------------------

test_that("dashboard_base_datos_estructura expande SM madres en dummies", {
  inst <- .fx_inst()
  data <- .fx_data()
  s <- .fx_session(inst, data)

  est <- .dashboard_base_datos_estructura(s)
  expect_length(est$secciones, 1L)
  vars <- est$secciones[[1]]$variables
  pref <- Filter(function(v) v$name == "preferencias", vars)[[1]]
  expect_equal(pref$tipo, "sm")
  expect_length(pref$dummies, 3L)
  expect_equal(pref$dummies[[1]]$opt_label, "Rojo")
})

test_that("dashboard_base_datos_data devuelve filas paginadas en modo códigos", {
  inst <- .fx_inst()
  data <- .fx_data()
  s <- .fx_session(inst, data)

  out <- .dashboard_base_datos_data(
    s, modo = "codigos",
    variables = list("sexo", "preferencias"),
    page = 1L, page_size = 3L
  )
  expect_equal(out$total, nrow(data))
  expect_length(out$rows, 3L)
  # SM expandido: 1 col sexo + 3 cols dummy preferencias.
  expect_length(out$columnas, 4L)
})

test_that("dashboard_base_datos_data en modo etiquetas resuelve SO", {
  inst <- .fx_inst()
  data <- .fx_data()
  s <- .fx_session(inst, data)

  out <- .dashboard_base_datos_data(
    s, modo = "etiquetas",
    variables = list("sexo"),
    page = 1L, page_size = 100L
  )
  expect_true(all(unlist(lapply(out$rows, function(r) r$sexo)) %in%
                  c("Masculino", "Femenino")))
})

test_that("dashboard_base_datos_data filtra por search", {
  inst <- .fx_inst()
  data <- .fx_data()
  s <- .fx_session(inst, data)

  out <- .dashboard_base_datos_data(
    s, modo = "etiquetas",
    variables = list("sexo"),
    page = 1L, page_size = 100L,
    search = "Masculino"
  )
  expect_equal(out$total, sum(data$sexo == "M"))
})

test_that("dashboard_base_datos_diccionario devuelve opciones SO", {
  inst <- .fx_inst()
  data <- .fx_data()
  s <- .fx_session(inst, data)

  d <- .dashboard_base_datos_diccionario(s, "sexo")
  expect_equal(d$variable, "sexo")
  expect_length(d$opciones, 2L)
  expect_equal(sort(vapply(d$opciones, function(o) o$etiqueta, character(1))),
               c("Femenino", "Masculino"))
})

# ----- FODA — backbone helpers que mi wrapper consume ----------------------

test_that(".foda_compute_stats calcula score_mean y score_sd correctamente", {
  df <- data.frame(
    dim_a = c(80, 85, 90, 75, 82),
    dim_b = c(50, 55, 45, 60, 50),
    dim_c = c(95, 30, 80, 40, 60),  # alta variabilidad
    stringsAsFactors = FALSE
  )
  stats <- .foda_compute_stats(
    df,
    vars = c("dim_a", "dim_b", "dim_c"),
    labels = c("Dim A", "Dim B", "Dim C"),
    usar_pesos = FALSE
  )
  expect_equal(nrow(stats), 3L)
  expect_equal(stats$score_mean[1], mean(df$dim_a))
  expect_gt(stats$score_sd[3], stats$score_sd[1])  # Dim C dispersa
  expect_true(all(stats$n_valid == 5L))
})

test_that(".foda_classify asigna 4 cuadrantes según cortes", {
  stats_df <- data.frame(
    var = c("a", "b", "c", "d"),
    label = c("A", "B", "C", "D"),
    score_mean = c(85, 85, 50, 50),
    score_sd   = c(2,  10, 2,  10),
    n_valid = c(5L, 5L, 5L, 5L),
    stringsAsFactors = FALSE
  )
  out <- .foda_classify(stats_df, corte_score = 80, corte_sd = 5)
  expect_equal(out$cuadrante[out$var == "a"], "fortaleza")    # alto + consistente
  expect_equal(out$cuadrante[out$var == "b"], "oportunidad")  # alto + disperso
  expect_equal(out$cuadrante[out$var == "c"], "debilidad")    # bajo + consistente
  expect_equal(out$cuadrante[out$var == "d"], "amenaza")      # bajo + disperso
})

test_that("dashboard_dim_icon_data_uri devuelve '' si la ruta no existe", {
  expect_equal(.dashboard_dim_icon_data_uri(""), "")
  expect_equal(.dashboard_dim_icon_data_uri("/no/existe.png"), "")
  expect_equal(.dashboard_dim_icon_data_uri(NULL), "")
})

test_that("dashboard_dim_foda devuelve estructura ready=FALSE sin rp_dim", {
  s <- list()  # sesión vacía, sin dashboard_rp_dim
  out <- .dashboard_dim_foda(s, modo = "general", objetivo = "x")
  expect_false(isTRUE(out$ready))
})

.fx_dim_icon_path <- function() {
  p <- tempfile(fileext = ".png")
  grDevices::png(p, width = 8, height = 8, bg = "transparent")
  graphics::par(mar = c(0, 0, 0, 0))
  graphics::plot.new()
  graphics::rect(0.1, 0.1, 0.9, 0.9, col = "black", border = NA)
  grDevices::dev.off()
  p
}

.fx_dashboard_dimensiones_session <- function() {
  icon_path <- .fx_dim_icon_path()
  dat <- data.frame(
    p1 = c("5", "4", "5", "4", "5", "4"),
    p2 = c("3", "3", "4", "3", "2", "3"),
    p3 = c("2", "1", "2", "1", "2", "1"),
    servicio = c("A", "A", "B", "B", "C", "C"),
    distrito = c("Ate", "Rimac", "Ate", "Rimac", "Villa El Salvador", "Villa El Salvador"),
    stringsAsFactors = FALSE
  )
  attr(dat$p1, "label") <- "P1"
  attr(dat$p2, "label") <- "P2"
  attr(dat$p3, "label") <- "P3"
  attr(dat$servicio, "label") <- "Servicio"
  attr(dat$distrito, "label") <- "Distrito"

  inst <- list(
    survey = data.frame(
      name = c("p1", "p2", "p3", "servicio", "distrito"),
      type = c("select_one sat", "select_one sat", "select_one sat", "select_one srv", "select_one dist"),
      list_name = c("sat", "sat", "sat", "srv", "dist"),
      stringsAsFactors = FALSE
    ),
    choices = rbind(
      data.frame(
        list_name = "sat",
        name = c("1", "2", "3", "4", "5"),
        label = c("1", "2", "3", "4", "5"),
        stringsAsFactors = FALSE
      ),
      data.frame(
        list_name = "srv",
        name = c("A", "B", "C"),
        label = c("A", "B", "C"),
        stringsAsFactors = FALSE
      ),
      data.frame(
        list_name = "dist",
        name = c("Ate", "Rimac", "Villa El Salvador"),
        label = c("Ate", "Rimac", "Villa El Salvador"),
        stringsAsFactors = FALSE
      )
    ),
    orders_list = NULL
  )

  d1 <- reporte_dimensiones(
    data = dat,
    instrumento = inst,
    vars = c("p1", "p2", "p3"),
    prefijo = "r100_",
    reemplazar = FALSE,
    orden_por_lista = list(sat = c("1", "2", "3", "4", "5"))
  )
  d2 <- reporte_dimensiones_indices(
    data = d1,
    subindices = list(
      subindice("s1", "S1", c("r100_p1"), icono = icon_path),
      subindice("s2", "S2", c("r100_p2"), icono = icon_path),
      subindice("s3", "S3", c("r100_p3"), icono = icon_path)
    ),
    indices = list(indice("idx", "Indice", c("s1", "s2", "s3")))
  )
  d2$idx_indice_general <- d2$idx_idx

  sid <- session_create()
  session_set(sid, "analitica_dim_ok", TRUE)
  session_set(sid, "rp_dim", d2)
  session_set(sid, "rp_inst", inst)
  session_set(sid, "dashboard_rp_data", d2)
  session_set(sid, "dashboard_rp_inst", inst)
  session_set(sid, "dashboard_config", utils::modifyList(
    .dashboard_default_config(),
    list(
      paletas_listas = list(srv = list(A = "#111111", B = "#222222", C = "#333333")),
      foda_icon_tint = "#FFFFFF",
      foda_aliases = list(distrito = list(Ate = "ATE", Rimac = "RIM", "Villa El Salvador" = "VES"))
    )
  ))
  list(sid = sid, session = session_get(sid))
}

test_that("dashboard_dim_foda con cruce devuelve dimension por grupo, colores e iconos", {
  fx <- .fx_dashboard_dimensiones_session()
  on.exit(session_delete(fx$sid), add = TRUE)

  out <- .dashboard_dim_foda(
    fx$session,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "servicio",
    incluir_total = FALSE
  )

  expect_true(isTRUE(out$ready))
  expect_equal(length(unique(vapply(out$items, `[[`, character(1), "grupo"))), 3L)
  expect_setequal(names(out$group_colors), c("A", "B", "C"))
  expect_identical(out$group_colors$A, "#111111")
  expect_equal(length(out$items), 9L)
  expect_true(all(grepl("^data:image/png;base64,", vapply(out$items, `[[`, character(1), "icono_url"))))
  expect_equal(length(out$icon_legend), 3L)
})

test_that("dashboard_dim_foda por servicios usa Índice General como métrica", {
  fx <- .fx_dashboard_dimensiones_session()
  on.exit(session_delete(fx$sid), add = TRUE)

  out <- .dashboard_dim_foda(
    fx$session,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "servicio",
    incluir_total = FALSE,
    foda_config = list(foda_vista = "servicios")
  )

  expect_true(isTRUE(out$ready))
  expect_equal(out$item_kind, "servicios")
  expect_equal(out$item_var, "servicio")
  expect_equal(out$metric_var, "idx_indice_general")
  expect_equal(length(out$items), 3L)
  expect_setequal(vapply(out$items, `[[`, character(1), "axis_label"), c("A", "B", "C"))
  expect_true(all(vapply(out$items, `[[`, character(1), "grupo") == "Servicios"))
  expect_true(all(vapply(out$items, `[[`, numeric(1), "score_mean") >= 0))
  expect_true(all(vapply(out$items, `[[`, integer(1), "n_valid") == 2L))
  expect_named(out$counts, c("fortaleza", "oportunidad", "debilidad", "amenaza"))
})

test_that("dashboard_dim_foda por municipios devuelve aliases de distrito", {
  fx <- .fx_dashboard_dimensiones_session()
  on.exit(session_delete(fx$sid), add = TRUE)

  out <- .dashboard_dim_foda(
    fx$session,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "",
    incluir_total = FALSE,
    foda_config = list(foda_vista = "municipios")
  )

  expect_true(isTRUE(out$ready))
  expect_equal(out$item_kind, "municipios")
  expect_equal(out$item_var, "distrito")
  expect_equal(length(out$items), 3L)
  aliases <- stats::setNames(
    vapply(out$items, `[[`, character(1), "card_label"),
    vapply(out$items, `[[`, character(1), "axis_label")
  )
  expect_equal(aliases[["Ate"]], "ATE")
  expect_equal(aliases[["Rimac"]], "RIM")
  expect_equal(aliases[["Villa El Salvador"]], "VES")
  expect_true(all(vapply(out$items, `[[`, character(1), "grupo") == "Municipios"))
})

test_that("dashboard_dim_foda por municipios aplica comparación por servicio", {
  fx <- .fx_dashboard_dimensiones_session()
  on.exit(session_delete(fx$sid), add = TRUE)

  out <- .dashboard_dim_foda(
    fx$session,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "servicio",
    incluir_total = FALSE,
    foda_config = list(foda_vista = "municipios")
  )

  expect_true(isTRUE(out$ready))
  expect_equal(out$item_kind, "municipios")
  expect_equal(out$item_var, "distrito")
  expect_gt(length(out$items), 3L)
  expect_setequal(unique(vapply(out$items, `[[`, character(1), "grupo")), c("A", "B", "C"))
  expect_setequal(names(out$group_colors), c("A", "B", "C"))
  expect_true(all(vapply(out$items, `[[`, character(1), "card_mode") == "alias"))
  expect_true(all(vapply(out$items, `[[`, integer(1), "n_valid") >= 1L))
})

test_that("dashboard_dim_foda ignora comparación redundante con la misma variable", {
  fx <- .fx_dashboard_dimensiones_session()
  on.exit(session_delete(fx$sid), add = TRUE)

  out <- .dashboard_dim_foda(
    fx$session,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "distrito",
    incluir_total = FALSE,
    foda_config = list(foda_vista = "municipios")
  )

  expect_true(isTRUE(out$ready))
  expect_equal(length(out$items), 3L)
  expect_true(all(vapply(out$items, `[[`, character(1), "grupo") == "Municipios"))
  expect_equal(out$group_colors, list())
})

test_that("dashboard_dim_foda acepta vistas configurables por variable", {
  fx <- .fx_dashboard_dimensiones_session()
  on.exit(session_delete(fx$sid), add = TRUE)

  out <- .dashboard_dim_foda(
    fx$session,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "",
    incluir_total = FALSE,
    foda_config = list(
      foda_vista = "sedes",
      foda_views = list(
        list(
          id = "sedes",
          label = "Sedes",
          variable = "distrito",
          metric_var = "idx_indice_general",
          card_mode = "alias",
          aliases = list(Ate = "ATE", Rimac = "RIM", "Villa El Salvador" = "VES"),
          icons = list()
        )
      )
    )
  )

  expect_true(isTRUE(out$ready))
  expect_equal(out$item_kind, "sedes")
  expect_equal(out$item_label, "Sedes")
  expect_equal(out$item_var, "distrito")
  expect_equal(out$card_mode, "alias")
  expect_equal(length(out$items), 3L)
  expect_true(all(vapply(out$items, `[[`, character(1), "grupo") == "Sedes"))
  expect_equal(out$items[[1]]$card_mode, "alias")
})

test_that("dashboard_dim_foda sin cruce mantiene fallback total y counts", {
  fx <- .fx_dashboard_dimensiones_session()
  on.exit(session_delete(fx$sid), add = TRUE)

  out <- .dashboard_dim_foda(
    fx$session,
    modo = "general",
    objetivo = "idx_idx",
    cruce = "",
    incluir_total = TRUE
  )

  expect_true(isTRUE(out$ready))
  expect_equal(unique(vapply(out$items, `[[`, character(1), "grupo")), "Total")
  expect_equal(length(out$items), 3L)
  expect_named(out$counts, c("fortaleza", "oportunidad", "debilidad", "amenaza"))
})
