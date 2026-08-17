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

# Barras por lamina a partir de las cuales se parte.
#
# Sale de medir el entregable aprobado, no de un calculo propio. El 9 original
# lo habia derivado de un piso de grosor —2.87 in utiles entre 0.32— que era
# inventado y que el aprobado no cumple.
#
# EL 7 MEDIA OTRA COSA. `calibrar_umbrales()` devuelve
# `barras_por_grafico = 7`, y ese 7 es el maximo del aprobado POR GRAFICO:
# `medir_mazo()` agrupa barras contiguas de una misma paleta. Pero esta
# constante se aplica POR LAMINA, sobre `sum(tam)` de todas las premisas. Una
# lamina del aprobado como «Bienestar universitario» lleva TRES bloques de
# cuatro publicos —doce barras—, y cada bloque cuenta como un grafico de cuatro.
# Un maximo por grafico usado como techo por lamina parte lo que la referencia
# no parte.
#
# Medido sobre el aprobado contando TODAS sus filas de barra por lamina, con la
# maquinaria de `.verif_graficos()` sobre las dos paletas: maximo 12, y NUEVE de
# sus laminas llevan ocho o mas (2 con 8, 3 con 10, 1 con 11, 3 con 12).
#
# El coste del 7 estaba medido y no atribuido: el mazo generado salia con 73
# laminas contra las 63 del aprobado, su moda era de cuatro barras por lamina, y
# el contenido moria al 85.7 % de la zona util contra el 96.5 % del aprobado
# —73 % de sus laminas dejaban mas de un decimo del alto muerto abajo, contra el
# 8 % de la referencia—. Con menos barras en el mismo panel, cada barra engorda:
# de ahi tambien parte de B3 y B4.
#
# Se usa su MAXIMO y no su percentil alto: un techo por debajo de lo que hace la
# referencia deja de medir conformidad.
#
# Y AUN ASI SIGUE EN 7. Subirlo a 12 se probo y se descarto con dos medidas:
#
#   - La vara subio de 21 a 22. Aparece `R2 barras por grafico`.
#
#     OJO, CORRECCION: aqui se escribio que el motor «junta las doce en un
#     bloque». ES FALSO, y se comprobo mirando el render: el motor compone TRES
#     bloques con su enunciado, su separacion y su leyenda, igual que el
#     aprobado. Lo que dispara R2 es otra cosa —una lamina de escala cuyo
#     grafico de RAMPA pasa de siete barras—, y ahi la regla tiene razon: el
#     aprobado nunca pasa de siete en rampa. En azul dicotomico si llega a ocho
#     (su lamina 18), pero `calibrar_umbrales()` solo mira la rampa, asi que ese
#     techo no esta calibrado para las dos paletas.
#   - Y no arreglo lo que apuntaba. El mazo bajo de 73 laminas a 69, pero el
#     contenido paso de morir al 85.7 % de la zona util a morir al 86.2 %, con
#     el 71 % de sus laminas por debajo del 90 % contra el 73 % de antes. La
#     mitad inferior vacia NO la causa el techo: sobra sitio con cuatro barras
#     igual que con doce, asi que el panel no llena su hueco pase lo que pase
#     con cuantas filas tenga.
#
# REPETIDO con la reserva de pie ya reparada (0.5 en vez de 0.85), por si las
# dos cosas interactuaban: vara 18 -> 19 y el contenido subio del 89.0 % al
# 89.2 % de la zona util. Sigue sin compensar, pero ahora el unico incumplimiento
# nuevo es ese R2 de rampa.
#
# Lo que falta para llegar a las laminas de 8 a 12 barras del aprobado —nueve de
# las suyas— NO es una capacidad que el motor no tenga: ya compone varios bloques
# bien. Es que el techo sea POR PALETA, como lo es en el aprobado —hasta doce por
# lamina en dicotomicas azules, siete por grafico en rampa—, en vez de un solo
# numero para las dos.
.PARTICION_MAX_BARRAS <- 7L

