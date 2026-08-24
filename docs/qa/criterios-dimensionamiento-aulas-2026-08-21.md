# Criterios de dimensionamiento del muestreo de aulas

Doc vivo. Abierto el 2026-08-21 a partir de la pregunta de Gonzalo: «¿qué más
podemos dimensionar o tener como criterio de dimensionamiento?».

Complementa `validez-cadena-esperado-2026-08-20.md` (que audita el modelo del
esperado) y `plan-1b-esperado-redefinido-2026-08-20.md` (que lo ejecuta). Aquel
par responde *cuán bien predecimos lo que rinde un aula*; este responde *qué
otras cantidades del estudio se deciden con una medición y hoy se deciden con
una constante*.

Caso de uso que lo motivó: `traslape-iagen-hsvg-2026-08-21.md`.

## 0 · El punto de partida: qué se dimensiona hoy

| Cantidad | Cómo se decide | Dónde vive |
|---|---|---|
| Cupos de titulares (190) | `ceil(cuota ÷ (P25 × tasa_facultad))` | plan 1b · `cfg$efectividad` |
| Reparto por facultad | `selector$faculty_targets`, en dos niveles | `calc_muestra_aulas_afijacion.R` |
| Presupuesto de visitas | cupos ÷ tasa de aplicación media del marco | plan 1b (228 vs techo 200) |

**Todo lo demás es constante declarada o residuo.** Las tres cantidades de
arriba son las únicas del diseño que responden a una medición.

## 1 · Lo que está cerrado y no debe reabrirse sin dato nuevo

V8 (2026-08-20) barrió el 2025 con la vara de residual condicional e IC
bootstrap: **bloque horario** (4 categorías), **día de semana** (5), **fatiga de
campo por semana**, **reagendas**, **tipo de curso** y **modalidad** — todas con
IC ∋ 1 o constantes. El único destello, nivel 8 con 0,873, se descartó como
artefacto de comparaciones múltiples.

Veredicto vigente: `E × R(tamaño) × F(facultad)` es todo lo que el 2025
sostiene. **Buscar un cuarto factor multiplicativo con los datos actuales es
terreno agotado.** Lo que sigue no son factores del rendimiento del aula: son
otras cantidades del estudio.

## 2 · Candidatos medibles con los datos que ya tenemos

### C1 · Profundidad de la cadena de reemplazo

**Hoy**: `replacement_waves = 11L` en los defaults del estudio
(`calc_muestra_aulas.R:395`). Global, fijo, igual para todos los titulares.

**Medible**: la tasa de aplicación por tipo de docente ya está sellada en
`cfg$efectividad`. Con ella, `P(ninguna aplica) = (1−p)^(1+k)`:

| Tasa de aplicación | k para 95 % | 99 % | 99,9 % |
|---|--:|--:|--:|
| Contratado 0,865 | 1 | 2 | 3 |
| Ordinario-principal 0,730 | 2 | 3 | 5 |
| General 0,843 | 1 | 2 | 3 |

**Lectura**: cinco reservas llevan hasta el peor tipo de docente por encima del
99,9 %. Las otras seis son papel — coincide con el criterio de campo de Gonzalo
(2026-08-21): «reemplazos 1 a 5 pueden ser riesgosos, del 6 a más es poco
probable que vayamos».

**Lo que cambia**: la profundidad pasa de constante global a **cantidad por
titular** — un aula de ordinario-principal pide 3, una de contratado 2. Hoy las
dos reciben 11.

**Advertencia**: `p` mide rechazo del docente, no imposibilidad de agenda. La
cadena real absorbe ambas cosas, así que estos k son un piso, no un techo. La
medición que faltaría es a qué profundidad llegó de verdad el campo 2025
(`Historico 2025/HSVBG2025_relacion_cursos_horario_aplicados.xlsx`).

**Estado**: medido, listo para decidir.

### C2 · Tamaño del banco de extras

**Hoy**: `extra_pool_policy = "leftover_after_chains"` — los 761 extras son
*todo lo que sobró* tras armar las cadenas. Un residuo, no una decisión.

**Pero tienen función declarada** (Gonzalo, 2026-08-18): los extras no
reemplazan a nadie, son aulas adicionales para **cerrar la cuota de hombres y
mujeres por facultad**. Esa brecha es dimensionable: cuota de sexo de la
facultad − esperadas por sexo de sus titulares.

**Síntoma de que hoy no responde a nada**: Derecho tiene 241 extras y Educación
3, sin que ese reparto salga de ninguna brecha medida.

**Estado**: dimensionable; falta decidir la vara (¿cubrir la brecha esperada?
¿con qué holgura?).

### C3 · La operación de campo

**Hoy**: el motor declara `classroom_label` (sesiones y aula) como
**«DESCRIPTIVO, no identidad»** (`calc_muestra_aulas.R:984`) y nunca lo parsea.
Día, hora, pabellón y aula física viajan en el dato y no dimensionan nada.

Medido sobre los 190 titulares del plan 1b (los 190 parsean sin residuo):

| Medida | Valor | Por qué dimensiona |
|---|---|---|
| Aulas con **una sola sesión semanal** | **121 de 190 (64 %)** | una oportunidad de visita por semana; si se pierde, se pierde la semana |
| Pico de aulas simultáneas | **21** (MAR 09:00; MIE 11:00 son 20) | piso de aplicadores si el campo se concentra |
| Sesiones por día | MAR 63 · MIE 58 · LUN 56 · JUE 38 · VIE 37 · SAB 9 | el sábado casi no existe |
| Concentración por pabellón | L 46 · Z 40 · A 40 · E 36 (de ~260) | dos tercios en cuatro pabellones |
| Encuentros por semana | 1: 121 · 2: 68 · 4: 1 | la mitad del marco no da segunda chance semanal |

