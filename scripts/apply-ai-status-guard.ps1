$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Replace-Exact {
  param([string]$RelativePath, [string]$Old, [string]$New, [string]$Name)
  $path = Join-Path $projectRoot $RelativePath
  $content = [System.IO.File]::ReadAllText($path)
  if ($content.Contains($New)) { return }
  if (-not $content.Contains($Old)) { throw "未找到预期修改位置：$RelativePath / $Name" }
  [System.IO.File]::WriteAllText($path, $content.Replace($Old, $New), $utf8NoBom)
}

Replace-Exact -RelativePath "ai-service.js" -Name "保存服务状态" -Old @'
  const config = global.APP_CONFIG;

  class AIServiceError extends Error {
'@ -New @'
  const config = global.APP_CONFIG;
  let configuredState = null;

  class AIServiceError extends Error {
'@

Replace-Exact -RelativePath "ai-service.js" -Name "读取服务状态" -Old @'
  async function getStatus() {
    if (!config.aiEnhancementEnabled) return { configured: false, model: "规则引擎" };
    return requestJson(config.aiStatusEndpoint, { method: "GET" });
  }

  async function enhance(type, inputs, ruleResult) {
    if (!config.aiEnhancementEnabled) {
      throw new AIServiceError("AI_DISABLED", "AI 增强解读当前未启用");
    }
'@ -New @'
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
'@

Replace-Exact -RelativePath "ai-service.js" -Name "暴露服务状态" -Old @'
    getStatus,
    enhancePlanting: (inputs, ruleResult) => enhance("planting", inputs, ruleResult),
'@ -New @'
    getStatus,
    isConfigured: () => configuredState,
    enhancePlanting: (inputs, ruleResult) => enhance("planting", inputs, ruleResult),
'@

Replace-Exact -RelativePath "recognition-service.js" -Name "识别前状态保护" -Old @'
    if (global.APP_CONFIG.recognitionMode === "api") {
      try {
        return await recognizeByApi(file, sampleCode);
'@ -New @'
    if (global.APP_CONFIG.recognitionMode === "api") {
      try {
        if (global.AIService?.isConfigured?.() === false) {
          throw new RecognitionError("AI_NOT_CONFIGURED", "AI 尚未配置，请先在 Netlify 设置环境变量");
        }
        return await recognizeByApi(file, sampleCode);
'@

Replace-Exact -RelativePath "app.js" -Name "识别等待状态" -Old @'
    const waitingForModel = error.code === "MODEL_NOT_CONNECTED" || error.code === "CONFIG_ERROR";
'@ -New @'
    const waitingForModel = ["MODEL_NOT_CONNECTED", "CONFIG_ERROR", "AI_NOT_CONFIGURED"].includes(error.code);
'@

Write-Output "AI 状态保护已应用。"
