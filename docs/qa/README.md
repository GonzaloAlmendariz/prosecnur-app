# Calidad y evidencia

Esta portada inventaría los documentos de `docs/qa/`. Son baselines, auditorías,
matrices, planes y registros fechados: describen evidencia o trabajo pendiente,
pero no reemplazan contratos ejecutables, ADR aceptados ni la arquitectura
canónica. Vuelva al [índice general](../README.md) para consultar la precedencia.

## Vigentes

- [Baseline canónico de deuda](deuda-baseline.md): referencia comparativa para
  las auditorías periódicas.
- [Medición estructural de deuda de Monitoreo](deuda-monitoreo.md): corte
  detallado que complementa el baseline.
- [Escalabilidad arquitectónica — corte 2026-07-29](escalabilidad-arquitectonica-2026-07-29.md):
  evaluación de capacidad y límites del contrato local-first.
- [Auditoría de cumplimiento del ADR 0019](auditoria-adr-0019-cursos-horario-2026-07-30.md):
  contraste del perfil de cursos-horario contra su decisión y sus pruebas.
- [Lecciones operativas de revamps visuales](revamps-visuales-lecciones-operativas-2026-07-26.md):
  contrato complementario para validar reparaciones visuales.
- [Prompt de validación visual de referencia](prompt-validacion-visual-referencia.md):
  guía reutilizable; no es evidencia de una ejecución.
- [Calidad estadística del Cálculo de muestra](calidad-estadistica-calc-muestra-2026-08-07.md):
  auditoría de tres lentes del eje estadístico de aulas y su reparación.
- [Anatomía de los tres Excel de un estudio de aulas](anatomia-excels-aulas-2026-08-16.md): registro qa fechado.
- [Recetario del mazo de acreditación — valores medidos, no propuestos](cookbook-mazo-acreditacion-2026-08-14.md): registro qa fechado.
- [Estándar de PPT de acreditación — de 51 comentarios a 17 reglas](estandar-ppt-acreditacion-2026-08-14.md): registro qa fechado.
- [Implicancias de retirar del marco los cursos-horario del estudio IAGen](implicancias-retiro-iagen-2026-08-22.md): registro qa fechado.
- [Mapa de los 57 comentarios del mazo de Contabilidad](mapa-comentarios-conta-2026-08-16.md): registro qa fechado.
- [Plan 1b — el esperado redefinido, de punta a punta](plan-1b-esperado-redefinido-2026-08-20.md): plan de trabajo qa.
- [Plan de ticks — de la selección de aulas al control de campo](plan-ticks-hsvg2026-2026-08-22.md): plan de trabajo qa.
- [Checklist dimensionado: las tres fuentes de Monitoreo](checklist-tres-fuentes-monitoreo-2026-08-27.md): agendación, registro de campo y base de control, cada una con qué está cubierto, qué es parcial y qué falta; más los filtros de encuesta válida, la procedencia y la crítica de forma.
- [Simular la primera semana de HSVG2026 con el campo real de 2025](simulacion-semana1-hsvg2026-2026-08-27.md): qué saldría tras una semana sobre las 174 reales calibrando con 2025 —nueve de quince facultades no llegarían con sus titulares— y qué destapa eso en Monitoreo, incluido el criterio C-F de procedencia.
- [Monitoreo: criterios generales y prueba con la selección real](checklist-monitoreo-criterios-2026-08-26.md): los cinco criterios de dominio que Monitoreo tiene que sostener, y el plan para probarlos con las 174 aulas de HSVG26ULT.
- [Seguimiento de τ en campo — diseño de la superficie](seguimiento-tau-campo-2026-08-26.md): dónde vive el contraste entre la τ que dimensionó y la que rinde el campo, con su checklist.
- [Plan de 25 ticks — Monitoreo de aulas: Validación como instrumento](plan-validacion-aulas-2026-08-20.md): plan de trabajo qa.
- [Recorrido del usuario nuevo — Cálculo de muestra (2026-08-21)](recorrido-usuario-nuevo-2026-08-21.md): registro qa fechado.
- [Traslape entre el estudio IAGen (DAA) y HSVG 2026](traslape-iagen-hsvg-2026-08-21.md): registro qa fechado.

### Operativo de aulas (HSVG2026 y CCSS Perfil)

