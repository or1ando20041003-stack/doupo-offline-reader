# 斗破苍穹 Offline Reader

一个 Android 手机优先、同时支持 Windows Chrome/Edge 的私人离线中文小说 PWA。阶段 4.4A.1 已将“正文 TXT + 可选章节目录 TXT”升级为 Reference-First 章节定位；ReaderScreen 支持断点续读、目录、滚动/左右翻页、文本锚点、设置与四套主题。没有服务器、账号、云同步、网络 API 或在线正文，小说和目录不会离开当前设备。

## 技术栈与目录

- React 19、TypeScript strict、Vite
- Dexie / IndexedDB：书籍、单章正文、文本进度、设置
- Web Worker：大 TXT 解码、清洗、解析
- Workbox / `vite-plugin-pwa`：可安装 app shell 与离线冷启动
- Vitest、fake-indexeddb：纯逻辑与数据层测试
- 普通 CSS、多栏排版：不使用在线字体或阅读器组件库

```text
src/
  book-processing/   TXT 解码、分层清洗、章节解析与 QA
  db/                Dexie schema、章节索引和 Repository
  domain/            模型、字符进度、order 导航、阅读会话
  services/          书架装配、导入、DOM 文本锚点、节流进度保存
  ui/                BookshelfScreen、BookCard、ReaderScreen 与阅读组件
  workers/           后台导入 Worker
scripts/             本地真实 TXT 检查工具
```

## 开发与构建

