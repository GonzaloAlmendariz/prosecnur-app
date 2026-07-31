# Auditoría integral del interventor universitario por cursos-horario

Tipo: Auditoría QA fechada
Estado: Reemplazado
Fecha: 2026-07-13
Autoridad: Evidencia histórica; conserva referencias locales transitorias de la auditoría original
Reemplazado por: [Auditoría de cumplimiento del ADR 0019](auditoria-adr-0019-cursos-horario-2026-07-30.md)

**Fecha:** 13 de julio de 2026  
**Proyecto de referencia para QA:** HSVG2026 (lectura y prueba sin guardar)  
**Estado:** reparación implementada y validada; queda abierto únicamente el pendiente metodológico señalado en §7

## Scope lock

- **Módulo afectado:** Cálculo de muestra y marco muestral, recorrido universitario por cursos-horario.
- **Archivos previstos:** componentes y estilos del toolbar persistente, resumen del diseño, criterios del marco y textos visibles del recorrido universitario; pruebas directamente asociadas; este informe.
- **Fuera de alcance:** navegación global de Prosecnur, contratos persistidos `.pulso`, nombres internos de rutas/tipos/campos `aula*`, el perfil histórico congelado de monitoreo y cualquier guardado del proyecto HSVG2026.
- **Fuente de verdad:** marco construido por el motor R para cifras duras; estimación viva del dominio de criterios para cambios aún no reconstruidos; unidad muestral `curso-horario` (`cursos-horario` en plural).
- **Riesgo principal:** presentar como cifra dura un conteo provisional o romper compatibilidad al renombrar identificadores internos.
- **Validación mínima:** typecheck, suite frontend, revisión de diferencias, verificación visual real a 1920 y 1280 px y comprobación de que HSVG2026 no fue guardado.
- **Regla de parada:** una sola cabecera persistente y legible en las cinco secciones, sin resúmenes redundantes en pestañas; cada criterio ocupa una fila completa con opciones autocontenidas; sin overflow global ni errores de página/API; pruebas aplicables en verde; pendientes metodológicos documentados sin presentar supuestos como hechos.

## Contrato de la cabecera persistente

La cabecera del módulo distinguirá seis magnitudes:

1. universo de estudiantes;
2. universo de cursos-horario;
3. estudiantes elegibles;
4. cursos-horario elegibles;
5. muestra objetivo;
6. sobremuestra operativa.

Las dos cifras de universo proceden de la base y no cambian al editar criterios. Las dos cifras de elegibles reaccionan a la selección: se identifican como **estimación** mientras el marco duro no haya sido reconstruido. La muestra y la sobremuestra proceden del motor reactivo del diseño. Este bloque se conserva al navegar entre Datos, Marco, Cálculo, Selección y Entrega.

## 1. Resultado ejecutivo

La revisión concluye que el módulo tiene una base metodológica suficientemente general para intervenir cursos-horario en cualquier estudio universitario, no solo en HSyVBG/hostigamiento. El recorrido ya separa: definición del estudio, bases, población, marco de cursos-horario, cálculo, selección, reemplazos, entrega y monitoreo. La generalidad dependía, sin embargo, de corregir tres problemas de presentación y contrato:

1. La interfaz seguía llamando “aulas” a la unidad muestral, mezclándola con el salón físico.
2. La suite de criterios distribuía tarjetas en columnas desiguales; al forzarlas luego a ancho completo, las opciones quedaron desconectadas de sus conteos y aparecieron grandes vacíos.
3. Las cifras de universo, elegibles, muestra y sobremuestra estaban repartidas entre pestañas, sin una cabecera persistente que permitiera saber en todo momento sobre qué diseño se estaba trabajando.

La reparación establece una gramática única:

- **curso-horario** es la unidad de muestreo;
- **cursos-horario** es el plural;
- **salón** se reserva para la ubicación física;
- la cabecera persistente diferencia universo, elegibles y operación;
- cada criterio ocupa una fila completa, pero sus categorías se organizan en una retícula compacta de opciones autocontenidas;
- el código visible de una unidad es `CH`, sin alterar identificadores persistidos o contratos históricos.

## 2. Fuentes revisadas

La auditoría contrastó la aplicación con dos repositorios documentales
externos, no versionados con Prosecnur. Sus rutas locales se omiten para que
este informe sea portable:

- `Documentación Definitiva HST`, especialmente cifras canónicas, población
  versus unidad, criterios, marco, cálculo, comparación por años, auditorías y
  formatos DTI.
- `Diseño Muestral PUCP — 2 escenarios (2025–2026)`, incluyendo el Excel de
  dos escenarios, la metodología DOCX/PDF, la base ponderada 2025 y la sintaxis
  de proporción de éxito.

Los documentos de control más relevantes fueron:

- `02 · Cifras canónicas.md`;
- `03.4 Aulas y marco muestral.md`;
- `03.6 Cálculo de muestra y de aulas.md`;
- `04.7 Auditoría de granularidad y llave curso-horario.md`.

La última contiene la demostración cuantitativa completa de los dos hallazgos metodológicos tratados aquí. Este informe no sustituye esa evidencia: la conecta con el comportamiento y el contrato de Prosecnur.

## 3. Evaluación metodológica del interventor general

### 3.1 Qué representa

El módulo diseña una intervención universitaria donde la representatividad se define sobre estudiantes, pero el operativo selecciona conglomerados observables: cursos-horario. No presupone un tema sustantivo. HSyVBG 2026 funciona como proyecto de referencia y calibración, no como ontología del producto.

La secuencia canónica queda así:

```text
universo de estudiantes
  → criterios de estudiante
  → estudiantes elegibles (N)
  → universo de cursos-horario
  → criterios de curso-horario
  → marco elegible
  → muestra y sobremuestra
  → asignación por estratos
  → selección probabilística de cursos-horario
  → reservas y reemplazos
  → aplicación, monitoreo y cierre
```

### 3.2 Qué ya es generalizable

| Capa | Evaluación | Evidencia funcional |
|---|---|---|
| Definición | Adecuada | Título, cliente, alcance, etapa y fuente esperada no imponen hostigamiento. |
| Ingesta | Adecuada | Acepta base madre o modelo multibase y obliga a mapear variables reales. |
| Población | Adecuada | Formación, condición, edad, ciclo/nivel y facultad se configuran desde categorías observadas. |
| Marco | Adecuada | Modalidad, sesión, docente, nivel del curso, matriculados y mínimo de elegibles son criterios configurables. |
| Cálculo | Adecuada con advertencia | Confianza, error, proporción, `deff`, sobremuestra y distribución están desacoplados del tema del estudio. |
| Selección | Adecuada | Compara sistemático-PPS, balanceado, balance + dispersión y pool controlado. |
| Campo | Adecuada | Distingue titulares, reservas, cadenas, agenda, QR/fichas y monitoreo. |
| Auditoría | Adecuada | Conserva semilla, huella del marco, probabilidades, pesos, balance y memoria de decisión. |

### 3.3 Condiciones para usarlo en otro proyecto

Un estudio nuevo debe declarar, sin heredar supuestos de HSVG:

- población que quiere representar;
- criterios de elegibilidad del estudiante;
- variables de estratificación y tolerancias;
- definición operativa de curso-horario;
- filtros del marco;
- tamaño de muestra o parámetros para calcularlo;
- rendimiento esperado por curso-horario;
- método de selección y profundidad de reservas;
- reglas de campo y monitoreo.

El módulo no debe asumir que “primer ciclo”, mayoría de edad, formación pregrado o condición regular son universales. En HSVG son decisiones del proyecto; en otro estudio se conservan, cambian o desactivan explícitamente.

## 4. Contrato terminológico

| Concepto | Forma visible correcta | Uso |
|---|---|---|
| Unidad singular | `curso-horario` | Una combinación específica de curso y horario. |
| Unidad plural | `cursos-horario` | Conjunto o marco de unidades. Nunca `cursos-horarios`. |
| Lugar físico | `salón` | Ubicación donde se dicta la sesión; no es llave por sí misma. |
| Código operativo | `CH 001`, `CH 002`… | Presentación visible; los valores históricos `AULA …` se normalizan al mostrar. |
| Identificadores internos | `aula*`, `classroom*` | Se conservan cuando forman parte de schemas, tipos, rutas o compatibilidad `.pulso`. No deben filtrarse a la interfaz. |

