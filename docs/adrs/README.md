# Architecture Decision Records

Este directorio contiene las decisiones arquitectonicas de Prosecnur.

Un ADR se crea cuando una decision afecta estructura, persistencia,
caracteristicas arquitectonicas, dependencias entre modulos, despliegue,
seguridad de datos o contratos publicos. Los ADRs no reemplazan la
documentacion tecnica: explican por que una direccion fue elegida y como se
verificara que el codigo siga obedeciendola.

## Formato

Usar la [plantilla ADR](0000-template.md). Cada decision debe incluir:

- contexto;
- decision;
- consecuencias;
- cumplimiento;
- fecha.

Los ADR nuevos también separan el estado de la decisión del avance de
implementación. Esta separación se migra de forma progresiva en los ADR
históricos; la ausencia del campo en un documento antiguo no cambia su estado.

## Autoridad y ciclo de vida

Un ADR registra una decisión, no una lista de tareas. Sus estados permitidos
son:

| Estado | Autoridad |
|---|---|
| `Propuesto` | Borrador no autoritativo; puede cambiar antes de ratificarse. |
| `Aceptado` | Decisión ratificada y vigente, aunque su implementación siga en curso. |
| `Rechazado` | Alternativa evaluada que nunca entró en vigor. Se conserva como historia. |
| `Reemplazado` | Decisión antes vigente cuyo ámbito fue asumido por un ADR posterior. |

La implementación se declara por separado como `No iniciada`, `En curso`,
`Completa`, `Retirada` o `No aplica`. El código no cambia automáticamente un
ADR de `Propuesto` a `Aceptado`: la ratificación es una decisión explícita.

`Reemplaza` contradice o retira el mismo ámbito y debe enlazarse en ambos
sentidos. `Extiende` agrega un ámbito compatible y deja ambos ADR aceptados. Un
reemplazo parcial conserva el ADR anterior como aceptado, declara qué ámbito
sigue vigente y enlaza al sucesor.

## Identidad y edición

- Cada decisión nueva recibe un ID numérico de cuatro dígitos, único e
  inmutable. Filename, encabezado e índice deben coincidir.
- Una decisión aceptada no se reescribe para cambiar su sentido normativo: se
  crea un ADR que la reemplaza o extiende.
- Un ADR propuesto sí puede consolidarse antes de su aceptación.
- Los aliases históricos conservan enlaces antiguos, pero no cuentan como una
  segunda decisión canónica.
- `## Cumplimiento` nombra invariantes y evidencia verificable. «Implementado»
  sin un test, comando, ruta o revisión responsable no es evidencia suficiente.

Existe una colisión histórica: Cálculo de muestra y Editor XLSForm comparten el
ID 0035. Se mantiene visible hasta que el dueño apruebe una migración de
identidad; no debe usarse como precedente para IDs nuevos.

## Auditorías

- [Estado completo de los ADR — 2026-07-29](estado-adr-2026-07-29.md): 48
  decisiones físicas, 47 IDs, estado documental, muestra estática de
  implementación y deuda pendiente.
- El gate documental se ejecuta con `node scripts/check-docs-governance.mjs`.
  Los enlaces rotos, documentos huérfanos y desalineaciones índice–archivo
  fallan; la deuda editorial heredada se informa como advertencia.

## Indice

