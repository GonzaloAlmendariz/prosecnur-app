# Revamps visuales: errores recurrentes y gate operativo

**Fecha:** 26 de julio de 2026
**Estado:** evidencia post-incidente y contrato obligatorio para futuros revamps
**Origen:** ocho chats recientes de Prosecnur, la auditoría visual de Monitoreo
y las reaperturas de Territorial/Telefónico.

## Propósito

Este documento no define una nueva estética. Registra por qué una limpieza
visual que parecía terminada tuvo que reabrirse varias veces y convierte esas
fallas en un método reproducible.

La conclusión principal es:

> Un revamp no está aprobado porque compile, no tenga overflow global o haya
> generado muchas capturas. Está aprobado cuando el estado correcto está
> hidratado, cada región usa el espacio según su contenido, todo el recorrido
> es alcanzable y una persona inspecciona la composición completa en cada
> régimen de layout.

Este contrato complementa `docs/ui-layout-grammar.md`,
`docs/loops-reparacion.md`, `.claude/skills/revamp-visual/SKILL.md` y
`docs/qa/prompt-validacion-visual-referencia.md`.

## Corpus revisado

Se tomaron los ocho chats Prosecnur más recientes visibles al iniciar esta
síntesis. Los identificadores son trazabilidad local de Codex; la evidencia
persistente es la que se cita después bajo `docs/qa/` y `tmp/visual-qa/`.

| # | Chat | Aporte al diagnóstico |
|---:|---|---|
| 1 | `019f9fb6-63c9-7fa3-aece-ceb4115558ac` — Pulir Monitoreo territorial y telefónico | Caso principal: QA amplio seguido de reaperturas por espacio muerto, recorte interno, composición duplicada, mapa ausente e hidratación tardía. |
| 2 | `019f9ea6-9883-7ce0-9c09-aa8aae0a404a` — cierre de la app dev | El entorno de prueba también forma parte del gate: una vista o backend fallido no puede dejar el runner o Electron sin cierre controlado. Evidencia indirecta. |
| 3 | `019f9c20-fd82-7140-862d-6009acab6bdc` — recorrer Carga | Llegar a una ruta no prueba que se haya abierto el estado, actor o cuerpo correcto; la verificación debe confirmar contexto y datos. |
| 4 | `019f9c24-ae7a-7ef1-ad87-468e14f800dd` — auditoría visual por modo | Inventario exhaustivo, scroll por pestaña y detección de fallos internos que no producían overflow global. |
| 5 | `019f9b0d-56d1-7000-8aed-c81fb425c354` — evaluación de ACRDCONTA | Los proyectos reales revelan multiactor, etiquetas largas, cardinalidades extremas y combinaciones que las semillas pequeñas no representan. |
| 6 | `019f9b02-4642-7d40-ae72-4846e2c6a63d` — acceso a rutas QA | La navegación debe hacerse por dirección canónica y debe confirmar ruta solicitada, ruta real y pestaña activa. |
| 7 | `019f91c4-cc83-72f3-a1b1-4065a9ef3609` — ejecución del plan de revamp UI | Una matriz grande no sustituye el juicio visual ni la revisión de estados vacíos, cargados y compactos. |
| 8 | `019f8029-f9a0-7921-a703-ae4b30bfb115` — multibase ACRDCONTA | La fidelidad visual depende de usar datos y contratos reales sin alterar el proyecto fuente. Evidencia indirecta de fixture y preservación. |

Los chats 2 y 8 no son postmortems visuales puros. Se conservan porque
explican dos condiciones del QA: entorno controlable y proyecto real intacto.
No se usan para atribuirles hallazgos visuales que no contienen.

## Qué salió mal

### 1. Se confundió cobertura con observación

Se recorrieron muchas rutas y se generaron capturas de inicio, medio y final,
pero algunas capturas no mostraban el cuerpo que se pretendía evaluar. En
`Fuentes > Fuentes activas`, por ejemplo, el contador podía quedar verde aunque
el primer viewport aún mostrara otra arquitectura. Después apareció el panel
real de 13 fuentes, cuatro actores y baja cardinalidad con tarjetas estiradas.

