# «Alumnos por CH» ofrece el estadistico que aplico el diseno de 2025.
#
# El motor ofrecia P25, mediana y media. El diseno HSyVBG 2025 no uso ninguno de
# los tres: su hoja «TD Estudiantes» nombra la columna «Minimo entre mediana y
# media», y las 15 facultades cuadran con ese calculo. Sin esa opcion, replicar
# el diseno exigia elegir a mano facultad por facultad cual de los dos centros
# era el menor —y volver a hacerlo cada vez que el marco cambiaba—.
#
# Se deriva de la distribucion que el snapshot ya publica, asi que no agrega
# campo ni cambia `calc_muestra_alumnos_por_ch_v1`: un `.pulso` firmado con
# `p25` sigue siendo valido y sigue resolviendo igual.

.apcmin_dist <- function(valores) {
  q <- as.numeric(stats::quantile(valores, probs = c(0.25, 0.50), type = 7, names = FALSE))
  list(media = mean(valores), p25 = q[[1]], p50 = q[[2]])
}

# Dos facultades elegidas para que las tres cifras difieran Y para que el minimo
# caiga de un lado distinto en cada una:
#
#   FAC A  10, 20, 60  ->  p25 15 · mediana 20 · media 30  ->  min = 20 (mediana)
#   FAC B  10, 50, 60  ->  p25 30 · mediana 50 · media 40  ->  min = 40 (media)
#
# Con una sola facultad, un motor que devolviera siempre la mediana pasaria.
.apcmin_fila <- function(key, label, valores) {
  list(
    faculty_key = key, faculty_label = label, row_kind = "faculty",
    elegible = list(
      n_ch = length(valores), n_ch_con_dato = length(valores),
      n_matriculas_elegibles = sum(valores),
      distribution = .apcmin_dist(valores)
    ),
    contraste_total = list(
      n_ch = length(valores), n_ch_con_dato = length(valores),
      n_matriculas_elegibles = sum(valores),
      distribution = .apcmin_dist(valores)
    )
  )
}

.apcmin_fila_a <- function() .apcmin_fila("fac_a", "FAC A", c(10, 20, 60))
.apcmin_fila_b <- function() .apcmin_fila("fac_b", "FAC B", c(10, 50, 60))

test_that("el estadistico esta en la whitelist y sobrevive la normalizacion", {
  expect_true("min_mediana_media" %in% .cm_alumnos_por_ch_methods)
  expect_identical(.cm_alumnos_por_ch_method("min_mediana_media"), "min_mediana_media")

  # Y llega entero hasta la decision persistida: si la whitelist no lo conociera,
  # se guardaria como "" y `/calcular` fallaria cerrado con `estadistico_invalido`.
  decision <- .cm_alumnos_por_ch_normalize_decision(list(
    schema = "calc_muestra_alumnos_por_ch_decision_v1",
    frame_hash = "frame-min-1",
    denominador = "elegible",
    estadistico_default = "min_mediana_media",
    por_facultad = list("FAC B" = "min_mediana_media"),
    confirmado_at = "2026-08-16T12:00:00Z"
  ))
  expect_identical(decision$estadistico_default, "min_mediana_media")
  expect_identical(decision$por_facultad$fac_b, "min_mediana_media")
  expect_identical(decision$schema, "calc_muestra_alumnos_por_ch_decision_v1")
})

test_that("toma la mediana cuando la mediana es la menor", {
  valor <- .cm_alumnos_por_ch_stat_value(.apcmin_fila_a(), "min_mediana_media")
  expect_equal(valor, 20)
  # Y no es ninguno de los otros dos: si lo fuera, este archivo no probaria nada.
  expect_false(isTRUE(all.equal(valor, 15)))  # p25
  expect_false(isTRUE(all.equal(valor, 30)))  # media
})

test_that("toma la media cuando la media es la menor", {
  # La direccion contraria. Un motor que devolviera siempre la mediana pasa el
  # test anterior y cae aqui.
  valor <- .cm_alumnos_por_ch_stat_value(.apcmin_fila_b(), "min_mediana_media")
  expect_equal(valor, 40)
  expect_false(isTRUE(all.equal(valor, 30)))  # p25
  expect_false(isTRUE(all.equal(valor, 50)))  # mediana
})

