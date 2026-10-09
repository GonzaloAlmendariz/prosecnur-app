# B10 del checklist del operativo (docs/qa/checklist-operativo-aulas-2026-08-31.md):
# el telefono del docente muere en el ARMADOR del frame, y el libro salio sin
# telefonos el dia que el operativo llama a los docentes.
#
# Verificado sobre HSVG26ULT2: la base DTI «207915-Cursos-Horarios 2026-2.xlsx»
# (hoja Data) SI trae TELEFDOCENTE junto a DOCENTE (codigo), NOMBREDOCENTE y
# CORREOPUCPDOCENTE. Aguas abajo TODO esta listo —el normalizador del plan lee
# `teacher_phone` con alias (monitoreo_aulas_universitarias.R:477) y la hoja
# «Aulas Agendadas» tiene su columna TELEFONO DE DOCENTE desde la spec
# (carga_aulas_agendadas.R:30) con el generador escribiendo `u$teacher_phone`
# (carga_aulas_libro_generar.R:106)—, pero el dato nunca llega: es «una lista
# cerrada se traga lo que no reconoce», DOS veces en calc_muestra_aulas.R:
#
#   1. El armador solo declara los campos del docente `teacher` y
#      `teacher_email`: en el mapeo default (L250-251), en el enriquecido desde
#      el catalogo (L842-856), en la extraccion (L1204-1207) y en el aula_frame
#      (L1428-1429). TELEFDOCENTE no tiene rol, asi que el frame sale con 56
#      columnas y CERO telefono.
#   2. La seleccion subsetea por la lista cerrada `public_cols`
#      (calc_muestra_aulas.R:4529-4559, `intersect` en L4560): aunque el frame
#      llevara `teacher_phone`, la seleccion publica lo dejaria fuera.
#
# OJO para el writer: calc_muestra_aulas.R esta CONGELADO a crecimiento; ambos
# arreglos ahi exigen swap neto-cero (sumar el alias/columna en lineas que ya
# existen) o un hook en archivo nuevo.
#
# Los telefonos van como TEXTO y las comparaciones son por valor exacto: un
# `all(nzchar(NULL))` da TRUE y este archivo existe justo para no aprobar por
# ausencia.

# Base madre estilo DTI (MATRICULADO): una fila por alumno, sin datos del
# docente — como en HSVG26ULT2, el docente vive solo en el catalogo.
.tel_base <- function(n_aulas = 2L, por_aula = 5L) {
  cursos <- c("ACT131", "LIT105", "FIS201", "ART110", "MAT128", "HIS210", "QUI115", "ECO101")[seq_len(n_aulas)]
  horarios <- sprintf("%04d", 200L + seq_len(n_aulas))
  aula <- rep(seq_len(n_aulas), each = por_aula)
  data.frame(
    ALUMNO = sprintf("a%03d", seq_along(aula)),
    CLAVECURSO = cursos[aula],
    HORARIO = horarios[aula],
    NOMBREFAC = ifelse(aula %% 2L == 1L, "CIENCIAS", "LETRAS"),
    NOMBREESP = paste0("P", (aula %% 2L) + 1L),
    SEXO = rep(c("F", "M"), length.out = length(aula)),
    EDAD = 20,
    CONDICION = "REGULAR",
    NIVELCURR = "3",
    MODALIDAD = "presencial",
    stringsAsFactors = FALSE
  )
}

# Catalogo estilo Cursos-Horarios «Data»: cabeceras reales de la DTI 2026,
# incluida la trampa historica DOCENTE = CODIGO del profesor.
.tel_catalogo <- function(n_aulas = 2L, tel_col = "TELEFDOCENTE") {
  base <- .tel_base(n_aulas, 1L)
  out <- data.frame(
    CLAVECURSO = base$CLAVECURSO,
    HORARIO = base$HORARIO,
    SESIONES = paste("MAR 10:00-12:00 C", paste0("L", 200L + seq_len(n_aulas))),
    DOCENTE = sprintf("%08d", 8700L + seq_len(n_aulas)),
    NOMBREDOCENTE = paste0("DOCENTE ", LETTERS[seq_len(n_aulas)], ", TITULAR"),
    CORREOPUCPDOCENTE = sprintf("docente%d@pucp.edu.pe", seq_len(n_aulas)),
    TIPODOCENTE = "DOCENTE ORDINARIO - PRINCIPAL",
    stringsAsFactors = FALSE
  )
  out[[tel_col]] <- .tel_numeros(n_aulas)
  out
}

.tel_numeros <- function(n) sprintf("987000%02d", seq_len(n))

