# ADR 0047: Bitácora, cronograma y canvas como tres vistas de un grafo vinculado

Estado: Propuesto

Fecha: 2026-07-28

## Contexto

El módulo Bitácora (slug `diseno-estudio`, ruta `/bitacora`) nació del ADR 0029
con tres secciones: el registro cronológico, el cronograma Gantt y el
calendario. Las tres funcionan y persisten en el `.pulso`, pero cada una es una
isla: una entrada de bitácora no puede señalar el hito que documenta, un hito no
puede avisar cuando vence, y no existe superficie para ordenar espacialmente lo
que el estudio va acumulando.

Tres carencias concretas motivan esta decisión.

**El cronograma es el espejo de un Excel, no una herramienta de la app.** El
usuario escribe el texto de una actividad y el backend adivina el resto con
expresiones regulares: `.plan_task_targets()` decide a qué módulo pertenece con
`grepl("campo|encuesta|supervision|monitoreo|…")` y cae a `"plan-trabajo"` si
nada coincide; `.plan_task_kind()` decide si es hito o ventana de campo por
palabras y duración. Ambas se recalculan en cada edición, así que pisan
cualquier elección explícita. Es la misma patología que el ADR 0045 corrigió en
Monitoreo: la etiqueta la pone un fallback, no la persona. El estado vacío
invita a importar un Excel antes que a construir el cronograma acá.

Y sin embargo el concepto correcto ya existe enterrado: `.plan_windows()`
agrupa tareas por módulo y calcula `min(inicio)`/`max(fin)` —eso es exactamente
el rango de fechas de una fase— y `.plan_sync_preview()` contrasta esa ventana
contra la evidencia real de la sesión (`planned_only` frente a
`evidence_available`). Lo que falta no es el cálculo: es que el usuario pueda
declarar la ventana en vez de que emerja de adivinanzas.

**No hay ninguna infraestructura de avisos.** Ni notificación, ni centro de
avisos, ni un toast reutilizable en toda la aplicación: el único deck existente
vive dentro de `LogicCanvas.tsx` con `useState` propio. Un hito con fecha no
puede recordarle nada a nadie.

**No hay superficie espacial.** Existen dos lienzos escritos a mano —el mapa de
lógica del XLSForm y el canvas de Gráficos— pero ambos están casados con su
dominio y ninguno expone una costura reutilizable: en `LogicCanvas.tsx`, `zoom`
y `pan` son `useState` dentro de 2610 líneas, el manejador de rueda está tipado
a `SVGSVGElement` y el clamp de zoom está escrito tres veces en el mismo
archivo.

La decisión afecta el modelo de datos persistido en el `.pulso`, la
compatibilidad con proyectos de estudios reales ya guardados, el contrato de
navegación del ADR 0044 y la geometría del Contrato de Superficie.

## Decisión

Si este ADR es aceptado, Bitácora pasa a ser **un subsistema de cuatro secciones
sobre un mismo grafo de entidades enlazables**: registro, cronograma,
calendario y lienzo. Se adoptan las reglas siguientes.

### 1. La fase es lo que el usuario crea; la regex solo sugiere

La unidad primaria del cronograma es el **rango de fechas de una fase**,
elegida de un catálogo cerrado de seis que hablan el idioma del estudio:

| Fase | Módulos que cubre |
|---|---|
| Diseño | `diseno-estudio` |
| Muestra | `calc-muestra` |
| Instrumento | `editor-xlsform` |
| Campo | `monitoreo`, `hojas-ruta`, `recopiladores` |
| Procesamiento | `carga`, `validacion`, `codificacion`, `analitica` |
| Entregables | `graficos`, `dashboard`, `reportes` |

`api/R/bitacora_fases.R` es el dueño único de esa tabla, y cada fase declara dos
cosas distintas que no hay que confundir:

- **Identidad** (`modulo`, `seccion`): a qué parte de la app se refiere la
  etapa. De ahí salen su ícono y su color, que son los mismos que el usuario ya
  ve en la barra de módulos y en el home. Una etapa que no se puede señalar en
  la app es una etapa que el usuario no puede accionar, así que cada una lleva
  además el enlace a su destino.
- **Evidencia** (`evidencia`): con qué claves se comprueba si la etapa arrancó
  de verdad. No coinciden con los slugs de módulo —`carga` y `validacion` son
  secciones de Procesamiento, `reportes` no es un módulo— y mezclarlas con la
  identidad era justamente lo que dejaba fases sin módulo al que apuntar.