Este contrato se aplicó al recorrido activo de cálculo, selección, reemplazos, entregables, recopiladores y perfil actual de monitoreo. Los nombres internos no se migraron porque hacerlo sería un cambio de esquema distinto y de mayor riesgo.

## 5. Reparación de la cabecera persistente

### 5.1 Problema anterior

La navegación estaba centrada como una píldora aislada. A la derecha aparecían “Mesa preparada” y “Guardado”, mientras las cifras relevantes vivían en un bloque dentro del desk o en franjas particulares de ciertas pestañas. Esto producía tres efectos:

- el usuario perdía el diseño vigente al cambiar de sección;
- “universo” y “población elegible” se presentaban como si fueran equivalentes;
- los contenidos comenzaban a distintas alturas y repetían resúmenes.

### 5.2 Estándar adoptado

Solo en Cálculo de muestra, el toolbar se compone como una cabecera de módulo de ancho completo, alineada con el área profesional de trabajo:

1. primera línea: identidad del módulo, navegación de cinco pasos y estado de guardado;
2. segunda línea persistente: seis magnitudes del diseño;
3. contenido: pestañas y controles, sin franja KPI redundante.

Las seis magnitudes son:

| Magnitud | Fuente | Comportamiento |
|---|---|---|
| Universo de estudiantes | `frame.perfil.universo` | Cifra dura de la base completa. |
| Universo de cursos-horario | `frame.perfil.aulas_totales` / auditoría `classroom_n` | Cifra dura de unidades únicas antes de filtros. |
| Estudiantes elegibles | estimación viva de criterios, con respaldo en `poblacion_n` | Cambia al editar criterios y avisa “falta reconstruir” si difiere del marco duro. |
| Cursos-horario elegibles | estimación viva, con respaldo en `marco_aulas` | Misma regla; nunca se presenta como cifra reconstruida si aún es provisional. |
| Muestra objetivo | motor reactivo del diseño | Meta de respuestas válidas. |
| Sobremuestra operativa | motor reactivo del diseño | Techo con contingencia. |

La cabecera ocupa seis columnas a 1920 px y una retícula 3×2 a 1280 px. No genera overflow global.

## 6. Reparación estética de Criterios

### 6.1 Iteración rechazada

La primera corrección hizo que cada criterio ocupara una fila completa, pero mantuvo una columna angosta de metadatos y distribuyó las categorías sobre todo el ancho. El resultado observado fue deficiente:

- conteos pegados al extremo derecho;
- rótulos largos partidos en columnas estrechas;
- switches casi invisibles;
- extensas áreas blancas sin función;
- baja asociación visual entre categoría, conteo y variante original.

El ancho completo por sí solo no resolvía la composición.

### 6.2 Composición final

Cada criterio ahora tiene:

- cabecera compacta con nombre, columna mapeada y resumen de selección;
- divisor visual único;
- acciones “Todas/Ninguna” alineadas;
- retícula de opciones autocontenidas;
- dentro de cada opción: switch, rótulo, conteo y variante cruda;
- máximo de cuatro columnas para listas largas;
- reducción progresiva a tres, dos o una columna según el ancho;
- switch de 34×20 px con borde y estado apagado legible;
- secciones “Excepciones” y “¿Por qué así?” a ancho completo, después de las opciones.

Esto evita el patrón mostrado en la captura rechazada: ningún conteo queda visualmente separado de la categoría que explica.

## 7. Hallazgo metodológico 1 — estimador sobre filas repetidas

**Estado:** 🟠 pendiente de validación metodológica.  
**No se autoriza cambiar todavía las cifras oficiales 162/235.**

### 7.1 Hecho verificado

El Excel canónico calcula el tamaño típico de la unidad usando `Cursos-Horario!M2:M23134`: 23,133 filas administrativas. Ese rango no deduplica por curso-horario, no filtra `AULA_INCLUIDA` y alimenta media/mediana por facultad. La base contiene 5,262 cursos-horario únicos y el marco depurado contiene 2,483.

| Universo usado para el estimador | Escenario 1 | Escenario 2 | Estado |
|---|---:|---:|---|
| 23,133 filas crudas | 162 | 235 | Cifras oficiales vigentes, con reserva. |
| 5,262 cursos-horario únicos | 185 | 288 | Sensibilidad: efecto de deduplicar. |
| 2,483 cursos-horario incluidos | 133 | 187 | Sensibilidad: deduplicación + filtros. |

Los valores 133/187 **no son una corrección aprobada**. La falta de monotonicidad es esperable: deduplicar retira ponderación accidental, mientras filtrar puede retirar unidades pequeñas y elevar el tamaño típico de las que permanecen.

### 7.2 Riesgo

Una misma cifra de elegibles se repite por relaciones con facultades, carreras o docentes. Calcular media o mediana sobre esas filas pondera implícitamente cada curso-horario por su cantidad de asociaciones administrativas, no por su probabilidad ni por una regla muestral acordada.

Además, 628 de los 2,483 cursos-horario incluidos se asocian a más de una facultad. Antes de recalcular debe decidirse si se atribuyen a la facultad propietaria, a la facultad predominante o si contribuyen a múltiples cuotas según la composición real de estudiantes.

### 7.3 Protocolo de cierre

1. Validar conceptualmente la atribución de facultad y el significado del rendimiento.
2. Colapsar de forma reproducible a una fila por curso-horario y separar relaciones múltiples.
3. Aplicar el marco depurado de 2,483 y verificar unicidad.
4. Comparar alternativas contra los 194 cursos-horario efectivamente intervenidos en 2025.
5. Elegir el estimador con evidencia por facultad: aforo elegible o respuestas válidas esperadas.
6. Actualizar en una sola versión el Excel, QMD/PDF, cifras canónicas y preset de Prosecnur.

Hasta completar esos pasos, la aplicación debe mostrar la reserva y evitar afirmar que el número de cursos-horario está “validado” por el solo hecho de reproducir el Excel.

## 8. Hallazgo metodológico 2 — llave `cod_curso`

**Estado:** ✅ contrato documental corregido y motor protegido.

### 8.1 Por qué `cod_curso` no es una llave

`cod_curso` identifica la asignatura; el conglomerado es la sesión específica. En la evidencia PUCP existen 2,670 códigos de curso y 5,262 cursos-horario. Un total de 703 cursos tiene más de un horario, y 74.2% de las matrículas pertenece a cursos multihorario.

Cruzar solo por curso provoca una expansión muchos-a-muchos:

| Cruce | Filas resultantes a partir de 136,284 matrículas |
|---|---:|
| `cod_curso` → cursos-horario únicos | 959,551 |
| `cod_curso` → 23,133 filas crudas | 7,529,831 |
| `cod_curso + horario` → filas crudas | 806,453 |
| `cod_curso + horario` → maestro deduplicado | 136,279; 5 huérfanas |

Por tanto, la corrección tiene dos condiciones inseparables:

```text
llave = cod_curso + horario
destino = exactamente una fila por curso-horario
```

Para múltiples semestres se recomienda `semestre + cod_curso + tipo_horario + horario`, o preferentemente un NRC/CRN nativo e inmutable.

### 8.2 Protección en Prosecnur

El constructor de identidad en [`calc_muestra_aulas.R`](../../api/R/calc_muestra_aulas.R) rechaza como identificador directo cualquier faceta suelta: curso, horario, sección o salón. Si no existe un identificador real de curso-horario, compone la identidad a partir de curso × sección × horario × etiqueta. Esto impide que el matcher difuso confunda, por ejemplo, una columna `horario` con un supuesto `course_schedule_id`.

La prueba dedicada [`test-calc-muestra-aulas-identidad.R`](../../api/tests/testthat/test-calc-muestra-aulas-identidad.R) cubre:

- `cod_curso + horario` sin identificador directo;
- identificador compuesto explícito;
- rechazo del salón como llave única;
- preservación de docentes múltiples dentro de una misma unidad.

### 8.3 Validaciones obligatorias de una entrega DTI

