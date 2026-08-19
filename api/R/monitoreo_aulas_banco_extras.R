# El banco de reservas extra de un estudio de aulas.
#
# El diseño da DOS niveles de respaldo y hasta ahora solo se veia uno:
#
#   1. La cadena propia del curso-horario —`CH 6` -> `R 6.1` -> `R 6.2`…, hasta
#      once eslabones—, que se ve en Consultas > Reemplazos.
#   2. El BANCO: reservas que no cuelgan de ningun titular. En HSVG2026 son 639
#      contra 202 titulares, con `wave = "Extra"` y el titular vacio en las 639.
#
# El banco NO es global: viene repartido por estrato —facultad, sexo y tamaño—.
# En el estudio real, Derecho tiene 207 y Arquitectura 12, y bajando a estrato
# completo `DERECHO / F / G4` lleva 104. Esa es su razon de ser: si una cadena
# se agota entera, se saca del banco DE ESE ESTRATO para que el reemplazo no
# descuadre la composicion.
#
# Lo que esta vista tiene que contestar, dicho por quien la pidio: «necesitamos
# bastantes mujeres en determinada facultad, esta cadena no funciono, ¿que extra
# me garantiza tantos hombres y tantas mujeres?». Por eso agrega por facultad y
# ordena por lo que hay dentro, no por codigo.

# Las etiquetas de sexo llegan en dos idiomas y hay que reconocer los dos: el
# estudio real trae `F` y `M`, y los fixtures sinteticos `Mujer` y `Hombre`.
# Mirar solo uno dejaba la mitad de los estudios con el desglose en cero.
.mabe_es_mujer <- function(etiqueta) {
  v <- toupper(trimws(as.character(etiqueta %||% "")))
  v %in% c("F", "MUJER", "MUJERES", "FEMENINO")
}

.mabe_es_hombre <- function(etiqueta) {
  v <- toupper(trimws(as.character(etiqueta %||% "")))
  v %in% c("M", "HOMBRE", "HOMBRES", "MASCULINO")
}

# Mujeres y hombres de una fila, a partir de los dos tramos de sexo del plan.
# Devuelve `NA` cuando la fila no declara ninguno de los dos: cero y «no se
# sabe» son cosas distintas y sumarlos como cero mentiria sobre el banco.
.mabe_sexos <- function(fila) {
  e1 <- fila$sex_top_1 %||% ""
  e2 <- fila$sex_top_2 %||% ""
  n1 <- suppressWarnings(as.numeric(fila$sex_top_1_n %||% NA))
  n2 <- suppressWarnings(as.numeric(fila$sex_top_2_n %||% NA))
  if (!is.finite(n1)) n1 <- NA_real_
  if (!is.finite(n2)) n2 <- NA_real_
  mujeres <- sum(c(if (.mabe_es_mujer(e1)) n1, if (.mabe_es_mujer(e2)) n2), na.rm = TRUE)
  hombres <- sum(c(if (.mabe_es_hombre(e1)) n1, if (.mabe_es_hombre(e2)) n2), na.rm = TRUE)
  conocido <- .mabe_es_mujer(e1) || .mabe_es_mujer(e2) || .mabe_es_hombre(e1) || .mabe_es_hombre(e2)
  list(mujeres = if (conocido) mujeres else NA_real_,
       hombres = if (conocido) hombres else NA_real_)
}

#' El banco de extras, por facultad y aula.
#'
#' @param plan filas del plan normalizado.
#' @return lista con `total`, `por_facultad` y `extras`.
#' @export
monitoreo_aulas_banco_extras <- function(plan = list()) {
  vacio <- list(total = 0L, elegibles = 0L, mujeres = 0L, hombres = 0L,
                por_facultad = list(), extras = list())
  if (!length(plan)) return(vacio)

  es_extra <- vapply(plan, function(u) identical(as.character(u$sample_role %||% ""), "extra_reserve_pool"), logical(1))
  filas <- plan[es_extra]
  if (!length(filas)) return(vacio)

  extras <- lapply(filas, function(u) {
    sx <- .mabe_sexos(u)
    elegibles <- suppressWarnings(as.numeric(u$eligible_n %||% NA))
    list(
      # Una extra sigue DISPONIBLE mientras no haya entrado al operativo. Es el
      # mismo juego de estados dormidos con el que `monitoreo_aulas_en_juego()`
      # decide que eslabon de una cadena esta en juego, y se reusa en vez de
      # copiarlo: en `01c0163d` una segunda copia de unos tramos se desincronizo
      # y un tramo acabo sin contener una sola aula de las que nombraba.
      #
      # `total` y `disponibles` son cosas distintas y hasta ahora solo viajaba
      # el total: un banco de 207 del que ya se gastaron 190 se leia como 207,
      # que es justo el numero con el que alguien decide salir a llamar.
      disponible = .maej_dormido(u$sample_status %||% ""),
      operational_code = as.character(u$operational_code %||% ""),
      course_name = as.character(u$course_name %||% ""),
      faculty = as.character(u$faculty %||% ""),
      stratum = as.character(u$stratum %||% ""),
      level = as.character(u$level %||% ""),
      teacher = as.character(u$teacher %||% ""),
      eligible_n = if (is.finite(elegibles)) as.integer(elegibles) else NA_integer_,
      mujeres = if (is.finite(sx$mujeres)) as.integer(sx$mujeres) else NA_integer_,
      hombres = if (is.finite(sx$hombres)) as.integer(sx$hombres) else NA_integer_
    )
  })

  # Por facultad, ordenado por cuantos extras tiene: la pregunta que se hace
  # primero es «¿de esta facultad me queda algo?», no «¿como se llama?».
  facultades <- vapply(extras, function(e) e$faculty, character(1))
  por_facultad <- lapply(unique(facultades), function(f) {
    propios <- extras[facultades == f]
    suma <- function(campo) {
      v <- vapply(propios, function(e) as.numeric(e[[campo]] %||% NA), numeric(1))
      as.integer(sum(v, na.rm = TRUE))
    }
    list(faculty = f, extras = length(propios),
         disponibles = sum(vapply(propios, function(e) isTRUE(e$disponible), logical(1))),
         elegibles = suma("eligible_n"),
         mujeres = suma("mujeres"), hombres = suma("hombres"))
  })
  orden <- order(-vapply(por_facultad, function(f) f$extras, integer(1)),
                 vapply(por_facultad, function(f) f$faculty, character(1)))
  por_facultad <- por_facultad[orden]

  suma_total <- function(campo) {
    v <- vapply(extras, function(e) as.numeric(e[[campo]] %||% NA), numeric(1))
    as.integer(sum(v, na.rm = TRUE))
  }
  list(
    total = length(extras),
    disponibles = sum(vapply(extras, function(e) isTRUE(e$disponible), logical(1))),
    elegibles = suma_total("eligible_n"),
    mujeres = suma_total("mujeres"),
    hombres = suma_total("hombres"),
    por_facultad = por_facultad,
    extras = extras
  )
}
