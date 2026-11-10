# Plan: rediseño de Procesamiento (Carga, Validación, Codificación y Analítica)

Tipo: Plan y checklist de diseño
Estado: En curso
Fecha: 2026-11-10
Autoridad: pedido de Gonzalo del 2026-11-10. Las decisiones de la sección 9 son suyas; nada de este plan se implementa hasta que las resuelva. Solo Gonzalo da por terminado un ítem

Prototipo con el CSS real de la app: https://claude.ai/artifact/S82u2QNoLCagBVTWiYN5VY (privado). Doce pantallas, verificadas a 1440×1000 y 1280×720 sin desbordes. No se tocó código de la app.

## 1. Checklist del pedido

| # | Indicación de Gonzalo | Dónde queda resuelta | Estado |
|---|---|---|---|
| 1 | Revisar la función actual de todo el módulo | Sección 2 (inventario de las cuatro secciones, 27 pestañas, 16 paneles y sus endpoints) | hecho, por revisar |
| 2 | Definir bien las pestañas de cada sección | Sección 5 (mapa hoy y propuesto, con la pregunta que responde cada pestaña) | mapa aprobado (2026-11-10) |
| 3 | Rediseño visual completo | Sección 4.7 y prototipo (doce pantallas, diez de 22 pestañas) | en curso: Codificación completa; faltan doce pestañas |
| 4 | Ordenamiento conceptual más claro | Secciones 4 y 5 | propuesto |
| 5 | Propuesta profunda, no un acomodo | Secciones 3 a 6 (cambia qué vive dónde, no solo cómo se ve) | propuesto |
| 6 | Todas las secciones y pestañas menos Gráficos | Sección 5 | propuesto |
| 7 | Cubrir los escenarios reales: fuentes de formato distinto, actualizar una fuente, tipos de base, multibase | Sección 6 y prototipo "Carga, actualizar una fuente" | propuesto, espera D7 y D8 |
| 8 | En línea con los demás módulos, sin romper sus conceptos | Sección 7 | propuesto |
| 9 | Coherente consigo mismo | Sección 4 (columna común de las cuatro secciones) | propuesto |
| 10 | Calidad de contenedores: definición, márgenes y botones | Sección 8.2 (contrato de geometría) y las doce pantallas del prototipo | rehecho, por revisar |
| 11 | Dinámicas que se conservan y suben de nivel (arrastre de Codificación y otras) | Sección 8.1 y prototipo "Codificación, Codificar" | propuesto |
| 12 | Entregables de Analítica con orden, agrupación, síntesis y recorrido | Sección 5.4 y prototipo "Analítica, Entrega" | propuesto, espera D5 |
| 13 | Sin acordeones: bloques a la vista | Sección 8.2 y prototipo "Carga, Equivalencias" | propuesto |
| 15 | Codificación: las cuatro pestañas maquetadas, con mejores contenedores | Prototipos "Codificación, Preguntas", "Codificar", "Matrices" y "Aplicar" | hecho, por revisar |
| 14 | El plan automático del formulario, los casos a revisar por combinaciones sospechosas y su paso al panel de decisión, claro y bien resuelto | Sección 5.2 y prototipos "Validación, Reglas" y "Validación, Hallazgos" | propuesto, espera D3 |

## 2. Qué se revisó y cómo

- **Código**: las cuatro secciones completas (pestañas, navegación interna no declarada, paneles, capacidades y endpoints), el kit compartido y su adopción, los conceptos de los otros seis módulos, el ciclo de vida de una fuente en el backend y las dinámicas de interacción. Seis lecturas independientes, todas con cita de archivo y línea.
- **Pantalla**: 26 capturas del proyecto de referencia `acnur_acg` (una base desde archivo) y 63 más sobre copias de trabajo de siete estudios reales, elegidos por lo que cubren. Las copias viven fuera del repo. Se leyeron en imagen unas 35; las demás quedaron como respaldo y falta leerlas al maquetar cada sección.

