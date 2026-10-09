# El criterio de nivel del curso vaciaba el marco ENTERO por dos caminos, y
# ninguno de los dos se nombraba a si mismo. Reproducido el 2026-08-25 sobre
# HSVG26DEF.pulso con las bases reales de PUCP 2026-2: 0 de 5.269 aulas.
#
# 1. `faculty_curso` (la facultad DEL CURSO, que vive en el catalogo) derivaba
#    sus candidatos de `mapping$faculty` (la facultad DEL ALUMNO, que vive en la
#    base). Con `faculty` en defaults el vector arrastraba el generico
#    "facultad" y por ahi resolvia la columna FACULTAD del catalogo — por
#    accidente. Al mapear `faculty` A MANO (ADR 0035, mapeo exclusivo) el
#    generico desaparecia y ninguna clave calzaba: la señal quedaba vacia.
# 2. Con la facultad vacia los pares (facultad, nivel) salian DEGRADADOS
#    ("<FLD>2" en vez de "CIENCIAS E INGENIERIA<FLD>2"). El par NO estaba vacio
#    —traia el nivel— asi que el fallback a par modal no se activaba, y el
#    evaluador, que busca la facultad del par en el mapa de rangos, no
#    encontraba ninguna y devolvia FALSE para TODAS las aulas.
#
# El tercer defecto es de contrato: una facultad SIN entrada en
# `courseLevelRanges` quedaba EXCLUIDA entera en vez de quedar SIN FILTRAR, que
# es lo que promete la UI («Sin rango, la facultad admite todos los niveles y no
# filtra») y lo unico compatible con su toggle «Aplica», que al apagarse BORRA
# la clave. Con rango en una sola facultad, las otras perdian todas sus aulas.

# Base madre: la facultad DEL ALUMNO vive en NOMBREFAC — un nombre propio que
# obliga al mapeo manual. 3 facultades x 2 aulas x 2 alumnos.
.cnv_base <- function() {
  do.call(rbind, lapply(1:12, function(i) data.frame(
    alumno = sprintf("E%02d", i),
    curso_horario = sprintf("CH%02d", ceiling(i / 2)),
    NOMBREFAC = c("CIENCIAS E INGENIERIA", "ARTES ESCENICAS",
                  "CIENCIAS SOCIALES")[[ceiling(i / 4)]],
    programa = "P1", sexo = "F", edad = 20, condicion = "regular",
    formacion = "PREGRADO", modalidad = "PRESENCIAL", tipo_sesion = "TEORICO",
    stringsAsFactors = FALSE, check.names = FALSE
  )))
}

# Catalogo curso-horario: la facultad DEL CURSO llega con el nombre generico
# FACULTAD (distinto del NOMBREFAC de la base) y el nivel en NIVEL. Aulas
# impares nivel 2, pares nivel 7.
.cnv_catalogo <- function() {
  do.call(rbind, lapply(1:6, function(k) data.frame(
    curso_horario = sprintf("CH%02d", k),
    FACULTAD = c("CIENCIAS E INGENIERIA", "ARTES ESCENICAS",
                 "CIENCIAS SOCIALES")[[ceiling(k / 2)]],
    NIVEL = if (k %% 2L == 1L) "2" else "7",
    stringsAsFactors = FALSE, check.names = FALSE
  )))
}

.cnv_config <- function(rangos) {
  list(
    mapping = list(
      student_id = "alumno", classroom_id = "curso_horario",
      faculty = "NOMBREFAC", program = "programa", sex = "sexo", age = "edad",
      condition = "condicion", formation = "formacion",
      modality = "modalidad", session_type = "tipo_sesion"
    ),
    filters = list(
      require_adult = FALSE, require_undergraduate = FALSE,
      require_in_person = FALSE, accepted_conditions = list(),
      exclude_session_patterns = list(), min_eligible_per_class = 1L
    ),
    criterios_seleccion = list(
      minEligible = list(threshold = 1),
      courseLevelRanges = rangos
    )
  )
}

