# ADR 0114: Los gráficos del resumen ejecutivo son nativos del motor

Estado: Propuesto (implementado; espera la ratificación de Gonzalo)

Implementacion: Hecha en la rama `claude/vigilant-poitras-f29198`

Fecha: 2026-11-07

Relación: extiende [ADR 0093](0093-el-motor-dibuja-con-formas-nativas.md) (formas nativas, especificación pura por familia) y respeta su punto 2 (la diferencia se resta entre cifras rotuladas).

## Contexto

Para la reunión de revisión de informes del estudio de acreditación de Formación General de Arte y Diseño (noviembre de 2026) se armó un resumen ejecutivo con cinco gráficos hechos a mano fuera de la app (matplotlib y pptxgenjs). Al cliente le gustaron y Gonzalo pidió que el motor los produzca de forma nativa en vez de rehacerlos en cada estudio. Las decisiones de diseño ya las había validado él en varias iteraciones:

- la escala usa la paleta Likert del estándar, con «Sin información» en una columna aparte;
- no se rotula ningún «tramo crítico»;
- la base va como `n (cobertura %)` por público;
- la diferencia y la base van en una tabla fuera del gráfico, con encabezados (después afinado: la base constante va en la leyenda o en la nota, ver 2);
- las formas de los puntos distinguen públicos aunque se imprima en blanco y negro;
- las cifras de segmentos chicos van fuera de la barra en vez de ocultarse.

## Decisión

1. **Dos estilos, no tipos duplicados.** El contraste de públicos, las aperturas internas y las competencias son el mismo dumbbell con otra composición: `p_dumbbell(estilo = "resumen")`. La escala con «Sin información» aparte es la barra divergente con otra composición: `p_barras_divergentes(estilo = "resumen", orden = …)`. El estilo por defecto sigue siendo `recetario` (láminas 85, 86 y 71), así que ningún plan existente cambia. El panorama sí es un tipo nuevo, `p_panorama()`, porque afirma otra cosa (la distribución de todas las preguntas de cada público).
2. **Especificaciones nuevas.** `contraste/1` (`graficos_espec_contraste.R`) y `panorama/1` (`graficador_panorama.R`) se calculan una vez y ningún renderer las recalcula; la divergente agrega `estilo` y el orden por «Sin información» a `divergentes/1`.
   - Con dos grupos la diferencia es el primero menos el segundo, entre cifras rotuladas; con tres o más es el mayor menos el menor, sin signo. Quién menos quién va en el pie.
   - La base de cada celda son los casos sin ponderar de esa pregunta en ese grupo. Con padrón declarado (`universos`) se escribe `115 (93%)`; sin padrón, o con uno que no lo cubre, sólo `115`. El padrón no se infiere: el de un subgrupo suele no ser confiable, y entonces no se declara.
   - **Dónde va la base** (`base_en`). Gonzalo, 2026-11-07, en dos pasos: «a veces es mejor poner el N en la leyenda con porcentaje o en la nota de la base y ya no ponerle en otra columna» y «la base podría ir en la esquina inferior izquierda, como ya iba antes; ya no es necesario hacer columnas adicionales para bases, simplemente para diferencia». Por defecto la base de cada grupo va en la nota de la base, abajo a la izquierda («Base: Docentes 115 (93%); Estudiantes 279 (85%)»), reemplaza a la base automática de la encuesta entera y la tabla lleva sólo la diferencia; si cambia de pregunta a pregunta, la nota da su rango («107 a 115»). La leyenda (`leyenda`, sólo con base constante) y las columnas (`tabla`) quedan como opción explícita.
   - Los separadores (`separar_tras`) cuentan filas en el orden declarado y lo fijan.
   - El panorama compara la mediana y el conteo «Bajo 60%» sobre las cifras que se leen; el desplazamiento vertical de los puntos es determinista (secuencia áurea sobre el rango), así que la misma base da la misma lámina.
3. **Formas y colores.** Círculo, cuadrado, triángulo y rombo, en ese orden, con borde blanco. Un público toma su color de la paleta `actores` por su nombre; si dos públicos comparten tono (Docentes y Administrativos), o los grupos no son públicos, se usa la paleta nueva `grupos` del estándar (`estandar_pulso.json`).
4. **Escala del resumen.** Desacuerdo a la izquierda del centro (el nivel moderado pegado al centro), acuerdo a la derecha, «Sin información» en una columna gris aparte. Leyenda en orden lógico y alineada con cada lado. Cifras en texto oscuro; si no caben en el segmento de un extremo, van fuera de la barra en negrita con el color del segmento oscurecido; si no caben en uno interior, adentro con letra más chica. Un segmento en cero no se pinta ni se rotula. Sin totales por lado.
5. **Respaldo.** Lo que no cabe en la lámina nativa (más de 14 filas en pares, más de 24 sub-filas, más de cinco públicos) sale por el dibujo ggplot de la misma especificación, como cualquier tipo del ADR 0093.

## Consecuencias

- `p_dumbbell` gana `estilo`, `universos`, `separar_tras` y `base_en`; con `estilo = "resumen"` y un cruce admite hasta cuatro grupos. `p_barras_divergentes` gana `estilo` y `orden`. Ambos sólo escriben en los overrides lo que el slot declara (O7c).
- `.radar_mb_datos()` devuelve además `n_casos` (casos sin ponderar por celda), que el radar ignora.
- La UI de Gráficos ofrece los estilos en la tarjeta del tipo y el panorama en la familia «Comparar».
- `lamina_piezas.R`: `.lam_linea()` admite trazo punteado y `.lam_caja()` el rombo.

## Cumplimiento

- `api/tests/testthat/test-graficos-resumen-ejecutivo.R`: especificaciones `contraste/1` y `panorama/1`, láminas nativas de los cinco gráficos, `base_en`, separador, escala del resumen y la ruta real de `reporte_ppt_plan`.
- Los contratos del registro (`test-graficos-metadata.R`, `test-graficos-tipos-catalogo.R`) y del front (`argsDatosGrafico.c40.test.ts`, `iconosTipo.contract.test.ts`) enumeran el graficador nuevo y los args.
- El estilo `recetario` no cambia: la lámina 71 y las pesas salen idénticas byte a byte antes y después (verificador, 2026-11-07).

## Notas

- Checklist del encargo: [checklist-graficos-resumen-ejecutivo-2026-11-07](../qa/checklist-graficos-resumen-ejecutivo-2026-11-07.md).
- Pendiente: QA visual de la tarjeta del inspector y del selector con `/ver-ui`.
