# ADR 0117: Hojas de ruta — las titulares salen de un sistemático PPS por distrito

Estado: Aceptado (decisión del revisor metodológico, opción b, 2026-10-29)

Implementación: Completa en `api/R/hojas_ruta_sorteo_pps.R` (rama `claude/nostalgic-haslett-674947`)

Fecha: 2026-10-29

Enmienda: ADR 0115 (π del marco elegible). Aplica: ADR 0066 (la probabilidad publicada es la del sorteo ejecutado).

## Contexto

Con `row_var = "distrito"`, el sorteo repartía primero las rutas de cada distrito entre sus zonas censales con
un redondeo de mayor resto **determinista** (`.hojas_ruta_allocate_integer` sobre la medida) y después sorteaba
dentro de cada zona. Un distrito de Lima tiene entre 40 y 199 zonas y recibe unas 25 rutas, así que sólo las 25
zonas más grandes recibían ruta. Todas las manzanas de las demás zonas tenían π = 0 con cualquier semilla.

En `acnur_acg` (simulación de 200 semillas):

| Distrito | Viviendas que nunca pueden salir |
|---|---|
| San Juan de Lurigancho | 70,3 % |
| San Martín de Porres | 52,6 % |
| Ate | 50,2 % |
| San Juan de Miraflores | 40,8 % |
| Chorrillos | 27,4 % |
| Los Olivos | 24,3 % |

El sesgo se ve en la muestra:

- La razón entre lo observado y lo teórico sube con el tamaño de la manzana: 0,36 en las de 0–7 viviendas y 1,24 en las de 40 o más.
- El NSE bajo, que debería ser 13,5 %, sale entre 3,6 % y 4,7 %.
- El NSE medio, que debería ser 36,6 %, sale entre 48,6 % y 51 %.

El ADR 0115 publicaba `π ≈ n_z·M_i/ΣM_z` **condicionada a que la zona recibiera rutas**, que no es la π del
mecanismo. Además, PPS imputaba peso 1 a la medida NA o ≤ 0.

## Decisión

1. **Un solo sistemático PPS por distrito** sobre la lista ordenada por zona → manzana → `id_manzana`, con
   arranque uniforme en [0, 1) en la escala de π (el mismo recorrido de `UPsystematic` que usa Cálculo de
   muestra, `.cm_aulas_recorrido_sistematico`). La zona queda como estrato implícito: cada zona recibe ⌊Σπ⌋
   o ⌈Σπ⌉ rutas.
2. **π_i = n_d·M_i/M_d**, con las unidades de certeza (π ≥ 1) tratadas por iteración, de modo que Σπ = n_d
   (`.cm_aulas_inclusion_probabilities`). El método `sistematico` es el mismo recorrido con M_i = 1 (igual
   probabilidad).
3. **M = 0 → π = 0.** No se inventa un peso 1 (ADR 0066). Es un criterio del marco: lo que no tiene medida no
   se puede sortear con probabilidad proporcional. Si ninguna manzana de un distrito tiene medida > 0, el sorteo
   falla de forma declarada (`E_FRAME_WITHOUT_MEASURE`) y esas entrevistas quedan en `E_UNASSIGNED_INTERVIEWS`.
   Si hay menos manzanas con medida > 0 que rutas, salen todas y el resto se avisa (`W_FRAME_INSUFFICIENT`).
4. **π publicada.** `marco_elegible.zonas[*]` publica `regla_pi = "pps_sistematico_distrito"` (o
   `igual_probabilidad_distrito`) y `probability_source = "formula"`. La π individual es exacta. La varianza no:
   el sistemático tiene pares con π_ij = 0 y se analiza como diseño sistemático o estratificado implícito, lo que
   es una aproximación declarada.
5. **Cuota por zona (`row_var = "zona"`).** El sistemático corre dentro de cada zona. Las rutas se reparten entre
   zonas con redondeo aleatorio controlado:
   - El total del distrito es ⌊Σn_z/k⌋.
   - Cada zona recibe ⌊x_z⌋ o ⌈x_z⌉ rutas, con E = x_z.
   - Antes se truncaba cada zona por separado, y la cuota de las zonas chicas se perdía en silencio.

   Lo que no completa una ruta se avisa con `W_QUOTA_REMAINDER_UNROUTED`, en las dos ramas.

   Hoy el redondeo no actúa: `.hojas_ruta_finalize_quota_cells` asigna la cuota por zona en múltiplos de k, así
   que x_z es entero. Queda como red para cuotas que no lo sean.