- [Auditoría del motor de selección de aulas](auditoria-motor-aulas-2026-08-28.md): el entregable y el motor calculaban cosas distintas; qué se puede afirmar del sorteo ULT2.
- [La tasa de la facultad frente a la tasa del aula](tasa-de-facultad-frente-a-tasa-de-aula-2026-08-28.md): las dos tasas del esperado, de dónde sale cada una y por qué difieren.
- [Suficiencia por facultad — HSVG 2026 sobre ULT2](suficiencia-por-facultad-hsvg2026-2026-08-28.md): con las aulas agendadas y la tasa supuesta, si cada facultad llega a su cuota.
- [Plan: las dos tasas en Monitoreo](plan-dos-tasas-en-monitoreo-2026-08-28.md): mapeo sin ejecutar de lo que ya existe para distinguir las dos tasas.
- [Sesión del 28 de agosto de 2026, HSVG PUCP 2026](sesion-hsvg2026-2026-08-28.md): resumen de la sesión del segundo sorteo y de lo que destapó.
- [Mapa de lo pendiente — cursos-horario, 2026-08-24](mapa-pendientes-aulas-2026-08-24.md): relevo del loop de cálculo de muestra a monitoreo: qué queda y dónde vive.
- [Censo de las cuatro cifras (A9-B7)](censo-cuatro-cifras-2026-09-01.md): cuatro conceptos repartidos en nueve claves del payload; insumo de diseño de B7.
- [Pendientes al cierre del loop de mejora visual](pendientes-cierre-loop-2026-09-03.md): acta del cierre del 2026-09-03 con todo lo que quedó vivo.
- [Traspaso — operativo de aulas, cierre del día 1](traspaso-operativo-aulas-2026-09-07.md): documentos vivos, lo cerrado con su commit y lo ya medido.
- [Cómo encajan los dos Sheets y la app](operativa-aulas-dos-sheets-y-la-app-2026-09-08.md): quién es dueño de qué dato y en qué orden se sincroniza.
- [Un ancho fijo acaba cortando un dato](anchos-que-cortan-datos-2026-09-09.md): lección del libro de aulas sobre anchos literales en el `.xlsx`.
- [El PDF de avance a cliente de cursos-horario](goal-pdf-cliente-aulas-2026-09-11.md): reglas del documento y lo que no hay que volver a hacer.
- [Seguimiento de cuotas en cursos-horario — método y motores](metodo-seguimiento-cuotas-aulas.md): con qué motor sale cada cifra del avance y qué trampas costaron un ciclo.
- [Croquis del campus PUCP — fuentes](croquis-campus-pucp-fuentes.md): respaldo de las coordenadas embebidas en el croquis de B32.

### Robustez

- [Robustez — la noche del 2026-09-11 al 12](goal-robustez-2026-09-12.md): diario de lo medido, lo arreglado y las recetas para reproducirlo.

### Motores de entregables y editor de Gráficos (F6)

- [Dirección de diseño del editor de Gráficos (F6.0)](direccion-diseno-editor-graficos-f6-2026-10-09.md): dirección aprobada por Gonzalo el 2026-10-09.
- [Plan de integración F6](plan-integracion-f6-2026-10-10.md): cómo se construyen F6.1–F6.5 bajo la dirección aprobada.
- [Contrato de movimiento F6](contrato-movimiento-f6-2026-10-10.md): animaciones de la pestaña Láminas y sus principios.
- [Contrato — orden de categorías por gráfico (D8)](contrato-orden-categorias-f6-2026-10-10.md): clave y forma del orden por defecto, invertido y personalizado.
- [Tamaño de letra por perfil de cliente (K13)](spec-tamano-letra-perfil-f6-2026-10-10.md): pasos con nombre que desplazan los valores del recetario.
- [Inventario conciliado de íconos (F6.1b)](inventario-iconos-recetario-2026-10-10.md): íconos del recetario frente a los del motor, lámina por lámina.
- [K15 — estándar contra lo dibujado en el recetario](k15-estandar-vs-recetario-2026-10-10.md): ranuras del estándar medidas sobre las láminas de ejemplo.
- [Hallazgo: con peso, la «Base» del informe es la suma de pesos](hallazgo-base-ponderada-2026-10-10.md): hallazgo metodológico con decisiones S1–S5 pendientes.
- [Meta B — encargo del loop del revamp visual](encargo-loop-revamp-visual-2026-10-10.md):
  lo que la sesión «Revamp visual» abre el primer día: rectores, tablero B0–B9, decisiones cerradas, traspaso a la nube, primer paso y pedidos a la Meta A.
