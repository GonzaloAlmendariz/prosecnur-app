source("setup-load-all.R")

# TXT-6 + TXT-7 (plan-texto-abierto-ccss-2026-10-24, contrato congelado): el diccionario del proyecto por pregunta.
#
#   texto_abierto_diccionario[[base]][[variable]] = list(equivalencias = list(list(mostrar, formas)), excluir, frases)
#
# Lo decide el usuario (no hay sinónimos de fábrica), viaja en el .pulso y lo leen la nube, la sugerencia de módulo y
# las citas. Un override del plan gana. Una frase fija se une aunque no la usen 3 personas. Un término excluido sale de
# la nube, del ranking y del vocabulario de la sugerencia; no sale de las citas, que son textuales. Fixture sintético.

.dic_textos <- function() c(
  "Los alumnos necesitan más biblioteca",
  "Faltan espacios para los estudiantes",
  "Los estudiantes y los alumnos piden enchufes",
  "Más docentes en ciencias sociales",
  "Los profesores de ciencias sociales faltan",
  "La facultad de ciencias sociales cierra temprano",
  "Quiero que la biblioteca abra los sábados",
  "Que los profesores lleguen a tiempo",
  "nada", "-", ""
)

.dic_ccss <- function() list(
  equivalencias = list(list(mostrar = "estudiantes", formas = c("alumnos", "estudiantes")),
                       list(mostrar = "docentes", formas = c("profesores", "docentes"))),
  excluir = c("ciencias sociales"),
  frases = c("ciencias sociales", "lleguen a tiempo")
)

.dic_n <- function(w) stats::setNames(w$n, w$palabra)

.dic_contar <- function(textos = .dic_textos(), ...) {
  x <- textos[nzchar(trimws(textos)) & !.txt_no_respuesta(textos)]
  .txt_conteo_terminos(x, contar = "personas", lematizar = TRUE, min_personas = 2, ...)
}

# ---------------------------------------------------------------------------
# Motor: la nube con el diccionario
# ---------------------------------------------------------------------------

test_that("sin diccionario, alumnos y estudiantes son términos distintos (no hay sinónimos de fábrica)", {
  n <- .dic_n(.dic_contar())
  expect_identical(unname(n["alumnos"]), 2)
  expect_identical(unname(n["estudiantes"]), 2)
  expect_true("ciencias sociales" %in% names(n))      # la frase automática la usan 3 personas
})

test_that("una equivalencia une las formas, cuenta personas una vez y muestra la forma elegida", {
  d <- .dic_ccss()
  n <- .dic_n(.dic_contar(equivalencias = d$equivalencias))
  expect_identical(unname(n["estudiantes"]), 3)        # 1, 2 y 3; la 3 usa las dos y cuenta una vez
  expect_false("alumnos" %in% names(n))
  expect_identical(unname(n["docentes"]), 3)           # «profesores» (2) + «docentes» (1), mostrado como docentes
  expect_false("profesores" %in% names(n))
})

test_that("un término excluido sale de la nube; una frase excluida se lleva sus palabras sueltas", {
  d <- .dic_ccss()
  n <- .dic_n(.dic_contar(excluir = d$excluir, frases_fijas = d$frases))
  expect_false(any(c("ciencias sociales", "sociales", "ciencias") %in% names(n)))
  n2 <- .dic_n(.dic_contar(excluir = "biblioteca"))
  expect_false("biblioteca" %in% names(n2))
  expect_true("ciencias sociales" %in% names(n2))
})

test_that("una frase fija se une aunque no llegue al mínimo de personas", {
  n <- .dic_n(.dic_contar(frases_fijas = "lleguen a tiempo"))
  expect_identical(unname(n["lleguen a tiempo"]), 1)
  expect_false("lleguen a tiempo" %in% names(.dic_n(.dic_contar())))
})

test_that("las equivalencias de antes (vector raíz → raíz) siguen funcionando", {
  n <- .dic_n(.dic_contar(equivalencias = c(alumno = "estudiante")))
  expect_identical(unname(n[grepl("^estudiante|^alumno", names(n))]), 3)
})

