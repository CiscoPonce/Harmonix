const { expect } = require("chai");
const aiService = require("./aiService");
const dailyWordRouter = require("../routes/dailyWord");

describe("Phase 18 catalog and limiter", () => {
  it("hides empty genre cells and keeps stocked ones", () => {
    const english = aiService.genresAvailableForLanguage("en");
    const spanish = aiService.genresAvailableForLanguage("es");
    expect(english).to.not.include("reggaeton");
    expect(english).to.include("pop");
    expect(spanish).to.include("reggaeton");
  });

  it("mounts the daily-word limiter on new, next, and from-track", () => {
    for (const path of ["/new", "/next", "/from-track"]) {
      const layer = dailyWordRouter.stack.find(
        (s) => s.route && s.route.path === path && s.route.methods.post
      );
      expect(layer.route.stack[0].name, path).to.equal("dailyWordLimiter");
    }
  });
});