**Regla:** una captura cuenta solo si demuestra a la vez ruta, pestaña, estado
hidratado y ancla de contenido esperada. El número de capturas no compensa una
precondición ausente.

### 2. Se trató “cero overflow” como aprobación visual

Un hijo puede estar recortado dentro de una tarjeta mientras el documento no
desborda. También puede existir un mapa completamente blanco, una tabla de 320
px sobre un lienzo vacío o una columna con cientos de píxeles muertos y aun así
obtener `globalOverflow: 0` y `scrollJails: 0`.

**Regla:** los contadores automáticos son condiciones necesarias, no un
veredicto. Deben acompañarse con geometría interna y comparación visual.

### 3. Se validó el estado común y no los estados que rompen el layout

Los defectos reaparecieron con:

- pocas filas o categorías vacías;
- listas reales de 150 UMP;
- tarjetas con texto operativo completo;
- una tabla con cientos de filas;
- sesión fría todavía sin hidratar;
- 1024×600 y también 1710×1107.

No existe un único “caso difícil”: mucha información rompe anchos y scroll;
poca información revela `stretch`, alturas heredadas y espacio artificial.

**Regla:** todo baseline define una matriz de estados, no solo una matriz de
viewports. Como mínimo: vacío, baja cardinalidad, cardinalidad real alta,
etiqueta larga, selección activa, carga fría y estado hidratado.

### 4. Se intentó corregir el síntoma sin llegar al primer ancestro causal

Los fallos compartían una cadena típica:

```text
shell ya acotado
  → stage vuelve a restar 100dvh
    → grid/flex distribuye el sobrante o comprime tracks
      → tarjeta usa height: 100%
        → contenido queda recortado o desplazado
```

Cambiar solo el hijo podía mejorar una captura y romper otro breakpoint. Los
casos reales exigieron revisar `min-height: 0`, `height: 100%`, tracks `auto`,
`align-items: stretch`, `grid-row: span`, `overflow` y overrides tardíos.

**Regla:** medir de la hoja hacia la raíz y corregir el primer ancestro que
viola el contrato. No acumular compensaciones en selectores cada vez más
específicos.

### 5. Se aplicó una sola política de altura a regímenes distintos

En Mapa y UMP, escritorio ancho necesita un workspace gobernado con mapa
flexible y lista/inspector como dueños de scroll. En compacto, esa misma
política desplaza o recorta contenido: allí el recorrido debe crecer de forma
intrínseca y usar el scroll exterior como respaldo.

**Regla:** declarar explícitamente los regímenes:

- ancho: altura acotada, un track flexible y colecciones con scroll interno;
- compacto/bajo: filas intrínsecas, apilado u orientación horizontal y scroll
  exterior alcanzable;
- no trasladar una variable de altura de un régimen al otro.

### 6. Se confundió igualdad de marcos con estiramiento indiscriminado

`align-stretch`, filas fraccionarias y spans hacían que una columna corta
heredara la altura de otra larga. Así aparecieron tarjetas de actor infladas,
un vacío entre UMP exacta y Cola UMP y un grupo de distritos vacío ocupando la
altura de una lista real.

El error no fue buscar consistencia. Dos bloques pares o varias tarjetas de la
misma variante sí deben conservar marcos de igual alto aunque uno no llene toda
su capacidad. El error fue estirar secciones semánticamente independientes o
dejar que la lista interior determinara el alto exterior.

**Regla:** primero declarar el grupo geométrico. Los pares y repetidos igualan
su **marco exterior**; el contenido se administra dentro mediante estado vacío,
scroll, paginación o divulgación progresiva. Las secciones independientes se
alinean arriba y usan altura intrínseca. Nunca se iguala una sección apilada a
la suma accidental de dos paneles vecinos.

