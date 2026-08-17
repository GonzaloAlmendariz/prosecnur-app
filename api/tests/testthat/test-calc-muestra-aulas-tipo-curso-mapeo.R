# La columna que define el marco se llama «Tipo Curso» y no la reconociamos.
#
# El criterio que construyo el marco de 2025 es el tipo de curso: de las 5.262
# aulas del semestre, 3.699 son presenciales Y teoricas, y el resto —2.523 de
# laboratorio, 2.117 talleres, 928 seminarios, 180 actividades, 166 asesorias,
# 106 artisticos, 96 cursos de investigacion y 36 trabajos de tesis— quedan
# fuera. Es el filtro mas fuerte del embudo despues de la modalidad.
#
# La base madre real lo trae en la columna **`Tipo Curso`** —sin «de»— y el
# catalogo en **`Tipo de curso`**. Los candidatos por defecto de `session_type`
# eran `session_type, tipo_sesion, tipo_clase, actividad`: ninguno coincide, asi
# que la columna llegaba VACIA en las 5.263 aulas del proyecto real y el criterio
# no se podia declarar.
#
# `calc_muestra_aulas_catalogo.R` ya habia visto la mitad del problema y lo dejo
# fuera de alcance con una nota: «el fix de la whitelist del workspace ya cura el
# paso tipo y la base real trae la señal; leer la columna Tipo del catalogo
# requeriria ademas sumar tipo_curso/tipo_de_curso a los candidatos default de
# session_type». La premisa era falsa: medido sobre el proyecto real, la base
# trae la columna y el motor no la leia.
#
# Ojo con `actividad`, que ya estaba en la lista: ACTIVIDAD es un VALOR de esta
# misma columna, no un nombre de columna.

.tcm_base <- function(col, tipos = c("TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)", "TALLER")) {
  filas <- do.call(rbind, lapply(seq_along(tipos), function(i) {
    data.frame(
      student_id = paste0("e", (i - 1L) * 20L + seq_len(20)),
      classroom_id = paste0("A", i), curso = "C1", horario = "L 8",
      facultad = "DERECHO", programa = "P1", sexo = "F", edad = 20,
      condicion = "regular", nivel = "pregrado", modalidad = "PRESENCIAL",
      tipo = tipos[[i]], stringsAsFactors = FALSE
    )
  }))
  names(filas)[names(filas) == "tipo"] <- col
  filas
}

.tcm_frame <- function(col) {
  calc_muestra_aulas_construir(
    base_madre = .tcm_base(col),
    config = list(filters = list(min_eligible_per_class = 5L))
  )
}

.tcm_tipos <- function(col) {
  v <- .tcm_frame(col)$aula_frame$session_type
  sort(as.character(v[nzchar(trimws(as.character(v)))]))
}

test_that("«Tipo Curso» —el nombre de la base real— llega a session_type", {
  # Sin esto el criterio que define el marco no se puede declarar.
  expect_equal(
    .tcm_tipos("Tipo Curso"),
    c("TALLER", "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)")
  )
})

test_that("«Tipo de curso» —el nombre del catalogo— tambien llega", {
  expect_equal(
    .tcm_tipos("Tipo de curso"),
    c("TALLER", "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)")
  )
})

test_that("los nombres que ya funcionaban siguen funcionando", {
  # Control: si el mapeo se hubiera roto al ampliarlo, esto lo dice.
  for (col in c("session_type", "tipo_sesion", "tipo_clase")) {
    expect_equal(
      .tcm_tipos(col),
      c("TALLER", "TEORICO(TEORICO-PRACTICO,TEORICO-LABORATORIO)"),
      info = col
    )
  }
})

test_that("una columna ajena NO se toma por tipo de curso", {
  # Control del control: si cualquier columna entrara, los tests de arriba
  # pasarian sin probar que el mapeo reconoce estos nombres en concreto.
  expect_equal(.tcm_tipos("Sabor Favorito"), character(0))
})

test_that("con el tipo leido, el criterio de tipo de curso recorta de verdad", {
  # El paso del embudo de 2025: presencial Y teorico. Antes no podia declararse
  # porque la columna llegaba vacia; un criterio sobre una columna vacia no
  # excluye a nadie y el marco se quedaba con las dos aulas.
  fr <- calc_muestra_aulas_construir(
    base_madre = .tcm_base("Tipo Curso"),
    config = list(
      filters = list(min_eligible_per_class = 5L),
      criterios_seleccion = list(byVariable = list(session_type = list(
        scope = "aula", kind = "flat", mode = "include", match = "any",
        categories = "teorico teorico practico teorico laboratorio"
      )))
    )
  )
  af <- fr$aula_frame
  inc <- af[af$included %in% TRUE, , drop = FALSE]
  expect_equal(nrow(inc), 1L)
  expect_true(grepl("^TEORICO", inc$session_type[[1]]))
})
