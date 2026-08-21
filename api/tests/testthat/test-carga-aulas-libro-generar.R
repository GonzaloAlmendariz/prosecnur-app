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
.calg_unidad <- function(code, role = "titular", rf = "", orden = NULL) list(
  operational_code = code, sample_role = role, replacement_for = rf,
  titular_operational_code = rf,
  replacement_order = orden, wave = "Muestra 01", teacher = "Docente Demo",
  teacher_phone = "999", teacher_email = "d@x.test", course_name = "Curso Demo",
  faculty = "SOCIALES", level = "3", label = "LUN A101", schedule = "LUN 08:00",
  enrolled_total = 40, eligible_n = 35, link = paste0("https://x.test/", code)
)

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

  # 1 columna de id + 2 bloques de 20.
  expect_identical(ncol(hojas), 41L)
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

.libro_de_prueba <- function(n_reservas = 2L) {
  titular <- list(
    operational_code = "CH 1", titular_operational_code = "CH 1",
    sample_role = "titular", faculty = "Letras y Ciencias Humanas",
    course_name = "HISTORIA Y TEORIA DE LA ARQUITECTURA CONTEMPORANEA",
    teacher = "Docente CH 1", eligible_n = 40, scheduled_date = "2026-08-11"
  )
  reservas <- lapply(seq_len(n_reservas), function(i) list(
    operational_code = sprintf("R 1.%d", i), titular_operational_code = "CH 1",
    sample_role = "chain_reserve", replacement_order = i,
    faculty = "Letras y Ciencias Humanas", course_name = "CURSO DE RESERVA",
    eligible_n = 30
  ))
  c(list(titular), reservas)
}

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

  # Una regla por bloque de cadena y no una por columna con validacion: colgarlo
  # de las validaciones teñia tambien «MEDIO DE CONTACTO» y «DÍA».
  rangos <- regmatches(xml, gregexpr('conditionalFormatting sqref="[^"]+"', xml))[[1]]
  expect_equal(length(rangos), 3L)   # titular + dos reservas
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
  estilos <- paste(readLines(file.path(destino, "xl", "styles.xml"), warn = FALSE),
                   collapse = "")
  # Los dos tonos de reserva son exclusivos de esta banda, asi que buscarlos en
  # el catalogo sirve: si desaparecen de aqui, desaparecen del libro.
  expect_match(estilos, "FF1D4F8C")
  expect_match(estilos, "FF2F6BB0")
  # **El navy NO se busca en el catalogo**: la portada lo usa en su titulo, sus
  # secciones y su barra de datos, asi que ahi esta pase lo que pase — con el
  # mutante que se lo quitaba a la cabecera de las hojas, este test seguia
  # verde. Se comprueba en LA CELDA, que es donde tiene que verse.
  expect_identical(relleno_de_celda(path, "Aulas Agendadas", 1, 1), "FF002457")
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
  # `STATUS DE APLICACIÓN` es la columna 33 (AG) porque su bloque lleva los 20
  # titulos de agenda en medio. Contando solo los titulos de campo daba la 13
  # (M), que es `MEDIO DE CONTACTO`: la regla existia y no teñia nada.
  xml <- paste(.xml_de_hoja_llamada(.libro_con_pct(0.61), "Aulas Aplicadas (Campo)"), collapse = "")
  expect_true(grepl('sqref="AG[0-9]', xml))
  expect_false(grepl('sqref="M[0-9]', xml))
})

test_that("las cuentas de campo entran como numero, no como texto", {
  # Un numFmt sobre una celda de texto no se ve. La celda de los asistentes
  # (columna W, la 23) no puede ser una cadena.
  xml <- paste(.xml_de_hoja_llamada(.libro_con_pct(0.61), "Aulas Aplicadas (Campo)"), collapse = "")
  celda <- regmatches(xml, regexpr('<c r="W3"[^>]*>', xml))
  expect_length(celda, 1L)
  expect_false(grepl('t="s"', celda, fixed = TRUE))
  expect_false(grepl('t="str"', celda, fixed = TRUE))
})

# --- Los tramos de la «Base de control» -------------------------------------

test_that("los cuatro tramos se anclan por NOMBRE y cubren la hoja entera", {
  g <- aulas_libro_grupos_control()
  expect_length(g, 4L)
  campos <- vapply(BASE_CONTROL_CAMPOS, function(s) s$titulos[[1]], character(1))
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
  expect_identical(campos[[g[[3]]$desde]], "TOTAL ENVIADAS")
  expect_identical(campos[[g[[4]]$desde]], "N ASISTENTES EN AULA")
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

test_that("la regla de cuadre se repite en cada intento, no solo en el primero", {
  # Un aula que se visita dos veces tiene dos bloques de parte y los dos se
  # llenan a mano. Contar columnas para uno solo ya costo el semaforo.
  xml <- paste(.xml_de_hoja_llamada(.libro_con_pct(0.61), "Aulas Aplicadas (Campo)"),
               collapse = "")
  n <- length(gregexpr('type="expression"', xml, fixed = TRUE)[[1]])
  expect_gte(n, 2L)
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
         enrolled_total = 34, eligible_n = 30)
  ))
  campos <- vapply(BASE_CONTROL_CAMPOS, function(s) s$titulos[[1]], character(1))
  fila <- unlist(d[3, ], use.names = FALSE)
  valor <- function(titulo) fila[[which(campos == titulo)[[1]]]]

  expect_identical(valor("MUESTRA"), "M1")
  expect_identical(valor("CURSO-HORARIO"), "CH 1")
  expect_identical(valor("NOMBRE DEL CURSO"), "Curso 1")
  expect_identical(valor("AULA"), "Aula 101")
  expect_identical(valor("HORARIO"), "Lun 10:00")
  expect_identical(valor("MATRICULADOS TOTALES"), "34")
  expect_identical(valor("MATRICULADOS POBLACION"), "30")
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
  otra <- openxlsx::int2col(1L + which(campos == "contact_medium"))

  cols <- columnas_con_formato_condicional(libro, "Aulas Agendadas")
  expect_true(esperada %in% cols)
  expect_false(otra %in% cols)
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

  wb <- openxlsx::loadWorkbook(libro)
  # Y «Listas» sigue oculta: se oculta por NOMBRE, asi que retirar dos hojas no
  # la descoloco.
  visible <- as.character(openxlsx::sheetVisibility(wb))
  expect_identical(visible[[which(names(wb) == "Listas")]], "hidden")
  expect_true(all(visible[names(wb) != "Listas"] == "visible"))
})