### 7. Se entendió “eliminar blanco” como “hacer todo más pequeño”

El blanco tenía cuatro significados distintos:

| Situación | Decisión correcta |
|---|---|
| Tabla con cientos de filas dentro de un shell bajo | Entregarle el alto disponible para mostrar más datos. |
| Dos cards pares y una tiene menos información | Conservar el mismo marco; el vacío interior es capacidad legítima. |
| Sección independiente con dos casos | Altura intrínseca; el panel siguiente empieza después del gutter. |
| Card repetida sin casos | Conservar la geometría de su variante y mostrar un estado vacío dentro. |

**Regla:** clasificar primero el vacío como capacidad interior, estado vacío,
capacidad útil para datos o hueco exterior sin dueño. Los tres primeros pueden
ser correctos; el último debe eliminarse. La frontera visible del contenedor es
lo que permite distinguir aire profesional de una composición rota.

### 8. Se repitió la misma información en demasiadas superficies

Mapa y UMP repetía la selección en foco del mapa, navegador, miniinspector,
tabla e inspector. La duplicación consumía alto, truncaba texto y hacía que
ninguna superficie tuviera una función clara.

**Regla:** para master-detail conservar una lista maestra y un inspector. El
canvas expresa ubicación; la tabla completa pasa a divulgación progresiva si
es secundaria. No duplicar una jerarquía para “llenar” espacio.

### 9. Las pruebas de contrato también pueden fijar un layout incorrecto

En la tercera iteración de Mapa y UMP, una regresión prohibía la fila flexible
que el mapa necesitaba. Cumplir esa prueba dejaba que la lista real agrandara
una fila `auto` miles de píxeles y desplazara el SVG fuera de la ventana.

**Regla:** una prueba estática debe expresar el comportamiento observable, no
una receta CSS accidental. Si el producto empeora al ponerla verde, se corrige
el contrato con evidencia; no se deforma la UI ni se debilita la aserción sin
explicación.

### 10. La hidratación se trató como tiempo, no como estado

Una captura fría de 1710 mostró cero válidas y falló el selector. Una repetición
caliente mostró lista, inspector, SVG y rutas. Esperar una cantidad fija de
milisegundos no distingue ambos estados.

**Regla:** el readiness visual exige invariantes del dominio: proyecto
correcto, contadores esperados, selector objetivo, contenido no vacío y, para
mapas/gráficos, SVG/canvas con geometría o marcas. Un reporte con
`waitSelectorMisses > 0`, `projectMisses > 0` u `ok: false` es intento inválido,
no evidencia aprobatoria; debe repetirse limpiamente.

### 11. La accesibilidad se revisó después de la estética

Filas clicables, nodos GPS solo de puntero, regiones completas con `aria-live`
y modales sin restauración de foco funcionaban visualmente pero no como
controles. Los textos truncados tampoco ofrecían siempre un nombre completo.

**Regla:** teclado, nombre accesible, foco, Escape y lectura no ruidosa forman
parte del contrato visual de cada iteración, no de una pasada posterior.

### 12. Los estilos compartidos ampliaron el radio de regresión

Territorial y Telefónico comparten shell, PageFrame y reglas base. Algunas
correcciones locales dependían de una variable contradictoria en CSS común;
otras debían permanecer aisladas para no alterar Subsanaciones, Salidas o el
otro perfil.

**Regla:** inventariar consumidores antes de editar. Si se toca una regla
compartida, verificar al menos un consumidor representativo de cada modo; si
la semántica es local, aislarla por componente/estado y añadir un guard de no
regresión para el vecino.

### 13. El harness y el inventario también envejecen

Una auditoría esperaba visible un `data-audit-ready` deliberadamente oculto,
un catálogo histórico contaba 24/26 pestañas donde el DOM vivo terminó
mostrando 28, y una primera enumeración profundizó solo una de cinco secciones
telefónicas. El runner ejecutó lo pedido, pero lo pedido ya no representaba la
aplicación.

