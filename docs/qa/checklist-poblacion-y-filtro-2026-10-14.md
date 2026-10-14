# Checklist · láminas de población nativas y mejoras de «Pregunta filtro y subpregunta»

Tipo: Checklist de implementación
Estado: Vigente
Fecha: 2026-10-14
Autoridad: Gonzalo, 2026-10-14. Sólo Gonzalo da por terminado un ítem

Dos pedidos de Gonzalo del mismo día:

1. Sobre «Población con cifras» del catálogo: «esto se ve fatal, no se ve nada parecido al recetario».
2. Sobre «Pregunta filtro y subpregunta»: «puede ser una pregunta como barras agrupadas pero también puede ser un pie o
   una dona, evaluemos posibilidades y mejoras». Aprobó el orden propuesto: «De acuerdo» (F1–F5).

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| P1 | Torta y dona dentro de un panel de las láminas de población (y de las mixtas): hoy el panel no las dibuja y la lámina entera cae a la plantilla anterior | `lamina_panel_circular.R`, `.lam_panel_geo` | hecho, por verificar: disco a la izquierda y cada porción con su cifra y rótulo (dos líneas si el panel es angosto); la dona con su cifra al centro |
| P2 | La ranura de cifra acepta el indicador numérico (una media o mediana sin grupos) como cifra destacada: hoy sólo acepta `p_cifra` | `.lam_numerico_como_cifra` | hecho, por verificar: la cifra dice qué mide (el título o la pregunta) y «Mediana de 172 respuestas» |
| P3 | Corona: el panel inferior (barras de 6 ciclos en 12,5 × 2,5 in) no cabe | `.lam_panel_geo` | hecho, por verificar: en un panel ancho y bajo, las categorías que no caben en filas van en columnas (lámina 68) |
| P4 | Población en tira, de cinco y de seis gráficos: no tienen composición nativa (siempre plantilla anterior: título en mayúsculas, sin enunciados, ggplot) | `lamina_poblacion_geo.R`, `reporte_slides_composicion.R` | hecho, por verificar: geometría del estándar; la tira con el enunciado a la izquierda; un panel que no cabe va con su gráfico dentro de su panel (ya no tumba la lámina) |
| P5 | El catálogo usa en población lo que el recetario dibuja (dicotomía, barras, cifras) además de torta y dona | `catalogo_recetario_plan.R` | hecho, por verificar: tira de dicotómicas; corona y cifras con dicotomía, barras y cifras con unidad; torta y dona en las de cinco y seis |
| D1 | Resaltar las respuestas que se elijan en barras (agrupadas y categóricas), no sólo la mayor; por defecto un solo color. Gonzalo: «Mantener un solo color por defecto y tener la posibilidad de resaltar alguna opción si se desea» | `DestacarRespuestas.tsx`, `preparar_categorica`, `lamina_categorica.R` | hecho, por verificar: «Destacar» en barras agrupadas y categóricas (`overrides.resaltar_opciones`, por rótulo); las elegidas en azul con su rótulo en negrita, las demás tenues; sin elegir, un solo color. Manda sobre «Resaltar la barra más alta». Pruebas en `test-lamina-poblacion-nativa.R`, también por la ruta real |
| D2 | Escala de las barras de población | — | decidido: se mantiene 0–100 % (Gonzalo, 2026-10-14) |
| D3 | Cada gráfico decide si muestra sus respuestas bajo su enunciado («172 respuestas»); en multiapiladas por actor, el interruptor bajo el actor. Gonzalo: «que cada gráfico pueda permitir si incluye o no su base… en el caso de multilista también con un switcher» | `lamina_mixtas.R`, `PublicoGrafico.tsx` | hecho, por verificar: «Respuestas bajo el enunciado» (Automático, Mostrar, Ocultar) en láminas de varios gráficos, `overrides.mostrar_publico`; Automático = G9. En multiapiladas, «Respuestas por público» ya existía y se verificó en la multilista del catálogo: encendido escribe «172 respuestas» bajo cada actor, apagado no |
| D4 | El ícono del público junto al antetítulo, como el recetario; hoy la lámina nativa descarta la ranura `icon` | `lamina_mixtas.R`, `.lam_titulo` | hecho, por verificar: el ícono de la ranura `icon` en un cuadrado de 0.3 in en (0.495, 0.165) y el antetítulo a su derecha |
| D5 | = P5 (el catálogo usa en población lo que dibuja el recetario) | | ver P5 |
| D6 | La cifra que sale de un indicador numérico lleva su unidad («22 años») | `.lam_composicion_mixta` | hecho, por verificar: «21.0 años / Edad mediana» cuando la pregunta trae la unidad entre paréntesis |
| F1 | Filtro como torta o dona, con conector desde el sector que habilita hasta el título de la subpregunta | `lamina_filtro_sub.R`, `graficos_filtro_subpregunta.R` | pendiente |
| F2 | Subpregunta de varias preguntas (multiapilada), todas con la base de quienes la habilitan | idem | pendiente |
| F3 | Proponer la pregunta filtro y lo que habilita desde el `relevant` del XLSForm | `FiltroSubpregunta.tsx` + endpoint | pendiente |
| F4 | Aviso cuando el salto no cuadra: respuestas de la subpregunta en personas que no la habilitan | `graficos_filtro_subpregunta.R` | pendiente |
| F5 | Pulido: frase de la base editable, pie con las dos bases, Top Two Box en la escala con sus respuestas, glifo según la forma | varios | pendiente |

## Lo medido (2026-10-14)

Exportado desde la app el catálogo (`/api/graficos/ppt` con las láminas de población) y trazado
`.lam_compositor_aplica_mixta` con los datos del catálogo:

| Lámina | Panel | Qué trae | ¿Cabe? |
|---|---|---|---|
| Corona | superior izq. / der. | torta / dona (espec `pie`) | no |
| Corona | inferior | categórica de 6 ciclos, 12,52 × 2,52 in | no |
| Con cifras | 1 y 4 | torta / dona | no |
| Con cifras | 2 | categórica de ciclo, 4,31 × 5,07 in | sí |
| Con cifras | 3 y 5 (cifras) | indicador numérico (`p_numerico`, media) | no: no es `pulso_cifra` |

Un solo panel que no cabe manda la lámina entera a la plantilla anterior.

Comparación con el recetario (p159, p161, p165, p167, p170), 2026-10-14: realce de la mayor (D1), barras escaladas a la
mayor (D2), público bajo cada enunciado (D3), ícono junto al antetítulo (D4), dicotomía en vez de torta (D5), cifra con
unidad (D6). D1–D3 chocaban con decisiones anteriores y Gonzalo las resolvió. El recetario (recetario_m2c.R) dibuja la
población con dicotomía partida, barras y cifras; nunca con torta o dona.
