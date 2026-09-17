# Generacion del libro operativo, y el contrato que de verdad importa: lo que la
# app ESCRIBE lo tiene que poder VOLVER A LEER.
#
# Sin ese round-trip el generador y los lectores derivan en silencio y el equipo
# se entera cuando el libro de un estudio en curso deja de importar.

# `titular_operational_code` acompaña SIEMPRE a `replacement_for`, porque asi
# llega del normalizador: son dos campos con dos idiomas. `replacement_for`
# lleva el `classroom_id` del titular —lo escriben asi `calc_muestra_aulas.R` y
# `monitoreo_aulas_apply_replacement()`— y `titular_operational_code` el codigo
# operativo. El fixture ponia solo el primero con un `CH n` dentro, y esa
# mentira tapaba que agrupar la cadena por `replacement_for` no funciona: sobre
# HSVG2026, 0 de 202 valores coincidian con un titular.
# **`aplicada` por defecto desde el 2026-09-07.** La «Base de control» dejo de
# escribir los titulares que todavia no se aplicaron: publicaba las 174 filas
# del plan con una sola aula aplicada, y 173 filas vacias esconden justo lo que
# la hoja existe para vigilar (dictado de Gonzalo el primer dia de campo,
# «muestra todos los CH cuando solo deberian ser los que ya se aplicaron»).
# Estos casos comprueban CONTENIDO y ORDEN de las filas, asi que sus aulas
# tienen que existir en la hoja; el caso que mira la hoja SIN aplicar pasa
# `aplicada = FALSE` a proposito.
.calg_unidad <- function(code, role = "titular", rf = "", orden = NULL,
                         aplicada = TRUE) c(list(
  operational_code = code, sample_role = role, replacement_for = rf,
  titular_operational_code = rf,
  replacement_order = orden, wave = "Muestra 01", teacher = "Docente Demo",
  teacher_phone = "999", teacher_email = "d@x.test", course_name = "Curso Demo",
  faculty = "SOCIALES", level = "3", label = "LUN A101", schedule = "LUN 08:00",
  enrolled_total = 40, eligible_n = 35, link = paste0("https://x.test/", code)
), if (aplicada) list(application_status = "APLICADA") else list())

test_that("lo que se genera se vuelve a leer sin perder la cadena", {
  unidades <- list(
    .calg_unidad("ABC-01"),
    .calg_unidad("ABC-02", "chain_reserve", "ABC-01", 1),
    .calg_unidad("XYZ-09")
  )
  path <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(unidades, path)
  out <- aulas_libro_importar(path)

  expect_identical(out$resumen$unidades, 3L)
  expect_identical(out$resumen$titulares, 2L)
  reserva <- Filter(function(u) identical(u$sample_role, "chain_reserve"), out$plan)[[1]]
  expect_identical(reserva$operational_code, "ABC-02")
  expect_identical(reserva$replacement_for, "ABC-01")
})

test_that("la app llena lo que sabe y deja vacio lo que le toca a la persona", {
  path <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(list(.calg_unidad("ABC-01")), path)
  f <- aulas_libro_importar(path)$plan[[1]]

  # Lo que la app sabe.
  expect_identical(f$operational_code, "ABC-01")
  expect_identical(f$teacher, "Docente Demo")
  expect_identical(f$link, "https://x.test/ABC-01")
  expect_equal(f$eligible_n, 35)
  # Lo que llena quien agenda: en blanco. Rellenarlo seria inventar campo.
  expect_identical(f$contact_medium, "")
  expect_identical(f$contact_date, "")
  expect_identical(f$sample_status, "")
  expect_identical(f$scheduled_date, "")
})

test_that("la profundidad de la cadena sale del plan, no de una constante", {
  # Un estudio con cadenas de dos no debe llevar doce bloques vacios.
  cortas <- list(.calg_unidad("A-1"), .calg_unidad("A-2", "chain_reserve", "A-1", 1))
  path <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(cortas, path)
  hojas <- readxl::read_excel(path, sheet = "Aulas Agendadas", col_names = FALSE, .name_repair = "minimal")

  # 1 columna de id + 2 bloques del ancho vigente.
  expect_identical(ncol(hojas), 1L + 2L * AULAS_AGENDADAS_ANCHO_BLOQUE)
})

test_that("el parte de campo generado trae la identidad y espera el resto", {
  path <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(list(.calg_unidad("ABC-01")), path)
  out <- aulas_libro_importar(path)

  # Nadie lo lleno todavia: cero partes es lo correcto, no un fallo de lectura.
  expect_identical(out$resumen$partes_de_campo, 0L)
  # Y la hoja de control si trae su fila de identidad.
  expect_identical(out$resumen$filas_de_control, 1L)
})

test_that("generar sin plan se rechaza con su codigo", {
  err <- tryCatch(aulas_libro_generar(list(), tempfile(fileext = ".xlsx")), error = function(e) e)
  expect_s3_class(err, "api_error")
  expect_identical(err$code, "E_AULAS_LIBRO_SIN_PLAN")
})

test_that("la cadena se agrupa aunque replacement_for traiga el classroom_id", {
  # El fixture REALISTA, tomado de HSVG2026: `replacement_for` no lleva «CH 1»
  # sino «arc232_0905», el `classroom_id` del titular. Es lo que escriben sus
  # dos escritores y por tanto lo que llega de verdad.
  #
  # Con el generador agrupando por ese campo, el titular quedaba en un grupo y
  # sus dos reservas en otro, bajo una clave que no existe como fila: tres
  # filas de Excel para una sola cadena. Este aserto es el que lo caza — si se
  # vuelve a agrupar por `replacement_for`, `nrow` sube de 2 a 3.
  unidades <- list(
    list(operational_code = "CH 1", sample_role = "titular",
         titular_operational_code = "CH 1", replacement_for = ""),
    list(operational_code = "R 1.1", sample_role = "chain_reserve",
         titular_operational_code = "CH 1", replacement_for = "arc232_0905",
         replacement_order = 1),
    list(operational_code = "R 1.2", sample_role = "chain_reserve",
         titular_operational_code = "CH 1", replacement_for = "arc232_0905",
         replacement_order = 2)
  )
  hoja <- aulas_libro_hoja_agendadas(unidades)

  # Cabecera + UNA fila: la cadena entera vive en su titular.
  expect_identical(nrow(hoja), 2L)
  # Y los tres eslabones salen en orden dentro de esa fila.
  fila <- as.character(hoja[2, ])
  expect_true(all(c("CH 1", "R 1.1", "R 1.2") %in% fila))
  expect_lt(which(fila == "R 1.1"), which(fila == "R 1.2"))
  expect_lt(which(fila == "CH 1"), which(fila == "R 1.1"))
})

