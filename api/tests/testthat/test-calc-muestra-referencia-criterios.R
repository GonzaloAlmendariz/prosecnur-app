# La comparacion con el estudio anterior necesita el histórico de CRITERIOS,
# y el proyecto solo tenia el de asistencia.
#
# Medido en HSVG2026: de las 269 anclas de `criterios_anclas_historicas` —grano
# criterio x facultad, 15 criterios por 18 facultades— **252 dicen
# «incompatible» y solo 17 traen dato**, todas del mismo criterio
# (`enrolled_total`). Los otros catorce tienen CERO. La estanteria estaba y el
# dato no.
#
# Gonzalo, textual: «hay que separar criterios generales y luego el card de cada
# facultad con sus criterios especificos y todas sus cuentas y compararlos con el
# 2025, sus cuentas y sus metodos, tanto por card de facultad como por criterios
# generales».

.rc_ref <- function(...) {
  calc_muestra_referencia_criterios_normalizar(list(
    periodo = "2025-2", estudio = "HSVBG 2025",
    general = list(
      estadistico = "min(mediana, media)", n_diseno = 2500, sobremuestra = 1.5,
      seleccion = "sistematico k = N/n", tipo_docente_es_criterio = FALSE
    ),
    por_facultad = list(...)
  ))
}

.rc_fila <- function(f, ...) c(list(facultad = f), list(...))

test_that("la referencia normaliza sus filas y conserva el metodo general", {
  r <- .rc_ref(
    .rc_fila("LETRAS Y CIENCIAS HUMANAS", poblacion = 225, cuota = 25,
             aulas_sorteadas = 9, aulas_titulares = 4, piso_matriculados = 10),
    .rc_fila("CIENCIAS E INGENIERIA", poblacion = 4512, cuota = 523,
             aulas_sorteadas = 231, aulas_titulares = 39, piso_matriculados = 10)
  )
  expect_equal(r$schema, "calc_muestra_referencia_criterios_v1")
  expect_equal(length(r$por_facultad), 2L)
  expect_equal(r$periodo, "2025-2")
  # El metodo general viaja tal cual: es lo que permite comparar METODO y no
  # solo numeros.
  expect_false(r$general$tipo_docente_es_criterio)
  expect_equal(r$general$estadistico, "min(mediana, media)")
})

test_that("un campo ausente viaja como NA y NUNCA como 0", {
  # Un 0 se leeria como «medido y vale cero», que es otra afirmacion.
  r <- .rc_ref(.rc_fila("EDUCACION", poblacion = 197))
  f <- r$por_facultad[[1]]
  expect_equal(f$poblacion, 197)
  expect_true(is.na(f$aulas_titulares))
  expect_true(is.na(f$efectivas_logradas))
})

test_that("sin ninguna facultad utilizable la referencia es NULL", {
  # Una referencia vacia se leeria como «comparado y sin diferencias».
  expect_null(calc_muestra_referencia_criterios_normalizar(list(por_facultad = list())))
  expect_null(calc_muestra_referencia_criterios_normalizar(list()))
  expect_null(calc_muestra_referencia_criterios_normalizar(NULL))
  # Una fila sin nombre de facultad no cuenta.
  expect_null(calc_muestra_referencia_criterios_normalizar(
    list(por_facultad = list(list(poblacion = 100)))))
})

test_that("acepta un data.frame ademas de una lista de filas", {
  r <- calc_muestra_referencia_criterios_normalizar(list(por_facultad = data.frame(
    facultad = c("DERECHO", "GASTRONOMIA"), cuota = c(286, 16),
    stringsAsFactors = FALSE
  )))
  expect_equal(length(r$por_facultad), 2L)
  expect_equal(r$por_facultad[[1]]$cuota, 286)
})