| ADR | Estado | Fecha | Decision |
|---|---|---:|---|
| [0001](0001-app-local.md) | Aceptado | 2026-05-31 | Prosecnur es una aplicacion local de escritorio |
| [0002](0002-formato-pulso.md) | Aceptado | 2026-05-31 | El proyecto persistente usa formato `.pulso` |
| [0003](0003-motor-r-integrado.md) | Aceptado | 2026-05-31 | El motor R vive integrado en `prosecnurapp` |
| [0004](0004-monolito-modular-microkernel.md) | Aceptado | 2026-05-31 | La arquitectura base es monolito modular con orientacion microkernel |
| [0005](0005-secretos-fuera-del-proyecto.md) | Aceptado | 2026-05-31 | Los secretos se guardan fuera del proyecto |
| [0006](0006-modulos-por-dominio.md) | Aceptado | 2026-05-31 | Los modulos se organizan por dominio metodologico |
| [0007](0007-integraciones-salientes-dashboard-publicable.md) | Aceptado | 2026-05-31 | Prosecnur permite integraciones salientes y dashboard publicable sin dejar de ser local |
| [0008](0008-proyecto-canonico-auditoria.md) | Aceptado | 2026-05-31 | Prosecnur usa un proyecto canonico de auditoria reproducible |
| [0009](0009-hojas-ruta-fases-piloto-campo-real.md) | Aceptado | 2026-06-04 | Hojas de ruta separa fases piloto y campo real |
| [0010](0010-monitoreo-centro-control-operativo-sheets.md) | Aceptado | 2026-06-06 | Monitoreo opera como centro de control local con perfiles y Google Sheets |
| [0011](0011-cache-persistida-mapas-monitoreo-territorial.md) | Aceptado | 2026-06-15 | Monitoreo territorial persiste una cache compacta de mapas por fase |
| [0012](0012-reportes-monitoreo-publicables.md) | Reemplazado por 0016 | 2026-06-16 | Monitoreo publica reportes web como snapshots agregados sin subir la app completa |
| [0013](0013-importacion-workbook-surveymonkey-offline.md) | Aceptado | 2026-06-16 | SurveyMonkey multibase importa archivos offline contra bases existentes |
| [0014](0014-publicacion-dual-monitoreo.md) | Reemplazado por 0016 | 2026-06-18 | Monitoreo separa publicaciones cliente e internas por audiencia |
| [0015](0015-monitoreo-space-cliente-sheets-interno.md) | Reemplazado por 0016 | 2026-06-19 | Monitoreo publica Space cliente y Sheets separados |
| [0016](0016-monitoreo-solo-google-sheets.md) | Aceptado | 2026-06-19 | Monitoreo publica solo Google Sheets |
| [0017](0017-base-panel-analitica.md) | Aceptado | 2026-06-19 | Analitica genera bases panel wide por llave y ola |
| [0018](0018-paquete-compartible-graficos.md) | Aceptado | 2026-06-19 | Graficos comparte planes editables como paquete portable |
| [0019](0019-monitoreo-aulas-universitarias.md) | Aceptado | 2026-06-19 | Monitoreo de aulas universitarias separa seleccion muestral y campo |
| [0020](0020-ficha-tecnica-contextos-metodologicos.md) | Aceptado | 2026-06-22 | La ficha tecnica compone contexto metodologico desde modulos auxiliares |
| [0021](0021-arranque-con-proyecto-y-warm-start.md) | Aceptado | 2026-06-24 | Prosecnur arranca con proyecto obligatorio y warm start local |
| [0022](0022-monitoreo-perfiles-frontend-dinamicos.md) | Aceptado | 2026-06-24 | Monitoreo usa perfiles frontend dinamicos y desktop-fast evita typecheck estricto |
| [0023](0023-acnur-kobo-mapas-cobertura-graficos.md) | Aceptado | 2026-06-25 | ACNUR Kobo y mapas de cobertura entran al motor de Graficos |
| [0024](0024-monitoreo-subsanaciones-operativas.md) | Aceptado | 2026-06-25 | Monitoreo territorial guarda subsanaciones operativas auditables |
| [0025](0025-monitoreo-anulacion-produccion-territorial.md) | Aceptado | 2026-06-26 | Monitoreo territorial permite anular produccion localmente |
| [0026](0026-guardado-explicito-guardia-salida.md) | Aceptado | 2026-06-26 | Prosecnur guarda `.pulso` explicitamente y protege salidas con guardia comun |
| [0027](0027-diseno-estudio-bitacora-viva.md) | Reemplazado por 0029 | 2026-06-28 | Diseno del estudio reemplaza Enciclopedia como expediente y bitacora viva |
| [0028](0028-plan-trabajo-cronograma-sincronico.md) | Reemplazado por 0029 | 2026-06-29 | Plan de trabajo modela cronogramas sincronicos con evidencia operativa |
| [0029](0029-reorientacion-por-proyecto-bitacora-y-overview.md) | Aceptado | 2026-07-09 | Reorientacion por proyecto: modulo Bitacora unico, Home adaptativo y overview de proyecto |
| [0030](0030-grupos-repeat-end-to-end.md) | Aceptado | 2026-07-10 | Soporte de grupos repeat (begin_repeat) end-to-end: base hija long canonica y reconexion de la validacion multi-tabla |
| [0031](0031-script-replicacion-base-analitica.md) | Aceptado | 2026-07-10 | Analitica puede entregar un script R reproducible de la base final |
| [0032](0032-handoff-instrumento-siempre-local.md) | Aceptado | 2026-07-11 | El handoff Monitoreo a Procesamiento usa siempre un XLSForm local |
| [0033](0033-reconciliacion-variables-data-xlsform.md) | Aceptado | 2026-07-11 | Las variables extra de data se reconcilian explicitamente contra el XLSForm |
| [0034](0034-label-overrides-etiquetas-por-proyecto.md) | Aceptado | 2026-07-12 | Los overrides de etiquetas se conservan por proyecto |
| [0035](0035-calc-muestra-mapeo-manual-exclusivo-por-hoja.md) | Aceptado | 2026-07-14 | Calculo de muestra (aulas): definicion de datos manual, exclusiva y por hoja (sin fuzzy, sin data hardcodeada) |
| [0035 — Editor](0035-editor-xlsform-coleccion-multi-formulario.md) | Aceptado | 2026-07-14 | El Editor XLSForm mantiene una coleccion multi-formulario; comparte numero historico con el ADR de Calculo de muestra |
| [0036](0036-filtro-universo-manual-en-carga.md) | Aceptado | 2026-07-14 | El filtro manual real/prueba se materializa en Carga y se hereda a repeats |
| [0037](0037-reporte-metodologico-validacion.md) | Aceptado | 2026-07-14 | Validacion genera un reporte metodologico exhaustivo basado en el plan efectivo y distingue la naturaleza de cada formula |
| [0038](0038-identidad-visual-v1-1.md) | Aceptado | 2026-07-15 | Identidad visual v1.1 «La señal ordenada»: isotipo canonico unico, patrones maestros y paquete branding/ como referencia normativa |
| [0039](0039-agentic-os-multirepo-provider-neutral.md) | Aceptado | 2026-07-19 | Agentic OS multirepo neutral al proveedor: núcleo global namespaced, packs opt-in y overlays locales |
| [0040](0040-flujo-acreditacion-formularios-monitoreo-procesamiento-ppt.md) | Aceptado | 2026-07-20 | Acreditacion enlaza revisiones XLSForm, efectivos reconciliados, procesamiento independiente y un PPT consolidado |
| [0041](0041-shell-v3-sidebar-navegacion-unificado.md) | Reemplazado por 0042 | 2026-07-23 | Shell v3 con sidebar unificado para módulos, secciones y pestañas; revertido por el dueño el 2026-07-24 |
| [0042](0042-chrome-modulo-uniforme-topbar.md) | Aceptado | 2026-07-24 | Chrome de módulo uniforme: top bar de secciones + rail de pestañas re-ratificados (patrones #1–#3 del ADR 0038), uniformidad en los 8 módulos y pulido macOS-like; reemplaza al ADR 0041 |
| [0043](0043-proyectos-de-referencia-reales-anonimizados.md) | Aceptado | 2026-07-24 | Catálogo de proyectos de referencia: los cuatro estudios reales (ACNUR PDM, ACNUR ACG, HSyVbG 2026, Acreditación Contabilidad) anonimizados y versionados como fixtures, complementando las semillas sintéticas |
| [0044](0044-jerarquia-y-direcciones-de-navegacion.md) | Aceptado | 2026-07-24 | Jerarquía canónica módulo→[modo]→sección→pestaña→panel con un solo vocabulario, y toda vista enlazable por dirección (`?modo=&seccion=&pestana=&panel=`) más manifiesto enumerable para el inspector visual |
| [0045](0045-monitoreo-actores-modelo-telefonia-explicita.md) | Aceptado | 2026-07-27 | Fuentes gobierna actores y canales; Modelo configura estrategia y Teléfono consume esa declaración |
| [0046](0046-recopiladores-despliegue-recoleccion.md) | Aceptado | 2026-07-27 | Recopiladores prepara accesos, materiales y handoff de recolección mediante adapters con capacidades reales de SurveyMonkey y Kobo |
| [0047](0047-bitacora-cronograma-canvas-vinculado.md) | Propuesto | 2026-07-28 | Bitácora, cronograma y canvas como cuatro vistas de un grafo vinculado: la fase se elige en vez de adivinarse, avisos in-app con disparo único y núcleo de lienzo compartido |
| [0048](0048-identidad-version-y-canales-distribucion.md) | Reemplazado por 0056 | 2026-07-30 | Identidad de versión única y canales de distribución separados: preview interno sin publicación y stable fail-closed |
| [0049](0049-fronteras-confianza-electron-credenciales-hf.md) | Aceptado | 2026-07-30 | Electron valida navegación e IPC; los tokens HF guardados permanecen en el proceso principal detrás de un broker loopback tipado |
| [0050](0050-entorno-r-reproducible-ci-inmutable.md) | Aceptado | 2026-07-30 | El entorno R usa un lock exacto y CI fija runners, acciones, cachés y bundles verificables |
| [0051](0051-retiro-de-enciclopedia.md) | Aceptado | 2026-07-31 | Enciclopedia se retira entera; se conserva lo que Bitácora y Cálculo de muestra consumen |
| [0052](0052-excepcion-auditada-brace-expansion-empaquetado.md) | Aceptado | 2026-07-31 | Excepción por advisory (no por umbral) para GHSA-mh99-v99m-4gvg en el árbol de build de Electron, con condiciones de admisión y caducidad en cada corte |
| [0053](0053-serie-3x-como-deuda-historica-de-versionado.md) | Reemplazado por 0056 | 2026-07-31 | La serie 3.x es deuda histórica de nomenclatura, no la línea de versionado: se excluye de la monotonicidad por lista explícita y el producto sigue en la serie 0.x |
| [0054](0054-publicacion-manual-sin-firma-0-6-0.md) | Reemplazado por 0056 | 2026-07-31 | Excepción acotada a la 0.6.0: se publica a mano con los binarios del preview, sin firma ni updater, dejando intactos los gates del ADR 0048 |
| [0056](0056-como-se-publica-prosecnur.md) | Aceptado | 2026-08-01 | Documento unico de publicacion: consolida 0048, 0053, 0054 y 0055; identidad de cinco superficies, serie 0.x, dos canales, sin firma de distribucion, Windows bloqueante con macOS best-effort y reuso de Quality por SHA |
| [0055](0055-retiro-de-la-firma-de-distribucion.md) | Reemplazado por 0056 | 2026-08-01 | El canal stable deja de exigir firma de distribución y payloads de updater de macOS, que el repositorio no puede producir sin certificados; se publica por tag con instalables sin firmar y macOS por DMG |
| [0057](0057-tarjeta-de-categoria-en-calculo-de-muestra.md) | Aceptada | 2026-08-02 | La unidad de decisión de Cálculo de muestra es la categoría de criterio: un contenedor por categoría con su control, CH, alumnos, boxplot con eje común, cuantiles, efecto en el embudo y tasa de asistencia, todo por facultad y dinámico a los criterios previos |
| [0058](0058-matriz-de-cascada-de-criterios.md) | Aceptada | 2026-08-03 | La procedencia del marco se cuenta con una matriz de cascada: filas facultad, columnas criterio, cada celda lo que ese criterio quita ahí, y la última fila y columna cerrando en los cursos-horario elegibles |
| [0059](0059-calendario-unico-de-binarios-r-y-gate-por-linaje.md) | Aceptado | 2026-08-04 | Los binarios R de Windows y macOS leen el mismo snapshot fechado de Posit con la fecha en una fuente única que avanza junto al lock, y el precheck de Release reusa el Quality verde de un ancestro cuando el diff acumulado toca solo packaging |
| [0060](0060-vocabulario-del-embudo-de-aulas.md) | Aceptada | 2026-08-04 | Base, motor y pantalla dicen el embudo de aulas con un solo glosario: `elegibles` deja de llamarse población, `iniciadas`/`efectivas` reemplazan a enviadas/largas, los tramos pasan a apertura/efectividad/rendimiento, y los filtros de corte se declaran por estudio con una taxonomía cerrada de cuatro clases que decide qué sale del denominador |
| [0061](0061-la-config-de-analitica-pertenece-a-su-base.md) | Aceptada | 2026-08-06 | La configuración de Analítica se scopea por base cuando las bases no comparten instrumento (topología `separate`/`independent`), ninguna base hereda la configuración global del proyecto, Gráficos aplica las etiquetas curadas de cada base igual que ya aplica el orden de categorías, y `label_original` conserva el texto del instrumento |
| [0062](0062-matriz-de-equivalencias-entre-publicos.md) | Aceptada | 2026-08-06 | El estudio declara qué pregunta de un público equivale a cuál de otro en una pestaña condicional de Carga: la app genera la plantilla poblada, acepta códigos crudos de plataforma, escribe la etiqueta estándar en la config de cada base y sella la declaración contra los instrumentos que la validaron. Enmendado 2026-08-06: la vía principal es el editor en pantalla, con propuestas marcadas que no se guardan sin confirmar, y la declaración gana la diapositiva del informe |
| [0063](0063-el-mazo-se-deriva-de-la-declaracion.md) | Aceptada | 2026-08-06 | La declaración de equivalencias es una fuente del plan sugerido de Gráficos y no un mecanismo aparte: una diapositiva por `diapositiva` declarada, un tema por pregunta y una barra por público; se propone y se previsualiza, nunca sobrescribe el plan por su cuenta, y lo no graficable se reporta en vez de fabricarse |
| [0064](0064-el-enunciado-vive-en-la-diapositiva.md) | Aceptada | 2026-08-06 | La declaración de equivalencias gana un nivel —sección → diapositiva (enunciado + escala) → ítem → variable por público—: el enunciado que el importador de matrices pierde titula la diapositiva del mazo, la etiqueta estándar sólo debe ser única dentro de su diapositiva, la escala se deriva y se sella en vez de escribirse, y la divergencia de escala se marca sin bloquear porque a veces es un hallazgo. Enmendado 2026-08-06: el formato de intercambio son ocho columnas con el núcleo delante, sin volcar el instrumento ni sembrar propuestas, con desplegable por base y garantía de ida y vuelta; el mazo derivado se marca con `origen` y se regenera por bloque sin tocar lo hecho a mano |
| [0065](0065-una-barra-mide-lo-mismo-en-toda-la-presentacion.md) | Aceptada | 2026-08-07 | El alto de fila crece para aprovechar el hueco de la lámina, pero con un tope: una lámina de tres barras y una de seis tienen barras de grosor parecido aunque la de tres no llene la diapositiva. Llenar la lámina es una propiedad de UNA lámina; la comparabilidad del grosor es una propiedad del MAZO, y el mazo es lo que se presenta. El aire al pie es el precio de que una barra mida lo mismo en la lámina 3 y en la 30 |
| [0066](0066-la-probabilidad-publicada-es-la-del-sorteo-ejecutado.md) | Aceptada | 2026-08-07 | La probabilidad de inclusión que se publica es la del mecanismo que realmente sorteó, no la del diseño nominal: tres configuraciones publicaban una π que no correspondía al sorteo ejecutado, y con ella se ponderaba toda estimación posterior |
| [0067](0067-el-relato-cinematico-de-la-seleccion-de-aulas.md) | Aceptada | 2026-08-07 | La selección de aulas se puede narrar cuadro a cuadro —marco, embudo, estratos, cuotas, probabilidades, sorteo— y cada cuadro es un hecho de la corrida real, no una animación ilustrativa. Extensión narrativa del ADR 0066 |
| [0068](0068-la-composicion-de-slides-tiene-una-sola-autoridad.md) | Aceptada | 2026-08-07 | Las bibliotecas y el renderer PPT consumen un único contrato efectivo versionado: identidad explícita, wire path-free, adaptador v1 y caché invalidada por la configuración que cambia geometría |
| [0069](0069-el-instrumento-sellado-reconoce-a-su-propia-base.md) | Aceptada | 2026-08-08 | Una base queda ligada a la revisión publicada cuyo hash canónico coincide exactamente con su XLSForm, el enlace se resuelve en `estudio_add_base`/`estudio_replace_base_files` para que valga en toda vía de carga y no solo en acreditación, y la severidad declarada del validador —no el prefijo del id— decide qué impide publicar |
| [0071](0071-el-grafico-nativo-cuesta-el-reposicionamiento-de-etiquetas.md) | Aceptada | 2026-08-10 | El motor PPT sigue emitiendo formas y no charts nativos OOXML: `mschart` reproduce el XML del deck de acreditación rasgo a rasgo, pero PowerPoint no mueve una etiqueta que no entra y devolvería a mano el reposicionamiento que el motor resuelve solo (62 de 91 etiquetas del deck de referencia están desplazadas a mano) |
| [0072](0072-una-tabla-es-una-tabla-y-va-nativa.md) | Aceptada | 2026-08-11 | Toda tabla del entregable se emite nativa de PowerPoint, con el mecanismo que ya usa la ficha técnica. Precisa el alcance del 0071 sin revertirlo: aquella decisión hablaba de charts, y su razón —el reposicionamiento de etiquetas— no existe en una rejilla de filas y columnas |
| [0073](0073-el-sorteo-balanceado-da-la-misma-muestra-en-toda-maquina.md) | Aceptada | 2026-08-11 | El sorteo balanceado de aulas da la misma muestra en toda máquina. La fase de vuelo del cubo toma un vector del núcleo con `svd`, que lo define salvo signo, y cada BLAS elegía el suyo: con la misma semilla, macOS y Linux sorteaban aulas distintas. Se canonicaliza el svd (signo fijo y ruido recortado a 12 cifras) sin tocar el método ni las probabilidades de inclusión |
| [0074](0074-el-proyecto-guarda-decisiones-no-defaults.md) | Aceptada | 2026-08-13 | El `.pulso` guarda sólo lo que difiere del default de fábrica, y la procedencia de un valor se deriva de su presencia en vez de etiquetarse. Medido en «Conta 11-08»: 218 de 253 valores de preset son idénticos al default del día en que se guardó, y el motor no puede distinguirlos de una decisión — raíz común de las reglas de «legado» de `textos_negrita`, del alias de `numerar_oe` y de que el reparto multiactor pisara el preset |
| [0075](0075-una-base-validada-es-una-base-sin-hallazgos-sin-decidir.md) | Aceptada | 2026-08-13 | Una base está validada cuando no le quedan hallazgos **sin decidir**, no cuando no tiene hallazgos. Cero inconsistencias es inalcanzable en cualquier base real y falsificable apagando criterios; además `procedencia` —el caso se recolectó con otra versión del formulario, fuera del periodo o no llegó completo— no admite corrección en el dato, así que bloquear por eso obligaría a falsearlo. Procedencia nunca bloquea; contradicción, valor inválido y faltante exigen una decisión, y conservar es una de ellas |
| [0076](0076-una-base-depurada-se-promueve-no-se-recomienda.md) | Aceptada | 2026-08-15 | La base efectiva de un estudio la fija la última etapa que la depuró, y esa etapa la promueve. Hoy el filtro de universo promueve su data filtrada y Codificación la respeta, pero Limpieza deja su base depurada como descarga «recomendada» que ningún consumidor lee: en ACNUR V3 dos casos excluidos con decisión y justificación reaparecieron en el entregable. La invalidación de aguas abajo ya ocurre, así que hoy se rehace el pipeline para obtener el mismo resultado |
| [0077](0077-marcar-una-variable-abre-una-decision-no-la-cierra.md) | Propuesto | 2026-08-15 | Una codificación está completa cuando no le quedan variables marcadas **sin decidir**, no cuando todas tienen categorías. Marcar declara una intención y abre una decisión que se cierra de cuatro formas, y «no categorizar, con motivo» es una de ellas: hoy decidir no categorizar por `n` insuficiente no tiene dónde vivir y se confunde con un olvido. En ACNUR V3, 9 marcadas, 3 con categorías y 5 pendientes que se entregaron sin recodificar sin que nada lo dijera |

Ver tambien la [guia arquitectonica canonica](../arquitectura-prosecnur.md).
