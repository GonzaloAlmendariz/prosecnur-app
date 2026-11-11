# Planner (ADR 0122, fase P1): la clave `planner/v1`, la proyección desde los
# lugares viejos y la escritura con revisión.
#
# Lo que fija este archivo:
# - leer el Planner es PURO: ni escribe ni marca el proyecto como modificado;
# - sólo lo declarado se guarda; lo demás se proyecta con la precedencia del §7;
# - el catálogo de códigos sólo agrega;
# - el equipo se guarda donde lo leen el anonimizador y el gate de datos
#   personales (`planner$equipo$personas`) y la proyección nunca trae el DNI.

source("setup-load-all.R")

.pl_sesion <- function(estado = list(), envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  s <- session_get(sid)
  for (k in names(estado)) s[k] <- list(estado[[k]])
  s$project_path <- "/tmp/planner-test.pulso"
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  sid
}

.pl_huella <- function(sid) {
  s <- .session_env[[sid]]
  s$last_access <- NULL
  digest::digest(s)
}

.pl_referencia <- function(slug, envir = parent.frame()) {
  pulso <- system.file("reference_projects", slug, paste0(slug, ".pulso"), package = "prosecnurapp")
  if (!nzchar(pulso)) pulso <- testthat::test_path("..", "..", "inst", "reference_projects", slug, paste0(slug, ".pulso"))
  testthat::skip_if_not(file.exists(pulso), paste("sin el proyecto de referencia", slug))
  copia <- withr::local_tempdir(.local_envir = envir)
  file.copy(pulso, file.path(copia, "ref.pulso"))
  ld <- suppressMessages(load_pulso(file.path(copia, "ref.pulso")))
  withr::defer(session_delete(ld$session_id), envir = envir)
  ld$session_id
}

test_that("una clave ausente o ajena se lee como un Planner vacío en la revisión 0", {
  expect_equal(.planner_normalizar(NULL)$revision, 0L)
  expect_equal(.planner_normalizar(list(schema = "otro/v9", revision = 7L))$secciones, list())
})

test_that("normalizar es idempotente", {
  crudo <- list(schema = PLANNER_SCHEMA, revision = 3L,
    declarado_en = list(estudio = "2026-10-31T10:00:00Z", perfiles = "2026-10-31T10:05:00Z"),
    estudio = list(nombre = "  Estudio X  ", cliente = "PUCP"),
    perfiles = list(list(tipo = "aulas", seleccion = "marco", poblaciones = list(
      list(etiqueta = "Estudiantes", representatividad = list(universo = list(nivel = "universidad"),
                                                              variables = list(), celdas = list(list(cuota = 1))))))),
    basura = 1
  )
  una <- .planner_normalizar(crudo)
  expect_identical(.planner_normalizar(.planner_a_persistir(una)), una)
  expect_equal(una$secciones$estudio$declarado_en, "2026-10-31T10:00:00Z")
  expect_equal(names(una$secciones), c("estudio", "perfiles"))
  expect_equal(una$secciones$estudio$valor$nombre, "Estudio X")
  # Las celdas son del diseñador: el Planner nunca las guarda (ADR 0122 §3).
  rep <- una$secciones$perfiles$valor[[1]]$poblaciones[[1]]$representatividad
  expect_null(rep$celdas)
  expect_equal(rep$schema, "representatividad_v1")
})

test_that("leer el Planner no escribe ni marca el proyecto como modificado", {
  sid <- .pl_sesion(list(
    monitoreo_config = list(monitoreo_profile = list(family = "territorial", route_selected = TRUE),
                            territorial = list(enumerator_roster = list(code_format = "PXXX", assignments = list(
                              list(codigo_pulso = "P001", nombre = "Encuestador Ejemplo Uno", dni = "00000000")))))
  ))
  antes <- .pl_huella(sid)
  payload <- .planner_payload(session_get(sid))
  modos <- .planner_modos(session_get(sid))
  expect_identical(.pl_huella(sid), antes)
  expect_false(isTRUE(session_get(sid)$project_dirty))
  # El Planner se ve vacío; el modo se sigue deduciendo por dentro (ADR 0123 §5).
  expect_equal(payload$origen$perfiles, "vacio")
  expect_length(payload$planner$perfiles, 0L)
  expect_equal(modos$origen, "deducido")
  expect_equal(modos$monitoreo$modo, "territorial")
  expect_equal(payload$revision, 0L)
})