test_that("la comparacion da hoy, antes y la diferencia POR FACULTAD", {
  ref <- .rc_ref(.rc_fila("LETRAS Y CIENCIAS HUMANAS", cuota = 25, aulas_titulares = 4))
  cmp <- calc_muestra_referencia_criterios_comparar(
    list(list(facultad = "LETRAS Y CIENCIAS HUMANAS", cuota = 26, aulas_titulares = 4)),
    ref
  )
  f <- cmp$filas[[1]]
  expect_true(cmp$con_referencia)
  expect_equal(f$campos$cuota$hoy, 26)
  expect_equal(f$campos$cuota$antes, 25)
  expect_equal(f$campos$cuota$delta, 1)
  expect_equal(f$campos$aulas_titulares$delta, 0)
})

test_that("empareja aunque el nombre venga con acentos o de otra forma", {
  ref <- .rc_ref(.rc_fila("GASTRONOMIA, HOTELERIA Y TURISMO", cuota = 16))
  cmp <- calc_muestra_referencia_criterios_comparar(
    list(list(facultad = "GASTRONOMÍA, HOTELERÍA Y TURISMO", cuota = 15)), ref)
  expect_equal(cmp$filas[[1]]$campos$cuota$delta, -1)
})

test_that("sin referencia el delta es NA, no 0", {
  # Publicar 0 inventaria una comparacion que no ocurrio.
  cmp <- calc_muestra_referencia_criterios_comparar(
    list(list(facultad = "DERECHO", cuota = 347)), NULL)
  f <- cmp$filas[[1]]
  expect_false(cmp$con_referencia)
  expect_equal(f$campos$cuota$hoy, 347)
  expect_true(is.na(f$campos$cuota$antes))
  expect_true(is.na(f$campos$cuota$delta))
  expect_false(f$en_el_estudio_anterior)
})

test_that("una facultad que existia antes y hoy no tiene aulas SALE igual", {
  # Es justo el caso que importa: callarla escondería la desaparicion.
  ref <- .rc_ref(.rc_fila("ARTES ESCENICAS", cuota = 70, aulas_titulares = 7))
  cmp <- calc_muestra_referencia_criterios_comparar(list(), ref)
  expect_equal(length(cmp$filas), 1L)
  f <- cmp$filas[[1]]
  expect_false(f$en_el_estudio_actual)
  expect_true(f$en_el_estudio_anterior)
  expect_equal(f$campos$cuota$antes, 70)
  expect_true(is.na(f$campos$cuota$hoy))
})

test_that("CONTROL: dos facultades distintas no se funden", {
  # Si el emparejamiento colapsara nombres parecidos —como paso truncando a 14
  # caracteres con las dos de Estudios Generales— toda la tabla mentiria.
  ref <- .rc_ref(
    .rc_fila("ESTUDIOS GENERALES LETRAS", cuota = 435),
    .rc_fila("ESTUDIOS GENERALES CIENCIAS", cuota = 424)
  )
  cmp <- calc_muestra_referencia_criterios_comparar(list(
    list(facultad = "ESTUDIOS GENERALES LETRAS", cuota = 389),
    list(facultad = "ESTUDIOS GENERALES CIENCIAS", cuota = 393)
  ), ref)
  expect_equal(length(cmp$filas), 2L)
  d <- vapply(cmp$filas, function(z) z$campos$cuota$delta, 1)
  expect_setequal(round(d), c(-46, -31))
})

# La referencia sale de la BASE, no de una entrada nueva.
#
# Gonzalo, textual: «el histórico sale de la base, ya tenemos todo un mecanismo
# que lo asimila». Es `POST /api/calc-muestra/asistencia/referencia`, que ya lee
# del libro del estudio anterior las hojas `cuotas` —facultad con su cuota total
# y por sexo— y `diseno` —las cifras únicas del estudio—, y hasta ahora sólo
# conservaba la parte de asistencia.

.rc_cuotas <- function() data.frame(
  facultad = c("ARQUITECTURA Y URBANISMO", "ARTE Y DISEÑO", "CIENCIAS E INGENIERIA"),
  cuota_total = c(123, 117, 523),
  cuota_mujeres = c(84, 91, 130),
  cuota_hombres = c(39, 26, 393),
  stringsAsFactors = FALSE
)