**Regla:** antes de usar el harness, auditar sus selectores, runtime, puertos e
inventario contra navegación y DOM actuales. Navegar por dirección canónica;
usar texto visible solo como fallback. Reportar siempre `requested === actual`,
la pestaña activa y el conteo esperado de destinos.

### 14. Se aprobó la apariencia sin comprobar la verdad operativa

En los chats revisados aparecieron estados “Disponible” o verdes con cobertura
parcial, contadores derivados de archivos sueltos y superficies visualmente
listas cuyo flujo real no podía persistir, reabrirse, configurarse o exportarse
desde la UI. Un backend o fixture capaz no demuestra que la persona pueda
completar el recorrido.

**Regla:** un revamp de superficie operativa prueba también la acción primaria,
persistencia/reload, selección, preview y salida cuando existan. Color, copy,
contador y habilitación deben derivar de la misma fuente autoritativa.

### 15. Se midió tamaño mínimo, pero no la geometría del contenido

Un mapa puede superar un mínimo de ancho/alto y seguir siendo una franja
panorámica inútil si el `viewBox` no corresponde al bounding box real. De igual
modo, el primer viewport puede estar “completo” y no mostrar ninguna fila,
pregunta o acción útil porque el chrome consumió todo el alto.

**Regla:** medir utilidad y composición: relación de aspecto, bounding box,
porcentaje de ocupación del contenido y primera unidad operativa visible. Los
mínimos numéricos son piso, no criterio suficiente de calidad.

### 16. La regla correcta existía, pero perdía por especificidad

En Telefónico, el chrome renderizaba tres hijos —cabecera, claridad y
contenido— mientras una regla compartida más específica declaraba únicamente
dos tracks. La corrección local de tres filas estaba escrita, pero no ganaba la
cascada. El tercer hijo cayó en una fila implícita y el track flexible intermedio
absorbió cerca de 480 px: una vista técnicamente sin overflow mostraba el
contenido pegado abajo y un gran hueco exterior.

**Regla:** el QA geométrico debe registrar estilos computados y número de hijos
contra tracks explícitos; leer la última declaración del archivo no demuestra
qué regla gobierna. Cuando una corrección depende de la cascada, la regresión
debe fijar el selector contractual con especificidad suficiente y la prueba de
runtime debe medir el inicio del contenido, no solo su alto.

## Evidencia concreta de las reaperturas