- [Plan de traspaso en tres sesiones](plan-traspaso-tres-sesiones-2026-10-10.md): Fase 0 calidad, Meta A Gráficos y Meta B revamp visual, con dueños de archivos y reglas de integración.
- [GOAL — Fase 0: Quality en verde](goal-ci-calidad-2026-10-10.md): tablero de los gates rojos del traspaso.
- [Meta A — Gráficos (encargo del loop F6)](encargo-loop-f6-2026-10-10.md): vara, tablero A0–A11, colas, decisiones y operación.

## En curso

- [Goal loop de Cálculo de muestra](goal-loop-calc-muestra-2026-07-31.md):
  selector con evidencia estadística, revamp de Aulas y ledger de iteraciones.
- [Goal loop visual de toda la aplicación](goal-loop-visual-app-2026-07-30.md):
  órbita de los ocho módulos del proyecto y Enciclopedia como utilidad global.
- [Remasterización de la UI — documento maestro (2026-10-10)](remasterizacion-ui-2026-10-10.md):
  el punto de entrada único: diagnóstico, decisiones, el kit pieza por
  pieza, la maqueta página por página, las 36 unidades detalladas, el plan,
  la vara, el ledger y las trampas.
- [Estado del CI en el traspaso (2026-10-10)](estado-ci-traspaso-2026-10-10.md):
  gate por gate del pre-flight antes de subir 2.463 commits; qué está rojo,
  por qué, y dónde vive el trabajo que se traspasa. La maqueta de la
  remasterización vive en `maqueta-remasterizacion-2026-10-10/`.
- [Censo de acciones de datos en Monitoreo (2026-10-10)](censo-acciones-datos-monitoreo-2026-10-10.md):
  qué hace cada botón de actualización en los cuatro perfiles hasta el
  endpoint, y el modelo «un verbo por dirección» (L38).
- [Censo de animaciones y sistema de movimiento (2026-10-10)](censo-animaciones-2026-10-10.md):
  233 keyframes sin sistema, 34 transiciones de layout, 13 presses; los
  principios, el catálogo de 22 coreografías y el antes/después (L37).
- [Plan de trabajo — remasterización de la UI (2026-10-10)](plan-trabajo-remasterizacion-ui-2026-10-10.md):
  siete vueltas ordenadas por dependencia (el kit primero), cada unidad con
  su maqueta, archivos, agente y gate; 73 sesiones orientativas.
- [GOAL — La app se siente de una sola generación (2026-10-10)](goal-modernizacion-ui-2026-10-10.md):
  vara, cola en seis oleadas, decisiones que esperan al dueño, ledger y
  trampas; el plan de acción del censo.
- [Censo de la UI — estado, deuda y techo de modernización (2026-10-10)](censo-ui-2026-10-10.md):
  mapa módulo → modo → sección → pestaña → panel, madurez por módulo, la
  quinta dimensión (diálogos y flujos de Carga), cumplimiento de la v3,
  diagnóstico de modernidad y techo por capas.
- [Plan de mejoras de julio de 2026](plan-mejoras-2026-07.md): priorización
  operativa de deuda y calidad.
- [Roadmap del motor de Gráficos](roadmap-motor-graficos-2026-08-08.md): deuda
  medida del motor y catálogo de tipos de gráfico pendientes, en cuatro olas.
- [Estado del pulido estético de Monitoreo](pulido-monitoreo-estado.md):
  bitácora viva del recorrido de superficies.
- [Goal loop visual de Selección](goal-loop-seleccion-visual-2026-08-09.md):
  Selección alcanza la vara visual de Cálculo y Marco, superficie por superficie.
- [Registro del motor de Gráficos](registro-motor-graficos-2026-08-10.md):
  qué está reparado, qué sigue roto y qué del deck 2021 llega al usuario.
- [Validación contra el deck de acreditación 2021](validacion-deck-acreditacion-2021.md):
  medición del motor contra una vara externa, lámina por lámina.
