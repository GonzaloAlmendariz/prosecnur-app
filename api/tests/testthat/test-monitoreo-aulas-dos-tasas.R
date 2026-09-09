# Dos tasas de efectividad en paralelo: la del AULA y la de la FACULTAD.
#
# Mandato de Gonzalo (B3, 2026-08-31): «poder tener margenes de los esperados y
# no descartar algo o catalogarlo como algo simplemente porque la tasa de
# efectividad no es la esperada». Un aula fuera de margen se SEÑALA, no se
# descarta.
#
# La mitad FACULTAD ya existe (`monitoreo_aulas_efectividad_seguimiento.R`).
# Esto fija el grano AULA: `monitoreo_aulas_dos_tasas(plan)` recibe el plan
# normalizado (lista de filas) y devuelve `list(aulas, criterio)`. Por aula:
# la tasa prevista del diseño (`tasa_efectividad_aula`), la vara agregada de su
# facultad (`tasa_facultad`, lado a lado), la observada, y una BANDA de
# 2*sqrt(p*(1-p)/elegibles) con p = la prevista — el patron de tasaDeCaida.ts:
# la banda se arma sobre la p de REFERENCIA con el n del aula.
#
# Doctrina de la banda: dentro del margen NO se le pone nombre (direccion
# NULL); `bajo`/`sobre` solo fuera de banda. Y JAMAS un campo «valido» en la
# salida: la respuesta que cuenta es la EFECTIVA (pasa filtros), y la señal es
# eso, una señal, no un veredicto.
#
# El numerador es la efectiva de PLATAFORMA (`respuestas_validas` de la fila);
# el parte (`effective_surveys`) entra como respaldo, y el origen usado se
# declara en `numerador`.

# Una fila normalizada del plan, con solo lo que cada caso necesita.
#
# `estado` es el `operational_status` del plan (vocabulario de
# `monitoreo_aulas_estados()`). Solo se CONTRASTA el aula aplicada
# (aplicada/cerrada/parcial = MONITOREO_AULAS_ESTADOS_APLICADOS): la prevista
# del diseño es CONDICIONAL a que el aula se aplique
# (calc_muestra_aulas_efectividad.R), y la mitad facultad ya condiciona igual
# (`mide <- aplicada & elegibles > 0`).
.mdt_fila <- function(codigo, facultad = "Ciencias", elegibles = 40,
                      prevista = NULL, plataforma = NULL, parte = NULL,
                      tasa_facultad = NULL, rol = "titular", estado = NULL) {
  fila <- list(
    operational_code = codigo,
    faculty = facultad,
    sample_role = rol,
    eligible_n = elegibles
  )
  if (!is.null(prevista)) fila[["tasa_efectividad_aula"]] <- prevista
  if (!is.null(plataforma)) fila[["respuestas_validas"]] <- plataforma
  if (!is.null(parte)) fila[["effective_surveys"]] <- parte
  if (!is.null(tasa_facultad)) fila[["tasa_facultad"]] <- tasa_facultad
  if (!is.null(estado)) fila[["operational_status"]] <- estado
  fila
}

# La fila de salida de un aula, buscada por su codigo.
.mdt_aula <- function(res, codigo) {
  for (a in res[["aulas"]]) {
    if (is.list(a) && identical(a[["codigo"]], codigo)) return(a)
  }
  NULL
}

test_that("dentro del margen el aula es CONFORME y no se le pone nombre", {
  # AJUSTADO (B1/M1): la fila lleva estado aplicada porque solo el aula
  # aplicada se contrasta —la prevista es condicional a aplicarse—, y la z de
  # la banda es la de la casa (1.959964 = .maes_Z), no un 2 redondeado.
  # prevista 0.60, elegibles 40: banda = 1.959964*sqrt(0.6*0.4/40) = 0.1518.
  # 22 efectivas dan 0.55 observada: a 0.05 de la prevista, dentro de banda.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 22,
              estado = "aplicada")
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_true(is.list(aula))
  expect_identical(aula[["senal"]], "conforme")
  expect_equal(aula[["tasa_observada"]], 0.55, tolerance = 1e-3)
  expect_equal(aula[["banda"]], 1.959964 * sqrt(0.6 * 0.4 / 40), tolerance = 1e-6)
  # Doctrina de tasaDeCaida: dentro del margen no hay direccion ni veredicto.
  expect_null(aula[["direccion"]])
})

