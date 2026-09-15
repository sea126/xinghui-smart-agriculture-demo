const pages = {
  overview: "产业总览",
  disease: "病虫害识别",
  yield: "产量预测与定制种植方案",
  drying: "品质干燥方案"
};

const diseaseData = window.RecognitionService.getMockCatalog();

const yieldData = {
  "德保县": { values:[410,395,550,420,550,420,540], forecast:[405,455], temp:20.2, ph:4.9, change:"28.6%", note:"预计进入小年周期" },
  "那坡县": { values:[420,400,565,410,550,400,540], forecast:[410,460], temp:18.0, ph:5.0, change:"35.0%", note:"预计进入小年周期" },
  "右江区": { values:[380,365,510,385,500,390,490], forecast:[365,415], temp:20.5, ph:4.9, change:"25.6%", note:"预计进入小年周期" },
  "田林县": { values:[350,340,480,360,480,350,470], forecast:[340,390], temp:19.8, ph:5.0, change:"34.3%", note:"预计进入小年周期" },
  "凌云县": { values:[340,325,455,340,445,345,435], forecast:[315,360], temp:19.5, ph:4.8, change:"26.1%", note:"预计进入小年周期" },
  "上林县": { values:[380,365,510,385,500,390,490], forecast:[355,405], temp:19.8, ph:5.1, change:"25.6%", note:"预计进入小年周期" },
  "宁明县": { values:[400,385,540,400,530,405,520], forecast:[375,420], temp:20.5, ph:4.9, change:"28.4%", note:"预计进入小年周期" },
  "防城区": { values:[400,380,530,390,520,400,510], forecast:[370,415], temp:21.5, ph:4.8, change:"27.5%", note:"预计进入小年周期" },
  "上思县": { values:[370,355,495,370,485,375,475], forecast:[345,390], temp:21.0, ph:4.9, change:"26.7%", note:"预计进入小年周期" },
  "浦北县": { values:[360,345,480,360,470,365,460], forecast:[335,380], temp:20.5, ph:5.0, change:"26.0%", note:"预计进入小年周期" },
  "容县": { values:[400,420,560,420,600,430,580], forecast:[390,445], temp:20.8, ph:5.3, change:"34.9%", note:"高产区，预计出现周期性回落" },
  "福绵区": { values:[390,405,545,410,530,415,520], forecast:[380,430], temp:21.0, ph:5.2, change:"25.3%", note:"预计进入小年周期" },
  "北流市": { values:[370,380,520,390,540,400,530], forecast:[360,410], temp:21.0, ph:5.2, change:"32.5%", note:"预计进入小年周期" },
  "藤县": { values:[380,400,560,420,580,430,570], forecast:[385,430], temp:19.8, ph:5.1, change:"32.6%", note:"高产区，预计周期性回落" },
  "苍梧县": { values:[360,375,520,390,510,395,500], forecast:[355,405], temp:20.0, ph:5.0, change:"26.6%", note:"预计进入小年周期" },
  "金秀县": { values:[300,280,400,300,420,310,410], forecast:[280,315], temp:19.8, ph:4.7, change:"32.3%", note:"酸性土壤产区，预计进入小年周期" },
  "凤山县": { values:[320,305,430,320,420,325,410], forecast:[300,335], temp:19.0, ph:4.8, change:"26.2%", note:"预计进入小年周期" }
};

const dryingRules = {
  quality: {
    large:{ name:"热泵干燥", reason:"低温循环干燥，适合批量加工与品质保持", temp:"55–60", time:"10–14", moisture:"12.5", unit:"±0.5%", score:96, quality:"挥发油保留：优秀", warning:false },
    small:{ name:"二段式热风干燥", reason:"杀青后低温恒温，兼顾传统设备与香气保留", temp:"55–58", time:"9–10", moisture:"12.5", unit:"±0.5%", score:92, quality:"挥发油保留：优秀", warning:false }
  },
  balanced: {
    large:{ name:"微波热泵耦合干燥", reason:"微波快速脱水后转热泵，兼顾效率与复水品质", temp:"60", time:"6–9", moisture:"12.5", unit:"±0.5%", score:94, quality:"综合品质：优秀", warning:false },
    small:{ name:"杀青后晒干", reason:"设备要求低，适合小批量传统加工", temp:"80–100", time:"4–6", moisture:"13", unit:"% 左右", score:85, quality:"莽草酸含量：较高", warning:true, timeUnit:"天" }
  },
  speed: {
    large:{ name:"微波热泵耦合干燥", reason:"微波快速脱水并由热泵完成品质稳定", temp:"60", time:"5–8", moisture:"12.5", unit:"±0.5%", score:91, quality:"效率与品质：均衡", warning:false },
    small:{ name:"微波干燥", reason:"功率 415W 快速脱水，适合小批量加工", temp:"70–90", time:"45–90", moisture:"12.5", unit:"±0.5%", score:95, quality:"干燥效率：优秀", warning:true, timeUnit:"min" }
  }
};