- [Checklist — las 19 preguntas que Ulises marcó en el XLSForm de ACNUR V3](checklist-acnur-v3-preguntas-ausentes-2026-08-19.md): checklist qa fechado.
- [Checklist — la cadena operativa de aulas, de punta a punta](checklist-cadena-operativa-aulas-2026-08-23.md): checklist qa fechado.
- [Checklist — las siete decisiones de Gonzalo y la cola del loop de cobertura](checklist-decisiones-certeza-2026-08-27.md): checklist qa fechado.
- [Checklist — la certeza de cobertura simula con τ y no con la tasa del aula](checklist-certeza-tasa-por-aula-2026-08-28.md): checklist qa fechado.
- [Diagnóstico — el sorteo de aulas de HSVG 2026, medido contra el motor](diagnostico-sorteo-aulas-hsvg2026-2026-08-26.md): diagnóstico qa fechado.
- [Diagnóstico del sorteo de aulas — HSVG PUCP 2026-2](diagnostico-sorteo-aulas-hsvg2026-seleccion-2026-08-26.md): diagnóstico qa fechado.
- [Checklist — cadena de reemplazos, objetivo de profundidad y rendimiento P05](checklist-cadena-reemplazos-2026-08-16.md): checklist qa fechado.
- [Checklist — pendientes de Cálculo de muestra tras la revisión del 2026-08-15](checklist-calc-muestra-2026-08-15.md): checklist de trabajo (documento vivo).
- [Checklist — experiencia del usuario nuevo en Cálculo de muestra (2026-08-21)](checklist-experiencia-usuario-nuevo-2026-08-21.md): checklist qa fechado.
- [Checklist — el libro de agendación deja de calcar el Excel viejo](checklist-libro-agendacion-2026-08-21.md): checklist qa fechado.
- [Checklist — que ningún control declarado pueda no llegar](checklist-mandos-vivos-2026-08-13.md): checklist qa fechado.
- [Checklist — el mazo revisado contra PowerPoint, no contra LibreOffice](checklist-mazo-conta-powerpoint-2026-08-16.md): checklist qa fechado.
- [Checklist — nueve arreglos al motor, los presets y el proyecto](checklist-motor-graficos-2026-08-11.md): checklist qa fechado.
- [Checklist — el pipeline de aulas de punta a punta (2026-08-16)](checklist-pipeline-aulas-2026-08-16.md): checklist qa fechado.
- [Replicar 2025 con el motor de 2026 — doc vivo](checklist-replicacion-2025-2026-08-17.md): checklist qa fechado.
- [Checklist — sinergia calc-muestra ↔ Monitoreo: el excel de agendación (2026-08-20)](checklist-sinergia-agendacion-2026-08-20.md): checklist qa fechado.
- [GOAL — Cálculo de muestra: el marco se puede defender](goal-calc-muestra-marco-defendible-2026-08-15.md): goal operativo (loop de convergencia).
- [GOAL — Cálculo de muestra: reconstruir HSyVbG desde cero y llegar al 2025](goal-calc-muestra-replicar-2025-2026-08-16.md): goal operativo (loop de convergencia).
- [GOAL — el aula se recoge sola: del sorteo al dato, sin planilla paralela](goal-campo-aulas-qr-registro-2026-08-16.md): registro de goal loop.
- [GOAL — el mazo de acreditación sale conforme al recetario, sin retoques](goal-mazo-sin-retoques-2026-08-14.md): registro de goal loop.
- [GOAL — Método y Simulación se entienden solas](goal-metodo-simulacion-2026-08-22.md): registro de goal loop.
- [GOAL — Monitoreo mira cómo se está trabajando, no solo cuánto falta](goal-monitoreo-calidad-campo-2026-08-13.md): registro de goal loop.
- [GOAL — El motor produce el informe de Contabilidad, y después mejor](goal-motor-mazo-estandar-conta-2026-08-16.md): goal operativo (loop de convergencia).
- [GOAL — la entrega se explica sola, sin exponer el caso](goal-reproducibilidad-entrega-2026-08-15.md): registro de goal loop.
- [GOAL — la interfaz dice lo que el motor ya sabe](goal-ui-dice-lo-que-el-motor-sabe-2026-08-15.md): registro de goal loop.
- [GOAL — La validación deja de ser un espejo del instrumento](goal-validacion-extrinseca-2026-08-12.md): registro de goal loop.
- [Las preguntas que el libro permite y la app contesta (o no)](preguntas-monitoreo-aulas-2026-08-18.md): registro qa fechado.
- [El script y el informe deben quedar claros y reproducibles, sin exponer el caso](reproducibilidad-decisiones-pendiente-2026-08-15.md): registro qa fechado.
- [Quién usa estas pantallas y qué hace con ellas](roles-del-operativo-de-aulas-2026-08-22.md): registro qa fechado.
- [Validez estadística de la cadena del esperado — revisión exhaustiva](validez-cadena-esperado-2026-08-20.md): registro qa fechado.