| Escenario | Qué muestra |
|---|---|
| Nueve hermanas independientes de SurveyMonkey | Asistente de familia, actualización por plataforma, aprobación por base |
| Cuatro bases separadas con serie 2021 a 2026 | Equivalencias, segmentos, comparativos |
| Tres bases desde formulario publicado con SAV | El lazo con Formularios |
| Una base de Kobo traída de Monitoreo con hija de grupo repetido | Bases derivadas, universo |
| Una base con codificación aplicada | El recorrido completo hasta Analítica |
| Una base con columnas anexadas, variables calculadas y ponderación | Lo que hoy vive tras "Variables" |
| Dos olas de un mismo estudio | Tablas entre bases y base panel |

No se pudo ver en pantalla: una base integrada (ningún estudio en disco la usa) ni una auditoría con hallazgos reales (los proyectos guardados reabren sin la evaluación).

## 3. Diagnóstico

Siete causas, de la más estructural a la más visible.

**3.1 Las pestañas siguen la historia del motor, no la pregunta del analista.** Carga › Fuentes son cuatro pantallas distintas según cómo se relacionan las bases; con nueve hermanas la lista de bases no entra en la primera pantalla porque la preceden cinco bandas de contexto y un asistente de cuatro pasos. Validación › Reglas del formulario contiene tres pasos apilados. Analítica tiene trece pestañas en fila sin agrupar, y ocho de ellas mezclan preparar la base con generar un archivo. Frecuencias y Cruces no muestran ninguna tabla: son formularios que descargan un Excel.

**3.2 La misma decisión se toma en varios lugares.**

| Decisión | Dónde se toma hoy |
|---|---|
| Qué casos cuentan | Carga › Revisión (universo), reglas de respuesta efectiva del asistente de SurveyMonkey, Validación › Reglas (identidad y validez), Analítica (panel "Qué casos cuentan"), Validación › Cierre (excluir) |
| Columnas fuera del formulario | Carga › Revisión ("Variables extra") y panel "Variables de la base" |
| Si una lista es ordinal | Analítica › Orden de categorías y Analítica › Bases, tras un plegable (medida para SPSS) |
| Descargar la base | Carga › Fuentes, Validación › Cierre y Analítica › Bases |
| Tratamiento de un hallazgo | Al crear el criterio y otra vez al decidir; la lista de ocho tratamientos está escrita tres veces |
| Periodo de campo y duplicados | "Controles operativos" y dos tipos de criterio |

**3.3 El tipo de estudio cambia pantallas enteras en vez de cambiar datos.** No hay una base activa común: Carga tiene tres selectores sin sincronizar, Validación y Codificación usan un componente, Analítica y Gráficos otro. Con nueve bases Analítica muestra tres selectores a la vez y Validación rotula "Base única". Las hijas de un grupo repetido cuentan como bases: un Kobo con un repeat se trata como estudio de varias bases y abre "Comparativos".

**3.4 Actualizar una fuente es el punto más frágil del módulo.** Hay nueve caminos y cada uno existe solo en cierto tipo de estudio u origen: refrescar SurveyMonkey o Kobo solo en hermanas; una base nacida de formulario publicado no tiene ninguno. Solo tres muestran qué va a cambiar antes de aplicar. Al aplicar se borran el plan, la auditoría, los criterios propios, las variables fuera de auditoría y el borrador de limpieza; el aviso de "Nueva versión" solo menciona la limpieza. Después, Analítica vuelve a preparar en silencio y Gráficos no avisa. No existe "al día": las marcas por base significan "algo se hizo".

**3.5 No hay vista de conjunto.** El avance del Home es global, no por base; `/procesamiento` redirige con otras banderas; la banda usa una tercera definición. El estado por base y por fase que el backend ya publica solo se dibuja como cinco puntos dentro de un desplegable, y solo en hermanas.

**3.6 El vocabulario choca.** "Fuente" es la pestaña, una encuesta dentro de una base y, en "Comparar fuentes", una base. La misma estrategia se llama "Hermanas independientes", "Fuentes independientes" y "Mantener bases separadas" según la pantalla. "Recodificar" nombra tres cosas. La pestaña "Cierre de base" se titula por dentro "Limpieza y transformación"; "Preparar" se llama "Organizar" en los botones. Se muestran términos del motor ("Solitaria", "Auto", "Respaldo disponible si el motor principal no está").

