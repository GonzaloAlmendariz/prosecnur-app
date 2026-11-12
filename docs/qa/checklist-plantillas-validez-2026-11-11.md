# Checklist: Plantillas sobria, última pestaña y con validez (2026-11-11)

Pedido de Gonzalo tras la revisión en vivo con el RMS ACNUR. Sólo Gonzalo da por terminado cada ítem.

Estados: **pendiente**, **en curso**, **resuelto** (test y vista revisada), **bloqueado** (necesita decisión).

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Las plantillas no llevan descripción | `plantillas/catalogoPlantillas.ts`, `PestanaPlantillas.tsx` | resuelto: el catálogo ya no tiene el campo; sólo la territorial deshabilitada dice por qué. Sin la frase de ayuda bajo el título ni el texto largo de las guardadas ("Ninguna todavía.") |
| 2 | UI sobria y elegante para el menú de plantillas | `PestanaPlantillas.tsx`, `plantillas.css` | resuelto: menú más angosto, filas compactas con miniatura chica y nombre en letra de cuerpo; la elegida en semibold sobre el fondo suave. Visto en vivo a 1440x1000 con el RMS |
| 3 | Plantillas es la última pestaña de Gráficos (Gonzalo eligió "moverla al final") | `lib/navegacion/catalogos/procesamiento.ts` | resuelto: última del riel; test de orden actualizado |
| 4 | Avisar antes de cambiar la identidad: estilo y plantilla de PowerPoint, marca (logos) y paletas de colores | `plantillas/identidadDePlantilla.ts` (nuevo) + panel | resuelto: el panel "Identidad del informe" lista, antes de crear, el cambio de estilo, las paletas que se agregan, reemplazan, quitan o conservan, los tipos de gráfico cuyo estilo cambia y si los logos propios dejan de ir en la portada. Si algo del proyecto se pisa, "Crear láminas" pide confirmar ("Crear y cambiar la identidad" o "Cancelar"). Visto en vivo de Pulso a ACNUR y de ACNUR a Pulso |
| 5 | Todo validado: cada acción dice lo que cambia o por qué no se puede | panel y modelo | resuelto: ver V1 a V4 abajo |

## Lo encontrado antes de tocar código

- "Crear láminas" aplica el perfil de estilo de la plantilla con `aplicarPlanSugerido` → `estiloDePerfil` (store.ts):
  funde presets, paletas (una lista con el mismo nombre se reemplaza) y ajustes reutilizables, y escribe `profile_id`
  y `template_id` en `scope_rules.global`. No avisa de nada.
- "Informe Pulso" tiene `config: {}`. En un estudio ACNUR el backend elige el perfil ACNUR cuando el perfil viene
  vacío (`.graficos_suggested_plan`, único uso de `.graficos_is_acnur_study`), y al venir de ACNUR la identidad ACNUR
  queda en `scope_rules.global`: elegir Pulso no devolvía la identidad Pulso. Comprobado leyendo
  `graficos_plan_coverage.R` y `router_graficos.R` (`.graficos_delivery_options`).
- Con plantilla de cliente los logos propios no van en la portada (`graficos_estilo_cliente_worker.R`, aviso del
  export); hoy nadie lo dice al elegir la plantilla.

## Validaciones y defectos encontrados al probar con el RMS (2026-11-11)

| # | Qué | Resultado |
|---|---|---|
| V1 | "Crear láminas" deshabilitado dice por qué | "Faltan las secciones y preguntas del cuestionario", "Falta leer el estilo de la plantilla", "No hay preguntas dentro del informe" |
| V2 | Guardar una plantilla con un nombre que ya existe | el botón dice "Reemplazar" en vez de "Guardar" |
| V3 | Volver a "Informe Pulso" desde ACNUR dejaba la identidad de ACNUR | corregido. Se quita lo que dejó el perfil saliente (ajustes y paletas sin editar, ajustes reutilizables, estilo en `scope_rules.global`; lo editado se conserva) y la plantilla escribe su identidad entera en el pedido, porque el backend funde el pedido sobre la config guardada y omitir una clave no la borra. "Informe Pulso" manda `perfil_auto = FALSE` para que un estudio de ACNUR no lo vuelva ACNUR. En vivo quedaron sin perfil ni paletas de ACNUR; que la plantilla de PowerPoint pase a la de Pulso lo fija un test de R sobre la fusión del backend, porque la última vuelta en vivo no terminó con la máquina a carga 88 |
| V4 | El total de láminas de Pulso no coincidía con lo creado | corregido: prometía 154 y armaba 73. Una batería pone varias preguntas en una lámina y se sumaba por pregunta. La estructura manda las preguntas de cada lámina y el total se cuenta por lámina: en vivo prometió 73 y creó 73; ACNUR, 161 y 161 |
| V5 | Estilo vigente con la plantilla de PowerPoint de ACNUR y sin su perfil | cuenta como ACNUR: el aviso no se calla |