let selectedDisease = "TZ";
let activeTreatment = "farm";
let choices = { moisture:"medium", goal:"quality", scale:"large" };
let plantingGoal = "yield";

function navigate(page) {
  if (!pages[page]) return;
  document.querySelectorAll(".page").forEach(el => el.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  document.getElementById("pageCrumb").textContent = pages[page];
  document.getElementById("sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (page === "yield") setTimeout(renderYieldChart, 60);
}

document.querySelectorAll("[data-page]").forEach(el => {
  el.addEventListener("click", event => {
    event.preventDefault();
    navigate(el.dataset.page);
  });
});
document.getElementById("menuBtn").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));

const uploadZone = document.getElementById("uploadZone");
const previewImage = document.getElementById("previewImage");
const imageInput = document.getElementById("imageInput");
let uploadedFile = null;
let recognitionResult = null;

function chooseSample(code) {
  selectedDisease = code;
  uploadedFile = null;
  const item = diseaseData[code];
  document.querySelectorAll(".sample").forEach(btn => btn.classList.toggle("active", btn.dataset.code === code));
  previewImage.src = item.image;
  uploadZone.classList.add("has-image");
  resetRecognitionResult();
}
document.querySelectorAll(".sample").forEach(btn => btn.addEventListener("click", event => {
  event.preventDefault();
  chooseSample(btn.dataset.code);
}));

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  uploadedFile = file;
  selectedDisease = null;
  document.querySelectorAll(".sample").forEach(btn => btn.classList.remove("active"));
  previewImage.src = URL.createObjectURL(file);
  uploadZone.classList.add("has-image");
  resetRecognitionResult();
});
["dragenter","dragover"].forEach(type => uploadZone.addEventListener(type, event => { event.preventDefault(); uploadZone.classList.add("dragging"); }));
["dragleave","drop"].forEach(type => uploadZone.addEventListener(type, event => { event.preventDefault(); uploadZone.classList.remove("dragging"); }));
uploadZone.addEventListener("drop", event => {
  const file = event.dataTransfer.files[0];
  if (file?.type.startsWith("image/")) {
    uploadedFile = file;
    selectedDisease = null;
    document.querySelectorAll(".sample").forEach(btn => btn.classList.remove("active"));
    previewImage.src = URL.createObjectURL(file);
    uploadZone.classList.add("has-image");
    resetRecognitionResult();
  }
});
document.getElementById("resetImage").addEventListener("click", () => {
  uploadedFile = null;
  selectedDisease = "TZ";
  recognitionResult = null;
  imageInput.value = "";
  previewImage.removeAttribute("src");
  uploadZone.classList.remove("has-image");
  document.querySelectorAll(".sample").forEach(btn => btn.classList.toggle("active", btn.dataset.code === "TZ"));
  resetRecognitionResult();
});

function resetRecognitionResult() {
  recognitionResult = null;
  const panel = document.getElementById("resultPanel");
  panel.classList.remove("ready");
  document.getElementById("resultPlaceholder").innerHTML = `
    <div class="radar"><span></span><i></i></div>
    <h3>等待识别</h3><p>选择一张图片并点击“开始智能识别”</p>`;
}

function showRecognitionMessage(title, description, type = "info") {
  const panel = document.getElementById("resultPanel");
  panel.classList.remove("ready");
  document.getElementById("resultPlaceholder").innerHTML = `
    <div class="message-icon ${type}">${type === "error" ? "!" : "◇"}</div>
    <h3>${title}</h3><p>${description}</p>`;
}

