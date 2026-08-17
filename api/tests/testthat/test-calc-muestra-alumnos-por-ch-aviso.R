# Calcular sin decidir los alumnos por CH deja de ser silencioso.
#
# `resolver_estudio` devuelve el estudio intacto cuando la decision es NULL
# —compatibilidad con proyectos previos al contrato v1— y el motor sigue
# adelante calculando las aulas de las quince facultades con UN UNICO
# `avg_conglomerado` global. Medido en HSVG2026: el elegible real por aula va de
# 16 en Letras y Ciencias Humanas a 46 en Estudios Generales Letras, asi que el
# promedio unico no es una aproximacion menor —en las facultades pequeñas
# decide si el estudio es siquiera factible—. Hasta ahora el resultado no lo
# mencionaba en ninguna parte.
#
# No se confirma nada por el analista: la decision sigue exigiendo su firma.
# Solo se hace visible que falta.

.apcha_estudio <- function(n_estratos = 2L) {
  filas <- lapply(seq_len(n_estratos), function(i) {
    list(
      estrato = paste("FACULTAD", i), N = 1000L, cuota = 200L,
      avg_conglomerado = 20, estadistico_usado = "media", tau = 0.5,
      aulas_base = 20L, aulas_reemplazo = 0L, aulas_extra_operativas = 0L,
      aulas_total = 20L, tipo_aula = "G2 (20-29)", precision_e = 0.05
    )
  })
  list(componentes = list(list(
    actor_id = "estudiantes_universidad",
    resultado = list(aulas_por_estrato = filas)
  )))
}

test_that("sin decision, cada fila dice que uso el promedio global", {
  out <- calc_muestra_alumnos_por_ch_adjuntar_auditoria(.apcha_estudio(3L), NULL)
  filas <- out$componentes[[1]]$resultado$aulas_por_estrato
  expect_length(filas, 3L)
  for (fila in filas) {
    expect_equal(fila$alumnos_por_ch$estado, "sin_decision")
    expect_equal(fila$alumnos_por_ch$referencia, "promedio_global")
    expect_true(grepl("promedio global", fila$alumnos_por_ch$aviso, fixed = TRUE))
    # El aviso dice QUE HACER, no solo que algo falta.
    expect_true(grepl("Confirma la decisión", fila$alumnos_por_ch$aviso, fixed = TRUE))
  }
})

test_that("el aviso no toca la cifra que el motor aplico de verdad", {
  # Es aditivo: `avg_conglomerado` y `estadistico_usado` siguen siendo los que
  # se usaron. Pisarlos convertiria un aviso en una mentira distinta.
  out <- calc_muestra_alumnos_por_ch_adjuntar_auditoria(.apcha_estudio(), NULL)
  fila <- out$componentes[[1]]$resultado$aulas_por_estrato[[1]]
  expect_equal(fila$avg_conglomerado, 20)
  expect_equal(fila$estadistico_usado, "media")
  expect_equal(fila$aulas_base, 20L)
})

test_that("una fila ya resuelta por facultad no se pisa", {
  # Control: si la auditoria si resolvio esa facultad, su bloque manda.
  estudio <- .apcha_estudio()
  estudio$componentes[[1]]$resultado$aulas_por_estrato[[1]]$alumnos_por_ch <- list(
    referencia = "marco_ejecutado", estadistico = "min_mediana_media", valor = 17
  )
  out <- calc_muestra_alumnos_por_ch_adjuntar_auditoria(estudio, NULL)
  fila <- out$componentes[[1]]$resultado$aulas_por_estrato[[1]]
  expect_equal(fila$alumnos_por_ch$referencia, "marco_ejecutado")
  expect_null(fila$alumnos_por_ch$estado)
})

test_that("un estudio sin aulas por estrato no revienta ni inventa filas", {
  vacio <- list(componentes = list(list(actor_id = "x", resultado = list())))
  out <- calc_muestra_alumnos_por_ch_adjuntar_auditoria(vacio, NULL)
  expect_null(out$componentes[[1]]$resultado$aulas_por_estrato)
  expect_equal(calc_muestra_alumnos_por_ch_adjuntar_auditoria(list(), NULL), list())
})

# --- Decision en blanco vs decision a medias ---------------------------------
# El proyecto real de HSVG2026 guarda la decision con los SEIS campos vacios.
# Como el objeto EXISTE no caia en la rama de compatibilidad y el resolutor lo
# trataba como CORRUPTO: 409 `schema_invalido`, «La decision de alumnos por CH
# esta incompleta o usa un schema desconocido». El estudio no se podia calcular
# y el mensaje no decia como salir.

.apcha_blanco <- function() list(
  schema = "", frame_hash = "", denominador = "",
  estadistico_default = "", por_facultad = list(), confirmado_at = ""
)

test_that("la decision del proyecto real se reconoce EN BLANCO", {
  expect_true(.cm_alumnos_por_ch_decision_en_blanco(.apcha_blanco()))
  expect_true(.cm_alumnos_por_ch_decision_en_blanco(NULL))
  expect_true(.cm_alumnos_por_ch_decision_en_blanco(list()))
})

test_that("una decision A MEDIAS no es una decision en blanco", {
  # Alguien empezo a decidir: eso SI debe seguir dando 409, no colarse como
  # ausente. Es la diferencia entre «no tocado» y «mal llenado».
  for (campo in c("schema", "frame_hash", "denominador", "estadistico_default", "confirmado_at")) {
    parcial <- .apcha_blanco()
    parcial[[campo]] <- "algo"
    expect_false(
      .cm_alumnos_por_ch_decision_en_blanco(parcial),
      info = paste("campo con contenido:", campo)
    )
  }
  con_facultad <- .apcha_blanco()
  con_facultad$por_facultad <- list(derecho = "p25")
  expect_false(.cm_alumnos_por_ch_decision_en_blanco(con_facultad))
})

test_that("un estudio con la decision en blanco CALCULA en vez de fallar", {
  # El desbloqueo end-to-end: antes esto lanzaba 409.
  estudio <- list(
    workspace = list(
      frame_mode = "opinion_universitaria",
      aulas_config = list(alumnos_por_ch_decision = .apcha_blanco())
    ),
    componentes = list()
  )
  resuelto <- calc_muestra_alumnos_por_ch_resolver_estudio(estudio)
  expect_null(resuelto$auditoria)
  expect_true(is.list(resuelto$estudio))
})
