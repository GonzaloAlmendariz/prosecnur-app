source("setup-load-all.R")

# ADR 0128 §4 ter: en una base hija repeat cada tabla de cruces toma el grano de su fila.
# Fixture sintético con la forma de CCSS 2026: 160 estudiantes en 16 aulas (la madre) y de 1 a 3 personas
# responsables de la crianza por estudiante (la hija). `ciclo` y `area` son del estudiante; `nivel_resp` es de la
# persona responsable.

.gr_fixture <- function() {
  set.seed(11)
  n <- 160
  aula <- sprintf("a%02d", rep(1:16, each = 10))
  area <- ifelse(as.integer(sub("a", "", aula)) <= 8, "1", "2")
  ciclo <- ifelse(stats::runif(n) < ifelse(area == "1", 0.75, 0.30), "6", "9")
  madre <- data.frame(`_index` = seq_len(n), ciclo = ciclo, area = area, aula = aula,
                      stringsAsFactors = FALSE, check.names = FALSE)
  k <- rep(c(1L, 2L, 3L, 2L), length.out = n)          # personas por estudiante: 1 a 3
  pos <- rep(seq_len(n), k)
  hija <- data.frame(`_parent_index` = pos, `_index` = seq_along(pos),
                     nivel_resp = ifelse(stats::runif(length(pos)) < ifelse(area[pos] == "1", 0.7, 0.3), "u", "s"),
                     ciclo = ciclo[pos], area = area[pos], aula = aula[pos],
                     stringsAsFactors = FALSE, check.names = FALSE)
  survey <- data.frame(name = c("ciclo", "area", "nivel_resp"),
                       type = c("select_one ci", "select_one ar", "select_one nv"), list_name = c("ci", "ar", "nv"),
                       label = c("Ciclo", "Área", "Nivel educativo de la persona"), stringsAsFactors = FALSE)
  choices <- data.frame(list_name = c("ci", "ci", "ar", "ar", "nv", "nv"), name = c("6", "9", "1", "2", "u", "s"),
                        label = c("Sexto", "Noveno", "Uno", "Dos", "Universitario", "Secundaria"),
                        stringsAsFactors = FALSE)
  inst <- list(survey = survey, choices = choices,
               orders_list = list(ciclo = list(names = c("6", "9"), labels = c("Sexto", "Noveno")),
                                  area = list(names = c("1", "2"), labels = c("Uno", "Dos")),
                                  nivel_resp = list(names = c("u", "s"), labels = c("Universitario", "Secundaria"))))
  diseno <- list(kind = "cluster_persona", cluster_col = "_parent_index", n_instancias = nrow(hija),
                 n_personas = n, min_clusters = 8L, inference_ok = TRUE, reason = "",
                 heredadas = c("ciclo", "area", "aula"), parent_base = "madre",
                 unidad = "personas responsables de la crianza")
  attr(hija, "repeat_design") <- diseno
  attr(hija, "repeat_madre") <- madre
  list(madre = madre, hija = hija, inst = inst, diseno = diseno)
}

.gr_hoja <- function(path) {
  raw <- as.matrix(readxl::read_excel(path, col_names = FALSE))
  raw[is.na(raw)] <- ""
  raw
}

# Bloque de una tabla: desde su título hasta su nota de letras.
.gr_bloque <- function(raw, titulo) {
  i <- which(raw[, 1] == titulo)[1]
  j <- i
  while (j < nrow(raw) && !grepl("^(Las letras|Esta tabla es descriptiva)", raw[j, 1])) j <- j + 1L
  raw[i:j, , drop = FALSE]
}

.gr_exportar <- function(data, inst, secciones, repeat_design = NULL) {
  out <- tempfile(fileext = ".xlsx")
  suppressMessages(reporte_cruces(data = data, instrumento = inst, SECCIONES = secciones, cruces = "area",
                                  path_xlsx = out, show_sig = TRUE, repeat_design = repeat_design,
                                  notas = list(fuente = "Pulso PUCP 2026", base_defecto = "total de encuestados (n = 160)")))
  out
}

