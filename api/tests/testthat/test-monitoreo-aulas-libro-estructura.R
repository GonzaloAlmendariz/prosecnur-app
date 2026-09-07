# La estructura del libro operativo tras la revision de la siembra real.
#
# Gonzalo, mirando el libro generado por la via del handoff: «estas combinando
# muestra uno con muestra dos, y CH uno con CH dos»; «ni siquiera se por que la
# columna muestra esta ahi cuando curso horario te esta dando todo».
#
# Tres contratos congelados (checklist docs/qa/checklist-operativo-aulas-2026-08-31.md):
#
# 1. **Fuera la columna MUESTRA.** `AULAS_AGENDADAS_BLOQUE` pierde la entrada
#    `wave` (titulo «MUESTRA») y queda en 20 titulos. La hoja de agendadas y la
#    de aplicadas dejan de llevarla; la Base de control la CONSERVA (su pin vive
#    en test-carga-aulas-libro-generar.R). El lector es tolerante por diseño
#    —empareja por titulo, lo desconocido se ignora— asi que un libro viejo con
#    la columna sigue importando; y `wave` sale de `AULAS_LIBRO_CAMPOS_PROPIOS`
#    para que el libro no pueda pisar la ola interna del plan, que viene de
#    Calculo de muestra.
#
# 2. **El generador declara, no mezcla.** Una reserva (chain_reserve, o un
#    extra activado con parte) SIN `titular_operational_code` no produce una
#    fila fantasma en silencio: `aulas_libro_generar` (o la hoja de agendadas)
#    lanza `E_AULAS_LIBRO_SIN_CADENAS` (409) con mensaje causal. Umbral: UNA
#    sola reserva sin toc dispara. Los titulares sin toc son legales: su toc es
#    su propio codigo, y asi los trata hoy `.calg_titular`.
#
# 3. **El handoff escribe lo que el libro necesita.** `collection_handoff`
#    emite por fila `titular_operational_code`, `enrolled_total` y `eligible_n`.
#    Medido hoy: la unit del plan de collection (`.collection_legacy_unit`)
#    carga `eligible_n` (de eligible_n|matriculados_poblacion|students_n) y el
#    codigo del titular SOLO como `dimensions$replacement_for` (consumido de
#    `titular_operational_code`, con guarda de autorreferencia); NO carga
#    `enrolled_total`. La fila que el handoff crea sale sin toc y sin
#    matriculados, y el ciclo handoff -> normalize -> hoja de agendadas produce
#    filas de mas: la mezcla que Gonzalo vio en la siembra real. La via sana
#    (`monitoreo_aulas_from_calc`) esta medida aparte: 174 titulares, sin
#    mezcla, 30|28 poblados (HSVG26ULT2).

# --- 1. Fuera la columna MUESTRA --------------------------------------------

.male_unidades <- function() list(
  list(operational_code = "CH 1", titular_operational_code = "CH 1",
       sample_role = "titular", wave = "M1", faculty = "ARTE Y DISEÑO",
       course_name = "Curso 1", teacher = "Docente 1", label = "LUN 08:00 A101",
       enrolled_total = 34, eligible_n = 30),
  list(operational_code = "R 1.1", titular_operational_code = "CH 1",
       sample_role = "chain_reserve", wave = "M2", replacement_order = 1,
       faculty = "ARTE Y DISEÑO", course_name = "Curso 1R",
       teacher = "Docente 1R", label = "MAR 10:00 A102",
       enrolled_total = 29, eligible_n = 26)
)

test_that("el bloque de agenda tiene 23 titulos y ninguno es MUESTRA", {
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  # 20 del contrato B8 («sin MUESTRA») + «RECIBIÓ CORREO» (B22) + «STATUS DE
  # LLAMADA» (B23) + «LUGAR DE APLICACIÓN» (B30, 2026-09-02) + «AULA UTILIZADA»
  # (2026-09-04: «una columna adicional que le diga al usuario cuál fue el
  # reemplazo que usamos, al lado de status muestra»). El numero se pinea
  # LITERAL a proposito: un campo nuevo en la spec debe pasar por aqui y
  # declararse, no colarse. Esta se colo el 2026-09-04 y el rojo se quedo
  # esperando hasta el 2026-09-07.
  expect_length(AULAS_AGENDADAS_BLOQUE, 24L)
  expect_identical(AULAS_AGENDADAS_ANCHO_BLOQUE, 24L)
  expect_false("wave" %in% campos)
  # «STATUS MUESTRA» no es «MUESTRA»: se compara el titulo entero.
  titulos <- unlist(lapply(AULAS_AGENDADAS_BLOQUE, function(s) s$titulos))
  expect_false("MUESTRA" %in% titulos)
})


