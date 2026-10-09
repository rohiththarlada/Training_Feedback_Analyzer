import React, { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title);

const ALIASES = {
  course: ["course", "course name", "training course", "program", "programme"],
  trainer: ["trainer", "trainer name", "facilitator", "instructor"],
  date: ["session date", "date", "training date", "feedback date", "response date", "timestamp"],
  mode: ["mode", "training mode", "delivery mode", "session mode"],
  content: ["content relevance", "content relevance 1to5", "content relevance (1-5)", "content relevance 1 5", "content rating"],
  trainerEffectiveness: ["trainer effectiveness", "trainer effectiveness 1to5", "trainer effectiveness (1-5)", "trainer effectiveness 1 5", "trainer rating"],
  pace: ["pace", "pace 1to5", "pace (1-5)", "pace 1 5", "training pace"],
  application: ["likely to apply", "likely to apply 1to5", "likely to apply (1-5)", "likely to apply 1 5", "application", "application rating"],
  overall: ["overall score", "overall score 1to5", "overall score (1-5)", "overall rating", "overall"],
  comments: ["comments", "comment", "feedback comments", "feedback", "open ended feedback", "written feedback", "response"],
  sentiment: ["sentiment", "ai sentiment", "predicted sentiment", "sentiment label"],
  theme: ["theme", "ai theme", "predicted theme", "comment theme", "category"],
  summary: ["ai summary", "summary", "comment summary", "explanation"],
  action: ["suggested action", "recommended action", "action recommendation", "action"],
  manualSentiment: ["manual sentiment", "verified sentiment", "gold sentiment", "actual sentiment"],
  manualTheme: ["manual theme", "verified theme", "gold theme", "actual theme"],
  verifiedCorrect: ["verified correct", "is correct", "classification correct", "correct prediction"],
  verificationStatus: ["verification status", "verified", "checked status", "manual verification status"],
  id: ["feedback id", "response id", "id", "record id"]
};