test_that("fuera de banda por debajo, la señal es «bajo» — señalar, no descartar", {
  # AJUSTADO (B1): estado aplicada, porque solo el aula aplicada se contrasta.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 10,
              estado = "aplicada")
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "bajo")
  expect_equal(aula[["tasa_observada"]], 0.25, tolerance = 1e-3)
})

test_that("fuera de banda por encima, la señal es «sobre»", {
  # AJUSTADO (B1): estado aplicada, porque solo el aula aplicada se contrasta.
  # Pasarse tambien se señala: 30 de 40 con prevista 0.30 es 0.75 observada.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.30, plataforma = 30,
              estado = "aplicada")
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "sobre")
})

test_that("con muy pocos elegibles no hay banda: la cifra se enseña, no se juzga", {
  # AJUSTADO (B1): `sin_banda` es un resultado del CONTRASTE, asi que tambien
  # exige estado aplicada.
  # Un aula de 3 elegibles no da para una banda binomial honesta. La señal lo
  # dice (`sin_banda`) y la observada VIAJA igual: enseñar sin juzgar.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 3, prevista = 0.60, plataforma = 2,
              estado = "aplicada")
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "sin_banda")
  expect_true(is.numeric(aula[["tasa_observada"]]))
})

test_that("sin tasa prevista del diseño la señal es «sin_previsto», no un juicio", {
  # AJUSTADO (B1): estado aplicada para aislar el hueco del DISEÑO del estado
  # operativo — sin el, la fila caeria en «pendiente» y este test mediria otra
  # cosa.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, plataforma = 22, estado = "aplicada")
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "sin_previsto")
})

test_that("sin plataforma ni parte no hay datos, y se declara «sin_datos»", {
  # AJUSTADO (B1): estado aplicada — un aula aplicada sin numerador es un hueco
  # de DATOS; sin estado seria «pendiente», que es otro hueco.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, estado = "aplicada")
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "sin_datos")
  # Sin efectivas no hay observada: NULL, no un cero que se lea como medicion.
  expect_null(aula[["tasa_observada"]])
})

test_that("el numerador se declara: plataforma manda y el parte respalda", {
  # AJUSTADO (B1): estado aplicada en las dos filas; el test aisla la eleccion
  # de numerador dentro del regimen contrastado.
  res <- monitoreo_aulas_dos_tasas(list(
    # Con las dos fuentes, gana la efectiva de PLATAFORMA (22, no 99).
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 22, parte = 99,
              estado = "aplicada"),
    # Sin plataforma, el parte entra como respaldo y se dice.
    .mdt_fila("CH 2", elegibles = 40, prevista = 0.60, plataforma = NULL, parte = 22,
              estado = "aplicada")
  ))
  a1 <- .mdt_aula(res, "CH 1")
  expect_identical(a1[["efectivas"]], 22)
  expect_identical(a1[["numerador"]], "plataforma")
  a2 <- .mdt_aula(res, "CH 2")
  expect_identical(a2[["efectivas"]], 22)
  expect_identical(a2[["numerador"]], "parte")
})

test_that("las DOS varas viajan lado a lado: la del aula y la de su facultad", {
  # Un aula bajo su propia meta tuvo un problema; una bajo la de su facultad
  # pero sobre la suya solo es mas grande que el promedio. Sin las dos tasas en
  # la misma fila los dos casos se ven iguales.
  # AJUSTADO (B1): estado aplicada, porque solo el aula aplicada se contrasta.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.55, plataforma = 22,
              tasa_facultad = 0.62, estado = "aplicada")
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_equal(aula[["tasa_prevista"]], 0.55, tolerance = 1e-6)
  expect_equal(aula[["tasa_facultad"]], 0.62, tolerance = 1e-6)
})

test_that("cero efectivas es un DATO: observada 0 y señal «bajo», no sin_datos", {
  # AJUSTADO (B1, punto 5 del contrato): el «cero es dato» queda CONDICIONADO
  # al estado aplicada. En el tablero real TODAS las filas llevan
  # respuestas_validas = 0 —tambien las que aun no entran a campo—, asi que el
  # cero solo es una medicion cuando el aula se APLICO; sin estado la fila es
  # «pendiente» (test de abajo), no un «bajo, 0%» catalogado por agenda.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 0,
              estado = "aplicada")
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_identical(aula[["senal"]], "bajo")
  expect_equal(aula[["tasa_observada"]], 0, tolerance = 1e-9)
})

