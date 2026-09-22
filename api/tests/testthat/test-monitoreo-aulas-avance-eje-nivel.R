# =============================================================================
# El tablero entero con el eje en NIVEL CURRICULAR
# =============================================================================
#
# Es la prueba de la fase 2 del eje declarable: `avance_cuota` dejó de leer
# `"faculty"` fijo y consume `monitoreo_aulas_eje_atribucion()`. Lo que aquí se
# comprueba es que un estudio cuyas metas son por nivel —CCSS Perfil 2026-II—
# mide de punta a punta, con las bolsas que el eje por persona añade y con el
# invariante cerrado.
#
# **El contrato del import NO cambia** (ADR 0079, «los tests son contra el
# contrato»): `design_targets$facultades`, `facultad` y `faculty_key` conservan
# sus nombres. Lo que cambia es su VALOR —el nivel— y lo que lo declara es el
# campo hermano `eje`.

.aen_plan <- function() list(
  # Dos aulas cuyo nivel MODAL es 7 y 8, con alumnos de varios niveles dentro:
  # es el caso real, y por eso el nivel no puede salir del aula.
  list(classroom_id = "a1", operational_code = "CH 1", label = "a1",
       faculty = "CIENCIAS SOCIALES", program = "ECONOMÍA", level = "7",
       sample_role = "titular", wave = "M1", orden = 1,
       eligible_n = 30, expected_valid = 12, sample_status = "agendada"),
  list(classroom_id = "a2", operational_code = "CH 2", label = "a2",
       faculty = "CIENCIAS SOCIALES", program = "SOCIOLOGÍA", level = "8",
       sample_role = "titular", wave = "M1", orden = 2,
       eligible_n = 30, expected_valid = 12, sample_status = "agendada")
)

.aen_dt <- function() list(
  schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
  tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 7,
  facultades = list(
    list(facultad = "7", faculty_key = monitoreo_aulas_eje_key("7"), cuota = 4, tau = 0.5),
    list(facultad = "8", faculty_key = monitoreo_aulas_eje_key("8"), cuota = 3, tau = 0.5)
  ),
  selection_run_id = "run_1", frame_hash = "hash_1"
)

.aen_cfg <- function() monitoreo_aulas_normalize_config(list(
  enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
  plan = .aen_plan(), design_targets = .aen_dt(),
  eje_cuota = "nivel",
  eje_cuota_motivo = "Las metas del estudio se prometieron por nivel curricular.",
  source_mapping = list(collector_var = "collectorID", sex_var = "sexo",
                        student_code_var = "codigo")
))

.aen_padron <- function() list(
  schema = "monitoreo_aulas_padron_v1", vigencia = "2026-09-07",
  filas = list(
    list(codigo = "20190001", nivel = 7L, carrera = "ECONOMÍA", sexo = "F"),
    list(codigo = "20190002", nivel = 7L, carrera = "ECONOMÍA", sexo = "M"),
    list(codigo = "20190003", nivel = 8L, carrera = "SOCIOLOGÍA", sexo = "F"),
    list(codigo = "20190004", nivel = 9L, carrera = "SOCIOLOGÍA", sexo = "M")
  )
)

# Seis respuestas. Las dos primeras son de niveles 7 y 7 en el aula a1; la
# tercera repite a la persona 0001 (duplicada); la cuarta es nivel 8 en a2; la
# quinta trae un código que no está en el padrón (sin eje); la sexta es de un
# aula que no está en el plan (huérfana).
.aen_resp <- function() data.frame(
  collectorID = c("a1", "a1", "a1", "a2", "a2", "ZZ"),
  codigo = c("20190001", "20190002", "20190001", "20190003", "20199999", "20190004"),
  sexo = c("Femenino", "Masculino", "Femenino", "Femenino", "Masculino", "Masculino"),
  stringsAsFactors = FALSE
)

.aen_avance <- function() {
  cfg <- .aen_cfg()
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())
  d$avance_cuota
}

