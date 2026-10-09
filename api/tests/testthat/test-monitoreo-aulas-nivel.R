# =============================================================================
# El nivel de una respuesta se resuelve por su PERSONA, no por su aula
# =============================================================================
#
# Es el cambio de modelo del eje «nivel», y el ADR 0079 había escrito lo
# contrario como supuesto: «la atribución es por aula del plan y no por
# auto-reporte». Con una persona que tiene un solo nivel, el aula donde
# respondió no lo determina.
#
# Lo que estas pruebas fijan:
#   - sin columna declarada, NADA resuelve (no se adivina la llave);
#   - sin cruce no hay nivel, y no hay respaldo al ciclo autodeclarado;
#   - los tres motivos de «sin nivel» se distinguen, porque son tres arreglos;
#   - la celda cuenta PERSONAS: el duplicado se marca y se publica;
#   - y una huérfana con código resoluble no consume la primera aparición de su
#     persona, que es la trampa del orden de prioridad.

.tn_padron <- function() list(
  schema = "monitoreo_aulas_padron_v1",
  filas = list(
    list(codigo = "20191234", nivel = 7L, carrera = "ECONOMÍA", sexo = "F"),
    list(codigo = "20205678", nivel = 9L, carrera = "SOCIOLOGÍA", sexo = "M"),
    # Una persona que está en el padrón pero cuyo nivel quedó ilegible al
    # cargarlo: está, y aun así no acredita celda.
    list(codigo = "20213333", nivel = NA_integer_, carrera = "ANTROPOLOGÍA", sexo = "F")
  )
)

.tn_cfg <- function(var = "P1_codigo") {
  list(source_mapping = list(student_code_var = var))
}

.tn_resp <- function(codigos) data.frame(P1_codigo = codigos, stringsAsFactors = FALSE)

test_that("sin columna declarada no resuelve ninguna, y el motivo lo dice", {
  # A diferencia del sexo, aquí NO hay busqueda por nombre de respaldo: una
  # columna adivinada que resulte ser otra cosa no falla, resuelve a cero y deja
  # el eje midiendo vacio.
  r <- monitoreo_aulas_nivel_por_respuesta(.tn_resp(c("20191234", "20205678")),
                                           .tn_padron(), list())
  expect_false(any(r$resuelto))
  expect_identical(unique(r$motivo), "sin_codigo_declarado")
  expect_identical(monitoreo_aulas_columna_codigo(.tn_resp("x"), list()), "")
})

test_that("la columna del codigo declarada sobrevive al normalizador", {
  # La lista blanca de `source_mapping` es CERRADA y el engine re-normaliza en
  # cada pase. Sin nombrar los dos campos ahi, declararlos en la pantalla no
  # sobreviviria al primer «actualizar» y el eje «nivel» se quedaria mudo sin
  # que nadie supiera por que. Es el defecto que ya se comio `sex_var` y
  # `faculty_var`, y por eso se prueba el SEGUNDO pase.
  cfg <- monitoreo_aulas_normalize_config(list(
    source_mapping = list(student_code_var = "P1_codigo",
                          student_code_label = "Código PUCP")))
  expect_identical(cfg$source_mapping$student_code_var, "P1_codigo")
  expect_identical(cfg$source_mapping$student_code_label, "Código PUCP")

  otra_vez <- monitoreo_aulas_normalize_config(cfg)
  expect_identical(otra_vez$source_mapping$student_code_var, "P1_codigo")
  # Y que sirva de verdad tras el segundo pase, no solo que este presente.
  expect_identical(monitoreo_aulas_columna_codigo(.tn_resp("x"), otra_vez), "P1_codigo")
})

test_that("un estudio que no declara el codigo sale con el campo vacio, no ausente", {
  cfg <- monitoreo_aulas_normalize_config(list())
  expect_identical(cfg$source_mapping$student_code_var, "")
})

test_that("resuelve nivel, carrera y sexo de la persona", {
  r <- monitoreo_aulas_nivel_por_respuesta(.tn_resp(c("20191234", "20205678")),
                                           .tn_padron(), .tn_cfg())
  expect_true(all(r$resuelto))
  expect_identical(r$nivel, c(7L, 9L))
  expect_identical(r$carrera, c("ECONOMÍA", "SOCIOLOGÍA"))
  expect_identical(r$sexo, c("F", "M"))
  expect_identical(unique(r$motivo), "")
})

test_that("el codigo se encuentra aunque venga con espacios o guiones", {
  # El padron guarda «20191234»; la persona escribe « 2019-1234 ». Si las dos
  # puntas no normalizan igual, la respuesta cae a la bolsa por un guion.
  r <- monitoreo_aulas_nivel_por_respuesta(.tn_resp(c(" 20191234 ", "2020-5678")),
                                           .tn_padron(), .tn_cfg())
  expect_true(all(r$resuelto))
  expect_identical(r$nivel, c(7L, 9L))
})

test_that("los tres motivos de «sin nivel» se distinguen", {
  # Son tres problemas distintos: los dos primeros son de campo —nadie puso el
  # codigo, o puso cualquier cosa— y el tercero puede ser padron incompleto,
  # que se arregla en la oficina.
  r <- monitoreo_aulas_nivel_por_respuesta(
    .tn_resp(c("", "abc", "20999999", "20191234")), .tn_padron(), .tn_cfg())
  expect_identical(r$motivo, c("sin_codigo_declarado", "codigo_ilegible",
                               "codigo_no_en_padron", ""))
  expect_identical(r$resuelto, c(FALSE, FALSE, FALSE, TRUE))
})