.cnv_frame <- function(rangos) {
  calc_muestra_aulas_construir(
    base_madre = .cnv_base(),
    catalogo_curso_horario = .cnv_catalogo(),
    config = .cnv_config(rangos)
  )
}

test_that("faculty_curso resuelve el catalogo aunque faculty este mapeado a mano", {
  mapping <- prosecnurapp:::.cm_aulas_config_mapping(.cnv_config(list())$mapping)

  # Sanidad: el mapeo ES manual (el sentinel del rol desaparecio del vector).
  expect_true(prosecnurapp:::.cm_catalogo_rol_mapeado_a_mano(mapping, "faculty"))

  sig <- prosecnurapp:::.cm_aulas_catalog_aula_signals(.cnv_catalogo(), mapping)
  # La columna del catalogo se resuelve: el rol de la facultad DEL CURSO no
  # puede quedarse sin genericos porque el usuario mapeo la del ALUMNO.
  expect_identical(toupper(sig$columns$faculty_curso), "FACULTAD")

  # Y los pares salen COMPLETOS, no degradados a "<FLD>nivel".
  pares <- unname(sig$course_faculty_level_pairs)
  expect_length(pares, 6L)
  expect_false(any(startsWith(pares, prosecnurapp:::.cm_catalogo_pair_fld)))
  expect_true(all(grepl("CIENCIAS E INGENIERIA|ARTES ESCENICAS|CIENCIAS SOCIALES", pares)))
})

test_that("un par sin facultad cae al fallback en vez de matar el aula", {
  # Defensa en profundidad del punto 2: aunque la señal del catalogo llegue
  # degradada, el evaluador no puede devolver FALSE para todo. El par sin
  # facultad se repara con la facultad efectiva del aula.
  fld <- prosecnurapp:::.cm_catalogo_pair_fld
  aula_frame <- data.frame(
    classroom_id = c("CH01", "CH02"),
    faculty = c("CIENCIAS E INGENIERIA", "CIENCIAS E INGENIERIA"),
    eligible_n = c(2L, 2L), enrolled_total = c(20, 20),
    included = TRUE, exclude_reason = "",
    stringsAsFactors = FALSE, check.names = FALSE
  )
  señales <- list(
    course_faculty_level_pairs = stats::setNames(
      c(paste0("", fld, "2"), paste0("", fld, "7")),
      prosecnurapp:::.cm_aulas_text_key(c("CH01", "CH02"))
    )
  )
  vals <- prosecnurapp:::.cm_criterios_valores_aula(aula_frame, señales, c(2, 7))
  expect_false(any(startsWith(vals$course_pairs, fld)))

  flags <- prosecnurapp:::.cm_criterios_eval_course_ranges(
    vals$course_pairs,
    list(ciencias_e_ingenieria = list(list(min = 1, max = 4))),
    vals$faculty_aula
  )
  expect_identical(flags, c(TRUE, FALSE))
})

test_that("el criterio de nivel vuelve a morder en vez de vaciar el marco", {
  frame <- .cnv_frame(list(ciencias_e_ingenieria = list(list(min = 1, max = 4))))
  af <- frame$aula_frame
  inc <- function(id) af$included[af$classroom_id == id]

  # ESTE es el defecto reportado: con `faculty` mapeado a mano el marco entero
  # se iba a 0. La facultad declarada tiene que volver a decidir — nivel 2
  # dentro del rango entra, nivel 7 fuera cae — en vez de arrastrar a todos.
  expect_true(inc("CH01"))
  expect_false(inc("CH02"))
  expect_identical(af$exclude_reason[af$classroom_id == "CH02"], "course_level")
  expect_gt(frame$perfil$marco_aulas, 0L)
})

