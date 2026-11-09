# ADR 0128 «Familia por base»: con `bh_informe`, cada ranura pertenece a la familia de SU base. El worker del export
# armaba una sola familia, la de la base activa: la lámina de otra base salía «fuera_de_familia», sin marcas y con aviso,
# mientras /api/graficos/diferencias (R12-2) sí la probaba sobre su base. Ahora el export arma una familia por base del
# plan con la misma regla, y el inspector y el export coinciden.

.fpb_inst <- function(grupos) {
  list(survey = data.frame(name = c("p3", "gedad"), type = c("select_one sn", "select_one ge"), label = c("P3", "Edad"),
                           stringsAsFactors = FALSE),
       choices = data.frame(list_name = c("sn", "sn", rep("ge", length(grupos))), name = c("1", "2", grupos),
                            label = c("Sí", "No", paste("Grupo", grupos)), stringsAsFactors = FALSE),
       orders_list = NULL)
}
# Estudiantes con una diferencia real por edad (x 75 % «Sí», z 40 %); docentes sin patrón.
.fpb_ds <- function() {
  est <- data.frame(gedad = rep(c("x", "y", "z"), each = 100), stringsAsFactors = FALSE)
  est$p3 <- c(rep(c("1", "2"), c(75, 25)), rep(c("1", "2"), c(60, 40)), rep(c("1", "2"), c(40, 60)))
  set.seed(7)
  doc <- data.frame(gedad = sample(c("a", "b"), 120, TRUE), p3 = sample(c("1", "2"), 120, TRUE), stringsAsFactors = FALSE)
  list(docentes = doc, estudiantes = est)
}
.fpb_lam <- function(id, var, cruce) list(id = id, payload = list(list(graficador = "p_barras_agrupadas",
                                                                       args = list(var = var, cruces = cruce))))
.fpb_regla <- list(prueba = "z", correccion = "bh_informe", umbral_puntos = 0, base_minima = 20)
.fpb_sig_arg <- function(plan) {
  list(equivalencias_publicos = NULL,
       graficos_config = list(significancia = .fpb_regla, plan = plan),
       analitica_config = list(cruces_vars = list(), secciones = list(), cruces = list(cruces_vars = list())))
}
# La fuente que arma el render (`.sig_fuente_render`) para una lámina agrupada de la base `base`.
.fpb_render <- function(ds, is, base) {
  d <- ds[[base]]
  fuente <- structure(list(diseno = "independiente", var = "p3", survey = is[[base]]$survey, orders_list = NULL,
                           data = d, g = d$gedad, niveles = sort(unique(d$gedad)), base = base), class = "sig_fuente")
  cods <- sort(unique(d$gedad))
  n <- t(sapply(c("1", "2"), function(v) vapply(cods, function(g) sum(d$p3 == v & d$gedad == g), numeric(1))))
  rownames(n) <- c("1", "2")   # el render rotula con lo que tabula `.sig_indicadores` (aquí, el código)
  .sig_evaluar_render(fuente, n, cods, paste("Grupo", cods))
}
.fpb_get <- function(pr, sid, path, query = "") {
  req <- as.environment(list(REQUEST_METHOD = "GET", PATH_INFO = path, QUERY_STRING = query,
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
                             rook.input = list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) character())))
  res <- pr$call(req)
  list(status = as.integer(res$status), body = jsonlite::fromJSON(as.character(res$body), simplifyVector = FALSE))
}