test_that("estar en el padron sin nivel legible no acredita celda", {
  r <- monitoreo_aulas_nivel_por_respuesta(.tn_resp("20213333"), .tn_padron(), .tn_cfg())
  expect_false(r$resuelto[[1]])
  expect_true(is.na(r$nivel[[1]]))
  # La carrera SI se conoce: la persona esta en el padron. Lo que falta es el
  # nivel, y eso es lo que impide acreditar.
  expect_identical(r$carrera[[1]], "ANTROPOLOGÍA")
})

test_that("sin padron, lo legible queda en «no esta en el padron», no en «ilegible»", {
  # Decir «ilegible» mandaria a revisar los codigos cuando lo que falta es la
  # tabla. El diagnostico de arriba es el que dice que el padron no esta.
  r <- monitoreo_aulas_nivel_por_respuesta(.tn_resp(c("20191234", "x")),
                                           list(), .tn_cfg())
  expect_identical(r$motivo, c("codigo_no_en_padron", "codigo_ilegible"))
  expect_false(any(r$resuelto))
})

test_that("no hay respaldo al ciclo autodeclarado", {
  # Decision tomada: sin cruce no hay nivel. Aunque la respuesta traiga su
  # ciclo, el resolutor no lo mira — una celda alimentada por auto-reporte sin
  # verificar es peor que una bolsa declarada.
  resp <- data.frame(P1_codigo = "20999999", A1_ciclo = "7", stringsAsFactors = FALSE)
  r <- monitoreo_aulas_nivel_por_respuesta(resp, .tn_padron(), .tn_cfg())
  expect_false(r$resuelto[[1]])
  expect_true(is.na(r$nivel[[1]]))
})

test_that("la celda cuenta personas: la segunda respuesta de alguien se marca", {
  r <- monitoreo_aulas_nivel_por_respuesta(
    .tn_resp(c("20191234", "20205678", "20191234")), .tn_padron(), .tn_cfg())
  dup <- monitoreo_aulas_nivel_duplicado(r)
  # Se conserva la PRIMERA en orden de llegada; la tercera es repeticion.
  expect_identical(dup, c(FALSE, FALSE, TRUE))
})

test_that("una huerfana con codigo resoluble NO consume la primera aparicion", {
  # La trampa del orden de prioridad. Si la deduplicacion corriera antes del
  # paso del aula, la respuesta huerfana se quedaria la primera aparicion de su
  # persona y la que SI acredita quedaria marcada como duplicada: la celda
  # perderia una persona real.
  r <- monitoreo_aulas_nivel_por_respuesta(
    .tn_resp(c("20191234", "20191234")), .tn_padron(), .tn_cfg())
  # La primera es huerfana (no paso el paso del aula), la segunda si.
  dup <- monitoreo_aulas_nivel_duplicado(r, elegible = c(FALSE, TRUE))
  expect_identical(dup, c(FALSE, FALSE))
})

test_that("el diagnostico publica la tasa y los motivos con casos", {
  r <- monitoreo_aulas_nivel_por_respuesta(
    .tn_resp(c("20191234", "20205678", "20191234", "", "20999999")),
    .tn_padron(), .tn_cfg())
  d <- monitoreo_aulas_nivel_diagnostico(r)
  expect_identical(d$consideradas, 5L)
  expect_identical(d$resueltas, 2L)     # personas distintas que acreditan
  expect_identical(d$duplicadas, 1L)
  expect_identical(d$sin_nivel, 2L)
  # La suma tiene que cerrar: es el invariante que hace auditable la cifra.
  expect_identical(d$resueltas + d$duplicadas + d$sin_nivel, d$consideradas)
  expect_identical(d$por_motivo$sin_codigo_declarado, 1L)
  expect_identical(d$por_motivo$codigo_no_en_padron, 1L)
  # Un motivo sin casos no aparece: un cero por cada motivo es ruido.
  expect_null(d$por_motivo$codigo_ilegible)
})

test_that("el diagnostico sobre cero respuestas no inventa una tasa", {
  d <- monitoreo_aulas_nivel_diagnostico(data.frame())
  expect_identical(d$consideradas, 0L)
  expect_true(is.na(d$tasa))
  expect_identical(d$por_motivo, list())
})

test_that("la tasa de resolucion es la cifra que delata una columna mal declarada", {
  # Es la devolucion que hace posible confiar en el padron, y el mismo criterio
  # que el cruce de facultad declarada ya usa: un mapeo bueno coincide casi
  # todo, uno corrido coincide cero.
  bien <- monitoreo_aulas_nivel_por_respuesta(
    .tn_resp(c("20191234", "20205678")), .tn_padron(), .tn_cfg())
  expect_identical(monitoreo_aulas_nivel_diagnostico(bien)$tasa, 1)

  # La columna declarada existe pero trae otra cosa (el nombre del curso).
  mal <- monitoreo_aulas_nivel_por_respuesta(
    data.frame(P1_codigo = c("ECONOMETRIA", "ANTROPOLOGIA"), stringsAsFactors = FALSE),
    .tn_padron(), .tn_cfg())
  expect_identical(monitoreo_aulas_nivel_diagnostico(mal)$tasa, 0)
})
