# =============================================================================
# «Avance por facultad» cuando la celda de la cuota NO es una facultad
# =============================================================================
#
# El bug, publicado el 2026-09-22 con campo corriendo (CCSS Perfil 2026-II):
# `.calaf_avance_por_facultad()` agrupa el plan por `u$faculty` y casa esa clave
# contra `design_targets$facultades`. Con el eje declarable (ADR 0086) esas
# filas son los cuatro NIVELES —`faculty_key` "6"/"7"/"8"/"9"— mientras las 136
# unidades del plan traen todas `faculty = "CIENCIAS SOCIALES"`, así que
# `clave == k` no es TRUE nunca. El bloque salió al Sheets del operativo con
# Efectivas 0, Avance 0,0 %, Aulas aplicadas 0 y Aulas planificadas
# originalmente 0 en las cuatro filas, encima de un bloque general que decía 50
# aulas planificadas y al lado de «Rendimiento por facultad» con 72 efectivas.
#
# Las dos mitades del arreglo, y las dos se prueban aquí:
#
#   · **las cifras salen del bloque que ya cruzó por persona**
#     (`.monitoreo_aulas_avance_cuota()`), no de un segundo cruce. Atribuir por
#     el nivel del AULA daría un número plausible y falso: un aula de nivel modal
#     6 tiene alumnos de 5, 6 y 7 (ADR 0086/0088);
#   · **las cuatro columnas de aulas van a raya, no a cero** (decisión de
#     Gonzalo, 2026-09-22). Un aula no pertenece a un nivel; el cero de hoy
#     miente y se lee como un operativo que no arrancó.
#
# Y la parte que más importa: **un estudio con el eje en el AULA no cambia un
# byte**, reciba el bloque o no. Eso se comprueba comparando las dos salidas,
# no leyendo el código.

.alep_plan <- function() list(
  # El nivel de la fila es el MODAL del aula, que es lo que el marco calculó
  # para dimensionar. Ninguna cifra de esta tabla puede salir de ahí.
  list(classroom_id = "a1", operational_code = "CH 1", label = "a1",
       faculty = "CIENCIAS SOCIALES", program = "ECONOMÍA", level = "7",
       sample_role = "titular", wave = "M1", orden = 1,
       eligible_n = 30, expected_valid = 12, sample_status = "agendada",
       scheduled_date = "2026-09-21"),
  list(classroom_id = "a2", operational_code = "CH 2", label = "a2",
       faculty = "CIENCIAS SOCIALES", program = "SOCIOLOGÍA", level = "8",
       sample_role = "titular", wave = "M1", orden = 2,
       eligible_n = 30, expected_valid = 12, sample_status = "agendada",
       scheduled_date = "2026-09-22")
)

# Tres celdas de NIVEL. La de nivel 9 no recibe ninguna respuesta: su cero es un
# cero MEDIDO y tiene que seguir siendo cero, no una raya. Las dos noticias son
# distintas y esta tabla las tiene que poder dar las dos.
.alep_dt <- function() list(
  schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
  tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 9,
  facultades = list(
    list(facultad = "7", faculty_key = monitoreo_aulas_eje_key("7"), cuota = 4, tau = 0.5),
    list(facultad = "8", faculty_key = monitoreo_aulas_eje_key("8"), cuota = 3, tau = 0.5),
    list(facultad = "9", faculty_key = monitoreo_aulas_eje_key("9"), cuota = 2, tau = 0.5)
  ),
  selection_run_id = "run_1", frame_hash = "hash_1"
)

.alep_cfg <- function() monitoreo_aulas_normalize_config(list(
  enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
  plan = .alep_plan(), design_targets = .alep_dt(),
  eje_cuota = "nivel",
  eje_cuota_motivo = "Las metas del estudio se prometieron por nivel curricular.",
  source_mapping = list(collector_var = "collectorID", sex_var = "sexo",
                        student_code_var = "codigo")
))

.alep_padron <- function() list(
  schema = "monitoreo_aulas_padron_v1", vigencia = "2026-09-07",
  filas = list(
    list(codigo = "20190001", nivel = 7L, carrera = "ECONOMÍA", sexo = "F"),
    list(codigo = "20190002", nivel = 7L, carrera = "ECONOMÍA", sexo = "M"),
    list(codigo = "20190003", nivel = 8L, carrera = "SOCIOLOGÍA", sexo = "F")
  )
)

# Tres respuestas, todas en aulas del plan: dos personas de nivel 7 en un aula
# de nivel modal 7 y una de nivel 8 en un aula de nivel modal 8.
.alep_resp <- function() data.frame(
  collectorID = c("a1", "a1", "a2"),
  codigo = c("20190001", "20190002", "20190003"),
  sexo = c("Femenino", "Masculino", "Femenino"),
  stringsAsFactors = FALSE
)

