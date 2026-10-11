source("setup-load-all.R")

# Ítem 15 del checklist de codificación SM 2026-10-11 (ADR 0094): cómo se
# emparejó cada pregunta de una fuente. El endpoint solo EXPONE lo que decidió la
# alineación y quedó en `sm_alineacion_fuentes`; aquí corre la importación real
# (`sm_api_xlsform` + motor canónico + alineación) con la red simulada.
#
# Fixtures sintéticos, sin red ni token real.

.cfe_mock <- function(name, value) {
  env <- asNamespace("prosecnurapp")
  had <- exists(name, envir = env, inherits = FALSE)
  previous <- if (had) get(name, envir = env) else NULL
  locked <- had && bindingIsLocked(name, env)
  if (locked) unlockBinding(name, env)
  assign(name, value, envir = env)
  if (locked) lockBinding(name, env)
  function() {
    if (bindingIsLocked(name, env)) unlockBinding(name, env)
    if (had) assign(name, previous, envir = env) else rm(list = name, envir = env)
    if (locked) lockBinding(name, env)
  }
}

# --- Encuestas sintéticas -----------------------------------------------------

.cfe_single <- function(id, heading, labels) {
  list(id = id, family = "single_choice", subtype = "vertical",
       headings = list(list(heading = heading)),
       answers = list(choices = lapply(seq_along(labels), function(i) {
         list(id = paste0(id, "c", i), text = labels[[i]], position = i)
       })))
}
.cfe_open <- function(id, heading) {
  list(id = id, family = "open_ended", subtype = "single", headings = list(list(heading = heading)))
}
.cfe_relleno <- function(prefijo, k) lapply(seq_len(k), function(i) .cfe_open(paste0(prefijo, i), paste("Comentario", i)))

# Un nombre vacío en `paginas` es una página sin título (SM la deja en "").
.cfe_details <- function(survey_id, title, paginas) {
  list(id = survey_id, title = title, pages = lapply(seq_along(paginas), function(i) {
    list(id = paste0("pg", i), position = i, title = names(paginas)[i], questions = paginas[[i]])
  }))
}

# REF (principal): «Biblioteca» dos veces con la misma escala y un año de
# egreso al final que la fuente no pregunta. La primera página trae su título
# con HTML y espacios de sobra, como lo devuelve SM; la segunda no tiene título.
.cfe_ref <- function() {
  .cfe_details("REF", "Egresados Personalizado", list(
    "  <strong>Datos</strong>&nbsp;  generales " = list(
      .cfe_single("a1", "¿Desea continuar?", c("Sí", "No")),
      .cfe_open("a2", "¿Cuántos años tiene?"),
      .cfe_single("a3", "¿Cuál es su género?", c("Masculino", "Femenino"))
    ),
    " " = c(
      list(.cfe_single("a4", "Biblioteca", c("Sí", "No")), .cfe_single("a5", "Biblioteca", c("Sí", "No"))),
      .cfe_relleno("ar", 10L),
      list(.cfe_single("a16", "¿Cuál es su año de egreso?", c("2021", "2022")))
    )
  ))
}

# FUE: «Indique su código PUCP» tras el consentimiento (corre edad y género a
# otro nombre), una sola «Biblioteca» (ambigua) y sin año de egreso.
.cfe_fuente <- function() {
  .cfe_details("FUE", "Egresados Telefónico", stats::setNames(list(
    list(
      .cfe_single("f1", "¿Desea continuar?", c("Sí", "No")),
      .cfe_open("f2", "Indique su código PUCP"),
      .cfe_open("f3", "¿Cuántos años tiene?"),
      .cfe_single("f4", "¿Cuál es su género?", c("Masculino", "Femenino"))
    ),
    c(list(.cfe_single("f5", "Biblioteca", c("Sí", "No"))), .cfe_relleno("fr", 10L))
  ), c("Datos del egresado", "")))
}

# OTRA: otro instrumento; comparte solo el consentimiento.
.cfe_otra <- function() {
  .cfe_details("OTRA", "Otra encuesta", list("Única" = list(
    .cfe_single("o1", "¿Desea continuar?", c("Sí", "No")),
    .cfe_open("o2", "Edad en años cumplidos"),
    .cfe_single("o3", "Sexo", c("Masculino", "Femenino"))
  )))
}

