# Verificador del mazo contra el recetario.
#
# La guia de canvas (`debug_ph`) pinta bordes magenta sobre los placeholders.
# Sirve para mirar una lamina, no para saber si un mazo de sesenta cumple. Peor:
# activa mete 978 bordes que tapan lo que se quiere ver —una comparacion de
# color con la guia encendida oculto el hallazgo de los tamanos de letra—.
#
# Esto la reemplaza por lo que hacia falta: medir el .pptx ya generado contra
# las recetas medidas del entregable aprobado, y devolver los incumplimientos
# con su lamina. Un mazo se aprueba por conformidad, no por ausencia de bordes.
#
# La cadena de medicion es la misma que se valido a mano sobre el mazo del
# 14-08, y el orden importa porque cada paso descarta un falso positivo que ya
# costo una conclusion equivocada:
#
#   segmento -> barra (misma fila) -> grafico (misma columna)
#
# - Un segmento se reconoce por su RELLENO. Solo los colores de la escala: el
#   azul institucional y el celeste pintan cabeceras y la columna Top Two Box, y
#   meterlos ensancha el rango de alturas hasta hacerlo inutil.
# - La leyenda repite esos mismos colores en cuadraditos; sin descartarlos, cada
#   leyenda se lee como un grafico de "una barra de 0.108 in".
# - La caja de etiqueta usa el mismo azul que la barra categorica y lleva texto
#   propio; sin ese filtro el medidor devuelve 0.159 in en decenas de laminas.
# - El grosor de un grafico es la MODA de sus barras, no la media: en una lamina
#   conviven la barra, la cabecera y la leyenda.
# - Y se mide POR GRAFICO, no por lamina: una lamina de dos graficos con 7 y 6
#   barras no es "un grafico de 13 barras finisimas".

