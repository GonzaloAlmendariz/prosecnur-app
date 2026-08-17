# Un criterio puesto en UNA facultad se cumple SOLO en esa facultad.
#
# Gonzalo: «si establezco un criterio específico para una facultad en particular,
# es un criterio que funciona exclusivamente para esa facultad, y habra otra
# facultad que tendra ligeramente otros criterios, y el embudo tiene que
# funcionar de forma adecuada».
#
# El mecanismo vive en `crit$exceptions[[faculty_key]]`
# (`calc_muestra_aulas_criterios.R` ~1184) con dos modos: `add` añade las
# categorias de esa facultad a las generales, y `replace` hace que esa facultad
# use SOLO las suyas. Nada protegia esa frontera: si la excepcion se filtrara a
# las demas facultades, el marco se llenaria de aulas que el diseño excluyo, y
# ningun test lo notaria.

.cpf_base <- function(por_aula = 20L) {
  do.call(rbind, lapply(1:8, function(i) {
    fac <- if (i <= 4L) "DERECHO" else "ARTES ESCENICAS"
    tipo <- if (i %% 2L == 0L) "TALLER" else "TEORICO"
    do.call(rbind, lapply(seq_len(por_aula), function(j) data.frame(
      student_id = paste0("e", (i - 1L) * por_aula + j), aula_id = sprintf("A%02d", i),
      curso_id = paste0("C", i), curso = paste("Curso", i), horario = "L 8",
      facultad = fac, programa = "P1", sexo = "F", edad = 20,
      condicion = "regular", nivel = "pregrado", modalidad = "presencial",
      tipo_sesion = tipo, stringsAsFactors = FALSE
    )))
  }))
}

.cpf_frame <- function(exceptions = list()) {
  calc_muestra_aulas_construir(
    base_madre = .cpf_base(),
    config = list(
      mapping = list(session_type = "tipo_sesion"),
      filters = list(min_eligible_per_class = 5L),
      criterios_seleccion = list(byVariable = list(session_type = list(
        scope = "aula", kind = "flat", mode = "include", match = "any",
        categories = "teorico", exceptions = exceptions
      )))
    )
  )
}

.cpf_tabla <- function(fr) {
  af <- fr$aula_frame
  inc <- af[af$included %in% TRUE, , drop = FALSE]
  function(facultad, tipo) sum(inc$faculty == facultad & inc$session_type == tipo)
}

test_that("sin excepciones el criterio general rige en las dos facultades", {
  # Control: si esto ya trajera talleres, el test de abajo pasaria sin medir.
  n <- .cpf_tabla(.cpf_frame())
  expect_equal(n("DERECHO", "TEORICO"), 2L)
  expect_equal(n("ARTES ESCENICAS", "TEORICO"), 2L)
  expect_equal(n("DERECHO", "TALLER"), 0L)
  expect_equal(n("ARTES ESCENICAS", "TALLER"), 0L)
})

test_that("una excepcion abre la categoria SOLO en su facultad", {
  n <- .cpf_tabla(.cpf_frame(list(
    artes_escenicas = list(categories = "taller", op = "add")
  )))
  # Entra en la facultad que la declaro...
  expect_equal(n("ARTES ESCENICAS", "TALLER"), 2L)
  # ...y NO se filtra a la otra. Esta es la frontera que el test protege.
  expect_equal(n("DERECHO", "TALLER"), 0L)
  # Y el criterio general sigue rigiendo en ambas.
  expect_equal(n("DERECHO", "TEORICO"), 2L)
  expect_equal(n("ARTES ESCENICAS", "TEORICO"), 2L)
})

test_that("`replace` deja a esa facultad SOLO con sus categorias", {
  # `add` suma a las generales; `replace` las sustituye. Con replace, Artes
  # Escenicas se queda con taller y PIERDE teorico, mientras Derecho no se entera.
  n <- .cpf_tabla(.cpf_frame(list(
    artes_escenicas = list(categories = "taller", op = "replace")
  )))
  expect_equal(n("ARTES ESCENICAS", "TALLER"), 2L)
  expect_equal(n("ARTES ESCENICAS", "TEORICO"), 0L)
  expect_equal(n("DERECHO", "TEORICO"), 2L)
  expect_equal(n("DERECHO", "TALLER"), 0L)
})

test_that("una excepcion de una facultad que no existe no altera el marco", {
  # Un nombre mal escrito no debe abrir la categoria en todas por descuido.
  n <- .cpf_tabla(.cpf_frame(list(
    facultad_inexistente = list(categories = "taller", op = "add")
  )))
  expect_equal(n("DERECHO", "TALLER"), 0L)
  expect_equal(n("ARTES ESCENICAS", "TALLER"), 0L)
})

# `exenta`: el criterio NO APLICA en esa facultad.
#
# Gonzalo, textual: «siento que los criterios los sigue aplicando de forma
# general, por ejemplo creo que perdemos muchas aulas con el criterio de nivel;
# al 80 % en los estudios generales letras y ciencias no deberia tenerlos».
# Medido en HSVG2026: el criterio de nivel del curso se llevaba el **94 %** de
# las aulas de EE.GG. LETRAS (455 de 482) y esa facultad se quedaba con 20 aulas
# elegibles necesitando 35.
#
# Con `replace` se podria imitar enumerando TODAS las categorias validas, pero
# eso congela la lista: una categoria nueva quedaria fuera en silencio, y el
# analista no escribio «solo estas», escribio «aqui no aplica».