test_that("la nube recibe el diccionario por argumentos nuevos y lo aplica", {
  df <- data.frame(t = .dic_textos(), stringsAsFactors = FALSE)
  d <- .dic_ccss()
  rk <- attr(graficar_nube_palabras(df, var_texto = "t", filtrar_no_respuestas = TRUE, lematizar = TRUE, contar = "personas",
                                    min_personas = 2, equivalencias = d$equivalencias, excluir_terminos = d$excluir,
                                    frases_fijas = d$frases), "pulso_espec")$ranking
  n <- stats::setNames(rk$n, rk$palabras)
  expect_identical(unname(n["estudiantes"]), 3)
  expect_false(any(c("alumnos", "sociales", "ciencias sociales") %in% rk$palabras))
  expect_true("lleguen a tiempo" %in% rk$palabras)
})

# ---------------------------------------------------------------------------
# Validación del diccionario
# ---------------------------------------------------------------------------

.dic_err <- function(expr) tryCatch({ force(expr); NULL }, error = function(e) e)

test_that("normaliza: recorta, quita repetidos dentro del grupo y deja listas vacías cuando no hay nada", {
  d <- .txt_dic_normalizar(list(equivalencias = list(list(mostrar = " Estudiantes ", formas = list("alumnos", "Estudiantes ", "alumnos"))),
                                excluir = list(" ciencias  sociales "), frases = list()))
  expect_identical(d$equivalencias[[1]]$mostrar, "Estudiantes")
  expect_identical(d$equivalencias[[1]]$formas, c("alumnos", "Estudiantes"))
  expect_identical(d$excluir, "ciencias sociales")
  expect_identical(d$frases, character(0))
  expect_true(.txt_dic_es_vacio(.txt_dic_normalizar(list())))
})

test_that("una forma repetida entre grupos, un mostrar fuera de sus formas o un término vacío son errores tipados", {
  e <- .dic_err(.txt_dic_normalizar(list(equivalencias = list(list(mostrar = "estudiantes", formas = c("alumnos", "estudiantes")),
                                                             list(mostrar = "pupilos", formas = c("pupilos", "Alumnos"))))))
  expect_identical(e$code, "E_TXT_FORMA_REPETIDA")
  expect_identical(e$status, 422)
  e <- .dic_err(.txt_dic_normalizar(list(equivalencias = list(list(mostrar = "docentes", formas = c("profesores", "maestros"))))))
  expect_identical(e$code, "E_TXT_MOSTRAR_FUERA_DE_FORMAS")
  e <- .dic_err(.txt_dic_normalizar(list(excluir = c("biblioteca", "  "))))
  expect_identical(e$code, "E_TXT_DICCIONARIO_INVALIDO")
  e <- .dic_err(.txt_dic_normalizar(list(equivalencias = list(list(mostrar = "docentes", formas = "docentes")))))
  expect_identical(e$code, "E_TXT_DICCIONARIO_INVALIDO")
  e <- .dic_err(.txt_dic_normalizar(list(equivalencias = "alumnos=estudiantes")))
  expect_identical(e$code, "E_TXT_DICCIONARIO_INVALIDO")
})

test_that("dos formas distintas con la misma raíz en grupos distintos también chocan (con el corpus)", {
  d <- .txt_dic_normalizar(list(equivalencias = list(list(mostrar = "estudiantes", formas = c("alumnos", "estudiantes")),
                                                     list(mostrar = "alumno", formas = c("alumno", "pupilo")))))
  e <- .dic_err(.txt_dic_validar_corpus(d, .dic_textos()))
  expect_identical(e$code, "E_TXT_FORMA_REPETIDA")
})

# ---------------------------------------------------------------------------
# Palabras reconocidas (lo que la UI ofrece para unir, excluir o fijar)
# ---------------------------------------------------------------------------