function fillDiseaseResult(item = recognitionResult) {
  if (!item) return;
  document.getElementById("diseaseName").textContent = item.name;
  document.getElementById("diseaseLatin").textContent = item.latin;
  document.getElementById("confidenceValue").textContent = item.confidence.toFixed(1);
  document.getElementById("symptomText").textContent = item.symptom;
  document.getElementById("treatmentText").textContent = item[activeTreatment];
  document.getElementById("imageQuality").textContent = item.imageQuality;
  document.getElementById("riskLevel").textContent = item.riskLevel;
  document.getElementById("modelVersion").textContent = item.modelVersion;
  document.getElementById("recordStatus").textContent = item.storageNote || (item.recordSaved ? "匿名记录已保存" : "本次未保存");
  document.getElementById("analysisBasis").textContent = item.analysisBasis || "建议结合现场症状和农技人员意见复核。";
  document.getElementById("requestId").textContent = `识别编号：${item.requestId}`;
  const tag = document.querySelector("#resultPanel .result-tag");
  tag.textContent = item.serviceMode === "fallback" ? "规则回退" : item.confidence < 70 ? "建议人工复核" : "AI辅助匹配";
  const circle = document.querySelector(".confidence .progress");
  circle.style.strokeDashoffset = 214 * (1 - item.confidence / 100);
}

async function runRecognition() {
  if (!uploadZone.classList.contains("has-image")) chooseSample(selectedDisease || "TZ");
  uploadZone.classList.add("scanning");
  const button = document.getElementById("recognizeBtn");
  button.disabled = true;
  button.innerHTML = "<span>◌</span> 正在分析图像特征…";
  try {
    recognitionResult = await window.RecognitionService.recognize({
      file: uploadedFile,
      sampleCode: selectedDisease
    });
    fillDiseaseResult(recognitionResult);
    document.getElementById("resultPanel").classList.add("ready");
    showToast(`识别完成：${recognitionResult.name}`);
  } catch (error) {
    const waitingForModel = ["MODEL_NOT_CONNECTED", "CONFIG_ERROR", "AI_NOT_CONFIGURED"].includes(error.code);
    showRecognitionMessage(
      waitingForModel ? "图片已准备就绪" : "识别未完成",
      error.message || "识别服务暂时不可用，请稍后重试",
      waitingForModel ? "info" : "error"
    );
    showToast(waitingForModel ? "当前请使用内置样本体验识别" : "识别失败，请重试");
  } finally {
    uploadZone.classList.remove("scanning");
    button.disabled = false;
    button.innerHTML = "<span>◎</span> 重新识别";
  }
}

document.getElementById("recognizeBtn").addEventListener("click", runRecognition);
document.getElementById("quickDemoBtn").addEventListener("click", () => {
  chooseSample("TZ");
  runRecognition();
});
document.querySelectorAll("[data-treatment]").forEach(btn => btn.addEventListener("click", () => {
  activeTreatment = btn.dataset.treatment;
  document.querySelectorAll("[data-treatment]").forEach(el => el.classList.toggle("active", el === btn));
  if (document.getElementById("resultPanel").classList.contains("ready")) fillDiseaseResult(recognitionResult);
}));