test_that("el libro sale con desplegables, panel congelado y anchos", {
  # El libro se generaba con `openxlsx::write.xlsx()`: un volcado. Medido sobre
  # el de HSVG2026 antes de esto —842 x 241, 204 x 102 y 204 x 39—: CERO
  # validaciones, cero paneles, cero anchos, cero proteccion. Sin desplegable,
  # `STATUS MUESTRA` se escribe a mano 2 040 veces y llegan cuatro grafias del
  # mismo estado.
  unidades <- list(
    list(operational_code = "CH 1", sample_role = "titular", titular_operational_code = "CH 1"),
    list(operational_code = "R 1.1", sample_role = "chain_reserve",
         titular_operational_code = "CH 1", replacement_order = 1)
  )
  path <- tempfile(fileext = ".xlsx")
  aulas_libro_generar(unidades, path)

  hojas <- openxlsx::getSheetNames(path)
  expect_true("Listas" %in% hojas)
  expect_true(all(c("Aulas Agendadas", "Aulas Aplicadas (Campo)", "Base de control") %in% hojas))

  # sheet2 y no sheet1: el libro abre por la portada «Resumen» desde que existe,
  # asi que la hoja de agenda es la segunda. Buscarla por posicion fija es
  # justo lo que rompio este test al anadir la portada.
  hoja_agenda <- which(hojas == "Aulas Agendadas")
  xml <- paste(readLines(unz(path, sprintf("xl/worksheets/sheet%d.xml", hoja_agenda)),
                         warn = FALSE), collapse = "")
  # Las validaciones con formula a otra hoja las escribe `openxlsx` en el
  # namespace de extension `x14`, NO como `<dataValidation `. Buscar la etiqueta
  # simple daba CERO sobre un libro que si las llevaba, y con ese cero casi
  # declaro rota una funcion que funcionaba.
  expect_match(xml, "dataValidation")
  expect_match(xml, "<pane ")

  # Una validacion POR COLUMNA, no un rectangulo: los eslabones estan a 20
  # columnas de distancia y `cols = <vector>` produce `P2:IB842`, que dejaba el
  # desplegable de estados sobre el nombre del docente y el enlace.
  sqrefs <- regmatches(xml, gregexpr("<xm:sqref>[^<]+</xm:sqref>", xml))[[1]]
  expect_gt(length(sqrefs), 0)
  columna_unica <- grepl("^<xm:sqref>([A-Z]+)[0-9]+:\\1[0-9]+</xm:sqref>$", sqrefs)
  expect_true(all(columna_unica))
})

test_that("se distingue lo que trae la app de lo que llena la persona", {
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  cols <- aulas_libro_columnas_de_la_app(
    campos, AULAS_LIBRO_CAMPOS_DE_LA_PERSONA, bloques = 2L,
    ancho = AULAS_AGENDADAS_ANCHO_BLOQUE, desplazamiento = 1L
  )

  # Ni una columna de la persona teñida: si `sample_status` saliera gris, quien
  # agenda leeria «esto ya viene puesto» justo en la columna que mas se llena.
  idx <- function(campo) 1L + which(campos == campo)
  for (campo in AULAS_LIBRO_CAMPOS_DE_LA_PERSONA) {
    expect_false(idx(campo) %in% cols, info = campo)
    # Y lo mismo en el segundo bloque, que es donde falla un calculo por
    # posicion: el desplazamiento del bloque tiene que entrar en la cuenta.
    expect_false((idx(campo) + AULAS_AGENDADAS_ANCHO_BLOQUE) %in% cols, info = campo)
  }

  # El enlace SI lo trae la app aunque viva en el tramo de la persona.
  expect_true(idx("link") %in% cols)
  expect_true(idx("operational_code") %in% cols)
})

# ── Formato del libro ────────────────────────────────────────────────────
# Gonzalo, 2026-08-21: «que el excel que se genera y que se lee esten en muy
# buen formato, elegantes… muy profesional y sofisticado». Lo que sigue fija lo
# que se puede comprobar sin abrir Excel: el .xlsx es un zip y su XML dice si
# hay filtro, anchos propios y agrupado.


#' El XML de una hoja por NOMBRE.
#'
#' Por nombre y no por indice: el libro gano una portada y todo lo que apuntaba
#' a `sheet1.xml` paso a leer «Resumen». Un test que localiza su hoja por
#' posicion se rompe en cuanto el libro crece por delante.
.xml_de_hoja_llamada <- function(path, nombre) {
  hojas <- openxlsx::getSheetNames(path)
  .xml_de_hoja(path, which(hojas == nombre))
}

.xml_de_hoja <- function(path, hoja = 1L) {
  destino <- file.path(tempdir(), paste0("xlsx_", as.integer(runif(1, 1, 1e6))))
  dir.create(destino)
  utils::unzip(path, exdir = destino)
  readLines(file.path(destino, "xl", "worksheets", sprintf("sheet%d.xml", hoja)),
            warn = FALSE)
}

test_that("la hoja de agenda sale con autofiltro sobre su cabecera", {
  # Sin filtro, encontrar una facultad en 951 filas era desplazarse a mano.
  path <- file.path(tempdir(), "libro_filtro.xlsx")
  aulas_libro_generar(.libro_de_prueba(), path)
  xml <- paste(.xml_de_hoja_llamada(path, "Aulas Agendadas"), collapse = "")
  expect_match(xml, 'autoFilter ref="A1:')
})

test_that("cada columna toma el ancho de lo que lleva, no uno fijo", {
  # Con un ancho unico, «DIA» y «NOMBRE DEL CURSO» ocupaban lo mismo: el primero
  # desperdiciaba media columna y el segundo cortaba el titulo.
  path <- file.path(tempdir(), "libro_anchos.xlsx")
  aulas_libro_generar(.libro_de_prueba(), path)
  xml <- paste(.xml_de_hoja_llamada(path, "Aulas Agendadas"), collapse = "")
  anchos <- unique(as.numeric(sub('.*width="([0-9.]+)".*', "\\1",
                                  regmatches(xml, gregexpr('width="[0-9.]+"', xml))[[1]])))
  expect_gt(length(anchos), 3)
  # Y ninguna se come la pantalla: el tope es 42.
  expect_lte(max(anchos), 43)
  expect_gte(min(anchos), 9)
})