### Operativo de aulas (HSVG2026 y CCSS Perfil)

- [Checklist — motor de aulas y sus indicadores](checklist-motor-aulas-2026-08-24.md): lo que la revisión del diseño de Kamila dejó para el motor.
- [Barrido de la mesa de Cálculo de muestra](checklist-barrido-mesa-calc-muestra-2026-08-25.md): la mesa contra el Contrato de Superficie, defecto por defecto.
- [Checklist — la ficha de campo sale con sus datos](checklist-ficha-campo-datos-2026-08-27.md): pabellón, aula, curso, horario y docente que morían en tres eslabones.
- [GOAL — Monitoreo de aulas, genuinamente profesional](goal-monitoreo-profesional-2026-08-28.md): loop de convergencia abierto; solo Gonzalo lo cierra.
- [Loop definido — Monitoreo de aulas](checklist-loop-definido-aulas-2026-08-28.md): cierra lo que destapó el simulacro de semana y media.
- [Avance, superficie por superficie, contra su norte](auditoria-avance-aulas-2026-08-29.md): auditoría de Avance contra la cuota de sexo por facultad.
- [Checklist — registro académico y lectura no técnica](checklist-registro-academico-aulas-2026-08-29.md): español sin jerga y Avance como revisión no técnica.
- [Checklist — operativo de aulas 2026](checklist-operativo-aulas-2026-08-31.md): cerrar el circuito del libro y superar 2025.
- [Checklist · Asignación de aplicadores](checklist-asignacion-aplicadores-2026-09-04.md): cuatro dictados sobre la vista de Asignación.
- [Checklist · El libro de campo dice de dónde viene cada dato](checklist-libro-campo-2026-09-04.md): paleta por función y estados de la cadena de reemplazos.
- [Base de control — pedido del 2026-09-07](checklist-base-control-2026-09-07.md): bloques de control vacíos y el orden de sus encabezados.
- [Checklist — «Avance de campo» en cinco tablas](checklist-avance-general-2026-09-08.md): la hoja dictada columna a columna, con cifras numéricas.
- [Checklist — «Correcciones Parte 1»](checklist-avance-correcciones-parte1-2026-09-08.md): Avance de cursos-horario en la app y en el Sheets.
- [Checklist — el ciclo de la distribución, sin scripts míos](checklist-distribucion-robusta-2026-09-08.md): la app propone y el coordinador dispone.
- [Censo completo de Monitoreo › Cursos-horario › Avance](checklist-revamp-avance-aulas-2026-09-08.md): qué va en cada pestaña y en qué forma.
- [Checklist — el operativo se actualiza con dos clics](checklist-sincronizacion-dos-sheets-2026-09-09.md): lo que se arregló para que la app entienda los dos Sheets.
- [Checklist — monitoreo de aulas, dictado del 2026-09-10](checklist-monitoreo-aulas-2026-09-10.md): nueve indicaciones ordenadas por prioridad.
- [Llevar el diseño de «Relevos de aula» a la app](checklist-relevos-en-la-app-2026-09-10.md): el artefacto manda en el diseño; la app, en el dato.
- [GOAL · Refuerzo y complemento en Cursos-horario](goal-refuerzo-aulas-2026-09-10.md): registro duradero del loop de refuerzo por facultad.
- [Checklist — consistenciar el operativo de aulas](checklist-consistencia-operativo-2026-09-12.md): nueve indicaciones del dictado del 2026-09-12.
- [«Avance por facultad» — dictado del 2026-09-15](checklist-avance-facultad-2026-09-15.md): aulas aplicadas, planificadas y proyectadas al cierre junto a efectivas.
- [Tramos del operativo](checklist-tramos-operativo-2026-09-15.md): rangos con nombre propio que la app recuerda semana a semana.
- [Checklist — el eje carrera como capacidad de la app](checklist-eje-carrera-2026-09-15.md): inventario y traslado del eje declarado en el ADR 0085.
- [Facultades en riesgo y la facultad declarada que no se pierde](checklist-facultades-en-riesgo-2026-09-18.md): contexto de la hoja de riesgo y persistencia de la facultad.
- [Checklist — bases de CCSS Perfil para reproducir el marco](checklist-marco-ccss-2026-09-07.md): las condiciones de HSVG2026 aplicadas a las extracciones de CCSS.
- [Checklist — CCSS Perfil 2026-II: composición por nivel](checklist-ccss-operativo-2026-09-23.md): Sheets y UI listos para actualizar desde la app.
- [Checklist — PDF de avance con metas por nivel](checklist-pdf-avance-aulas-nivel-2026-09-28.md): el PDF de cliente para estudios de aulas por nivel.

