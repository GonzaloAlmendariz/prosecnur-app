# GOAL · Refuerzo y complemento en Monitoreo › Cursos-horario

Tipo: Registro de goal loop
Estado: En curso
Fecha: 2026-09-10
Autoridad: Encargo de Gonzalo; objetivo de trabajo, no certifica por sí solo el estado del módulo

Registro duradero del loop indefinido abierto por Gonzalo el 2026-09-10. El
encargo vivo (`ENCARGO_LOOP.md` del scratchpad) apunta aquí y sólo conserva el
tablero, la vara y lo que está en curso.

## La vara

> «asegúrate que la sección consultas (o donde conceptualmente sea mejor)
> tengamos una sección que, en base al rendimiento y la efectividad de cada
> facultad podamos plantear ver cómo reforzar algún CH muy bajo o complementar
> con aulas disponibles alguna facultad que le esté yendo mal en hombres o en
> mujeres o en ambos con el mejor postor».

## Las tres lecturas de una cuota

Decisión suya (2026-09-10): **las tres se publican y se enseñan juntas**, no se
elige una. «No se resuelve eligiendo una, se resuelve enseñándolas juntas y
diciendo cada una de qué universo habla».

| | Qué mide | Para qué |
|---|---|---|
| (a) `proyeccion` | todo el plan × tasa del diseño | el TECHO: ¿alcanza el plan? |
| (b) `proyeccion_agendada` | sólo lo que tiene fecha × tasa del diseño | lo COMPROMETIDO |
| (c) `proyeccion_agendada_observada` | lo agendado × tasa observada | lo comprometido corregido por el campo |

`factor_de_campo` es la calibración logrado/previsto **encogida hacia 1**
(`.MAC_ENCOGIMIENTO = 60`): con poco observado manda el diseño, y a medida que
el campo acumula manda el campo.

## Medición del 2026-09-10 (30 celdas, 1 353 respuestas, libro releído 15:35)

- **(a) 0 celdas cortas · (b) 6 · (c) 5.**
- Las seis, cuota/agendado: DERECHO F 237/173 · DERECHO M 126/111 · PSICOLOGÍA F
  57/50 · PSICOLOGÍA M 18/13 · CIENCIAS Y ARTES DE LA COMUNICACIÓN F 54/54 ·
  ESTUDIOS GENERALES LETRAS M 157/153 — la única que sí llega con (c), 160,
  porque su `factor_de_campo` es 1,08.
- **Las seis tienen techo por encima de su cuota**: son faltas de AGENDA, no de
  aula. El remedio es una llamada, no el banco de reservas.

## Etapas

| # | Etapa | Estado | Commits |
|---|---|---|---|
| E1 | Por qué el panel de refuerzo estaba apagado | cerrada | — |
| E2 | Las tres proyecciones, medidas | cerrada | — |
| E3 | La proyección contaba dos veces lo aplicado | cerrada | — |
| E4 | Arreglo del doble conteo | cerrada | `b675f908` |
| E5 | Medición por el pipeline real | cerrada | — |
| E6 | Decisión: las dos lecturas, no una | cerrada | — |
| E7 | El motor publica las tres | cerrada | `fb6168ae` |
| E8 | La superficie y la contradicción | cerrada | `43aceae4` `3aabb459` |

### E8, en detalle

- **La contradicción era la ETIQUETA, no el cálculo.** `estado` mide el plan
  entero —lectura legítima, es el techo— pero decía «Va a llegar, con margen» en
  seis celdas que no llegan con lo agendado. Ahora nombra su universo: «Llega
  con todo el plan, con margen».
- **La puerta de `reserva_dirigida` NO cambia** (descartado a propósito).
  Abrirla con (b) o (c) mandaría al banco seis celdas cuyo remedio es agendar.
  Que publique cero es correcto. Vive en `monitoreo_aulas_reserva_dirigida.R:182`.
- **El mejor postor ya usa el campo**: `tasa_aula` recibe el `factor_de_campo`
  de la celda. Sin factor medible cae a la tasa del diseño.
- Verificado en pantalla: el panel «Qué grupos no llegan» lista las seis y las
  seis dicen «agendar».

## El operativo, tal como quedó el 2026-09-10

### Los dos Sheets y sus dueños

