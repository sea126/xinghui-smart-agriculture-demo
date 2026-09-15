import test from "node:test";
import assert from "node:assert/strict";
import aiGateway, {
  normalizeDiseaseResult,
  parseModelJson,
  safeAdviceInput
} from "../netlify/functions/ai-gateway.mjs";

test("可以解析纯JSON和带说明文字的JSON", () => {
  assert.deepEqual(parseModelJson('{"disease_code":"TZ"}'), { disease_code: "TZ" });
  assert.deepEqual(parseModelJson('结果如下：\n{"disease_code":"MY"}\n请复核'), { disease_code: "MY" });
});

test("模型置信度0到1时转换为百分数", () => {
  const result = normalizeDiseaseResult({
    disease_code: "TZ",
    confidence: 0.82,
    image_quality: "清晰",
    observed_features: "叶缘可见褐色病斑",
    reasoning: "与炭疽病可见特征较接近"
  }, "req-test", null);
  assert.equal(result.disease_code, "TZ");
  assert.equal(result.confidence, 82);
  assert.match(result.analysis_basis, /褐色病斑/);
});

test("未知类别被收敛到人工复核", () => {
  const result = normalizeDiseaseResult({
    disease_code: "OTHER",
    confidence: 98,
    image_quality: "一般"
  }, "req-unknown", null);
  assert.equal(result.disease_code, "UNKNOWN");
  assert.equal(result.disease_name, "暂无法确定");
  assert.ok(result.confidence <= 55);
});

test("内置样本以已标注数据集标签展示", () => {
  const result = normalizeDiseaseResult({
    disease_code: "UNKNOWN",
    confidence: 68,
    image_quality: "清晰"
  }, "req-sample", "CH");
  assert.equal(result.disease_code, "CH");
  assert.equal(result.disease_name, "八角尺蠖");
});

test("方案增强仅接受种植和干燥两类输入", () => {
  assert.equal(safeAdviceInput({ type: "other" }), null);
  assert.deepEqual(
    safeAdviceInput({ type: "planting", inputs: { region: "德保县" }, ruleResult: { score: 90 } }),
    { type: "planting", inputs: { region: "德保县" }, ruleResult: { score: 90 } }
  );
});
test("状态接口公开独立的低成本文本模型和短超时", async () => {
  const response = await aiGateway(new Request("https://example.test/api/v1/ai/status", { method: "GET" }));
  const payload = await response.json();
  assert.equal(payload.visionModel, "qwen3-vl-flash");
  assert.equal(payload.textModel, "qwen-flash");
  assert.equal(payload.adviceTimeoutMs, 10000);
});
test("文本方案调用使用低成本模型并返回结构化解读", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DASHSCOPE_API_KEY;
  let upstreamBody;
  process.env.DASHSCOPE_API_KEY = "test-key";
  globalThis.fetch = async (_url, options) => {
    upstreamBody = JSON.parse(options.body);
    return Response.json({
      id: "req-advice-test",
      choices: [{
        message: {
          content: JSON.stringify({
            headline: "盛果期稳产管理",
            summary: "根据规则方案组织年度管理重点。",
            focus: "先执行规则中的水肥和修剪措施。",
            caution: "参考方案需结合现场条件复核。"
          })
        }
      }]
    });
  };

  try {
    const response = await aiGateway(new Request("https://example.test/api/v1/advice/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "planting",
        inputs: { region: "德保县", area: 20 },
        ruleResult: { expectedYieldRange: [420, 460], disclaimer: "仅供参考" }
      })
    }));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(upstreamBody.model, "qwen-flash");
    assert.equal(upstreamBody.enable_thinking, false);
    assert.equal(payload.result.model, "qwen-flash");
    assert.match(payload.result.summary, /规则方案/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DASHSCOPE_API_KEY;
    else process.env.DASHSCOPE_API_KEY = originalKey;
  }
});