test_that("sin declarar, el Planner no trae equipo: es de Monitoreo (ADR 0123 §2)", {
  sid <- .pl_sesion(list(
    monitoreo_config = list(territorial = list(enumerator_roster = list(code_format = "PXXX", assignments = list(
      list(codigo_pulso = "P001", nombre = "Encuestador Ejemplo Uno", dni = "00000000")))))
  ))
  p <- .planner_payload(session_get(sid))
  expect_length(p$planner$equipo$personas, 0L)
  expect_equal(p$origen$equipo, "vacio")
  expect_false(any(grepl("Encuestador|00000000", unlist(p))))
})

test_that("la deducción del modo: Monitoreo elegido gana, y nada de eso se muestra en el Planner", {
  # Forma de acnur_acg: Monitoreo territorial elegido, Cálculo con un diseño de aulas.
  sid <- .pl_sesion(list(
    monitoreo_config = list(monitoreo_profile = list(family = "territorial", route_selected = TRUE)),
    calc_muestra_estudio = list(macro_familia = "encuesta_estudiantes", workspace = list(frame_mode = "opinion_universitaria"))
  ))
  perfiles <- .planner_payload_perfiles(session_get(sid))
  expect_equal(vapply(perfiles, `[[`, "", "tipo"), "territorial")
  expect_equal(perfiles[[1]]$diseno, "hojas-ruta")
  p <- .planner_payload(session_get(sid))
  expect_length(p$planner$perfiles, 0L)
  expect_length(p$avisos, 0L)
  expect_length(p$conflictos, 0L)
})

test_that("una familia sin route_selected no cuenta como elección", {
  sid <- .pl_sesion(list(
    monitoreo_config = list(monitoreo_profile = list(family = "telefonico")),
    calc_muestra_estudio = list(macro_familia = "acreditacion", workspace = list(frame_mode = "x"))
  ))
  perfiles <- .planner_payload_perfiles(session_get(sid))
  expect_equal(perfiles[[1]]$tipo, "acreditacion")
  expect_equal(perfiles[[1]]$diseno, "calc-muestra")
})

test_that("una familia sin equivalente no inventa un perfil", {
  sid <- .pl_sesion(list(monitoreo_config = list(monitoreo_profile = list(family = "digital_general", route_selected = TRUE))))
  expect_length(.planner_payload_perfiles(session_get(sid)), 0L)
  expect_length(.planner_payload(session_get(sid))$conflictos, 0L)
})

test_that("aulas con marco disponible deduce la selección por marco", {
  sid <- .pl_sesion(list(calc_muestra_estudio = list(macro_familia = "hsvg_universitario",
                                                     workspace = list(frame_mode = "marco_disponible"))))
  perfil <- .planner_payload_perfiles(session_get(sid))[[1]]
  expect_equal(perfil$tipo, "aulas")
  expect_equal(perfil$seleccion, "marco")
})

test_that("declarar exige la revisión vigente y la sube en uno", {
  sid <- .pl_sesion()
  expect_error(.planner_declarar(sid, "estudio", list(nombre = "X"), 5L), class = "api_error")
  .planner_declarar(sid, "estudio", list(nombre = "Estudio X", cliente = "Cliente"), 0L)
  p <- .planner_payload(session_get(sid))
  expect_equal(p$revision, 1L)
  expect_equal(p$origen$estudio, "declarado")
  expect_equal(p$planner$estudio$nombre, "Estudio X")
  expect_true(isTRUE(session_get(sid)$project_dirty))
  err <- tryCatch(.planner_declarar(sid, "estudio", list(nombre = "Y"), 0L), error = identity)
  expect_equal(err$code, "E_PLANNER_DESACTUALIZADO")
})

