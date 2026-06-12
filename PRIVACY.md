# Privacy Policy — Tab Cluster AI

_Last updated: 2026-06-13_

Tab Cluster AI ("the Extension") is an open-source Chrome extension that groups your open tabs using either an on-device AI (Chrome's Prompt API / Gemini Nano) or the Gemini API. This document describes what data the Extension handles, where it goes, and what it does NOT do.

## TL;DR

- The Extension does **not** collect, transmit, or sell any data to the extension author.
- There are no analytics, telemetry, advertising, or remote-config SDKs.
- All settings are stored **locally** in your browser profile (`chrome.storage.local`).
- In **on-device mode**, tab data never leaves your browser.
- In **Gemini API mode**, tab titles and URLs are sent **only** to Google's Generative Language API, using **your own** API key.
- In **Organize by domain** mode, no AI is used and nothing is sent anywhere.

## Data the Extension reads

When you click "Analyze with AI" or "Organize by domain", the Extension reads from the current Chrome window:

- The **title** of each open tab.
- The **URL** of each open tab.
- Whether each tab is pinned or already in a group (to exclude it).

Pinned tabs, `chrome://` pages, and tabs already in a group are excluded.

## Where the data goes

| Mode | Where tab titles + URLs go | Stored on disk |
| --- | --- | --- |
| On-device (Gemini Nano) | Processed locally by Chrome. Never leaves your browser. | No |
| Gemini API | Sent to `https://generativelanguage.googleapis.com` (Google) over HTTPS, using **your** API key. | No (only your API key + preferences) |
| Organize by domain | Not sent anywhere. Hostnames are compared locally. | No |

The Extension makes **no other network requests**. It does not contact the author, any analytics service, or any third party.

## Data stored locally

The following items are stored in `chrome.storage.local` for **this Chrome profile only**:

- Your Gemini API key (if you entered one).
- Your selected provider (on-device / Gemini API).
- Your selected Gemini model id.
- Your free-text "grouping preferences" note (if you entered one).
- A short diagnostic cache of Prompt API status (no tab data).

Uninstalling the Extension clears these. The author has no access to them.

## Google's handling of your Gemini API requests

When you use Gemini API mode, your requests are subject to **Google's** terms and privacy policy for the Generative Language API:

- Generative Language API — <https://ai.google.dev/gemini-api/terms>
- Google Privacy Policy — <https://policies.google.com/privacy>

The Extension author has no visibility into, and no control over, how Google handles those requests. Your API key is your responsibility — keep it private and revoke it from [Google AI Studio](https://aistudio.google.com/apikey) if compromised.

## Permissions and why they're needed

| Permission | Why |
| --- | --- |
| `tabs` | Read the titles and URLs of open tabs in the active window so the AI can suggest groupings. |
| `tabGroups` | Create, name, and color Chrome tab groups after you click "Apply groups". |
| `storage` | Save your API key, model choice, and preferences locally in this browser. |
| Host: `https://generativelanguage.googleapis.com/*` | Send your tab titles and URLs to the Gemini API **only** when you use Gemini API mode. |

The Extension does **not** request `<all_urls>`, scripting, cookies, history, or any host permission other than the Gemini API endpoint.

## Children

The Extension is not directed at children under 13 and does not knowingly collect personal information from them.

## Changes to this policy

Material changes will be published in this file in the public GitHub repository. The "Last updated" date at the top reflects the most recent revision.

## Contact

- GitHub Issues: <https://github.com/0xmokuren/TabClusterAI/issues>
- Source code: <https://github.com/0xmokuren/TabClusterAI>
