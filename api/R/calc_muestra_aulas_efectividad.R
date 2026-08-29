# Efectividad esperada ex ante (EF3 fase 1, era EFECTIVIDAD).
#
# VARA 0 de Gonzalo, textual: «tenemos que genuinamente asegurarnos que este
# mecanismo de selección de aulas nos garantice efectividad (…) lo importante
# es medirla ANTES, porque luego ya no podemos arreglar las cosas».
#
# Calibración 2025 (base ADR 0060, 230 intentadas / 194 aplicadas), medida el
# 2026-08-18 y registrada en docs/qa/checklist-replicacion-2025-2026-08-17.md:
#   - P(aplicada): base 84%; DOCENTE CONTRATADO 87%; ORDINARIO-PRINCIPAL 73%.
#     (Asociado/Auxiliar/Pre-docente sin calibración propia → base.)
#   - Rendimiento (efectivas/elegibles, mediana 0.56), monotónico en tamaño:
#     ≤15: 0.80 · 16–25: 0.69 · 26–35: 0.56 · 36–50: 0.55 · >50: 0.44.
#     Bins sobre ELEGIBLES (v1; la base 2025 bineó sobre su tamaño de aula).
#   - LIMITACIÓN DECLARADA: el bloque horario (especial-mañana −15 pts de
#     aplicación; noche rinde 0.40) NO es derivable del marco actual — el
#     `schedule` es código de sección, no hora. Señal medida, no usable en v1.
#   - tipo_curso no calibrable (2025 fue todo teórico): talleres sin prior.
#
# FASE 1 = REFERENCIAL: anota columnas en el frame DESPUÉS del frame_hash (no
# muta la firma ni invalida artefactos acreditados) y NO toca π ni el sorteo.
# Pesar el sorteo con esto es fase 2 y espera la decisión de Gonzalo.

.cm_efectividad_p_aplicada <- function(teacher_type) {
  tt <- toupper(trimws(as.character(teacher_type %||% "")))
  p <- rep(0.84, length(tt))
  p[grepl("CONTRATADO", tt, fixed = TRUE)] <- 0.87
  p[grepl("ORDINARIO", tt, fixed = TRUE) & grepl("PRINCIPAL", tt, fixed = TRUE)] <- 0.73
  p
}

# LOS CINCO TRAMOS EMBEBIDOS, en la MISMA forma con la que la config los sella.
#
# Estaban escritos como cinco asignaciones sueltas dentro de
# `.cm_efectividad_rendimiento()`, y sacarlos aqui no es orden: es lo que hace
# que sellarlos NO pueda mover un numero (ADR 0083). El sellador escribe
# exactamente este objeto y el motor lo evalua por el MISMO camino que un sello
# del estudio, asi que las dos ramas son la misma cuenta. Mantener dos copias
# de estos cinco numeros —una para calcular y otra para sellar— es el defecto
# que este repo ya pago varias veces: dos listas que nadie ata.
#
# El ultimo tramo lleva `hasta = NA`, que el evaluador y el normalizador leen
# como infinito; no se escribe `Inf` porque la config viaja a JSON.
.CM_EFECTIVIDAD_TRAMOS_EMBEBIDOS <- list(
  list(hasta = 15, tasa = 0.80),
  list(hasta = 25, tasa = 0.69),
  list(hasta = 35, tasa = 0.56),
  list(hasta = 50, tasa = 0.55),
  list(hasta = NA_real_, tasa = 0.44)
)

