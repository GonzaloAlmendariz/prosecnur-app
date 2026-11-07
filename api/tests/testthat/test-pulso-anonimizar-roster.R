source("setup-load-all.R")

# La lista de encuestadores de Monitoreo (`monitoreo_config$territorial$enumerator_roster`) es una lista de
# registros, no un data.frame: el recorrido genérico del anonimizador y el del gate de PII pasaban de largo y un
# fixture publicado salía con nombres y DNI reales («verde por ceguera»). Aquí: nombres -> seudónimos estables, DNI
# fuera, `codigo_pulso` conservado (PXXX) o recodificado (formato DNI) igual en la lista, en
# `material_territorial_asignacion` y en el `responsible_display` de los datos derivados.
#
# Los nombres del fixture son ficticios evidentes (regla de la casa): nunca un nombre real como ejemplo.
# Mutante que mata: sin `.pulso_anon_roster_aplicar` la lista conserva los nombres y el gate los marca.

.par_nombres <- c("FULANO DE TAL PRUEBA", "MENGANA FICTICIA EJEMPLO", "ZUTANO INVENTADO DEMO")
.par_dnis <- c("41111111", "42222222", "43333333")
.par_supervisor <- "PERENGANO SUPUESTO MODELO"
.par_tokens_reales <- c("FULANO", "MENGANA", "ZUTANO", "FICTICIA", "INVENTADO", "PRUEBA", "EJEMPLO", "DEMO",
                        "PERENGANO", "SUPUESTO", "MODELO")

# Un XLSForm de ocurrencias con la lista de encuestadores en `choices` («P001 · Nombre»), al que le falta
# `_rels/.rels` como al de acnur_acg: readxl no lo abre y el anonimizador y el gate lo saltaban en silencio.
.par_xlsform_ilegible <- function(path, codigos) {
  wb <- openxlsx::createWorkbook()
  for (h in c("survey", "choices", "settings")) openxlsx::addWorksheet(wb, h)
  openxlsx::writeData(wb, "survey", data.frame(type = "select_one encuestador", name = "encuestador",
                                               label = "Encuestador"))
  openxlsx::writeData(wb, "choices", data.frame(list_name = "encuestador", name = tolower(codigos),
                                                label = paste(codigos, .par_nombres, sep = " · ")))
  openxlsx::writeData(wb, "settings", data.frame(form_id = "ocurrencias"))
  tmp <- tempfile(fileext = ".xlsx"); openxlsx::saveWorkbook(wb, tmp)
  dir <- tempfile("xf-"); zip::unzip(tmp, exdir = dir)
  unlink(file.path(dir, "_rels", ".rels"))
  entradas <- list.files(dir, recursive = TRUE, all.files = TRUE)
  zip::zip(path, files = entradas, root = dir)
  invisible(path)
}

# Texto crudo de todas las celdas de los xlsx (sharedStrings + hojas), legibles o no.
.par_xml_xlsx <- function(path) {
  dir <- tempfile("xx-"); zip::unzip(path, exdir = dir)
  xml <- list.files(file.path(dir, "xl"), pattern = "\\.xml$", recursive = TRUE, full.names = TRUE)
  unlist(lapply(xml, function(f) paste(readLines(f, warn = FALSE, encoding = "UTF-8"), collapse = "")))
}

