import { describe, expect, it } from "vitest";

import { UMBRAL_DE_RIESGO, agendamiento } from "./agendamiento";

const aula = (o: Record<string, unknown>) => ({ sample_role: "titular", ...o });

describe("agendamiento", () => {
  it("no cuenta lo que nadie va a agendar", () => {
    // El banco no cuelga de ningún titular y una reemplazada ya no se visita:
    // meterlas en el denominador diría que falta trabajo que no existe.
    const r = agendamiento([
      aula({ scheduled_date: "2026-09-01" }),
      aula({ sample_role: "extra_reserve_pool" }),
      aula({ sample_status: "reemplazada", scheduled_date: "2026-09-02" }),
    ]);
    expect(r.enJuego).toBe(1);
    expect(r.agendadas).toBe(1);
    expect(r.porAgendar).toBe(0);
  });

  it("agendada es la que tiene FECHA, no la que lo dice el estado", () => {
    // Cuando el estado y el hecho discrepan manda el hecho: una fila «agendada»
    // sin fecha no se puede visitar.
    const r = agendamiento([
      aula({ sample_status: "agendada" }),
      aula({ sample_status: "sin_contactar", scheduled_date: "2026-09-01" }),
    ]);
    expect(r.agendadas).toBe(1);
    expect(r.porAgendar).toBe(1);
  });

  it("la insistencia son los que pasaron de una gestión", () => {
    const r = agendamiento([
      aula({ contact_attempts: 1 }), aula({ contact_attempts: 3 }),
      aula({ contact_attempts: 5 }), aula({ contact_attempts: 0 }),
    ]);
    expect(r.conInsistencia).toBe(2);
    // Mediana de 1, 3, 5 —el cero no registra gestión y no entra—.
    expect(r.intentosMedianos).toBe(3);
  });

  it("sin ninguna gestión registrada no inventa una mediana", () => {
    // «0 intentos de media» diría que nadie llamó; `null` dice que no consta.
    expect(agendamiento([aula({})]).intentosMedianos).toBeNull();
  });

  it("los medios van de más a menos, y el vacío no es un medio", () => {
    const r = agendamiento([
      aula({ contact_medium: "Correo" }), aula({ contact_medium: "Llamada" }),
      aula({ contact_medium: "Llamada" }), aula({ contact_medium: "  " }),
    ]);
    expect(r.medios).toEqual([{ medio: "Llamada", aulas: 2 }, { medio: "Correo", aulas: 1 }]);
  });
});

/**
 * **Aplicada sin fecha agendada: un descuadre, no un estado del operativo.**
 *
 * Regla del operativo (Gonzalo, 2026-08-24): «si no se agenda un aula, no se
 * aplica; esa situación no puede suceder». La primera versión de este test
 * llamaba al caso «aplicadas sin cita previa» y lo daba por bueno, porque mi
 * simulación de campo aplicaba sin agendar antes — fabriqué un imposible y
 * después escribí UI que lo normalizaba.
 *
 * Se cuenta y no se bloquea: la combinación puede llegar del Excel por un error
 * de transcripción —falta la fecha en la agenda, o el parte se anotó en la fila
 * equivocada— y rechazar la importación perdería un parte real. Descartarlo en
 * silencio lo escondería.
 */