### Cálculo de muestra

- [Checklist — Aulas como patrón para Muestra general y Acreditación (E15)](checklist-calc-muestra-patron-aulas-2026-09-24.md): catálogo de patrones de aulas que se replican.
- [Checklist — Animaciones de aulas en Muestra general y Acreditación (E16)](checklist-calc-muestra-animaciones-2026-09-25.md): tokens y coreografías aprendidas de aulas.

### Robustez

- [GOAL — Robustez: que la app no falle al usarse](goal-robustez-app-2026-09-12.md): marco de clases de defecto; una clase se cierra con un guard probado.

### Motores de entregables y editor de Gráficos (F6)

- [Checklist — perfil comparable 2021 vs 2026 (ACRD CONTA)](checklist-perfil-comparativo-2021-2026-08-25.md): barras 2021 en gris junto a 2026.
- [Checklist — el instrumento artesanal al motor de formulario en papel](checklist-motor-formulario-papel-2026-09-24.md): lo aprendido del instrumento de Ser Adolescente.
- [Checklist: diagnóstico del motor de PPT](checklist-motor-ppt-diagnostico-2026-10-06.md): brecha contra las presentaciones de capacitación y plan; entregables en su carpeta.
- [Checklist: comentarios de Gonzalo al recetario PPT moderno](checklist-recetario-comentarios-2026-10-07.md): 41 comentarios en 38 láminas.
- [Inventario F6 — el editor frente a los motores nativos](inventario-f6-editor-2026-10-09.md): hechos del motor que sostienen la dirección de diseño.
- [Inventario N7 — 22 tipos de lámina e identidad](inventario-n7-tipos-lamina-2026-10-09.md): orden de trabajo por uso real y gate del ADR 0093.
- [N8 — Word completo: inventario y hitos](inventario-n8-word-2026-10-09.md): la propuesta Word como norma frente al motor actual.
- [Checklist — editor de Gráficos F6](checklist-editor-graficos-f6-2026-10-10.md): etapas de la nueva UI de Láminas y del motor nativo.
- [Decisiones pendientes de Gonzalo — loop F6](decisiones-pendientes-f6-2026-10-10.md): preguntas con la recomendación del lead.
- [A0 — Inventario de cierre del Editor anterior](inventario-cierre-a0-2026-10-11.md): lista de paridad C1–C55, R1–R10, O1–O5.
- [Contrato — miniaturas en lote y vista previa asíncrona](contrato-miniaturas-preview-f6-2026-10-11.md): A4, caché por huella y jobs.
- [Contrato A6 — Word y Estilo del cliente](contrato-word-estilo-f6-2026-10-11.md): guardar decisiones, no defaults (ADR 0094).
- [Contrato A7 — Informe compartido y multibase en Láminas](contrato-consolidado-laminas-f6-2026-10-11.md): huecos H1–H9 y decisiones D1–D4.
- [Contrato A5 rebanada 2b — Vista general](contrato-vista-general-2b-f6-2026-10-11.md): «Otros» automáticos, índice, «Armar desde…» y E2.
- [Contrato — base sin ponderar en Gráficos](contrato-base-sin-ponderar-graficos-f6-2026-10-11.md): S1–S4, n_casos junto a n, S4 y n efectivo.
- [Revisión C40 — argumentos sin control en Láminas](revision-c40-args-sin-control-f6-2026-10-11.md): veredictos por argumento, defectos D1 (denominador con `top_n`) y D2 (90–99 con ceros), tests de guarda.
- [Estudio — paletas por lista en el PPT nativo y el Word](estudio-paletas-por-lista-f6-2026-10-11.md): qué familias honran la paleta por lista, listas que no calzan con el recetario y qué falta.
- [Pendientes al cierre de la Meta A (Gráficos)](pendientes-cierre-meta-a-graficos-f6-2026-10-11.md): gate final, deuda con dónde vive y qué la bloquea, y notas de versión.
- [Paridad para el retiro del Editor anterior (A10)](paridad-retiro-editor-anterior-f6-2026-10-11.md): huecos, prerrequisitos del borrado y decisiones 28–33.