test_that("los tres estadisticos de siempre no se mueven", {
  fila <- .apcmin_fila_a()
  expect_equal(.cm_alumnos_por_ch_stat_value(fila, "p25"), 15)
  expect_equal(.cm_alumnos_por_ch_stat_value(fila, "mediana"), 20)
  expect_equal(.cm_alumnos_por_ch_stat_value(fila, "media"), 30)
})

test_that("con un empate el minimo es ese valor", {
  fila <- .apcmin_fila("fac_c", "FAC C", c(20, 20, 20))
  expect_equal(.cm_alumnos_por_ch_stat_value(fila, "min_mediana_media"), 20)
})

test_that("si falta uno de los dos centros no hay minimo", {
  # Sin `na.rm`, a proposito. Con `na.rm = TRUE` una facultad a la que le falta
  # la media devolveria la mediana disfrazada de minimo: el guard de
  # `valor_no_positivo` la dejaria pasar y el divisor seria otro sin que nadie
  # lo vea. Un snapshot incompleto llega asi de verdad —`n_ch_con_dato < n_ch`
  # pone la distribucion entera en NA—.
  sin_media <- .apcmin_fila_a()
  sin_media$elegible$distribution$media <- NA_real_
  expect_true(is.na(.cm_alumnos_por_ch_stat_value(sin_media, "min_mediana_media")))

  sin_mediana <- .apcmin_fila_a()
  sin_mediana$elegible$distribution$p50 <- NA_real_
  expect_true(is.na(.cm_alumnos_por_ch_stat_value(sin_mediana, "min_mediana_media")))

  incompleto <- list(
    faculty_key = "fac_d", faculty_label = "FAC D", row_kind = "faculty",
    elegible = list(
      n_ch = 2L, n_ch_con_dato = 1L, n_matriculas_elegibles = NA_real_,
      distribution = list(media = NA_real_, p25 = NA_real_, p50 = NA_real_)
    )
  )
  expect_true(is.na(.cm_alumnos_por_ch_stat_value(incompleto, "min_mediana_media")))

  # Y una fila sin distribucion tampoco inventa un cero.
  vacia <- list(faculty_key = "fac_e", row_kind = "faculty", elegible = list())
  expect_true(is.na(.cm_alumnos_por_ch_stat_value(vacia, "min_mediana_media")))
})

# --- Por la ruta que usa la app: la decision firmada mueve el divisor ---------

.apcmin_estratos <- function() list(
  list(
    label = "FAC A", N = 1000, N_a = 500, N_b = 500,
    e_facultad = 0.05, p_facultad = 0.5,
    promedio_conglomerado = 777, aulas_base_fijas = 777L, tau = 1
  ),
  list(
    label = "FAC B", N = 800, N_a = 400, N_b = 400,
    e_facultad = 0.05, p_facultad = 0.5,
    promedio_conglomerado = 888, aulas_base_fijas = 888L, tau = 1
  )
)

.apcmin_componente <- function(actor_id, tecnica) list(
  id = paste0("cmp-", actor_id), actor = actor_id, actor_id = actor_id,
  actor_categoria = "otros", canal_recojo = "aula_qr", tecnica = tecnica,
  marco = list(estado = "validado", estratos = .apcmin_estratos()),
  parametros = list(
    p = 0.5, z = 1.96, e = 0.05, deff = 1,
    tau = 1, promedio_conglomerado = 25, oversample_pct = 0
  )
)

.apcmin_estudio <- function(estadistico = "min_mediana_media") list(
  macro_familia = "encuesta_estudiantes",
  workspace = list(
    frame_mode = "opinion_universitaria",
    aulas_config = list(alumnos_por_ch_decision = list(
      schema = "calc_muestra_alumnos_por_ch_decision_v1",
      frame_hash = "frame-min-1",
      denominador = "elegible",
      estadistico_default = estadistico,
      por_facultad = list(),
      confirmado_at = "2026-08-16T12:00:00Z"
    ))
  ),
  componentes = list(
    .apcmin_componente("estudiantes_universidad", "prob_conglomerado_multietapico"),
    .apcmin_componente("estudiantes_facultad", "prob_estratificado_independiente")
  )
)