.cfe_response <- function(details, id, answers) {
  qs <- unlist(lapply(details$pages, function(p) p$questions), recursive = FALSE)
  by_id <- stats::setNames(qs, vapply(qs, `[[`, "", "id"))
  questions <- lapply(names(answers), function(qid) {
    q <- by_id[[qid]]
    val <- answers[[qid]]
    ans <- if (is.list(val)) {
      list(list(text = val$text))
    } else {
      ch <- q$answers$choices
      list(list(choice_id = ch[[match(val, vapply(ch, `[[`, "", "text"))]]$id))
    }
    list(id = qid, answers = ans)
  })
  list(id = id, response_status = "completed", collector_id = "col1",
       date_created = "2026-10-01T10:00:00+00:00", date_modified = "2026-10-01T10:00:00+00:00",
       pages = list(list(id = "pg1", questions = questions)))
}

.cfe_responses <- function() {
  ref <- .cfe_ref(); fue <- .cfe_fuente(); otra <- .cfe_otra()
  list(
    REF = list(.cfe_response(ref, "rr1", list(a1 = "Sí", a2 = list(text = "28"), a3 = "Masculino"))),
    FUE = list(
      .cfe_response(fue, "rf1", list(f1 = "Sí", f2 = list(text = "20151234"), f3 = list(text = "30"), f4 = "Femenino")),
      .cfe_response(fue, "rf2", list(f1 = "Sí", f2 = list(text = "20189999"), f3 = list(text = "45"), f4 = "Masculino"))
    ),
    OTRA = list(.cfe_response(otra, "ro1", list(o1 = "Sí", o2 = list(text = "50"), o3 = "Femenino")))
  )
}

.cfe_network_mocks <- function() {
  details <- list(REF = .cfe_ref(), FUE = .cfe_fuente(), OTRA = .cfe_otra())
  responses <- .cfe_responses()
  list(
    .cfe_mock(".connections_token_require", function(provider, sid = NULL, profile_id = NULL, base_url = NULL) {
      "cfe-token-efimero"
    }),
    .cfe_mock("sm_api_fetch_survey_details", function(survey_id, token, ...) {
      details[[as.character(survey_id)]] %||% stop("survey_id inesperado: ", survey_id)
    }),
    .cfe_mock("sm_api_fetch_all_responses_bulk", function(survey_id, token, ...) {
      data <- responses[[as.character(survey_id)]] %||% list()
      list(total = length(data), data = data)
    }),
    .cfe_mock("sm_api_fetch_responses_bulk", function(survey_id, token, ...) {
      data <- responses[[as.character(survey_id)]] %||% list()
      list(total = length(data), data = utils::head(data, 1L))
    }),
    .cfe_mock("sm_api_fetch_collectors", function(survey_id, ...) list(total = 0L, data = list())),
    .cfe_mock("sm_multibase_list_surveys", function(token, ...) list(surveys = list()))
  )
}

.cfe_importar <- function(sid, sources) {
  titles <- c(REF = "Personalizado", FUE = "Telefónico", OTRA = "Otra")
  specs <- list(list(
    survey_id = sources[1], label = "Egresados", source_title = "Egresados",
    response_statuses = list("completed"),
    sources = lapply(sources, function(id) {
      list(survey_id = id, source_title = titles[[id]], response_statuses = list("completed"))
    })
  ))
  out <- sm_multibase_import_independent(sid, specs = specs, token = "cfe-token-efimero")
  as.character(out$bases[[1]]$nombre %||% out$bases[[1]]$name %||% out$active_base)
}

.cfe_fuente_de <- function(payload, survey_id) Find(function(f) identical(f$survey_id, survey_id), payload$fuentes)
.cfe_fila_de <- function(fuente, etiqueta) Filter(function(r) identical(r$etiqueta, etiqueta), fuente$filas)
.cfe_estados <- function(fuente) vapply(fuente$filas, `[[`, "", "estado")

.cfe_endpoint <- function() {
  pr <- mount_carga_fuentes(plumber::pr())
  eps <- pr$endpoints[[1]]
  paths <- vapply(eps, function(e) e$path, character(1))
  eps[[which(paths == "/api/carga/fuentes/emparejamiento")[1]]]
}

# =============================================================================
# 1. Persistencia: `pares` sale del mismo mapa y viaja en el .pulso
# =============================================================================

