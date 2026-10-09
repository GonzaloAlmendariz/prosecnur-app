# ADR 0082 — Rerandomizar no es optimizar entre candidatas

- **Estado**: **Aceptado** por Gonzalo el 2026-08-27, textual: «acepta el ADR
  0082». Pedido por él ese mismo día: «Necesita su ADR, necesita su propia
  pestaña al final de las pestañas actuales de selección porque es la última
  decisión».
- **Implementación**: No iniciada.
- **Ámbito**: Cálculo de muestra · motor de selección de aulas
  (`calc_muestra_aulas.R`) · sección Selección
- **Fecha**: 2026-08-27
- **Relación**: consecuencia del aviso que el motor ya emite para
  `pool_controlado` («Si se optimiza entre candidatas, las probabilidades
  finales no son cube puro») y hermano de
  [ADR 0077](0077-avisa-fuerte-lo-que-sigue-produciendo-dano.md): acá no basta
  con avisar, hay que separar dos cosas que se parecen.

## Contexto

### El problema, con la cifra que lo produjo

El diseño de HSVG 2026 tiene que cerrar **30 celdas** —15 facultades × 2 sexos—
con las cuotas de cada una. Un sorteo de cubo no las cierra siempre: de **50
sorteos medidos, sólo 25 las cerraron todas**. La mediana de cobertura mínima
fue **0,998**, es decir justo por debajo de alcanzar la celda más floja. La
muestra que se usó salió de la semilla **202**, con cobertura mínima **1,079**.

O sea: la muestra final **no es el primer sorteo**. Es uno elegido entre
cincuenta. Eso es una decisión metodológica de pleno derecho y hoy no está
declarada en ninguna parte del proyecto: el `.pulso` guarda la semilla ganadora
como si fuera la única que se corrió.

### Las dos cosas que se parecen

El motor ya sabe sortear muchas veces y quedarse con una. `pool_controlado`
(`calc_muestra_aulas.R:2211`) sortea `candidate_pool_size` candidatas —100 por
defecto—, puntúa cada una con
`coverage_weight × únicos − duplicate_penalty × solape + pps_weight × log1p(elegibles)`
y devuelve la mejor. Es tentador llamar a eso rerandomización. **No lo es.**

| | **Optimizar entre candidatas** (`pool_controlado`, hoy) | **Rerandomizar** (esta propuesta) |
|---|---|---|
| Regla | argmax de un score continuo sobre N sorteos | aceptar / rechazar contra un criterio **fijado antes de sortear** |
| Qué devuelve | la mejor de N | la primera que pasa (o la última si se agota el presupuesto, declarándolo) |
| Probabilidades de inclusión | **no calculables**: dependen del score de todas las candidatas | la **condicional** del diseño dado el criterio: sigue siendo un diseño, con su propia distribución |
| Inferencia | exige estimar `pi_final` por simulación; el motor ya lo advierte | válida si condiciona sobre el mismo criterio |
| Qué se puede declarar | «se optimizó», sin más | el criterio, la **tasa de aceptación** y la semilla aceptada |

En la literatura de muestreo esto último se llama **muestreo rechazativo**; en
la de experimentos, **rerandomización** (Morgan & Rubin, 2012). El punto que
comparten es el que importa acá: **el criterio se fija antes de mirar los
resultados**, y por eso el conjunto de muestras aceptables no depende del
sorteo. Elegir la mejor de cincuenta *después* de verlas no tiene esa
propiedad.

Y hay una consecuencia práctica que el cuadro no dice: **la tasa de aceptación
es información del diseño**. Un 50 % —el medido acá— avisa de que el criterio
está al filo de lo que el marco puede dar. Un 2 % diría que el criterio es
irreal y que hay que revisar el diseño, no seguir sorteando. `pool_controlado`
no produce ese número porque nunca rechaza nada: siempre devuelve algo.

## Decisión

1. **La rerandomización es un paso propio y declarado**, no un modo del
   selector. Vive **al final de Selección**, después de que la corrida existe,
   porque es la última decisión antes de fijar la muestra.
2. **El criterio se declara antes de sortear y se persiste con la corrida.**
   Para el caso de HSVG el criterio natural es «toda celda facultad × sexo
   alcanza su cuota», y el estadístico que lo resume es la **cobertura mínima**
   (el mínimo sobre celdas de `logrado / cuota`); se acepta con ≥ 1.