function renderYieldChart() {
  const region = document.getElementById("regionSelect").value;
  const data = yieldData[region];
  const svg = document.getElementById("yieldChart");
  const years = [2019,2020,2021,2022,2023,2024,2025,2026];
  const forecastMid = Math.round((data.forecast[0] + data.forecast[1]) / 2);
  const values = [...data.values, forecastMid];
  const minY = 300, maxY = 600, left = 55, right = 730, top = 25, bottom = 275;
  const x = i => left + (right-left) * i / 7;
  const y = v => bottom - (v-minY) / (maxY-minY) * (bottom-top);
  const historyPoints = data.values.map((v,i) => `${x(i)},${y(v)}`).join(" ");
  const areaPoints = `${left},${bottom} ${historyPoints} ${x(6)},${bottom}`;
  let html = `<defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3e8a62" stop-opacity=".22"/><stop offset="1" stop-color="#3e8a62" stop-opacity=".02"/></linearGradient></defs>`;
  [300,375,450,525,600].forEach(value => {
    html += `<line class="grid-line" x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}"/><text class="axis-label" x="12" y="${y(value)+4}">${value}</text>`;
  });
  html += `<polygon class="area-fill" points="${areaPoints}"/>`;
  html += `<rect class="forecast-band" x="${x(7)-35}" y="${y(data.forecast[1])}" width="70" height="${y(data.forecast[0])-y(data.forecast[1])}" rx="8"/>`;
  html += `<polyline class="history-line" points="${historyPoints}"/><line class="forecast-line" x1="${x(6)}" y1="${y(data.values[6])}" x2="${x(7)}" y2="${y(forecastMid)}"/>`;
  values.forEach((value,i) => {
    html += `<circle class="chart-point ${i===7?"forecast-point":""}" cx="${x(i)}" cy="${y(value)}" r="${i===7?6:5}"/>`;
    html += `<text class="value-label" x="${x(i)}" y="${y(value)-13}">${i===7?data.forecast[0]+"–"+data.forecast[1]:value}</text>`;
    html += `<text class="axis-label" text-anchor="middle" x="${x(i)}" y="301">${years[i]}${i===7?" 预测":""}</text>`;
  });
  svg.innerHTML = html;
  document.getElementById("chartTitle").textContent = `${region}鲜果亩产趋势`;
  document.getElementById("currentYield").innerHTML = `${data.values[6]} <i>kg/亩</i>`;
  document.getElementById("forecastYield").innerHTML = `${data.forecast[0]}—${data.forecast[1]} <i>kg/亩</i>`;
  document.getElementById("tempMetric").innerHTML = `${data.temp} <i>℃</i>`;
  document.getElementById("phMetric").textContent = data.ph;
  document.querySelector(".metric-card .up").innerHTML = `↑ ${data.change} <span>较上年</span>`;
  document.getElementById("trendText").textContent = `2026 年${data.note}，综合历史波动与气候因素，亩产预测区间为 ${data.forecast[0]}—${data.forecast[1]} kg。`;
}
document.getElementById("regionSelect").addEventListener("change", renderYieldChart);
document.getElementById("forecastBtn").addEventListener("click", () => {
  renderYieldChart();
  showToast(`${document.getElementById("regionSelect").value} 2026 年预测已更新`);
});
document.getElementById("exportBtn").addEventListener("click", () => {
  showToast("正在打开打印窗口，可选择“另存为 PDF”");
  setTimeout(() => window.print(), 180);
});

const plantingRules = {
  varieties: {
    "大红八角": {
      range: [420, 465],
      action: ["品种管理", "优先保留健壮结果枝，结合低产株表现分批开展复壮或品种改良。"],
      risk: "大红八角单产潜力相对稳健，产量优先时应避免一次性重剪或过量追肥。"
    },
    "柔枝红花": {
      range: [500, 550],
      action: ["品种管理", "发挥柔枝红花结果潜力，花前补充硼锌等中微量元素，谢花后关注保果。"],
      risk: "高产潜力品种在大年后树势消耗较大，应预留恢复性营养并防止次年落花。"
    },
    "柔枝淡红花": {
      range: [480, 530],
      action: ["品种管理", "适度疏花疏果并补充钾肥，兼顾果实充实度与枝组更新。"],
      risk: "柔枝淡红花不宜追求过高挂果量，连续高负载可能加剧大小年波动。"
    }
  },
  stages: {
    young: { label:"幼树期", factor:0.18, focus:"整形扩冠", action:["树体培养", "以主干和骨架枝培养为主，及时抹除竞争枝；原则上不鼓励幼树过早大量挂果。"] },
    early: { label:"初果期", factor:0.62, focus:"稳树促果", action:["初果管理", "逐步建立结果枝组，控制首次挂果负荷，避免树势尚弱时过度消耗。"] },
    mature: { label:"盛果期", factor:1, focus:"保花保果", action:["树冠调控", "采用轻剪与疏枝保持通风透光，分批更新衰弱结果枝，避免大幅重剪。"] },
    old: { label:"衰老期", factor:0.76, focus:"更新复壮", action:["更新复壮", "分年度回缩衰弱枝、补充有机质并评估低效株更新，避免一次性强刺激。"] }
  },
  goals: {
    yield: { label:"产量优先", factor:[1.03,1.07], focus:"花果量与大小年调控", action:["大小年调控", "大年适度疏花疏果、采后及时恢复树势；小年加强花芽分化期营养与水分管理。"] },
    quality: { label:"品质优先", factor:[0.96,1], focus:"果实充实与适期采收", action:["品质与采收", "控制结果负载，膨果期补充钾和中微量元素，成熟度达标后分批采收并及时转入品质干燥流程。"] },
    stable: { label:"稳产优先", factor:[0.97,1.02], focus:"投入节奏与风险缓冲", action:["稳产管理", "按物候分次投入水肥与植保，保留安全产量空间，避免单季高投入造成次年树势透支。"] }
  }
};

