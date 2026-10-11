# Estudio — paletas por lista de opciones en el PPT nativo y el Word

Tipo: Estudio técnico
Estado: Vigente
Fecha: 2026-10-11
Autoridad: Preocupación de Gonzalo tras la decisión 2a; lead de la Meta A (Explore en solo lectura)

Preocupación, textual: «Lo único que me preocupa es que no podamos determinar unas paletas con colores particulares
cuando la lista de opciones no es la misma que el recetario pone, porque a veces hay listas de otros proyectos».

## Cómo funciona hoy

- El store guarda `paletas` como `list_name → {etiqueta: hex}` (`frontend/src/features/graficos/store.ts:84`,
  `setColorEnPaleta` :781-796). `PaletasEditor.tsx` sólo lista las listas del instrumento actual (`:112`), agrupa listas
  idénticas por firma exacta `name::label` (`:41-43`) y sugiere sólo por número de opciones (`:140-145`).
- Persistido en `graficos_config$paletas`; `.graficos_palette_env` (`router_graficos.R:1671-1684`) crea un objeto
  `paleta_<ln>` por lista; `.paleta_auto` (`reporte_plan_ppt.R:3075-3103`) lo busca por nombre exacto (± s/es) y
  `.reporte_plan_palette_for_levels` (`reporte_plan_opciones.R:329-416`) cruza por etiqueta exacta, luego sin tildes, y
  por último **por posición**.

## Qué familia nativa honra la paleta por lista

| Familia | PPT nativo | Word |
|---|---|---|
| Escala / apiladas / multiapiladas / paneles / mixtas | Sí | Sí |
| Escala de 2 categorías (va a dicotomía) | No (`lamina_categorica.R:130`) | No |
| Categórica (columnas, barras, dicotomía, lollipop) | No (azul fijo, `lamina_categorica.R:15,43`) | No (`.WORD_TINTA`) |
| Agrupadas | No (sin color en la espec; con cruce, ni se consulta) | No |
| Torta y dona | No (`lamina_circulares.R:35-37`; con k>3 cae a ggplot, que sí la honra) | No (`.WORD_PALETA_TORTA`) |
| Divergentes | No (por posición, `graficos_espec_divergentes.R:57-67`) | No |
| Radar | Parcial (sólo la lista del cruce; un preset la pisa) | Sí |
| Dimensiones | No aplica en heatmap (el color mide); comparativo fijo | No |
| Serie temporal | Sólo override por gráfico | — |
| Numéricos, pesas | No | No |

## Listas que no calzan con el recetario

1. **Nombre de lista distinto** (perfil u otro proyecto: `acuerdo_4`, `likert`, `yesno` frente a `lst_p14`): la paleta se
   ignora en silencio y queda huérfana e invisible en el editor (aunque `listasConColor` la cuenta).
2. **Sin paleta definida**: en escala, `.reporte_plan_pulso_palette_for_levels` (`reporte_plan_opciones.R:419-453`) elige
   por palabras clave una rampa `approval` que arranca en rojo `#CA5651` y gana a la Likert del recetario
   (`graficador_paleta.R:47-67`). Leído en el código, sin render.
3. **Nombre igual, etiquetas distintas**: respaldo posicional (`reporte_plan_opciones.R:405-413`) que puede duplicar un
   color o darle el significado equivocado; si la paleta es más corta, rellena con colores del motor que no son del
   recetario (`graficador_paleta.R:99-142`).
4. **El recetario no tiene paleta por tipo de lista** (`estandar_pulso.json`: likert, likert_neutro, dicotomica,
   actores, categorias, calor, mapa): son colores fijos de lámina, no defaults asignables a una lista.

## Qué falta (propuesta)

1. Resolver la paleta por firma normalizada de opciones o por una clase de escala declarada, con vínculo explícito
   `lista del instrumento → paleta`; mostrar en el editor las paletas huérfanas y permitir vincularlas.
2. Que la espec lleve colores en categórica, agrupadas, torta/dona, divergentes (por etiqueta), comparativo y pesas, y que
   cada `lamina_*` y renderer Word los lea con el recetario como respaldo.
3. Conectar `.paleta_auto` en divergentes y en agrupadas con cruce; revisar la precedencia preset > paleta en radar.
4. Opción desconocida: color neutro del recetario + aviso, en vez del respaldo posicional.
5. Default sin paleta: la Likert del recetario, no la rampa `approval` con rojo.
6. Decisión previa de diseño: las categóricas del recetario son monocromas a propósito (navy + realce, ADR 0093).

## Decisiones de Gonzalo (2026-10-11, ~12:00 Perú)

«De acuerdo, haz todo lo que recomiendas» → P1a, P2a, P3a y P4a adoptadas en el ADR 0097. Además: 5a (los tipos que
salen por el motor anterior —puntos comparativos, tabla y radar por dimensiones— conservan sus controles en Láminas
mientras no tengan versión nativa), 6a (se retira de la tarjeta la opción «personalizado» de `tipo_rango`) y 7a (el
anonimizador no reemplaza el nombre del cliente en títulos o etiquetas, pero lo avisa en su reporte).
