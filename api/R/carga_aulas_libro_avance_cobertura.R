# El bloque «Cobertura» de la hoja «Avance de campo».
#
# **El dato ya estaba calculado y nadie lo pintaba.**
# `.monitoreo_aulas_avance_cuota()` publica `composicion` —schema
# `monitoreo_aulas_composicion_referencial_v1`— desde el 2026-09-17, con una
# dimensión por cada cosa que el estudio describe y, en cada una, la población
# del marco contra lo que se lleva alcanzado. Un motor sin consumidor no es una
# capacidad; esto le pone consumidor.
#
# Para CCSS Perfil 2026-II es hoy la tabla más accionable del libro: ECONOMÍA es
# el 44,8 % de la población y el 74,3 % de lo recogido, y tres carreras van en
# cero. Por eso va inmediatamente después del bloque del eje y antes de
# «Rendimiento por facultad».
#
# LO QUE ESTA TABLA NO TIENE, Y ES DELIBERADO
#
# Ni «Muestra», ni «Faltantes», ni avance. `composicion` se declara a sí misma
# `caracter = "referencial"`: la cuota del estudio es por su eje y estas
# dimensiones NO la reparten. Una columna de faltantes aquí inventaría un umbral
# que el estudio negó explícitamente, y el operativo gastaría llamadas
# persiguiendo una cuota que no existe.
#
# Tampoco lleva la `nota` que `composicion` trae: las notas didácticas se
# retiraron de este libro el 2026-09-22. Lo que la tabla necesita decir lo dice
# su título.
#
# LAS DIMENSIONES NO SE ENUMERAN AQUÍ
#
# Se pinta una tabla por dimensión, en el orden en que vienen. Hoy son sexo y
# carrera (`.MAC_REF_DIMENSIONES`); el día que el catálogo gane una tercera,
# este archivo la publica sin tocarse. Es la misma doctrina que el eje
# declarable: la app se adapta a lo que el estudio declara, sin un `if` por
# proyecto.

#' Las columnas del bloque, en su orden.
#'
#' Viven aquí y no en `AULAS_AVANCE_CABECERAS` porque aquella constante es un
#' mapa clave → tabla 1:1 —y hay tests que lo exigen— mientras que «Cobertura»
#' es UNA cabecera para N tablas, una por dimensión. Lo que sí comparte con el
#' resto de la hoja es el mecanismo: los dos renderers y el formateador de
#' Sheets preguntan por el RÓTULO, nunca por la posición.
#' @keywords internal
AULAS_COBERTURA_CABECERAS <- c(
  "Categoría", "Población", "% de la población", "Alcanzadas", "% de lo alcanzado"
)

#' La clave con la que el vocabulario reconoce este bloque.
#' @keywords internal
AULAS_COBERTURA_CLAVE <- "cobertura"

.calaco_num <- function(x, escala = 1) {
  v <- suppressWarnings(as.numeric(x %||% NA))
  if (!length(v) || !is.finite(v[1])) NA_real_ else v[1] / escala
}

#' Las tablas de cobertura de un bloque `composicion`.
#'
#' @param composicion el campo `composicion` de `.monitoreo_aulas_avance_cuota()`.
#' @return lista de `{clave, titulo, tabla}`, una por dimensión con filas.
#'   Vacía cuando el estudio no describe ninguna dimensión o cuando el cruce no
#'   pudo resolver a nadie — el bloque entero no se escribe, en vez de publicar
#'   una tabla de ceros que se leería como «no alcanzamos a nadie».
#' @keywords internal
aulas_libro_cobertura <- function(composicion = NULL) {
  dims <- (composicion %||% list())[["dimensiones"]] %||% list()
  if (!length(dims)) return(list())
  out <- list()
  for (i in seq_along(dims)) {
    d <- dims[[i]]
    if (!is.list(d)) next
    filas <- d[["filas"]] %||% list()
    if (!length(filas)) next
    etiqueta <- .monitoreo_scalar(d[["etiqueta"]] %||% "", "")
    clave <- .monitoreo_scalar(d[["dimension"]] %||% names(dims)[i] %||% "", "")
    if (!nzchar(clave)) clave <- paste0("dim", i)
    if (!nzchar(etiqueta)) etiqueta <- clave
    tabla <- do.call(rbind, lapply(filas, function(f) {
      data.frame(
        `Categoría` = .monitoreo_scalar((f %||% list())[["categoria"]] %||% "", ""),
        `Población` = .calaco_num(f[["poblacion"]]),
        # **Las proporciones viajan 0–1**, como todo el resto de la hoja: el
        # porcentaje es formato de celda y no texto. `composicion` las emite
        # 0–100 porque su consumidor natural es la pantalla.
        `% de la población` = .calaco_num(f[["poblacion_pct"]], 100),
        `Alcanzadas` = .calaco_num(f[["obtenidas"]]),
        `% de lo alcanzado` = .calaco_num(f[["obtenidas_pct"]], 100),
        check.names = FALSE, stringsAsFactors = FALSE
      )
    }))
    if (!is.data.frame(tabla) || !nrow(tabla)) next
    if (!identical(names(tabla), AULAS_COBERTURA_CABECERAS)) {
      stop("aulas_libro_cobertura(): las columnas no son AULAS_COBERTURA_CABECERAS.",
           call. = FALSE)
    }
    out[[length(out) + 1L]] <- list(
      clave = clave,
      # El título nombra la dimensión y su carácter: «Cobertura por carrera» dice
      # a la vez qué se reparte y que no se está exigiendo nada.
      titulo = paste0("Cobertura por ", tolower(etiqueta)),
      tabla = tabla
    )
  }
  out
}

#' Todos los títulos que el bloque puede traer, para reconocerlos al leer la hoja.
#'
#' Mismo motivo que `.calae_titulos_posibles()`: el formateador de Sheets
#' identifica los bloques por su título para darles su banda y para saber dónde
#' acaba una tabla. Un título que no esté en la lista deja su bloque **sin banda
#' y sin delimitar, sin fallar**.
#' @keywords internal
.calaco_titulos_posibles <- function() {
  vapply(.MAC_REF_DIMENSIONES, function(d) {
    paste0("Cobertura por ", tolower(.monitoreo_scalar(d[["etiqueta"]] %||% "", "")))
  }, character(1), USE.NAMES = FALSE)
}
