# ADR 0139: tipos de lámina y tipos de gráfico, dos catálogos

Estado: Aceptado (Gonzalo, 2026-11-08, como vara del trabajo de láminas)
Fecha: 2026-11-08
Autoridad: Gonzalo: «los gráficos tienen que venderse como eso, como tipos de gráficos, y las láminas como eso, como
tipos de láminas… cada lámina puede incluir varios gráficos… tiene que tener a su disposición el catálogo de gráficos,
que no estén como dependiendo de ciertas cosas o que tengas que generar un resumen para ello, sino que el resumen… te
diga, bueno, puedes usar este catálogo de gráficos y no viceversa».

## Contexto

La auditoría del 2026-11-08 encontró cuatro problemas:

- **Variantes que solo se alcanzan por una intención.** El contraste de públicos, las aperturas internas y la escala
  con «Sin información» aparte son variantes `estilo: "resumen"` de `p_dumbbell` y `p_barras_divergentes`. Solo se
  llega a ellas desde una tarjeta de «¿Qué quieres contar?» o desde un argumento poco visible.
- **Gráficos rotulados como láminas.** Esas tarjetas llevan la clase «Lámina» o «Lámina de resumen» aunque lo que
  insertan es un gráfico dentro de `p_slide_1_grafico`.
- **Vocabularios mezclados.** «Resumir el informe» figura como tipo de lámina, y el selector de láminas dice «Ver por
  tipo de gráfico».
- **Espejos escritos a mano.** Los nombres, las familias y los presets del frontend se mantienen a mano y les faltan 19
  de los 31 tipos.

## Decisión

1. **Dos catálogos.**
   - Un *tipo de lámina* es una composición con ranuras: un gráfico, dos, tres o más, o texto.
   - Un *tipo de gráfico* es lo que va en una ranura.
   - La interfaz usa «Tipo de lámina» y «Tipo de gráfico», sin mezclar las dos palabras y sin rótulos de marketing.
2. **Las variantes son entradas del catálogo de gráficos.**
   - `graficos_tipos.json` declara `variantes`: entradas de catálogo con nombre, familia, ícono y args fijos (por
     ejemplo, `p_dumbbell` con `estilo: "resumen"` se llama «Contraste de públicos»).
   - No se crean graficadores nuevos ni cambia el formato del plan guardado.
   - Toda variante se alcanza desde el selector de gráfico de cualquier ranura.
3. **El resumen recomienda.** «Resumir el informe» deja de ser un tipo de lámina. Es una recomendación que apunta a
   entradas del catálogo de gráficos (graficador + variante). Un test falla si una recomendación apunta a una entrada
   que no existe.
4. **Una sola fuente.**
   - Desde el JSON se generan:
     - los nombres legibles (`graficadorDisplay`);
     - las familias del selector;
     - los presets;
     - las ranuras por tipo de lámina.
   - Cada espejo tiene su test de contrato.
5. **Pendiente en una segunda etapa:** las láminas de 0 ranuras (hallazgos, resumen de diferencias, cierre) y las
   tarjetas de diferencias (`meta`) siguen como hoy. Se decidirá si pasan a gráficos declarados cuando la primera etapa
   esté verificada.

## Consecuencias

- El catálogo visual del artefacto y la app muestran el mismo mapa: tipos de lámina y tipos de gráfico, con sus
  variantes.
- Los planes guardados no cambian. Una lámina que ya usa `estilo: "resumen"` se reconoce como su variante.

## Nota de implementación (etapa 1, backend)

- Las variantes viven en `api/R/graficos_variantes.R` (`.graficos_variantes()`): `p_dumbbell:contraste` («Contraste de
  públicos»), `p_dumbbell:aperturas` («Aperturas por grupo») y `p_barras_divergentes:escala_sin_informacion` («Escala
  con columna de Sin información»). Cada una trae `id`, `graficador`, `nombre`, `familia`, `icono`, `descripcion`,
  `args_fijos` (un `null` significa que el argumento va nulo) y `args_quitar` (los argumentos que se borran al aplicarla).
- `graficos_tipos.json` agrega `variantes`, `familias_editor`, `titulo_humano` de cada graficador y de cada lámina, y
  `ranuras` (`{name, role, label}`) de cada lámina. `/api/graficos/registry` suma `variantes` sin quitar campos.
- `.graficos_variante_de(graficador, args)` reconoce la variante de una lámina guardada; sólo lee, no migra el plan.

## Enmienda (2026-11-09): las variantes se presentan como versiones del tipo

Gonzalo, sobre el catálogo: «Estas debería ser dos versiones de un mismo tipo de gráfico: y debería llamarse multiapilada
divergente» (Barras divergentes y Escala con columna de Sin información).

1. Una variante no es una tarjeta aparte en el catálogo ni en el selector de gráfico: es una **versión** dentro de la
   tarjeta de su tipo. La tarjeta muestra el tipo y sus versiones (la base y cada variante) con un control segmentado; al
   elegir una versión se aplican sus `args_fijos`. Vale para todos los tipos con variantes (divergentes y dumbbell).
2. `p_barras_divergentes` se llama **«Multiapilada divergente»**. Sus versiones: «Clásica» y «Con columna de Sin
   información».
3. El plan guardado no cambia (`graficador` + `args`); el reconocimiento de la variante (`.graficos_variante_de`) sigue
   igual y ahora nombra la versión.
