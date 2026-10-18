/** An RGB lookup table: 256 entries, three bytes each. */
export type Lut = Uint8ClampedArray;

// ColorBrewer YlOrRd via matplotlib, sampled at 256 points: a warm sequential map
// (yellow → orange → red), readable with colour blindness and over photos.
const WARM_HEX =
  'ffffccfffecbfffec9fffdc8fffdc6fffcc5fffcc4fffbc2fffac1fffac0fff9befff9bdfff8bbfff8bafff7b9fff7b7' +
  'fff6b6fff5b5fff5b3fff4b2fff4b0fff3affff3aefff2acfff1abfff1a9fff0a8fff0a7ffefa5ffefa4ffeea3ffeda1' +
  'ffeda0ffec9fffec9dffeb9cffea9bffea99ffe998ffe997ffe895ffe794ffe793ffe691ffe590ffe58fffe48dffe48c' +
  'fee38bfee289fee288fee187fee085fee084fedf83fede82fede80fedd7ffedd7efedc7cfedb7bfedb7afeda78fed977' +
  'fed976fed774fed673fed572fed470fed36ffed16efed06cfecf6bfece6afecc68fecb67feca66fec965fec863fec662' +
  'fec561fec45ffec35efec15dfec05bfebf5afebe59febd57febb56feba55feb953feb852feb651feb54ffeb44efeb34d' +
  'feb24cfeb04bfeaf4bfeae4afead4afeac49feab49fea948fea848fea747fea647fea546fea446fea245fea145fea044' +
  'fd9f44fd9e43fd9d43fd9c42fd9a42fd9941fd9841fd9740fd9640fd953ffd933ffd923efd913efd903dfd8f3dfd8e3c' +
  'fd8c3cfd8a3bfd883bfd863afd8439fd8239fd8038fd7e38fd7c37fd7a37fd7836fd7636fd7435fd7234fd7034fd6e33' +
  'fc6c33fc6a32fc6832fc6631fc6430fc6330fc612ffc5f2ffc5d2efc5b2efc592dfc572cfc552cfc532bfc512bfc4f2a' +
  'fc4d2afb4b29fa4a29f94828f84628f84528f74327f64227f54026f43e26f43d25f33b25f23924f13824f13624f03523' +
  'ef3323ee3122ed3022ed2e21ec2c21eb2b21ea2920e92720e9261fe8241fe7231ee6211ee61f1de51e1de41c1de31a1c' +
  'e2191ce1191de0181ddf171ddd161ddc151edb141eda141ed9131fd7121fd6111fd51020d41020d30f20d10e21d00d21' +
  'cf0c21ce0c22cd0b22cb0a22ca0923c90823c80723c70723c50624c40524c30424c20325c10325c00225be0126bd0026' +
  'bb0026b90026b70026b60026b40026b20026b00026ae0026ac0026aa0026a80026a60026a40026a20026a100269f0026' +
  '9d00269b00269900269700269500269300269100268f00268d00268b00268a0026880026860026840026820026800026';

function fromHex(hex: string): Lut {
  const lut = new Uint8ClampedArray(hex.length / 2);
  for (let i = 0; i < lut.length; i++) lut[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return lut;
}

/** Linear interpolation between evenly spaced colour stops. */
function fromStops(stops: string[]): Lut {
  const rgb = stops.map((s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)));
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (rgb.length - 1);
    const k = Math.min(Math.floor(t), rgb.length - 2);
    const f = t - k;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = rgb[k][c] * (1 - f) + rgb[k + 1][c] * f;
  }
  return lut;
}

export const WARM: Lut = fromHex(WARM_HEX);

/** Blue (less) → neutral → orange (more), with luminous ends so both read over a greyed photo; blue and orange stay distinct with red–green colour blindness. */
export const BLUE_ORANGE: Lut = fromStops(['#2f7fd0', '#5ea3e3', '#a6cbeb', '#ededed', '#f7c27c', '#f0983a', '#dd7a16']);

export function cssColour(lut: Lut, t: number): string {
  const i = Math.round(Math.min(Math.max(t, 0), 1) * 255) * 3;
  return `rgb(${lut[i]}, ${lut[i + 1]}, ${lut[i + 2]})`;
}