function roundToFive(value) {
  return Math.max(0, Math.round(value / 5) * 5);
}

function generatePlantingPlan({ region, area, treeStage, recentYield, variety, goal }) {
  const regionData = yieldData[region];
  const stageRule = plantingRules.stages[treeStage];
  const varietyRule = plantingRules.varieties[variety];
  const goalRule = plantingRules.goals[goal];
  if (!regionData || !stageRule || !varietyRule || !goalRule) {
    throw new Error("种植方案参数不完整");
  }

  const blendedLow = (regionData.forecast[0] * 0.58 + varietyRule.range[0] * 0.42) * stageRule.factor * goalRule.factor[0];
  const blendedHigh = (regionData.forecast[1] * 0.55 + varietyRule.range[1] * 0.45) * stageRule.factor * goalRule.factor[1];
  let expectedLow = roundToFive(blendedLow);
  let expectedHigh = Math.max(expectedLow + 10, roundToFive(blendedHigh));
  if (treeStage === "young") {
    expectedLow = 0;
    expectedHigh = Math.max(70, expectedHigh);
  }

  const relation = recentYield < regionData.forecast[0]
    ? `低于${region} 2026 年参考预测下限 ${regionData.forecast[0]} kg/亩`
    : recentYield > regionData.forecast[1]
      ? `高于${region} 2026 年参考预测上限 ${regionData.forecast[1]} kg/亩`
      : `处于${region} 2026 年参考预测区间内`;
  const stageAdvice = treeStage === "young"
    ? "当前以树体培养为主，不以短期产量作为核心考核指标"
    : recentYield < varietyRule.range[0] * stageRule.factor
      ? `尚未充分体现${variety}在${stageRule.label}的参考潜力，应先查明树势、土壤和病虫害限制`
      : `已接近${variety}在${stageRule.label}的参考潜力，应优先稳定树势并控制年度波动`;

  const actions = [
    stageRule.action,
    goalRule.action,
    varietyRule.action,
    ["水肥管理", treeStage === "young"
      ? "少量多次补充腐熟有机肥与平衡水肥，雨季及时排水，干旱期维持根区湿润。"
      : goal === "yield"
        ? "花前、保果期与采后分次施肥，氮磷钾配合有机质，依据树势和土壤检测调整用量。"
        : "以土壤检测和树势为依据分次投入，避免偏施氮肥；酸性土壤分区、小量调理。"],
    ["病虫害防控", "花果期加强炭疽病、煤烟病与食叶害虫巡查；优先农业防治，达到防治指标后再按当地登记用药执行。"],
    goal === "quality"
      ? ["采收与加工", "按成熟度分批采收，避免雨后立即采收；鲜果及时分级，并衔接低温、可控的品质干燥工艺。"]
      : ["年度复盘", "记录花期天气、投入、病虫害和实收亩产，年底与本方案对照，为下一年度规则或 AI 模型校准积累数据。"]
  ];

  const risks = [
    regionData.temp >= 21
      ? "花期均温偏高，注意高温造成授粉与坐果风险，必要时通过保墒、遮阴或错峰管理缓冲。"
      : "花期仍需关注短时高温与低温波动，结合田间物候及时调整保花保果措施。",
    "连续降雨可能加重落花、病害和根区积水，应提前疏通排水沟并缩短巡园间隔。"
  ];
  if (regionData.ph <= 4.9) risks.push(`区域参考土壤 pH 为 ${regionData.ph}，偏酸地块应先检测，再分次调理，避免一次性过量施用。`);
  if (treeStage === "young") risks.push("幼树过早挂果会影响骨架形成和后续产能，发现花果应根据树势适度疏除。");
  risks.push(varietyRule.risk);

  const totalLow = Number((expectedLow * area / 1000).toFixed(1));
  const totalHigh = Number((expectedHigh * area / 1000).toFixed(1));
  const completenessScore = 88 + (goal === "stable" ? 2 : 4) + (treeStage === "mature" ? 2 : 0) + (recentYield > 0 ? 2 : 0);

  return {
    diagnosis: `近一年亩产 ${recentYield} kg/亩，${relation}；${stageAdvice}。`,
    strategyName: `${variety}${stageRule.label}${goalRule.label.replace("优先", "")}方案`,
    matchScore: Math.min(96, completenessScore),
    expectedYieldRange: [expectedLow, expectedHigh],
    expectedTotalRange: [totalLow, totalHigh],
    managementFocus: goalRule.focus,
    stageLabel: stageRule.label,
    actions: actions.map(([name, detail]) => ({ name, detail })),
    risks,
    disclaimer: "本方案基于演示数据、统计区间与规则引擎生成，仅供参考，不承诺固定增产效果，也不替代当地农技人员的现场判断。"
  };
}

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
  const area = Number(document.getElementById("plantingArea").value);
  const recentYield = Number(document.getElementById("recentYield").value);
  const areaError = document.getElementById("areaError");
  const yieldError = document.getElementById("yieldError");
  areaError.textContent = Number.isFinite(area) && area >= 0.1 && area <= 10000 ? "" : "请输入 0.1—10000 亩之间的面积";
  yieldError.textContent = Number.isFinite(recentYield) && recentYield >= 0 && recentYield <= 1500 ? "" : "请输入 0—1500 kg/亩之间的亩产";
  return areaError.textContent || yieldError.textContent ? null : { area, recentYield };
}

