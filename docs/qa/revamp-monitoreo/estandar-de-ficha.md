# Estándar de maqueta del revamp de Monitoreo

Tipo: Contrato de entregable QA
Estado: Vigente
Situación: Vigente (v2, reemplaza la v1 del mismo día)
Fecha: 2026-10-22
Autoridad: pedidos de Gonzalo (2026-10-22): «maquetar el revamp completo con su detalle para que luego los ejecutores no
adivinen»; y, al ver la v1: «muy planas, poco imaginativas, no aprovechan el alto disponible y no se centran en
replantear las secciones o pestañas para que sean más coherentes y ordenadas, con mejores elementos y contenedores de UI
y un repensamiento de cada tipo de monitoreo»; «estos textos sobreexplicativos con enlaces azules son señales claras de
AI slop».

## 0. El revamp parte de lo mejor que ya existe

Pedido de Gonzalo (2026-10-22): «he pasado por muchas otras sesiones donde se han mejorado algunas cosas; no siento que
estés haciendo un revamp y una mejora real». Antes de dibujar una pestaña se hace el **inventario de lo que hoy hace la
app** en ese tema, leyendo el código y viendo la pantalla real: qué columnas, qué filtros, qué detalle por caso, qué
acciones, qué paneles. Ejemplos de capacidades maduras que no pueden perderse: en territorial, el manejo de las cuotas
faltantes por UMP; en telefónico, el control de insistencias caso por caso, con quién tiene asignado cada caso y
cuántos intentos lleva.

Regla de **paridad hacia arriba**: todo lo que la app ya muestra o permite aparece en la propuesta con el mismo o más
detalle, y el `.md` lo prueba con una tabla «capacidad de hoy, dónde queda, qué mejora». Simplificar nunca significa
mostrar menos de lo que el equipo ya usa.

**Realismo operativo** (Gonzalo, 2026-10-22: «ellos no registran observaciones por cada caso, registran de forma
sencilla; no se complican tanto la vida»). La interfaz refleja lo que el equipo de campo de verdad registra y hace, no
un flujo ideal. Antes de diseñar una vista se revisa qué columnas trae la fuente en los estudios reales (la hoja del
barrido, el Kobo telefónico, los partes) y se diseña con eso: no se piden datos que el campo no captura (historia
de llamadas por caso, próximo intento, número marcado en cada intento) salvo que una fuente ya los traiga, ni se
inventan acciones que hoy se hacen en otra herramienta (reasignar o reprogramar se hacen en la hoja del equipo; Monitoreo
lee). Si algo sería útil pero el campo no lo registra, va como propuesta separada en «Decisiones», con su costo para
el equipo, nunca dibujado como si existiera.

Y el **dominio de cada modo se respeta**: las cuotas telefónicas no son geográficas (son perfiles, actores, periodos,
lo que el proyecto declare), así que el telefónico no lleva mapas de cuotas; los mapas son de territorial.

## 1. Primero se repiensa el modo, después se dibuja

Cada modo (acreditación, telefónico, territorial, cursos-horario) empieza por su **arquitectura**: qué necesita ver y
hacer el equipo durante el campo, en qué orden, y qué secciones y pestañas lo sirven. La estructura de hoy es un punto
de partida, no un contrato: se fusionan, separan, renombran, reordenan o retiran secciones y pestañas cuando eso hace el
modo más coherente. Cada cambio de arquitectura dice qué pestaña de hoy absorbe y por qué, en una línea.

El primer tablero de cada lienzo es esa arquitectura: hoy frente a propuesta, como diagrama de piezas sueltas.

**Esqueleto común de cuatro secciones (Gonzalo, 2026-10-22).** Todo Monitoreo, sea del tipo que sea, tiene las
mismas cuatro secciones, en este orden y con estos nombres:

1. **Insumos**: qué bases se usan, cómo se conectan, de dónde se extrae y se lee cada dato, con qué plataformas, y
   quiénes son los actores o públicos del estudio. Todo lo que hay que tener bien relacionado antes de medir.
