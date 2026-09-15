/**
 * AI 服务配置。浏览器只访问本站的 Netlify Function，
 * 百炼 API Key 必须保存在 Netlify 环境变量中，禁止写入前端。
 */
window.APP_CONFIG = Object.freeze({
  recognitionMode: "api",
  aiEnhancementEnabled: true,
  apiBaseUrl: "",
  recognitionEndpoint: "/api/v1/disease/recognize",
  adviceEndpoint: "/api/v1/advice/enhance",
  aiStatusEndpoint: "/api/v1/ai/status",
  requestTimeoutMs: 45000,
  adviceTimeoutMs: 12000,
  maxImageSizeMB: 4,
  imageMaxDimension: 1280,
  imageQuality: 0.84,
  saveUploadedImages: true,
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"]
});

