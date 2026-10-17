// Glifos de los tipos de pregunta (identidad «Señales», 2026-10-17). Portados tal cual de la propuesta aprobada por
// Gonzalo (sello C): rejilla de 24, tres trazos como máximo, la forma dice el tipo y el color dice la familia.
// Clases de cada forma (las pinta sello.css):
//   t = trazo · a = relleno de acento · o = relleno que tapa con trazo · k = trazo que tapa · w = relleno que tapa
//   s = área translúcida
// «Tapar» es pintar con el fondo del sello, para que una forma se recorte sobre otra.

export type ClaseGlifo = "t" | "a" | "o" | "k" | "w" | "s";

export type FormaGlifo = {
  e: "path" | "circle" | "rect" | "text" | "g";
  c?: ClaseGlifo;
  a: Readonly<Record<string, string>>;
  h?: readonly FormaGlifo[];
  texto?: string;
};

export type Glifo = readonly FormaGlifo[];

export const GLIFOS_TIPO: Readonly<Record<string, Glifo>> = {
  select_one: [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"8.6"}},{e:"circle",c:"a",a:{cx:"12",cy:"12",r:"4"}}],
  select_multiple: [{e:"rect",c:"a",a:{x:"3.4",y:"3.4",width:"17.2",height:"17.2",rx:"4.4"}},{e:"path",c:"k",a:{d:"M7.6 12.4l3 3 5.8-6.6"}}],
  rank: [{e:"path",c:"t",a:{d:"M3 20.5v-7h6M15 13.5h6v7"}},{e:"rect",c:"a",a:{x:"8.5",y:"6",width:"7",height:"14.5",rx:"1.2"}},{e:"path",c:"t",a:{d:"M2.5 20.5h19"}}],
  text: [{e:"text",a:{x:"12",y:"17.2",textAnchor:"middle",fontSize:"14.5",letterSpacing:"-.6"},texto:"Aa"}],
  integer: [{e:"path",c:"t",a:{d:"M9.6 3.8 7.4 20.2M16.6 3.8l-2.2 16.4M4.4 9h16.2M3.4 15h16.2"}}],
  decimal: [{e:"text",a:{x:"13",y:"17.6",textAnchor:"middle",fontSize:"14",letterSpacing:"-.4"},texto:"1.5"}],
  range: [{e:"path",c:"t",a:{d:"M3 12h18"}},{e:"circle",c:"a",a:{cx:"14.5",cy:"12",r:"4.6"}},{e:"circle",c:"w",a:{cx:"14.5",cy:"12",r:"1.7"}}],
  date: [{e:"rect",c:"t",a:{x:"3.5",y:"5",width:"17",height:"15.5",rx:"3"}},{e:"path",c:"t",a:{d:"M3.5 10h17M8 3v4M16 3v4"}},{e:"rect",c:"a",a:{x:"7",y:"13",width:"4.6",height:"4.4",rx:"1"}}],
  time: [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"8.8"}},{e:"path",c:"t",a:{d:"M12 7v5.2l3.4 2.2"}}],
  datetime: [{e:"rect",c:"t",a:{x:"2.8",y:"4.2",width:"14",height:"13.6",rx:"2.6"}},{e:"path",c:"t",a:{d:"M2.8 8.6h14M6.6 2.6v3.2M13 2.6v3.2"}},{e:"circle",c:"o",a:{cx:"16.8",cy:"16.8",r:"5.2"}},{e:"path",c:"t",a:{d:"M16.8 14.3v2.7l1.8 1.1"}}],
  image: [{e:"rect",c:"t",a:{x:"2.8",y:"4.5",width:"18.4",height:"15",rx:"3"}},{e:"path",c:"a",a:{d:"M3.6 18.4l5.4-5.6 3.8 3.8 2.6-2.6 4.8 4.4z"}},{e:"circle",c:"a",a:{cx:"16.4",cy:"9",r:"1.9"}}],
  audio: [{e:"path",c:"t",a:{d:"M4 10v4M8 6.5v11M12 3.5v17M16 7.5v9M20 10v4"}}],
  video: [{e:"rect",c:"t",a:{x:"2.6",y:"5",width:"18.8",height:"14",rx:"3.4"}},{e:"path",c:"a",a:{d:"M10 8.8v6.4l5.4-3.2z"}}],
  file: [{e:"path",c:"t",a:{d:"M6 2.8h8.2l4.8 4.8v13.6H6z"}},{e:"path",c:"a",a:{d:"M14.2 2.8v4.8H19z"}}],
  barcode: [{e:"rect",c:"a",a:{x:"3",y:"4.5",width:"2.4",height:"15",rx:".5"}},{e:"rect",c:"a",a:{x:"6.8",y:"4.5",width:"1.2",height:"15",rx:".5"}},{e:"rect",c:"a",a:{x:"9.4",y:"4.5",width:"3",height:"15",rx:".5"}},{e:"rect",c:"a",a:{x:"13.6",y:"4.5",width:"1.2",height:"15",rx:".5"}},{e:"rect",c:"a",a:{x:"16.2",y:"4.5",width:"2.2",height:"15",rx:".5"}},{e:"rect",c:"a",a:{x:"19.6",y:"4.5",width:"1.4",height:"15",rx:".5"}}],
  geopoint: [{e:"path",c:"a",a:{d:"M12 21.5s-6.6-6.3-6.6-11.2a6.6 6.6 0 0 1 13.2 0c0 4.9-6.6 11.2-6.6 11.2z"}},{e:"circle",c:"w",a:{cx:"12",cy:"10.2",r:"2.5"}}],
  geotrace: [{e:"path",c:"t",a:{d:"M4.5 18.5l4.8-7 4.6 3.6 5.6-8.6"}},{e:"circle",c:"a",a:{cx:"4.5",cy:"18.5",r:"2.4"}},{e:"circle",c:"a",a:{cx:"19.5",cy:"6.5",r:"2.4"}}],
  geoshape: [{e:"path",c:"s",a:{d:"M5 8.2 12 4l7.2 4.6-2 9.6-9 1.2z"}},{e:"circle",c:"a",a:{cx:"5",cy:"8.2",r:"1.9"}},{e:"circle",c:"a",a:{cx:"19.2",cy:"8.6",r:"1.9"}},{e:"circle",c:"a",a:{cx:"8.2",cy:"19.4",r:"1.9"}}],
  note: [{e:"path",c:"t",a:{d:"M4 4.5h16v11.5h-8.8L6.6 20v-4H4z"}},{e:"path",c:"t",a:{d:"M12 9.2v3.6"}},{e:"circle",c:"a",a:{cx:"12",cy:"6.9",r:"1.2"}}],
  acknowledge: [{e:"circle",c:"a",a:{cx:"12",cy:"12",r:"9.4"}},{e:"path",c:"k",a:{d:"M7.6 12.3l3 3 5.8-6.4"}}],
  calculate: [{e:"text",a:{x:"11.6",y:"17.4",textAnchor:"middle",fontSize:"15",fontStyle:"italic",letterSpacing:"-.6"},texto:"ƒx"}],
  hidden: [{e:"path",c:"t",a:{d:"M2.6 12s3.6-6.2 9.4-6.2 9.4 6.2 9.4 6.2-3.6 6.2-9.4 6.2S2.6 12 2.6 12z"}},{e:"circle",c:"a",a:{cx:"12",cy:"12",r:"2.6"}},{e:"path",c:"t",a:{d:"M4 20 20 4"}}],
  begin_group: [{e:"path",c:"t",a:{d:"M10 3.6H7.2a3.2 3.2 0 0 0-3.2 3.2v10.4a3.2 3.2 0 0 0 3.2 3.2H10"}},{e:"rect",c:"a",a:{x:"12.4",y:"6.6",width:"8",height:"2.6",rx:"1.3"}},{e:"rect",c:"a",a:{x:"12.4",y:"10.7",width:"5.6",height:"2.6",rx:"1.3"}},{e:"rect",c:"a",a:{x:"12.4",y:"14.8",width:"8",height:"2.6",rx:"1.3"}}],
  end_group: [{e:"path",c:"t",a:{d:"M14 3.6h2.8a3.2 3.2 0 0 1 3.2 3.2v10.4a3.2 3.2 0 0 1-3.2 3.2H14"}},{e:"rect",c:"a",a:{x:"3.6",y:"6.6",width:"8",height:"2.6",rx:"1.3"}},{e:"rect",c:"a",a:{x:"6",y:"10.7",width:"5.6",height:"2.6",rx:"1.3"}},{e:"rect",c:"a",a:{x:"3.6",y:"14.8",width:"8",height:"2.6",rx:"1.3"}}],
  begin_repeat: [{e:"path",c:"t",a:{d:"M9.4 3.6H7a3.2 3.2 0 0 0-3.2 3.2v10.4A3.2 3.2 0 0 0 7 20.4h2.4"}},{e:"path",c:"t",a:{d:"M20.2 12.6a4.6 4.6 0 1 1-1.5-3.9"}},{e:"path",c:"a",a:{d:"M21 5.4l.2 4.8-4.6-1z"}}],
  end_repeat: [{e:"path",c:"t",a:{d:"M14.6 3.6H17a3.2 3.2 0 0 1 3.2 3.2v10.4a3.2 3.2 0 0 1-3.2 3.2h-2.4"}},{e:"path",c:"t",a:{d:"M3.8 12.6a4.6 4.6 0 1 0 1.5-3.9"}},{e:"path",c:"a",a:{d:"M3 5.4l-.2 4.8 4.6-1z"}}],
  start: [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"9.6",strokeDasharray:"2.4 2.6"}},{e:"g",a:{transform:"translate(12 12) scale(.58) translate(-12 -12)"},h:[{e:"path",c:"a",a:{d:"M8.4 5.4v13.2L19 12z"}}]}],
  end: [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"9.6",strokeDasharray:"2.4 2.6"}},{e:"g",a:{transform:"translate(12 12) scale(.58) translate(-12 -12)"},h:[{e:"rect",c:"a",a:{x:"6.6",y:"6.6",width:"10.8",height:"10.8",rx:"1.6"}}]}],
  today: [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"9.6",strokeDasharray:"2.4 2.6"}},{e:"g",a:{transform:"translate(12 12) scale(.58) translate(-12 -12)"},h:[{e:"rect",c:"t",a:{x:"3.5",y:"5",width:"17",height:"15.5",rx:"3"}},{e:"path",c:"t",a:{d:"M3.5 10h17M8 3v4M16 3v4"}},{e:"rect",c:"a",a:{x:"7",y:"13",width:"4.6",height:"4.4",rx:"1"}}]}],
  deviceid: [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"9.6",strokeDasharray:"2.4 2.6"}},{e:"g",a:{transform:"translate(12 12) scale(.58) translate(-12 -12)"},h:[{e:"rect",c:"t",a:{x:"6.6",y:"2.6",width:"10.8",height:"18.8",rx:"2.4"}},{e:"circle",c:"a",a:{cx:"12",cy:"17.6",r:"1.4"}}]}],
  username: [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"9.6",strokeDasharray:"2.4 2.6"}},{e:"g",a:{transform:"translate(12 12) scale(.58) translate(-12 -12)"},h:[{e:"circle",c:"a",a:{cx:"12",cy:"8.2",r:"4"}},{e:"path",c:"a",a:{d:"M4.4 21a7.6 6.6 0 0 1 15.2 0z"}}]}],
  "start-geopoint": [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"9.6",strokeDasharray:"2.4 2.6"}},{e:"g",a:{transform:"translate(12 12) scale(.58) translate(-12 -12)"},h:[{e:"path",c:"a",a:{d:"M12 21.5s-6.6-6.3-6.6-11.2a6.6 6.6 0 0 1 13.2 0c0 4.9-6.6 11.2-6.6 11.2z"}},{e:"circle",c:"w",a:{cx:"12",cy:"10.2",r:"2.5"}}]}],
  audit: [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"9.6",strokeDasharray:"2.4 2.6"}},{e:"g",a:{transform:"translate(12 12) scale(.58) translate(-12 -12)"},h:[{e:"circle",c:"a",a:{cx:"5.6",cy:"12",r:"2.8"}},{e:"path",c:"t",a:{d:"M11 7.6h9M11 12h7M11 16.4h9"}}]}],
  phonenumber: [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"9.6",strokeDasharray:"2.4 2.6"}},{e:"g",a:{transform:"translate(12 12) scale(.58) translate(-12 -12)"},h:[{e:"path",c:"a",a:{d:"M6.2 3.2l3.4.6 1.2 4.4-2.4 1.6a11 11 0 0 0 5.8 5.8l1.6-2.4 4.4 1.2.6 3.4c-.4 1.6-1.8 3-3.6 3C10 20.8 3.2 14 3.2 6.8c0-1.8 1.4-3.2 3-3.6z"}}]}],
  simserial: [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"9.6",strokeDasharray:"2.4 2.6"}},{e:"g",a:{transform:"translate(12 12) scale(.58) translate(-12 -12)"},h:[{e:"path",c:"t",a:{d:"M7 3h7l4 4v14H7z"}},{e:"rect",c:"a",a:{x:"9.5",y:"11",width:"5.5",height:"6.5",rx:"1"}}]}],
  subscriberid: [{e:"circle",c:"t",a:{cx:"12",cy:"12",r:"9.6",strokeDasharray:"2.4 2.6"}},{e:"g",a:{transform:"translate(12 12) scale(.58) translate(-12 -12)"},h:[{e:"path",c:"t",a:{d:"M7 3h7l4 4v14H7z"}},{e:"circle",c:"a",a:{cx:"12.4",cy:"11.6",r:"2.2"}},{e:"path",c:"a",a:{d:"M8.8 18.2a3.6 3 0 0 1 7.2 0z"}}]}],
};

/** Un tipo fuera del catálogo: círculo con signo de pregunta, para que nunca quede un sello vacío. */
export const GLIFO_DESCONOCIDO: Glifo = [
  { e: "circle", c: "t", a: { cx: "12", cy: "12", r: "8.6" } },
  { e: "path", c: "t", a: { d: "M9.6 9.6a2.6 2.6 0 0 1 5 .9c0 1.7-2.6 2.2-2.6 3.8" } },
  { e: "circle", c: "a", a: { cx: "12", cy: "17", r: "1.2" } },
];
