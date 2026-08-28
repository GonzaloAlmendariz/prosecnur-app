# Ampliacion DECLARADA del bolson operativo, sin resortear ni tocar el marco.
#
# El caso que la motiva, HSVG2026: `session_type` admite solo sesiones teoricas
# en catorce de las quince facultades, y la excepcion del `taller` se concedio a
# ARTE Y DISENO pero no a ARQUITECTURA Y URBANISMO. Verificado en la config, no
# en la prosa: las quince tienen excepcion propia y solo `arte_y_diseno` lista
# `taller`. A Arquitectura ese criterio le quito **36 de sus 62 aulas restantes**,
# el recorte mayor de su embudo, y la dejo con un marco de 20.
#
# Gonzalo, 2026-08-28: «estas aulas de taller en realidad no debieron haberse
# filtrado […] lo que podemos hacer es integrarlas a estas aulas extra». Y antes:
# «las aulas que salieron de arquitectura son las que son […] el sorteo ya esta
# realizado y ya se enviaron las comunicaciones».
#
# ## Por que esto NO es un resorteo ni un cambio de marco
#
# Las reservas extra no son parte de la muestra probabilistica: no cargan peso de
# diseno, no entran en pi y no participan de la inferencia —el propio motor lo
# estampa en `analysis_weight_warning`—. Son reserva OPERATIVA para cerrar cuota.
# Ampliar ese bolson cambia de que dispone el operativo, no que se sorteo. El
# marco publicado (1 512 aulas) y la seleccion enviada (174 titulares mas sus
# cadenas) quedan intactos, y ninguno de los dos menciona las extras: verificado
# sobre el libro que se envio, donde la palabra «extra» no aparece en ninguna
# celda de sus dieciocho hojas.
#
# ## Por que se DECLARA y no se disimula
#
# Porque un ajuste operativo defendible que alguien descubre despues deja de
# discutirse por sus meritos. Cada aula anadida viaja marcada —`origen_operativo`,
# `criterio_exceptuado`— y la corrida guarda el acta: quien lo decidio, cuando,
# por que, cuantas aulas y con cuantos elegibles. Que se muestre o no en un
# entregable es otra decision; que el dato sepa de donde viene, no.
#
# ## Por que se admite por `exclude_reason` y no reimplementando los criterios
#
# El motor ya guarda, aula por aula, la lista de criterios que incumplio. Al
# intentar reimplementarlos aqui salian **43** aulas admisibles porque se me
# escaparon `c7_prevalencia`, `c8_facultad`, `faculty_curso` y
# `particularidad_manual`; leyendo `exclude_reason` salen **36**, que es lo que
# la cascada del propio motor reporta en ese paso. **Nunca reimplementes la
# cascada: preguntale al campo que ya la resume.**

#' Aulas que solo incumplen el criterio que se exceptua.
#'
#' `exclude_reason` es la lista de criterios incumplidos separada por `|`. Una
#' aula es admisible si esa lista es EXACTAMENTE el criterio exceptuado: si
#' incumple algo mas, sigue fuera. La condicion de Gonzalo fue explicita —«tienen
#' que cumplir con todas las caracteristicas que ya tienen las demas aulas»— y
#' esta es la lectura literal de esa condicion.
#' @keywords internal
.cmao_solo_incumple <- function(motivos, criterio) {
  v <- trimws(as.character(motivos %||% ""))
  !is.na(v) & v == criterio
}

#' Candidatas a ampliacion operativa, con su acta.
#'
#' @param universo `aula_frame` del marco guardado, con `exclude_reason`,
#'   `faculty`, `session_type` y `eligible_n`. Es el UNIVERSO (5 269 en
#'   HSVG2026), no el marco: las aulas que interesan son justamente las que el
#'   marco dejo fuera.
#' @param facultad Nombre de la facultad, tal como viaja en `faculty`.
#' @param criterio Criterio que se exceptua, tal como aparece en
#'   `exclude_reason` (p. ej. `"session_type"`).
#' @param categorias Categorias de ese criterio que se admiten, comparadas
#'   contra `columna`. `NULL` admite todas las que solo incumplan `criterio`.
#' @param columna Columna sobre la que se comparan `categorias`.
#' @return Lista con `aulas` (data.frame de las admitidas) y `acta`. Cuando no
#'   hay ninguna, `aulas` tiene cero filas y el acta lo dice: **no se devuelve
#'   NULL**, porque una ampliacion que no anadio nada es un hecho que hay que
#'   poder registrar igual.
#' @export
calc_muestra_aulas_ampliacion_operativa <- function(universo, facultad, criterio,
                                                    categorias = NULL,
                                                    columna = "session_type") {
  vacio <- function(motivo, df) list(
    aulas = df,
    acta = list(
      schema = "calc_muestra_aulas_ampliacion_operativa_v1",
      facultad = as.character(facultad %||% ""),
      criterio_exceptuado = as.character(criterio %||% ""),
      categorias_admitidas = as.character(categorias %||% character(0)),
      aulas = 0L, elegibles = 0, estado = motivo
    )
  )
  if (!is.data.frame(universo) || !nrow(universo)) return(vacio("sin_universo", universo))
  if (!all(c("exclude_reason", "faculty") %in% names(universo))) {
    return(vacio("universo_sin_exclude_reason", universo[0, , drop = FALSE]))
  }

  fac <- trimws(as.character(universo$faculty))
  ok <- fac == trimws(as.character(facultad)) &
    .cmao_solo_incumple(universo$exclude_reason, criterio)

  if (!is.null(categorias) && length(categorias) && columna %in% names(universo)) {
    cats <- toupper(trimws(as.character(categorias)))
    ok <- ok & toupper(trimws(as.character(universo[[columna]]))) %in% cats
  }

  aulas <- universo[which(ok), , drop = FALSE]
  if (!nrow(aulas)) return(vacio("ninguna_admisible", aulas))

  elegibles <- suppressWarnings(as.numeric(aulas$eligible_n))
  elegibles <- sum(elegibles[is.finite(elegibles)])

  # Marcas que viajan CON el dato. Sin esto, una extra anadida y una extra
  # sorteada serian indistinguibles tres meses despues.
  aulas$sample_role <- "extra_reserve_pool"
  aulas$wave <- "Extra"
  aulas$equivalence_level <- "reserva_extra"
  aulas$origen_operativo <- "ampliacion_declarada"
  aulas$criterio_exceptuado <- as.character(criterio)
  aulas$activation_weight_status <- "not_selected_extra_pool"
  aulas$analysis_weight_warning <- paste0(
    "Reserva extra anadida por ampliacion operativa declarada (excepcion de '",
    criterio, "'): no forma parte del marco sorteado ni de una cadena; ",
    "no usar peso analitico."
  )
  rownames(aulas) <- NULL

  list(
    aulas = aulas,
    acta = list(
      schema = "calc_muestra_aulas_ampliacion_operativa_v1",
      facultad = trimws(as.character(facultad)),
      criterio_exceptuado = as.character(criterio),
      categorias_admitidas = as.character(categorias %||% character(0)),
      aulas = nrow(aulas),
      elegibles = elegibles,
      estado = "aplicada"
    )
  )
}
