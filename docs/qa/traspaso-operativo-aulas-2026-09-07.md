# Traspaso — operativo de aulas HSVG2026, cierre del día 1

Escrito el 2026-09-07 al cerrar la primera jornada de campo, para la sesión que
siga. Lo que está cerrado va con su commit; lo que queda va con lo que ya se
midió, para no volver a medirlo.

---

## 1. Los documentos vivos, con enlace

### 1.1 Libro del operativo — el que abre el equipo

<https://docs.google.com/spreadsheets/d/11HV4-gmCGMfnWSczkkuO1f3yD0xG_wlwSh2jQtVrdPc/edit>

Nueve pestañas, con **dueño por hoja**. La app lo recuerda en
`aulas_universitarias.libro_sheets` y ahí publica.

| Pestaña | Dueño | Qué pasa al publicar |
|---|---|---|
| **Aulas Agendadas** | EQUIPO | `respetada` — la app NUNCA la escribe |
| **Aulas Agendadas (Extra)** | EQUIPO | `respetada` |
| **Aulas Aplicadas (Campo)** | EQUIPO | `respetada` |
| **Aulas Aplicadas (Extra)** | EQUIPO | `respetada` |
| Base de control | app | se reescribe entera |
| Plan del día | app | se reescribe entera |
| Avance de campo | app | se reescribe entera |
| Asignación de aplicadores | app | se reescribe entera |
| Disponibilidad de aplicadores | app | se reescribe entera |
| *Tabla dinámica 2* | del equipo, no la toca nadie | ni se lee ni se escribe |

La whitelist que decide esto es `monitoreo_sheets_pestanas_controladas()`. **Una
pestaña que no esté en esa lista jamás se escribe**, y ése es el mecanismo que
protege lo tecleado a mano.

### 1.2 Distribución de los aplicadores — el que ellos abren

<https://docs.google.com/spreadsheets/d/1-NmlPFRhq2G-JgNNEh_kOSFnZeTLKzpw9DrbZyCOBmE/edit>

UNA hoja, «Plan del día», de solo lectura para ellos. Sin esperadas, sin
enlaces, sin obtenidas: sólo a qué van. Un color por aplicador (paleta de 22 +
gris para Interno Pulso). Motor:
`monitoreo_aulas_publicar_distribucion.R` + `aulas_libro_plan_aplicadores.R`.

Título en Drive: «Distribución de aplicaicones - Semana 1». La pestaña vieja
«Asignación de aplicadores» ya está borrada (verificado leyéndolo el 2026-09-08).

**Se crea y se lee desde la app** desde el commit `0fd5b984`:

```
POST /api/monitoreo/aulas/crear-distribucion   {"titulo": "..."}
POST /api/monitoreo/aulas/leer-distribucion    {}      # al destino recordado
POST /api/monitoreo/aulas/publicar-distribucion {}     # idem
```

Crear es endpoint aparte a propósito —crear un archivo en el Drive de alguien no
puede ser efecto secundario de otra acción— y **no comparte con nadie**: el
enlace se reparte desde Drive con permiso de lectura, que es decisión del lead.
Leer no escribe: compara lo publicado con el reparto vigente y nombra lo que
falta, lo que sobra y lo que cambió.

**Y lo primero que encontró, el 2026-09-08**: el documento publica 83 citas
contra 85 del reparto vigente, con **20 que cambiaron de aplicador** —4 de ese
mismo día—. Causa: el reparto se recalcula entero y el equipo agendó dos aulas
después de publicar; el motor es codicioso y reordena al crecer la demanda.
**Decisión pendiente del lead**: fijar lo ya publicado (`reparto_fijado`) y
republicar sólo para sumar las dos nuevas —así nadie cambia de aula, que es la
regla suya de que un día confirmado no se mueve— o republicar tal cual avisando
por el grupo. **El motor no lo hizo solo, y no debe.**

### 1.3 Plataforma

- Kobo **EU**: `https://eu.kobotoolbox.org`, perfil de conexión `KOBOEU`
  (`koboeu_6a68725e`).
- Asset: `aNNuP72AedZ886EoAUeV5o` — «HOSTIGAMIENTO SEXUAL Y VIOLENCIA BASADA EN
  GÉNERO EN LA COMUNIDAD PUCP — PREGRADO 2026».
- El token lo puso Gonzalo desde la app. **Nunca introducir credenciales por
  el agente.** El que llegó a pegarse en el chat el 2026-09-07 quedó
  comprometido y debe estar regenerado.

---

