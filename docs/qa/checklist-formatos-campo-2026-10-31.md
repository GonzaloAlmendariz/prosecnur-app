# Checklist: los formatos que campo llena, y quién los genera

Fecha: 2026-10-31. Pedido de Gonzalo tras ver la asignación en la app: «la asignación no suele hacerse desde la
aplicación, sino que hay que generar una especie de documento Excel»; «el equipo de campo no usa la app»; revisar las
carpetas de campo de ACNUR acogida (territorial) y de Ser Adolescente; el barrido telefónico del RMS; y los PDF de
recorrido y de consolidado, que «has inventado tus propios mecanismos».

Fuentes revisadas (sólo estructura; no se copió ningún nombre, DNI ni teléfono):

- Drive, carpeta de campo ACNUR KOICA (acogida): «Hojas Ruta Operativo_11_06_26» (Sheets), «Monitoreo de campo»
  (Sheets), «codigos_pulso_encuestadores-VF.xlsx», «Lista de encuestadores - ACNUR KOICA», «Formatos de seguimiento y
  consolidado» (dos Word).
- Local, `Documents/Pulso/01_Estudios/2026_Ser_Adolescente/`: `Checklist_productos_campo_051026.md`,
  `Campo/Seguimiento_campo_SerAdolescente_v3.xlsx`, hoja de ruteo y hoja de consolidados en PDF.
- Drive, «Listado Telefónico - RMS PULSO PUCP»: es la muestra de ACNUR con datos personales, no el barrido. No se
  siguió leyendo.

## Lo que hace campo hoy

1. **La asignación vive en el Excel operativo.** Acogida usó el «Excel operativo de hojas de ruta» que genera la app
   (`/api/hojas-ruta/route-workbook`, `hojas_ruta_engine.R` ~8753; hoy se descarga en Material › Paquetes). Campo lo
   subió a Sheets y le **agregó a mano** las columnas «Encuestador» (nombre, texto libre), «Fecha de Salida», «Fecha de
   entrega» y «OBSERVACIONES». Llenó el «Estado» de la UMP y de cada «Encuesta 1…8». Contó UMP por encuestador con una
   tabla dinámica y anotó arriba «7 REEMPLAZADAS · 13 ANULADAS».
2. **Las reasignaciones se hacen ahí mismo**, editando la fila. La app no se entera.
3. **En papel van dos formatos de campo** (Word): la *hoja de seguimiento de viviendas* (dirección, resultado con
   códigos 1–8 y 99, nombre, edad, sexo y n.º de encuesta, 80 filas) y la *hoja de consolidados* (resumen de
   ocurrencias por código, total de efectivas e intentos, y el registro de encuestados con hora de inicio y fin).
4. **Ser Adolescente** repite el patrón: un Excel «Seguimiento de campo» por sede que llenan los coordinadores
   (logradas por celda de cuota, estado y reporte por fórmula), más hoja de ruteo y hoja de consolidados en papel.

## Ítems

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| C1 | El Excel que campo llena para asignar UMP a encuestadores | `api/R/collection_territorial_excel.R` (`POST …/territorial/asignacion/excel`); botón «Excel para campo» en Material › Entrega | ☑ Hecho, en verificación de Gonzalo. Una fila por UMP de la foto, cada reemplazo bajo su titular (azul/amarillo), «Encuestador» con desplegable «P844 · Nombre» de la lista de Monitoreo, fechas, estado, observaciones, conteo por encuestador y lo ya asignado escrito. Probado en vivo con acnur_acg (300 UMP) |
| C2 | Quién es dueño de la asignación y de las reasignaciones: Material o Monitoreo | **Decidido por Gonzalo (2026-10-31): «Sí, Material».** Material genera el Excel y lo lee de vuelta; Monitoreo tiene la lista y compara | ☑ Decidido |
| C3 | Leer de vuelta el Excel llenado (asignación y reasignaciones) | `POST …/territorial/asignacion/importar` (lectura pura) + el PUT de la asignación; botón «Subir Excel llenado» | ☑ Hecho, en verificación de Gonzalo. Lee la etiqueta, el código suelto o el nombre; reporta por fila lo que no reconoce; avisa si el Excel es de otra muestra; lee también el Excel operativo viejo. En vivo: 149 de 150 titulares leídas, la fila con un nombre ajeno señalada, 298 UMP guardadas y el Excel regenerado con todo escrito. Sólo se lee el encuestador |
| C4 | El selector de encuestador dentro de la app (I3) | Material › Entrega, `AsignacionEquipo.tsx` | ⛔ Bloqueado: si C1 y C3 se hacen, queda como respaldo para el analista o se retira. Decide Gonzalo |
| C5 | La hoja de seguimiento de viviendas: comparar con la ficha que genera la app | Formato de campo: Word en la carpeta de acogida. App: ficha de Material | ☐ Pendiente: comparar sección por sección (códigos de resultado 1–8 y 99, columnas) |
| C6 | La hoja de consolidados: comparar con lo que genera la app | Formato de campo: Word. App: el PDF de consolidado | ☐ Pendiente: igual que C5 |
| C7 | El «Estado» por encuesta que llena campo frente al avance que Monitoreo ya calcula desde Kobo | Monitoreo territorial (su sesión) | ☐ Pendiente: aclarar si el Excel lo lleva o lo deja a Monitoreo |
| C8 | El Excel del barrido telefónico (RMS) | Monitoreo telefónico, otra sesión (`docs/qa/checklist-monitoreo-telefonico-rms-2026-10-22.md`) | ↗ Fuera de esta sesión: se avisa a Meta B |

## Notas

- La lista de encuestadores que campo maneja («codigos_pulso_encuestadores-VF», con código PULSO) es la misma pieza que
  Monitoreo carga como `enumerator_roster`. Eso respalda «la de Monitoreo» de I3: el desplegable del Excel saldría de
  ahí y la lectura de vuelta casaría por código.
- Al subir un Excel de prueba con P101…P104, Monitoreo guardó P320, P270, P229 y P220 con los mismos nombres. Es del
  importador de Monitoreo y queda para su sesión.
