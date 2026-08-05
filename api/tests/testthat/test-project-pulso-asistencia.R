# G53 · La lectura del histórico tiene que sobrevivir al guardado.
#
# La whitelist de persistencia se quedó en la v1 y podaba en silencio todo lo
# que el ADR 0060 añadió: diseño, encuentros, embudos, composición, cuotas,
# serie de campo y cadenas de reemplazo. Al reabrir el proyecto, la pestaña
# Histórico volvía a su estado vacío y pedía subir otra vez la base.
#
# Y no hay forma de recalcularlo: el archivo crudo de la referencia se excluye a
# propósito del zip porque es la base de OTRO estudio. Si el agregado no viaja,
# no viaja nada.
#
# Estos casos fijan qué tiene que sobrevivir. Se prueban contra el sanitizador
# directamente —es la función que poda— para que el rojo señale la whitelist y
# no el zip.

.asist_ref_completa <- function() {
  list(
    schema = "calc_muestra_referencia_asistencia_v2",
    owner = "calc_muestra",
    momento = "post",
    transferible = TRUE,
    modelo = "aulas",
    combinable = FALSE,
    unidad = "curso_horario",
    denominador = "elegibles",
    estudio = list(id = "hsvbg2025", label = "HSVBG 2025", periodo = "2025-2", fuente = "campo"),
    diseno = list(
      poblacion_objetivo = 29090, muestra = 3200, sobremuestra = 3520,
      tasa_respuesta_asumida = 0.7, efectivas_logradas = 3303,
      aulas_dimensionadas = 170, aulas_aplicadas = 194, declarado = TRUE
    ),
    filtros_corte = list(list(
      id = "consent", etiqueta = "Consentimiento", columna = "corte_consent",
      condicion = "== 0", clase = "rechazo", origen = "formulario",
      orden = 1, en_denominador = TRUE
    )),
    cobertura = list(
      agendados = 194, aplicados = 194, observados = 194, glosario_completo = TRUE,
      columnas_glosario = list("elegibles", "ya_medidas"),
      columnas_criterio = list("condicion_curso")
    ),
    encuentros = list(
      elegibles = 6232, asistentes = 4931, ya_medidas = 421, no_elegibles = 85,
      elegibles_presentes = 4425, efectivas = 3303, no_efectivas = 335,
      no_realizadas = 892, presentes_no_contados = 105,
      unidades_publicables = 190L, unidades_con_residual_negativo = 43L
    ),
    embudos = list(list(
      dimension_key = "facultad", dimension_label = "Facultad", orden = 1L,
      filas = list(list(
        celda_key = "derecho", celda_label = "Derecho", k = 21L,
        semana_min = 1L, semana_max = 3L, semana_media = 1.56, k_con_semana = 21L,
        elegibles = 900,
        asistentes = 700, ya_medidas = 40, no_elegibles = 10,
        elegibles_presentes = 650, efectivas = 500, no_efectivas = 60,
        pct_ausencia = 0.22, pct_ya_medidas = 0.06, pct_rechazo = 0.09,
        efectividad = 0.77, rendimiento = 0.56
      ))
    )),
    composicion = list(list(
      criterio_key = "modalidad", criterio_label = "Modalidad", orden = 1L,
      categorias = list(
        list(categoria = "Presencial", n = 180L, pct = 0.93),
        list(categoria = "Virtual", n = 14L, pct = 0.07)
      ),
      filas = list(list(facultad = "Derecho", n = 21L, reparto = list(
        list(categoria = "Presencial", n = 18L, pct = 0.86, elegibles = 700),
        list(categoria = "Virtual", n = 3L, pct = 0.14, elegibles = 120)
      )))
    )),
    cuotas = list(
      unidad = "cumplimiento_de_cuota", cuota_mujeres = 1600, cuota_hombres = 1600,
      logradas_mujeres = 2300, logradas_hombres = 1003,
      cumplimiento_mujeres = 1.44, cumplimiento_hombres = 0.63,
      filas = list(list(
        facultad = "Derecho", aulas = 21L, cuota_total = 300, cuota_mujeres = 150,
        cuota_hombres = 150, logradas = 500, logradas_mujeres = 300,
        logradas_hombres = 200, cumplimiento = 1.67,
        cumplimiento_mujeres = 2, cumplimiento_hombres = 1.33
      ))
    ),
    serie_campo = list(
      unidad = "semana_de_campo",
      filas = list(
        list(semana = 1L, etiqueta = "Semana 1", orden = 1L, k = 86L,
             elegibles = 2569, ausentes = 478, asistentes = 2091,
             ya_medidas = 124, no_elegibles = 20, a_encuestar = 2091,
             registros = 1700, efectivas = 1520, no_efectivas = 150,
             efectivas_acumuladas = 1520, asistencia = 0.814,
             pct_ya_medidas = 0.059, efectividad = 0.727, rendimiento = 0.59,
             efectivas_por_aula = 17.7),
        list(semana = 4L, etiqueta = "Semana 4", orden = 4L, k = 4L,
             elegibles = 140, ausentes = 39, asistentes = 101,
             ya_medidas = 18, no_elegibles = 2, a_encuestar = 101,
             registros = 70, efectivas = 57, no_efectivas = 8,
             efectivas_acumuladas = 3303, asistencia = 0.722,
             pct_ya_medidas = 0.181, efectividad = 0.564, rendimiento = 0.41,
             efectivas_por_aula = 14.2)
      ),
      deriva = list(
        tramos = 4L, tramos_medibles = 4L,
        etiqueta_primera = "Semana 1", etiqueta_ultima = "Semana 4",
        efectividad_primera = 0.727, efectividad_ultima = 0.564,
        efectividad_min = 0.564, efectividad_min_etiqueta = "Semana 4",
        efectividad_min_k = 4L, efectividad_max = 0.795,
        efectividad_max_etiqueta = "Semana 3", efectividad_max_k = 36L,
        tramo_dominante = "Semana 1", peso_dominante = 0.47,
        ya_medidas_primera = 0.059, ya_medidas_ultima = 0.181,
        agotamiento_crece = TRUE, por_aula_primera = 17.7, por_aula_ultima = 14.2,
        puntos = list(list(etiqueta = "Semana 1", k = 86L, a_encuestar = 2091,
                           efectividad = 0.727, pct_ya_medidas = 0.059))
      )
    ),
    cadenas_reemplazo = list(
      unidad = "cadena_de_reemplazo", cadenas_declaradas = 170L,
      cadenas_resueltas = 169L, resueltas_con_titular = 120L,
      resueltas_con_reemplazo = 49L, profundidad_maxima = 7L,
      motivos = list(list(motivo = "Docente no autorizó", codigo = "A", n = 30L, orden = 1L)),
      filas = list(list(
        cadena = 1L, facultad = "Derecho", titular = "MAT146-0205",
        nombre_curso = "Cálculo 1", horario = "17:00-20:00",
        efectivas_mujeres = 12, efectivas_hombres = 10,
        escalones_trabajados = 2L, aplicados = 1L, resuelta_en = 2L,
        semana_inicio = 3L, semana_fin = 3L,
        efectivas = 22, elegibles = 30, rendimiento = 0.73,
        escalones = list(
          list(posicion = 1L, semana = NA_integer_, rol = "Titular",
               curso_horario = "MAT146-0205", estado = "cayo", efectivas = NA_real_,
               efectivas_mujeres = NA_real_, efectivas_hombres = NA_real_,
               elegibles = NA_real_, rendimiento = NA_real_,
               motivo = "Docente no autorizó", motivo_codigo = "A"),
          list(posicion = 2L, semana = 3L, rol = "Reemplazo 1",
               curso_horario = "MAT146-0204", estado = "aplicado", efectivas = 22,
               efectivas_mujeres = 12, efectivas_hombres = 10, elegibles = 30,
               rendimiento = 0.73, motivo = NA_character_, motivo_codigo = NA_character_)
        )
      ))
    ),
    identidad = list(regla = "asistentes = efectivas + no_efectivas + no_realizadas",
                     verificada = 147L, verificables = 190L, inconsistentes = 43L,
                     residuales_negativos = 43L),
    umbrales = list(insuficiente_max = 2L, delgada_min = 3L, solida_min = 8L,
                    bootstrap_n = 2000L, nivel_ic = 0.95, quantile_type = 7L),
    cadena = list(
      asistencia = list(key = "asistencia", label = "Asistencia", k = 190L,
                        numerador = 4931, denominador = 6232, tasa = 0.7912,
                        ic_low = 0.77, ic_high = 0.81, metodo_ic = "bootstrap"),
      efectividad = list(key = "efectividad", label = "Efectividad", k = 190L,
                         numerador = 3303, denominador = 4425, tasa = 0.7464,
                         ic_low = 0.73, ic_high = 0.76, metodo_ic = "bootstrap"),
      rendimiento = list(key = "rendimiento", label = "Rendimiento", k = 190L,
                         numerador = 3303, denominador = 6232, tasa = 0.53,
                         ic_low = 0.51, ic_high = 0.55, metodo_ic = "bootstrap")
    ),
    global = list(k = 190L, matriculados = 6232, asistentes = 4931,
                  enviadas = 3638, validas = 3303, no_respondieron = 892,
                  tasa = 0.7912, media_ch = 0.78, sd_ch = 0.12,
                  ic_low = 0.77, ic_high = 0.81, metodo_ic = "bootstrap"),
    dimensiones = list(list(
      dimension_key = "facultad", dimension_label = "Facultad", orden = 1L,
      filas = list(list(celda_key = "derecho", celda_label = "Derecho", orden = 1L,
                        k = 21L, matriculados = 900, asistentes = 700,
                        semana_min = 1L, semana_max = 3L, semana_media = 1.56,
                        k_con_semana = 21L, tasa = 0.78,
                        estimador = "razon", media_ch = 0.77, sd_ch = 0.1,
                        ic_low = 0.74, ic_high = 0.82, metodo_ic = "bootstrap",
                        suficiencia = "solida", tasa_publicada = 0.78,
                        k_publicada = 21L, fuente_publicada = "celda"))
    )),
    advertencias = list("43 aulas con residual negativo"),
    celdas_criterios = NULL
  )
}

