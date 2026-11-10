# Cobertura GeoPeru en los seis departamentos sin Hojas de ruta

Tipo: Diagnóstico QA fechado
Estado: Vigente
Fecha: 2026-11-04
Autoridad: Insumo para la variante nacional urbana del [ADR 0131](../adrs/0131-muestra-probabilistica-urbana-multiciudad.md) (estrato = departamento), pregunta abierta del checklist `checklist-muestra-urbana-multiciudad-2026-11-04.md`, ítem 6.

Es análisis y propuesta. No se integró nada al motor ni a `territorios.json`.

## Respuesta corta

- **Los seis departamentos tienen marco.** La capa GeoPeru `peru_estrato_nacional_` trae manzanas con `IDMZ18` en al menos una provincia de Amazonas, Apurímac, Huancavelica, Madre de Dios, Moquegua y Pasco. No hace falta otra fuente cartográfica para tener una ciudad por departamento.
- **Ninguna candidata llega al nivel 1 ni al nivel 2 del ADR 0119 §1.** La que más se acerca es Tambopata, con 97 288 habitantes en 2025. Todas las demás tienen menos de 100 000 en los distritos cubiertos.
- **Cinco de las seis capitales pasan los umbrales de calidad del nivel 2** (captación ≥ 55 % y cobertura ≥ 65 %): Chachapoyas, Abancay, Huancavelica, Puerto Maldonado y Moquegua. Pasco solo los pasa si se deja fuera Simón Bolívar. Todas entrarían por la vía del §7: caso a caso, con la cobertura declarada.
- **El cruce de ubigeo de Mariscal Nieto está explicado.** El distrito de San Antonio (180107) se creó en 2021 separándolo de Moquegua (Ley 31216). El CPV 2025 cuenta aparte a una población que en 2017 estaba en las manzanas del Cercado. Si se suma 180107 al denominador, la captación baja de 93,4 % a 63,4 %.
- **Con n = 1 800 repartido por población urbana 2025, los seis departamentos juntos reciben unas 67 entrevistas** (3,7 % de la muestra), entre 8 y 14 cada uno. Con el mínimo de 2 rutas por estrato del ADR 0131 §1 (k = 8), cada uno recibe 16 entrevistas y los seis suman 96.

## Insumos y cómo se midió

| Insumo | Fuente | Detalle |
|---|---|---|
| Manzanas + NSE | GeoPeru/IDEP, `https://descargas.geoperu.gob.pe/peru_estrato_nacional_.zip` | 35 109 469 bytes, archivo del 28-05-2026, md5 `06497e1d721de5bef79efe4758d32191` (igual al ETag del servidor). 267 846 filas, 71 provincias con `IDMZ18`. |
| Viviendas y población 2017 por manzana | REDATAM CPV 2017 (`Manzana.NMANZ` × `Vivienda.C2P2` / `Poblacio.SEXO`) | 36 consultas, con caché en la carpeta temporal del repo, `geoperu/redatam_cache/`. |
| Población censada 2025 por distrito | REDATAM CPV 2025 (`CPV2025DI`) | 1 890 distritos. La suma nacional (32 706 028) cuadra con la población censada publicada. |
| Proporción urbana por departamento | INEI, *Resultados Definitivos CPV 2017*, Tomo I, Cuadro N.º 2.6 (p. 33) | El REDATAM 2025 no entrega el área urbana/rural por consulta automática. El `Vivienda.AREA` del REDATAM 2017 es el «concepto encuesta» y solo suma 23,2 de los 29,4 millones censados, así que tampoco sirve. |

Se corrió el builder del ADR 0119 sobre las 10 provincias candidatas, sin tocar el registro del repo (`$TMP_REPO` es la carpeta temporal `tmp` del repo):

