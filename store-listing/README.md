# Chrome Web Store 説明文

Chrome Web Store Developer Dashboard の「Store listing」タブにそのまま貼り付ける、5 言語ぶんの説明文です。

## ファイル一覧

| ファイル | 主言語 | 文字数（参考） |
| --- | --- | --- |
| `description.en.txt` | English | ~4.2 KB |
| `description.ja.txt` | 日本語 | ~4.8 KB |
| `description.de.txt` | Deutsch | ~4.1 KB |
| `description.es.txt` | Español | ~4.0 KB |
| `description.fr.txt` | Français | ~4.2 KB |

すべて Chrome Web Store の上限（16 KB）以内に収まっています。

## Dashboard への反映手順

1. [Developer Dashboard](https://chrome.google.com/webstore/devconsole) → 該当アイテム → **Store listing** タブ
2. 主言語（English）を選び、`description.en.txt` の全文をコピーして **Description** 欄に貼り付け
3. **Add a language** で `Japanese / German / Spanish / French` を追加し、それぞれ対応する `description.*.txt` を貼り付け
4. **保存** → 必要に応じて「審査のため送信」

## 更新時のルール

- 文言を変更したら、必ず **5 言語すべて** を同じ意味に更新する（1 言語だけ進化すると訳ずれが起きる）
- 大きな機能追加（新モード・新言語サポート）は対応する箇所を `✦ FEATURES` セクションに追記
- バージョン番号は説明文には書かない（ストアの「Version」フィールドが正）
- リンクは生 URL で書く（Markdown の `[text](url)` は Web Store で展開されない）

## 関連ドキュメント

- プライバシーポリシー本体: [`../PRIVACY.md`](../PRIVACY.md)
  - 配信 URL: `https://0xmokuren.github.io/TabClusterAI/PRIVACY.html`
- GitHub Sponsors: `https://github.com/sponsors/0xmokuren`
