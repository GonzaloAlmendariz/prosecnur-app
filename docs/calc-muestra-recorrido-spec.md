# Spec del recorrido "Muestra de aulas" — cadenas trazables por pestaña

**Fecha:** 2026-07-12
**Propósito:** contrato de implementación para el revamp de IA del módulo Cálculo de muestra (desk `universidad/`). Cada pestaña deja de ser una "tabla final" y pasa a mostrar la **cadena paso a paso con número vivo y ejemplo canónico**, para que la implementación no vuelva a aplanar el detalle metodológico.
**Fuente de verdad:** `HST UNSA/Documentación Definitiva HST/` — cifras canónicas (`02`), método (`03.0`, `03.2`, `03.4`, `03.6`, `03.7`). Cualquier número aquí está verificado contra esos documentos.

---

## 0 · Conceptos transversales (visibles en todo el recorrido)

| Concepto | Regla | Dónde se surflea |
|---|---|---|
| **Dos etapas** | **Propuesta** (data del semestre anterior, hoy 2025-2 → N=21,365) vs **Campo** (base DTI del semestre de aplicación, aún no existe). El estudio conoce su modo. | Badge de modo en el header; check de reconciliación al cargar base Campo |
| **Dos filtros / dos unidades** | Criterios de **alumno** → población N + divisor de aulas · Criterios de **aula** → marco de curso-horario. Nunca mezclar. | Marco/Criterios (dos bloques) |
| **El puente** | `matriculados_población` de un aula = **Σ del flag de elegibilidad de sus alumnos**. Los criterios de alumno definen N **y** el divisor de aulas. | Impacto en vivo de Marco/Criterios |
| **Tres momentos de filtro** | **marco** (elegibilidad) · **instrumento** (ciclo 1 fuera, no es criterio de población) · **procesamiento**. | Notas en Criterios y Población |
| **Dos escenarios** | **E1** global (2,500/162) vs **E2** por facultad (4,050/235). Elección de primera clase. | Cálculo/Diseño (selector) |
| **Redondeo de diseño** | 2,500 NO sale de la fórmula (fórmula ≈ 2,353); es cifra fijada conservadora. Error implícito con n=2,500 → 2.39%. | Cálculo/Diseño (paso 2 de Cadena A) |

---

## Cadena A — de la población a la META (cuotas H/M por facultad)

| # | Paso | Fórmula | Ejemplo canónico |
|---|---|---|---|
| A1 | Fórmula (E1) | `n = N·Z²·p(1-p)·deff / [(N-1)e² + Z²p(1-p)deff]` | N=21,365 · Z=1.96 · p=.30 · e=2.47% · deff=2 → **2,353** |
| A2 | Redondeo de diseño | 2,353 → **2,500** (fijado) | error implícito 2.39% |
| A3 | Afijación por facultad | `n_fac = round(2500 · N_fac/21365)` | Arquitectura `2500·1080/21365=126.4→126` |
| A4 | Afijación por sexo | `n_sexo = round(n_fac · sexo_fac/N_fac)` | Arq. M `126·744/1080=87` · H `39` |
| A5 | Cuadratura (determinística) | Σ celdas redondeadas = 2,499 → residuo +1 a la facultad de mayor N (Cs e Ing) → su sexo mayoritario (H) | H pasa de 1,267 a **1,268** y cierra **2,500** exacto |
| A6 | **LA META** | tabla cuotas facultad×sexo | **M 1,232 / H 1,268 = 2,500** (49.3% M) |

**Guardas canónicas:** el Excel oficial imprime mal el Total (1,431/1,069); lo correcto es la suma de cuotas después del residuo A5 (1,232/1,268). El valor H=1,267 es la suma previa a cuadratura, no la meta final. Una pestaña que reconstruye A5–A6 detecta ambos descuadres.

---

## Cadena B — de la muestra a las AULAS (estudiantes/aula por facultad)

| # | Paso | Fórmula | Ejemplo canónico |
|---|---|---|---|
| B1 | Sobremuestra | `n_fac × 1.5` (E1) | Arq. `126×1.5=189` |
| B2 | Estudiantes/aula (divisor) | `mín(mediana, media)` de `matriculados_población` por aula, **por facultad**, en marco depurado | Arq. med 20/media 27.6 → **20** · EE.GG.L 40/36 → **36** |
| B3 | Aulas por facultad | `ceil(sobremuestra_fac / est_aula)` | Arq. `ceil(189/20)=10` · Cs e Ing `ceil(792/25)=32` |
| B4 | Total | Σ facultades | **162** (15/15 verificadas) |
| B5 | Bolsa operativa | elección | **162 / 177 / 192** (sugerido B=177) |

