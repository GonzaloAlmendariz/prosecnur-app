# Cuadre entre el parte de campo y la Base de control.
#
# Son dos hojas del mismo libro que cuentan la misma aula en dos momentos: el
# parte lo llena el aplicador cuando sale del aula, y la Base de control la
# llena despues quien revisa. Que exista una segunda hoja es precisamente para
# poder comparar — y hasta ahora nadie comparaba: la app cuadraba la aritmetica
# INTERNA del parte (`monitoreo_aulas_reconciliacion.R`) y las dos hojas nunca
# se miraban entre si.
#
# Que se cruza y que NO, medido sobre el operativo de 2025 (170 partes y 170
# filas de control, 114 con el control lleno):
#
# | campo                | en el parte | en el control | se cruza |
# |----------------------|-------------|---------------|----------|
# | `observed_students`  | 170         | 114           | SI       |
# | `attendance_pct`     | 170         | 114           | SI       |
# | `applied_by`         | 170         | 170           | SI       |
# | `applied_date`       | 0           | 0             | no       |
# | `application_status` | 0           | 170           | no       |
# | `effective_surveys`  | 170         | 0             | no       |
# | `sent_total`         | 0           | 114           | no       |
#
# Las cuatro de abajo no se cruzan y el motivo importa: una columna que solo
# una de las dos hojas trae daria 170 hallazgos que no son discrepancias sino
# ausencias. `effective_surveys` y `sent_total` ademas NO son el mismo hecho
# —las efectivas las declara el aplicador y las enviadas las cuenta el equipo
# sobre la plataforma—, que es la misma distincion que el modulo ya sostiene
# entre «Respuestas validas» y «efectivas».
#
# Este control no decide cual de las dos hojas tiene razon. Dice que aula y que
# campo discrepan, y con que valores. Quien sabe que paso en esa aula es el
# equipo.

# Los campos que las dos hojas traen con el mismo nombre y el mismo
# significado. `etiqueta` es como se nombra en la frase, sin jerga de columna.
MONITOREO_AULAS_CRUCE_CAMPOS <- list(
  list(campo = "observed_students", etiqueta = "los asistentes", tipo = "numero"),
  # `unidad = "porcentaje"` para que la frase no diga «0.765» donde la tabla de
  # al lado ya dice «76.5 %». La escala la decide la COLUMNA entera, igual que
  # en la capa de presentacion del frontend: el libro puede traer estas razones
  # en 0-1 o en 0-100 y el motor no las normaliza.
  list(campo = "attendance_pct", etiqueta = "el % de asistencia", tipo = "numero",
       unidad = "porcentaje"),
  list(campo = "applied_by", etiqueta = "quien aplico", tipo = "texto")
)

.mach_num <- function(valor) {
  v <- suppressWarnings(as.numeric(valor %||% NA))
  if (length(v) != 1L || !is.finite(v)) NA_real_ else v
}

.mach_txt <- function(valor) trimws(as.character(valor %||% ""))

# Dos numeros discrepan si se separan mas que la tolerancia. La tolerancia
# existe por el `% ASISTENCIA`: el equipo lo escribe redondeado a tres decimales
# y compararlo con `==` marcaria como discrepancia un redondeo.
.mach_discrepan_numero <- function(a, b, tolerancia) {
  x <- .mach_num(a); y <- .mach_num(b)
  # Sin dato en una de las dos NO hay discrepancia: hay una hoja sin llenar, que
  # es otra cosa y ya la cuenta el resumen del control.
  if (!is.finite(x) || !is.finite(y)) return(FALSE)
  abs(x - y) > tolerancia
}

.mach_discrepan_texto <- function(a, b) {
  x <- .mach_txt(a); y <- .mach_txt(b)
  if (!nzchar(x) || !nzchar(y)) return(FALSE)
  # Sin distinguir mayusculas ni espacios de mas: «Equipo 2» y «equipo  2» son
  # el mismo equipo escrito por dos personas distintas, y marcarlo seria ruido.
  !identical(toupper(gsub("[[:space:]]+", " ", x)), toupper(gsub("[[:space:]]+", " ", y)))
}