test_that("B30: el lugar de aplicacion va y VUELVE — es campo propio del libro", {
  # «Se llena manual con el aula/pabellon confirmado finalmente… pero tiene
  # que NUTRIR a las demas pestañas/hojas y la app; el codigo siempre va a
  # tener este formato A206». Si no es campo propio, la fusion lo llenaria
  # solo en vacio y la correccion moriria en silencio (la trampa de B22).
  expect_true("scheduled_venue" %in% AULAS_LIBRO_CAMPOS_PROPIOS)
  titulos <- c("ID MATCH", vapply(AULAS_AGENDADAS_BLOQUE,
                                  function(sp) sp$titulos[[1]], character(1)))
  fila <- rep("", length(titulos))
  fila[[1]] <- "1"
  fila[[which(titulos == "CURSO-HORARIO")]] <- "CH 1"
  fila[[which(titulos == "LUGAR DE APLICACIÓN")]] <- "A206"
  df <- as.data.frame(rbind(fila), stringsAsFactors = FALSE)
  vuelta <- aulas_agendadas_a_plan(df, titulos)
  expect_identical(as.character(vuelta[[1]]$scheduled_venue), "A206")
})

test_that("el libro nuevo no trae MUESTRA en ninguna cabecera de agenda o campo", {
  hoja_ag <- aulas_libro_hoja_agendadas(.male_unidades())
  # Los bloques 2+ llevan su papel como sufijo (« R1»); se descarta igual que
  # hace el lector para comparar el titulo canonico.
  cabecera <- sub(" R[0-9]+$", "", as.character(unlist(hoja_ag[1, ], use.names = FALSE)))
  expect_false("MUESTRA" %in% cabecera)
  # El control de que no se borro de mas: el resto del bloque sigue entero.
  expect_true("CURSO-HORARIO" %in% cabecera)
  expect_true("STATUS MUESTRA" %in% cabecera)

  hoja_ap <- aulas_libro_hoja_aplicadas(.male_unidades())
  campos_ap <- as.character(unlist(hoja_ap[2, ], use.names = FALSE))
  expect_false("MUESTRA" %in% campos_ap)
  expect_true("STATUS MUESTRA" %in% campos_ap)
})

test_that("wave ya no es un campo del bloque: una hoja sin MUESTRA esta completa", {
  # Antes de retirarla, una hoja nueva sin la columna MUESTRA reportaba `wave`
  # como campo ausente — un aviso sobre una columna que ya no existe.
  titulos_sin_muestra <- vapply(
    Filter(function(s) !identical(s$campo, "wave"), AULAS_AGENDADAS_BLOQUE),
    function(s) s$titulos[[1]], character(1)
  )
  expect_identical(
    aulas_agendadas_campos_ausentes(c("ID MATCH", titulos_sin_muestra)),
    character(0)
  )
})

test_that("un libro viejo con MUESTRA importa sin error y sin contaminar la ola del plan", {
  # La cabecera de 2025: bloque de 20 CON «MUESTRA» y sin «MOMENTO DE LA
  # CLASE». El lector empareja por titulo, asi que la columna sobrante se
  # ignora sin aviso ni error.
  titulos_viejos <- c(
    "ID MATCH", "MUESTRA", "CURSO-HORARIO", "NOMBRE DE DOCENTE",
    "TELÉFONO DE DOCENTE", "CORREO PUCP DOCENTE", "NOMBRE DEL CURSO",
    "FACULTAD", "NIVEL DEL CURSO", "SESIONES Y AULA", "MATRICULADOS TOTAL DTI",
    "MATRICULADOS POBLACIÓN", "MEDIO DE CONTACTO", "FECHA DE LLAMADA",
    "NÚMERO DE INTENTOS", "STATUS MUESTRA", "FECHA DE APLICACIÓN", "DÍA",
    "HORA", "ENLACE DE LA FICHA", "OBSERVACIONES"
  )
  fila <- c("1", "Muestra 02", "CH 1", "Docente 1", "999", "d@x.test",
            "Curso 1", "ARTE", "3", "LUN 08:00 A101", "34", "30", "Llamada",
            "2026-08-20", "2", "AGENDADA", "2026-08-25", "Martes", "08:00",
            "https://x.test/f", "sin novedad")
  df <- as.data.frame(rbind(fila), stringsAsFactors = FALSE)

  vuelta <- aulas_agendadas_a_plan(df, titulos_viejos)
  expect_length(vuelta, 1L)
  expect_identical(vuelta[[1]]$operational_code, "CH 1")
  expect_identical(vuelta[[1]]$sample_status, "AGENDADA")

  # `wave` es del plan (viene de Calculo de muestra), no del libro: la fusion
  # ya no puede pisarlo con lo que diga la columna MUESTRA de un libro viejo.
  expect_false("wave" %in% AULAS_LIBRO_CAMPOS_PROPIOS)
  previo <- list(list(operational_code = "CH 1", classroom_id = "A-01",
                      wave = "M1", sample_role = "titular", eligible_n = 30))
  fusion <- aulas_libro_fusionar_plan(previo, vuelta)
  expect_identical(as.character(fusion$plan[[1]]$wave), "M1")
})