const normalizeHeader = value => String(value ?? "").trim().toLowerCase()
  .replace(/[_-]+/g, " ").replace(/[()[\]{}]/g, " ")
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const text = value => String(value ?? "").trim();
const normalizeLabel = value => text(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
const escapeText = value => text(value);

function getValue(row, key) {
  const keys = Object.keys(row);
  for (const alias of (ALIASES[key] || [key])) {
    const match = keys.find(k => normalizeHeader(k) === normalizeHeader(alias));
    if (match !== undefined && text(row[match]) !== "") return row[match];
  }
  const tokens = {
    content: ["content", "relevance"],
    trainerEffectiveness: ["trainer", "effectiveness"],
    application: ["likely", "apply"],
    comments: ["comment"],
    date: ["date"],
    overall: ["overall"]
  }[key];
  if (tokens) {
    const match = keys.find(k => tokens.every(token => normalizeHeader(k).includes(token)));
    if (match !== undefined) return row[match] ?? "";
  }
  return "";
}
function numberValue(value) {
  if (value === null || value === undefined || text(value) === "") return null;
  const n = Number(text(value).replace(/,/g, "").replace(/%$/, ""));
  return Number.isFinite(n) ? n : null;
}
function rating(row, key) {
  const n = numberValue(getValue(row, key));
  return n !== null && n >= 1 && n <= 5 ? n : null;
}
function mean(values) {
  const valid = values.filter(v => v !== null && Number.isFinite(v));
  return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : null;
}
function fmt(value, digits = 2) {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}
function parseDate(value) {
  const s = text(value);
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
  const date = new Date(s);
  return Number.isNaN(date.getTime()) ? null : date;
}
function dateISO(value) {
  const d = parseDate(value);
  return d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` : "";
}
function prettyDate(value) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"}) : (text(value) || "—");
}
function sentimentKind(value) {
  const s = normalizeLabel(value);
  if (s.includes("positive") || s === "pos") return "positive";
  if (s.includes("negative") || s === "neg") return "negative";
  if (s.includes("neutral")) return "neutral";
  return s ? "other" : "unknown";
}
function canonicalize(row, index) {
  const sentiment = text(getValue(row, "sentiment"));
  const theme = text(getValue(row, "theme"));
  const manualSentiment = text(getValue(row, "manualSentiment"));
  const manualTheme = text(getValue(row, "manualTheme"));
  const correctRaw = normalizeLabel(getValue(row, "verifiedCorrect"));
  const status = normalizeLabel(getValue(row, "verificationStatus"));
  let explicitCorrect = null;
  if (["true","yes","y","1","correct","pass"].includes(correctRaw)) explicitCorrect = true;
  else if (["false","no","n","0","incorrect","fail"].includes(correctRaw)) explicitCorrect = false;
  const comparisons = [];
  if (sentiment && manualSentiment) comparisons.push(normalizeLabel(sentiment) === normalizeLabel(manualSentiment));
  if (theme && manualTheme) comparisons.push(normalizeLabel(theme) === normalizeLabel(manualTheme));
  const comparison = explicitCorrect !== null ? explicitCorrect : (comparisons.length ? comparisons.every(Boolean) : null);
  const verified = Boolean(manualSentiment || manualTheme || explicitCorrect !== null ||
    ["verified","checked","complete","completed","yes","true"].includes(status));
  const providedOverall = numberValue(getValue(row, "overall"));
  const dims = {
    content: rating(row, "content"),
    trainerEffectiveness: rating(row, "trainerEffectiveness"),
    pace: rating(row, "pace"),
    application: rating(row, "application")
  };
  return {
    raw: row,
    id: text(getValue(row, "id")) || `row-${index + 1}`,
    course: text(getValue(row, "course")) || "Unspecified course",
    trainer: text(getValue(row, "trainer")) || "Unspecified trainer",
    dateRaw: text(getValue(row, "date")),
    dateISO: dateISO(getValue(row, "date")),
    dateLabel: prettyDate(getValue(row, "date")),
    mode: text(getValue(row, "mode")) || "Unspecified mode",
    ...dims,
    overall: providedOverall !== null && providedOverall >= 1 && providedOverall <= 5
      ? providedOverall : mean(Object.values(dims)),
    comments: text(getValue(row, "comments")),
    sentiment,
    sentimentKind: sentimentKind(sentiment),
    theme,
    summary: text(getValue(row, "summary")),
    action: text(getValue(row, "action")),
    manualSentiment,
    manualTheme,
    verified,
    comparison,
    explicitCorrect
  };
}
function groupBy(rows, key) {
  const map = new Map();
  rows.forEach(row => {
    const value = row[key] || "Unlabelled";
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  });
  return map;
}
function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))].sort((a,b) => a.localeCompare(b));
}
function downloadCsv(rows) {
  if (!rows.length) return;
  const csv = Papa.unparse(rows.map(r => r.raw), { skipEmptyLines: true });
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "training-feedback-filtered.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, note, symbol, tone = "blue" }) {
  return <article className="kpi-card">
    <div className="kpi-top"><span>{label}</span><span className={`kpi-symbol ${tone}`}>{symbol}</span></div>
    <strong>{value}</strong><p>{note}</p>
  </article>;
}
function SectionHeading({ title, subtitle, right }) {
  return <div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{right}</div>;
}
function EmptyChart({ show, children }) {
  return show ? <p className="chart-empty">{children}</p> : null;
}

export default function App() {
  const fileInput = useRef(null);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("Upload a CSV to populate the dashboard.");
  const [messageType, setMessageType] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [filters, setFilters] = useState({ course:"", trainer:"", mode:"", sentiment:"", from:"", to:"", search:"" });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => rows.filter(r => {
    if (filters.course && r.course !== filters.course) return false;
    if (filters.trainer && r.trainer !== filters.trainer) return false;
    if (filters.mode && r.mode !== filters.mode) return false;
    if (filters.sentiment && r.sentiment !== filters.sentiment) return false;
    if (filters.from && r.dateISO && r.dateISO < filters.from) return false;
    if (filters.to && r.dateISO && r.dateISO > filters.to) return false;
    const q = normalizeLabel(filters.search);
    if (q && !normalizeLabel([r.course,r.trainer,r.comments,r.sentiment,r.theme,r.summary].join(" ")).includes(q)) return false;
    return true;
  }), [rows, filters]);

  const courseOptions = useMemo(() => unique(rows.map(r=>r.course).filter(v=>v!=="Unspecified course")), [rows]);
  const trainerOptions = useMemo(() => unique(rows.map(r=>r.trainer).filter(v=>v!=="Unspecified trainer")), [rows]);
  const modeOptions = useMemo(() => unique(rows.map(r=>r.mode).filter(v=>v!=="Unspecified mode")), [rows]);
  const sentimentOptions = useMemo(() => unique(rows.map(r=>r.sentiment)), [rows]);

  const kpis = useMemo(() => {
    const labelled = filtered.filter(r=>r.sentiment);
    const negative = labelled.filter(r=>r.sentimentKind==="negative").length;
    return {
      responseCount: filtered.length,
      overall: mean(filtered.map(r=>r.overall)),
      courseCount: unique(filtered.map(r=>r.course).filter(v=>v!=="Unspecified course")).length,
      negative,
      labelledCount: labelled.length,
      scoreCount: filtered.filter(r=>r.overall!==null).length
    };
  }, [filtered]);

  const courseSummary = useMemo(() => [...groupBy(filtered,"course").entries()].map(([course, rs]) => ({
    course, count: rs.length,
    content: mean(rs.map(r=>r.content)),
    trainer: mean(rs.map(r=>r.trainerEffectiveness)),
    pace: mean(rs.map(r=>r.pace)),
    application: mean(rs.map(r=>r.application)),
    overall: mean(rs.map(r=>r.overall))
  })).sort((a,b)=>(b.overall ?? -1)-(a.overall ?? -1)), [filtered]);

  const sentimentCounts = useMemo(() => {
    const counts = { Positive:0, Neutral:0, Negative:0, Other:0 };
    filtered.forEach(r => {
      if (!r.sentiment) return;
      if (r.sentimentKind === "positive") counts.Positive++;
      else if (r.sentimentKind === "neutral") counts.Neutral++;
      else if (r.sentimentKind === "negative") counts.Negative++;
      else counts.Other++;
    });
    return counts;
  }, [filtered]);

  const themeCounts = useMemo(() => {
    const counts = new Map();
    filtered.forEach(r => { if (r.theme) counts.set(r.theme, (counts.get(r.theme)||0)+1); });
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  }, [filtered]);

  const verification = useMemo(() => {
    const eligible = filtered.filter(r=>r.verified && r.comparison !== null);
    const correct = eligible.filter(r=>r.comparison === true).length;
    const incorrectRows = eligible.filter(r=>r.comparison === false);
    const sentimentRows = filtered.filter(r=>r.sentiment && r.manualSentiment);
    const themeRows = filtered.filter(r=>r.theme && r.manualTheme);
    const sentimentCorrect = sentimentRows.filter(r=>normalizeLabel(r.sentiment)===normalizeLabel(r.manualSentiment)).length;
    const themeCorrect = themeRows.filter(r=>normalizeLabel(r.theme)===normalizeLabel(r.manualTheme)).length;
    return { eligible, correct, incorrect: eligible.length-correct, incorrectRows,
      accuracy: eligible.length ? correct/eligible.length*100 : null,
      sentimentRows, sentimentCorrect, themeRows, themeCorrect };
  }, [filtered]);

  const insights = useMemo(() => {
    if (!filtered.length) return [];
    const dims = [
      ["Content relevance","content"],["Trainer effectiveness","trainerEffectiveness"],
      ["Pace","pace"],["Likelihood to apply","application"]
    ].map(([label,key])=>({label, score:mean(filtered.map(r=>r[key]))})).filter(x=>x.score!==null).sort((a,b)=>a.score-b.score);
    const result = [];
    if (dims.length) {
      result.push({type:"warn", title:`Review ${dims[0].label.toLowerCase()}`, body:`This has the lowest average rating among available dimensions (${dims[0].score.toFixed(2)} out of 5). Review related comments before choosing an action.`});
      const highest = dims[dims.length-1];
      if (highest.score-dims[0].score >= .5) result.push({type:"good", title:`Relative strength: ${highest.label.toLowerCase()}`, body:`This dimension has the highest average rating (${highest.score.toFixed(2)} out of 5). Check comments for practices worth retaining.`});
    } else result.push({type:"warn", title:"Rating data unavailable", body:"No valid 1–5 ratings were detected. Check the CSV headers and values."});
    const labelled = filtered.filter(r=>r.sentiment);
    const negatives = labelled.filter(r=>r.sentimentKind==="negative");
    if (negatives.length) result.push({type:"warn", title:"Review negative-labelled comments", body:`${negatives.length} comments are labelled negative (${(negatives.length/labelled.length*100).toFixed(1)}% of labelled comments). Inspect them and manually verify a sample.`});
    else if (!labelled.length) result.push({type:"warn", title:"Comments are not classified yet", body:"Click “Classify comments with AI” in the upload panel to generate sentiment and theme labels from your original comments."});
    if (themeCounts.length) result.push({type:"good", title:`Most frequent theme: ${themeCounts[0][0]}`, body:`${themeCounts[0][1]} records have this label. Read sample comments to understand the theme in context.`});
    return result;
  }, [filtered, themeCounts]);

  const totalPages = Math.ceil(filtered.length/pageSize);
  const visibleRows = filtered.slice((page-1)*pageSize, page*pageSize);

  function updateFilter(key, value) {
    setFilters(old => ({...old, [key]:value}));
    setPage(1);
  }
  function resetFilters() {
    setFilters({course:"",trainer:"",mode:"",sentiment:"",from:"",to:"",search:""});
    setPage(1);
  }

  async function classifyComments() {
    const comments = [...new Set(rows.map(r => r.comments).filter(Boolean))];
    if (!rows.length) {
      setMessage("Upload your original feedback CSV first.");
      setMessageType("error");
      return;
    }
    if (!comments.length) {
      setMessage("No written comments were detected. Check the comments column in your CSV.");
      setMessageType("error");
      return;
    }

    setIsClassifying(true);
    setMessage(`Sending ${comments.length} unique comments for AI classification…`);
    setMessageType("");

    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `AI classification failed (${response.status}).`);
      }

      const labels = new Map((payload.results || []).map(item => [
        text(item.comment),
        { sentiment: text(item.sentiment), theme: text(item.theme), summary: text(item.summary), action: text(item.action) }
      ]));
      if (!labels.size) throw new Error("The AI returned no usable classifications.");

      const updated = rows.map(row => {
        const label = labels.get(row.comments);
        if (!label) return row;
        const raw = {
          ...row.raw,
          Sentiment: label.sentiment,
          Theme: label.theme,
          "AI Summary": label.summary,
          "Suggested Action": label.action
        };
        return canonicalize(raw, Number(String(row.id).replace("row-", "")) - 1 || 0);
      });
      setRows(updated);
      setFilters(old => ({ ...old, sentiment: "" }));
      const classifiedCount = updated.filter(r => r.sentiment).length;
      setMessage(`AI classification complete. Added sentiment and theme labels to ${classifiedCount} records from ${labels.size} unique comments. Your original CSV was not changed. You can export the enriched data below.`);
      setMessageType("success");
    } catch (error) {
      setMessage(`${error.message || "Could not classify comments."} Check that GEMINI_API_KEY is configured on Vercel and that you are using Vercel's local development server when testing locally.`);
      setMessageType("error");
    } finally {
      setIsClassifying(false);
    }
  }

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Please select a .csv file exported from Excel.");
      setMessageType("error");
      return;
    }
    setMessage("Reading and validating CSV…");
    setMessageType("");
    Papa.parse(file, {
      header:true, skipEmptyLines:"greedy",
      transformHeader: h => String(h ?? "").replace(/^\uFEFF/,"").trim(),
      complete: result => {
        const raw = (result.data || []).filter(row=>Object.values(row).some(v=>text(v)));
        const headers = result.meta.fields || [];
        if (!headers.length || !raw.length) {
          setMessage("This file appears empty or has no readable header row.");
          setMessageType("error");
          return;
        }
        const hasCourse = headers.some(h => normalizeHeader(h).includes("course"));
        const hasRating = ["content","trainerEffectiveness","pace","application","overall"].some(key =>
          headers.some(h => (ALIASES[key]||[]).some(a=>normalizeHeader(a)===normalizeHeader(h))));
        if (!hasCourse && !hasRating) {
          setMessage("CSV headers were not recognised. Include Course and rating columns such as Content Relevance, Trainer Effectiveness, Pace, Likely to Apply or Overall Score.");
          setMessageType("error");
          return;
        }
        const processed = raw.map(canonicalize);
        setRows(processed);
        setFilters({course:"",trainer:"",mode:"",sentiment:"",from:"",to:"",search:""});
        setPage(1);
        const ratingCount = processed.filter(r=>r.content!==null||r.trainerEffectiveness!==null||r.pace!==null||r.application!==null||r.overall!==null).length;
        const commentCount = processed.filter(r=>r.comments).length;
        setMessage(`Loaded ${processed.length} records from ${file.name}. Recognised ratings in ${ratingCount} records and comments in ${commentCount}.` +
          ((result.errors||[]).length ? ` Parser warnings: ${result.errors.length}; inspect the file if results look unexpected.` : ""));
        setMessageType((result.errors||[]).length ? "" : "success");
      },
      error: error => { setMessage(`Could not read the CSV: ${error.message || "unknown error"}`); setMessageType("error"); }
    });
  }

  const ratingChart = {
    labels:["Content relevance","Trainer effectiveness","Pace","Likely to apply"],
    datasets:[{label:"Average rating",data:[
      mean(filtered.map(r=>r.content)),mean(filtered.map(r=>r.trainerEffectiveness)),
      mean(filtered.map(r=>r.pace)),mean(filtered.map(r=>r.application))
    ].map(v=>v===null?0:Number(v.toFixed(2))),backgroundColor:["#6584ed","#8c6cdb","#35aa9a","#e5a04d"],borderRadius:7,maxBarThickness:42}]
  };
  const courseChart = {
    labels:courseSummary.map(c=>c.course),
    datasets:[{label:"Average overall score",data:courseSummary.map(c=>c.overall===null?0:Number(c.overall.toFixed(2))),backgroundColor:"#6478e8",borderRadius:7,maxBarThickness:48}]
  };
  const sentimentChart = {
    labels:Object.keys(sentimentCounts),
    datasets:[{data:Object.values(sentimentCounts).some(Boolean)?Object.values(sentimentCounts):[1],backgroundColor:Object.values(sentimentCounts).some(Boolean)?["#2ca58d","#a9b3c4","#e26c6c","#e7b45c"]:["#edf0f5"],borderWidth:0,hoverOffset:5}]
  };
  const themeChart = {
    labels:themeCounts.length?themeCounts.map(x=>x[0]):["No theme data"],
    datasets:[{label:"Comments",data:themeCounts.length?themeCounts.map(x=>x[1]):[0],backgroundColor:"#9275dc",borderRadius:6,maxBarThickness:35}]
  };
  const commonOptions = {
    responsive:true, maintainAspectRatio:false,
    plugins:{legend:{labels:{font:{family:"DM Sans",size:11},usePointStyle:true,boxWidth:8,padding:16}}},
  };
  const ratingOptions = {...commonOptions, plugins:{...commonOptions.plugins,legend:{display:false}},scales:{y:{min:0,max:5,ticks:{stepSize:1},grid:{color:"#edf0f5"}},x:{grid:{display:false}}}};
  const horizontalOptions = {...commonOptions,indexAxis:"y",plugins:{...commonOptions.plugins,legend:{display:false}},scales:{x:{beginAtZero:true,max:5,ticks:{stepSize:1},grid:{color:"#edf0f5"}},y:{grid:{display:false}}}};
  const themeOptions = {...commonOptions,indexAxis:"y",plugins:{...commonOptions.plugins,legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0},grid:{color:"#edf0f5"}},y:{grid:{display:false}}}};
  const sentimentHasData = filtered.some(r=>r.sentiment);
  const themeHasData = themeCounts.length > 0;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TF</div><div><strong>FeedbackLab</strong><span>Learning analytics</span></div></div>
      <nav className="nav-links" aria-label="Dashboard sections">
        <a className="nav-link active" href="#overview"><span>▦</span> Overview</a>
        <a className="nav-link" href="#performance"><span>▥</span> Course performance</a>
        <a className="nav-link" href="#comments"><span>☷</span> Comment analysis</a>
        <a className="nav-link" href="#verification"><span>✓</span> AI verification</a>
        <a className="nav-link" href="#records"><span>≡</span> Feedback records</a>
      </nav>
      <div className="sidebar-note"><span className="status-dot"></span><div><strong>Local processing</strong><p>Your selected CSV is analysed in this browser. This app does not upload it to a server.</p></div></div>
      <div className="sidebar-footer">Training Feedback Analyser<br/><span>Project dashboard</span></div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div><p className="eyebrow">LEARNING &amp; DEVELOPMENT</p><h1>Training Feedback Analyser</h1><p className="subtitle">Turn feedback into practical training improvements.</p></div>
        <div className="topbar-actions">
          <span className={`status-pill ${rows.length?"success":"neutral"}`}>{rows.length?`${rows.length.toLocaleString()} records loaded`:"No data loaded"}</span>
          <button className="button button-secondary" disabled={!rows.length} onClick={()=>downloadCsv(filtered)}>Export filtered CSV</button>
        </div>
      </header>

      <section className="upload-panel panel">
        <div className="upload-copy"><div className="upload-icon">↑</div><div><h2>Upload feedback data</h2><p>Upload your original feedback CSV. Then run AI classification here—no sentiment column is needed in your input file.</p><p className="small muted">In Excel, choose <strong>Save As → CSV UTF-8 (Comma delimited)</strong>.</p></div></div>
        <div className="upload-actions">
          <input ref={fileInput} id="csvFile" type="file" accept=".csv,text/csv" onChange={handleFile} />
          <button className="button button-primary" onClick={()=>fileInput.current?.click()}>Choose CSV file</button>
          <span className="file-name">{fileName || "No file selected"}</span>
          <button className="button button-primary" onClick={classifyComments} disabled={!rows.length || isClassifying}>
            {isClassifying ? "Classifying comments…" : "Classify comments with AI"}
          </button>
        </div>
        <div className="upload-message muted">AI uses Gemini through a secure serverless endpoint. Your API key belongs in the server environment, never in React code.</div>
        <div className={`upload-message ${messageType}`} role="status" aria-live="polite">{message}</div>
      </section>

      <section className="filter-panel panel" aria-label="Dashboard filters">
        <SectionHeading title="Filters" subtitle="Filters update the dashboard and feedback table." right={<button className="text-button" disabled={!rows.length} onClick={resetFilters}>Reset filters</button>} />
        <div className="filters-grid">
          <label>Course<select value={filters.course} disabled={!rows.length} onChange={e=>updateFilter("course",e.target.value)}><option value="">All courses</option>{courseOptions.map(v=><option key={v}>{v}</option>)}</select></label>
          <label>Trainer<select value={filters.trainer} disabled={!rows.length} onChange={e=>updateFilter("trainer",e.target.value)}><option value="">All trainers</option>{trainerOptions.map(v=><option key={v}>{v}</option>)}</select></label>
          <label>Training mode<select value={filters.mode} disabled={!rows.length} onChange={e=>updateFilter("mode",e.target.value)}><option value="">All modes</option>{modeOptions.map(v=><option key={v}>{v}</option>)}</select></label>
          <label>Sentiment<select value={filters.sentiment} disabled={!rows.length} onChange={e=>updateFilter("sentiment",e.target.value)}><option value="">All sentiments</option>{sentimentOptions.map(v=><option key={v}>{v}</option>)}</select></label>
          <label>From date<input type="date" value={filters.from} disabled={!rows.length} onChange={e=>updateFilter("from",e.target.value)} /></label>
          <label>To date<input type="date" value={filters.to} disabled={!rows.length} onChange={e=>updateFilter("to",e.target.value)} /></label>
        </div>
      </section>

      <section id="overview" className="dashboard-section">
        <SectionHeading title="Overview" subtitle="Snapshot of the currently filtered feedback." right={<span className="muted small">{filtered.length} of {rows.length} records</span>} />
        <div className="kpi-grid">
          <StatCard label="Total responses" value={kpis.responseCount.toLocaleString()} note={`${kpis.scoreCount} with a usable overall score`} symbol="↗" tone="blue"/>
          <StatCard label="Overall score" value={fmt(kpis.overall)} note="Out of 5, based on available ratings" symbol="★" tone="purple"/>
          <StatCard label="Courses analysed" value={String(kpis.courseCount)} note="Distinct course names" symbol="▤" tone="teal"/>
          <StatCard label="Negative comments" value={kpis.labelledCount?String(kpis.negative):"—"} note={kpis.labelledCount?`${fmt(kpis.negative/kpis.labelledCount*100,1)}% of labelled comments`:"Requires sentiment labels"} symbol="!" tone="orange"/>
        </div>
        <div className="chart-grid">
          <article className="panel chart-panel"><div className="panel-heading"><div><h3>Average rating by dimension</h3><p>Mean of each available rating field</p></div></div><div className="chart-wrap"><Bar data={ratingChart} options={ratingOptions}/></div></article>
          <article className="panel chart-panel"><div className="panel-heading"><div><h3>Sentiment distribution</h3><p>Based on AI-generated sentiment labels</p></div></div><div className="chart-wrap doughnut-wrap"><Doughnut data={sentimentChart} options={{...commonOptions,cutout:"69%",plugins:{...commonOptions.plugins,legend:{position:"bottom",labels:{font:{family:"DM Sans",size:11},usePointStyle:true,boxWidth:8,padding:15}}}}}/></div><EmptyChart show={!sentimentHasData}>Upload your CSV, then click “Classify comments with AI”.</EmptyChart></article>
        </div>
      </section>

      <section id="performance" className="dashboard-section">
        <SectionHeading title="Course performance" subtitle="Compare ratings across courses to identify strengths and improvement areas."/>
        <article className="panel chart-panel wide-chart"><div className="panel-heading"><div><h3>Rating comparison by course</h3><p>Average overall score for each course</p></div></div><div className="chart-wrap"><Bar data={courseChart} options={horizontalOptions}/></div></article>
        <div className="panel table-panel"><div className="panel-heading"><div><h3>Course summary</h3><p>Calculated from currently filtered records.</p></div></div><div className="table-scroll"><table><thead><tr><th>Course</th><th>Responses</th><th>Content relevance</th><th>Trainer effectiveness</th><th>Pace</th><th>Likely to apply</th><th>Overall</th></tr></thead><tbody>
          {courseSummary.length?courseSummary.map(c=><tr key={c.course}><td className="course-name">{c.course}</td><td>{c.count}</td><td>{fmt(c.content)}</td><td>{fmt(c.trainer)}</td><td>{fmt(c.pace)}</td><td>{fmt(c.application)}</td><td><span className="score-pill">{fmt(c.overall)}</span></td></tr>):<tr><td colSpan="7" className="empty-cell">Upload a CSV to see course summaries.</td></tr>}
        </tbody></table></div></div>
      </section>

      <section id="comments" className="dashboard-section">
        <SectionHeading title="Comment analysis" subtitle="Explore comment themes and the feedback behind the ratings."/>
        <div className="chart-grid">
          <article className="panel chart-panel"><div className="panel-heading"><div><h3>Most common themes</h3><p>Themes generated by the AI classifier</p></div></div><div className="chart-wrap"><Bar data={themeChart} options={themeOptions}/></div><EmptyChart show={!themeHasData}>Run AI classification to generate comment themes.</EmptyChart></article>
          <article className="panel insight-panel"><div className="panel-heading"><div><h3>Suggested areas to review</h3><p>Rule-based observations from uploaded data</p></div></div><div className="insights-list">
            {insights.length?insights.map((i,index)=><div key={`${i.title}-${index}`} className="insight-item"><div className={`insight-bullet ${i.type==="good"?"good":""}`}>{i.type==="good"?"✓":"!"}</div><div><h4>{i.title}</h4><p>{i.body}</p></div></div>):<div className="empty-state">Insights will appear after you upload data.</div>}
          </div><p className="disclaimer">These are data-based prompts for review, not proof of cause or automatically verified recommendations.</p></article>
        </div>
      </section>

      <section id="verification" className="dashboard-section">
        <SectionHeading title="AI classification verification" subtitle="Evaluate predictions against independently recorded manual labels."/>
        <div className="kpi-grid">
          <StatCard label="Verified records" value={verification.eligible.length.toLocaleString()} note="Records with usable manual labels" symbol="✓" tone="blue"/>
          <StatCard label="Correct predictions" value={verification.correct.toLocaleString()} note="Among verified records" symbol="✓" tone="teal"/>
          <StatCard label="Verification accuracy" value={verification.accuracy===null?"—":`${verification.accuracy.toFixed(1)}%`} note="Correct ÷ verified × 100" symbol="%" tone="purple"/>
          <StatCard label="Incorrect predictions" value={verification.incorrect.toLocaleString()} note="Investigate common error patterns" symbol="!" tone="orange"/>
        </div>
        <div className="panel note-panel"><strong>How accuracy is calculated</strong><p>The app uses an explicit <code>verified_correct</code> column when available. Otherwise, it compares AI labels with manual labels, such as <code>sentiment</code> versus <code>manual_sentiment</code>. Unverified rows are excluded. Sentiment and theme accuracy are also reported separately.</p><p className="muted">{verification.sentimentRows.length?`Sentiment: ${verification.sentimentCorrect}/${verification.sentimentRows.length} correct (${(verification.sentimentCorrect/verification.sentimentRows.length*100).toFixed(1)}%). `:""}{verification.themeRows.length?`Theme: ${verification.themeCorrect}/${verification.themeRows.length} correct (${(verification.themeCorrect/verification.themeRows.length*100).toFixed(1)}%).`:""}{!verification.sentimentRows.length&&!verification.themeRows.length?"No matching AI/manual label pairs found. Add manual_sentiment and/or manual_theme, or verified_correct.":""}</p></div>
        <div className="panel table-panel"><div className="panel-heading"><div><h3>Incorrect verified classifications</h3><p>Investigate mistakes and improve the AI prompt.</p></div></div><div className="table-scroll"><table><thead><tr><th>Comment</th><th>AI sentiment</th><th>Manual sentiment</th><th>AI theme</th><th>Manual theme</th><th>Verification</th></tr></thead><tbody>
          {verification.incorrectRows.length?verification.incorrectRows.slice(0,100).map(r=><tr key={r.id}><td className="comment-cell">{r.comments||"—"}</td><td>{r.sentiment||"—"}</td><td>{r.manualSentiment||"—"}</td><td>{r.theme||"—"}</td><td>{r.manualTheme||"—"}</td><td><span className="tag incorrect">Incorrect</span></td></tr>):<tr><td colSpan="6" className="empty-cell">No incorrect verified classifications detected, or verification fields are not present.</td></tr>}
        </tbody></table></div></div>
      </section>

      <section id="records" className="dashboard-section">
        <SectionHeading title="Feedback records" subtitle="Search comments and inspect individual ratings and labels." right={<div className="search-box"><span>⌕</span><input type="search" placeholder="Search comments, courses, trainers…" value={filters.search} disabled={!rows.length} onChange={e=>updateFilter("search",e.target.value)} aria-label="Search feedback records"/></div>}/>
        <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Course</th><th>Trainer</th><th>Date</th><th>Overall</th><th>Sentiment</th><th>Theme</th><th>Comment</th></tr></thead><tbody>
          {visibleRows.length?visibleRows.map(r=><tr key={r.id}><td>{r.course}</td><td>{r.trainer}</td><td>{r.dateLabel}</td><td>{r.overall===null?"—":<span className="score-pill">{fmt(r.overall)}</span>}</td><td>{r.sentiment?<span className={`tag ${r.sentimentKind}`}>{r.sentiment}</span>:"—"}</td><td>{r.theme||"—"}</td><td className="comment-cell">{r.comments||"—"}</td></tr>):<tr><td colSpan="7" className="empty-cell">Upload a CSV to see feedback records.</td></tr>}
        </tbody></table></div><div className="table-footer"><span>{filtered.length} record{filtered.length===1?"":"s"}</span><div className="pagination"><button className="button button-secondary button-small" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {filtered.length?page:0} of {totalPages}</span><button className="button button-secondary button-small" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button></div></div></div>
      </section>

      <footer className="footer"><span>Training Feedback Analyser</span><span>Use verified data and human judgement for decisions.</span></footer>
    </main>
  </div>;
}
