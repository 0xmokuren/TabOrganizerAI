# Chrome Web Store 提出素材

Tab Cluster AI を Chrome Web Store に申請するときに [Developer Dashboard](https://chrome.google.com/webstore/devconsole) で入力する内容を、コピペできる形でまとめたディレクトリです。

## このディレクトリの中身

| ファイル | Dashboard 内のどこで使うか |
| --- | --- |
| `description.en.txt` | Store listing → Description（英語、メイン言語） |
| `description.ja.txt` | Store listing → 言語追加 → 日本語 |
| `description.de.txt` | Store listing → 言語追加 → ドイツ語 |
| `description.es.txt` | Store listing → 言語追加 → スペイン語 |
| `description.fr.txt` | Store listing → 言語追加 → フランス語 |
| `permission-justifications.md` | Privacy practices → 各権限の正当化説明 |
| `data-usage-declaration.md` | Privacy practices → Data usage の選択肢 + 認証文 |
| `screenshot-guide.md` | スクリーンショット 5 枚の撮影手順 |

リポジトリルートの [`PRIVACY.md`](../PRIVACY.md) はプライバシーポリシー本体です。GitHub Pages を有効化すると `https://0xmokuren.github.io/TabClusterAI/PRIVACY.html` で配信されます。

## 申請フロー（残り作業）

| # | 作業 | 担当 |
| --- | --- | --- |
| 1 | このブランチをマージし、`PRIVACY.md` を main に置く | あなた |
| 2 | リポジトリ Settings → Pages → Source: `main` / root を有効化 | あなた |
| 3 | `screenshot-guide.md` に従って 1〜5 枚撮影 | あなた |
| 4 | [Developer Dashboard](https://chrome.google.com/webstore/devconsole) → 新しいアイテム → `dist/TabClusterAI-1.5.3.zip` をアップロード | あなた |
| 5 | Store listing タブ: メイン言語を English にして `description.en.txt` を貼り付け、アイコン (`icons/icon128.png`) とスクリーンショットをアップロード | あなた |
| 6 | 言語を追加 (Japanese / German / Spanish / French) し、各 description.*.txt を貼り付け | あなた |
| 7 | Privacy practices タブ: `permission-justifications.md` と `data-usage-declaration.md` の内容を入力。Privacy policy URL に `https://0xmokuren.github.io/TabClusterAI/PRIVACY.html` を入れる | あなた |
| 8 | Distribution タブ: 配信地域を選択（通常は全地域）、価格は無料 | あなた |
| 9 | 「審査のために送信」 | あなた |

## カテゴリ

> Productivity / Workflow & Planning

## 検索キーワード（任意・各掲載言語に 1 つの欄）

英語:
```
tab manager, tab groups, ai, gemini, gemini nano, on-device ai, productivity
```

日本語:
```
タブ管理, タブグループ, AI, Gemini, オンデバイスAI, 生産性
```
