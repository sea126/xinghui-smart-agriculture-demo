(function createAIService(global) {
  const config = global.APP_CONFIG;
  let configuredState = null;

  class AIServiceError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "AIServiceError";
      this.code = code;
    }
  }

  async function requestJson(endpoint, options = {}) {
    const {
      timeoutMs = config.requestTimeoutMs,
      timeoutMessage = "AI 分析超时，请稍后重试",
      ...fetchOptions
    } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${config.apiBaseUrl}${endpoint}`, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(fetchOptions.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
          ...fetchOptions.headers
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new AIServiceError(payload.code || "HTTP_ERROR", payload.message || `AI 服务异常（${response.status}）`);
      }
      return payload;
    } catch (error) {
      if (error.name === "AbortError") throw new AIServiceError("TIMEOUT", timeoutMessage);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function getStatus() {
    if (!config.aiEnhancementEnabled) {
      configuredState = false;
      return { configured: false, model: "规则引擎" };
    }
    const status = await requestJson(config.aiStatusEndpoint, { method: "GET" });
    configuredState = Boolean(status.configured);
    return status;
  }

  async function enhance(type, inputs, ruleResult) {
    if (!config.aiEnhancementEnabled) {
      throw new AIServiceError("AI_DISABLED", "AI 增强解读当前未启用");
    }
    if (configuredState === false) {
      throw new AIServiceError("AI_NOT_CONFIGURED", "AI 尚未配置，当前规则方案仍然有效");
    }
    const payload = await requestJson(config.adviceEndpoint, {
      method: "POST",
      body: JSON.stringify({ type, inputs, ruleResult }),
      timeoutMs: config.adviceTimeoutMs,
      timeoutMessage: "AI 个性化解读超时，已保留规则结果"
    });
    return payload.result;
  }

  global.AIService = Object.freeze({
    getStatus,
    isConfigured: () => configuredState,
    enhancePlanting: (inputs, ruleResult) => enhance("planting", inputs, ruleResult),
    enhanceDrying: (inputs, ruleResult) => enhance("drying", inputs, ruleResult),
    AIServiceError
  });
})(window);
