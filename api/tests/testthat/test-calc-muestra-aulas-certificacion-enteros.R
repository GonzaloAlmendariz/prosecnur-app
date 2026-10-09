# Los elegibles y las efectivas son PERSONAS: el aviso que lee un humano no
# puede decir «Faltan 2,6». Y la direccion del redondeo no es la misma en los
# dos numeros del mismo aviso:
#
#   · lo que PROMETEMOS (las efectivas esperadas) se redondea hacia ABAJO —
#     prometer de mas es lo contrario de dimensionar con prudencia;
#   · lo que PEDIMOS (las que faltan) se redondea hacia ARRIBA — si faltan 2,6
#     encuestas, faltan 3 personas, y con 2 la celda sigue corta.
#
# El valor interno sigue siendo decimal: el margen y las sumas por facultad se
# calculan crudos. Lo que cambia es lo que se publica.

.certent_estudio <- function() list(
  componentes = list(list(resultado = list(aulas_por_estrato = list(
    list(estrato = "FACULTAD CORTA", cuota = 60, margen = list(aulas_requeridas = 2)),
    list(estrato = "FACULTAD SOBRADA", cuota = 100, margen = list(aulas_requeridas = 2)),
    list(estrato = "FACULTAD JUSTA", cuota = 100, margen = list(aulas_requeridas = 2))
  ),
  # Sin `distribucion_sub` no hay cuotas por sexo y las celdas salen vacias:
  # el bucle del ultimo test no correria ni una asercion y testthat lo
  # reportaria como SKIP, que se lee como verde. Las cuotas van aqui.
  distribucion_sub = list(
    list(estrato = "FACULTAD JUSTA", sub = "F", n = 60),
    list(estrato = "FACULTAD JUSTA", sub = "M", n = 40)
  )))))

.certent_seleccion <- function() list(
  selection = data.frame(
    classroom_id = c("C1", "C2", "S1", "S2", "J1", "J2"),
    faculty = c("FACULTAD CORTA", "FACULTAD CORTA", "FACULTAD SOBRADA",
                "FACULTAD SOBRADA", "FACULTAD JUSTA", "FACULTAD JUSTA"),
    sample_role = "titular",
    wave = "M1",
    eligible_n = c(50, 50, 90, 90, 90, 90),
    # El split por sexo del aula sale de sex_top_1/2; en JUSTA da 57,6 F y 38,4 M
    # sobre la tasa, que son justo los decimales que el entero publicado corta.
    sex_top_1 = "F", sex_top_1_n = c(30, 30, 55, 55, 54, 54),
    sex_top_2 = "M", sex_top_2_n = c(20, 20, 35, 35, 36, 36),
    # CORTA  suma  57,4 contra cuota  60 -> faltan 2,6 -> se piden 3.
    # SOBRADA suma 100,6 contra cuota 100 -> promete 100, no 101.
    # JUSTA   suma  99,6 contra cuota 100 -> NO cubre; redondear arriba la
    #         convertiria en certificada, que es el error que hay que impedir.
    efectivas_esperadas = c(28.7, 28.7, 50.3, 50.3, 49.8, 49.8),
    stringsAsFactors = FALSE
  )
)

.certent_filas <- function() {
  out <- calc_muestra_aulas_adjuntar_certificacion(
    .certent_seleccion(), estudio = .certent_estudio(),
    referencia_asistencia = list(diseno = list(tasa_respuesta_asumida = 0.8))
  )
  filas <- out$certificacion_facultad$filas
  stats::setNames(filas, vapply(filas, `[[`, "", "faculty_key"))
}

test_that("lo que falta se pide entero y hacia arriba: 2,6 encuestas son 3 personas", {
  f <- .certent_filas()[["facultad_corta"]]
  expect_identical(f$estado, "no_cubre")
  # 60 - 57,4 = 2,6. El aviso pide 3, nunca «2,6» ni «2».
  expect_match(f$aviso, "Faltan 3\\.", fixed = FALSE)
  expect_false(grepl("2,6|2\\.6", f$aviso))
})

test_that("lo que se promete se publica entero y hacia abajo", {
  filas <- .certent_filas()
  # 57,4 esperadas se publican como 57: prometer 58 seria inventar media persona.
  expect_match(filas[["facultad_corta"]]$aviso, "suman 57 efectivas")
  # 100,6 se publican como 100 aunque el estado sea «certificada».
  expect_identical(filas[["facultad_sobrada"]]$estado, "certificada")
  expect_match(filas[["facultad_sobrada"]]$aviso, "suman 100 efectivas")
})

test_that("el redondeo de publicacion no se filtra al veredicto", {
  # El caso que separa publicar de decidir: 99,6 contra 100. Redondear las
  # esperadas hacia arriba antes de comparar la certificaria; hacia abajo la
  # deja igual de corta. El estado sale del valor CRUDO, y el aviso publica el
  # entero prometido (99) y el que falta (1).
  f <- .certent_filas()[["facultad_justa"]]
  expect_identical(f$estado, "no_cubre")
  expect_match(f$aviso, "suman 99 efectivas")
  expect_match(f$aviso, "Faltan 1\\.")
})

test_that("la celda por sexo publica entero, y el crudo sobrevive en el margen", {
  f <- .certent_filas()[["facultad_justa"]]
  celdas <- stats::setNames(f$sexo, vapply(f$sexo, `[[`, "", "sexo"))
  expect_setequal(names(celdas), c("F", "M"))
  for (sx in names(celdas)) {
    c1 <- celdas[[sx]]
    # Lo publicado es entero: ninguna celda muestra media persona.
    expect_equal(c1$esperadas, floor(c1$esperadas))
    # Y el crudo no se pierde: el margen conserva los decimales que el entero
    # corta, asi que la cifra que decide sigue siendo la fina.
    expect_false(is.na(c1$margen))
    expect_equal(c1$margen, round(c1$margen, 2))
  }
  # NOTA de por que este test no intenta probar que `cubre` sale del crudo:
  # con cuota ENTERA, `floor(esp) >= cuota` es equivalente a `esp >= cuota`, asi
  # que el redondeo hacia abajo no puede voltear el veredicto y no hay caso que
  # lo discrimine. Con `round()` si lo habria (59,6 subiria a 60 y certificaria
  # una celda corta) — es una razon mas para que la promesa vaya hacia abajo.
})