1. El maestro tiene una fila por llave.
2. El cruce matrículas → maestro es muchos-a-uno.
3. El cruce no aumenta el número de matrículas.
4. No existen llaves vacías.
5. El anti-join no deja matrículas huérfanas, o las excepciones quedan explicadas.
6. Semestre y tipo de horario coinciden en ambos lados.
7. Matriculados declarados se reconcilian con el conteo de relaciones alumno × curso-horario.

## 9. Evaluación de claridad por sección

| Sección | Qué debe responder | Resultado de la revisión |
|---|---|---|
| Datos | ¿Qué estudio es, qué bases existen y qué representa cada columna? | Claro. Se reforzó que curso + horario identifica la unidad y salón es solo ubicación. |
| Marco | ¿Quiénes son elegibles y qué cursos-horario pueden seleccionarse? | Claro tras separar criterios de estudiante y de curso-horario y mover los KPI a la cabecera. |
| Cálculo | ¿Cómo se obtiene muestra, sobremuestra y reparto? | Claro. Debe conservar visible la reserva del estimador de rendimiento mientras siga pendiente. |
| Selección | ¿Qué método se usó, con qué probabilidades y qué unidades salieron? | Claro. Se normalizó todo el lenguaje visible a cursos-horario. |
| Entrega | ¿Qué archivos, memoria y monitoreo se producen? | Claro. El anexo y las fichas se nombran como selección de cursos-horario. |

## 10. Evidencia visual

Las capturas de esta auditoría fueron artefactos locales de QA bajo `tmp/` y no
se versionaron. Se conservan sus rutas como trazabilidad histórica, no como
enlaces portables:

- Vista 1920×1080: `tmp/visual-qa/interventor-toolbar-2026-07-13/final2-1920/quick-calc-muestra-1920x1080-portable.png`.
- Vista 1280×800: `tmp/visual-qa/interventor-toolbar-2026-07-13/final-1280/quick-calc-muestra-1280x800-portable.png`.

En ambas capturas:

- la cabecera persiste fuera de la pestaña;
- no hay overflow global;
- no hay errores de página ni de API;
- cada criterio ocupa una fila completa;
- cada opción conserva junto su rótulo, conteo y variante;
- los switches apagados son visibles;
- el plural mostrado es `cursos-horario`.

El inspector automático reporta cinco overflows locales en el rail lateral colapsado. Son el contenido textual de los botones que se expande intencionalmente en hover; el rail permanece recortado y no genera overflow del documento. No corresponden a las tarjetas ni a la cabecera.

## 11. Validación técnica

| Control | Resultado |
|---|---|
| TypeScript | ✅ `pnpm --dir frontend typecheck`. |
| Suite frontend | ✅ 66 archivos, 749 pruebas aprobadas. |
| Prueba R de identidad curso-horario | ✅ 11 expectativas aprobadas, 0 fallos, 0 advertencias, 0 omitidas. |
| Diferencias con whitespace inválido | ✅ `git diff --check` sin hallazgos. |
| QA visual 1920×1080 | Sin errores de página/API ni overflow global. |
| QA visual 1280×800 | Sin errores de página/API ni overflow global. |
| Proyecto HSVG2026 | La primera sesión de QA con API real provocó un autosalvado no solicitado al abrir la vista. Baseline previo: mtime `2026-07-13 12:38:06 -0500`, SHA-256 `ba8735404bed02fbef3449695a69141d86c000c7585d98ca3190e9523e8d406c`. Estado posterior: mtime `2026-07-13 13:47:44 -0500`, SHA-256 `fc451daa740d70e0d3ee44827a7197abd5e7e0ca3c8998fb1823c898411ef062`. El paquete declara `saved_at = 2026-07-13T18:47:44Z`. No se encontró una copia binaria de respaldo para restaurar el hash exacto; las sesiones de QA se cerraron y el incidente queda registrado explícitamente. |

## 12. Pendientes y límites

1. **Validación metodológica del estimador:** pendiente; es el único bloqueo sustantivo abierto.
2. **Cifras 162/235:** siguen siendo oficiales con reserva; no se reemplazan por 133/187.
3. **Identificadores internos `aula*`:** permanecen por compatibilidad y no deben interpretarse como lenguaje recomendado de interfaz.
4. **Perfil histórico congelado de monitoreo:** no es la fuente actual del recorrido; cualquier migración de sus identificadores internos requiere una tarea de esquema separada.
5. **Base de campo 2026:** aún no existe; universo, elegibles y marco deben reconstruirse cuando DTI entregue el semestre de aplicación.

## 13. Contrato de la iteración

La iteración se considera cerrada cuando:

- la cabecera persistente muestra las seis magnitudes y se conserva en las cinco secciones;
- desaparecen los bloques KPI redundantes en el contenido superior de Criterios y del desk;
- cada criterio ocupa una fila y su composición interna se mantiene compacta en 1920 y 1280 px;
- `curso-horario` / `cursos-horario` gobierna el lenguaje visible y `salón` se usa solo para el espacio físico;
- el motor conserva la identidad compuesta y su prueba dedicada pasa;
- la suite aplicable pasa o cualquier fallo preexistente queda demostrado y documentado;
- este informe registra los resultados reales, no resultados esperados.

## 14. Iteración adicional — confirmación individual por variable

**Fecha:** 2026-07-13.  
**Fuente de verdad:** configuración portable `aulas_config.criterios_seleccion`; el motor R solo interviene al ejecutar `Reconstruir marco`.

### 14.1 Falla observada

Antes de esta iteración, cada switch, rango o umbral escribía inmediatamente el conjunto completo de criterios en el workspace. Aunque el motor R no se ejecutaba en cada clic, la interfaz no distinguía con suficiente claridad tres estados diferentes:

1. una edición que la persona todavía está probando;
2. una variable ya incorporada a la configuración del proyecto;
3. el último marco efectivamente reconstruido por el motor.

Eso hacía posible confundir una selección exploratoria con una decisión metodológica confirmada y producía guardados innecesarios del workspace.

### 14.2 Contrato implementado

Cada criterio funciona ahora como un borrador independiente:

- los switches, chips, umbrales, excepciones y rangos editan estado local;
- una tarjeta modificada cambia a estado semántico ámbar `Cambios sin confirmar`;
- `Confirmar <variable>` copia únicamente el fragmento de esa variable al workspace;
- `Descartar` recupera únicamente el último valor confirmado de esa variable;
- las demás variables no se modifican por esa confirmación;
- `Elegibles por curso-horario` usa el mismo contrato individual;
- una actualización externa del proyecto conserva los borradores pendientes y actualiza las variables limpias;
- `Reconstruir marco` queda deshabilitado mientras exista al menos un borrador, por lo que nunca incorpora silenciosamente ediciones sin confirmar;
- confirmar no ejecuta el motor R: la reconstrucción exhaustiva sigue siendo una acción global, separada y explícita.

La prueba del modelo cubre la independencia entre variables, el rango de nivel, el umbral de elegibles y la reconciliación con una actualización externa.

### 14.3 Rediseño visual

Se aplicó el sistema visual de Prosecnur con una composición de panel de preferencias macOS para trabajo analítico:

- superficie sólida para los controles y tratamiento material solo en la barra de comandos;
- color del módulo para controles seleccionados y acciones primarias;
- verde semántico para `Confirmado` y ámbar semántico para el borrador pendiente;
- icono, texto y color en cada estado, evitando depender solo del color;
- cabecera compacta con variable, columna, resumen y estado;
- opciones autocontenidas con asociación directa entre switch, rótulo, conteo y variante;
- cinco opciones legibles en escritorio amplio y tres columnas a 1280 px;
- franja de confirmación visible solo cuando existe una decisión pendiente;
- botones de 28 px, foco visible, presión breve y animación anulada con `prefers-reduced-motion`.

La rúbrica de modernización obtiene **18/20**: estructura 2, jerarquía 2, densidad 2, materiales 2, estados 2, iconografía 2, movimiento 1, color 2, tipografía 1 y accesibilidad 2. No existe un cero en las dimensiones obligatorias.

## 15. Evidencia y contrato de cierre de la iteración

### 15.1 Evidencia funcional

La prueba automatizada en una sesión aislada observó:

| Comprobación | Resultado |
|---|---|
| Variables pendientes antes de editar | `0` |
| Variables pendientes tras cambiar `PREGRADO` | `1` |
| Reconstrucción con borrador abierto | deshabilitada |
| Variables pendientes tras confirmar Formación | `0` |
| Reconstrucción después de confirmar | habilitada |
| Fragmentos copiados por confirmación | solo la variable indicada |

### 15.2 Evidencia visual

- Estado confirmado, 1710×1107: `tmp/visual-qa/criterios-confirmacion-2026-07-13/1710/quick-calc-muestra-1710x1107-portable.png`.
- Estado confirmado, 1280×800: `tmp/visual-qa/criterios-confirmacion-2026-07-13/1280/final-1280x800.png`.
- Estado pendiente, 1280×800: `tmp/visual-qa/criterios-confirmacion-2026-07-13/fresh-1280/pendiente-centrado-1280x800.png`.

En 1280 px no existe overflow global y las cinco opciones de Formación miden 371×53 px, sin overflow interior. Los cinco avisos del inspector pertenecen al rail lateral colapsado y son los mismos falsos positivos documentados en la sección 10.

### 15.3 Contrato de iteración

| Campo | Evidencia |
|---|---|
| Falla observada | Edición y confirmación eran la misma operación de workspace. |
| Cambio mínimo | Borrador local por variable, confirmación/descartado individual y bloqueo de reconstrucción con pendientes. |
| Archivos | `CriteriosMarcoTab.tsx`, `CriterioCard.tsx`, `borradorCriterios.ts`, su prueba y `criterios.css`. |
| Validación | TypeScript aprobado; 67 archivos y 752 pruebas frontend aprobadas; `git diff --check` aprobado; QA 1710 y 1280 sin overflow global ni errores de página/API. |
| Resultado | Cumplido: editar no equivale a confirmar y confirmar no equivale a reconstruir. |
| Límite | El autosalvado del proyecto de referencia durante QA queda como incidente operativo independiente; no cambia el contrato funcional de borradores. |

La regla de cierre se cumple: cada variable muestra su estado, confirma o descarta de forma autónoma y el cálculo exhaustivo permanece bajo una única acción global consciente.

## 16. Iteración adicional — cabecera mínima y fija de pestaña

**Fecha:** 2026-07-13.  
**Alcance:** las 23 pestañas locales de Datos, Marco, Cálculo, Selección y Entrega.

### 16.1 Decisión de interfaz

Se descartó la cabecera explicativa extensa. La cabecera local muestra exclusivamente:

- el icono propio de la pestaña activa;
- el título de la pestaña activa.

No incorpora descripción, estado, antetítulo ni texto metodológico. La pestaña `Criterios` pasa a llamarse **Criterios de inclusión**, tanto en el rail como en esta cabecera.

La cabecera forma parte del chrome inicial del workbench y queda fuera del área desplazable. Solo se desplaza el contenido de la pestaña: al mover el panel interno 360 px, la coordenada vertical de la cabecera permaneció idéntica (`351.953125 px`). Al cambiar de sección o pestaña, el contenido vuelve al inicio.

En `Marco → Criterios de inclusión` también se retiró el bloque explicativo suelto que originó esta corrección. Las acciones `Todos los criterios están confirmados` y `Reconstruir marco` permanecen como una toolbar compacta, separada de la cabecera.

### 16.2 Evidencia

| Control | Resultado |
|---|---|
| Recorrido automatizado | 23 de 23 pestañas con título exacto, un icono y cabecera visible. |
| Cabecera durante scroll | Fija; misma posición antes y después de desplazar el contenido. |
| TypeScript | ✅ `pnpm --dir frontend typecheck`. |
| Suite frontend | ✅ 67 archivos, 752 pruebas aprobadas. |
| Diferencias con whitespace inválido | ✅ `git diff --check`. |
| QA 1710×1107 y 1280×800 | Sin overflow global, scroll jails, errores de página, API o recursos. |

- Vista final 1710×1107: `tmp/visual-qa/tab-header-minimal-2026-07-13/final-fixed/quick-calc-muestra-1710x1107-portable.png`.
- Vista final 1280×800: `tmp/visual-qa/tab-header-minimal-2026-07-13/final-fixed/quick-calc-muestra-1280x800-portable.png`.

El inspector conserva cinco avisos por viewport, todos atribuibles al contenido textual deliberadamente oculto del rail icon-only. No hay desbordamiento del documento ni del workbench.

### 16.3 Contrato de cierre

La iteración se considera cumplida porque la cabecera es común, mínima y estable en las cinco secciones; `Criterios de inclusión` usa el nombre solicitado; y el desplazamiento queda confinado al contenido de cada pestaña sin mover la cabecera.

## 17. Iteración adicional — economía de texto dentro de las pestañas

**Fecha:** 2026-07-13.  
**Problema observado:** varias superficies mostraban un antetítulo, un título y uno o dos párrafos que explicaban nuevamente la pestaña antes de exponer controles o resultados.

### 17.1 Regla editorial aplicada

Se retiró texto cuando cumplía alguna de estas condiciones:

- repetía el nombre de la pestaña activa;
- narraba lo que ya mostraba inmediatamente un flujo, tabla, fórmula o grupo de controles;
- añadía un badge puramente taxonómico (`POBLACIÓN`, `MARCO`) junto a un título inequívoco;
- presentaba un par `antetítulo + frase explicativa` donde bastaba un solo encabezado.

Se conservó texto únicamente cuando está vinculado a una acción, un estado, una advertencia, una definición opcional, una decisión metodológica o un resultado concreto. No se modificaron reglas, cálculos ni contenidos de los desplegables `¿Por qué así?`.

### 17.2 Cambios visibles

- `Criterios de estudiante` y `Criterios de curso-horario` quedan como títulos únicos, sin tags ni párrafos introductorios.
- Se eliminaron las cinco franjas generales `ContextoLlano` que repetían el recorrido en Estudio, Población, Diseño, Marco de cursos-horario y Cierre.
- Fuentes, Variables y Cursos-horario exponen directamente sus opciones, mapeos y cifras.
- Los encabezados dobles de Marco, Cálculo, Selección y Entrega se redujeron a una sola línea descriptiva.
- El reporte metodológico ya no antepone un párrafo que enumera el contenido que sus propios controles entregan.
- La definición `¿universo vs población?` se conserva como ayuda opcional, sin un párrafo permanente alrededor.

### 17.3 Evidencia y validación

| Control | Resultado |
|---|---|
| Criterios de estudiante | Texto exacto del encabezado; `0` párrafos y `0` tags meta. |
| Criterios de curso-horario | Texto exacto del encabezado; `0` párrafos y `0` tags meta. |
| Recorrido de pestañas | 23 de 23 pestañas mantienen icono, título y visibilidad. |
| TypeScript | ✅ `pnpm --dir frontend typecheck`. |
| Suite frontend | ✅ 67 archivos, 752 pruebas aprobadas. |
| Diferencias con whitespace inválido | ✅ `git diff --check`. |
| QA visual | 1710×1107, 1280×800 y 1024×600 sin overflow global, scroll jail, errores de página, API o recursos. |

- Comparación transversal posterior: `tmp/visual-qa/meta-text-pruning-2026-07-13/after/contact-sheet.png`.
- Criterios, 1280×800: `tmp/visual-qa/meta-text-pruning-2026-07-13/final/quick-calc-muestra-1280x800-portable.png`.
- Criterios, 1024×600: `tmp/visual-qa/meta-text-pruning-2026-07-13/final/quick-calc-muestra-1024x600-portable.png`.

Los cinco avisos del inspector por viewport siguen correspondiendo al texto deliberadamente oculto del rail lateral icon-only; no representan desbordamiento visible.

### 17.4 Contrato de iteración

| Campo | Evidencia |
|---|---|
| Falla | Exceso de texto meta antes de los datos y controles. |
| Cambio enfocado | Retiro de prefacios redundantes y normalización de encabezados a una sola línea. |
| Fuente de verdad | Cabecera persistente de pestaña + contenido operativo inmediato. |
| Resultado | Mejor: aumenta la información útil visible en el primer viewport y se reduce la jerarquía duplicada. |
| Límite | Ayudas metodológicas opcionales, estados vacíos, alertas y explicaciones ligadas a controles se mantienen. |