test_that("las celdas se llenan por NIVEL, no por el nivel modal del aula", {
  av <- .aen_avance()
  por <- stats::setNames(
    vapply(av$facultades, function(f) as.integer(f$respuestas_validas), integer(1)),
    vapply(av$facultades, function(f) as.character(f$facultad), character(1)))
  # Nivel 7: las dos personas distintas del aula a1 (la repetida no cuenta).
  expect_identical(unname(por[["7"]]), 1L + 1L)
  # Nivel 8: la persona 0003, que estaba en a2 — cuyo nivel modal es 8 y aquí
  # coincide; lo que se comprueba es que el valor sale del PADRÓN.
  expect_identical(unname(por[["8"]]), 1L)
  # Y la cuota de cada celda es la del diseño, leída del contrato congelado.
  cuotas <- stats::setNames(
    vapply(av$facultades, function(f) as.numeric(f$cuota), numeric(1)),
    vapply(av$facultades, function(f) as.character(f$facultad), character(1)))
  expect_identical(unname(cuotas[["7"]]), 4)
  expect_identical(unname(cuotas[["8"]]), 3)
})

test_that("las tres bolsas se publican, y el invariante cierra", {
  av <- .aen_avance()
  t <- av$total
  # 6 válidas = 3 en celdas + 1 duplicada + 1 sin eje + 0 fuera de universo +
  # 1 huérfana.
  expect_identical(t$duplicadas, 1L)
  expect_identical(t$sin_eje, 1L)
  expect_identical(t$huerfanas, 1L)
  expect_identical(t$fuera_universo, 0L)
  expect_true(t$invariante$ok)
  expect_identical(t$invariante$suma, 6L)
  expect_identical(t$invariante$solapadas, 0L)
  expect_identical(t$invariante$partes$en_celdas, 3L)
})

test_that("la declaracion del eje viaja en el bloque, con su motivo", {
  cfg <- .aen_cfg()
  # La declaración va EN el bloque que publica las celdas: quien publica una
  # cifra dice de qué es. (En el import también viaja, colgada de `metas`.)
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())
  eje <- d$avance_cuota$eje
  expect_identical(eje$clave, "nivel")
  expect_identical(eje$columna, "level")
  expect_identical(eje$atribucion, "persona")
  expect_identical(eje$fuente_valor, "padron")
  expect_match(eje$motivo, "nivel curricular")
})

test_that("SIN padron ninguna respuesta acredita, y no es un cero medido", {
  # La regla del estudio: sin cruce no hay nivel. Lo que NO puede pasar es que
  # eso se lea como «no llegó nadie»: las válidas siguen contadas, en la bolsa.
  cfg <- .aen_cfg()
  av <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = NULL)$avance_cuota
  en_celdas <- sum(vapply(av$facultades, function(f) as.integer(f$respuestas_validas), integer(1)))
  expect_identical(en_celdas, 0L)
  expect_identical(av$total$sin_eje, 5L)
  expect_identical(av$total$huerfanas, 1L)
  expect_true(av$total$invariante$ok)
})

test_that("el eje NIVEL no toca el eje FACULTAD: identidad byte a byte", {
  # La prueba que protege lo que está en campo. El mismo estudio sin declarar
  # eje tiene que dar exactamente lo que daba antes de que el eje existiera, y
  # las dos bolsas nuevas salen en CERO — declaradas, no ausentes.
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    plan = .aen_plan(),
    design_targets = local({
      dt <- .aen_dt()
      dt$facultades <- list(list(facultad = "CIENCIAS SOCIALES",
                                 faculty_key = monitoreo_aulas_eje_key("CIENCIAS SOCIALES"),
                                 cuota = 7, tau = 0.5))
      dt
    }),
    source_mapping = list(collector_var = "collectorID", sex_var = "sexo")
  ))
  av <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg)$avance_cuota
  expect_identical(as.character(av$facultades[[1]]$facultad), "CIENCIAS SOCIALES")
  # Las cinco respuestas con aula del plan cuentan TODAS: con eje facultad no se
  # deduplica, que es el supuesto del ADR 0079 y no se cambia por debajo.
  expect_identical(as.integer(av$facultades[[1]]$respuestas_validas), 5L)
  expect_identical(av$total$duplicadas, 0L)
  expect_identical(av$total$sin_eje, 0L)
  expect_identical(av$total$huerfanas, 1L)
  expect_true(av$total$invariante$ok)
})