test_that("los bloques de reemplazo se pliegan y el del titular no", {
  # La hoja son 21 columnas por eslabon. Quien agenda trabaja sobre el titular y
  # solo baja a la cadena cuando un aula cae; agrupados, los reemplazos se
  # pliegan con un clic.
  path <- file.path(tempdir(), "libro_grupos.xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), path)
  xml <- paste(.xml_de_hoja_llamada(path, "Aulas Agendadas"), collapse = "")
  cols <- regmatches(xml, gregexpr('<col [^>]*>', xml))[[1]]
  con_nivel <- grep("outlineLevel", cols, value = TRUE)
  # Dos reservas -> dos bloques agrupados.
  expect_equal(length(con_nivel), 2L * AULAS_AGENDADAS_ANCHO_BLOQUE)
  # Y el primer bloque —el titular, columnas 2 a 21— se queda fuera.
  primeras <- as.integer(sub('.*min="([0-9]+)".*', "\\1", con_nivel))
  expect_gt(min(primeras), AULAS_AGENDADAS_ANCHO_BLOQUE)
  # Visibles al abrir: el agrupado ofrece plegarlos, no lo decide por nadie.
  expect_false(any(grepl('outlineLevel="1"[^>]*hidden="1"', con_nivel)))
})

test_that("el estado se tiñe, y solo el estado", {
  # Con 951 filas, encontrar «que falta» era leer celda a celda. El color lo
  # dice de un vistazo y el texto se queda: el color solo no sirve —hay quien no
  # lo distingue y el fichero se imprime en blanco y negro—.
  path <- file.path(tempdir(), "libro_semaforo.xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), path)
  xml <- paste(.xml_de_hoja_llamada(path, "Aulas Agendadas"), collapse = "")

  textos <- unique(regmatches(xml, gregexpr('text="[^"]+"', xml))[[1]])
  for (estado in c("AGENDADA", "REEMPLAZADA", "EN RESERVA")) {
    expect_true(any(grepl(estado, textos, fixed = TRUE)), info = estado)
  }

  # Una regla por bloque de cadena y por PALETA. La serie, que es la que cuenta
  # la historia: eran **3** —el semáforo de estados en titular + dos reservas—,
  # pasaron a **9** cuando «MEDIO DE CONTACTO» y «DÍA» ganaron la suya (Gonzalo
  # las pidió con color porque son las dos columnas que el agendador recorre en
  # vertical para repartir su jornada), y son **15** desde el 2026-09-17, cuando
  # «STATUS DE LLAMADA» y «RECIBIÓ CORREO» ganaron las suyas: eran las dos
  # únicas tecleables con desplegable y sin color, justo las del barrido
  # telefónico.
  #
  # Lo que el guard defiende no cambia: cada columna lleva LA SUYA. El defecto
  # que evitaba era colgar el semaforo de ESTADOS de las validaciones, que
  # teñia esas dos con reglas que ninguna de sus celdas casa.
  rangos <- regmatches(xml, gregexpr('conditionalFormatting sqref="[^"]+"', xml))[[1]]
  expect_equal(length(rangos), 15L)   # 5 paletas x (titular + dos reservas)
})

test_that("la hoja de aplicadas tiñe su propio estado", {
  path <- file.path(tempdir(), "libro_semaforo2.xlsx")
  aulas_libro_generar(.libro_de_prueba(1L), path)
  xml <- paste(.xml_de_hoja_llamada(path, "Aulas Aplicadas (Campo)"), collapse = "")
  expect_match(xml, "conditionalFormatting")
  expect_match(xml, 'text="APLICADA"')
})

test_that("la cabecera distingue el titular de cada reserva", {
  # Los veinte titulos se repiten identicos en cada bloque: la cabecera de la
  # columna 21 y la de la 41 se leen igual y no habia forma de saber en que
  # eslabon se esta. Una fila de banda encima seria lo natural, pero el lector
  # espera los titulos en la PRIMERA fila y añadirla rompe la relectura.
  path <- file.path(tempdir(), "libro_banda.xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), path)

  destino <- file.path(tempdir(), paste0("banda_", as.integer(runif(1, 1, 1e6))))
  dir.create(destino)
  utils::unzip(path, exdir = destino)
  # **Se comprueba en LA CELDA de cada bloque, no en el catalogo de estilos.**
  # Antes se buscaban dos tonos fijos —`FF1D4F8C` y `FF2F6BB0`— porque la banda
  # los alternaba; la escala por eslabon los calcula, asi que un color concreto
  # dejo de ser el contrato. Lo que sigue siendolo: el titular lleva el navy del
  # libro y cada bloque un color distinto.
  A <- AULAS_AGENDADAS_ANCHO_BLOQUE
  cabeceras <- vapply(1:3, function(b) {
    relleno_de_celda(path, "Aulas Agendadas", 1L + (b - 1L) * A + 2L, 1)
  }, character(1))
  expect_identical(cabeceras[[1]], "FF002457")
  expect_identical(anyDuplicated(cabeceras), 0L)
  expect_true(all(nzchar(cabeceras)))
})

test_that("la banda no rompe la relectura", {
  # Es la razon de hacerlo con color y no con una fila nueva: el contrato del
  # lector es que los titulos esten en la primera fila.
  path <- file.path(tempdir(), "libro_banda2.xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), path)
  plan <- aulas_agendadas_leer(path)
  expect_equal(length(plan), 3L)   # titular + dos reservas
  expect_equal(plan[[1]]$operational_code, "CH 1")
})

test_that("la hoja de listas queda oculta y los desplegables siguen", {
  # «Listas» existe para que las validaciones apunten a un rango y no a
  # literales; no es del equipo, y verla en la barra invita a editarla —que es
  # justo lo que las rompe—. Excel las resuelve igual contra una hoja oculta.
  path <- file.path(tempdir(), "libro_listas.xlsx")
  aulas_libro_generar(.libro_de_prueba(1L), path)
  wb <- openxlsx::loadWorkbook(path)
  visibilidad <- openxlsx::sheetVisibility(wb)
  expect_equal(as.character(visibilidad[which(names(wb) == "Listas")]), "hidden")
  # Y las de trabajo siguen a la vista: ocultarlas todas seria peor remedio.
  expect_true(all(as.character(visibilidad[names(wb) != "Listas"]) == "visible"))

  # El desplegable sigue declarado contra ella.
  xml <- paste(.xml_de_hoja_llamada(path, "Aulas Agendadas"), collapse = "")
  expect_match(xml, "Listas")
})

test_that("la banda de grupo de la hoja de campo ocupa su bloque", {
  # La fila de grupo escribia la etiqueta en su primera celda y rellenaba el
  # resto con vacios: impresa, era una franja navy enorme con dos palabras en la
  # esquina y todo lo demas en blanco. Visto en el PDF.
  path <- file.path(tempdir(), "libro_merge.xlsx")
  aulas_libro_generar(.libro_de_prueba(1L), path)
  xml <- paste(.xml_de_hoja_llamada(path, "Aulas Aplicadas (Campo)"), collapse = "")
  expect_match(xml, "mergeCell")
})

test_that("la hoja de campo tambien repite el codigo al imprimir", {
  # Mismo defecto que la agenda: `ID MATCH` es un correlativo y sin el codigo
  # las paginas siguientes no dicen de que aula hablan.
  path <- file.path(tempdir(), "libro_campo_cols.xlsx")
  aulas_libro_generar(.libro_de_prueba(1L), path)
  destino <- file.path(tempdir(), paste0("campo_", as.integer(runif(1, 1, 1e6))))
  dir.create(destino)
  utils::unzip(path, exdir = destino)
  # **El RANGO de la hoja, no cuantos `Print_Titles` hay en el libro.** Contarlos
  # no vale: seis hojas los declaran, asi que el conteo se cumple aunque esta
  # repita la columna equivocada. Con el mutante que la dejaba en `ID MATCH`
  # —el defecto real que se encontro mirando el PDF— el test seguia verde.
  hasta <- 1L + which(prosecnurapp:::.calg_titulos_agenda() == "CURSO-HORARIO")
  expect_identical(
    columnas_repetidas_de(path, "Aulas Aplicadas (Campo)"),
    sprintf("$A:$%s", openxlsx::int2col(hasta))
  )
  # Y llega mas alla de la primera: `ID MATCH` es un correlativo.
  expect_gt(hasta, 1L)
})

# --- El % de asistencia y el semaforo de la hoja de campo -------------------
#
# Tres defectos de contar columnas y de escala, los tres invisibles: la columna
# se quedaba en blanco, el semaforo se pintaba sobre una columna ajena y los
# numeros entraban como texto con un formato numerico encima que no se veia.

.libro_con_pct <- function(pct) {
  plan <- list(list(classroom_id = "A-01", operational_code = "CH 1",
                    label = "Aula 101", course_name = "C1", faculty = "F",
                    sample_role = "titular", wave = "M1", orden = 1,
                    eligible_n = 30, enrolled_total = 34, expected_valid = 20))
  f <- withr::local_tempfile(fileext = ".xlsx", .local_envir = parent.frame())
  aulas_libro_generar(plan, f, partes = list(list(
    operational_code = "CH 1", intento = 1L, observed_students = 22,
    attendance_pct = pct, application_status = "APLICADA")))
  f
}


# La columna del `% ASISTENCIA` en la hoja de campo, calculada como la calcula
# el generador: `ID MATCH` + los titulos de agenda + su posicion entre los de
# campo.
.col_pct_campo <- function() {
  1L + length(prosecnurapp:::.calg_titulos_agenda()) +
    which(prosecnurapp:::.calg_titulos_campo() == "% ASISTENCIA")
}

test_that("un % de asistencia en 0-1 se ENSEÑA como porcentaje", {
  # Se resuelve el formato de LA CELDA y no se mira si `styles.xml` contiene
  # «0.0%»: el libro tiene varias hojas y basta con que otra lo aplique para que
  # el catalogo lo declare. Este test dejo de discriminar el dia que la hoja
  # «Datos» empezo a formatear sus porcentajes — quitarle el formato a la hoja
  # de campo ya no rompia nada—, y se descubrio pasando el mutante despues.
  expect_identical(
    formato_de_celda(.libro_con_pct(0.61), "Aulas Aplicadas (Campo)",
                     .col_pct_campo(), 3),
    "0.0%"
  )
})

test_that("un % que llega en 0-100 NO se formatea como porcentaje", {
  # El control del anterior: con la misma cifra en la otra escala, el formato
  # de porcentaje enseñaria 7650 %. La columna decide por si misma.
  expect_identical(
    formato_de_celda(.libro_con_pct(76.5), "Aulas Aplicadas (Campo)",
                     .col_pct_campo(), 3),
    "0.0"
  )
})

test_that("el semaforo de la hoja de campo cae sobre STATUS DE APLICACIÓN", {
  # `STATUS DE APLICACIÓN` cae despues del ID MATCH y de TODOS los titulos de
  # agenda, que van en medio del bloque. Contando solo los titulos de campo daba
  # la 13 (M), que es `MEDIO DE CONTACTO`: la regla existia y no teñia nada.
  #
  # La letra se DERIVA del ancho vigente en vez de fijarse: cuando el bloque de
  # agenda crecio de 20 a 21 campos, la columna paso de AG a AH y este aserto
  # era lo unico que quedaba apuntando al sitio viejo.
  libro <- .libro_con_pct(0.61)
  cab <- openxlsx::read.xlsx(libro, sheet = "Aulas Aplicadas (Campo)",
                             colNames = FALSE, skipEmptyRows = FALSE, rows = 2)
  letra <- openxlsx::int2col(
    which(as.character(unlist(cab[1, ], use.names = FALSE)) == "STATUS DE APLICACIÓN")[[1]])
  xml <- paste(.xml_de_hoja_llamada(libro, "Aulas Aplicadas (Campo)"), collapse = "")
  expect_true(grepl(sprintf('sqref="%s[0-9]', letra), xml), info = letra)
  expect_false(grepl('sqref="M[0-9]', xml))
})

test_that("las cuentas de campo entran como numero, no como texto", {
  # Un numFmt sobre una celda de texto no se ve. La celda de los asistentes no
  # puede ser una cadena. La letra se DERIVA por titulo, igual que el semaforo
  # de arriba: fijada en «W3» sobrevivio de suerte al ensanche de B22 (la col
  # 23 seguia siendo un numero) y con B23 apuntaba a ENLACE DE LA FICHA.
  libro <- .libro_con_pct(0.61)
  cab <- openxlsx::read.xlsx(libro, sheet = "Aulas Aplicadas (Campo)",
                             colNames = FALSE, skipEmptyRows = FALSE, rows = 2)
  letra <- openxlsx::int2col(
    which(as.character(unlist(cab[1, ], use.names = FALSE)) == "CANTIDAD DE ASISTENTES")[[1]])
  xml <- paste(.xml_de_hoja_llamada(libro, "Aulas Aplicadas (Campo)"), collapse = "")
  celda <- regmatches(xml, regexpr(sprintf('<c r="%s3"[^>]*>', letra), xml))
  expect_length(celda, 1L)
  expect_false(grepl('t="s"', celda, fixed = TRUE))
  expect_false(grepl('t="str"', celda, fixed = TRUE))
})

# --- Los tramos de la «Base de control» -------------------------------------

test_that("los cinco tramos se anclan por NOMBRE y cubren la hoja entera", {
  g <- aulas_libro_grupos_control()
  # Cinco desde el reordenamiento del 2026-09-07: «lo esperado» se separó de
  # «lo que llegó de la plataforma», que convivían bajo «CONTROL - CUENTA», y
  # las razones bajaron a su propio tramo porque comparan a los dos.
  expect_length(g, 5L)
  # Los tramos se calculan sobre las columnas que la hoja ESCRIBE, no sobre la
  # spec entera: las cuatro `solo_lectura` existen para releer libros viejos y
  # no salen en la hoja, asi que compararlas con `BASE_CONTROL_CAMPOS` dejaba
  # los indices corridos por cuatro.
  campos <- vapply(prosecnurapp:::.calg_control_escritos(),
                   function(s) s$titulos[[1]], character(1))
  # Contiguos, sin solape y sin dejar columnas fuera: si mañana el spec gana un
  # campo en medio, el tramo que lo contiene crece y los demas se corren solos.
  expect_identical(g[[1]]$desde, 1L)
  expect_identical(g[[length(g)]]$hasta, length(campos))
  for (k in seq_len(length(g) - 1L)) {
    expect_identical(g[[k]]$hasta + 1L, g[[k + 1L]]$desde)
  }
  # El control de que el anclaje es por nombre y no por numero: el primer campo
  # de cada tramo es el que dice la etiqueta.
  expect_identical(campos[[g[[2]]$desde]], "FECHA AGENDADA")
  expect_identical(campos[[g[[3]]$desde]], "TASA DE LA FACULTAD")
  # El ancla es el CAMPO desde el 2026-09-07; el título es lo que cambia.
  expect_identical(campos[[g[[4]]$desde]], "TOTAL ENVIADAS A PLATAFORMA")
  expect_identical(campos[[g[[5]]$desde]], "ENVIADAS VS MATRICULADOS")
})

test_that("la base de control combina sus tramos y repite hasta el curso-horario", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(), libro)
  xml <- paste(.xml_de_hoja_llamada(libro, "Base de control"), collapse = "")
  # **Una por tramo, no «al menos una».** Con el mutante que dejaba la hoja
  # combinando un tramo de los cuatro, un `grepl("<mergeCell")` seguia verde y
  # los otros tres volvian a imprimirse como franjas en blanco.
  expect_identical(
    celdas_combinadas_de(libro, "Base de control"),
    length(aulas_libro_grupos_control())
  )

  d <- withr::local_tempdir()
  utils::unzip(libro, exdir = d)
  wbx <- paste(readLines(file.path(d, "xl", "workbook.xml"), warn = FALSE), collapse = "")
  # `MUESTRA` es la ola y se repite en cientos de filas: repetir solo la
  # primera columna dejaba las paginas rotuladas «M1» y sin aula.
  expect_true(grepl("Print_Titles", wbx, fixed = TRUE))
  expect_true(grepl("Base de control'!\\$A:\\$B", wbx))
})

# --- El descuadre del parte se ve al escribirlo ------------------------------

test_that("la hoja de campo avisa cuando las efectivas no cuadran", {
  # `monitoreo_aulas_reconciliacion.R` ya comprueba esto, pero al IMPORTAR:
  # quien llena la hoja en el aula no se entera hasta que alguien sube el libro,
  # y para entonces la clase se acabo. La misma regla, en la hoja.
  xml <- paste(.xml_de_hoja_llamada(.libro_con_pct(0.61), "Aulas Aplicadas (Campo)"),
               collapse = "")
  expect_true(grepl('type="expression"', xml, fixed = TRUE))
  # La formula compara efectivas contra asistentes menos rechazos y duplicados.
  # `N()` convierte el vacio en cero: rechazos y duplicados sin anotar son
  # eventos que no ocurrieron, igual que en el motor.
  expect_true(grepl("N(", xml, fixed = TRUE))
  # Y no tiñe una fila vacia: sin efectivas y sin asistentes no hay descuadre.
  expect_true(grepl("AND(", xml, fixed = TRUE))
})

test_that("la regla de cuadre se repite en cada eslabon, no solo en el primero", {
  # B24: los bloques son eslabones y cada uno se llena a mano. La cuenta se
  # DERIVA del numero real de bloques de la hoja (contar para uno solo ya
  # costo el semaforo; asumir 3 fijos costo este pin cuando el diseño cambio).
  libro <- .libro_con_pct(0.61)
  cab <- openxlsx::read.xlsx(libro, sheet = "Aulas Aplicadas (Campo)",
                             colNames = FALSE, skipEmptyRows = FALSE, rows = 2)
  bloques <- sum(as.character(unlist(cab[1, ], use.names = FALSE)) == "ID MATCH",
                 na.rm = TRUE)
  xml <- paste(.xml_de_hoja_llamada(libro, "Aulas Aplicadas (Campo)"),
               collapse = "")
  n <- length(gregexpr('type="expression"', xml, fixed = TRUE)[[1]])
  expect_gte(n, bloques)
})

test_that("declarar de MENOS no se tiñe: es posible y corriente", {
  # El motor da por descuadre cualquier diferencia; la hoja solo tiñe el
  # IMPOSIBLE —mas efectivas que gente disponible—. Declarar de menos pasa
  # cuando alguien presente no responde y nadie lo anota como rechazo: medido en
  # el estudio, los DOS unicos partes descuadrados van en ese sentido (declaran
  # 20 donde la cuenta da 21). Teñirlos seria acusar de un error que no hubo.
  xml <- paste(.xml_de_hoja_llamada(.libro_con_pct(0.61), "Aulas Aplicadas (Campo)"),
               collapse = "")
  # `>` y no `<>`: la comparacion es de un solo lado.
  expect_true(grepl("&gt;", xml, fixed = TRUE))
  expect_false(grepl("AB3&lt;&gt;X3", xml, fixed = TRUE))
})

test_that("cada desplegable saca sus valores de SU lista, no de la de al lado", {
  # El emparejamiento entre columna y lista sale de dos numeraciones que se
  # llevan a mano: la posicion del campo en el bloque y el indice de la lista en
  # la hoja «Listas». Si manaña se añade una lista en medio, se cruzan y el
  # desplegable de estados ofrece los dias — sin que nada falle.
  #
  # El aserto no compara letras de columna: comprueba que la CABECERA de la
  # lista a la que apunta cada validacion es el titulo de la columna validada.
  # Asi se mantiene solo.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(1L), libro)

  v <- validaciones_de(libro, "Aulas Agendadas")
  expect_gt(nrow(v), 0L)

  titulos_lista <- unlist(openxlsx::read.xlsx(libro, sheet = "Listas",
                                              colNames = FALSE, rows = 1))
  titulos_bloque <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$titulos[[1]], character(1))

  for (k in seq_len(nrow(v))) {
    letra <- sub("([A-Z]+).*", "\\1", v$sqref[[k]])
    n <- openxlsx::col2int(letra)
    # La posicion dentro del bloque, descontando la columna `ID MATCH`.
    pos <- ((n - 2L) %% AULAS_AGENDADAS_ANCHO_BLOQUE) + 1L
    esperado <- titulos_bloque[[pos]]

    col_lista <- openxlsx::col2int(sub(".*!\\$([A-Z]+)\\$.*", "\\1", v$formula[[k]]))
    expect_identical(unname(titulos_lista[[col_lista]]), esperado,
                     info = sprintf("la validacion de %s apunta a otra lista", esperado))
  }
})

test_that("las siete columnas de identidad del control se llenan de verdad", {
  # `aulas_libro_hoja_control()` las escribe con `pon("MUESTRA", ...)`, que busca
  # el titulo en la spec y **si no lo encuentra no hace nada y no avisa**. Un
  # renombrado en `BASE_CONTROL_CAMPOS` dejaria esa columna vacia en el libro de
  # todos los estudios sin que nada fallara: descartar en silencio.
  #
  # Se comprueba por su EFECTO —la celda trae el dato— y no listando los siete
  # literales otra vez, que seria una tercera copia de los mismos nombres.
  d <- aulas_libro_hoja_control(list(
    list(operational_code = "CH 1", sample_role = "titular", wave = "M1",
         course_name = "Curso 1", label = "Aula 101", schedule = "Lun 10:00",
         enrolled_total = 34, eligible_n = 30,
         # La hoja solo escribe lo ya aplicado; sin esto el aula no tiene fila
         # y el test miraria una hoja vacia.
         application_status = "APLICADA")
  ))
  # Por CAMPO canonico y no por titulo literal: el titulo es justo lo que un
  # renombrado (B17: POBLACION → ELEGIBLES) cambia, y este test vigila el
  # llenado, no el rotulo — el rotulo lo pinea el contrato v4.
  campos <- vapply(BASE_CONTROL_CAMPOS, function(s) s$campo, character(1))
  fila <- unlist(d[3, ], use.names = FALSE)
  valor <- function(campo) fila[[which(campos == campo)[[1]]]]

  expect_identical(valor("wave"), "M1")
  expect_identical(valor("operational_code"), "CH 1")
  expect_identical(valor("course_name"), "Curso 1")
  expect_identical(valor("room"), "Aula 101")
  expect_identical(valor("schedule"), "Lun 10:00")
  expect_identical(valor("enrolled_total"), "34")
  expect_identical(valor("eligible_n"), "30")
})

test_that("las hojas anchas se imprimen en horizontal", {
  # Sin esto se parten por columnas en A4 vertical y cada pagina queda con
  # cuatro columnas y media: es el defecto que motivo el `pageSetup`, y no habia
  # nada que lo sostuviera —el mutante que las ponia en vertical sobrevivia—.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  for (hoja in c("Aulas Agendadas", "Aulas Aplicadas (Campo)", "Base de control")) {
    expect_identical(impresion_de(libro, hoja)$orientacion, "landscape",
                     info = sprintf("la hoja «%s» se imprimiria en vertical", hoja))
  }
  # Ya no hay excepcion: las tres hojas del libro son anchas y van en
  # horizontal. La portada, que era la unica en vertical, se retiro.
  expect_null(impresion_de(libro, "Resumen"))
})