6. **Firma del algoritmo.** La muestra lleva `algoritmo_sorteo`: `"pps_sistematico_distrito_v2"` o
   `"zona_mayor_resto_v1"`. Una muestra sin firma es v1. Al cargar el estado, una muestra v1 recibe, por
   distrito, el aviso `W_SAMPLE_DRAWN_WITH_V1`, que dice qué porcentaje de las viviendas del marco elegible quedó
   sin probabilidad y pide volver a sortear antes de salir a campo. **Nunca se vuelve a sortear en silencio.**
   Con cuota por zona, v1 y v2 cubren lo mismo, porque lo que queda fuera lo deja la cuota y no el sorteo. Por
   eso una muestra v1 con cuota por zona no pide volver a sortear: recibe el aviso de la cuota (Pendiente).

## Consecuencias

- La misma semilla da otra muestra. Las muestras v1 guardadas conservan sus manzanas y su aviso.
- La vista previa del marco elegible publica en `capacidad[*].rutas` la **esperanza** de rutas por zona (Σπ, con
  dos decimales), no un entero. La capacidad de la zona se compara contra ⌈rutas⌉.
- `hojas_ruta_engine.R` se achica: el reparto por zonas sale del motor congelado. Su línea base baja a 10 226.
- Los reemplazos se siguen sorteando con `.hojas_ruta_sample_indices`, sin manzanas de medida ≤ 0 (ver abajo). La π publicada es la de las titulares según el
  diseño.
- **Pendiente.** Con `row_var = "zona"`, la propia cuota (`.hojas_ruta_finalize_quota_cells`) reparte rutas entre
  zonas con el mismo mayor resto determinista, así que las zonas que la cuota deja en 0 tienen π = 0. En Lima
  eso es entre el 27 % y el 67 % de las viviendas del marco elegible de un distrito. Esa decisión es de diseño de
  la cuota y no se toca aquí, pero **se avisa**: cada sorteo con cuota por zona, y cada muestra v1 con cuota por
  zona al cargarse, recibe `W_ZONE_QUOTA_EXCLUDES_ZONES`. El aviso da el porcentaje de viviendas del marco
  elegible del distrito en zonas sin cuota y nombra la causa, que es la cuota y no el sorteo.
- Los reemplazos en PPS siguen §3. Sus candidatas son sólo las manzanas con medida > 0
  (`.hojas_ruta_sorteo_candidatos`, en el sorteo y en los reemplazos puntuales), y `.hojas_ruta_sample_indices`
  ya no imputa peso 1 a la medida NA o ≤ 0. Antes salían manzanas con 0 viviendas, que en campo no sirven. La
  capacidad de reemplazo de una zona (`E_REPLACEMENT_ZONE_INSUFFICIENT`) cuenta sólo esas candidatas.

## Cumplimiento

- `api/tests/testthat/test-hojas-ruta-sorteo-pps.R`, con un fixture de dos distritos de unas 40 zonas
  desiguales y 300 semillas. Verifica:
  - La frecuencia empírica coincide con la π publicada dentro de 4·SE, y el control positivo (la π de v1) no
    pasa ese mismo arnés.
  - Toda zona con viviendas sale alguna vez.
  - Σπ = n_d y las certezas salen siempre.
  - Los casos de borde:
    - más rutas que manzanas;
    - un distrito de una sola zona;
    - route_total = 0;
    - medida en 0 o NA en todo el distrito.
  - La misma semilla da la misma muestra.
  - En la rama zona, asignadas + sin ruta = cuota.
  - Las zonas sin cuota se avisan con su causa, y el redondeo no da la ruta extra a una zona sin fracción.
  - El aviso de v1 sale y es idempotente, y con cuota por zona no pide volver a sortear.
  - Control de escala: una π un 30 % más alta no pasa el arnés.
- `test-hojas-ruta-marco-elegible.R`:
  - π con la fórmula del sorteo.
  - Paridad: cada zona recibe ⌊Σπ⌋ o ⌈Σπ⌉ rutas.