| Vista | Falla que escapó | Causa causal | Reparación verificada |
|---|---|---|---|
| Fuentes activas | Tarjetas de actores enormes bajo un encabezado casi vacío | Grid de dos columnas, `span 2` y estiramiento por la suma de paneles vecinos | Tres superficies naturales, alineadas arriba; guard Telefónico separado. |
| Territorial/Fuentes/Filtro | Variables y Regla efectiva tenían 154 px de diferencia aunque el padre declaraba `stretch` | Ambos hijos optaban fuera con un `align-self: start` compartido más específico | Pares laterales `stretch` en desktop; al apilar, retorno explícito a altura intrínseca. |
| Reconciliación UMP | Cientos de píxeles entre dos casos y Cola UMP | Panel UMP estirado a la altura de Código y tracks flexibles repartiendo sobrante | `align-self: start`; se conservan contenedores y estados vacíos. |
| Consultas/Registro | Tabla de 265 filas encerrada en 320 px con lienzo vacío debajo | Override tardío convertía alto útil en máximo fijo | 320 px como mínimo y tabla expandida al alto disponible. |
| Consultas/Subsanaciones | Tarjetas de 149 px comprimidas a 116 px; cabecera heredaba scroll | Segundo cálculo de viewport, filas implícitas comprimidas y scroll exterior | Rama operacional, filas `max-content`, fallback compacto y reset de scroll. |
| Telefónico/Llamadas | Tiempos, Sin efectiva, Responsables y Alertas comenzaban cientos de píxeles abajo | Tres hijos dentro de un grid de dos tracks; la regla local de tres filas perdía por especificidad | Tres tracks explícitos bajo el selector contractual; contenido en la fila flexible y readiness posterior a carga. |
| Telefónico/Avance/Diario | Ritmo ocupaba solo una fracción del ancho; Contexto, Universo y Actor terminaban superpuestos en una franja de 174 px | Un override tardío con `auto-fit` anulaba las tres áreas declaradas y produjo seis tracks, incluido uno de 0 px | En escritorio se restituyen `daily` a todo el ancho y `storage/context/focus` como tres áreas; el apilado queda restringido al breakpoint compacto. |
| Telefónico/Avance/Salidas | El collector reportó inaccesible “Validar salida” aunque la captura mostraba el resumen cerrado | Se eligió un descendiente de `details:not([open])` como si estuviera renderizado | El checker y los agentes excluyen el cuerpo cerrado; al abrirlo deliberadamente, el botón debe quedar totalmente alcanzable. |
| Territorial/Ocurrencias/Distritos | Filas iguales pero angostas, con una tercera columna completamente vacía | La variante heredaba `districts districts daily` aunque solo renderizaba distritos | Canvas de una columna y una única área `districts`; gutters laterales deliberados. |
| Aulas/Fuentes y Agenda | Segunda tabla colapsada a 0 px y más de 100 px sin dueño bajo el workbench | Fila fantasma compartida y stacks compactos con `minmax(0,1fr)` compitiendo por un alto corto | Una fila real para el workbench; stacks intrínsecos y tabla con viewport mínimo y scroll propio. |
| Avance/Resumen | Grupo de distritos vacío tan alto como la columna de progreso | Grid simétrico y `stretch` entre contenidos no equivalentes | Áreas independientes, alineación superior y altura intrínseca. |
| Avance/Mapa y UMP v1 | Recorte interno de 50 px a 1280 y 146 px a 1024 | Tarjeta al 100% dentro de viewport tardíamente reducido | Eliminar compresión y preservar mínimo útil del mapa. |
| Avance/Mapa y UMP v2 | Mapa blanco en 1710 y 1440 aunque había datos | Lista de 150 UMP inflaba una fila `auto` y desplazaba el SVG | Workspace ancho acotado; solo viewport flexible; lista/inspector con scroll. |
| Avance/Salidas | Selector 152 px dentro de 135 px a 1024 | Mínimo rígido en control compartido | `min-width: 0`, grid/wrap compacto y guard compartido. |

El detalle iterativo y las rutas de capturas viven en
`docs/qa/monitoreo/territorial_telefonico_visual_cleanup_20260726.md`.

## Protocolo obligatorio

### Antes de editar

1. Declarar scope lock, archivos excluidos, riesgo y stopping rule.
2. Leer QA históricos y registrar qué observaciones siguen abiertas.
3. Inventariar modos, secciones y pestañas desde navegación/DOM vivo; no
   confiar solo en una matriz antigua.
4. Elegir un proyecto de referencia real y una copia escribible. Usar el mismo
   proyecto antes y después.
5. Definir la matriz mínima:
   `vista × viewport × cardinalidad × hidratación × selección`.
6. Declarar grupos geométricos: pares comparables, variantes repetidas y
   secciones independientes.
7. Identificar PageFrame, dueño de scroll y contrato de altura/capacidad de
   cada región.
8. Capturar baseline con medidas de marco y contenido, no únicamente
   screenshots.

### Durante cada iteración

1. Nombrar una sola falla observable.
2. Medir tarjeta, contenido y ancestros hasta hallar la primera divergencia.
3. Crear una regresión que describa el comportamiento esperado.
4. Aplicar un cambio enfocado; revisar orden de cascada y consumidores
   compartidos.
5. Repetir exactamente el caso que fallaba y un guard vecino.
6. Registrar mejor/igual/peor. Si empeora otro régimen, rechazar la iteración.

### Gate visual final

Para un workbench completo:

- viewports: 1710×1107, 1440×1000, 1280×800 o 1280×720 y 1024×600;
- todas las secciones y pestañas direccionables;
- carga fría y estado hidratado confirmado por invariantes;
- inicio, medio y final de cada dueño de scroll que tenga exceso;
- estados vacío, baja cardinalidad y cardinalidad real alta;
- igualdad exterior de bloques pares y cards repetidas por variante;
- estabilidad del marco entre cardinalidades; los ítems no gobiernan su alto;
- espacio blanco interior contenido y ningún hueco exterior sin dueño;
- etiquetas largas y selección/inspector activos;
- ancho y alto de hijos críticos, no solo del documento;
- cero contenido inaccesible, recorte, overflow global o interno accidental;
- mapa/gráfico realmente dibujado, no solo contenedor montado;
- primera fila, pregunta, caso o acción útil visible cuando la tarea lo exige;
- estados, colores, contadores y acciones coherentes con la verdad operativa;
- flujo primario probado hasta persistencia/reload o preview/salida cuando
  pertenezca al alcance;
- teclado, foco visible, Escape, nombre accesible y orden de lectura;
- consola, página, API y recursos sin errores atribuibles;
- `data-audit-ready`, ruta real y pestaña activa correctas;
- comparación humana antes/después y verificador independiente.

Un reporte inválido por readiness no se combina con otros para producir un
“verde compuesto”. Se reemplaza por una corrida limpia. Las capturas fallidas
pueden conservarse como diagnóstico, etiquetadas como inválidas.

## Medidas mínimas que debe registrar el runner

Para cada captura relevante:

- ruta solicitada, ruta real, modo, sección y pestaña activa;
- viewport y `devicePixelRatio`;
- proyecto/actor/fase y contadores de readiness esperados;
- `scrollWidth/clientWidth` y `scrollHeight/clientHeight` del documento y de
  cada scroll owner;
- rectángulo de regiones críticas y altura real de su contenido;
- grupo/variante geométrica y diferencia entre su alto máximo y mínimo;
- estabilidad del marco entre estados vacío, bajo y lleno en el mismo viewport;
- capacidad interior no usada, distinguida de huecos exteriores sin contenedor;
- elementos parcialmente fuera de su clipping ancestor;
- posición inicial/final alcanzada por scroll;
- último elemento realmente renderizado: los descendientes de un
  `details:not([open])` no cuentan hasta abrirlo; en estado cerrado solo su
  `summary` participa de la geometría visible;
- para scrolls anidados, cadena completa de dueños y posición final alcanzada
  desplazando de afuera hacia adentro; una hoja fuera del primer encuadre no es
  por sí sola contenido recortado;
- para SVG/mapa: dimensiones, cantidad de paths/marcas y bounding box útil;
- ocupación y relación de aspecto del contenido dentro del canvas;
- para tabla: alto del viewport y primera/última fila visible;
- errores, misses de selector y resultado `ok`.

## Definición de terminado

Un revamp puede cerrarse únicamente cuando:

- la falla original y las variantes de cardinalidad quedan corregidas;
- no se ha trasladado el problema a otro viewport o consumidor compartido;
- cada espacio en blanco tiene una función explicable;
- los bloques pares y repetidos conservan geometría exterior coherente;
- cada contenedor vacío conserva la caja de su variante y un estado explícito;
- el contenido largo es alcanzable sin hacer crecer el marco con cada ítem;
- las secciones independientes no heredan alturas ajenas ni dejan huecos entre
  bloques;
- los reportes usados como evidencia son válidos y reproducibles;
- pruebas, typecheck, diff y QA visual independiente están verdes;
- el registro de iteración cita archivos y evidencia persistente.

## Controles preventivos incorporados al agentic OS

Estas lecciones ya no dependen de que una persona recuerde este postmortem:

- `revamp-visual` y la ruta `diseñar` cargan `govern-visual-harmony` antes de
  congelar dirección;
