# ADR 0092 — Los recetarios son el estándar del motor de PPT y Word

- **Estado**: Aceptado
- **Implementación**: En curso — fuente de verdad en `api/inst/estandar/estandar_pulso.json`
  (exportada por `docs/qa/motor-ppt-2026-10-06/herramientas/exportar_estandar.R`); fases F0 a F7 en
  [goal-remasterizacion-motor-2026-10-08.md](../qa/goal-remasterizacion-motor-2026-10-08.md)
- **Ámbito**: Procesamiento › Gráficos (motor PPT, motor Word, graficadores y editor)
- **Fecha**: 2026-10-08 · **Ratificado**: 2026-10-08 (Gonzalo: «el recetario de PPT, tanto como el
  recetario de Word, son a lo que tenemos que apuntar. Y precisamente ante eso es lo que el motor debe ajustarse»)
- **Relación**: deja histórico el estilo «fiel» del recetario como norma; conserva
  [estandar-ppt-acreditacion-2026-08-14.md](../qa/estandar-ppt-acreditacion-2026-08-14.md) sólo como referencia de contenido.

## Contexto

El motor se construyó por capas, lámina a lámina y caso a caso. Hoy el estilo vive en al menos cuatro lugares
que se contradicen: los presets de `graficos_metadata.R`, los defaults de cada `graficar_*`, valores sueltos
dentro de `reporte_plan_ppt.R` y paletas que sólo existen en perfiles. La geometría la deciden las plantillas
(márgenes de 0.315, 0.347 o 0.505 in según el layout). El Word arma el documento a mano, sin estilos ni campos.

Entre el 6 y el 8 de octubre de 2026 se cerraron dos recetarios con Gonzalo: la propuesta de diseño en PPT
(`recetario-moderna.pptx`, 22 tipos de lámina) y la propuesta en Word (`propuesta-word.docx`).

## Decisión

1. **Una sola fuente de verdad.** Todo valor visual del motor (color, tamaño, margen, grosor, aire, posición de
   ranuras, estilos de Word) sale de `estandar_pulso.json`. Ningún graficador ni renderer declara un valor
   visual propio. Lo que hoy es un número suelto pasa a ser un token con nombre.
2. **El recetario moderno es el estilo por defecto.** Los perfiles de cliente (acreditación, ACNUR) quedan como
   variantes que sólo cambian logo y paleta, sobre la misma geometría y las mismas reglas.
3. **Los proyectos existentes migran solos.** Un plan guardado se abre y se regenera con el estándar; lo que no
   tenga equivalente se avisa con nombre (`[PULSO-AVISO]`), nunca se descarta en silencio.
4. **La app produce el Word completo**: portada, índices, capítulos con apertura y encabezado, «Cómo leer este
   informe», figuras con rótulo, base y lectura, tablas y contraportada.
5. **Conformidad medida.** Las reglas de `verificar_mazo` se amplían con la conformidad al estándar; una fase
   se cierra en verde por conformidad, no por ausencia de errores.

## Consecuencias

- Cambiar el estilo es cambiar el JSON (y el recetario que lo origina), no un graficador.
- `reporte_plan_ppt.R` y `graficador_dimensiones.R` siguen congelados: lo nuevo va en archivos propios y el
  renderer sólo delega.
- Los mazos de proyectos ya entregados se verán distintos al regenerarse: es el efecto buscado.

## Registro de decisiones del motor

Gonzalo (2026-10-26): «el estandar_pulso.json debe quedar en el ADR que se actualiza con las decisiones del motor». Este
registro es esa fuente: cada decisión que cambia cómo dibuja el motor (PPT o Word) se anota aquí con su fecha, su
origen y el token de `api/inst/estandar/estandar_pulso.json` que la sostiene. El JSON guarda los valores; este registro
dice qué significan y por qué existen. Un valor visual que todavía vive suelto en el código figura como «por crear» y su
ítem del [checklist del desfase](../qa/checklist-recetario-desfase-2026-10-26.md) lo sigue hasta que pase al JSON
(los tokens se agregan en el exportador `docs/qa/motor-ppt-2026-10-06/herramientas/exportar_estandar.R`, no a mano).

Formato: **fecha · decisión** — origen · token · ítem del checklist.

