# Partición de láminas de escala que no caben.
#
# Una lámina de escala apila una barra por cada cruce premisa x público. Cuando
# se acumulan demasiadas, el alto disponible se reparte entre todas y el grosor
# cae por debajo de lo legible: medido sobre el mazo del entregable, 13 barras
# dan 0.221 in contra un piso de 0.32. La misma aritmética fija el umbral —el
# alto util ronda las 2.87 in, asi que el piso se cruza en 9 barras.
#
# El umbral se cuenta en BARRAS, no en premisas. Cuatro premisas por cuatro
# publicos son dieciseis barras en una sola lamina, y ninguna de esas cuatro
# premisas parece excesiva vista de a una. Contar premisas fue el primer error:
# el plan del estudio de acreditacion no tiene ninguna lamina de mas de cuatro
# premisas y aun asi produce la lamina mas apretada del mazo.
#
# La continuacion NO es una disposicion nueva: la segunda lamina usa el mismo
# layout que la primera, con el titulo marcado. Por eso no hay plantilla
# `escala_continuada` — lo que hacia falta era que el motor generara una lamina
# de mas, que es una capacidad, no un hueco en la plantilla.
#
# Vive fuera de `reporte_plan_ppt.R`, congelado a crecimiento: alli solo queda
# la llamada.

# Barras por lamina a partir de las cuales el grosor cae bajo el piso legible.
.PARTICION_MAX_BARRAS <- 9L

# Sufijo del titulo de las laminas de continuacion.
.PARTICION_SUFIJO_CONT <- "(cont.)"


#' Indica si un elemento es una escala particionable
#' @keywords internal
.particion_es_escala <- function(el) {
  inherits(el, "ppt_element") &&
    identical(el$.element_type %||% "", "barras_multiapiladas") &&
    identical(el$modo %||% "", "var_cruce") &&
    length(el$vars %||% list()) > 0L &&
    length(el$titulos_grupo %||% list()) > 1L
}


#' Cuenta las barras de cada grupo de un cruce
#'
#' `vars` ya viene agrupado: una entrada por premisa (`tema_1`, `tema_2`...) y
#' dentro de cada una la variable de cada publico. No hay que deducir nada de
#' los nombres — la estructura del plan ya dice donde empieza y acaba cada
#' premisa, y los grupos no tienen por que ser del mismo tamano (una premisa
#' que solo se pregunto a estudiantes trae una sola variable).
#'
#' Un plan viejo con `vars` plana —una cadena por entrada— se lee como una
#' premisa por variable, que es lo que significa.
#'
#' @return Vector con el numero de barras por grupo, o `NULL` si no encaja.
#' @keywords internal
.particion_tam_grupos <- function(el) {
  vars <- el$vars %||% list()
  grupos <- el$titulos_grupo %||% list()
  if (!length(vars)) return(NULL)
  # El reparto se hace sobre `vars` y `titulos_grupo` en paralelo: si no van a
  # la par, subsetear uno desalinearia el otro.
  if (length(grupos) && length(grupos) != length(vars)) return(NULL)

  tam <- vapply(vars, function(v) {
    if (is.list(v)) length(v) else length(as.character(v))
  }, integer(1))
  if (any(tam == 0L)) return(NULL)
  tam
}


#' Barras totales de un elemento de escala
#' @keywords internal
.particion_n_barras <- function(el) {
  tam <- .particion_tam_grupos(el)
  if (is.null(tam)) 0L else sum(tam)
}


#' Agrupa los grupos en tandas que respetan el maximo de barras
#'
#' Un grupo nunca se parte por la mitad: sus barras son la misma premisa vista
#' por varios publicos y separarlas rompe la comparacion que la lamina existe
#' para mostrar. Un grupo que por si solo excede el maximo viaja igual en su
#' propia tanda.
#'
#' @return Lista de vectores de indices de grupo.
#' @keywords internal
.particion_repartir <- function(tam, max_barras = .PARTICION_MAX_BARRAS) {
  tandas <- list()
  actual <- integer(0)
  acum <- 0L
  for (gi in seq_along(tam)) {
    n <- tam[[gi]]
    if (length(actual) && acum + n > max_barras) {
      tandas[[length(tandas) + 1L]] <- actual
      actual <- integer(0)
      acum <- 0L
    }
    actual <- c(actual, gi)
    acum <- acum + n
  }
  if (length(actual)) tandas[[length(tandas) + 1L]] <- actual
  tandas
}