# El mapeo del proyecto real: los campos del docente apuntan a columnas que
# viven SOLO en el catalogo. `teacher_phone` NO se mapea a proposito: el
# contrato es que el armador lo resuelva solo, igual que resuelve
# CORREOPUCPDOCENTE sin que nadie lo mapee.
.tel_mapping <- function() {
  list(
    student_id = "ALUMNO", course_id = "CLAVECURSO", schedule = "HORARIO",
    faculty = "NOMBREFAC", program = "NOMBREESP", sex = "SEXO", age = "EDAD",
    condition = "CONDICION", level = "NIVELCURR", modality = "MODALIDAD",
    teacher = "NOMBREDOCENTE", teacher_email = "CORREOPUCPDOCENTE",
    teacher_type = "TIPODOCENTE"
  )
}

.tel_config <- function(...) {
  list(mapping = .tel_mapping(), filters = list(min_eligible_per_class = 1L), ...)
}

test_that("el frame trae el telefono del docente cuando el catalogo trae TELEFDOCENTE", {
  frame <- calc_muestra_aulas_construir(
    base_madre = .tel_base(2L),
    catalogo_curso_horario = .tel_catalogo(2L),
    config = .tel_config()
  )
  af <- frame$aula_frame
  expect_identical(nrow(af), 2L)
  # Anclas verdes: el mecanismo hermano (correo/nombre desde el catalogo) ya
  # funciona; si esto cae, el fixture se rompio, no el telefono.
  expect_identical(af$teacher[af$course_id == "ACT131"], "DOCENTE A, TITULAR")
  expect_identical(af$teacher_email[af$course_id == "ACT131"], "docente1@pucp.edu.pe")
  # El pin: TELEFDOCENTE viaja como teacher_phone, por aula y con su numero.
  expect_true("teacher_phone" %in% names(af))
  expect_identical(af$teacher_phone[af$course_id == "ACT131"], "98700001")
  expect_identical(af$teacher_phone[af$course_id == "LIT105"], "98700002")
})

test_that("una base de una sola hoja con la columna de telefono tambien lo publica", {
  # Camino sin catalogo: los datos del docente vienen inline en la base, con
  # los dos nombres reales de columna que el default debe reconocer (el
  # mecanismo de alias es el mismo de teacher_email en el mapeo default).
  for (alias in c("TELEFDOCENTE", "TELEFONO_DOCENTE")) {
    base <- .tel_base(2L)
    aula <- as.integer(factor(base$CLAVECURSO, levels = unique(base$CLAVECURSO)))
    base$NOMBREDOCENTE <- paste0("DOCENTE ", LETTERS[aula], ", TITULAR")
    base[[alias]] <- .tel_numeros(2L)[aula]
    frame <- calc_muestra_aulas_construir(base_madre = base, config = .tel_config())
    af <- frame$aula_frame
    expect_identical(nrow(af), 2L)
    # Ancla verde + guarda anti-captura: el telefono no debe desplazar a nadie.
    expect_identical(af$teacher[af$course_id == "ACT131"], "DOCENTE A, TITULAR")
    expect_true("teacher_phone" %in% names(af))
    expect_identical(
      af$teacher_phone[af$course_id == "ACT131"], "98700001",
      info = paste("alias de base:", alias)
    )
    expect_identical(
      af$teacher_phone[af$course_id == "LIT105"], "98700002",
      info = paste("alias de base:", alias)
    )
  }
})

test_that("CELULAR en el catalogo de curso-horario resuelve al telefono del docente", {
  # En el catalogo cada fila es un curso-horario x docente, asi que un CELULAR
  # ahi es del docente — el equivalente de «Correo PUCP»/«Correo docente» en el
  # lookup de teacher_email (calc_muestra_aulas.R:850). En la BASE de alumnos
  # ese nombre seria del estudiante y NO debe reclamarse; por eso el alias
  # generico se pina solo por esta via.
  frame <- calc_muestra_aulas_construir(
    base_madre = .tel_base(2L),
    catalogo_curso_horario = .tel_catalogo(2L, tel_col = "CELULAR"),
    config = .tel_config()
  )
  af <- frame$aula_frame
  expect_true("teacher_phone" %in% names(af))
  expect_identical(af$teacher_phone[af$course_id == "ACT131"], "98700001")
  expect_identical(af$teacher_phone[af$course_id == "LIT105"], "98700002")
})

