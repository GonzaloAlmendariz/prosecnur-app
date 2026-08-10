# ADR 0071 — El gráfico nativo cuesta el reposicionamiento de etiquetas

- **Estado**: Aceptada
- **Fecha**: 2026-08-10
- **Ámbito**: Entregables (motor PPT · graficadores)

## Contexto

El motor emite sus gráficos como **formas y DML**: un grupo de rectángulos y
textos dibujado desde un canvas de ggplot/cowplot. El informe consolidado de
acreditación 2021 —la vara de la casa para este entregable— emite en cambio
**charts nativos OOXML** (`c:barChart`) con su libro de Excel embebido.

La pregunta que este ADR cierra: ¿debería el motor emitir charts nativos?

La diferencia no es cosmética. Un chart nativo se abre en PowerPoint como
gráfico: el cliente puede ver los datos, cambiar el tipo, reusarlo. Un grupo de
formas se puede editar pieza a pieza pero no es «un gráfico» para Office.

## Decisión

**No se migra a charts nativos.** El motor sigue emitiendo formas.

La razón no es que no se pueda: se probó y se puede. `mschart` (ya instalado,
no declarado en `DESCRIPTION`) produce XML equivalente al del deck 2021 en
todos los rasgos que se midieron —`barDir=bar`, `grouping=percentStacked`,
`gapWidth=74`, `overlap=100`, ambos ejes con `delete=1`, `dLblPos=ctr`,
`numFmt 0%`, etiquetas de 14 pt en `002060`, la rampa naranja→verde y el
`externalData` con su `.xlsx`—. El paquete resultante pasa las validaciones de
esquema, relaciones y contenido sin una sola advertencia.

Lo que cuesta es el **reposicionamiento automático de etiquetas**.

PowerPoint centra cada etiqueta en su segmento y no la mueve nunca. En una
escala Likert con colas de 1–2 % eso colisiona siempre. En el prototipo, con
tres filas de datos reales, dos quedaron ilegibles: `1%6%` y `0%4%` —
incluyendo un 0 % etiquetado, que el deck de referencia borra a mano.

Ese es exactamente el trabajo que el motor existe para eliminar. En el deck
2021, **62 de 91 etiquetas** tienen `manualLayout` con desplazamientos hechos
a mano, y hay un `<c:delete/>` puntual para el 0 %. Nuestro
`.finalizar_estado_labels_apiladas()` y
`.limitar_una_label_fuera_por_barra_apiladas()` resuelven eso solos, con
conector cuando la etiqueta sale del segmento. Migrar a nativo devolvería ese
trabajo a una persona, multiplicado por cada lámina de cada mazo.

Hay un costo secundario: la columna Top 2 Box (rejilla, semáforo y triángulo)
no es parte del chart. Hoy vive en el mismo canvas que las barras y se alinea
con ellas por construcción. Con chart nativo habría que dibujarla como formas
aparte y sostener a mano su alineación vertical contra un gráfico que
PowerPoint reflowea por su cuenta.

## Consecuencias

- El entregable no trae datos abribles en Excel. Cuando un cliente los pida,
  se resuelve exportando el XLSX del reporte, no cambiando el motor.
- Si en el futuro un estudio exige gráficos editables en PowerPoint, la vía
  está probada y documentada aquí: `mschart` + declarar la dependencia en
  `api/DESCRIPTION`. Sería un modo opcional por lámina, nunca el defecto, y
  asumiendo el repaso manual de etiquetas.
- La ventaja se conserva y conviene decirla en voz alta: nuestras láminas no
  necesitan que nadie mueva una etiqueta después de generarlas.

## Evidencia

Prototipo en `mschart` sobre la escala del deck, XML inspeccionado rasgo a
rasgo contra `2021_Informe_Consolidado Final.pptx`, validación de paquete
`PASSED`, y render comparado. La colisión de etiquetas se reprodujo con los
mismos valores de la lámina 6 del deck (1 / 6 / 49 / 44).