## 2. CUIDADO — cómo NO perder lo que se llena a mano

Esto es lo primero que hay que leer. Hay dos bloques de trabajo humano que sólo
existen en el Sheets:

1. **La agendación telefónica** — «Aulas Agendadas»: medio de contacto, fecha de
   llamada, número de intentos, status de llamada, recibió correo, status
   muestra, lugar de aplicación, fecha y hora agendadas, observaciones. Lo llena
   quien llama a los docentes, **en vivo, mientras trabajamos**.
2. **El registro de campo** — «Aulas Aplicadas (Campo)»: aplicador, fecha, hora,
   salón real, asistentes y estado. Lo llena el encargado de campo.

Reglas que no se negocian:

- **Las cuatro pestañas del equipo se respetan siempre.** Si un cambio hace que
  alguna deje de salir `respetada` en el recibo de la publicación, es un
  defecto: parar y arreglarlo antes de publicar.
- **Antes de tocar la agenda, leerla.** Hay alguien agendando en vivo; el estado
  de la app puede estar un rato viejo.
- **Publicar ahora LEE primero** (commit `732c4221`). Hasta ese commit sólo
  escribía, y por eso el día 1 se publicó una Base de control con un parte
  cuando el encargado ya llevaba siete escritos. Si alguien vuelve a separar
  esos dos pasos, ese defecto vuelve.
- **Nunca `force` sobre el Sheets.** Ante conflicto, releer y fusionar.
- El `.pulso` de trabajo es una COPIA
  (`<scratchpad>/HSVG26ULT2_kobo.pulso`); el original del cliente es
  `~/Documents/Pulso/HSTVG2026/Segundo sorteo 27 agosto/HSVG26ULT2.pulso` y no
  se sobrescribe sin pedirlo.

---

## 3. Estado medido al cierre del día 1

Sobre 273 respuestas sincronizadas:

| | |
|---|---|
| Cursos-horario del plan | 174 titulares (+1 173 reservas) |
| Aplicados | **9** |
| Respuestas recibidas | 273 |
| Fuera del operativo (capacitación, prueba) | 37 |
| Efectivas | **212** |
| Cuota del diseño | 2 500 · brecha 2 288 · avance 8,5 % |
| Partes de campo en sesión | 7 |
| Filas de control | 9 |

**Criterio de validez declarado** (decisión de Gonzalo): `inicio/consent_1 = 1`
· `inicio/consent_2 = 1` · `inicio/filtro = 1`.
**Sexo**: `datos_demo/P2`, con `1 = Mujer` y `2 = Hombre` — no se adivinó, se
contrastó el reparto obtenido contra el padrón de la DTI aula por aula (en CH 43
con 44 hombres de 50 y CH 7 con 25 de 30, el código 2 domina).
**Descartes**: `collectorID ∈ {CAPACITACION, CAPATICACION, PRUEBA_2026,
INTERNOPULSO}`.

---

## 4. Lo que quedó cerrado hoy (no rehacer)

| Commit | Qué cerró |
|---|---|
| `1a357240` | `venue` es criterio de aula y el contrato lo dice |
| `f94f5e5d` | el ESTADO del Plan del día cuenta la aplicación, no el circuito |
| `dcc656c2` | Base de control: vocabulario, dos tasas, orden en cinco tramos, se llena desde la plataforma |
| `e82bfeba` | una sola definición de «aula aplicada»; un solo resolvedor de la variable de sexo; la brecha por facultad resta lo conseguido |
| `1e8f020f` | la hoja de avance publicada dice lo mismo que el libro; producción por aplicador desde el reparto |
| `f2564d25` | el bloque de campo se llena sin esperar al parte; la hora es la del salón, no UTC |
| `732c4221` | publicar LEE lo que el equipo escribió antes de escribir lo suyo |

Checklist con los 19 ítems:
`docs/qa/checklist-base-control-2026-09-07.md`.

---

## 5. Lo que queda — por prioridad

### 5.1 Robustez (lo que puede morder mañana)

1. **La hora local está resuelta pero sin fixture a escala.** Hay aulas
   agendadas hasta las **19:30**, que en UTC son las 00:30 del día siguiente.
   Se arregló el orden de columnas (`monitoreo_aulas_hora_local.R`) y hay tests
   sintéticos, pero **todavía no ha entrado ninguna respuesta de una aula
   nocturna**. El martes hay dos a las 19:30: mirar ese día que su fecha de
   aplicación y su renglón del avance diario caigan en el martes.