test_that("una sección desconocida es 404", {
  sid <- .pl_sesion()
  err <- tryCatch(.planner_declarar(sid, "cuotas", list(), 0L), error = identity)
  expect_equal(err$code, "E_PLANNER_SECCION")
})

test_that("un equipo declarado antes del 0123 se lee donde lo leen el anonimizador y el gate, sin campos de más", {
  sid <- .pl_sesion()
  .planner_sembrar_legado(sid, "equipo", list(code_format = "PXXX", personas = list(
    list(codigo = "P001", nombre = "Encuestador Ejemplo Uno", rol = "encuestador", perfiles = list("territorial"),
         dni = "00000000", telefono = "999999999"),
    list(codigo = "", nombre = "Aplicadora Ejemplo Dos", rol = "aplicador", perfiles = list("aulas"))
  )))
  guardado <- session_get(sid)$planner
  # La ruta del ADR 0122 §6: es la que recorre .pulso_anon_roster_planner.
  expect_equal(guardado$equipo$personas[[1]]$nombre, "Encuestador Ejemplo Uno")
  expect_length(.pulso_anon_roster_planner(session_get(sid)), 2L)
  # El Planner no guarda DNI ni teléfono como campo: el anonimizador no los cubre.
  expect_setequal(names(guardado$equipo$personas[[1]]), c("codigo", "nombre", "rol", "perfiles", "activo"))
  expect_equal(.planner_payload(session_get(sid))$origen$equipo, "declarado")
})

test_that("el equipo y los códigos ya no se declaran en el Planner (ADR 0123 §2)", {
  sid <- .pl_sesion()
  equipo <- tryCatch(.planner_declarar(sid, "equipo", list(personas = list(list(codigo = "P001", nombre = "Uno"))), 0L),
                     error = identity)
  expect_equal(equipo$code, "E_PLANNER_SECCION_RETIRADA")
  expect_equal(equipo$details$modulo, "Monitoreo")
  codigos <- tryCatch(.planner_declarar(sid, "codigos", list(resultado = list()), 0L), error = identity)
  expect_equal(codigos$code, "E_PLANNER_SECCION_RETIRADA")
  expect_equal(codigos$details$modulo, "Material de campo")
  expect_equal(.planner_leer(session_get(sid))$revision, 0L)
  expect_false(any(c("equipo", "codigos") %in% unlist(.planner_payload(session_get(sid))$escribibles)))
})

test_that("un estudio tiene un solo tipo y quién diseña la muestra sale del tipo (ADR 0124)", {
  sid <- .pl_sesion()
  dos <- tryCatch(.planner_declarar(sid, "perfiles", list(list(tipo = "territorial"), list(tipo = "telefonico")), 0L),
                  error = identity)
  expect_equal(dos$code, "E_PLANNER_INVALIDO")
  diseno <- function(...) .planner_norm_perfil(list(...))$diseno
  expect_equal(diseno(tipo = "territorial"), "hojas-ruta")
  expect_equal(diseno(tipo = "territorial", seleccion = "conveniencia"), "cuotas")
  expect_equal(diseno(tipo = "aulas"), "calc-muestra")
  expect_equal(diseno(tipo = "telefonico"), "cliente")
  # ADR 0143: una acreditación que se declara ahora la diseña Cálculo; la que ya guardó "cliente" lo conserva.
  expect_equal(diseno(tipo = "acreditacion"), "calc-muestra")
  expect_equal(.planner_modos_de(list(.planner_norm_perfil(list(tipo = "acreditacion"))))$calc$modo, "acreditacion")
  expect_equal(diseno(tipo = "acreditacion", diseno = "cliente"), "cliente")
  expect_null(.planner_modos_de(list(.planner_norm_perfil(list(tipo = "acreditacion", diseno = "cliente"))))$calc$modo)
})