test_that("la salida no trae ningun campo «valido»/«cumple»: señal, no veredicto", {
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 22),
    .mdt_fila("CH 2", elegibles = 40, prevista = 0.60, plataforma = 10)
  ))
  for (aula in res[["aulas"]]) {
    expect_false(any(grepl("valid|cumple", names(aula), ignore.case = TRUE)))
  }
})

test_that("entran los titulares y quien tenga señal de campo; una reserva dormida no", {
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 22),
    # Reserva sin ninguna señal de campo: no es una fila que medir todavia.
    .mdt_fila("CH 9", elegibles = 35, prevista = 0.60, rol = "chain_reserve"),
    # Reserva que YA rindio un parte: entro al operativo y se mide.
    .mdt_fila("CH 10", elegibles = 35, prevista = 0.60, parte = 15,
              rol = "chain_reserve")
  ))
  expect_true(is.list(.mdt_aula(res, "CH 1")))
  expect_null(.mdt_aula(res, "CH 9"))
  expect_true(is.list(.mdt_aula(res, "CH 10")))
})

test_that("el criterio se describe solo: numerador, banda y la vara agregada", {
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 22)
  ))
  crit <- res[["criterio"]]
  expect_true(is.list(crit))
  # El numerador declarado: efectiva de plataforma, con el parte de respaldo.
  expect_true(grepl("plataforma", crit[["numerador"]]))
  expect_true(grepl("parte", crit[["numerador"]]))
  # La banda: 2 EE sobre la PREVISTA con los elegibles del aula.
  expect_true(grepl("elegibles", crit[["banda"]]))
  # Y que la vara agregada es la de la fila (`tasa_facultad`), dicho ahi.
  texto <- paste(unlist(Filter(is.character, crit)), collapse = " ")
  expect_true(grepl("tasa_facultad", texto))
})

# ── B1: la prevista es CONDICIONAL a aplicarse; el estado condiciona la señal ──
#
# `efectivas_esperadas = elegibles x tasa del aula — CONDICIONAL a que el aula
# se aplique` (calc_muestra_aulas_efectividad.R). Contrastar un aula que aun no
# se aplico contra esa prevista la cataloga por AGENDA, no por rendimiento: en
# el tablero real toda fila lleva `respuestas_validas = 0` (no NA), asi que un
# titular «planificada» salia observada 0% y señal «bajo». La mitad facultad ya
# condiciona (`mide <- aplicada & elegibles > 0`, con
# MONITOREO_AULAS_ESTADOS_APLICADOS = aplicada/cerrada/parcial); esta mitad
# tiene que degradar igual.

test_that("un titular en estado PRE-aplicacion es «pendiente», no un «bajo, 0%»", {
  # Los cuatro estados previos del vocabulario de `monitoreo_aulas_estados()`.
  # La fila viaja con su prevista y sus elegibles —para que la vista enseñe que
  # se espera de ella—, con el estado literal en `estado_operativo`, y sin
  # bajo/sobre: todavia no hay rendimiento que juzgar.
  for (est in c("planificada", "contactada", "agendada", "en_campo")) {
    res <- monitoreo_aulas_dos_tasas(list(
      .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 0,
                estado = est)
    ))
    aula <- .mdt_aula(res, "CH 1")
    expect_true(is.list(aula), info = est)
    expect_identical(aula[["senal"]], "pendiente", info = est)
    expect_identical(aula[["estado_operativo"]], est, info = est)
    expect_equal(aula[["tasa_prevista"]], 0.60, tolerance = 1e-6, info = est)
    expect_equal(aula[["elegibles"]], 40, tolerance = 1e-9, info = est)
  }
  # Y el estado VACIO —un titular que aun no lleva gestion— degrada igual:
  # pendiente, no un contraste contra una prevista condicional.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 2", elegibles = 40, prevista = 0.60, plataforma = 0)
  ))
  expect_identical(.mdt_aula(res, "CH 2")[["senal"]], "pendiente")
})

test_that("un titular reemplazado o cancelado es «retirada», jamas «bajo» a perpetuidad", {
  # El titular reemplazado ya tiene su reserva rindiendo por el: dejarlo en
  # «bajo, 0%» duplica el asiento del hueco para siempre.
  for (est in c("reemplazada", "cancelada")) {
    res <- monitoreo_aulas_dos_tasas(list(
      .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 0,
                estado = est)
    ))
    aula <- .mdt_aula(res, "CH 1")
    expect_true(is.list(aula), info = est)
    expect_identical(aula[["senal"]], "retirada", info = est)
    expect_identical(aula[["estado_operativo"]], est, info = est)
  }
})

