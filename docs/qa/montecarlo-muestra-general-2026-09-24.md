# Monte Carlo del sorteo de Muestra general — 2026-09-24

Tipo: Registro QA fechado
Estado: Vigente
Fecha: 2026-09-24
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados

E8 del loop de Cálculo de muestra. Pregunta: el diseño que calcula y sortea
el motor general ¿cumple lo que declara? Script reproducible:
`E8_R=1000 Rscript scripts/calc-muestra-montecarlo-general.R`.

## Montaje

- Población sintética N = 5.000 en 4 estratos (40/30/20/10 %), indicador
  binario con prevalencia 0,20 / 0,35 / 0,50 / 0,65 por estrato → P real
  0,3512. Medida de tamaño lognormal para PPS.
- n = 357: lo que el motor calcula para e = 0,05, p = 0,5, z = 1,96, deff 1
  (Cochran + FPC; a mano 356,8 → 357).
- R = 1.000 sorteos por diseño con `calc_muestra_general_sortear`, semillas
  1…1000. Estimador de Hájek con los pesos 1/π publicados. Varianza: MAS con
  FPC (el sistemático se trata como MAS), estratificada por fórmula exacta,
  PPS con la aproximación con reemplazo (Hansen–Hurwitz).

## Resultado

| Diseño | Sesgo | EE empírico | \|p̂ − P\| ≤ e | Cobertura IC95 |
|---|---|---|---|---|
| MAS | 0,0006 | 0,0245 | 95,8 % | 94,8 % |
| Estratificado (reparto proporcional) | 0,0004 | 0,0226 | 98,1 % | 95,8 % |
| Sistemático (intervalo fraccional) | 0,0010 | 0,0286 | 94,8 % | 93,4 % |
| PPS sistemático | −0,0003 | 0,0235 | 97,5 % | 99,5 % |

## Lectura

- **Insesgado en los cuatro diseños** (|sesgo| ≤ 0,001 con EE de Monte Carlo
  ≈ 0,0008): los pesos 1/π publicados son los correctos.
- **El margen declarado se cumple.** Con p = 0,5 como peor caso, el n de 357
  debe dejar el error dentro de ±0,05 al menos el 95 % de las veces; con la
  prevalencia real 0,35 (varianza menor) lo hace entre 94,8 % y 98,1 %. El
  estratificado gana precisión (EE 0,0226 frente a 0,0245) porque la
  prevalencia difiere entre estratos: es la ganancia que la fórmula no cuenta
  y que por eso el deff por defecto de un estratificado es 1, no 1,5 (H07).
- **El sistemático tiene sólo ~14 muestras posibles** (k = N/n ≈ 14): su EE
  empírico (0,0286) se estima sobre esas pocas muestras distintas y es ruidoso;
  no indica sesgo. La cobertura del 93,4 % es la de tratarlo como MAS, que es
  la práctica habitual cuando el orden del marco no tiene periodicidad.
- **PPS sobrecubre (99,5 %)** porque la varianza con reemplazo sobreestima la
  de un diseño sin reemplazo con certezas. Es conservador, no un error.

## Lo que esto no prueba

- No mide el efecto de la no respuesta ni de liberar reservas (la población
  responde entera).
- El marco ordenado por id no tiene periodicidad: el riesgo del sistemático
  con marcos periódicos no se ejercita aquí.

## E3 — estratificado con proporción por estrato y Neyman

Script: `E8_R=2000 Rscript scripts/calc-muestra-montecarlo-neyman.R`.
Población de N = 10.000 en 3 estratos (6.000 / 3.000 / 1.000) con prevalencias
0,08 / 0,30 / 0,55 (P real 0,1953); e declarado 0,03; el sorteo recibe el
reparto que publica el cálculo; estimador de Hájek con 1/π; 2.000 réplicas.

| Asignación | n | Reparto A/B/C | e publicado | 1,96 · EE empírico | \|p̂ − P\| ≤ e | Sesgo |
|---|---|---|---|---|---|---|
| Proporcional (Cochran 5.25) | 534 | 320 / 160 / 54 | 0,0300 | 0,0295 | 95,2 % | 0,0004 |
| Neyman (Cochran 5.26) | 496 | 231 / 195 / 70 | 0,0300 | 0,0300 | 95,0 % | 0,0003 |

Con la p global conservadora (0,5) el mismo margen habría pedido **965**. La
fórmula por estrato cumple el margen justo al 95 % con 534, y Neyman lo cumple
con 496 porque lleva casos al estrato de mayor varianza (C: 54 → 70). El error
que publica el motor (con la asignación efectiva) coincide con el empírico.
