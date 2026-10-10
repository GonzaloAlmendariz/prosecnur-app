# El aviso de la migración de población llega al usuario, una vez por canal, y la migración se persiste (R4).
#
# Antes el aviso sólo iba al stderr del servidor (seis por normalización, acumulándose) y ni el GET de la config ni el
# resultado del job lo traían; y como la migración no se guardaba en la sesión, abrir y guardar sin tocar Gráficos
# dejaba el .pulso con los tipos antiguos: al reabrir, vuelta a migrar y a avisar.
#
# Contrato (lead, 2026-10-10): el canal es el de los demás avisos —`result_data$avisos` de los jobs /ppt y /word,
# ordenados por `.pulso_avisos_ordenar`— y el GET de la config, que devuelve `avisos` una sola vez. Migrar el plan de la
# sesión es una mutación real: marca `project_dirty`; tras migrar una vez no se vuelve a migrar ni a avisar, y al
# reabrir lo guardado hay cero avisos. Nada sólo a stderr.

.mpa_graf <- function(var) list(graficador = "p_barras_categoricas", args = list(var = var))
.mpa_plan <- function() {
  list(slides = list(
    list(id = "s-port", tipo = "p_slide_portada", payload = list(titulo = "Portada")),
    list(id = "s-p2", tipo = "p_slide_2_graficos_poblacion",
         payload = list(titulo = "Dos", izquierda = .mpa_graf("a"), derecha = .mpa_graf("b"), icono = "ico-1")),
    list(id = "s-p4", tipo = "p_slide_4_graficos_poblacion",
         payload = list(titulo = "PERFIL DEL DOCENTE", superior_izquierda = .mpa_graf("c"), superior_derecha = .mpa_graf("d"),
                        inferior_izquierda = .mpa_graf("e"), inferior_derecha = .mpa_graf("f")))
  ))
}
.mpa_tipos <- function(plan) vapply(plan$slides, function(s) s$tipo, "")
.mpa_stderr <- function(expr) {
  sellos <- character()
  val <- withCallingHandlers(expr, message = function(m) {
    if (grepl("[PULSO-AVISO]", conditionMessage(m), fixed = TRUE)) sellos <<- c(sellos, conditionMessage(m))
    invokeRestart("muffleMessage")
  })
  list(valor = val, sellos = sellos)
}

test_that("la migración no escribe al stderr: devuelve sus avisos con el plan, en español y con la causa", {
  r <- .mpa_stderr(.graficos_migrar_poblacion_antigua(.mpa_plan()))
  expect_length(r$sellos, 0L)
  av <- .graficos_avisos_migracion(r$valor)
  expect_length(av, 2L)
  expect_match(av[2], "lámina 3", fixed = TRUE)
  expect_match(av[2], "«PERFIL DEL DOCENTE»", fixed = TRUE)
  expect_match(av[2], "ya no está en el recetario", fixed = TRUE)
  expect_match(av[2], "«Cuatro gráficos»", fixed = TRUE)
  expect_match(av[2], "4 gráficos", fixed = TRUE)
  # Sin ids internos en lo que lee el usuario.
  expect_false(any(grepl("s-p4", av, fixed = TRUE)))
  # La config normalizada no lleva avisos pegados ni escribe al stderr (se normaliza en cada preview y export).
  n <- .mpa_stderr(.graficos_normalize_config(list(plan = .mpa_plan())))
  expect_length(n$sellos, 0L)
  expect_null(attr(n$valor$plan, "avisos_migracion"))
  # Un plan ya vigente no arrastra avisos viejos.
  expect_length(.graficos_avisos_migracion(.graficos_migrar_poblacion_antigua(r$valor)), 0L)
})

test_that("muchas láminas migradas se dicen en una línea con sus títulos", {
  p <- .mpa_plan(); p$slides <- c(p$slides, lapply(1:3, function(k) {
    s <- p$slides[[3]]; s$id <- paste0("x", k); s$payload$titulo <- paste("Perfil", k); s
  }))
  av <- .graficos_avisos_migracion(.graficos_migrar_poblacion_antigua(p))
  expect_length(av, 1L)
  expect_match(av, "^5 láminas")
  expect_match(av, "«Perfil 3»", fixed = TRUE)
  # Con su número: en acrconta tres láminas se llaman «PERFIL DEL EGRESADO».
  expect_match(av, "Láminas: 2 «Dos», 3 «PERFIL DEL DOCENTE», 4 «Perfil 1», 5 «Perfil 2», 6 «Perfil 3».", fixed = TRUE)
})