test_that("un .pulso que ya guardó dos perfiles se lee y fija el modo con el primero", {
  sid <- .pl_sesion()
  .planner_sembrar_legado(sid, "perfiles", list(list(tipo = "aulas"), list(tipo = "telefonico")))
  expect_length(.planner_payload(session_get(sid))$planner$perfiles, 2L)
  m <- .planner_modos(session_get(sid))
  expect_equal(unlist(m$perfiles), "aulas")
  expect_equal(m$monitoreo$modo, "aulas")
})

test_that("los cinco proyectos de referencia abren el Planner vacío y conservan su modo (ADR 0123 §5)", {
  # Oráculo medido el 1/11 (tabla de Cumplimiento del ADR 0123).
  esperados <- list(
    acnur_acg = list(calc = "territorial-handoff", mon = "territorial", mat = "territorial", hojas = TRUE),
    # ADR 0125 §4: la telefónica trae su supervisión.
    acnur_pdm = list(calc = NA, mon = "telefonico", mat = c("telefonica", "supervision"), hojas = FALSE),
    hsvg2026 = list(calc = "opinion-universitaria", mon = "aulas", mat = "aulas", hojas = FALSE),
    # ADR 0125 §5: sin canales declarados en el Modelo, acreditación abre correo.
    acrconta = list(calc = NA, mon = "acreditacion", mat = "correo", hojas = FALSE),
    acrconta_mazo = list(calc = NA, mon = NA, mat = character(0), hojas = FALSE)
  )
  for (slug in names(esperados)) {
    sid <- .pl_referencia(slug)
    dirty_antes <- isTRUE(session_get(sid)$project_dirty)
    antes <- .pl_huella(sid)
    p <- .planner_payload(session_get(sid))
    m <- .planner_modos(session_get(sid))
    expect_identical(.pl_huella(sid), antes, info = slug)
    expect_identical(isTRUE(session_get(sid)$project_dirty), dirty_antes, info = slug)
    expect_true(all(unlist(p$origen) == "vacio"), info = slug)
    expect_length(p$planner$perfiles, 0L)
    expect_equal(p$planner$estudio$nombre, "", info = slug)
    e <- esperados[[slug]]
    expect_identical(m$calc$modo %||% NA, e$calc, info = slug)
    expect_identical(m$monitoreo$modo %||% NA, e$mon, info = slug)
    expect_identical(as.character(unlist(m$material$campanas)), e$mat, info = slug)
    expect_identical(isTRUE(m$hojas_ruta$aplica), e$hojas, info = slug)
  }
})

# --- P2: el modo que cada perfil fija en cada módulo (ADR 0122 §4) -------------