.cm_efectividad_rendimiento <- function(eligible_n, tramos = NULL) {
  e <- suppressWarnings(as.numeric(eligible_n))
  e[!is.finite(e)] <- 0
  # Tramos sellados en la config (plan 1b): la curva es DATO del estudio, no
  # codigo. Sin sello rigen los embebidos, POR ESTE MISMO CAMINO — ver la nota
  # de `.CM_EFECTIVIDAD_TRAMOS_EMBEBIDOS`. La procedencia la declara
  # `.cm_efectividad_calibracion()` como `calibracion_embebida`.
  if (!is.list(tramos) || !length(tramos)) tramos <- .CM_EFECTIVIDAD_TRAMOS_EMBEBIDOS
  r <- rep(NA_real_, length(e))
  restante <- rep(TRUE, length(e))
  for (tr in tramos) {
    hasta <- suppressWarnings(as.numeric(tr$hasta)[1])
    if (!is.finite(hasta)) hasta <- Inf
    tasa <- suppressWarnings(as.numeric(tr$tasa)[1])
    idx <- restante & e <= hasta
    r[idx] <- tasa
    restante <- restante & !idx
  }
  r
}

# Las TRES piernas del rendimiento del aula.
#
# `tasa` es el producto y sigue siendo la cifra que dimensiona; las piernas son
# su descomposicion, medida sobre las 194 aulas aplicadas de 2025 (razon de
# sumas) y reproducen la `tasa` sellada EXACTO en los cinco tramos:
#
#   tramo   asistencia  respuesta  validez   producto  sellado
#   <=15      1,1262      0,7960    0,9025    0,80905   0,809
#   16-25     0,8460      0,8298    0,9148    0,64220   0,642
#   26-35     0,9043      0,7103    0,8808    0,56576   0,566
#   36-50     0,7676      0,7282    0,8954    0,50050   0,500
#   >50       0,6354      0,7357    0,8757    0,40936   0,409
#
# Cuatro decimales y no tres: con tres, el tramo 26-35 daba 0,56546 contra una
# tasa de 0,566, un desvio por encima del propio redondeo de la tasa. La
# descomposicion tiene que caber dentro de la cifra que describe.
#
# Por que importan separadas: **todo el castigo del aula grande esta en la
# asistencia** (1,126 -> 0,635), la respuesta baja poco y la validez es plana
# (0,876-0,915). Son tres problemas con tres palancas distintas —agenda y
# horario / aplicador, tiempo e instrumento / completitud y consentimiento— y
# una sola cifra no dice cual esta fallando.
#
# La asistencia pasa de 1 en el tramo chico porque `asistentes` cuenta gente en
# el salon, no necesariamente elegible. NO se topa aqui: toparla rompería el
# producto, que es el invariante que un test fija.
#
# **Sin sello no hay piernas.** La calibracion embebida es de otra ola y su
# producto no sale de esta descomposicion; inventarle una seria publicar una
# lectura que nadie midio. Devuelve NA y la superficie lo declara.
.cm_efectividad_piernas <- function(eligible_n, tramos = NULL) {
  e <- suppressWarnings(as.numeric(eligible_n))
  e[!is.finite(e)] <- 0
  vacio <- list(asistencia = rep(NA_real_, length(e)),
                respuesta = rep(NA_real_, length(e)),
                validez = rep(NA_real_, length(e)))
  if (!is.list(tramos) || !length(tramos)) return(vacio)
  out <- vacio
  restante <- rep(TRUE, length(e))
  for (tr in tramos) {
    hasta <- suppressWarnings(as.numeric(tr$hasta)[1])
    if (!is.finite(hasta)) hasta <- Inf
    idx <- restante & e <= hasta
    for (nm in c("asistencia", "respuesta", "validez")) {
      v <- suppressWarnings(as.numeric(tr[[nm]])[1])
      out[[nm]][idx] <- if (is.finite(v) && v > 0) v else NA_real_
    }
    restante <- restante & !idx
  }
  out
}

