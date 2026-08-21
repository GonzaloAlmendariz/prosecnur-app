# El tercer cruce: lo que el equipo declaro contra lo que llego al servidor.

.cp_parte <- function(cod, efectivas) list(
  operational_code = cod, intento = 1L, effective_surveys = efectivas
)

test_that("un aula que declara mas de lo que llego sale como «faltan»", {
  # El caso grave y el que motivo el control: el equipo aplico 49 encuestas y
  # llegaron 3. No es un descuadre de aritmetica ni un desacuerdo entre
  # revisores: es un enlace mal puesto o envios sin sincronizar.
  h <- monitoreo_aulas_cruce_plataforma(
    list(.cp_parte("CH 48", 49)),
    c(`CH 48` = 3)
  )
  expect_length(h, 1L)
  expect_identical(h[[1]]$sentido, "faltan")
  expect_equal(h[[1]]$diferencia, 46)
})

test_that("un aula que recibio mas de lo que declara sale como «sobran»", {
  # El control del anterior: el signo NO es un detalle. Que llegue de mas es
  # otro problema —el enlace lo uso otra aula, o el parte se quedo corto— y un
  # solo rotulo para los dos escondería cual de los dos hay que ir a mirar.
  h <- monitoreo_aulas_cruce_plataforma(
    list(.cp_parte("CH 7", 12)),
    c(`CH 7` = 20)
  )
  expect_identical(h[[1]]$sentido, "sobran")
  expect_equal(h[[1]]$diferencia, -8)
})

test_that("un aula sin NINGUNA respuesta cuenta como faltante, no se salta", {
  # Es el caso mas grave de todos y el mas facil de perder: si el codigo no
  # aparece en el conteo, la tentacion es saltarlo por «sin dato».
  h <- monitoreo_aulas_cruce_plataforma(
    list(.cp_parte("R 16.1", 32)),
    c(`CH 1` = 10)
  )
  expect_length(h, 1L)
  expect_equal(h[[1]]$recibidas, 0)
  expect_equal(h[[1]]$diferencia, 32)
})

test_that("un parte sin efectivas declaradas NO produce hallazgo", {
  # Suponer cero inventaria un faltante en toda aula que aun no llena su parte.
  h <- monitoreo_aulas_cruce_plataforma(
    list(list(operational_code = "CH 2", observed_students = 30)),
    c(`CH 2` = 12)
  )
  expect_length(h, 0L)
})

test_that("lo que cuadra no sale, y la tolerancia se respeta", {
  exacto <- monitoreo_aulas_cruce_plataforma(list(.cp_parte("CH 3", 20)), c(`CH 3` = 20))
  expect_length(exacto, 0L)
  # Con tolerancia 0 —la de por defecto— una sola encuesta de diferencia SI es
  # un hallazgo: son cuentas de encuestas, no razones con redondeo.
  uno <- monitoreo_aulas_cruce_plataforma(list(.cp_parte("CH 3", 21)), c(`CH 3` = 20))
  expect_length(uno, 1L)
  con_tol <- monitoreo_aulas_cruce_plataforma(list(.cp_parte("CH 3", 21)), c(`CH 3` = 20),
                                              tolerancia = 1)
  expect_length(con_tol, 0L)
})

test_that("los hallazgos abren por la diferencia mas grande", {
  # CH 2 falta por 46 y CH 4 SOBRA por 40: con las tres diferencias positivas,
  # ordenar por el signo y por el valor absoluto daba lo mismo y el aserto no
  # distinguia nada.
  h <- monitoreo_aulas_cruce_plataforma(
    list(.cp_parte("CH 1", 12), .cp_parte("CH 2", 50), .cp_parte("CH 3", 15),
         .cp_parte("CH 4", 5)),
    c(`CH 1` = 10, `CH 2` = 4, `CH 3` = 8, `CH 4` = 45)
  )
  # Por VALOR ABSOLUTO: una que sobra por 40 es tan urgente como una que falta
  # por 40, y ordenar por el signo pondria todas las que sobran al final.
  expect_identical(vapply(h, function(x) x$operational_code, character(1)),
                   c("CH 2", "CH 4", "CH 3", "CH 1"))
})

