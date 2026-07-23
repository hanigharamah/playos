import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";

/**
 * Flowing halftone dot-wave for the Home hero (mockup style), rendered as a
 * single GPU fragment shader via React Native Skia — the documented,
 * performant way to draw a dense particle field (vs. hundreds of SVG nodes
 * on the JS thread). See shopify.github.io/react-native-skia shaders docs.
 *
 * Technique: work in polar coordinates around an off-screen centre near the
 * top-right corner, so a regular halftone dot grid bends into concentric
 * flowing streamlines. Dot size, colour (peach → coral → pink) and opacity
 * are driven by proximity to a warm bloom centred right-of-middle; the field
 * fades toward the left edge and above the featured card.
 */
const source = Skia.RuntimeEffect.Make(`
uniform float2 resolution;

const vec3 PEACH = vec3(1.0, 0.71, 0.48);
const vec3 CORAL = vec3(1.0, 0.435, 0.38);
const vec3 PINK  = vec3(1.0, 0.29, 0.59);

vec3 palette(float t) {
  return t < 0.5 ? mix(PEACH, CORAL, t / 0.5) : mix(CORAL, PINK, (t - 0.5) / 0.5);
}

vec4 main(vec2 fragCoord) {
  vec2 uv = fragCoord / resolution;     // 0..1, top-down (Skia origin is top-left)
  float aspect = resolution.x / resolution.y;

  // Polar frame around an off-screen centre near the top-right corner
  vec2 d = uv - vec2(1.05, 0.10);
  d.x *= aspect;
  float radius = length(d);
  float angle = atan(d.y, d.x);

  // Concentric flowing bands + a little wobble, and arc-length spacing along
  // each band so the halftone cells stay roughly square (round dots).
  float F = 46.0;
  float band  = radius * F + sin(angle * 3.0 + radius * 2.0) * 0.22;
  float along = angle * radius * F;
  vec2 cell = vec2(fract(band) - 0.5, fract(along) - 0.5);
  float dd = length(cell);

  // Warm bloom, centre-right
  vec2 bd = uv - vec2(0.70, 0.34);
  bd.x *= aspect;
  float prox = clamp(1.0 - length(bd) / 0.62, 0.0, 1.0);

  // NB: "dot" is a reserved builtin in SkSL — naming a variable "dot" makes
  // RuntimeEffect.Make() fail silently, so the whole wave vanishes.
  float dotR = 0.10 + prox * 0.16;
  float disc = smoothstep(dotR, dotR - 0.06, dd);

  float edgeL = smoothstep(0.0, 0.26, uv.x);
  float cardFade = smoothstep(0.80, 0.42, uv.y) * 0.7 + 0.3;

  float a = disc * (0.10 + prox * 0.85) * edgeL * cardFade;
  vec3 col = palette(prox);
  vec3 glow = PINK * prox * prox * 0.10;

  float outA = clamp(a + prox * prox * 0.10, 0.0, 1.0);
  return vec4(col * a + glow, outA);   // premultiplied alpha
}
`);

export function DotWaveBackground({ width, height }: { width: number; height: number }) {
  if (!source) {
    if (__DEV__) console.warn("DotWaveBackground: SkSL shader failed to compile — wave hidden");
    return null;
  }
  return (
    <Canvas style={{ position: "absolute", top: 0, left: 0, width, height }} pointerEvents="none">
      <Fill>
        <Shader source={source} uniforms={{ resolution: [width, height] }} />
      </Fill>
    </Canvas>
  );
}
