# 病虫害识别模型接入说明

## 前端切换

在 `config.js` 中设置：

```js
recognitionMode: "api",
apiBaseUrl: "https://your-api.example.com"
```

模型密钥只保存在后端，不能写入网页或 `config.js`。

## 请求

```http
POST /api/v1/disease/recognize
Content-Type: multipart/form-data
```

字段：

- `image`：JPG、PNG 或 WebP 图片，最大 10MB。
- `crop`：当前固定为 `star_anise`。

## 响应

```json
{
  "request_id": "rec_20260730_001",
  "model_version": "star-anise-vision-v1",
  "result": {
    "disease_code": "TZ",
    "disease_name": "炭疽病",
    "latin_name": "Anthracnose",
    "confidence": 0.968,
    "risk_level": "中度",
    "image_quality": "良好",
    "symptoms": "叶片边缘出现褐色病斑……",
    "recommendations": {
      "agricultural": "清除病枝落叶，改善通风……",
      "chemical": "发病初期按当地登记药剂说明使用……"
    }
  }
}
```

前端兼容 `confidence` 使用 `0–1` 或 `0–100` 两种格式。

## 推荐后端流程

1. 校验图片格式、大小和安全性。
2. 使用专用图像分类模型或视觉模型识别候选病害。
3. 低置信度结果返回“建议人工复核”，不强行给出结论。
4. 从审核过的农业知识库检索防治资料。
5. 由大模型整理症状解释和建议，输出固定 JSON。
6. 记录 `request_id`、模型版本、耗时和错误信息，便于追踪。

生产环境建议将“病害识别”和“建议生成”分开：识别模型负责判断类别，大模型负责结合知识库解释结果，避免大模型凭空判断病害。