describe("agendamiento · una aplicada sin agenda es un descuadre", () => {
  const fila = (over: Record<string, unknown>) =>
    ({ sample_role: "titular", sample_status: "agendada", ...over }) as never;

  it("no cuenta como por agendar: no hay cita que cerrar, hay algo que revisar", () => {
    const r = agendamiento([
      fila({ operational_status: "aplicada" }),
      fila({ operational_status: "planificada" }),
    ]);
    expect(r.enJuego).toBe(2);
    expect(r.agendadas).toBe(0);
    expect(r.aplicadasSinAgenda).toBe(1);
    expect(r.porAgendar).toBe(1);
  });

  it("una aplicada CON fecha sigue contando como agendada", () => {
    // Se agendó y además se aplicó: el hecho de la fecha manda, como ya decía
    // el comentario del bucle.
    const r = agendamiento([
      fila({ operational_status: "aplicada", scheduled_date: "2026-09-01" }),
    ]);
    expect(r.agendadas).toBe(1);
    expect(r.aplicadasSinAgenda).toBe(0);
    expect(r.porAgendar).toBe(0);
  });

  it("las tres cifras siguen particionando el total en juego", () => {
    const r = agendamiento([
      fila({ operational_status: "aplicada" }),
      fila({ scheduled_date: "2026-09-02" }),
      fila({}),
      fila({}),
    ]);
    expect(r.agendadas + r.aplicadasSinAgenda + r.porAgendar).toBe(r.enJuego);
  });

  describe("el umbral de riesgo, medido en 2025", () => {
    it("cuenta las que van por la tercera gestión y siguen sin fecha", () => {
      const r = agendamiento([
        { sample_role: "titular", contact_attempts: 1 },
        { sample_role: "titular", contact_attempts: 2 },
        { sample_role: "titular", contact_attempts: 3 },
        { sample_role: "titular", contact_attempts: 5 },
      ]);
      expect(r.enUmbralDeRiesgo).toBe(2);
      expect(UMBRAL_DE_RIESGO).toBe(3);
    });

    it("una que costó cuatro llamadas pero YA está agendada no es riesgo", () => {
      // Es una historia, no un pronóstico: el riesgo mide lo que puede caerse
      // todavía, y una con fecha cerrada ya no se cae por no contactarla.
      const r = agendamiento([
        { sample_role: "titular", contact_attempts: 4, scheduled_date: "2026-09-10" },
        { sample_role: "titular", contact_attempts: 4 },
      ]);
      expect(r.enUmbralDeRiesgo).toBe(1);
      expect(r.conInsistencia).toBe(2);
    });

    it("sin medio de contacto se cuenta aparte, y sólo si sigue sin fecha", () => {
      const r = agendamiento([
        { sample_role: "titular" },
        { sample_role: "titular", contact_medium: "Llamada" },
        { sample_role: "titular", scheduled_date: "2026-09-10" },
      ]);
      expect(r.sinMedioDeContacto).toBe(1);
    });

    it("una reserva dormida no entra en ningún riesgo: nadie la va a llamar", () => {
      const r = agendamiento([
        { sample_role: "chain_reserve", sample_status: "", contact_attempts: 6 },
        { sample_role: "chain_reserve", sample_status: "en_reserva" },
      ]);
      expect(r.enUmbralDeRiesgo).toBe(0);
      expect(r.sinMedioDeContacto).toBe(0);
    });
  });

  describe("la distribución de gestiones, que la mediana esconde", () => {
    it("agrupa por número de llamadas y marca el tramo en riesgo", () => {
      const r = agendamiento([
        { sample_role: "titular", contact_attempts: 1 },
        { sample_role: "titular", contact_attempts: 1 },
        { sample_role: "titular", contact_attempts: 2 },
        { sample_role: "titular", contact_attempts: 4 },
      ]);
      expect(r.distribucionDeGestiones).toEqual([
        { gestiones: 1, aulas: 2, enRiesgo: false },
        { gestiones: 2, aulas: 1, enRiesgo: false },
        { gestiones: 4, aulas: 1, enRiesgo: true },
      ]);
    });

    it("la mediana no basta: con mediana 2 puede haber cola larga", () => {
      // El caso de 2025: mediana 2 y aun así 33 de 170 en la cuarta o más. Un
      // tile con la mediana da la misma cifra con cola y sin ella.
      const conCola = agendamiento([
        ...Array.from({ length: 6 }, () => ({ sample_role: "titular", contact_attempts: 2 })),
        ...Array.from({ length: 3 }, () => ({ sample_role: "titular", contact_attempts: 6 })),
      ]);
      const sinCola = agendamiento(
        Array.from({ length: 9 }, () => ({ sample_role: "titular", contact_attempts: 2 })),
      );
      expect(conCola.intentosMedianos).toBe(sinCola.intentosMedianos);
      expect(conCola.distribucionDeGestiones).not.toEqual(sinCola.distribucionDeGestiones);
    });

    it("sin gestiones anotadas la distribución va vacía, no en cero", () => {
      // Una barra única en cero se leería como «todas salen a la primera», que
      // es lo contrario de que nadie apuntó nada.
      const r = agendamiento([{ sample_role: "titular" }, { sample_role: "titular" }]);
      expect(r.distribucionDeGestiones).toEqual([]);
    });

    it("las reservas dormidas no entran en la distribución", () => {
      const r = agendamiento([
        { sample_role: "chain_reserve", sample_status: "", contact_attempts: 5 },
        { sample_role: "titular", contact_attempts: 1 },
      ]);
      expect(r.distribucionDeGestiones).toEqual([{ gestiones: 1, aulas: 1, enRiesgo: false }]);
    });
  });
});

