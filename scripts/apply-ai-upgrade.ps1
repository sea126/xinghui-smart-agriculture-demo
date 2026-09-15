$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Update-TextFile {
  param(
    [Parameter(Mandatory)][string]$RelativePath,
    [Parameter(Mandatory)][array]$Replacements
  )
  $path = Join-Path $projectRoot $RelativePath
  $content = [System.IO.File]::ReadAllText($path)
  foreach ($item in $Replacements) {
    $old = [string]$item.Old
    $new = [string]$item.New
    if ($content.Contains($new)) { continue }
    if (-not $content.Contains($old)) {
      throw "未找到预期修改位置：$RelativePath / $($item.Name)"
    }
    $content = $content.Replace($old, $new)
  }
  [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

Update-TextFile -RelativePath "config.js" -Replacements @(
  @{
    Name = "AI配置"
    Old = @'
/**
 * 识别服务配置。
 * 后期接入真实模型时，将 recognitionMode 改为 "api"，
 * 并通过部署环境注入 apiBaseUrl。不要在前端存放模型密钥。
 */
window.APP_CONFIG = Object.freeze({
  recognitionMode: "mock",
  apiBaseUrl: "",
  recognitionEndpoint: "/api/v1/disease/recognize",
  requestTimeoutMs: 30000,
  maxImageSizeMB: 10,
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"]
});
'@
    New = @'
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
  maxImageSizeMB: 4,
  imageMaxDimension: 1280,
  imageQuality: 0.84,
  saveUploadedImages: true,
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"]
});
'@
  }
)

