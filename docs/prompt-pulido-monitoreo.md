# Prompt de pulido estético de Monitoreo

Bucle de convergencia sobre la estética de los cuatro modos de Monitoreo. No es
una lista que se agota: es un loop que **solo Gonzalo cierra**. Cuando no queden
superficies sin auditar, se vuelve a empezar con criterio más fino.

Se lanza así:

```bash
/loop Sigue el protocolo de docs/prompt-pulido-monitoreo.md. Elige la siguiente superficie del registro, púlela entera y commitea. No te detengas.
```

El registro de avance vive en `docs/qa/pulido-monitoreo-estado.md` y lo escribe
el propio loop. Si no existe, la primera iteración lo crea con el inventario de
superficies de los cuatro modos.

---

## Misión

Afinar la estética de Monitoreo hasta que se vea de una sola casa: **espaciado
correcto, uniformidad, elegancia y gramática macOS**. En el mismo pase, mejorar
la redacción y la **didáctica de la interfaz** — que cada superficie enseñe qué
es y qué se decide en ella— sin caer en explicar de más.

**No se altera la funcionalidad.** El alcance es CSS y texto visible. Si un
defecto estético solo se arregla tocando lógica, se anota en el registro y se
deja; no se toca.

---

## Una iteración

### 1. Elegir

Toma del registro la primera superficie sin auditar. Una superficie es una
pestaña concreta de un modo concreto —`telefónico › Fuentes › Universo y
barrido`—, no un módulo entero. Si el registro está vacío, constrúyelo
enumerando con `window.__pulsoNav.manifiesto` sobre un proyecto abierto.

### 2. Verla, no leerla

Ábrela con el skill `/ver-ui` y **júzgala en pantalla**. No se diagnostica
leyendo CSS: los defectos que importan —celdas de 2 px, títulos encimados,
texto que se sale de su caja— pasan typecheck y tests sin inmutarse.

Proyecto por modo (ADR 0043):

| Modo | Proyecto |
|---|---|
| telefónico | `api/inst/reference_projects/acnur_pdm/acnur_pdm.pulso` |
| acreditación | `api/inst/reference_projects/acrconta/acrconta.pulso` |
| territorial | `api/inst/reference_projects/acnur_acg/acnur_acg.pulso` |
| cursos-horario | `api/inst/reference_projects/hsvg2026/hsvg2026.pulso` |

Levanta el stack **una vez** y recorre todo en esa sesión: abrir un proyecto de
referencia cuesta 2–4 min y una recarga completa vuelve a pagarlo. Navega con
`window.__pulsoNav.ir(...)`, nunca recargando.

### 3. Medir contra la casa

Las referencias canónicas son **Procesamiento › Gráficos** y el **editor de
formularios**: ahí la gramática está asentada. Mide con `getComputedStyle`, no a
ojo, y compara:

| Nivel | Radio | Materia |
|---|---|---|
| Panel de sección | `--pulso-radius-panel` (16) | borde + `--pulso-shadow-low` |
| Tarjeta | `--pulso-radius-card` (14) | gradiente + luz interior + sombra difusa |
| Control / celda | `--pulso-radius` (10) o 999 en chip | fondo, **sin caja propia** |

La materia de tarjeta son tres cosas **juntas**, y ninguna sobra:

```css
background:
  linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.93)),
  var(--pulso-surface);
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.86),   /* la luz que da el canto */
  0 4px 12px rgba(0, 36, 87, 0.052);      /* la sombra que la asienta */
```

Sin la luz interior, el gradiente solo aplana más.

Tipografía, medida en las referencias:

- Título de tarjeta: 13 px, `--pulso-weight-heavy`, `line-height: 1.18`.
- Descripción: 10.75 px, `--pulso-weight-medium`, `line-height: 1.38`.
- Label de campo: **12 px `--pulso-weight-semibold`, en color de texto**.
- Versalitas: **solo el antetítulo de un grupo**. Con todo en versalita nada
  encabeza nada.
- Cifra: 22 px, `--pulso-weight-black`, `font-variant-numeric: tabular-nums`.

### 4. Qué buscar

**Geometría y espaciado**

- Radios de un mismo nivel que no coinciden entre superficies hermanas.
- Tarjetas sin materia: rectángulos con una línea gris.
- Cajas concéntricas. Más de dos marcos y el ojo no sabe cuál es la unidad.
- Grupos pares sin `equal`: una tarjeta que colapsa a su contenido convierte
  cualquier diferencia de datos en desalineación.