describe("fecha prevista no es cita cerrada", () => {
  /**
   * `scheduled_date` sale de la columna «FECHA AGENDADA» del Excel, que llega
   * **pre-rellenada con la fecha prevista de cada curso-horario**. La prueba
   * está en las reservas dormidas: las 1.173 la traen sin que nadie las haya
   * agendado, y **1.137 con fecha distinta de la de su titular** —la de su
   * propio curso, no una heredada—.
   *
   * Contar «agendadas» por fecha sigue siendo correcto para «cuántas se pueden
   * visitar». Lo que no puede pasar es que «Por agendar 0» esconda a las que se
   * intentó agendar y no se logró: nueve en el corte de HSVG2026 «como 2025»,
   * con medio declarado y de tres a cinco gestiones.
   */
  it("cuenta las que tienen fecha y siguen sin contacto logrado", () => {
    const r = agendamiento([
      aula({ operational_code: "CH 1", scheduled_date: "2026-09-18", sample_status: "agendada", contact_attempts: 1 }),
      aula({ operational_code: "CH 2", scheduled_date: "2026-09-19", sample_status: "sin_contactar", operational_status: "agendada", contact_medium: "Llamada", contact_attempts: 3 }),
      aula({ operational_code: "CH 3", scheduled_date: "2026-09-20", sample_status: "sin_contactar", operational_status: "agendada", contact_medium: "Correo", contact_attempts: 5 }),
    ]);
    expect(r.agendadas).toBe(3);
    expect(r.porAgendar).toBe(0);
    // Las dos que nadie confirmó no desaparecen tras el «por agendar 0».
    expect(r.estadosEnDesacuerdo).toBe(2);
  });

  it("una sin fecha y sin contactar no cuenta aquí: ésa ya está en «por agendar»", () => {
    const r = agendamiento([
      aula({ operational_code: "CH 1", sample_status: "sin_contactar", contact_attempts: 2 }),
    ]);
    expect(r.porAgendar).toBe(1);
    expect(r.estadosEnDesacuerdo).toBe(0);
  });

  it("con todo confirmado no hay ninguna", () => {
    const r = agendamiento([
      aula({ operational_code: "CH 1", scheduled_date: "2026-09-18", sample_status: "agendada" }),
    ]);
    expect(r.estadosEnDesacuerdo).toBe(0);
  });
});

describe("los dos estados de la misma fila, en desacuerdo", () => {
  /**
   * `sample_status` y `operational_status` pueden contradecirse. La primera
   * versión de este contador miraba sólo el primero y decía «sin contacto
   * logrado», eligiendo uno de los dos como verdadero sin poder probarlo.
   *
   * Medido sobre HSVG2026 «como 2025», los tres pares del plan en juego:
   * agendada/aplicada 152 · agendada/agendada 13 · **sin_contactar/agendada 9**.
   */
  it("no cuenta una fila cuyo estado operativo también dice «sin contactar»", () => {
    // Ahí no hay contradicción: los dos dicen lo mismo, y esa fila está
    // simplemente por agendar.
    const r = agendamiento([
      aula({ operational_code: "CH 1", scheduled_date: "2026-09-18",
             sample_status: "sin_contactar", operational_status: "sin_contactar" }),
    ]);
    expect(r.estadosEnDesacuerdo).toBe(0);
  });

  it("cuenta también «aplicada» y «cerrada», no sólo «agendada»", () => {
    // Si el operativo dice que ya se aplicó, el «sin contactar» del otro campo
    // es todavía más contradictorio.
    const r = agendamiento([
      aula({ operational_code: "CH 1", scheduled_date: "2026-09-18",
             sample_status: "sin_contactar", operational_status: "aplicada" }),
      aula({ operational_code: "CH 2", scheduled_date: "2026-09-19",
             sample_status: "sin_contactar", operational_status: "cerrada" }),
    ]);
    expect(r.estadosEnDesacuerdo).toBe(2);
  });

  it("sin estado operativo no se afirma nada", () => {
    const r = agendamiento([
      aula({ operational_code: "CH 1", scheduled_date: "2026-09-18", sample_status: "sin_contactar" }),
    ]);
    expect(r.estadosEnDesacuerdo).toBe(0);
  });
});

describe("«sin medio de contacto» cuenta las que aún hay que agendar", () => {
  /**
   * La condición de la fecha estaba en el código y no en el nombre: se cuentan
   * sólo las que siguen sin fecha, porque una ya agendada no necesita que la
   * llamen. Medido sobre HSVG2026 «como 2025»: 33 de las 174 en juego no
   * declaran medio y el contador marca 0, porque las 174 tienen fecha.
   */
  it("una sin medio pero YA agendada no cuenta", () => {
    const r = agendamiento([
      aula({ operational_code: "CH 1", scheduled_date: "2026-09-18", sample_status: "agendada" }),
    ]);
    expect(r.sinMedioDeContacto).toBe(0);
  });

  it("una sin medio y sin fecha sí: no hay por dónde llamarla", () => {
    const r = agendamiento([
      aula({ operational_code: "CH 1", sample_status: "sin_contactar" }),
    ]);
    expect(r.sinMedioDeContacto).toBe(1);
  });

  it("con medio anotado no cuenta aunque siga sin fecha", () => {
    const r = agendamiento([
      aula({ operational_code: "CH 1", contact_medium: "Llamada", sample_status: "sin_contactar" }),
    ]);
    expect(r.sinMedioDeContacto).toBe(0);
  });
});