test_that("la seleccion CONSERVA teacher_phone: la lista public_cols no puede tragarselo", {
  # Segundo eslabon, aislado del primero: aunque el frame ya traiga el
  # telefono (aqui se inyecta a mano), `public_cols` en
  # calc_muestra_aulas.R:4529-4560 es una lista cerrada con `intersect` y hoy
  # lo deja fuera de selection$selection.
  frame <- calc_muestra_aulas_construir(
    base_madre = .tel_base(8L, 4L),
    catalogo_curso_horario = .tel_catalogo(8L),
    config = .tel_config()
  )
  af <- frame$aula_frame
  telefonos <- .tel_numeros(8L)
  frame$aula_frame$teacher_phone <- telefonos[match(af$course_id, .tel_catalogo(8L)$CLAVECURSO)]
  expect_true(all(nzchar(frame$aula_frame$teacher_phone)))

  config <- .tel_config(selector = list(
    seed = 202L, n_aulas = 2L, replacement_waves = 1L,
    selector_engine = "sistematico_pps", strata_cols = list("faculty"),
    simulation_runs = 0L, monte_carlo_n = 0L
  ))
  selection <- calc_muestra_aulas_seleccionar(frame, config)
  sel <- selection$selection
  tel_sel <- sel[["teacher_phone"]]
  # Presencia con longitud, no truthiness: length(NULL) delataria la ausencia.
  expect_identical(length(tel_sel), nrow(sel))
  expect_true(all(as.character(tel_sel) %in% telefonos))
  titulares <- as.character(tel_sel)[sel$sample_role == "titular"]
  expect_identical(length(titulares), 2L)
  expect_true(all(nzchar(titulares)))
})

test_that("punta a punta: del catalogo con TELEFDOCENTE a la celda TELEFONO DE DOCENTE del libro", {
  # El recorrido que el operativo pago: construir -> seleccionar ->
  # monitoreo_aulas_from_calc -> plan -> hoja «Aulas Agendadas». Hoy muere en
  # el primer eslabon y el libro sale con la columna vacia.
  config <- .tel_config(selector = list(
    seed = 202L, n_aulas = 2L, replacement_waves = 1L,
    selector_engine = "sistematico_pps", strata_cols = list("faculty"),
    simulation_runs = 0L, monte_carlo_n = 0L
  ))
  frame <- calc_muestra_aulas_construir(
    base_madre = .tel_base(8L, 4L),
    catalogo_curso_horario = .tel_catalogo(8L),
    config = config
  )
  selection <- calc_muestra_aulas_seleccionar(frame, config)
  cfg_mon <- monitoreo_aulas_from_calc(NULL, selection, frame, list())
  plan <- cfg_mon$plan
  expect_true(length(plan) >= 2L)

  telefonos <- .tel_numeros(8L)
  tel_plan <- vapply(plan, function(u) as.character(u$teacher_phone %||% ""), character(1))
  roles <- vapply(plan, function(u) as.character(u$sample_role %||% ""), character(1))
  expect_true(all(nzchar(tel_plan[roles == "titular"])))
  expect_true(all(tel_plan[nzchar(tel_plan)] %in% telefonos))

  hoja <- aulas_libro_hoja_agendadas(plan)
  cabecera <- as.character(unlist(hoja[1, ], use.names = FALSE))
  col_tel <- match("TELÉFONO DE DOCENTE", cabecera)
  expect_false(is.na(col_tel))
  celdas <- as.character(unlist(hoja[-1, col_tel], use.names = FALSE))
  # Toda fila del libro tiene titular, y todo titular tiene telefono.
  expect_true(length(celdas) >= 2L)
  expect_true(all(nzchar(celdas)))
  expect_true(all(celdas %in% telefonos))
})

test_that("conservacion plan->hoja: un plan que YA trae telefono lo escribe (eslabon sano)", {
  # Este eslabon esta verde y se pina para que un fix del armador no lo rompa:
  # el generador escribe `u$teacher_phone` bajo la columna de la spec.
  unidad <- list(
    operational_code = "CH 1", sample_role = "titular", replacement_for = "",
    titular_operational_code = "CH 1", wave = "M1",
    teacher = "DOCENTE A, TITULAR", teacher_phone = "98700001",
    teacher_email = "docente1@pucp.edu.pe", course_name = "Curso A",
    faculty = "CIENCIAS", level = "3", label = "MAR 10:00-12:00 C L201",
    enrolled_total = 20, eligible_n = 18
  )
  hoja <- aulas_libro_hoja_agendadas(list(unidad))
  cabecera <- as.character(unlist(hoja[1, ], use.names = FALSE))
  col_tel <- match("TELÉFONO DE DOCENTE", cabecera)
  expect_false(is.na(col_tel))
  expect_identical(as.character(hoja[2, col_tel]), "98700001")
})

test_that("una base sin columna de telefono no falla y no inventa numeros", {
  # Tolerancia: el estudio de 2025 no traia telefono y su marco debe seguir
  # construyendose igual, con la columna ausente o vacia — jamas un error y
  # jamas un dato inventado.
  catalogo <- .tel_catalogo(2L)
  catalogo$TELEFDOCENTE <- NULL
  frame <- NULL
  expect_no_error({
    frame <- calc_muestra_aulas_construir(
      base_madre = .tel_base(2L),
      catalogo_curso_horario = catalogo,
      config = .tel_config()
    )
  })
  af <- frame$aula_frame
  expect_identical(nrow(af), 2L)
  if ("teacher_phone" %in% names(af)) {
    expect_true(all(!nzchar(af$teacher_phone)))
  }
})