test_that("la cabecera lleva alto propio: dos lineas de titulo no caben en uno", {
  # Con el alto por defecto, «DUPLICADOS (YA RESPONDIERON)» en una columna de 18
  # se cortaba. El mutante que lo quitaba tambien sobrevivia.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  expect_gt(alto_de_fila(libro, "Aulas Agendadas", 1), 20)
  # Y la fila de datos NO lo lleva: el alto es de la cabecera, no de la hoja.
  expect_true(is.na(alto_de_fila(libro, "Aulas Agendadas", 3)))
})

test_that("el semaforo de la agenda cae sobre STATUS MUESTRA", {
  # Mismo defecto que ya se vivio en la hoja de campo —la regla teñia
  # «MEDIO DE CONTACTO»— y en la agenda no habia nada que lo vigilara: el
  # mutante que le cambiaba la columna sobrevivia. Una regla que existe pero no
  # tiñe donde debe no se nota por ningun lado.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)

  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(sp) sp$campo, character(1))
  esperada <- openxlsx::int2col(1L + which(campos == "sample_status"))
  con_paleta <- openxlsx::int2col(1L + which(campos == "contact_medium"))
  sin_paleta <- openxlsx::int2col(1L + which(campos == "teacher"))

  cols <- columnas_con_formato_condicional(libro, "Aulas Agendadas")
  expect_true(esperada %in% cols)
  # `contact_medium` YA lleva color, con su propia paleta: se pidio asi. Lo que
  # sigue sin tenerlo es una columna de texto libre, que es donde un formato por
  # valor no significaria nada.
  expect_true(con_paleta %in% cols)
  expect_false(sin_paleta %in% cols)
})

