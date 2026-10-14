# Etiquetas para los entregables desde Procesamiento (G18) — propuesta

Tipo: Propuesta de diseño
Estado: Vigente
Fecha: 2026-10-13
Autoridad: Evidencia de QA; no reemplaza un ADR

Gonzalo, 2026-10-13: «aquí podemos ayudarnos de procesamiento para que las etiquetas no se vean tan largas; partimos del
hecho de que esta base ya pasó por procesamiento y que es capaz de ajustar cosas de cara a los entregables» y «quiero que
te centres en qué tipo de correcciones o errores ellos solían cometer». Regla vigente (D4): **la app detecta y avisa; el
analista corrige**. Nada se reescribe solo.

## Qué corregía el cliente (medido, no supuesto)

Fuente: `Correcciones por carrera - Informes cuantitativos.xlsx` (ACRD Ingeniería, 62 observaciones con texto, agosto
2026) y `Registro de correcciones Contabilidad 19-08.xlsx` (ACRD Contabilidad, 8 correcciones aplicadas).

| Tipo (columna del Excel) | n | Qué eran | ¿Lo puede ver Procesamiento? |
|---|---|---|---|
| Redacción | 23 | espacio antes de «:» o «,»; doble «%» o «%)»; falta de tilde; errores de escritura; palabra partida en la portada («RE ACREDITACIÓN»); sigla incompleta; artículo equivocado ante sigla; mayúscula suelta («docentes Y autoridades»); nombre de sección o categoría incompleto; frase incompleta; uso ambiguo de «mención» | Sí, en las etiquetas: espacios antes de signo, signos duplicados, mayúsculas sueltas y palabras partidas son detectables. Tildes y erratas, sólo como sugerencia |
| Gráfico | 15 | bases distintas entre gráficos de una misma lámina o del informe (181 vs 182, 27 vs 28); rótulo del «No» invisible en la torta; categorías mal clasificadas en preguntas abiertas | Bases: sí (cruce de n por lámina). El resto es del motor o de Codificación |
| Listado «Otros» | 12 | no ordenado por frecuencia; entradas duplicadas o equivalentes separadas; entradas truncadas, ilegibles o sin especificar; siglas sin desarrollar; todos los ítems terminan en punto; menciones únicas sin frecuencia | Sí: es Codificación de la pregunta abierta |
| Institución | 8 | entradas que no son instituciones, nombres abreviados o no verificables, contexto en lugar del nombre | Sí: Codificación (catálogo) |
| Dato | 4 | la narrativa nombra otra carrera; rangos de edad que no corresponden al porcentaje | No en etiquetas: es redacción del informe (Renzo y Ulises) |

Contabilidad (19-08): ninguna cifra; color de un grado de la escala, una mayúscula suelta, tamaño de un rótulo,
flechas y tamaño de un radar, conclusiones y recomendaciones. Antes (64 filas de `Revisón graficos.xlsx`): todas de
redondeo, ya resuelto en el motor.

## Propuesta

Una sección **«Etiquetas para los entregables»** en Procesamiento (Validación o Codificación, a decidir) con una fila por
pregunta y por opción que llega a los gráficos:

1. **Etiqueta de la pregunta tal como viene** y **etiqueta para los entregables** (editable). Se guarda en
   `label_overrides$titles` / `$values` (`api/R/label_overrides.R`), que ya se aplica una vez en la capa de instrumento
   y llega a PPT, Word, tablas y libro de códigos.
2. **Avisos, nunca cambios automáticos**, con el fragmento citado, sobre lo que el cliente corrigió a mano:
   espacio antes de «: , ; .»; signo duplicado («%%», «%)»); mayúscula suelta en medio de frase; palabra partida
   («RE ACREDITACIÓN»); punto final en una opción; nota entre corchetes o HTML (D4); etiqueta larga para un gráfico
   (más de N caracteres, p. ej. en la matriz de cuadrantes o el radar); dos opciones que difieren sólo en mayúsculas o
   tildes (equivalentes separadas).
3. **Bases que no cuadran** entre gráficos de la misma lámina (181 vs 182): aviso en Gráficos, no en Procesamiento.

Fuera de esta propuesta (ya tienen dueño): ordenar «Otros» por frecuencia y fusionar equivalentes es Codificación;
la redacción de la narrativa es del equipo.

## Limpiezas automáticas que hoy existen (señaladas, sin tocar)

`surveymonkey_api.R:1495` y `surveymonkey_multibase.R:22` (quitan HTML del texto de SurveyMonkey al importar);
`equivalencias_importar_bloques.R:236` (borra marcas en mayúsculas entre corchetes); `router_codificacion.R:410`,
`interactivo_relacion.R:306`. Decide Gonzalo si pasan a aviso.

## Decisión (2026-10-13)

Gonzalo: «Tienes mi aprobación, aunque recuerdo que en procesamiento había una forma de hacerlo en analítica, pero haz lo
que consideres más robusto». La forma existe: **Analítica › Revisión de datos** guarda etiquetas curadas de pregunta y de
opción (`analitica_config$datos$variable_labels` / `value_labels`) y Gráficos ya las aplica con el mismo cuerpo
(`.analitica_apply_label_overrides`, router_graficos.R ~652). Se construyó ahí, sin tabla nueva (3b888c809):
`frontend/src/features/analitica/panes/revisionEtiquetas/` (detector puro + avisos bajo cada etiqueta, con «Corregir»
cuando la corrección es mecánica). La palabra partida («RE ACREDITACIÓN») y las tildes no se detectan: no hay regla segura.
