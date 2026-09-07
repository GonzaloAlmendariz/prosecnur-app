# El día, la hora y el aula que el catálogo ya decía.
#
# Estas pruebas existen porque las tres casillas de la ficha de campo —«Pabellón
# y aula», «Horario del curso»— salían en blanco sobre un marco que SÍ traía el
# dato, dentro de la columna `SESIONES` del catálogo de cursos-horarios.
#
# La gramática está medida, no supuesta: sobre el libro de HSVG2026, las 30.207
# sesiones sueltas casan `DIA HH:MM-HH:MM  <tipo>  [aula]`.

test_that("una sesión se parte en horario y aula", {
  p <- calc_muestra_aulas_sesiones_partes("MIE 17:00-20:00 C  A506")
  expect_equal(p$horario, "MIE 17:00-20:00")
  expect_equal(p$aula, "A506")
})

test_that("la letra de tipo de sesión NO es el aula", {
  # Regresión: la primera versión resolvía esto con una sola expresión regular y
  # devolvía «C  A506». Imprimir «C» bajo el rótulo «Pabellón y aula» es peor que
  # dejar la raya en blanco, porque parece un dato.
  p <- calc_muestra_aulas_sesiones_partes("MIE 07:00-09:00 H  LFIA")
  expect_equal(p$aula, "LFIA")
  expect_false(grepl("^[A-Z] ", p$aula))
})

test_that("un curso sin aula asignada devuelve aula vacía, no el tipo", {
  p <- calc_muestra_aulas_sesiones_partes("MAR 10:00-12:00 C")
  expect_equal(p$horario, "MAR 10:00-12:00")
  expect_equal(p$aula, "")
})

test_that("el 0000 del catálogo es un hueco, no un aula", {
  # Es el placeholder con forma de dato: llega a la ficha impresa como si fuera
  # un aula real y manda al aplicador a un sitio que no existe.
  expect_equal(calc_muestra_aulas_sesiones_partes("LUN 16:00-19:00 C  0000")$aula, "")
})

test_that("varias sesiones se unen sin repetir y en orden", {
  p <- calc_muestra_aulas_sesiones_partes(
    "LUN 16:00-18:00 C  L101<br />MIE 16:00-18:00 C  L220"
  )
  # Los dos días comparten franja, así que la hora se dice una vez.
  expect_equal(p$horario, "LUN y MIE 16:00-18:00")
  expect_equal(p$aula, "L101 · L220")

  repetida <- calc_muestra_aulas_sesiones_partes(
    "MIE 10:00-12:00 C  L401<br />VIE 10:00-12:00 C  L401"
  )
  expect_equal(repetida$aula, "L401")
})

test_that("lo que no casa la gramática pasa entero como horario y no inventa aula", {
  p <- calc_muestra_aulas_sesiones_partes("A CONVENIR CON EL DOCENTE")
  expect_equal(p$horario, "A CONVENIR CON EL DOCENTE")
  expect_equal(p$aula, "")
})

test_that("vacío y NA no producen dato", {
  for (x in list("", NA, NA_character_, NULL)) {
    p <- calc_muestra_aulas_sesiones_partes(x)
    expect_equal(p$horario, "")
    expect_equal(p$aula, "")
  }
})

test_that("la versión vectorial respeta el largo y el orden", {
  v <- c("MIE 17:00-20:00 C  A506", "", "MAR 10:00-12:00 C")
  expect_equal(calc_muestra_aulas_sesiones_columna(v, "aula"), c("A506", "", ""))
  expect_equal(
    calc_muestra_aulas_sesiones_columna(v, "horario"),
    c("MIE 17:00-20:00", "", "MAR 10:00-12:00")
  )
  expect_equal(calc_muestra_aulas_sesiones_columna(character(0), "aula"), character(0))
})

test_that("las columnas nuevas no las captura el alias de otro rol", {
  # Regresión con síntoma medido: la primera versión las llamó `pabellon_aula` y
  # `horario_sesiones`. `mapping$classroom_label` lleva el alias `aula` y
  # `.cm_aulas_col()` acepta que el nombre de la columna esté CONTENIDO en el
  # candidato, así que `pabellon_aula` fue capturada como etiqueta del aula: las
  # 1.512 fichas pasaron a titularse «A501» y a llamarse `CH 1 - A501.pdf`.
  alias_label <- c("classroom_label", "sesiones_y_aula", "sesiones y aula",
                   "aula", "salon", "ambiente", "local_aula")
  con_nuevas <- data.frame(
    venue = "A501", sesiones_dia_hora = "LUN 10:00-13:00", HORARIO = "0591",
    stringsAsFactors = FALSE
  )
  expect_identical(.cm_aulas_col(con_nuevas, alias_label), "")
  expect_identical(.cm_aulas_col(con_nuevas, c("schedule", "horario")), "HORARIO")
  expect_identical(
    .cm_aulas_col(con_nuevas, c("session_type", "tipo_sesion", "tipo_de_curso")), ""
  )

  # Y la prueba de que el peligro era real, no teórico.
  con_viejas <- data.frame(pabellon_aula = "A501", stringsAsFactors = FALSE)
  expect_identical(.cm_aulas_col(con_viejas, alias_label), "pabellon_aula")
})