- Recorte de dato operativo. Elipsis en etiqueta larga sí; en dato, nunca.
- Toolbars desbalanceados: `1fr` inanicia los lados.
- Vacío exterior sin dueño y scroll anidado (un solo dueño de scroll por
  pantalla).

**Redacción**

- Antetítulos que repiten el nombre de la pestaña activa que el chrome ya dice.
- Subtítulos que parafrasean su título.
- Frases que describen una afordancia («pasa el cursor por…»).
- Rótulos que nombran el proveedor o la estructura interna (`snapshot`,
  `payload`, `raw`, `asset`, nombres de servicio) en vez de la pregunta del
  estudio.
- El mismo dato en dos sitios de la misma pantalla; la misma etiqueta sobre dos
  denominadores distintos.
- Identificadores opacos ocupando el sitio de un enlace o de un nombre humano.
- **Rótulos heredados que mienten.** Un nombre puede venir de la planilla con la
  que se operaba y significar otra cosa: en el Excel de cursos-horario, `CORTAS`
  y `LARGAS` no eran minutos sino rutas del cuestionario, y `VÁLIDO` no era
  validez metodológica sino haber alcanzado el 70 % del denominador. Cuando el
  rótulo engaña, se cambia el rótulo —eso es texto, entra en el alcance—; lo que
  no se toca es el cálculo que hay debajo.

**Didáctica**

Cada superficie declara qué es y qué se decide en ella. Guiar es **nombrar el
siguiente paso concreto**, no explicar el concepto. Un estado pendiente dice la
acción que lo resuelve; un estado completo no añade prosa. Cuando un dato falta
por una razón que el usuario puede corregir, se dice esa razón en el sitio donde
se corrige.

Y cuando una cifra convive con su denominador, el denominador se nombra. Una
tasa por encima del 100 % no es necesariamente un error —puede ser un
denominador desactualizado o gente de otra sección—, así que se explica en vez
de esconderse o de bloquear.

### 5. Reglas duras

- **Funcionalidad intacta.** CSS y texto. Nada de lógica, contratos ni datos.
- **No se maquilla una ausencia.** Si una superficie se ve pobre porque le falta
  una pieza que el producto todavía no tiene, eso se anota en el registro con su
  referencia y se deja tal cual. Rellenar el hueco con copy es exactamente el
  AI slop que este loop existe para quitar.
- **Tokens `--pulso-*`.** Ningún hex en CSS de feature.
- **Archivos congelados** (`agentic/manifest.json`): lo nuevo va a archivo
  propio. Comprueba con `node agentic/sync-agentic-os.mjs --audit`.
- **Iconos** por el shim `src/vendor/lucide-react`.
- **Scope por perfil.** Un cambio para telefónico se scopea a
  `.is-telefonico-profile`; tocar `profilePage.css` a pelo alcanza a los cuatro
  modos y no los has mirado todos.
- **Sin `!important`** salvo que exista y se explique el empate de cascada.

### 6. Verificar

Antes de commitear, y con el alcance acotado al diff:

- La superficie en pantalla, en **1440×1000** y **1024×600**.
- `pnpm -C frontend exec tsc --noEmit --pretty false`.
- `pnpm -C frontend exec vitest run src/features/monitoreo`.

Verde por conformidad, no por ausencia. Si un caso falla, córrelo aislado antes
de acusar a tu cambio: `MonitoringProfilesReadinessContract` recorre el AST de
los page-files completos y cae por contención en la suite, no por regresión.

### 7. Cerrar y seguir

Un commit por superficie, conventional en español, describiendo **lo medido**
—«radio 9 y sin sombra contra 14 con materia»— y no la intención. Actualiza el
registro con lo hecho, lo que dejaste fuera y por qué.

**Y pasa a la siguiente sin preguntar.** No pidas permiso para continuar: la
instrucción de correr el loop es la aprobación. Solo interrumpes si un cambio
exigiría tocar funcionalidad, si dos criterios se contradicen sin árbitro, o si
lo que encuentras es un bug de datos y no de estética —eso se reporta y se
sigue—.

---

## Cursos-horario: el único modo con especificación previa