El reparto sigue el dominio, no la estructura de carpetas: Procesamiento es la
tubería que deja la base limpia y codificada (carga, validación, codificación),
mientras que Analítica y Gráficos producen salidas y pertenecen a Entregables.
Ambas son secciones del **mismo** módulo Procesamiento, así que Procesamiento y
Entregables comparten su acento teal a propósito: son el mismo módulo y fingir
lo contrario mentiría sobre dónde vive la funcionalidad. Lo que las distingue es
el ícono de la sección, que es lo que el usuario ve al entrar. El Dashboard
cuenta como evidencia de entregable pero no da identidad: es un plus, no el
camino.

Lo que no puede repetirse es el **destino**: dos etapas que apuntaran al mismo
par módulo/sección serían indistinguibles y llevarían al mismo lugar. Eso lo
fija un test, junto con otro que exige seis íconos distintos y otro que ata el
catálogo de R al manifiesto de `lib/modules.ts`, para que renombrar un slug no
deje etapas sin sello en silencio.

No se introduce una entidad nueva: una fase es una tarea con `sync_targets`
explícito y rango de fechas; un entregable es una tarea con fecha puntual. Así
el Gantt, el calendario y el export XLSX siguen operando sin cambios, porque
todos iteran `plan$tasks`.

`.plan_task_targets()` y `.plan_task_kind()` dejan de decidir y pasan a
**proponer** un valor inicial al crear. En cuanto el usuario elige, los campos
`fase_manual` y `kind_manual` congelan esa elección y las expresiones regulares
no vuelven a pisarla.

Importar y exportar Excel se conservan, pero como acciones secundarias: el
punto de entrada del cronograma es el compositor in-app.

### 2. `kind` y `temporal_kind` responden preguntas distintas

El `kind` existente (`activity`, `milestone`, `deliverable`,
`fieldwork_window`) responde *qué es en el estudio* y alimenta el Gantt, los
hitos derivados y el export. No se renombra, no se migra, no cambia de
vocabulario.

Se agrega `temporal_kind` (`punto`, `rango`, `recurrente`) para responder *cómo
ocupa el calendario*. Se deriva en `.plan_rebuild_derived()` salvo cuando existe
una regla de recurrencia explícita.

### 3. `vencido` se deriva en el cliente, nunca se persiste

`.plan_now_iso()` formatea en UTC mientras `start_date` y `end_date` son fechas
de día local —por eso existe `dateUtils.dateValue()`, que interpreta
`YYYY-MM-DD` como medianoche local para evitar el desplazamiento de zona
horaria. Compararlas en R sería escribir ese bug a mano. Además, un payload
generado antes de medianoche seguiría afirmando que nada venció.

Regla: `vencido = !archivado && status !== "done" && finLocal(tarea) < ahora`,
evaluada en el frontend.

### 4. Tres claves de sesión nuevas, censadas y persistibles

- `bitacora_canvas` — los lienzos. Los grupos se modelan como nodos de tipo
  `grupo` con caja delimitadora: la pertenencia es geométrica, sin una tercera
  colección que pueda quedar con identificadores colgantes. El color de un nodo
  guarda el **nombre del token** (`neutro`, `acento`, `riesgo`, …), nunca un
  valor hexadecimal, para que el modo oscuro y los tokens `--pulso-*` sigan
  gobernando.
- `bitacora_avisos` — el libro mayor de disparos, con clave
  `<task_id>|<reminder_id>|<ocurrencia_iso>`. Es un libro y no un atributo de la
  tarea para que editar los recordatorios de un hito no reviva avisos que ya se
  mostraron.
- `bitacora_preferencias` — filtros y preferencias de vista. Persisten en el
  `.pulso` y no en `localStorage`: en esta aplicación la sesión es el proyecto
  abierto, y un filtro por etiqueta del estudio A no significa nada en el
  estudio B.

Las tres van a `session_schema.R` como `persistible` en el mismo commit que las
introduce, según la regla vigente del censo.

**El índice de retroenlaces no es una clave de sesión.** Se deriva por request.
Persistirlo sería garantizar que se desincronice del grafo que describe.

### 5. Los enlaces se guardan en un sentido y se leen en los dos

