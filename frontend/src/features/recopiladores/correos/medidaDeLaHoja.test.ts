// La vista previa del correo se mide solo a la vista (QA de Contactos,
// 2026-10-22): si el editor carga oculto —enlace a Contactos y luego Editor,
// teclear y cambiar de pestaña antes del repintado, «Importar la lista» desde
// el vacío—, el iframe se quedaba en 319 px con `scrolling="no"` y el correo no
// se alcanzaba. La medida tomada a oscuras queda pendiente y se aplica al volver.
import { describe, expect, it } from "vitest";

import { ALTO_MINIMO_DE_LA_HOJA, crearMedidorDeLaHoja, medirLaHoja, type DocumentoMedible, type MedidaDeLaHoja } from "./medidaDeLaHoja";

function documento(alto: number, ancho = 600): DocumentoMedible {
  return { documentElement: { scrollHeight: alto, scrollWidth: ancho }, body: { scrollWidth: ancho } };
}

describe("medirLaHoja", () => {
  it("oculto (sin ancho) o sin layout no mide: no devuelve el mínimo como si fuera el alto", () => {
    expect(medirLaHoja(documento(0), 0)).toBeNull();
    expect(medirLaHoja(documento(2380), 0)).toBeNull();
    expect(medirLaHoja(documento(0), 900)).toBeNull();
    expect(medirLaHoja(null, 900)).toBeNull();
    // A media carga el iframe no tiene raíz: no revienta.
    expect(medirLaHoja({ documentElement: null, body: null }, 900)).toBeNull();
  });

  it("a la vista mide el documento entero, con el mínimo como piso", () => {
    expect(medirLaHoja(documento(2380), 900)).toEqual({ alto: 2380, ancho: 600 });
    expect(medirLaHoja(documento(120), 900)?.alto).toBe(ALTO_MINIMO_DE_LA_HOJA);
  });
});

describe("crearMedidorDeLaHoja", () => {
  function montar() {
    const estado = { doc: documento(0) as DocumentoMedible, ancho: 0 };
    const aplicadas: MedidaDeLaHoja[] = [];
    const medidor = crearMedidorDeLaHoja({
      doc: () => estado.doc,
      anchoVisible: () => estado.ancho,
      aplicar: (m) => aplicadas.push(m),
    });
    return { estado, aplicadas, medidor };
  }

  it("el documento que carga con la pestaña oculta se mide al volver a la vista", () => {
    const { estado, aplicadas, medidor } = montar();
    medidor.alCargar(); // carga oculto: nada que aplicar
    expect(aplicadas).toEqual([]);
    // La pestaña Editor vuelve: el lienzo recupera ancho y el documento layout.
    estado.ancho = 1100;
    estado.doc = documento(2380);
    medidor.alRedimensionar();
    expect(aplicadas.at(-1)).toEqual({ alto: 2380, ancho: 600 });
  });

  it("un resize sin cambio no vuelve a aplicar; uno que cambia el alto sí", () => {
    const { estado, aplicadas, medidor } = montar();
    estado.ancho = 1100;
    estado.doc = documento(1974);
    medidor.alCargar();
    medidor.alRedimensionar();
    expect(aplicadas).toHaveLength(1);
    estado.doc = documento(2100);
    medidor.alRedimensionar();
    expect(aplicadas.map((m) => m.alto)).toEqual([1974, 2100]);
  });

  it("una medida a oscuras después de otra buena no la pisa con el mínimo", () => {
    const { estado, aplicadas, medidor } = montar();
    estado.ancho = 1100;
    estado.doc = documento(2380);
    medidor.alCargar();
    estado.ancho = 0;
    estado.doc = documento(0);
    medidor.alCargar(); // se re-renderiza oculto
    expect(aplicadas.map((m) => m.alto)).toEqual([2380]);
    estado.ancho = 1100;
    estado.doc = documento(2380);
    medidor.alRedimensionar(); // pendiente: se aplica aunque no cambió
    expect(aplicadas.map((m) => m.alto)).toEqual([2380, 2380]);
  });
});