test_that("el telefono del docente NO es un numero", {
  # Es la columna con la que el agendador marca, y este libro es su unica
  # herramienta. Tipada como numero, Excel enseñaria «900,040,826» —o «9E+08»
  # si la columna se estrecha— y no se puede marcar lo que no se lee. Es texto
  # a proposito y nadie lo vigilaba.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(list(list(
    operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
    course_name = "Curso 1", teacher = "Docente 1", teacher_phone = "900040826",
    eligible_n = 30, enrolled_total = 34
  )), libro)

  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(sp) sp$campo, character(1))
  col <- 1L + which(campos == "teacher_phone")
  expect_identical(tipo_de_celda(libro, "Aulas Agendadas", col, 2), "s")

  # Y el control: los denominadores SI son numeros, asi que el libro no esta
  # escribiendolo todo como texto —eso los dejaria sin poder sumarse—.
  col_n <- 1L + which(campos == "enrolled_total")
  expect_identical(tipo_de_celda(libro, "Aulas Agendadas", col_n, 2), "n")
})

test_that("las columnas con coma de miles no tienen cifras de cuatro digitos", {
  # Gonzalo vio comas donde no tenian sentido. Venian de la portada —«5,410
  # alumnos elegibles»— y de la hoja «Datos», las dos retiradas. En las hojas de
  # trabajo el formato «#,##0» sigue puesto y esta bien que siga: lo que hay que
  # comprobar es que lo llevan CUENTAS POR AULA, no totales de estudio.
  #
  # Se miran solo esas columnas. Barrer todos los numeros de la hoja daba un
  # falso positivo con 46245, que es el SERIAL de una fecha —lleva formato
  # «dd/mm/yyyy» y se ve como fecha—: el mismo aserto demasiado ancho que este
  # fichero lleva media sesion acotando.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  d <- suppressWarnings(openxlsx::read.xlsx(libro, sheet = "Aulas Agendadas",
                                            colNames = FALSE))
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(sp) sp$campo, character(1))
  for (cmp in c("enrolled_total", "eligible_n", "contact_attempts")) {
    col <- 1L + which(campos == cmp)
    v <- suppressWarnings(as.numeric(d[[col]]))
    v <- v[is.finite(v)]
    if (!length(v)) next
    expect_lt(max(v), 1000, label = sprintf("el mayor valor de «%s»", cmp))
  }
})

