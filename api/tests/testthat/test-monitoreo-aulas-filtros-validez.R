# Que es una encuesta EFECTIVA, cuando hace falta mas de un filtro.
#
# Gonzalo: «la seccion de fuentes no deja declarar las variables que definen a
# una encuesta efectiva, que en algunos casos tiene mas de un filtro, puede tener
# hasta 4». Hasta aqui el criterio era UNA columna contra una lista de estados, y
# eso no alcanza para un estudio real: «efectiva» suele ser completa **y** con
# consentimiento **y** del publico elegible.

.mafv_base <- function() {
  data.frame(
    estado        = c("completa", "completa", "completa", "parcial", "completa"),
    consentimiento = c("si", "si", "no", "si", "si"),
    publico       = c("alumno", "docente", "alumno", "alumno", "alumno"),
    duracion_ok   = c("si", "si", "si", "si", "no"),
    stringsAsFactors = FALSE
  )
}

test_that("un solo filtro sigue contando como antes", {
  cfg <- list(source_mapping = list(status_var = "estado", valid_statuses = "completa"))
  # Cuatro de cinco tienen estado «completa».
  expect_identical(sum(prosecnurapp:::.monitoreo_aulas_valid_response(.mafv_base(), cfg)), 4L)
})

test_that("CUATRO filtros se exigen todos, y ninguno amplia", {
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "estado", values = "completa"),
    list(var = "consentimiento", values = "si"),
    list(var = "publico", values = "alumno"),
    list(var = "duracion_ok", values = "si")
  )))
  ok <- prosecnurapp:::.monitoreo_aulas_valid_response(.mafv_base(), cfg)
  # Solo la fila 1 cumple las cuatro: la 2 es docente, la 3 no consintio, la 4
  # esta parcial y la 5 no cumple duracion.
  expect_identical(ok, c(TRUE, FALSE, FALSE, FALSE, FALSE))
  expect_identical(sum(ok), 1L)
})

test_that("cada filtro ACOTA: quitar uno no puede dar menos validas", {
  # La invariante que hace util tener varios: son una conjuncion. Si añadir un
  # filtro subiera el conteo, estarian actuando como alternativas.
  base <- .mafv_base()
  con <- function(fs) sum(prosecnurapp:::.monitoreo_aulas_valid_response(
    base, list(source_mapping = list(valid_filters = fs))))
  uno <- list(list(var = "estado", values = "completa"))
  dos <- c(uno, list(list(var = "consentimiento", values = "si")))
  tres <- c(dos, list(list(var = "publico", values = "alumno")))
  expect_true(con(uno) >= con(dos))
  expect_true(con(dos) >= con(tres))
  expect_identical(c(con(uno), con(dos), con(tres)), c(4L, 3L, 2L))
})

test_that("una columna declarada que la base NO trae no descarta todo", {
  # Descartar las cinco por una columna ausente seria peor que contar de mas: el
  # estudio se quedaria sin avance por un error de tipeo en la config.
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "estado", values = "completa"),
    list(var = "columna_que_no_existe", values = "si")
  )))
  expect_identical(sum(prosecnurapp:::.monitoreo_aulas_valid_response(.mafv_base(), cfg)), 4L)
})

test_that("un filtro sin variable o sin valores no entra", {
  # Dejarlo entrar descartaria TODAS las respuestas en silencio.
  fs <- monitoreo_aulas_filtros_de_validez(list(source_mapping = list(valid_filters = list(
    list(var = "estado", values = "completa"),
    list(var = "", values = "si"),
    list(var = "consentimiento", values = character(0))
  ))))
  expect_length(fs, 1L)
  expect_identical(fs[[1]]$var, "estado")
})

test_that("sin `valid_filters` se lee el `status_var` de siempre", {
  # Un estudio ya configurado no cambia de numero por este cambio.
  fs <- monitoreo_aulas_filtros_de_validez(list(source_mapping = list(
    status_var = "estado", valid_statuses = c("completa", "parcial")
  )))
  expect_length(fs, 1L)
  expect_identical(fs[[1]]$var, "estado")
  expect_identical(fs[[1]]$values, c("completa", "parcial"))
})

test_that("el criterio NOMBRA los filtros, y avisa del que no se pudo aplicar", {
  # Un motor que filtra en silencio es lo que este perfil lleva corrigiendo: sin
  # nombrarlos habria que abrir la config para saber que se esta contando.
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "estado", values = "completa"),
    list(var = "consentimiento", values = "si"),
    list(var = "columna_que_no_existe", values = "si")
  )))
  crit <- monitoreo_aulas_criterio_validez(.mafv_base(), cfg)
  expect_identical(crit$modo, "por_filtros")
  expect_identical(crit$validas, 3L)

  txt <- monitoreo_aulas_criterio_texto(crit)
  expect_true(grepl("3 condiciones", txt, fixed = TRUE))
  expect_true(grepl("estado, consentimiento", txt, fixed = TRUE))
  # Y la que no se pudo aplicar se dice, o un error de tipeo pasaria por criterio.
  expect_true(grepl("columna_que_no_existe", txt, fixed = TRUE))
  expect_true(grepl("no se aplicó", txt, fixed = TRUE))
})