La stopping rule se cumple: los bloques señalados ya no explican la interfaz; la interfaz muestra primero decisiones, cifras y controles.

**Verificación independiente:** PASS. Confirmó el alcance puramente editorial, la permanencia de ayudas funcionales y la ausencia de imports o variables huérfanos detectables por TypeScript.

## 18. Iteración adicional — paleta canónica Hombre/Mujer y retiro de “¿Por qué así?”

**Fecha:** 2026-07-13.  
**Alcance:** comparaciones por sexo en Marco, Cálculo, Propuestas/Salidas y composición por curso-horario; tarjetas de Criterios de inclusión.

### 18.1 Falla observada

Las comparaciones Hombre/Mujer no compartían un contrato cromático. Según la superficie, se mostraban como morado oscuro y verde oscuro, como dos intensidades de morado o como colores definidos por el orden de llegada de las categorías. Eso generaba tres problemas:

1. el mismo grupo cambiaba de color entre pestañas;
2. el verde de Hombre competía con el verde semántico reservado a estados correctos o confirmados;
3. invertir el orden de las categorías podía invertir también la leyenda.

En Criterios, el desplegable `¿Por qué así?` añadía una capa de texto meta a cada variable sin mejorar la decisión inmediata.

### 18.2 Contrato cromático

La paleta queda definida una sola vez dentro del marco visual de Cálculo de muestra:

| Serie | Token del módulo | Color resuelto | Uso |
|---|---|---|---|
| Hombre | `--cmv2-sex-hombre` | azul cobalto `#2563eb` | barras, segmentos, puntos y leyendas de Hombre/Masculino/M/H. |
| Mujer | `--cmv2-sex-mujer` | frambuesa `#c2416b` | barras, segmentos, puntos y leyendas de Mujer/Femenino/F. |
| Sin dato | `--cmv2-sex-sin-dato` | borde neutro del sistema | categorías ausentes, nunca confundidas con Hombre o Mujer. |

El azul reutiliza el cobalto existente de la paleta Prosecnur y el frambuesa reutiliza `--pulso-accent-rose`; ambos acompañan al morado del módulo sin duplicarlo. El verde queda reservado para éxito/validación. Sobre texto blanco, los contrastes medidos son **5.17:1** y **4.93:1**, respectivamente, por encima del umbral AA para texto normal.

La normalización reconoce singular, plural, códigos y equivalentes frecuentes (`Hombre`, `Hombres`, `Masculino`, `M`, `H`, `Male`, `Varón`; `Mujer`, `Mujeres`, `Femenino`, `F`, `Female`, `Fem`). La asignación depende de la etiqueta normalizada, no del índice de la serie.

### 18.3 Superficies unificadas

- barra simple de Sexo o género en Población;
- barras apiladas de Sexo por facultad;
- composición Hombre/Mujer por curso-horario;
- población y cuotas por facultad × sexo en Distribución;
- gráfico Plotly compartido por Propuestas y Salidas cuando existe resultado del motor;
- leyendas y segmentos, que consumen exactamente el mismo resolvedor.

En las tarjetas de Criterios de inclusión se retiraron el componente, el disparador y los estilos de `¿Por qué así?`. La tarjeta termina ahora en sus controles, excepciones y —solo cuando corresponde— la confirmación individual. El contenido metodológico del dominio no altera ni ejecuta el cálculo.

### 18.4 Evidencia visual y técnica

| Control | Resultado |
|---|---|
| Población | Hombre `rgb(37, 99, 235)`; Mujer `rgb(194, 65, 107)`. |
| Sexo por facultad | Leyenda y 18 barras apiladas conservan la misma pareja. |
| Sexo por curso-horario | Leyenda y 12 composiciones conservan la misma pareja. |
| Distribución | Leyendas M/F y segmentos usan la misma pareja en población y cuotas. |
| Criterios | Conteo exacto de `¿Por qué así?`: `0`. |
| Escritorio compacto 1280×720 | Sin overflow horizontal de documento ni body. |
| TypeScript | ✅ `pnpm --dir frontend typecheck`. |
| Suite frontend | ✅ 68 archivos, 767 pruebas aprobadas. |
| Contraste con blanco | Hombre 5.17:1; Mujer 4.93:1. |

- Sexo o género — población: `tmp/visual-qa/sex-palette-2026-07-13/sexo-poblacion-card.png`.
- Sexo por facultad: `tmp/visual-qa/sex-palette-2026-07-13/sexo-facultad-card.png`.
- Sexo por curso-horario: `tmp/visual-qa/sex-palette-2026-07-13/sexo-curso-horario-card.png`.
- Distribución 1710×1107: `tmp/visual-qa/sex-palette-2026-07-13/distribucion-1710x1107.png`.
- Distribución 1280×720: `tmp/visual-qa/sex-palette-2026-07-13/distribucion-1280x720.png`.
- Criterios sin el desplegable meta: `tmp/visual-qa/sex-palette-2026-07-13/criterios-1710x1107.png`.

### 18.5 Contrato de iteración

| Campo | Evidencia |
|---|---|
| Falla | Colores de sexo inconsistentes y explicación meta repetida por criterio. |
| Cambio enfocado | Tokens del módulo + resolvedor único por etiqueta + retiro del disclosure. |
| Fuente de verdad | Paleta Prosecnur y semántica visible de la categoría, no el orden del arreglo. |
| Resultado | Mejor: Hombre y Mujer mantienen identidad estable en todas las comparaciones auditadas. |
| Persistencia y cálculo | No modificados. No se tocó el motor R ni el esquema `.pulso`. |

La stopping rule se cumple: no queda verde ni una dupla morado oscuro/claro en las comparaciones Hombre/Mujer auditadas, las leyendas coinciden con sus marcas y el texto meta señalado desapareció de Criterios.

## 19. Iteración adicional — comparación de sexo contra referencia del 50%

**Fecha:** 2026-07-13.  
**Alcance:** gráficos `Sexo o género` y `Sexo por facultad` de Marco > Población.

### 19.1 Falla observada

La tarjeta agregada de sexo ocupaba solo media fila y dejaba una columna vacía. Además, sus barras se normalizaban contra la categoría de mayor tamaño: la categoría mayor siempre llegaba al 100% de la pista, aunque su participación real fuera apenas superior al 50%. Esa escala impedía comparar visualmente la distancia respecto de la paridad. En el cruce por facultad, las barras de 13 px hacían menos legible el punto exacto en que cambiaba el predominio.

### 19.2 Cambio enfocado

- `Sexo o género` ocupa ahora el ancho completo de la grilla y conserva una altura compacta de 164 px.
- Sus barras usan participación sobre el total como escala 0–100%, no normalización contra el máximo de la serie.
- Las participaciones agregadas se muestran con una décima para no convertir, por redondeo, un 50,4% frente a 49,6% en dos etiquetas idénticas de 50%.
- Las barras agregadas aumentaron de 13 a 18 px; las barras apiladas por facultad, de 13 a 17 px.
- Ambos gráficos incorporan la misma clave `Referencia 50%` y una guía vertical punteada superpuesta exactamente en el centro de cada pista.
- La guía usa un halo del color de superficie y un trazo neutro, por lo que permanece visible tanto sobre el azul de Hombre como sobre el frambuesa de Mujer sin introducir un tercer color de serie.

### 19.3 Evidencia visual y geométrica

| Control | Resultado |
|---|---|
| Tarjeta agregada, 1710 px | ancho 1,574 px, igual al ancho completo de su grilla. |
| Grosor agregado | 18 px en ambas barras. |
| Grosor por facultad | 17 px en las 18 barras apiladas. |
| Centro de pista agregada | `x = 913 px`; centro de la guía `x = 913 px`. |
| Lectura de diferencia | Hombre termina 3.97 px después de la guía; Mujer, 4.31 px antes. |
| Guías por facultad | las primeras cinco filas medidas comparten la misma coordenada horizontal. |
| Escritorio 1710×1107 | ancho del documento = ancho del viewport; sin overflow horizontal ni errores de consola. |
| Escritorio 1280×800 | ancho del documento = ancho del viewport; la lectura vertical permanece dentro del único scroll de la pestaña. |

