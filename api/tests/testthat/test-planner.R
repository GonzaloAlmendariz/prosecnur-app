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
  expect_identical(.pl_huella(sid), antes)
  expect_false(isTRUE(session_get(sid)$project_dirty))
  expect_equal(payload$origen$perfiles, "proyectado")
  expect_equal(payload$revision, 0L)
})

test_that("la proyección del equipo nunca trae el DNI", {
  sid <- .pl_sesion(list(
    monitoreo_config = list(territorial = list(enumerator_roster = list(code_format = "PXXX", assignments = list(
      list(codigo_pulso = "P001", nombre = "Encuestador Ejemplo Uno", dni = "00000000")))))
  ))
  equipo <- .planner_payload(session_get(sid))$planner$equipo
  expect_equal(equipo$personas[[1]]$codigo, "P001")
  expect_false(any(grepl("00000000", unlist(equipo), fixed = TRUE)))
  expect_null(equipo$personas[[1]]$dni)
})

test_that("la precedencia del perfil: Monitoreo elegido gana y lo más débil queda como aviso", {
  # Forma de acnur_acg: Monitoreo territorial elegido, Cálculo con un diseño de aulas.
  sid <- .pl_sesion(list(
    monitoreo_config = list(monitoreo_profile = list(family = "territorial", route_selected = TRUE)),
    calc_muestra_estudio = list(macro_familia = "encuesta_estudiantes", workspace = list(frame_mode = "opinion_universitaria"))
  ))
  p <- .planner_payload(session_get(sid))
  expect_equal(vapply(p$planner$perfiles, `[[`, "", "tipo"), "territorial")
  expect_equal(p$planner$perfiles[[1]]$diseno, "hojas-ruta")
  expect_length(p$conflictos, 0L)
  expect_equal(vapply(p$avisos, `[[`, "", "codigo"), "fuente_contradice")
})

test_that("una familia sin route_selected no cuenta como elección", {
  sid <- .pl_sesion(list(
    monitoreo_config = list(monitoreo_profile = list(family = "telefonico")),
    calc_muestra_estudio = list(macro_familia = "acreditacion", workspace = list(frame_mode = "x"))
  ))
  p <- .planner_payload(session_get(sid))
  expect_equal(p$planner$perfiles[[1]]$tipo, "acreditacion")
  expect_equal(p$planner$perfiles[[1]]$diseno, "calc-muestra")
})

test_that("una familia sin equivalente abre conflicto y no inventa un perfil", {
  sid <- .pl_sesion(list(monitoreo_config = list(monitoreo_profile = list(family = "digital_general", route_selected = TRUE))))
  p <- .planner_payload(session_get(sid))
  expect_length(p$planner$perfiles, 0L)
  expect_equal(vapply(p$conflictos, `[[`, "", "codigo"), "perfil_sin_equivalente")
})