test_that("el guardado conserva la lectura completa del historico", {
  guardada <- .pulso_sanitize_calc_muestra_asistencia(.asist_ref_completa())

  # Los bloques que el ADR 0060 anadio y la whitelist v1 borraba.
  expect_false(is.null(guardada$diseno))
  expect_identical(guardada$diseno$efectivas_logradas, 3303)
  expect_false(is.null(guardada$encuentros))
  expect_identical(guardada$encuentros$elegibles_presentes, 4425)
  expect_length(guardada$embudos, 1L)
  expect_identical(guardada$embudos[[1L]]$filas[[1L]]$efectividad, 0.77)
  expect_length(guardada$composicion, 1L)
  expect_length(guardada$cuotas$filas, 1L)
  expect_length(guardada$filtros_corte, 1L)

  # La efectividad es la tasa que se hereda: sin ella en la cadena, el panel
  # abria sin su cifra principal.
  expect_false(is.null(guardada$cadena$efectividad))
  expect_identical(guardada$cadena$efectividad$tasa, 0.7464)
  expect_false(is.null(guardada$cadena$rendimiento))
})

test_that("la dimension temporal sobrevive al guardado", {
  guardada <- .pulso_sanitize_calc_muestra_asistencia(.asist_ref_completa())

  expect_length(guardada$serie_campo$filas, 2L)
  expect_identical(guardada$serie_campo$filas[[2L]]$efectividad, 0.564)
  # La deriva es lo que permite decir que el 74,6 % global es un promedio y no
  # una constante; si se poda, el aviso desaparece sin que nadie lo note.
  expect_identical(guardada$serie_campo$deriva$efectividad_min, 0.564)
  expect_identical(guardada$serie_campo$deriva$efectividad_max, 0.795)
  expect_true(guardada$serie_campo$deriva$agotamiento_crece)
  expect_length(guardada$serie_campo$deriva$puntos, 1L)

  # La ventana por celda: sin ella, la tasa de una facultad se lee como una
  # propiedad suya y no como lo que rindio en el tramo de campo que le toco.
  celda_embudo <- guardada$embudos[[1L]]$filas[[1L]]
  expect_identical(celda_embudo$semana_min, 1L)
  expect_identical(celda_embudo$semana_max, 3L)
  expect_identical(celda_embudo$k_con_semana, 21L)
  celda_dimension <- guardada$dimensiones[[1L]]$filas[[1L]]
  expect_identical(celda_dimension$semana_media, 1.56)

  # La semana de cada escalon: una cadena que bajo escalones se resolvio tarde.
  cadena <- guardada$cadenas_reemplazo$filas[[1L]]
  expect_identical(cadena$semana_inicio, 3L)
  expect_identical(cadena$escalones[[2L]]$semana, 3L)
  expect_identical(cadena$escalones[[2L]]$estado, "aplicado")
  # El motivo de la caida viaja con su codigo: la casilla no puede quedar muda.
  expect_identical(guardada$cadenas_reemplazo$motivos[[1L]]$codigo, "A")
})