```bash
HOJAS_RUTA_GEOPERU_ESTRATO="$TMP_REPO"/geoperu/zip/peru_estrato_nacional_.zip \
HOJAS_RUTA_REDDATAM_MANZANA_CACHE="$TMP_REPO"/geoperu/redatam_cache \
HOJAS_RUTA_CIUDADES_OUT="$TMP_REPO"/geoperu/salida \
HOJAS_RUTA_CIUDADES_PROVINCIAS=0101,0102,0107,0301,0302,0901,1701,1801,1803,1901 \
Rscript api/inst/hojas_ruta/build_inei2017_ciudades.R
```

Los indicadores son los del ADR 0119 §1, calculados con las mismas funciones del builder (`redatam2017_manzana.R`):

- **cobertura** = población 2017 en manzanas de la capa / población 2017 del distrito en REDATAM;
- **captación** = población 2017 en manzanas de la capa / población censada 2025;
- **tamaño** = población censada 2025 de los distritos cubiertos.

| Nivel | Tamaño | Captación | Cobertura |
|---|---|---|---|
| 1 | ≥ 300 000 | ≥ 65 % | ≥ 75 % |
| 2 | ≥ 100 000 | ≥ 55 % | ≥ 65 % |

En la tabla, «manzanas» cuenta las manzanas con id de la capa, después de unir los polígonos partidos (9 384 en total). «Viv. 2017» son las viviendas censadas en esas manzanas.

## Tabla por departamento

Columna «Calidad N2»: ✔ si la provincia pasa captación ≥ 55 % y cobertura ≥ 65 %, aunque no llegue al tamaño.

### Amazonas

| Provincia | Distritos | Manzanas | Viv. 2017 | Pob 2025 | Captación | Cobertura | Nivel | Calidad N2 | Decisión sugerida |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| **Chachapoyas** (capital) | 010101 Chachapoyas | 532 | 5 945 | 38 529 | 60,1 % | 72,3 % | fuera (tamaño) | ✔ | **Entra con cobertura declarada** |
| Bagua | 010201 Bagua | 376 | 5 608 | 27 426 | 70,9 % | 78,4 % | fuera (tamaño) | ✔ | Alternativa o complemento |
| Utcubamba | 010701 Bagua Grande | 696 | 8 463 | 52 945 | 48,6 % | 71,6 % | fuera | ✘ captación | No: la ciudad creció fuera del marco 2017 |

Bagua Grande es la ciudad más poblada del departamento, pero su marco 2017 solo cubre la mitad de la población de 2025. Si se quieren dos ciudades, la opción con buen marco es Chachapoyas + Bagua (65 955 habitantes en 2025).

### Apurímac

| Provincia | Distritos | Manzanas | Viv. 2017 | Pob 2025 | Captación | Cobertura | Nivel | Calidad N2 | Decisión sugerida |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| **Abancay** (capital) | 030101 Abancay, 030109 Tamburco | 795 | 18 224 | 83 219 | 67,5 % | 77,7 % | fuera (tamaño) | ✔ | **Entra con cobertura declarada** |
| Andahuaylas | 030201 Andahuaylas, 030213 San Jerónimo, 030216 Talavera | 692 | 13 227 | 92 454 | 47,2 % | 74,0 % | fuera | ✘ captación | No como provincia |

- En Abancay, Tamburco capta 48,0 % y el Cercado 70,8 %. Con el Cercado solo: 707 manzanas, captación 70,8 % y cobertura 79,7 %.
- En Andahuaylas, solo el Cercado pasa (57,2 % y 77,8 %). San Jerónimo (30,7 %) y Talavera (43,6 %) crecieron fuera del marco.

### Huancavelica

| Provincia | Distritos | Manzanas | Viv. 2017 | Pob 2025 | Captación | Cobertura | Nivel | Calidad N2 | Decisión sugerida |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| **Huancavelica** (capital) | 090101 Huancavelica, 090118 Ascensión | 634 | 14 376 | 52 874 | 77,6 % | 80,2 % | fuera (tamaño) | ✔ | **Entra con cobertura declarada** |

