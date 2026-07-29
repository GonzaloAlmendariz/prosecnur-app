import { describe, expect, test } from "vitest";
import { acreditacionSerieDeEstados } from "./AcreditacionFotografiasDeEstado";
import { acreditacionDeclaracionesDesdeReglas } from "./AcreditacionEstadosLlamada";
import type { MonitoreoStateRule } from "../../../../api/client";

// Regla de dominio: los estados telefónicos son FOTOGRAFÍAS del momento, no
// eventos. La base tiene N casos y cada caso tiene un solo estado a la vez, así
// que cada actualización reparte esos mismos N casos de otra forma.
//
// El error que estas pruebas existen para impedir es el reflejo natural al leer
// «estados por día»: tratarlos como un histograma y sumarlos. Eso contaría el
// mismo caso una vez por corte y produciría un total que crece solo.

describe("una fotografía por día, la última", () => {
  test("dos actualizaciones el mismo día: manda la última, la otra se descarta entera", () => {
    const serie = acreditacionSerieDeEstados([
      { cutAt: "2026-06-05T09:00:00", estado: "Efectivo", casos: 40 },
      { cutAt: "2026-06-05T09:00:00", estado: "No contesta", casos: 60 },
      { cutAt: "2026-06-05T18:00:00", estado: "Efectivo", casos: 55 },
      { cutAt: "2026-06-05T18:00:00", estado: "No contesta", casos: 45 },
    ]);

    expect(serie.fotografias).toHaveLength(1);
    const [foto] = serie.fotografias;
    // 55 y 45, no 95 y 105: la fotografía de la mañana no se suma.
    expect(foto.porFamilia.efectivo).toBe(55);
    expect(foto.porFamilia.sin_contacto).toBe(45);
    expect(foto.total).toBe(100);
    expect(foto.cutAt).toBe("2026-06-05T18:00:00");
  });

  test("el total se mantiene estable entre días: es redistribución, no producción", () => {
    const serie = acreditacionSerieDeEstados([
      { cutAt: "2026-06-05T18:00:00", estado: "Efectivo", casos: 20 },
      { cutAt: "2026-06-05T18:00:00", estado: "No barrido", casos: 80 },
      { cutAt: "2026-06-06T18:00:00", estado: "Efectivo", casos: 45 },
      { cutAt: "2026-06-06T18:00:00", estado: "No barrido", casos: 55 },
    ]);

    expect(serie.fotografias.map((f) => f.total)).toEqual([100, 100]);
    expect(serie.totalInestable).toBe(false);
    // Lo que cambia es el reparto: 20 → 45 efectivos sobre la MISMA base.
    expect(serie.fotografias.map((f) => f.porFamilia.efectivo)).toEqual([20, 45]);
  });

  test("un total que se mueve se declara, no se suaviza", () => {
    // Significa que la base cambió de tamaño o que la fuente mezcló cortes.
    // Las dos cosas hay que verlas.
    const serie = acreditacionSerieDeEstados([
      { cutAt: "2026-06-05", estado: "Efectivo", casos: 100 },
      { cutAt: "2026-06-06", estado: "Efectivo", casos: 130 },
    ]);
    expect(serie.totalInestable).toBe(true);
    expect(serie.fotografias.map((f) => f.total)).toEqual([100, 130]);
  });

  test("los días salen ordenados y sin huecos inventados", () => {
    const serie = acreditacionSerieDeEstados([
      { cutAt: "2026-06-07", estado: "Efectivo", casos: 10 },
      { cutAt: "2026-06-05", estado: "Efectivo", casos: 10 },
    ]);
    expect(serie.fotografias.map((f) => f.dia)).toEqual(["2026-06-05", "2026-06-07"]);
  });
});

describe("agrupación y declaraciones", () => {
  test("respeta lo que el usuario confirmó en el definidor", () => {
    const declaraciones = acreditacionDeclaracionesDesdeReglas([{
      id: "estado-efectivo",
      label: "Efectivo",
      final_state: "efectivo",
      priority: 100,
      outcome_values: ["Contactado por WhatsApp"],
      stop_contact: false,
    } as MonitoreoStateRule]);

    const serie = acreditacionSerieDeEstados([
      { cutAt: "2026-06-05", estado: "Efectivo", casos: 40 },
      { cutAt: "2026-06-05", estado: "Contactado por WhatsApp", casos: 5 },
    ], declaraciones);

    // Sin la declaración, WhatsApp caería en sin_contacto.
    expect(serie.fotografias[0].porFamilia.efectivo).toBe(45);
    expect(serie.fotografias[0].porFamilia.sin_contacto).toBe(0);
  });

  test("las once categorías reales de acrconta caben en las seis familias", () => {
    const crudos = [
      "Efectivo", "No contesta", "Apagado", "No barrido", "Número Incorrrecto",
      "No efectivo / Fuera de servicio", "No existe el número", "Contactar después",
      "Rechazo", "Número suspendido", "Contactado por WhatsApp",
    ];
    const serie = acreditacionSerieDeEstados(
      crudos.map((estado) => ({ cutAt: "2026-07-23", estado, casos: 10 })),
    );
    expect(serie.fotografias).toHaveLength(1);
    expect(serie.fotografias[0].total).toBe(110);
    // Ninguna cae en «otro»: la heurística cubre el vocabulario real.
    expect(serie.fotografias[0].porFamilia.otro).toBe(0);
  });

  test("fechas ilegibles y conteos vacíos no crean puntos fantasma", () => {
    const serie = acreditacionSerieDeEstados([
      { cutAt: "", estado: "Efectivo", casos: 10 },
      { cutAt: "no es fecha", estado: "Efectivo", casos: 10 },
      { cutAt: "2026-06-05", estado: "Efectivo", casos: 0 },
    ]);
    expect(serie.fotografias).toHaveLength(0);
  });
});