.rc_diseno <- function() data.frame(
  campo = c("poblacion_objetivo", "muestra", "ratio_sobremuestra", "metodo_seleccion"),
  valor = c("22234", "2500", "1.5", "Sistemático sobre el marco"),
  stringsAsFactors = FALSE
)

test_that("la hoja `cuotas` se traduce a las filas por facultad", {
  # Los nombres de la hoja no son los del schema: `cuota_total` es la cuota.
  r <- calc_muestra_referencia_criterios_desde_base(.rc_cuotas(), .rc_diseno(), "2025-2", "libro")
  expect_equal(length(r$por_facultad), 3L)
  f <- .cm_ref_crit_buscar(r, "CIENCIAS E INGENIERIA")
  expect_equal(f$cuota, 523)
  expect_equal(f$cuota_mujeres, 130)
  expect_equal(f$cuota_hombres, 393)
  # Lo que la hoja no trae sigue siendo NA, no 0.
  expect_true(is.na(f$aulas_titulares))
})

test_that("la hoja `diseno` viaja como el METODO general", {
  # Sin el método no se puede comparar «si se aplicaron los mismos criterios»,
  # que es la mitad que faltaba.
  r <- calc_muestra_referencia_criterios_desde_base(.rc_cuotas(), .rc_diseno())
  expect_equal(r$general$poblacion_objetivo, "22234")
  expect_equal(r$general$muestra, "2500")
  expect_equal(r$general$metodo_seleccion, "Sistemático sobre el marco")
})

test_that("sin hoja de cuotas no se inventa una referencia", {
  # Un libro sin `cuotas` no debe producir una comparación vacía que se lea como
  # «comparado y sin diferencias».
  expect_null(calc_muestra_referencia_criterios_desde_base(NULL))
  expect_null(calc_muestra_referencia_criterios_desde_base(data.frame()))
  expect_null(calc_muestra_referencia_criterios_desde_base(list()))
})

test_that("sin hoja de diseno la referencia sigue siendo util", {
  # Las cuentas por facultad valen aunque falte el método.
  r <- calc_muestra_referencia_criterios_desde_base(.rc_cuotas(), NULL)
  expect_equal(length(r$por_facultad), 3L)
  expect_equal(length(r$general), 0L)
})

test_that("acepta los nombres alternativos de la hoja de metas", {
  # El libro de metas usa `meta_muestra`/`meta_mujeres` en vez de `cuota_total`.
  metas <- data.frame(facultad = "EDUCACION", meta_muestra = 26, meta_mujeres = 21,
                      meta_hombres = 5, aulas_titulares = 4, stringsAsFactors = FALSE)
  r <- calc_muestra_referencia_criterios_desde_base(metas)
  f <- r$por_facultad[[1]]
  expect_equal(f$cuota, 26)
  expect_equal(f$cuota_mujeres, 21)
  expect_equal(f$aulas_titulares, 4)
})

test_that("el payload de estado publica la referencia de criterios", {
  # Un test del helper no protege la APLICACION: si nadie la colgara del
  # payload, la UI no la vería y los tests de arriba seguirían verdes.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  expect_null(.cm_state_payload(sid)$aulas$referencia_criterios)
  session_set(sid, "calc_muestra_referencia_criterios",
              calc_muestra_referencia_criterios_desde_base(.rc_cuotas(), .rc_diseno()))
  pub <- .cm_state_payload(sid)$aulas$referencia_criterios
  expect_equal(pub$schema, "calc_muestra_referencia_criterios_v1")
  expect_equal(length(pub$por_facultad), 3L)
})