- Sexo o género — ancho completo y referencia final: `tmp/visual-qa/sex-reference-2026-07-13/sexo-general-wide-final.png`.
- Sexo por facultad — barras gruesas y referencia: `tmp/visual-qa/sex-reference-2026-07-13/sexo-facultad-wide.png`.
- Sexo o género — composición compacta 1280 px: `tmp/visual-qa/sex-reference-2026-07-13/sexo-general-compact.png`.

La inspección se ejecutó con la copia QA `tmp/visual-qa/tab-header-minimal-2026-07-13/HSVG2026-QA.pulso`; no se abrió ni se modificó el proyecto HSVG original.

### 19.4 Validación y contrato de cierre

| Control | Resultado |
|---|---|
| Prueba focal | ✅ verifica anchos 55%/45%, dos guías agregadas y una guía apilada por fila. |
| TypeScript | ✅ `pnpm --dir frontend typecheck`. |
| Suite frontend | ✅ 68 archivos, 768 pruebas aprobadas. |
| Diferencias con whitespace inválido | ✅ `git diff --check` en los archivos de la iteración. |
| Persistencia y motor | No modificados; no se tocó R, el esquema `.pulso` ni el cálculo del marco. |

La stopping rule se cumple: ambas superficies muestran la misma referencia porcentual, las barras tienen el grosor solicitado, la tarjeta agregada usa todo el ancho disponible y las diferencias respecto del 50% se distinguen sin solapamientos ni desbordamiento horizontal.

## 20. Revisión estética profunda — composición, densidad y uso del canvas

**Fecha:** 2026-07-13.  
**Superficies:** Marco → Población, Cursos-horario, Consistencia y Cobertura; Cálculo → Supuestos y Diseño.  
**Proyecto de validación:** copia QA `tmp/visual-qa/tab-header-minimal-2026-07-13/HSVG2026-QA.pulso`.

### 20.1 Diagnóstico transversal

La revisión no se trató como una corrección de bordes o colores aislados. Las capturas iniciales mostraban seis fallas de composición repetidas:

1. límites de ancho fijos que dejaban grandes planos blancos a ambos lados;
2. tarjetas pequeñas atrapadas en columnas parciales aun cuando eran el único contenido de la fila;
3. texto y cifras comprimidos dentro de nodos demasiado estrechos;
4. títulos internos que repetían el título persistente de la pestaña;
5. gráficos estirados para llenar una columna, sin conservar una proporción visual estable;
6. indicadores sin interpretación sustantiva, como una referencia de 50% en barras de magnitud por facultad.

El contrato aplicado fue: **cada bloque debe ocupar el ancho que su lectura necesita, no el ancho heredado por accidente**. Las comparaciones panorámicas usan el canvas completo; las decisiones relacionadas se agrupan en retículas; los micrográficos conservan una anchura máxima; y una referencia porcentual solo aparece cuando existe una composición porcentual real.

### 20.2 Resolución caso por caso

| Superficie | Falla observada | Resolución final |
|---|---|---|
| Población | Embudo y resultados separados por un gran vacío; nombres partidos en demasiadas líneas. | Banda continua de universo → filtros → población → consolidación. Etiquetas visuales compactas (`Universo`, `Matrícula regular`, `Edad ≥ 18 años`) sin alterar las etiquetas auditivas del motor. |
| Cursos-horario | KPIs, embudo e indicadores ocupaban solo una fracción del ancho; la merma se cortaba. | Cuatro KPIs, embudo y cuatro lecturas ocupan filas completas. La arista reserva ancho para `−1,754 cursos-horario`. Las descripciones antiguas con `aula(s)` se normalizan en presentación, con concordancia masculina y plural invariable. |
| Consistencia | Fuentes desconectadas visualmente, diagrama pequeño en un plano vacío, estado contradictorio y título duplicado. | Las dos fuentes se unen mediante una pieza central explícita `Llave de unión · Curso + horario`; la coincidencia, el estado compuesto y las tres salidas de la reconciliación ocupan todo el ancho. Se retiró el título interno repetido y el Venn decorativo. |
| Cobertura | Introducción angosta, nombres truncados, pistas excesivamente largas y ayuda final redundante. | Cabecera compacta con cuatro cifras; grilla de tres columnas con nombres legibles, pistas de 15 px y valores alineados. La escala muestra únicamente `0` y el máximo observado. Se retiró la línea de 50%, reservada exclusivamente para composiciones por sexo. |
| Supuestos | Cuatro tarjetas `pendiente`, controles comprimidos y gráficos excesivamente estirados. | Un solo estado pendiente, controles en dos columnas y tercer parámetro a ancho completo, separación 5/12–7/12 y leyenda Universidad/Facultades. Los SVG se centran con ancho máximo de 760 px; las notas conservan la misma medida. |
| Diseño | Todo el contenido estaba limitado a 1,040 px; controles, reserva y escenarios se comprimían dentro de una columna central. | La pestaña usa el canvas completo. Fórmula, controles y resultados forman una lectura panorámica; Reserva y Escenarios se comparan en una retícula 5/12–7/12 en escritorio amplio y se apilan antes de comprimirse. Se eliminó además el botón anidado de `ponderación`, que producía HTML interactivo inválido. |

### 20.3 Evidencia visual final

Cada superficie se recorrió con datos reales de la copia QA en dos tamaños de escritorio. En los doce recorridos, `documentElement.scrollWidth`, `body.scrollWidth` y el ancho del viewport fueron idénticos.