# Techo para las laminas DICOTOMICAS, las de dos categorias por barra.
#
# El aprobado trata las dos familias distinto y la constante de arriba las
# trataba igual. Medido con la maquinaria de `.verif_graficos()` sobre sus dos
# paletas: en rampa no pasa nunca de siete barras por grafico, pero en azul
# dicotomico llega a ocho (su lamina 18) y a doce por lamina. Y el techo unico
# salia de `calibrar_umbrales()`, que deriva `barras_por_grafico` de
# `barras_escala` — solo la rampa—: un umbral calibrado sobre media muestra
# aplicado a las dos.
#
# Una barra dicotomica aguanta mas filas porque no tiene que repartir su ancho
# entre cuatro o cinco segmentos con su cifra dentro: lo que la hace ilegible es
# el grosor, no el numero de tramos.
#
# 8 Y NO 12, y el 12 era otra vez la unidad equivocada. Se puso midiendo las
# barras POR LAMINA del aprobado, donde llega a doce —su lamina 18—; pero esas
# doce son OCHO azules mas CUATRO de rampa, dos paletas en una misma lamina. Un
# elemento dicotomico suyo no pasa NUNCA de ocho, que es lo que mide la regla
# `R11 barras por grafico categorico`.
#
# Medido al bajarlo de 12 a 8 sobre el mazo de Conta:
#
#   R11   2 -> 0   (desaparece entera)
#   R10   4 -> 2
#   VARA 23 -> 20
#   contenido de la zona util 89.2 % -> 89.1 %, mismas 70 laminas: no reabre
#   el hueco de P23.
.PARTICION_MAX_BARRAS_DICOTOMICA <- 8L

# Sufijo del titulo de las laminas de continuacion.
.PARTICION_SUFIJO_CONT <- "(cont.)"


#' Techo de barras que le toca a un elemento por su familia
#'
#' `top2box` es la senal disponible en el plan: una lamina de escala declara su
#' top two box, y una dicotomica no puede tenerlo —no hay dos categorias
#' superiores que sumar en un si/no—. Comprobado sobre el plan de Conta: sus
#' tres elementos con `top2box = FALSE` son exactamente los tres dicotomicos, de
#' 8, 13 y 13 barras.
#'
#' Solo un `FALSE` EXPLICITO abre el techo. Ausente se trata como escala, que es
#' el techo estrecho: si la ausencia ensanchara, un plan viejo que no declara el
#' campo —o un elemento armado a mano— empezaria a juntar doce barras sin que
#' nadie lo pidiera, y el ensanchado tiene que ser una declaracion, no un
#' descuido. Tres tests de esta misma suite lo cazaron cuando el default era el
#' contrario.
#'
#' LIMITE, y se prefiere a un techo unico: una escala de cuatro categorias a la
#' que el analista le declarara `top2box = FALSE` se leeria aqui como dicotomica
#' y se le dejarian pasar doce barras. El coste esta acotado y es visible —la
#' regla `R2 barras por grafico` mide justo eso—, mientras que el techo unico
#' parte laminas que el entregable aprobado no parte.
#'
#' @param el Elemento de escala.
#' @param max_barras Techo de las laminas de escala.
#' @param max_dicotomica Techo de las dicotomicas.
#' @return El techo aplicable.
#' @keywords internal
.particion_max_barras_de <- function(el,
                                     max_barras = .PARTICION_MAX_BARRAS,
                                     max_dicotomica = .PARTICION_MAX_BARRAS_DICOTOMICA) {
  if (!identical(el$top2box, FALSE)) return(max_barras)
  max(max_barras, max_dicotomica)
}


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
      # El techo no es uno solo: una dicotomica aguanta mas filas que una escala.
      techo <- .particion_max_barras_de(el, max_barras)
      if (!is.null(tam) && sum(tam) > techo) {
        tandas <- .particion_repartir(tam, techo)
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
              length(tandas), sum(tam), techo
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