test_that("export: la ranura de la base no activa entra en la familia de su base y marca como /diferencias", {
  skip_if_not_installed("plumber")
  ds <- .fpb_ds(); is <- list(docentes = .fpb_inst(c("a", "b")), estudiantes = .fpb_inst(c("x", "y", "z")))
  plan <- list(slides = list(.fpb_lam("est", "estudiantes$p3", "estudiantes$gedad"), .fpb_lam("doc", "p3", "gedad")))

  previa <- .sig_informe_preparar(.fpb_sig_arg(plan), ds, is, "docentes")
  on.exit(options(previa), add = TRUE)
  ev <- .fpb_render(ds, is, "estudiantes")
  expect_identical(as.integer(ev$fuera_de_familia), 0L)
  expect_true(all(is.finite(ev$pares$p_ajustado[ev$pares$elegible])))
  expect_true(any(ev$pares$veredicto %in% c("marcada", "fragil")))

  # El inspector, con la misma sesión y el mismo plan, da los mismos p ajustados y veredictos.
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
                                   active_base = "docentes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", ds); session_set(sid, "rp_inst_sources", is)
  .graficos_config_set(sid, list(plan = plan, significancia = .fpb_regla))
  pr <- mount_graficos_diferencias(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  r <- .fpb_get(pr, sid, "/api/graficos/diferencias", "slide=est")
  expect_identical(r$status, 200L)
  pj <- r$body$lamina$pares
  clave <- function(f, a, b) paste(f, pmin(a, b), pmax(a, b))
  insp <- stats::setNames(vapply(pj, function(p) as.numeric(p$p_ajustado %||% NA), 0),
                          vapply(pj, function(p) clave(p$fila, p$a, p$b), ""))
  ver_insp <- stats::setNames(vapply(pj, function(p) p$veredicto, ""), names(insp))
  let <- ev$letras
  k <- clave(ev$pares$fila, unname(let[ev$pares$a]), unname(let[ev$pares$b]))
  expect_setequal(k, names(insp))
  expect_equal(signif(ev$pares$p_ajustado, 3), unname(insp[k]), tolerance = 1e-2)   # el JSON recorta decimales
  expect_identical(ev$pares$veredicto, unname(ver_insp[k]))

  # El informe usa las mismas familias que /diferencias.
  ri <- .fpb_get(pr, sid, "/api/graficos/diferencias/informe")
  est <- Filter(function(l) identical(l$slide_id, "est"), ri$body$laminas)[[1]]
  expect_identical(vapply(est$pares, function(p) as.numeric(p$p_ajustado %||% NA), 0), unname(insp))
})

test_that("export de una sola base: la opción y las marcas no cambian", {
  ds <- list(principal = .fpb_ds()$estudiantes); is <- list(principal = .fpb_inst(c("x", "y", "z")))
  plan <- list(slides = list(.fpb_lam("est", "p3", "gedad")))
  sig <- .fpb_sig_arg(plan)
  previa <- .sig_informe_preparar(sig, ds, is, "principal")
  on.exit(options(previa), add = TRUE)
  opt <- getOption("prosecnur.sig_informe")
  expect_null(opt$familias)
  ref <- .sig_contexto_estudio(ds$principal, is$principal, sig$graficos_config, sig$analitica_config)
  expect_identical(opt$familia, ref$familia)
  expect_identical(opt$m, ref$m)
  ev <- .fpb_render(ds, is, "principal")
  expect_identical(as.integer(ev$fuera_de_familia), 0L)
  # Con la fuente sin base (como antes de este cambio) la evaluación es idéntica.
  f0 <- ds$principal
  fuente0 <- structure(list(diseno = "independiente", var = "p3", survey = is$principal$survey, orders_list = NULL,
                            data = f0, g = f0$gedad, niveles = c("x", "y", "z")), class = "sig_fuente")
  n <- t(sapply(c("1", "2"), function(v) vapply(c("x", "y", "z"), function(g) sum(f0$p3 == v & f0$gedad == g), numeric(1))))
  rownames(n) <- c("1", "2")   # el render rotula con lo que tabula `.sig_indicadores` (aquí, el código)
  ev0 <- .sig_evaluar_render(fuente0, n, c("x", "y", "z"), paste("Grupo", c("x", "y", "z")))
  expect_identical(ev$pares, ev0$pares)
})

test_that("el plan de una base: las ranuras de otra base no entran en su familia; una sola base no se filtra", {
  b <- c("docentes", "estudiantes")
  plan <- list(slides = list(.fpb_lam("est", "estudiantes$p3", "estudiantes$gedad"), .fpb_lam("doc", "p3", "gedad"),
                             .fpb_lam("rota", "egresados$p3", "egresados$gedad")))
  ids <- function(p) vapply(p$slides, `[[`, "", "id")
  expect_identical(ids(.sig_plan_de_base(plan, "estudiantes", "docentes", b)), "est")
  expect_identical(ids(.sig_plan_de_base(plan, "docentes", "docentes", b)), "doc")
  expect_identical(.sig_plan_de_base(plan, "principal", "principal", "principal"), plan)
  expect_identical(.sig_bases_del_plan(plan, "docentes", b), "estudiantes")
})
