# Tab Cluster AI

Chrome のローカル AI（Gemini Nano / Prompt API）または Gemini API で、開いているタブを自動的にグループ化する拡張機能です。Google が廃止した Tab Organizer の代替として、提案を確認してから適用できます。

<p>
  <img src="https://img.shields.io/badge/Chrome-138%2B-4285F4?logo=googlechrome&logoColor=white" alt="Chrome 138+">
  <img src="https://img.shields.io/badge/Manifest-V3-4285F4" alt="Manifest V3">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/0xmokuren/TabClusterAI" alt="License"></a>
</p>

## 特徴

- **オンデバイス AI** — Gemini Nano（Prompt API）でタブを分析。API キー不要
- **Gemini API** — Google AI Studio の API キーでクラウド分析。モデルを選択可能
- **確認してから適用** — AI の提案をプレビューし、問題なければグループ化
- **現在のウィンドウのみ** — 全ウィンドウ対象にも切り替え可能
- **日本語対応** — グループ名や UI を日本語で表示

## 必要条件

### オンデバイス AI を使う場合

| 項目 | 内容 |
| --- | --- |
| ブラウザ | Google Chrome 138 以上 |
| OS | macOS 13+ / Windows 10+ / Linux |
| メモリ | **16 GB 以上**（CPU モード）または VRAM 4 GB 超（GPU モード） |
| ストレージ | **空き 22 GB 以上**（初回モデル DL 用） |
| ネットワーク | **非従量制**（Wi‑Fi 等。初回 DL 時） |
| 設定 | Chrome → 設定 → システム → **オンデバイス AI** をオン |

> **注意:** オンデバイス AI が ON でも、RAM 不足・ディスク不足・回線条件などで Prompt API は `unavailable` になることがあります。拡張機能の「診断情報」を確認してください。

### Gemini API を使う場合

| 項目 | 内容 |
| --- | --- |
| ブラウザ | Google Chrome（Manifest V3 対応版） |
| API キー | [Google AI Studio](https://aistudio.google.com/apikey) で取得 |
| ネットワーク | `generativelanguage.googleapis.com` への接続 |

オンデバイス AI の要件（22 GB DL 等）は不要です。タブのタイトルと URL は Google サーバーへ送信されます。

### 初回の AI モデルダウンロード

**初めて AI 分析を使うとき**、Chrome が Gemini Nano のモデルを端末へダウンロードします。オンデバイス AI を ON にしただけではモデルは入っておらず、**最初の「AI で分析」実行時**に取得が始まります。

| 項目 | 目安 |
| --- | --- |
| サイズ | **約 22 GB** |
| 所要時間 | **数分〜数十分**（回線速度・端末性能による） |
| 回線 | **非従量制**（Wi‑Fi 等）が必要 |
| 空き容量 | **22 GB 以上** |

ポップアップには進捗が表示されます。

- **パーセント**と**推定ダウンロード量**（例: `47%` / `約 10.3 GB / 22 GB`）
- Chrome が先にバックグラウンドで DL している間は **経過時間** を表示
- 分析中はポップアップを**開いたまま**待ってください（閉じると進捗表示は止まりますが、Chrome 側の DL は続く場合があります）

2 回目以降はモデルが端末にキャッシュされるため、通常はこの待ち時間は発生しません。

### うまくいかないとき

1. `chrome://flags/#optimization-guide-on-device-model` → **Enabled**（開発中は **BypassPerfRequirement** も可）
2. `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled multilingual**
3. `chrome://on-device-internals` → **Model Status** にエラーがないか確認
4. Chrome を再起動

## インストール

### GitHub Releases から（推奨）

[`main` への push で CI が成功するたび](https://github.com/0xmokuren/TabClusterAI/actions) に、[Releases](https://github.com/0xmokuren/TabClusterAI/releases) へ `TabClusterAI-{version}.zip` が公開されます。

1. [Releases](https://github.com/0xmokuren/TabClusterAI/releases/latest) から最新の ZIP をダウンロード
2. ZIP を展開する
3. `chrome://extensions` を開く
4. **デベロッパーモード** を有効化
5. **パッケージ化されていない拡張機能を読み込む** で、展開したフォルダを選択

> Chrome Web Store 未公開のため、開発者モードでの読み込みが必要です。`manifest.json` の `version` を上げて `main` に push すると、新しい Release が作成されます（同じバージョンの場合は ZIP が更新されます）。

### 開発版（リポジトリから直接）

1. このリポジトリを clone する
2. `chrome://extensions` を開く
3. **デベロッパーモード** を有効化
4. **パッケージ化されていない拡張機能を読み込む** で、このリポジトリのルートを選択

## 使い方

1. ツールバーの Tab Cluster AI アイコンをクリック
2. **AI の使い方** でプロバイダを選択
   - **オンデバイス** — 従来どおりローカル AI（デフォルト）
   - **Gemini API** — API キーを入力し、モデルを選択
3. **AI で分析** を押す（未グループ化タブが 2 つ以上必要）
   - オンデバイス初回は AI モデルのダウンロードが走ります（[初回の AI モデルダウンロード](#初回の-ai-モデルダウンロード) 参照）
4. 提案プレビューを確認
5. **グループを適用** で Chrome のタブグループを作成

### Gemini API モードの設定

1. [Google AI Studio](https://aistudio.google.com/apikey) で API キーを作成
2. ポップアップの **AI の使い方** → **Gemini API** を選択
3. API キーを貼り付け（このブラウザにのみ保存）
4. モデルを選択（デフォルト: `gemini-3.1-flash-lite`）

選択可能なモデル（`lib/gemini-models.js` で管理）:

| モデル ID | 表示名 | tier |
| --- | --- | --- |
| `gemini-3.1-flash-lite` | Gemini 3.1 Flash-Lite | stable |
| `gemini-3.5-flash` | Gemini 3.5 Flash | stable |
| `gemini-2.5-flash-lite` | Gemini 2.5 Flash-Lite | stable |
| `gemini-2.5-flash` | Gemini 2.5 Flash | stable |
| `gemini-2.5-pro` | Gemini 2.5 Pro | stable |
| `gemini-3-flash-preview` | Gemini 3 Flash | preview |

`stable` は本番向けの固定版、`preview` はプレビュー版です。廃止されたモデル（2.0 系など）で 404 になった場合は、設定から別のモデルへ切り替えてください。

レート制限（429）に達した場合は、しばらく待ってから再試行するか、AI Studio の利用上限を確認してください。

## 制限

- 一度に整理できるのは **40 タブまで**
- ピン留めタブ・`chrome://` 等は対象外
- オンデバイスモードでは Prompt API が使えない環境では利用不可（ポップアップに理由を表示）
- Gemini API モードでは API キーが必要

## 開発

```bash
npm install
npm run check      # 検証 + ESLint
npm run build      # dist/TabClusterAI-{version}.zip を生成
```

### プロジェクト構成

```
TabClusterAI/
├── manifest.json
├── background/     # Service Worker
├── lib/            # AI / タブ操作ロジック
├── popup/          # UI
└── icons/
```

## プライバシー

| モード | データの扱い |
| --- | --- |
| オンデバイス | タブのタイトルと URL は Chrome 内の Gemini Nano で処理。外部 API への送信や API キーは不要 |
| Gemini API | タブのタイトルと URL が Google の Gemini API へ送信される。API キーは `chrome.storage.local` にのみ保存 |

## ライセンス

[MIT License](LICENSE)