.gr_regla <- function() {
  .sig_regla_normalizar(list(prueba = "rao_scott", correccion = "bh_informe", conglomerado = "aula",
                             umbral_puntos = 10, base_minima = 30, conglomerados_minimos = 8))
}

test_that("una variable del estudiante en la hija sale de la madre: misma tabla, mismas letras, n del estudiante", {
  skip_if_not_installed("readxl")
  f <- .gr_fixture()
  gc <- list(significancia = .gr_regla())
  ac <- list(cruces_vars = list("area"), secciones = list(list(variables = list("ciclo", "nivel_resp"))))
  sig <- list(graficos_config = gc, analitica_config = ac)

  ctx_madre <- .sig_contexto_de_base(list(madre = f$madre), list(madre = f$inst), "madre", sig)
  vieja <- .sig_informe_activar(.sig_contexto_liviano(ctx_madre)); on.exit(options(vieja), add = TRUE)
  out_m <- .gr_exportar(f$madre, f$inst, list(G = "ciclo")); on.exit(unlink(out_m), add = TRUE)

  ctx_hija <- .sig_contexto_de_base(list(madre = f$madre, hija = f$hija), list(madre = f$inst, hija = f$inst),
                                    "hija", sig)
  .sig_informe_activar(.sig_contexto_liviano(ctx_hija))
  out_h <- .gr_exportar(f$hija, f$inst, list(G = c("ciclo", "nivel_resp")), f$diseno)
  on.exit(unlink(out_h), add = TRUE)

  bm <- .gr_bloque(.gr_hoja(out_m), "Ciclo")
  bh <- .gr_bloque(.gr_hoja(out_h), "Ciclo")
  nc <- min(ncol(bm), ncol(bh))
  expect_identical(bh[, seq_len(nc)], bm[, seq_len(nc)])
  expect_equal(unname(bh[bh[, 1] == "Total", 2][1]), "160")                      # no 320: cada estudiante una vez
  expect_true(any(grepl("total de encuestados (n = 160)", bh[, 1], fixed = TRUE)))
  expect_true(any(grepl("Rao-Scott por aula", bh[, 1], fixed = TRUE)))
  expect_true(any(bh == "B"))                                             # la diferencia de 45 puntos se marca
})

test_that("una variable propia de la hija se queda en el registro y su pie declara la unidad y los dos conteos", {
  skip_if_not_installed("readxl")
  f <- .gr_fixture()
  sig <- list(graficos_config = list(significancia = .gr_regla()),
              analitica_config = list(cruces_vars = list("area"),
                                      secciones = list(list(variables = list("ciclo", "nivel_resp")))))
  ctx <- .sig_contexto_de_base(list(madre = f$madre, hija = f$hija), list(madre = f$inst, hija = f$inst), "hija", sig)
  vieja <- .sig_informe_activar(.sig_contexto_liviano(ctx)); on.exit(options(vieja), add = TRUE)
  out <- .gr_exportar(f$hija, f$inst, list(G = c("ciclo", "nivel_resp")), f$diseno); on.exit(unlink(out), add = TRUE)

  b <- .gr_bloque(.gr_hoja(out), "Nivel educativo de la persona")
  expect_equal(unname(b[b[, 1] == "Total", 2][1]), as.character(nrow(f$hija)))
  pie <- unname(b[grepl("^Fuente", b[, 1]), 1])
  expect_equal(pie, paste0("Fuente: Pulso PUCP 2026. Base: personas responsables de la crianza (",
                           nrow(f$hija), " registros de 160 encuestados). Porcentajes por columna."))
  expect_false(any(grepl("total de encuestados", b[, 1], fixed = TRUE)))
  # La regla del estudio, no el contraste por persona: hereda el aula del estudiante.
  expect_true(any(grepl("Rao-Scott por aula", b[, 1], fixed = TRUE)))
  expect_false(any(grepl("agrupados por encuestado", b[, 1], fixed = TRUE)))
})

