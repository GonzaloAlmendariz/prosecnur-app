# Activar un reemplazo desde la app.
#
# Hasta ahora el plan sabia QUE aula reemplaza a cual —`replacement_for`, la
# cadena `R n.k`, el orden— pero activarla era una decision que se tomaba en un
# chat y se anotaba a mano en el Excel. La consecuencia no es de comodidad: el
# avance sigue contando el aula caida contra su meta, asi que la brecha del
# estudio miente hasta que alguien reescribe la hoja.
#
# Lo que esta funcion hace y lo que NO hace:
#
#   SI  mueve el estado de MUESTRA: la caida a `reemplazada`, su siguiente
#       reserva a `agendada`, y deja el motivo y la marca de tiempo.
#   NO  toca `activation_weight_status`. Ese campo dice que el peso de una
#       reserva es CONDICIONAL por diseno muestral, y el relato de Calculo de
#       muestra lo explica asi. La activacion es un hecho operativo; que el peso
#       se active es una consecuencia que el ponderador deriva de ver una
#       reserva condicional ya agendada.
#   NO  inventa una reserva cuando la cadena se agoto. Devuelve que no hay, con
#       cuantas se habian usado ya.

.mar_txt <- function(x, default = "") {
  v <- suppressWarnings(as.character(x %||% default)[1])
  if (is.na(v)) default else trimws(v)
}

.mar_num <- function(x, default = NA_real_) {
  v <- suppressWarnings(as.numeric(x %||% default)[1])
  if (!length(v) || !is.finite(v)) default else v
}

# El titular de una cadena: para un titular es el mismo, para una reserva es su
# `replacement_for`. Sale del campo, no de la posicion — ver L41.
# **La cadena se resuelve por `titular_operational_code`, no por
# `replacement_for`.**
#
# Es la misma leccion que `.calg_titular()` en `carga_aulas_libro_generar.R` ya
# tiene escrita, y aqui no se habia aplicado: «`replacement_for` NO sirve para
# esto y es el error que costo el mapeo entero: tanto `calc_muestra_aulas.R`
# como `monitoreo_aulas_apply_replacement()` lo escriben con el `classroom_id`
# del titular —`arc232_0905`—, que es su clave interna y no un codigo
# operativo. Medido sobre HSVG2026 (2 615 filas): de los 202 `replacement_for`
# distintos, CERO coincidian con un titular». `titular_operational_code` si
# habla ese idioma: 1 774 de 1 774 reservas encadenadas caen en su titular.
#
# El efecto de leerlo al reves, medido el 2026-09-12 con las tres formas:
# `titular_operational_code` daba **0** reservas disponibles,
# `replacement_for` con el `classroom_id` daba **0**, y solo un
# `replacement_for` con codigo operativo —el caso que no ocurre en los datos—
# daba 1. Es decir: sobre el plan real, activar un reemplazo contestaba
# «no quedan reservas» teniendolas todas.
#
# `replacement_for` se conserva DETRAS como respaldo: un plan viejo que solo lo
# traiga, y con codigo operativo, sigue resolviendose.
.mar_titular_de <- function(fila) {
  toc <- .mar_txt(fila$titular_operational_code)
  if (nzchar(toc)) return(toc)
  rf <- .mar_txt(fila$replacement_for)
  if (nzchar(rf)) rf else .mar_txt(fila$operational_code)
}