- **Libro del operativo** `11HV4-gmCGMfnWSczkkuO1f3yD0xG_wlwSh2jQtVrdPc`.
  Cuatro hojas del equipo (`respetada`, jamás se escriben) y seis de la app.
- **Distribución de aplicadores** `1-NmlPFRhq2G-JgNNEh_kOSFnZeTLKzpw9DrbZyCOBmE`,
  una pestaña «Semana 1», 96 citas.

### El ciclo diario

`POST /api/monitoreo/aulas/sincronizar-distribucion` es la acción única: lee la
hoja, dice qué adoptaría, **añade** las agendadas sin cita, refresca el estado y
dice cuántas quedan sin aplicador. **Ensayo por defecto**; `aplicar: true` es el
acto. No reasigna, no mueve una fila y no borra ninguna. La ventana por defecto
es el rango del reparto (2026-09-07 → 12, Semana 1).

**Nunca publicar sin adoptar antes**: con `reparto_fijado` vacío el sorteo
rebaraja, y medido ese día habría cambiado el aplicador de **75 de 90** citas.

### Dos vocabularios, y es correcto que sean dos

- **Distribución** (`MONITOREO_AULAS_ESTADOS_DISTRIBUCION`, 7): POR APLICAR ·
  APLICADA · APLICADA POR REAGENDACIÓN · REAGENDADA · RECHAZADA · APLICADA SIN
  AGENDACIÓN · POR APLICAR SIN AGENDACIÓN.
- **Libro, STATUS DE APLICACIÓN** (`aulas_libro_status_aplicacion_de()`):
  titular = POR APLICAR · APLICADA · APLICADA POR REAGENDACIÓN · NO APLICADA ·
  REEMPLAZADA POR · COMPLEMENTADA CON; la reserva cambia las dos últimas por
  APLICADA DE REFUERZO.

### Quién escribe el ESTADO

«APLICADA» **no es de la app**: el coordinador la elige en el chip desplegable,
y suele hacerlo antes de que llegue el parte. Regla suya del 2026-09-09: «la
celda escrita se conserva SIEMPRE; la app sólo siembra la vacía». Ni siquiera se
asciende: un ascenso también es escribir encima. Lo único que la app repara es
la **grafía** (tildes) de un estado declarado.

Nació de un daño medido: cuando la app proponía estados, CH 111 y CH 82
—agendadas para el viernes 11 y con cero respuestas— salieron APLICADA porque un
parte estaba tecleado en la fila de al lado.

## Cómo leer esos Sheets sin la app

`/api/monitoreo/sheets/inspect` sólo devuelve la primera fila del rango. Para
los valores:

```r
pkgload::load_all("api")
id  <- "<spreadsheet id>"
url <- paste0(prosecnurapp:::.monitoreo_sheets_api_base(id), "/values/",
              utils::URLencode("'HOJA'!A1:BZ400", reserved = TRUE))
prosecnurapp:::.monitoreo_google_api(url)$values
```

## Lecciones de la jornada

- **«Traer respuestas» PUBLICA.** Llama a `/aulas/sync`, que devuelve
  `monitoreo_aulas_sync_payload()` y con `libro_sheets` recordado lee y
  **re-publica**. Para actualizar sin publicar: «Leer del Sheets».
- **Buscar la guarda antes de avisar de un borrado.** Avisé de que publicar la
  distribución borraría el trabajo del equipo; ya existía
  `E_AULAS_DISTRIBUCION_CON_DUENO` y se habría negado.
- **Antes de añadir a una lista cerrada, mirar la validación real de la hoja
  donde va a vivir.** Deduje «NO APLICADA» del libro y la metí en el vocabulario
  de la distribución, donde no iba.
- **Un espacio de menos pierde una encuesta.** «CH164» contra «CH 164» del plan:
  el aula aplicada sin agendación no contaba y nada decía por qué.
  `.cm_aulas_codigo_operativo()` ya normalizaba y el ciclo no lo llamaba.
- **Caber no es no pisarse.** Verifiqué un eje midiendo sólo el recorte; los
  rótulos cabían enteros y se montaban unos sobre otros.
- **El vocabulario crece y el pintor se queda atrás.** Pasó con «REEMPLAZADA
  POR» y con «POR APLICAR». Hay guarda: un test exige regla de color para cada
  valor del desplegable, preguntando al pintor, no leyendo el archivo.