#' Clona un elemento de escala conservando solo algunos grupos
#' @keywords internal
.particion_elemento <- function(el, grupos_idx) {
  el$vars <- el$vars[grupos_idx]
  if (length(el$titulos_grupo %||% list())) {
    el$titulos_grupo <- el$titulos_grupo[grupos_idx]
  }
  el
}


#' Marca el titulo de una lamina de continuacion
#' @keywords internal
.particion_titulo_cont <- function(titulo) {
  if (is.null(titulo)) return(NULL)
  t <- trimws(as.character(titulo)[1])
  if (is.na(t) || !nzchar(t)) return(titulo)
  if (endsWith(t, .PARTICION_SUFIJO_CONT)) return(titulo)
  paste(t, .PARTICION_SUFIJO_CONT)
}


# Claves donde una lamina puede llevar su titulo. El motor usa `title` en la
# lamina, pero el plan tambien lo acepta en `slots` y en `payload` segun por
# donde haya entrado, asi que se marcan las tres: marcar solo una dejaria la
# continuacion sin marca en el resto de los caminos.
#
# El titulo dibujado sale en MAYUSCULAS, asi que el sufijo se lee `(CONT.)`.
.PARTICION_CLAVES_TITULO <- c("title", "titulo")

#' Marca el titulo de una lamina alla donde viva
#' @keywords internal
.particion_marcar_titulo <- function(slide) {
  for (k in .PARTICION_CLAVES_TITULO) {
    if (!is.null(slide[[k]])) slide[[k]] <- .particion_titulo_cont(slide[[k]])
    if (!is.null(slide$slots) && !is.null(slide$slots[[k]])) {
      slide$slots[[k]] <- .particion_titulo_cont(slide$slots[[k]])
    }
    if (!is.null(slide$payload) && !is.null(slide$payload[[k]])) {
      slide$payload[[k]] <- .particion_titulo_cont(slide$payload[[k]])
    }
  }
  slide
}


#' Parte las laminas de escala que superan el maximo de barras
#'
#' Solo actua sobre laminas cuyo unico elemento graficable es la escala
#' excedida. Una lamina de dos graficos plantea una pregunta que este paso no
#' puede responder solo —que hacer con el grafico que si cabia—, y adivinar
#' dejaria un hueco o lo duplicaria; en ese caso se deja intacta.
#'
#' @param plan Lista de laminas del plan.
#' @param elementos_de Funcion que extrae los `ppt_element` de una lamina.
#' @param max_barras Barras por lamina a partir de las cuales se parte.
#'
#' @return El plan, con las laminas excedidas expandidas.
#' @keywords internal
.plan_particionar_escalas <- function(plan, elementos_de,
                                      max_barras = .PARTICION_MAX_BARRAS) {
  if (!length(plan)) return(plan)
  out <- list()

  for (slide in plan) {
    els <- elementos_de(slide)
    graficables <- Filter(function(e) inherits(e, "ppt_element"), els)
    partido <- FALSE

    if (length(graficables) == 1L && .particion_es_escala(graficables[[1]])) {
      el <- graficables[[1]]
      tam <- .particion_tam_grupos(el)
      if (!is.null(tam) && sum(tam) > max_barras) {
        tandas <- .particion_repartir(tam, max_barras)
        if (length(tandas) > 1L) {
          # El slot que hay que reemplazar es el que contiene la escala.
          slot_nm <- NULL
          for (nm in names(slide$slots %||% list())) {
            if (identical(slide$slots[[nm]], el)) { slot_nm <- nm; break }
          }
          if (!is.null(slot_nm)) {
            for (k in seq_along(tandas)) {
              nueva <- slide
              nueva$slots[[slot_nm]] <- .particion_elemento(el, tandas[[k]])
              if (k > 1L) nueva <- .particion_marcar_titulo(nueva)
              out[[length(out) + 1L]] <- nueva
            }
            partido <- TRUE
            .pulso_aviso(sprintf(
              paste("Una lamina de escala se partio en %d: %d barras no caben",
                    "legibles en una sola (el maximo es %d). Reduce publicos o",
                    "premisas si prefieres tenerlas juntas."),
              length(tandas), sum(tam), max_barras
            ))
          }
        }
      }
    }

    if (!partido) out[[length(out) + 1L]] <- slide
  }

  class(out) <- unique(c("ppt_plan", "list", class(plan)))
  out
}