test_that("`exenta` deja pasar la facultad entera y no toca a las demas", {
  n <- .cpf_tabla(.cpf_frame(list(
    artes_escenicas = list(op = "exenta")
  )))
  # La facultad exenta conserva TODO, incluido lo que el criterio general excluye.
  expect_equal(n("ARTES ESCENICAS", "TALLER"), 2L)
  expect_equal(n("ARTES ESCENICAS", "TEORICO"), 2L)
  # Y el criterio general sigue recortando en la otra: una exencion no es un
  # apagado global.
  expect_equal(n("DERECHO", "TALLER"), 0L)
  expect_equal(n("DERECHO", "TEORICO"), 2L)
})

test_that("`exenta` NO necesita declarar categorias", {
  # Es la diferencia con `replace`: decir «aqui no aplica» sin enumerar nada.
  sin_cats <- .cpf_tabla(.cpf_frame(list(artes_escenicas = list(op = "exenta"))))
  con_cats <- .cpf_tabla(.cpf_frame(list(
    artes_escenicas = list(op = "exenta", categories = "teorico")
  )))
  # Las categorias declaradas se ignoran: exenta es exenta.
  expect_equal(sin_cats("ARTES ESCENICAS", "TALLER"), 2L)
  expect_equal(con_cats("ARTES ESCENICAS", "TALLER"), 2L)
})

test_that("un `op` desconocido cae a `add`, nunca a exenta", {
  # Un typo no puede desactivar un criterio en silencio: seria el fallo mas caro
  # posible de esta funcion.
  n <- .cpf_tabla(.cpf_frame(list(
    artes_escenicas = list(op = "exsenta", categories = "taller")
  )))
  expect_equal(n("ARTES ESCENICAS", "TALLER"), 2L)
  expect_equal(n("ARTES ESCENICAS", "TEORICO"), 2L)
  # CONTROL: sin categorias, un op desconocido no exime a nadie.
  m <- .cpf_tabla(.cpf_frame(list(artes_escenicas = list(op = "apagado"))))
  expect_equal(m("ARTES ESCENICAS", "TALLER"), 0L)
})

# Exencion del criterio de NIVEL DEL CURSO, que es `kind = "range"` y no pasa por
# `byVariable`.
#
# Gonzalo: «los niveles en todas las facultades deben ser de dos a 10, no ciclo 1
# ni 11 u 12» — pero «en los estudios generales letras y ciencias no deberia
# tenerlos». Medido en HSVG2026: declarada la exencion de EE.GG. LETRAS con el
# rango 1-99, la facultad quedaba igual con 63 de 482 aulas y `course_level` como
# razon en 316. La causa son DOS universos de «facultad» con el mismo nombre: la
# regla se declara contra la facultad DEL AULA —la que muestra la UI— y el
# evaluador la juzgaba contra los pares (facultad del CURSO en el catalogo,
# nivel); un curso de Estudios Generales esta catalogado bajo la facultad de
# DESTINO del alumno, asi que la regla de EE.GG. no llegaba a aplicarse.

.clr_pairs <- function(fac_curso, nivel) {
  paste0(fac_curso, .cm_catalogo_pair_fld, nivel)
}

test_that("una facultad EXENTA pasa aunque su curso este catalogado en otra", {
  # El aula es de EE.GG. LETRAS y su curso figura bajo DERECHO con nivel 1, que
  # el rango de Derecho (2-10) rechaza. La exencion del AULA manda.
  ranges <- list(derecho = list(list(min = 2, max = 10)),
                 estudios_generales_letras = .cm_criterios_rango_exento)
  ok <- .cm_criterios_eval_course_ranges(
    course_pairs = c(.clr_pairs("DERECHO", 1), .clr_pairs("DERECHO", 1)),
    ranges = ranges,
    faculty_keys = c("ESTUDIOS GENERALES LETRAS", "DERECHO")
  )
  expect_true(ok[[1]])
  # CONTROL: la de Derecho sigue recortada. Una exencion no es un apagado global.
  expect_false(ok[[2]])
})

test_that("sin exencion el rango rige por la facultad del CURSO", {
  # Es el comportamiento previo y no debe cambiar.
  ranges <- list(derecho = list(list(min = 2, max = 10)))
  ok <- .cm_criterios_eval_course_ranges(
    course_pairs = c(.clr_pairs("DERECHO", 1), .clr_pairs("DERECHO", 5)),
    ranges = ranges,
    faculty_keys = c("DERECHO", "DERECHO")
  )
  expect_false(ok[[1]])
  expect_true(ok[[2]])
})

