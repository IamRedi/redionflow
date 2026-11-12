import { expect, it } from 'vitest';
import sharp from 'sharp';
import { previewPhoto } from './preview';
import type { PhotoShape } from './rendition';

it('makes a smaller Retina preview with exactly the lossless resized pixels and original aspect', async () => {
  const raster=Buffer.alloc(1024*768*3);
  for(let i=0;i<raster.length;i++)raster[i]=(i*17+(i>>>5)*31)%256;
  const original=await sharp(raster,{raw:{width:1024,height:768,channels:3}}).webp({quality:90}).toBuffer();
  const preview=await previewPhoto(original,192);
  const meta=await sharp(preview).metadata();
  expect(meta).toMatchObject({format:'webp',width:192,height:144});
  expect(preview.length).toBeLessThan(original.length);
  const expected=await sharp(original).resize({width:192,withoutEnlargement:true,kernel:'lanczos3'}).raw().toBuffer();
  expect(await sharp(preview).raw().toBuffer()).toEqual(expected);
  expect(meta.exif).toBeUndefined();
  expect((await sharp(original).metadata()).width).toBe(1024);
  for(const [shape,height] of [['square',192],['4x3',144],['6x5',160]] as Array<[PhotoShape,number]>) {
    const cropped=await previewPhoto(original,192,shape);
    expect(await sharp(cropped).metadata()).toMatchObject({width:192,height});
    const frame=await sharp(original).resize({width:192,height,fit:'cover',position:'centre',withoutEnlargement:true,kernel:'lanczos3'}).raw().toBuffer();
    expect(await sharp(cropped).raw().toBuffer()).toEqual(frame);
  }
});
it('never enlarges, never mutates an original and falls back safely on invalid/unneeded transforms', async () => {
  const tiny=await sharp({create:{width:40,height:30,channels:4,background:'#aabbcc88'}}).webp({lossless:true}).toBuffer();
  expect(await previewPhoto(tiny,192)).toBe(tiny);
  expect(await previewPhoto(tiny,50000)).toBe(tiny);
  const invalid=Buffer.from('invalid');expect(await previewPhoto(invalid,192)).toBe(invalid);
});