# Un .pulso mínimo armado a mano: manifest + state.rds + el Excel de origen de la lista en files/.
.par_pulso <- function(code_format = "PXXX") {
  codigos <- if (identical(code_format, "DNI")) .par_dnis else c("P001", "P002", "P003")
  fid <- "f0000000-0000-4000-8000-0000000000aa"
  asignaciones <- lapply(seq_along(.par_nombres), function(i) list(
    codigo_pulso = codigos[[i]], nombre = .par_nombres[[i]],
    nombre_normalizado = .monitoreo_territorial_enumerator_key(.par_nombres[[i]]),
    dni = .par_dnis[[i]], source_row = i))
  # Un registro con código y sin nombre: el normalizador le pone el código como nombre (así queda guardado). No
  # es una persona y su código no debe convertirse en seudónimo.
  asignaciones[[4]] <- list(codigo_pulso = "P004", nombre = "P004",
                            nombre_normalizado = .monitoreo_territorial_enumerator_key("P004"), dni = "",
                            source_row = 4L)
  # Las anulaciones de producción guardan al responsable como `codigo_clave`, con la clave sacada del DATO DE
  # CAMPO: otra variante del nombre (otro orden, menos piezas) que no casa con la de la lista. Así se filtraron
  # 7 encuestadores de acnur_acg.
  llave <- function(i, variante) paste0(tolower(codigos[[i]]), "_", variante)
  anulaciones <- list(field = list(list(
    responsible_key = llave(1, "prueba_fulano_de_tal"), responsible_label = paste(codigos[[1]], "·", .par_nombres[[1]]),
    impact = list(responsible_key = llave(1, "prueba_fulano")))))
  estado <- list(
    monitoreo_config = list(territorial = list(enumerator_roster = list(
      enabled = TRUE, code_format = code_format, code_var = "codigo_pulso", source_file_id = fid,
      file_name = "encuestadores.xlsx", assignments = asignaciones),
      production_annulments = anulaciones)),
    material_territorial_asignacion = list(
      schema = MATERIAL_TERRITORIAL_ASIGNACION_SCHEMA, campaign_id = "territorial", fase = "field", revision = 2L,
      asignacion = list(list(id_manzana = "M-01", codigo = codigos[[1]]),
                        list(id_manzana = "M-02", codigo = codigos[[3]]))),
    # El equipo que declara el Planner: un encuestador que también está en la lista y un supervisor que no.
    planner = list(schema = "planner/v1", equipo = list(schema = "planner_equipo/v1", code_format = code_format,
      personas = list(
        list(codigo = codigos[[1]], nombre = .par_nombres[[1]], rol = "encuestador", perfiles = list("territorial"),
             activo = TRUE),
        list(codigo = "E09", nombre = .par_supervisor, rol = "supervisor", perfiles = list("territorial"),
             activo = TRUE)))),
    # Monitoreo guarda la configuración entera serializada en sus tokens de caché.
    monitoreo_dashboard_cache_token_full = NULL,
    # Lo que Monitoreo deriva de la lista: «CÓDIGO · Nombre» y el nombre asignado, en columnas de nombre inocente.
    monitoreo_snapshot = list(audit_summary = data.frame(
      response_id = c("r1", "r2", "r3"),
      pulso_code = codigos,
      enumerator_assigned = .par_nombres,
      responsible_display = paste(codigos, .par_nombres, sep = " · "),
      stringsAsFactors = FALSE),
      otros = data.frame(pulso_code = c("P004", "P0041"), stringsAsFactors = FALSE),
      reports = list(production_annulments = list(responsibles = list(
        list(key = llave(2, "ejemplo_mengana"), label = paste(codigos[[2]], "·", "MENGANA EJEMPLO")),
        # Un código con clave que no es un nombre de su persona no se toca.
        list(key = "p003_sin_dato", label = "P003 · sin dato"),
        # Código mal digitado (no está en la lista) con una variante del nombre: sólo lo alcanza el barrido por
        # pares de piezas (acnur_acg: «p844_…» con la lista en P884 y P824).
        list(key = "p999_inventado_zutano_demo", label = "P999 · INVENTADO ZUTANO"))),
      # Un nombre que vive como CLAVE de una lista, no como valor.
      por_responsable = stats::setNames(list(list(n = 3L)), "ficticia_mengana")))
  )
  estado$monitoreo_dashboard_cache_token_full <- paste0(
    "monitoreo-dashboard-v1|full|", jsonlite::toJSON(estado$monitoreo_config, auto_unbox = TRUE))
  stage <- tempfile("par-"); dir.create(file.path(stage, "files"), recursive = TRUE)
  saveRDS(estado, file.path(stage, "state.rds"))
  writeLines(jsonlite::toJSON(list(schema = "pulso/v1"), auto_unbox = TRUE), file.path(stage, "manifest.json"))
  partes <- strsplit(.par_nombres, " ")
  openxlsx::write.xlsx(data.frame(
    `AP PATERNO` = vapply(partes, `[[`, "", 2L), `AP MATERNO` = vapply(partes, `[[`, "", 3L),
    NOMBRES = vapply(partes, `[[`, "", 1L), DNI = .par_dnis, check.names = FALSE),
    file.path(stage, "files", paste0(fid, "__encuestadores.xlsx")), sheetName = "Encuestadores")
  .par_xlsform_ilegible(file.path(stage, "files", "f0000000-0000-4000-8000-0000000000bb__ocurrencias_xlsform.xlsx"),
                        codigos)
  origen <- tempfile(fileext = ".pulso")
  zip::zip(origen, files = c("manifest.json", "state.rds", "files"), root = stage)
  origen
}