test_that("los filtros SOBREVIVEN al normalizador de config", {
  # Este normalizador es la whitelist: lo que no nombra, no persiste. Sin esto
  # la UI dejaria elegir los filtros y al guardar se perderian en silencio, que
  # es el defecto clasico de este repo —un campo cruza varias whitelists—.
  cfg <- monitoreo_aulas_normalize_config(list(source_mapping = list(
    valid_filters = list(
      list(var = "estado", values = c("completa")),
      list(var = "consentimiento", values = c("si"))
    )
  )))
  fs <- cfg$source_mapping$valid_filters
  expect_length(fs, 2L)
  expect_identical(fs[[1]]$var, "estado")
  expect_identical(unlist(fs[[2]]$values), "si")
})

test_that("el normalizador tira los filtros incompletos y corta en CUATRO", {
  # Un filtro sin variable o sin valores descartaria TODAS las respuestas, y el
  # tope es el que declaro Gonzalo: «puede tener hasta 4».
  cfg <- monitoreo_aulas_normalize_config(list(source_mapping = list(
    valid_filters = c(
      list(list(var = "", values = "x")),
      list(list(var = "a", values = character(0))),
      lapply(1:6, function(i) list(var = paste0("v", i), values = "si"))
    )
  )))
  fs <- cfg$source_mapping$valid_filters
  expect_length(fs, 4L)
  expect_identical(vapply(fs, function(f) f$var, character(1)), c("v1", "v2", "v3", "v4"))
})

test_that("UN SOLO `valid_filters` ya filtra: no cae al camino viejo", {
  # El defecto salio haciendo el ciclo entero desde la pantalla: se guardaba
  # «sexo = F», las validas seguian siendo 3 700 y no habia error. El motor
  # exigia MAS DE UNO para aplicar `valid_filters` y con uno se iba por
  # `status_var`, que en ese estudio esta vacio, asi que contaba todo.
  #
  # No lo veian los tests porque el caso de «un filtro» se probaba con
  # `status_var`, que es el camino viejo.
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "consentimiento", values = "si")
  )))
  ok <- prosecnurapp:::.monitoreo_aulas_valid_response(.mafv_base(), cfg)
  expect_identical(sum(ok), 4L)
  expect_true(sum(ok) < nrow(.mafv_base()))

  crit <- monitoreo_aulas_criterio_validez(.mafv_base(), cfg)
  expect_identical(crit$modo, "por_filtros")
  expect_identical(crit$validas, 4L)
  # Y con uno solo la frase no dice «1 condiciones».
  expect_true(grepl("consentimiento", monitoreo_aulas_criterio_texto(crit), fixed = TRUE))
  expect_false(grepl("1 condiciones", monitoreo_aulas_criterio_texto(crit), fixed = TRUE))
})

test_that("los filtros sobreviven aunque lleguen como DATA.FRAME desde el JSON", {
  # `jsonlite` convierte un array de objetos en un data.frame, no en una lista:
  # iterando con `for (f in crudos)` se recorren las COLUMNAS y se descarta todo
  # **en silencio**. El sintoma exacto que salio en pantalla: el POST devuelve
  # 200, la clave aparece en la config y su valor es `[]`.
  como_json <- data.frame(var = c("estado", "consentimiento"), stringsAsFactors = FALSE)
  como_json$values <- list("completa", "si")

  cfg <- monitoreo_aulas_normalize_config(list(source_mapping = list(valid_filters = como_json)))
  fs <- cfg$source_mapping$valid_filters
  expect_length(fs, 2L)
  expect_identical(fs[[1]]$var, "estado")
  expect_identical(unlist(fs[[2]]$values), "si")

  # Y filtran de verdad, que es lo que se estaba perdiendo.
  ok <- prosecnurapp:::.monitoreo_aulas_valid_response(.mafv_base(), cfg)
  expect_identical(sum(ok), 3L)
})

# --- En CUAL condicion se cae cada respuesta que no cuenta -------------------
#
# Gonzalo, 2026-08-31: «estas son las efectivas, estas son las que no pasan el
# filtro, estas son las que se quedan en el primer, segundo o tercer filtro».
#
# El criterio decia «2.616 de 2.760» y eso no dice donde esta el problema: 144
# descartadas pueden ser 144 sin consentimiento o 144 fuera de la poblacion, y se
# hacen cosas distintas en cada caso.

