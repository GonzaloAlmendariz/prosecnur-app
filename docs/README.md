# Documentación de Prosecnur

Esta es la entrada única a la documentación mantenida en `docs/`. El índice
distingue contratos vigentes, referencias de dominio, planes y evidencia para
evitar que un plan de trabajo o una auditoría fechada se interpreten como norma.

## Cómo interpretar la documentación

Cuando dos documentos parezcan discrepar, use este orden de precedencia:

1. El contrato ejecutable o metadato declarado como fuente única, como
   `api/DESCRIPTION` para la versión y
   `frontend/src/lib/modules.ts` para la navegación.
2. El [ADR aceptado](adrs/README.md) más reciente que gobierne el asunto.
3. La [arquitectura canónica](arquitectura-prosecnur.md).
4. La norma de dominio o de superficie aplicable.
5. El plan vigente, solo para ordenar la ejecución dentro de su alcance.
6. El baseline, auditoría o matriz QA, como evidencia observada y fechada.
7. El tutorial, prompt reutilizable o documento histórico.

Los planes y los informes de QA no crean por sí mismos contratos de producto.
Antes de seguir uno, revise el estado y la fecha que declara en su cabecera.

## Empiece aquí

| Necesidad | Entrada | Autoridad |
| --- | --- | --- |
| Entender el sistema | [Arquitectura de Prosecnur](arquitectura-prosecnur.md) | Canónica |
| Consultar una decisión | [Registro de ADR](adrs/README.md) | Canónica para decisiones aceptadas |
| Reparar o cambiar código | [Loops de reparación](loops-reparacion.md) | Protocolo de trabajo |
| Entender los agentes y adaptadores | [Agentic OS](agentic-os.md) | Contrato de operación agentic |
| Construir o revisar una superficie | [Gramática de layout](ui-layout-grammar.md) | Norma de superficie |
| Ejecutar la auditoría integral | [Auditoría canónica](auditoria-canonica.md) | Guía operativa |
| Revisar calidad y deuda | [Índice de QA](qa/README.md) | Evidencia y baselines |

## Arquitectura y contratos

- [Arquitectura canónica de Prosecnur](arquitectura-prosecnur.md): límites,
  módulos y características arquitectónicas del producto.
- [Arquitectura multibase](arquitectura-multi-base.md): modelos de convivencia
  entre bases, perfiles y hermanos independientes.
- [Registro de decisiones arquitectónicas](adrs/README.md): estados y enlaces a
  todos los ADR. Los ADR propuestos todavía no alteran el contrato.
- [Agentic OS](agentic-os.md): compatibilidad Claude–Codex, manifiesto y
  adaptadores generados.
- [Grafo del Agentic OS](sistema/agentic/README.md): las 16 skills, 13 agentes
  y 8 ramas de enrutamiento, generadas desde el manifiesto canónico.
- [Loops de reparación](loops-reparacion.md): protocolo de alcance, iteración,
  evidencia y parada.
- [Gramática de layout](ui-layout-grammar.md): jerarquía y contrato de las
  superficies de la aplicación.
- [Índice de direcciones](sistema/direcciones/README.md): cada dirección del
  contrato de navegación con su sello, qué documento la gobierna y si la bóveda
  de producto la documenta. Generado por `make vaults-index`; no editar a mano.

## Referencias por dominio

### Diseño del estudio y muestra

- [Tipos de estudio 2024–2026](tipos-estudio-2024-2026.md): familias y ruta del
  evaluador de muestra; remite a los catálogos ejecutables canónicos.
- [Recorrido de Cálculo de muestra](calc-muestra-recorrido-spec.md): recorrido y
  comportamiento esperado del módulo.
- [Copys metodológicos de Cálculo de muestra](calc-muestra-copys-metodologicos.md):
  vocabulario y explicaciones metodológicas.

### Formularios

- [Vista «Filtros de opciones»](vista-filtros-opciones-spec.md): especificación
  original de la vista; contraste su estado declarado con el producto actual.

### Hojas de ruta

- [Detalle de cartografía](hojas-ruta-cartografia-detalle.md): fuentes,
  transformación y uso de cartografía.
- [Pendientes operativos](hojas-ruta-pendientes.md): estado aplicado y pendientes
  residuales; no reemplaza un ADR.

### Recopiladores

- [Plan de Recopiladores](plan-recopiladores-2026-07.md): alcance y olas del
  despliegue de recolección. Su contrato arquitectónico está en el ADR enlazado
  desde el propio plan.

### Monitoreo

- [Monitoreo digital](monitoreo-digital.md): referencia funcional y técnica del
  módulo.
- [Publicación web](deploy-web.md): operación de Dashboard y salidas vigentes de
  Monitoreo; ante conflicto prevalecen los ADR aceptados.
- [Lecciones de Acreditación](lecciones-monitoreo-2026-07.md): retrospectiva
  fechada para revisar otros perfiles, no norma independiente.
- [Protocolo de pulido estético](prompt-pulido-monitoreo.md): prompt operativo
  para iterar sobre las superficies de Monitoreo; su registro de avance es
  evidencia fechada, no contrato de producto.

### Entregables

- [Preview de PowerPoint](pptx-preview-renderer.md): renderer y flujo de vista
  previa de presentaciones.
- [Documentación de PDF](pdf/README.md): sistema de diseño y briefs de trabajo.

## Operación y ciclo de vida

- [Auditoría canónica](auditoria-canonica.md): comandos y recorrido de auditoría
  reproducible.
- [Publicación web](deploy-web.md): despliegue del Dashboard como artefacto
  público controlado.