.par_entradas <- function(path) {
  stage <- tempfile("par-out-"); dir.create(stage)
  zip::unzip(path, exdir = stage)
  xlsx <- list.files(file.path(stage, "files"), full.names = TRUE)
  list(state = readRDS(file.path(stage, "state.rds")), celdas = unlist(lapply(xlsx, .par_xml_xlsx)))
}

.par_texto_state <- function(s) rawToChar(serialize(s, NULL, ascii = TRUE))

.par_sin_reales <- function(texto) {
  # En minúsculas: `nombre_normalizado` guarda la clave derivada del nombre («fulano_de_tal_prueba»).
  for (t in c(.par_tokens_reales, .par_dnis)) {
    expect_false(any(grepl(tolower(t), tolower(texto), fixed = TRUE)), info = t)
  }
}

test_that("el gate de PII ve los nombres y DNI reales de la lista de encuestadores", {
  h <- pulso_detectar_pii(.par_pulso())
  lista <- h[h$ruta == "state$monitoreo_config$territorial$enumerator_roster", , drop = FALSE]
  expect_true(all(c("nombre", "dni_pe") %in% lista$tipo))
  expect_equal(lista$n[lista$columna == "nombre"], 3L)
  # El XLSForm que readxl no abre: el gate lee su XML y reconoce «P001 · Nombre» sin firma de catálogo.
  expect_true(any(grepl("ocurrencias_xlsform.xlsx", h$ruta, fixed = TRUE) & h$tipo == "nombre"))
  # El equipo del Planner, con la misma política.
  expect_true("state$planner$equipo$personas" %in% h$ruta)
  # Las claves `codigo_variante` de las anulaciones, aunque la variante no sea la de la lista.
  expect_true("prueba fulano de tal" %in% .pulso_anon_roster_llave_hallazgos(c("p001_prueba_fulano_de_tal",
                                                                                "p001_ana_rojas_tapia", "p003_sin_dato")))
  expect_length(.pulso_anon_roster_llave_hallazgos(c("p001_ana_rojas_tapia", "p003_sin_dato")), 0L)
  # Y la copia serializada dentro del token de caché.
  token <- h[h$ruta == "state$monitoreo_dashboard_cache_token_full", , drop = FALSE]
  expect_setequal(token$tipo, c("nombre", "dni_pe"))
  # El ejemplo identifica el formato, no a la persona.
  expect_false(any(grepl("FULANO DE TAL", h$ejemplo, fixed = TRUE)))
  # El Excel de origen de la lista también: sus apellidos van en columnas que el clasificador no reconoce.
  expect_true(any(grepl("encuestadores.xlsx", h$ruta, fixed = TRUE) & h$tipo == "nombre"))
})