**3.7 La composición no acompaña.** Cuatro patrones de cabecera en un módulo. Lienzos con una tarjeta y el 80 % vacío junto a otros saturados de prosa. 25 plegables en Carga. Cajas con receta propia: 258 en Carga, 60 en Analítica, 45 en Validación, 40 en Codificación. Estilos en línea: 452 en Validación, 390 en Analítica, 246 en Codificación. Siete `window.confirm`. Ningún atajo visible en todo el módulo.

## 4. Concepto

Un principio, el mismo que se aprobó para Gráficos: **cada pestaña responde una pregunta del analista y cada decisión vive en un solo lugar.** Sobre él, una columna común a las cuatro secciones.

**4.1 Un solo modelo: el estudio tiene bases y cada base tiene fuentes.** La relación entre bases (una, separadas, integrada, independientes) es un dato declarado del estudio, no una pantalla. Una base se dibuja siempre igual, venga de donde venga. Las hijas de un grupo repetido van anidadas bajo su madre y no cuentan como bases.

**4.2 Una base activa, en un solo lugar.** Zona de contexto de la banda del módulo (la zona izquierda del chrome de tres zonas, ADR 0042): selector de base y, a su lado, los casos que cuentan con su denominador ("288 de 293"). Reemplaza los cinco selectores actuales. La base entra a la dirección como alcance (`base=`), igual que `campana` en Material y `ciudad` en Hojas de ruta.

**4.3 Un vocabulario de estado, con causa.** Por iniciar, En curso, Al día, Requiere atención y Desactualizada. "Desactualizada" siempre dice qué cambió y cuándo. Lo usan las píldoras de sección (para la base activa), el riel, la cabecera, el Home y la vista de conjunto. Se calcula con huella, generalizando lo que ya hace la aprobación para informe de las hermanas.

**4.4 Estado del estudio.** `/procesamiento` deja de redirigir y pasa a ser la vista de conjunto: una matriz de base por fase con su dato, la lista de lo que falta en orden, los cambios recientes y los archivos del estudio.

**4.5 Un solo flujo para actualizar una fuente.** Tres pasos para cualquier origen y cualquier tipo de estudio: leer la fuente, qué cambia (en las respuestas, en el formulario y en el trabajo ya hecho, fase por fase: qué se conserva y qué hay que rehacer) y aplicar. Se guarda una copia para volver.

**4.6 Los casos de la base, en una sola cadena.** Recibidos, pruebas y parciales fuera, excluidos en limpieza, cuentan. Cada eslabón se decide en su lugar natural, pero la cadena completa se lee en un panel único abierto desde la cifra de la banda.

**4.7 Cuatro disposiciones y una cabecera.**

| Disposición | Para qué | Pestañas |
|---|---|---|
| Colección con inspector | Objetos del estudio | Bases |
| Mesa de tres columnas (lista, detalle, decisión o ajustes) | Recorrer muchos ítems | Explorar, Reglas, Hallazgos, Preguntas, Codificar, Variables, Categorías, Frecuencias, Cruces, Entrega |
| Tabla | Consultar datos | Formulario, Respuestas |
| Recorrido por pasos | Flujos largos con un final | Agregar base, Actualizar fuente, Dimensiones, Ponderación |

Cabecera única (`TabHeading`): sección, título, estado y cifras con denominador. Sin "pestaña n de m": las pestañas no son pasos. Reglas de composición: datos reales en el primer viewport; ninguna frase que explique lo que la vista ya muestra; ajustes a la vista con el Switch del kit, sin plegables; toda generación termina en el contenedor de archivo con su estado; todo trabajo largo con avance y cancelación; todo panel con dirección.

## 5. Mapa de pestañas

### 5.1 Carga

| Hoy | Propuesto | Pregunta que responde |
|---|---|---|
| Plan | se integra en Bases | |
| Fuentes | **Bases** | ¿Qué bases tiene el estudio y de dónde viene cada una? |
| Revisión | **Revisión** | ¿La carga quedó bien? |
| panel "Variables de la base" | **Variables** | ¿Qué columnas tiene la base además del formulario? |
| Equivalencias (condicional) | **Equivalencias** (condicional) | ¿Cuál es la misma pregunta en cada base? |
| Estructura | **Formulario** | ¿Qué pregunta el formulario y con qué lógica? |
| Datos | **Respuestas** | ¿Qué trae la base? |