# --- canal del job --------------------------------------------------------------------------------------------------
.mpa_endpoint <- function(path, body, captura, sid = "sid-mpa", verbo = "POST") {
  testthat::local_mocked_bindings(
    session_header = function(req) sid,
    .require_rp_data = function(sid) list(),
    .graficos_effective_config = function(...) list(presets = list(), paletas = list()),
    .graficos_delivery_options = function(...) list(profile_id = NULL, template_id = NULL, auto_otros_slides = FALSE),
    .graficos_resolve_template_pptx = function(...) NA_character_,
    .graficos_processing_sources = function(sid) list(data_sources = list(), inst_sources = list()),
    job_save_rds = function(...) tempfile(),
    .graficos_icon_registry = function(...) list(),
    .graficos_active_base_name = function(sid) "",
    .graficos_export_filename = function(...) "x",
    .graficos_opciones_documento = function(...) list(),
    job_submit = function(sid, kind, func, args, ..., on_complete = NULL) {
      captura$args <- args; captura$on_complete <- on_complete; "job-mpa"
    },
    .package = "prosecnurapp"
  )
  pr <- mount_graficos(plumber::pr())
  endpoints <- unlist(pr$endpoints, recursive = FALSE)
  ep <- endpoints[[which(vapply(endpoints, function(e) identical(e$path, path) && verbo %in% e$verbs, TRUE))]]
  req <- new.env(parent = emptyenv())
  if (!is.null(body)) req$bodyRaw <- charToRaw(enc2utf8(as.character(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null"))))
  res <- new.env(parent = emptyenv()); res$status <- 200L; res$setHeader <- function(...) invisible(NULL)
  ep$getFunc()(req, res)
}

test_that("/ppt y /word: el resultado del job trae el aviso de migración una vez, junto a los del worker", {
  skip_if_not_installed("plumber")
  for (path in c("/api/graficos/ppt", "/api/graficos/word")) {
    captura <- new.env()
    r <- .mpa_stderr(.mpa_endpoint(path, list(plan = .mpa_plan(), presets = list()), captura))
    expect_length(r$sellos, 0L)
    expect_null(attr(captura$args$plan, "avisos_migracion"))   # el worker recibe el plan limpio
    testthat::local_mocked_bindings(
      .pulso_avisos_de_job = function(sid, job_id, maximo = 8L) c("El eje se achicó a 9,5 pt para que quepa."),
      .register_output_file = function(...) list(file_id = "f", original_name = "x", size = 1),
      .graficos_status_set = function(...) invisible(TRUE),
      .package = "prosecnurapp"
    )
    out <- captura$on_complete(list(sid = "sid-mpa", id = "job-mpa", result_path = tempfile(), result_data = list(n_slides = 3L)))
    av <- as.character(unclass(out$avisos))
    expect_identical(sum(grepl("ya no está en el recetario", av, fixed = TRUE)), 2L, label = path)
    expect_true("El eje se achicó a 9,5 pt para que quepa." %in% av, label = path)
  }
})

# --- canal del GET de la config y persistencia ------------------------------------------------------------------------
.mpa_get_config <- function(sid) .mpa_endpoint("/api/graficos/config", NULL, new.env(), sid = sid, verbo = "GET")

test_that("GET config: avisa una vez, persiste la migración y marca el proyecto como modificado", {
  skip_if_not_installed("plumber")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "project_path", tempfile(fileext = ".pulso"))   # con un .pulso abierto, un cambio marca dirty
  session_set(sid, "graficos_config", list(plan = .mpa_plan()))
  session_set(sid, "project_dirty", FALSE)

  r1 <- .mpa_stderr(.mpa_get_config(sid))
  expect_length(r1$sellos, 0L)
  av <- as.character(unclass(r1$valor$avisos))
  expect_length(av, 2L)
  expect_true(all(grepl("ya no está en el recetario", av, fixed = TRUE)))
  expect_identical(.mpa_tipos(r1$valor$config$plan), c("p_slide_portada", "p_slide_2_graficos", "p_slide_4_graficos"))
  # Persistida en la sesión (lo que el .pulso guarda) y marcada como cambio.
  s <- session_get(sid)
  expect_identical(.mpa_tipos(s$graficos_config$plan), c("p_slide_portada", "p_slide_2_graficos", "p_slide_4_graficos"))
  expect_null(attr(s$graficos_config$plan, "avisos_migracion"))
  expect_true(isTRUE(s$project_dirty))
  # Sólo la migración entró: el resto de lo guardado sigue siendo decisión del usuario, no defaults (ADR 0074).
  expect_identical(names(s$graficos_config), "plan")

  r2 <- .mpa_stderr(.mpa_get_config(sid))
  expect_length(as.character(unclass(r2$valor$avisos)), 0L)
  expect_length(r2$sellos, 0L)
})

test_that("GET config multibase: migra la config de cada base y nombra la base en el aviso", {
  skip_if_not_installed("plumber")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "graficos_config_por_base", list(egresados = list(plan = .mpa_plan()), docentes = list(plan = .mpa_plan())))
  av <- as.character(unclass(.mpa_get_config(sid)$avisos))
  expect_length(av, 4L)
  expect_identical(sum(grepl("^Base «egresados»", av)), 2L)
  expect_identical(sum(grepl("^Base «docentes»", av)), 2L)
  cfgs <- session_get(sid)$graficos_config_por_base
  for (b in c("egresados", "docentes")) expect_identical(.mpa_tipos(cfgs[[b]]$plan), c("p_slide_portada", "p_slide_2_graficos", "p_slide_4_graficos"))
  expect_length(as.character(unclass(.mpa_get_config(sid)$avisos)), 0L)
})

test_that("abrir, ver Gráficos, guardar y reabrir: el .pulso queda con los tipos vigentes y no vuelve a avisar", {
  skip_if_not_installed("plumber")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "graficos_config", list(plan = .mpa_plan()))
  expect_length(as.character(unclass(.mpa_get_config(sid)$avisos)), 2L)
  dest <- tempfile(fileext = ".pulso"); on.exit(unlink(dest), add = TRUE)
  suppressMessages(build_pulso(sid, dest, project_name = "mpa", allow_empty_overwrite = TRUE))
  r <- suppressMessages(load_pulso(dest)); on.exit(session_delete(r$session_id), add = TRUE)
  expect_identical(.mpa_tipos(session_get(r$session_id)$graficos_config$plan),
                   c("p_slide_portada", "p_slide_2_graficos", "p_slide_4_graficos"))
  expect_length(as.character(unclass(.mpa_get_config(r$session_id)$avisos)), 0L)
})