`Link = { target_type, target_id, relation }` con `target_type` en
`{tarea, entrada, nodo, lienzo}` y `relation` en
`{menciona, deriva_de, documenta, bloquea}`.

Un índice derivado (`.bit_link_indice`) construye la vista inversa por request,
sin duplicar el dato. Borrar cualquier entidad invoca `.bit_link_gc`, que
elimina los enlaces cuyo destino desapareció; no quedan referencias rotas
silenciosas. Un nodo de referencia cuyo destino ya no existe degrada a un estado
visible con dos salidas —desvincular o convertir en texto— nunca a un recuadro
en blanco.

### 6. Los avisos son solo in-app y se evalúan en el cliente

No se amplía el `contextBridge` de Electron. No hay notificación del sistema
operativo, badge del dock ni permiso solicitado al arranque.

La evaluación corre en el frontend por tres razones: Plumber no tiene
planificador y no existe un lugar en R donde corra un temporizador; "ahora" debe
ser hora de pared local; y el requisito es evaluar *al abrir la aplicación*, no
mantener un proceso vivo. R conserva lo único que debe ser durable: el libro de
disparos.

El disparo único tiene doble candado —un conjunto en memoria contra
evaluaciones concurrentes y el libro persistido entre sesiones— y **se reclama
antes de presentar**: la implementación natural, mostrar y luego persistir, deja
una ventana en la que recargar vuelve a disparar.

Al abrir con avisos vencidos se muestra **un solo toast agregado** que abre el
centro de avisos. Los toasts individuales quedan para lo que vence con la
aplicación abierta, con tope de tres simultáneos. El centro de avisos es un
**panel direccionable** (`?panel=avisos`), conforme al ADR 0044.

Este trabajo construye además el `Toaster` global reutilizable que la aplicación
no tenía. Su hoja de estilos vive en `components/toaster.css`, no en
`theme.css`, que está congelado a crecimiento.

### 7. Nace `lib/lienzo/` como hogar canónico de la cámara

La gramática de lienzo del mapa de lógica —desambiguación de rueda de trackpad
frente a ratón, conversión pantalla↔mundo, minimapa con rectángulo de viewport—
se destila a `frontend/src/lib/lienzo/` como funciones puras, agnósticas de SVG
y de dominio, más un hook `useCamara`. La selección múltiple y el arrastre de
grupo se destilan de `graficos/v2/canvas/PlanCanvas.tsx`.

El lienzo nuevo usa DOM con `transform` para los nodos y un único `<svg>` para
las aristas. Es una arquitectura distinta a la del mapa de lógica, cuyos nodos
son grupos SVG acoplados al dominio XLSForm y caros por nodo. Se descarta un
`<canvas>` 2D porque perdería foco, orden de tabulación y etiquetas
seleccionables, y el lienzo debe ser operable sin ratón.

`LogicCanvas.tsx` **no se modifica en este trabajo**. Migrarlo a consumir el
núcleo compartido es una unidad de trabajo posterior con su propio QA visual,
registrada abajo como deuda. Hasta entonces conviven dos implementaciones, pero
`lib/lienzo/` es el hogar declarado: código nuevo de lienzo se cuelga de ahí.

### 8. El canvas es la cuarta sección de Bitácora, y su vocabulario son las etapas

Vive en `/bitacora?seccion=canvas`, no en un módulo nuevo. Es coherente con la
premisa del subsistema —cuatro vistas de un mismo grafo— y hereda el chrome y la
paleta ámbar del módulo sin tocar `PROSECNUR_MODULES` más allá de agregar la
sección.

Lo que el canvas aporta sobre el cronograma es la **ramificación**. El
cronograma es lineal por naturaleza: seis etapas, una detrás de otra. Pero un
estudio real se bifurca —dos actores con campos distintos, una base que se
procesa dos veces, un entregable que depende de dos análisis— y esa forma no
entra en una línea de tiempo.

Por eso el canvas usa el mismo vocabulario que el cronograma en vez de inventar
uno propio: un nodo puede referenciar una etapa, un módulo o una sección, y se
pinta con el sello de ese módulo. El usuario arrastra las piezas que ya conoce
—las mismas de la barra de módulos— y las conecta como su estudio realmente
funciona. El resultado no es un diagrama decorativo sino un grafo que apunta a
partes reales de la app: cada nodo lleva a su módulo y muestra su estado vivo.

