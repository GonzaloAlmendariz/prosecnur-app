# Auditoría visual exhaustiva de Monitoreo

Tipo: Fuente histórica QA
Estado: Histórico
Fecha: 2026-07-25
Autoridad: Evidencia histórica fechada; no certifica el producto actual
Consolidado en: [Síntesis de reparaciones visuales de Monitoreo](../historico/monitoreo-reparaciones-visuales-2026-07.md)

**Fecha:** 25 de julio de 2026
**Alcance:** Territorial, Acreditación, Aulas universitarias y Telefónico
**Veredicto global:** **RECHAZADO VISUALMENTE hasta resolver los P1**

## Resumen ejecutivo

La auditoría recorrió **68/68 pestañas actuales**:

| Modo | Secciones | Pestañas | Hidratadas | Captura inicial | Scroll medio/final |
|---|---:|---:|---:|---:|---:|
| Territorial | 6 | 26 | 26/26 | Sí | Sí, cuando existe exceso vertical |
| Acreditación | 5 | 22 | 22/22 | Sí | Sí, cuando existe exceso vertical |
| Aulas universitarias | 5 | 5 | 5/5 | Sí | Sí, cuando existe exceso vertical |
| Telefónico | 5 | 15 | 15/15 | Sí | Sí, cuando existe exceso vertical |
| **Total** | **21** | **68** | **68/68** | **Sí** | **Sí** |

Además se inspeccionó la entrada de cada modo en **1710×1107, 1440×1000,
1366×768, 1280×720 y 1024×600**. No hubo errores de página, API o recursos,
ni desbordamiento horizontal global. Acreditación presenta un desbordamiento
interno de 11 px en un `input` a 1024×600.

El producto tiene una base visual consistente y varias superficies de alta
calidad —especialmente los patrones master-detail, los encabezados pegajosos y
la presentación del contrato de fuentes—, pero no debe aprobarse todavía por
tres motivos:

1. Territorial contiene información real cortada e inaccesible en seis
   pestañas y una séptima con un scroll técnicamente alcanzable, pero
   funcionalmente inutilizable.
2. Los cuatro modos usan señales de éxito, avance o disponibilidad que
   contradicen el estado operativo mostrado en la misma pantalla.
3. Territorial, Acreditación y Telefónico permiten generar salidas aun cuando
   el corte se declara pendiente, incompleto, con cero válidas o con efectivas
   sin determinar.

## Método y evidencia

### Proyectos usados

- Territorial:
  `outputs/audit-projects/seeds/territorial_lima_manzanas/territorial_lima_manzanas.pulso`
- Acreditación:
  `outputs/audit-projects/seeds/acreditacion_multiactor/acreditacion_multiactor.pulso`
- Aulas universitarias:
  copia de corrida escribible de `api/inst/audit_reference/prosecnur_audit_reference.pulso`
- Telefónico:
  `outputs/audit-projects/seeds/telefonico_cuotas/telefonico_cuotas.pulso`

### Evidencia reproducible

Los artefactos fueron salidas locales ignoradas por Git. Se conservan como
rutas históricas, no como enlaces portables:

- Territorial, 26 pestañas: `outputs/ux-audit/monitoreo-2026-07-25/deep-tabs/territorial/`.
- Acreditación, 22 pestañas: `outputs/ux-audit/monitoreo-2026-07-25/deep-tabs-v2/acreditacion/`.
- Aulas, 5 pestañas: `outputs/ux-audit/monitoreo-2026-07-25/deep-tabs/aulas_universitarias/`.
- Telefónico, 15 pestañas: `outputs/ux-audit/monitoreo-2026-07-25/deep-tabs-v3/telefonico/`.
- Matriz de cinco viewports: `outputs/ux-audit/monitoreo-2026-07-25/viewports/`.

En cada pestaña se tomó una captura inicial. Cuando un contenedor tenía más
contenido que altura visible, se midió el dueño del scroll y se tomaron
capturas en la mitad y al final. Si el exceso estaba bajo `overflow: hidden` o
`visible` sin un dueño de scroll, se registró como **contenido no alcanzable**.