# ── B1b: la reserva ACTIVADA entra por su estado, no solo por sus numeros ─────

test_that("una reserva APLICADA con 0 efectivas y sin parte es VISIBLE y «bajo»", {
  # El caso mas alarmante del tablero: la reserva entro al operativo, se aplico
  # y no rindio nada. Con la entrada solo por parte/plataforma>0 esa fila era
  # INVISIBLE —desaparecia del grano aula mientras la τ̂ de facultad si la
  # contaba—. Aplicada y con 0 se contrasta: observada 0 y señal «bajo».
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 9", elegibles = 40, prevista = 0.60, plataforma = 0,
              rol = "chain_reserve", estado = "aplicada"),
    .mdt_fila("CH 20", elegibles = 40, prevista = 0.60, plataforma = 0,
              rol = "extra_reserve_pool", estado = "aplicada")
  ))
  reserva <- .mdt_aula(res, "CH 9")
  expect_true(is.list(reserva))
  expect_identical(reserva[["senal"]], "bajo")
  expect_equal(reserva[["tasa_observada"]], 0, tolerance = 1e-9)
  # El banco extra es el otro rol de respaldo y entra por la misma puerta.
  banco <- .mdt_aula(res, "CH 20")
  expect_true(is.list(banco))
  expect_identical(banco[["senal"]], "bajo")
})

test_that("una reserva con estado operativo ACTIVO entra aunque no rinda aun; la dormida no", {
  # Activa = un estado de gestion REAL (contactada en adelante). OJO: este
  # fixture va crudo; el camino real pasa por el normalizador, que escribe
  # «planificada» en toda fila sin estado — ese caso lo pinnea el test
  # post-normalizador de abajo, que es el que cazo la regresion del banco.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 9", elegibles = 35, prevista = 0.60, plataforma = 0,
              rol = "chain_reserve", estado = "contactada"),
    .mdt_fila("CH 11", elegibles = 35, prevista = 0.60, plataforma = 0,
              rol = "chain_reserve")
  ))
  activa <- .mdt_aula(res, "CH 9")
  expect_true(is.list(activa))
  expect_identical(activa[["senal"]], "pendiente")
  expect_null(.mdt_aula(res, "CH 11"))
})

test_that("tras el normalizador, el banco dormido sigue fuera: «planificada» por default no es gestion", {
  # El normalizador escribe «planificada» en TODA fila sin estado (default del
  # row-builder y de .monitoreo_aulas_status en monitoreo_aulas_universitarias),
  # asi que «estado no vacio» dejaba entrar el banco de reservas ENTERO como
  # «pendiente»: cientos de filas que nadie planea visitar, prometiendo agenda.
  # Este test pasa el fixture por monitoreo_aulas_normalize_plan() ANTES del
  # engine — el camino real del dashboard — que es el test que habria cazado
  # la regresion (un sin-hallazgos vale lo que el fixture).
  plan <- monitoreo_aulas_normalize_plan(list(
    list(operational_code = "CH 1", classroom_id = "CH 1", sample_role = "titular",
         faculty = "X", eligible_n = 40, tasa_efectividad_aula = 0.6),
    list(operational_code = "R 1.1", classroom_id = "R 1.1", sample_role = "chain_reserve",
         faculty = "X", eligible_n = 35, tasa_efectividad_aula = 0.6),
    list(operational_code = "R 1.2", classroom_id = "R 1.2", sample_role = "chain_reserve",
         faculty = "X", eligible_n = 35, tasa_efectividad_aula = 0.6,
         operational_status = "contactada")
  ))
  res <- monitoreo_aulas_dos_tasas(plan)
  # La dormida (default «planificada») queda fuera; la contactada entra como
  # pendiente; el TITULAR planificado si es pendiente: su agenda es real.
  expect_null(.mdt_aula(res, "R 1.1"))
  activa <- .mdt_aula(res, "R 1.2")
  expect_true(is.list(activa))
  expect_identical(activa[["senal"]], "pendiente")
  expect_identical(.mdt_aula(res, "CH 1")[["senal"]], "pendiente")
})

# ── M1: la banda es un PISO y la z es la de la casa ──────────────────────────