# Activar un aula ELEGIDA, que puede no ser la que tocaba.
#
# Las cuatro guardas, y por que cada una rechaza en vez de corregir: una
# activacion mal hecha manda gente a un aula equivocada, y equivocarse en
# silencio cuesta un dia de campo. Se devuelve un `stop_api` con su codigo para
# que la UI pueda decir QUE pasa, no un "no se pudo".
#
#  · Que exista.
#  · Que NO sea la propia caida.
#  · Que siga dormida — si ya esta agendada, esta comprometida con otra cosa.
#  · **Que sea de la misma facultad.** «El bolson es siempre siempre siempre
#    dentro de la misma facultad, jamas de otra», y medido sobre ULT2 ninguna de
#    las 1 173 reservas de cadena cruza. La cuota se reparte por facultad y sexo:
#    un aula de otra deja a una corta y a la otra pasada.
.mar_activar_elegida <- function(plan, pos_caida, codigo, elegida, motivo, ahora) {
  pos <- which(vapply(plan, function(r) identical(.mar_txt(r$operational_code), elegida), logical(1)))
  if (!length(pos)) {
    stop_api(404, "E_AULA_NO_ENCONTRADA",
             sprintf("No existe el curso-horario '%s' en el plan.", elegida))
  }
  pos <- pos[[1]]
  if (identical(pos, pos_caida)) {
    stop_api(409, "E_REEMPLAZO_MISMA_AULA",
             "Un curso-horario no puede reemplazarse a si mismo.")
  }

  cand <- plan[[pos]]
  caida <- plan[[pos_caida]]

  if (!.mar_txt(cand$sample_status) %in% MONITOREO_AULAS_ESTADOS_DORMIDOS) {
    stop_api(409, "E_REEMPLAZO_NO_DISPONIBLE",
             sprintf("'%s' ya esta comprometida (%s): no se puede activar para otra cosa.",
                     elegida, .mar_txt(cand$sample_status, "sin estado")))
  }

  fac_cand <- .mar_txt(cand$faculty)
  fac_caida <- .mar_txt(caida$faculty)
  # LA FACULTAD SE COMPARA SIEMPRE, TAMBIEN CUANDO VIENE VACIA.
  #
  # Exigir que las DOS fueran no vacias dejaba pasar el caso peor: un
  # curso-horario sin facultad declarada aceptaba cualquier candidato, de la
  # facultad que fuera. Y el frontend lo ofrecia, porque `bolsonExtra()` tenia
  # el mismo agujero -un `!fac ||` que desactivaba el filtro-, asi que la
  # frontera dura se caia en las dos capas a la vez y por la misma razon.
  #
  # Con `identical` a secas los dos escenarios quedan bien: si el estudio no
  # reparte por facultad ambas son "" y pasa, y si reparte pero esta fila no la
  # declara no se puede afirmar que respete la frontera, asi que no pasa.
  if (!identical(fac_cand, fac_caida)) {
    stop_api(409, "E_REEMPLAZO_OTRA_FACULTAD",
             if (!nzchar(fac_caida) || !nzchar(fac_cand)) {
               sprintf(paste0("No se puede comprobar que '%s' y '%s' sean de la misma facultad ",
                              "porque %s no la declara, y un reemplazo no cruza de facultad."),
                       elegida, codigo,
                       if (!nzchar(fac_caida)) sprintf("'%s'", codigo) else sprintf("'%s'", elegida))
             } else {
               sprintf("'%s' es de %s y '%s' de %s: un reemplazo no cruza de facultad.",
                       elegida, fac_cand, codigo, fac_caida)
             })
  }

  # De donde sale, para que el plan lo recuerde. Un reemplazo de su cadena y uno
  # tomado del bolson son decisiones distintas y no pueden leerse igual despues.
  origen <- if (identical(.mar_txt(cand$sample_role), "extra_reserve_pool")) {
    "extra"
  } else if (identical(.mar_titular_de(cand), .mar_titular_de(caida))) {
    "cadena"
  } else {
    "otra_cadena"
  }

  plan[[pos_caida]]$sample_status <- "reemplazada"
  if (nzchar(motivo)) plan[[pos_caida]]$replacement_reason <- motivo
  plan[[pos_caida]]$replaced_at <- ahora
  plan[[pos_caida]]$replaced_by <- elegida

  plan[[pos]]$sample_status <- "agendada"
  plan[[pos]]$activated_at <- ahora
  plan[[pos]]$activation_origin <- origen
  # Cubre a ESTE titular aunque su cadena fuera otra. Sin esto, el avance
  # seguiria atribuyendola a su cadena original y la caida quedaria sin cubrir.
  plan[[pos]]$activated_for <- codigo
  if (nzchar(motivo)) plan[[pos]]$activation_reason <- motivo

  list(plan = plan, activada = elegida, reemplazada = codigo,
       agotada = FALSE, origen = origen,
       restantes = length(monitoreo_aulas_reservas_disponibles(plan, codigo)),
       advertencia_peso = .mar_txt(plan[[pos]]$analysis_weight_warning))
}