La pasada profunda de todas las pestañas se hizo en 1600×1000. La matriz de
cinco viewports cubre el shell y la primera sección de cada modo; por tanto, el
informe no afirma que las 68 pestañas se hayan repetido en los cinco tamaños.

## Hallazgos priorizados

| ID | Prioridad | Modo | Error observado | Impacto | Mejora y aceptación |
|---|---|---|---|---|---|
| MON-VIS-01 | P1 | Territorial | Seis pestañas contienen bloques cortados sin scroll alcanzable; una séptima ofrece solo 16 px visibles para 339 px de contenido. | Datos y acciones pueden quedar fuera de acceso con rueda o teclado. | Definir un único dueño de scroll por región y una altura útil mínima. Aceptar solo si todos los bloques relevantes reportan `unreachable:false` y permiten operar en 1600×1000, 1366×768 y 1024×600. |
| MON-VIS-02 | P1 | Todos | Colores, porcentajes y textos de estado se contradicen con los datos del mismo corte. | El usuario no puede distinguir “dato recibido”, “dato válido”, “configurado” y “listo”. | Adoptar una máquina de estados visual común: sin configurar, cargado, parcial, bloqueado, listo. Verde queda reservado para evidencia completa. |
| MON-VIS-03 | P1 | Territorial, Acreditación, Telefónico | Salidas PDF/Sheets están disponibles con corte pendiente, cero válidas, `S/D` o fuente faltante. | Se puede producir un entregable aparentemente oficial con datos no defendibles. | Gatear cada salida por readiness y registros procesables; permitir borrador diagnóstico solo con rotulado y marca de agua. |
| MON-VIS-04 | P1 | Aulas | Avance muestra 0 aplicadas, 8 válidas, 100% de representatividad, 8 brechas y estados “Pendiente”/“Listo” simultáneos. | El corte no tiene una lectura metodológica inequívoca. | Mostrar denominadores y separar cobertura de respuestas de aplicación de cursos. Nunca presentar 100% sin explicar 0 aplicaciones. |
| MON-VIS-05 | P1 | Aulas | Tablas limitan silenciosamente columnas y filas; Agenda solicita más columnas de las que presenta. | Información operativa puede desaparecer sin aviso. | Mostrar todas las columnas esenciales o selector explícito; añadir “Mostrando N de M” y paginación/virtualización. |
| MON-VIS-06 | P1 | QA transversal | Los catálogos y probes versionados de QA conservan pestañas y selectores retirados. | Un reporte puede declarar éxito mientras captura otra pestaña o declarar fallo donde el producto sí funciona. | Derivar pestañas del registro semántico del frontend y exigir coincidencia de sección/pestaña activa antes de capturar. |
| MON-VIS-07 | P2 | Territorial, Acreditación, Telefónico | Navegación local icon-only incluso en escritorio amplio; se pierden `badge` y `status`. | Descubribilidad baja y dependencia del tooltip/memoria. | Mostrar etiqueta persistente de la pestaña activa y conservar badge/estado; icon-only solo en compacto. |
| MON-VIS-08 | P2 | Acreditación, Territorial | Consultas y mapas requieren scrolls de cientos o miles de píxeles, a veces anidados. | La información es alcanzable, pero la comparación y el retorno al contexto son costosos. | Virtualizar listas, compactar filas y mantener selección/encabezado visibles. Evitar más de un scroll vertical por columna. |
| MON-VIS-09 | P2 | Aulas, Telefónico | Estados vacíos comunican éxito o certeza cuando falta configuración o una fuente. | “Sin alertas” puede interpretarse como control ejecutado y aprobado. | Usar “No evaluado”, “Sin configurar” o “Sin datos para este corte”; verde solo tras ejecutar el control. |
| MON-VIS-10 | P2 | Territorial | Anulación usa confirmaciones nativas y permite avanzar sin preview/motivo obligatorio. | Riesgo de error en una acción destructiva y experiencia visual ajena al sistema. | Diálogo Pulso con preview, motivo obligatorio, Cancelar predeterminado y restauración de foco. |
| MON-VIS-11 | P3 | Acreditación | Un `input` desborda internamente 11 px a 1024×600. | Pulido compacto incompleto, sin derrame global. | Ajustar `min-width`, padding o `box-sizing`; el reporte de 1024×600 debe quedar sin issues. |
| MON-VIS-12 | P3 | Transversal | Texto auxiliar extremadamente pequeño, literales de color y fechas ISO sin localizar. | Legibilidad y consistencia visual menores. | Mínimo legible para metadatos, tokens semánticos y fechas locales consistentes. |

