const { expect } = require("chai");
const { lookupOfflineIpa } = require("./ipaLookupService");

describe("offline IPA lookup", () => {
  it("returns English phonetics for inflected lyric words without a model call", () => {
    const ipa = lookupOfflineIpa("younger", "en");
    expect(ipa).to.be.a("string");
    expect(ipa.startsWith("/")).to.equal(true);
    expect(ipa.length).to.be.greaterThan(3);
  });

  it("does not invent IPA for unknown tokens", () => {
    expect(lookupOfflineIpa("zxqunknownword", "en")).to.equal(null);
    expect(lookupOfflineIpa("younger", "xx")).to.equal(null);
  });

  it("looks up Spanish headwords from the compact table", () => {
    expect(lookupOfflineIpa("luz", "es")).to.equal("/luθ/");
  });
});