test_that("el enriquecido escribe venue y sesiones_dia_hora en la base", {
  raw <- data.frame(
    classroom_id = c("MAT202_0591", "TEL138_0791"),
    stringsAsFactors = FALSE
  )
  catalogo <- data.frame(
    classroom_id = c("MAT202_0591", "TEL138_0791"),
    SESIONES = c("MIE 17:00-20:00 C  A506", "MAR 10:00-12:00 C"),
    stringsAsFactors = FALSE
  )
  key <- c("MAT202_0591", "TEL138_0791")
  out <- calc_muestra_aulas_anotar_sesiones(
    raw, catalogo, key, key, list(classroom_label = "SESIONES")
  )
  expect_equal(out$venue, c("A506", ""))
  expect_equal(out$sesiones_dia_hora, c("MIE 17:00-20:00", "MAR 10:00-12:00"))
})

test_that("el enriquecido no pisa un aula que la base ya traía", {
  # Mismo contrato que el resto de `.cm_aulas_fill_from_lookup()`: rellenar donde
  # falta, nunca sobrescribir lo que el usuario declaró.
  raw <- data.frame(
    classroom_id = "MAT202_0591",
    venue = "AULA REAL",
    stringsAsFactors = FALSE
  )
  catalogo <- data.frame(
    classroom_id = "MAT202_0591",
    SESIONES = "MIE 17:00-20:00 C  A506",
    stringsAsFactors = FALSE
  )
  out <- calc_muestra_aulas_anotar_sesiones(
    raw, catalogo, "MAT202_0591", "MAT202_0591", list(classroom_label = "SESIONES")
  )
  expect_equal(out$venue, "AULA REAL")
})

test_that("sin columna de sesiones la base sale intacta", {
  raw <- data.frame(classroom_id = "X", stringsAsFactors = FALSE)
  catalogo <- data.frame(classroom_id = "X", OTRA = "cosa", stringsAsFactors = FALSE)
  out <- calc_muestra_aulas_anotar_sesiones(
    raw, catalogo, "X", "X", list(classroom_label = "no_existe")
  )
  expect_identical(out, raw)
})

test_that("los días que comparten franja se agrupan en vez de repetir la hora", {
  # Pedido de Gonzalo (2026-08-28): los horarios partidos tienen que leerse bien
  # en el papel. Medido sobre las 1.512 unidades del plan, **310 cambian** y el
  # largo máximo baja de 87 a 63 caracteres — el que antes se recortaba con
  # elipsis y le hacía perder días al aplicador.
  parte <- function(x) calc_muestra_aulas_sesiones_partes(x)$horario

  # Dos días, una franja: la hora se dice UNA vez.
  expect_equal(parte("MIE 11:00-13:00 C  L1<br />VIE 11:00-13:00 C  L2"), "MIE y VIE 11:00-13:00")
  # Tres o más, con coma y la «y» al final: esto se lee, no se parsea.
  expect_equal(
    parte("LUN 08:00-10:00 C<br />MIE 08:00-10:00 C<br />VIE 08:00-10:00 C"),
    "LUN, MIE y VIE 08:00-10:00"
  )
  # Una sola sesión no cambia: son 977 de las 1.512.
  expect_equal(parte("LUN 10:00-13:00 C  A501"), "LUN 10:00-13:00")
})

test_that("los días salen en orden de semana, no de aparición ni alfabético", {
  # «VIE y LUN» o «JUE y LUN» leídos en un papel obligan a reordenar mentalmente.
  expect_equal(
    calc_muestra_aulas_sesiones_partes("VIE 09:00-11:00 C<br />LUN 09:00-11:00 C")$horario,
    "LUN y VIE 09:00-11:00"
  )
  expect_equal(
    calc_muestra_aulas_sesiones_partes("SAB 08:00-10:00 C<br />MAR 08:00-10:00 C")$horario,
    "MAR y SAB 08:00-10:00"
  )
})

test_that("franjas distintas siguen separadas, y cada una con sus días", {
  # Agrupar por franja no puede fundir horas distintas en una.
  expect_equal(
    calc_muestra_aulas_sesiones_partes(
      "LUN 10:00-13:00 C<br />MAR 10:00-13:00 C<br />MIE 11:00-13:00 C"
    )$horario,
    "LUN y MAR 10:00-13:00 · MIE 11:00-13:00"
  )
})