## Auditoría por modo

### 1. Territorial — rechazado

#### P1: contenido cortado

La evidencia confirma contenido no alcanzable en:

- **Fuente / Filtro y distritos:** 203 px en dos regiones.
- **UMPs / Cobertura:** 114, 104 y 59 px.
- **UMPs / Manzanas:** 120 px.
- **Consultas / Subsanaciones:** 126 px.
- **Ocurrencias / Resumen:** 39 px.
- **Ocurrencias / Alertas:** 378 px.
- **Ocurrencias / UMP:** el contenedor sí hace scroll, pero ofrece apenas 16 px
  visibles para 339 px de contenido; es técnicamente alcanzable y
  funcionalmente inutilizable.

Ejemplos:

- Filtro y distritos: `outputs/ux-audit/monitoreo-2026-07-25/deep-tabs/territorial/screenshots/tabs/02-fuente-filtro-y-distritos.png`.
- Ocurrencias / Alertas: `outputs/ux-audit/monitoreo-2026-07-25/deep-tabs/territorial/screenshots/tabs/25-ocurrencias-alertas.png`.
- Ocurrencias / UMP: `outputs/ux-audit/monitoreo-2026-07-25/deep-tabs/territorial/screenshots/tabs/24-ocurrencias-ump.png`.

**Mejora:** liberar la altura del hijo o convertir el contenedor correcto en
scroll owner. Las listas de UMP deben mostrar al menos dos tarjetas completas
sin interacción. Todo contenido debe ser accesible con rueda, trackpad y
teclado.

#### P1: conteos incompatibles

La misma operación presenta 36 respuestas recibidas, 22 que pasan filtro, “100%
de 24 entrevistas”, 31 GPS parseables y, en otras superficies, 0 válidas, 0%
de avance y 0 GPS.

**Mejora:** separar visualmente tres granos:

1. ingesta cruda;
2. casos elegibles/procesables;
3. avance oficial válido.

Cada superficie debe mostrar el mismo conteo oficial y, cuando difiera del
crudo, explicar la regla causal con un enlace directo al bloqueo.

#### P1: salidas sin avance válido

`Avance / Salidas` —evidencia local en
`outputs/ux-audit/monitoreo-2026-07-25/deep-tabs/territorial/screenshots/tabs/21-avance-salidas.png`—
ofrece PDF y paquete con 0 válidas. El gate actual se apoya en snapshot y número
de filas, no en registros procesables.

**Aceptación:** con cero válidas se deshabilitan las salidas de cliente. Un
paquete diagnóstico, si existe, debe decir “Borrador no publicable”.

#### P1: semántica verde incorrecta

“Pendiente”, “Sin configurar”, “Sin asset” y “0 reportes” aparecen con
tratamiento verde en Formulario y Ocurrencias. El acento de selección está
mezclado con el tono de estado.

**Aceptación:** selección y readiness usan canales visuales distintos. Verde
significa exclusivamente “Listo”.

#### P2: fricción y densidad

- 26 pestañas dependen de iconos sin etiqueta persistente.
- Ocurrencias repite aproximadamente 360 px de configuración antes del
  contenido de cada pestaña.
- Avance / Mapa y UMP usa un scroll principal de 1060 px y dos scrolls internos
  de 223 y 39 px, además de dos mapas.
- Cuotas exige 1755 px internos.
- El inspector UMP cambia de lado según la paridad de la fila, alterando la
  memoria espacial.
- Ritmo comunica “Mejor día válido: 0” en vez de un estado vacío causal.