- **Bases** absorbe Plan y las cuatro variantes de Fuentes. La relación entre bases es una línea declarada arriba. Cada base muestra sus fuentes (una o varias, de cualquier formato), su formulario y sus casos. "Agregar base" es un solo recorrido por pasos con seis orígenes; los asistentes de hermanas y de integración pasan a ser ese mismo recorrido con varias bases a la vez.
- **Revisión** queda solo con lo que bloquea o pide decisión: mapeo de códigos, emparejamiento entre fuentes, cambios de la última actualización. El universo pasa a la cadena de casos (4.6) y la base preparada fuera pasa a ser un dato de la base, en su inspector.
- **Variables** saca a la luz lo que hoy está tras un botón y solo en bases separadas: columnas fuera del formulario (un solo lugar), columnas anexadas, variables calculadas, "ya viene codificada".
- Formulario y Respuestas van en un segundo grupo del riel, de consulta.

### 5.2 Validación

| Hoy | Propuesto | Pregunta que responde |
|---|---|---|
| Explorar respuestas | **Explorar** | ¿Cómo respondió la gente? |
| Reglas del formulario, paso 1, y Criterios de revisión | **Reglas** | ¿Qué se va a comprobar? |
| Reglas del formulario, pasos 2 y 3, y la cola de Cierre | **Hallazgos** | ¿Qué encontró la auditoría y qué hago con cada cosa? |
| Cierre de base | **Cierre** | ¿Qué cambia en la base y está lista? |

- **Reglas**: un catálogo con tres orígenes (del formulario, del operativo, propias), un interruptor por regla y un editor único en panel con dirección. Los controles operativos dejan de duplicar tipos de criterio.
- **Hallazgos**: una sola auditoría (hoy hay dos botones de ejecutar para una misma evaluación) y una mesa de cola, casos y decisión, con la geometría de Monitoreo › Control › "Por resolver". El tratamiento se elige una vez.
- **Cierre**: efecto de las decisiones, cadena de casos, "Cerrar la base", archivos del cierre y paquete metodológico (que hoy está entre los botones de preparar el plan).

**Del plan automático a la decisión** (Gonzalo, 2026-11-10: cómo se integra el plan de consistencia del instrumento con los casos a revisar por combinaciones sospechosas, y cómo llega todo al panel de decisión). Hoy son dos pestañas, dos botones de ejecutar y dos listas de tratamientos, y solo se juntan en la cola de Cierre. La propuesta:

1. Una franja en Reglas dice el recorrido con sus cifras: tres orígenes (del formulario, que se arma solo; del operativo; propias), una auditoría, dos clases de resultado y una cola.
2. Las dos clases son las que ya introduce `ClasificacionHallazgo`: **inconsistencia** (la respuesta contradice al formulario) y **caso a revisar** (posible, pero conviene mirarlo). Las reglas del formulario producen inconsistencias; las del operativo y las propias declaran cuál producen.
3. Cada regla declara su **tratamiento previsto**. Llega marcado al panel de decisión con la etiqueta "Previsto en la regla" y se puede cambiar caso por caso. Se elige una vez.
4. Las sugerencias que salen de mirar la base se añaden desde Reglas, en un bloque a la vista.
5. Hallazgos muestra las dos clases en una sola cola, con su conteo, y la misma mesa de decisión para ambas.

### 5.3 Codificación

| Hoy | Propuesto | Pregunta que responde |
|---|---|---|
| Preparar | **Preguntas** | ¿Qué se codifica y por qué camino? |
| Codificar | **Codificar** | ¿Qué código lleva cada respuesta? |
| Matrices | **Matrices** | ¿Qué se codificó en Excel? |
| Adaptación | **Aplicar** | ¿Qué cambia en la base? |

- **Preguntas**: tabla con inspector en vez de tarjetas. El camino (en la app, en Excel, no se codifica) es un dato de cada pregunta. El emparejamiento por arrastre se conserva y sube de nivel (8.1).
- **Codificar** y **Matrices** dejan de numerarse como pasos: son caminos alternos que confluyen en Aplicar.
- **Aplicar** reúne los archivos (respuestas adaptadas, formulario adaptado, matriz para el cliente, auditoría, respaldo) que hoy están repartidos entre Matrices y Adaptación. El término de la unidad es "código" en las cuatro pestañas.
- Se retira la ruta `/codificacion/preguntas/:parent`, que nada enlaza.