test_that("las bandas dicen TITULAR y REEMPLAZO n, no «muestra»", {
  # El vocabulario del estudio dejo de hablar de muestra 1 y muestra 2: una
  # cadena es un titular y sus reemplazos, y asi se llaman ya los codigos
  # —«CH 4» y su «R 4.1»—. La banda decia «MUESTRA DE APLICACIÓN PRINCIPAL» y
  # «APLICACIÓN DE REEMPLAZO 2», que ademas estaba desalineado: el bloque 2 es
  # el reemplazo 1, no el 2.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  fila <- suppressWarnings(openxlsx::read.xlsx(libro, sheet = "Aulas Aplicadas (Campo)",
                                               colNames = FALSE, rows = 1))
  bandas <- Filter(nzchar, as.character(unlist(fila)))
  expect_identical(bandas[[1]], "TITULAR")
  # El bloque 2 es el reemplazo 1: la numeracion sigue al codigo del aula.
  expect_identical(bandas[[2]], "REEMPLAZO 1")
  expect_false(any(grepl("MUESTRA", bandas, fixed = TRUE)))
})

test_that("renombrar las bandas no rompe la relectura", {
  # Es lo que permite cambiar el vocabulario sin romper un libro a medio llenar:
  # el lector toma los titulos de la fila 2 e IGNORA la de grupo.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(1L), libro, partes = list(list(
    operational_code = "CH 1", intento = 1L, observed_students = 21,
    effective_surveys = 19, application_status = "APLICADA"
  )))
  partes <- aulas_aplicadas_leer(libro)
  expect_gt(length(partes), 0L)
  expect_equal(as.numeric(partes[[1]]$effective_surveys), 19)
})

test_that("el libro abre por la hoja donde se trabaja", {
  # Quien recibe este fichero lo abre para agendar. Cuando habia portada, la
  # hoja 1 era el resumen y esto significaba «abre por la portada»; al
  # retirarla, el comportamiento correcto se cumplio por el orden, no por una
  # decision. Queda fijado como decision: la primera hoja es la del agendador.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  expect_identical(openxlsx::getSheetNames(libro)[[1]], "Aulas Agendadas")
  # Y la que queda ACTIVA, que es otra cosa: el orden dice cual es la primera,
  # `activeTab` dice por cual abre. Un mutante que la ponia en la ultima
  # sobrevivio al aserto de orden.
  expect_identical(hoja_activa_de(libro), "Aulas Agendadas")

  wb <- openxlsx::loadWorkbook(libro)
  # Y «Listas» sigue oculta: se oculta por NOMBRE, asi que retirar dos hojas no
  # la descoloco.
  visible <- as.character(openxlsx::sheetVisibility(wb))
  expect_identical(visible[[which(names(wb) == "Listas")]], "hidden")
  expect_true(all(visible[names(wb) != "Listas"] == "visible"))
})

test_that("al imprimir se repite la fila de TITULOS, no la banda de grupo", {
  # Repitiendo las dos, las columnas repetidas arrastraban la banda del PRIMER
  # tramo: una pagina con columnas de «CONTROL - CUENTA» salia rotulada
  # «INFORMACIÓN DEL CURSO». Medido en el libro del estudio: el rotulo enganaba
  # en 56 de las 56 paginas de esa hoja; ahora sale en 8 —las primeras de cada
  # tramo de columnas— y en las demas no hay rotulo, que es mejor que uno falso.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  # Las hojas de dos filas de cabecera repiten SOLO la segunda.
  expect_identical(filas_repetidas_de(libro, "Base de control"), "$2:$2")
  expect_identical(filas_repetidas_de(libro, "Aulas Aplicadas (Campo)"), "$2:$2")
  # Y la agenda, que solo tiene una, sigue repitiendo la suya.
  expect_identical(filas_repetidas_de(libro, "Aulas Agendadas"), "$1:$1")
})