**Mejora:** fijar la posición del inspector, fusionar mapas mediante capas,
colapsar configuración repetida y conservar visible el nombre de la pestaña.

#### Fortaleza

La jerarquía modo → sección → pestaña es estable; los patrones de mapa y
master-detail son claros cuando el layout no los recorta.

### 2. Acreditación — rechazado por el P1 de salidas; resto con pendientes P2/P3

Las 22 pestañas actuales están hidratadas y el contenido es alcanzable. Los 45
“unreachable” del auditor son falsos positivos de enlaces
`.pulso-module-tile` con 27 px de texto excedente, no regiones de datos.

#### P1 compartido: salida publicable con estado indeterminado

`Avance / Salidas` —evidencia local en
`outputs/ux-audit/monitoreo-2026-07-25/deep-tabs-v2/acreditacion/screenshots/tabs/22-avance-salidas.png`—
muestra `ESTADO Pendiente`, `EFECTIVAS S/D` y, al mismo tiempo, botones
habilitados para generar PDFs.

**Aceptación:** el panel de salidas explica su readiness. Sin efectivas
determinadas, la salida oficial queda bloqueada o rotulada como borrador.

#### P2: listas excesivamente largas

- Registros en plataforma: 4880 px.
- Estado de la base: 4451 px.
- Cruces efectivos: 10225 px más 983 px del inspector.
- Subsanación: 5802 px más 1304 px del detalle.
- Avance / Actores: 1462 px.

No hay scroll jail. Los encabezados y filtros permanecen visibles y el
master-detail conserva contexto, pero la longitud vuelve costosa la exploración.

**Mejora:** virtualización o paginación, filas más compactas, “N de M” visible,
atajos a pendientes y preservación del caso seleccionado.

#### P2: espacio sin uso y estados sin siguiente acción

- Modelo / Lectura deja gran parte del lienzo vacío.
- Teléfono / Sin efectiva prioriza un estado vacío y desplaza la tabla útil.
- Responsables puede comunicar filas sin responsable sin un CTA directo a la
  configuración propietaria.

**Mejora:** colapsar vacíos, elevar la acción útil y añadir deep-links
contextuales.

#### P3: compacto

La matriz de viewports no detecta desbordamiento global. A 1024×600 existe un
`input` con 148 px útiles y 159 px de contenido.

#### Fortaleza

Consultas / Cruces y Subsanación presentan una de las mejores soluciones
master-detail del módulo: filtros, selección, explicación de la decisión y
trazabilidad permanecen comprensibles durante el scroll.

### 3. Aulas universitarias — rechazado

#### P1: corte no defendible

`Avance / Resumen` —evidencia local en
`outputs/ux-audit/monitoreo-2026-07-25/deep-tabs/aulas_universitarias/screenshots/tabs/01-avance-resumen.png`—
presenta:

- 0 cursos-horario aplicados;
- 8 respuestas válidas;
- 100% de representatividad;
- 8 brechas;
- estado “Pendiente” y corte “Listo”.

**Mejora:** mostrar denominadores y distinguir cobertura de respuestas,
representatividad de muestra y aplicación por curso. Si el snapshot está
desactualizado, debe existir un banner explícito.

#### P1: pasos verdes sin evidencia

`Agenda / Aulas` —evidencia local en
`outputs/ux-audit/monitoreo-2026-07-25/deep-tabs/aulas_universitarias/screenshots/tabs/02-agenda-aulas.png`—
pinta en verde `Kobo + QR` y `Fichas PDF/Word`, pero el detalle dice `0/8`,
`pendiente` y `sin enlaces`.

**Aceptación:** los pasos de proceso son neutrales cuando solo describen
arquitectura; verde exige evidencia operativa.

#### P1: información silenciosamente omitida

La implementación limita las tablas a ocho columnas y 80 filas. Agenda solicita
nueve columnas, por lo que campos como origen/recopilador pueden desaparecer sin
aviso.

**Mejora:** columnas esenciales siempre visibles, selector de columnas,
paginación/virtualización y mensaje “Mostrando N de M”.

#### P1: Consultas mezcla granos