Tiene el mejor marco de los seis: pasaría la calidad del nivel 1 si tuviera el tamaño. Ascensión capta 81,9 %, es decir, más población 2017 en la capa que censada en 2025. El cruce de ubigeo está bien: el distrito existe con el mismo código en los dos censos. Es una ciudad que casi no creció.

### Madre de Dios

| Provincia | Distritos | Manzanas | Viv. 2017 | Pob 2025 | Captación | Cobertura | Nivel | Calidad N2 | Decisión sugerida |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| **Tambopata** (Puerto Maldonado) | 170101 Tambopata | 923 | 19 998 | 97 288 | 59,0 % | 72,6 % | fuera (tamaño, 2 712 bajo el corte) | ✔ | **Entra con cobertura declarada** |

La capa solo trae el distrito de Tambopata. Las Piedras, Laberinto e Inambari no tienen manzanas en la capa. La captación de 59 % refleja un crecimiento de 23 % sobre 2017.

### Moquegua

| Provincia | Distritos | Manzanas | Viv. 2017 | Pob 2025 | Captación | Cobertura | Nivel | Calidad N2 | Decisión sugerida |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| **Mariscal Nieto** (Moquegua), con 180107 | 180101 Moquegua, 180104 Samegua (+ 180107 San Antonio en el denominador 2025) | 1 744 | 19 580 | 81 269 | 63,4 % | 71,6 % | fuera (tamaño) | ✔ | **Entra con cobertura declarada**, con el cruce corregido |
| Mariscal Nieto, sin corregir (lo que calcula el builder) | 180101, 180104 | 1 744 | 19 580 | 55 155 | 93,4 % | 71,6 % | fuera | (inflada) | No usar esta cifra |
| Ilo | 180301 Ilo, 180303 Pacocha | 1 573 | 19 280 | 68 807 | 78,7 % | 76,8 % | fuera (tamaño) | ✔ | Alternativa o complemento |

**El cruce de ubigeo.** El Cercado de Moquegua (180101) tiene 64 061 habitantes en el REDATAM 2017 y 45 552 en el CPV 2025. La caída no es despoblamiento: en 2021 la Ley 31216 creó el distrito de San Antonio (180107, 26 114 habitantes en 2025) separándolo de Moquegua. Las manzanas de San Antonio vienen en la capa 2017 bajo el ubigeo 180101, pero el CPV 2025 las cuenta en 180107. El builder compara ubigeo contra ubigeo y no lo ve, así que la captación sale en 102,8 % para el Cercado y 93,4 % para la provincia.

Para integrarla habría que sumar 180107 al denominador 2025 de 180101, o asignar las manzanas de la capa al distrito nuevo. Esto último exige el límite distrital de San Antonio, que no está en la capa. Es el mismo tipo de traducción en la frontera que el §6 del ADR 0119 hace con Lima (`27xxxx` → `15xxxx`).

Moquegua e Ilo son dos ciudades de tamaño parecido. Ilo tiene mejor marco (78,7 % y 76,8 %; con el Cercado solo, 82,1 % y 79,2 %), y Pacocha es el distrito flojo (35,8 % y 40,3 %). Juntas suman 150 076 habitantes, el 96 % de la población urbana estimada del departamento.

### Pasco

| Provincia | Distritos | Manzanas | Viv. 2017 | Pob 2025 | Captación | Cobertura | Nivel | Calidad N2 | Decisión sugerida |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| Pasco, provincia | 190101 Chaupimarca, 190109 Simón Bolívar, 190113 Yanacancha | 1 419 | 13 053 | 60 612 | 67,9 % | 63,4 % | fuera | ✘ cobertura (por 1,6 pp) | No como provincia |
| **Cerro de Pasco** (Chaupimarca + Yanacancha) | 190101, 190113 | 1 138 | 11 753 | 48 483 | 76,4 % | 69,8 % | fuera (tamaño) | ✔ | **Entra con cobertura declarada**, sin Simón Bolívar |

