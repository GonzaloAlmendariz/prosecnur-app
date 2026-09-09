# Checklist — que el operativo se actualice solo con dos clics (2026-09-09)

La tanda de indicaciones de Gonzalo del 9 de setiembre, jornada 3 del operativo
HSVG2026. Un ítem por indicación, cada uno con **dónde vive** y su estado. Sólo
él lo da por terminado.

Continúa `operativa-aulas-dos-sheets-y-la-app-2026-09-08.md`, que describe los
dos documentos y sus dueños. Aquí está lo que se arregló para que la app los
entienda sin ayuda.

| # | Indicación (textual) | Dónde vive | Estado |
|---|---|---|---|
| 1 | «ya autoricé, corre el script de AULA UTILIZADA» | libro vivo, edición directa | ☑ 12 columnas por hoja, cuerpo vacío, 0 celdas distintas contra el respaldo |
| 2 | «lo apruebo, pero es algo que lo hace el coordinador de campo» | `carga_aulas_libro_formato.R` | ☑ `e8470c57` — la columna sale blanca, no gris |
| 3 | «mejorar la tabla de Producción por aplicador para que sea más entendible» | `carga_aulas_libro_avance_columnas.R` | ☑ `493c8e22` — «Diferencia de tasa», intercalada |
| 4 | «el sheets es el que manda ahora, tiene la versión última» | `monitoreo_aulas_publicar_adopcion.R` | ☑ `8650fa3f` — publicar adopta antes de rehacer Asignación |
| 5 | «la app debe ser robusta en entender esos cambios [manuales]» | ídem + `81e1835d` | ☑ el ensayo ya recuerda el enlace; armar la red no exige escribir |
| 6 | «haz que la fuente herede el servidor de su perfil» | `monitoreo_fuente_servidor.R` | ☑ `7aad68af` |
| 7 | «haz la UI más intuitiva para… actualizar el sheets de distribución y el sheets operativo» | `AulasDosSheets.tsx`, `AulasOperationsPanel.tsx` | ☑ `7aad68af` + `23274551` |
| 8 | «avance de agendación es una hoja que va después de aulas agendadas» | `monitoreo_aulas_publicar_libro.R` | ☑ `2b3da50c` — nace pegada a su fuente |
| 9 | «una tabla al inicio que diga cuántas agendadas en total… titulares y reemplazos» | `carga_aulas_libro_agendacion.R` | ☑ `2b3da50c` — bloque «Cuánto se lleva agendado» |
| 10 | «necesito ver cómo queda el sheets nuevo» | libro vivo | ☑ publicado 13:23Z con 730 respuestas |
| 11 | Republicar con la hora de hoy | libro vivo | ☑ «Avance de campo» pasó de 494 (ayer 14:34) a 642 (hoy 08:22) |
| 12 | Dejar el `.pulso` armado para que él siga | — | ☐ **esperando su sí**: exige reinstalar el paquete con su app corriendo |

## Las tres averías que esta tanda destapó, y que no se veían

**1. Dos verdades publicadas sobre quién va a qué aula.** La hoja «Asignación de
aplicadores» del libro contradecía a la de los 22 aplicadores en **38 de 85
aulas**, 32 de ese día en adelante y 13 de ese mismo día. Causa: el `.pulso`
nunca había adoptado la hoja, así que `reparto_fijado` estaba vacío y cada
cálculo volvía a sortear desde cero. Con las fijaciones, el reparto coincide
**86 de 86**; sin ellas, 11 de 84. Tras publicar, verificado: 86 de 86.

**2. «Sincronizar campo» no sincronizaba.** Sólo recalculaba con el snapshot que
ya estaba en la sesión. Dos jornadas devolviendo las mismas cifras de la víspera
sin nada en pantalla que lo dijera. La descarga vive en `POST
/api/monitoreo/sync`, que es un job. Ahora el botón se llama «Traer respuestas»
y hace las dos cosas, en ese orden.

**3. El proyecto apuntaba a un perfil de Kobo borrado.** Cuando los secretos
dejaron de descifrarse el 08/09 a las 20:50, Gonzalo volvió a autorizar y la app
creó `pulsoeu_b87d662e`; el proyecto seguía nombrando `koboeu_6a68725e`. La
conexión estaba bien y el token descifraba: sólo la fuente señalaba a un perfil
muerto. Repuntada, el proyecto pasó de 579 a **730 respuestas**.

## Lo que queda de él, no del código

- **CH 12 y CH 74** siguen citados el 07/09 en la hoja de aplicadores con su
  agenda ya movida al 14/09 y al 09/09. Son filas suyas; la app las dice en el
  recibo («2 citas escritas ya no tienen su aula agendada ese día») y no las
  toca.
- **Cinco citas sin aplicador**: CH 40, 82, 69 y 133 el 11/09, y CH 83 el 12/09.
- **El parte de CH 113** sentado en la fila de CH 111.

## Trampas de medición que costaron una vuelta

- La hoja publicada tiene **una fila por aplicador y día**, con los códigos
  listados en «CURSOS-HORARIO DEL DÍA». Keyear por esa celda entera da 0
  comparables y parece que no hay problema.
- El aviso **«(fuera de su disponibilidad declarada)»** va pegado al nombre: sin
  quitarlo, 38 falsas discrepancias que son la misma persona.
- **`.alpa_txt()` es escalar** (hace `[1]`): pasarle un vector lo colapsa a su
  primer elemento en silencio.
- **`monitoreo_aulas_disponibilidad` ES la lista de personas**, no un objeto con
  `$personas`. Preguntarle por ese campo deja el roster vacío y la adopción cae
  a «5 de 86» con todos los nombres «no reconocidos».
- Comparar cifras derivadas **sin redondear**: redondear las tres columnas por
  separado y luego restar dio un falso negativo.
- En Sheets, la fecha del «Plan del día» es **texto ISO a propósito**: su propio
  selector filtra con `TEXT($B$1;"yyyy-mm-dd")`. El bug del mes/día era del xlsx.