test_that("con eje por PERSONA el plan no genera filas que nunca se llenan", {
  # **Salió armando el simulacro, no de un test.** El diseño declara los niveles
  # de la cuota y el plan trae además aulas cuyo nivel MODAL es otro —en CCSS,
  # 5 y 10—. Con eje por persona el valor lo pone el padrón, así que en esas
  # filas no puede caer nunca una respuesta: la tabla salía con SEIS filas y no
  # cuatro, dos con cuota `NA` y cero para siempre. Dos filas vacías que no se
  # llenan se leen como un hueco del operativo.
  cfg <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    eje_cuota = "nivel",
    plan = c(.aen_plan(), list(
      # El aula de nivel modal 10: existe en el plan y no es del universo del eje.
      list(classroom_id = "a3", operational_code = "CH 3", label = "a3",
           faculty = "CIENCIAS SOCIALES", level = "10", sample_role = "titular",
           wave = "M1", orden = 3, eligible_n = 30, expected_valid = 12,
           sample_status = "agendada"))),
    design_targets = .aen_dt(),
    source_mapping = list(collector_var = "collectorID", sex_var = "sexo",
                          student_code_var = "codigo")))
  av <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())$avance_cuota
  claves <- vapply(av$facultades, function(f) as.character(f$facultad), character(1))
  expect_setequal(claves, c("7", "8"))
  expect_false("10" %in% claves)

  # Y con eje por AULA el plan SÍ las genera, que es lo que HSVG publica hoy:
  # ahí la columna del plan es la población del eje.
  cfg2 <- monitoreo_aulas_normalize_config(list(
    enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
    plan = list(
      list(classroom_id = "a1", operational_code = "CH 1", label = "a1",
           faculty = "DERECHO", sample_role = "titular", wave = "M1", orden = 1,
           eligible_n = 30, expected_valid = 12, sample_status = "agendada"),
      list(classroom_id = "a2", operational_code = "CH 2", label = "a2",
           faculty = "PSICOLOGIA", sample_role = "titular", wave = "M1", orden = 2,
           eligible_n = 30, expected_valid = 12, sample_status = "agendada")),
    design_targets = list(
      schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
      tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 10,
      facultades = list(list(facultad = "DERECHO",
                             faculty_key = monitoreo_aulas_eje_key("DERECHO"),
                             cuota = 10, tau = 0.5)),
      selection_run_id = "run_1", frame_hash = "hash_1"),
    source_mapping = list(collector_var = "collectorID")))
  av2 <- monitoreo_aulas_dashboard(cfg2$plan, data.frame(collectorID = "a2"), cfg2)$avance_cuota
  claves2 <- vapply(av2$facultades, function(f) as.character(f$facultad), character(1))
  expect_true("PSICOLOGIA" %in% claves2)
  psico <- Filter(function(f) identical(as.character(f$facultad), "PSICOLOGIA"), av2$facultades)[[1]]
  expect_identical(psico$fuente_fila, "sin_cuota")
})

