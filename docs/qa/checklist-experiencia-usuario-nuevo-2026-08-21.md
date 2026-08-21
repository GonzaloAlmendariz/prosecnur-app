# Checklist — experiencia del usuario nuevo en Cálculo de muestra (2026-08-21)

Regla de la casa: un pedido con varias indicaciones se convierte en checklist
antes de tocar código, con **dónde vive** cada una y su estado. Se dibuja
entero cada vez que se menciona; sólo Gonzalo lo da por terminado.

Mandato que lo origina, textual: «que la experiencia usuaria de un usuario
nuevo sea muy limpia y muy pulcra y no falle… si le paso este motor a otra
persona, que sea capaz de subir la base de estudiantes, la de cursos-horario y
la histórica sin ningún problema… un loop iterativo prolongado, no una
comprobación superficial».

## Indicaciones de Gonzalo

| # | Indicación (textual, abreviada) | Dónde vive | Estado |
|---|---|---|---|
| 1 | «si la comparación dura mucho… hay que admitir que pase el tope. La idea es que el contador sea honesto con cómo vamos» | `hooks/jobPolling.ts` | ☑ `793d85c7` + `8104bd40` (el ETA declara si es del total o de la etapa) |
| 2 | «mide de dónde sale cada tasa» | motor `calc_muestra_aulas_efectividad.R` | ☑ `4652ab12` — son dos eslabones, no dos tasas: τ retrospectiva (insumo) → tasa prospectiva (resultado) |
| 3 | «la UI debería tener una forma amable de mostrar cada una y de dónde sale» | `TasaEfectividadFacultadCard` | ☑ `4652ab12` (desglose mix × residual por fila) |
| 4 | «de dónde sale cada tasa… podría ser un diagrama, no texto, y que no ocupe media pantalla» | `CurvaRendimientoDiagrama` | ☑ `cd770f37` — escalera de la curva; verificado con datos reales |
| 5 | «¿a qué se refiere con un mix de tamaños?» | `mix_tramos` del motor + diagrama | ☑ `cd770f37` — el mix es cómo reparte sus aulas por los peldaños |
| 6 | «nunca resuelves la muestra objetivo y la sobremuestra operativa… no lo veo en la interfaz» | paso 0 de Cursos-horario requeridos | ☑ `df91c004` |
| 7 | «el histórico debe viajar con el .pulso» | `project_pulso.R` | ☑ `bc9f5460` |
| 8 | «el default es el P25 y SIEMPRE es el P25» | `alumnosPorChDecisionModel.ts` | ☑ `f021abe6` — y supersede una indicación previa suya, documentada en la función |
| 9 | «el paso 1 debería hacer caso al criterio del marco; todos los gráficos también» | `DistribucionElegiblesCard` | ☑ `f021abe6` + `7d10622b` (marca, tooltip, leyenda y **orden**) |
| 10 | «el cuadro de texto gigante de la cadena debería ser más dinámico» | `CadenaFormulaFacultad` | ☑ `a2294216` |
| 11 | «no entiendo la finalidad de "alcanza"» | `CertezaCoberturaPanel` | ☑ `a2294216` — «¿Esas aulas alcanzan la cuota de cada facultad?» |
| 12 | «el KPI debería incluir el número de aulas titulares para cerrar el círculo» | `ResumenDiseno` | ☑ `9bd300d8` + `07441fc2` |
| 13 | «no entra en una sola fila y no se ve bien» / «4 arriba y 4 abajo» | `motor.css` | ☑ `9a6880f6` |
| 14 | «las aulas de reserva no se coordinan así» | 5 superficies | ☑ `9a6880f6`, `77bc5024`, `a28949af` + guardia de contrato |
| 15 | «el título debería ser mínimo entre media y mediana, sin jerga» | 3 superficies | ☑ `f021abe6` |
| 16 | «el chip de tasa de efectividad 53 % ya no es cierto» | `CalculoPropuestasTab` | ☑ `52818848` — muestra el rango real por facultad |
| 17 | «revisa bien que todo esté consistente» | transversal | ◐ 11 defectos de la familia «un rótulo promete otro número»; el barrido sigue |

## Decisiones que esperan a Gonzalo

| # | Decisión | Evidencia medida |
|---|---|---|
| D1 | Qué tasa debe dimensionar cuando el marco y el estrato discrepan | 157 aulas con la plana contra 145 con la del mix; la UI ya declara las dos |
| D2 | El reparto de cuotas no se regenera al perder una facultad del marco | Cálculo sin salida desde la UI; se dispara con la acción que la app ofrece |
| D3 | ¿El presupuesto de simulaciones debe repartirse por coste real de cada método? | Un método es 24-33× más caro; el coste lo dispara el **reparto por estratos**: 57 s con objetivo global contra >8 min con 17 cuotas, mismo marco y método |
| D4 | ¿«Del plan» sirve como nombre para titulares + reservas? | Término elegido por mí al retirar «a coordinar»; reversible en un cambio |

## Lo que no se pudo recorrer, y por qué

Las pestañas de Selección posteriores al sorteo —titulares con datos, solidez,
perfil, reemplazos, relato— siguen sin verse con datos reales. Exigen una
comparación completa, que sobre el marco real cuesta horas (ver D3). Se
prepararon bases reducidas a tres facultades (los cuatro métodos en 47 s) y se
intentó fabricar el estado por script: el motor lo rechazó cinco veces, todas
con razón y con cifras. La vía correcta es recorrerlo por la interfaz, lo que
exige poder cargar un archivo en el navegador.

## Hallazgos del recorrido que nadie pidió

- `/api/files/upload` daba **500** en vez del 400 que tiene escrito, cuando el
  `kind` llegaba en una forma que no cubría — `ee787d02`.
- La cabecera decía «resultado inválido» y **se guardaba la razón** que el
  motor publicaba con sus cifras — `a1d302ae`.
- El aviso «Cálculo completado» se anunciaba **sobre un resultado
  incompatible**, en la misma pantalla que lo declaraba inválido — `daf4b9be`.
- El home anunciaba una muestra que nadie iba a recolectar, sumando dos
  escenarios **alternativos** — `d0a7a0a9`.
- Tres pestañas decían «Siguiente paso» a la vez — `dc18198a`.
- «El cálculo ya tiene N y estratos listos» se anunciaba también **sobre un
  marco vacío** — `e0b5639e`.
- Un rótulo de grupo sobre 13 px de nada, en Coincidencia — `801e9386`.
- Y dos míos, cazados mirando la pantalla después de commitear: el aviso de
  duración contaba aulas que no se comparan y el contador prometía un final que
  no era — `d511dd4e`, `0c417f37`, `8104bd40`.
