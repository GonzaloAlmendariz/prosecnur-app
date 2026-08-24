# Checklist — motor de aulas y sus indicadores

**Encargo (textual):** «Integremos estas construcciones al checklist actual que tenemos porque
integrar todo es ultra importante […] y también agregar que el monitoreo debe reportar todos
estos indicadores de forma responsable.»

**Origen**: revisión del diseño muestral de Kamila (HSVG PUCP 2026, 21-08) contrastado contra
nuestro plan 1b. La revisión encontró defectos en su diseño y, de paso, **cinco en el nuestro**.
Los ítems **1-3** vienen de lo que ella hace mejor; los **A-H** son nuestros, independientes de
su trabajo.

**Contexto operativo (24-08)**: el estudio **todavía no sale a campo**; el Monitoreo actual corre
sobre simulaciones. Nada de esto es una urgencia: es la ventana para dejarlo bien **antes** de que
entre el primer dato real.

---

## El checklist completo

| # | Qué | Dónde vive | Costo | Estado |
|---|---|---|---|---|
| **1** | Certeza automática + columna de probabilidad por facultad | `router_calc_muestra.R` · `CalculoCursosHorarioFacultadTab` | bajo | ☐ |
| **2** | Criterios del marco documentados facultad por facultad, con la tabla a la vista | `calc_muestra_aulas_criterios.R` · superficie de criterios | medio | ☐ |
| **3** | Registrar la tabla de asistencia de Kamila como validación independiente | `docs/qa/` · memoria | — | ☑ |
| **A** | Partir τ en **asistencia × respuesta** | `cfg$efectividad` · `calc_muestra_aulas_efectividad.R` | bajo | ☐ |
| **B** | Reparar el denominador: elegibles **de la facultad**, no del aula | `calc_muestra_aulas*.R` · libro | medio | ☐ |
| **C** | Residual de las 9 facultades: **reportar con su IC, no corregir el modelo** | `cfg$efectividad` · superficie de referencia | bajo | ☐ |
| **D** | Recortar la cadena de reemplazo de 11 a 5 | `calc_muestra_aulas.R:395` | bajo | ☐ |
| **E** | Reserva dirigida: el pool de extras deja de ser residuo | Monitoreo + motor de efectividad | medio | ☐ |
| **F** | Reglas de redondeo — los elegibles son personas | `calc_muestra_aulas_efectividad.R` · superficies | bajo | ☐ |
| **G** | Nomenclatura y estados de los cuatro indicadores | `monitoreo_aulas_*.R` · contratos de idioma | medio | ☐ |
| **H** | Monitoreo reporta los cuatro **con responsabilidad** | superficies de Monitoreo | medio | ☐ |
| **I** | Avance por **sexo × facultad** con calibración, y los gráficos de avance a ese grano | `monitoreo_aulas_universitarias.R` · gráficos de avance | medio | ☐ |

☐ pendiente · ⛔ bloqueado (espera decisión) · ☑ hecho

---

## Detalle

### 1 · Certeza automática + columna de probabilidad — *bajo*

**No reemplaza al P25.** El P25 sigue decidiendo; `certeza` pasa de botón opcional a auditoría
automática.

Hoy existe todo: endpoint `POST /api/calc-muestra/aulas/certeza`, job retomable, sesión
`calc_muestra_aulas_certeza` y `CertezaCoberturaPanel.tsx` **ya montado en la misma pestaña que
los cupos**. Lo único que falta es que se dispare solo después de `calculateSample` y que la
probabilidad aparezca como columna al lado del cupo de cada facultad.

**Evidencia de por qué**: con 16 aulas Derecho cumple su cuota en el **47,7 %** de los sorteos; con
17 en el **93,6 %**; con 18 en el 99,7 %. El plan 1b le daba 16 y el libro operativo le puso 20 —
se corrigió por criterio, sin el número. En la otra dirección, C&I llega al 100 % con **33** y
recibe 40; EE.GG. Ciencias llega con **24** y recibe 30.

**Verificación**: la propuesta recalculada publica probabilidad en las 15 facultades sin click
extra; test de contrato que falle si `certeza` queda `NULL` tras un cálculo exitoso.

### 2 · Criterios del marco documentados por facultad — *medio*