# P51, MEDIDO Y ABIERTO: **dos laminas apilan la escala AL REVES**. El orden
# canonico de izquierda a derecha es
#
#   F4B183 (Totalmente en desacuerdo) > FFD965 > ADD493 > 70AD47 > BFBFBF (SIN INF)
#
# y lo cumplen 33 de las 35 laminas medibles de `p52.pptx`. Las laminas **28 y
# 30** dibujan `BFBFBF > 70AD47 > ADD493 > FFD965`, o sea la canonica invertida
# con el gris al frente: sus barras corren de acuerdo a desacuerdo mientras el
# resto del mazo corre de desacuerdo a acuerdo. **El entregable aprobado tiene
# CERO** —31 de 31 en orden canonico—, asi que contra la vara son 2 contra 0.
#
# MEDIDA YA LA LEYENDA, ES PEOR QUE UNA INVERSION. Sus cuadros llevan el mismo
# orden que las barras, asi que son coherentes entre si; el problema es cual se
# perdio. Emparejando cada cuadro con la etiqueta que tiene a su derecha:
#
#   lamina 24 y 27 (sanas)   F4B183 · FFD965 · ADD493 · 70AD47 · BFBFBF
#   lamina 28 y 30           BFBFBF · 70AD47 · ADD493 · FFD965 · BFBFBF
#
# La inversion se comio el NARANJA y puso el gris al frente, asi que quedan
# **cuatro colores para cinco categorias** y **BFBFBF esta asignado dos veces**:
# a «Totalmente en desacuerdo» y a «SIN INF». En esas dos laminas esas dos
# categorias son INDISTINGUIBLES, en la leyenda y en las barras. No es que la
# lamina vaya al reves: es que no se puede leer.
#
# EL NARANJA NO SE DIBUJA POCO: NO SE DIBUJA NUNCA. Contadas las ocurrencias de
# `<a:srgbClr>` de la rampa en cada lamina:
#
#   lamina 24 (sana)   F4B183 8 · FFD965 8 · ADD493 8 · 70AD47 16 · BFBFBF 8
#   lamina 27 (sana)   7 · 7 · 7 · 14 · 7
#   lamina 28          **F4B183 0** · 8 · 8 · 16 · **BFBFBF 16**
#   lamina 30          **0** · 3 · 3 · 6 · **6**
#
# El gris aparece EXACTAMENTE EL DOBLE, que es la firma de estar sirviendo a dos
# series. Asi que no es que el nivel «Totalmente en desacuerdo» no tenga casos
# —si los tuviera, seguiria en la leyenda con su color—: es que su color se
# perdio y el gris ocupo su lugar.
#
# DOS SITIOS PUEDEN PRODUCIRLO, los dos localizados:
#
#   1. `graficador_barras_apiladas.R:1697-1698` — `niveles_stack` y
#      `niveles_leyenda` se invierten segun `invertir_segmentos` /
#      `invertir_leyenda`, y de ahi sale el `levels_cat` de la paleta.
#   2. `graficador_paleta.R:110` — la rama POSICIONAL de
#      `.graficos_mk_palette()`: `pal_user[seq_along(levels_cat)]`, que asigna
#      por posicion. El propio archivo ya avisa del riesgo unas lineas antes
#      («caeria al branch posicional y asignaria el color por posicion en vez de
#      por etiqueta, invirtiendo colores cuando el factor esta en orden distinto
#      al del override»), asi que este defecto es una recaida de algo ya visto.
#
# LOS DOS SITIOS DE ARRIBA PARTIAN DE UNA PREMISA FALSA, y esta medida: **el
# plan NO declara colores en ningun sitio**. Cargado el `.pulso` y recorridas
# sus 66 laminas, la unica clave de color/orden que existe en todo el plan es un
# `border_color`; no hay `colores_grupos`, ni `paleta`, ni `invertir_segmentos`,
# ni `orden_categorias` (los titulos de lamina tambien vienen VACIOS). Asi que
# `pal_user` no llega del plan y la rampa se resuelve en otro lado.
#
# DONDE SE RESUELVE DE VERDAD: `graficos_preset_acreditacion.R`, con
# `.PRESET_ACRD_RAMPA` (cuatro colores) y `.PRESET_ACRD_FUERA_ESCALA` (el gris).
# `.preset_acreditacion_colores()` busca cada etiqueta en `.PRESET_ACRD_ESCALA`
# y arma el color por POSICION:
#
#   out <- ifelse(is.na(pos), .PRESET_ACRD_FUERA_ESCALA, .PRESET_ACRD_RAMPA[pos])
#
# o sea que **una etiqueta que no reconoce se convierte en el gris de «fuera de
# escala», que es el MISMO gris de SIN INF, y sin avisar**. Ese es el patron que
# ya mordio antes en este repo: una lista cerrada se traga en silencio lo que no
# reconoce.
#
# LO DESMIENTE. Corrida en frio `.preset_acreditacion_colores()` con las
# etiquetas EXACTAS de la 28 —«Totalmente en desacuerdo», «En desacuerdo», «De
# acuerdo», «Totalmente de acuerdo», «SIN INF»—, devuelve la rampa CANONICA y
# con cinco colores distintos:
#
#   F4B183 · FFD966 · B0D597 · 8FC36B · BFBFBF
#
# `.preset_acrd_clave()` normaliza las cinco sin problema y las cuatro de escala
# se reconocen. **El preset NO es el culpable.**
#
# Y la misma corrida destapa algo mas util: **esos hexes no son los del mazo**.
# El XML dibuja `FFD965` y `ADD493`, que no estan ni en `.PRESET_ACRD_RAMPA`
# (`FFD966`/`B0D597`) ni en el default de `reporte_plan_ppt.R:1821`
# (`FFD966`/`B7D7A8`). O sea que **los colores del mazo NO coinciden con ninguna
# constante declarada del motor**: algo los transforma antes de escribirlos.
#
# TRAZADO, Y EL GRAFICADOR ES INOCENTE. Instrumentado `colores_efectivos` en
# `graficador_barras_apiladas.R` para volcar por render `niveles_leyenda`, el
# `colores_grupos` de ENTRADA y el vector resuelto. Sobre los **232 renders**
# del mazo:
#
#   entrada == salida en los 232        `.graficos_mk_palette()` es paso directo
#   150 renders  #F4B183 #FFD965 #ADD493 #70AD47 #BFBFBF   (la correcta)
#    15 renders  #BFBFBF #70AD47 #ADD493 #FFD965 #BFBFBF   (la rota)
#    54 renders  #081F5C #9DC3E6                            (dicotomicas)
#
# En los 15 rotos `niveles_leyenda` llega en orden CANONICO —«Totalmente en
# desacuerdo | En desacuerdo | De acuerdo | Totalmente de acuerdo | SIN INF»— y
# aun asi el color sale mal, porque **`colores_grupos` YA LLEGA ROTO**: la
# entrada es identica a la salida. El defecto esta AGUAS ARRIBA de
# `graficar_barras_apiladas()`, en quien construye ese vector.
#
# La rota es la canonica con **los cuatro de escala INVERTIDOS y el gris
# anadido al final**: `rev(F4B183, FFD965, ADD493, 70AD47)` + `BFBFBF`. Por eso
# el naranja se cae —queda fuera de los cuatro primeros— y el gris entra al
# frente. 15 renders = las 2 laminas PPT mas sus gemelas de Word.
#
# Y OJO CON EL CALLEJON DE ANTES: la paleta correcta `#F4B183 #FFD965 #ADD493
# #70AD47 #BFBFBF` coincide EXACTAMENTE con los hexes del XML, asi que si existe
# —se construye en tiempo de ejecucion, no esta escrita como constante—. Que un
# `grep` no la encuentre no significaba que no existiera.
#
# ACOTADO UN PASO MAS. `colores_grupos` se asigna en `reporte_plan_ppt.R` desde
# tres sitios —4428/4954/5133 con `.paleta_auto()`, y 4451/5006/5169 con
# `.reporte_plan_palette_for_levels()`—, y ninguno la INVENTA:
#
# - `.reporte_plan_palette_for_levels()` (`reporte_plan_opciones.R:317`) mapea
#   por NOMBRE contra un `palette` recibido, con respaldo POSICIONAL para los
#   que no casan. No puede producir `BFBFBF` dos veces salvo que el `palette`
#   que recibe ya lo traiga repetido.
# - `.reporte_plan_pulso_palette_for_levels()` (misma, 388) usa OTROS hexes
#   —`CA5651`, `E4A34C`, `85BB85`, `4F8A3E`—, que no son los del mazo.
# - `.paleta_auto()` (`reporte_plan_ppt.R:3384`) **no construye**: busca un
#   objeto llamado `paleta_<list_name>` en `env_diapos` y exige que venga CON
#   NOMBRES (`if (is.null(names(pal))) return(NULL)`).
#
# Y LA PALETA ROTA NO ESTA GUARDADA EN EL `.pulso`: recorrido entero
# `graficos_config`, el UNICO vector hex que existe es
# `F4B183 FFD965 ADD493 70AD47` en `plan$slides$5$payload$estilo$
# first_col_fill_by_row`, sin nombres y en orden CANONICO. (El buscador se
# verifico aflojando el filtro: encuentra ese y sólo ese, asi que el cero no es
# del filtro.)
#
# CONCLUSION: la paleta rota es un objeto `paleta_<algo>` **nombrado**, vivo en
# el entorno de generacion del mazo. Si sus nombres estan emparejados con los
# colores equivocados, el mapeo por etiqueta la propaga tal cual y nadie miente:
# cada pieza hace su trabajo sobre una entrada ya mal formada.
#
# ENCONTRADO, SIN TRAZAR. Las paletas SI estan en el `.pulso`: en
# `graficos_config$paletas`, **34 paletas** nombradas `lst_pNN`, cada una una
# LISTA de pares etiqueta→color. La busqueda anterior no las vio porque sólo
# inspeccionaba vectores `character`, y son listas: **el «cero» de antes era del
# filtro, otra vez** —y esta vez el aflojado del patron no bastó, porque lo que
# fallaba era el TIPO, no el patron—.
#
# LA CULPABLE ES `lst_p14`, guardada AL REVES y con otra capitalizacion:
#
#   SIN INF                   #BFBFBF
#   Totalmente de Acuerdo     #70AD47
#   De Acuerdo                #ADD493
#   En Desacuerdo             #FFD965
#   Totalmente en Desacuerdo  #F4B183
#
# El mecanismo encaja exacto con lo medido. `.reporte_plan_palette_for_levels()`
# casa primero por NOMBRE: «SIN INF» es identico y se lleva su `BFBFBF`. Los
# otros cuatro NO casan —los datos dicen «De acuerdo» y la paleta «De Acuerdo»,
# con A mayuscula— y caen al respaldo POSICIONAL, que toma los primeros de `pal`
# **en su orden guardado**: `BFBFBF 70AD47 ADD493 FFD965`. El naranja queda
# quinto y nunca se usa. Resultado `BFBFBF · 70AD47 · ADD493 · FFD965 · BFBFBF`,
# que es exactamente el vector que la traza vio llegar a los 15 renders.
#
# NO ES LA UNICA GUARDADA RARA, y conviene mirarlas al reparar: `lst_p20` esta
# tambien invertida (Muy satisfecho primero), `lst_p16` tiene «De acuerdo» y
# «Totalmente de acuerdo» cambiados de sitio, y `lst_p10` pinta «Totalmente en
# Desacuerdo» con `#9DC3E6`, el celeste de las dicotomias.
#
# REPARADO Y MEDIDO (`66c3a72d`). El emparejado por nombre de
# `.reporte_plan_palette_for_levels()` ahora prueba el nombre EXACTO y, solo si
# no casa, el normalizado sin acentos ni mayusculas con
# `.reporte_plan_ascii_lower()` —que ya vivia en ese archivo sin usarse ahi—.
# Medido sobre `p54.pptx`, regenerado con el arreglo:
#
#   fuera de canon   2 -> **0**   (motor 35 de 35; aprobado 31 de 31)
#   leyenda de la 28 F4B183 · FFD965 · ADD493 · 70AD47 · BFBFBF, **cinco
#                    colores distintos**, en orden y con el naranja de vuelta
#   vara            25 -> **25**, distribucion IDENTICA
#   cortes           2, los mismos (el par entrelazado de la 59)
#   solapes          1, el mismo (la 59)
#
# O sea que arregla lo suyo y no mueve nada mas. **P51 CERRADO.**
#
# Y LA SALVEDAD QUE SE LEVANTO NO SE SOSTIENE, tambien medida: se dijo que
# `lst_p10` —que pinta «Totalmente en Desacuerdo» con `#9DC3E6`, el celeste de
# las dicotomias— quedaba sin cubrir. Buscadas todas las laminas cuya leyenda es
# de ESCALA y llevan azul de dicotomia en sus cuadros: **CERO**, ni en `p54` ni
# en `p52`. El buscador se verifico aflojando el filtro y encuentra **42**
# laminas de escala, asi que el cero es real. Ese par mal guardado **no llega al
# mazo**: es un riesgo latente del dato, no un defecto del entregable. Quedan
# igual anotadas `lst_p20` (invertida) y `lst_p16` (dos niveles cambiados de
# sitio), que el arreglo si neutraliza porque su fallo era de capitalizacion.
#
# El barrido VISUAL de P41 habia dado la 30 por limpia. Una inversion de rampa
# no salta en una hoja de contacto: se ve bien, solo esta al reves.
#
# Colores de la rampa de escala (dos paletas: la del entregable y la del motor).
.VERIF_RAMPA <- c("F4B183", "FFD965", "FFD966", "ADD493", "B0D597",
                  "70AD47", "8FC36B", "CA5651")

# Azul institucional: barras categoricas.
.VERIF_AZUL <- c("081F5C")

# Todo se expresa en CENTIMETROS. El OOXML mide en EMU y `officer` en pulgadas,
# pero un informe que dice «0.303 in» obliga a convertir para compararlo con una
# regla o con la guia del canvas, que ya acota en cm. La conversion se hace una
# vez, al construir los umbrales.
.VERIF_CM_POR_IN <- 2.54

