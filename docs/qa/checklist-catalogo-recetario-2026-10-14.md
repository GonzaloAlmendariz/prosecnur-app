# Checklist · proyecto catálogo del recetario (.pulso de prueba)

Pedido de Gonzalo (2026-10-14): «crear un .pulso que contemple absolutamente todos los gráficos posibles según el
recetario para poder poner a prueba cómo se ven todos a nivel de la maqueta, UI y personalización disponible».
Alimenta `checklist-configuraciones-graficos-2026-10-13.md` (inventario) y el ítem 9 de `checklist-maqueta-ficha-2026-10-13.md`.
Sólo Gonzalo da por terminado un ítem.

## Por qué sintético y no `acrconta_mazo`

`acrconta_mazo` (referencia anonimizada, 4 bases) no trae lo que el recetario necesita: **cero** preguntas de opción
múltiple (p72–p73, p191, radar por selección), texto abierto sólo en los «Otro, especifique» (nube p101–p104), una
sola numérica por base y ninguna dimensión calculada. El catálogo del motor (`docs/qa/motor-ppt-2026-10-06/herramientas/
catalogo_motor.R`) lo suplía en memoria y la app no lo ve. Un estudio generado por script es reproducible bit a bit,
no tiene datos de cliente y cubre cada tipo de variable a propósito.

## Ítems

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| K1 | Instrumento y datos sintéticos de tres públicos (docentes ~52, estudiantes ~172, egresados ~178, como el recetario): escalas de acuerdo con SIN INF, utilidad, satisfacción; categóricas (ciclo, sexo, grado); dicotómicas; opción múltiple (mejoras, canales); numéricas (edad, años, ingreso); texto abierto con frases reales de encuesta; competencias comunes a los tres públicos; semilla fija | `api/R/catalogo_recetario_datos.R` (nuevo) | hecho, por verificar por Gonzalo: 5 bases (52 docentes, 172 estudiantes, 178 egresados y los procesos 2018 y 2021); acreditación con la misma escala, con escalas de 5 y 4 puntos (servicios) y con otra caja en las etiquetas y otros nombres de variable (egresados `p40_*`) |
| K2 | Estudio con las tres bases y sus equivalencias por la ruta de la app (carga, `estudio_add_base`), dimensiones calculadas por Analítica | `api/R/catalogo_recetario.R` (nuevo) | hecho, por verificar: por la ruta de la carga; las dimensiones viajan en la base de estudiantes |
| K3 | Plan: una lámina por variante del recetario (cap. 2, p68–p112) agrupadas por sus capítulos 2.1–2.8 con separadores, y las configuraciones que cambian lo dibujado (multiapiladas en sus cinco lecturas, Top/Bottom Two Box, ancho de temas, respuestas por público, significancia, 0–100 % con marcas, promedio, formato de cifra, top N, saldo, brecha…) | `catalogo_recetario.R` | hecho, por verificar: 119 láminas por capítulos del recetario |
| K4 | Láminas de estructura en todas sus variantes: portada ×3, índice ×4 composiciones con y sin subcapítulos, separador ×7, objetivo ×3, ficha técnica, top two box, redondeo, cierre ×5, texto; y las 22 composiciones de gráficos | `catalogo_recetario.R` | hecho, por verificar: las 33 láminas del registro, con portada ×3, índice ×4, separador ×7, objetivo ×3 y cierre ×5 |
| K5 | Lo que el motor no produce (p69 torta con leyenda de cifras, p85 conteos por año, p98 peso en la satisfacción, p103–p104 frases y temas, mapas territoriales) entra como lámina de texto que dice qué falta, no se omite | `catalogo_recetario.R` | hecho, por verificar: 8 láminas de texto dicen qué falta |
| K6 | Script y Makefile: `make catalogo-recetario-build` escribe `api/inst/reference_projects/recetario_catalogo/` con su manifiesto | `api/scripts/`, `Makefile` | hecho: `make catalogo-recetario-build` escribe `api/inst/recetario_catalogo/recetario_catalogo.pulso` (175 KB). No va en `reference_projects/`: no tiene origen de cliente ni pasa por el anonimizador |
| K7 | Verificación: el plan valida, el PPT y el Word exportan, y la lista de avisos por lámina queda en el manifiesto (ningún «Sin datos» sin explicar) | test `test-catalogo-recetario.R` | parcial: `test-catalogo-recetario.R` exige que el plan valide y cubra los 26 gráficos vigentes y los 33 tipos de lámina. El PPT sale con 124 láminas; 6 salen «Sin datos» (ver hallazgos) |
| K8 | Recorrido en la app con `/ver-ui`: cada lámina en el editor (maqueta, pestaña Gráfico, ajustes disponibles); hallazgos al inventario de configuraciones | QA en vivo | pendiente |

## Hallazgos del catálogo (2026-10-14)

| # | Hallazgo | Estado |
|---|---|---|
| H1 | «Una pregunta por grupos» y «Barras apiladas por grupos» salían «Sin datos» en todo estudio de varias bases: la rama `modo = "cruce"` resolvía `var` sin su base (`reporte_plan_ppt.R`, `.tab_freq`) | arreglado; `test-plan-multibase-cruce.R` rojo antes y verde después. La prueba vieja usaba `expect_no_error`, que no ve el «Sin datos» porque el motor atrapa el error |
| H2 | Las cuatro láminas de dimensiones (p95–p99) salen «Sin datos»: el render exige la trazabilidad de `reporte_dimensiones()` (`recodificacion_items_meta`) y una base cargada desde archivo no la trae; Analítica guarda sus dimensiones aparte (`s$rp_dim`) | por confirmar en la app (K8) antes de arreglar |
| H3 | Públicos por tema con escalas distintas (docentes en 5 puntos, estudiantes en 4) no se puede graficar: el editor lo marca como error y bloquea Exportar; el motor, «Sin datos» | **bloqueado**: decisión de Gonzalo sobre cómo debe dibujarse |
| H4 | El ranking con puntos (p72) no acepta opción múltiple, que es justo como lo dibuja el recetario | pendiente (inventario de configuraciones) |
| H5 | La misma escala con otra caja en las etiquetas y otros nombres de variable sí se grafica junta | verificado |
