# R12-2: /api/graficos/diferencias prueba la lámina sobre la base de su ranura («base$var»), no sobre la base activa.
# Con la base activa en docentes, «estudiantes$p3 × gedad» devolvía los grupos de docentes.

.dbr_inst <- function(grupos) {
  list(survey = data.frame(name = c("p3", "gedad"), type = c("select_one sn", "select_one ge"), label = c("P3", "Edad"),
                           stringsAsFactors = FALSE),
       choices = data.frame(list_name = c("sn", "sn", rep("ge", length(grupos))), name = c("1", "2", grupos),
                            label = c("Sí", "No", paste("Grupo", grupos)), stringsAsFactors = FALSE),
       orders_list = NULL)
}
.dbr_base <- function(grupos, n, seed) {
  set.seed(seed)
  data.frame(p3 = sample(c("1", "2"), n, TRUE), gedad = sample(grupos, n, TRUE), stringsAsFactors = FALSE)
}
.dbr_sesion <- function() {
  sid <- session_create()
  session_set(sid, "estudio", list(bases = list(docentes = list(nombre = "docentes"), estudiantes = list(nombre = "estudiantes")),
                                   active_base = "docentes", processing_mode = "multibase"))
  session_set(sid, "rp_data_sources", list(docentes = .dbr_base(c("a", "b"), 120, 1), estudiantes = .dbr_base(c("x", "y", "z"), 300, 2)))
  session_set(sid, "rp_inst_sources", list(docentes = .dbr_inst(c("a", "b")), estudiantes = .dbr_inst(c("x", "y", "z"))))
  lam <- function(id, var, cruce) list(id = id, payload = list(list(graficador = "p_barras_agrupadas",
                                                                     args = list(var = var, cruces = cruce))))
  plan <- list(slides = list(lam("est", "estudiantes$p3", "estudiantes$gedad"), lam("doc", "p3", "gedad"),
                             lam("rota", "egresados$p3", "egresados$gedad")))
  .graficos_config_set(sid, list(plan = plan, significancia = list(prueba = "z", correccion = "bonferroni_fila")))
  sid
}
.dbr_get <- function(pr, sid, path, query = "") {
  req <- as.environment(list(REQUEST_METHOD = "GET", PATH_INFO = path, QUERY_STRING = query,
                             HTTP_X_PULSO_SESSION = sid, HEADERS = c(`x-pulso-session` = sid),
                             rook.input = list(read = function(...) raw(0), rewind = function() invisible(0), read_lines = function(...) character())))
  res <- pr$call(req)
  list(status = as.integer(res$status), body = jsonlite::fromJSON(as.character(res$body), simplifyVector = FALSE))
}

test_that("la base de la ranura sale del prefijo; una referencia pelada es la base activa", {
  b <- c("docentes", "estudiantes")
  lam <- function(var, cruce, ...) list(payload = list(list(graficador = "p_barras_agrupadas", args = list(var = var, cruces = cruce, ...))))
  expect_identical(.sig_base_de_lamina(lam("estudiantes$p3", "estudiantes$gedad"), b), "estudiantes")
  expect_identical(.sig_base_de_lamina(lam("p3", "estudiantes$gedad"), b), "estudiantes")
  expect_null(.sig_base_de_lamina(lam("p3", "gedad"), b))
  expect_identical(.sig_base_de_lamina(lam("p3", "gedad", source = "estudiantes"), b), "estudiantes")
  err <- tryCatch(.sig_base_de_lamina(lam("egresados$p3", "gedad"), b), error = function(e) e)
  expect_identical(err$code, "E_SIG_BASE_DESCONOCIDA")
})

test_that("HTTP: una lámina de la base no activa se prueba con los grupos de su base", {
  skip_if_not_installed("plumber")
  sid <- .dbr_sesion(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_graficos_diferencias(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  r <- .dbr_get(pr, sid, "/api/graficos/diferencias", "slide=est")
  expect_identical(r$status, 200L)
  cods <- vapply(r$body$lamina$grupos, function(g) as.character(g$codigo), "")
  expect_setequal(cods, c("x", "y", "z"))
  expect_identical(sum(vapply(r$body$lamina$grupos, function(g) as.numeric(g$n), 0)), 300)
  # La referencia pelada sigue en la base activa.
  r2 <- .dbr_get(pr, sid, "/api/graficos/diferencias", "slide=doc")
  expect_setequal(vapply(r2$body$lamina$grupos, function(g) as.character(g$codigo), ""), c("a", "b"))
  # Una base que no está en el proyecto es un 409 con su código, no la base activa en silencio.
  r3 <- .dbr_get(pr, sid, "/api/graficos/diferencias", "slide=rota")
  expect_identical(r3$status, 409L)
  expect_identical(r3$body$error$code %||% r3$body$code, "E_SIG_BASE_DESCONOCIDA")
})

test_that("HTTP: el informe prueba cada lámina sobre la base de su ranura", {
  skip_if_not_installed("plumber")
  sid <- .dbr_sesion(); on.exit(session_delete(sid), add = TRUE)
  cfg <- .graficos_config_get(sid); cfg$plan$slides <- cfg$plan$slides[1:2]; .graficos_config_set(sid, cfg)
  pr <- mount_graficos_diferencias(plumber::pr_set_serializer(plumber::pr(), .api_serializer()))
  r <- .dbr_get(pr, sid, "/api/graficos/diferencias/informe")
  expect_identical(r$status, 200L)
  por_id <- stats::setNames(r$body$laminas, vapply(r$body$laminas, `[[`, "", "slide_id"))
  expect_setequal(vapply(por_id$est$grupos, function(g) as.character(g$codigo), ""), c("x", "y", "z"))
  expect_setequal(vapply(por_id$doc$grupos, function(g) as.character(g$codigo), ""), c("a", "b"))
})