### 5.4 Analítica

| Hoy (13) | Propuesto (8) | Grupo |
|---|---|---|
| Datos | **Variables** | Preparación |
| Orden de categorías, códigos especiales (hoy en Libro de códigos), medida para SPSS (hoy en Bases) | **Categorías** | Preparación |
| Dimensiones | **Dimensiones** | Preparación |
| Ponderación | **Ponderación** | Preparación |
| Frecuencias | **Frecuencias** | Tablas |
| Cruces | **Cruces** | Tablas |
| Tablas multibase, Comparativos, "Unir bases", Base panel | **Comparativos** (condicional) | Tablas |
| Base final, Bases e instrumentos, Libro de códigos, Ficha técnica | **Entrega** | Entrega |

- El riel se ordena por dependencia y en tres grupos con separador. Hoy Orden de categorías y Dimensiones van al final aunque Frecuencias y Cruces dependen de ellas.
- **Frecuencias** y **Cruces** muestran la tabla tal como sale en el archivo, con los ajustes al lado y el archivo debajo.
- **Entrega** es la síntesis que hoy falta: los ocho entregables de la base en orden y en tres grupos (base de datos, documentación, tablas), cada uno con su estado, con qué se construye y sus archivos. "Generar lo que falta" y "Armar el paquete" actúan sobre todos.
- **Comparativos** muestra la variante que corresponde a la relación entre bases declarada en Carga. La base panel pasa a ser una base derivada más, con lo que deja de duplicar libro de códigos, frecuencias, cruces y ficha.
- Los tres controles de la cabecera actual se reparten: la versión de la base (original o codificada) va con el selector de base; la plantilla pasa al menú de acciones; "Cuentan N casos" es la cifra de la banda.

## 6. Escenarios

| Escenario | Cómo lo resuelve la misma estructura |
|---|---|
| Una base desde archivo | Bases con una tarjeta; sin selector en la banda |
| Bases separadas por público | Una tarjeta por base; Equivalencias y Comparativos aparecen |
| Hermanas independientes | Igual, más la aprobación para informe en Estado del estudio |
| Base integrada | Una tarjeta con varias fuentes y su emparejamiento |
| Dos fuentes de formato distinto en una base | Dos líneas de fuente en la tarjeta; "Cómo se unieron" en el inspector |
| Hija de grupo repetido | Fila anidada bajo la madre; no cuenta como base |
| Formulario publicado | Origen en "Agregar base"; la revisión se ve en el inspector |
| Traída de Monitoreo | Origen en "Agregar base" |
| Base limpiada fuera | Dato de la base en su inspector |
| Serie de mediciones | Equivalencias en Carga y Comparativos en Analítica |
| Actualizar cualquier fuente | Un solo flujo de tres pasos (4.5) |

## 7. Coherencia con los demás módulos

| Concepto | Pieza que ya existe y se reutiliza |
|---|---|
| Alcance en la dirección | `campana` (Material) y `ciudad` (Hojas de ruta); se suma `base` |
| Conectar un origen | Monitoreo "Conectar fuente": piezas en orden, con estado y verificación |
| Cola de decisiones | Monitoreo acreditación › Control › "Por resolver" (`panel=caso&foco=`) |
| Entrega | Sección "Entrega" de Cálculo, Material y Hojas; aquí es pestaña y grupo |
| Archivos | Contenedor de archivo, bandeja y nombres del ADR 0133 |
| Lista con inspector | `PulsoTable` con `?foco=` |
| Pasos internos | `StageStepper`, nunca junto a numeración de secciones |
| Estados | Los del Home, más "Desactualizada" |

Límites que se respetan: cinco niveles de navegación; chrome de tres zonas y una fila; riel de 56 px siempre presente; toda vista enlazable; `PageFrame` con disposición y dueño de scroll; Contrato de Superficie; datos en la secuencia navy; booleanos con Switch. Procesamiento no gana "modo": la relación entre bases es un atributo, no un juego de secciones distinto.

