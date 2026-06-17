# 設計決策暫存區

以下項目在套用 Liquid Gradient Glassmorphism 主題時需要決策，暫時跳過。

---

## D-1  travel-guide 組件主題整合

**狀況**：`travel-guide` 全用 Tailwind utility class + 自己的 `isDarkMode` toggle，不走 CSS 變數系統。
**決策點**：
- A) 保留現有 Tailwind 風格不動（組件是獨立 AI 導遊介面，差異化可接受）
- B) 改寫 Tailwind class → 改成用 CSS 變數 + glassmorphism，與其他頁面統一
- C) 移除組件自己的 blob 背景（交給全域 `app.component` 的 blob 層），其他 UI 不改

---

## D-2  Dark Mode Toggle 行為

**狀況**：現行有 `ThemeService` 控制 `body.dark`，但 Liquid 主題已把全局底色改成深色（不需要 light mode）。
**決策點**：
- A) 保留 dark mode toggle（讓深色更深，見 `body.dark` 覆蓋變數）
- B) 移除 toggle，固定 Liquid 深色，簡化

---

## D-3  滑鼠游標液態 Ripple 特效

**狀況**：討論過「滑鼠移動帶動 blob 光源」效果（見對話記錄）。
**決策點**：
- A) 跳過，純 CSS 動畫已足夠
- B) 用 Angular `HostListener` + CSS custom property `--mx/--my` 讓 blob 跟隨游標偏移

---

## D-4  Three.js vs CSS 液態漸層

**狀況**：討論過用 Three.js ShaderMaterial 做更真實的液態效果。
**決策點**：
- A) 維持現行純 CSS（效能好，無需依賴）
- B) 引入 Three.js WebGL 背景（需 `NgZone.runOutsideAngular` 管理）

---

## D-5  Globe + Liquid 背景整合

**狀況**：`globe.gl`（Three.js）目前有獨立 canvas，液態 blob 在其下方。
**決策點**：
- A) 現狀：blob 透過 globe canvas 可見，視覺上 globe 浮在漸層上（已 OK）
- B) 讓 globe 背景透明（`globe.backgroundColor('rgba(0,0,0,0)')`），使 blob 色彩透進 globe

---

*記錄時間：依照 `/goal` 指令於 2026-06 執行 Liquid 主題整合時暫存*