test_that("guardar NO borra la referencia previa cuando la nueva viene vacia", {
  # Un libro sin hoja `cuotas` no debe llevarse por delante la comparación que
  # ya estaba.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  previa <- calc_muestra_referencia_criterios_desde_base(.rc_cuotas(), .rc_diseno())
  session_set(sid, "calc_muestra_referencia_criterios", previa)
  st <- session_get(sid)
  .cm_criterios_referencia_guardar(sid, st, list(schema = "x"), FALSE, NULL, NULL,
                                   referencia_criterios = NULL)
  expect_equal(length(.cm_state_payload(sid)$aulas$referencia_criterios$por_facultad), 3L)
})

# El rescate: una sesion que cargo el historico ANTES de que este bloque
# existiera se quedaba sin comparacion para siempre.
#
# Gonzalo, con HSVG2026 abierto y el libro de 2025 ya cargado: «¿por que dice
# todavia sin cargar si ya lo cargamos?». El dato estaba, en la referencia de
# ASISTENCIA que el mismo endpoint escribe.

.rc_asist <- function(filas = NULL, estudio = list(periodo = "2025-2", label = "HSVBG 2025")) {
  list(
    estudio = estudio,
    cuotas = list(
      unidad = "cumplimiento_de_cuota",
      filas = filas %||% list(
        list(facultad = "CIENCIAS E INGENIERIA", aulas = 231L, cuota_total = 523,
             cuota_mujeres = 130, cuota_hombres = 393, logradas = 512),
        list(facultad = "EDUCACION", aulas = 8L, cuota_total = 26,
             cuota_mujeres = 21, cuota_hombres = 5, logradas = 24)
      )
    )
  )
}

test_that("la referencia se rescata de la asistencia ya guardada", {
  r <- calc_muestra_referencia_criterios_desde_asistencia(.rc_asist())
  expect_equal(r$schema, "calc_muestra_referencia_criterios_v1")
  expect_equal(r$periodo, "2025-2")
  expect_equal(length(r$por_facultad), 2L)
  f <- .cm_ref_crit_buscar(r, "CIENCIAS E INGENIERIA")
  expect_equal(f$cuota, 523)
  expect_equal(f$cuota_mujeres, 130)
  expect_equal(f$efectivas_logradas, 512)
})

test_that("las aulas de la asistencia son las SORTEADAS, no los titulares", {
  # Llamarlas titulares inventaria una cifra que el libro no publica: en 2025 el
  # pool sorteado fue 1.097 y los titulares 170.
  f <- .cm_ref_crit_buscar(
    calc_muestra_referencia_criterios_desde_asistencia(.rc_asist()),
    "CIENCIAS E INGENIERIA"
  )
  expect_equal(f$aulas_sorteadas, 231)
  expect_true(is.na(f$aulas_titulares))
  # Lo que la asistencia no guarda sigue siendo NA, jamas 0.
  expect_true(is.na(f$piso_matriculados))
  expect_true(is.na(f$poblacion))
})

test_that("no se rescata un metodo general que nadie leyo", {
  # Publicar un metodo inventado haria que la tarjeta dijera «si, igual» sobre
  # decisiones que la asistencia no guarda.
  r <- calc_muestra_referencia_criterios_desde_asistencia(.rc_asist())
  expect_equal(length(r$general), 0L)
})

test_that("sin cuotas en la asistencia NO se inventa una referencia", {
  # `.cm_asist_cuotas` publica NA cuando el bloque no existe.
  expect_null(calc_muestra_referencia_criterios_desde_asistencia(list(cuotas = NA)))
  expect_null(calc_muestra_referencia_criterios_desde_asistencia(list()))
  expect_null(calc_muestra_referencia_criterios_desde_asistencia(NULL))
  expect_null(calc_muestra_referencia_criterios_desde_asistencia(
    list(cuotas = list(filas = list()))))
  # Una fila sin nombre de facultad no cuenta.
  expect_null(calc_muestra_referencia_criterios_desde_asistencia(
    .rc_asist(filas = list(list(aulas = 3L, cuota_total = 10)))))
})