## 8. Dinámicas y contenedores

### 8.1 Dinámicas que se conservan y suben de nivel

| # | Hoy | Propuesta | Pieza existente |
|---|---|---|---|
| 1 | Emparejar preguntas por arrastre: fantasma con giro, sin destinos señalados, sin deshacer | Destinos válidos visibles al levantar, inválidos atenuados, fantasma que se asienta, "Deshacer" | `fantasma.ts` de Formularios, `--drag-valid-*`, toaster |
| 2 | Asignar respuestas a un código de una en una, con casilla | Selección múltiple, arrastre del lote con contador, tecla del código, "Deshacer" | `seleccionVistaGeneral.ts`, `BarraSeleccion` |
| 3 | Deshacer: un nivel o ninguno | Cmd+Z en Codificar, Hallazgos y Analítica | `historialAgrupado.ts` |
| 4 | Reordenar con flechas, sin movimiento | Reordenar con FLIP y Alt+flecha | `flip.ts`, `OrdenCategoriasGrafico` |
| 5 | Dos editores de orden casi iguales | Uno | |
| 6 | Arrastre como única vía en Dimensiones | Alternativa por teclado | `sortableKeyboardCoordinates` |
| 7 | Atajos sin rótulo | Atajos visibles junto al botón y ayuda con "?" | `lib/teclado.ts`, `ShortcutsModal` |
| 8 | Siete `window.confirm` | Diálogo del kit | `Dialog` |
| 9 | Cuatro progresos distintos | Uno, con cancelación | `JobProgress`, contenedor de archivo |
| 10 | Tres tablas más `<table>` a mano | `PulsoTable` | |
| 11 | 61 `select` nativos | `PulsoSelect` y el combobox de Equivalencias | `PreguntaCombobox` |
| 12 | Lista de respuestas sin virtualizar | Virtualizada | `PulsoTable` |

El arrastre de Codificación hoy existe solo en Preparar. El prototipo lo lleva también a Codificar, que es donde se hace el trabajo repetitivo.

### 8.2 Contenedores

Gonzalo (2026-11-10), sobre la primera versión del prototipo: "a los contenedores aún les falta mejor definición, márgenes más profesionales, algunos botones se muestran mejor centrados; cuando te digo mejorar es mejorar: veo cambios de disposición, pero no mejoras visuales". El prototipo se rehízo con este contrato, recuperado de `tokens.css`:

| Regla | Valor |
|---|---|
| Espacios | Solo la escala 4, 8, 12, 16, 20, 24, 32. Entre paneles, 16 |
| Riel interior | 20 px en todo panel: título, filtros, primera columna de la tabla, texto de las listas y pie caen sobre la misma línea |
| Panel | Radio 14, borde de 1 px, sombra suave. Cabecera de 52 con línea inferior: ícono en tesela de 28, título de 15, conteo en píldora y acciones a la derecha en la misma fila |
| Pie de panel | Fondo un tono más bajo y línea superior. La acción principal ocupa el ancho, centrada, a 36 de alto y con su atajo dentro; la secundaria a su izquierda |
| Segundo nivel | Pozos de radio 10 sin sombra para cifras, opciones y sugerencias. Nunca una caja con sombra dentro de otra |
| Tablas | Cabecera de 36 con fondo, filas de 44, selección de borde a borde |
| Listas | 8 de margen y 12 de relleno, radio 10, selección con relleno y borde del acento |
| Letra | 11 rótulo, 12 dato secundario, 13 cuerpo, 15 título de panel, 18 objeto, 21 cifra. Sin tamaños intermedios |
| Punteado | Solo donde se suelta o se agrega algo |

Al implementar, el contrato se cumple con las primitivas del kit (`Panel`, `PulsoButton`, `PulsoTable`) y se declara como geometría C1 de cada superficie; lo que el kit no tenga (pie de panel, pozo, conteo en píldora) entra primero al kit.

Una receta: el `Panel` del kit (radio 14, borde de 1 px, sombra suave). Dentro, filas separadas por una línea; nada de caja dentro de caja. Sin franja de acento a la izquierda, sin borde punteado salvo en zonas donde se suelta algo o en vacíos.

