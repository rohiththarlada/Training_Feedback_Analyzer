# Training Feedback Analyser (React + Gemini)

## What changed
- Upload the original `Trainer_Feedback.csv` without adding any columns.
- Click **Classify comments with AI** to generate sentiment, theme, summary, and suggested action.
- The app classifies unique comments and maps the result back to every matching record.
- Export filtered CSV includes the AI-generated fields.
- The Gemini API key is only read by the Vercel serverless function; it is not included in frontend code.

## 1. Create a Gemini API key
Create a key in Google AI Studio: https://aistudio.google.com/apikey

Do not paste the key into `src/App.jsx`, commit it to GitHub, or share it in screenshots.

## 2. Configure Vercel
1. Push this project to GitHub.
2. Import the repository into Vercel.
3. In **Project Settings → Environment Variables**, add:
   - Name: `GEMINI_API_KEY`
   - Value: your Gemini API key
   - Environment: Production (and Preview if you want preview deployments to work)
4. Redeploy the project after adding the variable.

Vercel uses `api/classify.js` as the serverless endpoint. Do not expose the key with a `VITE_` variable.

## 3. Run locally
Vite by itself does not run Vercel serverless functions. Install the Vercel CLI, then use Vercel's local development server:

```bash
npm install
npm install --global vercel
vercel dev
```

When prompted, link the project to your Vercel project (or create a local project). Add `GEMINI_API_KEY` to the local `.env` file (do not commit `.env`).

Alternatively, test after deploying to a Vercel preview URL.

## 4. Use the dashboard
1. Upload the original CSV.
2. Click **Classify comments with AI**.
3. Wait for the success message.
4. Check the sentiment chart, theme chart, and feedback records.
5. Use **Export filtered CSV** to save the enriched results.

## Important notes
- This is AI-generated classification and can be wrong. Manually verify a sample before reporting accuracy.
- Do not calculate model accuracy by comparing the AI's labels against themselves. Enter independent human labels for the verification sample.
- Only comments are sent to the Gemini API for classification. The original input file is not modified.
- API usage is subject to Google's current quotas, availability, and terms.