- [Versiones de la aplicación](versiones-app.md): historial de cortes; la fuente
  única de la versión actual es `api/DESCRIPTION`.
- [Identidad de versión y canales de distribución](adrs/0048-identidad-version-y-canales-distribucion.md):
  decisión aceptada que separa preview interno y stable fail-closed.
- [Deuda estructural del pipeline](deuda-estructural-pipeline-2026-07.md):
  constancia fechada de deuda diferida, no descripción del estado actual.

## Planes de trabajo

Los siguientes documentos gobiernan ejecución dentro del alcance y estado que
ellos mismos declaran. No tienen precedencia sobre contratos ejecutables, ADR o
arquitectura canónica.

### Planes de dominio y mejora

- [GOAL v2 de Cálculo de muestra](qa/goal-loop-calc-muestra-v2-2026-08-01.md):
  loop permanente vigente, ledger y cola de lotes del módulo.
- [GOAL de la superficie de Cálculo de muestra](qa/goal-loop-calc-muestra-frontend-2026-08-02.md):
  loop de la superficie del módulo, con su cola de lotes y transversales.
- [GOAL de la matriz y los criterios de curso-horario](qa/goal-loop-matriz-criterios-2026-08-03.md):
  serie G; la matriz de cascada, las tarjetas de criterio y el recorrido vivo.
- [GOAL del motor PPT/Word de Gráficos](qa/goal-loop-motor-ppt-2026-08-03.md):
  auditoría total e indefinida del motor de reportes; bitácora B y cola viva.
- [GOAL multibase de Gráficos](qa/goal-loop-graficos-multibase-2026-08-03.md):
  la superficie declara de qué base habla; cobertura y validación por base.
- [GOAL del radar entre públicos](qa/goal-loop-radar-multibase-2026-08-06.md):
  el radar compara públicos y el analista declara el indicador; forma, color y
  reparto del alto del mazo derivado de la matriz.
- [GOAL de expansión del catálogo y UI de Gráficos](qa/goal-loop-expansion-graficos-ui-2026-08-08.md):
  loop sucesor para introducir nuevos tipos con verdad metodológica, contrato
  vertical y mejora continua de la experiencia de autoría.
- [GOAL de la interfaz de Gráficos](qa/goal-loop-graficos-ui-honesta-2026-08-10.md):
  loop indefinido para que la interfaz sea honesta, se deje encontrar y explique
  su capa, sin cambiar cómo se hace lo que ya funciona.
  [Prompt](qa/prompt-goal-loop-graficos-ui-honesta.md).
- [Registro del motor de gráficos](qa/registro-motor-graficos-2026-08-10.md):
  estado consolidado de errores resueltos, persistentes y pendientes, y cuánto
  del formato del deck 2021 alcanza al analista sin escribir R.
- [Validación contra el deck de acreditación 2021](qa/validacion-deck-acreditacion-2021.md):
  medición rasgo a rasgo de los cuatro tipos de lámina contra la vara de la casa.
- [Prompt del loop de la superficie](qa/prompt-goal-loop-calc-muestra-frontend.md).
- [Prompt del loop de Cálculo de muestra](qa/prompt-goal-loop-calc-muestra.md).
- [Prompt del loop del motor PPT](qa/prompt-goal-loop-motor-ppt.md).
- [Fuentes legibles de Monitoreo](plan-fuentes-legibles-2026-07.md).
- [Monitoreo de acreditación](plan-monitoreo-acreditacion-2026-07.md).
- [Monitoreo telefónico](plan-monitoreo-telefonico-2026-07.md).
- [Optimización de performance](plan-optimizacion-perf-2026-07.md).
- [Recopiladores](plan-recopiladores-2026-07.md).
- [Saneamiento del repositorio](plan-saneamiento-repo-2026-07.md).
- [Loop de bóvedas](plan-vaults-2026-07.md): la bóveda de producto, esta
  documentación y la costura verificable entre ambas.

### Suite de revamp visual

Empiece por el [índice y arbitraje de la suite](plan-revamp-ui-2026-07-INDICE.md).
Las piezas se conservan para trazabilidad, incluso cuando el índice las marca
como reemplazadas o parcialmente aplicables:

- [Plan continuo de armonía y espaciado](plan-armonia-espaciado-2026-07.md).
- [Plan base](plan-revamp-ui-2026-07.md).
- [Guía de sidebar](plan-revamp-ui-2026-07-guia-sidebar.md).
- [Indicación 2](plan-revamp-ui-2026-07-indicacion-2.md).
- [Indicación 3](plan-revamp-ui-2026-07-indicacion-3.md).
- [Indicación 4](plan-revamp-ui-2026-07-indicacion-4.md).
- [Indicación 5](plan-revamp-ui-2026-07-indicacion-5.md).

## Calidad y evidencia

El [índice de QA](qa/README.md) separa baselines, auditorías, matrices, planes y
registros de reparación para Carga, Monitoreo y operación del repositorio.
Ninguno debe leerse como contrato normativo salvo que otra fuente canónica lo
declare explícitamente.

## Capacitación

El [índice de capacitación](capacitacion/README.md) distingue fuentes editables,
guías, estilos y artefactos HTML generados.

## Convenciones para documentos nuevos

- Enlace el documento desde esta portada o desde la portada temática apropiada.
- Declare tipo, estado, fecha y autoridad; añada `superseded_by` si fue
  reemplazado.
- Use nombres en minúsculas, palabras separadas por guiones y fechas
  `YYYY-MM-DD` cuando la fecha forme parte del nombre.
- Use enlaces relativos al repositorio; no registre rutas absolutas de equipos o
  datos de cliente.
- Mantenga las fuentes editables separadas de los artefactos generados.