# Umbrales DERIVADOS del entregable que el cliente aprobo, no elegidos a ojo.
#
# Salen de `calibrar_umbrales()` sobre `Informe Contabilidad 14-08.pptx`, con el
# percentil 10 para los pisos y el 90 para los techos. Los anteriores —0.32 in,
# 9 barras, 11 pt— se habian fijado contra un ideal, y el resultado es que el
# propio entregable aprobado los incumplia mas del doble que el motor. Un piso
# que la referencia no cumple no mide conformidad: mide distancia a una idea.
#
# Al calibrar, DOS de los cuatro salieron mas exigentes que el ideal, no menos:
# el aprobado no baja de 12 pt en la decima parte peor de su texto, ni de 0.256
# in en sus barras categoricas. El ideal era laxo justo donde el entregable es
# cuidadoso.
#
# Se usa el percentil y no el extremo a proposito: el peor caso de un mazo de
# sesenta laminas es un accidente, y calibrar contra el deja pasar cualquier
# cosa. La vara es parecerse al entregable TIPICO, no a su peor lamina.
.VERIF_UMBRALES <- list(
  grosor_escala_cm     = 0.77,
  grosor_categorica_cm = 0.65,
  barras_por_grafico   = 7L,
  # LA VARA MEDIA UNA PALETA Y EL MAZO TIENE DOS. `barras_por_grafico` sale de
  # `barras_escala`, que solo cuenta la rampa; el techo se aplicaba luego a las
  # dos. Medido sobre el aprobado con el mismo filtro que usa la regla: sus
  # graficos AZULES llegan a 8 barras por grafico y a 1.80 cm de grosor, y nada
  # de eso lo miraba nadie.
  #
  # Los dos son TECHOS y van al MAXIMO del aprobado, no a su p90 —igual que
  # `barras_por_grafico`, que tambien sale de un `max()`—. Medido: con el p90
  # el techo de grosor marcaba 3 de los 25 graficos del PROPIO aprobado, y un
  # techo que la referencia no cumple no mide conformidad. El maximo se redondea
  # hacia ARRIBA para que su propio extremo no caiga fuera por el decimal.
  barras_por_grafico_categorico = 8L,
  # 1.81 y no 1.80: el valor exacto es 1.8049 y a dos decimales hacia abajo el
  # PROPIO aprobado incumplia su techo por cinco milesimas. Un techo que la
  # referencia no cumple no mide conformidad.
  grosor_categorico_max_cm      = 1.81,
  texto_minimo_pt      = 12,
  # El aprobado no tiene NI UNO en la rampa de escala: sus 67 rojos son todos
  # titulos. El umbral es cero porque el modelo esta en cero.
  rojo_en_rampa_max    = 0L,
  # Percentil 10 del borde superior del titulo en el aprobado. La mediana es
  # 0.90 cm; se toma el p10 para no marcar por una lamina que empieza mas arriba.
  titulo_top_min_cm    = 0.78,
  # Proporcion de texto por debajo del minimo que el aprobado se permite.
  texto_prop_max       = 0.062,
  # Tolerancia de dispersion de grosor DENTRO de una lamina. 0.05 cm es medio
  # milimetro: por debajo es redondeo del render, por encima se ve.
  grosor_dispersion_max_cm = 0.05,
  # Cifras blancas sobre un tramo claro de la rampa. El aprobado tiene CERO.
  texto_ilegible_max   = 0L,
  # Percentil 10 del aprobado. Su mediana es 4.24 cm; el motor nunca arranca
  # tan arriba como el peor caso del modelo.
  arranque_min_cm      = 3.53,
  # Hueco ENTRE premisas. El aprobado separa 1.76 cm de mediana y el motor
  # 0.97: es lo que hay detras de «se ve muy apretado».
  hueco_premisas_min_cm = 1.40,
  # Dispersion de grosor ENTRE laminas gemelas —mismo numero de barras—. Es el
  # eje de «dos laminas del mismo tipo no salen iguales», y ninguna regla lo
  # media: B3 mira DENTRO de una lamina y no ve que la de al lado saque otro
  # grosor. Medido: el motor dispersa 0.01 cm entre gemelas y el aprobado 0.17,
  # asi que aqui el motor es el mejor de los dos y el umbral se pone donde
  # protege lo ganado, no donde el modelo llega.
  grosor_gemelas_max_cm = 0.10
)

.VERIF_EMU <- 914400


#' Lee las laminas de un .pptx como texto XML
#' @keywords internal
.verif_laminas_xml <- function(path) {
  if (!file.exists(path)) {
    stop_api(400L, "E_ARCHIVO_NO_EXISTE", detalle = "No se encuentra el .pptx a verificar.")
  }
  nombres <- utils::unzip(path, list = TRUE)$Name
  nombres <- grep("^ppt/slides/slide[0-9]+\\.xml$", nombres, value = TRUE)
  if (!length(nombres)) return(list())
  orden <- order(as.integer(sub("\\D*(\\d+)\\.xml$", "\\1", nombres)))
  nombres <- nombres[orden]

  destino <- tempfile("verif_mazo_")
  dir.create(destino, showWarnings = FALSE, recursive = TRUE)
  on.exit(unlink(destino, recursive = TRUE), add = TRUE)
  utils::unzip(path, files = nombres, exdir = destino)

  lapply(nombres, function(n) {
    con <- file(file.path(destino, n), encoding = "UTF-8")
    on.exit(close(con), add = TRUE)
    paste(readLines(con, warn = FALSE), collapse = "")
  })
}


#' Formas con geometria y relleno de una lamina
#' @keywords internal
.verif_formas <- function(xml) {
  sps <- regmatches(xml, gregexpr("<p:sp>.*?</p:sp>", xml))[[1]]
  if (!length(sps)) return(list())

  out <- list()
  for (sp in sps) {
    m <- regmatches(sp, regexpr(
      '<a:off x="(-?\\d+)" y="(-?\\d+)"/>\\s*<a:ext cx="(\\d+)" cy="(\\d+)"', sp))
    if (!length(m)) next
    nums <- as.numeric(regmatches(m, gregexpr("-?\\d+", m))[[1]])
    if (length(nums) < 4L) next

    fill <- regmatches(sp, regexpr('<a:solidFill>\\s*<a:srgbClr val="[0-9A-Fa-f]{6}"', sp))
    if (!length(fill)) next
    col <- toupper(sub('.*val="', "", sub('"$', "", fill)))
    col <- substr(gsub('[^0-9A-Fa-f]', "", col), 1, 6)

    textos <- regmatches(sp, gregexpr("<a:t>[^<]*</a:t>", sp))[[1]]
    texto <- trimws(paste(gsub("</?a:t>", "", textos), collapse = ""))

    out[[length(out) + 1L]] <- list(
      x = nums[[1]] / .VERIF_EMU, y = nums[[2]] / .VERIF_EMU,
      w = nums[[3]] / .VERIF_EMU, h = nums[[4]] / .VERIF_EMU,
      col = col, texto = texto
    )
  }
  out
}


#' Segmentos de barra de una familia
#'
#' `exigir_sin_texto` va activo para TODAS las familias, no solo la categorica:
#' una barra de datos no lleva texto propio —su cifra es una capa aparte—, y las
#' cajas que si lo llevan son la columna Top Two Box, con relleno de la rampa y
#' alto fijo de 0.159 in. Sin este filtro la mediana del grosor del entregable
#' aprobado salia 0.159 exacta: no era el grosor de sus barras, era el de una
#' caja de texto contada sesenta veces.
#'
#' @keywords internal
.verif_segmentos <- function(formas, colores, exigir_sin_texto = TRUE) {
  Filter(function(f) {
    f$col %in% colores &&
      f$h > 0 && f$w > f$h &&                       # horizontal
      !(f$w < 0.25 && f$h < 0.25) &&                # no es cuadradito de leyenda
      (!exigir_sin_texto || !nzchar(f$texto))       # no es caja de etiqueta
  }, formas)
}


