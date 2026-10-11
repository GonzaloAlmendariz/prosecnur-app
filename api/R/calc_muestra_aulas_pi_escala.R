# =============================================================================
# Escala de la probabilidad publicada en la selección de aulas
# =============================================================================
#
# Un diseño de tamaño fijo que sortea n titulares reparte EXACTAMENTE n en
# probabilidades de inclusión: Σπ = n sobre el marco y Σπ = cuota_h dentro de
# cada estrato. La vara es `pi_design`, que cumple ese invariante por
# construcción —`.cm_aulas_inclusion_probabilities` renormaliza a n—, así que
# sirve para juzgar la π que se publica venga de donde venga.
#
# El discriminante es de SUMA, no de VALOR, y eso es lo único que hace que la
# red no degenere en «prohibir π = 1». Hay tres casos donde el 1 es la
# respuesta correcta y ninguno necesita figurar en una lista de excepciones,
# porque los tres siguen sumando su cuota: el estrato saturado (cuota_h = N_h),
# el censo (n >= N) y la unidad autorrepresentada (cuota_h · MOS_i / Σ MOS >= 1).
# Lo que no puede pasar es que el marco sume 119 cuando el sorteo selecciona 55.
#
# Son dos hechos DISTINTOS y salen por dos canales distintos: el estimador
# fuera de escala es del diseño (`methodological_warning`) y la ponderación
# anulada es de la fila (`weight_warning`). `calc_muestra_aulas_seleccionar`
# los invoca; aquí sólo vive el criterio. El PISO del mismo invariante —que
# ninguna aula seleccionada publique π = 0— lo pone `.cm_aulas_pi_final_rescue`
# en `calc_muestra_aulas.R`: esto es el TECHO, no lo reemplaza.

# El estimador fuera de escala, contra la vara de la cabecera: la suma del
# marco y la de cada estrato. El caso que lo motiva se midio con el conteo
# Monte Carlo incluyendo las cadenas de reemplazo — el marco sumaba 119 con un
# sorteo de 55, un exceso de 64 aulas imposible bajo cualquier diseno que
# sortee 55—, y ahi pi_final deja de ser una probabilidad de inclusion.
.cm_aulas_aviso_pi_fuera_de_escala <- function(pi_final, pi_design, stratum = NULL) {
  pi_final <- as.numeric(pi_final)
  pi_design <- as.numeric(pi_design)
  ok <- is.finite(pi_final) & is.finite(pi_design)
  if (!any(ok)) return(character(0))
  # La tolerancia es ABSOLUTA en aulas y NO lleva el SE del Monte Carlo, aunque
  # la pi se estime por simulacion. La suma no tiene ruido de estimacion:
  #
  #     Σ_i pi_i = (1/R) · Σ_r T_r,  con T_r = titulares de la corrida r,
  #
  # y bajo tamano fijo T_r = n en TODA corrida, asi que la suma vale n exacto
  # con las corridas que sean. El ruido MC vive en el REPARTO entre aulas, no
  # en el total (medido: SE por aula 0.077 con desvio de la suma 0.000000).
  # Meter el SE aqui admitiria un desvio de ~3.5 aulas sobre 55 que ningun
  # diseno de tamano fijo puede producir: fijaria el aviso por el lado debil,
  # que es el defecto que este archivo vino a reparar.
  #
  # Media aula absorbe lo unico legitimo: un ajuste de tamano que mueva la
  # media de T_r entre corridas. Un estrato que NO puede llenar su cuota
  # (cuota_h > N_h) no necesita tolerancia porque el cap esta en las DOS
  # magnitudes —el diseno lo capea en .cm_aulas_inclusion_probabilities y el
  # sorteo no puede sacar aulas que no existen—: medido con cuota 5 sobre N_h
  # = 1, Σ design = Σ MC = 2.000000 con n_aulas = 6, desvio 0.000000 global y
  # por estrato. Por eso la vara es pi_design y no el n_aulas pedido.
  tol <- 0.5
  suma <- sum(pi_final[ok])
  esperado <- sum(pi_design[ok])
  d_h <- numeric(0)
  if (length(stratum) == length(pi_final)) {
    st <- as.character(stratum)[ok]
    d_h <- abs(tapply(pi_final[ok], st, sum) - tapply(pi_design[ok], st, sum))
  }
  fuera <- which(is.finite(d_h) & d_h > tol)
  if (abs(suma - esperado) > tol) {
    sprintf(paste0("Las probabilidades publicadas suman %.2f sobre el marco, pero el sorteo selecciona %.2f aulas ",
                   "(tolerancia de %.2f): pi_final no es una probabilidad de inclusion y 1/pi_final no es un peso de diseno."),
            suma, esperado, tol)
  } else if (length(fuera)) {
    peor <- fuera[[which.max(d_h[fuera])]]
    sprintf(paste0("Las probabilidades publicadas se salen de su cuota en %s de %s estrato(s): el peor se desvia %.2f aulas ",
                   "sobre una tolerancia de %.2f, asi que ahi 1/pi_final no es un peso de diseno."),
            length(fuera), length(d_h), d_h[[peor]], tol)
  } else {
    character(0)
  }
}

# El otro hecho, por fila: aunque la suma cuadre, si TODOS los titulares salen
# con pi_final = 1 teniendo una fraccion de sorteo menor que 1, el peso vale 1
# en todos y la ponderacion queda sin efecto —la muestra se lee como si fuera el
# marco—. No es "existe algun pi = 1": la certeza que obliga la aritmetica del
# estrato (saturado, censo, autorrepresentada) trae pi_design = 1 y no se declara.
#
# El vacio es `character(0)` en los DOS avisos de este archivo, no "": el de
# escala entra en un `unique(c(...))` donde un "" contaria como aviso y dejaria
# sin efecto el fallback "Sin advertencias metodologicas criticas.", publicando
# una cadena vacia en el payload. La direccion de la unificacion la decide ese
# consumidor; el de la fila se guarda con `length()` en su call site.
.cm_aulas_aviso_ponderacion_anulada <- function(pi_final, pi_design, es_titular, n_marco) {
  idx <- which(es_titular %in% TRUE & is.finite(pi_final))
  fraccion <- if (is.finite(n_marco) && n_marco > 0) length(idx) / n_marco else NA_real_
  uno <- 1 - sqrt(.Machine$double.eps)
  if (!length(idx) || !is.finite(fraccion) || fraccion >= 1) return(character(0))
  if (!all(pi_final[idx] >= uno)) return(character(0))
  if (all(is.finite(pi_design[idx]) & pi_design[idx] >= uno)) return(character(0))
  sprintf(paste0("Los %s titulares tienen pi_final = %.3f con una fraccion de sorteo de %.2f (%s de %s aulas): ",
                 "el peso vale %.2f en todos y la ponderacion queda sin efecto."),
          length(idx), min(pi_final[idx]), fraccion, length(idx), n_marco, 1 / min(pi_final[idx]))
}