test_that("el libro conserva el orden del plan, no el alfabetico", {
  # `split()` ordena los grupos por su clave como TEXTO, asi que el libro salia
  # «CH 1, CH 10, CH 100, CH 101…»: quien busca «CH 11» lo encontraba noventa
  # filas mas abajo. Y el orden de la muestra, que el plan trae resuelto, se
  # perdia.
  plan <- lapply(c(1, 2, 10, 11, 100), function(n) list(
    operational_code = sprintf("CH %d", n), titular_operational_code = sprintf("CH %d", n),
    sample_role = "titular", faculty = "Letras", course_name = "C", eligible_n = 30
  ))
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, libro)
  d <- suppressWarnings(openxlsx::read.xlsx(libro, sheet = "Aulas Agendadas",
                                            colNames = FALSE))
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  v <- as.character(d[[1L + which(campos == "operational_code")]])[-1]
  v <- v[!is.na(v) & nzchar(v)]
  expect_identical(v, c("CH 1", "CH 2", "CH 10", "CH 11", "CH 100"))
})

test_that("«ID MATCH» va con el gris de la app: no se escribe en el", {
  # Es el correlativo con el que se enlazan las filas y salia en blanco, que en
  # esta hoja significa «escribe aqui».
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.libro_de_prueba(2L), libro)
  expect_identical(relleno_de_celda(libro, "Aulas Agendadas", 1, 2), "FFF2F4F7")
})

test_that("las tres hojas listan las aulas en el MISMO orden", {
  # No es casualidad ni cosmetica: es lo que permite mirar dos hojas en
  # paralelo. Cada una filtra distinto —la agenda trae un grupo por titular, la
  # de campo los que tienen parte, el control los que tienen registro— asi que
  # el numero de filas no coincide, pero el orden relativo si tiene que
  # coincidir. Sin esto, reordenar una sola las descuadra sin que nada falle.
  plan <- lapply(c(1, 2, 10, 11, 100), function(n) list(
    operational_code = sprintf("CH %d", n), titular_operational_code = sprintf("CH %d", n),
    sample_role = "titular", faculty = "Letras", course_name = "C",
    eligible_n = 30, expected_valid = 20, wave = "M1"
  ))
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, libro,
                      partes = list(list(operational_code = "CH 10", intento = 1L,
                                         observed_students = 20, effective_surveys = 18)),
                      control = list(list(operational_code = "CH 2", sent_total = 9)))

  codigos <- function(hoja, fila_cab) {
    d <- suppressWarnings(openxlsx::read.xlsx(libro, sheet = hoja, colNames = FALSE))
    cab <- as.character(unlist(d[fila_cab, ]))
    v <- as.character(d[[which(cab == "CURSO-HORARIO")[[1]]]])[-(1:fila_cab)]
    v[!is.na(v) & nzchar(v)]
  }
  esperado <- c("CH 1", "CH 2", "CH 10", "CH 11", "CH 100")
  expect_identical(codigos("Aulas Agendadas", 1L), esperado)
  expect_identical(codigos("Aulas Aplicadas (Campo)", 2L), esperado)
  # **La base de control lista un SUBCONJUNTO, y en el mismo orden.** Desde el
  # 2026-09-07 escribe solo lo ya aplicado más lo que ya tiene control
  # registrado, así que aquí entran las cinco aplicadas de la fijación más
  # CH 2, que trae control. Lo que sigue siendo contrato es el ORDEN: si las
  # tres hojas ordenaran distinto, cruzarlas a mano sería imposible.
  ctrl <- codigos("Base de control", 2L)
  expect_true(all(ctrl %in% esperado))
  expect_identical(ctrl, esperado[esperado %in% ctrl])
})

test_that("«Plan del día» tipa su FECHA AGENDADA: 07/09 no puede leerse como 09/07", {
  # Era la única hoja con una columna de fecha sin declarar, así que su celda
  # salía con el formato por defecto del escritor —mes/día— y el lunes 7 de
  # setiembre se veía «09/07/2026». En un operativo de septiembre con jornadas
  # del 7 al 12, todos los días caben también como mes: no se ve rara, se ve
  # como otra fecha. Visto en el PDF del libro el 2026-09-09.
  destino <- tempfile(fileext = ".xlsx")
  plan <- list(
    list(operational_code = "CH 1", classroom_id = "aula_1", sample_role = "titular",
         sample_status = "agendada", faculty = "DERECHO", course_name = "Cálculo",
         teacher = "Docente Uno", scheduled_venue = "A101",
         scheduled_date = "2026-09-07", scheduled_time = "10:00",
         eligible_n = 40, expected_valid = 20)
  )
  aulas_libro_generar(plan, destino)
  wb <- openxlsx::loadWorkbook(destino)
  col <- which(prosecnurapp:::.capd_CABECERA == "FECHA AGENDADA")
  expect_length(col, 1L)
  estilos <- wb$styleObjects
  # El estilo de fecha tiene que alcanzar a esa columna en «Plan del día», y
  # con el formato del día PRIMERO. Un `numFmt` cualquiera no sirve: la avería
  # era justamente tener formato, pero el otro.
  toca <- Filter(function(e) {
    identical(e$sheet, "Plan del día") && col %in% e$cols &&
      identical(e$style$numFmt$numFmtId, "165") ||
      (identical(e$sheet, "Plan del día") && col %in% e$cols &&
         grepl("dd/mm", e$style$numFmt$formatCode %||% "", fixed = TRUE))
  }, estilos)
  expect_gt(length(toca), 0L)
  formatos <- unique(unlist(lapply(toca, function(e) e$style$numFmt$formatCode)))
  expect_true(any(grepl("^dd/mm", formatos)))
  expect_false(any(grepl("^mm/dd", formatos)))
})

# =============================================================================
# «SESIONES Y AULA»: el horario que el que llama va a proponer
# =============================================================================
#
# La celda prefiere `sesiones_legibles` —día↔aula apareados desde el catálogo
# DTI— y caía directamente al `label`, que es el CÓDIGO INTERNO del
# curso-horario (`ant310_0811`). Entre las dos faltaba un escalón, y con datos
# reales se abrió: en CCSS Perfil 2026-II `sesiones_legibles` viene en **0 de
# 136** aulas (su marco no la produjo) mientras `sesiones_dia_hora` viene en
# **136 de 136** con «LUN 15:00-18:00» y `venue` trae el aula («Z410»).
#
# O sea: el dato estaba, en el campo hermano, y la columna publicaba un código
# que al docente no le dice nada — justo lo que el dictado B15 pedía evitar
# («no vaya a ser que jale mal algún número […] y el docente pierda seriedad
# sobre el estudio»). Es la columna con la que se agenda, así que el fallback al
# `label` no es un detalle cosmético: es una llamada sin horario que proponer.

test_that("SESIONES Y AULA: la legible manda, y el dia y hora la respaldan", {
  celda <- prosecnurapp:::.calg_sesiones_y_aula
  # 1) La legible gana siempre que exista: HSVG no se mueve.
  expect_identical(
    celda(list(sesiones_legibles = "LUN 16:00-18:00 L101",
               sesiones_dia_hora = "MAR 10:00-12:00", venue = "Z410",
               label = "ant310_0811")),
    "LUN 16:00-18:00 L101")
  # 2) Sin legible, el día y la hora con su aula al lado.
  expect_identical(
    celda(list(sesiones_legibles = "", sesiones_dia_hora = "LUN 15:00-18:00",
               venue = "Z410", label = "ant310_0811")),
    "LUN 15:00-18:00 Z410")
  # 3) Sin aula, el día y la hora solos: sigue siendo lo que hace falta para
  #    proponer una fecha.
  expect_identical(
    celda(list(sesiones_dia_hora = "LUN 15:00-18:00", label = "ant310_0811")),
    "LUN 15:00-18:00")
  # 4) Sin día ni hora, el aula sola dice más que el código interno.
  expect_identical(celda(list(venue = "Z410", label = "ant310_0811")), "Z410")
  # 5) Y el `label` queda como ÚLTIMO recurso, que es lo que era.
  expect_identical(celda(list(label = "ant310_0811")), "ant310_0811")
})