test_that("las palabras reconocidas traen raíz, forma, formas, personas y su estado en el diccionario", {
  out <- texto_abierto_palabras(.dic_textos(), .txt_dic_normalizar(.dic_ccss()))
  expect_identical(out$resumen$escribieron, 10L)
  expect_identical(out$resumen$con_contenido, 8L)
  p <- out$palabras
  fila <- function(r) Find(function(x) identical(x$raiz, r), p)
  al <- fila("alumno")
  expect_identical(al$forma, "alumnos")
  expect_identical(al$personas, 2L)
  expect_identical(al$grupo, "estudiantes")
  expect_false(al$excluida)
  so <- fila("social")
  expect_identical(so$frases, list("ciencias sociales"))
  expect_false(so$excluida)                             # la palabra no está excluida: sí la frase que la contiene
  expect_identical(so$excluida_en, list("ciencias sociales"))
  bi <- fila("biblioteca")
  expect_null(bi$grupo)
  expect_identical(bi$frases, list())
  expect_true(fila("enchufe")$personas == 1L)
  # De mayor a menor por personas.
  expect_false(is.unsorted(rev(vapply(p, `[[`, integer(1), "personas"))))
  g <- out$grupos[[1]]
  expect_identical(g$mostrar, "estudiantes")
  expect_identical(g$personas, 3L)
  expect_true(any(vapply(out$frases_detectadas, function(f) identical(f$forma, "ciencias sociales"), logical(1))))
})

# ---------------------------------------------------------------------------
# Sesión, multibase y .pulso
# ---------------------------------------------------------------------------

.dic_sesion <- function() {
  sid <- session_create()
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases <- list(
    primera = list(nombre = "primera"),
    ccss = list(nombre = "ccss")
  )
  s$estudio$active_base <- "ccss"
  s$codif_por_base <- list(
    primera = list(data = data.frame(coment = c("el bus tarda", "alumnos"), stringsAsFactors = FALSE)),
    ccss = list(data = data.frame(coment = .dic_textos(), stringsAsFactors = FALSE))
  )
  .session_env[[sid]] <- s
  sid
}

test_that("guardar escribe en la base activa (no en la primera), conserva las hermanas y marca el proyecto", {
  sid <- .dic_sesion()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid); s$project_path <- tempfile(fileext = ".pulso"); s$project_dirty <- FALSE; .session_env[[sid]] <- s
  otra <- list(equivalencias = list(), excluir = "bus", frases = character(0))
  texto_abierto_diccionario_guardar(sid, base = "primera", variable = "coment", otra)
  out <- texto_abierto_diccionario_guardar(sid, base = NULL, variable = "coment", .dic_ccss())
  expect_identical(out$base, "ccss")
  st <- session_get(sid)$texto_abierto_diccionario
  expect_identical(st$ccss$coment$excluir, "ciencias sociales")
  expect_identical(st$ccss$coment$equivalencias[[1]]$formas, c("alumnos", "estudiantes"))
  expect_identical(st$primera$coment$excluir, "bus")    # la hermana no se toca
  expect_true(isTRUE(session_get(sid)$project_dirty))

  got <- texto_abierto_diccionario_consultar(sid, base = NULL, variable = "coment")
  expect_identical(got$base, "ccss")
  expect_identical(got$diccionario$excluir, list("ciencias sociales"))
  expect_true(length(got$palabras) > 0L)
  # Un diccionario vacío borra la entrada de esa pregunta.
  texto_abierto_diccionario_guardar(sid, base = "primera", variable = "coment", list())
  expect_null(session_get(sid)$texto_abierto_diccionario$primera)
})

test_that("variable, base y validación inexistentes responden con códigos E_TXT_*", {
  sid <- .dic_sesion()
  on.exit(session_delete(sid), add = TRUE)
  expect_identical(.dic_err(texto_abierto_diccionario_consultar(sid, NULL, ""))$code, "E_TXT_SIN_VARIABLE")
  expect_identical(.dic_err(texto_abierto_diccionario_consultar(sid, NULL, "no_existe"))$code, "E_TXT_VARIABLE_NO_EXISTE")
  expect_identical(.dic_err(texto_abierto_diccionario_consultar(sid, "fantasma", "coment"))$code, "E_TXT_BASE_NO_EXISTE")
  e <- .dic_err(texto_abierto_diccionario_guardar(sid, NULL, "coment",
                                                 list(equivalencias = list(list(mostrar = "x", formas = c("alumnos", "estudiantes"))))))
  expect_identical(e$code, "E_TXT_MOSTRAR_FUERA_DE_FORMAS")
  expect_null(session_get(sid)$texto_abierto_diccionario)
})

