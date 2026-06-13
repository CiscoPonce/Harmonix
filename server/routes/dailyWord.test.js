const { expect } = require("chai");
const dailyWordRouter = require("./dailyWord");
const dailyWordService = require("../services/dailyWordService");
const db = require("../db");

const mockRes = () => {
  const r = {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; return r; };
  r.sendStatus = (c) => { r.statusCode = c; return r; };
  return r;
};

describe("Daily Word Routes", () => {
  const userId = "daily-route-user";

  beforeEach(() => {
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(userId, "route@test.com", "x");
  });

  it("GET / returns daily word payload", async () => {
    const original = dailyWordService.generateDailyWord;
    dailyWordService.generateDailyWord = async () => ({ date: "2026-06-14", word: { text: "hola" } });

    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/").route.stack[0].handle;
    const req = { user: { id: userId } };
    const res = mockRes();
    await handler(req, res);

    expect(res.body.word.text).to.equal("hola");
    dailyWordService.generateDailyWord = original;
  });

  it("POST /new forces regeneration", async () => {
    const original = dailyWordService.generateDailyWord;
    let forced = false;
    dailyWordService.generateDailyWord = async (_user, opts) => {
      forced = opts.force;
      return { date: "2026-06-14", word: { text: "nuevo" } };
    };

    const handler = dailyWordRouter.stack.find((s) => s.route.path === "/new").route.stack[0].handle;
    const req = { user: { id: userId } };
    const res = mockRes();
    await handler(req, res);

    expect(forced).to.equal(true);
    expect(res.body.word.text).to.equal("nuevo");
    dailyWordService.generateDailyWord = original;
  });
});