test_that("un horario en texto libre no se agrupa, se deja como vino", {
  # Inventarle una lectura a «A CONVENIR CON EL DOCENTE» sería peor que copiarlo.
  expect_equal(
    calc_muestra_aulas_sesiones_partes("A CONVENIR CON EL DOCENTE")$horario,
    "A CONVENIR CON EL DOCENTE"
  )
})

# ---------------------------------------------------------------------------
# El otro separador y las sesiones que no son clase (bases CCSS, sol. 212139).
#
# La segunda base universitaria llegó el 2026-09-07 con la misma columna pero con
# `REPLACE(hdc.sesiones,'<br />',' - ')` aplicado dentro del SQL de la DTI, y con
# el catálogo saliendo de la OFERTA en vez de la matrícula: bajo un mismo
# curso-horario conviven la teoría, los grupos de práctica y los exámenes.
# ---------------------------------------------------------------------------

test_that("dos sesiones separadas por « - » no se leen como una sola", {
  # Regresión medida: con el corte sólo por `<br />` esta cadena devolvía aula
  # «H101 - MIE 10:00-12:00 C H101» y perdía el miércoles. 1.220 curso-horario
  # del marco de CCSS quedaban así.
  p <- calc_muestra_aulas_sesiones_partes("LUN 10:00-12:00 C  H101 - MIE 10:00-12:00 C  H101")
  expect_equal(p$horario, "LUN y MIE 10:00-12:00")
  expect_equal(p$aula, "H101")
})

test_that("el separador « - » no parte un aula que lleve guion", {
  # El corte exige que lo que sigue vuelva a ser DIA HH:MM; si no, no es una
  # sesión nueva y la cadena se queda entera.
  p <- calc_muestra_aulas_sesiones_partes("LUN 10:00-12:00 C  PAB - A101")
  expect_equal(p$horario, "LUN 10:00-12:00")
  expect_equal(p$aula, "PAB - A101")
})

test_that("`<br />` sigue funcionando: las dos bases conviven", {
  p <- calc_muestra_aulas_sesiones_partes("LUN 16:00-18:00 C  L101<br />MIE 16:00-18:00 C  L220")
  expect_equal(p$horario, "LUN y MIE 16:00-18:00")
  expect_equal(p$aula, "L101 · L220")
})

test_that("una sesión de examen no aporta su aula si la fila tiene clase", {
  p <- calc_muestra_aulas_sesiones_partes("LUN 10:00-12:00 C  H101 - SAB 09:00-12:00 EF  E204")
  expect_equal(p$aula, "H101")
  expect_equal(p$horario, "LUN 10:00-12:00")
})

test_that("una fila que es toda evaluación conserva su dato", {
  # La poda es preferencia, no filtro: perder el dato sería peor que tenerlo.
  # Quien decide si esa fila entra al marco es el criterio de aulas.
  p <- calc_muestra_aulas_sesiones_partes("LUN 15:00-18:00 EE  E202 - JUE 08:00-11:00 E7  E202")
  expect_equal(p$aula, "E202")
})

test_that("el tipo de sesión se devuelve, ya no sólo se descarta", {
  expect_equal(.cm_aulas_sesion_partes("MIE 17:00-20:00 C  A506")$tipo, "C")
  expect_equal(.cm_aulas_sesion_partes("SAB 09:00-12:00 EP  E204")$tipo, "EP")
  expect_equal(.cm_aulas_sesion_partes("texto sin gramática")$tipo, "")
})

test_that("entre varias filas del mismo curso-horario mandan las de clase", {
  # 1MAT09/0404 de CCSS: ocho filas de grupos de práctica del sábado en E104
  # contra una sola de teoría los miércoles y viernes. La moda daba el sábado.
  catalogo <- data.frame(
    SESIONES = c(
      "SAB 16:00-18:00 A  E104", "SAB 16:00-18:00 B  E104",
      "SAB 16:00-18:00 A  E104", "SAB 16:00-18:00 B  E104",
      "LUN 11:30-14:30 EE  E104",
      "MIE 15:00-17:00 C  E308 - VIE 15:00-17:00 C  E214"
    ),
    stringsAsFactors = FALSE
  )
  raw <- data.frame(alumno = c("a", "b"), stringsAsFactors = FALSE)
  out <- calc_muestra_aulas_anotar_sesiones(
    raw, catalogo,
    raw_key = c("1MAT09|0404", "1MAT09|0404"),
    catalog_key = rep("1MAT09|0404", 6L),
    mapping = list(classroom_label = "SESIONES")
  )
  expect_equal(unique(out$venue), "E308 · E214")
  expect_equal(unique(out$sesiones_dia_hora), "MIE y VIE 15:00-17:00")
})
