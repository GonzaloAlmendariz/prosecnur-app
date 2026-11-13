# ADR 0145: script de limpieza replicable en Quarto

Estado: Propuesto
Fecha: 2026-11-12
Autoridad: Gonzalo anotó el 2026-11-11 que "en algunos estudios como acnur piden script de limpieza replicable en qmd" y el 2026-11-12 respondió las siete preguntas de `docs/qa/propuesta-script-limpieza-qmd-2026-11-11.md` (sección 6). Queda como Propuesto hasta que él lo acepte, porque cambia el criterio de qué detalle de la limpieza llega al cliente.

## Contexto

Algunos clientes piden, junto con la base, un documento Quarto (`.qmd`) que al ejecutarse sobre la base recibida de la plataforma produzca la base limpia, y su HTML renderizado. Prosecnur ya genera dos scripts R y ninguno lo cumple:

- El script de replicación de Analítica (ADR 0031) llega a la base final copiando o recodificando columna por columna. Reproduce el resultado, pero no recorre las decisiones de limpieza ni dice por qué cambió un valor.
- El script del paquete metodológico de Validación (ADR 0037) reconstruye el universo y evalúa las reglas. Encuentra casos; no aplica decisiones.

Las decisiones de limpieza sí se guardan como datos, con acción, variable, casos, parámetros y justificación (`api/R/limpieza_decision_engine.R`, `.limpieza_validate_decision()`), y se aplican en un orden fijo (`.limpieza_apply_decisions_to_data()`). Falta convertirlas en código.

Dos defectos del estado actual lo impiden en un estudio terminado:

1. Aplicar la codificación reemplaza la data de la base con `estudio_replace_base_files()`, y esa función, cuando la data cambia, borra el linaje de la limpieza y vacía el workspace de Validación. Como Codificación va después de Validación, un estudio codificado ya no conserva las decisiones que explican su base. El proyecto de referencia `acnur_acg` está en ese estado.
2. El archivo del que partió la limpieza (`limpieza$source_data_file_id`) y la base limpia (`limpieza$effective_data_file_id`) no están en la lista de archivos que se guardan en el `.pulso` (`.pulso_collect_input_fids()`). Solo se salvan si coinciden con otro archivo que sí se guarda.

## Decisión

1. **Entregable nuevo en Validación › Cierre**: un ZIP con un `.qmd` y su HTML renderizado. El `.qmd` va de la base recibida a la base limpia, con un bloque por paso en el orden en que el motor los aplica: lectura, universo de Carga, reglas de validación, exclusiones, correcciones una por decisión, pasos sin receta, comprobación y escritura. Si la máquina no tiene Quarto, se entrega el `.qmd` solo y el aviso dice la causa.
2. **Código autónomo con `dplyr`, en español.** El script no depende del paquete de la app. Quien lo ejecuta necesita R con `dplyr`, y `readxl` si la base es `.xlsx`.
3. **Igualdad comprobada al generar.** El motor ejecuta el código del `.qmd` en un entorno limpio contra la base recibida y lo compara celda por celda con la base limpia promovida. Una columna que no coincide pasa al bloque de pasos sin receta (valores por identificador de caso), el `.qmd` la declara y la app avisa nombrándola.
4. **Detalle hacia el cliente.** Al generar el script se elige si muestra el detalle. Con la opción encendida, cada bloque muestra su regla, sus casos y la justificación de la decisión. En cada decisión el analista elige si su justificación va como párrafo del script o si el cambio solo se aplica. La justificación es el mismo texto que la decisión ya exige al marcarse lista; el panel donde se escribe avisa que puede llegar al script. Con la opción apagada rige el criterio de `docs/qa/reproducibilidad-decisiones-pendiente-2026-08-15.md`: ni casos excluidos ni motivos, solo los casos que permanecen. Ese criterio y la regla de sanitización del ADR 0031 siguen rigiendo para el script de replicación de Analítica.
5. **Las decisiones de limpieza sobreviven a la codificación.** Cuando la data nueva de una base sale de su base limpia vigente (la pestaña Aplicar de Codificación), `estudio_replace_base_files()` conserva el linaje de la limpieza y el workspace de Validación. Solo se descarta lo que se calcula sobre la data (la caché del explorador). Las demás vías de carga siguen igual: una data nueva que no desciende de la vigente descarta el linaje y las decisiones.
6. **La base recibida y la base limpia viajan en el `.pulso`.** `.pulso_collect_input_fids()` incluye `limpieza$source_data_file_id` y `limpieza$effective_data_file_id`.

## Consecuencias

- Revertir la limpieza de una base ya codificada dejaría el formulario codificado junto a la base recibida. Mientras no exista una forma de deshacer la codificación, revertir en ese estado se rechaza con la causa (`E_LIMPIEZA_REVERTIR_CODIFICADA`); corregir una decisión y volver a cerrar la limpieza sigue siendo posible y vuelve a pedir la codificación.
- El `.pulso` de un estudio con limpieza promovida puede crecer en el tamaño de una o dos bases más.
- Hay dos implementaciones de cada acción de limpieza: la del motor y su traducción a código. Un test por tipo de acción compara las dos salidas, y una acción nueva sin traducción lo pone en rojo.
- `original_data_file_id` sigue significando "la base vigente antes de codificar" (`codificacion_fuente_actual.R`), no "la base recibida". El script de limpieza busca la base recibida en el origen del universo de Carga o, si no hubo, en el origen de la limpieza.

## Precisiones pendientes

Lectura del 2026-11-12, a confirmar al aceptar el ADR:

- Con la opción del estudio apagada tampoco salen las justificaciones marcadas para el script: la opción del estudio manda.
- La justificación sigue siendo obligatoria para marcar una decisión como lista; "solo aplicar" significa que no se publica, no que pueda quedar vacía.
- La frase del aviso se valida con la pantalla del rediseño de Validación. Propuesta: "La justificación encabeza este cambio en el script de limpieza."

## Notas

Relacionado: [0031](0031-script-replicacion-base-analitica.md), [0037](0037-reporte-metodologico-validacion.md), [0076](0076-una-base-depurada-se-promueve-no-se-recomienda.md), [0133](0133-entregables-un-registro-un-nombre-una-carpeta.md) y [0142](0142-mapa-de-pestanas-de-procesamiento.md).