function renderPlantingPlan({ silent = false } = {}) {
  const values = validatePlantingForm();
  if (!values) {
    showToast("请先检查种植面积和近一年亩产");
    return null;
  }
  const region = document.getElementById("regionSelect").value;
  const treeStage = document.getElementById("treeStage").value;
  const variety = document.getElementById("plantingVariety").value;
  const result = generatePlantingPlan({ region, treeStage, variety, goal: plantingGoal, ...values });
  document.getElementById("strategyName").textContent = result.strategyName;
  document.getElementById("plantingDiagnosis").textContent = result.diagnosis;
  document.getElementById("plantingMatchScore").textContent = result.matchScore;
  document.getElementById("expectedYieldRange").textContent = `${result.expectedYieldRange[0]}—${result.expectedYieldRange[1]}`;
  document.getElementById("expectedTotalRange").textContent = `${result.expectedTotalRange[0]}—${result.expectedTotalRange[1]}`;
  document.getElementById("managementFocus").textContent = result.managementFocus;
  document.getElementById("planRegionLabel").textContent = `${region} · ${result.stageLabel}`;
  document.getElementById("plantingActions").innerHTML = result.actions.map((action, index) =>
    `<div><span>${String(index + 1).padStart(2, "0")}</span><p><strong>${action.name}</strong>${action.detail}</p></div>`
  ).join("");
  document.getElementById("plantingRisks").innerHTML = result.risks.map(risk => `<div><span>!</span><p>${risk}</p></div>`).join("");
  document.getElementById("plantingDisclaimer").textContent = result.disclaimer;
  document.getElementById("plantingRegionChip").textContent = region;
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
}

document.querySelectorAll(".planting-goal-choice button").forEach(button => button.addEventListener("click", () => {
  plantingGoal = button.dataset.value;
  document.querySelectorAll(".planting-goal-choice button").forEach(item => item.classList.toggle("active", item === button));
}));
document.getElementById("plantingPlanBtn").addEventListener("click", () => renderPlantingPlan());
document.getElementById("plantingDemoBtn").addEventListener("click", () => {
  document.getElementById("regionSelect").value = "德保县";
  document.getElementById("plantingArea").value = "28";
  document.getElementById("recentYield").value = "430";
  document.getElementById("treeStage").value = "mature";
  document.getElementById("plantingVariety").value = "柔枝红花";
  plantingGoal = "yield";
  document.querySelectorAll(".planting-goal-choice button").forEach(item => item.classList.toggle("active", item.dataset.value === plantingGoal));
  renderYieldChart();
  renderPlantingPlan();
  document.getElementById("plantingResultPanel").scrollIntoView({ behavior:"smooth", block:"center" });
});
document.getElementById("plantingResetBtn").addEventListener("click", () => {
  document.getElementById("plantingArea").value = "20";
  document.getElementById("recentYield").value = "420";
  document.getElementById("treeStage").value = "mature";
  document.getElementById("plantingVariety").value = "柔枝红花";
  plantingGoal = "yield";
  document.querySelectorAll(".planting-goal-choice button").forEach(item => item.classList.toggle("active", item.dataset.value === plantingGoal));
  document.getElementById("areaError").textContent = "";
  document.getElementById("yieldError").textContent = "";
  renderPlantingPlan({ silent:true });
  showToast("种植方案输入已重置");
});
document.getElementById("regionSelect").addEventListener("change", () => {
  document.getElementById("plantingRegionChip").textContent = document.getElementById("regionSelect").value;
  renderPlantingPlan({ silent:true });
});

