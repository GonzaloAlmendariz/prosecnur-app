# Estándar de PPT de acreditación — de 51 comentarios a 17 reglas

Tipo: Registro QA fechado
Estado: Vigente
Fecha: 2026-08-14
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


**Abierto**: 2026-08-14 · **Origen**: los 57 comentarios de
`Informe Conta 12-08_REVISADO HASTA SLIDE 32.pptx` (51 de Gabriela, 4 de Renzo,
1 de Alice) contrastados contra el entregable final `Informe Contabilidad
14-08.pptx` y contra el mazo que genera el motor hoy.

## Para qué existe este documento

Los 51 comentarios de Gabriela **no son 51 problemas**. Son 17, repetidos lámina
tras lámina porque el mazo no tiene un default que los resuelva de una vez. Ocho
comentarios distintos piden «letra más grande»; seis piden «barras más gruesas»;
siete piden «menos apretado». Responderlos uno por uno es garantizar que vuelvan
en el próximo estudio.

La regla de lectura, entonces: **un comentario repetido no es una corrección, es
un default que falta**.

Cada regla de abajo dice qué exige, de qué comentarios sale, y **con qué mando
del motor se cumple**. Las que no tienen mando están marcadas: esas sí son
desarrollo.

## A. Tipografía

| # | Regla | Comentarios | Mando | Valor |
|---|---|---|---|---|
| A1 | El tamaño de letra **no se recalcula por lámina**: se declara y se respeta, cediendo espacio en vez de encoger | lám 9, 20 («el Sí/No en 10.5 arriba y 14 aquí») | `preservar_tamanos_texto` | `TRUE` |
| A2 | Enunciados de pregunta a 13 pt | lám 17, 18 | preset de escala | `13` |
| A3 | Cifras de porcentaje a 14 pt | lám 17 («en escultura o derecho están en 14») | preset de escala | `14` |
| A4 | Nota de base y de redondeo en negrita, 10–11 pt | lám 9 | pie de lámina | `11`, negrita |
| A5 | Portada: título en azul Pulso; «Informe consolidado» sin negrita a 18 pt | lám 1 | plantilla de portada | — |

**A1 es la regla madre de todo el bloque.** El motor ya la tiene y su propia
ayuda describe el síntoma exacto que reporta Gabriela:

> Respeta los tamaños declarados aunque el texto no quepa: cede el espacio en vez
> de encoger la letra. Sin esto, cada bloque se achica por su cuenta y dos
> bloques de la misma lámina salen con tipografías distintas.

Medido: el entregable final usa 14 pt (2513 veces), 12 pt (776) y 13 pt (470)
—redondos—. Nuestro mazo usa **15.93 pt (895) y 15.99 pt (505)**, fraccionarios,
porque autoescala. Mientras el tamaño se calcule por lámina, «uniformizar» es
imposible por definición: A2–A4 no se pueden cumplir sin A1.

## B. Geometría de las barras

| # | Regla | Comentarios | Mando | Valor |
|---|---|---|---|---|
| B1 | Barras más gruesas que el default actual | lám 11, 13, 14, 21, 26, 30 | `grosor_modo` + `grosor_barras` / `grosor_barras_mult` | por calibrar contra un mazo previo |
| B2 | Separación extra entre bloques temáticos | lám 18, 21, 26 («que se note que son tres premisas distintas») | `canvas_gap_grupos` | por calibrar |
| B3 | El gráfico arranca más abajo, despegado del logo | lám 20 | `encabezado_separacion_in` | por calibrar |
| B4 | Cuando el bloque no cabe con letra legible, se parte en dos láminas | lám 22, 28 | — **sin mando** | desarrollo |

B1–B3 son numéricos y **hay que calibrarlos mirando**, no razonando: la propia
Gabriela remite a «estudios anteriores de acredita». Se fijan comparando contra
un mazo aprobado, no eligiendo un número que suene bien.

B4 no tiene mando y es la única de este bloque que es desarrollo real.

## C. Color

| # | Regla | Comentarios | Mando | Valor |
|---|---|---|---|---|
| C1 | El extremo negativo de la escala es **naranja**, nunca rojo | lám 18, 22 («ese rojo no es el que usamos en los acreditas») | rampa del preset | `#F4B183` |
| C2 | La rampa de 4 puntos es la de acreditación | — | `.PRESET_ACRD_RAMPA` | `#F4B183 · #FFD966 · #B0D597 · #8FC36B` |

Medido color por color, **tres de las cuatro posiciones ya coinciden** con el
entregable. La única que falla es la primera: el motor pinta el extremo negativo
con su rojo por defecto `#CA5651` (270 usos) donde el entregable usa el naranja
`#F4B183` (213 usos).

No hay que rehacer la paleta. Hay que cambiar un color.

## D. Estructura del mazo

