# Plan — análisis del discurso del comentario final (CCSS Perfil 2026, frente L11)

Pedido de Gonzalo (vía la sesión del mazo): «análisis del discurso del comentario final, organizado por las secciones del formulario».
Variable `coment`. Diseño hecho en solo lectura sobre una copia del proyecto; cifras medidas el 2026-10-24.

## Cifras que deciden el alcance

- Escribieron algo 93 de 397. 27 son no respuestas claras («-», «.», «no», «ninguno», «nada»…). **Quedan 62–66 con contenido**
  (mediana 104 caracteres, unas 8 palabras de contenido).
- Con filtro, raíz y conteo por persona: 496 raíces; solo 31 las usan 3 personas o más y 17, 5 o más.
- Bigramas: ninguno llega a 3 personas. Trigramas: «biblioteca de sociales» y «espacios de estudio», con 3 cada uno.
- Co-ocurrencia: 4 pares con 4 personas o más, que son frases o temas, no relaciones.
- Por nivel: 6=25, 7=15, 8=14, 9=12. Por carrera: 35/16/11/4.

**Alcanza:** nube con raíces que usan 3 personas o más, temas por módulo y citas.
**No alcanza:** una lámina propia de n-gramas, una red de co-ocurrencia ni el cruce por carrera.

## Diseño

| Pedido | Qué se hace | Dónde |
|---|---|---|
| TXT-1 nube limpia | Filtra no respuestas, quita palabras vacías funcionales y de opinión, agrupa flexiones (raíz), une frases que usan 3 personas o más y **cuenta personas, no apariciones**. Encabezado: «62 comentarios con contenido (de 93 que escribieron algo)» | `texto_abierto_normalizar.R` (nuevo), `graficador_nube_palabras.R`, `lamina_marco.R` |
| TXT-2 n-gramas | Las frases entran al ranking de la nube. `p_ngramas` en lollipop solo si hay al menos 5 frases que usen 3 personas o más; si no, la lámina lo dice | `graficador_ngramas.R` (nuevo) |
| TXT-3 temas por módulo | Codificación de `coment` como texto multicode, con códigos por módulo A–E + «otro». El módulo sugerido sale del vocabulario de cada sección (`.section_map`) y queda como **propuesta** que el analista confirma. Se grafica con las barras de selección múltiple que ya existen (% de personas con contenido; suma más de 100 %) | `codificacion_sugerir_seccion.R` (nuevo), endpoint `/api/codificacion/sugerencias-seccion` |
| TXT-4 citas | `p_citas`: de 3 a 5 por tema. Selección determinista: largo de 40 a 280 caracteres, más raíces frecuentes del tema, menos de 60 % de solape con las ya elegidas, una por persona, semilla fija. Anonimato: se borran correo, teléfono y URL y no hay atribución. Cortes con «[…]». **Aprobación obligatoria del analista** | `texto_citas.R`, `lamina_citas.R` (nuevos) |
| TXT-5 co-ocurrencia | Fuera por ahora: con 62 comentarios es ruido. Solo con 150 o más y pares de 5 personas o más | — |

## Decisiones tomadas en el loop (default conservador; Gonzalo pidió no preguntar)

1. Sinónimos: no se unifican (profesores ≠ docentes). Solo flexiones; la lista `equivalencias` queda como opción.
2. Sin ponderar, con nota.
3. El filtro de no respuestas es **opcional y apagado por defecto** en las nubes ya hechas, porque cambiaría las cifras de la lámina 101. Se activa explícitamente en el plan de CCSS.
4. Temas: solo módulo A–E + «otro».
5. Cruce: por nivel agrupado (6–7 contra 8–9) y en números absolutos; ninguno por carrera.
6. Citas: sin atribución, 280 caracteres como máximo y aprobación obligatoria.
7. TXT-2 como lámina aparte y TXT-5: fuera del mazo CCSS.

## Oleadas

- **O1, backend:** `texto_abierto_*.R`, `graficador_nube_palabras.R`, `lamina_marco.R` (rótulos del ranking), `reporte_plan_ppt.R` solo sustituyendo líneas en ~2499 y ~3950–3993, tests `test-texto-abierto-*.R` y `test-nube-*.R`.
- **O1b, backend, en paralelo:** `codificacion_sugerir_seccion.R`, un bloque al final de `router_codificacion.R`, `test-codificacion-sugerir-seccion.R`.
- **O2, backend, después de O1:** citas y n-gramas, más sus entradas en `graficos_metadata.R`, `reporte_plan_slides.R` y `catalogo_recetario_plan.R`.
- **O3, frontend, después de O2:** argumentos y tarjeta de aprobación de citas en Gráficos; marca de módulo sugerido en Codificación.
