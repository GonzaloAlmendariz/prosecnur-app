# Checklist — consistenciar el operativo de aulas (dictado 2026-09-12)

Dictado de Gonzalo, textual en lo que decide cada ítem: «me gustaría que todo
esté bastante consistenciado». Nueve indicaciones. Se marca conforme se cierran
y **sólo él lo da por terminado**. Cada vez que se mencione, se dibuja entero.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| C1 | «Avance de agendación» debería considerar las aulas **extra** agendadas | `carga_aulas_libro_agendacion.R` `.calan_total`, `.calan_facultad`, `.calan_semana`, `.calan_dia` | ◐ medido |
| C2 | La jerga de la columna **«Slots»** no es buena | `AULAS_AGENDACION_CABECERAS$facultad` + su nota al pie | ☐ |
| C3 | ¿La agendación considera el estatus nuevo **«REFUERZO POR CONTACTAR»**? ¿Es robusta ante estatus nuevos? | `carga_aulas_libro_formato.R` (`STATUS_MUESTRA_BASE`), `.calan_ejes` | ☐ |
| C4 | ¿«Aulas Aplicadas (Campo)» y «(Extra)» **pintan** las aulas pedidas como refuerzo? | `monitoreo_aulas_sheets_formato.R` | ☐ |
| C5 | El **morado** del refuerzo no se ve en STATUS MUESTRA | idem C4 + `respetada` por hoja | ◐ causa identificada |
| C6 | **«Plan del día» sigue con el `#REF!`** — que se solucione | `monitoreo_aulas_plan_dia_selector.R` (arreglado en código) | ◐ falta ejecutarlo |
| C7 | «Asignación de aplicadores» más clara, y sobre todo la **producción por aplicador**: quién aplica más y menos, en qué rangos horarios, cuánto en horario regular y cuánto en especial (noche / mañana) | hoja nueva del libro | ☐ |
| C8 | **Disponibilidad de aplicadores**: añadir los **disponibles por semana** (la 1 tenía ~21–24; ahora menos) | `carga_disponibilidad_aplicadores` + su hoja | ☐ |
| C9 | ¿La app hace la distribución **por semana a partir de una lista dada**, nombrándola «Semana N»? | `monitoreo_aulas_distribucion_semanas.R`, `monitoreo_aulas_publicar_distribucion.R` | ◐ medido |

Leyenda: ☐ pendiente · ◐ en curso / medido sin cerrar · ☑ cerrado · ⛔ bloqueado
(espera decisión suya).

---

## Lo medido hasta ahora, por ítem

### C1 · las extra en «Avance de agendación»

**La app ya las contempla, pero sólo aparecen cuando existen.** La tabla total
lleva una fila «De reservas extra» — y está dentro de un
`if (any(extra))` (`.calan_total`), así que hoy no sale: **de las 45 filas de
«Aulas Agendadas (Extra)» del operativo, 0 tienen FECHA AGENDADA** (9 «REFUERZO
POR CONTACTAR», 36 «SIN CONTACTAR»). Es decir, lo que él ve no es un olvido: es
que todavía no hay ninguna.

Lo que sí es un defecto es la condición: **una fila que aparece y desaparece no
distingue «ninguna agendada» de «no se miran»**, que es exactamente la duda que
él tuvo. Este repo ya aplica la regla contraria en otros recibos («un cero se
dice, no se omite»).

Y las extra **no cuentan como «Slots»** a propósito y con razón documentada: no
reemplazan a nadie, y contándolas DERECHO salía con 61 slots donde el diseño le
puso 19. Eso se queda. Lo que falta es que se **vean** en su propia columna en
las tablas por facultad, semana y día, donde hoy sólo hay «De titulares» y «De
reemplazos» — y su respuesta a «¿o las estás metiendo en reemplazos?» es **no,
no están en ninguna de las dos**.

### C5 · por qué no se ve el morado

**La regla existe y es la primera de la lista** (`.mafs_REGLAS_STATUS_MUESTRA`,
`#F0E9F7` sobre `#5B2E86`, puesta el 2026-09-11 por su «que sea como de un
morado especial»). No se ve por otra razón: **«Aulas Agendadas» y «Aulas
Aplicadas (Campo)» son hojas del equipo y vuelven `respetada`**, y una hoja
respetada **no recibe formato nuevo** — sólo se le reenvía cuando cambia de
geometría. Los colores y desplegables nuevos se quedan en la app.

Eso convierte C4 y C5 en el mismo problema, y su solución es una decisión suya:
o el formato viaja aunque la hoja sea respetada (escribe formato, nunca
valores), o se acepta que esas dos hojas no se pinten.

### C6 · el `#REF!`

El diagnóstico está cerrado con el mensaje literal de Google: es un **resultado
cacheado** de un estorbo que ya no existe (B4 vacía, sin merges ni rangos
protegidos, 18 filas para una reserva de 24). `FILTER` no es volátil y abrir el
documento no recalcula. El arreglo está en código (`32030b5b`): al ver un error,
el publicador vacía la celda y vuelve a ponerla. **Falta ejecutarlo contra el
documento**, y eso es una escritura en el Sheets del operativo.

### C9 · una pestaña por semana desde una lista dada

**Sí lo hace, desde `a8d761ee` + `83d98403`.** El kit es
`monitoreo_aulas_reparto_por_semana()` + `.mads_hoja_para_semana()`, las semanas
se anclan al lunes de la primera aula agendada del plan, y el publicador escribe
**una pestaña por semana** respetando las que ya existen. Así se publicó
«Semana 2» del operativo con los 19 aplicadores sin Brenda.

Lo que queda por comprobar es **desde dónde se pide**: que la pantalla permita
elegir el roster y la semana sin pasar por una llamada a la función.