#' Agrupa segmentos en barras (misma fila) y barras en graficos (misma columna)
#'
#' @param tol_hueco Separacion en pulgadas a partir de la cual dos segmentos de
#'   la misma fila pertenecen a graficos distintos.
#'
#' @return Lista de graficos; cada uno con `n` barras y su `grosor` (la moda).
#' @keywords internal
.verif_graficos <- function(segs, tol_fila = 0.02, tol_col = 1.0,
                            tol_hueco = 0.30) {
  if (!length(segs)) return(list())

  # Barra = segmentos CONTIGUOS de una misma fila. Compartir fila no basta: dos
  # graficos lado a lado tienen barras a la misma altura, y unirlos por la `y`
  # los funde en una barra imposible que arranca en el grafico izquierdo y
  # termina en el derecho. Se parte donde hay hueco.
  clave <- vapply(segs, function(s) round(s$y / tol_fila), numeric(1))
  barras <- list()
  for (fila in split(segs, clave)) {
    ord <- order(vapply(fila, function(s) s$x, numeric(1)))
    fila <- fila[ord]
    ini <- fila[[1]]
    fin_x <- ini$x + ini$w
    for (k in seq_along(fila)[-1]) {
      s <- fila[[k]]
      if (s$x - fin_x > tol_hueco) {
        barras[[length(barras) + 1L]] <- list(x = ini$x, h = ini$h)
        ini <- s
      }
      fin_x <- max(fin_x, s$x + s$w)
    }
    barras[[length(barras) + 1L]] <- list(x = ini$x, h = ini$h)
  }
  if (!length(barras)) return(list())

  # Grafico = barras que arrancan en la misma columna. Ninguna barra cruza de un
  # grafico al de al lado, asi que el eje las separa sin ambiguedad.
  ejes <- sort(unique(round(vapply(barras, function(b) b$x, numeric(1)), 1)))
  grupos <- list()
  actual <- ejes[[1]]
  for (e in ejes[-1]) {
    if (e - actual[[length(actual)]] < tol_col) {
      actual <- c(actual, e)
    } else {
      grupos[[length(grupos) + 1L]] <- actual
      actual <- e
    }
  }
  grupos[[length(grupos) + 1L]] <- actual

  out <- list()
  for (g in grupos) {
    propias <- Filter(function(b) b$x >= min(g) - 0.05 && b$x <= max(g) + 0.05, barras)
    # Con una sola barra no hay grosor comparable del que hablar.
    if (length(propias) < 2L) next
    alturas <- round(vapply(propias, function(b) b$h, numeric(1)), 3)
    tab <- table(alturas)
    out[[length(out) + 1L]] <- list(
      n = length(propias),
      grosor = as.numeric(names(tab)[which.max(tab)])
    )
  }
  out
}


#' Medidas crudas de un mazo, sin juzgarlas
#'
#' Separado de la verificacion porque son dos preguntas distintas: esta dice
#' cuanto mide el mazo, y `verificar_mazo()` dice si eso esta bien. Mezclarlas
#' fue lo que dejo los umbrales sin origen comprobable — cada uno se eligio a
#' ojo y ninguno salia de haber medido el entregable.
#'
#' @param path Ruta al `.pptx`.
#'
#' @return Lista con `grosor_escala`, `barras_escala`, `grosor_categorico` y
#'   `texto_pt`, cada uno un vector con una entrada por grafico o por texto. Los
#'   grosores van en CENTIMETROS; el texto, en puntos.
#' @export
medir_mazo <- function(path) {
  laminas <- .verif_laminas_xml(path)
  gr_esc <- numeric(0); n_esc <- integer(0)
  gr_cat <- numeric(0); n_cat <- integer(0); txt <- numeric(0)
  rojo <- 0L; tops <- numeric(0); ilegible <- 0L

  for (xml in laminas) {
    formas <- .verif_formas(xml)
    for (g in .verif_graficos(.verif_segmentos(formas, .VERIF_RAMPA))) {
      gr_esc <- c(gr_esc, g$grosor); n_esc <- c(n_esc, g$n)
    }
    for (g in .verif_graficos(.verif_segmentos(formas, .VERIF_AZUL, exigir_sin_texto = TRUE))) {
      gr_cat <- c(gr_cat, g$grosor); n_cat <- c(n_cat, g$n)
    }
    szs <- as.numeric(gsub('\\D', "", regmatches(xml, gregexpr('sz="\\d+"', xml))[[1]])) / 100
    txt <- c(txt, szs[is.finite(szs)])
    rojo <- rojo + .verif_rojo_en_rampa(xml)
    ilegible <- ilegible + .verif_texto_ilegible(.verif_formas(xml))
    tt <- .verif_titulo_top_cm(xml)
    if (!is.na(tt)) tops <- c(tops, tt)
  }

  list(grosor_escala = gr_esc * .VERIF_CM_POR_IN, barras_escala = n_esc,
       grosor_categorico = gr_cat * .VERIF_CM_POR_IN, barras_categorico = n_cat,
       texto_pt = txt,
       rojo_en_rampa = rojo, titulo_top_cm = tops, texto_ilegible = ilegible)
}


#' Deriva los umbrales de un mazo de referencia
#'
#' Los umbrales del recetario se habian fijado contra un ideal, y el entregable
#' que el cliente aprobo los incumple mas del doble que el motor: 46 de sus
#' graficos bajan de 0.32 in y 53 de sus textos de 11 pt. Un piso que la
#' referencia no cumple no mide conformidad, mide distancia a una idea.
#'
#' Se toma un percentil bajo y no el minimo: el minimo de un mazo de sesenta
#' laminas es un caso aislado, y calibrar contra el deja pasar cualquier cosa.
#'
#' CONSECUENCIA QUE HAY QUE TENER PRESENTE AL LEER LA CUENTA: si el piso es el
#' percentil 10 de la referencia, la referencia lo incumple ~10 % de las veces
#' POR CONSTRUCCION. R1, R5 y R8 son pisos —`>=`, barra demasiado FINA o
#' arranque demasiado ALTO—, no techos, y el aprobado los incumple diez veces
#' entre los tres. Que el motor empiece a incumplirlos no significa que haya
#' empeorado: significa que ya tiene cola donde antes no tenia ninguna.
#'
#' Medido tras P45, en tasa y no en cuenta (motor `p52` contra el aprobado):
#'
#'   grosor de escala      8.1 % bajo el piso  contra 10.3 %   (min 0.483 / 0.488)
#'   grosor categorico     4.0 %               contra  4.0 %   (mediana 0.826 / 0.876)
#'   arranque vertical     5.1 %               contra  9.3 %   (mediana 3.938 / 4.240)
#'
#' Antes de P45 el motor iba en 2.7 / 0.0 / 0.0 %: sin cola, con la mediana mas
#' gruesa que el aprobado. La cuenta subio de 21 a 25 —la del aprobado— porque
#' la distribucion se le acerco, no porque el mazo salga peor. Comparar TASAS y
#' no cuentas es lo unico que distingue esos dos casos.
#'
#' @param path Ruta al `.pptx` de referencia.
#' @param p Percentil inferior que se acepta como piso.
#'
#' @return Lista de umbrales con la forma de `.VERIF_UMBRALES`.
#' @export
calibrar_umbrales <- function(path, p = 0.10) {
  m <- medir_mazo(path)
  q <- function(x, prob) if (!length(x)) NA_real_ else unname(stats::quantile(x, prob, na.rm = TRUE))

  list(
    grosor_escala_cm     = round(q(m$grosor_escala, p), 2),
    grosor_categorica_cm = round(q(m$grosor_categorico, p), 2),
    # El techo usa el MAXIMO del aprobado, no su percentil alto, y ahi la
    # asimetria con los pisos es deliberada. Un piso calibrado al minimo lo
    # baja un solo accidente; un techo calibrado al percentil lo pone por
    # DEBAJO de lo que la referencia hace, y entonces el motor parte laminas
    # que el entregable no partia. Medido: con el percentil 90 (seis barras) el
    # mazo pasaba de 63 a 73 laminas.
    barras_por_grafico   = as.integer(max(m$barras_escala)),
    # Techos de la paleta AZUL, que hasta P36 no medía nadie. Al maximo del
    # aprobado y no a su p90: con el p90 el de grosor marcaba 3 de los 25
    # graficos del propio aprobado. El redondeo va hacia ARRIBA por la misma
    # razon —su extremo no puede quedar fuera por un decimal—.
    barras_por_grafico_categorico = as.integer(max(m$barras_categorico)),
    grosor_categorico_max_cm      = ceiling(max(m$grosor_categorico) * 100) / 100,
    texto_minimo_pt      = round(q(m$texto_pt, p), 1),
    texto_prop_max       = round(mean(m$texto_pt < q(m$texto_pt, p)), 3),
    rojo_en_rampa_max    = as.integer(m$rojo_en_rampa),
    texto_ilegible_max   = as.integer(m$texto_ilegible),
    titulo_top_min_cm    = if (length(m$titulo_top_cm)) round(q(m$titulo_top_cm, p), 2)
                           else .VERIF_UMBRALES$titulo_top_min_cm
  )
}


