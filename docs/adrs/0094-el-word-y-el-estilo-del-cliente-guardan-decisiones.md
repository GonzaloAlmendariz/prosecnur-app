# ADR 0094 — El Word y el estilo del cliente guardan decisiones, no defaults

- **Estado**: Aceptada (decisión «1a» y «5a» de Gonzalo, 2026-10-11)
- **Fecha**: 2026-10-11
- **Ámbito**: Persistencia `.pulso` · Procesamiento › Gráficos › Word y Estilo del cliente (F6.4, A6 de la Meta A)
- **Relación**: extiende el ADR 0074 («El proyecto guarda decisiones, no defaults»), que hoy rige sólo para `presets`.
  Contrato operativo: `docs/qa/contrato-word-estilo-f6-2026-10-11.md`.

## Contexto

Gonzalo, 2026-10-11: «el recetario siempre manda; si algo va a cambiar en el recetario, cambia en los defaults por
defecto de la app». Decisión 1a: el `.pulso` guarda sólo lo que difiere del default de la app; lo no tocado sigue al
default y hereda si el recetario cambia. Decisión 5a: «Modificado» se compara contra el default.

Medido en solo lectura (revisión de contratos, 2026-10-11): los cuatro proyectos de referencia con estado guardan
`w_presets.chart_presets.barras_apiladas` con `size_leyenda=6`, `legend_key_cm=0.15`, `mostrar_barra_extra=FALSE`,
`barra_extra_preset="ninguno"`, `canvas_w_extra=0`: fotos de dos defaults anteriores (G1, leyenda de 6 pt; G2, previo a
f1b7034, sin Top Two Box). Un diff ingenuo las guardaría como decisiones y esos proyectos nunca heredarían el Top Two
Box ni los 8 pt.

## Decisión

1. `config.w_presets`, `config.documento_word` y `config.estilo_cliente` se guardan **sólo como diferencias** contra su
   default declarado (`.WORD_PRESETS_DEFAULT_PULSO`, `.DOCUMENTO_WORD_DEFAULTS`, recetario + perfil del catálogo). El
   diff lo calcula el backend al guardar (`.graficos_config_set` y el borrador del consolidado); hojas iguales al
   default y contenedores vacíos desaparecen; lo que no tiene default declarado se conserva.
2. Al leer se repone el default completo en un solo embudo (`.build_w_presets` y homólogos), de forma idempotente:
   `strip(merge(default, strip(x))) == strip(x)`.
3. **Fósiles por generación**: una tabla `.WORD_MIGRACIONES_DEFAULTS` (G1, G2) reemplaza un bloque sólo si coinciden
   TODAS las claves de esa generación; un valor aislado distinto se respeta como decisión. La migración es de lectura:
   abrir un proyecto no lo marca modificado; el primer guardado deja el diff en disco. Sin cambio de `format_version`.
4. **Procedencia derivada, no guardada**: clave ausente = «Del recetario»; presente = «Propio». «Volver al recetario»
   borra la clave. (Coherente con la alternativa descartada del ADR 0074.)
5. Logos del cliente en `files/` del `.pulso` por `file_id`, nunca por ruta; el worker `callr` recibe rutas resueltas.
   Un logo no es secreto (ADR 0005 no aplica), pero `estilo_cliente` no lleva rutas ni credenciales.
6. `GET /api/graficos/config` devuelve además `defaults` (aditivo, no persistido) para que «Modificado» compare contra
   la autoridad del backend.

## Consecuencias

- Los cuatro proyectos de referencia cambian en el Word al abrirse con esta versión (leyenda 6 → 8 pt y aparece el Top
  Two Box en `barras_apiladas`): es el efecto buscado por 1a y va en las notas de versión.
- El espejo de defaults frontend↔R (`test-reporte-word-defaults-espejo.R`) se amplía a todo el árbol: con diff, una
  deriva del espejo se guardaría como decisión.
- `.build_w_presets` deja de abortar con claves desconocidas: las filtra contra `formals(w_presets)` con aviso, y las
  sublistas de estilo se mezclan, no se reemplazan.
- Abiertas al aceptarse (en el contrato): ámbito de `estilo_cliente` en multibase independiente, persistencia del
  perfil de letra entre proyectos, y logo propio en el PPT.