Simón Bolívar tiene una cobertura de 34,5 % y una captación de 33,8 %: la capa dibuja una parte chica del distrito. Chaupimarca y Yanacancha captan más de 70 %. Es coherente con que Pasco sea el único departamento que perdió población entre 2017 y 2025.

## Departamentos sin provincia en la capa

Ninguno. Los seis tienen al menos una provincia con manzanas en la capa, así que no hace falta otra fuente cartográfica para la variante.

Lo que sí falta es cobertura **dentro** de algunas ciudades: Bagua Grande, Andahuaylas, San Jerónimo, Talavera, Tamburco, Samegua, Pacocha y Simón Bolívar captan menos de 55 %. Las vías para cubrirlas ya existen en el repo, y ninguna se probó en esta sesión:

- **Marco 2025 estimado del ADR 0119 §5** (Open Buildings sobre la capa 2017): es la vía prevista para ciudades que crecieron fuera de la cartografía 2017. Tiene la revisión metodológica pendiente.
- **Excluir el distrito flojo y declararlo**, como se hizo arriba con Pasco. Es lo que permite el §7: la ficha técnica dice qué parte de la ciudad 2025 queda fuera.

Si en otra variante se quisiera una ciudad que no está en la capa, el REDATAM CPV 2017 da conteos por manzana en todo el país (`Manzana.NMANZ`), pero sin polígonos. Habría que pedirle al INEI la cartografía digital de manzanas.

## Reparto de n = 1 800 por población urbana 2025

**Cómo se calcula.** La población urbana 2025 de cada departamento se estima como su población censada 2025 por su proporción urbana del CPV 2017 (Cuadro 2.6). Es un supuesto que se declara: la urbanización siguió creciendo entre 2017 y 2025, así que la cifra subestima algo la población urbana. Lima incluye a Lima Metropolitana y a Lima provincias, con 98,3 %. Sumada, la población urbana nacional estimada es 26,06 millones. El Cuadro 2.6 excluye en 2017 el distrito de Carmen Alto (Ayacucho), así que el porcentaje de Ayacucho se aplica sin él.

Se muestran dos repartos:

- **Proporcional**: n × proporción urbana del departamento.
- **Con el mínimo del ADR 0131 §1**: 225 rutas con k = 8, al menos 2 rutas por estrato y el resto en proporción, redondeado con restos mayores.

### Los seis departamentos

| Departamento | Pob 2025 | % urbano 2017 | Urbana 2025 est. | Proporción | n proporcional | Rutas (mín. 2) | n con mínimo | Ciudad sugerida | Pob 2025 de la ciudad / urbana del dpto. |
|---|---:|---:|---:|---:|---:|---:|---:|---|---:|
| Amazonas | 453 100 | 41,5 | 188 036 | 0,72 % | 13,0 | 2 | 16 | Chachapoyas | 20 % |
| Apurímac | 445 365 | 45,8 | 203 977 | 0,78 % | 14,1 | 2 | 16 | Abancay | 41 % |
| Huancavelica | 362 744 | 30,5 | 110 637 | 0,42 % | 7,6 | 2 | 16 | Huancavelica | 48 % |
| Madre de Dios | 185 176 | 82,8 | 153 326 | 0,59 % | 10,6 | 2 | 16 | Puerto Maldonado | 63 % |
| Moquegua | 179 214 | 86,9 | 155 737 | 0,60 % | 10,8 | 2 | 16 | Moquegua (o + Ilo) | 52 % (96 % con Ilo) |
| Pasco | 235 538 | 63,1 | 148 624 | 0,57 % | 10,3 | 2 | 16 | Cerro de Pasco | 33 % |
| **Seis departamentos** | 1 861 137 | | 960 337 | 3,68 % | **66,3** | 12 | **96** | | |

La última columna es la población 2025 de los distritos de la ciudad sobre la población urbana estimada del departamento. Exagera un poco, porque la población del distrito incluye su parte rural. Dice cuánto del estrato «departamento urbano» representa en realidad la ciudad principal: en Amazonas y Pasco, menos de un tercio.

