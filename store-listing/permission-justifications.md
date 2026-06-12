# Permission justifications

Chrome Web Store Developer Dashboard 「Privacy practices」タブで、各権限について 1〜2 文の理由を求められます。以下をそのままコピペできます（英語）。

## Single purpose description

> Tab Cluster AI's single purpose is to group the user's open browser tabs into meaningful Chrome tab groups, either using Chrome's built-in on-device AI (Prompt API / Gemini Nano), the user's own Gemini API key, or a simple by-domain rule. All other features (preferences, diagnostics, model selection) exist only to support this single grouping workflow.

## `tabs` permission

> The extension reads the title and URL of each open, ungrouped, non-pinned tab in the active window so that the AI (or the by-domain rule) can decide which tabs belong together. No tab data is read in the background — only when the user explicitly clicks "Analyze with AI" or "Organize by domain".

## `tabGroups` permission

> Used only to create new Chrome tab groups, name them, color them, and add tabs to them after the user reviews the preview and clicks "Apply groups". The extension also reads existing group titles to offer "merge into existing group" suggestions.

## `storage` permission

> Used to persist the user's preferences in `chrome.storage.local`: the chosen provider (on-device vs. Gemini API), the user's own Gemini API key (if any), the selected Gemini model id, and a free-text "grouping preferences" note. Nothing is sent to a remote server.

## Host permission: `https://generativelanguage.googleapis.com/*`

> Required only for Gemini API mode. When the user picks "Gemini API" and clicks "Analyze with AI", the extension POSTs the open tab titles and URLs to Google's Generative Language API using the user's own API key. No other host is contacted; on-device mode and "Organize by domain" make no network requests.

## Remote code

> No. The extension ships with all of its JavaScript bundled. It does not load or `eval()` any code fetched from a remote server.