Update-TextFile -RelativePath "recognition-service.js" -Replacements @(
  @{
    Name = "API结果字段"
    Old = @'
      imageQuality: result.image_quality || "合格",
      modelVersion: result.model_version || payload.model_version || "在线模型",
      requestId: result.request_id || payload.request_id || "—"
'@
    New = @'
      imageQuality: result.image_quality || "合格",
      analysisBasis: result.analysis_basis || "模型依据图片可见特征与限定病害知识进行辅助研判。",
      modelVersion: result.model_version || payload.model_version || "在线模型",
      requestId: result.request_id || payload.request_id || "—",
      recordSaved: Boolean(result.record_saved),
      recordId: result.record_id || null,
      storageNote: result.storage_note || "本次图片未保存",
      serviceMode: "api"
'@
  },
  @{
    Name = "浏览器图片压缩"
    Old = @'
  async function recognizeByApi(file, sampleCode) {
'@
    New = @'
  async function compressImage(file) {
    validateFile(file);
    if (!file) return null;
    const config = global.APP_CONFIG;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const scale = Math.min(1, config.imageMaxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(value => value ? resolve(value) : reject(new Error("图片压缩失败")), "image/jpeg", config.imageQuality);
      });
      const name = `${(file.name || "star-anise").replace(/\.[^.]+$/, "")}.jpg`;
      const compressed = new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
      validateFile(compressed);
      return compressed;
    } catch (error) {
      if (file.size <= config.maxImageSizeMB * 1024 * 1024) return file;
      throw new RecognitionError("IMAGE_PROCESSING_FAILED", "图片压缩失败，请换一张尺寸较小的图片");
    } finally {
      bitmap?.close?.();
    }
  }

  async function recognizeByApi(file, sampleCode) {
'@
  },
  @{
    Name = "同源API及压缩"
    Old = @'
    validateFile(uploadFile);
    if (!uploadFile) throw new RecognitionError("NO_IMAGE", "请先上传待识别图片");
    if (!config.apiBaseUrl) throw new RecognitionError("CONFIG_ERROR", "尚未配置识别服务地址");

    const controller = new AbortController();
'@
    New = @'
    validateFile(uploadFile);
    if (!uploadFile) throw new RecognitionError("NO_IMAGE", "请先上传待识别图片");
    uploadFile = await compressImage(uploadFile);

    const controller = new AbortController();
'@
  },
  @{
    Name = "上传来源和保存同意"
    Old = @'
      form.append("image", uploadFile);
      form.append("crop", "star_anise");
      const response = await fetch(`${config.apiBaseUrl}${config.recognitionEndpoint}`, {
'@
    New = @'
      form.append("image", uploadFile);
      form.append("crop", "star_anise");
      form.append("source", file ? "user" : "sample");
      if (sampleCode) form.append("sample_code", sampleCode);
      const consent = document.getElementById("saveUploadConsent");
      form.append("save_image", String(Boolean(file && config.saveUploadedImages && consent?.checked)));
      const response = await fetch(`${config.apiBaseUrl}${config.recognitionEndpoint}`, {
'@
  },
  @{
    Name = "API失败回退"
    Old = @'
    if (global.APP_CONFIG.recognitionMode === "api") {
      return recognizeByApi(file, sampleCode);
    }
'@
    New = @'
    if (global.APP_CONFIG.recognitionMode === "api") {
      try {
        return await recognizeByApi(file, sampleCode);
      } catch (error) {
        if (!file && sampleCode && catalog[sampleCode]) {
          return {
            ...catalog[sampleCode],
            modelVersion: "规则回退引擎 v1.0",
            requestId: `FALLBACK-${Date.now().toString(36).toUpperCase()}`,
            analysisBasis: "AI 服务暂时不可用，当前结果来自已标注内置样本与病害知识映射。",
            recordSaved: false,
            storageNote: "内置样本不重复保存",
            serviceMode: "fallback"
          };
        }
        throw error;
      }
    }
'@
  },
  @{
    Name = "模拟结果补充字段"
    Old = @'
      ...catalog[sampleCode],
      modelVersion: "离线识别引擎 v1.0",
      requestId: `DEMO-${Date.now().toString(36).toUpperCase()}`
'@
    New = @'
      ...catalog[sampleCode],
      modelVersion: "离线识别引擎 v1.0",
      requestId: `DEMO-${Date.now().toString(36).toUpperCase()}`,
      analysisBasis: "当前结果来自已标注内置样本与病害知识映射。",
      recordSaved: false,
      storageNote: "内置样本不重复保存",
      serviceMode: "mock"
'@
  }
)

Update-TextFile -RelativePath "index.html" -Replacements @(
  @{
    Name = "上传保存同意"
    Old = @'
              </label>
              <div class="sample-title"><span>快速体验：选择内置样本</span><i></i></div>
'@
    New = @'
              </label>
              <label class="upload-consent"><input type="checkbox" id="saveUploadConsent" checked><span>匿名保存本次上传图片与鉴定结果，用于后续历史记录和样本积累；请勿上传含个人信息的图片。</span></label>
              <div class="sample-title"><span>快速体验：选择内置样本</span><i></i></div>
'@
  },
  @{
    Name = "识别记录状态"
    Old = @'
                  <span>识别引擎 <b id="modelVersion">—</b></span>
                </div>
                <div class="symptom-box"><span>症状描述</span><p id="symptomText"></p></div>
'@
    New = @'
                  <span>识别引擎 <b id="modelVersion">—</b></span>
                  <span>图片记录 <b id="recordStatus">—</b></span>
                </div>
                <div class="symptom-box"><span>症状描述</span><p id="symptomText"></p></div>
                <div class="ai-basis-box"><span>AI 研判依据</span><p id="analysisBasis"></p></div>
'@
  },
  @{
    Name = "种植引擎说明"
    Old = @'
              <p class="engine-note"><span>规则演示版</span>当前由前端决策表与参数化模板生成，已预留 AI 服务接口。</p>
'@
    New = @'
              <p class="engine-note"><span>规则 + AI</span>数值由规则引擎计算，AI 负责个性化解读；接口异常时保留规则结果。</p>
'@
  },
  @{
    Name = "种植AI解读"
    Old = @'
              <div class="plan-disclaimer"><span>i</span><p id="plantingDisclaimer">本方案基于演示数据与规则生成，仅供参考，不替代当地农技人员的现场判断。</p></div>
'@
    New = @'
              <div class="ai-insight" id="plantingAiInsight" data-state="idle">
                <div class="ai-insight-head"><span>AI</span><strong data-ai-title>等待生成增强解读</strong><small data-ai-model>规则方案保持有效</small></div>
                <p data-ai-summary>点击“生成年度种植方案”后，AI 将在不修改数值的前提下补充个性化说明。</p>
                <div data-ai-detail>产量区间与总产量始终由规则引擎计算。</div>
              </div>
              <div class="plan-disclaimer"><span>i</span><p id="plantingDisclaimer">本方案基于演示数据与规则生成，仅供参考，不替代当地农技人员的现场判断。</p></div>
'@
  },
  @{
    Name = "干燥AI解读"
    Old = @'
              <div class="safe-note" id="safeNote"><span>✓</span><p><strong>品质安全区间</strong>推荐温度不超过 60℃，有利于保留八角挥发性风味成分。</p></div>
'@
    New = @'
              <div class="safe-note" id="safeNote"><span>✓</span><p><strong>品质安全区间</strong>推荐温度不超过 60℃，有利于保留八角挥发性风味成分。</p></div>
              <div class="ai-insight compact" id="dryingAiInsight" data-state="idle">
                <div class="ai-insight-head"><span>AI</span><strong data-ai-title>等待生成增强解读</strong><small data-ai-model>规则参数保持有效</small></div>
                <p data-ai-summary>生成干燥方案后，AI 将结合原料状态解释执行重点。</p>
                <div data-ai-detail>温度、时间与含水率不会由大模型改写。</div>
              </div>
'@
  },
  @{
    Name = "AI服务脚本"
    Old = @'
  <script src="./recognition-service.js"></script>
  <script src="./app.js"></script>
'@
    New = @'
  <script src="./recognition-service.js"></script>
  <script src="./ai-service.js"></script>
  <script src="./app.js"></script>
'@
  }
)

Update-TextFile -RelativePath "app.js" -Replacements @(
  @{
    Name = "展示AI识别字段"
    Old = @'
  document.getElementById("imageQuality").textContent = item.imageQuality;
  document.getElementById("riskLevel").textContent = item.riskLevel;
  document.getElementById("modelVersion").textContent = item.modelVersion;
  document.getElementById("requestId").textContent = `识别编号：${item.requestId}`;
  const tag = document.querySelector("#resultPanel .result-tag");
  tag.textContent = item.confidence < 70 ? "建议人工复核" : "匹配成功";
'@
    New = @'
  document.getElementById("imageQuality").textContent = item.imageQuality;
  document.getElementById("riskLevel").textContent = item.riskLevel;
  document.getElementById("modelVersion").textContent = item.modelVersion;
  document.getElementById("recordStatus").textContent = item.storageNote || (item.recordSaved ? "匿名记录已保存" : "本次未保存");
  document.getElementById("analysisBasis").textContent = item.analysisBasis || "建议结合现场症状和农技人员意见复核。";
  document.getElementById("requestId").textContent = `识别编号：${item.requestId}`;
  const tag = document.querySelector("#resultPanel .result-tag");
  tag.textContent = item.serviceMode === "fallback" ? "规则回退" : item.confidence < 70 ? "建议人工复核" : "AI辅助匹配";
'@
  },
  @{
    Name = "AI解读通用渲染"
    Old = @'
window.generatePlantingPlan = generatePlantingPlan;

function validatePlantingForm() {
'@
    New = @'
window.generatePlantingPlan = generatePlantingPlan;

function renderAIInsight(elementId, state, payload = {}) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.dataset.state = state;
  const title = element.querySelector("[data-ai-title]");
  const model = element.querySelector("[data-ai-model]");
  const summary = element.querySelector("[data-ai-summary]");
  const detail = element.querySelector("[data-ai-detail]");
  if (state === "loading") {
    title.textContent = "AI 正在生成解读…";
    model.textContent = "规则结果已先行生成";
    summary.textContent = "正在结合当前参数组织个性化说明，请稍候。";
    detail.textContent = "AI 不会修改规则计算出的数值。";
    return;
  }
  if (state === "ready") {
    title.textContent = payload.headline || "AI 个性化解读";
    model.textContent = payload.model || "在线模型";
    summary.textContent = payload.summary || "已完成规则结果的个性化解释。";
    detail.textContent = [payload.focus, payload.caution].filter(Boolean).join(" · ");
    return;
  }
  if (state === "error") {
    title.textContent = "AI 解读暂不可用";
    model.textContent = "已保留规则方案";
    summary.textContent = payload.message || "接口未配置或暂时不可用，不影响当前规则结果。";
    detail.textContent = "比赛演示仍可继续；配置恢复后可重新点击生成。";
    return;
  }
  title.textContent = "等待生成增强解读";
  model.textContent = "规则方案保持有效";
  summary.textContent = payload.message || "点击生成按钮后，AI 将在不修改数值的前提下补充个性化说明。";
  detail.textContent = "核心数值始终由规则引擎计算。";
}

let plantingAIRequest = 0;
async function requestPlantingAI(inputs, result) {
  const requestId = ++plantingAIRequest;
  renderAIInsight("plantingAiInsight", "loading");
  try {
    const insight = await window.AIService.enhancePlanting(inputs, {
      strategyName: result.strategyName,
      diagnosis: result.diagnosis,
      expectedYieldRange: result.expectedYieldRange,
      expectedTotalRange: result.expectedTotalRange,
      managementFocus: result.managementFocus,
      actions: result.actions,
      risks: result.risks,
      disclaimer: result.disclaimer
    });
    if (requestId === plantingAIRequest) renderAIInsight("plantingAiInsight", "ready", insight);
  } catch (error) {
    if (requestId === plantingAIRequest) renderAIInsight("plantingAiInsight", "error", { message: error.message });
  }
}

let dryingAIRequest = 0;
async function requestDryingAI(inputs, result) {
  const requestId = ++dryingAIRequest;
  renderAIInsight("dryingAiInsight", "loading");
  try {
    const insight = await window.AIService.enhanceDrying(inputs, result);
    if (requestId === dryingAIRequest) renderAIInsight("dryingAiInsight", "ready", insight);
  } catch (error) {
    if (requestId === dryingAIRequest) renderAIInsight("dryingAiInsight", "error", { message: error.message });
  }
}

function validatePlantingForm() {
'@
  },
  @{
    Name = "触发种植AI解读"
    Old = @'
  document.getElementById("plantingResultPanel").classList.add("generated");
  if (!silent) showToast(`已生成：${result.strategyName}`);
  return result;
'@
    New = @'
  document.getElementById("plantingResultPanel").classList.add("generated");
  if (!silent) {
    showToast(`规则方案已生成：${result.strategyName}`);
    requestPlantingAI({
      region,
      area: values.area,
      recentYield: values.recentYield,
      treeStage: result.stageLabel,
      variety,
      goal: plantingRules.goals[plantingGoal].label
    }, result);
  } else {
    plantingAIRequest += 1;
    renderAIInsight("plantingAiInsight", "idle", { message: "参数已更新，点击生成按钮获取 AI 增强解读。" });
  }
  return result;
'@
  },
  @{
    Name = "触发干燥AI解读"
    Old = @'
  note.innerHTML = rule.warning
    ? `<span>!</span><p><strong>高温品质提示</strong>当前方案包含超过 70℃ 的处理阶段，可能降低部分挥发性香气成分，请严格控制时间。</p>`
    : `<span>✓</span><p><strong>品质安全区间</strong>推荐温度不超过 60℃，有利于保留八角挥发性风味成分。</p>`;
  showToast(`已匹配推荐方案：${rule.name}`);
'@
    New = @'
  note.innerHTML = rule.warning
    ? `<span>!</span><p><strong>高温品质提示</strong>当前方案包含超过 70℃ 的处理阶段，可能降低部分挥发性香气成分，请严格控制时间。</p>`
    : `<span>✓</span><p><strong>品质安全区间</strong>推荐温度不超过 60℃，有利于保留八角挥发性风味成分。</p>`;
  showToast(`规则方案已匹配：${rule.name}`);
  requestDryingAI({ ...choices }, {
    processName: rule.name,
    reason: `${rule.reason}；${moisture.label}`,
    temperature: `${rule.temp}℃`,
    time: `${adjustedTime}${timeUnit}`,
    targetMoisture: `${rule.moisture}${rule.unit}`,
    quality: rule.quality,
    warning: rule.warning,
    steps: selectedSteps
  });
'@
  },
  @{
    Name = "AI服务状态检测"
    Old = @'
  document.getElementById("recognitionStatus").textContent =
    window.RecognitionService.isApiMode() ? "在线识别服务已连接" : "识别服务已就绪";
}

initializeLiveDetails();
'@
    New = @'
  document.getElementById("recognitionStatus").textContent =
    window.RecognitionService.isApiMode() ? "正在检测 AI 服务…" : "识别服务已就绪";
}

async function initializeAIStatus() {
  const statusElement = document.getElementById("recognitionStatus");
  try {
    const status = await window.AIService.getStatus();
    statusElement.textContent = status.configured ? `${status.model} 已连接` : "AI 待配置 · 规则可用";
  } catch {
    statusElement.textContent = "AI 状态未知 · 规则可用";
  }
}

initializeLiveDetails();
initializeAIStatus();
'@
  }
)

Update-TextFile -RelativePath "styles.css" -Replacements @(
  @{
    Name = "上传同意和识别依据样式"
    Old = @'
.sample-title { display:flex;align-items:center;gap:12px;margin-bottom:12px;color:#829087;font-size:9px; }
'@
    New = @'
.upload-consent { display:flex;align-items:flex-start;gap:8px;margin:-7px 0 15px;color:#77857c;font-size:8px;line-height:1.55;cursor:pointer; }
.upload-consent input { width:13px;height:13px;flex:0 0 auto;margin:0;accent-color:var(--green-700); }
.sample-title { display:flex;align-items:center;gap:12px;margin-bottom:12px;color:#829087;font-size:9px; }
'@
  },
  @{
    Name = "结果四列和AI依据"
    Old = @'
.result-meta-row { display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 14px; }
'@
    New = @'
.result-meta-row { display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 14px; }
'@
  },
  @{
    Name = "AI样式"
    Old = @'
.symptom-box { padding:14px;border:1px solid var(--line);border-radius:12px;background:#fafaf7; }.symptom-box span { color:var(--green-700);font-size:9px;font-weight:700; }.symptom-box p { margin:7px 0 0;color:#5f6e65;font-size:10px;line-height:1.7; }
'@
    New = @'
.symptom-box { padding:14px;border:1px solid var(--line);border-radius:12px;background:#fafaf7; }.symptom-box span { color:var(--green-700);font-size:9px;font-weight:700; }.symptom-box p { margin:7px 0 0;color:#5f6e65;font-size:10px;line-height:1.7; }
.ai-basis-box { margin-top:9px;padding:11px 13px;border:1px solid #d9e7dd;border-radius:11px;background:#f0f6f2; }.ai-basis-box span { color:var(--green-700);font-size:8px;font-weight:700; }.ai-basis-box p { margin:5px 0 0;color:#607066;font-size:9px;line-height:1.65; }
.ai-insight { margin:14px 0 10px;padding:14px 15px;border:1px solid #d6e4da;border-radius:13px;background:linear-gradient(135deg,#f1f7f3,#faf8ef); }
.ai-insight-head { display:flex;align-items:center;gap:8px; }.ai-insight-head > span { width:27px;height:27px;display:grid;place-items:center;border-radius:9px;color:#fff;background:linear-gradient(135deg,var(--green-700),#b89045);font-size:8px;font-weight:700; }.ai-insight-head strong { color:#2f4e3b;font-size:10px; }.ai-insight-head small { margin-left:auto;color:#87938c;font-size:7px; }
.ai-insight > p { margin:9px 0 6px;color:#53665a;font-size:9px;line-height:1.7; }.ai-insight > div:last-child { color:#8a7450;font-size:8px;line-height:1.6; }
.ai-insight[data-state="loading"] { animation:aiPulse 1.4s ease-in-out infinite; }.ai-insight[data-state="error"] { border-color:#e7d6c2;background:#fbf6ee; }.ai-insight.compact { margin-top:12px; }
@keyframes aiPulse { 50% { opacity:.68; } }
'@
  },
  @{
    Name = "移动端结果列"
    Old = @'
  .sample-row { overflow-x:auto;grid-template-columns:repeat(5,75px);padding-bottom:3px; }.upload-zone { height:250px; }
'@
    New = @'
  .sample-row { overflow-x:auto;grid-template-columns:repeat(5,75px);padding-bottom:3px; }.upload-zone { height:250px; }
  .result-meta-row { grid-template-columns:repeat(2,1fr); }.ai-insight-head { flex-wrap:wrap; }.ai-insight-head small { width:100%;margin-left:35px; }
'@
  }
)

Write-Output "AI 升级补丁已应用。"