.alep_bloque <- function() {
  cfg <- .alep_cfg()
  monitoreo_aulas_avance_cuota_del_plan(cfg$plan, .alep_resp(), cfg,
                                        padron = .alep_padron())
}

.alep_tabla <- function(con_bloque = TRUE) {
  cfg <- .alep_cfg()
  resp <- .alep_resp()
  .calaf_avance_por_facultad(
    cfg$plan,
    efectivas = monitoreo_aulas_efectivas_por_aula(cfg$plan, resp, cfg),
    cuotas = cfg$design_targets, responses = resp,
    validas = rep(TRUE, nrow(resp)), cfg = cfg,
    avance_cuota = if (con_bloque) .alep_bloque() else NULL
  )
}

.alep_fila <- function(tabla, nivel) tabla[as.character(tabla$Facultad) == nivel, , drop = FALSE]

# --- 1. El rojo de hoy --------------------------------------------------------

test_that("sin el bloque, las celdas de nivel salen en CERO: es el bug publicado", {
  # Esta prueba documenta el defecto y fija el comportamiento heredado: sin
  # `avance_cuota` la tabla es exactamente la de antes, y por eso ningún estudio
  # con el eje en la facultad puede verse afectado por el arreglo.
  t <- .alep_tabla(con_bloque = FALSE)
  expect_identical(nrow(t), 3L)
  expect_true(all(as.numeric(t$Efectivas) == 0))
  # Y el cero que más engaña: aulas planificadas cero con dos aulas en el plan.
  expect_true(all(as.numeric(t$`Aulas planificadas originalmente`) == 0))
})

# --- 2. El verde: las cifras salen del bloque --------------------------------

test_that("con el bloque, cada celda del eje trae SUS efectivas", {
  t <- .alep_tabla()
  expect_identical(nrow(t), 3L)
  # Nivel 7: las dos personas del padrón que respondieron. Nivel 8: una.
  expect_identical(as.numeric(.alep_fila(t, "7")$Efectivas), 2)
  expect_identical(as.numeric(.alep_fila(t, "8")$Efectivas), 1)
  # Nivel 9 no recibió ninguna: su cero está MEDIDO y sigue siendo cero.
  expect_identical(as.numeric(.alep_fila(t, "9")$Efectivas), 0)
  # La misma cifra que publica el tablero para esa celda: no hay dos cuentas.
  bloque <- stats::setNames(
    vapply(.alep_bloque()$facultades, function(f) as.numeric(f$respuestas_validas), numeric(1)),
    vapply(.alep_bloque()$facultades, function(f) as.character(f$facultad), character(1)))
  for (nivel in c("7", "8", "9")) {
    expect_identical(as.numeric(.alep_fila(t, nivel)$Efectivas), unname(bloque[[nivel]]))
  }
})

test_that("la muestra, el avance y los faltantes son los de la celda", {
  t <- .alep_tabla()
  f7 <- .alep_fila(t, "7")
  expect_identical(as.numeric(f7$Muestra), 4)
  expect_equal(as.numeric(f7$`Avance muestra`), 0.5)
  expect_identical(as.numeric(f7$`Faltantes muestra`), 2)
  f9 <- .alep_fila(t, "9")
  expect_identical(as.numeric(f9$`Faltantes muestra`), 2)
  # Y el pie de la tabla suma lo mismo que sus filas.
  total <- .calaf_fila_total(t)
  expect_identical(as.numeric(total$Efectivas), 3)
  expect_identical(as.numeric(total$Muestra), 9)
})

# --- 3. Raya y no cero en las cuatro columnas de aulas ------------------------

test_that("las cuatro columnas de aulas NO SE PINTAN, ni a cero ni a raya", {
  # Gonzalo lo dictó en dos pasos el mismo día. Primero: a raya en vez de a
  # cero, porque el cero se leía como un operativo que no arrancó. Y al ver la
  # hoja publicada: «todavía hay campos vacíos» — una raya PERMANENTE es la
  # regla del slop aplicada a la geometría. Un aula no pertenece a un nivel, así
  # que la columna no existe.
  t <- .alep_tabla()
  for (col in c("Aulas aplicadas", "Aulas planificadas originalmente",
                "Aulas proyectadas al cierre", "Aulas sobre el plan")) {
    expect_false(col %in% names(t), info = col)
  }
  # Y la fila «Total» resume lo que hay, no la constante.
  expect_identical(names(.calaf_fila_total(t)), names(t))
})