# --- 2. El generador declara, no mezcla -------------------------------------

test_that("una reserva sin codigo de cadena no produce fila fantasma: se declara", {
  unidades <- list(
    list(operational_code = "CH 1", titular_operational_code = "CH 1",
         sample_role = "titular", faculty = "ARTE", course_name = "C1",
         eligible_n = 30, enrolled_total = 34),
    # La reserva llega como la escribe el handoff de Recopiladores hoy: con
    # `replacement_for` en el vocabulario del classroom_id y SIN toc.
    list(operational_code = "R 1.1", sample_role = "chain_reserve",
         replacement_for = "mat101_0101", replacement_order = 1,
         faculty = "ARTE", course_name = "C1R", eligible_n = 26,
         enrolled_total = 29)
  )
  path <- withr::local_tempfile(fileext = ".xlsx")
  err <- tryCatch(aulas_libro_generar(unidades, path), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_LIBRO_SIN_CADENAS")
  expect_identical(err$status, 409)
  # El mensaje nombra la CAUSA y las dos salidas, no solo el hecho.
  expect_match(err$message, "cadena")
  expect_match(err$message, "[Cc][aá]lculo de muestra")
  expect_match(err$message, "Recopiladores")
})

test_that("UNA sola reserva sin toc dispara, aunque el resto del plan este sano", {
  # No es un porcentaje: una sola ya produce una fila fantasma en el Excel del
  # equipo, y el agregado esconde lo que muerde por celda.
  cadena <- function(n) list(
    list(operational_code = sprintf("CH %d", n),
         titular_operational_code = sprintf("CH %d", n),
         sample_role = "titular", faculty = "ARTE",
         course_name = sprintf("C%d", n), eligible_n = 30, enrolled_total = 34),
    list(operational_code = sprintf("R %d.1", n),
         titular_operational_code = sprintf("CH %d", n),
         sample_role = "chain_reserve", replacement_order = 1,
         faculty = "ARTE", course_name = sprintf("C%dR", n),
         eligible_n = 26, enrolled_total = 29)
  )
  unidades <- c(cadena(1), cadena(2), cadena(3), list(
    list(operational_code = "R 4.1", sample_role = "chain_reserve",
         replacement_order = 1, faculty = "ARTE", course_name = "C4R",
         eligible_n = 22, enrolled_total = 25)
  ))
  path <- withr::local_tempfile(fileext = ".xlsx")
  err <- tryCatch(aulas_libro_generar(unidades, path), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_LIBRO_SIN_CADENAS")
})

test_that("un extra activado con parte tambien necesita su codigo de cadena", {
  unidades <- list(
    list(operational_code = "CH 1", titular_operational_code = "CH 1",
         sample_role = "titular", faculty = "ARTE", course_name = "C1",
         eligible_n = 30, enrolled_total = 34),
    list(operational_code = "EXTRA 1", sample_role = "extra_reserve_pool",
         faculty = "ARTE", course_name = "CX1", eligible_n = 20,
         enrolled_total = 23)
  )
  partes <- list(list(operational_code = "EXTRA 1", observed_students = 10,
                      effective_surveys = 8))
  path <- withr::local_tempfile(fileext = ".xlsx")
  err <- tryCatch(aulas_libro_generar(unidades, path, partes = partes),
                  error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_LIBRO_SIN_CADENAS")
})

test_that("el banco sin usar sigue quedando fuera sin disparar la guarda", {
  # Un extra dormido no esta activado: se filtra, como siempre, y no exige toc.
  unidades <- list(
    list(operational_code = "CH 1", titular_operational_code = "CH 1",
         sample_role = "titular", faculty = "ARTE", course_name = "C1",
         eligible_n = 30, enrolled_total = 34),
    list(operational_code = "EXTRA 1", sample_role = "extra_reserve_pool",
         faculty = "ARTE", course_name = "CX1", eligible_n = 20)
  )
  path <- withr::local_tempfile(fileext = ".xlsx")
  escrito <- aulas_libro_generar(unidades, path)
  expect_identical(as.integer(attr(escrito, "unidades")), 1L)
})

test_that("los titulares sin toc son legales: su toc es su propio codigo", {
  # Conducta vigente de `.calg_titular`, pineada: con toc vacio el titular se
  # agrupa por su `operational_code`. Retirarla convertiria todo plan historico
  # en error.
  unidades <- list(
    list(operational_code = "CH 1", sample_role = "titular", faculty = "ARTE",
         course_name = "C1", eligible_n = 30, enrolled_total = 34),
    list(operational_code = "CH 2", sample_role = "titular", faculty = "ARTE",
         course_name = "C2", eligible_n = 28, enrolled_total = 31)
  )
  hoja <- aulas_libro_hoja_agendadas(unidades)
  expect_identical(nrow(hoja), 3L)
  expect_true("CH 1" %in% as.character(unlist(hoja[2, ], use.names = FALSE)))
  expect_true("CH 2" %in% as.character(unlist(hoja[3, ], use.names = FALSE)))
  path <- withr::local_tempfile(fileext = ".xlsx")
  expect_no_error(aulas_libro_generar(unidades, path))
})

# --- 3. El handoff escribe lo que el libro necesita -------------------------

# La seleccion sintetica calca la forma REAL de la de Calculo de muestra:
# codigos operativos canonicos, `titular_operational_code` en las cuatro filas,
# `replacement_for` de las reservas en el vocabulario del classroom_id del
# titular (medido: asi lo escriben sus dos escritores), los dos denominadores
# numericos y la cadena intercalada por `operational_sequence`.
.male_seleccion <- function() list(
  list(operational_code = "CH 1", classroom_id = "mat101_0101",
       titular_operational_code = "CH 1", sample_role = "titular",
       wave = "M1", selection_slot_id = "slot_001", operational_sequence = 1,
       faculty = "ARTE", course_name = "Curso 1", teacher = "Docente 1",
       eligible_n = 30, enrolled_total = 34),
  list(operational_code = "R 1.1", classroom_id = "mat101_0111",
       titular_operational_code = "CH 1", replacement_for = "mat101_0101",
       sample_role = "chain_reserve", wave = "M2", replacement_order = 1,
       operational_sequence = 1, faculty = "ARTE", course_name = "Curso 1",
       teacher = "Docente 1R", eligible_n = 26, enrolled_total = 29),
  list(operational_code = "CH 2", classroom_id = "let202_0202",
       titular_operational_code = "CH 2", sample_role = "titular",
       wave = "M1", selection_slot_id = "slot_002", operational_sequence = 2,
       faculty = "ARTE", course_name = "Curso 2", teacher = "Docente 2",
       eligible_n = 28, enrolled_total = 31),
  list(operational_code = "R 2.1", classroom_id = "let202_0222",
       titular_operational_code = "CH 2", replacement_for = "let202_0202",
       sample_role = "chain_reserve", wave = "M2", replacement_order = 1,
       operational_sequence = 2, faculty = "ARTE", course_name = "Curso 2",
       teacher = "Docente 2R", eligible_n = 24, enrolled_total = 27)
)

# Sesion con plan sembrado, deployment preparado y handoff entregado. El mismo
# recorrido offline que test-collection-costura-aulas.R.
.male_handoff <- function(sid) {
  session_set(sid, "project_name", "Estructura libro")
  session_set(sid, "calc_muestra_aulas_selection", list(selection = .male_seleccion()))
  seeded <- collection_state_seed(sid)
  adapter <- collection_adapter_get("kobo_existing_v1")
  target <- list(
    provider = "kobo",
    base_access_url = "https://ee.example.test/x/aB3xY9kQ",
    prefill_field = "collectorID",
    asset_type = "survey",
    deployment_active = TRUE,
    asset_uid = "aEstructura1"
  )
  preview <- adapter$preview_deployment(
    plan = seeded$plan, target = adapter$inspect_target(list(), target)
  )
  preview$capability_preflight <- NULL
  put <- collection_deployment_put(sid, preview, seeded$state_revision)
  prep <- collection_deployment_prepare(sid, put$state_revision)
  list(seeded = seeded, handoff = collection_handoff(sid, prep$state_revision))
}

.male_por_codigo <- function(rows) {
  stats::setNames(rows, vapply(
    rows, function(r) as.character(r[["operational_code"]] %||% ""), character(1)
  ))
}

test_that("la unit de collection carga hoy lo que carga: el mapeo queda pineado", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "calc_muestra_aulas_selection", list(selection = .male_seleccion()))
  seeded <- collection_state_seed(sid)

  units <- stats::setNames(seeded$plan$units, vapply(
    seeded$plan$units, function(u) as.character(u$dimensions$legacy_ref %||% ""),
    character(1)
  ))
  expect_length(units, 4L)
  # `eligible_n` viaja (alias eligible_n | matriculados_poblacion | students_n).
  expect_identical(units[["R 1.1"]]$dimensions$eligible_n, 26)
  # El codigo del titular viaja consumido en `replacement_for` —el candidato
  # `titular_operational_code` va primero— y con guarda de autorreferencia:
  # vacio para el titular, «CH n» para su reserva.
  expect_identical(units[["R 1.1"]]$dimensions$replacement_for, "CH 1")
  expect_identical(units[["R 2.1"]]$dimensions$replacement_for, "CH 2")
  expect_identical(units[["CH 1"]]$dimensions$replacement_for, "")
})

test_that("el handoff emite por fila el toc del titular y los dos denominadores", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .male_handoff(sid)
  rows <- .male_por_codigo(fx$handoff$monitoring_rows)
  expect_length(rows, 4L)

  toc <- function(code) as.character(rows[[code]][["titular_operational_code"]] %||% "")
  num <- function(code, campo) suppressWarnings(as.numeric(rows[[code]][[campo]] %||% NA))

  # Cada reserva trae el toc de SU titular — es lo que agrupa la cadena en el
  # libro; sin el, la fila se vuelve un grupo fantasma.
  expect_identical(toc("R 1.1"), "CH 1")
  expect_identical(toc("R 2.1"), "CH 2")
  # Y el titular, el suyo propio, como lo escribe Calculo de muestra.
  expect_identical(toc("CH 1"), "CH 1")
  expect_identical(toc("CH 2"), "CH 2")

  # Los dos denominadores llegan numericos y por fila: son los «30|28» que la
  # hoja imprime en MATRICULADOS TOTAL DTI y MATRICULADOS POBLACION.
  expect_identical(num("CH 1", "enrolled_total"), 34)
  expect_identical(num("CH 1", "eligible_n"), 30)
  expect_identical(num("R 1.1", "enrolled_total"), 29)
  expect_identical(num("R 1.1", "eligible_n"), 26)
  expect_identical(num("CH 2", "enrolled_total"), 31)
  expect_identical(num("CH 2", "eligible_n"), 28)
  expect_identical(num("R 2.1", "enrolled_total"), 27)
  expect_identical(num("R 2.1", "eligible_n"), 24)
})