.apcmin_frame <- function() {
  aula_frame <- data.frame(
    classroom_id = paste0("CH-", 1:6),
    faculty = c("FAC A", "FAC A", "FAC A", "FAC B", "FAC B", "FAC B"),
    included = rep(TRUE, 6),
    eligible_n = c(10, 20, 60, 10, 50, 60),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  list(
    schema = "calc_muestra_aulas_frame_v1",
    frame_hash = "frame-min-1",
    aula_frame = aula_frame,
    alumnos_por_ch = calc_muestra_alumnos_por_ch(aula_frame, "frame-min-1")
  )
}

test_that("la decision firmada baja el minimo al divisor de cada estrato", {
  # Lo que de verdad importa: no que el helper calcule bien, sino que el numero
  # llegue al estrato por la ruta que corre `/calcular`. El estadistico se
  # resuelve por facultad, asi que las dos direcciones del minimo tienen que
  # aparecer en el mismo estudio.
  resuelto <- calc_muestra_alumnos_por_ch_resolver_estudio(
    .apcmin_estudio(), .apcmin_frame()
  )

  for (componente in resuelto$estudio$componentes) {
    divisores <- vapply(componente$marco$estratos, `[[`, numeric(1), "promedio_conglomerado")
    expect_equal(divisores, c(20, 40))
    # **La fijacion de titulares SOBREVIVE al recalculo.** Este test exigia
    # `c(0, 0)`: el resolver borraba `aulas_base_fijas` de forma incondicional
    # para protegerse de las fijas que los defaults de auditoria espolvoreaban
    # en el frontend. Esa contaminacion se corto en la fuente (`f51a3c1a`), y
    # entonces el borrado pasaba a matar una decision registrada del usuario
    # —medido: fija 9, calcular, 0—. La decision vigente fija el DIVISOR; la
    # fijacion de titulares es otra decision y no se toca.
    expect_equal(
      vapply(componente$marco$estratos, `[[`, numeric(1), "aulas_base_fijas"),
      c(777, 888)
    )
  }

  # La auditoria publica el estadistico usado, que es lo que la pestana de
  # Calculo muestra al analista.
  auditoria <- resuelto$auditoria$componentes[["estudiantes_universidad"]]
  expect_identical(
    vapply(auditoria$estratos, `[[`, character(1), "estadistico"),
    c("min_mediana_media", "min_mediana_media")
  )
  expect_equal(vapply(auditoria$estratos, `[[`, numeric(1), "valor"), c(20, 40))
})

test_that("el minimo se distingue de los tres estadisticos viejos por la ruta real", {
  # Si el motor resolviera el nuevo id como uno de los de siempre, este contraste
  # lo delata: ninguno de los tres produce el par (20, 40).
  frame <- .apcmin_frame()
  divisores <- function(estadistico) {
    resuelto <- calc_muestra_alumnos_por_ch_resolver_estudio(
      .apcmin_estudio(estadistico), frame
    )
    vapply(
      resuelto$estudio$componentes[[1]]$marco$estratos,
      `[[`, numeric(1), "promedio_conglomerado"
    )
  }
  expect_equal(divisores("p25"), c(15, 30))
  expect_equal(divisores("mediana"), c(20, 50))
  expect_equal(divisores("media"), c(30, 40))
  expect_equal(divisores("min_mediana_media"), c(20, 40))
})

test_that("un estadistico inventado sigue fallando cerrado", {
  # La whitelist crecio en uno, no se abrio.
  expect_error(
    calc_muestra_alumnos_por_ch_resolver_estudio(
      .apcmin_estudio("min_media_mediana"),  # el nombre del OTRO contrato
      .apcmin_frame()
    ),
    class = "api_error"
  )
})
