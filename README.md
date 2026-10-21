<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ItDgZ0i3GMH8LO5CEFWGEuPDwpVrRAlf

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
3. Open the app and paste your own OpenRouter API key under **AI 设置 → OpenRouter API 密钥**
4. (Optional) Set a different OpenRouter model id, default is `openai/gpt-4o-mini`

## Security model (GitHub Pages friendly)

- This project uses **BYOK (Bring Your Own Key)**.
- No project-level model API key is embedded during build.
- Each user enters their own OpenRouter API key in the UI.
- The key is stored only in browser storage on that user device (session or local, based on user choice).