test_that("las listas de columnas no se pierden por no ser escalares", {
  guardada <- .pulso_sanitize_calc_muestra_asistencia(.asist_ref_completa())
  expect_identical(length(guardada$cobertura$columnas_glosario), 2L)
  expect_true(guardada$cobertura$glosario_completo)
  # El reparto de la barra apilada es una lista de registros —una categoria por
  # tramo—, no un vector de numeros: aplanarlo dejaba la barra sin tramos y el
  # cliente rechazaba el payload entero al reabrir el proyecto.
  reparto <- guardada$composicion[[1L]]$filas[[1L]]$reparto
  expect_length(reparto, 2L)
  expect_identical(reparto[[1L]]$categoria, "Presencial")
  expect_identical(reparto[[1L]]$n, 18L)
  expect_identical(reparto[[2L]]$elegibles, 120)
  # Y sus tramos suman las aulas de la facultad, que es lo que el cliente exige.
  expect_identical(
    sum(vapply(reparto, function(r) r$n, integer(1))),
    guardada$composicion[[1L]]$filas[[1L]]$n
  )
})

test_that("una referencia v1 sigue abriendo despues del cambio", {
  # Un `.pulso` guardado antes del ADR 0060 no trae los bloques nuevos y usa los
  # nombres viejos de la cadena. Tiene que sobrevivir sin inventar campos.
  vieja <- list(
    schema = "calc_muestra_referencia_asistencia_v1",
    estudio = list(id = "x", label = "X"),
    cobertura = list(agendados = 10, aplicados = 10, observados = 10),
    cadena = list(
      asistencia = list(key = "asistencia", tasa = 0.8),
      completitud = list(key = "completitud", tasa = 0.9)
    ),
    dimensiones = list()
  )
  guardada <- .pulso_sanitize_calc_muestra_asistencia(vieja)
  expect_identical(guardada$cadena$asistencia$tasa, 0.8)
  expect_identical(guardada$cadena$completitud$tasa, 0.9)
  expect_null(guardada$serie_campo)
  expect_null(guardada$encuentros)
})
