# ADR 0065 — Una barra mide lo mismo en toda la presentación

Fecha: 2026-08-07
Estado: Aceptado
Ámbito: motor de gráficos (barras apiladas y multiapiladas)
Relacionado: ADR 0063 (el mazo se deriva de la declaración), ADR 0064 (el
enunciado vive en la diapositiva)

## Contexto

El canvas de barras se arma con un alto **intrínseco**: número de filas por el
alto de fila. Luego se coloca en el placeholder de la lámina conservando su
proporción. Medido con `debug_ph_bordes = TRUE` sobre el mazo de equivalencias
del estudio de Acreditación Contabilidad:

```
hueco físico:  6.00 in de alto × 12.5 de ancho
canvas armado: 3.56 in  →  el 41 % de la lámina quedaba en blanco
   cabecera 0.00 · panel 2.39 · leyenda 0.75 · reserva de pie 0.85
```

La reacción inmediata es estirar el canvas hasta llenar el hueco. Es la decisión
equivocada, y por eso este ADR existe.

## Decisión

**El alto de fila crece para aprovechar el hueco, pero con un tope. Una lámina
de tres barras y una de seis tienen barras de grosor parecido, aunque la de tres
no llene la diapositiva.**

Concretamente:

1. El sobrante entre el alto intrínseco y el hueco físico se reparte a las
   filas, no a los márgenes.
2. El reparto se detiene en `.BARRAS_ALTO_FILA_MAX_IN`. Lo que sobre después del
   tope se queda como aire al pie.
3. Sólo se **crece**. Si el hueco es más chico que el contenido, el canvas ya se
   encoge al colocarse; forzarlo aquí apretaría las barras dos veces.

## Por qué el tope, y no llenar

Sin tope, el alto de fila sería una función del número de filas: una lámina de
dos barras las dibujaría tres veces más gruesas que una de seis. El lector que
pasa las láminas percibe ese cambio como **énfasis** —una barra más gruesa se
lee como más importante— cuando lo único que cambió es cuántos temas trae la
diapositiva. En un mazo de 44 láminas derivadas de una matriz, donde el número
de temas por diapositiva lo decide el instrumento y no el analista, eso es ruido
puro.

Llenar la lámina es una propiedad de UNA lámina. La comparabilidad del grosor es
una propiedad del MAZO, y el mazo es lo que se presenta.

El aire que queda al pie no es un defecto: es el precio de que una barra mida lo
mismo en la lámina 3 y en la lámina 30.

## Consecuencias

- Una lámina de dos o tres barras no llena su hueco. Es deliberado.
- El tope es un número editorial, no un cálculo: se fijó mirando el mazo
  completo. Subirlo es una decisión de dirección de arte con el mismo peso que
  cambiar una tipografía — se toca en su constante, con nombre, no repartido en
  llamadas.
- La banda de leyenda se dimensiona aparte, por las filas que ocupa. Cobrar un
  fijo de 0.75 in para dibujar una línea de texto era el otro tercio del espacio
  perdido, y ese sí era desperdicio sin contrapartida.

## Cumplimiento

`api/R/graficador_helpers_leyenda.R` implementa el reparto y el tope.
`api/tests/testthat/test-graficador-alto-y-leyenda.R` fija las tres reglas: que
el sobrante engorde las filas, que el tope las acote, y que un hueco chico no
las apriete dos veces.