#' Tasa de aplicacion por tipo de docente desde la tabla sellada; un aula con
#' docentes compuestos («A | B») lleva la del mas restrictivo (min), que es
#' como el campo se comporta: basta que uno rechace.
.cm_efectividad_p_desde_tabla <- function(tipos, tabla) {
  claves <- vapply(tabla, function(x) toupper(trimws(as.character(x$tipo)[1])), character(1))
  tasas <- vapply(tabla, function(x) suppressWarnings(as.numeric(x$tasa)[1]), numeric(1))
  general <- tasas[claves %in% c("GENERAL", "*", "")]
  base <- if (length(general)) general[[1]] else NA_real_
  vapply(as.character(tipos), function(tt) {
    partes <- toupper(trimws(strsplit(tt, "|", fixed = TRUE)[[1]]))
    partes <- partes[nzchar(partes)]
    if (!length(partes)) return(base)
    vals <- vapply(partes, function(pp) {
      hit <- which(claves == pp)
      if (length(hit)) tasas[[hit[1]]] else base
    }, numeric(1))
    vals <- vals[is.finite(vals)]
    if (!length(vals)) return(base)
    min(vals)
  }, numeric(1), USE.NAMES = FALSE)
}

#' Normaliza la declaracion de procedencia de la calibracion (cfg$efectividad).
#' Tres estados legales: "historico" (las tasas provienen de la data historica
#' del estudio anterior; periodo opcional), "tau_global" (no hay historico: el
#' esperado se rige por el supuesto global tau declarado), o NULL (nadie
#' declaro nada). Gonzalo (2026-08-20): «la idea es que no sea un hardcore…
#' puede no haber historico: se rige por el global, y hay que mostrarlo».
.cm_efectividad_normalize_config <- function(ef = NULL) {
  if (!is.list(ef)) return(NULL)
  chr1 <- function(x) {
    v <- as.character(x)[1]
    if (length(v) != 1L || is.na(v)) "" else trimws(v)
  }
  fuente <- chr1(ef$fuente)
  periodo <- chr1(ef$periodo)
  tau <- suppressWarnings(as.numeric(ef$tau)[1])
  if (identical(fuente, "historico")) {
    # Ajuste por facultad (decision de Gonzalo, 2026-08-20): tau medido de la
    # VARA DE EFECTIVAS del historico donde la referencia lo clasifica con
    # suficiencia (k>=12); las demas facultades NO llevan entrada — para ellas
    # rige la tasa general y la UI lo declara. tau_base es el agregado que las
    # curvas reproducen; el factor por aula es tau_facultad / tau_base.
    tau_base <- suppressWarnings(as.numeric(ef$tau_base)[1])
    if (!is.finite(tau_base) || tau_base <= 0 || tau_base > 1) tau_base <- NA_real_
    pf_in <- ef$por_facultad
    por_facultad <- NULL
    if (is.list(pf_in) && length(pf_in)) {
      limpio <- lapply(pf_in, function(e) {
        if (!is.list(e)) return(NULL)
        fac <- chr1(e$facultad)
        tv <- suppressWarnings(as.numeric(e$tau)[1])
        kv <- suppressWarnings(as.integer(e$k)[1])
        suf <- chr1(e$suficiencia)
        # tau admite hasta 2: con tau_base=1 el sello guarda RESIDUALES
        # directos (Derecho 1,115 rinde por encima de su mix) — un residual
        # mayor a 2 si seria absurdo y se descarta.
        if (!nzchar(fac) || !is.finite(tv) || tv <= 0 || tv > 2) return(NULL)
        # `aplicar` es EXPLICITO y por defecto TRUE: los sellos existentes
        # -las 6 con base suficiente- siguen aplicandose sin tocarlos. Una
        # entrada con `aplicar = FALSE` viaja como REFERENCIA: se publica lo
        # que el historico observo y el modelo no lo usa. Es la unica forma de
        # que una facultad sin base declare su residual sin que ese residual
        # entre por la puerta de atras.
        ap <- e$aplicar
        aplicar <- !(length(ap) == 1L && identical(as.logical(ap)[1], FALSE))
        num_opt <- function(nm) {
          v <- suppressWarnings(as.numeric(e[[nm]])[1])
          if (is.finite(v)) v else NULL
        }
        list(facultad = fac, tau = tv,
             k = if (length(kv) == 1L && !is.na(kv)) kv else NA_integer_,
             suficiencia = suf, aplicar = aplicar,
             ic_low = num_opt("ic_low"), ic_high = num_opt("ic_high"))
      })
      limpio <- Filter(Negate(is.null), limpio)
      if (length(limpio)) por_facultad <- limpio
    }
    # Tramos de rendimiento sellados: {hasta, tasa} ascendentes; el ultimo
    # puede venir sin `hasta` (= infinito). Invalido -> NULL (rige embebida,
    # declarada).
    tramos_in <- ef$rendimiento_tramos
    rendimiento_tramos <- NULL
    if (is.list(tramos_in) && length(tramos_in)) {
      limpio_t <- lapply(tramos_in, function(tr) {
        if (!is.list(tr)) return(NULL)
        hasta <- suppressWarnings(as.numeric(tr$hasta)[1])
        tasa <- suppressWarnings(as.numeric(tr$tasa)[1])
        if (!is.finite(tasa) || tasa <= 0 || tasa > 1) return(NULL)
        # Las tres piernas son OPCIONALES y se conservan solo si son legibles:
        # un tramo sin ellas sigue siendo valido —la `tasa` es lo que
        # dimensiona— y publica NA en vez de un numero inventado.
        pierna <- function(nm) {
          v <- suppressWarnings(as.numeric(tr[[nm]])[1])
          if (is.finite(v) && v > 0) v else NULL
        }
        list(hasta = if (is.finite(hasta)) hasta else NA_real_, tasa = tasa,
             asistencia = pierna("asistencia"), respuesta = pierna("respuesta"),
             validez = pierna("validez"))
      })
      limpio_t <- Filter(Negate(is.null), limpio_t)
      hastas <- vapply(limpio_t, function(x) if (is.finite(x$hasta)) x$hasta else Inf, numeric(1))
      if (length(limpio_t) >= 2L && !is.unsorted(hastas, strictly = TRUE)) {
        rendimiento_tramos <- limpio_t
      }
    }
    # DE DONDE SALEN ESOS TRAMOS. El resto del bloque dice "historico" y los
    # tramos pueden no serlo: `calc_muestra_aulas_sellar_rendimiento()` sella
    # los embebidos y los marca `calibracion_embebida`. Sin esta linea la clave
    # se perderia aqui —esta funcion construye su retorno campo a campo— y el
    # sello volveria a no declarar nada, que es el defecto que repara.
    rendimiento_fuente <- chr1(ef$rendimiento_fuente)
    # Tasa de aplicacion por tipo de docente (capa OPERATIVA): {tipo, tasa, k}.
    ta_in <- ef$tasa_aplicacion
    tasa_aplicacion <- NULL
    if (is.list(ta_in) && length(ta_in)) {
      limpio_a <- lapply(ta_in, function(x) {
        if (!is.list(x)) return(NULL)
        tipo <- chr1(x$tipo)
        tasa_v <- suppressWarnings(as.numeric(x$tasa)[1])
        kv <- suppressWarnings(as.integer(x$k)[1])
        if (!nzchar(tipo) || !is.finite(tasa_v) || tasa_v <= 0 || tasa_v > 1) return(NULL)
        list(tipo = tipo, tasa = tasa_v,
             k = if (length(kv) == 1L && !is.na(kv)) kv else NA_integer_)
      })
      limpio_a <- Filter(Negate(is.null), limpio_a)
      if (length(limpio_a)) tasa_aplicacion <- limpio_a
    }
    return(list(fuente = "historico", periodo = periodo, tau = NA_real_,
                tau_base = tau_base, por_facultad = por_facultad,
                rendimiento_tramos = rendimiento_tramos,
                rendimiento_fuente = rendimiento_fuente,
                tasa_aplicacion = tasa_aplicacion))
  }
  if (identical(fuente, "tau_global") && is.finite(tau) && tau > 0 && tau <= 1) {
    return(list(fuente = "tau_global", periodo = periodo, tau = tau))
  }
  NULL
}