### Escalas y Top Two Box

- **2026-10-23 · Una sola «Barra extra» por gráfico** (Top Two Box, Bottom Two Box o conteos); el Word la hereda y
  `word_barra_extra` la cambia sólo allí — `5706e40c8` · contrato en `graficos_barra_extra.R` · E2.
- **2026-10-23 · Piso de grosor de la barra de escala**: no baja de `grosor_piso_cm`; antes que apretar, la lámina se
  parte — `51aafe5c8` · `ppt.grosor.piso_escala_cm` · E3.
- **2026-10-26 · El piso de 1,12 cm rige sin declararlo**: era opt-in por proyecto (Arte lo declaraba; el catálogo y
  los proyectos nuevos no) y las apiladas por grupos salían delgadas (Gonzalo: «Las barras se ven muy delgadas cuando
  pensé que ya habíamos solucionado eso en el motor actual»). El estándar trae 1,12 cm; `grosor_piso_cm = 0` lo
  apaga — `ppt.grosor.piso_escala_cm` · E3.
- **2026-10-23 · Hasta seis barras sin «(cont.)»**: se comprime el aire, no la barra — `51aafe5c8`, `7a301695b` · por
  crear `ppt.geometria.apretado.*` · E4.
- **2026-10-23 · Cifra chica** a 0,28 in sobre la barra, ≥ 0,075 de la de arriba, caja de 0,22 — reemplaza
  `ppt.geometria.aire_cifra_chica = 0.36` · E5.
- **2026-10-24 · Cifras chicas vecinas** repartidas sin solaparse, centradas en su grupo, 0,12 in de aire; ninguna se
  omite — `0a3133f60` · reemplaza `ppt.reglas.cifras_chicas` (0,46 in) · E6.
- **2026-10-23 · Filete entre temas apagado por defecto** — `51aafe5c8` · E7.
- **2026-10-23 · `ancho_enunciado_extra_in`** (tope 1,5 in) ensancha el enunciado sin mover el Top Two Box — E8.
- **2026-10-24 · Tabla de calor Likert con columna Top Two Box** — `8c3176b01` · `ppt.colores.verde_top_two_box` · E9.
- **2026-10-26 · Columna Top Two Box del Word**: se mide en pulgadas, centrada con 0,12 in de aire a cada lado (0,16
  entre Top y Bottom) y termina en el margen derecho; cae en el mismo lugar en todas las figuras (Gonzalo: «el top two
  box debe finalizar cuando finaliza el margen derecho») — `824e06338` · por crear `word.figura.columna_box` · E1.

### Columna de rótulos y alineación (Word)

- **2026-10-26 · Arranque común**: las figuras de barras con rótulo corto (≤ 1,6 in) arrancan en la misma columna,
  calculada por capítulo; el rótulo largo conserva la suya — `6328befb2`, `baa8098d8` · por crear
  `word.figura.rotulo_corto_in` · A1.
- **2026-10-26 · Rótulo mediano** se parte en hasta dos líneas para entrar en la columna común — `7aa7ace25` · por crear
  `word.figura.rotulo_lineas_max` · A2.
- **2026-10-26 · Sin rótulo de fila** la figura no reserva columna y va a todo el ancho (Gonzalo: «si no tiene etiqueta,
  no tiene por qué reservar espacio») — `ce8ffb540`, `397232f91` · A3.

### Categóricas y dicotomía (PPT)

- **2026-10-25 · Barras de una serie**: columna de rótulos ≤ 35 %, hasta 3 líneas, piso de 11 pt; el 0–100 % sigue por
  defecto y el eje libre (máximo × 1,15) es opcional — `a865d7b60` · por crear `ppt.geometria.barras_ancho.*` · A4.
- **2026-10-24 · Pocas categorías**: barra ≤ 0,55 in, fila ≤ 0,88, bloque centrado — `98e6690db` · reemplaza
  `ppt.grosor.categorias` · A5.
- **2026-10-23 · La dicotomía es sólo para Sí/No**; el sexo y otras nominales de dos categorías van en barras —
  `51aafe5c8` · S1.
- **2026-10-23 · «N respuestas» y «x de y» sólo con `mostrar_respuestas`** (apagado) — `51aafe5c8`, `6ec72b494` ·
  reemplaza `ppt.reglas.base_chica` · S5.