2. **`ALUMNOS EN AULA` sólo la sabe el parte.** Es la única columna del bloque
   de campo que no se puede derivar, y de ella salen `% ASISTENCIA` y `ALUMNOS
   QUE NO RESPONDIERON`. Si el encargado deja de llenarla, esas tres se apagan
   en silencio. Vale un aviso que lo diga.
3. **El estado del circuito (`operational_status`) sigue sin llegar nunca a
   «aplicada» desde el libro.** Hoy ya no importa porque el predicado compartido
   mira otras tres vías, pero el campo existe y engaña: alguien lo va a volver a
   usar. O se retira del vocabulario o se documenta en un ADR.
4. **`efectivas_pct_esperado`, `elegibles_esperados`, `short_*`, `long_*`,
   `threshold_*`, `valid_*` viven como `solo_lectura`.** Diez campos que se leen
   y no se escriben. Cuando ya no queden libros de 2025 circulando, se retiran.
5. **Cuatro tests en rojo del perfil de aulas, preexistentes**, ya lanzados a
   otra sesión (`task_93fb976e`): dos de textos en `AulasSeccionCalidad.tsx`,
   uno que exige ≥3 gráficos de Plotly y encuentra 1, y el vacío de la cola de
   contacto.

### 5.2 El Excel — estética y lectura

Lo que ya está: cinco tramos con banda de color, rótulos en registro formal,
porcentajes con formato de porcentaje, números tipados, cabeceras que bajan de
línea, anchos por columna.

Lo que falta:

1. **Las notas largas se desbordan.** En «Avance de campo» y en la Base de
   control las notas se escriben en una sola celda de la columna A sin
   `mergeCells` ni `wrapText`: en Sheets se derraman hasta la primera celda
   ocupada y sobresalen del ancho de su tabla. Deberían ir **fusionadas a lo
   ancho del bloque que explican**, con `wrapText` y alto de fila.
2. **La banda de sección no cubre el ancho de su tabla.** «Avance contra la
   meta» pinta `cols = 1:2` sobre una hoja de doce columnas; el subrayado se
   corta a la mitad.
3. **Los formatos del xlsx no llegan al Sheets.** La pestaña se publica en RAW
   más un puñado de requests de formato
   (`monitoreo_aulas_avance_formato.R`): sólo bandas de título y cabeceras. Ni
   anchos de columna, ni congelar la fila de cabecera, ni alineación numérica,
   ni bordes. **Congelar cabecera y fijar anchos es lo que más se notaría** con
   menos trabajo.
4. **La Base de control tiene 43 columnas y ninguna vista corta.** Se lee bien
   de izquierda a derecha, pero para el día a día bastarían las de un tramo.
   Filtros por vista o pestañas por tramo son una opción.
5. **`Efectivas declaradas` sale vacía para quien no rindió parte** y deja la
   fila con un hueco en medio. Es honesto (NA ≠ 0), pero visualmente irregular:
   un «—» explícito se leería mejor.
6. **El «Avance diario» tendrá una fila por día** y la hoja crece hacia abajo
   sin totales. Con dos semanas de campo conviene una fila de cierre.

### 5.3 La app — robustez y estética

Lo que ya está: el embudo con sus mermas separadas por causa, los KPIs con las
tres vías, la tabla de cuotas por facultad y sexo con aplicados reales, el
criterio de validez con lo que cae en cada filtro.

Lo que falta:

1. **`avance_cuota` y `.calaf_avance_por_facultad` siguen siendo dos tablas por
   facultad** que se pintan en la misma sección con reglas propias. Hoy
   coinciden porque se arreglaron las dos, pero la doctrina de este repo —una
   definición por pregunta— pide fundirlas. Es el trabajo que evita el quinto
   sitio.
2. **La declaración del criterio de validez no tiene UI.** `valid_filters`,
   `sex_var`, `sex_female_values`, `sex_male_values` y `descartes` se
   escribieron por API. Fuentes debería dejar declararlos: sin eso, el próximo
   estudio repite el día 1 de éste —contando enviadas como efectivas y con las
   treinta celdas de cuota en cero—.
3. **El aviso de sexo sin decodificar ya dice dónde se arregla**, pero no hay
   dónde hacerlo desde la pantalla. Mismo punto que el anterior.
4. **La vista de Avance tarda ~40 s en el warm start** con el estudio real. Se
   nota y no hay indicación de progreso más allá de «Preparando vista».