test_that("las columnas son las que la declaración implica, en el orden del vocabulario", {
  # `.calaf_exigir_cabecera()` ya rompería dentro de la función; esto lo fija
  # desde fuera para que no se pueda «arreglar» el bug quitando columnas a mano.
  #
  # CCSS no declara sobremuestra (`meta_diseno`/`meta_operativa` vacías), ni
  # cuota por sexo (sus celdas traen `facultad`, `faculty_key`, `cuota`, `tau`),
  # ni un eje que pertenezca al aula: se queda con el corte que Gonzalo pidió
  # —efectivas, muestra, avance y faltantes— y nada más.
  t <- .alep_tabla()
  expect_identical(names(t), c("Facultad", "Efectivas", "Avance muestra",
                               "Muestra", "Faltantes muestra"))
  # Que es exactamente lo que la declaración del estudio implica, derivado por
  # la misma función que lo decide en producción.
  decl <- prosecnurapp:::.calacd_declaracion(
    .alep_cfg()$design_targets, por_aula = FALSE, con_sexo_observado = FALSE)
  expect_identical(names(t),
                   prosecnurapp:::aulas_avance_columnas_declaradas("facultad", decl))
  # Y siguen siendo rótulos del vocabulario, en su orden: lo que cambia es
  # cuántos, nunca cuáles ni en qué orden.
  expect_true(all(names(t) %in% AULAS_AVANCE_CABECERAS$facultad))
  expect_false(is.unsorted(match(names(t), AULAS_AVANCE_CABECERAS$facultad),
                           strictly = TRUE))
})

test_that("la raya no trae explicación colgada: la tabla no publica ninguna nota", {
  # Gonzalo, 2026-09-22: «algunas tablas se explican solas, no hace falta que
  # les pongas notas». Una raya en una tabla cuyo eje es el nivel se lee sola.
  cfg <- .alep_cfg()
  resp <- .alep_resp()
  ind <- aulas_libro_indicadores(
    cfg$plan,
    efectivas = monitoreo_aulas_efectivas_por_aula(cfg$plan, resp, cfg),
    responses = resp, validas = rep(TRUE, nrow(resp)),
    cuotas = cfg$design_targets, cfg = cfg, avance_cuota = .alep_bloque())
  filas <- aulas_libro_hoja_avance(ind, fecha = as.Date("2026-09-22"),
                                   eje = monitoreo_aulas_eje(cfg))
  primera <- vapply(filas, function(f) as.character(f[[1]] %||% ""), character(1))
  # El título nombra el EJE, no «facultad»: sus filas son niveles.
  expect_identical(prosecnurapp:::aulas_avance_titulos_eje("facultad", monitoreo_aulas_eje(cfg)),
                   "Avance por nivel")
  i <- which(primera == "Avance por nivel")
  expect_length(i, 1L)
  expect_false(any(primera == AULAS_AVANCE_TITULOS[["facultad"]]))
  # Y «Rendimiento por facultad» NO se renombra: sus filas salen de `u$faculty`,
  # que con el eje por persona sigue siendo la facultad de verdad.
  expect_true(any(primera == AULAS_AVANCE_TITULOS[["rendimiento"]]))
  # Justo debajo del título va la CABECERA de la tabla, no una nota —y con la
  # palabra del eje, que es lo que el satélite de cabeceras sustituye.
  expect_identical(primera[[i + 1L]], "Nivel")
  # Y en toda la hoja no aparece ninguna frase sobre por qué las aulas callan.
  expect_false(any(grepl("aula no pertenece", primera, fixed = TRUE)))
  expect_false(any(grepl("columnas de aulas", primera, fixed = TRUE)))
})

test_that("sin reparto por sexo en la celda, las columnas de sexo CALLAN", {
  # El bloque no publica sexo por celda —sexo y carrera son referenciales y
  # viajan para todo el estudio—, así que aquí no hay cero que dar: cero y «no
  # lo sabemos» son dos noticias distintas.
  t <- .alep_tabla()
  expect_true(all(is.na(suppressWarnings(as.numeric(t$`Efectivas hombres`)))))
  expect_true(all(is.na(suppressWarnings(as.numeric(t$`Efectivas mujeres`)))))
})

# --- 4. Lo que NO puede cambiar: el eje en el AULA ----------------------------

.alep_plan_fac <- function() list(
  list(classroom_id = "b1", operational_code = "CH 1", label = "b1",
       faculty = "ARQUITECTURA", sample_role = "titular", wave = "M1", orden = 1,
       eligible_n = 30, expected_valid = 10, sample_status = "agendada",
       scheduled_date = "2026-09-21"),
  list(classroom_id = "b2", operational_code = "CH 2", label = "b2",
       faculty = "EDUCACIÓN", sample_role = "titular", wave = "M1", orden = 2,
       eligible_n = 30, expected_valid = 10, sample_status = "agendada",
       scheduled_date = "2026-09-22")
)