test_that("el payload RESCATA la referencia cuando solo esta la de asistencia", {
  # Es la aplicacion, no el helper: si nadie lo colgara del payload la sesion de
  # Gonzalo seguiria diciendo «todavia sin cargar» y los tests de arriba
  # seguirian verdes.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  expect_null(.cm_state_payload(sid)$aulas$referencia_criterios)
  session_set(sid, "calc_muestra_referencia_asistencia", .rc_asist())
  pub <- .cm_state_payload(sid)$aulas$referencia_criterios
  expect_equal(pub$schema, "calc_muestra_referencia_criterios_v1")
  expect_equal(length(pub$por_facultad), 2L)
  expect_equal(pub$periodo, "2025-2")
})

test_that("la referencia GUARDADA gana sobre el rescate", {
  # El rescate es un piso, no un reemplazo: la que salio de las hojas `cuotas` y
  # `diseno` trae el metodo general, y perderlo seria una regresion.
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "calc_muestra_referencia_asistencia", .rc_asist())
  session_set(sid, "calc_muestra_referencia_criterios",
              calc_muestra_referencia_criterios_desde_base(.rc_cuotas(), .rc_diseno()))
  pub <- .cm_state_payload(sid)$aulas$referencia_criterios
  expect_equal(length(pub$por_facultad), 3L)
  expect_equal(pub$general$metodo_seleccion, "Sistemático sobre el marco")
})

# Segundo piso del rescate: la referencia de HSVG2026 es de un schema ANTERIOR y
# no tiene el bloque `cuotas` —tampoco `serie_campo` ni `cadenas_reemplazo`—.
# Lo que si sobrevivio son las quince filas de la dimension `facultad`.

.rc_asist_vieja <- function() list(
  estudio = list(periodo = "", label = "HSVBG2025_referencia_para_motor.xlsx"),
  dimensiones = list(
    list(dimension_key = "rango_horario", filas = list(list(celda_label = "Mañana", k = 4))),
    list(dimension_key = "facultad", dimension_label = "Facultad", filas = list(
      list(celda_key = "arquitectura_y_urbanismo", celda_label = "ARQUITECTURA Y URBANISMO",
           k = 7, matriculados = 267, asistentes = 215),
      list(celda_key = "estudios_generales_letras", celda_label = "ESTUDIOS GENERALES LETRAS",
           k = 23, matriculados = 1264, asistentes = 801)
    ))
  )
)

test_that("sin bloque `cuotas` el rescate cae a la dimension `facultad`", {
  r <- calc_muestra_referencia_criterios_desde_asistencia(.rc_asist_vieja())
  expect_equal(length(r$por_facultad), 2L)
  f <- .cm_ref_crit_buscar(r, "ARQUITECTURA Y URBANISMO")
  # 267 matriculados en 7 aulas medidas.
  expect_equal(round(f$alumnos_por_ch, 2), round(267 / 7, 2))
})

test_that("la `k` de la dimension NO se publica como aulas de ninguna clase", {
  # Son las aulas donde se MIDIO asistencia: en 2025 el pool sorteado fue 1.097,
  # los titulares 170 y las aplicadas 194. Ninguna de las tres es `k`.
  f <- .cm_ref_crit_buscar(
    calc_muestra_referencia_criterios_desde_asistencia(.rc_asist_vieja()),
    "ESTUDIOS GENERALES LETRAS"
  )
  expect_true(is.na(f$aulas_sorteadas))
  expect_true(is.na(f$aulas_titulares))
  expect_true(is.na(f$aulas_universo))
  # Y los matriculados de las aulas medidas NO son la poblacion de la facultad.
  expect_true(is.na(f$poblacion))
})

test_that("el bloque `cuotas` GANA sobre la dimension cuando ambos estan", {
  # El primer piso trae cuotas y efectivas; caer al segundo teniendo el primero
  # perderia datos sin avisar.
  mixta <- .rc_asist_vieja()
  mixta$cuotas <- .rc_asist()$cuotas
  r <- calc_muestra_referencia_criterios_desde_asistencia(mixta)
  expect_equal(length(r$por_facultad), 2L)
  expect_equal(.cm_ref_crit_buscar(r, "CIENCIAS E INGENIERIA")$cuota, 523)
})

