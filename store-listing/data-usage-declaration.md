# Data usage declaration

Chrome Web Store の「Data usage」セクションで何にチェックを入れるか、何を書くかの早見表です。

## "What user data do you plan to collect from users now or in the future?"

以下にチェック:

- [x] **Authentication information** — the Gemini API key the user pastes in
- [x] **Website content** — open tab titles and URLs (only in Gemini API mode)

以下はチェックしない:

- [ ] Personally identifiable information
- [ ] Health information
- [ ] Financial and payment information
- [ ] Personal communications
- [ ] Location
- [ ] Web history
- [ ] User activity

> Note: タブの URL は技術的には「ブラウジング履歴」ではありません。ユーザーが現在開いているタブのスナップショットのみで、`chrome.history` には触れません。Google のガイドラインに従い "Website content" として申告するのが正解です。

## Certifications (必須・3 つすべて Yes)

- [x] **I do not sell or transfer user data to third parties, outside of the approved use cases.**
- [x] **I do not use or transfer user data for purposes that are unrelated to my item's single purpose.**
- [x] **I do not use or transfer user data to determine creditworthiness or for lending purposes.**

## Privacy policy URL

```
https://0xmokuren.github.io/TabClusterAI/PRIVACY.html
```

> GitHub Pages を有効化したあと、リポジトリ直下の `PRIVACY.md` がこの URL で配信されます（あるいは `https://github.com/0xmokuren/TabClusterAI/blob/main/PRIVACY.md` を暫定で使用しても可）。

## Disclosure tab — verbal description

Dashboard で求められた場合に貼れる説明文（英語）:

> Tab Cluster AI handles two categories of user data:
>
> 1. The user's Gemini API key (only when the user chooses Gemini API mode and pastes it). It is stored locally in `chrome.storage.local` and is sent only to Google's Generative Language API on the user's behalf. It is never transmitted to the extension author.
>
> 2. The titles and URLs of the user's currently open, ungrouped, non-pinned tabs. These are read only when the user explicitly clicks "Analyze with AI" or "Organize by domain". In on-device mode and "Organize by domain" mode they never leave the browser. In Gemini API mode they are POSTed to `https://generativelanguage.googleapis.com` using the user's own API key.
>
> The extension contains no analytics, no telemetry, no advertising SDK, and no remote code. Source code is publicly available at https://github.com/0xmokuren/TabClusterAI.