#' Reservas disponibles para cubrir un aula caida.
#'
#' @param plan filas del plan (formato largo).
#' @param codigo codigo operativo del aula que cae.
#' @return indices de las reservas de esa cadena aun sin usar, en orden.
#' @export
monitoreo_aulas_reservas_disponibles <- function(plan = list(), codigo = "") {
  codigo <- .mar_txt(codigo)
  if (!length(plan) || !nzchar(codigo)) return(integer(0))
  caida <- Filter(function(r) identical(.mar_txt(r$operational_code), codigo), plan)
  if (!length(caida)) return(integer(0))
  cadena <- .mar_titular_de(caida[[1]])
  # Una reserva ya agendada o ya aplicada no esta disponible: esta en campo.
  #
  # La lista es la CANONICA de `monitoreo_aulas_en_juego.R`, no un literal
  # propio. Aqui habia uno paralelo con tres valores contra los cinco de aquella:
  # le faltaban `"-"` y `"planificada"`. En los fixtures actuales no muerde
  # —ninguna reserva los lleva— pero `"-"` es como el equipo escribe «todavia
  # nada aqui» en el Excel, 1 810 de 2 040 celdas de STATUS MUESTRA en 2025. Con
  # un libro asi, esta funcion habria dicho «no quedan reservas» teniendolas
  # todas. Dos listas para el mismo concepto es la deriva que se arregla
  # borrando una, no sincronizandolas.
  libres <- MONITOREO_AULAS_ESTADOS_DORMIDOS
  idx <- which(vapply(plan, function(r) {
    identical(.mar_txt(r$sample_role), "chain_reserve") &&
      identical(.mar_titular_de(r), cadena) &&
      !identical(.mar_txt(r$operational_code), codigo) &&
      .mar_txt(r$sample_status) %in% libres
  }, logical(1)))
  if (!length(idx)) return(integer(0))
  # Por orden de cadena; el que no lo declare va al final en vez de al frente.
  orden <- vapply(plan[idx], function(r) .mar_num(r$replacement_order, Inf), numeric(1))
  idx[order(orden)]
}