test_that("dice cuantas caen en cada filtro, y cuantas caen SOLO por ese", {
  # Cinco respuestas. La 3 falla solo consentimiento, la 4 solo publico, y la 5
  # falla LOS DOS: no la salva arreglar ninguno por separado.
  datos <- data.frame(
    consentimiento = c("si", "si", "no", "si", "no"),
    publico        = c("alumno", "alumno", "alumno", "docente", "docente"),
    stringsAsFactors = FALSE
  )
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "consentimiento", values = list("si")),
    list(var = "publico", values = list("alumno"))
  )))
  d <- prosecnurapp:::.monitoreo_aulas_caidas_por_filtro(datos, cfg)
  por <- setNames(d, vapply(d, function(f) f$var, character(1)))

  # `caen` cuenta todas las que lo incumplen, se cumplan o no los demas.
  expect_identical(por$consentimiento$caen, 2L)   # la 3 y la 5
  expect_identical(por$publico$caen, 2L)          # la 4 y la 5

  # `solo_este` es lo accionable: arreglando ESE filtro, esas entran.
  expect_identical(por$consentimiento$solo_este, 1L)  # solo la 3
  expect_identical(por$publico$solo_este, 1L)         # solo la 4

  # Y la 5 no la salva ninguno de los dos por separado: `caen` suma 4 sobre 3
  # descartadas, que es justo la senal de que hay solapamiento.
  validas <- sum(prosecnurapp:::.monitoreo_aulas_valid_response(datos, cfg))
  expect_identical(as.integer(nrow(datos) - validas), 3L)
  expect_identical(sum(vapply(d, function(f) f$solo_este, integer(1))), 2L)
})

test_that("un filtro cuya columna no esta en la base no se cuenta como incumplido", {
  # Misma regla que `.monitoreo_aulas_valid_response()`: sin la columna el filtro
  # NO se aplica. Contarlo como que las 5 lo incumplen mandaria a arreglar una
  # variable que el estudio ni siquiera trae.
  datos <- data.frame(consentimiento = rep("si", 5), stringsAsFactors = FALSE)
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "consentimiento", values = list("si")),
    list(var = "columna_que_no_existe", values = list("x"))
  )))
  d <- prosecnurapp:::.monitoreo_aulas_caidas_por_filtro(datos, cfg)
  expect_identical(vapply(d, function(f) f$var, character(1)), "consentimiento")
})

test_that("el desglose viaja dentro del criterio, que es quien lo publica", {
  datos <- data.frame(consentimiento = c("si", "no"), stringsAsFactors = FALSE)
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "consentimiento", values = list("si"))
  )))
  cr <- monitoreo_aulas_criterio_validez(datos, cfg)
  expect_identical(cr$modo, "por_filtros")
  expect_identical(cr$por_filtro[[1]]$var, "consentimiento")
  expect_identical(cr$por_filtro[[1]]$caen, 1L)
})

test_that("el texto del criterio dice en cual condicion se cae, y ordena por la peor", {
  datos <- data.frame(
    consentimiento = c("si", "si", "no", "si", "si", "si"),
    publico        = c("alumno", "docente", "alumno", "docente", "docente", "alumno"),
    stringsAsFactors = FALSE
  )
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "consentimiento", values = list("si")),
    list(var = "publico", values = list("alumno"))
  )))
  txt <- monitoreo_aulas_criterio_texto(monitoreo_aulas_criterio_validez(datos, cfg))
  # 3 caen solo por publico, 1 solo por consentimiento.
  expect_match(txt, "De las 4 que no cuentan")
  # El que mas descarta va primero: es por donde se empieza a mirar.
  expect_match(txt, "3 por 'publico' · 1 por 'consentimiento'", fixed = TRUE)
})

test_that("las que fallan mas de una condicion se declaran aparte", {
  # Arreglar un filtro no las recupera, asi que repartirlas entre los dos
  # prometeria una ganancia que no existe.
  datos <- data.frame(
    consentimiento = c("si", "no", "no"),
    publico        = c("alumno", "alumno", "docente"),
    stringsAsFactors = FALSE
  )
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "consentimiento", values = list("si")),
    list(var = "publico", values = list("alumno"))
  )))
  txt <- monitoreo_aulas_criterio_texto(monitoreo_aulas_criterio_validez(datos, cfg))
  expect_match(txt, "1 por 'consentimiento'", fixed = TRUE)
  # Y concuerda en singular: «Las otras 1 fallan» es lo que sale de no mirarlo.
  expect_match(txt, "La otra falla más de una condición", fixed = TRUE)
})

test_that("sin descartadas no se anade la frase", {
  datos <- data.frame(consentimiento = c("si", "si"), stringsAsFactors = FALSE)
  cfg <- list(source_mapping = list(valid_filters = list(
    list(var = "consentimiento", values = list("si"))
  )))
  txt <- monitoreo_aulas_criterio_texto(monitoreo_aulas_criterio_validez(datos, cfg))
  expect_false(grepl("que no cuentan", txt, fixed = TRUE))
})