test_that("con eje por persona NO se mezcla el fallback por facultad", {
  # **El defecto más visible que encontró el simulacro**, y no lo vio ningún
  # test: la pantalla publicaba «faltan 1.168» sobre una muestra de 400.
  #
  # Las celdas de sexo salían de dos vocabularios a la vez: las del DISEÑO
  # —niveles 6 a 9, sumando 400— más dos del fallback por facultad, que proyecta
  # el cruce facultad × sexo del marco («CIENCIAS SOCIALES» F 404 y M 364). La
  # misma carencia contada dos veces, en dos idiomas.
  #
  # El fallback existe para cubrir a las facultades que el diseño no trazó, y con
  # el eje en facultad sigue haciendo su trabajo. Con `atribucion = "persona"` no
  # hay fallback que ofrecer: si el diseño no trae la cuota por sexo del eje, esa
  # celda no existe, y decirlo es mejor que rellenarla con la cuenta de otra cosa.
  cfg <- .aen_cfg()
  # El cruce facultad × sexo del marco, tal como lo copia `from_calc`: es el
  # insumo del fallback, y con eje nivel no puede aparecer en las celdas.
  cfg$quotas <- list(sex_by_faculty = data.frame(
    primary_role = c("faculty", "faculty"), primary_raw = c("CIENCIAS SOCIALES", "CIENCIAS SOCIALES"),
    secondary_role = c("sex", "sex"), secondary_raw = c("F", "M"),
    count = c(421L, 379L), stringsAsFactors = FALSE))
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())

  celdas <- d$quotas_sex_faculty %||% list()
  fuentes <- unique(vapply(celdas, function(c1) as.character(c1$source %||% ""), character(1)))
  expect_false("calc_muestra_faculty_sex" %in% fuentes)
  # Ninguna celda habla de la facultad: todas son del eje.
  valores <- unique(vapply(celdas, function(c1) as.character(c1$faculty %||% ""), character(1)))
  expect_false("CIENCIAS SOCIALES" %in% valores)
  expect_true(all(valores %in% c("7", "8")))

  # Y la cifra que se veía mal: la brecha total no puede pasar de la cuota.
  expect_lte(as.numeric(d$avance_cuota$total$brecha), as.numeric(d$avance_cuota$total$cuota))
})

test_that("la meta es por NIVEL y no por nivel y sexo", {
  # Gonzalo, 2026-09-17: «recuerda que la meta no es por sexo y nivel sino sólo
  # nivel». Decisión 2 del plan: la cuota es por el eje y es DURA; sexo y carrera
  # son referenciales.
  #
  # **Yo lo había hecho mal en el simulacro**, no el motor: le puse `cuota_sexo`
  # mitad y mitad dentro de cada nivel «para que el tablero tuviera celdas que
  # enseñar», y eso es convertir en cuota dura algo que el estudio declaró
  # descriptivo. Esta prueba existe para que no vuelva a pasar por comodidad.
  #
  # El diseño de CCSS declara `cuota` por nivel y NO declara `cuota_sexo`; el
  # motor ya hacía lo correcto con eso, y aquí queda fijado.
  cfg <- .aen_cfg()   # su `design_targets` no trae `cuota_sexo`
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())

  # Ni una celda de sexo: no hay cuota que medir por sexo.
  expect_identical(length(d$quotas_sex_faculty %||% list()), 0L)

  # Y la brecha de cada nivel es su NETO —cuota menos conseguidas—, no la suma de
  # unas celdas de sexo que nadie prometió.
  por <- stats::setNames(
    lapply(d$avance_cuota$facultades, identity),
    vapply(d$avance_cuota$facultades, function(f) as.character(f$facultad), character(1)))
  siete <- por[["7"]]
  expect_identical(as.numeric(siete$brecha),
                   as.numeric(siete$cuota) - as.numeric(siete$respuestas_validas))

  # El sexo NO desaparece: se describe. Es la diferencia entre «no se mide» y
  # «no se exige».
  expect_true("sexo" %in% names(d$avance_cuota$composicion$dimensiones))
})

test_that("un estudio que SI declara cuota por sexo la sigue midiendo", {
  # La contracara, que protege a HSVG: el ADR 0079 sigue vigente para el eje
  # facultad, donde la cuota es facultad Y sexo y no se compensa entre celdas.
  # Lo que cambia no es la regla: es que ahora se aplica sólo donde el diseño la
  # declara.
  cfg <- .aen_cfg()
  cfg$design_targets$facultades <- lapply(cfg$design_targets$facultades, function(f) {
    f$cuota_sexo <- list(F = floor(f$cuota / 2), M = f$cuota - floor(f$cuota / 2))
    f
  })
  cfg <- monitoreo_aulas_normalize_config(cfg)
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())
  expect_gt(length(d$quotas_sex_faculty %||% list()), 0L)
  # Y todas las celdas hablan del eje, no de la facultad (el fallback sigue apagado).
  valores <- unique(vapply(d$quotas_sex_faculty, function(c1) as.character(c1$faculty %||% ""), character(1)))
  expect_false("CIENCIAS SOCIALES" %in% valores)
})