test_that("la familia de la hija suma a la de la madre sólo las comparaciones propias", {
  f <- .gr_fixture()
  sig <- list(graficos_config = list(significancia = .gr_regla()),
              analitica_config = list(cruces_vars = list("area"),
                                      secciones = list(list(variables = list("ciclo", "nivel_resp")))))
  ctx_m <- .sig_contexto_de_base(list(madre = f$madre), list(madre = f$inst), "madre", sig)
  ctx_h <- .sig_contexto_de_base(list(madre = f$madre, hija = f$hija), list(madre = f$inst, hija = f$inst), "hija", sig)
  expect_gt(ctx_m$m, 0L)
  expect_gt(ctx_h$m, ctx_m$m)                       # entran las propias
  expect_identical(ctx_h$madre$familia, ctx_m$familia)   # la madre no cambia
  # Las heredadas no se cuentan dos veces: la hija sin variables propias tiene la familia de la madre.
  sig$analitica_config$secciones <- list(list(variables = list("ciclo")))
  ctx_m2 <- .sig_contexto_de_base(list(madre = f$madre), list(madre = f$inst), "madre", sig)
  ctx_h2 <- .sig_contexto_de_base(list(madre = f$madre, hija = f$hija), list(madre = f$inst, hija = f$inst), "hija", sig)
  expect_equal(ctx_h2$m, ctx_m2$m)
})

test_that("la hija hereda el conglomerado de la regla aunque no esté en el XLSForm", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases <- list(
    madre = list(nombre = "madre", source_kind = "manual"),
    hija = list(nombre = "hija", source_kind = "xlsx_repeat", parent_base = "madre", repeat_group = "crianza",
                link_key = "_parent_index", parent_index_key = "_index")
  )
  session_set(sid, "estudio", s$estudio)
  session_set(sid, "graficos_config", list(significancia = list(conglomerado = "aula")))
  f <- .gr_fixture()
  hija <- f$hija[, c("_parent_index", "_index", "nivel_resp")]
  inst_hija <- list(survey = f$inst$survey[3, ], choices = f$inst$choices[5:6, ])
  inst_madre <- list(survey = f$inst$survey[1:2, ], choices = f$inst$choices[1:4, ])
  res <- .analitica_enrich_child_pair(sid, "hija", hija, inst_hija,
                                      data_sources = list(madre = f$madre, hija = hija),
                                      inst_sources = list(madre = inst_madre, hija = inst_hija))
  expect_true("aula" %in% names(res$data))
  expect_equal(as.vector(res$data$aula), f$madre$aula[hija$`_parent_index`])
  expect_true(isTRUE(attr(res$data$aula, "repeat_inherited")))
  expect_false("aula" %in% as.character(res$inst$survey$name))   # no se vuelve variable de la tabla
})

test_that("los rótulos de una variable heredada son los de la madre aunque la hija guarde una copia vieja", {
  madre <- list(
    survey = data.frame(name = "B2", type = "select_one tiempo", list_name = "tiempo", label = "Tiempo",
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = "tiempo", name = c("1", "2"),
                         label = c("Menos de 1 hora", "Entre 1 hora y 30 minutos y 2 horas"), stringsAsFactors = FALSE),
    dicc_code_to_label = list(tiempo = c(`1` = "Menos de 1 hora", `2` = "Entre 1 hora y 30 minutos y 2 horas"))
  )
  hija <- list(
    survey = data.frame(name = "A9_1", type = "select_one reg", list_name = "reg", label = "Región",
                        stringsAsFactors = FALSE),
    choices = data.frame(list_name = c("reg", "tiempo", "tiempo"), name = c("1", "1", "2"),
                         label = c("Lima", "Menos de 1 hora", "Entre una 1 hora y 30 minutos y 2 horas"),
                         stringsAsFactors = FALSE),
    dicc_code_to_label = list(reg = c(`1` = "Lima"),
                              tiempo = c(`1` = "Menos de 1 hora", `2` = "Entre una 1 hora y 30 minutos y 2 horas"))
  )
  out <- .analitica_repeat_merge_inst(hija, madre, "B2")
  lbl <- out$choices$label[out$choices$list_name == "tiempo" & out$choices$name == "2"]
  expect_equal(lbl, "Entre 1 hora y 30 minutos y 2 horas")
  expect_equal(unname(out$dicc_code_to_label$tiempo[["2"]]), "Entre 1 hora y 30 minutos y 2 horas")
  expect_equal(sum(out$choices$list_name == "tiempo"), 2L)            # sin duplicar opciones
  expect_equal(out$choices$label[out$choices$list_name == "reg"], "Lima")   # lo propio de la hija se conserva
})