Antes de tocar ese modo, lee `docs/plan-monitoreo-aulas-2026-07.md`. Es la
auditoría del Excel con el que se operó PUCP 2025 —`Base de control`, 47
columnas, 194 curso-horario— convertida en requisitos. Cambia cómo se audita el
modo en tres cosas.

### Sabes qué secciones debe tener

Cinco: **Fuentes, Agenda, Avance, Validación y Consultas**, y la §5 del plan
dice qué responde cada una. Si una superficie no responde lo suyo, el defecto no
es de espaciado. Anótalo como hallazgo estructural y sigue puliendo lo que sí
está.

### Sabes qué cifras deben cuadrar

El plan trae una línea base histórica que sirve de oráculo:

| Indicador | 2025 |
|---|---:|
| Registros de campo | 196 |
| Aplicaciones reales | 194 |
| Respuestas crudas | 3.708 |
| Respuestas atribuibles | 3.698 |
| Sin curso–horario | 10 |
| Exclusiones de ruta | 394 |
| Elegibles | 3.304 |
| Mujeres / hombres | 1.741 / 1.563 |
| Cumplen 70 % de población | 58 |

No es para hardcodearla ni para exigir que `hsvg2026` la reproduzca —es otro
estudio—. Es para reconocer la **forma** de las relaciones: los tres filtros
suman las exclusiones, elegibles más exclusiones son las atribuibles, mujeres
más hombres son los elegibles. Si una pantalla muestra cifras que no cierran
así, es un bug de datos: se reporta y se sigue con la estética.

### Sabes qué está ausente y no debe maquillarse

El plan documenta piezas que el producto todavía no tiene, y el guion de
conexión declara dos fuentes donde la especificación exige cuatro. Lo que
encuentres de esta lista se anota, no se rellena:

- **Estado de contacto y estado de aplicación en la misma columna.** En el Excel
  hacía figurar dos aplicaciones reales como agendadas. Son dos campos.
- **Asistencia pegada a mano** en vez de derivada de eventos de campo: iba 85
  asistentes por detrás de la fuente.
- **Aula planificada tratada como aula real.** Son `planned_room` y
  `actual_room`, y ocho cursos ni siquiera permitían extraer la planificada.
- **Elegibles calculados restando tres negativas**, que deja pasar como elegible
  cualquier respuesta con los consentimientos vacíos.
- **Reemplazos sin cadena longitudinal** hasta su titular.

Y hay diez preguntas metodológicas abiertas en la §8 del plan —qué es el 70 %,
qué separa elegible de validada, cuándo se activa un reemplazo—. Ninguna la
decide este loop. Si una superficie depende de una de ellas, se anota con el
número de la pregunta y se deja.

---

## El registro

`docs/qa/pulido-monitoreo-estado.md`, con una fila por superficie:

```markdown
| Modo | Sección › Pestaña | Estado | Hallazgos | Commit |
|---|---|---|---|---|
| telefónico | Fuentes › Fuentes activas | hecho | escala 9→14, celdas sin caja | 5b8d3db9 |
| cursos-horario | Agenda | pendiente | | |
```

Los hallazgos que no son estéticos van a una segunda tabla del mismo archivo,
separados por tipo —pieza ausente, bug de datos, pregunta metodológica—, con la
referencia al plan que los respalda. Esa tabla es la que convierte el loop en
algo más que un pase de CSS.

Cuando todas las superficies estén en `hecho`, empieza otra vuelta: baja el
umbral —alineación óptica, ritmo vertical, coherencia de estados entre modos— y
marca todo como `pendiente (vuelta 2)`.

---

## Lo que ya está hecho

Para no repetir trabajo, lee antes:

- `docs/lecciones-monitoreo-2026-07.md` — las 13 lecciones del rediseño de
  Acreditación y Telefónico, cada una con qué evaluar en los demás modos.
- `docs/plan-fuentes-legibles-2026-07.md` — Fuentes en los cuatro modos.
- `docs/plan-monitoreo-aulas-2026-07.md` — la especificación de cursos-horario.
- `docs/ui-layout-grammar.md` — la norma de layout y el Contrato de Superficie.

Telefónico › Fuentes quedó pulido el 2026-07-30 y sirve de patrón. **Territorial
y cursos-horario no se han mirado**, y el guion de conexión de Acreditación está
cubierto por test pero nunca se abrió en la app.