test_that("el ciclo handoff -> normalize -> hoja de agendadas no mezcla cadenas", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  fx <- .male_handoff(sid)

  plan <- monitoreo_aulas_normalize_plan(fx$handoff$monitoring_rows)
  hoja <- aulas_libro_hoja_agendadas(plan)

  # EXACTAMENTE titulares + 1 (la cabecera): dos cadenas, dos filas. El rojo
  # de la siembra real era filas de mas —reservas huerfanas y titulares
  # agrupados bajo un «CH n» que no es el suyo—.
  expect_identical(nrow(hoja), 3L)

  fila_1 <- as.character(unlist(hoja[2, ], use.names = FALSE))
  fila_2 <- as.character(unlist(hoja[3, ], use.names = FALSE))
  # Cada fila es UNA cadena entera y nada de la otra.
  expect_true(all(c("CH 1", "R 1.1") %in% fila_1))
  expect_false(any(c("CH 2", "R 2.1") %in% fila_1))
  expect_true(all(c("CH 2", "R 2.1") %in% fila_2))
  expect_false(any(c("CH 1", "R 1.1") %in% fila_2))

  # Y los denominadores del titular llegan poblados, no en cero ni vacios: la
  # posicion se deriva de la spec para que el retiro de MUESTRA no la corra.
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  col_enr <- 1L + which(campos == "enrolled_total")
  col_eleg <- 1L + which(campos == "eligible_n")
  expect_identical(fila_1[[col_enr]], "34")
  expect_identical(fila_1[[col_eleg]], "30")
  expect_identical(fila_2[[col_enr]], "31")
  expect_identical(fila_2[[col_eleg]], "28")
})