test_that("la unidad sale del rótulo del begin_repeat y, sin rótulo, del nombre del grupo", {
  inst <- list(survey = data.frame(type = c("begin_repeat", "select_one x", "end_repeat"),
                                   name = c("datos_crianza", "A9_1", "datos_crianza"),
                                   label = c("Personas responsables de la crianza", "Región", NA),
                                   stringsAsFactors = FALSE))
  expect_equal(.analitica_repeat_unidad(inst, "datos_crianza"), "personas responsables de la crianza")
  inst$survey$label[1] <- NA
  expect_equal(.analitica_repeat_unidad(inst, "datos_crianza"), "registros del grupo repetido «datos_crianza»")
})

test_that("la nota sin letras está en registro formal y no se contradice", {
  formal <- function(x) {
    expect_false(grepl(";", x, fixed = TRUE))
    expect_false(grepl("cluster", x, ignore.case = TRUE))
    expect_false(grepl("—|–|·", x))
    expect_false(grepl("..", x, fixed = TRUE))
    expect_false(grepl("\\bvalida\\b", x))
  }
  nota <- .repeat_nota_descriptiva("La prueba requiere al menos 8 encuestados con datos en el cruce y hay 5.")
  expect_equal(nota, paste("Esta tabla es descriptiva y no lleva letras de diferencias significativas.",
                           "La prueba requiere al menos 8 encuestados con datos en el cruce y hay 5."))
  formal(nota)
  formal(.repeat_nota_descriptiva(character(0)))

  # 400 encuestados, todos con la misma respuesta: hay encuestados de sobra, lo que falta es variación.
  d <- data.frame(pid = rep(1:400, each = 2), y = "a", g = rep(c("1", "2"), 400), stringsAsFactors = FALSE)
  cmp <- .repeat_compare_columns_cluster(d, "y", codes_row = c("a", "b"), estratos = c("1", "2"), var_estrato = "g",
                                         tp = "so", weight_col = "peso",
                                         repeat_design = list(cluster_col = "pid", inference_ok = TRUE,
                                                              n_personas = 400L, min_clusters = 8L))
  formal(cmp$reason)
  expect_false(grepl("400", cmp$reason))
  expect_match(cmp$reason, "variación suficiente")

  # Pocos encuestados en el cruce.
  chico <- d[d$pid <= 5, ]
  cmp2 <- .repeat_compare_columns_cluster(chico, "y", codes_row = c("a", "b"), estratos = c("1", "2"),
                                          var_estrato = "g", tp = "so", weight_col = "peso",
                                          repeat_design = list(cluster_col = "pid", inference_ok = TRUE,
                                                               n_personas = 5L, min_clusters = 8L))
  formal(cmp2$reason)
  expect_equal(cmp2$reason, "La prueba requiere al menos 8 encuestados con datos en el cruce y hay 5.")
  inst_g <- structure(list(), repeat_grain = list(kind = "instancia"))
  formal(.analitica_repeat_design(data.frame(`_parent_index` = 1:3, check.names = FALSE), inst_g)$reason)
  formal(.analitica_repeat_design(data.frame(x = 1:3), inst_g)$reason)
})

test_that("las secciones multibase suman las variables propias de la hija en el orden de la config", {
  inst <- function(vars) list(survey = data.frame(name = vars, type = paste("select_one", vars), list_name = vars,
                                                  label = vars, stringsAsFactors = FALSE),
                              choices = data.frame(list_name = vars, name = "1", label = "Uno", stringsAsFactors = FALSE))
  insts <- list(madre = inst(c("a1", "a2")), hija = inst(c("a1", "b9")))
  secs <- list(general = c("b9", "a1", "a2"))
  out <- .analitica_filter_sections_bases(secs, insts)
  expect_equal(out$general, c("b9", "a1", "a2"))
  # Sin secciones configuradas no decide: el router conserva las del instrumento de la base activa.
  expect_null(.analitica_filter_sections_bases(NULL, insts))
  expect_null(.analitica_filter_sections_bases(list(), insts))
})