2. **Modelo**: qué se espera lograr: metas, objetivos y cuotas por la variable que el proyecto declare (sede, actor,
   perfil, periodo, facultad).
3. **Control**: lo que hay que revisar mientras el campo corre: casos por revisar o analizar, cruces que no están
   cruzando como deberían, calidad, correcciones, y la operación propia del modo (llamadas, ocurrencias de campo).
4. **Avance**: cómo vamos y si se cumplen las metas y cuotas.

Lo específico de cada tipo de monitoreo vive como **pestañas dentro de esas cuatro secciones** o como módulos
condicionales, nunca como secciones nuevas. Si un modo cree necesitar una quinta sección, lo justifica en la tabla de
arquitectura y queda como «Falta tu decisión».

**Orden de secciones (regla común, Gonzalo 2026-10-22): sigue el flujo real del operativo.** Primero lo que se
configura (el estudio: fuentes, públicos, metas), después lo que se opera (contacto, casos, campo) y al final la
lectura. **Avance va siempre al final**, nunca primero. Cada sección y cada pestaña justifica su lugar con una línea
en la tabla de arquitectura: qué pregunta del equipo responde y qué pestañas de hoy absorbe.

## 2. Las maquetas son pantallas, no láminas explicativas

- Cada tablero es **una pantalla completa de la app a 1440 × 1000**, con el chrome real, y el contenido **ocupa todo
  el alto** disponible: nada de una franja de tarjetas arriba y vacío abajo.
- **Contenedores y elementos con oficio**: vista maestro-detalle con inspector, tablas densas con columnas numéricas
  alineadas y miniaturas (sparklines, barras en celda), mapas de calor por fecha o por categoría, líneas de tiempo,
  embudos, mapas, paneles laterales, barras de filtros con chips, estados por fila. Elegidos por lo que el dato pide,
  no por variedad.
- **Gráficos dibujados de verdad** (SVG con los datos reales), no rectángulos grises de relleno.
- **Mapas reales**: Monitoreo territorial y Hojas de ruta muestran mapas de verdad, así que la maqueta usa la geometría
  real de la cartografía empaquetada (manzanas y zonas INEI que sirve `api/R/hojas_ruta_engine.R`), con estado por
  manzana, límites, rótulos, leyenda y escala. Nada tapa el mapa; el inspector va al costado.
- **Prioridad (Gonzalo, 2026-10-22): que se vean sumamente bien y con todo el detalle especificado.** Mejor menos
  pantallas excelentes que muchas correctas, sin dejar sin tablero ninguna pestaña de la arquitectura propuesta.
- **Microcopy de producto**: rótulos cortos y cifras. Ningún párrafo que explique la pantalla dentro de la pantalla
  (regla de la casa: no sobreexplicar, ni en la UI). Sin texto en azul subrayado, sin «Ver más →» decorativos, sin
  notas flotantes con prosa.
- **Escritura profesional y elegante** (Gonzalo, 2026-10-22: «pareciera que lo llenaras como contexto por defecto, y
  eso se ve muy mal»). Nada de taquigrafía de notas dentro de la interfaz: ni signos `=` como sinónimo («UMP = una
  manzana titular»), ni flechas `→` en rótulos, ni cadenas de `·` que pegan datos sueltos, ni paréntesis
  aclaratorios, ni abreviaturas improvisadas. Cada rótulo es una frase o un sustantivo bien escrito, como lo
  escribiría un editor: «Unidad de muestreo: una manzana titular». Cada texto se revisa preguntando si un usuario
  exigente lo leería como producto terminado.
- **Interactividad que da control**: las vistas de detalle son exploraciones de verdad. En territorial, por ejemplo,
  al entrar a una UMP se ve su mapa interactivo con cada punto efectivo de Kobo, la hora de cada uno y el recorrido del
  aplicador en esa UMP como historia en el tiempo.
- Las anotaciones, si hacen falta, son marcadores numerados pequeños sobre la maqueta; su contenido vive en el `.md`.
- Variantes y estados (vacío, cargando, preparando, error, sin capacidad declarada) son **tableros propios** o
  alternancias interactivas dentro del tablero, también a pantalla completa.