test_that("cada fuente guarda sus pares con etiqueta y sección de la base, sin _other, y viajan en el .pulso", {
  restores <- .cfe_network_mocks()
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  base_name <- .cfe_importar(sid, c("REF", "FUE", "OTRA"))
  base <- session_get(sid)$estudio$bases[[base_name]]
  fue <- Find(function(f) identical(f$survey_id, "FUE"), base$sm_alineacion_fuentes)

  pares <- fue$pares
  expect_true(length(pares) > 0L)
  expect_true(all(vapply(pares, function(p) setequal(names(p), c("base", "fuente", "etiqueta", "seccion")), TRUE)))
  # Mismo mapa que se aplicó: n_emparejadas preguntas, ninguna `_other`.
  expect_length(pares, fue$n_emparejadas)
  expect_false(any(grepl("_other$", vapply(pares, `[[`, "", "base"))))
  edad <- Find(function(p) identical(p$etiqueta, "¿Cuántos años tiene?"), pares)
  expect_false(identical(edad$base, edad$fuente))
  # La sección es el título de la página SM de la base, limpio de HTML y de
  # espacios; una página sin título es «Página N».
  expect_equal(edad$seccion, "Datos generales")
  relleno <- Find(function(p) identical(p$etiqueta, "Comentario 1"), pares)
  expect_equal(relleno$seccion, "Página 2")
  # Lo que no entró lleva la página de la FUENTE.
  pucp <- Find(function(x) identical(x$etiqueta, "Indique su código PUCP"), fue$sin_par_fuente)
  expect_equal(pucp$seccion, "Datos del egresado")
  egreso <- Find(function(x) identical(x$etiqueta, "¿Cuál es su año de egreso?"), fue$sin_par_base)
  expect_equal(egreso$seccion, "Página 2")
  expect_true(all(vapply(fue$ambiguas, function(x) identical(x$seccion, "Página 2"), TRUE)))
  # Sin par y ambiguas también traen sección.
  expect_true(all(vapply(c(fue$sin_par_base, fue$ambiguas, fue$sin_par_fuente),
                         function(x) "seccion" %in% names(x), TRUE)))
  expect_false(grepl("cfe-token-efimero", paste(capture.output(dput(base$sm_alineacion_fuentes)), collapse = "")))

  destino <- tempfile(fileext = ".pulso")
  on.exit(unlink(destino), add = TRUE)
  build_pulso(sid, destino, project_name = "cfe-emparejamiento")
  reabierto <- load_pulso(destino)
  on.exit(session_delete(reabierto$session_id), add = TRUE)
  base2 <- session_get(reabierto$session_id)$estudio$bases[[base_name]]
  expect_equal(base2$sm_alineacion_fuentes, base$sm_alineacion_fuentes)
  expect_equal(.carga_fuentes_emparejamiento(reabierto$session_id, base_name)$fuentes,
               .carga_fuentes_emparejamiento(sid, base_name)$fuentes)
})

# =============================================================================
# 2. Motor: filas en el orden de la base, estados y fuente excluida
# =============================================================================