.alep_cfg_fac <- function() monitoreo_aulas_normalize_config(list(
  enabled = TRUE, selection_run_id = "run_1", frame_hash = "hash_1",
  plan = .alep_plan_fac(),
  design_targets = list(
    schema = "monitoreo_aulas_design_targets_v1", source = "calc-muestra",
    tasa_esperada = 0.5, tasa_fuente = "tau_disenio", total_cuota = 20,
    facultades = list(
      list(facultad = "ARQUITECTURA", faculty_key = .cm_criterios_fac_key("ARQUITECTURA"),
           cuota = 10, cuota_sexo = list(F = 6, M = 4), tau = 0.5),
      list(facultad = "EDUCACIÓN", faculty_key = .cm_criterios_fac_key("EDUCACIÓN"),
           cuota = 10, cuota_sexo = list(F = 5, M = 5), tau = 0.5)
    ),
    selection_run_id = "run_1", frame_hash = "hash_1"
  ),
  source_mapping = list(collector_var = "collectorID", sex_var = "sexo")
))

.alep_resp_fac <- function() data.frame(
  collectorID = c("b1", "b1", "b2"),
  sexo = c("Femenino", "Masculino", "Femenino"),
  stringsAsFactors = FALSE
)

.alep_tabla_fac <- function(avance_cuota) {
  cfg <- .alep_cfg_fac()
  resp <- .alep_resp_fac()
  .calaf_avance_por_facultad(
    cfg$plan,
    efectivas = monitoreo_aulas_efectivas_por_aula(cfg$plan, resp, cfg),
    cuotas = cfg$design_targets, responses = resp,
    validas = rep(TRUE, nrow(resp)), cfg = cfg,
    avance_cuota = avance_cuota
  )
}

test_that("con el eje en el AULA, el bloque ni se computa", {
  cfg <- .alep_cfg_fac()
  expect_null(monitoreo_aulas_avance_cuota_del_plan(
    cfg$plan, .alep_resp_fac(), cfg, padron = .alep_padron()))
})

test_that("con el eje en el AULA la tabla es IDÉNTICA, le pasen el bloque o no", {
  # La vara de aceptación de todo este cambio: HSVG2026 y cualquier estudio con
  # cuota por facultad no puede notar nada. Se compara la tabla ENTERA, no unas
  # columnas elegidas a mano.
  sin <- .alep_tabla_fac(NULL)
  # Un bloque de otro estudio, con su eje declarado en el aula: aun así no se
  # consume, porque la condición es la atribución y no la presencia.
  cfg <- .alep_cfg_fac()
  con <- .alep_tabla_fac(list(
    fuente = "design_targets",
    eje = monitoreo_aulas_eje_declaracion(monitoreo_aulas_eje(cfg)),
    facultades = list(list(faculty_key = .cm_criterios_fac_key("ARQUITECTURA"),
                           respuestas_validas = 999, brecha = 0))
  ))
  expect_identical(con, sin)
  # Y las cifras siguen siendo las de siempre: dos aulas del plan, dos
  # aplicadas, y el reparto por sexo vivo.
  arq <- sin[as.character(sin$Facultad) == "ARQUITECTURA", , drop = FALSE]
  expect_identical(as.numeric(arq$Efectivas), 2)
  expect_identical(as.numeric(arq$`Aulas planificadas originalmente`), 1)
  expect_identical(as.numeric(arq$`Efectivas mujeres`), 1)
})

# --- 5. Por el camino real: `aulas_libro_indicadores()` -----------------------

test_that("las cinco tablas del libro heredan el arreglo por su parámetro", {
  cfg <- .alep_cfg()
  resp <- .alep_resp()
  ind <- aulas_libro_indicadores(
    cfg$plan,
    efectivas = monitoreo_aulas_efectivas_por_aula(cfg$plan, resp, cfg),
    responses = resp, validas = rep(TRUE, nrow(resp)),
    cuotas = cfg$design_targets, cfg = cfg,
    avance_cuota = .alep_bloque()
  )
  expect_identical(as.numeric(.alep_fila(ind$facultades, "7")$Efectivas), 2)
  expect_true(all(is.na(suppressWarnings(as.numeric(ind$facultades$`Aulas aplicadas`)))))
  # **Y el bloque general del libro NO se queda sin sus aulas**: ese conteo es
  # del estudio entero y se cuenta sobre el plan, no derivando la tabla por
  # celda. Dos aulas titulares, y las dos siguen ahí.
  expect_identical(as.numeric(ind$meta$aulas), 2)
  general <- ind$general
  planificadas <- general[as.character(general[[1]]) == "Aulas planificadas originalmente", 2][[1]]
  expect_identical(as.numeric(planificadas), 2)
})