建议 Node 20.19+ 或 22.12+：

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
npm run preview
npm run verify:deploy
npm run inspect:book -- "C:\\本地路径\\斗破苍穹.txt"
```

真实 TXT、浏览器书库和 `.local-diagnostics/` 均被 Git 忽略。`inspect:book` 只生成统计、标题、行号、问题类型和短异常摘要，不保存完整正文。

## GitHub Pages 一键部署

项目包含 `.github/workflows/deploy-pages.yml`。push 到 `main` 或 `master` 后，GitHub Actions 会执行 `npm ci`、测试、typecheck、production build、部署隐私自检，并把 `dist/` 作为 Pages artifact 发布。也支持在 Actions 页面手动运行。

workflow 根据 `GITHUB_REPOSITORY` 自动得到 repository 名：普通项目自动使用 `/<repository-name>/`；如果 repository 本身名为 `<owner>.github.io`，则使用 `/`。无需手工修改 Vite 配置。`VITE_BASE_PATH` 同时控制：

- Vite JS/CSS/Worker asset URL；
- manifest `id`、`start_url`、`scope` 和 icons；
- Service Worker scope、注册地址、precache 与 navigation fallback。

本地开发默认 base 为 `/`。可这样模拟 GitHub Pages 子路径：

```bash
# PowerShell
$env:VITE_BASE_PATH='/repository-name/'
$env:EXPECTED_BASE_PATH='/repository-name/'
npm run build
npm run verify:deploy
```

`verify:deploy` 会检查 index、manifest、Service Worker、icons、assets、base path，并拒绝 TXT/电子书、IndexedDB 导出、诊断报告和 Windows 用户绝对路径进入 `dist/`。项目没有 URL router，Pages 首页和 PWA 内刷新都使用同一个入口，不需要 React Router 或 `404.html` hack。

第一次部署和 Android 安装请直接阅读 [ANDROID_INSTALL.md](./ANDROID_INSTALL.md)。GitHub 官方要求在 repository 的 **Settings → Pages** 将 Source 设为 **GitHub Actions**。

## 多书数据库架构（阶段 4.1）

Dexie 数据库版本为 v3。每个 `Book` 使用 UUID；每个 `Chapter` 和 `ReadingProgress` 都绑定 `bookId`，章节主键由 `bookId + section + order` 组成，`chapterNumber` 只用于显示。TXT 导入在单个 transaction 中追加 Book、Chapters 和初始 Progress，不会清空其他小说。v3 为 Book 增加可选的 `sourceHash`、`wordCount` 和 `description`，旧记录无需重新导入。

从 v1 打开时，Dexie 在原地 transaction 中保留旧 Book、正文和 Progress，为旧记录补齐多书元数据与缺失的 `bookId`。迁移失败会整体回滚，不删除 store、不重新解析 TXT。`ReaderSettings` 目前仍是全局共享设置。

Repository 提供 `getBooks()`、`getBookById(bookId)`、按 `bookId` 的章节/进度查询，以及只级联删除指定小说的 `deleteBook(bookId)`。

## 导入与书籍管理（阶段 4.3）

导入分成“后台解析”和“用户确认”两段。选择 TXT 后，界面依次显示读取文件、编码识别、文本清洗、章节解析和保存数据；文件读取后的 SHA-256、解码、清洗与章节解析全部在 Web Worker 中完成。解析完成只显示确认界面，不写数据库；用户可以修改书名，核对章节数、正文字符数和编码，再确认导入或重新选择。

书名优先取文件名，去掉大小写无关的 `.txt`，并只清理末尾的“完整版”“全本”“全集”及常见括号/分隔符。重复导入先按文件 SHA-256 检测；为兼容没有 hash 的旧书，再按规范化书名、章节数和正文字符数匹配。命中后默认不覆盖，必须明确选择“覆盖原书”“保留两本”或“取消”。覆盖使用原子 transaction 替换所选书的章节并重置该书进度，不影响其他书。

书卡显示章节数、字数、导入时间、最后阅读章节、阅读百分比和最后阅读时间。删除确认会再次显示书名、章节数、当前阅读章节和进度；只删除应用数据库中的所选书、章节和进度，不删除手机原 TXT。

## 章节目录辅助导入（阶段 4.4A.1）

导入界面明确区分“小说正文 TXT（必选）”和“章节目录 TXT（可选）”。没有目录时沿用普通 TXT 解析；提供目录时，目录会复用 UTF-8/GB18030 解码设施。除文档开头高置信的 `《书名》目录` 外，每个非空行都会保留为有序 `ReferenceEntry`。章号、卷名和条目类型只是可选元数据，不决定条目是否有效，也不要求章号在全书范围内持续递增。

正文解码后先做换行和 BOM 等轻量结构规范化并建立 `BodyLineIndex`，保存每行原文、规范化文本、行号和字符偏移。随后由每个 ReferenceEntry 直接定位正文行，依次尝试原文精确、规范化精确、正文行是目录前缀、目录是正文行前缀以及受前后强锚点限制的模糊匹配。同名条目按目录顺序选择上一个正文偏移之后的合理位置；最终阅读顺序只依赖 `order`。精确定位完成后，再合并普通正文解析器可靠识别而目录没有覆盖的标题。

目录只是辅助参考，不是绝对真理。无法可靠定位的条目只计入摘要并保持与相邻正文合并：不创建空 Chapter、不按字数猜边界、不阻止导入。正文独有的可靠章节也不会被删除。前言、引子、楔子、后记、完本总结、附录、带卷名前缀的章节、错写成“张”的标题以及章号重复/重置都可以直接参与定位。

确认页会显示目录条目、正文初始候选、精确定位、格式修复、前缀修复、模糊匹配、未定位、正文独有和最终阅读条目。目录为空或无法读取时自动退回普通解析，并给出可理解的提示。同一正文即使换了目录，重复检测仍只依据正文 hash，用户可明确选择覆盖重新处理；覆盖前会提示该书阅读进度将重置到开头。全部索引与对齐仍在 Web Worker 中完成，避免数 MB 正文阻塞界面。

## BookshelfScreen 架构（阶段 4.2）

`App` 启动后固定进入书架，不再默认打开某一本书。`bookshelf.ts` 负责把 Book、对应 Progress 和最近章节标题装配为书卡数据；UI 组件不直接拼装数据库查询。

- `BookshelfScreen`：书架布局、导入状态和删除对话框协调；
- `BookCard`：书名、最近章节、阅读百分比、最后阅读时间和继续阅读；
- `EmptyBookshelf`：正常的空书架提示与第一本 TXT 导入入口；
- `ImportBookButton`：书架统一文件选择入口；
- `DeleteBookDialog`：明确列出章节和进度删除范围。

书卡按 `lastReadAt` 优先、无阅读时间时按 `importedAt` 排序。导入完成后停留在书架；删除只影响所选 Book。点击书卡后以显式 `bookId` 加载对应 Book、Progress 和全局 Settings。

## ReaderScreen 架构

`ReaderScreen` 接收显式 `bookId`，所有章节查询都限制在该书。有有效进度时直接打开 `progress.chapterId` 并恢复段内位置；无进度或进度指向已不存在章节时回退到第一条 main Chapter。ReaderScreen 只把当前章放进 DOM，大目录仅使用轻量章节索引。顶部“书架”按钮会先保存当前文本位置，再返回并刷新书卡的 `lastReadAt`。

主要组件：

- `ReaderScreen`：章节请求序列、生命周期、键盘、设置和进度协调；
- `ReaderViewport` / `ReaderChapter`：当前章排版、点击分区与触摸手势；
- `ReaderControls` / `ReadingStatus`：临时工具栏和常驻低干扰状态；
- `ChapterDrawer`：正文/附加内容分区、当前章定位；
- `SettingsPanel`：字体、字号、行距、边距、宽度、缩进、主题和模式；
- `readingAnchor.ts`：DOM position 与结构化文本锚点互转；
- `readingProgress.ts`：字符进度和 1 秒防抖保存；
- `readerSession.ts`：启动恢复和严格按 `order` 的前后章导航。

章节加载有递增 request sequence，快速请求时只有最后一次结果可更新 UI。严重读取错误显示重新加载/返回书架入口，不会自动删除数据。新 TXT 由原子 transaction 创建为独立 Book，不会覆盖旧书及其进度。

## Scroll 与 Paged 模式

Scroll 模式使用当前章的标准纵向流式排版和浏览器原生滚动，不在章末自动跳章。中央区域点击显示/隐藏 Controls。

Paged 模式使用固定高度 viewport 与 CSS multi-column：列内容宽度加左右 column gap 等于实际 viewport 宽度，`scrollLeft / clientWidth` 只计算当前临时页。左 25% 上一页、中央 50% 控制层、右 25% 下一页；横向滑动阈值为 56px，并要求横向位移明显大于纵向位移。末页向后进入下一条 `order` 记录，首页向前进入上一章末页。

字号、行距、边距、内容宽度、窗口尺寸或横竖屏变化时重新计算 `scrollWidth / clientWidth`。重新分页前保留文本锚点，布局稳定后恢复锚点并重新得到 pageIndex，pageIndex 从不写入 ReadingProgress。

## Text Anchor 与断点续读

每个段落渲染为 `data-paragraph-index`。阅读探针位于 viewport 约 42% 高度、正文水平中央：

1. `elementFromPoint` 或可见矩形找到段落；
2. 优先使用浏览器 caret API 获取段内字符，回退时用 DOM Range 二分字符位置；
3. 保存 `chapterId + paragraphIndex + characterOffset`；
4. 恢复时建立 collapsed Range；Scroll 计算目标 `scrollTop`，Paged 根据 Range 横向坐标计算所在列。

位置停止变化约 250ms 后采样，最新 ReadingProgress 约 1000ms 防抖写入。章节切换、模式切换、`visibilitychange → hidden`、`pagehide`、`beforeunload` 会强制保存。Scroll/Paged 切换和 resize 均复用切换前锚点，不以像素 scrollTop 或 pageIndex 为权威。

章节进度按章内字符计算。正文 `globalProgress` 使用 main 字符总数与 `sectionCharacterStart`；附加内容使用 extra 分区字符总数，不按章节数量估算。

## 目录和章节导航

真实文件当前解析为 main 1533、extra 12。目录按实际 Chapter 记录展示，不人为补齐没有独立标题的 chapterNumber，也不显示缺号阻塞提示。目录打开时当前章自动滚到可见区域，extra 默认折叠；当前 extra 阅读时自动展开。

上一章/下一章完全依据 `order`，不使用 `chapterNumber + 1`。main 大结局的下一条是第一条 extra，并显示一次轻量“已进入附加内容”；第一条记录没有上一章，最后 extra 没有下一章。

## ReaderSettings

默认设置：19px、1.8 行距、20px 水平边距、桌面 760px 内容宽度、`2em` 首行缩进、paper、scroll。

- 字体：系统默认、宋体/衬线、黑体/无衬线、楷体，全部使用系统 fallback；
- 字号：14–32px；行距：1.4–2.4；
- 手机边距：12–36px；桌面内容宽度：560–960px；
- 首行缩进：开/关；阅读模式：scroll/paged；
- 主题：paper、light、eyeCare、dark。

设置写入 IndexedDB；主题另镜像一个不含用户内容的本地主题键，使重启时在 React 首屏前应用颜色，减少夜间模式白闪。四套主题都通过 CSS custom properties 同时覆盖正文、Controls、Drawer 与 Settings。

## Android 与 Windows 操作

Android：正文占满可用宽度，使用 `100dvh`、`safe-area-inset-*`、大触控按钮、底部 Sheet 设置和覆盖式左 Drawer。Scroll 保留纵向触摸；Paged 使用横向阈值手势和 `overscroll-behavior-x`，没有全局阻止 touchmove。

Windows：正文默认居中且最大 760px。Scroll 支持鼠标滚轮以及浏览器原生 Space/PageDown；Paged 支持 ArrowRight/PageDown/Space 下一页，ArrowLeft/PageUp 上一页。Escape 关闭 Drawer、Settings 和 Controls；面板打开时禁用翻页快捷键。

所有按钮有可读名称，Drawer/Settings 使用 dialog 语义，当前目录项使用 `aria-current`，并尊重 `prefers-reduced-motion`。

## PWA 安装与离线验收

1. `npm run build && npm run preview`，首次在线打开生产地址；
2. 导入本地 TXT，切换章节/主题/模式并等待进度保存；
3. 在 Application 中确认 Manifest 与 Service Worker；安装 PWA；
4. 断网或停止静态服务器，完全关闭后重开；
5. 应进入 BookshelfScreen；点击小说后恢复本地章节、文本位置、主题和模式，目录/设置/翻页均可用。

Workbox 只预缓存 app shell，小说正文只在 IndexedDB。清除站点数据、隐私模式退出或卸载时选择清理数据会删除本地书库。

## 真实《斗破苍穹》结果与 QA

本地源文件为 11,343,206 bytes、GB18030。清洗后“武动乾坤”和 HTML 残留均为零，可读字符 main 5,104,646、extra 29,390。阶段 3 使用实际 1545 条 Chapter 验证：首章、中部、接近大结局、大结局、第一 extra 和最后 extra 均能加载；目录跳转、order 前后章、刷新恢复、Scroll/Paged 切换、字号重排、dark 持久化和竖/横/竖重新分页均通过。

源 TXT 没有严格的 1–1624 独立标题结构；本产品接受这些合并章节，不推断或伪造章节边界。真实正文不会提交到仓库或构建产物。

## 当前产品边界

阶段 4.4A.1 已完成任意有序目录条目解析、Reference-First 正文行定位、匹配摘要和安全回退，并把普通小说处理规则与《斗破苍穹》旧书兼容规则分离。搜索、分类、标签、封面、账号、云同步和 OCR 仍未加入；产品也不包含书签、书城、网络正文、TTS 或复杂翻书动画。浏览器删除站点数据后无法恢复书库；不同 Android WebView/厂商浏览器仍建议用目标设备执行一次安装与长时间阅读测试。