### El reparto completo

| Departamento | Urbana 2025 est. | n proporcional | n con mínimo |
|---|---:|---:|---:|
| Lima (Metropolitana + provincias) | 10 390 893 | 717,6 | 704 |
| Piura | 1 656 612 | 114,4 | 112 |
| Arequipa | 1 593 790 | 110,1 | 112 |
| La Libertad | 1 572 412 | 108,6 | 104 |
| Lambayeque | 1 104 194 | 76,3 | 72 |
| Callao | 1 043 538 | 72,1 | 72 |
| Junín | 967 136 | 66,8 | 64 |
| Ica | 939 414 | 64,9 | 64 |
| Cusco | 786 284 | 54,3 | 56 |
| Áncash | 738 564 | 51,0 | 48 |
| Loreto | 694 627 | 48,0 | 48 |
| San Martín | 646 588 | 44,7 | 48 |
| Puno | 629 444 | 43,5 | 40 |
| Cajamarca | 507 088 | 35,0 | 32 |
| Ucayali | 474 799 | 32,8 | 32 |
| Huánuco | 401 922 | 27,8 | 32 |
| Ayacucho | 393 323 | 27,2 | 24 |
| Tacna | 327 432 | 22,6 | 24 |
| Tumbes | 235 184 | 16,2 | 16 |
| Apurímac | 203 977 | 14,1 | 16 |
| Amazonas | 188 036 | 13,0 | 16 |
| Moquegua | 155 737 | 10,8 | 16 |
| Madre de Dios | 153 326 | 10,6 | 16 |
| Pasco | 148 624 | 10,3 | 16 |
| Huancavelica | 110 637 | 7,6 | 16 |
| **Total** | 26 063 581 | 1 800 | 1 800 (225 rutas) |

Lectura para decidir:

- Con el reparto proporcional, los seis reciben menos de 16 entrevistas, es decir, menos de 2 rutas. Huancavelica, con 7,6, tendría una sola ruta. Con menos de 2 rutas no se puede estimar la varianza dentro del estrato, así que el mínimo del §1 es obligatorio.
- Con el mínimo, los seis quedan con 16 entrevistas cada uno. Es suficiente para que el estrato exista y aporte al total nacional con su peso. No alcanza para publicar resultados por departamento. El costo es sacar 30 entrevistas de los estratos grandes (Lima pierde 14) y que los seis queden sobrerrepresentados entre 1,2 veces (Amazonas) y 2,1 veces (Huancavelica), lo que la ponderación corrige.
- Seis departamentos más suman seis ciudades y 12 rutas para los mismos 1 800. El costo de campo crece por desplazamiento, no por número de entrevistas.

## Para decidir

1. **¿Se acepta la vía del §7 para ciudades bajo 100 000?** Ninguna candidata llega al tamaño del nivel 2, y la variante por departamento no puede esperar que lleguen. La alternativa es crear un nivel «capital departamental» con los umbrales de calidad del nivel 2 y sin el de tamaño.
2. **Moquegua:** integrarla exige corregir el cruce 180101/180107 en el builder (sumar San Antonio al denominador 2025). Si no, la captación publicada es falsa.
3. **Una o dos ciudades** en Moquegua (Moquegua + Ilo) y Amazonas (Chachapoyas + Bagua). Las dos ciudades suben mucho lo que la muestra representa del departamento, con el mismo n.
4. **Pasco sin Simón Bolívar** y **Abancay con o sin Tamburco**: decidir si se excluye el distrito flojo o se deja con aviso.

## Reproducir

Lo descargado y lo intermedio quedó en la carpeta temporal del repo, `geoperu/`, que no se versiona: `zip/`, `redatam_cache/`, `salida/`, `inei/00TOMO_01.pdf`, `urbana2017_cuadro2_6.csv`, `indicadores_distrito.csv`, `indicadores_provincia.csv` y `reparto_1800.csv`.