test_that("renombrar o quitar una base arrastra su diccionario", {
  sid <- .dic_sesion()
  on.exit(session_delete(sid), add = TRUE)
  texto_abierto_diccionario_guardar(sid, base = "ccss", variable = "coment", .dic_ccss())
  estudio_rename_base(sid, "ccss", "ccss2026")
  st <- session_get(sid)$texto_abierto_diccionario
  expect_null(st[["ccss"]])                             # `[[` y no `$`: `$ccss` casaría «ccss2026» por partial matching
  expect_identical(st[["ccss2026"]]$coment$excluir, "ciencias sociales")
  estudio_remove_base(sid, "ccss2026")
  expect_null(session_get(sid)$texto_abierto_diccionario$ccss2026)
})

test_that("el diccionario viaja en el .pulso (state.rds) y sobrevive guardar y abrir", {
  sid <- session_create()
  tmp <- tempfile(fileext = ".pulso")
  on.exit({ unlink(tmp, force = TRUE); session_delete(sid) }, add = TRUE)
  meta <- save_upload(sid, "xlsform", "i.xlsx", as.raw(c(0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00)))
  dm <- save_upload(sid, "data", "d.xlsx", as.raw(c(0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00)))
  estudio_ensure(sid)
  s <- session_get(sid)
  s$estudio$bases[["ccss"]] <- list(nombre = "ccss", xlsform_file_id = meta$file_id, data_file_id = dm$file_id, data_ext = "xlsx")
  .session_env[[sid]] <- s
  session_set(sid, "texto_abierto_diccionario", list(ccss = list(coment = .txt_dic_normalizar(.dic_ccss()))))
  expect_true(build_pulso(sid, tmp, project_name = "Diccionario")$ok)
  st <- readRDS(unz_state <- {
    d <- tempfile(); utils::unzip(tmp, files = "state.rds", exdir = d); file.path(d, "state.rds")
  })
  expect_identical(st$texto_abierto_diccionario$ccss$coment$frases, c("ciencias sociales", "lleguen a tiempo"))
  r <- load_pulso(tmp)
  on.exit(session_delete(r$session_id), add = TRUE)
  d2 <- session_get(r$session_id)$texto_abierto_diccionario$ccss$coment
  expect_identical(d2$equivalencias[[2]]$mostrar, "docentes")
  expect_identical(d2$excluir, "ciencias sociales")
})

test_that("el campo está censado en el esquema de sesión como persistible", {
  sch <- session_schema()
  fila <- sch[sch$clave == "texto_abierto_diccionario", , drop = FALSE]
  expect_identical(nrow(fila), 1L)
  expect_identical(fila$categoria, "persistible")
})

# ---------------------------------------------------------------------------
# Camino del render: el diccionario viaja con el instrumento de cada base
# ---------------------------------------------------------------------------

test_that("las fuentes del render llevan el diccionario de su base, sin tocar las demás", {
  sid <- .dic_sesion()
  on.exit(session_delete(sid), add = TRUE)
  texto_abierto_diccionario_guardar(sid, base = "ccss", variable = "coment", .dic_ccss())
  src <- list(data_sources = list(primera = data.frame(), ccss = data.frame()),
              inst_sources = list(primera = list(survey = data.frame(name = "x")), ccss = list(survey = data.frame(name = "coment"))))
  out <- .txt_dic_adjuntar_fuentes(sid, src)
  expect_null(out$inst_sources$primera$texto_abierto_diccionario)
  expect_identical(out$inst_sources$ccss$texto_abierto_diccionario$coment$excluir, "ciencias sociales")
  expect_identical(out$data_sources, src$data_sources)
})

test_that("los argumentos del diccionario ceden ante el override del plan; uno vacío no apaga el diccionario", {
  dic <- .txt_dic_normalizar(.dic_ccss())
  a <- .txt_dic_args_nube(dic, list())
  expect_identical(a$excluir_terminos, "ciencias sociales")
  expect_identical(a$frases_fijas, c("ciencias sociales", "lleguen a tiempo"))
  a2 <- .txt_dic_args_nube(dic, list(equivalencias = list(), colores_palabras = list()), list(excluir_terminos = "biblioteca"))
  expect_identical(a2$equivalencias, dic$equivalencias)  # la lista vacía que manda el editor por defecto no decide
  expect_null(a2$excluir_terminos)
  expect_identical(a2$frases_fijas, c("ciencias sociales", "lleguen a tiempo"))
  expect_identical(.txt_dic_args_nube(NULL, list()), list())
})