test_that("el emparejamiento expone emparejada, otro nombre, sin respuesta, ambigua y no entró en el orden de la base", {
  restores <- .cfe_network_mocks()
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .cfe_importar(sid, c("REF", "FUE", "OTRA"))
  datos_antes <- session_get(sid)$estudio$bases[[base_name]]

  out <- .carga_fuentes_emparejamiento(sid, base_name)
  expect_equal(out$base_nombre, base_name)
  expect_setequal(names(out), c("base_nombre", "equivalencias", "fuentes"))
  expect_length(out$fuentes, 2L)

  fue <- .cfe_fuente_de(out, "FUE")
  expect_equal(fue$estado, "incorporada")
  expect_true(fue$detalle_disponible)
  expect_equal(fue$n_filas_incorporadas, 2L)
  expect_setequal(names(fue), c("survey_id", "titulo", "estado", "n_emparejadas", "n_preguntas_base",
                                "n_filas_incorporadas", "n_filas_excluidas", "detalle_disponible", "filas"))
  expect_true(all(vapply(fue$filas, function(r) {
    setequal(names(r), c("seccion", "etiqueta", "variable_base", "variable_fuente", "estado", "pagina_fuente"))
  }, TRUE)))

  estados <- .cfe_estados(fue)
  expect_setequal(unique(estados), c("emparejada", "otro_nombre", "sin_respuesta", "ambigua", "no_entro"))
  expect_equal(.cfe_fila_de(fue, "¿Desea continuar?")[[1]]$estado, "emparejada")
  expect_equal(.cfe_fila_de(fue, "¿Cuántos años tiene?")[[1]]$estado, "otro_nombre")
  expect_equal(.cfe_fila_de(fue, "¿Cuál es su género?")[[1]]$estado, "otro_nombre")
  expect_equal(.cfe_fila_de(fue, "¿Cuál es su año de egreso?")[[1]]$estado, "sin_respuesta")
  biblioteca <- .cfe_fila_de(fue, "Biblioteca")
  expect_length(biblioteca, 2L)
  expect_true(all(vapply(biblioteca, function(r) identical(r$estado, "ambigua") && !nzchar(r$variable_fuente), TRUE)))
  pucp <- .cfe_fila_de(fue, "Indique su código PUCP")[[1]]
  expect_equal(pucp$estado, "no_entro")
  expect_equal(pucp$seccion, "Solo en la fuente")
  expect_equal(pucp$pagina_fuente, "Datos del egresado")
  expect_equal(pucp$variable_base, "")
  expect_equal(.cfe_fila_de(fue, "¿Cuántos años tiene?")[[1]]$seccion, "Datos generales")
  expect_equal(.cfe_fila_de(fue, "¿Cuál es su año de egreso?")[[1]]$seccion, "Página 2")
  expect_equal(.cfe_fila_de(fue, "¿Cuántos años tiene?")[[1]]$pagina_fuente, "")

  # Orden: lo de la base sigue su instrumento (el año de egreso es la última
  # pregunta de la base) y lo que solo existe en la fuente va al final.
  n <- length(estados)
  expect_equal(estados[n], "no_entro")
  expect_equal(fue$filas[[n - 1L]]$etiqueta, "¿Cuál es su año de egreso?")
  expect_equal(fue$filas[[1]]$etiqueta, "¿Desea continuar?")
  # Una fila por variable de la base, cada una una sola vez.
  vars_base <- vapply(Filter(function(r) nzchar(r$variable_base), fue$filas), `[[`, "", "variable_base")
  expect_false(anyDuplicated(vars_base) > 0L)
  expect_equal(length(vars_base), fue$n_preguntas_base)

  # La fuente que es otro instrumento sale con sus filas, para ver por qué no calzó.
  otra <- .cfe_fuente_de(out, "OTRA")
  expect_equal(otra$estado, "excluida")
  expect_equal(otra$n_filas_excluidas, 1L)
  expect_true(otra$detalle_disponible)
  expect_true("emparejada" %in% .cfe_estados(otra))
  expect_true("no_entro" %in% .cfe_estados(otra))
  expect_true("sin_respuesta" %in% .cfe_estados(otra))

  # Exponer no cambia la base.
  expect_identical(session_get(sid)$estudio$bases[[base_name]], datos_antes)
})

# =============================================================================
# 3. Bases anteriores, una sola encuesta y base inexistente
# =============================================================================

.cfe_sesion_con_base <- function(base) {
  sid <- session_create()
  s <- session_get(sid)
  s$estudio <- list(bases = list(b1 = base), active_base = "b1")
  .session_env[[sid]] <- s
  sid
}

test_that("una base anterior a los pares no reconstruye el detalle", {
  sid <- .cfe_sesion_con_base(list(nombre = "b1", sm_alineacion_fuentes = list(list(
    survey_id = "FUE", titulo = "Telefónico", n_emparejadas = 3L, n_preguntas_base = 4L, cobertura = 0.75,
    reordenada = TRUE, instrumento_distinto = FALSE, excluida = FALSE, n_filas_excluidas = 0L,
    n_filas_incorporadas = 2L,
    sin_par_fuente = list(list(variable = "p2", etiqueta = "Código")),
    sin_par_base = list(list(variable = "p4", etiqueta = "Egreso")), ambiguas = list()
  ))))
  on.exit(session_delete(sid), add = TRUE)
  out <- .carga_fuentes_emparejamiento(sid, "b1")
  expect_length(out$fuentes, 1L)
  expect_false(out$fuentes[[1]]$detalle_disponible)
  expect_equal(out$fuentes[[1]]$filas, list())
  expect_equal(out$fuentes[[1]]$estado, "incorporada")
  expect_equal(out$fuentes[[1]]$n_filas_incorporadas, 2L)
})