## Reemplazados

- [Goal loop de las bibliotecas de Gráficos](goal-loop-popovers-graficos-2026-08-07.md),
  consolidado en el [ADR 0068](../adrs/0068-la-composicion-de-slides-tiene-una-sola-autoridad.md);
  su [prompt de arranque](prompt-goal-loop-popovers-graficos.md) sigue siendo reutilizable.
- [Rollout del Agentic OS de 2026-07-19](agentic-os-rollout-2026-07-19.md),
  reemplazado por el [contrato vigente de Agentic OS](../agentic-os.md).
- [Auditoría integral del interventor por cursos-horario](auditoria-interventor-cursos-horario-2026-07-13.md),
  reemplazada por la auditoría del ADR 0019; conserva su evidencia histórica.

## Histórico

El [índice histórico de QA](historico/README.md) organiza treinta fuentes
fechadas en seis síntesis. Los originales permanecen enlazados desde allí para
trazabilidad, pero ya no forman parte de la navegación activa.
- [El XLSForm final exportado no es un XLSForm](bug-xlsform-final-type-sin-lista.md): registro de defecto.
- [Checklist — redondeo y decimales como configuración general de Gráficos](checklist-redondeo-decimales-2026-08-14.md): checklist qa fechado.
- [Criterios de dimensionamiento del muestreo de aulas](criterios-dimensionamiento-aulas-2026-08-21.md): registro qa fechado.
- [GOAL — el mazo sale sin retoques](goal-motor-graficos-entregable-2026-08-12.md): registro de goal loop.
- [Mejoras de UI pendientes — salidas de la revisión de ACNUR V3](mejoras-ui-pendientes-2026-08-15.md): registro qa fechado.

- [Bitácora del trabajo en Monitoreo de aulas](bitacora-monitoreo-aulas-2026-08-29.md): iteraciones consolidadas en el loop definido de Monitoreo de aulas.
- [Checklist — Sistema Pabellón a todo Monitoreo de aulas (B33)](checklist-sistema-pabellon-2026-09-02.md): B33 quedó conforme; consolidado en el acta de cierre del loop.
- [Checklist — loop de mejora estética de la app de aulas y el Sheets](checklist-loop-estetica-sheets-app-2026-09-07.md): detenido por Gonzalo; siguió en el checklist de las dos metas.
- [Checklist — Avance con las dos metas](checklist-avance-dos-metas-2026-09-08.md): sus ítems abiertos se absorbieron en «Correcciones Parte 1».
- [Traspaso — Avance con las dos metas](traspaso-avance-dos-metas-2026-09-08.md): contexto del traspaso; el trabajo siguió en «Correcciones Parte 1».
- [Prompt de la sesión de diseño del editor de Gráficos (F6)](prompt-diseno-editor-graficos-f6-2026-10-09.md): su resultado es la dirección de diseño aprobada.

## Regla de lectura

Cada documento activo declara `Tipo`, `Estado`, `Fecha` y `Autoridad`. Antes de
reutilizar una cifra o conclusión, confirme el corte observado y ejecute el gate
vigente. `Plan`, `Prompt`, `Goal` y `Registro` orientan trabajo: no prueban que
una reparación esté implementada.

- [Checklist · maqueta como ficha visual (implementación en el editor)](checklist-maqueta-ficha-2026-10-13.md): Maqueta como ficha visual: ítems de implementación del contrato M1–M10.
- [Checklist · configuraciones de los gráficos contra el recetario](checklist-configuraciones-graficos-2026-10-13.md): Configuraciones de los gráficos contra el recetario y controles que el editor muestra y el motor descartaba.
- [Checklist · proyecto catálogo del recetario (.pulso de prueba)](checklist-catalogo-recetario-2026-10-14.md): Proyecto catálogo del recetario y hallazgos de su recorrido en la app (H, M, I).
- [Checklist · la matriz de equivalencias sólo declara equivalencias (ADR 0102)](checklist-matriz-equivalencias-pura-2026-10-14.md): La matriz de equivalencias sólo declara equivalencias (ADR 0102).
- [Láminas de población nativas y filtro con subpregunta](checklist-poblacion-y-filtro-2026-10-14.md): las láminas de población con piezas del recetario y las mejoras de la pregunta filtro (F1–F5).