.dic_inst <- function(dic = NULL) {
  inst <- list(survey = data.frame(name = "coment", type = "text", list_name = NA, label = "Comentario final", stringsAsFactors = FALSE),
               choices = data.frame(list_name = character(), name = character(), label = character()), orders_list = NULL)
  if (!is.null(dic)) inst$texto_abierto_diccionario <- list(coment = dic)
  inst
}

test_that("el motor del PPT aplica el diccionario de la pregunta en la nube, y el override del plan gana", {
  skip_if_not_installed("officer")
  df <- data.frame(coment = .dic_textos(), stringsAsFactors = FALSE)
  ov <- list(filtrar_no_respuestas = TRUE, lematizar = TRUE, contar = "personas", min_personas = 2)
  render <- function(inst, overrides = ov) {
    out <- tempfile(fileext = ".pptx")
    suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
      plan = p_plan(slides = list(p_slide_1_grafico(p_nube_palabras("coment", overrides = overrides), titulo = "Nube")))))
    )
    xml2::xml_text(xml2::xml_find_all(xml2::read_xml(unz(out, "ppt/slides/slide1.xml")),
                                      "//p:sp[p:nvSpPr/p:cNvPr[@name='ranking:palabra']]"))
  }
  con <- render(.dic_inst(.txt_dic_normalizar(.dic_ccss())))
  expect_true("estudiantes" %in% con)
  expect_false(any(c("alumnos", "sociales", "ciencias sociales") %in% con))
  sin <- render(.dic_inst())
  expect_true(all(c("alumnos", "ciencias sociales") %in% sin))
  plan_gana <- render(.dic_inst(.txt_dic_normalizar(.dic_ccss())), c(ov, list(excluir_terminos = list("biblioteca"))))
  expect_true("ciencias sociales" %in% plan_gana)       # la lámina excluye lo suyo y reemplaza la lista del proyecto
  expect_false("biblioteca" %in% plan_gana)
  expect_true("estudiantes" %in% plan_gana)
})

# ---------------------------------------------------------------------------
# Sugerencia de módulo y citas
# ---------------------------------------------------------------------------

test_that("la sugerencia de módulo une las equivalencias y saca los excluidos de su vocabulario", {
  survey <- data.frame(
    type = c("begin_group", "text", "end_group", "begin_group", "text", "end_group", "begin_group", "text", "end_group"),
    name = c("modulo_a", "a1", NA, "modulo_b", "b1", NA, "modulo_c", "coment", NA),
    label = c("Módulo A: Docencia", "¿Qué opina de los docentes?", NA, "Módulo B: Biblioteca", "¿Usa la biblioteca?", NA,
              "Comentarios", "Comentario final", NA),
    stringsAsFactors = FALSE)
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey"); openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(list_name = "x", name = "1", label = "Uno"))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  inst <- leer_instrumento_xlsform(path)
  data <- data.frame(`_uuid` = c("u1", "u2"), coment = c("Los profesores llegan tarde", "La biblioteca cierra temprano"),
                     stringsAsFactors = FALSE, check.names = FALSE)
  cod <- function(out, id) {
    r <- Find(function(x) identical(x$id_caso, id), out$respuestas)
    vapply(r$propuestas, `[[`, "", "codigo")
  }
  sin <- codif_sugerir_seccion(inst, data, "coment")
  expect_length(cod(sin, "u1"), 0L)                     # «profesores» no está en el formulario
  expect_identical(cod(sin, "u2"), "20")
  dic <- .txt_dic_normalizar(list(equivalencias = list(list(mostrar = "docentes", formas = c("profesores", "docentes"))),
                                  excluir = "biblioteca"))
  con <- codif_sugerir_seccion(inst, data, "coment", diccionario = dic)
  expect_identical(cod(con, "u1"), "10")
  expect_length(cod(con, "u2"), 0L)
})

test_that("las citas unen las equivalencias al puntuar, pero no borran el término excluido del texto", {
  r <- .citas_raices(c("Los alumnos piden enchufes", "Los estudiantes piden aulas"),
                     equivalencias = list(list(mostrar = "estudiantes", formas = c("alumnos", "estudiantes"))))
  expect_true("estudiante" %in% r[[1]] && "estudiante" %in% r[[2]])
  expect_false("alumno" %in% r[[1]])
  txt <- "La biblioteca de ciencias sociales debería abrir los sábados, porque entre semana no alcanza el tiempo."
  sel <- .citas_seleccionar(c(txt, "nada"), equivalencias = list())
  expect_identical(sel$candidatas$texto, txt)
})

