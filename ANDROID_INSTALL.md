# Android 安装与使用说明

这份说明只需要照着操作。小说文件不会上传到 GitHub；GitHub Pages 上只有阅读器程序。

## 第一部分：电脑只需要做一次

1. 在 GitHub 新建一个 repository，例如 `doupo-offline-reader`。公开 repository 可以免费使用 GitHub Pages。
2. 把当前项目的全部代码保存并推送到这个 repository。不要把 `斗破苍穹.txt` 拖进 repository。
3. 打开 GitHub 上的 repository 页面，确认能看到 `.github`、`src`、`package.json` 等文件。
4. 以后不要随意重命名 repository。改名会改变阅读器网址，手机会把新网址当成另一套本地数据。

如果使用 GitHub Desktop：选择这个项目目录，填写提交说明，点击 Commit，再点击 Push origin。第一次使用 GitHub Desktop 时，按它的提示登录 GitHub 即可。

## 第二部分：GitHub 设置

1. 在 repository 顶部点击 **Settings**。
2. 在左侧找到 **Pages**。
3. 在 **Build and deployment** 的 **Source** 中选择 **GitHub Actions**。
4. 回到 repository 顶部，点击 **Actions**。
5. 找到 **Deploy GitHub Pages**。第一次 push 后它通常会自动运行；也可以打开它并点击 **Run workflow** 手动运行。
6. 等待 build 和 deploy 都显示绿色对勾。第一次通常需要几分钟。
7. 打开完成的 deploy，复制 GitHub Pages 提供的 HTTPS 地址。

地址通常是：

```text
https://你的GitHub用户名.github.io/你的repository名称/
```

例如 repository 叫 `doupo-offline-reader`，网址末尾就会有 `/doupo-offline-reader/`。不要删掉这一段。

如果 Actions 报告 Pages 尚未启用，再回到 **Settings → Pages**，确认 Source 已选择 **GitHub Actions**，然后重新运行 workflow。

## 第三部分：手机安装

1. 手机第一次操作时保持 Wi-Fi 或移动数据联网。
2. 使用 Android Chrome 打开刚才的 GitHub Pages HTTPS 地址。
3. 新手机上应该看到“你的书架还是空的”，不会直接出现小说正文。
4. 如果页面显示 **安装到手机**，点击并确认安装。
5. 如果没有安装按钮，点击 Chrome 右上角菜单，选择 **安装应用**。部分版本显示为 **添加到主屏幕**，也可以使用。
6. 安装完成后，手机桌面会出现“斗破苍穹 Offline Reader”图标。

请使用 Chrome，不建议用微信或 QQ 内置浏览器安装。

## 第四部分：导入斗破苍穹

1. 先把 `斗破苍穹.txt` 放进手机的 **Download/下载** 目录，或者其他自己容易找到的目录。
2. 从手机桌面打开阅读器。
3. 点击 **导入 TXT**，进入“导入小说”界面。
4. 在 **小说正文 TXT（必选）** 下选择 `斗破苍穹.txt`。
5. 如果手上有章节目录文件，在 **章节目录 TXT（可选）** 下选择例如 `斗破苍穹-目录.txt`；没有目录就直接跳过这一项。
6. 点击 **开始分析**，等待读取、识别编码、清洗、章节解析和目录对齐完成。大文件在后台处理，期间请不要关闭应用。
7. 在“确认书籍信息”界面核对或修改书名，检查正文大小、章节数和目录辅助统计。未找到的目录章节会保持与相邻正文合并，不会阻止确认。
8. 点击 **确认导入**，等待“保存数据”完成。返回书架并看到小说卡片后，导入才算完成。
9. 点击 **继续阅读** 进入第一章；以后打开应用先选择书籍，再恢复该书上一次阅读位置。

如果再次选择同一本 TXT，阅读器会提示书架中已存在这本书。默认不会覆盖：选择 **取消** 不做改动，选择 **保留两本** 新建独立副本，选择 **覆盖原书** 会替换原书正文并把该书阅读进度重置到开头。任何选择都不会修改或删除手机里的 TXT。

章节目录只是当前导入任务的辅助文件，不会成为书架中的另一本小说，也不会影响其他书。目录为空、乱码或无法识别时，阅读器会自动使用普通章节解析，正文仍可导入。程序更新后不需要重新安装 PWA、清除缓存、删除旧小说或重新导入；只有想用目录改善某本旧书的章节时，才重新选择同一正文和目录，并明确选择覆盖。

TXT 不需要放进 GitHub，不需要复制到 `dist`，也不会跟随 GitHub Pages 发布。文件只在当前手机中处理，处理后的章节保存在这个网址对应的手机浏览器本地存储中。

## 第五部分：断网测试

第一次断网以前必须先完成三件事：

1. 在线成功打开 GitHub Pages 阅读器；
2. 完成应用安装；
3. 完成小说导入，并正常打开过 ReaderScreen。

然后测试：

1. 完全关闭阅读器。
2. 打开飞行模式，或同时关闭 Wi-Fi 和移动数据。
3. 从手机桌面重新打开阅读器。
4. 应该显示本地书架；点击小说后恢复上次章节和位置，目录、Scroll、Paged 和设置都应该可用。

如果第一次离线失败，恢复网络，重新打开阅读器等待十几秒，再关闭并重试。不要清除 Chrome 的“网站数据”。

## 第六部分：以后如何更新程序

1. 电脑上保存新的程序代码。
2. 提交并 Push 到同一个 GitHub repository。
3. 打开 GitHub **Actions**，等待 **Deploy GitHub Pages** 变成绿色。
4. 手机下一次联网打开阅读器时，会自动取得新的程序版本。

普通程序更新只替换 HTML、CSS、JavaScript 和 Service Worker，不会主动删除 IndexedDB 中的小说与进度。只有在书架确认删除小说、清理网站数据，或卸载时选择清理数据，才可能影响本地小说。

## Windows 使用

Windows Chrome 或 Edge 打开同一个 GitHub Pages 地址。可以从浏览器菜单选择“安装此站点作为应用”，也可以直接在浏览器中阅读。

Android 和 Windows 各自选择自己的 TXT，各自保存小说和进度，不会自动同步。