**Sin acordeones** (Gonzalo, 2026-11-10: "estos acordeones no me gustan nada, prefiero que sea un bloque elegante", sobre "¿Qué es armonizar?" de Equivalencias). Hoy hay 34 `<details>` en las cuatro secciones (25 en Carga). Cada uno se resuelve de una de dos formas: si el contenido hace falta, pasa a un bloque a la vista dentro del inspector o del panel, con un ejemplo dibujado y no un párrafo; si solo explica lo que la vista ya muestra, se retira. En Equivalencias la explicación de armonizar pasa a ser el inspector de la fila: las escalas de cada base y la escala común, dibujadas. Guard: un contrato que falla si aparece `<details>` o `Collapsible` en las cuatro secciones, con el caso que lo pone rojo. Meta de los ratchets `cajasPropias`: bajar a cero por sección al rediseñar cada una, y extender el detector a Validación y a los estilos en línea.

## 9. Decisiones

Aprobadas por Gonzalo el 2026-11-10 ("sí" al mapa de pestañas con las recomendaciones D1 a D11). D9 queda por definir con él porque es cambio de motor; D5 se resuelve con una sola pestaña "Entrega".

| # | Decisión | Recomendación |
|---|---|---|
| D1 | Carga: retirar la pestaña Plan e integrarla en Bases | Sí |
| D2 | Carga: promover "Variables" a pestaña y renombrar Estructura y Datos a Formulario y Respuestas | Sí |
| D3 | Validación: unir reglas del formulario, del operativo y propias en "Reglas", y la auditoría con la cola en "Hallazgos" | Sí |
| D4 | Codificación: nombres "Preguntas" y "Aplicar" | Sí; los archivos conservan "adaptada" |
| D5 | Analítica: una pestaña "Entrega" en vez de cuatro pestañas de entregables | Sí; alternativa: tres pestañas (Base de datos, Libro de códigos, Ficha técnica) |
| D6 | Analítica: unir Tablas multibase, Comparativos y Base panel en "Comparativos" | Sí, con la base panel como base derivada (toca el ADR 0017) |
| D7 | `/procesamiento` como "Estado del estudio" en vez de redirigir | Sí |
| D8 | Al actualizar una fuente, conservar criterios propios y variables fuera de auditoría cuando solo cambian las respuestas | Sí; hoy se borran |
| D9 | Permitir fuentes de formato distinto dentro de una base separada (hoy solo SurveyMonkey con SurveyMonkey o base integrada) | A definir contigo: es cambio de motor |
| D10 | Que la Ficha del estudio proponga la relación entre bases | Sí, como sugerencia editable |
| D11 | Dónde se declaran identidad del caso y recopilador | Carga › Variables, como roles de la base |

## 10. Fases

| # | Fase | Contenido | Depende de |
|---|---|---|---|
| F0 | Limpieza | Código que nadie monta, vocabulario, `window.confirm`, copys con estudios concretos | nada |
| F1 | Columna común | Base activa única con `base=`, estados con causa, cabecera, Estado del estudio | D7 |
| F2 | Carga | Bases, Agregar base, Actualizar fuente, Variables | D1, D2, D8, D9 |
| F3 | Validación | Reglas, Hallazgos, Cierre | D3, D11 |
| F4 | Codificación | Preguntas, Codificar con arrastre, Aplicar | D4 |
| F5 | Analítica | Riel en grupos, Categorías, tablas con vista, Entrega, Comparativos | D5, D6 |

Cada fase cambia claves de pestaña: las viejas se leen como alias y no se escriben, como se hizo con Gráficos. Las fases F2 a F5 necesitan su maqueta por pestaña antes de implementarse.

## 11. Pendiente

- Maquetas de las doce pestañas que no están en el prototipo: Revisión, Variables (Carga), Formulario, Respuestas, Explorar, Cierre, Variables (Analítica), Categorías, Dimensiones, Ponderación, Frecuencias y Comparativos.
- Ver en pantalla una base integrada y una auditoría con hallazgos reales.
- Confirmar en el motor cómo se combinan el universo de Carga y "Qué casos cuentan" de Analítica antes de dibujar la cadena de casos.