`Inicio` y `final del scroll` —evidencia local en
`outputs/ux-audit/monitoreo-2026-07-25/deep-tabs/aulas_universitarias/screenshots/tabs/04-consultas-brechas.png`
y
`outputs/ux-audit/monitoreo-2026-07-25/deep-tabs/aulas_universitarias/screenshots/tabs/04-consultas-brechas-scroll-consultas-0-bottom.png`—
muestran cursos repetidos en “Reemplazos y brechas”, sin columna que distinga
tipo, motivo o relación titular–reemplazo.

**Aceptación:** cada fila identifica su grano, procedencia, motivo y acción.

#### P2: falsos éxitos y acciones sin prerrequisito

- Validación usa “Correcto” cuando no hay cuota detectable y el KPI es 0/0.
- Fuentes ofrece “Sincronizar campo” con 0/0 fuentes activas.
- La fecha “Generado” se presenta como ISO crudo.

**Mejora:** usar “No aplica”, “Sin configurar” o “No evaluado”; deshabilitar o
explicar acciones sin prerequisitos y localizar las fechas.

#### Scroll

Consultas tiene un scroll interno real de 74 px. El encabezado y la última fila
son alcanzables; no hay scroll jail en el fixture.

### 4. Telefónico — rechazado

La pasada final recorrió las cinco secciones y 15 pestañas actuales:

- Fuentes: Kobo, Base y barrido, Paquete.
- Modelo: Cuotas, Cronograma.
- Consultas: Efectivas Kobo, CodPulso.
- Llamadas: Resumen, Tiempos, Incidencia, Responsables, Alertas.
- Avance: Diario, Cuotas, Salidas.

#### P1: fuentes y avance no comparten la misma verdad

`Fuentes / Paquete` —evidencia local en
`outputs/ux-audit/monitoreo-2026-07-25/deep-tabs-v3/telefonico/screenshots/tabs/03-fuentes-paquete.png`—
declara 2/3 fuentes, `Falta Kobo`, 0 encuestas y `Sin sync`.

`Avance / Salidas` —evidencia local en
`outputs/ux-audit/monitoreo-2026-07-25/deep-tabs-v3/telefonico/screenshots/tabs/15-avance-salidas.png`—
declara 9 efectivas Kobo, CodPulso 9/9 y habilita PDFs mientras el estado global
continúa “Pendiente”.

**Mejora:** diferenciar claramente datos históricos del snapshot frente a
fuentes conectadas actuales. El usuario debe ver fecha, procedencia y
completitud del conteo usado por cada salida.

**Aceptación:** una fuente faltante nunca convive con métricas “listas” sin
explicación. Las salidas oficiales requieren un corte completo o muestran
marca de agua y advertencia.

#### P1: Alertas ofrece falsa certeza

`Llamadas / Alertas` —evidencia local en
`outputs/ux-audit/monitoreo-2026-07-25/deep-tabs-v3/telefonico/screenshots/tabs/12-telefono-alertas.png`—
muestra 2/3 fuentes y estado pendiente, pero comunica que no hay observaciones
y que la consistencia está lista.

**Mejora:** “Sin observaciones disponibles para este corte” hasta contar con
las fuentes requeridas. Consolidar hero, vacío central y lateral en un solo
estado con causa y siguiente acción.

#### P2: scroll y redundancia

- Resumen repite Responsables en un panel con 182 px de scroll poco evidente.
- Incidencia necesita 377 px adicionales.
- Avance / Cuotas usa 622 px internos.
- Fuentes usa 579, 310 y 546 px según la pestaña.
- CodPulso usa un inspector de 559 px más una tabla de 33 px.

Todos son alcanzables. La mejora principal no es “añadir más scroll”, sino
reducir duplicación, hacer visible la affordance y conservar el detalle completo
en su pestaña propietaria.

#### P2: navegación

Las pestañas locales se representan solo con iconos. Incidencia y Alertas son
especialmente ambiguas.

**Aceptación:** mostrar etiqueta de la activa y badge/estado; tooltip accesible
con mouse y teclado para las demás.

#### Fortaleza

