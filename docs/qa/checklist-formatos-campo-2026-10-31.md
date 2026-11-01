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
| C5 | La hoja de seguimiento de viviendas (hoja de ruteo): comparar con lo que genera la app | `api/R/collection_territorial_papel.R` (`POST …/territorial/papel`, pieza `ruteo`); Material › Catálogo › Hoja de ruteo y Paquetes. Códigos en `collection_territorial_formatos.R` (Catálogo › Códigos de resultado). La Hoja del día perdió su grilla (D2a) | ☑ Hecho, en verificación de Gonzalo (D1 y D2(a) aprobados el 31 oct). Vertical, 1 o 2 caras, 30 filas por cara, leyenda de códigos del estudio, columna del criterio, cabecera con el encuestador asignado. Commits e1453fd2e, b61a14de3, c7952818e. Falta verla con el backend relanzado |
| C6 | La hoja de consolidados: comparar con lo que genera la app | `collection_territorial_papel.R` (pieza `consolidados`); Material › Catálogo › Hoja de consolidados y Paquetes | ☑ Hecho, en verificación de Gonzalo. Apaisada: ocurrencias por código con total no aplicadas, efectivas e intentos; registro de encuestados ya numerado con los cuestionarios de la UMP; observaciones |
| C7 | El «Estado» por encuesta que llena campo frente al avance que Monitoreo ya calcula desde Kobo | Monitoreo territorial (su sesión) | ⛔ Bloqueado: decide Gonzalo si el Excel de asignación lleva el Estado. Hoy la importación sólo lee el encuestador y no guarda estado ni fechas. Monitoreo (31 oct) pide, si se guarda, que el GET de asignación exponga por UMP `estado_declarado`, las fechas y el estado por encuesta con la misma huella de muestra; lo cruzaría con Kobo como contraste, sin moverlo al avance |
| C8 | El Excel del barrido telefónico (RMS) | Monitoreo telefónico, otra sesión (`docs/qa/checklist-monitoreo-telefonico-rms-2026-10-22.md`) | ☑ Revisado por la sesión «ACNUR RMS» (31 oct): propuesta de plantilla en la §6 del informe fuera del repo (`Documents/Pulso/01_Estudios/2026_ACNUR_RMS/Revision_barrido_RMS_2026-10-31.md`; trae datos personales, no copiar filas). Insumo de la etapa 4: hoja única con la cola idéntica (Responsable, Status, Teléfono, Intentos, Fecha), pestaña «Listas», Tanda aparte, llave y encabezados protegidos en todas las filas, códigos por Status; no romper lo que Monitoreo lee (proGres, Periodo de Llegada, Status, Responsable, Intentos, Fecha) |

## Comparación C5/C6 (2026-10-31)

El juego de papel de PULSO para campo territorial tiene tres piezas por UMP. Ser Adolescente (octubre) las tiene ya con
la marca PULSO; acogida (junio) usó las dos últimas en Word.

| Pieza | Qué lleva | ¿La genera la app? |
|---|---|---|
| Ficha de trabajo de campo | Datos generales, cuota de sexo y edad, esquema de recorrido, salto, procedimiento ante la no respuesta, mapa | ☑ Sí: es la ficha de Material (la que campo usó en acogida) |
| Hoja de ruteo (seguimiento de viviendas) | Cabecera: distrito, ámbito, encuestador, fecha, UMP, hoja n.º. Leyenda de **códigos de resultado**. Tabla de ~50–80 visitas: dirección, n.º, resultado, nombre, edad, sexo y la variable de elegibilidad del estudio (p. ej. «Cursa estudios sup.») | ☐ No. La «Hoja del día» trae una grilla por ruta con disposiciones **inventadas** (Completa / Rechazo / Ausente / Desocupada / No elegible) que no coinciden con los códigos de campo |
| Hoja de consolidados | La misma cabecera. **Ocurrencias del recorrido**: conteo por código, total no aplicadas, efectivas y total de intentos. **Registro de encuestados**: n.º de cuestionario, nombre, edad, sexo, variable del estudio, dirección completa, teléfono, hora de inicio (acogida: también NSE y hora final) | ☐ No |

**Códigos de resultado.** Hay un núcleo común y tres posiciones que cambian por estudio:

| Código | Acogida (ACNUR) | Ser Adolescente |
|---|---|---|
| 1 | No quería participar | No quiso participar |
| 2 | Vivienda abandonada / sin vivencia / inaccesible | Vivienda desocupada |
| 3 | Miembros del hogar migrantes o refugiados | Vivienda inaccesible |
| 4 | Miembros del hogar ausentes | Nadie en casa |
| 5 | No cumple criterios de selección | No hay persona de 18 a 25 años |
| 6 | Fuera de cuota (sexo, edad) | Fuera de cuota (sexo o perfil) |
| 7 | Encuesta inconclusa | Encuesta inconclusa |
| 8 | Encuesta efectiva | Efectiva |
| 99 | Manzana no elegible (terreno, parque) | — |

