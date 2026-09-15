$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$path = Join-Path $projectRoot "netlify/functions/ai-gateway.mjs"
$content = [System.IO.File]::ReadAllText($path)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$changes = @(
  @{
    Name = "跨Node版本文件校验"
    Old = '  if (!(image instanceof File)) return json({ code: "NO_IMAGE", message: "请先上传待识别图片" }, 400);'
    New = '  if (!image || typeof image.arrayBuffer !== "function" || typeof image.type !== "string") return json({ code: "NO_IMAGE", message: "请先上传待识别图片" }, 400);'
  },
  @{
    Name = "不记录访问者IP"
    Old = @'
        requestId: result.request_id,
        sourceIpHash: context?.ip ? "recorded-by-netlify" : "unavailable"
'@
    New = @'
        requestId: result.request_id
'@
  }
)

foreach ($change in $changes) {
  if ($content.Contains($change.New)) { continue }
  if (-not $content.Contains($change.Old)) { throw "未找到预期修改位置：$($change.Name)" }
  $content = $content.Replace($change.Old, $change.New)
}

[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
Write-Output "服务端兼容与隐私修正已应用。"