Fuentes / Paquete explica con claridad el contrato de base, barrido y Kobo, y
señala la fuente faltante con una acción concreta. Ese patrón debe convertirse
en la fuente de verdad visual de Avance y Salidas.

## Navegación, accesibilidad y sistema visual

### Navegación local

El rail secundario permanece icon-only incluso a 1600 px. El componente recibe
`badge` y `status`, pero el adaptador los descarta. Tampoco hay un rótulo
persistente de la pestaña activa.

**Propuesta:**

- escritorio: icono + etiqueta activa + badge/estado;
- compacto: iconos, pero con indicador activo más rótulo contextual;
- tooltip visible por hover y foco;
- URL, foco y selección sincronizados;
- nombre de sección y pestaña anunciado por lector de pantalla sin aplicar
  `aria-live` a todo el `<main>`.

### Legibilidad

El timestamp del rail llega a 7 px y varios metadatos usan 8–10 px. A 1024×600
la jerarquía principal sigue siendo legible, pero aparecen KPI truncados y
campos muy comprimidos.

**Aceptación:** texto auxiliar dentro del mínimo definido por el sistema,
etiquetas críticas sin elipsis y controles de al menos 32 px de alto en
compacto.

### Color y tokens

Territorial y Telefónico contienen numerosos colores literales. El problema
visible no es solo deuda técnica: los literales permiten que “seleccionado”,
“pendiente” y “listo” terminen compartiendo verde.

**Propuesta:** tokens separados para:

- selección;
- información;
- éxito;
- advertencia;
- bloqueo;
- dato ausente;
- estado no evaluado.

## Cobertura pestaña por pestaña

La columna “Scroll útil” registra píxeles adicionales realmente alcanzables.
“No alcanzable” registra exceso sin dueño de scroll. Se excluyen de esta última
los falsos positivos de enlaces `.pulso-module-tile`.

### Territorial

| Sección / pestaña | Hidratada | Scroll útil (px) | No alcanzable (px) |
|---|---:|---:|---:|
| Fuente/Formulario | Sí | — | — |
| Fuente/Filtro y distritos | Sí | — | 203, 203 |
| Fuente/Encuestadores | Sí | — | — |
| Fuente/Reconciliación | Sí | 295, 181 | — |
| Fuente/Historial | Sí | — | — |
| UMPs/Cobertura | Sí | — | 114, 104, 59 |
| UMPs/Manzanas | Sí | — | 120 |
| Validación/Geolocalización | Sí | 35 | — |
| Validación/Reconciliación UMP | Sí | — | — |
| Validación/Duración de tiempo | Sí | 416 | — |
| Validación/Cuotas | Sí | 1755 | — |
| Validación/Anulación | Sí | 79 | — |
| Consultas/Registro | Sí | — | — |
| Consultas/GPS por revisar | Sí | — | — |
| Consultas/Duración por revisar | Sí | — | — |
| Consultas/Cruce responsable | Sí | — | — |
| Consultas/Subsanaciones | Sí | — | 126 |
| Avance/Resumen | Sí | 912 | — |
| Avance/Mapa y UMP | Sí | 1060, 223, 39 | — |
| Avance/Ritmo diario | Sí | — | — |
| Avance/Salidas | Sí | — | — |
| Ocurrencias/Resumen | Sí | — | 39 |
| Ocurrencias/Reporte UMP | Sí | 47 | — |
| Ocurrencias/UMP | Sí | 323 | — |
| Ocurrencias/Alertas | Sí | — | 378 |
| Ocurrencias/Ritmo | Sí | — | — |

### Acreditación

