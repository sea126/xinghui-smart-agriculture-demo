(function createRecognitionService(global) {
  const catalog = {
    TZ: {
      code: "TZ", name: "炭疽病", latin: "ANTHRACNOSE · TZ", confidence: 96.8,
      image: "./assets/diseases/anthracnose.jpg", riskLevel: "中度", imageQuality: "良好",
      symptom: "叶片边缘出现圆形或不规则褐色病斑，边缘深褐、中间灰白，严重时叶片枯萎脱落。",
      farm: "冬季彻底清园，清除病枝落叶并集中处理；合理修剪增强通风透光，增施磷钾肥以提高植株抗病力。",
      chemical: "春梢萌发期可用 45% 苯甲·咪鲜胺 750–1500 倍液预防；发病初期交替喷洒 75% 百菌清 600 倍液或 70% 甲基托布津 800 倍液，每隔 7–10 天一次，连喷 2–3 次。"
    },
    MY: {
      code: "MY", name: "煤烟病", latin: "SOOTY MOLD · MY", confidence: 95.4,
      image: "./assets/diseases/sooty-mold.jpg", riskLevel: "中度", imageQuality: "良好",
      symptom: "叶片表面覆盖黑色煤烟状霉层，用手可擦掉；病情严重时会明显影响叶片光合作用。",
      farm: "及时防治蚜虫、介壳虫等诱因虫害，并通过合理修剪增强林间通风透光。",
      chemical: "可喷施 40% 多菌灵悬浮剂 500 倍液，同时使用 10% 吡虫啉可湿性粉剂 2000 倍液等防治蚜虫和介壳虫。"
    },
    YB: {
      code: "YB", name: "叶斑病", latin: "LEAF SPOT · YB", confidence: 94.7,
      image: "./assets/diseases/leaf-spot.jpg", riskLevel: "轻度", imageQuality: "良好",
      symptom: "叶片出现近圆形或不规则病斑，边缘深褐、中央灰白至浅褐，潮湿时病斑上可见黑色小点。",
      farm: "冬季清园，彻底清除病落叶并集中处理；加强水肥管理，增强树势。",
      chemical: "发病初期喷洒 75% 百菌清可湿性粉剂 600 倍液，或 50% 异菌脲可湿性粉剂 1000 倍液，间隔 7–10 天一次，连喷 2–3 次。"
    },
    GF: {
      code: "GF", name: "根腐病", latin: "ROOT ROT · GF", confidence: 93.9,
      image: "./assets/diseases/root-rot.jpg", riskLevel: "高", imageQuality: "良好",
      symptom: "植株叶片黄化萎蔫，根部皮层腐烂并呈黑褐色，伴有异味，严重时整株枯死。",
      farm: "选择排水良好的地块种植并避免积水；发现病株后立即挖除，并用生石灰对病穴消毒。",
      chemical: "发病初期可用 70% 恶霉灵可湿性粉剂 1500 倍液灌根，每株灌药液约 2–3 升。"
    },
    CH: {
      code: "CH", name: "八角尺蠖", latin: "STAR ANISE LOOPER · CH", confidence: 97.2,
      image: "./assets/diseases/looper.jpg", riskLevel: "中度", imageQuality: "清晰",
      symptom: "叶片被幼虫啃食形成缺刻或孔洞，严重时仅剩叶脉，枝条上可见幼虫吐丝下垂。",
      farm: "冬季翻土杀灭越冬蛹，利用黑光灯诱杀成虫，并注意保护寄生蜂、鸟类等天敌。",
      chemical: "幼虫 3 龄前喷洒 2.5% 高效氯氟氰菊酯乳油 2000 倍液，或 1.8% 阿维菌素乳油 3000 倍液。"
    }
  };

  class RecognitionError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "RecognitionError";
      this.code = code;
    }
  }

  function validateFile(file) {
    if (!file) return;
    const config = global.APP_CONFIG;
    if (!config.allowedImageTypes.includes(file.type)) {
      throw new RecognitionError("INVALID_TYPE", "仅支持 JPG、PNG 或 WebP 图片");
    }
    if (file.size > config.maxImageSizeMB * 1024 * 1024) {
      throw new RecognitionError("FILE_TOO_LARGE", `图片不能超过 ${config.maxImageSizeMB}MB`);
    }
  }

  function normalizeApiResult(payload) {
    const result = payload.result || payload.data || payload;
    if (!result.disease_code || !result.disease_name) {
      throw new RecognitionError("INVALID_RESPONSE", "识别服务返回的数据格式不完整");
    }
    return {
      code: result.disease_code,
      name: result.disease_name,
      latin: result.latin_name || result.disease_code,
      confidence: Number(result.confidence) <= 1
        ? Number(result.confidence) * 100
        : Number(result.confidence),
      symptom: result.symptoms || "暂无症状描述",
      farm: result.recommendations?.agricultural || "暂无农业防治建议",
      chemical: result.recommendations?.chemical || "暂无化学防治建议",
      riskLevel: result.risk_level || "待评估",
      imageQuality: result.image_quality || "合格",
      analysisBasis: result.analysis_basis || "模型依据图片可见特征与限定病害知识进行辅助研判。",
      modelVersion: result.model_version || payload.model_version || "在线模型",
      requestId: result.request_id || payload.request_id || "—",
      recordSaved: Boolean(result.record_saved),
      recordId: result.record_id || null,
      storageNote: result.storage_note || "本次图片未保存",
      serviceMode: "api"
    };
  }

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
    const config = global.APP_CONFIG;
    let uploadFile = file;
    if (!uploadFile && sampleCode && catalog[sampleCode]) {
      const response = await fetch(catalog[sampleCode].image);
      const blob = await response.blob();
      uploadFile = new File([blob], `${sampleCode}.jpg`, { type: blob.type || "image/jpeg" });
    }
    validateFile(uploadFile);
    if (!uploadFile) throw new RecognitionError("NO_IMAGE", "请先上传待识别图片");
    uploadFile = await compressImage(uploadFile);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const form = new FormData();
      form.append("image", uploadFile);
      form.append("crop", "star_anise");
      form.append("source", file ? "user" : "sample");
      if (sampleCode) form.append("sample_code", sampleCode);
      const consent = document.getElementById("saveUploadConsent");
      form.append("save_image", String(Boolean(file && config.saveUploadedImages && consent?.checked)));
      const response = await fetch(`${config.apiBaseUrl}${config.recognitionEndpoint}`, {
        method: "POST",
        body: form,
        signal: controller.signal
      });
      if (!response.ok) throw new RecognitionError("HTTP_ERROR", `识别服务异常（${response.status}）`);
      return normalizeApiResult(await response.json());
    } catch (error) {
      if (error.name === "AbortError") throw new RecognitionError("TIMEOUT", "识别超时，请稍后重试");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function recognize({ file, sampleCode }) {
    validateFile(file);
    if (global.APP_CONFIG.recognitionMode === "api") {
      try {
        if (global.AIService?.isConfigured?.() === false) {
          throw new RecognitionError("AI_NOT_CONFIGURED", "AI 尚未配置，请先在 Netlify 设置环境变量");
        }
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
    if (!sampleCode || !catalog[sampleCode]) {
      throw new RecognitionError(
        "MODEL_NOT_CONNECTED",
        "自定义图片识别将在模型服务接入后开放，当前可使用内置样本体验完整流程"
      );
    }
    await new Promise(resolve => setTimeout(resolve, 1450));
    return {
      ...catalog[sampleCode],
      modelVersion: "离线识别引擎 v1.0",
      requestId: `DEMO-${Date.now().toString(36).toUpperCase()}`,
      analysisBasis: "当前结果来自已标注内置样本与病害知识映射。",
      recordSaved: false,
      storageNote: "内置样本不重复保存",
      serviceMode: "mock"
    };
  }

  global.RecognitionService = Object.freeze({
    recognize,
    getMockCatalog: () => catalog,
    isApiMode: () => global.APP_CONFIG.recognitionMode === "api",
    RecognitionError
  });
})(window);