test_that("aulas con marco disponible proyecta la selección por marco", {
  sid <- .pl_sesion(list(calc_muestra_estudio = list(macro_familia = "hsvg_universitario",
                                                     workspace = list(frame_mode = "marco_disponible"))))
  perfil <- .planner_payload(session_get(sid))$planner$perfiles[[1]]
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

test_that("el equipo se guarda donde lo leen el anonimizador y el gate, sin campos de más", {
  sid <- .pl_sesion()
  .planner_declarar(sid, "equipo", list(code_format = "PXXX", personas = list(
    list(codigo = "P001", nombre = "Encuestador Ejemplo Uno", rol = "encuestador", perfiles = list("territorial"),
         dni = "00000000", telefono = "999999999"),
    list(codigo = "", nombre = "Aplicadora Ejemplo Dos", rol = "aplicador", perfiles = list("aulas"))
  )), 0L)
  guardado <- session_get(sid)$planner
  # La ruta del ADR 0122 §6: es la que recorre .pulso_anon_roster_planner.
  expect_equal(guardado$equipo$personas[[1]]$nombre, "Encuestador Ejemplo Uno")
  expect_length(.pulso_anon_roster_planner(session_get(sid)), 2L)
  # El Planner no guarda DNI ni teléfono como campo: el anonimizador no los cubre.
  expect_setequal(names(guardado$equipo$personas[[1]]), c("codigo", "nombre", "rol", "perfiles", "activo"))
  expect_equal(.planner_payload(session_get(sid))$origen$equipo, "declarado")
})

test_that("un código del equipo es de una sola persona y nadie queda sin nombre", {
  sid <- .pl_sesion()
  dup <- tryCatch(.planner_declarar(sid, "equipo", list(personas = list(
    list(codigo = "P001", nombre = "Uno"), list(codigo = "P001", nombre = "Dos"))), 0L), error = identity)
  expect_equal(dup$code, "E_PLANNER_INVALIDO")
  sin <- tryCatch(.planner_declarar(sid, "equipo", list(personas = list(list(codigo = "P002", nombre = ""), list(codigo = "P003", nombre = "Tres"))), 0L), error = identity)
  expect_equal(sin$code, "E_PLANNER_INVALIDO")
})

test_that("un perfil por tipo y un solo perfil diseñado en Cálculo", {
  sid <- .pl_sesion()
  dup <- tryCatch(.planner_declarar(sid, "perfiles", list(list(tipo = "aulas"), list(tipo = "aulas")), 0L), error = identity)
  expect_equal(dup$code, "E_PLANNER_INVALIDO")
  dos_calc <- tryCatch(.planner_declarar(sid, "perfiles", list(
    list(tipo = "aulas", diseno = "calc-muestra"), list(tipo = "telefonico", diseno = "calc-muestra")), 0L), error = identity)
  expect_equal(dos_calc$code, "E_PLANNER_INVALIDO")
  .planner_declarar(sid, "perfiles", list(list(tipo = "territorial", diseno = "calc-muestra"),
                                          list(tipo = "telefonico", diseno = "cliente")), 0L)
  perfiles <- .planner_payload(session_get(sid))$planner$perfiles
  # Territorial lo diseña siempre Hojas de ruta, diga lo que diga el cliente.
  expect_equal(vapply(perfiles, `[[`, "", "diseno"), c("hojas-ruta", "cliente"))
})

test_that("el catálogo de códigos sólo agrega: no se borra, no cambia de grupo, se retira", {
  sid <- .pl_sesion()
  base <- list(resultado = list(list(codigo = "1", rotulo = "No quiso", grupo = "no_aplicada"),
                                list(codigo = "8", rotulo = "Efectiva", grupo = "efectiva")))
  .planner_declarar(sid, "codigos", base, 0L)
  expect_equal(.planner_payload(session_get(sid))$planner$codigos$version, 1L)

  borrar <- tryCatch(.planner_declarar(sid, "codigos", list(resultado = base$resultado[2]), 1L), error = identity)
  expect_equal(borrar$code, "E_PLANNER_INVALIDO")
  regrupar <- base; regrupar$resultado[[1]]$grupo <- "efectiva"
  expect_equal(tryCatch(.planner_declarar(sid, "codigos", regrupar, 1L), error = identity)$code, "E_PLANNER_INVALIDO")

  # Corregir un rótulo no cambia la versión; retirar sí, y sella con ella.
  rotulo <- base; rotulo$resultado[[1]]$rotulo <- "No quiso participar"
  .planner_declarar(sid, "codigos", rotulo, 1L)
  expect_equal(.planner_payload(session_get(sid))$planner$codigos$version, 1L)
  retiro <- rotulo; retiro$resultado[[1]]$retirar <- TRUE
  .planner_declarar(sid, "codigos", retiro, 2L)
  cod <- .planner_payload(session_get(sid))$planner$codigos
  expect_equal(cod$version, 2L)
  expect_equal(cod$resultado[[1]]$retirado_en_version, 2L)
  vuelve <- tryCatch(.planner_declarar(sid, "codigos", rotulo, 3L), error = identity)
  expect_equal(vuelve$code, "E_PLANNER_INVALIDO")
})

test_that("la puerta de la F4 del 0121 declara universo y variables sin celdas", {
  sid <- .pl_sesion(list(calc_muestra_estudio = list(macro_familia = "encuesta_estudiantes",
                                                     workspace = list(frame_mode = "opinion_universitaria"))))
  bloque <- list(schema = "representatividad_v1", universo = list(nivel = "universidad", etiqueta = "PUCP"),
                 variables = list(list(clave = "facultad")), celdas = list(list(valores = list(facultad = "X"), cuota = 10)))
  .planner_declarar_representatividad(sid, "aulas", "principal", bloque, 0L)
  p <- .planner_payload(session_get(sid))
  expect_equal(p$origen$perfiles, "declarado")
  rep <- p$planner$perfiles[[1]]$poblaciones[[1]]$representatividad
  expect_equal(rep$universo$etiqueta, "PUCP")
  expect_null(rep$celdas)
})

test_that("los cinco proyectos de referencia proyectan su perfil sin escribir", {
  esperados <- list(acnur_acg = "territorial", acnur_pdm = "telefonico", acrconta = "acreditacion",
                    hsvg2026 = "aulas", acrconta_mazo = character(0))
  for (slug in names(esperados)) {
    sid <- .pl_referencia(slug)
    dirty_antes <- isTRUE(session_get(sid)$project_dirty)
    antes <- .pl_huella(sid)
    p <- .planner_payload(session_get(sid))
    expect_identical(.pl_huella(sid), antes, info = slug)
    expect_identical(isTRUE(session_get(sid)$project_dirty), dirty_antes, info = slug)
    expect_equal(vapply(p$planner$perfiles, `[[`, "", "tipo"), esperados[[slug]], info = slug)
    expect_length(p$conflictos, 0L)
    expect_false(any(grepl("dni", names(unlist(p$planner$equipo)), fixed = TRUE)), info = slug)
  }
})

# --- P2: el modo que cada perfil fija en cada módulo (ADR 0122 §4) -------------

test_that("la tabla perfil → modo del §4, perfil por perfil", {
  m <- function(...) .planner_modos_de(list(.planner_norm_perfil(list(...))))
  t <- m(tipo = "territorial")
  expect_equal(t$calc$modo, "territorial-handoff")
  expect_true(t$hojas_ruta$aplica)
  expect_equal(t$monitoreo$familia, "territorial")
  expect_equal(unlist(t$material$campanas), "territorial")

  a <- m(tipo = "aulas", seleccion = "conglomerados")
  expect_equal(a$calc$modo, "opinion-universitaria")
  expect_equal(a$calc$macro_familia, "encuesta_estudiantes")
  expect_equal(a$monitoreo$modo, "aulas")
  expect_equal(a$monitoreo$familia, "aulas_universitarias")
  expect_false(a$hojas_ruta$aplica)
  expect_equal(m(tipo = "aulas", seleccion = "marco")$calc$modo, "marco-disponible")

  tel <- m(tipo = "telefonico")
  expect_equal(tel$calc$modo, "marco-disponible")
  # No `listado_telefonico`: Cálculo lo manda a su mesa legacy (inferDesk).
  expect_equal(tel$calc$macro_familia, "estudio_propio")
  expect_equal(m(tipo = "aulas", seleccion = "marco")$calc$macro_familia, "estudio_propio")
  expect_equal(m(tipo = "territorial")$calc$macro_familia, "territorial")
  expect_equal(m(tipo = "acreditacion")$calc$macro_familia, "acreditacion")
  expect_equal(unlist(tel$material$campanas), "telefonica")
  # Una lista que entrega el cliente: Cálculo no diseña nada.
  cli <- m(tipo = "telefonico", diseno = "cliente")
  expect_null(cli$calc$modo)
  expect_equal(unlist(cli$calc$del_cliente), "telefonico")

  acr <- m(tipo = "acreditacion")
  expect_equal(acr$calc$modo, "acreditacion")
  expect_equal(unlist(acr$material$campanas), "correo")
})

test_that("con varios perfiles cada módulo recibe la lista y ningún modo único", {
  modos <- .planner_modos_de(list(
    .planner_norm_perfil(list(tipo = "territorial")),
    .planner_norm_perfil(list(tipo = "telefonico", diseno = "cliente", canales = list("telefono", "correo")))
  ))
  expect_equal(unlist(modos$monitoreo$modos), c("territorial", "telefonico"))
  expect_null(modos$monitoreo$modo)
  expect_equal(unlist(modos$material$campanas), c("territorial", "telefonica", "correo"))
  # Nadie diseña en Cálculo: el territorial lo lleva a su puntero a Hojas de ruta.
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
  expect_equal(modos$calc$modo, "marco-disponible")
  expect_equal(modos$origen, "declarado")
})

# --- Identidad del estudio: una sola, la del Planner (ADR 0122) -----------------

test_that("la identidad se siembra de los cuatro lugares viejos, en el orden del Home", {
  sid <- .pl_sesion(list(
    calc_muestra_estudio = list(titulo = "Encuesta a estudiantes", contexto = list(cliente = "Universidad Ejemplo")),
    dashboard_config = list(titulo = "Tablero", cliente = "Otro cliente")
  ))
  id <- .planner_identidad(session_get(sid))
  expect_equal(id$nombre, "Encuesta a estudiantes")
  expect_equal(id$cliente, "Universidad Ejemplo")
  expect_equal(id$origen, "proyectado")
  # Sin Cálculo, el Dashboard.
  sid2 <- .pl_sesion(list(dashboard_config = list(titulo = "Tablero", cliente = "Otro cliente")))
  expect_equal(.planner_identidad(session_get(sid2))$cliente, "Otro cliente")
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

test_that("el rótulo por defecto de Cálculo no se toma como nombre del estudio", {
  sid <- .pl_sesion(list(calc_muestra_estudio = list(titulo = "Estudio sin título"),
                         dashboard_config = list(titulo = "Tablero de HSVG")))
  expect_equal(.planner_identidad(session_get(sid))$nombre, "Tablero de HSVG")
})

# --- Insumos del cliente: se registran, el archivo no se mueve (ADR 0122) -------

.pl_archivos <- function() {
  list(
    `f-marco` = list(file_id = "f-marco", kind = "data", original_name = "BD estudiantes 2026-2.xlsx", uploaded_at = "2026-10-20T10:00:00Z"),
    `f-xls` = list(file_id = "f-xls", kind = "xlsform", original_name = "Instrumento.xlsx", uploaded_at = "2026-10-21T10:00:00Z")
  )
}

test_that("el marco que leyó Cálculo se siembra como insumo enlazado a su archivo", {
  # Forma real (hsvg2026): una vinculación por hoja; dos hojas del mismo archivo.
  sid <- .pl_sesion(list(files = .pl_archivos(),
                         calc_muestra_estudio = list(workspace = list(source_bindings = list(
                           list(id = "src-estudiantes", label = "Base principal de matrícula", file_id = "f-marco"),
                           list(id = "src-cursos", label = "Cursos", file_id = "f-marco"))))))
  p <- .planner_payload(session_get(sid))
  expect_length(p$planner$insumos, 1L)
  marco <- p$planner$insumos[[1]]
  expect_equal(marco$etiqueta, "Base principal de matrícula")
  expect_equal(marco$tipo, "marco")
  expect_equal(marco$archivo, "f-marco")
  expect_equal(marco$archivo_nombre, "BD estudiantes 2026-2.xlsx")
  expect_equal(marco$archivo_estado, "en_proyecto")
  expect_setequal(vapply(p$archivos, `[[`, "", "file_id"), c("f-marco", "f-xls"))
})

test_that("un insumo declarado guarda sólo el file_id; el nombre se resuelve al leer", {
  sid <- .pl_sesion(list(files = .pl_archivos()))
  .planner_declarar(sid, "insumos", list(
    list(id = "padron", tipo = "padron", etiqueta = "Padrón 2026", archivo = "f-marco", origen = "DTI",
         archivo_nombre = "no se guarda"),
    list(id = "listado", tipo = "listado", etiqueta = "Listado del cliente", archivo = "", origen = "Drive del cliente"),
    list(id = "viejo", tipo = "otro", etiqueta = "Ya no está", archivo = "f-borrado", origen = "Correo")
  ), 0L)
  guardado <- session_get(sid)$planner$insumos
  expect_null(guardado[[1]]$archivo_nombre)
  expect_equal(guardado[[1]]$archivo, "f-marco")
  estados <- vapply(.planner_payload(session_get(sid))$planner$insumos, `[[`, "", "archivo_estado")
  expect_equal(estados, c("en_proyecto", "externo", "falta"))
  # Registrar no mueve ni toca el archivo.
  expect_equal(session_get(sid)$files$`f-marco`$original_name, "BD estudiantes 2026-2.xlsx")
})

# --- Códigos: se siembran de Material y se leen del Planner (ADR 0122) -----------

test_that("territorial siembra el catálogo de la visita de Material: 1 a 8 con 8 efectiva, y 99", {
  sid <- .pl_sesion(list(monitoreo_config = list(monitoreo_profile = list(family = "territorial", route_selected = TRUE))))
  antes <- .pl_huella(sid)
  cod <- .planner_codigos(session_get(sid))
  expect_identical(.pl_huella(sid), antes)
  expect_equal(cod$origen, "proyectado")
  codigos <- vapply(cod$resultado, `[[`, "", "codigo")
  expect_equal(codigos, c(as.character(1:8), "99"))
  grupos <- stats::setNames(vapply(cod$resultado, `[[`, "", "grupo"), codigos)
  expect_equal(unname(grupos["8"]), "efectiva")
  expect_equal(unname(grupos["99"]), "manzana")
  expect_length(cod$status_barrido, 0L)
})

test_that("telefónico siembra los 14 Status del RMS con su clase", {
  sid <- .pl_sesion(list(monitoreo_config = list(monitoreo_profile = list(family = "telefonico", route_selected = TRUE))))
  st <- .planner_codigos(session_get(sid))$status_barrido
  expect_length(st, 14L)
  expect_equal(st[[1]]$codigo, "no_barrido")
  expect_equal(st[[2]]$grupo, "efectiva")
  expect_true(all(vapply(st, `[[`, "", "grupo") %in% PLANNER_CLASES_BARRIDO))
  # Ortografía literal del Sheets del RMS.
  expect_true("Número Incorrecto" %in% vapply(st, `[[`, "", "rotulo"))
})

test_that("si la campaña telefónica personalizó sus Status, se siembran ésos", {
  sid <- .pl_sesion(list(material_telefonica_config = list(status = list(
    list(codigo = "efectivo", status = "Efectivo", clase = "efectiva"),
    list(codigo = "no_contesta", status = "No contesta", clase = "no_contacto")))))
  st <- .planner_codigos(session_get(sid))$status_barrido
  expect_equal(vapply(st, `[[`, "", "codigo"), c("efectivo", "no_contesta"))
})

test_that("los rótulos del núcleo se editan (K1); el grupo o la clase no", {
  sid <- .pl_sesion(list(monitoreo_config = list(monitoreo_profile = list(family = "territorial", route_selected = TRUE))))
  cod <- .planner_codigos(session_get(sid))
  base <- list(resultado = cod$resultado, status_barrido = list(list(codigo = "efectivo", rotulo = "Efectivo", grupo = "efectiva")))
  .planner_declarar(sid, "codigos", base, 0L)
  editado <- base
  editado$resultado[[8]]$rotulo <- "Encuesta completa"
  .planner_declarar(sid, "codigos", editado, 1L)
  expect_equal(.planner_codigos(session_get(sid))$resultado[[8]]$rotulo, "Encuesta completa")
  expect_equal(.planner_codigos(session_get(sid))$origen, "declarado")
  reclase <- editado
  reclase$status_barrido[[1]]$grupo <- "pendiente"
  expect_equal(tryCatch(.planner_declarar(sid, "codigos", reclase, 2L), error = identity)$code, "E_PLANNER_INVALIDO")
})