5. **`respuestas_total` sigue incluyendo lo descartado** (273 con 37 fuera). Es
   defendible —son respuestas que llegaron— pero la tarjeta no lo dice; el
   embudo sí. Conviene igualarlas.
6. **El recibo de publicación ahora trae `lectura_previa`** y la UI no lo
   muestra. Sería la señal de «se recogieron 7 partes del equipo» justo donde
   hoy no se ve nada.

### 5.4 A medias

- **La distribución de los aplicadores está desactualizada y es la decisión más
  urgente**: 83 citas publicadas contra 85, y 20 cambios de aplicador. Ver 1.2.
- **El reparto no está congelado.** Se recalcula en cada publicación desde el
  plan + la disponibilidad + la config, así que cualquier cita que el equipo
  agende reordena asignaciones ya comunicadas. `reparto_fijado` existe para
  eso y hoy está vacío. Vale la pena que la app avise —«esto va a mover N
  asignaciones ya publicadas»— antes de republicar.
- **El deployment de los QR** quedó con la pregunta abierta de si el QR debe
  llevar el XPath completo. Gonzalo dijo «así está bien» para el lote entregado;
  la decisión de fondo sigue abierta.
- **La comparación parte ↔ plataforma no tiene alerta.** La hoja publica las dos
  cuentas juntas (González Rubio declaró 34 y la plataforma da 72 en sus dos
  aulas), pero nadie avisa cuando difieren mucho. Es el control de campo que el
  bloque existe para dar.

---

## 6. Cómo trabajar con esto

```bash
# backend con la copia de trabajo
PULSO_PORT=8836 PULSO_OPEN_BROWSER=false \
  PULSO_BOOTSTRAP_PROJECT=<scratchpad>/HSVG26ULT2_kobo.pulso \
  Rscript launcher/launch.R
```

- La sesión se resuelve por la cabecera **`X-Pulso-Session`**, no por `?sid=`:
  con el query param el POST abre una sesión nueva y vacía, contesta `ok:true`
  y no persiste nada.
- Un cambio en R **no se ve sin relanzar** el backend.
- Antes de relanzar, `POST /api/project/save` a la copia de trabajo, o se pierde
  lo que haya en sesión.
- Gate del área: `testthat::test_dir("api/tests/testthat",
  filter = "aulas|base-control")` — **210 suites, hoy en cero fallos**.
- Frontend: `pnpm -C frontend exec vitest run src/features/monitoreo/profiles/aulas/`
  — 217 archivos; hoy fallan 4 tests preexistentes (ver 5.1.5).

### Trampas que costaron tiempo hoy

- **Un lector de XML hecho a mano que ignora las celdas autocerradas
  (`<c r="P3"/>`) atribuye el valor de la celda siguiente a la anterior.** Dos
  veces me hizo creer que el generador estaba roto cuando el archivo estaba
  bien. Para inspeccionar un xlsx, `openxlsx::read.xlsx` o un parser que trate
  el auto-cierre.
- **Los valores crudos de un xlsx no son lo que se ve**: `0.0611185` con
  `numFmt 0.0%` se muestra como «6,1 %». Mirar el formato antes de declarar un
  defecto.
- **`modifyList` no borra con una lista vacía**: `modifyList(x, list(a =
  list()))` deja `a` intacto. Un fixture que creía estar desactivando algo lo
  seguía teniendo activo.

---

## 7. Addendum — misma tarde, 16:00 (sesión que retomó el traspaso)

Lo que se midió al retomar, y corrige o completa lo de arriba.

### 7.1 El `.pulso` de trabajo: dónde vive y quién lo tiene abierto

- **Dos backends tenían abierto el MISMO archivo**: el de Gonzalo (`:8787`,
  arrancado 11:53) y el de la sesión anterior (`:8836`). El de 8787 estaba en el
  estado de las **12:50**: 193 respuestas, 0 efectivas, `sex_var` vacío, 0
  `valid_filters`, 1 parte. El real (disco 15:40 y 8836) tiene 273 · 212 ·
  criterio declarado · 7 partes. **Un «Guardar» desde 8787 habría pisado la
  declaración del criterio.** Hasta que la app de Gonzalo *reabra* el archivo,
  lo que enseña es la foto vieja.
- La sesión 8836 se guardó a las **15:59** (`dirty=false`); el archivo del
  scratchpad es ahora el más nuevo.
- Como el scratchpad es `/private/tmp` y macOS lo limpia, quedó una copia
  fechada junto al original del cliente:
  `~/Documents/Pulso/HSTVG2026/Segundo sorteo 27 agosto/HSVG26ULT2_kobo (respaldo 2026-09-07 15-40).pulso`
  (zip íntegro, `state.rds` con criterio, 7 partes, reparto y disponibilidad).
