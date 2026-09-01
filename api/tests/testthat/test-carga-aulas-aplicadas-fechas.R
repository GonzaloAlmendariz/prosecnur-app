# La fecha del parte de campo tiene que volver LEGIBLE del Excel.
#
# Hallazgo A22 (checklist operativo, 2026-09-01): al importar un libro xlsx la
# fecha del parte volvia como el serial de Excel en texto («46282») en vez de
# fecha legible. El mecanismo es el mismo que ya se documento y reparo en
# agendadas (`.caa_fecha`): en cuanto la celda ES fecha —porque la escribio la
# app tipada, o porque Excel convirtio lo que alguien tecleo— el fichero guarda
# el numero de serie y readxl lo entrega como texto «46282». El lector de
# aplicadas pasaba `applied_date` por `.caa_txt` a secas, sin la conversion.
#
# El formato que se pinea es el del resto del sistema: `%Y-%m-%d`, que es lo
# que produce `.caa_fecha` en agendadas y lo que `.calg_tipar_fechas` parsea al
# escribir el libro. No un formato inventado.
#
# Estos tests van por el lector REAL sobre un xlsx real (no por el data.frame
# en memoria de test-carga-aulas-aplicadas.R) porque la frontera esta en como
# el archivo guarda la celda: en memoria no existe el serial.

.capf_tit_agenda <- c(
  "MUESTRA", "CURSO-HORARIO", "NOMBRE DE DOCENTE", "TELÉFONO DE DOCENTE",
  "CORREO PUCP DOCENTE", "NOMBRE DEL CURSO", "FACULTAD", "NIVEL DEL CURSO",
  "SESIONES Y AULA", "MATRICULADOS TOTAL DTI", "MATRICULADOS POBLACIÓN",
  "MEDIO DE CONTACTO", "FECHA DE LLAMADA", "NÚMERO DE INTENTOS", "STATUS MUESTRA",
  "FECHA DE APLICACIÓN", "DÍA", "HORA", "ENLACE DE LA FICHA",
  "OBSERVACIONES SOBRE AULAS AGENDADAS"
)
.capf_tit_campo <- c(
  "MATRICULADOS TOTAL DTI", "MATRICULADOS POBLACIÓN", "CANTIDAD DE ASISTENTES",
  "% ASISTENCIA", "CANTIDAD DE RECHAZOS", "DUPLICADOS (YA RESPONDIERON)",
  "CANTIDAD DE EFECTIVAS", "APLICADOR", "AULA",
  "FECHA DE APLICACIÓN", "HORA DE APLICACIÓN", "STATUS DE APLICACIÓN",
  "OBSERVACIONES SOBRE APLICACIONES"
)
# Columna de la SEGUNDA «FECHA DE APLICACIÓN» del bloque: la del parte, no la
# de agenda. 1 (ID MATCH) + 20 de agenda + posicion 10 de la parte de campo.
.capf_col_fecha <- 1L + length(.capf_tit_agenda) + 10L

# Un libro minimo de un bloque con la anatomia real (fila 1 grupo, fila 2
# campos, cuerpo desde la 3). `fecha` puede ser una Date (celda tipada, como la
# escribe la app o como la deja Excel al convertir lo tecleado) o un texto
# (celda que Excel NO convirtio); NULL deja la celda vacia.
.capf_libro <- function(fecha) {
  agenda <- c("Muestra 01", "POL312-0889", "DOCENTE DEMO", "999",
              "demo@pucp.edu.pe", "CURSO DEMO", "SOCIALES", "3",
              "LUN 08:00 A101", "40", "35", "Llamada", "2026-09-02", "1",
              "AGENDADA", "2026-09-10", "Miercoles", "08:00",
              "https://x.test/f", "sin novedad")
  campo <- c("40", "35", "27", "0.62", "1", "3", "23", "Bryan Robles", "J309",
             "", "15:00", "APLICADA", "todo bien")
  titulos <- c("ID MATCH", .capf_tit_agenda, .capf_tit_campo)
  fila <- c("77", agenda, campo)
  path <- withr::local_tempfile(fileext = ".xlsx", .local_envir = parent.frame())
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Aulas Aplicadas (Campo)")
  openxlsx::writeData(wb, 1, t(rep("TITULAR", length(titulos))), startRow = 1, colNames = FALSE)
  openxlsx::writeData(wb, 1, t(titulos), startRow = 2, colNames = FALSE)
  openxlsx::writeData(wb, 1, t(fila), startRow = 3, colNames = FALSE)
  if (!is.null(fecha)) {
    # Si es Date, openxlsx la escribe TIPADA con su dateFormat: la celda es
    # fecha de verdad, no texto con pinta de fecha.
    openxlsx::writeData(wb, 1, fecha, startRow = 3, startCol = .capf_col_fecha,
                        colNames = FALSE)
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

test_that("una celda de fecha REAL vuelve legible, no como serial de Excel", {
  path <- .capf_libro(as.Date("2026-09-17"))
  # Control de la fixture: la celda ES una fecha dentro del xlsx. Si esto
  # falla, el libro de prueba quedo mal armado y el test de abajo no mide nada.
  cruda <- openxlsx::read.xlsx(path, sheet = "Aulas Aplicadas (Campo)",
                               startRow = 2, detectDates = TRUE)
  expect_s3_class(cruda[[.capf_col_fecha]], "Date")

  partes <- aulas_aplicadas_leer(path)
  expect_length(partes, 1L)
  # El contrato: mismo formato que produce el resto del sistema (`.caa_fecha`
  # en agendadas, `%Y-%m-%d`). El defecto A22 entrega aqui «46282»: el serial
  # de Excel en texto, que viaja tal cual al plan y a la vista.
  expect_identical(partes[[1]]$applied_date, "2026-09-17")
})

test_that("una fecha tecleada como texto dd/mm/yyyy sobrevive tal cual", {
  # La celda NO es fecha para Excel (es texto): el lector no tiene serial que
  # convertir y no debe inventarse una conversion. Guardia contra un arreglo
  # que parsee de mas: `.caa_fecha` deja pasar lo no numerico sin tocarlo.
  path <- .capf_libro("17/09/2026")
  partes <- aulas_aplicadas_leer(path)
  expect_length(partes, 1L)
  expect_identical(partes[[1]]$applied_date, "17/09/2026")
})

test_that("una celda de fecha vacia queda vacia", {
  # Vacio es ausencia, no una fecha por defecto ni un NA impreso.
  path <- .capf_libro(NULL)
  partes <- aulas_aplicadas_leer(path)
  expect_length(partes, 1L)
  expect_identical(partes[[1]]$applied_date, "")
})
