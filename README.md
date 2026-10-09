# Training Feedback Analyser (React + Gemini)

[![Live App](https://img.shields.io/badge/Live%20App-Open%20Dashboard-brightgreen)](https://training-feedback-analyzer-loy4.vercel.app/)

## Live Link

**Open the application:** https://training-feedback-analyzer-loy4.vercel.app/

## Project Details

| Item | Details |
|---|---|
| Project ID | T45 |
| Project name | Training Feedback Analyser |
| Course deliverable | MBA Mini Project |
| Marks | 30 |
| Theme | AI Text Analytics |
| Main tools | React, Gemini API, Vercel, Excel/CSV |

### Objective

The project helps a training manager analyse participant feedback, compare course and trainer ratings, identify themes in written comments, prioritise courses for review, and prepare draft trainer feedback notes.

### Project tasks

1. Summarise ratings by course and trainer.
2. Use an LLM to classify comments into themes and manually check a sample.
3. Rank courses for redesign or further review.
4. Draft feedback notes for trainers.

### Submission deliverables

- A working build link, app file, or screen recording.
- The source workbook with output sheets added.
- An AI-use log containing at least 15 entries.
- A 3–5 page report with recommendations and reflection.
- At least three documented prompt-improvement rounds, including reasons and actual observed results.

## What the App Does

- Upload the original `Trainer_Feedback.csv` without adding any columns.
- Click **Classify comments with AI** to generate sentiment, theme, summary, and suggested action.
- The app classifies unique comments and maps the result back to every matching record.
- The **Export filtered CSV** feature includes the AI-generated fields.
- The Gemini API key is read only by the Vercel serverless function; it should not be included in frontend code.

## Dataset and Data Protection

The T45 project brief describes 300 synthetic training feedback forms in a `Training Feedback` sheet with 300 rows and 10 columns. The deployed app flow described here accepts the original `Trainer_Feedback.csv` file.

- Use only synthetic or otherwise approved data with public AI tools.
- If the workbook has a `Gold Labels (evaluation)` sheet, **do not send it to Gemini or any AI tool**. Use it only at the end for evaluation.
- Keep an unchanged copy of the source data so that results can be checked.
- Handle blank comments and missing ratings consistently.

## 1. Create a Gemini API Key

Create an API key in Google AI Studio:

https://aistudio.google.com/apikey

Do not paste the key into `src/App.jsx`, commit it to GitHub, or share it in screenshots.

## 2. Configure Vercel

1. Push the project files in the `app` directory to GitHub.
2. Import the repository into Vercel.
3. In **Project Settings → Environment Variables**, add:

   | Field | Value |
   |---|---|
   | Name | `GEMINI_API_KEY` |
   | Value | Your Gemini API key |
   | Environment | Production; add Preview too if preview deployments need the key |

4. Redeploy the project after adding or changing the environment variable.

Vercel uses `api/classify.js` as the serverless endpoint. Do not expose the key through a `VITE_` environment variable or frontend code.

## 3. Run Locally

Vite by itself does not run Vercel serverless functions. Install the project dependencies and Vercel CLI, then start Vercel's local development server:

```bash
npm install
npm install --global vercel
vercel dev
```

When prompted, link the project to your Vercel project or create a local project. Set `GEMINI_API_KEY` in a local `.env` file. **Do not commit `.env` to GitHub.**

Alternatively, test the app using a Vercel Preview deployment.

## 4. Use the Dashboard

1. Open the live app.
2. Upload the original CSV file.
3. Click **Classify comments with AI**.
4. Wait for the success message.
5. Review the sentiment chart, theme chart, and feedback records.
6. Use **Export filtered CSV** to download the enriched results.

## Course Redesign Ranking

Use verified scorecard averages and written comments together to decide which courses should be reviewed first. A low score signals a need to investigate; it does not automatically prove that a full redesign is required.

The project scorecard prepared during analysis listed this order. **Verify these figures against the final workbook before using them as final results.**

| Rank | Course | Responses | Overall average (/5) | Suggested review priority |
|---:|---|---:|---:|---|
| 1 | GenAI for Managers | 53 | 3.59 | High |
| 2 | POSH Awareness | 53 | 3.61 | High |
| 3 | Advanced Excel | 40 | 3.68 | High |
| 4 | Consultative Selling | 56 | 3.70 | Medium |
| 5 | Leadership Essentials | 47 | 3.74 | Low |
| 6 | Data Storytelling | 51 | 3.84 | Low |

For this six-course project, High is assigned to ranks 1–3, Medium to rank 4, and Low to ranks 5–6. This is a project-specific screening rule, not a universal threshold.

## AI Comment Themes

Use the five approved themes for consistent classification:

1. **Content Relevance**
2. **Trainer Effectiveness**
3. **Pace of Session**
4. **Practical Application**
5. **Training Facilities & Equipment**

A comment may receive more than one theme if the wording supports it. Theme totals may therefore exceed the number of feedback records. Review examples manually because AI classifications can be incorrect.

## Manual Validation and Accuracy

Manually assign themes to a sample of comments and compare the independent human labels with AI-generated labels.

**Exact-match accuracy:**

`Exact-match accuracy = exact matches / completed manual checks`

An exact match requires the complete set of AI-assigned themes to equal the complete manually assigned theme set. Partial overlap counts as a mismatch under this rule.

Record the sample size, how the sample was selected, exact matches, mismatches, accuracy, and common mismatch types. Exclude pending or blank manual checks from the accuracy denominator. Do not calculate model accuracy by comparing AI labels against themselves.

## Prompt Improvement Rounds

The T45 rubric requires at least three documented prompt-improvement rounds. A possible sequence is:

1. **Baseline classification:** Ask Gemini to assign approved themes and give a short reason.
2. **Improve consistency:** Require exact approved theme names, evidence for each theme, and no unsupported inference.
3. **Improve output reliability:** Require structured output and consistent handling of blank or irrelevant comments.

For every round, save the exact prompt, tool/model, test sample, example outputs, errors observed, reason for the change, and actual before/after result. Mark a round as successful only after running and comparing it.

## Trainer Feedback Notes

Trainer feedback notes should be grounded in rating averages and, where available, trainer-specific comments. Use constructive language and describe suggested actions as drafts for human review. Generic template text must not be represented as though it came directly from participants' comments.

## Important Notes and Limitations

- AI-generated classification can be wrong. Manually verify a sample before reporting accuracy.
- Do not calculate model accuracy by comparing AI labels against themselves; use independently assigned human labels.
- Only comments are sent to the Gemini API for classification. The original input file is not modified by the classification workflow.
- Verify numerical summaries against the source workbook before submitting results.
- AI-generated summaries and suggested actions are recommendations for human review, not definitive conclusions.
- API usage is subject to Google's current quotas, availability, and terms.

## Responsible AI and Security

- Use free-tier tools as required by the project brief, subject to the provider's limits and terms.
- Never send real personal or confidential information to public AI tools.
- Never send the `Gold Labels (evaluation)` sheet to Gemini.
- Never commit an API key or secret to GitHub.
- Store `GEMINI_API_KEY` in Vercel Environment Variables or a local `.env` file excluded from version control.
- Do not expose API keys in frontend code, screenshots, or documentation.
- Disclose AI-generated content in the final report.

## Repository Structure

The GitHub repository currently uses these main folders:

```text
Training_Feedback_Analyzer/
├── Report/                    # Project report
├── app/                       # React + Gemini application source
├── prompt_improvement_rounds/ # Prompt versions, reasons, and evidence
├── screenrecording/            # App demonstration recording
├── submission_workbook/       # Workbook and analysis outputs
└── README.md                  # Project instructions and documentation
```

Keep generated app files in their expected framework locations. Do not commit secret files such as `.env`.

## Final Submission Checklist

- [ ] Live app link works and the core workflow has been tested.
- [ ] Course and trainer statistics have been checked against the source data.
- [ ] Comment themes have been generated and a sample manually reviewed.
- [ ] Course redesign ranking and recommendations are documented.
- [ ] Trainer feedback notes are included and human-reviewed.
- [ ] Workbook contains the required output sheets.
- [ ] AI-use log has at least 15 entries.
- [ ] Three prompt-improvement rounds include actual test results.
- [ ] The report is 3–5 pages and includes recommendations, limitations, AI disclosure, and reflection.
- [ ] App link or screen recording is included in the final submission.
- [ ] No API key or confidential data is committed to the public repository.

## Evaluation Rubric Alignment

| Criterion | Marks | Evidence |
|---|---:|---|
| Working build | 8 | App source, tested workflow, link/file/recording |
| Correctness and verification | 7 | Numerical checks, manual validation, accuracy and mismatch review |
| Prompting and iteration | 5 | Three documented and tested prompt rounds |
| Business insight and recommendation | 6 | Course ranking, recommendations, trainer notes |
| Documentation and reflection | 4 | AI-use log, report, limitations, responsible-AI disclosure |
| **Total** | **30** | |

---

**Before final submission:** Update any pending or planned work with actual test evidence. Do not claim deployment, prompt improvements, or accuracy results that have not been measured.
