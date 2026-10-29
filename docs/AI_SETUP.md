# LERNEX AI — setup (Stage 1)

Stage 1 covers **Coding, Music and Spoken English**:

- **Learner Progress**: every public post in these skills gets an AI review in the background. The profile shows whether the member is improving.
- **AI Mentor Test**: replaces the written quiz for these three skills. A random live task plus feedback on a sample learner's work.

Everything runs in the background. If the AI is down, slow or has no keys, the app keeps working: reviews wait, and mentor tests go to an admin.

## 1. Get the free keys (no credit card)

| Provider | Role | Where |
|---|---|---|
| **Google Gemini** | Main judge, can listen to audio | https://aistudio.google.com → **Get API key** → Create API key |
| **Groq** | Backup judge + speech-to-text | https://console.groq.com → **API Keys** → Create API Key |

- Don't add a billing account or card to either. Without billing, nothing can be charged. When a free limit is reached, requests are simply refused and LERNEX waits.
- On free tiers, providers may use the content sent to them to improve their services. LERNEX only sends **public** posts and mentor-test answers, never private posts or chats.

## 2. Add them to Render

Render → `lernex-api` → **Environment** → Add:

```
GEMINI_API_KEY = <your Gemini key>
GROQ_API_KEY   = <your Groq key>
```

Save. Render redeploys automatically. Never put keys in the code or in chat.

### Optional settings

These are changed in the Render dashboard, not in code.

| Variable | Default | Meaning |
|---|---|---|
| `GEMINI_MODEL` | `gemini-2.5-flash` | Change if Google renames/retires the model |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq text model |
| `GROQ_WHISPER_MODEL` | `whisper-large-v3-turbo` | Groq speech-to-text model |
| `AI_DAILY_LIMIT_GEMINI` | `200` | Our own daily cap (kept below the free quota) |
| `AI_DAILY_LIMIT_GROQ` | `500` | Our own daily cap |
| `AI_MIN_GAP_MS` | `4500` | Gap between AI requests (per-minute limits) |

## 3. Check it works

In the app: **Profile → Admin Management → AI tab → Test connection**. Both providers should show ✓. The same tab shows:

- today's usage per provider, and whether a provider is resting after a limit
- per-skill switches for Progress and Mentor test (turning the test off brings back the quiz for that skill)
- the mentor tests waiting for your decision (approve / reject / ask the AI again)

## How decisions are made

**Post reviews:**
- A checklist per skill, scored 0–100 per item.
- Music also uses our own pitch analyzer; Spoken English uses our own pace/filler/pause measurements.
- Progress = average of recent posts vs earlier posts. It needs at least 3 confident reviews, and real mentor ratings count for 30% of each post's score.

**Mentor test:**
- Score = 70% performance + 30% mentoring feedback.
- **75+** → Mentor in that skill. **Below 55** → feedback, and they can retry after 7 days.
- **55–74, low AI confidence, a missing check phrase, a short recording, or AI unavailable** → admin review.

**Fallbacks:**
- Gemini fails or is rate-limited → Groq handles text and transcripts.
- Music with no listening model → our pitch measurement only. It's shown, but never used for trends or mentor decisions.

## Testing (developers)

See `backend/test/ai/`:

- `pitch-check.mjs`: our pitch analyzer on generated tones.
- `ai-e2e.mjs`: full flows against a fake Gemini/Groq, including outages, 429s and bad replies.
- `no-ai-e2e.mjs`: the app with no keys.
