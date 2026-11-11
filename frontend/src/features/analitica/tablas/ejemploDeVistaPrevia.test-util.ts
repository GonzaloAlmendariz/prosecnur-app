// Dobles de la vista previa de Frecuencias para las pruebas (contrato v2: la
// base va en casos sin ponderar). Las dos respuestas son las REALES de
// `POST /api/analitica/frecuencias/preview` sobre el proyecto de referencia
// acnur_acg (oleada 9, H): `ejemplo-respuesta-v2.json`, con ponderación por
// calibración, y `ejemplo-respuesta-v2-sin-pesos.json`, copiadas sin tocar
// (sha1 6d463a39 y a66e4300).
//
// Lo que se añade a mano, porque esas respuestas no lo traen, está marcado
// abajo: una tabla numérica (la configuración del ejemplo no declara ninguna),
// los códigos 98 y 99 como especiales y una fila sin código.
//
// No es una prueba ni se importa desde la app.

import type { FrecuenciasPreview, FrecuenciasPreviewTabla } from "../../../api/analitica";

/** Respuesta real con pesos, tal como llega del backend (incluye el sello, que la pantalla no muestra). */
export const RESPUESTA_REAL = {
  "ok": true,
  "base": {
    "nombre": "Monitoreo territorial",
    "bases_del_archivo": [
      "Monitoreo territorial"
    ],
    "n_bases": 1,
    "independientes": false
  },
  "fuente": "adaptados",
  "ponderado": true,
  "ponderacion": {
    "configurada": true,
    "estado": "aplicada",
    "modo": "calibracion",
    "peso_columna": null,
    "motivo": null,
    "n_efectivo": 499.243966180787,
    "deff": 2.56988584121495,
    "sello": "Resultados ponderados (n efectivo = 499)",
    "escala": "normalizada"
  },
  "casos": {
    "cuentan": 1283,
    "suma_pesos": 1283,
    "con_peso": 1283
  },
  "escala_pct": "proporcion",
  "opciones": {
    "orden": "original",
    "mostrar_todo": false,
    "incluir_secciones": false,
    "codigos_especiales": []
  },
  "limite": 500,
  "total_variables": 26,
  "devueltas": 26,
  "recortado": false,
  "tablas": [
    {
      "variable": "consent",
      "variable_origen": null,
      "etiqueta": "Si está de acuerdo con continuar con la encuesta, por favor, confirmar",
      "tipo": "unica",
      "seccion": {
        "nombre": "General",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Sí",
          "n": 1283,
          "pct": 1,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "whynotconsent",
      "variable_origen": null,
      "etiqueta": "Razón principal por la que decide no participar en la encuesta",
      "tipo": "unica",
      "seccion": {
        "nombre": "General",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": true,
      "filas": [],
      "total": {
        "n": 0,
        "pct": null
      },
      "base": {
        "n": 0,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": []
    },
    {
      "variable": "M5_district",
      "variable_origen": null,
      "etiqueta": "¿En qué distrito vive actualmente?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Datos Generales",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "smp",
          "etiqueta": "San Martín de Porres",
          "n": 211.685304943449,
          "pct": 0.16499244344774,
          "especial": false
        },
        {
          "codigo": "sjl",
          "etiqueta": "San Juan de Lurigancho",
          "n": 196.667036856476,
          "pct": 0.153286856474261,
          "especial": false
        },
        {
          "codigo": "chorrillos",
          "etiqueta": "Chorrillos",
          "n": 205.478279543683,
          "pct": 0.160154543681749,
          "especial": false
        },
        {
          "codigo": "olivos",
          "etiqueta": "Los Olivos",
          "n": 194.062819569034,
          "pct": 0.151257069032763,
          "especial": false
        },
        {
          "codigo": "ate",
          "etiqueta": "Ate (Vitarte)",
          "n": 201.268435793683,
          "pct": 0.156873293681749,
          "especial": false
        },
        {
          "codigo": "sjm",
          "etiqueta": "San Juan de Miraflores",
          "n": 273.838123293684,
          "pct": 0.213435793681749,
          "especial": false
        }
      ],
      "total": {
        "n": 1283.00000000001,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "E2_sex",
      "variable_origen": null,
      "etiqueta": "¿Cuál es su sexo?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Datos Generales",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Hombre",
          "n": 449.049999999999,
          "pct": 0.35,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Mujer",
          "n": 769.799999999999,
          "pct": 0.600000000000001,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Otros",
          "n": 64.1500000000002,
          "pct": 0.0500000000000003,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "M3_edu",
      "variable_origen": null,
      "etiqueta": "¿Cuál es el nivel educativo más alto que ha completado?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Datos Generales",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Primaria o menos",
          "n": 57.1719048605699,
          "pct": 0.0445611105694233,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Secundaria",
          "n": 598.044254582685,
          "pct": 0.46612958268331,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Educación superior",
          "n": 627.783840556748,
          "pct": 0.489309306747272,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "M4_employment",
      "variable_origen": null,
      "etiqueta": "¿Cuál describe mejor su situación laboral actual?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Datos Generales",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Trabaja en empleo formal o en una actividad formal generadora de ingresos",
          "n": 558.114538684673,
          "pct": 0.435007434672389,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Trabaja en empleo informal o en una actividad informal generadora de ingresos",
          "n": 350.264410467046,
          "pct": 0.273004217043684,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "No trabaja actualmente, pero está buscando trabajo",
          "n": 70.7868916975435,
          "pct": 0.0551729475429024,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "No trabaja actualmente y no está buscando trabajo",
          "n": 241.156869515407,
          "pct": 0.187963265405618,
          "especial": false
        },
        {
          "codigo": "98",
          "etiqueta": "No sabe",
          "n": 4.30444873732452,
          "pct": 0.00335498732449302,
          "especial": false
        },
        {
          "codigo": "99",
          "etiqueta": "Prefiere no responder",
          "n": 58.3728408980114,
          "pct": 0.045497148010921,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A1_leg",
      "variable_origen": null,
      "etiqueta": "Las personas refugiadas suelen huir de su país debido a violencia, conflictos o persecución.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 20.3213076491811,
          "pct": 0.0158388991809674,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 88.3279073225438,
          "pct": 0.0688448225429026,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 167.736831732646,
          "pct": 0.130737982644307,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 649.913119881045,
          "pct": 0.506557381045243,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 356.700833414588,
          "pct": 0.278020914586586,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A2_leg_inv",
      "variable_origen": null,
      "etiqueta": "La mayoría de las personas que llegan como refugiadas vienen principalmente por razones económicas.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 11.9147553870906,
          "pct": 0.00928663709048373,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 51.882000536272,
          "pct": 0.0404380362714514,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 124.463728671023,
          "pct": 0.0970099210218422,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 672.636299605108,
          "pct": 0.524268355109205,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 422.103215800509,
          "pct": 0.328997050507023,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A3_int",
      "variable_origen": null,
      "etiqueta": "La mayoría de las personas refugiadas pueden integrarse exitosamente en la sociedad peruana.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 106.977130460219,
          "pct": 0.0833804602184097,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 255.769665317864,
          "pct": 0.199352817862716,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 369.49142770086,
          "pct": 0.287990200858037,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 442.220301774573,
          "pct": 0.344676774570986,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 108.541474746491,
          "pct": 0.0845997464898607,
          "especial": false
        }
      ],
      "total": {
        "n": 1283.00000000001,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A4_eco",
      "variable_origen": null,
      "etiqueta": "Las personas refugiadas pueden hacer una contribución positiva a la economía del país.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 123.695629997076,
          "pct": 0.0964112470748841,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 227.783633604721,
          "pct": 0.17753985471919,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 292.174289927849,
          "pct": 0.227727427847116,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 537.795107498052,
          "pct": 0.419169998049925,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 101.55133897231,
          "pct": 0.0791514723088934,
          "especial": false
        }
      ],
      "total": {
        "n": 1283.00000000001,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A5_soc",
      "variable_origen": null,
      "etiqueta": "La presencia de personas refugiadas puede enriquecer la vida social y cultural de la comunidad.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 124.463728671023,
          "pct": 0.0970099210218422,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 281.79870295437,
          "pct": 0.219640454368177,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 296.788824102966,
          "pct": 0.231324102964121,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 486.412402374223,
          "pct": 0.379121124219972,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 93.5363418974269,
          "pct": 0.072904397425898,
          "especial": false
        }
      ],
      "total": {
        "n": 1283.00000000001,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A6_sec_inv",
      "variable_origen": null,
      "etiqueta": "La llegada de personas refugiadas aumenta la inseguridad en la comunidad.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 22.3316245368567,
          "pct": 0.0174057868564745,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 67.1026138358041,
          "pct": 0.0523013358034328,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 278.910670704955,
          "pct": 0.2173894549532,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 507.191723259558,
          "pct": 0.395317009555386,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 407.463367662834,
          "pct": 0.317586412831516,
          "especial": false
        }
      ],
      "total": {
        "n": 1283.00000000001,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A7_trust",
      "variable_origen": null,
      "etiqueta": "Confío en que las personas refugiadas respetan las normas y leyes del país.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 236.541553480891,
          "pct": 0.184365980889237,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 460.964129899573,
          "pct": 0.359286149570986,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 364.188388138653,
          "pct": 0.283856888650549,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 189.069865444619,
          "pct": 0.147365444617786,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 32.2360630362717,
          "pct": 0.0251255362714511,
          "especial": false
        }
      ],
      "total": {
        "n": 1283.00000000001,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "B1_coex",
      "variable_origen": null,
      "etiqueta": "Me sentiría cómodo/a conviviendo con personas refugiadas en mi barrio.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Convivencia y contacto cotidiano",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 184.065652544853,
          "pct": 0.143465044851796,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 369.882982888068,
          "pct": 0.288295388065525,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 322.885414391578,
          "pct": 0.251664391575666,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 348.27926945203,
          "pct": 0.271456952028083,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 57.8866807234795,
          "pct": 0.0451182234789397,
          "especial": false
        }
      ],
      "total": {
        "n": 1283.00000000001,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "B2_inter",
      "variable_origen": null,
      "etiqueta": "Me sentiría cómodo/a comprando en un negocio atendido por personas refugiadas.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Convivencia y contacto cotidiano",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 46.9573809233623,
          "pct": 0.0365996733619349,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 208.016038782178,
          "pct": 0.162132532176289,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 224.585515917513,
          "pct": 0.175047167511702,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 645.109375731279,
          "pct": 0.502813231279253,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 158.331688645672,
          "pct": 0.123407395670828,
          "especial": false
        }
      ],
      "total": {
        "n": 1283.00000000001,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "B3_space",
      "variable_origen": null,
      "etiqueta": "Me sentiría cómodo/a si mis familiares compartieran espacios con personas refugiadas.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Convivencia y contacto cotidiano",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 120.794462509751,
          "pct": 0.0941500097503911,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 366.792605426094,
          "pct": 0.285886676092046,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 303.319070178434,
          "pct": 0.23641392843214,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 431.306013674925,
          "pct": 0.336169924922,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 60.787848210804,
          "pct": 0.0473794608034327,
          "especial": false
        }
      ],
      "total": {
        "n": 1283.00000000001,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "B4_dist_inv",
      "variable_origen": null,
      "etiqueta": "Me sentiría incómodo/a teniendo contacto cercano con personas refugiadas.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Convivencia y contacto cotidiano",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 108.851560184283,
          "pct": 0.0848414342823724,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 501.916830635728,
          "pct": 0.391205635725432,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 276.062826028668,
          "pct": 0.215169778666149,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 290.702674166343,
          "pct": 0.226580416341656,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 105.466108984985,
          "pct": 0.0822027349844003,
          "especial": false
        }
      ],
      "total": {
        "n": 1283.00000000001,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "C1_negative",
      "variable_origen": null,
      "etiqueta": "En comparación con el año pasado, ¿cree que los mensajes negativos sobre personas refugiadas han aumentado, disminuido o se mantienen igual?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Entorno informativo",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "Han_disminuido",
          "etiqueta": "Han disminuido",
          "n": 149.304965507997,
          "pct": 0.116371757995321,
          "especial": false
        },
        {
          "codigo": "Se_mantienen_igual",
          "etiqueta": "Se mantienen igual",
          "n": 382.228699176094,
          "pct": 0.297917926092046,
          "especial": false
        },
        {
          "codigo": "Han_aumentado",
          "etiqueta": "Han aumentado",
          "n": 751.466335315911,
          "pct": 0.585710315912637,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "C2_disc",
      "variable_origen": null,
      "etiqueta": "En comparación con el año pasado, ¿cree que los comentarios discriminatorios hacia personas refugiadas han aumentado, disminuido o se mantienen igual?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Entorno informativo",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "Han_disminuido",
          "etiqueta": "Han disminuido",
          "n": 179.57199383288,
          "pct": 0.139962582878317,
          "especial": false
        },
        {
          "codigo": "Se_mantienen_igual",
          "etiqueta": "Se mantienen igual",
          "n": 514.735571860376,
          "pct": 0.401196860374418,
          "especial": false
        },
        {
          "codigo": "Han_aumentado",
          "etiqueta": "Han aumentado",
          "n": 588.692434306748,
          "pct": 0.458840556747272,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "D1_messages",
      "variable_origen": null,
      "etiqueta": "¿Recuerda haber visto mensajes que promuevan solidaridad con personas refugiadas?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Exposición a acciones del proyecto",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Sí",
          "n": 574.580028519893,
          "pct": 0.447841019890799,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "No",
          "n": 702.914586705341,
          "pct": 0.547867955343214,
          "especial": false
        },
        {
          "codigo": "99",
          "etiqueta": "Prefiere no responder",
          "n": 5.50538477476603,
          "pct": 0.00429102476599068,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "D1_information",
      "variable_origen": null,
      "etiqueta": "Si respondió sí: ¿Dónde vio o escuchó esos mensajes?",
      "tipo": "multiple",
      "seccion": {
        "nombre": "Exposición a acciones del proyecto",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Redes sociales",
          "n": 375.321909613887,
          "pct": 0.653210851377324,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Televisión",
          "n": 173.972004070789,
          "pct": 0.302781153948107,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Radio",
          "n": 23.7349057868567,
          "pct": 0.0413082679674707,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "Internet / sitios web",
          "n": 68.290414635336,
          "pct": 0.11885274678142,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Eventos o actividades comunitarias",
          "n": 41.2496509360378,
          "pct": 0.0717909584193103,
          "especial": false
        },
        {
          "codigo": "6",
          "etiqueta": "Afiches o carteles en espacios públicos",
          "n": 40.0618501365058,
          "pct": 0.0697237080093166,
          "especial": false
        },
        {
          "codigo": "7",
          "etiqueta": "Amigos o familiares",
          "n": 104.318495758581,
          "pct": 0.181556076752796,
          "especial": false
        },
        {
          "codigo": "8",
          "etiqueta": "Instituciones públicas o municipales",
          "n": 54.9723779982454,
          "pct": 0.0956740145317149,
          "especial": false
        },
        {
          "codigo": "96",
          "etiqueta": "Otros",
          "n": 32.1414580489472,
          "pct": 0.0559390449607916,
          "especial": false
        }
      ],
      "total": {
        "n": 574.580028519893,
        "pct": 1
      },
      "base": {
        "n": 560,
        "de": 1283,
        "denominador": "marcaron_alguna_opcion"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "D1_information_recod",
      "variable_origen": "D1_information",
      "etiqueta": "Si respondió sí: ¿Dónde vio o escuchó esos mensajes? (Recodificada)",
      "tipo": "multiple",
      "seccion": {
        "nombre": "Exposición a acciones del proyecto",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Redes sociales",
          "n": 375.321909613887,
          "pct": 0.653210851377324,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Televisión",
          "n": 173.972004070789,
          "pct": 0.302781153948107,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Radio",
          "n": 23.7349057868567,
          "pct": 0.0413082679674707,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "Internet / sitios web",
          "n": 68.290414635336,
          "pct": 0.11885274678142,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Eventos o actividades comunitarias",
          "n": 41.2496509360378,
          "pct": 0.0717909584193103,
          "especial": false
        },
        {
          "codigo": "6",
          "etiqueta": "Afiches o carteles en espacios públicos",
          "n": 40.0618501365058,
          "pct": 0.0697237080093166,
          "especial": false
        },
        {
          "codigo": "7",
          "etiqueta": "Amigos o familiares",
          "n": 104.318495758581,
          "pct": 0.181556076752796,
          "especial": false
        },
        {
          "codigo": "8",
          "etiqueta": "Instituciones públicas o municipales",
          "n": 54.9723779982454,
          "pct": 0.0956740145317149,
          "especial": false
        },
        {
          "codigo": "9",
          "etiqueta": "Trabajo",
          "n": 7.11101123732456,
          "pct": 0.0123760153231263,
          "especial": false
        },
        {
          "codigo": "10",
          "etiqueta": "Centro religioso",
          "n": 5.50538477476603,
          "pct": 0.00958158046138115,
          "especial": false
        },
        {
          "codigo": "11",
          "etiqueta": "Centro educativo",
          "n": 5.50538477476603,
          "pct": 0.00958158046138115,
          "especial": false
        },
        {
          "codigo": "12",
          "etiqueta": "Espacios públicos",
          "n": 11.4154599746491,
          "pct": 0.0198674847854616,
          "especial": false
        },
        {
          "codigo": "96",
          "etiqueta": "Otros",
          "n": 2.60421728744152,
          "pct": 0.00453238392944136,
          "especial": false
        }
      ],
      "total": {
        "n": 574.580028519893,
        "pct": 1
      },
      "base": {
        "n": 560,
        "de": 1283,
        "denominador": "marcaron_alguna_opcion"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "D2_activity",
      "variable_origen": null,
      "etiqueta": "¿Ha participado en alguna actividad que promueva la integración de las personas refugiadas?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Exposición a acciones del proyecto",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Sí",
          "n": 124.261383458465,
          "pct": 0.0968522084633398,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "No",
          "n": 1150.62901447932,
          "pct": 0.896826979329169,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "No recuerda",
          "n": 8.10960206220755,
          "pct": 0.00632081220748837,
          "especial": false
        }
      ],
      "total": {
        "n": 1282.99999999999,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "E5_unhcr",
      "variable_origen": null,
      "etiqueta": "¿Sabe qué es ACNUR?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Conocimiento de ACNUR",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Sí",
          "n": 32.4515434867398,
          "pct": 0.0252934867394699,
          "especial": false
        },
        {
          "codigo": "0",
          "etiqueta": "No",
          "n": 1250.54845651326,
          "pct": 0.974706513260529,
          "especial": false
        }
      ],
      "total": {
        "n": 1282.99999999999,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "E6_impact",
      "variable_origen": null,
      "etiqueta": "¿El trabajo de ACNUR en el Perú tiene un impacto positivo?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Conocimiento de ACNUR",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 2.60421728744152,
          "pct": 0.0802494121275202,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 1.40328125000002,
          "pct": 0.043242357657762,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 12.8187412246491,
          "pct": 0.395011757449597,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 12.3194458122076,
          "pct": 0.37962588180872,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 3.30585791244153,
          "pct": 0.101870590956401,
          "especial": false
        }
      ],
      "total": {
        "n": 32.4515434867398,
        "pct": 1
      },
      "base": {
        "n": 37,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "E7_foreigners",
      "variable_origen": null,
      "etiqueta": "En su opinión, ¿quiénes son los principales beneficiarios de las actividades de ACNUR en el Perú?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Conocimiento de ACNUR",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Solo refugiados y migrantes",
          "n": 10.9161645622076,
          "pct": 0.336383524150958,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Principalmente refugiados y migrantes",
          "n": 6.61171582488306,
          "pct": 0.203741181912802,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Tanto refugiados como comunidad local por igual",
          "n": 7.11101123732456,
          "pct": 0.21912705755368,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "Principalmente la comunidad local",
          "n": 2.60421728744152,
          "pct": 0.0802494121275202,
          "especial": false
        },
        {
          "codigo": "98",
          "etiqueta": "No sabe / No opina",
          "n": 5.20843457488304,
          "pct": 0.16049882425504,
          "especial": false
        }
      ],
      "total": {
        "n": 32.4515434867398,
        "pct": 1
      },
      "base": {
        "n": 37,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    }
  ],
  "sin_tabla": [],
  "avisos": []
};