test_that("la tabla perfil → modo del §4, perfil por perfil", {
  m <- function(...) .planner_modos_de(list(.planner_norm_perfil(list(...))))
  t <- m(tipo = "territorial")
  expect_equal(t$calc$modo, "territorial-handoff")
  expect_true(t$hojas_ruta$aplica)
  expect_equal(t$hojas_ruta$modo, "ump")
  # ADR 0125 §2: por cuotas, Hojas trabaja por zona.
  expect_equal(m(tipo = "territorial", seleccion = "conveniencia")$hojas_ruta$modo, "cuotas")
  expect_null(m(tipo = "aulas")$hojas_ruta$modo)
  expect_equal(t$monitoreo$familia, "territorial")
  expect_equal(unlist(t$material$campanas), "territorial")

  a <- m(tipo = "aulas", seleccion = "conglomerados")
  expect_equal(a$calc$modo, "opinion-universitaria")
  expect_equal(a$calc$macro_familia, "encuesta_estudiantes")
  expect_equal(a$monitoreo$modo, "aulas")
  expect_equal(a$monitoreo$familia, "aulas_universitarias")
  expect_false(a$hojas_ruta$aplica)
  expect_false(a$aulas$con_marco)
  # ADR 0125 §3: con marco de alumnos sigue siendo cursos-horario; el marco es un atributo.
  am <- m(tipo = "aulas", seleccion = "marco")
  expect_equal(am$calc$modo, "opinion-universitaria")
  expect_equal(am$calc$macro_familia, "encuesta_estudiantes")
  expect_true(am$aulas$con_marco)
  expect_equal(unlist(am$material$campanas), "aulas")
  expect_false(t$aulas$con_marco)

  # ADR 0124: el telefónico usa por defecto la lista del cliente; con Cálculo
  # declarado (un .pulso anterior) sigue en marco disponible.
  expect_null(m(tipo = "telefonico")$calc$modo)
  tel <- m(tipo = "telefonico", diseno = "calc-muestra")
  expect_equal(tel$calc$modo, "marco-disponible")
  # No `listado_telefonico`: Cálculo lo manda a su mesa legacy (inferDesk).
  expect_equal(tel$calc$macro_familia, "estudio_propio")
  expect_equal(m(tipo = "territorial")$calc$macro_familia, "territorial")
  expect_equal(m(tipo = "acreditacion", diseno = "calc-muestra")$calc$macro_familia, "acreditacion")
  expect_equal(unlist(tel$material$campanas), c("telefonica", "supervision"))
  # Una lista que entrega el cliente: Cálculo no diseña nada.
  cli <- m(tipo = "telefonico", diseno = "cliente")
  expect_null(cli$calc$modo)
  expect_equal(unlist(cli$calc$del_cliente), "telefonico")

  # ADR 0143: una acreditación declarada ahora abre Cálculo; la guardada con "cliente" no.
  acr <- m(tipo = "acreditacion")
  expect_equal(acr$calc$modo, "acreditacion")
  expect_null(m(tipo = "acreditacion", diseno = "cliente")$calc$modo)
  # ADR 0125 §5: los canales los declara el Modelo de Monitoreo; sin ellos, correo.
  expect_equal(unlist(acr$material$campanas), "correo")
  expect_equal(acr$material$proposito, "acreditacion")
  expect_null(tel$material$proposito)
  tres <- .planner_modos_de(list(.planner_norm_perfil(list(tipo = "acreditacion"))), c("telefonica", "correo", "aulas"))
  expect_equal(unlist(tres$material$campanas), c("telefonica", "correo", "aulas", "supervision"))
  # Los canales del Modelo no tocan a un estudio que no es de acreditación.
  expect_equal(unlist(.planner_modos_de(list(.planner_norm_perfil(list(tipo = "aulas"))), "telefonica")$material$campanas), "aulas")
})

test_that("los canales de acreditación salen del Modelo, por público y en rondas (ADR 0125 §5)", {
  s <- list(monitoreo_config = list(monitoreo_profile = list(units = list(
    list(actor = "Egresados", canales = list(list(ronda = 1L, canal = "correo"), list(ronda = 2L, canal = "telefonico"),
                                             list(ronda = 3L, canal = "correo"))),
    list(actor = "Estudiantes", canales = list(list(ronda = 1L, canal = "presencial"))),
    list(actor = "Docentes")
  ))))
  expect_identical(.planner_canales_del_modelo(s), c("correo", "telefonica", "aulas"))
  expect_identical(.planner_canales_del_modelo(list()), character(0))
  solo_correo <- list(monitoreo_config = list(monitoreo_profile = list(units = list(
    list(actor = "Egresados", canales = list(list(ronda = 1L, canal = "correo")))))))
  expect_identical(.planner_canales_del_modelo(solo_correo), "correo")
  # Las rondas se suman sobre la marcha: llamadas que no llegan a la meta y, después, correo.
  llamadas <- list(monitoreo_config = list(monitoreo_profile = list(units = list(
    list(actor = "Egresados", canales = list(list(ronda = 1L, canal = "telefonico")))))))
  expect_identical(.planner_canales_del_modelo(llamadas), "telefonica")
  llamadas$monitoreo_config$monitoreo_profile$units[[1]]$canales[[2]] <- list(ronda = 2L, canal = "correo")
  expect_identical(.planner_canales_del_modelo(llamadas), c("telefonica", "correo"))
})