Producimos la matriz de embudo por criterio y por facultad (`matriz_embudo`,
`facultad_efectiva_x_criterio`) pero **no la publicamos con esa forma**. Es el único punto donde
su documento es mejor que el nuestro: mide el % dentro de cada facultad, muestra la tabla, y
cambia la regla sólo donde hay algo que cambiar.

**Verificación**: cada criterio del marco expone «aulas antes / aulas después / % recortado» por
facultad, y ninguno se declara en una facultad donde no recorta nada.

### 3 · Tabla de asistencia como validación independiente — ☑

Nuestra referencia histórica (`calc_muestra_asistencia_referencia.R`, 01-08) es **anterior** a su
material y se calculó por otra vía. Sus 15 tasas coinciden con las nuestras **al decimal**. No se
adopta su tabla —9 de 15 facultades tienen IC de ±20 a ±45 pp— pero la coincidencia queda
registrada: dos cálculos independientes que dan lo mismo valen más que cualquiera por separado.

### A · Partir τ en asistencia × respuesta — *bajo*

La cadena real de 2025 tiene cuatro escalones:

```
6.232 elegibles → 4.931 asistentes (79,1 %) → 3.698 registros (75,0 %) → 3.303 efectivas (89,3 %)
                                                          producto = 53,0 % = τ
```

Nuestro τ los mete en un solo número. Partirlo **no gana precisión: gana diagnóstico**. Y el dato
dice que son fenómenos distintos:

| tamaño del aula | asistencia | respuesta |
|---|---:|---:|
| ≤ 15 | 112,6 % | 79,6 % |
| 36-50 | 76,8 % | 72,8 % |
| **> 50** | **63,5 %** | 73,6 % |

**Todo el castigo del aula grande es asistencia; la respuesta es plana.** Consecuencia operativa:
en un aula de 60, mandar mejor aplicador no sirve — el problema es que sólo van 38.

**Dónde**: `cfg$efectividad` gana dos sub-tasas por tramo; el anotador publica
`tasa_asistencia_aula` y `tasa_respuesta_aula` junto a la actual. **Global y por tramo de tamaño,
NO por facultad** — ahí el dato no alcanza (ver C).

**Trampa declarada**: la asistencia puede pasar de 100 % (Gastronomía 109,4 %; tramo ≤15 con
112,6 %) porque `asistentes` cuenta gente en el salón, no necesariamente elegible. Al partir la
tasa hay que topar esa pierna y decirlo.

### B · Reparar el denominador — *medio*

Nuestra columna `MATRICULADOS POBLACIÓN` coincide con los elegibles **totales** del aula en **193
de 193** aulas, y con los **propios de la facultad en 0**. Dimensionamos con el mismo denominador
que le criticamos a Kamila.

Hoy no muerde porque nuestras aulas quedaron bien atribuidas (95,1 % de alumnos propios contra su
89,4 %) y porque el margen del plan es 1,24×–2,22×. Pero el día que entre al marco un curso
compartido, es el mismo agujero y tampoco lo veríamos.

**Verificación**: el libro lleva las dos columnas —elegibles del aula y elegibles de la facultad—
y el dimensionamiento usa la segunda. Test que falle si divergen sin declararlo.

### C · El residual de las 9 facultades: **reportar, no corregir** — *bajo* ☑ decidido

**Corrección de cómo estaba planteado.** El plan 1b **ya deriva la tasa de dimensionamiento de las
9 desde el mix de tamaños de su propio marco** (`plan-1b-esperado-redefinido:17`). No estamos
ciegos al tamaño. Lo que vale `1` es el **residual** —la parte del rendimiento que *no* se explica
por el tamaño del aula—, y ahí sí no vemos nada: es donde vive la mala respuesta de Educación
(64,2 %).

**Decisión de Gonzalo (24-08):** derivar el residual sólo *«con tal de que no exageremos las aulas
a pedir; si no, debe reportarse y quedar absolutamente claro»*.

**Esa condición resuelve el ítem, y en contra de derivarlo.** Estimar un residual con k = 2 a 11
aulas es exactamente lo que el intervalo dice que no se puede hacer (Educación 95,2 %
[77,5 – 122,6], ancho ±45 pp). Un residual < 1 inflaría los cupos por ruido, que es justo lo que
la condición prohíbe.

**Lo que se hace en su lugar:**

1. **Publicar el residual observado de cada una de las 9, con su k y su IC**, marcado como
   *no incorporado al modelo*. Que quede absolutamente claro, como pide la decisión.