test_that("la lista PXXX sale con seudónimos estables, sin DNI y con sus códigos casando en todo el proyecto", {
  origen <- .par_pulso("PXXX")
  destino <- tempfile(fileext = ".pulso")
  rep <- pulso_anonimizar_archivo(origen, destino, sal = "sal-roster", slug = "roster")
  e <- .par_entradas(destino)
  s <- e$state

  .par_sin_reales(.par_texto_state(s))
  .par_sin_reales(e$celdas)
  expect_equal(rep$n_encuestadores_seudonimizados, 6L)                # registros: 4 de la lista + 2 del Planner

  ro <- .monitoreo_territorial_normalize_enumerator_roster(s$monitoreo_config$territorial$enumerator_roster)
  expect_equal(ro$total, 4L)                                          # ningún seudónimo colisiona y se pierde
  codigos <- vapply(ro$assignments, `[[`, "", "codigo_pulso")
  nombres <- stats::setNames(vapply(ro$assignments, `[[`, "", "nombre"), codigos)
  expect_identical(unname(codigos), c("P001", "P002", "P003", "P004"))
  # El registro sin nombre conserva su código como nombre, y ese código no se toca en ninguna parte.
  expect_identical(unname(nombres["P004"]), "P004")
  expect_identical(s$monitoreo_snapshot$otros$pulso_code, c("P004", "P0041"))
  nombres <- nombres[c("P001", "P002", "P003")]
  expect_true(all(vapply(ro$assignments, function(a) identical(a$dni, ""), logical(1))))
  expect_true(all(.pulso_anon_roster_firmado(nombres)))

  # La asignación de Material sigue apuntando a códigos de la lista.
  asig <- vapply(s$material_territorial_asignacion$asignacion, `[[`, "", "codigo")
  expect_identical(asig, c("P001", "P003"))

  # El Planner: la persona que también está en la lista queda con SU seudónimo; el supervisor conserva su código.
  pl <- s$planner$equipo$personas
  expect_identical(pl[[1]]$codigo, "P001")
  expect_identical(pl[[1]]$nombre, unname(nombres["P001"]))
  expect_identical(pl[[2]]$codigo, "E09")
  expect_true(.pulso_anon_roster_firmado(pl[[2]]$nombre))
  expect_identical(pl[[2]]$rol, "supervisor")

  # Las claves de anulación pasan al seudónimo de SU persona (por el código), sea cual sea la variante.
  llave_fake <- function(cod) paste0(tolower(cod), "_", tolower(gsub(" ", "_", nombres[[cod]])))
  an <- s$monitoreo_config$territorial$production_annulments$field[[1]]
  expect_identical(an$responsible_key, llave_fake("P001"))
  expect_identical(an$impact$responsible_key, llave_fake("P001"))
  expect_identical(an$responsible_label, paste("P001 ·", nombres[["P001"]]))
  resp <- s$monitoreo_snapshot$reports$production_annulments$responsibles
  expect_identical(resp[[1]]$key, llave_fake("P002"))
  expect_identical(resp[[1]]$label, paste("P002 ·", nombres[["P002"]]))
  expect_identical(resp[[2]]$key, "p003_sin_dato")
  # Pares de piezas con código ajeno: las dos piezas pasan al seudónimo de su persona, en su caja y con su separador.
  expect_true(.pulso_anon_roster_firmado(gsub("_", " ", sub("^p999_", "", resp[[3]]$key))))
  expect_true(.pulso_anon_roster_firmado(sub("^P999 · ", "", resp[[3]]$label)))
  # El nombre que era clave de lista ya no está.
  expect_false("ficticia_mengana" %in% names(s$monitoreo_snapshot$por_responsable))

  # Lo derivado nombra al mismo seudónimo que la lista.
  aud <- s$monitoreo_snapshot$audit_summary
  expect_identical(aud$enumerator_assigned, unname(nombres[aud$pulso_code]))
  expect_identical(aud$responsible_display, paste(aud$pulso_code, nombres[aud$pulso_code], sep = " · "))

  # El token describe la configuración anonimizada: mismo reemplazo que sufrió la lista.
  expect_identical(s$monitoreo_dashboard_cache_token_full, paste0(
    "monitoreo-dashboard-v1|full|", jsonlite::toJSON(s$monitoreo_config, auto_unbox = TRUE)))

  # Estable: misma sal, mismos seudónimos.
  destino2 <- tempfile(fileext = ".pulso")
  pulso_anonimizar_archivo(origen, destino2, sal = "sal-roster", slug = "roster")
  expect_identical(.par_entradas(destino2)$state$monitoreo_config, s$monitoreo_config)

  expect_equal(nrow(pulso_detectar_pii(destino)), 0L)
})