test_that("una base de una sola encuesta responde sin fuentes, no con error", {
  restores <- .cfe_network_mocks()
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .cfe_importar(sid, "REF")
  out <- .carga_fuentes_emparejamiento(sid, base_name)
  expect_equal(out$fuentes, list())
  expect_equal(out$base_nombre, base_name)
  # Sin base_nombre se usa la activa.
  expect_equal(.carga_fuentes_emparejamiento(sid)$base_nombre, base_name)
})

test_that("una base que no existe es 404", {
  sid <- .cfe_sesion_con_base(list(nombre = "b1"))
  on.exit(session_delete(sid), add = TRUE)
  err <- tryCatch(.carga_fuentes_emparejamiento(sid, "no_existe"), api_error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_equal(err$status, 404)
  expect_equal(err$code, "E_BASE_NOT_FOUND")
})

# =============================================================================
# 4. Equivalencias: el mismo predicado de la pestaña (ADR 0061)
# =============================================================================

.cfe_estudio <- function(bases, topology = "separate", processing_mode = "multibase") {
  sid <- session_create()
  s <- session_get(sid)
  s$estudio <- list(
    bases = stats::setNames(lapply(bases, function(b) list(nombre = b)), bases),
    processing_mode = processing_mode, topology_declared = topology, active_base = bases[1]
  )
  .session_env[[sid]] <- s
  sid
}

test_that("equivalencias.disponible coincide con el rail: dos bases separadas sí, una no", {
  sid2 <- .cfe_estudio(c("docentes", "estudiantes"))
  on.exit(session_delete(sid2), add = TRUE)
  sid1 <- .cfe_estudio("docentes")
  on.exit(session_delete(sid1), add = TRUE)

  eq2 <- .carga_fuentes_emparejamiento(sid2, "docentes")$equivalencias
  expect_true(eq2$disponible)
  expect_identical(eq2$disponible, .equiv_disponible(sid2))
  expect_equal(eq2$motivo, "Ahí se relacionan las preguntas entre públicos (bases separadas).")

  eq1 <- .carga_fuentes_emparejamiento(sid1, "docentes")$equivalencias
  expect_false(eq1$disponible)
  expect_identical(eq1$disponible, .equiv_disponible(sid1))
  expect_equal(eq1$motivo, "Aparece cuando el estudio tiene dos o más bases separadas, una por público.")

  # Modo independiente con una sola base: el predicado de la pestaña se
  # enciende, pero el rail no la muestra (una base primaria); el endpoint no
  # puede enlazar a una pestaña invisible.
  sid_ind <- .cfe_estudio("docentes", topology = "independent", processing_mode = "independent_siblings")
  on.exit(session_delete(sid_ind), add = TRUE)
  expect_true(.equiv_disponible(sid_ind))
  expect_false(.carga_fuentes_emparejamiento(sid_ind, "docentes")$equivalencias$disponible)
})

# =============================================================================
# 5. Contrato HTTP
# =============================================================================

test_that("contrato HTTP: GET /api/carga/fuentes/emparejamiento existe, está montado y responde", {
  ep <- .cfe_endpoint()
  expect_equal(ep$verbs, "GET")
  fuente_app <- paste(deparse(body(build_plumber_app)), collapse = " ")
  expect_true(grepl("mount_carga_fuentes(pr)", fuente_app, fixed = TRUE))

  restores <- .cfe_network_mocks()
  on.exit(lapply(rev(restores), function(r) r()), add = TRUE)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  base_name <- .cfe_importar(sid, c("REF", "FUE", "OTRA"))

  out <- ep$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid), res = plumber:::PlumberResponse$new(),
                      base_nombre = base_name)
  expect_true(isTRUE(out$ok))
  expect_length(out$fuentes, 2L)
  cuerpo <- jsonlite::fromJSON(.api_serializer()(out, list(), plumber:::PlumberResponse$new(), stop)$body,
                               simplifyVector = FALSE)
  expect_equal(cuerpo$base_nombre, base_name)
  expect_true(is.logical(cuerpo$equivalencias$disponible))
  expect_false(grepl("cfe-token-efimero", jsonlite::toJSON(cuerpo, auto_unbox = TRUE), fixed = TRUE))

  res <- plumber:::PlumberResponse$new()
  err <- ep$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid), res = res, base_nombre = "no_existe")
  expect_equal(res$status, 404)
  expect_equal(err$error$code %||% err$code, "E_BASE_NOT_FOUND")
})
