# Checklist: gráficos del resumen ejecutivo como tipos nativos (2026-11-07)

Tipo: Checklist de trabajo
Estado: Vigente
Fecha: 2026-11-07
Autoridad: Encargo de Gonzalo del 2026-11-07 — integrar al motor los cinco gráficos del resumen ejecutivo de Arte y Diseño FG 2026; ADR 0114

Pedido: integrar al motor los cinco gráficos hechos a mano para el resumen ejecutivo de Formación General de Arte y
Diseño 2026 (ADR 0114). Sólo Gonzalo da el checklist por terminado.

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Comparación de dos públicos (dumbbell): formas por público, cifra junto al punto, bandas, orden por diferencia, tabla lateral Diferencia y Base `n (cobertura %)` | `p_dumbbell(estilo = "resumen")` · `graficos_espec_contraste.R` · `lamina_contraste.R` | Hecho, render revisado |
| 2 | Aperturas internas: sub-fila por grupo con 3 o más; Base sólo `n` si el padrón del subgrupo no es confiable | `p_dumbbell(cruce, grupos = 2..4, estilo = "resumen")`; padrón sólo si se declara en `universos` | Hecho, render revisado |
| 3 | Panorama: punto por pregunta y público, mediana, referencia punteada en 60% sin «tramo crítico», tabla Mediana y Bajo 60% (`k de N`) | `p_panorama()` · `graficador_panorama.R` · `lamina_contraste.R` | Hecho, render revisado |
| 4 | Escala divergente con Sin información aparte: paleta Likert, leyenda alineada por lado, cifras oscuras, extremo fuera en negrita y color oscurecido, interior más chica, ceros sin pintar | `p_barras_divergentes(estilo = "resumen", orden)` · `lamina_divergentes_resumen.R` | Hecho, render revisado |
| 5 | Competencias: dumbbell con separador entre grupos de ítems | `separar_tras` (fija el orden declarado), línea punteada | Hecho, render revisado |
| 6 | Gonzalo (en la sesión): «a veces es mejor poner el N en la leyenda con porcentaje o en la nota de la base y ya no ponerle en otra columna» | `base_en` = auto · leyenda · nota · tabla (`graficos_espec_contraste.R`) | Hecho: auto pone la base constante en la leyenda; si cambia por fila, en la tabla |
| 7 | Elegibles desde la UI de Gráficos | registro `graficos_metadata.R` + tarjeta del inspector (`argsDatosGrafico.ts`), blueprint `panorama` | Hecho: estilos en la tarjeta, `p_panorama` en Comparar con su dibujo, ícono y glifo; aperturas de hasta 4 grupos. Sin QA visual de la tarjeta todavía |
| 8 | Gate por área R y front, verificador | `make gate-area`, `make gate-front AREA=graficos` | R: 62 suites verdes tras actualizar contratos (31 → 32 graficadores); front: 244 archivos / 2196 tests verdes. Verificador pendiente |
| 9 | Gonzalo: «la base podría ir en la esquina inferior izquierda, como ya iba antes; sólo columnas para diferencia» | `base_en` = auto → nota; la base por grupo reemplaza a la automática (`lamina_compositor.R`) | Hecho y render revisado; con base variable la nota da su rango |
| 10 | Probar en la app si se pueden armar y qué tan intuitivo es | acrconta en Procesamiento › Gráficos | Hecho: el panorama no se puede armar en la práctica (preguntas una por una, una base) y el estilo de la brecha está escondido; ver la propuesta |
| 11 | Relacionarlas con las láminas de resumen que ya existen y pensar gráficos de síntesis y tendencias más intuitivos | [propuesta-laminas-de-sintesis-2026-11-07.md](propuesta-laminas-de-sintesis-2026-11-07.md) | Bloqueado: tres decisiones de Gonzalo en la propuesta |
| 12 | Gonzalo: «propón una vista moderna de UI para seleccionar tipos de gráficos… centrada en el producto y en la accesibilidad del analista… en un artefacto para su aprobación» | Maqueta en artefacto (enlace en la propuesta de síntesis) | Esperando aprobación de Gonzalo |

Aprendido:
- La diferencia con dos grupos sigue la regla del motor (primero menos segundo, entre cifras rotuladas). Para leer
  «estudiantes menos docentes» se declara Estudiantes primero; el sentido va en el pie.
- La mediana del panorama es la mediana estadística (66,5 sube a 67); el script a mano tomaba el elemento central
  superior y por eso decía 76% en Administrativos donde el motor dice 73%.
- Docentes y Administrativos comparten azul en `actores`: el contraste le da al segundo el primer color de `grupos`
  que se distinga (naranja), como en el resumen.

Iteración visual (Gonzalo: «No se ve igual de bien que en el pdf»): marcas de 0,21" a 0,15", segmentos y tallos más
finos, cifras pegadas al punto y en 10 pt, panel blanco con bandas suaves sólo sobre el área de datos, guías más claras
y leyenda más liviana. Lo que sigue distinto del PDF es la plantilla Pulso del motor (fondo gris, título coral en sans),
no el gráfico.