# EL CERO DE TRUNCADOS ES EL DE LOS CORTES MARCADOS, NO EL DE LOS CORTES.
# Medido en el render de `p52`, lamina 25 («ESTRUCTURA ORGANIZACIONAL DE
# GOBIERNO»): su segundo enunciado termina en «de D» y el `<a:t>` siguiente ya
# es del bloque de al lado —«Los docentes que ocupan puestos»—, o sea que la
# frase se corta a media palabra. Y en toda esa lamina no hay un solo `<a:t>`
# acabado en elipsis.
#
# El detector de truncados busca justamente eso, la elipsis, asi que da CERO
# mientras hay un corte en seco.
#
# Y CONTARLOS BIEN NO ES INMEDIATO, medido: comparar el render contra el texto
# del PLAN da 16 cortes concatenando toda la lamina y 2 agrupando por caja
# `<p:sp>`, y las dos cifras contradicen el render. La causa esta medida: la
# lamina 16 tiene **101 cajas** y la primera linea de su enunciado vive sola en
# la suya (`['¿Conoce los propositos']`), o sea que rvg emite UNA CAJA POR LINEA
# DIBUJADA. Para reconstruir un enunciado hay que agrupar por columna y
# adyacencia vertical, con la geometria que `.verif_formas()` ya devuelve.
#
# HECHO Y VALIDADO (`p49c.R`), con dos detalles que costaron un intento cada
# uno: se agrupa por el CENTRO de la linea (`x + w/2`) y no por su `x` —el
# enunciado va centrado, asi que cada linea arranca distinto—, y el grupo se
# corta cuando el salto vertical pasa de ~2.2 alturas de linea. Con `x` a secas
# daba «completos 0», que contradecia el render; con el centro, la lamina 16
# sale con sus dos enunciados completos, que es lo que se ve.
#
# LO QUE FALTA ES EL MAPEO: `plan$slides[[i]]` NO corresponde a `slide<i>.xml`
# en cuanto el motor PARTE una lamina. Medido: los enunciados que el plan pone
# en `plan$slides[[26]]` estan dibujados en la lamina 30 del mazo, +4, y los
# demas desfases caen en 29, 34, 37, 53 y 62 —todas posteriores a una
# particion—. Sin resolver eso, cualquier conteo mide en la lamina equivocada.
#
# EL INDICE SE ESQUIVA buscando cada enunciado en TODO el mazo (`p49d.R`), y
# asi el metodo cierra: 16 declarados, 16 completos, 0 cortados. PERO ESA CIFRA
# CUBRE MUY POCO: el plan entero tiene **18 bloques y solo 13 con
# `titulos_grupo`**, y el enunciado que la lamina 25 corta en «de D» no esta en
# ninguno. `titulos_grupo` solo existe cuando alguien lo escribio a mano; en el
# resto el graficador cae en `.title_of_var(v)` —la ETIQUETA DE LA VARIABLE en
# el instrumento—, que es la fuente contra la que hay que comparar para contar
# el mazo entero.
#
# CONTADO YA, con el universo sacado por TRAZA —`.title_of_var()` y
# `.named_lookup()` viven dentro del renderer y no se pueden llamar desde
# fuera—: **universo 99, completos 95, CORTADOS 4, ausentes 0**, contra los 16
# que salian del plan. Los cuatro, sin elipsis:
#
#   lamina 31   55 de  66    «Estoy satisfecho(a) con la calidad de enseñanza…»
#   lamina 43   40 de  52    «La infraestructura se adecua a las necesidades…»
#   lamina 59  155 de 175    «El Departamento de Ciencias Contables fomenta…»
#   lamina 59   20 de 133    «Los estudiantes reciben información sobre be…»
#
# El ultimo dibuja 20 caracteres de 133. ALCANCE: la traza cubrio UN sitio de
# resolucion de los cuatro (`ttl <-` en 4746, 4764, 5394 y 5552 de
# `reporte_plan_ppt.R`), asi que **4 es un piso, no el total** — el corte de la
# lamina 25 sale por otra rama y no esta en esa lista.
#
# CORREGIDO: trazados los CUATRO sitios, el universo es IDENTICO al de uno solo
# —99 enunciados, `diff` vacio—, asi que 4 no era un piso sino el total DE ESE
# METODO.
#
# Y LA LAMINA 25 NO ERA UN FALLO DEL CONTADOR. Se acuso al agrupamiento de unir
# lineas de textos distintos; medida la geometria cruda de esa lamina, los separa
# bien: sus tres enunciados viven en el mismo centro (cx 1.6965) con huecos de
# 0.589 y 0.481 entre ellos y de 0.252 como mucho dentro de uno, con `h` 0.14, de
# modo que el corte a 2.2 alturas cae justo en medio. El contador decia
# «completo» porque LO ESTA: el XML reproduce exactamente el texto que recibio.
#
# EL CORTE ES ANTERIOR AL MOTOR, y esta medido en el `.pulso` de Contabilidad:
#
#   xlsform_forms$…$survey$rows$44          287 chars / 291 bytes  «…Jefe de Departamento).»
#   codif_por_base$…$parent_label           287 chars              integro
#   equivalencias_publicos$filas$41$
#     etiqueta_estandar                     252 chars / 256 BYTES  «…Consejo de D»
#   graficos_config$plan$…$titulos_grupo    252 chars              heredado del anterior
#
# 256 bytes exactos es el tope de etiqueta de variable de SPSS: la etiqueta entro
# por el `.sav` y no por el instrumento, que la tiene entera y la contiene como
# prefijo. De 153 filas de equivalencias SOLO la 41 llega a 256 bytes y NINGUNA
# los pasa. No hay `substr` culpable en el motor: no lo busques otra vez.
#
# QUE HACE EL APROBADO CON ESE MISMO ENUNCIADO (su lamina 23, medido): no arrastra
# el truncado de SPSS. Corta en un limite SEMANTICO —«…de la gestion de las
# autoridades de la Unidad», soltando el parentesis entero—, pone un marcador «1»
# y declara al pie «Se redujo el texto debido a que era muy largo». Contra la
# vara, entonces, el defecto del motor es doble: hereda una etiqueta cortada por
# bytes en vez de la del instrumento, y cuando un texto no cabe lo recorta a
# mitad de palabra, sin elipsis y sin nota.
#
# LOS «CUATRO CORTES DE RENDER» TAMPOCO ERAN CORTES. Volcada la geometria cruda
# de sus laminas, el XML tiene los cuatro textos ENTEROS. Eran dos artefactos
# distintos del contador:
#
# - Laminas 31 y 43: su ULTIMA linea («carrera.», «carrera.») quedaba fuera del
#   grupo por 0.0034 in. El umbral salia de la `h` de la linea ANTERIOR, y una
#   linea corta sin ascendentes ni descendentes mide 0.0828 donde sus hermanas
#   miden 0.1112: el corte se desplomaba con ella (0.1112 x 2.2 = 0.2446 contra
#   un hueco de 0.248). Con la MEDIANA de la lamina como escala, ambas cierran.
# - Lamina 59: los dos enunciados salian ENTRELAZADOS en el bloque, y ninguno
#   cabia entero en ningun grupo.
#
# Recontado con la mediana: 99 enunciados, **97 completos, 0 cortes de render**.
# Los dos que quedan marcados son el par de la 59, y no son un corte:
#
# ES UN SOLAPE, Y SE VE. La lamina 59 dibuja «Los estudiantes reciben» en
# y 4.9134 y «redes colaborativas.» en y 4.9175 —**0.0041 in**, la misma columna
# y la misma altura—, o sea la primera linea del tercer enunciado impresa ENCIMA
# de la ultima del segundo. Comprobado en el PDF: las dos palabras se pisan y no
# se lee ninguna. Contra la vara: motor **1 solape**, aprobado **4**, y los
# cuatro del aprobado tienen `dy` EXACTAMENTE 0.0000 porque son titulos de
# paneles contiguos a la misma altura en laminas de cuatro cuadros —texto al
# lado de texto, no encima—. El unico solape de verdad en los dos mazos es el del
# motor.
#
# AL MEDIR SOLAPE, exige el MISMO bucket de columna, no «cx parecido»: comparar
# cajas a los dos lados del borde del redondeo daba `dy` negativos y **208
# solapes falsos** en el aprobado.
#
# Lo que P46 cerro sigue cerrado —los 22 cortes
# CON elipsis se fueron y no han vuelto—, pero un «cero truncados» sin cubrir
# los cortes silenciosos vale solo para la mitad marcada.