2. **Dejar que la calibración del ítem I lo detecte en 2026** con datos reales y k creciente. Si el
   residual se confirma con base suficiente, entra al modelo por la puerta de siempre: medido y
   sellado en `cfg$efectividad`.

Deja de estar bloqueado y baja de costo: es una tabla de reporte, no un cambio de motor.

### D · Recortar la cadena de reemplazo de 11 a 5 — *bajo*

`replacement_waves = 11L` es global y fijo. Con la tasa de aplicación medida por tipo de docente,
`P(ninguna aplica) = (1−p)^(1+k)`: **5 reservas llevan al peor tipo de docente por encima del
99,9 %**. Las otras 6 son papel que alguien mantiene.

### E · Reserva dirigida — el pool de extras deja de ser residuo — *medio*

Hoy `extra_pool_policy = "leftover_after_chains"`: los extras son lo que sobró (Derecho 241,
Educación 3, sin criterio). Su función declarada —cerrar la cuota de sexo por facultad— **sí es
dimensionable**.

**Evidencia de que rinde**: en Derecho quedan 443 aulas fuera del plan; la mejor aporta **40,6
mujeres efectivas esperadas** contra **14,5** de la mediana del pool — **2,8×**. Y las aulas no son
homogéneas: en Derecho la composición va de 38 % a 95 % de mujeres.

**Legitimidad**: el sexo ya es variable de estratificación del diseño; elegir para cerrar una celda
**completa la estratificación, no la rompe**. La alternativa real es ponderar, que es lo que se
hizo en 2025 con EE.GG. Letras hombres (peso 1,1538). **Condición innegociable**: marcar las
encuestas que vengan de un extra dirigido, para poder correr la estimación con y sin ellas.

**Vive en Monitoreo**, no en Cálculo: el ranking depende de lo ya aplicado (`ya_medidas` sumó 446
alumnos en 2025), de la brecha del día y de restricciones operativas.

### F · Reglas de redondeo — los elegibles son personas — *bajo*

> **Lo que prometemos se redondea hacia abajo. Lo que pedimos, hacia arriba.**
> Se redondea **una sola vez**, en la decisión, nunca en los sumandos.

| El número responde a… | Dirección |
|---|---|
| cuántas aulas necesito (cupos) | ↑ (ya usa `ceil`) |
| cuántas encuestas faltan (déficit de celda) | **↑** |
| cuántos extras dirigidos pido | ↑ |
| cuánto material llevo al aula | ↑ |
| cuánto rinde el plan completo | no redondear los sumandos; una vez al final |
| la meta del aula, para compararla | ver G · `floor(x + 0,5)` |

**Evidencia**: redondear cada aula hacia arriba y después sumar infla el plan en **+100 encuestas
(+2,9 %)** — media persona × 193 aulas. En el otro extremo, la brecha de Artes Escénicas mujeres es
de **0,1**: si se muestra como decimal o se redondea al más cercano se lee 0, y **falta una
persona**.

**Trampa de R**: `round()` hace redondeo bancario — `round(16.5)` = 16, `round(17.5)` = 18,
`round(0.5)` = 0 ✓. Hay que escribir **`floor(x + 0.5)`**.

**Regla de tests**: ninguna suma de esperados se compara contra sumandos redondeados.

### G · Nomenclatura y estados de los cuatro indicadores — *medio* ⛔

| Indicador | Campo | Grano | Estados | Rol |
|---|---|---|---|---|
| Cumplimiento del aula | `cumplimiento_aula` | aula | Pleno · Satisfactorio · Parcial · Insuficiente · Crítico · Nulo | referencial |
| Conformidad del aula | `conformidad_aula` | aula | Conforme · No conforme · No evaluable | referencial |
| Balance diario de aplicación | `balance_aplicacion` | día × facultad | Superávit · Equilibrio · Déficit | referencial |
| **Cobertura proyectada por celda** | `cobertura_celda` | facultad × sexo | Asegurada · Ajustada · **Déficit proyectado** · **Déficit no subsanable** · Sin cuota | **DECISIÓN** |

**Sólo el último manda a alguien a un aula.** En 2025 hubo 91 aulas «fallidas» y el estudio cerró
con **+62 de superávit**: compensar por aula habría mandado decenas de aulas de más. La decisión es
por celda.

**Lo que hay que reparar de lo existente:**

