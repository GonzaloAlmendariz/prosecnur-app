# ADR 0097 — La paleta por lista de opciones llega a toda lámina nativa y al Word

- **Estado**: Aceptada (decisiones P1a–P4a de Gonzalo, 2026-10-11: «De acuerdo, haz todo lo que recomiendas»)
- **Fecha**: 2026-10-11
- **Ámbito**: Procesamiento › Gráficos › Estilo del informe › Paletas; motor nativo (ADR 0093) y Word
- **Relación**: el recetario manda por defecto (ADR 0092); las láminas nativas dibujan con formas (ADR 0093); se
  guardan decisiones, no defaults (ADR 0094). Estudio: `docs/qa/estudio-paletas-por-lista-f6-2026-10-11.md`.

## Contexto

Gonzalo: «Lo único que me preocupa es que no podamos determinar unas paletas con colores particulares cuando la lista
de opciones no es la misma que el recetario pone, porque a veces hay listas de otros proyectos».

Hoy la paleta por lista (`config.paletas`: `list_name → {etiqueta: hex}`) sólo llega al dibujo nativo en escala y, en
parte, en radar. Categórica, agrupadas, torta/dona, divergentes, pesas y comparativo usan colores fijos; el Word igual.
Una lista que se llama distinto (perfil u otro proyecto) se ignora en silencio; con etiquetas distintas el color se
reparte por posición; sin paleta, la escala toma una rampa que arranca en rojo y no la Likert del recetario.

## Decisión

1. **Resolución de la paleta de una lista (P1a)**, en este orden: (a) nombre exacto de la lista (± s/es, como hoy);
   (b) vínculo explícito `config.paletas_vinculos[list_name] = clave_de_paleta` (clave nueva, sólo decisiones; ausente =
   sin vínculo); (c) **firma de opciones**: una paleta cuyas etiquetas, normalizadas sin caja ni tildes ni espacios
   repetidos, coinciden como conjunto con las opciones de la lista. Un único resolvedor en el backend lo usan PPT,
   miniaturas, Word y consolidado. El editor de Paletas muestra las paletas sin lista del instrumento («huérfanas») y
   permite vincularlas con un clic; agrupa listas idénticas por firma normalizada.
2. **La espec nativa lleva los colores**: `espec$colores` (vector con nombres = rótulo de categoría) en categórica,
   agrupadas, torta/dona, divergentes (por etiqueta, no por posición), comparativo de dimensiones y pesas. Cada
   `lamina_*` y cada renderer Word los lee; sin `colores`, dibuja como hoy (recetario).
3. **Barras y tortas siguen monocromas por defecto (P2a)**: navy con la mayor destacada (ADR 0093). Sólo cuando el
   usuario definió una paleta que resuelve para esa lista se usan sus colores. Una paleta de un perfil (no del usuario)
   no cambia esa regla.
4. **Opción desconocida (P3a)**: una opción sin color en la paleta resuelta toma el gris neutro del recetario
   (`categorias$residual`) y genera un aviso visible («La opción «X» no tiene color en la paleta de «lista»»). Se retira
   el respaldo posicional y el relleno con colores del motor que no son del recetario.
5. **Escala sin paleta (P4a)**: la Likert del recetario (`.graficos_paleta_likert`), no la rampa `approval` con rojo.

## Consecuencias

- Proyectos con paletas definidas verán sus colores en láminas nativas y en el Word donde antes salían colores fijos.
- Escalas sin paleta pasan de la rampa con rojo a la Likert del recetario. Ambos van en las notas de versión.
- `paletas_vinculos` es aditiva, se guarda como diff y pasa por el normalizador y el JSON por secciones (sección
  Paletas). Sin cambio de `format_version`.

## Cumplimiento

- Una paleta definida para `acuerdo_4` se aplica a `lst_p14` con las mismas opciones (firma), y a otra lista por
  vínculo explícito; sin coincidencia, nada cambia.
- Cada familia de la tabla del estudio honra la paleta resuelta en PPT nativo y Word (test por familia).
- Una opción desconocida sale gris con aviso; ninguna opción toma un color por posición.
- Una escala sin paleta sale con la Likert del recetario.
- Sin paleta del usuario, categórica y torta salen idénticas a hoy (byte a byte en el XML de la lámina).