| Superficie | 1710 × 1107 | 1280 × 800 |
|---|---|---|
| Población | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/poblacion-1710x1107.png` | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/poblacion-1280x800.png` |
| Cursos-horario | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/cursos-horario-1710x1107.png` | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/cursos-horario-1280x800.png` |
| Consistencia | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/consistencia-1710x1107.png` | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/consistencia-1280x800.png` |
| Cobertura | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/cobertura-1710x1107.png` | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/cobertura-1280x800.png` |
| Supuestos | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/calculo-supuestos-1710x1107.png` | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/calculo-supuestos-1280x800.png` |
| Diseño | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/calculo-diseno-1710x1107.png` | `tmp/visual-qa/deep-aesthetic-review-2026-07-13/final/calculo-diseno-1280x800.png` |

La consola de estos recorridos no registró errores de página, API ni recursos. Solo aparecieron los dos avisos informativos preexistentes de migración futura de React Router. El inspector automatizado continúa reportando como overflow el texto accesible deliberadamente oculto de los cinco botones icon-only del rail; el documento y el body no desbordan.

### 20.4 Rúbrica de modernización

| Eje | Puntaje | Evidencia |
|---|---:|---|
| Estructura | 2/2 | Flujo, cifras, controles y resultados tienen agrupación explícita. |
| Jerarquía | 2/2 | Una cabecera persistente por pestaña; sin títulos internos repetidos. |
| Densidad | 2/2 | No quedan columnas parciales ni planos vacíos dominantes. |
| Materiales | 1/2 | Superficies y bordes usan tokens existentes; no se amplió el sistema de materiales. |
| Estados | 2/2 | Pendiente, validado, revisión y resultado se distinguen sin duplicación. |
| Iconografía | 2/2 | Iconos del módulo y estados mantienen tamaño y semántica. |
| Movimiento | 1/2 | Se preservan transiciones y stagger existentes; no se añadieron secuencias nuevas. |
| Color | 2/2 | Morado del módulo, verde de validación y ámbar de revisión conservan sus roles. |
| Tipografía | 2/2 | Etiquetas, cifras, notas y títulos recuperan escala y ancho legibles. |
| Accesibilidad | 2/2 | Sin botones anidados; roles, nombres accesibles y foco existentes se preservan. |

**Total:** 18/20. No hay ejes con puntaje cero.

### 20.5 Validación y stopping rule

| Control | Resultado |
|---|---|
| TypeScript | ✅ `pnpm --dir frontend typecheck`. |
| Suite frontend completa | ✅ 70 archivos, 774 pruebas aprobadas. |
| Pruebas focales de presentación | ✅ 13 pruebas de Marco, Cobertura y Supuestos; más verificación específica de terminología heredada. |
| Diferencias con whitespace inválido | ✅ `git diff --check`. |
| QA visual | ✅ 12 capturas finales; 1710 y 1280 px sin overflow horizontal global. |
| Lógica metodológica | No modificada: sin cambios al motor R, fórmulas, parámetros ni esquema `.pulso`. |
| Proyecto HSVG original | No abierto ni modificado durante esta revisión; se usó exclusivamente la copia QA. |

La stopping rule se cumple cuando las seis superficies usan el canvas de forma deliberada, mantienen una jerarquía legible en ambos anchos, no presentan cortes ni desbordamiento global y las referencias visuales tienen una interpretación metodológica real. Esas condiciones se verificaron en la evidencia anterior.

## 21. Auditoría de parametrización del embudo de cursos-horario

**Fecha:** 2026-07-13.  
**Alcance:** trazabilidad y reparación desde la configuración persistida del proyecto hasta los nodos, etiquetas, conteos y mermas del embudo de Marco → Cursos-horario.  
**Excluido:** fórmulas de tamaño de muestra, selección/sorteo, esquema `.pulso`, routers, Electron y datos del cliente.  
**Riesgo principal:** que un embudo visualmente correcto describa filtros heredados en lugar de los criterios realmente confirmados en el proyecto.  
**Validación mínima:** inspección de la cadena frontend/backend, prueba directa con el fixture categórico canónico, pruebas focales R y suite frontend existente.

### 21.1 Veredicto final

La comprobación **pasa después de la reparación**. El embudo se deriva ahora de la selección de criterios confirmada en cada proyecto: varían la cantidad de pasos, su orden evaluable, sus etiquetas, sus conteos y sus mermas. Los criterios no accionables —por ejemplo, un numérico sin umbral o un set vacío sin excepciones— no generan nodos. Cuando la suite de criterios es la fuente de verdad, los pasos legacy no se intersectan ni se vuelven a presentar; solo se conserva el flujo heredado para proyectos que todavía no tienen la suite configurada.

La auditoría inicial sí detectó una divergencia real —documentada en §21.2—: el marco final obedecía al proyecto, pero el perfil visual podía describir una secuencia fija. Esa condición ya no permanece abierta.

| Elemento visible | Fuente real | ¿Varía por proyecto? | Resultado |
|---|---|---|---|
| `Curso-horario únicos` | Conteo de identificadores únicos del frame | Sí, la cifra; no, la plantilla de etiqueta | El valor no está hardcodeado. |
| Modalidad efectiva | Selección confirmada de `modality` | Sí | Una categoría muestra su nombre; varias muestran el número de categorías. `Solo presencial` solo puede existir en el flujo legacy de un proyecto sin suite. |
| `−1,754 cursos-horario` | Diferencia frontend entre dos conteos consecutivos | Sí | No está hardcodeada. |
| Umbral de elegibles | `minEligible` confirmado, incluida su excepción por facultad | Sí | Se evalúa contra `eligible_n`; la etiqueta distingue el umbral general y las excepciones efectivas. Es distinto del filtro `enrolled_total`. |
| Orden y cantidad de pasos | Registro de variables y selección efectiva del proyecto | Sí | Solo aparecen los criterios activos, en orden canónico, y el último conteo reconcilia con el marco. |

### 21.2 Evidencia inicial de la brecha

El frontend no inventa los tres nodos de la captura: consume `frame.perfil.embudo_aula`, conserva sus etiquetas y conteos y calcula cada merma como la diferencia entre pasos consecutivos. La configuración categórica también se persiste y el marco final la evalúa por curso-horario usando el catálogo como fuente autoritativa.

La divergencia aparece después. Cuando la suite categórica está activa, el constructor neutraliza los filtros legacy y aplica `seleccion_aula$ok` al `included` final; en cambio, `calc_muestra_aulas_perfil()` sigue armando el embudo con los pasos predefinidos `total`, `presencial`, `tipo`, `elegibles`, `sede`, `docente`, `nivel`, `c7` y `c8`. El resultado combinado de `criterios_seleccion` no se descompone en pasos acumulativos por variable.

La prueba directa con el fixture categórico canónico —modalidad, tipo de sesión, docente, nivel y umbral configurados— produjo:

```text
Curso-horario únicos       12
Con 1 o más elegibles      11
marco_aulas                 4
```

El último nodo del embudo quedó en 11 mientras el marco final quedó en 4. Esto demuestra que el embudo omite recortes reales del proyecto y no garantiza la reconciliación `último paso = marco_aulas`.

Existe además un supuesto de presentación independiente: la vista oculta todo el embudo cuando el backend entrega menos de tres pasos. Un proyecto válido con únicamente `total → resultado` no vería su embudo, aunque ambos pasos fueran correctos.

### 21.3 Reparación implementada

La reparación separa tres responsabilidades que antes se confundían:

1. `enrolled_total` filtra la matrícula o capacidad declarada del curso-horario;
2. `minEligible` filtra el número de estudiantes realmente elegibles (`eligible_n`), con soporte para umbrales por facultad;
3. cada variable conserva una identidad propia en el borrador y en la confirmación individual del frontend.

El evaluador devuelve una bandera individual por variable activa. El perfil la acumula en el mismo orden del registro de criterios y deriva cada etiqueta de las categorías, rangos o umbrales confirmados. Modalidad, tipo de sesión, tipo de docente, nivel del curso, matrícula declarada, sede y mínimo elegible pueden aparecer o desaparecer sin modificar código de presentación. Las reglas independientes `c7` y `c8` se agregan después cuando están activas.

En presentación, un embudo válido de dos pasos ya no se oculta. Entre dos y cuatro pasos usa composición horizontal; a partir de cinco usa una retícula adaptativa: una fila en escritorio amplio y tres columnas en escritorio compacto. Así conserva cada etapa y cada merma sin comprimir etiquetas ni convertir el embudo en una lista vertical extensa.

### 21.4 Validación ejecutada

| Control | Resultado |
|---|---|
| Trazabilidad frontend | ✅ nodos, orden, etiquetas y conteos proceden del payload; la merma se calcula entre conteos consecutivos reales. |
| Autoridad del proyecto | ✅ con la suite activa, la selección confirmada gobierna el marco y el embudo; una configuración legacy contradictoria no vuelve a filtrar ni crea un nodo oculto. |
| Semántica de umbrales | ✅ `enrolled_total` y `minEligible` son filtros, claves y confirmaciones independientes; `minEligible` usa `eligible_n`. |
| Reconciliación | ✅ la prueba dinámica exige `tail(embudo_aula$conteo) == marco_aulas`. |
| Variación por proyecto | ✅ fixture virtual/taller/docente contratado/nivel 5–10/umbral 10, excepción de umbral por facultad y regla `c7`. |
| Embudo mínimo | ✅ un payload de dos pasos se renderiza completo y horizontal. |
| Embudo largo | ✅ seis pasos con etiquetas extensas se renderizan completos en retícula adaptativa. |
| Pruebas R | ✅ 38 expectativas dinámicas, 97 de perfil, 69 de criterios, 92 de criterios de cursos-horario y 66 de catálogo. |
| Frontend | ✅ TypeScript y 73 archivos / 790 pruebas. |
| QA visual | ✅ 1710×1107, 1440×1000 y 1280×800; ancho de documento = viewport, etiquetas sin clipping y flujo vertical para cinco pasos efectivos más el origen. |

Evidencia visual reconstruida con la copia QA, sin abrir el HSVG original:

- Embudo dinámico · 1710×1107: `tmp/visual-qa/embudo-dinamico-2026-07-13-run2/dynamic-1710x1107.png`;
- embudo dinámico · 1440×1000: `tmp/visual-qa/embudo-dinamico-2026-07-13-run2/dynamic-1440x1000.png`;
- embudo dinámico · 1280×800: `tmp/visual-qa/embudo-dinamico-2026-07-13-run2/dynamic-1280x800.png`.

La stopping rule se cumple: las etiquetas visibles salen de los criterios confirmados del proyecto, los criterios no accionables se omiten, el flujo mínimo se conserva, el flujo largo no se comprime y el último conteo coincide con el marco final. La política evaluativa de un set vacío se conserva como no-op; la reparación evita presentarlo como un filtro ficticio. Permanece fuera de esta iteración cualquier cambio a la política de señales ausentes.

## 22. Pulido visual integral de las superficies nuevas

**Fecha:** 2026-07-13.  
**Alcance:** chrome persistente, resumen de universo y operación, encabezados locales, criterios de inclusión, cursos-horario, Diseño, Propuestas, Supuestos y Distribución.  
**Excluido:** motor R, fórmulas, reglas metodológicas, contratos de datos, selección y sorteo, persistencia `.pulso`, Electron y otros módulos.  
**Riesgo principal:** intentar sofisticar la interfaz mediante más tarjetas, gradientes o aire y agravar precisamente la baja densidad denunciada.  
**Stopping rule:** jerarquía común, contenido útil en el primer viewport, cero overflow real, lectura clara a 1710, 1440 y 1280 px y una rúbrica de modernización igual o mayor a 14/20 sin un eje crítico en cero.

### 22.1 Hallazgos que gobernaron el cambio

La auditoría visual previa identificó cuatro problemas sistémicos y no meramente cosméticos:

1. el commandbar, el resumen persistente y el título local formaban tres tarjetas anidadas antes del contenido;
2. el resumen de seis cifras pasaba a dos filas demasiado pronto y consumía 172 px a 1280;
3. los embudos largos alternaban entre una cinta horizontal comprimida y una lista vertical demasiado alta;
4. Diseño → Escenarios heredaba `white-space: nowrap` de los botones globales y alcanzaba hasta 1,603 px de `scrollWidth` dentro de un panel de 1,150 px.

También se comprobó exceso de cajas internas en los criterios, cuatro tarjetas para cuatro cifras dentro de otro panel, un estado vacío de Propuestas de más de 320 px y dos distribuciones por sexo comprimidas lado a lado en escritorio compacto.

### 22.2 Contrato visual aplicado

- El commandbar superior quedó como plano de contexto; el rail central conserva una elevación mínima, sin una tarjeta exterior adicional.
- Universo, elegibles, muestra y sobremuestra forman una banda continua de seis celdas. En 1280 px permanece en una sola fila; universo es neutro, estimación pendiente usa ámbar, marco confirmado usa verde y objetivo/operación usa el morado del módulo.
- El encabezado local mide 36 px y contiene únicamente icono y título, con un hairline inferior. No usa gradiente, sombra, subtítulo ni barra lateral decorativa.
- Cada variable de Criterios de inclusión conserva una superficie completa y su confirmación individual; las categorías internas pasan a ser filas planas con separadores. Solo la selección activa recibe tinte y borde lateral.
- Las cuatro cifras de Cursos-horario y las tres cifras de Diseño son ribbons internos, no colecciones de tarjetas elevadas.
- Un embudo de cinco a seis pasos usa seis columnas en escritorio amplio y 3 × 2 en 1440/1280; la merma se mantiene visible dentro de la etapa receptora.
- Escenarios permite wrap real en todos sus descendientes y apila sus tarjetas cuando no existe ancho suficiente.
- El vacío de Propuestas se redujo a un preflight horizontal compacto.
- En Supuestos, el icono de ayuda quedó junto al concepto y los gráficos conservan proporción y ancho máximo.
- Distribución se apila a 1280, expande los códigos institucionales a `Hombre` y `Mujer`, conserva la paleta azul/rosa y dibuja la referencia punteada del 50% únicamente dentro de cada composición por sexo.

### 22.3 Evidencia visual y geométrica

La copia QA usada fue `tmp/visual-qa/tab-header-minimal-2026-07-13/HSVG2026-QA.pulso`; el proyecto HSVG original no se abrió ni modificó.

| Superficie | Evidencia amplia | Evidencia compacta |
|---|---|---|
| Criterios de inclusión | `tmp/visual-qa/sophisticated-pass-2026-07-13/marco-criterios/quick-calc-muestra-1710x1107-auto.png` | `tmp/visual-qa/sophisticated-pass-2026-07-13/marco-criterios/quick-calc-muestra-1280x800-auto.png` |
| Cursos-horario | `tmp/visual-qa/sophisticated-pass-2026-07-13/marco-cursos-horario/quick-calc-muestra-1710x1107-auto.png` | `tmp/visual-qa/sophisticated-pass-2026-07-13/marco-cursos-horario/quick-calc-muestra-1280x800-auto.png` |
| Diseño | `tmp/visual-qa/sophisticated-pass-2026-07-13/calculo-diseno/quick-calc-muestra-1710x1107-auto.png` | `tmp/visual-qa/sophisticated-pass-2026-07-13/calculo-diseno-final2/quick-calc-muestra-1280x800-auto.png` |
| Propuestas | `tmp/visual-qa/sophisticated-pass-2026-07-13/calculo-propuestas/quick-calc-muestra-1710x1107-auto.png` | `tmp/visual-qa/sophisticated-pass-2026-07-13/calculo-propuestas/quick-calc-muestra-1280x800-auto.png` |
| Supuestos | `tmp/visual-qa/sophisticated-pass-2026-07-13/calculo-supuestos/quick-calc-muestra-1710x1107-auto.png` | `tmp/visual-qa/sophisticated-pass-2026-07-13/calculo-supuestos/quick-calc-muestra-1280x800-auto.png` |
| Distribución | `tmp/visual-qa/sophisticated-pass-2026-07-13/calculo-distribucion/quick-calc-muestra-1710x1107-auto.png` | `tmp/visual-qa/sophisticated-pass-2026-07-13/calculo-distribucion-final/quick-calc-muestra-1280x800-auto.png` |

El proyecto QA tenía tres pasos efectivos en su embudo reconstruido. Para no inferir el caso largo, se verificó además el mismo componente con seis etapas y etiquetas extensas en el navegador real: a 1280 px la retícula midió **1,122 × 132 px**, produjo tres columnas de 362 px, conservó las seis etapas y obtuvo `scrollWidth = clientWidth`. La prueba de React exige además `data-orientacion="adaptive"` y las seis etiquetas del payload.

Todos los recorridos automatizados reportaron `globalOverflow = 0`, `scrollJails = 0`, `pageErrors = 0`, `apiErrors = 0` y `resourceErrors = 0`. Los cuatro avisos restantes por captura corresponden al texto accesible deliberadamente oculto de los botones icon-only del rail; el documento y sus paneles no desbordan.

### 22.4 Validación

| Control | Resultado |
|---|---|
| TypeScript | ✅ `pnpm --dir frontend typecheck`. |
| Suite frontend completa | ✅ 73 archivos, 798 pruebas aprobadas. |
| Pruebas focales | ✅ embudo mínimo/largo y paleta/etiquetas de sexo. |
| Whitespace | ✅ `git diff --check`. |
| QA visual | ✅ 1710 × 1107, 1440 × 1000 y 1280 × 800, sin overflow real. |
| Metodología y datos | No modificados en esta iteración. |

### 22.5 Rúbrica de modernización

| Eje | Puntaje | Evidencia |
|---|---:|---|
| Estructura | 2/2 | Un chrome, un ribbon y una superficie por variable/panel. |
| Jerarquía | 2/2 | Título local mínimo; cifras y acciones siguen el orden de decisión. |
| Densidad | 2/2 | Se eliminaron apilamientos prematuros, vacíos altos y flujos verticales extensos. |
| Materiales | 2/2 | Se retiraron gradientes/sombras redundantes y tarjetas internas. |
| Estados | 2/2 | Universo, estimado, confirmado y operación tienen tratamiento distinto. |
| Iconografía | 2/2 | Iconos de 28 px y ayuda anclada al concepto. |
| Movimiento | 1/2 | Stagger dinámico y reducción de movimiento; sin animación ornamental nueva. |
| Color | 2/2 | Acento del módulo separado de éxito, advertencia y series de sexo. |
| Tipografía | 2/2 | Pesos 500/600/700 y etiquetas completas en superficies analíticas. |
| Accesibilidad | 1/2 | Roles y labels preservados; queda fuera de esta pasada una auditoría completa de teclado y lector de pantalla. |

**Total independiente:** 18/20. No existe un eje crítico con puntaje cero. El verificador serial confirmó `PASS`; la stopping rule queda satisfecha.
