# ADR 0141: ranking de rótulos largos y rótulos cortos del mazo de Gráficos

Estado: Aceptado (Gonzalo, 2026-11-09)
Fecha: 2026-11-09
Autoridad: Gonzalo: "sería bueno tener en la UI cuáles son las etiquetas de variables y de opciones de variables más
largas como un ranking y tener la posibilidad de plasmar un equivalente más reducido a cada una para no tener estos
problemas, pero debería ser en una de las pestañas encargadas de eso, no en cualquiera"; "es mejor tener una para
analítica y otra para gráficos de forma independiente". Alcance precisado el mismo día: "una pestaña o vista de pestaña
que muestre el ranking por pregunta y por categoría de preguntas de las más largas y una opción para reemplazarlas por
un rótulo más corto que sea independiente, uno en analítica y otro en gráficos, porque en analítica ya hay uno pero sólo
para entregables analíticos; falta uno independiente para gráficos".

## Decisión

Analítica conserva su revisión de etiquetas (Revisión de datos: inspector y avisos de etiqueta) para sus entregables.
Este ADR crea el equivalente de Gráficos, independiente: no lee ni escribe la config de Analítica.

1. **Persistencia.** `plan.rotulos_cortos` de la config de Gráficos (por base activa, dentro del `.pulso`):

   ```json
   { "<rótulo completo de una opción>": "<corto>",
     "preguntas": { "<base>$<variable>": "<corto>" } }
   ```

   - Las opciones siguen como hasta hoy (U3): rótulo completo → corto, aplicado a datos, instrumento, plan y paletas.
     Los planes guardados se leen igual.
   - `preguntas` es una clave reservada: el mapa de opciones la salta.
   - Vale sólo para Gráficos (PPT, Word, vista previa y miniaturas).

2. **Precedencia del rótulo de una pregunta** al dibujar:
   1. el "Nombre corto de la pregunta" de ese gráfico (`overrides$etiquetas_vars`);
   2. `plan.rotulos_cortos.preguntas`;
   3. el nombre corto que la pregunta tiene en otro gráfico del plan (E4);
   4. el enunciado del instrumento.

   - Un resolvedor único, `.rotulos_preguntas_vigentes` (`api/R/graficos_rotulos_cortos_plan.R`). Lo consulta
     `.title_of_var`, y con él todo gráfico que rotula una pregunta por su variable. También lo consulta el eje del radar.
   - Las láminas de resumen usan `.nombre_corto_del_plan`, que aplica 2 antes que 3.
   - Los niveles 2 y 3 viajan al render en el contexto del informe (`prosecnur.sig_informe`), como E4.

3. **Ranking.** `GET /api/graficos/rotulos/ranking?scope=graficos` devuelve, por base:
   - `preguntas: [{ref, etiqueta, largo, usos, corto?, corto_en_grafico?}]`;
   - `opciones: [{ref, codigo, etiqueta, largo, usos, corto?}]`.

   Las dos listas van del rótulo más largo al más corto.
   - `usos` es el número de láminas donde aparece la pregunta, o alguna pregunta cuya lista trae la opción. Una lámina
     con comodín (`base$*`) no suma.
   - `corto` es sólo lo que el analista guardó. Nada se acorta solo.
   - `corto_en_grafico` es el nombre corto escrito en algún gráfico (nivel 3). Sólo se informa.
   - Otro scope responde 400 `E_GRAFICOS_ROTULOS_SCOPE`.

4. **Guardado.** `POST /api/graficos/rotulos` con `{preguntas?, opciones?}`:
   - Una sección presente reemplaza la guardada; una ausente se conserva.
   - `null` quita la entrada.
   - Se valida:
     - vacío → 400 `E_ROTULO_CORTO_VACIO`;
     - no más corto que el original → 400 `E_ROTULO_CORTO_NO_ACORTA`;
     - pregunta inexistente → 400 `E_ROTULO_CORTO_REF`.
   - Dos cortos iguales en una base (o dos opciones) son un aviso en `avisos`, no un bloqueo.

## Consecuencias

- El editor guarda el plan por autosave. Tras el POST, el frontend debe llevar `rotulos_cortos` de la respuesta a su
  store. Si no, el siguiente autosave lo pisa.
- El nivel 3 (E4) ahora vale en todo gráfico, no sólo en las láminas de resumen.
- Una opción cuyo rótulo sea literalmente "preguntas" no puede tener corto.