test_that("sin cuotas de sexo, el panel de las tres lecturas proyecta el EJE", {
  # **El hueco que destapó mirar la pestaña**, y el más importante de los cuatro:
  # `avance_cuota` traía las cuatro filas del eje con su cuota —120 · 121 · 95 ·
  # 64— y el panel «Qué grupos no llegan, y con qué remedio» publicaba su vacío
  # («el estudio no declara cuotas de facultad y sexo»), así que la pestaña se
  # quedaba **sin la cifra que el estudio prometió**.
  #
  # La salida no es un panel nuevo —el perfil ya tiene 19 pestañas— sino el mismo
  # panel con un grano menos fino: una celda por valor del eje.
  cfg <- .aen_cfg()
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())
  # La cuota por sexo sigue vacía: la meta es sólo por nivel y eso no cambia.
  expect_identical(length(d$quotas_sex_faculty %||% list()), 0L)
  # Pero el proyector recibe las celdas del eje y el panel tiene qué pintar.
  celdas <- d$avance_sexo_facultad %||% list()
  expect_gt(length(celdas), 0L)
  valores <- vapply(celdas, function(c1) as.character(c1$faculty), character(1))
  expect_setequal(valores, c("7", "8"))
  # **`grano` declara que esa celda no tiene dimensión de sexo**, que es distinto
  # de no conocerla: sin él la UI rotulaba «Sin sexo declarado» donde no hay sexo
  # que declarar.
  expect_true(all(vapply(celdas, function(c1) identical(c1$grano, "eje"), logical(1))))
  expect_true(all(vapply(celdas, function(c1) identical(c1$sex, ""), logical(1))))
  # Y la cuota de cada celda es la de su fila, no otra cuenta: nada se recalcula,
  # y por eso el panel no puede discrepar de la tabla.
  porFila <- stats::setNames(
    vapply(d$avance_cuota$facultades, function(f) as.numeric(f$cuota), numeric(1)),
    vapply(d$avance_cuota$facultades, function(f) as.character(f$facultad), character(1)))
  for (c1 in celdas) {
    expect_identical(as.numeric(c1$cuota), unname(porFila[[as.character(c1$faculty)]]))
  }
})

test_that("una fila SIN cuota no se proyecta: no hay meta contra la que medir", {
  # Darle un techo a una fila `sin_cuota` sería inventarle una meta.
  celdas <- prosecnurapp:::.monitoreo_aulas_celdas_del_eje(list(facultades = list(
    list(facultad = "7", cuota = 121, respuestas_validas = 10),
    list(facultad = "10", cuota = NA_real_, respuestas_validas = 3),
    list(facultad = "5", cuota = 0, respuestas_validas = 0),
    list(facultad = "", cuota = 50, respuestas_validas = 0)
  )))
  expect_identical(length(celdas), 1L)
  expect_identical(celdas[[1]]$faculty, "7")
  expect_identical(as.numeric(celdas[[1]]$observed), 10)
})

test_that("con cuotas de sexo declaradas el proyector sigue recibiendo ESAS", {
  # La contracara que protege a HSVG: donde el diseño declara la cuota por sexo,
  # el panel sigue proyectando el grano fino y `grano` va vacío.
  cfg <- .aen_cfg()
  cfg$design_targets$facultades <- lapply(cfg$design_targets$facultades, function(f) {
    f$cuota_sexo <- list(F = floor(f$cuota / 2), M = f$cuota - floor(f$cuota / 2))
    f
  })
  cfg <- monitoreo_aulas_normalize_config(cfg)
  d <- monitoreo_aulas_dashboard(cfg$plan, .aen_resp(), cfg, padron = .aen_padron())
  celdas <- d$avance_sexo_facultad %||% list()
  expect_gt(length(celdas), 0L)
  expect_true(all(vapply(celdas, function(c1) identical(c1$grano, ""), logical(1))))
  # **Por la CLAVE, no por el texto.** `c1$sex` es la ETIQUETA con la que la
  # celda se muestra —`.maac_sexo_etiqueta()` la produce como palabra: aquí sale
  # «FEMENINO»— y compararla con «F» es el defecto que costó `22dc6ea2`. La clave
  # se resuelve con el normalizador que existe para eso.
  expect_true(all(vapply(
    celdas, function(c1) prosecnurapp:::.maac_sexo_key(c1$sex) %in% c("F", "M"),
    logical(1))))
})

