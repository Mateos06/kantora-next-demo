// Upgrades the authored concept GLBs in public/models for the browser:
//   1. physically plausible materials (clear glass with IOR, real metals, glossy solar/water)
//   2. welded + deduplicated geometry
//   3. meshopt compression (decoded locally by drei's useGLTF, no network)
// Node and mesh names are preserved: the viewer relies on names like
// "BuildingA_Floor_12_Windows_Glass_Blue" for floor progress and layers.
//
// The unoptimized originals live in git history (commit 4946a15). Extract them first:
//   git show 4946a15:public/models/lakeview_concept.glb > src/lakeview_concept.glb   (etc.)
// Run: node scripts/optimize-models.mjs            (re-processes public/models in place)
//      node scripts/optimize-models.mjs --in <dir>  (reads source GLBs from another folder)
import { NodeIO } from '@gltf-transform/core';
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
  KHRMaterialsClearcoat,
  KHRMaterialsIOR,
  KHRMaterialsSpecular,
} from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MODELS = ['lakeview_concept.glb', 'aba_concept.glb', 'toptani_concept.glb'];
const outDir = path.resolve('public/models');
const inFlag = process.argv.indexOf('--in');
const inDir = inFlag > -1 ? path.resolve(process.argv[inFlag + 1]) : outDir;

// name -> [r, g, b, a?], metallic, roughness, extras
const MATERIALS = {
  Limestone: { color: [0.74, 0.7, 0.61], metal: 0, rough: 0.82 },
  Warm_Render: { color: [0.86, 0.84, 0.79], metal: 0, rough: 0.88 },
  Concrete: { color: [0.5, 0.5, 0.47], metal: 0, rough: 0.9 },
  Dark_Stone: { color: [0.12, 0.14, 0.15], metal: 0, rough: 0.55 },
  Bronze: { color: [0.55, 0.38, 0.22], metal: 1, rough: 0.38 },
  Aluminium: { color: [0.62, 0.64, 0.66], metal: 1, rough: 0.34 },
  Canopy: { color: [0.7, 0.72, 0.72], metal: 0.6, rough: 0.4 },
  Glass_Blue: { color: [0.2, 0.32, 0.38, 0.55], metal: 0, rough: 0.04, glass: true },
  Glass_Dark: { color: [0.08, 0.13, 0.17, 0.7], metal: 0, rough: 0.05, glass: true },
  Glass_Clear: { color: [0.62, 0.74, 0.78, 0.22], metal: 0, rough: 0.03, glass: true },
  Office_Glass: { color: [0.11, 0.19, 0.25, 0.78], metal: 0, rough: 0.04, glass: true },
  Office_Glass_Light: { color: [0.26, 0.36, 0.43, 0.7], metal: 0, rough: 0.05, glass: true },
  Water: { color: [0.1, 0.2, 0.22, 0.9], metal: 0, rough: 0.05, clearcoat: 1 },
  Solar: { color: [0.03, 0.05, 0.09], metal: 0.2, rough: 0.2, clearcoat: 1 },
  Retail_Sign: { color: [0.04, 0.06, 0.1], metal: 0.2, rough: 0.35 },
  Timber: { color: [0.42, 0.27, 0.15], metal: 0, rough: 0.7 },
  Grass: { color: [0.2, 0.27, 0.13], metal: 0, rough: 1 },
  Leaves: { color: [0.1, 0.19, 0.09], metal: 0, rough: 0.95 },
  Leaves_Light: { color: [0.17, 0.28, 0.13], metal: 0, rough: 0.95 },
  Paving: { color: [0.6, 0.59, 0.55], metal: 0, rough: 0.94 },
  Asphalt: { color: [0.11, 0.12, 0.13], metal: 0, rough: 0.97 },
  Accent: { color: [0.45, 0.22, 0.08], metal: 0, rough: 0.6 },
};

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

for (const file of MODELS) {
  const source = path.join(inDir, file);
  const before = (await stat(source)).size;
  const doc = await io.readBinary(new Uint8Array(await readFile(source)));
  const ior = doc.createExtension(KHRMaterialsIOR);
  const specular = doc.createExtension(KHRMaterialsSpecular);
  const clearcoat = doc.createExtension(KHRMaterialsClearcoat);

  for (const material of doc.getRoot().listMaterials()) {
    const spec = MATERIALS[material.getName()];
    if (!spec) continue;
    const [r, g, b, a = 1] = spec.color;
    material.setBaseColorFactor([r, g, b, a]);
    material.setMetallicFactor(spec.metal);
    material.setRoughnessFactor(spec.rough);
    if (spec.glass) {
      material.setAlphaMode('BLEND');
      material.setDoubleSided(true);
      material.setExtension('KHR_materials_ior', ior.createIOR().setIOR(1.52));
      material.setExtension(
        'KHR_materials_specular',
        specular.createSpecular().setSpecularFactor(1),
      );
    }
    if (spec.clearcoat) {
      material.setExtension(
        'KHR_materials_clearcoat',
        clearcoat
          .createClearcoat()
          .setClearcoatFactor(spec.clearcoat)
          .setClearcoatRoughnessFactor(0.08),
      );
    }
  }

  await doc.transform(
    dedup(),
    weld(),
    prune({ keepLeaves: true, keepAttributes: true }),
    quantize({ quantizePosition: 14, quantizeNormal: 10 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true);

  const bytes = await io.writeBinary(doc);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path.join(outDir, file), bytes);
  console.log(
    `${file}: ${(before / 1e6).toFixed(2)} MB -> ${(bytes.byteLength / 1e6).toFixed(2)} MB`,
  );
}