**Lo que permitiría**: dimensionar equipo de aplicadores, ventana de semanas de
campo y ruta diaria — tres cosas que hoy se deciden por experiencia y no por
medición, teniendo el dato a mano.

**Estado**: medido; ninguna de estas cifras entra hoy en una decisión.

### C4 · Traslape con otros estudios sobre la misma población

**Hoy**: no existe como criterio. El motor tiene `docente único` dentro del
sorteo, pero nada que mire fuera del estudio.

**Medible**: ver `traslape-iagen-hsvg-2026-08-21.md`. Con la lista de otro
estudio se cruza por `operational_code` y por docente, y se cuantifica en
efectivas esperadas.

**Límite duro que conviene tener presente**: excluir aulas resuelve el traslape
de aulas y de docentes, y **no toca el de alumnos**. En el caso IAGen, 941 de
los 1 366 alumnos compartidos coinciden por aulas distintas. Ninguna regla sobre
aulas puede evitar eso.

**Estado**: criterio nuevo, aplicado una vez, sin sellar en el motor.

### C5 · Precisión por dominio de análisis

**Hoy**: las cuotas por facultad vienen del diseño; no se derivan de un
error-objetivo por dominio.

Lo que compra cada cuota (p = 0,30, IC 95 %):

| Facultad | Cuota | ± con deff 1,1 | ± con deff 2,0 |
|---|--:|--:|--:|
| C&I | 528 | 4,1 % | 5,5 % |
| EGC | 403 | 4,7 % | 6,3 % |
| EGL | 397 | 4,7 % | 6,4 % |
| Derecho | 363 | 4,9 % | 6,7 % |
| CCSS | 149 | 7,7 % | 10,4 % |
| A&D | 119 | 8,6 % | 11,6 % |

**La pregunta de diseño**: si el informe lee resultados por facultad, A&D y CCSS
se leen con el doble de error que C&I. Dimensionar por precisión-objetivo del
dominio, en vez de por proporcionalidad, es una decisión distinta y defendible
—y más cara en aulas chicas—.

**Estado**: aritmética hecha; la decisión depende de qué promete el informe.

## 3 · El margen medido que todavía no se usa

V4 midió el **deff real: 1,08–1,12 estratificado** frente al **2,0 asumido** en
el diseño. Consecuencias aritméticas:

- Los 2 500 efectivas dan **±1,88 %** real, no el ±2,46 % nominal.
- El ±2,46 % nominal se alcanzaría con **~1 470 efectivas**.

*Nota sobre las dos cifras del nominal*: el cálculo directo (p=0,30, deff 2,0,
n=2 500, IC 95 %) da ±2,54 %; el diseño reporta ±2,46 %. La diferencia de
0,08 pp es consistente con una corrección por población finita sobre un marco
de ~35 000 estudiantes. No cambia ninguna conclusión de esta sección —el deff
real sigue siendo la mitad del asumido— pero queda anotada para que las dos
cifras no convivan sin explicación.

**Esto NO es una recomendación de recortar la muestra.** El deff se midió sobre
2025; el de `% mujeres` es 1,85 (carreras segregadas); y bajar n castiga
exactamente los dominios chicos de C5.

Se registra por otra razón: **ese colchón es lo que absorbe imprevistos como el
traslape con IAGen** —207 efectivas expuestas, 6 % del esperado, contra un
diseño sobre-dimensionado por un factor cercano a dos—. Conviene decidirlo
explícitamente y no descubrirlo al cierre.

## 4 · Lo que exige dato nuevo — y el dato ya se está capturando

`R(tamaño)` mezcla hoy tres cosas en un solo número: **quién asistió**, **quién
estaba y no respondió** y **quién no alcanzó a terminar**.

El libro de campo 2026 ya trae las columnas **«N ASISTENTES EN AULA»** y
**«N ASISTENTES QUE NO RESPONDIERON»** (hoja «Base de control»). Si se llenan
con disciplina este semestre, en 2027 se podrá dimensionar con asistencia y
rechazo separados — que es lo que permitiría responder si conviene un aula
grande con poca asistencia o dos chicas con mucha.

**Es la única veta que agranda el modelo en sí**, y depende de la captura en
campo, no de más análisis.

## 5 · Prioridad sugerida

| # | Criterio | Costo | Por qué primero |
|---|---|---|---|
| 1 | **C1 · Profundidad de cadena** | bajo | medido, decide solo, y quita 6 reservas muertas por titular |
| 2 | **C3 · Operación de campo** | bajo | el dato existe y hoy no dimensiona nada |
| 3 | **C2 · Banco de extras** | medio | convierte un residuo en decisión |
| 4 | C5 · Precisión por dominio | medio | depende de qué promete el informe |
| 5 | C4 · Traslape entre estudios | medio | vale la pena sellarlo si se repite |
| — | §4 · Asistencia vs rechazo | campo | no cuesta análisis, cuesta disciplina de captura |

## 6 · Reproducibilidad

Las mediciones de C1, C3 y C5 se regeneran con
`HSTVG2026/medir_criterios_dimensionamiento.py`, que lee el reporte DTI 2026-2 y
el libro del plan 1b. Las de §3 y §1 vienen de V4 y V8 en
`validez-cadena-esperado-2026-08-20.md`.