#' Verifica un mazo contra el recetario
#'
#' Las reglas que se comprueban son las medibles sobre el archivo. Las que no
#' —interlineado, arranque vertical del bloque— se declaran como no cubiertas en
#' vez de omitirse: un informe que calla lo que no mira se lee como si lo
#' hubiera aprobado.
#'
#' @param path Ruta al `.pptx`.
#' @param umbrales Lista de umbrales; por defecto los del recetario.
#'
#' @return Lista con `hallazgos` (data.frame), `resumen` y `no_cubierto`.
#' @export
verificar_mazo <- function(path, umbrales = .VERIF_UMBRALES) {
  u <- utils::modifyList(.VERIF_UMBRALES, umbrales %||% list())
  laminas <- .verif_laminas_xml(path)

  reglas <- character(0); lams <- integer(0)
  valores <- numeric(0); esperados <- character(0); detalles <- character(0)
  add <- function(regla, lam, valor, esperado, detalle) {
    reglas <<- c(reglas, regla); lams <<- c(lams, lam)
    valores <<- c(valores, valor); esperados <<- c(esperados, esperado)
    detalles <<- c(detalles, detalle)
  }

  n_graf_escala <- 0L; n_graf_cat <- 0L
  texto_todo <- numeric(0)
  gem <- list()

  for (i in seq_along(laminas)) {
    xml <- laminas[[i]]
    formas <- .verif_formas(xml)

    # R1 y R2: grosor y numero de barras en escala.
    gr_esc <- .verif_graficos(.verif_segmentos(formas, .VERIF_RAMPA))
    n_graf_escala <- n_graf_escala + length(gr_esc)
    for (g in gr_esc) {
      if (g$grosor * .VERIF_CM_POR_IN < u$grosor_escala_cm) {
        add("R1 grosor de escala", i, round(g$grosor * .VERIF_CM_POR_IN, 3),
            sprintf(">= %.2f cm", u$grosor_escala_cm),
            sprintf("%d barras", g$n))
      }
      if (g$n > u$barras_por_grafico) {
        add("R2 barras por grafico", i, g$n,
            sprintf("<= %d", u$barras_por_grafico),
            "la lamina deberia partirse")
      }
    }

    # R5: grosor en categoricas.
    gr_cat <- .verif_graficos(.verif_segmentos(formas, .VERIF_AZUL, exigir_sin_texto = TRUE))
    n_graf_cat <- n_graf_cat + length(gr_cat)
    for (g in gr_cat) {
      if (g$grosor * .VERIF_CM_POR_IN < u$grosor_categorica_cm) {
        add("R5 grosor categorico", i, round(g$grosor * .VERIF_CM_POR_IN, 3),
            sprintf(">= %.2f cm", u$grosor_categorica_cm),
            sprintf("%d barras", g$n))
      }
      # R10 y R11: los techos de la azul. R5 mira que la barra no sea DEMASIADO
      # FINA; nadie miraba que no fuera demasiado gruesa ni que cupieran
      # demasiadas, aunque el aprobado tiene su limite en las dos cosas.
      if (!is.null(u$grosor_categorico_max_cm) &&
          g$grosor * .VERIF_CM_POR_IN > u$grosor_categorico_max_cm) {
        add("R10 grosor categorico excesivo", i,
            round(g$grosor * .VERIF_CM_POR_IN, 3),
            sprintf("<= %.2f cm", u$grosor_categorico_max_cm),
            sprintf("%d barras estirandose en un hueco alto", g$n))
      }
      if (!is.null(u$barras_por_grafico_categorico) &&
          g$n > u$barras_por_grafico_categorico) {
        add("R11 barras por grafico categorico", i, g$n,
            sprintf("<= %d", u$barras_por_grafico_categorico),
            "la lamina deberia partirse")
      }
    }

      # R7: el titulo no puede pegarse al borde superior.
    tt <- .verif_titulo_top_cm(xml)
    if (!is.na(tt) && tt < u$titulo_top_min_cm) {
      add("R7 posicion del titulo", i, round(tt, 3),
          sprintf(">= %.2f cm", u$titulo_top_min_cm), "pegado al borde")
    }

    # R8: el bloque no puede empezar pegado al logo.
    ar <- .verif_arranque_cm(formas)
    if (!is.na(ar) && ar < u$arranque_min_cm) {
      add("R8 arranque vertical", i, round(ar, 3),
          sprintf(">= %.2f cm", u$arranque_min_cm), "primera barra muy arriba")
    }

    # B2: dos premisas seguidas necesitan mas aire que dos publicos.
    hp <- .verif_hueco_entre_premisas_cm(formas)
    if (!is.na(hp) && hp < u$hueco_premisas_min_cm) {
      add("B2 hueco entre premisas", i, round(hp, 3),
          sprintf(">= %.2f cm", u$hueco_premisas_min_cm), "se ve apretado")
    }

    # R9: una cifra blanca sobre un tramo claro no se lee.
    il <- .verif_texto_ilegible(formas)
    if (il > u$texto_ilegible_max) {
      add("R9 texto ilegible", i, il,
          sprintf("<= %d", u$texto_ilegible_max),
          "cifra blanca sobre tramo claro")
    }

    # B3: en una misma lamina, las barras miden todas lo mismo.
    dif <- .verif_grosores_desiguales(formas)
    if (dif > u$grosor_dispersion_max_cm) {
      add("B3 grosores desiguales", i, round(dif, 3),
          sprintf("<= %.2f cm", u$grosor_dispersion_max_cm),
          "dos bloques de la misma lamina con distinto grosor")
    }

    # B4 se acumula y se juzga al final: comparar una lamina con su gemela exige
    # tenerlas todas. Ver abajo.
    gem[[length(gem) + 1L]] <- .verif_grosores_de_lamina(formas, i)

    # R4: el rojo institucional es color de TITULO, no extremo de escala.
    rr <- .verif_rojo_en_rampa(xml)
    if (rr > u$rojo_en_rampa_max) {
      add("R4 rojo en la rampa", i, rr,
          sprintf("<= %d", u$rojo_en_rampa_max),
          "el extremo negativo va naranja")
    }

    # R3 se acumula y se juzga al final: ver abajo.
    szs <- as.numeric(gsub('\\D', "", regmatches(xml, gregexpr('sz="\\d+"', xml))[[1]])) / 100
    texto_todo <- c(texto_todo, szs[is.finite(szs)])
  }

  # R3 es una regla de MAZO, no de lamina. Medida por lamina no discrimina: basta
  # un rotulo pequeno para marcarla, y con el umbral del aprobado quedaban
  # marcadas 53 de 63 laminas del PROPIO entregable aprobado. Lo que distingue un
  # mazo legible de otro no es que ninguna lamina tenga letra chica, sino cuanta
  # hay.
  if (length(texto_todo)) {
    prop <- mean(texto_todo < u$texto_minimo_pt)
    if (prop > u$texto_prop_max) {
      add("R3 proporcion de texto pequeno", NA_integer_, round(prop, 4),
          sprintf("<= %.1f %%", 100 * u$texto_prop_max),
          sprintf("%.1f %% por debajo de %g pt", 100 * prop, u$texto_minimo_pt))
    }
  }

  # B4 tambien es de MAZO: una lamina no puede saber si su gemela salio igual.
  gemelas <- .verif_gemelas_desiguales(gem)
  for (r in seq_len(nrow(gemelas))) {
    if (gemelas$dif[r] <= u$grosor_gemelas_max_cm) next
    add("B4 gemelas desiguales", NA_integer_, round(gemelas$dif[r], 3),
        sprintf("<= %.2f cm", u$grosor_gemelas_max_cm),
        sprintf("laminas de firma %s salen a distinto grosor: %s",
                gemelas$firma[r], gemelas$laminas[r]))
  }

  hallazgos <- data.frame(
    regla = reglas, lamina = lams, valor = valores,
    esperado = esperados, detalle = detalles,
    stringsAsFactors = FALSE
  )

  list(
    hallazgos = hallazgos,
    resumen = list(
      laminas = length(laminas),
      graficos_escala = n_graf_escala,
      graficos_categoricos = n_graf_cat,
      incumplimientos = nrow(hallazgos),
      por_regla = if (nrow(hallazgos)) as.list(table(hallazgos$regla)) else list()
    ),
    # Lo que este verificador NO mira. Se declara para que un informe limpio no
    # se confunda con un mazo conforme.
    no_cubierto = c(
      "R6 circulares",
      "R10 interlineado (medido: los tres mazos usan 100 %; no es la causa)",
      "R8 arranque vertical del bloque",
      "R9 color del texto: el resto del criterio, mas alla de la legibilidad"
    )
  )
}