# ---------------------------------------------------------------------------
# Anonimato (de O2): un rango de años o de números cortos no es un teléfono
# ---------------------------------------------------------------------------

test_that("la expresión de teléfono borra teléfonos reales y respeta rangos de años y números cortos", {
  quedan <- c("En el ciclo 2025-2026 faltaron cursos", "Entre 10-15 alumnos por aula", "De 1990 - 2000 no cambió",
              "unos 20 o 30 minutos", "el aula 304-B")
  expect_identical(.txt_borrar_telefonos(quedan, "#"), quedan)
  borra <- c("llamar al 987654321", "llamar al 987 654 321", "llamar al 987-654-321", "llamar al +51 987 654 321",
             "llamar al (01) 234-5678", "llamar al +51987654321")
  expect_identical(.txt_borrar_telefonos(borra, "#"), rep("llamar al #", length(borra)))
  expect_identical(.citas_anonimizar("Ciclo 2025-2026: escribir al 987 654 321"), "Ciclo 2025-2026: escribir al […]")
  expect_identical(.txt_normalizar("rango 10-15, fono 987-654-321"), "rango fono")
})

# ---------------------------------------------------------------------------
# Contrato HTTP in-process: GET y PUT /api/texto-abierto/diccionario
# ---------------------------------------------------------------------------

.dic_endpoint <- function(verbo) {
  pr <- mount_texto_abierto(plumber::pr())
  eps <- pr$endpoints[[1]]
  hit <- Filter(function(e) identical(e$path, "/api/texto-abierto/diccionario") && verbo %in% e$verbs, eps)
  hit[[1]]
}

test_that("GET y PUT del diccionario por HTTP: base por query, cuerpo JSON y errores tipados", {
  sid <- .dic_sesion()
  on.exit(session_delete(sid), add = TRUE)
  put <- .dic_endpoint("PUT"); get <- .dic_endpoint("GET")
  body <- jsonlite::toJSON(list(equivalencias = list(list(mostrar = "estudiantes", formas = c("alumnos", "estudiantes"))),
                                excluir = list("ciencias sociales"), frases = list("ciencias sociales")), auto_unbox = TRUE)
  res <- plumber:::PlumberResponse$new()
  out <- put$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid, postBody = as.character(body)), res = res, variable = "coment")
  expect_true(isTRUE(out$ok))
  expect_identical(out$base, "ccss")
  expect_identical(session_get(sid)$texto_abierto_diccionario$ccss$coment$frases, "ciencias sociales")

  out <- get$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid), res = plumber:::PlumberResponse$new(), variable = "coment",
                       base = "ccss")
  expect_identical(out$diccionario$equivalencias[[1]]$formas, list("alumnos", "estudiantes"))
  expect_true(any(vapply(out$palabras, function(p) identical(p$grupo, "estudiantes"), logical(1))))
  # Serializa como JSON sin perder las listas de un elemento.
  js <- jsonlite::fromJSON(rawToChar(charToRaw(as.character(jsonlite::toJSON(out, auto_unbox = TRUE, null = "null")))),
                           simplifyVector = FALSE)
  expect_identical(js$diccionario$excluir, list("ciencias sociales"))

  res <- plumber:::PlumberResponse$new()
  bad <- jsonlite::toJSON(list(equivalencias = list(list(mostrar = "a", formas = c("alumnos", "estudiantes")),
                                                    list(mostrar = "alumnos", formas = c("alumnos", "pupilos")))), auto_unbox = TRUE)
  err <- put$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid, postBody = as.character(bad)), res = res, variable = "coment")
  expect_equal(res$status, 422)
  res <- plumber:::PlumberResponse$new()
  err <- get$getFunc()(req = list(HTTP_X_PULSO_SESSION = sid), res = res, base = "ccss")
  expect_equal(res$status, 400)
})

test_that("el router está montado en la app", {
  src <- paste(readLines(test_path("..", "..", "R", "plumber_app.R"), warn = FALSE), collapse = "\n")
  expect_match(src, "mount_texto_abierto\\(pr\\)")
})
