test_that("clasifica columnas PII por nombre y descarta enunciados de pregunta", {
  expect_equal(.pulso_pii_clasificar_columna("Apellidos y nombres"), "nombre")
  expect_equal(.pulso_pii_clasificar_columna("CORREO PUCP"), "correo")
  expect_equal(.pulso_pii_clasificar_columna("celular"), "telefono")
  expect_equal(.pulso_pii_clasificar_columna("Telefono de reemplazo (Celular)"), "telefono")
  expect_equal(.pulso_pii_clasificar_columna("Código PUCP"), "documento")
  expect_equal(.pulso_pii_clasificar_columna("_geolocation"), "gps")
  expect_equal(.pulso_pii_clasificar_columna("gps_inicio"), "gps")

  # El instrumento de acreditación tiene ítems cuyo ENUNCIADO menciona "correo
  # electrónico". Son respuestas de escala, no campos de contacto: si el
  # anonimizador los pisara, destruiría la data analítica del fixture.
  enunciado <- paste0(
    "q0030__la_informaci_on_sobre_la_formaci_on_que_brinda_la_facultad_est_a_",
    "disponible_v_ia_web_p_agina_oficial_correo_electr_onico_redes_sociales"
  )
  expect_true(is.na(.pulso_pii_clasificar_columna(enunciado)))

  expect_true(is.na(.pulso_pii_clasificar_columna("edad")))
  expect_true(is.na(.pulso_pii_clasificar_columna("distrito")))
})

test_that("los seudonimos son estables y preservan la forma del original", {
  df <- data.frame(
    `Apellidos y nombres` = c("Rojas Vargas, Maria", "Quispe Huaman, Jose", NA),
    correo = c("mrojas@pucp.edu.pe", "jquispe@gmail.com", ""),
    celular = c("987654321", "912345678", NA),
    dni = c("40123456", "07654321", NA),
    check.names = FALSE, stringsAsFactors = FALSE
  )

  a <- pulso_anonimizar_data(df, sal = "sal-de-prueba")
  b <- pulso_anonimizar_data(df, sal = "sal-de-prueba")
  expect_identical(a$data, b$data)

  # Sal distinta -> resultado distinto (los fixtures no son correlacionables).
  c <- pulso_anonimizar_data(df, sal = "otra-sal")
  expect_false(identical(a$data$correo[[1]], c$data$correo[[1]]))

  # Forma preservada.
  expect_true(all(grepl("@", a$data$correo[1:2])))
  expect_equal(nchar(a$data$celular[1:2]), c(9L, 9L))
  expect_true(all(substr(a$data$celular[1:2], 1, 1) == "9"))
  expect_equal(nchar(a$data$dni[1:2]), c(8L, 8L))

  # El dominio institucional se conserva: las reglas que segmentan por dominio
  # se siguen ejercitando.
  expect_true(grepl("@pucp\\.edu\\.pe$", a$data$correo[[1]]))

  # Nada del original sobrevive.
  expect_false(any(grepl("Rojas|Vargas|Maria", a$data$`Apellidos y nombres`, ignore.case = TRUE)))
  expect_false(any(grepl("mrojas", a$data$correo, ignore.case = TRUE)))

  # Los vacíos siguen vacíos: el patrón de faltantes es dato metodológico.
  expect_true(is.na(a$data$celular[[3]]) || !nzchar(a$data$celular[[3]]))
})

test_that("valores repetidos reciben el mismo seudonimo (las uniones siguen cerrando)", {
  df <- data.frame(
    responsable = c("Ana Torres", "Ana Torres", "Luis Prado"),
    stringsAsFactors = FALSE
  )
  a <- pulso_anonimizar_data(df, sal = "s")
  expect_equal(a$data$responsable[[1]], a$data$responsable[[2]])
  expect_false(a$data$responsable[[1]] == a$data$responsable[[3]])
})

test_that("sobrevive a nombres de columna duplicados y vacios", {
  # Caso real: el .pulso de ACNUR ACG trae una base cuyos nombres de columna se
  # repiten y alguno viene vacío. Recorrer el data.frame por nombre reventaba
  # con "subindice fuera de los limites"; el recorrido va por posicion.
  df <- data.frame(
    a = c("Rojas Vargas, Maria", "Quispe Huaman, Jose"),
    b = c("otro texto cualquiera", "mas texto sin interes"),
    c = c("dato", "dato"),
    stringsAsFactors = FALSE
  )
  names(df) <- c("Nombres", "", "Nombres")

  expect_no_error(res <- pulso_anonimizar_data(df, sal = "dup"))
  expect_equal(ncol(res$data), 3L)
  # Las dos columnas llamadas "Nombres" se anonimizaron; la vacía quedó fuera
  # de la clasificacion por nombre y se trata como texto comun.
  expect_false(any(grepl("Rojas|Vargas", res$data[[1]], ignore.case = TRUE)))
  expect_no_error(pulso_anonimizar_abiertas(res$data, res$diccionario, sal = "dup"))
})