# =============================================================================
# El nivel que el diseño no traza
# =============================================================================
#
# El defecto que esto fija, medido el 2026-09-22 sobre el primer día de campo de
# CCSS Perfil 2026-II: nueve respuestas de CH 45, siete personas de nivel 6 y
# dos de nivel 5. El estudio traza celdas de 6 a 9, así que las dos de nivel 5
# resolvían su eje —`cuenta = TRUE`— y ninguna celda las leía. No estaban en
# `sin_eje` (habían resuelto), ni en `fuera_universo` (el aula existía), ni en
# `huerfanas` (casaron con el plan). El bloque publicaba `respuestas_validas =
# 7`, `en_celdas = 9` y `ok = TRUE`: dos de las nueve del día, invisibles, con
# el invariante certificando que la cuenta cuadraba.
#
# No es un borde: el eje se movió a la persona PORQUE un aula de nivel 6 tiene
# alumnos de 5, 6 y 7. Pasa cada jornada.

.aen_nivel_fuera <- function() {
  cfg <- .aen_cfg()
  padron <- .aen_padron()
  padron$filas[[length(padron$filas) + 1L]] <- list(
    codigo = "20190005", nivel = 5L, carrera = "ECONOMÍA", sexo = "F")
  resp <- rbind(.aen_resp(), data.frame(
    collectorID = "a1", codigo = "20190005", sexo = "Femenino",
    stringsAsFactors = FALSE))
  monitoreo_aulas_dashboard(cfg$plan, resp, cfg, padron = padron)$avance_cuota
}

test_that("un nivel que el diseno no traza tiene su fila, con su conteo", {
  av <- .aen_nivel_fuera()
  etiquetas <- vapply(av$facultades, function(f) as.character(f$facultad), character(1))
  expect_true("5" %in% etiquetas)
  fila <- av$facultades[[match("5", etiquetas)]]
  expect_identical(as.integer(fila$respuestas_validas), 1L)
  expect_identical(fila$estado, "fuera_del_diseno")
  # Sin cuota que el diseño no le dio: ni denominador inventado ni porcentaje.
  expect_true(is.na(fila$cuota))
  expect_true(is.na(fila$avance_pct))
})

test_that("esa respuesta no entra al % global pero SI al invariante, por su bolsa", {
  av <- .aen_nivel_fuera()
  t <- av$total
  # El numerador de la cuota sigue siendo el de las celdas del diseño: 2 de
  # nivel 7 más 1 de nivel 8. La de nivel 5 no lo mueve.
  expect_identical(as.integer(t$respuestas_validas), 3L)
  # Y se declara, con su nombre propio: no es `sin_eje` —resolvió— ni huérfana.
  expect_identical(t$sin_celda, 1L)
  # 7 válidas = 3 en celdas + 1 sin celda + 1 duplicada + 1 sin eje + 0 fuera +
  # 1 huérfana. El invariante compara contra lo PUBLICADO, que es lo que el
  # lector puede sumar con el dedo.
  expect_true(t$invariante$ok)
  expect_identical(t$invariante$suma, 7L)
  expect_identical(t$invariante$solapadas, 0L)
  expect_identical(t$invariante$partes$en_celdas, 3L)
  expect_identical(t$invariante$partes$sin_celda, 1L)
})

test_that("sin niveles fuera del diseno la bolsa es un cero declarado", {
  # El cero se publica: su ausencia obligaría a adivinar si la bolsa no existe
  # o está vacía. Y es lo que protege a HSVG, cuyo eje es la facultad.
  t <- .aen_avance()$total
  expect_identical(t$sin_celda, 0L)
  expect_identical(t$invariante$partes$sin_celda, 0L)
  expect_identical(t$invariante$partes$en_celdas, 3L)
})