test_that("con dos perfiles (un .pulso anterior al ADR 0124) los módulos reciben sólo el primero", {
  modos <- .planner_modos_de(list(
    .planner_norm_perfil(list(tipo = "territorial")),
    .planner_norm_perfil(list(tipo = "telefonico", diseno = "cliente"))
  ))
  expect_equal(unlist(modos$monitoreo$modos), "territorial")
  expect_equal(modos$monitoreo$modo, "territorial")
  expect_equal(unlist(modos$material$campanas), "territorial")
  expect_equal(modos$calc$modo, "territorial-handoff")
})

test_that("sin perfiles no hay modo: cada módulo muestra su vacío", {
  sid <- .pl_sesion()
  modos <- .planner_modos(session_get(sid))
  expect_null(modos$calc$modo)
  expect_null(modos$monitoreo$modo)
  expect_length(modos$material$campanas, 0L)
  expect_false(modos$hojas_ruta$aplica)
})

test_that("leer los modos es puro y sigue lo declarado", {
  sid <- .pl_sesion(list(calc_muestra_estudio = list(macro_familia = "acreditacion", workspace = list(frame_mode = "x"))))
  antes <- .pl_huella(sid)
  expect_equal(.planner_modos(session_get(sid))$calc$modo, "acreditacion")
  expect_identical(.pl_huella(sid), antes)
  .planner_declarar(sid, "perfiles", list(list(tipo = "aulas", seleccion = "marco")), 0L)
  modos <- .planner_modos(session_get(sid))
  expect_equal(modos$calc$modo, "opinion-universitaria")
  expect_true(modos$aulas$con_marco)
  expect_equal(modos$origen, "declarado")
})

# --- Identidad del estudio: una sola, la del Planner (ADR 0122) -----------------

test_that("la identidad sólo vale declarada: no se toma el título de Cálculo ni del Dashboard", {
  sid <- .pl_sesion(list(
    calc_muestra_estudio = list(titulo = "Encuesta a estudiantes", contexto = list(cliente = "Universidad Ejemplo")),
    dashboard_config = list(titulo = "Tablero", cliente = "Otro cliente")
  ))
  id <- .planner_identidad(session_get(sid))
  expect_equal(id$nombre, "")
  expect_equal(id$cliente, "")
  expect_equal(id$origen, "vacio")
  .planner_declarar(sid, "estudio", list(nombre = "Percepción de la comunidad", cliente = "Cliente Ejemplo"), 0L)
  id <- .planner_identidad(session_get(sid))
  expect_equal(id$nombre, "Percepción de la comunidad")
  expect_equal(id$origen, "declarado")
})

test_that("el Home dice la identidad que declara el Planner, con su código", {
  sid <- .pl_sesion(list(calc_muestra_estudio = list(titulo = "Título viejo", contexto = list(cliente = "Cliente viejo"))))
  .planner_declarar(sid, "estudio", list(nombre = "HSVG 2026", codigo = "HSVG26", cliente = "Cliente nuevo"), 0L)
  protocol <- .diseno_protocol_summary(session_get(sid))
  expect_equal(protocol$title, "HSVG 2026")
  expect_equal(protocol$client, "Cliente nuevo")
  expect_equal(protocol$code, "HSVG26")
  proyecto <- .project_overview_payload(sid)$project
  expect_equal(proyecto$name, "HSVG 2026")
  expect_equal(proyecto$code, "HSVG26")
})

test_that("sin nombre en ningún lado, el Home usa el nombre del archivo y no un rótulo genérico", {
  sid <- .pl_sesion()
  s <- session_get(sid); s$project_path <- "/ruta/HSVG2026.pulso"; .session_env[[sid]] <- s
  expect_equal(.project_overview_payload(sid)$project$name, "HSVG2026")
})


# --- Insumos del cliente: se registran, el archivo no se mueve (ADR 0122) -------

.pl_archivos <- function() {
  list(
    `f-marco` = list(file_id = "f-marco", kind = "data", original_name = "BD estudiantes 2026-2.xlsx", uploaded_at = "2026-10-20T10:00:00Z"),
    `f-xls` = list(file_id = "f-xls", kind = "xlsform", original_name = "Instrumento.xlsx", uploaded_at = "2026-10-21T10:00:00Z")
  )
}