test_that("el marcador de exencion se acepta en las tres formas", {
  for (entrada in list("exenta", list("exenta"), list(exenta = TRUE))) {
    r <- .cm_criterios_normalize_nivel_por_unidad(list(estudios_generales_letras = entrada))
    expect_true(.cm_criterios_es_rango_exento(r$estudios_generales_letras))
  }
  # CONTROL: un rango normal NO se lee como exencion.
  r <- .cm_criterios_normalize_nivel_por_unidad(list(derecho = list(list(min = 2, max = 10))))
  expect_false(.cm_criterios_es_rango_exento(r$derecho))
  expect_equal(r$derecho[[1]]$min, 2)
})

test_that("una exencion NO se confunde con «sin rango declarado»", {
  # Sin rango la facultad se EXCLUYE (comportamiento vigente); exenta PASA. Si el
  # centinela fuera una lista vacia, las dos cosas serian la misma y una
  # exencion borraria la facultad en vez de salvarla.
  ok <- .cm_criterios_eval_course_ranges(
    course_pairs = c(.clr_pairs("GASTRONOMIA", 1), .clr_pairs("GASTRONOMIA", 1)),
    ranges = list(derecho = list(list(min = 2, max = 10)),
                  gastronomia = .cm_criterios_rango_exento),
    faculty_keys = c("SIN DECLARAR", "GASTRONOMIA")
  )
  expect_false(ok[[1]])
  expect_true(ok[[2]])
})

test_that("la etiqueta del paso NOMBRA a las facultades exentas", {
  # Si el criterio no juzga a una facultad, quien lee el paso debe enterarse.
  et <- .cm_criterios_label_course_level(
    list(estudios_generales_letras = .cm_criterios_rango_exento),
    list(label = "Nivel del curso")
  )
  expect_true(grepl("exenta", et, fixed = TRUE))
})

test_that("la exencion sobrevive a normalizar DOS veces", {
  # El config se normaliza mas de una vez —el router y el constructor lo hacen
  # por separado— y el centinela tiene que reconocerse a si mismo. Sin esto la
  # segunda pasada no lo veia como exencion, no le encontraba min/max y la clave
  # DESAPARECIA del mapa; y sin rango declarado el evaluador EXCLUYE, asi que
  # declarar una exencion borraba la facultad. Medido contra HSVG2026: mande 15
  # facultades y el motor guardo 13.
  una <- .cm_criterios_normalize_nivel_por_unidad(list(egl = "exenta"))
  dos <- .cm_criterios_normalize_nivel_por_unidad(una)
  tres <- .cm_criterios_normalize_nivel_por_unidad(dos)
  expect_equal(length(una), 1L)
  expect_equal(length(dos), 1L)
  expect_equal(length(tres), 1L)
  expect_true(.cm_criterios_es_rango_exento(tres$egl))
  # CONTROL: un rango normal tambien sobrevive, y sigue siendo un rango.
  rr <- .cm_criterios_normalize_nivel_por_unidad(
    .cm_criterios_normalize_nivel_por_unidad(list(derecho = list(list(min = 2, max = 10))))
  )
  expect_false(.cm_criterios_es_rango_exento(rr$derecho))
  expect_equal(rr$derecho[[1]]$max, 10)
})

test_that("EXTREMO A EXTREMO: la facultad exenta conserva su primer ciclo", {
  # Gonzalo: «los niveles en todas las facultades deben ser de dos a 10, no ciclo
  # 1 ni 11 u 12» pero «en los estudios generales letras y ciencias no deberia
  # tenerlos». Es la unica prueba que atraviesa el constructor entero, que es
  # donde se perdia: el evaluador aislado ya daba TRUE mientras el marco real
  # dejaba a EE.GG. LETRAS en cero.
  base <- do.call(rbind, lapply(1:4, function(i) do.call(rbind, lapply(1:12, function(j) data.frame(
    student_id = paste0("e", i, "_", j), aula_id = sprintf("A%02d", i),
    curso_id = paste0("C", i), curso = paste("Curso", i), horario = "L 8",
    facultad = if (i <= 2L) "ESTUDIOS GENERALES LETRAS" else "DERECHO",
    programa = "P1", sexo = "F", edad = 20, condicion = "regular",
    nivel = "pregrado", modalidad = "presencial", tipo_sesion = "TEORICO",
    nivel_curso = if (i %% 2L == 0L) 1 else 5, stringsAsFactors = FALSE
  )))))
  af <- calc_muestra_aulas_construir(base_madre = base, config = list(
    mapping = list(session_type = "tipo_sesion", course_level = "nivel_curso"),
    filters = list(min_eligible_per_class = 5L),
    criterios_seleccion = list(courseLevelRanges = list(
      derecho = list(list(min = 2, max = 10)),
      estudios_generales_letras = "exenta"
    ))
  ))$aula_frame
  inc <- function(id) af$included[af$classroom_id == id]
  expect_true(inc("A01"))   # EE.GG. nivel 5
  expect_true(inc("A02"))   # EE.GG. nivel 1 — el que la exencion salva
  expect_true(inc("A03"))   # Derecho nivel 5, dentro de su rango
  expect_false(inc("A04"))  # Derecho nivel 1 — el criterio SIGUE recortando
})