| Sección / pestaña | Hidratada | Scroll útil (px) | No alcanzable (px) |
|---|---:|---:|---:|
| Fuentes/Plataforma | Sí | 539 | — |
| Fuentes/Bases | Sí | — | — |
| Fuentes/Recopiladores | Sí | — | — |
| Fuentes/Estado | Sí | 434, 106 | — |
| Modelo/Modelo operativo | Sí | — | — |
| Modelo/Cronograma | Sí | — | — |
| Modelo/Lectura | Sí | — | — |
| Consultas/Registros en plataforma | Sí | 4880 | — |
| Consultas/Estado de la base | Sí | 4451 | — |
| Consultas/Cruces efectivos | Sí | 10225, 983 | — |
| Consultas/Subsanación | Sí | 5802, 1304 | — |
| Teléfono/Barrido + Kobo | Sí | — | — |
| Teléfono/Ritmo diario | Sí | — | — |
| Teléfono/Sin efectiva | Sí | — | — |
| Teléfono/Responsables | Sí | — | — |
| Teléfono/Alertas reales | Sí | — | — |
| Teléfono/Supervisión | Sí | — | — |
| Avance/Resumen | Sí | — | — |
| Avance/Actores | Sí | 1462 | — |
| Avance/Encuestas | Sí | — | — |
| Avance/Detalle | Sí | — | — |
| Avance/Salidas | Sí | — | — |

### Aulas universitarias

| Sección / pestaña | Hidratada | Scroll útil (px) | No alcanzable (px) |
|---|---:|---:|---:|
| Avance/Resumen | Sí | — | — |
| Agenda/Aulas | Sí | — | — |
| Validación/Alertas | Sí | — | — |
| Consultas/Brechas | Sí | 74 | — |
| Fuentes/Plan | Sí | — | — |

### Telefónico

| Sección / pestaña | Hidratada | Scroll útil (px) | No alcanzable (px) |
|---|---:|---:|---:|
| Fuentes/Kobo | Sí | 579 | — |
| Fuentes/Base y barrido | Sí | 310 | — |
| Fuentes/Paquete | Sí | 546 | — |
| Modelo/Cuotas | Sí | — | — |
| Modelo/Cronograma | Sí | 306 | — |
| Consultas/Efectivas Kobo | Sí | — | — |
| Consultas/CodPulso | Sí | 559, 33 | — |
| Llamadas/Resumen | Sí | 182 | — |
| Llamadas/Tiempos | Sí | — | — |
| Llamadas/Incidencia | Sí | 377 | — |
| Llamadas/Responsables | Sí | — | — |
| Llamadas/Alertas | Sí | — | — |
| Avance/Diario | Sí | — | — |
| Avance/Cuotas | Sí | 622 | — |
| Avance/Salidas | Sí | — | — |

## Plan de mejora recomendado

### Ola 1 — bloquear errores operativos

1. Reparar los seis scroll jails territoriales y el séptimo scroll
   funcionalmente inutilizable de Ocurrencias / UMP.
2. Introducir el contrato común de readiness y semántica de color.
3. Gatear salidas por registros procesables y completitud del corte.
4. Corregir el corte de Aulas y hacer explícitos sus denominadores.
5. Eliminar truncación silenciosa de tablas.

### Ola 2 — reducir carga cognitiva

1. Rail local con etiqueta activa, badge y estado.
2. Virtualizar Consultas de Acreditación y compactar Avance/Actores.
3. Quitar configuración repetida en Ocurrencias.
4. Consolidar vacíos y señales duplicadas en Alertas telefónicas.
5. Reducir scroll anidado y fijar posición de inspectores.

### Ola 3 — pulido y contrato QA

1. Corregir el `input` de 1024×600.
2. Elevar tamaños mínimos de metadatos y localizar fechas.
3. Migrar colores literales a tokens semánticos.
4. Derivar el catálogo del auditor del registro real de pestañas.
5. Añadir checks que fallen si `scrollTop` no cambia, si la captura middle/final
   es idéntica o si sección/pestaña activa no coincide con la declarada.

## Criterio de cierre

El módulo puede aprobarse cuando:

- las 68 pestañas siguen hidratando sin errores;
- no existe contenido de datos con `unreachable:true`;
- las salidas oficiales están bloqueadas para cortes incompletos;
- un mismo corte expresa conteos y estados coherentes en todas sus secciones;
- “sin datos” no se pinta como éxito;
- el rail identifica la pestaña activa sin depender del tooltip;
- los cinco viewports quedan sin overflow global ni truncamiento crítico;
- el auditor usa el catálogo vigente y conserva evidencia inicial, media y
  final de cada scroll real.