- `frontend-react` implementa grupos geométricos, cardinalidades y dueños de
  overflow declarados;
- `qa-visual-desktop` mide marco/contenido, vacío interior/exterior y alcance
  del último elemento;
- `ui-quick-check` acepta contratos `equal`/`intrinsic`, falla por
  `equal-frame-drift` o `capacity-drift` y descubre automáticamente las filas
  del workbench; por tanto, “sin overflow” ya no equivale a geometría aprobada;
- la navegación `--ir` mantiene la espera cuando todavía no existe marca de
  readiness y aborta si la dirección no alcanza un estado final; una captura
  fría ya no puede producir un `ok=true` solo porque el shell global apareció;
- `verificador` rechaza un `visualIssues=0` sin evidencia geométrica cuando el
  diff toca grid, flex, alto u overflow;
- `prosecnur-design-system`, `visual-ui-inspector` y
  `prosecnur-ux-evaluator` comparten la misma distinción entre capacidad
  interior válida, hueco exterior inválido y secciones independientes
  intrínsecas;
- el Harmony Contract global incorpora grupos equivalentes, ejes gobernados,
  tolerancia, matriz `0/1/pocos/muchos`, dueño de overflow y la clase causal
  `capacity_drift`.

La prueba de completitud es transversal: dirección declarada, implementación
acorde, inspección con medidas y gate independiente. Ninguna capa aislada puede
aprobar el revamp completo.

## Revalidación geométrica 2026-07-27

La institucionalización se probó de nuevo sobre los perfiles reales y no solo
contra fixtures CSS:

- Territorial: dos pasadas completas de 28 pestañas en 1440×1000 y 1024×600
  (56 estados por pasada), incluyendo scroll superior/medio/inferior, mapa SVG,
  Filtro, Reconciliación, Distritos y carga fría de Subsanaciones.
- Acreditación/Telefónico: Fuentes activas quedó en tres superficies de igual
  capacidad; Llamadas, Modelo y Avance se midieron en ambos viewports. En las
  pestañas telefónicas cortas el panel llega al borde interior del viewport de
  contenido; en las largas crece, el dueño de scroll sigue siendo el workbench
  y el último elemento es alcanzable. La reapertura final de Avance/Diario
  confirmó 199,53 px útiles para la lista de estados en 1440×1000 y alcance del
  último contenido con `scrollTop=max` en 1024×600; Salidas se comprobó con el
  `details` tanto cerrado como abierto.
- Aulas: 20 casos de navegación y 60 capturas recorrieron Avance, Agenda,
  Validación, Consultas y Fuentes; el selector conserva cuatro tarjetas de
  96 px, y las tablas de Fuentes/Agenda mantienen viewport interno alcanzable a
  1024×600.
- Readiness: Territorial, Acreditación y Telefónico omiten `data-audit-ready`
  durante la hidratación y publican la marca únicamente al desmontar el loader.

Queda una limitación de fixture, no una aprobación implícita: el proyecto real
`hsvg2026` posee el marco de cursos-horario a escala, pero no un snapshot de
Monitoreo Aulas importable. Por ello, la alta cardinalidad real de ese perfil se
registra como evidencia pendiente; no se fabricaron datos para convertirla en
un falso pase. De forma equivalente, `acnur_pdm` permite validar el chrome,
readiness y los estados vacíos reales de Telefónico, pero no contiene una
producción telefónica sincronizada de alta cardinalidad; esa variante también
queda registrada como evidencia pendiente.

## Deuda de verificación identificada

La reparación de Avance terminó con evidencia visual válida en cuatro tamaños,
pero sus reportes v3 conservaron un `waitSelectorMiss` de calentamiento y
`ok: false`; el gate independiente sustituyó visualmente la captura fría por
una caliente. Eso permitió comprobar el producto, pero no dejó un artefacto
automático canónico completamente verde. Este documento endurece el contrato:
en futuras reparaciones la corrida limpia es obligatoria y el intento frío se
conserva solo como diagnóstico.