test_that("import de una config con población antigua: la migra, la guarda y avisa en su respuesta (el GET ya no lo hará)", {
  skip_if_not_installed("plumber")
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  r <- .mpa_stderr(.mpa_endpoint("/api/graficos/config/import", list(config = list(plan = .mpa_plan())), new.env(), sid = sid))
  expect_true(isTRUE(r$valor$ok))
  expect_length(r$sellos, 0L)
  av <- as.character(unclass(r$valor$avisos))
  expect_length(av, 2L)
  # El mismo texto que el GET.
  expect_identical(av, .graficos_avisos_migracion(.graficos_migrar_poblacion_antigua(.mpa_plan())))
  expect_identical(.mpa_tipos(session_get(sid)$graficos_config$plan), c("p_slide_portada", "p_slide_2_graficos", "p_slide_4_graficos"))
  expect_length(as.character(unclass(.mpa_get_config(sid)$avisos)), 0L)
  # Una config ya vigente se importa sin avisos.
  r2 <- .mpa_endpoint("/api/graficos/config/import", list(plan = .graficos_migrar_poblacion_antigua(.mpa_plan(), avisar = FALSE)), new.env(), sid = sid)
  expect_length(as.character(unclass(r2$avisos)), 0L)
})

test_that("/ppt-all: la sesión migrada lleva los avisos de cada base al resultado del job, una vez", {
  sid <- session_create(); on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "graficos_config_por_base", list(egresados = list(plan = .mpa_plan()), docentes = list(plan = .mpa_plan())))
  s <- .graficos_sesion_con_migracion(sid)
  for (b in c("egresados", "docentes")) expect_identical(.mpa_tipos(s$graficos_config_por_base[[b]]$plan), c("p_slide_portada", "p_slide_2_graficos", "p_slide_4_graficos"))
  testthat::local_mocked_bindings(.pulso_avisos_de_job = function(sid, job_id, maximo = 8L) "Otro aviso", .package = "prosecnurapp")
  av <- .graficos_avisos_job(sid, "j", s)
  expect_identical(sum(grepl("^Base «egresados»", av)), 2L)
  expect_true("Otro aviso" %in% av)
  # Ya migrada: la segunda exportación (y el GET) no repiten el aviso.
  expect_identical(.graficos_avisos_job(sid, "j", .graficos_sesion_con_migracion(sid)), "Otro aviso")
})