function bindChoice(selector, key) {
  document.querySelectorAll(selector).forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(selector).forEach(el => el.classList.toggle("active", el === btn));
    choices[key] = btn.dataset.value;
  }));
}
bindChoice(".moisture-choice button", "moisture");
bindChoice(".goal-choice button", "goal");
bindChoice(".scale-choice button", "scale");

function renderRecommendation() {
  const rule = dryingRules[choices.goal][choices.scale];
  const timeUnit = rule.timeUnit || "h";
  const moistureSettings = {
    high: { factor: 1.2, label: "高含水鲜果，预计干燥时间相应延长" },
    medium: { factor: 1, label: "中等含水量，按标准工艺参数执行" },
    low: { factor: 0.8, label: "原料已经预干，可适当缩短干燥时间" }
  };
  const moisture = moistureSettings[choices.moisture];
  const adjustedTime = rule.time.split("–").map(value =>
    Math.max(1, Math.round(Number(value) * moisture.factor))
  ).join("–");
  document.getElementById("processName").textContent = rule.name;
  document.getElementById("processReason").textContent = `${rule.reason}；${moisture.label}`;
  document.getElementById("dryTemp").innerHTML = `${rule.temp}<small>℃</small>`;
  document.getElementById("dryTime").innerHTML = `${adjustedTime}<small>${timeUnit}</small>`;
  document.getElementById("targetMoisture").innerHTML = `${rule.moisture}<small>${rule.unit}</small>`;
  document.getElementById("matchScore").textContent = rule.score;
  document.getElementById("qualityLabel").textContent = rule.quality;
  const stepSets = {
    "热泵干燥": [
      ["预处理", "鲜果摊放沥水，剔除病果与杂质"],
      ["恒温干燥", "控制温度 55–60℃，保持均匀风量"],
      ["回软检测", "降至目标含水率后冷却密封"]
    ],
    "二段式热风干燥": [
      ["快速杀青", "93–98℃ 处理 10–15 分钟"],
      ["低温干燥", "55–58℃ 恒温干燥 9–10 小时"],
      ["冷却陈化", "自然冷却后检测含水率"]
    ],
    "微波热泵耦合干燥": [
      ["微波预干", "415W 处理至含水率约 30%"],
      ["热泵干燥", "60℃、风速约 2.6m/s"],
      ["回软检测", "目标含水率 12.5±0.5%"]
    ],
    "杀青后晒干": [
      ["热水杀青", "80–100℃ 处理 5–8 分钟"],
      ["均匀日晒", "薄层摊放并定时翻动"],
      ["储藏检测", "4–6 天后检测含水率"]
    ],
    "微波干燥": [
      ["分级装盘", "保持单层均匀，剔除病果"],
      ["微波脱水", "功率 415W，分段检查温升"],
      ["冷却检测", "达到目标含水率后立即冷却"]
    ]
  };
  const selectedSteps = stepSets[rule.name].map(step => [...step]);
  selectedSteps[0][1] += choices.moisture === "high"
    ? "，高含水原料先充分沥水"
    : choices.moisture === "low" ? "，注意避免过度干燥" : "";
  document.getElementById("processSteps").innerHTML = selectedSteps.map((step, index) =>
    `<div><span>${index + 1}</span><p><strong>${step[0]}</strong>${step[1]}</p></div>${index < 2 ? "<i></i>" : ""}`
  ).join("");
  const note = document.getElementById("safeNote");
  note.classList.toggle("warning", rule.warning);
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
}
document.getElementById("recommendBtn").addEventListener("click", renderRecommendation);

let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.querySelector("p").textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function initializeLiveDetails() {
  const now = new Date();
  document.getElementById("currentDate").textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(now);
  document.getElementById("todayBadge").textContent =
    `${String(now.getMonth() + 1).padStart(2, "0")}·${String(now.getDate()).padStart(2, "0")}`;
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
renderYieldChart();
renderPlantingPlan({ silent:true });
