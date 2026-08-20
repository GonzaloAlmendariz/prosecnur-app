# Validez estadística de la cadena del esperado — revisión exhaustiva

Mandato de Gonzalo (2026-08-20, textual): «esto a pie a que hagamos una
revisión bien exhaustiva de si la forma como calculamos todo lo que estamos
calculando ahora es efectiva, es válida y toma en consideración todos los
elementos que debería tomar en consideración».

Doc vivo. Cada eslabón de la cadena con: enunciado, evidencia, tamaño de
base (k), y veredicto. Vara de veredictos: **sólido** (medido con base
suficiente), **defendible** (medido con base delgada o supuesto estándar),
**débil** (supuesto sin medición propia), **defecto** (encontrado y por
corregir).

## La cadena

`cuota (diseño) → P25 × τ (dimensionamiento) → curvas docente/tamaño →
factor de facultad → esperado por aula → certificación por facultad →
Monitoreo (valor de validez)`

## Inventario de supuestos

| # | Eslabón | Enunciado | Evidencia | k | Veredicto |
|---|---|---|---|---|---|
| 1 | Cuota | n = 2.381 por fórmula (95 %, p 0,30, e 2,46 %, deff 2,0); muestra fijada 2.500; sobremuestra ×1,5; afijación proporcional facultad×sexo | Diseño 2025 declarado y replicado; p=0,30 y deff=2,0 son supuestos de diseño, no mediciones 2026 | — | defendible; **pendiente**: medir deff real del 2025 ejecutado para confirmar el 2,0 |
| 2 | P25 | El tamaño típico del aula por facultad es su percentil 25 de elegibles | Calculado del marco vigente 2026 (dato completo, no muestra); decisión sellada de Gonzalo | 15/15 fac. | sólido (es un percentil del universo, no una estimación) |
| 3 | τ = 0,53 | Tasa condicional efectivas/elegibles-sentados sobre aulas APLICADAS del 2025 | Medido del 2025 ejecutado (194 aplicadas) | k=194 | sólido como agregado; **pendiente**: re-verificar el denominador exacto de elegibles-en-aplicadas contra la base fuente |
| 4 | P(aplicación por docente) | Contratado 0,87 · Ord.-Asociado 0,84 · Ord.-Principal 0,73 | Medido del 2025 (aulas agendadas→aplicadas por tipo) | k por tipo **sin registrar** | defendible; **pendiente**: registrar k e IC por tipo |
| 5 | Rendimiento por tamaño | ≤15→0,80 · 16-25→0,69 · 26-35→0,56 · 36-50→0,55 · >50→0,44 (condicional a aplicada) | Medido del 2025 aplicado; monotónico como se esperaría | k por bin **sin registrar** | defendible; **pendiente**: k e IC por bin (la referencia v2 tiene celdas facultad×tamaño con suficiencia, vara asistencia) |
| 6 | Factor de facultad | τ_fac/τ_base en las 6 facultades con suficiencia (referencia v2: C&I sólida k=40; EGC 26, EGL 23, CCSS 17, DER 16, A&D 12 delgadas) | τ_fac medido (EF8b, vara de efectivas sobre aplicadas 2025) | k arriba | **defecto — ver hallazgo V1** |
| 7 | Multiplicatividad | p × r × factor sin interacciones | No verificada; V1 demuestra que factor↔r SÍ interactúan (composición) | — | débil → se corrige con la forma residual de V1 |
| 8 | Certificación | Garantía por facultad con τ plano 0,53 × elegibles | Contradice la mirada por aula (DER: cert ~1,0× vs esperadas 0,90× pre-factor) | — | **defecto conocido** (checklist tarde-3): migrar a Σesperadas |
| 9 | Meta de Monitoreo | El esperado por aula es el valor de validez; sin meta, sin juicio | Contrato cerrado con la sesión de Monitoreo; meta_origen/factor/k viajan por fila | 2.616 CH | sólido como contrato |

## Hallazgo V1 — el factor sellado sobre-corrige composición (2026-08-20)

El factor `τ_fac/τ_base` ignora que la curva de tamaño YA produce variación
por facultad (su mix de aulas). Medido sobre los titulares vigentes,
comparando la tasa condicional que la curva de tamaño sola produce (r̄_fac =
Σ el·r / Σ el) contra el τ_fac medido:

| Facultad | r̄ (curva tamaño, mix 2026) | τ_fac medido 2025 | Residual condicional | Factor sellado |
|---|---|---|---|---|
| DERECHO | 0,563 | 0,562 | **0,999** | 1,060 |
| CIENCIAS SOCIALES | 0,577 | 0,550 | 0,954 | 1,038 |
| CIENCIAS E INGENIERÍA | 0,564 | 0,538 | 0,954 | 1,015 |
| ARTE Y DISEÑO | 0,652 | 0,519 | **0,796** | 0,979 |
| EE.GG. LETRAS | 0,477 | 0,444 | 0,931 | 0,838 |
| EE.GG. CIENCIAS | 0,488 | 0,428 | 0,878 | 0,808 |

Lecturas: (a) el τ bajo de Derecho es SU MIX DE TAMAÑOS, no su
comportamiento — el factor sellado le regala un +6 % injustificado; (b) a
EGL/EGC el tamaño ya les explica la mayor parte y el factor sellado las
castiga dos veces; (c) el caso conductual genuino es Arte y Diseño (rinde
20 % bajo lo que su mix predice) y el factor sellado casi no la toca.

**Corrección propuesta**: factor residual `τ_fac / r̄_fac`, idealmente con
r̄_fac calculado sobre el MIX 2025 aplicado (la misma base donde se midió
τ_fac) para no atribuir a comportamiento lo que es cambio de mix entre
años. Las fuentes 2025 (solo lectura) permiten medirlo. Con el residual, la
Σ esperadas por facultad reproduce por construcción la tasa medida de la
facultad.

**Estado**: factor sellado vigente en el .pulso (Σ 3.020); corrección
pendiente de medición r̄_fac-2025 y del visto de Gonzalo (tercera revisión
del valor que Monitoreo consume en el día).

## Cola de mediciones pendientes

- [ ] r̄_fac sobre el mix 2025 aplicado (fuentes HSTVG2026, solo lectura) → factor residual definitivo.
- [ ] k e IC de P(aplicación) por tipo de docente (eslabón 4).
- [ ] k e IC del rendimiento por bin de tamaño (eslabón 5).
- [ ] deff real del 2025 ejecutado vs el 2,0 asumido (eslabón 1).
- [ ] Denominador exacto de τ=0,53 contra la base fuente (eslabón 3).
- [ ] Certificación por Σesperadas (eslabón 8) — decisión de Gonzalo.