- Regla que falta escribir: **un solo escritor por `.pulso`**, y la copia de un
  operativo real se guarda en la carpeta del cliente, no en un scratchpad.

### 7.2 La distribución de los aplicadores SÍ está desactualizada (5.4, medido)

Diff entre el reparto vigente (`aulas_libro_filas_plan_aplicadores` sobre el
`state.rds` guardado) y la hoja «Plan del día» del Sheets de distribución,
leída en solo lectura: **85 citas ahora contra 83 publicadas; 63 iguales; 2
nuevas; 20 cambian de persona.** Por día: Lun 07 y Sáb 12 iguales; Mar 08 →
1 nueva + 4 cambios; Mié 09 → 1 nueva + 4; Jue 10 → 6; Vie 11 → 6.

Martes 08/09, lo que leerían mañana si no se republica:

| CH | Aplica | Aula | En el Sheets | En el reparto vigente |
|---|---|---|---|---|
| CH 51 | 08:45–09:15 | E201 | *(no existe)* | Manayay Vásquez |
| CH 116 | 09:00–09:30 | H111 | Manayay Vásquez | Puchuri Chamorro |
| CH 71 | 17:00–17:30 | L323 | Manayay Vásquez | Ramirez Aramburú |
| CH 173 | 18:30–19:00 | H101 | Puchuri Chamorro | Aquino Dulanto |
| CH 113 | 18:45–19:15 | A502 | Aquino Dulanto | Ramirez Aramburú |

Causa: el reparto se recalcula cuando entra una confirmación (CH 51 y CH 35
entraron después de publicar) y las citas no fijadas se reacomodan. **La app no
recuerda el destino ni la fecha de la última publicación de la distribución**
(a diferencia de `libro_sheets`), así que no puede avisar que envejeció.
Decisión pendiente de Gonzalo: republicar tal cual, o **fijar** primero las
cuatro del martes como ya se publicaron y republicar sólo con CH 51 añadida.
Script del diff: `distribucion_diff.R` en el scratchpad de la sesión `83ff848b`
(deja `distribucion_calculada.csv` y `distribucion_en_sheets.csv`).

La pestaña vieja «Asignación de aplicadores» del documento de distribución **ya
no existe**: sólo queda «Plan del día». El pendiente manual de 1.2 está cerrado.

### 7.3 Las aulas nocturnas son HOY, no el martes (corrige 5.1.1)

El plan no tiene citas a las 19:30 el martes. Las que cruzan la medianoche UTC
(inicio ≥ 18:30 en Lima; 19:00 Lima = 00:00 UTC):

- **Lunes 07/09 (hoy)**: CH 13 18:30 A403 · CH 148 19:00 L323 · CH 74 19:30
  L312 · CH 9 19:45 A609. Las primeras respuestas con `_submission_time` del
  día siguiente entran **esta noche**.
- Martes 08/09: CH 173 18:30 H101 · CH 2 18:45 P104 · CH 113 18:45 A502.

La comprobación de `monitoreo_aulas_hora_local.R` se hace mañana temprano: tras
sincronizar, esas cuatro deben tener fecha de aplicación 07/09 y sumar al
renglón del lunes en el avance diario, no al del martes.

### 7.4 Repositorio y servidores

- **1 030 commits sin subir** desde `c9a3a78c` (24/08). `origin/main` sigue en
  `728f3513` (notas de 0.8.0). El «todo publicado» del cierre era el Sheets, no
  git. Subir pasa por `/publicar`.
- Siete worktrees en `.claude/worktrees/`; dos ramas con commits que no están
  en main (`claude/gallant-pike-78dba6`, 5 commits de efectividad/certeza del
  28/08; `claude/intelligent-rosalind-f04ad5`, un fix de `stop_api` en gráficos
  del 02/09) y tres worktrees con cambios sin commitear. Tres stashes viejos.
- Backend huérfano en `:8891` (PID 34974, del 27/08, sesión vacía). No es de
  nadie vivo; `make dev-prune` no lo listó.
- Sin commitear en main: `.claude/launch.json` (configs de dev de varias
  sesiones) y `docs/qa/checklist-marco-ccss-2026-09-07.md` (8/8 hechos, de la
  sesión del marco CCSS; el fix del prefijo `C` en
  `.cm_aulas_sesiones_prioridad` sí está commiteado).