test_that("con formato DNI el código se recodifica igual en la lista, la asignación y los datos", {
  origen <- .par_pulso("DNI")
  destino <- tempfile(fileext = ".pulso")
  pulso_anonimizar_archivo(origen, destino, sal = "sal-roster", slug = "roster")
  s <- .par_entradas(destino)$state

  .par_sin_reales(.par_texto_state(s))
  ro <- .monitoreo_territorial_normalize_enumerator_roster(s$monitoreo_config$territorial$enumerator_roster)
  expect_identical(ro$code_format, "DNI")
  expect_equal(ro$total, 3L)                                          # «P004» no es un código DNI válido
  codigos <- vapply(ro$assignments, `[[`, "", "codigo_pulso")[1:3]
  expect_true(all(grepl(.PULSO_ANON_ROSTER_CODIGO_RE, codigos)))
  expect_true(all(.monitoreo_territorial_valid_code(codigos, "DNI")))
  nombres <- stats::setNames(vapply(ro$assignments, `[[`, "", "nombre")[1:3], codigos)

  expect_identical(vapply(s$material_territorial_asignacion$asignacion, `[[`, "", "codigo"), codigos[c(1, 3)])
  expect_identical(s$planner$equipo$personas[[1]]$codigo, codigos[[1]])
  aud <- s$monitoreo_snapshot$audit_summary
  expect_identical(aud$pulso_code, unname(codigos))
  expect_identical(aud$responsible_display, paste(codigos, nombres, sep = " · "))

  expect_equal(nrow(pulso_detectar_pii(destino)), 0L)
})

test_that("--solo-encuestadores sanea un fixture ya publicado sin tocar el resto", {
  origen <- .par_pulso("PXXX")
  destino <- tempfile(fileext = ".pulso")
  r <- pulso_anonimizar_encuestadores_archivo(origen, destino, sal = "sal-roster")
  expect_equal(r$n_personas, 4L)                                     # 3 de la lista + el supervisor del Planner
  expect_equal(r$n_dnis, 3L)
  e <- .par_entradas(destino)
  .par_sin_reales(.par_texto_state(e$state))
  .par_sin_reales(e$celdas)
  expect_equal(nrow(pulso_detectar_pii(destino)), 0L)
  antes <- readRDS(file.path(local({ d <- tempfile(); zip::unzip(origen, exdir = d); d }), "state.rds"))
  expect_identical(e$state$monitoreo_snapshot$audit_summary$response_id, antes$monitoreo_snapshot$audit_summary$response_id)
  expect_identical(e$state$material_territorial_asignacion, antes$material_territorial_asignacion)
})

test_that("el barrido por piezas exige dos piezas DISTINTAS y respeta caja y separadores", {
  # Una pieza repetida no es un nombre: «Rosa rosa» en una etiqueta del instrumento se reescribía (72 textos de
  # acnur_acg entre el instrumento, su plan de validación y dos plantillas de codificación).
  estado <- list(monitoreo_config = list(territorial = list(enumerator_roster = list(code_format = "PXXX",
    assignments = list(list(codigo_pulso = "P001", nombre = "FULANO DE TAL PRUEBA")))))) 
  mapa <- .pulso_anon_roster_mapa(estado, "sal-piezas")
  barrer <- function(v) .pulso_anon_roster_restaurar(
    .pulso_anon_roster_marcar(data.frame(v = v, stringsAsFactors = FALSE), mapa)$data, mapa)$v
  intactos <- c("Una prueba prueba del instrumento", "prueba_prueba", "PRUEBA PRUEBA", "fulano")
  expect_identical(barrer(intactos), intactos)

  fake <- strsplit(unname(mapa$nombres[["FULANO DE TAL PRUEBA"]]), " ")[[1]]
  titulo <- function(x) paste0(toupper(substr(x, 1, 1)), tolower(substr(x, 2, nchar(x))))
  # Title case se queda en Title case; cada pieza va a la que le toca en el seudónimo.
  expect_identical(barrer("Atendió Fulano Prueba"), paste("Atendió", titulo(fake[[1]]), titulo(fake[[3]])))
  # «Apellido, Nombre» y apellidos compuestos con guion también son dos piezas juntas.
  expect_identical(barrer("PRUEBA, FULANO"), paste0(toupper(fake[[3]]), ", ", toupper(fake[[1]])))
  expect_identical(barrer("prueba-fulano"), paste0(tolower(fake[[3]]), "-", tolower(fake[[1]])))
})

test_that("un proyecto sin lista de encuestadores no cambia de comportamiento", {
  expect_length(.pulso_anon_roster_mapa(list(monitoreo_config = list()), sal = "x")$nombres, 0L)
  expect_equal(nrow(.pulso_anon_roster_hallazgos(list(), tempfile())), 0L)
})