test_that("SESIONES Y AULA: el libro publica el horario, no el codigo del curso", {
  # La comprobación sobre la hoja, no sólo sobre el helper: un test que mide el
  # helper y no la aplicación declara cobertura que no tiene.
  plan <- list(list(
    classroom_id = "ant310_0811", operational_code = "CH 1",
    label = "ant310_0811", sesiones_dia_hora = "LUN 15:00-18:00", venue = "Z410",
    faculty = "CIENCIAS SOCIALES", program = "ANTROPOLOGÍA", level = "7",
    course_name = "ANTROPOLOGÍA POLÍTICA 1", teacher = "DAMONTE VALENCIA, GERARDO HECTOR",
    teacher_phone = "990340822", teacher_email = "gdamonte@pucp.pe",
    sample_role = "titular", eligible_n = 12, expected_valid = 9.6, orden = 1
  ))
  hoja <- aulas_libro_hoja_agendadas(plan)
  col <- which(as.character(unlist(hoja[1, ])) == "SESIONES Y AULA")
  expect_length(col, 1L)
  expect_identical(as.character(hoja[2, col[[1]]]), "LUN 15:00-18:00 Z410")
  # Y que NO sea el código interno, que es el defecto concreto que se reparó.
  expect_false(identical(as.character(hoja[2, col[[1]]]), "ant310_0811"))
})

# =============================================================================
# El barrido telefónico se ve sin leerlo
# =============================================================================
#
# `STATUS MUESTRA`, `MEDIO DE CONTACTO` y `DÍA` llevaban color desde B13b/B18;
# `STATUS DE LLAMADA` y `RECIBIÓ CORREO` eran las dos únicas columnas
# TECLEABLES con desplegable y **sin** color. Y son justo las dos que el
# agendador recorre en vertical durante la jornada: «a quién vuelvo a llamar» y
# «a quién le falta el correo». Dictado de Gonzalo del 2026-09-17: «que todos
# los estatus y colores tanto de llamada, de recibió correo, de encontrado o
# agendada estén disponibles para que HOY se puedan realizar las llamadas
# telefónicas».
#
# La comprobación se ancla por RÓTULO, no por posición: el semáforo se cuelga
# por índice de columna y ya se pintó una vez sobre la columna equivocada
# —`MEDIO DE CONTACTO` en vez de `STATUS DE APLICACIÓN`—, y una regla que
# existe pero no tiñe nada no se ve por ningún lado.

test_that("las cinco columnas del barrido llevan color, ancladas por su rotulo", {
  plan <- lapply(1:3, function(i) list(
    classroom_id = sprintf("c%d", i), operational_code = sprintf("CH %d", i),
    label = sprintf("c%d", i), sesiones_dia_hora = "LUN 15:00-18:00", venue = "Z410",
    faculty = "CIENCIAS SOCIALES", program = "ANTROPOLOGÍA", level = "7",
    course_name = "CURSO", teacher = "DOCENTE", teacher_phone = "990000000",
    sample_role = "titular", eligible_n = 12, expected_valid = 9.6, orden = i
  ))
  dest <- file.path(tempdir(), sprintf("libro-color-%d.xlsx", as.integer(runif(1, 1, 1e9))))
  on.exit(unlink(dest), add = TRUE)
  aulas_libro_generar(plan, dest)

  hoja <- suppressMessages(openxlsx::read.xlsx(dest, sheet = "Aulas Agendadas", colNames = FALSE))
  cab <- as.character(unlist(hoja[1, ]))
  letra <- function(rotulo) {
    i <- which(cab == rotulo)
    expect_length(i, 1L)
    # Índice de columna a letra de Excel, que es como la trae el `sqref`.
    n <- i[[1]]; out <- ""
    while (n > 0) { r <- (n - 1L) %% 26L; out <- paste0(LETTERS[r + 1L], out); n <- (n - 1L) %/% 26L }
    out
  }
  reglas <- reglas_condicionales_de(dest, "Aulas Agendadas")

  for (rotulo in c("STATUS MUESTRA", "MEDIO DE CONTACTO", "DÍA",
                   "STATUS DE LLAMADA", "RECIBIÓ CORREO")) {
    col <- letra(rotulo)
    propias <- reglas[reglas$col == col, , drop = FALSE]
    expect_gt(nrow(propias), 0L)
    # `contains` y no otra clase: son semáforos de texto, no barras de datos.
    expect_true(all(propias$tipo == "containsText"), info = rotulo)
  }
})

test_that("el color de la llamada separa los tres destinos, y el correo no alarma", {
  # Lo que se comprueba es el SIGNIFICADO del color, no que haya color: el
  # agendador busca «a quién vuelvo a llamar», así que lo logrado, lo que vuelve
  # a la cola y lo que se cierra sin logro tienen que distinguirse.
  paletas <- prosecnurapp:::aulas_libro_paletas_de_estado()
  ll <- paletas$llamada
  # El color de un `bgFill` vive en `fill$fillBg$rgb`, no en `fillFg`: leer el
  # campo equivocado devuelve `NULL` para TODOS y entonces cualquier par de
  # tonos sale «idéntico» — el test pasaría con la paleta entera del mismo
  # color, que es justo lo que viene a impedir.
  tono <- function(p, texto) {
    hit <- Filter(function(r) identical(r$texto, texto), p)
    expect_length(hit, 1L)
    rgb <- hit[[1]]$estilo$fill$fillBg$rgb
    expect_true(is.character(rgb) && nzchar(rgb[[1]]), info = texto)
    rgb[[1]]
  }
  # Las siete opciones del desplegable están todas cubiertas: una opción sin
  # regla es una celda que se queda en blanco en la jornada.
  expect_setequal(vapply(ll, function(r) r$texto, character(1)), AULAS_LIBRO_STATUS_LLAMADA)
  # Logrado: la efectiva y la de WhatsApp comparten tono — las dos salen de la
  # cola de llamadas.
  expect_identical(tono(ll, "Efectiva"), tono(ll, "Contactado por WhatsApp"))
  # Vuelve a la cola: los tres reintentos comparten tono, distinto del logrado.
  expect_identical(tono(ll, "No contesta"), tono(ll, "Apagado"))
  expect_identical(tono(ll, "No contesta"), tono(ll, "Contactar después"))
  expect_false(identical(tono(ll, "No contesta"), tono(ll, "Efectiva")))
  # Se cierra sin logro, y no se confunde con ninguno de los otros dos.
  expect_identical(tono(ll, "Colgó"), tono(ll, "Rechazo"))
  expect_false(identical(tono(ll, "Rechazo"), tono(ll, "Efectiva")))
  expect_false(identical(tono(ll, "Rechazo"), tono(ll, "No contesta")))

  co <- paletas$correo
  expect_setequal(vapply(co, function(r) r$texto, character(1)), AULAS_LIBRO_RECIBIO_CORREO)
  # El «No» NO va en el rojo del rechazo: es el valor sembrado por defecto, y
  # pintar la columna entera de rojo el primer día diría que hay cincuenta
  # problemas donde sólo hay correos sin enviar.
  expect_false(identical(tono(co, "No"), tono(ll, "Rechazo")))
  expect_identical(tono(co, "Sí"), tono(ll, "Efectiva"))
})
