'use strict';

const { expect } = require('chai');
const jpeg = require('jpeg-js');
const {
  isAllowedCoverUrl,
  scaleRgbNearest,
  decodeImageToRgb,
  blitCover,
  buildPostcardPng,
} = require('./shareOg');

describe('shareOg cover helpers', () => {
  it('allows known album-art hosts only', () => {
    expect(isAllowedCoverUrl('https://e-cdns-images.dzcdn.net/images/cover/abc/250x250.jpg')).to.equal(
      true
    );
    expect(isAllowedCoverUrl('https://is1-ssl.mzstatic.com/image/thumb/Music/x.jpg')).to.equal(true);
    expect(isAllowedCoverUrl('https://evil.example/cover.jpg')).to.equal(false);
    expect(isAllowedCoverUrl('javascript:alert(1)')).to.equal(false);
  });

  it('scales RGB buffers with nearest neighbor', () => {
    const src = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 10, 20, 30]);
    const out = scaleRgbNearest(src, 2, 2, 2);
    expect(out.length).to.equal(2 * 2 * 3);
    expect(out[0]).to.equal(255);
    expect(out[1]).to.equal(0);
    expect(out[2]).to.equal(0);
  });

  it('decodes a tiny JPEG to RGB', () => {
    const width = 2;
    const height = 2;
    const frame = Buffer.alloc(width * height * 4);
    // RGBA red pixels
    for (let i = 0; i < width * height; i++) {
      frame[i * 4] = 200;
      frame[i * 4 + 1] = 10;
      frame[i * 4 + 2] = 10;
      frame[i * 4 + 3] = 255;
    }
    const encoded = jpeg.encode({ data: frame, width, height }, 90);
    const decoded = decodeImageToRgb(encoded.data);
    expect(decoded).to.not.equal(null);
    expect(decoded.width).to.equal(2);
    expect(decoded.height).to.equal(2);
    expect(decoded.data[0]).to.be.greaterThan(100);
  });

  it('blits a cover tile onto a canvas buffer', () => {
    const w = 40;
    const h = 40;
    const pixels = Buffer.alloc(w * h * 3, 20);
    const tile = Buffer.alloc(8 * 8 * 3, 180);
    blitCover(pixels, w, h, tile, 8, 10, 10);
    const i = (12 * w + 12) * 3;
    expect(pixels[i]).to.equal(180);
  });

  it('buildPostcardPng returns a PNG even without cover', async () => {
    const png = await buildPostcardPng({
      word: { text: 'hola', translation: 'hello' },
      song: { title: 'Song', artist: 'Artist' },
      cover: null,
    });
    expect(Buffer.isBuffer(png)).to.equal(true);
    expect(png[0]).to.equal(0x89);
    expect(png[1]).to.equal(0x50);
    expect(png[2]).to.equal(0x4e);
    expect(png[3]).to.equal(0x47);
    expect(png.length).to.be.greaterThan(1000);
  });
});