test_that("el marco que leyó Cálculo no se siembra como insumo; los archivos del proyecto sí se listan", {
  sid <- .pl_sesion(list(files = .pl_archivos(),
                         calc_muestra_estudio = list(workspace = list(source_bindings = list(
                           list(id = "src-estudiantes", label = "Base principal de matrícula", file_id = "f-marco"))))))
  p <- .planner_payload(session_get(sid))
  expect_length(p$planner$insumos, 0L)
  expect_setequal(vapply(p$archivos, `[[`, "", "file_id"), c("f-marco", "f-xls"))
})

test_that("los insumos ya no se declaran (ADR 0123 §2); los de un .pulso viejo se siguen leyendo", {
  sid <- .pl_sesion(list(files = .pl_archivos()))
  err <- tryCatch(.planner_declarar(sid, "insumos", list(), 0L), error = identity)
  expect_equal(err$code, "E_PLANNER_SECCION_RETIRADA")
  expect_match(err$message, "no se registran")
  .planner_sembrar_legado(sid, "insumos", list(
    list(id = "padron", tipo = "padron", etiqueta = "Padrón 2026", archivo = "f-marco", origen = "DTI",
         archivo_nombre = "no se guarda"),
    list(id = "listado", tipo = "listado", etiqueta = "Listado del cliente", archivo = "", origen = "Drive del cliente"),
    list(id = "viejo", tipo = "otro", etiqueta = "Ya no está", archivo = "f-borrado", origen = "Correo")
  ))
  guardado <- session_get(sid)$planner$insumos
  expect_null(guardado[[1]]$archivo_nombre)
  expect_equal(guardado[[1]]$archivo, "f-marco")
  estados <- vapply(.planner_payload(session_get(sid))$planner$insumos, `[[`, "", "archivo_estado")
  expect_equal(estados, c("en_proyecto", "externo", "falta"))
  # Registrar no mueve ni toca el archivo.
  expect_equal(session_get(sid)$files$`f-marco`$original_name, "BD estudiantes 2026-2.xlsx")
})

# --- Códigos: se siembran de Material y se leen del Planner (ADR 0122) -----------

test_that("sin declarar, el Planner no trae códigos: son de Material (ADR 0123 §2)", {
  sid <- .pl_sesion(list(
    monitoreo_config = list(monitoreo_profile = list(family = "telefonico", route_selected = TRUE)),
    material_telefonica_config = list(status = list(list(codigo = "efectivo", status = "Efectivo", clase = "efectiva")))))
  antes <- .pl_huella(sid)
  cod <- .planner_codigos(session_get(sid))
  expect_identical(.pl_huella(sid), antes)
  expect_equal(cod$origen, "vacio")
  expect_length(cod$resultado, 0L)
  expect_length(cod$status_barrido, 0L)
})



# --- Territorial: UMP aleatoria con hoja de ruta, o conveniencia (Gonzalo) -------

test_that("el territorial declara su variante; por defecto, UMP aleatoria", {
  p <- .planner_norm_perfil(list(tipo = "territorial"))
  expect_equal(p$seleccion, "ump_aleatoria")
  expect_equal(p$diseno, "hojas-ruta")
  expect_equal(.planner_norm_perfil(list(tipo = "territorial", seleccion = "otra"))$seleccion, "ump_aleatoria")
  conv <- .planner_norm_perfil(list(tipo = "territorial", seleccion = "conveniencia"))
  expect_equal(conv$seleccion, "conveniencia")
  expect_equal(conv$diseno, "cuotas")
  # «cuotas» es sólo del territorial por conveniencia.
  expect_equal(.planner_norm_perfil(list(tipo = "telefonico", diseno = "cuotas"))$diseno, "cliente")
})