- **2026-10-23 · Sí/No de una pregunta al 85 % del ancho**, centrado — `6ec72b494` · por crear
  `ppt.geometria.dicotomia_unica_frac` · S3.

### No sustantivos, residuales, base y pie

- **2026-10-24 · No sustantivo** (9, 77, NS/NR) al final en gris azulado, distinto del neutro de la escala; el
  denominador no cambia — `8bc71f483`, `bd8fd87b6`, `623146ac2` · hoy `texto_tenue`; por crear
  `ppt.colores.no_sustantivo` · N1.
- **2026-10-23 · Residuales con el color de su serie**; `residuales_gris` es opción apagada — `0e16a0a94` · reemplaza
  `ppt.reglas.orden_escala` en lo del color · N2.
- **2026-10-24 · Una sola forma del pie**: «Base: N» si el preset no declara sufijo — `67822ba19` · B1.
- **2026-10-24 · Base de un cruce**: los válidos en la variable y en el cruce — `f26d10c0a` · B2.

### Word: documento y figuras

- **2026-10-26 · Los ejemplos de «Cómo leer» no se numeran**: van como «Ejemplo: …» sin campo SEQ; el primer gráfico
  del estudio es el 1 — `cee79a0d3` · `word.rotulo` · W1.
- **2026-10-23 · «Cómo leer» automático**: cada sección entra si su recurso aparece en ≥ 2 láminas — `51aafe5c8` ·
  reemplaza `word.documento` («siempre») · W2.
- **2026-10-23 · Grosor de barra común de 0,70 cm** — `51aafe5c8` · por crear `word.figura.grosor_barra_cm` · W3.
- **2026-10-26 · Filtro y subpregunta en dos figuras**, la subpregunta sólo con su enunciado y la base de quienes la
  habilitan — `3d7526549`, `e60cc25d1` · F1.

### Texto abierto

- **2026-10-24 · Nube** con no respuestas, flexiones, frases de ≥ 3 personas y conteo de personas, todo opcional —
  `3516aab43`, `5acb31d46` · X1.
- **2026-10-25 · Temas de un texto codificado**: % sobre comentarios con contenido, módulo con sus subtemas debajo y
  jerarquía visual — `d596bb4f1`, `37e9c6ed3`, `eaa599f57` · X2.
- **2026-10-24 · Citas** sin atribución, con aprobación del analista; sin aprobadas sale como borrador —
  `c782ba495`, `896cebfa2` · por crear `ppt.citas.*` · X3.

### Paleta

- **2026-10-27 · Manda el JSON**: el catálogo, las sugerencias de la app y todo respaldo sin paleta pintan con las
  paletas del estándar; el coral va sólo en los títulos — Gonzalo («el recetario es la fuente de verdad y la
  constitución»; ante la pregunta, «manda el JSON») · `ppt.paletas.*`, `ppt.reglas.coral` · P1, P3, P4.
- **2026-10-27 · Lista nominal sin paleta**: dos opciones, la dicotómica (Sí azul oscuro, No celeste, como el mazo
  entregado de ACRD Conta); más, la rampa de azules — token nuevo `ppt.paletas.categorica`, leído por
  `.std_paleta_nominal()` · P4.
- **2026-10-27 · Cada paleta declara su regla de uso** (`uso`) y los públicos y roles de una serie sus rótulos; la
  lámina «Reglas de la identidad» del catálogo los dibuja tal cual (`p_slide_estandar`) — `ppt.paletas.*.uso`,
  `ppt.paletas.actores.rotulos`, `ppt.paletas.categorias.rotulos` · P5.

### Otros

- **2026-10-23 · Radar de 5 a 8 criterios**; con menos, líneas y puntos — `51aafe5c8`, `fb148d02b` · por crear
  `ppt.reglas.radar_criterios` · O1.
- **2026-10-26 · Grilla de seis** con filete vertical en las dos filas — `b433855dc` · G1.

El resto de reglas del inventario (donas y guías T1–T4, grillas G2–G4, divergente, dumbbell y marco de respaldo
O2–O8) sigue en el checklist con su estado; se anotan aquí a medida que su valor pasa al JSON.
