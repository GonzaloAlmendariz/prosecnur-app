# ADR 0066 — La probabilidad publicada es la del sorteo ejecutado

- **Estado**: aceptada
- **Implementación**: completa (este ADR nace con su implementación)
- **Fecha**: 2026-08-07
- **Contexto previo**: ADR 0019 (monitoreo de aulas), ADR 0035 (mapeo manual), ADR 0060 (vocabulario del embudo). Ninguno gobernaba el contrato de probabilidades de la selección de aulas; este ADR lo crea.
- **Origen**: auditoría metodológica de 2026-08-07 (`docs/qa/calidad-estadistica-calc-muestra-2026-08-07.md`), que encontró tres vías por las que la π publicada no correspondía al mecanismo que sorteó.

## Contexto

La selección de aulas publica, para cada aula del plan, una probabilidad de
inclusión (`pi_design`/`pi_final`) y su peso analítico (`1/pi_final`). Ese par
es lo que el investigador defiende ante un comité y lo que pondera cualquier
estimación posterior. La auditoría encontró que tres configuraciones sorteaban
de una manera y declaraban la π de otra:

1. `estratificado_aleatorio` sorteaba al azar simple pero publicaba π
   proporcional al tamaño (PPS).
2. El cube no incluía π en su matriz de balance, no fijaba el tamaño, y un
   parche silencioso agregaba o quitaba aulas sin declararlo.
3. El descuento secuencial de repetidos convertía el sorteo en un proceso
   sucesivo, pero las π seguían siendo las del diseño estático.

En los tres casos la salida *parecía* correcta — columnas de probabilidad,
pesos con seis decimales — pero describía un sorteo que no ocurrió.

## Decisión

**Regla única: la π que se publica es la π del mecanismo que realmente
ejecutó el sorteo.** De ella se derivan cinco reglas operativas:

1. **Cada motor publica su propia π.** `estratificado_aleatorio` (azar simple
   por estrato) publica `π = cuota_h / N_h` uniforme. Los motores PPS
   (sistemático, cube, local pivotal, pool) publican la π del MOS winsorizado
   con tratamiento iterativo de certezas. `.cm_aulas_design_probabilities`
   recibe el engine y distingue; no existe una π "genérica".
2. **El balanceo incluye la π.** La matriz de balance del cube/local pivotal
   lleva `pik` como primera columna (Deville–Tillé): balancear sobre π fija el
   tamaño de la muestra. Es la forma canónica de que el cube entregue la cuota.
3. **Ningún ajuste es silencioso.** Si el parche de tamaño
   (`.cm_aulas_fix_pick_count`) agrega o quita aulas, lo divulga: warning
   metodológico + metadata `size_adjustment` (agregadas/quitadas) que viaja con
   la selección. Las unidades de certeza (π = 1) no se recortan salvo último
   recurso divulgado.
4. **Un mecanismo secuencial exige π estimada, no prescrita.** Cuando el
   descuento secuencial de repetidos muerde en el sorteo, la π marginal ya no
   es calculable en fórmula cerrada: se estima por Monte Carlo que simula el
   proceso completo (mismas olas, mismo flag de descuento), con
   `probability_source = "monte_carlo_sequential_discount"`, presupuesto por
   escala divulgado (el recorte de corridas agrega varianza, nunca sesgo, y el
   SE reportado es el de las corridas ejecutadas) y rescate a π de diseño
   divulgado cuando el conteo MC es 0. La comparación de métodos, que no corre
   MC por costo, publica `probability_source = "prescribed_design_reference"`
   y lo advierte: sus π son referenciales del diseño estático.
5. **La π se defiende con un test de frecuencia empírica.** El contrato vive
   en `test-calc-muestra-aulas-pi-empirica.R`: para cada motor, la frecuencia
   empírica de inclusión en corridas repetidas debe reproducir la π publicada
   (tolerancia 4·SE), con control positivo que valida el arnés. Un motor nuevo
   entra al catálogo con su fila en ese test o no entra.

## Consecuencias

- **El golden del cube cambió.** Con `pik` en la matriz de balance el sorteo
  es otro (correcto); el golden `simulacion.rds` se regeneró deliberadamente.
- **Los pesos del engine estratificado cambian** para cualquier corrida
  futura: antes publicaba pesos de un PPS que no ejecutaba.
- **El descuento secuencial es más caro**: enciende MC por defecto. El
  estimador de costo del router lo asume como cota superior (prefiere mandar a
  job antes que congelar la vía síncrona).
- **La medida de tamaño ya no inventa**: un aula con 0 elegibles tiene MOS 0
  (antes recibía MOS 1 y podía salir sorteada).
- La fórmula del tamaño de muestra tiene **una sola fuente** (`calc_n_muestra`,
  con `ceiling`); el path territorial dejó de redondear por `round()`, que
  podía entregar un n bajo el margen declarado.

## Cumplimiento

1. `test-calc-muestra-aulas-pi-empirica.R` — frecuencia empírica ≈ π publicada
   por motor, con control positivo.
2. `test-calc-muestra-aulas-descuento-pi.R` — el descuento secuencial publica
   `monte_carlo_sequential_discount` y π del MC.
3. `test-calc-muestra-formula-unica.R` — fórmula única (ceiling), MOS 0 para
   0 elegibles, divulgación `composicion_na_n` en gates que dejan pasar NA.
4. Los goldens de aulas registran el engine efectivo; una regeneración se
   justifica por escrito o el diff no pasa revisión.