## 2a. Composición: principios que también obligan a quien construya

Pedido de Gonzalo (2026-10-22): «que los contenedores encajen bien, que sus elementos no choquen, que todo tenga un
espaciado homogéneo y armónico, que aprovechen bien el espacio y que no queden espacios vacíos abajo; deben ser
principios que todos tengan y que los constructores respeten constantemente». Rigen para las maquetas y para el código.

1. **El alto se usa entero.** El área de trabajo es una columna que llena el alto disponible. El último contenedor de
   cada columna crece hasta el borde inferior, con su contenido distribuido o con scroll interno propio. No queda
   una franja vacía de más de 24 px entre el último contenedor y el borde del área. Si una columna tiene menos
   contenido que su vecina, se reparte el espacio entre sus contenedores o se cambia la composición; nunca se deja un
   hueco.
2. **Las columnas vecinas terminan a la misma altura**, y los bordes superiores de los contenedores de una misma fila
   están alineados.
3. **Una sola escala de espacio**: 4, 8, 12, 16, 24 y 32 px. El espacio entre contenedores es siempre el mismo (12 px
   en el área de trabajo) y el relleno interno de todo contenedor también (16 px; 12 px en los compactos). Nada de
   valores sueltos.
4. **Nada choca.** Ningún elemento se superpone a otro sin intención: rótulos de mapa, marcadores, insignias, popovers
   y textos largos se miden con su contenido real. Un texto que no cabe se reescribe o el contenedor se rediseña; no
   se recorta ni se monta sobre el vecino.
5. **Alineación a una retícula.** Los títulos de los contenedores comparten línea base; las columnas numéricas se
   alinean a la derecha con cifras tabulares; los íconos y los textos se centran ópticamente.
5b. **Simetría entre hermanos.** Elementos del mismo tipo puestos lado a lado (tarjetas de cifras, columnas de un
   embudo, filas de una lista) tienen exactamente la misma estructura: el rótulo en la misma línea base, la cifra en la
   misma línea base, la barra con el mismo grosor y a la misma altura, la nota al pie en la misma posición. Si uno de
   ellos lleva una insignia o una línea más, los demás reservan ese espacio o la insignia se mueve a donde no
   desplace nada. Una barra de proporción nunca cambia de grosor para «llenar» su tarjeta.
5c. **Formato de cifras es-PE**: coma para los miles y punto para los decimales («2,296», «35.2 %»), con espacio
   antes del signo de porcentaje y cifras tabulares.
6. **Ritmo y jerarquía constantes.** Los mismos tamaños de título, subtítulo, cifra principal y rótulo en los cuatro
   modos; la cifra protagonista de una pantalla es una sola.
7. **Mismo lenguaje en los cuatro modos**: los mismos contenedores, radios, bordes, sombras, chips, tablas, gráficos y
   estados. Si un modo resuelve algo mejor, se adopta en los demás.

Verificación obligatoria de cada tablero, medida en el render y no a ojo: (a) espacio vacío al pie del área de trabajo
de 24 px o menos; (b) cero superposiciones no intencionales entre cajas de texto, marcadores y contenedores; (c) todos
los espacios entre contenedores y rellenos dentro de la escala; (d) columnas vecinas que terminan a la misma altura con
2 px o menos de diferencia; (e) cero contenidos recortados por overflow; (f) dentro de cada panel sin scroll propio,
24 px o menos entre el último hijo y el borde inferior (el vacío interno cuenta igual que el del pie); (g) ningún
texto con elipsis efectiva y ningún encabezado de tabla partido en dos líneas.

Decisiones de unificación ya tomadas: el switch encendido es azul marino `#002457`; la píldora de estado dice solo
«Al día», «Actualizando, paso N de M», «Falló» o «Preparando», sin repetir la fecha que ya muestra CORTE. Quien construya corre las mismas mediciones en la app con `ui-quick-check` y la geometría
declarada.

## 2b. Un lenguaje de diseño común a los cuatro modos

Pedido de Gonzalo (2026-10-22): aunque los estudios sean distintos, todos los Monitoreos comparten el mismo lenguaje.
Como mínimo:

- **Rail de pestañas a la izquierda que ocupa todo el alto** del área de trabajo, con la **fecha y hora de la última
  actualización al pie** del rail (p. ej. «09/07 · 07:24»), siempre en el mismo lugar.
- **Un botón Actualizar en todos los modos, en el mismo lugar de la cabecera, que explica su proceso**: al abrirlo
  muestra los pasos que va a hacer, en orden y por fuente (qué trae, qué recalcula, cuánto tarda aproximadamente, qué
  no toca), y mientras corre muestra en qué paso va y deja un recibo al terminar. Lo que escribe hacia afuera no está
  aquí: vive en Publicar (L38).
- La misma cabecera, los mismos contenedores, la misma escala tipográfica, los mismos estados (vacío, preparando,
  error) y la misma forma de rotular una cifra con su base. Lo que cambia entre modos es el contenido, no la gramática.

## 3. Datos reales de proyectos reales

Cada modo se maqueta con los `.pulso` de estudios reales, siempre sobre copias de trabajo:

| Modo | Proyectos de ejemplo |
|---|---|
| Acreditación | Acreditación Contabilidad (`ACRDCONTA`) y Acreditación Institucional PUCP 2026 |
| Territorial | ACNUR Comunidad de Acogida (`ACNURCG`) |
| Telefónico | ACNUR PDM Telefónico (`ACNUR_PDM`) y ACNUR PDM CBI |
| Cursos-horario | pendiente de proyecto de ejemplo |

Las cifras, nombres de públicos, sedes, actores, estados y fechas salen de esos proyectos. Si un dato no se puede
obtener, va `—` y la razón queda en el `.md`, nunca una cifra inventada. Los datos personales no aparecen: se usan
conteos, códigos o tokens.

## 4. Un proyecto no gobierna el modo

Una capacidad que solo tienen algunos proyectos (reserva y reemplazos del RMS en Telefónico, Mailchimp en Acreditación,
conectores opcionales) se dibuja como **módulo condicional**: aparece si el proyecto la declara y, si no, no se muestra
ni reserva espacio. El eje de cuota (sede, actor, periodo), los nombres de columnas, la llave de cruce (CodPulso,
proGres, token) y el vocabulario de estados se muestran con el rótulo que declara cada proyecto. Por eso es útil que el
lienzo muestre el mismo tablero con dos proyectos distintos cuando difieren.

## 5. La especificación vive en el `.md`

`docs/qa/revamp-monitoreo/<modo>.md` es lo que lee quien construye:

1. Arquitectura: tabla hoy → propuesta (sección, pestaña, qué absorbe, por qué).
2. Por cada pestaña propuesta, con estos encabezados: **Dirección** (`/monitoreo?modo=…&seccion=…&pestana=…`, id de
   readiness) · **Tablero** · **Reemplaza** (pestañas de hoy y hallazgos del censo o del GOAL que cierra) ·
   **Composición** (bloques de arriba abajo con su geometría) · **Datos** (cada cifra con su origen en el payload o el
   motor y su base) · **Estados** (texto literal de cada uno) · **Capacidad condicional** · **Contrato de Superficie**
   C1–C5 · **Responsive** (1366, 1280, 1024 × 600) · **Archivos** (qué se crea, qué se toca, congelados que no crecen)
   · **Aceptación** · **Decisiones** («Falta tu decisión», con opciones).

## 6. Reglas de oficio

- Tokens reales: carmesí de Monitoreo `#a0464e`, azul `#002457`, fondo `#f3f5f9`, borde `#e2e7f0`, texto `#17212f`,
  éxito `#dcfce7/#166534`, aviso `#fff4e0/#8a5000`, peligro `#fef2f2/#991b1b`, más la escala de grises del tema.
- Decisiones vigentes: sin tema oscuro; todo booleano es un switch; el rail de pestañas se queda; un verbo por
  dirección en los botones (L38); Telefónico y Acreditación siguen independientes.
- Contraste de 4.5:1; controles reales (`<button>`, `<input>`); íconos como SVG de trazo, nunca emoji.
