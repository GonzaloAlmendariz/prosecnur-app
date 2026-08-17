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
  expect_null(.cm_state_payload(sid)$referencia_criterios)
  session_set(sid, "calc_muestra_referencia_criterios",
              calc_muestra_referencia_criterios_desde_base(.rc_cuotas(), .rc_diseno()))
  pub <- .cm_state_payload(sid)$referencia_criterios
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
  expect_equal(length(.cm_state_payload(sid)$referencia_criterios$por_facultad), 3L)
})