test_that("M1: la banda usa z = 1.959964 (.maes_Z) y el criterio la declara PISO", {
  # La banda binomial asume independencia intra-aula, que NO se cumple (deff
  # medido 2025: 1,29–1,55): la banda real es MAS ancha y esta es un piso. El
  # criterio lo tiene que decir, y la z se alinea con la mitad facultad
  # (1.959964, no un 2 redondeado): dos superficies vecinas, una sola z.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 22,
              estado = "aplicada")
  ))
  aula <- .mdt_aula(res, "CH 1")
  expect_equal(aula[["banda"]], 1.959964 * sqrt(0.6 * 0.4 / 40), tolerance = 1e-9)
  texto <- paste(unlist(Filter(is.character, res[["criterio"]])), collapse = " ")
  expect_true(grepl("piso|independencia|deff", texto, ignore.case = TRUE))
})

# ── N2: el descuadre tiene nombre propio y la prevista rota no grita en R ────

test_that("mas efectivas que elegibles en un aula aplicada es «descuadre», no «sobre»", {
  # «Sobre» dice que el campo rindio mas que lo previsto; 55 efectivas en 40
  # elegibles dice que ALGUN numero esta mal (atribucion, aforo o plataforma).
  # Son dos hallazgos distintos y el segundo no puede disfrazarse del primero.
  res <- monitoreo_aulas_dos_tasas(list(
    .mdt_fila("CH 1", elegibles = 40, prevista = 0.60, plataforma = 55,
              estado = "aplicada")
  ))
  expect_identical(.mdt_aula(res, "CH 1")[["senal"]], "descuadre")
})

test_that("una prevista fuera de [0,1] degrada a «sin_banda» en silencio", {
  # sqrt(p*(1-p)) con p fuera de rango es NaN CON warning de R: la señal ya
  # degradaba bien pero el warning se colaba al log del tablero. Degradar
  # declarando, sin ruido.
  expect_silent(
    res <- monitoreo_aulas_dos_tasas(list(
      .mdt_fila("CH 1", elegibles = 40, prevista = 1.2, plataforma = 22,
                estado = "aplicada"),
      .mdt_fila("CH 2", elegibles = 40, prevista = -0.1, plataforma = 22,
                estado = "aplicada")
    ))
  )
  expect_identical(.mdt_aula(res, "CH 1")[["senal"]], "sin_banda")
  expect_identical(.mdt_aula(res, "CH 2")[["senal"]], "sin_banda")
})

test_that("un curso-horario con efectivas se contrasta aunque el plan lo llame «planificada»", {
  # **El defecto que este test fija**, visto en pantalla el 2026-09-08 sobre
  # HSVG26ULT2 y señalado por Gonzalo.
  #
  # `operational_status` lo trae el plan y NADIE LO ACTUALIZA conforme avanza el
  # campo: las 174 filas M1 lo tenian en «planificada», el default del
  # row-builder. Con el balde colgando solo de ese campo, las 174 caian en
  # `pendiente` y el panel publicaba «Ningun curso-horario tiene todavia margen
  # que contrastar» en la MISMA pantalla en que la banda decia «26
  # cursos-horario aplicados». No era que faltara dato: era que se preguntaba al
  # campo equivocado.
  #
  # El resto del perfil deriva la aplicacion de la EVIDENCIA —`course_status`
  # marca «en_aplicacion» con respuestas > 0— y de ahi salen esos 26.
  plan <- list(
    list(operational_code = "CH 1", faculty = "Derecho", operational_status = "planificada",
         eligible_n = 30, tasa_efectividad_aula = 0.5, respuestas_validas = 15),
    list(operational_code = "CH 2", faculty = "Derecho", operational_status = "planificada",
         eligible_n = 30, tasa_efectividad_aula = 0.5, respuestas_validas = 0)
  )
  out <- monitoreo_aulas_dos_tasas(plan)
  por_codigo <- setNames(out$aulas, vapply(out$aulas, function(a) a$codigo, character(1)))

  # La que rindio se contrasta: su señal es un juicio, no un balde.
  expect_false(identical(por_codigo[["CH 1"]]$senal, "pendiente"))
  expect_equal(por_codigo[["CH 1"]]$efectivas, 15)
  expect_equal(por_codigo[["CH 1"]]$numerador, "plataforma")

  # La que no trae evidencia sigue pendiente: sin estado escrito no hay forma de
  # distinguir «aplicada y rindio cero» de «todavia no se visito», y eso se
  # declara en vez de inventarse.
  expect_identical(por_codigo[["CH 2"]]$senal, "pendiente")
  expect_null(por_codigo[["CH 2"]]$efectivas)
})