/** Respuesta real sin pesos. */
export const RESPUESTA_REAL_SIN_PESOS = {
  "ok": true,
  "base": {
    "nombre": "Monitoreo territorial",
    "bases_del_archivo": [
      "Monitoreo territorial"
    ],
    "n_bases": 1,
    "independientes": false
  },
  "fuente": "adaptados",
  "ponderado": false,
  "ponderacion": {
    "configurada": false,
    "estado": "sin_config",
    "modo": null,
    "peso_columna": null,
    "motivo": null,
    "n_efectivo": null,
    "deff": null,
    "sello": "Base sin ponderar",
    "escala": null
  },
  "casos": {
    "cuentan": 1283,
    "suma_pesos": 1283,
    "con_peso": 1283
  },
  "escala_pct": "proporcion",
  "opciones": {
    "orden": "original",
    "mostrar_todo": false,
    "incluir_secciones": false,
    "codigos_especiales": []
  },
  "limite": 500,
  "total_variables": 26,
  "devueltas": 26,
  "recortado": false,
  "tablas": [
    {
      "variable": "consent",
      "variable_origen": null,
      "etiqueta": "Si está de acuerdo con continuar con la encuesta, por favor, confirmar",
      "tipo": "unica",
      "seccion": {
        "nombre": "General",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Sí",
          "n": 1283,
          "pct": 1,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "whynotconsent",
      "variable_origen": null,
      "etiqueta": "Razón principal por la que decide no participar en la encuesta",
      "tipo": "unica",
      "seccion": {
        "nombre": "General",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": true,
      "filas": [],
      "total": {
        "n": 0,
        "pct": null
      },
      "base": {
        "n": 0,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": []
    },
    {
      "variable": "M5_district",
      "variable_origen": null,
      "etiqueta": "¿En qué distrito vive actualmente?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Datos Generales",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "smp",
          "etiqueta": "San Martín de Porres",
          "n": 222,
          "pct": 0.173031956352299,
          "especial": false
        },
        {
          "codigo": "sjl",
          "etiqueta": "San Juan de Lurigancho",
          "n": 207,
          "pct": 0.161340607950117,
          "especial": false
        },
        {
          "codigo": "chorrillos",
          "etiqueta": "Chorrillos",
          "n": 216,
          "pct": 0.168355416991426,
          "especial": false
        },
        {
          "codigo": "olivos",
          "etiqueta": "Los Olivos",
          "n": 204,
          "pct": 0.15900233826968,
          "especial": false
        },
        {
          "codigo": "ate",
          "etiqueta": "Ate (Vitarte)",
          "n": 210,
          "pct": 0.163678877630553,
          "especial": false
        },
        {
          "codigo": "sjm",
          "etiqueta": "San Juan de Miraflores",
          "n": 224,
          "pct": 0.174590802805924,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "E2_sex",
      "variable_origen": null,
      "etiqueta": "¿Cuál es su sexo?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Datos Generales",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Hombre",
          "n": 640,
          "pct": 0.498830865159782,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Mujer",
          "n": 641,
          "pct": 0.499610288386594,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Otros",
          "n": 2,
          "pct": 0.00155884645362432,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "M3_edu",
      "variable_origen": null,
      "etiqueta": "¿Cuál es el nivel educativo más alto que ha completado?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Datos Generales",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Primaria o menos",
          "n": 58,
          "pct": 0.0452065471551052,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Secundaria",
          "n": 597,
          "pct": 0.465315666406859,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Educación superior",
          "n": 628,
          "pct": 0.489477786438036,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "M4_employment",
      "variable_origen": null,
      "etiqueta": "¿Cuál describe mejor su situación laboral actual?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Datos Generales",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Trabaja en empleo formal o en una actividad formal generadora de ingresos",
          "n": 609,
          "pct": 0.474668745128605,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Trabaja en empleo informal o en una actividad informal generadora de ingresos",
          "n": 313,
          "pct": 0.243959469992206,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "No trabaja actualmente, pero está buscando trabajo",
          "n": 71,
          "pct": 0.0553390491036633,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "No trabaja actualmente y no está buscando trabajo",
          "n": 227,
          "pct": 0.17692907248636,
          "especial": false
        },
        {
          "codigo": "98",
          "etiqueta": "No sabe",
          "n": 4,
          "pct": 0.00311769290724864,
          "especial": false
        },
        {
          "codigo": "99",
          "etiqueta": "Prefiere no responder",
          "n": 59,
          "pct": 0.0459859703819174,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A1_leg",
      "variable_origen": null,
      "etiqueta": "Las personas refugiadas suelen huir de su país debido a violencia, conflictos o persecución.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 19,
          "pct": 0.014809041309431,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 96,
          "pct": 0.0748246297739673,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 180,
          "pct": 0.140296180826189,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 651,
          "pct": 0.507404520654716,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 337,
          "pct": 0.262665627435698,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A2_leg_inv",
      "variable_origen": null,
      "etiqueta": "La mayoría de las personas que llegan como refugiadas vienen principalmente por razones económicas.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 12,
          "pct": 0.00935307872174591,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 59,
          "pct": 0.0459859703819174,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 129,
          "pct": 0.100545596258769,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 672,
          "pct": 0.523772408417771,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 411,
          "pct": 0.320342946219797,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A3_int",
      "variable_origen": null,
      "etiqueta": "La mayoría de las personas refugiadas pueden integrarse exitosamente en la sociedad peruana.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 80,
          "pct": 0.0623538581449727,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 233,
          "pct": 0.181605611847233,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 385,
          "pct": 0.300077942322681,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 473,
          "pct": 0.368667186282151,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 112,
          "pct": 0.0872954014029618,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A4_eco",
      "variable_origen": null,
      "etiqueta": "Las personas refugiadas pueden hacer una contribución positiva a la economía del país.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 96,
          "pct": 0.0748246297739673,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 230,
          "pct": 0.179267342166797,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 299,
          "pct": 0.233047544816836,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 546,
          "pct": 0.425565081839439,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 112,
          "pct": 0.0872954014029618,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A5_soc",
      "variable_origen": null,
      "etiqueta": "La presencia de personas refugiadas puede enriquecer la vida social y cultural de la comunidad.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 129,
          "pct": 0.100545596258769,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 258,
          "pct": 0.201091192517537,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 307,
          "pct": 0.239282930631333,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 487,
          "pct": 0.379579111457521,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 102,
          "pct": 0.0795011691348402,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A6_sec_inv",
      "variable_origen": null,
      "etiqueta": "La llegada de personas refugiadas aumenta la inseguridad en la comunidad.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 24,
          "pct": 0.0187061574434918,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 75,
          "pct": 0.0584567420109119,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 261,
          "pct": 0.203429462197974,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 535,
          "pct": 0.416991426344505,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 388,
          "pct": 0.302416212003118,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "A7_trust",
      "variable_origen": null,
      "etiqueta": "Confío en que las personas refugiadas respetan las normas y leyes del país.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Actitudes centrales y percepción",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 212,
          "pct": 0.165237724084178,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 455,
          "pct": 0.354637568199532,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 381,
          "pct": 0.296960249415433,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 204,
          "pct": 0.15900233826968,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 31,
          "pct": 0.0241621200311769,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "B1_coex",
      "variable_origen": null,
      "etiqueta": "Me sentiría cómodo/a conviviendo con personas refugiadas en mi barrio.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Convivencia y contacto cotidiano",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 155,
          "pct": 0.120810600155885,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 382,
          "pct": 0.297739672642245,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 313,
          "pct": 0.243959469992206,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 369,
          "pct": 0.287607170693687,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 64,
          "pct": 0.0498830865159782,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "B2_inter",
      "variable_origen": null,
      "etiqueta": "Me sentiría cómodo/a comprando en un negocio atendido por personas refugiadas.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Convivencia y contacto cotidiano",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 47,
          "pct": 0.0366328916601715,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 187,
          "pct": 0.145752143413874,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 229,
          "pct": 0.178487918939984,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 647,
          "pct": 0.504286827747467,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 173,
          "pct": 0.134840218238504,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "B3_space",
      "variable_origen": null,
      "etiqueta": "Me sentiría cómodo/a si mis familiares compartieran espacios con personas refugiadas.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Convivencia y contacto cotidiano",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 94,
          "pct": 0.0732657833203429,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 384,
          "pct": 0.299298519095869,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 322,
          "pct": 0.250974279033515,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 417,
          "pct": 0.32501948558067,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 66,
          "pct": 0.0514419329696025,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "B4_dist_inv",
      "variable_origen": null,
      "etiqueta": "Me sentiría incómodo/a teniendo contacto cercano con personas refugiadas.",
      "tipo": "unica",
      "seccion": {
        "nombre": "Convivencia y contacto cotidiano",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 116,
          "pct": 0.0904130943102104,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 497,
          "pct": 0.387373343725643,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 286,
          "pct": 0.222915042868277,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 309,
          "pct": 0.240841777084957,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 75,
          "pct": 0.0584567420109119,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "C1_negative",
      "variable_origen": null,
      "etiqueta": "En comparación con el año pasado, ¿cree que los mensajes negativos sobre personas refugiadas han aumentado, disminuido o se mantienen igual?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Entorno informativo",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "Han_disminuido",
          "etiqueta": "Han disminuido",
          "n": 158,
          "pct": 0.123148869836321,
          "especial": false
        },
        {
          "codigo": "Se_mantienen_igual",
          "etiqueta": "Se mantienen igual",
          "n": 406,
          "pct": 0.316445830085737,
          "especial": false
        },
        {
          "codigo": "Han_aumentado",
          "etiqueta": "Han aumentado",
          "n": 719,
          "pct": 0.560405300077942,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "C2_disc",
      "variable_origen": null,
      "etiqueta": "En comparación con el año pasado, ¿cree que los comentarios discriminatorios hacia personas refugiadas han aumentado, disminuido o se mantienen igual?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Entorno informativo",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "Han_disminuido",
          "etiqueta": "Han disminuido",
          "n": 155,
          "pct": 0.120810600155885,
          "especial": false
        },
        {
          "codigo": "Se_mantienen_igual",
          "etiqueta": "Se mantienen igual",
          "n": 511,
          "pct": 0.398285268901013,
          "especial": false
        },
        {
          "codigo": "Han_aumentado",
          "etiqueta": "Han aumentado",
          "n": 617,
          "pct": 0.480904130943102,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "D1_messages",
      "variable_origen": null,
      "etiqueta": "¿Recuerda haber visto mensajes que promuevan solidaridad con personas refugiadas?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Exposición a acciones del proyecto",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Sí",
          "n": 560,
          "pct": 0.436477007014809,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "No",
          "n": 718,
          "pct": 0.55962587685113,
          "especial": false
        },
        {
          "codigo": "99",
          "etiqueta": "Prefiere no responder",
          "n": 5,
          "pct": 0.00389711613406079,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "D1_information",
      "variable_origen": null,
      "etiqueta": "Si respondió sí: ¿Dónde vio o escuchó esos mensajes?",
      "tipo": "multiple",
      "seccion": {
        "nombre": "Exposición a acciones del proyecto",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Redes sociales",
          "n": 355,
          "pct": 0.633928571428571,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Televisión",
          "n": 152,
          "pct": 0.271428571428571,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Radio",
          "n": 26,
          "pct": 0.0464285714285714,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "Internet / sitios web",
          "n": 71,
          "pct": 0.126785714285714,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Eventos o actividades comunitarias",
          "n": 41,
          "pct": 0.0732142857142857,
          "especial": false
        },
        {
          "codigo": "6",
          "etiqueta": "Afiches o carteles en espacios públicos",
          "n": 45,
          "pct": 0.0803571428571429,
          "especial": false
        },
        {
          "codigo": "7",
          "etiqueta": "Amigos o familiares",
          "n": 101,
          "pct": 0.180357142857143,
          "especial": false
        },
        {
          "codigo": "8",
          "etiqueta": "Instituciones públicas o municipales",
          "n": 57,
          "pct": 0.101785714285714,
          "especial": false
        },
        {
          "codigo": "96",
          "etiqueta": "Otros",
          "n": 33,
          "pct": 0.0589285714285714,
          "especial": false
        }
      ],
      "total": {
        "n": 560,
        "pct": 1
      },
      "base": {
        "n": 560,
        "de": 1283,
        "denominador": "marcaron_alguna_opcion"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "D1_information_recod",
      "variable_origen": "D1_information",
      "etiqueta": "Si respondió sí: ¿Dónde vio o escuchó esos mensajes? (Recodificada)",
      "tipo": "multiple",
      "seccion": {
        "nombre": "Exposición a acciones del proyecto",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Redes sociales",
          "n": 355,
          "pct": 0.633928571428571,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Televisión",
          "n": 152,
          "pct": 0.271428571428571,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Radio",
          "n": 26,
          "pct": 0.0464285714285714,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "Internet / sitios web",
          "n": 71,
          "pct": 0.126785714285714,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Eventos o actividades comunitarias",
          "n": 41,
          "pct": 0.0732142857142857,
          "especial": false
        },
        {
          "codigo": "6",
          "etiqueta": "Afiches o carteles en espacios públicos",
          "n": 45,
          "pct": 0.0803571428571429,
          "especial": false
        },
        {
          "codigo": "7",
          "etiqueta": "Amigos o familiares",
          "n": 101,
          "pct": 0.180357142857143,
          "especial": false
        },
        {
          "codigo": "8",
          "etiqueta": "Instituciones públicas o municipales",
          "n": 57,
          "pct": 0.101785714285714,
          "especial": false
        },
        {
          "codigo": "9",
          "etiqueta": "Trabajo",
          "n": 8,
          "pct": 0.0142857142857143,
          "especial": false
        },
        {
          "codigo": "10",
          "etiqueta": "Centro religioso",
          "n": 5,
          "pct": 0.00892857142857143,
          "especial": false
        },
        {
          "codigo": "11",
          "etiqueta": "Centro educativo",
          "n": 5,
          "pct": 0.00892857142857143,
          "especial": false
        },
        {
          "codigo": "12",
          "etiqueta": "Espacios públicos",
          "n": 12,
          "pct": 0.0214285714285714,
          "especial": false
        },
        {
          "codigo": "96",
          "etiqueta": "Otros",
          "n": 3,
          "pct": 0.00535714285714286,
          "especial": false
        }
      ],
      "total": {
        "n": 560,
        "pct": 1
      },
      "base": {
        "n": 560,
        "de": 1283,
        "denominador": "marcaron_alguna_opcion"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "D2_activity",
      "variable_origen": null,
      "etiqueta": "¿Ha participado en alguna actividad que promueva la integración de las personas refugiadas?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Exposición a acciones del proyecto",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Sí",
          "n": 128,
          "pct": 0.0997661730319564,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "No",
          "n": 1147,
          "pct": 0.893998441153546,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "No recuerda",
          "n": 8,
          "pct": 0.00623538581449727,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "E5_unhcr",
      "variable_origen": null,
      "etiqueta": "¿Sabe qué es ACNUR?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Conocimiento de ACNUR",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Sí",
          "n": 37,
          "pct": 0.0288386593920499,
          "especial": false
        },
        {
          "codigo": "0",
          "etiqueta": "No",
          "n": 1246,
          "pct": 0.97116134060795,
          "especial": false
        }
      ],
      "total": {
        "n": 1283,
        "pct": 1
      },
      "base": {
        "n": 1283,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "E6_impact",
      "variable_origen": null,
      "etiqueta": "¿El trabajo de ACNUR en el Perú tiene un impacto positivo?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Conocimiento de ACNUR",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": true,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Totalmente en desacuerdo",
          "n": 3,
          "pct": 0.0810810810810811,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "En desacuerdo",
          "n": 2,
          "pct": 0.0540540540540541,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Ni de acuerdo ni en desacuerdo",
          "n": 14,
          "pct": 0.378378378378378,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "De acuerdo",
          "n": 14,
          "pct": 0.378378378378378,
          "especial": false
        },
        {
          "codigo": "5",
          "etiqueta": "Totalmente de acuerdo",
          "n": 4,
          "pct": 0.108108108108108,
          "especial": false
        }
      ],
      "total": {
        "n": 37,
        "pct": 1
      },
      "base": {
        "n": 37,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    },
    {
      "variable": "E7_foreigners",
      "variable_origen": null,
      "etiqueta": "En su opinión, ¿quiénes son los principales beneficiarios de las actividades de ACNUR en el Perú?",
      "tipo": "unica",
      "seccion": {
        "nombre": "Conocimiento de ACNUR",
        "rotulo": null
      },
      "orden": "original",
      "lista_ordinal": false,
      "sin_datos": false,
      "filas": [
        {
          "codigo": "1",
          "etiqueta": "Solo refugiados y migrantes",
          "n": 12,
          "pct": 0.324324324324324,
          "especial": false
        },
        {
          "codigo": "2",
          "etiqueta": "Principalmente refugiados y migrantes",
          "n": 8,
          "pct": 0.216216216216216,
          "especial": false
        },
        {
          "codigo": "3",
          "etiqueta": "Tanto refugiados como comunidad local por igual",
          "n": 8,
          "pct": 0.216216216216216,
          "especial": false
        },
        {
          "codigo": "4",
          "etiqueta": "Principalmente la comunidad local",
          "n": 3,
          "pct": 0.0810810810810811,
          "especial": false
        },
        {
          "codigo": "98",
          "etiqueta": "No sabe / No opina",
          "n": 6,
          "pct": 0.162162162162162,
          "especial": false
        }
      ],
      "total": {
        "n": 37,
        "pct": 1
      },
      "base": {
        "n": 37,
        "de": 1283,
        "denominador": "respondieron"
      },
      "resumen": [],
      "notas": [
        "Fuente: Pulso PUCP."
      ]
    }
  ],
  "sin_tabla": [],
  "avisos": []
};

const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
type Real = FrecuenciasPreview & { ponderacion: { sello?: string } };
const tabla = (r: Real, variable: string): FrecuenciasPreviewTabla => {
  const t = r.tablas.find((x) => x.variable === variable);
  if (!t) throw new Error(`El ejemplo real no trae ${variable}`);
  return t;
};

/**
 * AÑADIDA A MANO: la numérica. Los estadísticos son los de la respuesta v1 de
 * E1_age; la base, en casos sin ponderar como manda el contrato v2.
 */
export function numerica(): FrecuenciasPreviewTabla {
  return {
    variable: "E1_age", variable_origen: null, etiqueta: "¿Cuál es su edad?", tipo: "numerica",
    seccion: { nombre: "Datos Generales", rotulo: null }, orden: null, lista_ordinal: false, sin_datos: false,
    filas: [], total: { n: null, pct: null },
    base: { n: 1283, de: 1283, denominador: "casos_validos" },
    resumen: [
      { estadistico: "Casos válidos", valor: 1283 }, { estadistico: "Promedio", valor: 47.8 },
      { estadistico: "Desviación estándar", valor: 16.3 }, { estadistico: "Mínimo", valor: 18 },
      { estadistico: "Percentil 25", valor: 35 }, { estadistico: "Mediana (Percentil 50)", valor: 46 },
      { estadistico: "Percentil 75", valor: 59 }, { estadistico: "Máximo", valor: 91 },
    ],
    notas: ["Fuente: Pulso PUCP."],
  };
}

/** Una hoja corta del ejemplo real: la numérica, una única y una múltiple, en ese orden. */
function hojaCorta(r: Real): Real {
  const empleo = tabla(r, "M4_employment");
  // AÑADIDO A MANO: el ejemplo no declara códigos especiales.
  empleo.filas = empleo.filas.map((f) => ({ ...f, especial: f.codigo === "98" || f.codigo === "99" }));
  return { ...r, devueltas: 3, recortado: false, tablas: [numerica(), empleo, tabla(r, "D1_information")] };
}

/** Con pesos: la respuesta real, recortada a la numérica, M4_employment y D1_information. */
export function respuestaReal(): Real {
  return hojaCorta(copia(RESPUESTA_REAL) as unknown as Real);
}

/** Sin pesos: igual, de la respuesta real sin pesos, con una fila sin código. */
export function respuestaSinPesos(): FrecuenciasPreview {
  const r = hojaCorta(copia(RESPUESTA_REAL_SIN_PESOS) as unknown as Real);
  // AÑADIDO A MANO: el motor deja el código vacío cuando dos opciones comparten rótulo.
  r.tablas[1].filas[2] = { ...r.tablas[1].filas[2], codigo: null };
  return r;
}

/** Una tabla del ejemplo real, por su nombre. */
export function tablaReal(variable: string, conPesos = true): FrecuenciasPreviewTabla {
  return copia(tabla((conPesos ? RESPUESTA_REAL : RESPUESTA_REAL_SIN_PESOS) as unknown as Real, variable));
}

/** La hoja recortada: el archivo tiene 120 tablas y llegan las primeras. */
export function respuestaRecortada(devueltas = 3, total = 120): FrecuenciasPreview {
  const r = respuestaReal();
  return { ...r, limite: devueltas, total_variables: total, devueltas, recortado: true };
}

/** Dos bases: la vista previa es de la activa. */
export function respuestaDosBases(): FrecuenciasPreview {
  const r = respuestaReal();
  return { ...r, base: { ...r.base, bases_del_archivo: ["Monitoreo territorial", "Seguimiento"], n_bases: 2 } };
}

/** Una sola tabla, pedida por su nombre. */
export function respuestaDeUna(variable: string, etiqueta: string): FrecuenciasPreview {
  const r = respuestaReal();
  const t = { ...copia(r.tablas[1]), variable, etiqueta, seccion: { nombre: "Ingresos", rotulo: null } };
  return { ...r, limite: 1, total_variables: 120, devueltas: 1, recortado: false, tablas: [t] };
}

/** Pedida por su nombre, sin tabla en el archivo. */
export function respuestaSinTabla(variable: string, motivo: FrecuenciasPreview["sin_tabla"][number]["motivo"]): FrecuenciasPreview {
  const r = respuestaReal();
  return {
    ...r, limite: 1, total_variables: 26, devueltas: 0, recortado: false, tablas: [],
    sin_tabla: [{ variable, motivo }],
    avisos: [{ codigo: "variables_sin_tabla", mensaje: `1 variable pedida no tiene tabla en el archivo: ${variable}.` }],
  };
}

/** El archivo no tendría tablas. */
export function respuestaVacia(): FrecuenciasPreview {
  const r = respuestaReal();
  return {
    ...r, total_variables: 0, devueltas: 0, recortado: false, tablas: [],
    avisos: [{ codigo: "sin_tablas", mensaje: "El archivo no tendría tablas: ninguna variable de las secciones configuradas está en esta base." }],
  };
}
