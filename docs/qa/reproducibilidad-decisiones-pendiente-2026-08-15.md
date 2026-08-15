# Las decisiones de depuración no llegan a los artefactos que las explican

**Fecha**: 2026-08-15 · **Medido sobre**: `ACNUR_V3_final.pulso` (PDM Medios de
Vida 2026), 103 casos recibidos, 101 entregados, 2 excluidos con criterio y
justificación · **Relación**: [ADR 0076](../adrs/0076-una-base-depurada-se-promueve-no-se-recomienda.md)

Con el ADR 0076 la exclusión decidida en Limpieza ya llega a la base entregada.
Falta comprobar si llega a los dos artefactos cuyo propósito es **explicar cómo
se construyó esa base**: el script R de replicación y el informe metodológico en
PDF. Se verificó generando ambos sobre el proyecto final.

Resultado: el script **reproduce** la exclusión pero no la **explica**; el
informe metodológico no la menciona en absoluto.

---

## 1 · Script R de replicación — reproduce, no explica

**Estado**: funciona · falta el porqué

El script incluye el universo final y filtra el crudo contra él:

```r
# (2) Universo final del estudio: los casos que superaron el control de
#     calidad. Se listan por su identificador de caso (ya presente en el
#     crudo), lo que permite reproducir la base exacta sin exponer nada más.
universo_final <- c("152c05df-…", …)          # 101 identificadores

n_fuera <- nrow(crudo) - length(universo_final)
message(sprintf("Casos en el crudo: %d | Universo final: %d | Fuera del universo final por control de calidad: %d",
                nrow(crudo), length(universo_final), n_fuera))
```

Correr el script sobre el crudo de 103 casos devuelve exactamente los 101 de la
base entregada. **La reproducibilidad del qué está resuelta.**

**Lo que falta es el porqué.** El script no menciona en ninguna línea los
criterios que detectaron los casos ni los motivos que el analista escribió al
excluirlos. `grep -i "criterio|exclu|limpieza|RC_"` sobre el script emitido
devuelve **cero coincidencias** fuera del mensaje genérico de arriba.

Quien recibe el script ve 101 identificadores en duro y la frase «superaron el
control de calidad». No puede saber que dos casos salieron por criterios
declarados —una duración de −6 meses y una fecha de resultado posterior a la
entrevista— ni que cada exclusión lleva su justificación escrita.

**Propuesta**: un bloque de comentario antes de `universo_final` con una línea
por decisión: criterio que la detectó, cuántos casos afectó y el motivo que
registró el analista. El backend ya tiene todo en
`preview$logs$excluded_cases` (`decision_id`, `source_id`, `case_id`,
`rationale`) y en el linaje de la promoción (`n_casos_antes`, `n_casos_despues`).

**Dónde vive**: `api/R/analitica_script_replica.R`, emisión del texto (~línea
368) · el universo se arma en `.script_replica_build_plan()` (~línea 280).

---

## 2 · Informe metodológico PDF — no refleja nada de esto

**Estado**: hueco real

El PDF tiene la sección donde esto debería vivir, y sale vacía:

```
Encuestas recibidas
Reclasificadas
Pruebas retiradas
Otras exclusiones
Encuestas incluidas
```

Ninguna trae número. La portada declara `ENCUESTAS INCLUIDAS: -`.

Búsquedas sobre el texto extraído del PDF, 16.826 líneas:

| Qué se buscó | Coincidencias |
|---|---|
| Criterios personalizados (`Personalizada`, nombre de los criterios) | **0** |
| Casos excluidos, decisiones, motivos | **0** |
| Conteo de exclusiones en la sección de preparación | vacío |

El informe reporta **429 reglas del instrumento** y no dice nada de los dos
criterios de revisión que efectivamente encontraron los problemas, ni de las dos
decisiones que se tomaron sobre ellos. Un informe de «validación y limpieza» que
no menciona la limpieza que se hizo.

**Salvedad de esta medición**: el PDF se generó tras reconstruir el plan y correr
la auditoría, pero **sin reejecutar los criterios personalizados** en esa sesión.
Es posible que parte de las ausencias se deban a eso y no al motor. Lo que sí es
seguro es que las **decisiones de limpieza estaban en el proyecto** —viajan en el
`.pulso` y la base entregada ya tiene 101 casos— y aun así no aparecen. Antes de
implementar conviene repetir la medición reejecutando los criterios, para separar
lo que falta de lo que simplemente no se recalculó.

**Dónde vive**: `api/R/validacion_methodology_report.R` (o el archivo que arma
el informe) · endpoint `/api/validacion/v2/report/methodology/pdf`.

---

## 3 · El plan de validación no sobrevive al `.pulso`

**Estado**: hallazgo lateral, probablemente el más molesto en el uso diario

Abrir `ACNUR_V3_final.pulso` y pedir el informe metodológico devuelve:

```
E_NO_PLAN — "Primero construye el plan de validacion."
```

Hay que reconstruir el plan (442 reglas) y volver a correr la auditoría antes de
poder generar el informe, aunque el proyecto ya había pasado por validación
completa, tenga sus criterios declarados y sus decisiones tomadas.

Para un analista que reabre un proyecto cerrado hace semanas y solo quiere el
PDF para adjuntarlo, son dos pasos pesados que no aportan nada nuevo: el
resultado es el mismo que ya se había calculado.

**A decidir**: si el plan debe persistirse en el `.pulso` —con el costo de
tamaño y de invalidación cuando cambia el instrumento— o si el informe debería
reconstruirlo solo en vez de exigirlo al usuario.

---

## Por qué importa

Los tres puntos son la misma pregunta que motivó el ADR 0076, un paso más
adelante. Aquella decisión logró que **la exclusión llegue a la base**. Estos
artefactos existen para que la exclusión sea **defendible ante el cliente**: el
script prueba que la base se puede reconstruir y el informe explica con qué
criterio se depuró.

Hoy el entregable puede decir «son 101 casos» y no puede decir, por sí solo,
«son 101 porque estos dos fueron excluidos por estos criterios y con esta
justificación». Esa frase existe únicamente en el Excel de decisiones de
limpieza, que es un archivo aparte que nadie está obligado a mirar.

## Orden sugerido

1. **Punto 1** — es acotado y de alto valor: el dato ya está en el motor, falta
   emitirlo como comentario en el script.
2. **Punto 3** — decide una fricción diaria y es previo al 2, porque hoy medir
   el informe exige reconstruir el plan.
3. **Punto 2** — después de repetir la medición con los criterios reejecutados.
