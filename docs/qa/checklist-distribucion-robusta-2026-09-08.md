# Checklist — el ciclo de la distribución, sin scripts míos

Tipo: Checklist de pedido
Estado: En curso
Fecha: 2026-09-08
Autoridad: Pedido de Gonzalo. Evidencia de QA; no reemplaza un ADR

Pedido de Gonzalo (2026-09-08): **«Dejemos todo el proceso robusto para tapar el
agujero»**, dicho después de que `publicar-distribucion` resultara capaz de
borrar de un request los 33 cambios de aplicador y las tres reagendaciones que
el coordinador llevaba escritas en el Sheets.

El agujero no es sólo la sobrescritura. Es que **dos de los cuatro pasos del
ciclo se hacían con scripts míos fuera de la app**: añadir las filas de las
aulas agendadas a las que no iba nadie, y refrescar la columna ESTADO desde
plataforma. Mientras vivan en el scratchpad, el ciclo depende de que yo esté en
la sesión.

El ciclo, en el orden que él dictó: **la app PROPONE → el coordinador DISPONE →
la app ADOPTA → la app AÑADE**. La regla que lo mantiene estable: *una fila que
ya existe no se vuelve a proponer; la app sólo añade lo que falta y actualiza lo
que puede demostrar*.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| A1 | Publicar no puede borrar la hoja con dueño | `monitoreo_aulas_publicar_distribucion.R` · `E_AULAS_DISTRIBUCION_CON_DUENO` | ☑ commit `fae68099` |
| A2 | Detectar las aulas agendadas que no tienen fila en la distribución | `monitoreo_aulas_agendadas_sin_cita()` | ☑ `eb8b42d6` |
| A3 | Añadirlas en su sitio del día, con el aplicador en blanco | `monitoreo_aulas_posiciones_de_las_nuevas()` | ☑ `eb8b42d6` |
| A4 | Refrescar ESTADO desde plataforma sin pisar lo que el equipo tecleó | `monitoreo_aulas_estados_distribucion()` | ☑ `eb8b42d6` |
| A5 | Una sola acción que encadene leer → adoptar → añadir → estado, con ensayo por defecto | `monitoreo_aulas_sincronizar_distribucion()` | ☑ `eb8b42d6` |
| A6 | Endpoint HTTP, registro en `plumber_app.R` y sus `E_*` | `POST /api/monitoreo/aulas/sincronizar-distribucion` | ☑ `eb8b42d6` |
| A7 | Tests del área y gate verde | 7 666 asserts, 0 fallos | ☑ |
| A8 | El doc operativo dice el ciclo con la acción única dentro | `docs/qa/operativa-aulas-dos-sheets-y-la-app-2026-09-08.md` | ☐ |
| B1 | La fila nueva entró fuera de orden: «hay que estar en oficina a las 9:20, ¿no debería ir después de CH 161?» | `.madm_minutos()` en el motor + fila movida en vivo | ☑ |
| B2 | «Rompiste formatos que antes estaban bien»: fechas como seriales y % de asistencia como decimal | reparado en vivo (0 diferencias contra el respaldo) + el motor ya declara el formato | ☑ `a879a12f` |
| B3 | «Todo lo que Aulas Aplicadas jala de Aulas Agendadas lo jala sin formato de color» | `monitoreo_aulas_sheets_formato.R` · se aplica en la próxima publicación del libro | ☑ `a879a12f` |
| B4 | Rendimiento por facultad: lo mismo desglosado por sexo, más la meta y la meta por sexo, con las columnas **intercaladas** y no las metas al final | `carga_aulas_libro_avance_rendimiento.R` + vocabulario | ☑ `de9fca42` |
| B5 | «Tabla dinámica 2» pasa a ser una hoja que produce la app desde lo agendado: titulares **y reemplazos**, cuántas agendadas, de ésas cuántas aplicadas, la agendación por día, las titulares pendientes de agendar, los rechazos y los rechazos que ya agendaron reemplazo | motor `aulas_libro_agendacion()` ☑ `941226da` · **falta la pestaña** (xlsx, Sheets y formato) | ◐ |
| B7 | En esa misma tabla, la relación de aulas agendadas **por semana**: la semana 1 es del 7 al 11 de septiembre y **los domingos no cuentan** | motor ☑ `941226da`, con la semana de LUNES A SÁBADO · **pendiente de confirmar** si el sábado 12 entra en la semana 1 | ◐ |
| B6 | «En Aulas Agendadas no está la columna para decir si un docente ya recibió correo» | **ya existe**: `RECIBIÓ CORREO`, columna K del bloque titular y una por eslabón (AI, BG, CE…) | ☑ nada que construir |

## Lo aprendido que no se debe reinvestigar

- **Una hora se compara en MINUTOS, jamás como texto.** El equipo teclea «8:30»
  sin el cero, y como texto «8:30» es MAYOR que «09:20». La fila de las 09:20
  entró casi al principio del miércoles por eso.
- **Verificar los valores no verifica lo que se ve.** La migración a orden por CH
  se comprobó celda a celda contra el respaldo y dio cero diferencias… en el
  render de FÓRMULA. En el render MOSTRADO había 243 celdas rotas: las fechas
  habían quedado como TEXTO con el número de serie dentro («46273»), y ninguna
  cantidad de `numberFormat` arregla un texto. La comparación tiene que hacerse
  sobre lo que el usuario lee.

- **La pestaña se localiza por su CABECERA, no por su nombre.** El documento del
  operativo la tiene llamada «Semana 1» y la app publica «Plan del día»
  (`.madc_pestana_de_la_distribucion()`).
- **La FECHA de la hoja es `dd/mm` sin año** (`.alpa_dia_y_fecha()`), y el plan
  la trae ISO: comparar sin convertir da diferencias inventadas.
- **La rejilla de la pestaña hay que ensancharla antes de escribir** en una
  columna nueva, o el PUT rebota con «exceeds grid limits» sin tocar nada.
- **Las filas nuevas heredan formato con `insertDimension` + `inheritFromBefore`**;
  escritas al final del rango salen sin desplegable ni color.
- **Sólo entran las que la agenda declara agendada o reagendada.** El plan trae
  `scheduled_time` aunque nadie haya cerrado el acuerdo —cae al horario del
  catálogo—, y mandar a alguien por esa hora es mandarlo a una clase que el
  docente no confirmó.
