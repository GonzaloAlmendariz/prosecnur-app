# Rescatar la referencia de CRITERIOS de una sesion que cargo el historico ANTES
# de que existiera este bloque.
#
# Gonzalo lo vio en su pantalla, con HSVG2026 abierto y el libro de 2025 ya
# cargado: la tarjeta de Entrega decia «todavia sin cargar». No era falso — la
# sesion de verdad no tenia `calc_muestra_referencia_criterios`— pero si
# enganoso: el dato SI estaba, guardado en la referencia de ASISTENCIA que el
# mismo endpoint escribe.
#
# Es el patron que ya nos costo meses en el mapeo de columnas: una capacidad
# nueva solo alcanza a los proyectos que se cargan DESPUES de escribirla, y el
# estado que ya existe se queda ciego para siempre. La reparacion no puede ser
# «vuelve a cargar el libro»: tiene que derivarse al servir.
#
# QUE SE PUEDE RESCATAR Y QUE NO. El bloque `cuotas$filas` de la asistencia
# (`.cm_asist_cuotas`) trae por facultad: la cuota total y por sexo, las aulas de
# la referencia atribuidas a esa facultad y las efectivas logradas. Eso cubre
# cinco campos del schema. Lo demas —aulas titulares, piso de matriculados,
# universo de aulas, sobremuestra— NO esta ahi y viaja NA: un 0 se leeria como
# «medido y vale cero», que es otra afirmacion.

#' Referencia de criterios derivada de la referencia de asistencia ya guardada.
#'
#' @param asistencia La lista que vive en `calc_muestra_referencia_asistencia`.
#' @return La referencia normalizada, o NULL si no hay nada que rescatar — nunca
#'   una referencia vacia, que la UI leeria como «comparado y sin diferencias».
#' Segundo piso del rescate: la dimension `facultad` de una referencia VIEJA.
#'
#' Medido en el HSVG2026 de Gonzalo: su referencia guardada es de un schema
#' anterior y NO tiene el bloque `cuotas` —tampoco `serie_campo` ni
#' `cadenas_reemplazo`—, asi que el rescate de cuotas devuelve NULL. Lo que si
#' sobrevivio son las quince filas de la dimension `facultad`, con `k` aulas
#' medidas, `matriculados` y `asistentes`.
#'
#' De ahi sale UNA cifra sin ambiguedad: los **alumnos por curso-horario** del
#' estudio anterior, que es el paso 4 de la ficha y el estadistico que dimensiona
#' toda la muestra. `k` NO se publica como `aulas_sorteadas` ni como
#' `aulas_titulares`: son las aulas donde se midio asistencia, que no es ninguna
#' de las dos —en 2025 el pool sorteado fue 1.097, los titulares 170 y las
#' aplicadas 194—. Llamarla como cualquiera de ellas inventaria una cifra.
.cm_ref_crit_desde_dimension_facultad <- function(asistencia) {
  dims <- asistencia$dimensiones
  if (!is.list(dims)) return(list())
  dim_fac <- NULL
  for (d in dims) {
    if (is.list(d) && identical(.cm_aulas_scalar(d$dimension_key, ""), "facultad")) {
      dim_fac <- d
      break
    }
  }
  if (!is.list(dim_fac) || !length(dim_fac$filas)) return(list())

  filas <- lapply(dim_fac$filas, function(f) {
    if (!is.list(f)) return(NULL)
    facultad <- .cm_aulas_scalar(f$celda_label, "")
    if (!nzchar(facultad)) return(NULL)
    k <- suppressWarnings(as.numeric(f$k %||% NA)[1L])
    matriculados <- suppressWarnings(as.numeric(f$matriculados %||% NA)[1L])
    if (!isTRUE(is.finite(k)) || k <= 0 || !isTRUE(is.finite(matriculados))) return(NULL)
    # `k` son las aulas donde el estudio anterior APLICO la encuesta. No son sus
    # titulares —2025 declaro 170 y aplico 194, la diferencia son reemplazos— ni
    # el pool sorteado, que fue 1.097. Publicarla con su nombre propio permite
    # comparar contra lo que de verdad se hizo, que es la vara mas util: contra
    # el objetivo de la plantilla DERECHO parecia -6 y contra lo aplicado es -1.
    list(
      facultad = facultad,
      alumnos_por_ch = matriculados / k,
      aulas_aplicadas = k,
      asistentes = suppressWarnings(as.numeric(f$asistentes %||% NA)[1L])
    )
  })
  Filter(Negate(is.null), filas)
}

calc_muestra_referencia_criterios_desde_asistencia <- function(asistencia) {
  if (!is.list(asistencia)) return(NULL)
  cuotas <- asistencia$cuotas
  # `.cm_asist_cuotas` publica NA cuando el bloque no existe, no NULL. Sin filas
  # utilizables el `Filter` de abajo devuelve NULL por si mismo: no hace falta
  # una segunda guarda aqui, y comprobado que no mataba a ningun mutante.
  if (!is.list(cuotas)) cuotas <- list()

  filas <- lapply(cuotas$filas, function(f) {
    if (!is.list(f)) return(NULL)
    facultad <- .cm_aulas_scalar(f$facultad, "")
    if (!nzchar(facultad)) return(NULL)
    list(
      facultad = facultad,
      cuota = f$cuota_total,
      cuota_mujeres = f$cuota_mujeres,
      cuota_hombres = f$cuota_hombres,
      # `aulas` son las de la referencia atribuidas a esa facultad: el conjunto
      # que se sorteo, no los titulares. Llamarlo `aulas_titulares` inventaria
      # una cifra que el libro no publica.
      aulas_sorteadas = f$aulas,
      efectivas_logradas = f$logradas
    )
  })
  filas <- Filter(Negate(is.null), filas)
  # Segundo piso: si el bloque `cuotas` no existe —referencia de un schema
  # anterior, que es el caso de HSVG2026— todavia queda la dimension `facultad`.
  if (!length(filas)) filas <- .cm_ref_crit_desde_dimension_facultad(asistencia)
  if (!length(filas)) return(NULL)

  estudio <- if (is.list(asistencia$estudio)) asistencia$estudio else list()
  calc_muestra_referencia_criterios_normalizar(list(
    periodo = .cm_aulas_scalar(estudio$periodo, ""),
    estudio = .cm_aulas_scalar(estudio$label, ""),
    # El metodo general no se rescata: la asistencia no lo guarda, y afirmar que
    # coincide sin haberlo leido es peor que decir «sin referencia».
    general = list(),
    por_facultad = filas
  ))
}