| # | Regla | Comentarios | Mando | Valor |
|---|---|---|---|---|
| D1 | Sin láminas separadoras numeradas («1. OBJETIVO…») ni por dimensión | lám 3, 5, 8, 16, 19, 31 | plan | quitar del plan |
| D2 | Un único separador: «PRINCIPALES RESULTADOS» | lám 16 | plan | — |
| D3 | El mazo incluye la lámina de **escala de los cuestionarios** | lám 7 | — **sin mando** | desarrollo |
| D4 | El mazo incluye la lámina de **NS/NR** | lám 21 | — **sin mando** | desarrollo |
| D5 | El Top Two Box se explica con ejemplo (35 % + 55 % = 90 %) | lám 7 | lámina estructural | existe, revisar texto |
| D6 | «ÍNDICE» con tilde y alineado con sus viñetas | lám 2 | plantilla | — |

D1 es la que más láminas mueve: explica casi toda la diferencia entre las 67 del
motor y las 63 del entregable.

## E. Contenido y datos

| # | Regla | Comentarios | Mando | Valor |
|---|---|---|---|---|
| E1 | **La columna Top Two Box se dibuja siempre** en escalas de acuerdo | transversal | `top2box_labels` | declarar las categorías por nombre |
| E2 | Si la lámina es de un solo público, el título lo dice | lám 28 | plan | — |
| E3 | El alcance de campo lleva su porcentaje entre paréntesis | lám 6 | plan | — |
| E4 | Cada premisa pertenece al subcriterio correcto | lám 29 | plan | revisión metodológica |
| E5 | Los títulos no llevan erratas | lám 27 | plan | ver abajo |

**E1 es el hallazgo de mayor impacto visible**: el entregable final tiene la
columna Top Two Box en **45 láminas** y nuestro mazo en **1**. El motor lo avisa
al generar, una vez por lámina:

> La columna «top2box» se omite: no hay categorías declaradas. Declaralas por
> nombre en Configuración global > Estilo > Multi-apiladas; el motor ya no las
> deduce del orden de la escala.

Y tiene razón: el preset `multi_apiladas` del proyecto está vacío. El motor dejó
de deducirlas del orden de la escala —correcto, fallaba en escalas invertidas—
pero ningún proyecto se actualizó para declararlas. El mando existe
(`top2box_labels`) y nadie lo llenó.

**E5, con nombre y apellido.** Dos erratas viven en el plan del proyecto, no en
el motor, así que reaparecen en cada regeneración:

| Lámina | Dice | Debe decir |
|---|---|---|
| 12 | CARACTERISTICA INSTITUCIONALES | CARACTERÍSTICAS INSTITUCIONALES |
| 23 y 24 | GESTORES UNIVERSITARIO**,S** DOTACIÓN… | GESTORES UNIVERSITARIO**S,** DOTACIÓN… |

La de la coma es literalmente el comentario de la lámina 27 («aquí, cuidado con
la coma»). El entregable la corrigió a mano; el plan no, y por eso vuelve.

## Cómo se aplica

Nueve de las diecisiete reglas ya tienen mando en el motor y se resuelven
llenando el **preset de acreditación**, no tocando código: A1, B1, B2, B3, C1,
C2, E1, más las dos erratas y los separadores del plan.

Cuatro exigen desarrollo: B4 (partir bloque en dos láminas), D3 y D4 (láminas
metodológicas nuevas) y la calibración fina de A2–A4 si el preset no llega.

El orden importa: **A1 y E1 primero**. A1 porque sin tamaño fijo ninguna regla de
tipografía es verificable, y E1 porque es lo que más se ve.

## Cómo se verifica

El estándar no vale si «se ve bien» es el criterio. Cada regla se comprueba sobre
el .pptx generado, leyendo el XML:

- **A1–A4**: los `sz=` de las láminas son valores redondos y del conjunto
  declarado. Hoy fallan: aparecen 15.93, 15.99, 10.53 y 9.48.
- **C1–C2**: `#CA5651` no aparece en escalas; `#F4B183` sí. Hoy: 270 vs 0.
- **E1**: contar láminas con columna Top Two Box. Hoy: 1; objetivo: todas las de
  escala.
- **D1**: ninguna lámina cuyo texto sea solo un separador numerado.
- **E5**: ninguna aparición de las dos erratas.

Los cinco son contables sobre el archivo, así que el estándar se puede convertir
en un gate del QA visual en vez de en una lista que alguien recuerda.

## Lo aprendido que no hay que reinvestigar

- **La guía de canvas no es un defecto.** El proyecto tenía `debug_ph` activo y
  el mazo salía con 978 bordes magenta opacos en 48 de 67 láminas. Es el medidor
  opcional de encaje, encendido a propósito. Apagarlo los elimina por completo.
  Cualquier comparación de color contra un entregable debe hacerse con la guía
  apagada, o el ruido tapa los hallazgos reales — tapó el de los tamaños.
- **El archivo de comentarios usa los dos esquemas de PowerPoint.** Leyendo solo
  uno se recuperan 30 de 57. `leer_comentarios.py` de la skill lee ambos.