3. **Se reporta siempre la tasa de aceptación**, no sólo la muestra aceptada:
   cuántos sorteos se hicieron, cuántos pasaron y con qué cobertura mínima.
   Ese número es parte del sustento metodológico, igual que la semilla.
4. **Si se agota el presupuesto sin aceptar ninguna, se dice** y se entrega la
   mejor con el criterio incumplido a la vista. Nunca se devuelve la mejor
   fingiendo que pasó.
5. **`pool_controlado` no se toca y conserva su aviso.** Sigue siendo lo que
   es: optimización, con probabilidades que hay que estimar por simulación. El
   ADR no lo convierte en rerandomización renombrándolo.
6. **El artefacto de la muestra declara cuál de los dos se usó.** Un `.pulso`
   que no distinga entre «primer sorteo», «mejor de N» y «primera que pasó el
   criterio» no permite reconstruir el diseño, y las tres cosas producen
   muestras que se ven idénticas.

## Consecuencias

- La bitácora de la corrida gana tres campos: criterio, sorteos hechos y
  sorteos aceptados. Hoy guarda motor, semilla, fallback y advertencias.
- El sustento metodológico puede dejar de decir «se eligió la semilla 202» sin
  explicar por qué, y pasar a decir «se rerandomizó con criterio de cobertura
  mínima ≥ 1; 25 de 50 sorteos lo cumplieron; se tomó el primero aceptado».
- Los pesos siguen exigiendo `pi_final`, y la rerandomización **también** los
  desplaza respecto del cubo puro. La diferencia con `pool_controlado` es que
  acá el desplazamiento está definido por un criterio conocido y se puede
  estimar condicionando; allá depende de un score sobre candidatas.
- Aparece un costo de tiempo que hoy no existe: un criterio con 50 % de
  aceptación duplica en promedio el número de sorteos. Con criterios más duros
  crece rápido, y por eso el punto 4 es obligatorio y no opcional.

## Alternativas descartadas

- **Renombrar `pool_controlado` a «rerandomización»**. Es el error que este ADR
  existe para evitar: son mecanismos distintos con propiedades distintas, y el
  aviso del motor sobre las probabilidades quedaría contradicho por el nombre.
- **Dejarlo como práctica manual.** Es lo que pasó en HSVG 2026: se sortearon
  cincuenta veces fuera de la app y se eligió una. Contradice el pedido de
  Gonzalo de que «nada puede ser manual y todo tiene que estar registrado en la
  aplicación», y deja el `.pulso` describiendo un diseño que no es el que se
  ejecutó.
- **Aceptar por score en vez de por criterio** (aceptar si el score supera un
  umbral). Es optimización con otro nombre: el umbral sobre un score compuesto
  no define un conjunto de muestras interpretable, mientras que «toda celda
  alcanza su cuota» sí.

## Cumplimiento

### Qué falta para implementarla

- Elegir dónde vive el bucle: `.cm_aulas_select_once_dispatch` ya despacha por
  motor, pero rerandomizar no es un motor —envuelve al que sea—, así que el
  bucle va por fuera del dispatch.
- Definir el criterio como dato, no como código, para que el `.pulso` lo
  persista y el sustento lo pueda citar.
- La pestaña de Selección, la última, con el criterio, la tasa de aceptación y
  la muestra aceptada.

## Notas

- La distinción de este ADR es la misma familia que
  [una palabra para dos cosas](../qa/): dos mecanismos que producen muestras
  indistinguibles a la vista y tienen propiedades inferenciales distintas. Por
  eso el punto 6 exige que el artefacto declare cuál se usó: sin ese campo, el
  `.pulso` describe un diseño que puede no ser el ejecutado.
- Las cifras de HSVG 2026 (25 de 50, mediana 0,998, semilla 202 con 1,079)
  están medidas y viven en
  [el checklist de las decisiones](../qa/checklist-decisiones-certeza-2026-08-27.md).
- Morgan, K. L. & Rubin, D. B. (2012), *Rerandomization to improve covariate
  balance in experiments*, Annals of Statistics 40(2). El nombre clásico del
  mismo mecanismo en muestreo es **muestreo rechazativo**.