test_that("los inputs duplicados por contenido se colapsan a uno solo", {
  # Caso real: el marco muestral de HSVG viajaba dos veces, 11.5 MB cada copia,
  # bajo dos file_id distintos. Como los ids difieren, `build_pulso` los trata
  # como inputs separados y ambos entran al .pulso.
  stage <- tempfile("dup-"); dir.create(stage, recursive = TRUE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  dir.create(file.path(stage, "files"))

  fid_a <- "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  fid_b <- "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  contenido <- "col1,col2\n1,2\n"
  writeLines(contenido, file.path(stage, "files", paste0(fid_a, "__marco.csv")))
  writeLines(contenido, file.path(stage, "files", paste0(fid_b, "__marco.csv")))

  estado <- list(
    files = stats::setNames(
      list(list(original_name = "marco.csv"), list(original_name = "marco.csv")),
      c(fid_a, fid_b)
    ),
    estudio = list(bases = list(
      base_1 = list(data_file_id = fid_a),
      base_2 = list(data_file_id = fid_b)
    ))
  )

  res <- .pulso_anon_deduplicar_files(estado, file.path(stage, "files"))

  expect_equal(res$eliminados, fid_b)
  expect_equal(length(list.files(file.path(stage, "files"))), 1L)
  # La referencia de la base 2 se reapunta al canónico: no queda colgando.
  expect_equal(res$estado$estudio$bases$base_2$data_file_id, fid_a)
  expect_equal(names(res$estado$files), fid_a)
})

test_that("no se deduplican archivos de contenido distinto", {
  stage <- tempfile("nodup-"); dir.create(stage, recursive = TRUE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  dir.create(file.path(stage, "files"))
  writeLines("uno", file.path(stage, "files", "aaa__x.csv"))
  writeLines("dos", file.path(stage, "files", "bbb__y.csv"))

  res <- .pulso_anon_deduplicar_files(list(files = list(aaa = 1, bbb = 2)),
                                      file.path(stage, "files"))
  expect_equal(length(res$eliminados), 0L)
  expect_equal(length(list.files(file.path(stage, "files"))), 2L)
})

test_that("el GPS se desplaza en bloque y preserva la geometria relativa", {
  df <- data.frame(
    `_geolocation` = c("-12.046374 -77.042793 150 5", "-12.056374 -77.052793 152 4", NA),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  a <- pulso_anonimizar_data(df, sal = "geo")

  parse_pt <- function(x) as.numeric(strsplit(x, " ")[[1]][1:2])
  o1 <- parse_pt(df$`_geolocation`[[1]]); o2 <- parse_pt(df$`_geolocation`[[2]])
  n1 <- parse_pt(a$data$`_geolocation`[[1]]); n2 <- parse_pt(a$data$`_geolocation`[[2]])

  # Los puntos se movieron...
  expect_false(isTRUE(all.equal(o1, n1)))
  # ...pero la distancia entre ellos es la misma (desplazamiento rígido).
  expect_equal(o1 - o2, n1 - n2, tolerance = 1e-9)

  # Altitud y precisión intactas: alimentan filtros de calidad de captura.
  expect_equal(strsplit(a$data$`_geolocation`[[1]], " ")[[1]][3:4], c("150", "5"))
})

test_that("el barrido de abiertas reemplaza nombres sueltos dentro del texto", {
  df <- data.frame(
    entrevistado = c("Rojas Vargas, Maria", "Quispe Huaman, Jose"),
    comentario_open = c(
      "La senora Rojas me atendio muy bien en el modulo",
      "Converse con Jose sobre el tramite pendiente y quedo claro"
    ),
    stringsAsFactors = FALSE
  )
  a <- pulso_anonimizar_data(df, sal = "abiertas")
  b <- pulso_anonimizar_abiertas(a$data, a$diccionario)

  expect_gt(b$reemplazos, 0L)
  expect_false(any(grepl("\\bRojas\\b", b$data$comentario_open, ignore.case = TRUE)))
  expect_false(any(grepl("\\bJose\\b", b$data$comentario_open, ignore.case = TRUE)))
  # El resto del texto sobrevive: la abierta sigue siendo codificable.
  expect_true(grepl("me atendio muy bien", b$data$comentario_open[[1]]))
})

test_that("el barrido de abiertas redacta contactos sueltos con marcador explicito", {
  # Estos contactos NO pasan por ninguna columna clasificada: están escritos
  # dentro del texto. Es el hueco que deja la clasificación por nombre.
  df <- data.frame(
    observacion = c(
      "Pidio que le escriban a jperez@pucp.edu.pe para coordinar la visita",
      "Dejo su celular 987654321 y su documento 40123456 para el seguimiento"
    ),
    stringsAsFactors = FALSE
  )
  b <- pulso_anonimizar_abiertas(df, diccionario = character(), sal = "s")

  expect_false(any(grepl("jperez@pucp\\.edu\\.pe", b$data$observacion)))
  expect_false(any(grepl("987654321", b$data$observacion)))
  expect_false(any(grepl("40123456", b$data$observacion)))

  # Marcador explícito, no un seudónimo con forma de dato real: un revisor debe
  # poder distinguir "esto fue redactado" de "esto se filtró".
  expect_true(grepl("[correo]", b$data$observacion[[1]], fixed = TRUE))
  expect_true(grepl("[celular]", b$data$observacion[[2]], fixed = TRUE))
  expect_true(grepl("[documento]", b$data$observacion[[2]], fixed = TRUE))

  # El tema de la abierta sobrevive: sigue siendo codificable.
  expect_true(grepl("para coordinar la visita", b$data$observacion[[1]]))
  expect_true(grepl("para el seguimiento", b$data$observacion[[2]]))
})

test_that("pulso_detectar_pii encuentra PII residual y acepta un fixture limpio", {
  crear_pulso <- function(path, data) {
    stage <- tempfile("mk-pulso-"); dir.create(stage, recursive = TRUE)
    on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
    saveRDS(list(monitoreo_snapshot = list(data = data)), file.path(stage, "state.rds"))
    writeLines(
      jsonlite::toJSON(list(format_version = 1, project_name = "test"), auto_unbox = TRUE),
      file.path(stage, "manifest.json")
    )
    zip::zip(zipfile = path, files = list.files(stage), root = stage)
    path
  }

  sucio <- crear_pulso(
    tempfile(fileext = ".pulso"),
    data.frame(
      nota = c("escribir a mrojas@pucp.edu.pe", "llamar al 987654321"),
      stringsAsFactors = FALSE
    )
  )
  hallazgos <- pulso_detectar_pii(sucio)
  expect_gt(nrow(hallazgos), 0L)
  expect_true(all(c("correo", "celular_pe") %in% hallazgos$tipo))

  limpio <- crear_pulso(
    tempfile(fileext = ".pulso"),
    data.frame(
      nota = c("sin datos de contacto", "todo en orden"),
      distrito = c("Villa Sur", "Villa Norte"),
      stringsAsFactors = FALSE
    )
  )
  expect_equal(nrow(pulso_detectar_pii(limpio)), 0L)
})

test_that("anonimizar un .pulso completo deja el archivo sin PII detectable", {
  origen <- tempfile(fileext = ".pulso")
  stage <- tempfile("src-pulso-"); dir.create(stage, recursive = TRUE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)

  estado <- list(
    monitoreo_snapshot = list(
      data = data.frame(
        `Apellidos y nombres` = c("Rojas Vargas, Maria", "Quispe Huaman, Jose"),
        email = c("mrojas@pucp.edu.pe", "jquispe@pucp.edu.pe"),
        celular = c("987654321", "912345678"),
        `_geolocation` = c("-12.046374 -77.042793 150 5", "-12.056374 -77.052793 152 4"),
        comentario = c(
          "hable con Maria Rojas, dejo el correo mrojas@pucp.edu.pe",
          "sin novedad, su celular es 912345678"
        ),
        check.names = FALSE, stringsAsFactors = FALSE
      )
    ),
    estudio = list(bases = list(base_1 = list(nombre = "base_1", n_filas = 2)))
  )
  saveRDS(estado, file.path(stage, "state.rds"))
  writeLines(
    jsonlite::toJSON(list(format_version = 1, project_name = "origen"), auto_unbox = TRUE),
    file.path(stage, "manifest.json")
  )
  zip::zip(zipfile = origen, files = list.files(stage), root = stage)

  destino <- tempfile(fileext = ".pulso")
  reporte <- pulso_anonimizar_archivo(origen, destino, sal = "sal-fixture", slug = "prueba")

  expect_true(file.exists(destino))
  expect_equal(reporte$schema, PULSO_ANONIMIZACION_SCHEMA)
  expect_gt(reporte$n_nombres_seudonimizados, 0L)

  # El gate: cero PII detectable en las columnas que el anonimizador no
  # garantiza por construcción (incluida `comentario`, que traía un correo y un
  # celular escritos dentro del texto).
  expect_equal(nrow(pulso_detectar_pii(destino)), 0L)

  # Contraprueba de que el gate no pasa por estar mirando a otro lado: con
  # `incluir_columnas_pii` sí ve las columnas estructuradas, y ahí los
  # seudónimos legítimos aparecen justamente porque conservan la forma.
  expect_gt(nrow(pulso_detectar_pii(destino, incluir_columnas_pii = TRUE)), 0L)

  # La estructura sobrevive: mismas filas, mismas columnas, base intacta.
  stage2 <- tempfile("dst-"); dir.create(stage2)
  zip::unzip(destino, exdir = stage2)
  s2 <- readRDS(file.path(stage2, "state.rds"))
  expect_equal(nrow(s2$monitoreo_snapshot$data), 2L)
  expect_equal(names(s2$monitoreo_snapshot$data), names(estado$monitoreo_snapshot$data))
  expect_equal(s2$estudio$bases$base_1$n_filas, 2)

  # El manifest declara la procedencia.
  manifest <- jsonlite::fromJSON(file.path(stage2, "manifest.json"), simplifyVector = FALSE)
  expect_true(isTRUE(manifest$anonimizacion$aplicada))
  expect_equal(manifest$anonimizacion$slug, "prueba")
})
