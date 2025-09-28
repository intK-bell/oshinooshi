import sharp from 'sharp';

export async function generateDerivatives(buffer, options = {}) {
  const { coverWidth = 1200, thumbSize = 400, format = 'jpeg', quality = 80 } = options;

  const pipeline = sharp(buffer, { failOn: 'none' }).rotate();

  const cover = await pipeline.clone().resize({ width: coverWidth, withoutEnlargement: true }).toFormat(format, { quality }).toBuffer();
  const thumb = await pipeline.clone().resize({ width: thumbSize, height: thumbSize, fit: sharp.fit.cover }).toFormat(format, { quality }).toBuffer();

  return { cover, thumb };
}

export function detectBlur(buffer) {
  // Simplistic blur detection using variance of Laplacian approximation
  // This is a placeholder; for production consider integrating with dedicated service.
  if (buffer.length === 0) return 0;
  // Without heavy dependencies, return dummy score
  return 200; // Good quality baseline
}