test_that("una facultad SIN entrada no declara tramo y por tanto no filtra", {
  # DECIDIDO con Gonzalo el 2026-08-25. Hasta esa fecha una facultad sin entrada
  # en `courseLevelRanges` quedaba EXCLUIDA entera, y el repo sostenia las DOS
  # lecturas a la vez: tres superficies de la UI prometian que no filtra
  # —«Sin rango, la facultad admite todos los niveles y no filtra»
  # (criterios/facultades.tsx), «sin esto, la facultad admite todos»
  # (FacultadDecisionBloque.tsx), «sin rango (no filtra)» (CriterioCard.tsx)— y
  # el toggle «Aplica», al apagarse, BORRA la clave, de modo que apagar el
  # criterio de una facultad la borraba del marco; mientras el backend codificaba
  # la lectura de whitelist en tres sitios (el golden A8/Consorcio de
  # test-calc-muestra-criterios.R, el oraculo .a_level_range de
  # validacion-combinaciones y el aviso de llegada.R).
  #
  # Gana la UI: el mapa solo gobierna lo que nombra. La discontinuidad lo
  # delataba —con CERO facultades declaradas pasaban todas, y bastaba declarar
  # UNA para que las demas desaparecieran—, y un criterio de NIVEL que borra
  # facultades enteras promete un numero y entrega otro: para dejar una facultad
  # fuera del estudio esta el criterio de FACULTAD.
  frame <- .cnv_frame(list(ciencias_e_ingenieria = list(list(min = 1, max = 4))))
  af <- frame$aula_frame
  inc <- function(id) af$included[af$classroom_id == id]
  expect_true(all(vapply(c("CH03", "CH04", "CH05", "CH06"), inc, logical(1))))
  expect_identical(frame$perfil$marco_aulas, 5L)
})

test_that("un par de facultad sin tramo NO acredita a un aula ajena", {
  # El criterio tiene que seguir mordiendo donde SI se declaro. Un curso-horario
  # le cuenta a varias facultades (1609/5262 aulas sirven a >=2), y Consorcio /
  # Posgrado / EE.GG. son justo las que nadie declara: si un solo par suyo
  # acreditara al aula entera, declarar un tramo en Ciencias no filtraria nada
  # en cuanto el aula tocara una facultad no declarada.
  #
  # Este es el caso que la primera version del fix se comio: el `return(TRUE)`
  # quedo DENTRO del bucle por par y dejaba la ausencia MAS permisiva que la
  # exencion explicita. Lo detecto el agente `verificador`.
  fld <- prosecnurapp:::.cm_catalogo_pair_fld
  rec <- prosecnurapp:::.cm_catalogo_pair_rec
  ev <- prosecnurapp:::.cm_criterios_eval_course_ranges
  rangos <- prosecnurapp:::.cm_criterios_normalize_nivel_por_unidad(
    list(ciencias = list(list(min = 1, max = 4))))

  solo_ciencias <- paste0("ciencias", fld, "9")
  mixto <- paste(c(solo_ciencias, paste0("consorcio", fld, "9")), collapse = rec)
  # Orden inverso: la decision no puede depender de cual par se lea primero.
  mixto_inv <- paste(c(paste0("consorcio", fld, "9"), solo_ciencias), collapse = rec)

  # El aula ES de ciencias, que declaro tramo [1,4]. Su curso esta en nivel 9.
  expect_false(ev(solo_ciencias, rangos, "ciencias"))
  expect_false(ev(mixto, rangos, "ciencias"))
  expect_false(ev(mixto_inv, rangos, "ciencias"))

  # Ni siquiera con el nivel del par ajeno ilegible.
  expect_false(ev(paste(c(solo_ciencias, paste0("consorcio", fld, "")), collapse = rec),
                  rangos, "ciencias"))

  # Y sigue pasando cuando ALGUN par propio si cae en rango.
  expect_true(ev(paste(c(paste0("ciencias", fld, "3"), paste0("consorcio", fld, "9")),
                       collapse = rec), rangos, "ciencias"))
})