test_that("una dimension `facultad` sin k utilizable no produce filas", {
  # Un k de 0 daria una division por cero disfrazada de estadistico.
  vacia <- .rc_asist_vieja()
  vacia$dimensiones[[2]]$filas <- list(
    list(celda_label = "EDUCACION", k = 0, matriculados = 100),
    list(celda_label = "", k = 5, matriculados = 100),
    list(celda_label = "DERECHO", k = 5)
  )
  expect_null(calc_muestra_referencia_criterios_desde_asistencia(vacia))
})

test_that("la `k` de la dimension se publica como aulas APLICADAS", {
  # 2025 declaro 170 titulares y APLICO 194: la diferencia son reemplazos. `k`
  # es lo aplicado, y publicarlo con su nombre propio es lo que permite comparar
  # contra lo que de verdad se hizo — contra el objetivo de la plantilla DERECHO
  # parecia -6 y contra lo aplicado es -1.
  r <- calc_muestra_referencia_criterios_desde_asistencia(.rc_asist_vieja())
  f <- .cm_ref_crit_buscar(r, "ARQUITECTURA Y URBANISMO")
  expect_equal(f$aulas_aplicadas, 7)
  expect_equal(f$asistentes, 215)
  # Y NO se disfraza de titulares ni de sorteadas, que son otras dos cifras.
  expect_true(is.na(f$aulas_titulares))
  expect_true(is.na(f$aulas_sorteadas))
})

# El bloque general se llena con lo que el estudio anterior HIZO.
#
# Su diseño en papel —n, deff, p, error, metodo de seleccion— no vive en el
# proyecto sino en el libro de calculo, asi que no se puede rescatar. Lo que si
# guarda la referencia de asistencia es lo ejecutado: `cobertura` trae las aulas
# agendadas y las aplicadas, y `global` las encuestas validas y la tasa.
#
# Medido en HSVG2026: 1.012 agendadas, 194 aplicadas, 3.303 validas, 69,7 %.

.rc_asist_ejecutada <- function(...) {
  base <- .rc_asist_vieja()
  base$cobertura <- list(agendados = 1012, aplicados = 194, observados = 194)
  base$global <- list(k = 194, matriculados = 7070, asistentes = 4931,
                      enviadas = 3698, validas = 3303, tasa = 0.697454031117397)
  modifyList(base, list(...))
}

test_that("el general trae lo ejecutado, con su nombre propio", {
  g <- calc_muestra_referencia_criterios_desde_asistencia(.rc_asist_ejecutada())$general
  expect_equal(g$aulas_dimensionadas, "194")
  expect_equal(g$aulas_agendadas, "1012")
  expect_equal(g$efectivas_logradas, "3303")
  expect_equal(g$tasa_asistencia, "69.7 %")
})

test_that("NO se rellenan las decisiones de diseño con un resultado", {
  # Llamar «muestra» a las 3.303 encuestas logradas seria bautizar una cifra con
  # el nombre de otra — el error que este trabajo ya cometio dos veces.
  g <- calc_muestra_referencia_criterios_desde_asistencia(.rc_asist_ejecutada())$general
  for (k in c("muestra", "ratio_sobremuestra", "deff", "estadistico", "metodo_seleccion",
              "aulas_marco", "tasa_respuesta_asumida")) {
    expect_null(g[[k]])
  }
})

test_that("sin cobertura ni global el general queda VACIO, no con ceros", {
  g <- calc_muestra_referencia_criterios_desde_asistencia(.rc_asist_vieja())$general
  expect_equal(length(g), 0L)
})

test_that("las aulas aplicadas caen a `global$k` si no hay cobertura", {
  sin_cob <- .rc_asist_ejecutada(cobertura = NULL)
  g <- calc_muestra_referencia_criterios_desde_asistencia(sin_cob)$general
  expect_equal(g$aulas_dimensionadas, "194")
  expect_null(g$aulas_agendadas)
})