#' Activa la siguiente reserva de un aula caida.
#'
#' @param plan filas del plan.
#' @param codigo codigo operativo del aula que cae.
#' @param motivo por que cae; se guarda en la caida y en la reserva.
#' @param ahora marca de tiempo ISO; parametro para que el resultado sea
#'   reproducible en test.
#' @param elegida codigo operativo del aula con la que se quiere reemplazar.
#'   Vacio mantiene el comportamiento de siempre: la siguiente de SU cadena.
#'   Con valor, entra esa —y puede venir de otra cadena o del bolson extra—.
#'
#'   Existe porque la cadena es una guia, no un candado: «no es que los
#'   reemplazos no esten atados a su titular en forma de cadena, si lo estan,
#'   pero es una guia de procedimiento […] mas no es un requisito exclusivo y
#'   fundamental». Lo que la funcion NO hace es elegir por su cuenta: si nadie
#'   pasa `elegida`, sigue la cadena, que es el procedimiento.
#' @return lista con `plan` actualizado, `activada` (codigo o `NULL`),
#'   `reemplazada`, `agotada` (TRUE si no quedaban reservas) y `origen` de la
#'   activada (`"cadena"`, `"otra_cadena"` o `"extra"`). **El origen se devuelve
#'   siempre**: reponer con la reserva que le tocaba y reponer con un aula de
#'   otro sitio son dos operaciones distintas, y quien lea el plan despues
#'   necesita poder distinguirlas.
#' @export
monitoreo_aulas_activar_reemplazo <- function(plan = list(), codigo = "",
                                              motivo = "", ahora = NULL,
                                              elegida = "") {
  codigo <- .mar_txt(codigo)
  if (!length(plan)) {
    stop_api(409, "E_AULAS_SIN_PLAN", "No hay plan de cursos-horario sobre el que activar un reemplazo.")
  }
  pos_caida <- which(vapply(plan, function(r) identical(.mar_txt(r$operational_code), codigo), logical(1)))
  if (!length(pos_caida)) {
    stop_api(404, "E_AULA_NO_ENCONTRADA",
             sprintf("No existe el curso-horario '%s' en el plan.", codigo))
  }
  pos_caida <- pos_caida[[1]]
  ahora <- .mar_txt(ahora, format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  motivo <- .mar_txt(motivo)

  elegida <- .mar_txt(elegida)
  if (nzchar(elegida)) {
    return(.mar_activar_elegida(plan, pos_caida, codigo, elegida, motivo, ahora))
  }

  disponibles <- monitoreo_aulas_reservas_disponibles(plan, codigo)
  if (!length(disponibles)) {
    # La cadena se agoto. No se marca la caida como `reemplazada`: no lo esta.
    # Decir que si dejaria un aula fuera del avance sin nadie que la cubra.
    cadena <- .mar_titular_de(plan[[pos_caida]])
    usadas <- sum(vapply(plan, function(r) {
      identical(.mar_txt(r$sample_role), "chain_reserve") &&
        identical(.mar_titular_de(r), cadena) &&
        !.mar_txt(r$sample_status) %in% MONITOREO_AULAS_ESTADOS_DORMIDOS
    }, logical(1)))
    return(list(plan = plan, activada = NULL, reemplazada = codigo,
                agotada = TRUE, origen = NA_character_,
                reservas_usadas = as.integer(usadas)))
  }

  pos_reserva <- disponibles[[1]]
  plan[[pos_caida]]$sample_status <- "reemplazada"
  if (nzchar(motivo)) plan[[pos_caida]]$replacement_reason <- motivo
  plan[[pos_caida]]$replaced_at <- ahora
  # **Y QUIEN la reemplazo, igual que por la otra puerta.** La activacion con
  # reserva elegida a mano (`.mar_activar_elegida`) lo escribia y esta no: el
  # mismo hecho quedaba registrado a medias segun por donde se entrara, y
  # `replaced_at` sin sucesor no dice a donde fue el slot.
  plan[[pos_caida]]$replaced_by <- .mar_txt(plan[[pos_reserva]]$operational_code)

  plan[[pos_reserva]]$sample_status <- "agendada"
  plan[[pos_reserva]]$activated_at <- ahora
  # El motivo viaja a la reserva: quien la mire despues necesita saber POR QUE
  # esta en campo, no solo que lo esta.
  if (nzchar(motivo)) plan[[pos_reserva]]$activation_reason <- motivo

  list(plan = plan,
       activada = .mar_txt(plan[[pos_reserva]]$operational_code),
       reemplazada = codigo, agotada = FALSE, origen = "cadena",
       restantes = as.integer(length(disponibles) - 1L),
       # La advertencia de ponderacion de la reserva que ENTRA. La escribe
       # Calculo de muestra —«usar peso analitico final solo si se activa en
       # campo y se ajusta no respuesta»— y esta redactada para este momento
       # exacto: el de la activacion. Viajaba en el plan y quien pulsa el boton
       # no la veia nunca.
       #
       # Se DEVUELVE, no se mezcla en el texto: la consecuencia operativa
       # —cuantas reservas quedan— y la metodologica son dos lecturas distintas
       # y una frase sola las aplasta. Y sigue sin tocarse
       # `activation_weight_status`, que es la decision de la cabecera de este
       # modulo: mostrar no es mutar.
       advertencia_peso = .mar_txt(plan[[pos_reserva]]$analysis_weight_warning))
}

#' Frase que explica una activacion sin jerga.
#'
#' @param res resultado de `monitoreo_aulas_activar_reemplazo()`.
#' @return texto en espanol.
#' @export
monitoreo_aulas_activacion_texto <- function(res) {
  if (isTRUE(res$agotada)) {
    usadas <- as.integer(res$reservas_usadas %||% 0L)
    # Nunca haber tenido reserva y haberlas gastado todas son cosas distintas:
    # la primera es una decision del diseno muestral y la segunda un hecho del
    # operativo. Decir «ya se agoto: se habian usado 0» las confundia.
    if (usadas == 0L) {
      return(sprintf(
        "%s cae y no tiene ninguna reserva en el plan: la muestra nunca le asigno una. Su meta se queda sin cubrir.",
        res$reemplazada))
    }
    return(sprintf(
      "%s cae y su cadena de reemplazos ya se agotó: se habían usado %s. No queda reserva equivalente, así que la meta de ese curso-horario se queda sin cubrir.",
      res$reemplazada, usadas))
  }
  sprintf("%s pasa a reemplazada y entra %s en su lugar. Quedan %s reservas en la cadena.",
          res$reemplazada, res$activada, res$restantes %||% 0L)
}