test_that("exencion y ausencia coinciden en el evaluador, y llegada las separa", {
  # Tras la decision del 2026-08-25 «sin entrada = no filtra», declarar una
  # facultad exenta y no declararla producen el MISMO marco: las dos dicen que
  # esa facultad no tiene tramo. No es un descuido — es la decision.
  #
  # Lo que SI las separa es el aviso de llegada: el mapa RECONOCE a la exenta y
  # no reconoce a la ausente, asi que una facultad nueva que nadie declaro se
  # anuncia y una exenta declarada no. Ese es el valor que le queda al centinela.
  fld <- prosecnurapp:::.cm_catalogo_pair_fld
  ev <- prosecnurapp:::.cm_criterios_eval_course_ranges
  par <- paste0("ciencias", fld, "9")  # curso ajeno, fuera del tramo de ciencias

  # Normalizador REAL: el centinela de exencion tiene forma propia
  # (list(list(exenta = TRUE))) y hardcodearla aqui dejaria el test a merced de
  # un cambio interno. `"exenta"` es lo que escribe el analista.
  nz <- prosecnurapp:::.cm_criterios_normalize_nivel_por_unidad
  con_exenta <- nz(list(ciencias = list(list(min = 1, max = 4)), artes = "exenta"))
  sin_artes  <- nz(list(ciencias = list(list(min = 1, max = 4))))
  expect_true(prosecnurapp:::.cm_criterios_es_rango_exento(con_exenta$artes))

  # Aula DE artes con su curso catalogado en ciencias, nivel 9: pasa en ambos.
  # (Este es el caso que el test anterior NO probaba: sin el eje de la facultad
  # del aula, borrar la exencion no cambiaba nada y el bloque pasaba igual.)
  expect_true(ev(par, con_exenta, "artes"))
  expect_true(ev(par, sin_artes, "artes"))

  # Y el aula DE ciencias no se salva por ninguna de las dos vias.
  expect_false(ev(par, con_exenta, "ciencias"))
  expect_false(ev(par, sin_artes, "ciencias"))

  # Contraprueba de que el eje de la facultad del aula es el que decide: si el
  # aula fuera de ciencias con un curso de artes en rango, tampoco pasa.
  expect_false(ev(paste0("artes", fld, "9"), con_exenta, "ciencias"))
})

test_that("el criterio que vacia el marco lo dice en su propio paso", {
  # El cero no puede aflorar nueve pasos mas abajo sin que nadie lo nombre.
  frame <- .cnv_frame(list(
    ciencias_e_ingenieria = list(list(min = 20, max = 30)),
    artes_escenicas = list(list(min = 20, max = 30)),
    ciencias_sociales = list(list(min = 20, max = 30))
  ))
  expect_identical(frame$perfil$marco_aulas, 0L)

  embudo <- frame$perfil$embudo_aula
  fila <- embudo[embudo$id == "course_level", , drop = FALSE]
  expect_identical(nrow(fila), 1L)
  expect_identical(fila$conteo, 0L)
  expect_true(fila$vacia_marco)
  expect_match(fila$aviso, "dej", fixed = TRUE)
  expect_match(fila$aviso, "0", fixed = TRUE)

  # Los pasos POSTERIORES heredan el cero: no son ellos los que vacian y no
  # deben acusarse. Ese fue el sintoma que se vio en la app.
  posteriores <- embudo[seq_len(nrow(embudo)) > which(embudo$id == "course_level"), , drop = FALSE]
  if (nrow(posteriores)) expect_false(any(posteriores$vacia_marco))

  # Un marco sano no levanta el aviso.
  sano <- .cnv_frame(list(ciencias_e_ingenieria = list(list(min = 1, max = 4))))
  expect_false(any(sano$perfil$embudo_aula$vacia_marco))
})