# ADR 0125 §2: Hojas trabaja por UMP o por zona con cuotas; los dos pasan por Hojas.
test_that("todo territorial pasa por Hojas de ruta, con su modo", {
  ump <- .planner_modos_de(list(.planner_norm_perfil(list(tipo = "territorial"))))
  expect_true(ump$hojas_ruta$aplica)
  expect_equal(ump$calc$modo, "territorial-handoff")
  expect_equal(ump$territorial$seleccion, "ump_aleatoria")
  conv <- .planner_modos_de(list(.planner_norm_perfil(list(tipo = "territorial", seleccion = "conveniencia"))))
  expect_true(conv$hojas_ruta$aplica)
  expect_equal(conv$hojas_ruta$modo, "cuotas")
  expect_equal(ump$hojas_ruta$modo, "ump")
  expect_null(conv$calc$modo)
  expect_equal(conv$monitoreo$modo, "territorial")
  expect_equal(conv$territorial$seleccion, "conveniencia")
})

test_that("declarar la variante la persiste y llega a quien lee los perfiles", {
  sid <- .pl_sesion()
  .planner_declarar(sid, "perfiles", list(list(tipo = "territorial", seleccion = "conveniencia")), 0L)
  expect_equal(session_get(sid)$planner$perfiles[[1]]$seleccion, "conveniencia")
  expect_equal(.planner_payload_perfiles(session_get(sid))[[1]]$seleccion, "conveniencia")
})

# --- Q5 del ADR 0123 ------------------------------------------------------------

test_that("el objetivo se declara con la identidad y no se publica (ADR 0123 §7)", {
  sid <- .pl_sesion()
  .planner_declarar(sid, "estudio", list(nombre = "Estudio Ejemplo", cliente = "Cliente Ejemplo",
                                         objetivo = "Medir la convivencia en seis distritos."), 0L)
  s <- session_get(sid)
  expect_equal(.planner_identidad(s)$objetivo, "Medir la convivencia en seis distritos.")
  publicado <- .planner_para_publicar(s)$planner$estudio
  expect_setequal(names(publicado), c("nombre", "codigo", "cliente"))
  expect_null(publicado$objetivo)
})

test_that("editar perfiles conserva lo que la pantalla no manda (ADR 0123 §2)", {
  sid <- .pl_sesion()
  rep <- list(schema = "representatividad_v1", universo = list(nivel = "carrera"), variables = list(list(clave = "sexo")))
  .planner_sembrar_legado(sid, "perfiles", list(list(
    tipo = "acreditacion", diseno = "cliente", canales = list("correo", "telefono"),
    poblaciones = list(list(id = "egresados", etiqueta = "Egresados", bases = list("b_egr"), representatividad = rep)))))
  # La pantalla manda el perfil sin canales, sin bases y con otra representatividad.
  .planner_declarar(sid, "perfiles", list(list(
    tipo = "acreditacion", diseno = "cliente",
    poblaciones = list(list(id = "egresados", etiqueta = "Egresados 2025",
                            representatividad = list(universo = list(nivel = "otro")))))), 1L)
  p <- session_get(sid)$planner$perfiles[[1]]
  expect_equal(unlist(p$canales), c("correo", "telefono"))
  expect_equal(p$poblaciones[[1]]$etiqueta, "Egresados 2025")
  expect_equal(unlist(p$poblaciones[[1]]$bases), "b_egr")
  expect_equal(p$poblaciones[[1]]$representatividad$universo$nivel, "carrera")
  # Lo que sí manda gana: quitar el teléfono lo quita.
  .planner_declarar(sid, "perfiles", list(list(tipo = "acreditacion", diseno = "cliente", canales = list("correo"),
                                               poblaciones = list(list(id = "egresados", etiqueta = "Egresados 2025")))), 2L)
  expect_equal(unlist(session_get(sid)$planner$perfiles[[1]]$canales), "correo")
})


test_that("acreditación abre la campaña de correo y no lee canales (ADR 0124)", {
  campanas <- function(canales) unlist(.planner_modos_de(list(.planner_norm_perfil(list(tipo = "acreditacion", canales = canales))))$material$campanas)
  expect_equal(campanas(NULL), "correo")
  # Los canales los define Monitoreo y Material crea sus campañas: declararlos no cambia nada aquí.
  expect_equal(campanas(list("telefono", "qr")), "correo")
})