#' Resuelve la calibracion vigente. Sin declaracion NO se inventa un
#' historico: las curvas embebidas (medidas sobre un estudio anterior real)
#' se usan igual, pero la procedencia se DECLARA como calibracion_embebida
#' para que la UI lo diga en voz alta — anti-fallback.
.cm_efectividad_calibracion <- function(cfg = NULL) {
  ef <- .cm_efectividad_normalize_config(if (is.list(cfg)) cfg[["efectividad"]] else NULL)
  if (is.null(ef)) return(list(fuente = "calibracion_embebida", periodo = "", tau = NA_real_))
  ef
}

#' Anota el frame con la efectividad esperada por curso-horario.
#' Idempotente y sin RNG; con frame vacío o sin eligible_n devuelve tal cual.
#' Con fuente "tau_global" no hay curvas: esperado = elegibles x tau, y las
#' columnas de curva quedan NA a proposito (la UI muestra la via global).
.cm_aulas_efectividad_anotar <- function(aula_frame, calibracion = NULL) {
  if (!is.data.frame(aula_frame) || !nrow(aula_frame) || !"eligible_n" %in% names(aula_frame)) {
    return(aula_frame)
  }
  cal <- if (is.list(calibracion) && length(calibracion)) calibracion else
    list(fuente = "calibracion_embebida", periodo = "", tau = NA_real_)
  el <- suppressWarnings(as.numeric(aula_frame$eligible_n))
  el[!is.finite(el)] <- 0
  if (identical(cal$fuente, "tau_global")) {
    aula_frame$p_aplicada_ref <- NA_real_
    aula_frame$rendimiento_ref <- NA_real_
    aula_frame$efectividad_tau <- round(as.numeric(cal$tau), 3)
    aula_frame$efectivas_esperadas <- round(el * as.numeric(cal$tau), 1)
  } else {
    tipos <- aula_frame$teacher_type %||% rep("", nrow(aula_frame))
    # Tasa de aplicacion: capa OPERATIVA (visitas/cadena). V7 la saco de las
    # efectivas esperadas con evidencia (residual condicional ~1): un docente
    # decide SI el aula entra, no cuanto rinde adentro.
    p <- if (is.list(cal$tasa_aplicacion) && length(cal$tasa_aplicacion)) {
      .cm_efectividad_p_desde_tabla(tipos, cal$tasa_aplicacion)
    } else {
      .cm_efectividad_p_aplicada(tipos)
    }
    r <- .cm_efectividad_rendimiento(aula_frame$eligible_n, tramos = cal$rendimiento_tramos)
    aula_frame$p_aplicada_ref <- round(p, 3)
    aula_frame$rendimiento_ref <- round(r, 3)
    # Las tres piernas de `rendimiento_ref`, para que Monitoreo pueda decir CUAL
    # falla y no solo que falla. No cambian ningun esperado: su producto es
    # `rendimiento_ref`.
    piernas <- .cm_efectividad_piernas(aula_frame$eligible_n, tramos = cal$rendimiento_tramos)
    aula_frame$tasa_asistencia_aula <- round(piernas$asistencia, 3)
    aula_frame$tasa_respuesta_aula <- round(piernas$respuesta, 3)
    aula_frame$tasa_validez_aula <- round(piernas$validez, 3)
    # Ajuste por facultad: solo donde el historico declaro un tau con
    # suficiencia; el resto queda en 1 con k=NA — la UI dice "el historico no
    # pudo generar informacion especifica para esta facultad".
    factor <- rep(1, nrow(aula_frame))
    k_fac <- rep(NA_integer_, nrow(aula_frame))
    res_ref <- rep(NA_real_, nrow(aula_frame))
    res_ref_k <- rep(NA_integer_, nrow(aula_frame))
    res_ref_lo <- rep(NA_real_, nrow(aula_frame))
    res_ref_hi <- rep(NA_real_, nrow(aula_frame))
    res_aplicado <- rep(FALSE, nrow(aula_frame))
    pf <- cal$por_facultad
    tau_base <- suppressWarnings(as.numeric(cal$tau_base))
    if (is.list(pf) && length(pf) && length(tau_base) == 1L &&
        is.finite(tau_base) && tau_base > 0) {
      fac_col <- toupper(trimws(as.character(aula_frame$faculty %||% rep("", nrow(aula_frame)))))
      for (e in pf) {
        fk <- toupper(trimws(as.character(e$facultad)[1]))
        tv <- suppressWarnings(as.numeric(e$tau)[1])
        kv <- suppressWarnings(as.integer(e$k)[1])
        if (nzchar(fk) && is.finite(tv) && tv > 0) {
          idx <- fac_col == fk
          # El residual OBSERVADO viaja siempre; el APLICADO solo si el sello lo
          # autoriza. Son dos columnas y no una a proposito: `factor_facultad`
          # es lo que el modelo usa y `residual_ref` es lo que el historico vio.
          # Colapsarlas haria que una facultad sin base pareciera calibrada.
          res_ref[idx] <- tv / tau_base
          res_ref_k[idx] <- kv
          res_ref_lo[idx] <- if (is.null(e$ic_low)) NA_real_ else e$ic_low / tau_base
          res_ref_hi[idx] <- if (is.null(e$ic_high)) NA_real_ else e$ic_high / tau_base
          if (isTRUE(e$aplicar)) {
            res_aplicado[idx] <- TRUE
            factor[idx] <- tv / tau_base
            k_fac[idx] <- kv
          }
        }
      }
    }
    aula_frame$factor_facultad <- round(factor, 3)
    aula_frame$facultad_k <- k_fac
    # Referencia: lo que el historico observo para ESTA facultad, aplicado o no,
    # con su k y su intervalo. Una facultad sin base suficiente publica aqui su
    # residual y un `residual_aplicado = FALSE` al lado, que es exactamente lo
    # que se pidio: que quede absolutamente claro y que no toque el modelo.
    aula_frame$residual_ref <- round(res_ref, 3)
    aula_frame$residual_ref_k <- res_ref_k
    aula_frame$residual_ref_ic_low <- round(res_ref_lo, 3)
    aula_frame$residual_ref_ic_high <- round(res_ref_hi, 3)
    aula_frame$residual_aplicado <- res_aplicado
    # La tasa de efectividad DEL AULA (nombre propio, V7): R(tamano) x F(fac).
    aula_frame$tasa_efectividad_aula <- round(r * factor, 3)
    # EFECTIVAS ESPERADAS = elegibles x tasa del aula — CONDICIONAL a que el
    # aula se aplique. El riesgo del docente NO descuenta efectivas (la cadena
    # repone caidas); vive en p_aplicada_ref para presupuesto y cadena.
    aula_frame$efectivas_esperadas <- round(el * r * factor, 1)
    # LA MISMA CUENTA CON LA TASA DE LA FACULTAD, al lado.
    #
    # Las dos columnas responden preguntas distintas y hasta ahora solo existia
    # una. `efectivas_esperadas` usa la tasa del aula, que ajusta por su tamano;
    # esta usa el promedio de su facultad, que es la vara con la que se
    # dimensiono la muestra y con la que se mide el cumplimiento de la cuota.
    # Sin las dos en el frame, comparar exige multiplicar por fuera y cada
    # superficie lo hacia a su manera —medido: la matriz de seleccion publicaba
    # la de facultad y la app la del aula, con 120 de 174 aulas discrepando y
    # hasta doce encuestas de diferencia en una sola—.
    #
    # La tasa que se usa aqui es la DERIVADA del marco vigente, la misma que
    # `calc_muestra_aulas_tasas_facultad` publica, y no la sellada en el
    # estudio: asi las dos columnas salen del mismo marco y su diferencia es
    # solo el grano. La sellada puede ser de un marco anterior —lo es en
    # HSVG2026— y mezclarlas haria que esta comparacion midiera dos efectos.
    aula_frame$tasa_facultad <- local({
      fac <- toupper(trimws(as.character(aula_frame$faculty %||% "")))
      inc <- aula_frame$included
      ok <- nzchar(fac) & is.finite(r) & el > 0
      if (!is.null(inc)) ok <- ok & (inc %in% TRUE)
      out <- rep(NA_real_, nrow(aula_frame))
      for (ff in unique(fac[ok])) {
        idx <- ok & fac == ff
        tot <- sum(el[idx])
        if (tot <= 0) next
        out[fac == ff] <- sum(el[idx] * r[idx] * factor[idx]) / tot
      }
      round(out, 4)
    })
    aula_frame$esperadas_facultad <- round(el * aula_frame$tasa_facultad, 1)
    # **El denominador propio, al lado del del aula.**
    #
    # `eligible_n` cuenta TODOS los elegibles de la seccion, sean de la facultad
    # del aula o no, y es con ese numero con el que se dimensiona. Medido sobre
    # el estudio HSVG 2026: nuestras 193 titulares cargan 6.896 elegibles y
    # 6.555 son de su facultad (95,1 %). No muerde hoy porque la atribucion es
    # limpia -el sorteo balancea por facultad-, pero el metodo es el mismo que
    # deja una seleccion ajena en 4,8 % en GASTRONOMIA.
    #
    # `faculty_match_share` YA lo mide (criterio 8, parte 1: proporcion de
    # elegibles unicos cuya facultad coincide con la del curso). Lo que faltaba
    # no era calcularlo: era publicarlo como conteo y ponerlo donde se ve.
    #
    # **Se publican los dos y NO se cambia el que dimensiona.** Cambiar el
    # denominador mueve todos los esperados y todos los cupos de golpe: eso es
    # una decision del estudio, no un arreglo. Aqui queda la brecha a la vista
    # para poder tomarla.
    #
    # `round` y no `floor`: `share` es una proporcion de conteos redondeada a 4
    # decimales, asi que el producto RECONSTRUYE un entero que ya existia; no es
    # una promesa que redondear a la baja.
    share <- suppressWarnings(as.numeric(aula_frame$faculty_match_share %||% rep(NA_real_, nrow(aula_frame))))
    el_prop <- ifelse(is.finite(share), round(el * share), NA_real_)
    aula_frame$eligible_n_propios <- as.integer(el_prop)
    aula_frame$efectivas_esperadas_propias <- round(el_prop * r * factor, 1)
  }
  # La procedencia viaja en la fila: la UI y Monitoreo la leen, no la asumen.
  aula_frame$efectividad_fuente <- as.character(cal$fuente)
  aula_frame$efectividad_periodo <- as.character(cal$periodo %||% "")
  # Contrato con Monitoreo (2026-08-20): declarar de donde salio la meta para
  # que su lado pueda afirmar "del diseno" sin inferirlo. Literal estable.
  aula_frame$meta_origen <- "diseno"
  aula_frame
}

