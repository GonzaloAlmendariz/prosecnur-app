# El survey de un XLSForm trae filas sin `name` (begin_group/end_group,
# notas, filas vacías). `surv$type[surv$name == v][1]` devolvía el NA de la
# fila del grupo en vez del tipo de `v`, y `surv[surv$name == v, ]` traía filas
# NA delante de la buena: la variable perdía su tipo (dejaba de ser filtrable)
# y su list_name (la paleta se asignaba por posición, no por código).

.survey_con_grupo_sin_nombre <- function(list_name = "sn") {
  data.frame(
    type = c("begin_group", "select_one sn", "end_group"),
    name = c(NA, "p1", NA),
    label = c("Bloque", "¿Pregunta 1?", NA),
    list_name = c(NA, list_name, NA),
    stringsAsFactors = FALSE
  )
}

test_that(".inst_tipo_var salta las filas sin name que van antes de la variable", {
  surv <- .survey_con_grupo_sin_nombre()
  expect_identical(.inst_tipo_var(surv, "p1"), "select_one sn")
  expect_identical(.inst_tipo_var(surv, "no_existe"), "")
  surv$type[2] <- NA
  expect_identical(.inst_tipo_var(surv, "p1"), "")
  expect_identical(.inst_tipo_var(NULL, "p1"), "")
})

test_that(".resolver_paleta_var casa colores por código aunque haya un grupo sin name", {
  inst <- list(
    survey = .survey_con_grupo_sin_nombre(),
    choices = data.frame(
      list_name = c("sn", "sn"), name = c("1", "2"), label = c("Sí", "No"),
      stringsAsFactors = FALSE
    )
  )
  pal <- .resolver_paleta_var(
    "p1", inst,
    colores_apiladas_por_listname = list(sn = c("2" = "#aa0000", "1" = "#0000aa")),
    opcion_levels = c("Sí", "No")
  )
  expect_identical(unname(pal[["Sí"]]), "#0000aa")
  expect_identical(unname(pal[["No"]]), "#aa0000")
})

test_that("el dashboard de dimensiones reconoce un select_one tras un grupo sin name", {
  # Un solo valor observado: sólo es filtrable si se lee su tipo select_one.
  s <- list(
    analitica_dim_ok = TRUE,
    rp_dim = data.frame(p1 = rep("1", 5), stringsAsFactors = FALSE),
    rp_inst = list(survey = .survey_con_grupo_sin_nombre())
  )
  local_mocked_bindings(
    .dashboard_visible_secciones = function(s, secs = NULL) list(A = "p1"),
    .dashboard_var_label_override = function(s, v) NULL
  )
  out <- .dashboard_dim_secciones_vars(s)
  expect_length(out$secciones, 1L)
  expect_identical(out$secciones[[1]]$vars[[1]]$name, "p1")
})

test_that(".dim_build_context ofrece como filtro un select_one tras un grupo sin name", {
  dat <- data.frame(
    q1 = c("5", "4", "5", "4", "5", "4"),
    q2 = c("4", "4", "5", "3", "5", "4"),
    stringsAsFactors = FALSE
  )
  survey <- data.frame(
    name = c("q1", "q2"), type = rep("select_one sat", 2),
    list_name = rep("sat", 2), label = c("Q1", "Q2"),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = "sat", name = as.character(1:5), label = as.character(1:5),
    stringsAsFactors = FALSE
  )
  d1 <- reporte_dimensiones(
    data = dat, instrumento = list(survey = survey, choices = choices),
    vars = c("q1", "q2"), prefijo = "r100_", reemplazar = FALSE,
    orden_por_lista = list(sat = as.character(1:5))
  )
  d2 <- reporte_dimensiones_indices(
    data = d1,
    subindices = list(subindice("s1", "S1", "r100_q1")),
    indices = list(indice("global", "Global", "s1"))
  )
  # `p1` tiene un único valor y su lista no trae choices: sólo el tipo la
  # vuelve filtrable.
  d2$p1 <- "1"
  inst <- list(
    survey = rbind(
      .survey_con_grupo_sin_nombre(list_name = "sin_choices"),
      data.frame(
        type = survey$type, name = survey$name, label = survey$label,
        list_name = survey$list_name, stringsAsFactors = FALSE
      )
    ),
    choices = choices
  )
  ctx <- .dim_build_context(
    data = d2, instrumento = inst, secciones_limpias = list(A = "p1")
  )
  expect_true("p1" %in% unlist(ctx$filter_var_map))
})