La referencia conceptual es Obsidian Canvas: lienzo infinito, nodos que se
conectan a mano, y nodos que son ventanas a otra cosa en vez de copias de ella.
Se replica el modelo de interacción, no la interfaz.

Consecuencia de diseño: el resolutor de identidad
(`features/bitacora/identidadDeFase.ts`) es compartido entre el cronograma y el
lienzo desde el día uno. Sin eso, el canvas terminaría con su propia tabla de
íconos y colores, y las dos superficies divergirían.

## Consecuencias

**A favor.** Un hito puede avisar; una entrada conserva su historial de
ediciones; cualquier entidad puede señalar a cualquier otra y la relación se lee
desde ambos lados. El cronograma se construye en un minuto sin salir de la
aplicación. La aplicación entera gana un `Toaster` reutilizable y un núcleo de
lienzo canónico que no tenía.

**En contra.** El módulo Bitácora crece de tres secciones a cuatro y de dos
claves de sesión a cinco. El payload del plan crece con recordatorios, enlaces y
etiquetas. Y quedan dos cámaras de lienzo en el repositorio hasta que se salde
la deuda registrada.

**Compatibilidad.** Todos los campos nuevos son aditivos y `bitacora_migraciones.R`
migra por saltos de versión de forma idempotente, invocada desde `load_pulso()`.
Un `.pulso` de estudio real guardado antes de este cambio abre sin pérdida, y
sus tareas quedan repartidas en las seis fases derivando desde los
`sync_targets` heredados —incluido `plan-trabajo`, el fallback de "no supe"—
sin dejar ninguna sin clasificar. Los endpoints `/api/plan-trabajo/*` y
`/api/bitacora` no cambian su contrato; el endpoint consolidado
`GET /api/bitacora/estado` es aditivo.

## Registro de decisiones

| Decisión | Alternativas consideradas | Por qué | Costo de revertir |
|---|---|---|---|
| Extender las entidades existentes | Subsistema paralelo; reemplazo con migración | Cero pérdida en `.pulso` de estudios reales y cero duplicación de dominio | Bajo: los campos son aditivos y opcionales |
| Fase elegida de un catálogo de seis | Los 8 módulos de la app; texto libre | Seis opciones son las que el usuario piensa; el mapeo a módulos conserva el contraste con evidencia | Medio: cambiar el catálogo obliga a remapear tareas existentes |
| `temporal_kind` aparte de `kind` | Renombrar `kind`; un solo campo con vocabulario mixto | Son preguntas distintas; renombrar rompería Gantt, hitos derivados y export | Bajo: es un campo derivado |
| `vencido` derivado en el cliente | Campo persistido; derivado en R | UTC contra día local es el bug de zona horaria; el payload envejece en memoria | Bajo: es una función pura |
| Avisos solo in-app | Notificación nativa vía `contextBridge`; Notification del renderer | Evita entrar en packaging y revalidar instaladores en dos plataformas | Bajo: el motor ya separa evaluación de presentación |
| Evaluación de avisos en el frontend | Planificador en R | Plumber no tiene scheduler y "ahora" debe ser hora local | Alto: mover el motor implica reescribir la agrupación |
| Reclamar el aviso antes de presentarlo | Presentar y luego persistir | La segunda deja una ventana en la que recargar re-dispara | Bajo |
| Libro de disparos separado de la tarea | Estado dentro de cada recordatorio | Editar los recordatorios de un hito reviviría avisos ya mostrados | Medio: exige migrar el libro |
| Preferencias en el `.pulso` | `localStorage` por máquina | La sesión acá es el proyecto; un filtro del estudio A no aplica al B | Bajo |
| Índice de retroenlaces derivado | Índice persistido | Persistirlo garantiza desincronización | Bajo |
| Grupos del canvas como nodos con caja | Colección aparte de grupos | Evita identificadores colgantes; es el modelo de Obsidian Canvas | Medio |
| DOM + un SVG para el lienzo | SVG completo como el mapa de lógica; canvas 2D | SVG por nodo es caro; canvas 2D pierde foco y teclado | Alto: es la arquitectura del lienzo |
| `lib/lienzo/` sin migrar `LogicCanvas` | Copiar la lógica; migrar en la misma fase | Un hogar canónico desde el día uno sin tocar 2610 líneas sin red de tests | Bajo |
| Canvas como sección, no módulo | Módulo nuevo; panel global | Cuatro vistas de un grafo; no toca home ni paletas | Bajo |
| Etapa = módulo o sección, con su ícono y color | Etapas abstractas numeradas | El sello ancla la etapa a una parte accionable de la app; el usuario reconoce sin leer | Bajo |
| Destino único por etapa; el módulo puede repetirse | Un módulo por etapa | Entregables ES Procesamiento (secciones Analítica y Gráficos); forzar módulos distintos mentiría sobre dónde vive la funcionalidad | Bajo |
| Analítica y Gráficos en Entregables | Ambos en Procesamiento | Producen salidas, no la base limpia; Procesamiento termina en codificación | Bajo |
| Dashboard solo como evidencia | Dashboard como identidad de Entregables | Es un plus del estudio, no el camino por el que pasa el entregable | Bajo |
| Identidad compartida cronograma↔lienzo | Tabla propia en el canvas | Evita que las dos superficies diverjan en íconos y colores | Bajo |
| Import y export de Excel degradados | Retirar el import; dejarlos como están | El export sigue siendo el formato que el cliente espera | Bajo |