**Las 3 precisiones del divisor (B2):** (a) cuenta **elegibles**, no matriculados totales; (b) **por facultad** (~10 a ~36, sin promedio universal); (c) `mín(mediana,media)` conservador.

---

## DATOS — declarar el insumo (sin resultados)

| Pestaña | Rol | Contenido |
|---|---|---|
| **Estudio** | quién es el estudio | nombre, cliente, alcance, **modo Propuesta/Campo** |
| **Fuentes** | subir insumo DTI | archivos, hojas, modo de lectura, fuente del motor |
| **Variables** | mapear columna↔rol | auto-detectado de la base, editable; roles alumno vs aula diferenciados |

---

## MARCO — el flujo del marco (aquí corre el motor)

| Pestaña | Rol · cadena | Número vivo | Ejemplo canónico |
|---|---|---|---|
| **Criterios** | los dos filtros (alumno→aula) + **impacto en vivo sobre N y sobre estudiantes/aula** (el puente) | N, aulas, est/aula por facultad reaccionan a cada toggle | alumno: pregrado·regular·≥18 · aula: 5 reglas |
| **Población** | embudo alumno + tabla fac×sexo | conteos del embudo | 29,090→25,162→23,242→**21,365**; check inflación (si 25k–29k falta criterio) |
| **Aulas** | embudo aula + opcionales | conteo del marco | 5,262→presencial→tipo(+Taller A&D)→≥10→docente→nivel-fac→**2,483**; c7→2,056 · c8→799 |
| **Cobertura** | cruce alumno×aula | % alcanzable + factibilidad por facultad | **92.3%** (19,711/21,365); 15/15 factibles |
| **Consistencia** | que las bases se relacionen | gauge de match | prerrequisito; umbrales 70%/90% |

---

## CÁLCULO — dimensionar (n + escenarios)

| Pestaña | Rol · cadena | Número vivo | Ejemplo canónico |
|---|---|---|---|
| **Diseño** | **selector E1/E2** + parámetros + **Cadena A1–A2** | n de fórmula → redondeo | E1: 95%·2.47%·p.30·deff2 → 2,353→**2,500** |
| **Propuestas** | **Cadena A3–A6**: afijación fac → sexo → cuadratura → **META** | tabla de cuotas | **M 1,232 / H 1,268 = 2,500**; guarda del Total mal impreso |
| **Aulas/Objetivo** | **Cadena B completa** + **bolsa** | est/aula y aulas por facultad | tabla 15 fac → **162**; bolsa 162/177/192 |
| **Supuestos** | deff, tasa de rendimiento, sobremuestra≠reemplazos | n de campo | deff=1+(m̄−1)ρ; τ≈0.53 |
| **Distribución** | visual de la META (fac×sexo) | barras M/H por facultad | de la tabla de cuotas |

**Escenario 2 (cuando se elige):** parámetros por tamaño de facultad (N>1000→95/5%, 300–1000→95/7%, <300→90/10%), **p real por facultad**, deff 1.5, sobremuestra ×1.2, **ponderación W** post-estrato → 4,050/235. Matiz cliente: *representativo ≠ inferible por facultad*.

---

## SELECCIÓN — qué aulas concretas

| Pestaña | Rol |
|---|---|
| **Objetivo** | cuántas aulas cubrir (incluye bolsa 162/177/192) |
| **Método** | elegir el sorteo (PPS benchmark, cube balanceado, local pivotal, pool controlado) |
| **Simulación** | estabilidad y repetidos |
| **Titulares** | aulas que se intentan primero |
| **Reemplazos** | rutas Rn.1, Rn.2… equivalentes |
| **Sustento** | pesos, semilla, fuentes, firma del marco |

*(Se elimina "Marco de aulas" como primera pestaña: duplica Marco/Aulas.)*

---

## SALIDA — entregables

| Pestaña | Rol |
|---|---|
| **Cierre** | ficha ejecutiva del diseño (con margen real alcanzado) |
| **Tablas** | cuotas finales por facultad y sexo (la META) |
| **Entregables** | Excel/Sheets con política de privacidad |
| **Pase a Monitoreo** | handoff operativo y reservas |

---

## Deltas de implementación (orden sugerido)

1. 🔴 **Un solo hogar de criterios en Marco** (eliminar Datos/Elegibilidad y Datos/Institución).
2. 🔴 **Cálculo/Propuestas → mostrar Cadena A** (afijación → cuadratura → META, con la guarda del Total).
3. 🔴 **Cálculo/Objetivo → mostrar Cadena B** (estudiantes/aula por facultad + bolsa 162/177/192).
4. 🟡 **Marco/Población y Marco/Aulas → embudos con números** (no solo tablas).
5. 🟡 **Selector E1/E2** en Cálculo/Diseño.
6. 🟢 Badge Propuesta/Campo + checks de reconciliación · notas nivel≠ciclo · ciclo-1.
