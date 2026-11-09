# ADR 0140: cobertura por categorías de una variable frente al universo

Estado: Aceptado (Gonzalo, 2026-11-09)
Fecha: 2026-11-09
Autoridad: Gonzalo: «Este de cobertura está super bien, puede servir para mostrar las respuestas frente a una meta o
respuestas de un público frente a un universo. Por ejemplo: 15 estudiantes de antropología (5% de la muestra) y el
universo es 4%, como para mostrar que nuestra selección respeta alguna cuota de algún perfil, de la base o por bases.
Lógicamente tú no conoces el universo o cuántos son en cada uno, pero sí sabes las bases o los cruces de una variable a
selección; entonces el analista completa el total y cuánto es el universo de cada uno. El enfoque de este gráfico es
mostrar cobertura en porcentajes». Revisión metodológica del contrato del 2026-11-09 (aprobado con supuestos).

## Decisión

`p_cobertura` tiene dos versiones (modelo de versiones del ADR 0139):

- **«Por públicos»**: la de hoy, el n de cada base frente a su padrón y su meta.
- **«Por categorías de una variable»**, nueva. El analista elige una variable y una o varias bases. Por cada categoría,
  el motor calcula el n y el % de la muestra. El analista teclea el universo. La lámina muestra el % de la muestra frente
  al % del universo y la diferencia en puntos.

Reglas de la versión nueva:

1. **Denominador.** Las respuestas válidas de la variable: filas de la base tras los filtros de la lámina, sin NA y sin
   los códigos especiales (90, 94, 98, 99 y vacío).
   - "Sin información", "No sabe" y "No responde" van aparte, en una nota con su n y su % sobre todos los encuestados de
     la base.
   - Nunca entran en las barras ni en la suma.
2. **Sin ponderar.** La pregunta es la cuota de la selección. Si el proyecto tiene pesos, la lámina dice "Sin ponderar".
   No hay versión ponderada.
3. **Varias bases.**
   - Cada base va contra su propio universo, en una fila de categorías por base. Nunca se agrupan las bases.
   - El universo se teclea por base: una tabla base × categoría, con un total por base.
   - Las categorías se alinean por código, no por etiqueta.
4. **Universo.**
   - **Qué se guarda.** El analista lo teclea como conteos más un total, o como %. En los args de la lámina se guarda lo
     tecleado (campo propio `universo_categorias`, distinto del padrón por base). El motor deriva el %.
   - **Suma.** Con %, la suma debe estar entre 99.5 y 100.5. Si no, avisa sin bloquear y nunca renormaliza en silencio.
     Si el total no coincide con la suma de los conteos, avisa y usa la suma.
   - **Categorías que faltan.** Una categoría del universo con n = 0 en la muestra se dibuja con 0 % y diferencia
     negativa: es el hallazgo más importante. Una categoría de la muestra que no está en el universo sale "sin dato", sin
     diferencia y con aviso.
   - **Sin universo.** No se dibuja la barra del universo y la lámina lo dice.
   - **Universo viejo.** Si cambian la base o las categorías, el universo guardado se valida al dibujar y se avisa.
     Nunca se descarta en silencio.
5. **Precisión.** Se calcula con precisión completa y se redondea solo al dibujar. La diferencia en puntos sale de los
   valores sin redondear.
6. **Sin juicio inventado.**
   - No hay prueba de ajuste en la lámina y nunca se escribe "respeta la cuota".
   - Si el analista quiere una tolerancia, la teclea ("±X pts") y la lámina dice "dentro de ±X pts fijado por el
     analista".
   - Una categoría con n por debajo de la base mínima de la regla del estudio (30 por defecto) lleva su "n = 15" visible
     y una advertencia.
7. **Recodificadas y filtros.**
   - **Recodificadas.** La variable se resuelve con `.reporte_plan_resolve_recod_var`. Si las categorías del universo no
     calzan con las recodificadas, se avisa. Se guarda qué variable se usó.
   - **Filtros.** Con un filtro activo, la lámina lo muestra, porque el universo tecleado es del total.

## Supuestos

El denominador por defecto (válidos sin especiales), la tolerancia de suma 99.5–100.5 y "sin ponderar" como regla única
de esta versión.

## Consecuencias

- Una versión nueva en el catálogo de gráficos (variante `p_cobertura:categorias`), sin un graficador nuevo.
- La interfaz necesita una tabla editable del universo por base y categoría, prellenada con las categorías de la
  variable.