#' La tasa de efectividad de cada FACULTAD, derivada del marco anotado.
#'
#' Plan 1b/E3: es el numero que dimensiona (cupos = cuota / (P25 x tasa)) y el
#' que la tarjeta didactica de Cursos-horario requeridos explica. UN dueño:
#' se deriva de las columnas que el anotador ya escribio (rendimiento_ref y
#' factor_facultad), asi ninguna superficie recalcula por su cuenta.
#' Devuelve una lista por facultad: {facultad, tasa, n_aulas, elegibles,
#' con_residual (si su F vino del historico), facultad_k}.
calc_muestra_aulas_tasas_facultad <- function(aula_frame) {
  if (!is.data.frame(aula_frame) || !nrow(aula_frame) ||
      !all(c("faculty", "eligible_n", "rendimiento_ref") %in% names(aula_frame))) {
    return(list())
  }
  el <- suppressWarnings(as.numeric(aula_frame$eligible_n))
  el[!is.finite(el) | el < 0] <- 0
  r <- suppressWarnings(as.numeric(aula_frame$rendimiento_ref))
  f <- suppressWarnings(as.numeric(aula_frame$factor_facultad %||% rep(1, nrow(aula_frame))))
  f[!is.finite(f)] <- 1
  k_fac <- suppressWarnings(as.integer(aula_frame$facultad_k %||% rep(NA_integer_, nrow(aula_frame))))
  fac <- toupper(trimws(as.character(aula_frame$faculty)))
  ok <- nzchar(fac) & is.finite(r) & el > 0
  # Solo el marco ELEGIBLE dimensiona: si el frame trae la marca `included`,
  # las excluidas por criterios no aportan a la tasa de su facultad.
  inc <- aula_frame$included
  if (!is.null(inc)) ok <- ok & (inc %in% TRUE)
  salida <- list()
  for (ff in unique(fac[ok])) {
    idx <- ok & fac == ff
    tot_el <- sum(el[idx])
    if (tot_el <= 0) next
    tasa <- sum(el[idx] * r[idx] * f[idx]) / tot_el
    # Los DOS factores por separado, para que la pantalla pueda ensenar de
    # donde sale la tasa en vez de pedir que se crea el resultado:
    #   mix    = R ponderado por elegibles — que rinde el aula tipica de esta
    #            facultad SOLO por su mezcla de tamanos (chicas rinden mas).
    #   factor = F residual — lo que esta facultad rindio en el historico MAS
    #            ALLA de su mix; 1 cuando el historico no le dio base propia.
    # Se cumple tasa = mix x factor porque F es constante dentro de la facultad.
    mix <- sum(el[idx] * r[idx]) / tot_el
    ff_vals <- unique(f[idx])
    factor_res <- if (length(ff_vals) == 1L) ff_vals[[1]] else if (mix > 0) tasa / mix else 1
    # EL MIX, literal: como se reparten las aulas de esta facultad entre los
    # tramos de tamano. Gonzalo, mirando la tarjeta: «¿a que se refiere con un
    # mix de tamanos?». Decirlo en prosa no alcanzo; con esto la pantalla puede
    # ENSENARLO — «60 aulas que rinden 0,80, 90 que rinden 0,56…» — y se ve por
    # que dos facultades con las mismas aulas tienen tasas distintas.
    mix_tramos <- local({
      rr <- r[idx]; ee <- el[idx]
      niveles <- sort(unique(rr[is.finite(rr)]), decreasing = TRUE)
      lapply(niveles, function(tv) {
        sel <- is.finite(rr) & rr == tv
        list(
          tasa = round(tv, 4),
          n_aulas = as.integer(sum(sel)),
          elegibles = as.integer(round(sum(ee[sel]))),
          desde = as.integer(min(ee[sel])),
          hasta = as.integer(max(ee[sel]))
        )
      })
    })
    kk <- k_fac[idx]
    kk <- kk[!is.na(kk)]
    salida[[length(salida) + 1L]] <- list(
      facultad = ff,
      tasa = round(tasa, 4),
      # 6 decimales, no 4: con 4 el producto de los publicados NO reconstruye
      # la tasa publicada (0,6102 contra 0,6103 en el fixture de DERECHO) y la
      # pantalla ensenaria una cuenta que no da el numero que muestra al lado.
      rendimiento_mix = round(mix, 6),
      factor_residual = round(factor_res, 6),
      mix_tramos = mix_tramos,
      n_aulas = as.integer(sum(idx)),
      elegibles = as.integer(round(tot_el)),
      con_residual = any(f[idx] != 1),
      facultad_k = if (length(kk)) kk[[1]] else NA_integer_
    )
  }
  orden <- order(vapply(salida, function(x) -x$elegibles, numeric(1)))
  salida[orden]
}