#' Segmentos rojos que pertenecen a la rampa de escala
#'
#' El rojo institucional NO esta prohibido: es el color de los titulos, y el
#' entregable aprobado lo usa en 67. Lo que no puede es pintar el extremo
#' negativo de una escala. El criterio que los distingue sin ambiguedad —y que
#' ya se uso para corregir 26 colores en 23 listas sin tocar un solo titulo— es
#' la vecindad: es rampa cuando el color inmediatamente siguiente es el amarillo.
#'
#' @keywords internal
.verif_rojo_en_rampa <- function(xml) {
  cols <- toupper(gsub('.*val="', "", gsub('"$', "",
    regmatches(xml, gregexpr('srgbClr val="[0-9A-Fa-f]{6}"', xml))[[1]]))) 
  cols <- substr(gsub("[^0-9A-F]", "", cols), 1, 6)
  if (length(cols) < 2L) return(0L)
  rojos <- which(cols == "CA5651")
  rojos <- rojos[rojos < length(cols)]
  if (!length(rojos)) return(0L)
  sum(cols[rojos + 1L] %in% c("FFD965", "FFD966"))
}


#' Borde superior del titulo de lamina, en centimetros
#'
#' El titulo es el unico texto a 24 pt de la lamina, asi que se reconoce por su
#' cuerpo y no por su placeholder —que cambia de nombre entre plantillas—.
#'
#' @keywords internal
.verif_titulo_top_cm <- function(xml) {
  sps <- regmatches(xml, gregexpr("<p:sp>.*?</p:sp>", xml))[[1]]
  for (sp in sps) {
    if (!grepl('sz="2400"', sp, fixed = TRUE)) next
    m <- regmatches(sp, regexpr('<a:off x="(-?\\d+)" y="(-?\\d+)"/>', sp))
    if (!length(m)) next
    nums <- as.numeric(regmatches(m, gregexpr("-?\\d+", m))[[1]])
    if (length(nums) >= 2L) return(nums[[2]] / .VERIF_EMU * .VERIF_CM_POR_IN)
  }
  NA_real_
}


#' Grosores de barra distintos dentro de una misma lamina
#'
#' Una lamina que mezcla una escala con una dicotomica dibuja los dos bloques en
#' canvas separados y `plot_grid()` los escala con alturas relativas que incluyen
#' su cromo —titulo, leyenda, columna extra—, asi que el grosor final no coincide:
#' en «MECANISMOS DE ADMISION» las barras de escala salen a 1.19 cm y las de
#' Si/No a 0.90, sobre la misma lamina y sin que nadie lo pidiera.
#'
#' Se comparan solo barras de verdad —anchas y altas— para no contar los
#' marcadores de leyenda, que legitimamente son mas pequenos.
#'
#' @param formas Formas de la lamina, ya extraidas.
#' @return Diferencia en cm entre el grosor mayor y el menor; 0 si no hay dos.
#' @keywords internal
#' Grosor tipico de una lamina y cuantas barras tiene
#'
#' Reusa el mismo detector que B3 —el validado— porque un filtro por
#' dimensiones metia bandas de fondo y hasta la portada. Devuelve la MEDIANA y
#' no la media: una barra suelta de otro tamano no debe mover la firma de la
#' lamina, que es justo lo que B3 ya mide por su cuenta.
#'
#' @param formas Formas de la lamina, ya extraidas.
#' @param lamina Numero de lamina, para poder senalarla.
#' @return Lista con la `firma` de la lamina, su `grosor` mediano en cm y el
#'   numero de `lamina`; `NULL` si no hay barras que comparar.
#' @keywords internal
.verif_grosores_de_lamina <- function(formas, lamina) {
  rampa <- .verif_graficos(.verif_segmentos(formas, .VERIF_RAMPA, exigir_sin_texto = TRUE))
  azul  <- .verif_graficos(.verif_segmentos(formas, .VERIF_AZUL, exigir_sin_texto = TRUE))
  gr <- c(rampa, azul)
  if (!length(gr)) return(NULL)
  alt <- vapply(gr, function(g) g$grosor, numeric(1)) * .VERIF_CM_POR_IN
  ok <- is.finite(alt) & alt > 0
  if (!any(ok)) return(NULL)

  # La firma son los graficos de la lamina Y las barras de cada uno, no el
  # numero de graficos a secas: `.verif_graficos()` devuelve GRAFICOS, y contar
  # solo esos metia en el mismo grupo cualquier lamina de un grafico —la
  # mayoria del mazo, que no son gemelas de nada— y producia una dispersion de
  # 1.75 cm que no era de nadie.
  #
  # Y lleva la PALETA, porque cada familia declara su propio alto de fila —el
  # preset da 0.54 in a apiladas, 0.58 a multi-apiladas y 0.64 a agrupadas— y la
  # barra es una fraccion de ese alto: dos familias distintas tienen distinto
  # grosor POR DISENO. Sin la paleta, el grupo de «6 barras» juntaba cinco
  # multi-apiladas con un RADAR y marcaba como defecto esa diferencia. La paleta
  # no es la familia, pero es lo que el XML deja distinguir.
  paleta <- c(rep("rampa", length(rampa)), rep("azul", length(azul)))[ok]
  barras <- vapply(gr, function(g) g$n, integer(1))[ok]
  orden <- order(paleta, barras)
  list(
    lamina = lamina,
    firma = paste(paleta[orden], barras[orden], sep = ":", collapse = "-"),
    grosor = stats::median(alt[ok])
  )
}


#' Laminas gemelas que no salen iguales
#'
#' Dos laminas con la MISMA firma son gemelas: mismos graficos y mismas barras
#' en cada uno. Nada justifica entonces que una saque la barra a 0.36 cm y la
#' otra a 0.46. Es el eje de «dos laminas del mismo tipo no salen iguales», y B3
#' no lo ve porque mira dentro de una sola.
#'
#' La firma tiene que ser fina o el grupo deja de significar nada: agrupar por
#' «numero de filas» mezclaba una lamina de tres filas en un bloque con otra de
#' tres repartidas en cuatro, y contar solo GRAFICOS metia junta media baraja.
#' Las dos versiones producian una dispersion que no era de ninguna lamina.
#'
#' @param gem Lista de salidas de `.verif_grosores_de_lamina()`.
#' @return `data.frame` con una fila por grupo de gemelas que dispersa.
#' @keywords internal
# LO QUE B4 CUENTA SON GRUPOS DE FIRMA, NO LAMINAS, y eso hace que dos mazos no
# se puedan comparar por su numero de hallazgos. Medido sobre Conta:
#
#              grupos   max     media   mediana
#   aprobado      5     1.013   0.597   0.485
#   motor         8     0.879   0.391   0.305
#
# El motor sale PEOR en la cuenta y MEJOR en las tres medidas de dispersion, que
# son las comparables.
#
# Y LA DISPERSION QUE QUEDA TIENE CAUSA LEGITIMA. Medido el peor grupo del motor
# —`rampa:4`, siete laminas de 1.32 a 2.20 cm—: las siete tienen EXACTAMENTE la
# misma geometria de lamina (placeholder en 1.21 con 5.51 de alto, pie en 6.93,
# titulo en 0.37) y exactamente un grafico de cuatro barras sin azul. Lo que
# cambia es el ALTO DE LA ETIQUETA DE EJE: las de 1.32 y 1.52 llevan cuatro
# premisas con enunciados de cuatro lineas, y el graficador les baja la fraccion
# para dejar aire entre barras. El aprobado hace lo mismo y con mas amplitud
# —su peor grupo dispersa 1.013—. La diferencia es de composicion: 70 laminas con mas
# variedad de firmas contra 63. Un mazo con mas tipos distintos de lamina recibe
# mas hallazgos a igualdad de calidad, asi que perseguir el 8 hasta el 5 seria
# perseguir un artefacto. Lo que si es real es la dispersion DENTRO de un grupo.
#
.verif_gemelas_desiguales <- function(gem) {
  gem <- Filter(Negate(is.null), gem)
  vacio <- data.frame(firma = character(0), dif = numeric(0),
                      laminas = character(0), stringsAsFactors = FALSE)
  if (length(gem) < 2L) return(vacio)

  fir <- vapply(gem, function(g) g$firma, character(1))
  gro <- vapply(gem, function(g) g$grosor, numeric(1))
  lam <- vapply(gem, function(g) g$lamina, integer(1))

  out <- vacio
  for (k in unique(fir)) {
    idx <- which(fir == k)
    if (length(idx) < 2L) next   # sin gemela no hay con que comparar
    out <- rbind(out, data.frame(
      firma = k, dif = max(gro[idx]) - min(gro[idx]),
      laminas = paste(lam[idx], collapse = ", "),
      stringsAsFactors = FALSE
    ))
  }
  out
}


