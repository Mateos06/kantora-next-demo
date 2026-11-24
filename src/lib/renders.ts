/** Still image of a building model, produced by `scripts/render-stills.cjs`. */
export const renderOf = (model: string, light: 'day' | 'dusk' = 'day') =>
  '/renders/' + model.replace('_concept.glb', '') + '-' + light + '.jpg';

/** The bare building on a transparent background. */
export const cutoutOf = (model: string) =>
  '/renders/' + model.replace('_concept.glb', '') + '.webp';