Con esos códigos se miden la respuesta y la ocupación reales (lo que la grilla de la Hoja del día quería medir).

### Decisiones para Gonzalo

- **D1.** Que Material genere la **hoja de ruteo** y la **hoja de consolidados** por UMP, con la cabecera ya llena (distrito,
  UMP, rango de encuestas y el encuestador asignado del Excel C1) y un **catálogo de códigos de resultado por estudio**:
  núcleo fijo (1, 4, 6, 7, 8) y los rótulos de 2, 3 y 5 (y el 99) editables, más la variable de elegibilidad del
  estudio como columna. Recomendado: sí; es el juego que campo ya usa y hoy se hace a mano en Word.
- **D2.** Qué hacer con la **Hoja del día**: (a) dejarla como portada de la jornada (orden de rutas, km, reemplazos) y
  quitarle la grilla de disposiciones, que la hoja de ruteo reemplaza con los códigos de campo; (b) retirarla. Recomendado: (a).

## Lectura desde R del Excel por variante (2026-11-01)

openpyxl no abría el archivo; se leyó con `openxlsx` desde R. Se generó el Excel real de acnur_acg (300 UMP, 26
encuestadores) en las dos variantes, sobre una copia sin guardar (`load_pulso` + envío + campaña en memoria; la 1A con
el Planner simulado en `conveniencia`). Se contrastó contra la tabla A1–A10 y el §1C del informe de brechas. Gonzalo
(1 nov): «manda el formato, pero desde la app podemos mejorarlo».

| Brecha | 1B UMP aleatoria | 1A conveniencia | Estado |
|---|---|---|---|
| A1 Pestañas | `Asignación`, `Registro` (una región: Lima), `Encuestadores`, `Control` oculta | Igual, con el Registro titulado «Seguimiento de campo» | ☑ coincide |
| A2 Encuestador | Desplegable «Pxxx · Nombre» desde la lista de Monitoreo; en el Registro es fórmula que lee la Asignación | Igual | ☑ coincide |
| A3 Avance por celda | «La muestra enviada no trae cuotas por ficha»: una sola columna «Efectivas» | Igual | ◐ es del dato, no del motor: el sorteo de las copias de acnur_acg es el reparto por zonas v1 y no trae `cuota_*_totals` por ficha. Con un re-sorteo aparecen las celdas (lo cubre `test-collection-territorial-registro.R`) |
| A4 Estado | Manual en la Asignación (Pendiente, En campo, Finalizada, Reemplazada, Anulada); el Registro no trae Estado | Fórmula «Sin iniciar / En curso / Completa» en el Registro | ⛔ decidir: en 1A el Estado por fórmula es el del formato real, pero el límite Material/Monitoreo del 31 oct dice que la plantilla no trae «un Estado que compita con el de Monitoreo» |
| A5 Totales | Total efectivas, Faltan para la meta y Total de intentos como ayuda de llenado | Total efectivas, Faltan y «Total reportado por coordinación» | ☑ coincide |
| A6 Supervisión | Aprobadas / No aprobadas en blanco | Igual | ☑ coincide |
| A7 Fechas | Asignación: «Fecha de salida» y «Fecha de entrega»; Registro: «Fecha de visita» | Igual | ☑ (este commit) la Asignación dice «Fecha de retorno», como el real; un Excel ya repartido con «Fecha de entrega» se sigue leyendo. El campo del GET sigue siendo `fecha_entrega` (lo consume Monitoreo) |
| A8 Reporte | No hay pestaña Reporte | No hay | ☑ coincide (es de Monitoreo) |
| A10 Reemplazos | Fila bajo su titular, con «Reemplaza a» y «¿Se reemplaza?» | Sin «¿Se reemplaza?» | ☑ coincide |
| P2 / K1 Códigos | 1–7 y 99 como «no efectivas por código»; rótulos del catálogo de Material, editables también en el núcleo | Sin columnas de código | ☑ coincide. Los rótulos salen por defecto (2 «Vivienda desocupada», 5 «No hay persona elegible») porque acnur_acg no tiene su catálogo de acogida cargado: es configuración del proyecto, no del motor |

## Notas

- La lista de encuestadores que campo maneja («codigos_pulso_encuestadores-VF», con código PULSO) es la misma pieza que
  Monitoreo carga como `enumerator_roster`. Eso respalda «la de Monitoreo» de I3: el desplegable del Excel saldría de
  ahí y la lectura de vuelta casaría por código.
- Al subir un Excel de prueba con P101…P104, Monitoreo guardó P320, P270, P229 y P220 con los mismos nombres. Es del
  importador de Monitoreo y queda para su sesión.