.verif_grosores_desiguales <- function(formas) {
  # Se reusa el detector de barras ya validado en vez de filtrar por tamano:
  # con un filtro por dimensiones entraban bandas de fondo y hasta la portada,
  # y la regla disparaba en 61 laminas —y en 56 del entregable aprobado, que es
  # la senal de que media otra cosa—.
  #
  # ESTA CUENTA MEZCLA DOS COSAS DISTINTAS, y separarlas cambia el diagnostico.
  # Medido sobre `p45.pptx` contra el entregable aprobado, partiendo las laminas
  # con dos o mas graficos en dos grupos:
  #
  #   laminas con RAMPA y AZUL a la vez
  #     motor    7 laminas, 5 sobre umbral, max 0.424 cm, suma 0.841
  #     aprobado 10 laminas, 2 sobre umbral, max 0.150 cm, suma 0.201
  #
  #   laminas de una sola paleta
  #     motor    5 laminas, 3 sobre umbral, max 0.279 cm, suma 0.676
  #     aprobado 5 laminas, 4 sobre umbral, max 0.221 cm, suma 0.706
  #
  # O sea que en las laminas de una paleta el motor ya iguala o gana —tres
  # hallazgos contra cuatro, y menos suma—, y todo el desnivel esta en las
  # MIXTAS: un bloque de escala y un bloque de barras simples en la misma
  # lamina no se ponen de acuerdo en el grosor. El aprobado los mantiene a 1.5
  # mm de diferencia como mucho; el motor llega a 4.2 mm (lamina 41: rampa
  # 1.041 cm con dos barras contra azul 1.466 cm con tres).
  #
  # Por eso NO se persigue la lamina 9 —0.073 cm, 0.23 mm por encima de un
  # umbral de 0.05—: es del grupo donde el motor ya va mejor que la vara. Lo que
  # falta es que los dos graficos de una lamina mixta decidan su grosor juntos,
  # y eso no se arregla dentro de un graficador porque ninguno ve al otro.
  gr <- c(
    .verif_graficos(.verif_segmentos(formas, .VERIF_RAMPA, exigir_sin_texto = TRUE)),
    .verif_graficos(.verif_segmentos(formas, .VERIF_AZUL, exigir_sin_texto = TRUE))
  )
  if (length(gr) < 2L) return(0)
  alt <- round(vapply(gr, function(g) g$grosor, numeric(1)) * .VERIF_CM_POR_IN, 2)
  alt <- alt[is.finite(alt) & alt > 0]
  if (length(alt) < 2L) return(0)
  max(alt) - min(alt)
}


# Tramos claros de la rampa: sobre ellos una cifra blanca no se lee.
.VERIF_CLAROS <- c("F4B183", "FFD965", "FFD966", "EFD25E")


#' Cifras blancas que caen sobre un tramo claro
#'
#' El recetario dejo esto abierto por no poder medirlo: «el metodo por forma
#' devuelve el color de relleno de la propia caja, no el del segmento que hay
#' debajo». Se resuelve cruzando por POSICION —que segmento contiene el centro
#' de la caja de texto—, que es la unica forma de saber sobre que fondo cae.
#'
#' Importa porque es una regresion posible de la receta 4: al cambiar el extremo
#' negativo de rojo oscuro a naranja claro, las cifras blancas que se leian
#' sobre el rojo dejan de leerse sobre el naranja. El entregable aprobado tiene
#' cero.
#'
#' @param formas Salida de `.verif_formas()`.
#' @return Numero de cifras blancas sobre fondo claro.
#' @keywords internal
.verif_texto_ilegible <- function(formas) {
  if (!length(formas)) return(0L)
  segs <- Filter(function(f) f$col %in% .VERIF_CLAROS && !nzchar(f$texto), formas)
  if (!length(segs)) return(0L)
  blancos <- Filter(function(f) f$col == "FFFFFF" && nzchar(f$texto), formas)
  if (!length(blancos)) return(0L)

  sum(vapply(blancos, function(b) {
    cx <- b$x + b$w / 2
    cy <- b$y + b$h / 2
    any(vapply(segs, function(s) {
      cx >= s$x && cx <= s$x + s$w && cy >= s$y && cy <= s$y + s$h
    }, logical(1)))
  }, logical(1)))
}


#' Arranque vertical del bloque de datos, en centimetros
#'
#' Donde empieza la primera barra. El comentario que lo motiva —«los graficos
#' pueden estar un poquito mas abajo, la primera barra no tan cerca del logo»—
#' apuntaba al mazo criticado; el aprobado arranca a 4.24 cm de mediana.
#'
#' @keywords internal
.verif_arranque_cm <- function(formas) {
  segs <- .verif_segmentos(formas, .VERIF_RAMPA)
  if (!length(segs)) return(NA_real_)
  min(vapply(segs, function(s) s$y, numeric(1))) * .VERIF_CM_POR_IN
}


#' Hueco entre premisas de una lamina, en centimetros
#'
#' Hay DOS poblaciones de hueco y confundirlas no mide nada: el que separa dos
#' publicos de la misma premisa y el que separa dos premisas. Se distinguen por
#' el mayor salto de la serie ordenada, no por un estadistico que las promedie
#' —un coeficiente de variacion sobre la mezcla da falsos positivos, y ya costo
#' una iteracion entera perseguir un alto variable que no existia—.
#'
#' @return Mediana del hueco ENTRE premisas, o `NA_real_` si la lamina no tiene
#'   dos poblaciones distinguibles.
#' @keywords internal
.verif_hueco_entre_premisas_cm <- function(formas) {
  segs <- .verif_segmentos(formas, .VERIF_RAMPA)
  if (length(segs) < 4L) return(NA_real_)

  filas <- list()
  for (s in segs) filas[[as.character(round(s$y, 3))]] <- s$h
  ys <- sort(as.numeric(names(filas)))
  if (length(ys) < 4L) return(NA_real_)

  gaps <- numeric(0)
  for (i in seq_len(length(ys) - 1L)) {
    g <- ys[i + 1L] - (ys[i] + filas[[as.character(ys[i])]])
    if (is.finite(g) && g >= 0) gaps <- c(gaps, g)
  }
  if (length(gaps) < 3L) return(NA_real_)

  sg <- sort(gaps)
  saltos <- diff(sg)
  if (!length(saltos)) return(NA_real_)
  idx <- which.max(saltos)
  # Sin un salto claro, la lamina tiene una sola poblacion: no hay «entre
  # premisas» que medir y devolver la mediana de todo seria inventarlo.
  if (saltos[idx] <= stats::median(sg) * 0.5) return(NA_real_)

  stats::median(sg[(idx + 1L):length(sg)]) * .VERIF_CM_POR_IN
}