- `logrado >= vara` **es un techo disfrazado**: con obtenidas entera, `17 >= 17,4` es idéntico a
  `17 >= 18`. Hoy marca **103** aulas conformes donde con `floor(vara + 0,5)` son **113** ✓ — diez
  marcadas mal, incluida una que obtuvo 19 contra una meta de 19,0.
- Las bandas actuales (`hasta_25 / hasta_50 / hasta_99 / cumplida`) meten **82 aulas en una sola
  bolsa, de 8 a 270 encuestas faltantes**: tapan justo la diferencia entre «le falta una» y «no
  fue nadie».
- `quota_status` es **retrospectivo** (`observed >= target`): dice si ya llegaste, no si vas a
  llegar. La proyección es la pieza nueva.

**Colisiones a resolver en la misma tanda:**

| Palabra | Hoy significa | Propuesta |
|---|---|---|
| `cumplida` | tramo del aula **y** estado de la celda | `pleno` (aula) · `asegurada` (celda) |
| `en_riesgo` | celda con `observed > 0` bajo la meta | queda libre; la celda usa `ajustada` |
| «efectiva» | encuestas válidas | el aula usa `conforme`, nunca «efectiva» |
| «vara» | jerga para la meta del aula | en superficie: «meta del aula» |

**Decidido (24-08)**: la celda se evalúa contra la **muestra (2.500)**; la sobremuestra queda como
cifra **referencial para reportar el avance de campo**, nunca como meta de la celda. Se escribe en
`cuota_origen = "muestra"`, y la superficie muestra ambas con su rótulo, sin que la sobremuestra
dispare estados.

### H · Monitoreo reporta los cuatro con responsabilidad — *medio*

No basta con calcularlos: hay que publicarlos de forma que no engañen. Cinco condiciones, todas
verificables:

1. **Cada indicador con su denominador a la vista.** «68 %» sin decir de qué es el defecto que
   venimos persiguiendo todo el documento.
2. **El que decide, separado de los referenciales.** La celda va en su propia superficie, con su
   acción declarada. Los tres referenciales no llevan botón.
3. **Nada verde por ausencia.** Una celda sin datos es *Sin cuota definida*, no *Asegurada*. Un
   aula sin meta es *No evaluable*, no *Conforme*.
4. **Los avisos dicen la causa, no sólo el hecho.** «Derecho mujeres en déficit proyectado de 3
   porque las 4 aulas pendientes aportan 21 y faltan 24», no «Derecho en riesgo».
5. **Sin sobreexplicar.** Un rótulo, su número y su denominador. Parafrasear el título es ruido.

**Verificación**: `ui-quick-check` sobre las superficies de Monitoreo con proyecto real, más un
test de contrato de idioma que falle si aparece un estado fuera del vocabulario de G.

### I · Avance por sexo × facultad, con calibración — *medio*

**El vocabulario ya existe** en el frontend de Monitoreo: `logrado`/`observed` (286 usos),
`previsto`/`expected` (217), `proyectado`/`projected` (56). Lo que falta es **el grano de sexo** y
**una cuarta lectura**.

**Las cuatro series por celda (facultad × sexo):**

| Serie | Qué es | Para qué |
|---|---|---|
| **Logrado** | efectivas obtenidas de ese sexo, acumulado | dónde estamos |
| **Previsto** | lo que las aulas **ya aplicadas** debían aportar de ese sexo | el término de comparación |
| **Proyectado** | logrado + aporte de las aulas **pendientes** | ¿voy a llegar? → alimenta `cobertura_celda` |
| **Calibración** | **logrado ÷ previsto** | **¿el campo se comporta como el modelo dice?** |

**La calibración es la pieza nueva y la que más importa**, porque detecta un sesgo sistemático
mientras todavía hay aulas por delante. Sin ella, un modelo mal calibrado se descubre cuando ya no
quedan aulas.

**Y hay evidencia de que el sesgo existe.** Composición por sexo planificada vs lograda, 2025
ejecutado ✓:

| Facultad | % mujeres meta | % mujeres logrado | desvío |
|---|---:|---:|---:|
| **GESTIÓN Y ALTA DIRECCIÓN** | 57,9 % | 67,1 % | **+9,2** |
| **GASTRONOMÍA** | 62,5 % | 71,4 % | **+8,9** |
| ARTES ESCÉNICAS | 51,4 % | 56,9 % | +5,5 |
| **EE.GG. LETRAS** | 58,6 % | 63,8 % | **+5,2** |
| EDUCACIÓN | 80,8 % | 84,4 % | +3,6 |
| CIENCIAS E INGENIERÍA | 24,9 % | 28,1 % | +3,2 |
| DERECHO | 65,0 % | 67,6 % | +2,6 |
| *(otras 4 con desvío negativo: A&D −3,3 · CC.SS. −3,0 · LyCH −4,8 · PSI −0,8)* | | | |
| **TOTAL** | **48,2 %** | **51,6 %** | **+3,4** |

**Diez de catorce facultades se desvían hacia mujeres, y el total +3,4 pp.** Coincide con lo que
la propia hoja de diseño 2025 ya registraba («composición planeada 48,8 % · lograda 52,7 % ·
desvío +3,9 pp») sin sacarle consecuencia.

**Tres consecuencias de diseño:**

1. **La proyección por celda no puede usar la misma tasa para ambos sexos.** Si el aula entrega
   sistemáticamente más mujeres de las que su padrón predice, la celda de hombres se queda corta
   aunque el total del aula cumpla.
2. **La reserva dirigida (ítem E) debe priorizar hombres**, que es el sexo que el sesgo castiga.
3. **Que EE.GG. Letras hombres fuera la única celda incumplida en 2025 no fue mala suerte**: es la
   consecuencia previsible de este sesgo en la facultad con el cuarto desvío más grande (+5,2).

**Limitación declarada**: con los datos de 2025 no puedo separar limpiamente «visitamos aulas con
más mujeres» de «las mujeres responden más», porque falta el padrón por sexo de cada aula de ese
año. La dirección es consistente en 10 de 14 facultades y el diseño es proporcional (no elige
aulas por sexo), lo que apunta a un efecto de respuesta — pero **en 2026 esto se puede medir
limpio**, porque sí tenemos el padrón por sexo de cada aula. Es lo primero que debería reportar
esta serie.

**Sobre los gráficos**: no hace falta inventar superficies. Los de avance ya muestran
logrado/previsto/proyectado; lo que cambia es (a) desglosarlos por sexo dentro de cada facultad y
(b) añadir la banda de calibración, que hoy no tiene representación. Mejorar los actuales rinde
más que agregar nuevos.

---

## Decisiones — las cuatro resueltas el 24-08

| # | Decisión | Resolución de Gonzalo |
|---|---|---|
| 1 | ¿La celda se evalúa contra la muestra o la sobremuestra? | **La muestra (2.500).** La sobremuestra queda **referencial para reportar el avance de campo**, no dispara estados. Se sella en `cuota_origen`. |
| 2 | Método para el residual de las 9 facultades | **Derivarlo sólo si no exagera las aulas a pedir; si no, reportarlo y que quede absolutamente claro.** Con k = 2-11 e IC de ±20 a ±45 pp, la condición se incumple → **se reporta, no se corrige** (ver C). |
| 3 | Umbral de margen para `ajustada` | **5 %.** |
| 4 | ¿La proyección por celda aplica tasa diferencial por sexo? | **No por ahora.** Se reporta la calibración del ítem I **sin tocar el modelo**, hasta que 2026 confirme el sesgo con padrón por sexo de cada aula. Si se confirma con base suficiente, entra medido y sellado en `cfg$efectividad`. |

---

## Hallazgos de la revisión que sostienen este checklist

Medidos, para que el doc se sostenga solo:

- **La sobremuestra de +50 % es exactamente la pérdida que un modelo de sólo asistencia no
  captura**: `1 ÷ (0,750 × 0,893) = 1,4931` contra `1,5000` declarado. Queda validado con número
  el +50 % que se usaba por convención.
- **El deff real de 2025 es 1,29** (`indice_vbg`, de donde sale el p = 0,30) y **1,55**
  (`indice_hs`), no 2,0. El 2,0 es colchón deliberado, no riesgo.
- **Nuestro plan de 193 entrega 1,24×–2,22×** de la cuota de cada facultad; ninguna baja del
  101 %. Las dos más justas (C&I y Derecho) son de las que **sí tienen factor propio medido**.
- **Celdas sin aire hoy**: Derecho mujeres 99 %, Artes Escénicas mujeres 100 %. En 2025 la única
  celda incumplida fue EE.GG. Letras hombres, que hoy va en 142 %.