test_that("el resumen dice cuantas cuadran SOBRE cuantas se compararon", {
  h <- monitoreo_aulas_cruce_plataforma(
    list(.cp_parte("CH 1", 49), .cp_parte("CH 2", 12), .cp_parte("CH 3", 20)),
    c(`CH 1` = 3, `CH 2` = 20, `CH 3` = 20)
  )
  r <- monitoreo_aulas_cruce_plataforma_resumen(h, comparables = 3)
  expect_equal(r$cuadran, 1L)
  expect_equal(r$comparables, 3L)
  expect_equal(r$faltan, 1L)
  expect_equal(r$sobran, 1L)
  # Las dos magnitudes por separado: sumarlas daria 38 y se compensarian entre
  # si, que es justo lo que esconde el problema.
  expect_equal(r$encuestas_sin_llegar, 46)
  expect_equal(r$encuestas_de_mas, 8)
  expect_identical(r$peor$operational_code, "CH 1")
})

# --- El enganche: el cruce llega al payload del tablero ---------------------

# El fixture imita al estudio real: el identificador que viaja en las respuestas
# NO es el codigo operativo. En el operativo de aulas, `collectorID` vale
# «aulch1_0220» y el codigo del plan es «CH 1». Con los dos iguales, indexar por
# uno o por otro da lo mismo y el test no distingue nada — sobrevivio un mutante
# asi antes de escribirlo de esta forma.
.cp_plan <- function() monitoreo_aulas_normalize_plan(list(
  list(operational_code = "CH 1", classroom_id = "aulch1_0220", label = "Aula 1",
       course_name = "Curso 1", faculty = "Derecho", sample_role = "titular",
       eligible_n = 30, expected_valid = 21, sample_status = "agendada")
))

# Cuatro respuestas llegaron y TRES son validas: sin una invalida, el total y
# las validas coinciden y comparar contra unas u otras da lo mismo — otro
# mutante sobrevivio por eso. La validez la declara el estudio con sus filtros,
# no la deduce el motor; por eso el fixture los declara.
.cp_respuestas <- function() data.frame(
  collectorID = rep("aulch1_0220", 4),
  sexo = c("Mujer", "Hombre", "Mujer", "Prefiero no decir"),
  stringsAsFactors = FALSE
)

.cp_cfg <- function(efectivas) list(
  enabled = TRUE, plan = .cp_plan(),
  source_mapping = list(valid_filters = list(list(var = "sexo",
                                                 values = c("Mujer", "Hombre")))),
  partes_campo = list(list(operational_code = "CH 1", intento = 1L,
                           observed_students = 25, effective_surveys = efectivas))
)

test_that("el tercer cruce llega al tablero, con su resumen", {
  # Una capacidad existe solo si alguien la consume: el motor sin enganche es
  # deuda, no una funcion.
  plan <- .cp_plan()
  respuestas <- .cp_respuestas()
  d <- monitoreo_aulas_dashboard(plan, respuestas, .cp_cfg(20))
  expect_length(d$platform_cross_check, 1L)
  h <- d$platform_cross_check[[1]]
  expect_identical(h$operational_code, "CH 1")
  # El equipo declaro 20 y llegaron 3.
  expect_equal(h$declaradas, 20)
  # CUATRO recibidas: el total, no las tres validas. El aplicador cuenta las
  # encuestas que consiguio; el criterio de validez es un filtro posterior.
  expect_equal(h$recibidas, 4)
  expect_identical(h$sentido, "faltan")
  expect_equal(d$platform_cross_check_summary$comparables, 1L)
  expect_equal(d$platform_cross_check_summary$cuadran, 0L)
})

test_that("cuando lo declarado y lo recibido cuadran, el tablero no inventa un hallazgo", {
  # El control del anterior: si el enganche emparejara por el codigo operativo
  # —que NO es el identificador que viaja en las respuestas— este caso saldria
  # como «faltan 4», porque no encontraria ninguna respuesta del aula.
  d <- monitoreo_aulas_dashboard(.cp_plan(), .cp_respuestas(), .cp_cfg(4))
  expect_length(d$platform_cross_check, 0L)
  expect_equal(d$platform_cross_check_summary$cuadran, 1L)
  expect_equal(d$platform_cross_check_summary$comparables, 1L)
})