### Fase 7 — nodos de referencia

| Decisión | Alternativa descartada | Por qué | Costo de revertir |
|---|---|---|---|
| Un nodo puede referenciar una PIEZA DE LA APP (módulo o sección) | Solo hitos y entradas | Es lo que convierte el lienzo en un mapa del estudio en vez de un pizarrón; el equivalente de embeber una nota en Obsidian Canvas | Bajo |
| El catálogo de piezas lo resuelve el frontend contra `lib/modules.ts` | Duplicar el catálogo de módulos en R | Una segunda copia divergiría en el primer renombre de sección, y R no tiene por qué conocer la navegación | Bajo |
| Un destino `modulo` siempre está vivo para el gc de vínculos | Validarlo contra el universo del proyecto | El universo del proyecto no contiene módulos: validar ahí borraría todos los nodos de referencia en cada limpieza | Bajo |
| El resumen del nodo se resuelve en el cliente (`resumenVivo`) | Leer `vinculos.resumenes` del servidor | Ese índice se arma desde vínculos PERSISTIDOS, así que un nodo recién insertado se leía como huérfano; «destino perdido» tiene que significar «lo borraron», no «todavía no guardaste» | Bajo |
| El nodo guarda el título al insertar, como respaldo | Guardar solo `{target_type, target_id}` | Al borrarse el destino, el huérfano puede decir «apuntaba a Campo» en vez de escupir un uuid — justo cuando más falta hace | Bajo |
| El selector es un popover anclado, no un bloque en el flujo | Panel que empuja el lienzo | Medido: empujando, el lienzo caía de 773 a 439 px al abrirlo; el marco de una superficie no puede cambiar de tamaño según lo que el usuario esté haciendo (C2) | Bajo |

## Deuda registrada

1. **`LogicCanvas.tsx` conserva su cámara propia.** Convive con `lib/lienzo/`
   hasta que se migre. Saldarlo exige una unidad de trabajo con QA visual del
   editor XLSForm, sin red automatizada: vitest corre en Node puro y no puede
   renderizar el componente.
2. **El deck de toasts de `LogicCanvas` no se migra** al `Toaster` global; queda
   en la whitelist heredada del contrato de decks `aria-live`, que solo puede
   encoger.

## Fuera de alcance

Colaboración en tiempo real, sincronización en la nube, permisos por usuario,
integración con calendarios externos, sugerencias automáticas, Gantt con
dependencias complejas más allá de `bloqueado por` sin ciclos, plantillas de
proyecto e informes generados.

## Relación con otros ADRs

- Sucede al [ADR 0029](0029-reorientacion-por-proyecto-bitacora-y-overview.md),
  que fusionó cronograma dentro de Bitácora; no lo reemplaza, lo extiende.
- Cumple el [ADR 0044](0044-jerarquia-y-direcciones-de-navegacion.md): la
  sección nueva y los paneles de avisos e importación son direccionables.
- Aplica la lección del [ADR 0045](0045-monitoreo-actores-modelo-telefonia-explicita.md):
  la clasificación la declara el usuario, no un fallback.
- Respeta el [ADR 0026](0026-guardado-explicito-guardia-salida.md): todo el
  estado nuevo marca `project_dirty` y se escribe solo con guardado explícito.