#' Aulas donde el parte de campo y la Base de control no dicen lo mismo.
#'
#' @param partes lista de partes de campo.
#' @param control lista de filas de «Base de control».
#' @param tolerancia separacion numerica que se considera igual.
#' @return lista de hallazgos, uno por (aula, campo) discrepante, y el conteo de
#'   aulas que si se pudieron comparar.
#' @export
monitoreo_aulas_cruce_hojas <- function(partes = list(), control = list(), tolerancia = 0.01) {
  vacio <- list(comparables = 0L, hallazgos = list())
  if (!length(partes) || !length(control)) return(vacio)

  por_codigo <- list()
  for (fila in control) {
    if (!is.list(fila)) next
    code <- .mach_txt(fila$operational_code %||% fila$classroom_id)
    if (nzchar(code)) por_codigo[[code]] <- fila
  }
  if (!length(por_codigo)) return(vacio)

  # Si una columna de porcentaje viene en 0-1, sobre TODAS las filas de las dos
  # hojas. Una regla por valor rompe donde importa: una asistencia del 108 %
  # —hay aulas con mas presentes que elegibles— se leeria «1.1 %».
  en_proporcion <- list()
  for (spec in MONITOREO_AULAS_CRUCE_CAMPOS) {
    if (!identical(spec$unidad %||% "", "porcentaje")) next
    valores <- c(
      vapply(partes, function(p) if (is.list(p)) .mach_num(p[[spec$campo]]) else NA_real_, numeric(1)),
      vapply(control, function(f) if (is.list(f)) .mach_num(f[[spec$campo]]) else NA_real_, numeric(1))
    )
    valores <- valores[is.finite(valores)]
    en_proporcion[[spec$campo]] <- length(valores) > 0L && max(abs(valores)) <= 1.5
  }

  comparables <- 0L
  hallazgos <- list()
  for (p in partes) {
    if (!is.list(p)) next
    code <- .mach_txt(p$operational_code %||% p$classroom_id)
    if (!nzchar(code)) next
    c_fila <- por_codigo[[code]]
    if (is.null(c_fila)) next
    comparables <- comparables + 1L
    for (spec in MONITOREO_AULAS_CRUCE_CAMPOS) {
      en_parte <- p[[spec$campo]]
      en_control <- c_fila[[spec$campo]]
      discrepan <- if (identical(spec$tipo, "numero")) {
        .mach_discrepan_numero(en_parte, en_control, tolerancia)
      } else {
        .mach_discrepan_texto(en_parte, en_control)
      }
      if (!discrepan) next
      hallazgos[[length(hallazgos) + 1L]] <- list(
        operational_code = code,
        campo = spec$campo,
        etiqueta = spec$etiqueta,
        unidad = spec$unidad %||% "",
        escalar = isTRUE(en_proporcion[[spec$campo]]),
        en_parte = if (identical(spec$tipo, "numero")) .mach_num(en_parte) else .mach_txt(en_parte),
        en_control = if (identical(spec$tipo, "numero")) .mach_num(en_control) else .mach_txt(en_control)
      )
    }
  }
  list(comparables = comparables, hallazgos = hallazgos)
}

#' Frase que explica una discrepancia entre las dos hojas, sin jerga.
#'
#' @param hallazgo un elemento de `monitoreo_aulas_cruce_hojas()$hallazgos`.
#' @return texto en espanol.
#' @export
monitoreo_aulas_cruce_texto <- function(hallazgo) {
  porcentaje <- identical(hallazgo$unidad %||% "", "porcentaje")
  valor <- function(v) {
    if (is.character(v)) return(v)
    if (!porcentaje) return(format(v, trim = TRUE))
    n <- if (isTRUE(hallazgo$escalar)) v * 100 else v
    paste0(format(round(n, 1), trim = TRUE), " %")
  }
  # «pone X en Y» y no «Y es X»: las etiquetas son sintagmas de distinto numero
  # —«los asistentes», «el % de asistencia», «quien aplico»— y con el verbo
  # delante la frase salia «los asistentes es 39».
  sprintf(
    "%s: el parte de campo pone %s en %s y la Base de control pone %s.",
    hallazgo$operational_code,
    valor(hallazgo$en_parte),
    hallazgo$etiqueta,
    valor(hallazgo$en_control)
  )
}

# --- Orden natural de los codigos de curso-horario ----------------------------
#
# `CH 10` va DESPUES de `CH 2`, no antes. Ordenar los codigos como texto los
# deja en orden alfabetico —CH 2, CH 10, CH 11 … CH 24, CH 5, CH 6— y asi es
# como se veian las 24 cadenas en pantalla: un desorden que no tiene explicacion
# para quien lo lee, porque el codigo LLEVA un numero y el ojo lo lee como
# numero. El mismo defecto estaba en las brechas, en el control y en el avance,
# porque los cuatro desempatan por `operational_code`.
#
# La clave es (prefijo, numero, resto): asi `R 4.1` y `R 4.2` tambien quedan en
# su orden, y un codigo sin numero conserva el alfabetico entre los suyos.

#' Clave de orden natural para un vector de codigos.
#'
#' @param codigos vector de codigos operativos.
#' @return `order()` aplicable, o el orden alfabetico si no hay numeros.
#' @export
monitoreo_aulas_orden_codigo <- function(codigos) {
  txt <- as.character(codigos %||% character(0))
  txt[is.na(txt)] <- ""
  # Prefijo: todo lo anterior al primer digito. `CH 10` -> «CH », `R 4.1` -> «R ».
  prefijo <- sub("[0-9].*$", "", txt)
  resto <- substring(txt, nchar(prefijo) + 1L)
  primero <- suppressWarnings(as.numeric(sub("^([0-9]+).*$", "\\1", resto)))
  # Segundo numero para las reservas encadenadas (`R 4.1` frente a `R 4.2`).
  segundo <- suppressWarnings(as.numeric(sub("^[0-9]+[^0-9]+([0-9]+).*$", "\\1", resto)))
  primero[!is.finite(primero)] <- Inf
  segundo[!is.finite(segundo)] <- 0
  order(prefijo, primero, segundo, txt)
}

#' Rango de orden natural, para usar DENTRO de un `order()` con mas criterios.
#'
#' `order()` no compone: pasarle otro `order()` como columna ordenaria por la
#' posicion y no por el codigo. Esto devuelve el puesto de cada codigo, que si
#' se puede usar como una columna mas del desempate.
#'
#' @param codigos vector de codigos operativos.
#' @return vector de enteros con el puesto de cada codigo.
#' @export
monitoreo_aulas_rango_codigo <- function(codigos) {
  o <- monitoreo_aulas_orden_codigo(codigos)
  r <- integer(length(o))
  r[o] <- seq_along(o)
  r
}
