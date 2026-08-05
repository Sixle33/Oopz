import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Globe2,
  MessageCircle,
  ShieldCheck,
  ShieldAlert,
  Send,
  Languages,
  Loader2,
  Clock,
  X,
  Pencil,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Claude API helpers                                                 */
/* ------------------------------------------------------------------ */

async function askClaude(prompt, maxTokens = 400) {
  // Calls our own serverless function (see /api/claude.js) so the
  // Anthropic API key never has to live in the browser.
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, maxTokens }),
  });
  if (!response.ok) throw new Error("Claude request failed");
  const data = await response.json();
  return (data.text || "").trim();
}

async function translateText(text, targetLang) {
  try {
    const out = await askClaude(
      `Translate the following text into ${targetLang}. Respond with ONLY the translated text — no quotes, no notes, no preamble.\n\nText:\n${text}`,
      500
    );
    return out || text;
  } catch (e) {
    return null;
  }
}

async function safetyCheck(text) {
  try {
    const raw = await askClaude(
      `You are a lightweight safety reviewer for a global social app connecting strangers across countries. Read the message below and decide if it shows signs of: a scam or phishing attempt, harassment or hate speech, or a stranger pressuring someone for money/personal/financial info. Most everyday messages are fine — only flag real risk, not just bluntness or a foreign language.\n\nRespond with ONLY compact JSON, no markdown fences, in this exact shape:\n{"flagged": boolean, "category": "none" | "scam" | "harassment" | "privacy_risk", "reason": "one short plain sentence, empathetic tone"}\n\nMessage:\n"""${text}"""`,
      250
    );
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (e) {
    return { flagged: false, category: "none", reason: "" };
  }
}

async function personaReply(contact, incomingTranslated) {
  try {
    const out = await askClaude(
      `Roleplay briefly as ${contact.name}, a person living in ${contact.city} who writes in ${contact.lang}. A pen pal from another country just wrote to you (already translated into ${contact.lang} for you): "${incomingTranslated}". Reply warmly and naturally in 1-2 short sentences, in ${contact.lang} only. Output ONLY their reply text.`,
      200
    );
    return out;
  } catch (e) {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Seed data                                                          */
/* ------------------------------------------------------------------ */

const LANGUAGES = [
  "English",
  "Spanish",
  "Portuguese",
  "French",
  "German",
  "Japanese",
  "Hindi",
  "Arabic",
  "Mandarin",
  "Swahili",
];

const SEED_POSTS = [
  {
    id: "p1",
    name: "Yuki Tanaka",
    city: "Tokyo",
    flag: "🇯🇵",
    lang: "Japanese",
    text: "今日の夕焼けは特別だった。誰かと分かち合いたくて。",
    time: Date.now() - 1000 * 60 * 42,
  },
  {
    id: "p2",
    name: "Amara Okafor",
    city: "Lagos",
    flag: "🇳🇬",
    lang: "English",
    text: "Started my own small business today. Scary and exciting all at once.",
    time: Date.now() - 1000 * 60 * 105,
  },
  {
    id: "p3",
    name: "Lucas Ferreira",
    city: "São Paulo",
    flag: "🇧🇷",
    lang: "Portuguese",
    text: "Chuva a tarde toda, café quente, e um bom livro. Dia perfeito.",
    time: Date.now() - 1000 * 60 * 210,
  },
  {
    id: "p4",
    name: "Priya Nair",
    city: "Mumbai",
    flag: "🇮🇳",
    lang: "Hindi",
    text: "आज पहली बार बारिश में भीगा। बचपन याद आ गया।",
    time: Date.now() - 1000 * 60 * 300,
  },
  {
    id: "p5",
    name: "Elena Kowalski",
    city: "Berlin",
    flag: "🇩🇪",
    lang: "German",
    text: "Neue Stadt, neue Sprache, neue Freunde. Es ist nicht leicht, aber es lohnt sich.",
    time: Date.now() - 1000 * 60 * 400,
  },
];

const CONTACTS = [
  { id: "c1", name: "Lucas Ferreira", city: "São Paulo", flag: "🇧🇷", lang: "Portuguese" },
  { id: "c2", name: "Priya Nair", city: "Mumbai", flag: "🇮🇳", lang: "Hindi" },
  { id: "c3", name: "Yuki Tanaka", city: "Tokyo", flag: "🇯🇵", lang: "Japanese" },
];

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

function timeAgo(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Ribbon({ active }) {
  return (
    <div className={"m-ribbon" + (active ? " m-ribbon--dual" : "")}>
      <span className="m-ribbon-dot" />
    </div>
  );
}

function TrustRing({ pct = 100, size = 34 }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} className="m-ring">
      <circle cx={size / 2} cy={size / 2} r={r} className="m-ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="m-ring-value"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function WarningCard({ warning, onEdit, onDismiss }) {
  if (!warning) return null;
  return (
    <div className="m-warning">
      <ShieldAlert size={16} className="m-warning-icon" />
      <div className="m-warning-body">
        <div className="m-warning-title">
          Held back — {warning.category === "scam" ? "possible scam" : warning.category === "harassment" ? "possible harassment" : "privacy risk"}
        </div>
        <div className="m-warning-reason">{warning.reason}</div>
      </div>
      <div className="m-warning-actions">
        <button className="m-btn-ghost" onClick={onEdit}>
          <Pencil size={13} /> Edit
        </button>
        <button className="m-icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const [view, setView] = useState("feed");
  const [lang, setLang] = useState("English");
  const [ready, setReady] = useState(false);

  const [posts, setPosts] = useState([]);
  const [translations, setTranslations] = useState({});
  const [translating, setTranslating] = useState({});

  const [composer, setComposer] = useState("");
  const [posting, setPosting] = useState(false);
  const [postWarning, setPostWarning] = useState(null);

  const [chats, setChats] = useState({});
  const [activeContact, setActiveContact] = useState(CONTACTS[0]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTyping, setReplyingTyping] = useState(false);
  const [chatWarning, setChatWarning] = useState(null);

  const [stats, setStats] = useState({ checked: 0, caught: 0 });

  const scrollRef = useRef(null);

  /* ---- load persisted state ---- */
  useEffect(() => {
    (async () => {
      try {
        const p = await window.storage.get("oopz:feed", true);
        if (p && p.value) setPosts(JSON.parse(p.value));
        else {
          setPosts(SEED_POSTS);
          await window.storage.set("oopz:feed", JSON.stringify(SEED_POSTS), true);
        }
      } catch {
        setPosts(SEED_POSTS);
        try {
          await window.storage.set("oopz:feed", JSON.stringify(SEED_POSTS), true);
        } catch {}
      }
      try {
        const c = await window.storage.get("oopz:chats", false);
        if (c && c.value) setChats(JSON.parse(c.value));
      } catch {}
      try {
        const s = await window.storage.get("oopz:stats", false);
        if (s && s.value) setStats(JSON.parse(s.value));
      } catch {}
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chats, activeContact, replyingTyping]);

  const savePosts = useCallback(async (next) => {
    setPosts(next);
    try {
      await window.storage.set("oopz:feed", JSON.stringify(next), true);
    } catch {}
  }, []);

  const saveChats = useCallback(async (next) => {
    setChats(next);
    try {
      await window.storage.set("oopz:chats", JSON.stringify(next), false);
    } catch {}
  }, []);

  const bumpStats = useCallback(async (flagged) => {
    setStats((prev) => {
      const next = { checked: prev.checked + 1, caught: prev.caught + (flagged ? 1 : 0) };
      window.storage.set("oopz:stats", JSON.stringify(next), false).catch(() => {});
      return next;
    });
  }, []);

  /* ---- feed ---- */
  async function handlePost() {
    const text = composer.trim();
    if (!text || posting) return;
    setPosting(true);
    setPostWarning(null);
    const result = await safetyCheck(text);
    bumpStats(result.flagged);
    if (result.flagged) {
      setPostWarning(result);
      setPosting(false);
      return;
    }
    const newPost = {
      id: "p" + Date.now(),
      name: "You",
      city: "Somewhere",
      flag: "🌍",
      lang,
      text,
      time: Date.now(),
    };
    await savePosts([newPost, ...posts]);
    setComposer("");
    setPosting(false);
  }

  async function handleTranslatePost(post) {
    if (translations[post.id] || translating[post.id]) return;
    setTranslating((p) => ({ ...p, [post.id]: true }));
    const out = await translateText(post.text, lang);
    setTranslations((p) => ({ ...p, [post.id]: out || "Translation unavailable right now." }));
    setTranslating((p) => ({ ...p, [post.id]: false }));
  }

  /* ---- chat ---- */
  const activeMessages = chats[activeContact.id] || [];

  async function handleSendChat() {
    const text = chatInput.trim();
    if (!text || sending) return;
    setSending(true);
    setChatWarning(null);
    const result = await safetyCheck(text);
    bumpStats(result.flagged);
    if (result.flagged) {
      setChatWarning(result);
      setSending(false);
      return;
    }
    const mine = { id: "m" + Date.now(), sender: "me", text, lang };
    const withMine = { ...chats, [activeContact.id]: [...activeMessages, mine] };
    await saveChats(withMine);
    setChatInput("");
    setSending(false);

    setReplyingTyping(true);
    const forThem = await translateText(text, activeContact.lang);
    const reply = await personaReply(activeContact, forThem || text);
    if (reply) {
      const forMe = await translateText(reply, lang);
      const theirs = {
        id: "m" + (Date.now() + 1),
        sender: "them",
        text: reply,
        lang: activeContact.lang,
        translated: forMe,
      };
      const cur = withMine[activeContact.id] || [];
      const withReply = { ...withMine, [activeContact.id]: [...cur, theirs] };
      await saveChats(withReply);
    }
    setReplyingTyping(false);
  }

  if (!ready) {
    return (
      <div className="m-app m-app--loading">
        <style>{CSS}</style>
        <Loader2 className="m-spin" size={22} />
      </div>
    );
  }

  return (
    <div className="m-app">
      <style>{CSS}</style>

      {/* ---------------- sidebar ---------------- */}
      <nav className="m-nav">
        <div className="m-brand">
          <Globe2 size={20} />
          <span>Oopz</span>
        </div>
        <button
          className={"m-nav-item" + (view === "feed" ? " is-active" : "")}
          onClick={() => setView("feed")}
        >
          <Globe2 size={17} />
          <span>Feed</span>
        </button>
        <button
          className={"m-nav-item" + (view === "chat" ? " is-active" : "")}
          onClick={() => setView("chat")}
        >
          <MessageCircle size={17} />
          <span>Chat</span>
        </button>

        <div className="m-nav-spacer" />

        <div className="m-lang-picker">
          <Languages size={14} />
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="m-shield">
          <ShieldCheck size={14} />
          <span>
            {stats.checked} reviewed{stats.caught ? ` · ${stats.caught} caught` : ""}
          </span>
        </div>
      </nav>

      {/* ---------------- main ---------------- */}
      <main className="m-main">
        {view === "feed" && (
          <div className="m-feed">
            <header className="m-feed-head">
              <h1>Global Feed</h1>
              <p>Every post here started in someone else's language.</p>
            </header>

            <div className="m-composer">
              <TrustRing pct={98} />
              <div className="m-composer-body">
                <textarea
                  placeholder={`Write in ${lang}…`}
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  rows={2}
                />
                <WarningCard
                  warning={postWarning}
                  onDismiss={() => setPostWarning(null)}
                  onEdit={() => setPostWarning(null)}
                />
                <div className="m-composer-actions">
                  <span className="m-hint">Checked for scams &amp; harassment before it's posted</span>
                  <button className="m-btn" disabled={!composer.trim() || posting} onClick={handlePost}>
                    {posting ? <Loader2 size={14} className="m-spin" /> : "Post"}
                  </button>
                </div>
              </div>
            </div>

            <div className="m-posts">
              {posts.map((post) => (
                <article className="m-post" key={post.id}>
                  <Ribbon active={!!translations[post.id]} />
                  <div className="m-post-head">
                    <div className="m-avatar">{post.name.slice(0, 1)}</div>
                    <div className="m-post-meta">
                      <div className="m-post-name">
                        {post.name} <span className="m-post-flag">{post.flag}</span>
                      </div>
                      <div className="m-post-sub">
                        {post.city} · {post.lang} <Clock size={11} /> {timeAgo(post.time)}
                      </div>
                    </div>
                  </div>
                  <p className="m-post-text">{post.text}</p>

                  {translations[post.id] ? (
                    <div className="m-translation">
                      <span className="m-translation-tag">Translated from {post.lang}</span>
                      <p>{translations[post.id]}</p>
                    </div>
                  ) : (
                    post.lang !== lang && (
                      <button
                        className="m-btn-ghost"
                        onClick={() => handleTranslatePost(post)}
                        disabled={translating[post.id]}
                      >
                        {translating[post.id] ? (
                          <>
                            <Loader2 size={13} className="m-spin" /> Translating…
                          </>
                        ) : (
                          <>
                            <Languages size={13} /> Translate to {lang}
                          </>
                        )}
                      </button>
                    )
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {view === "chat" && (
          <div className="m-chat">
            <div className="m-contacts">
              {CONTACTS.map((c) => (
                <button
                  key={c.id}
                  className={"m-contact" + (c.id === activeContact.id ? " is-active" : "")}
                  onClick={() => {
                    setActiveContact(c);
                    setChatWarning(null);
                  }}
                >
                  <div className="m-avatar m-avatar--sm">{c.name.slice(0, 1)}</div>
                  <div>
                    <div className="m-contact-name">{c.name}</div>
                    <div className="m-contact-sub">
                      {c.flag} {c.city} · writes in {c.lang}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="m-thread">
              <header className="m-thread-head">
                <div className="m-avatar">{activeContact.name.slice(0, 1)}</div>
                <div>
                  <div className="m-post-name">{activeContact.name}</div>
                  <div className="m-post-sub">
                    {activeContact.flag} {activeContact.city} · auto-translated live
                  </div>
                </div>
              </header>

              <div className="m-thread-body" ref={scrollRef}>
                {activeMessages.length === 0 && (
                  <div className="m-empty">Say hello — it'll arrive in {activeContact.name.split(" ")[0]}'s language.</div>
                )}
                {activeMessages.map((m) => (
                  <Bubble key={m.id} m={m} viewerLang={lang} theirLang={activeContact.lang} />
                ))}
                {replyingTyping && (
                  <div className="m-bubble m-bubble--them m-bubble--typing">
                    <Loader2 size={13} className="m-spin" /> {activeContact.name.split(" ")[0]} is replying…
                  </div>
                )}
              </div>

              <div className="m-thread-input">
                <WarningCard
                  warning={chatWarning}
                  onDismiss={() => setChatWarning(null)}
                  onEdit={() => setChatWarning(null)}
                />
                <div className="m-input-row">
                  <input
                    placeholder={`Message in ${lang}…`}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  />
                  <button className="m-btn m-btn--icon" disabled={!chatInput.trim() || sending} onClick={handleSendChat}>
                    {sending ? <Loader2 size={15} className="m-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Bubble({ m, viewerLang, theirLang }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const mine = m.sender === "me";
  const display = mine ? m.text : m.translated || m.text;
  return (
    <div className={"m-bubble" + (mine ? " m-bubble--me" : " m-bubble--them")}>
      <Ribbon active />
      <p>{showOriginal ? m.text : display}</p>
      {!mine && m.translated && (
        <button className="m-original-toggle" onClick={() => setShowOriginal((s) => !s)}>
          {showOriginal ? `Show translation` : `Show original (${theirLang})`}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Spectral&family=Inter&family=JetBrains+Mono&display=swap');

:root{
  --ink:#10142A;
  --surface:#1A2044;
  --surface-2:#232B54;
  --border:#2C3566;
  --fog:#8D93B8;
  --paper:#F3F1EA;
  --gold:#E7B650;
  --teal:#4FC7B3;
  --coral:#FF6E61;
}

*{box-sizing:border-box;}
.m-app{
  display:flex;
  min-height:100vh;
  background:var(--ink);
  color:var(--paper);
  font-family:'Inter',sans-serif;
}
.m-app--loading{align-items:center;justify-content:center;}
.m-spin{animation:m-spin 0.9s linear infinite;}
@keyframes m-spin{to{transform:rotate(360deg);}}

/* ---- nav ---- */
.m-nav{
  width:220px;
  flex-shrink:0;
  background:var(--surface);
  border-right:1px solid var(--border);
  display:flex;
  flex-direction:column;
  padding:20px 14px;
  gap:4px;
}
.m-brand{
  display:flex;align-items:center;gap:8px;
  font-family:'Spectral',serif;
  font-size:19px;font-weight:600;
  color:var(--gold);
  padding:4px 10px 20px;
  letter-spacing:0.2px;
}
.m-nav-item{
  display:flex;align-items:center;gap:10px;
  background:none;border:none;color:var(--fog);
  font-family:inherit;font-size:14px;font-weight:500;
  padding:10px 12px;border-radius:10px;cursor:pointer;
  text-align:left;
}
.m-nav-item:hover{background:var(--surface-2);color:var(--paper);}
.m-nav-item.is-active{background:var(--surface-2);color:var(--gold);}
.m-nav-spacer{flex:1;}
.m-lang-picker{
  display:flex;align-items:center;gap:8px;
  background:var(--surface-2);border:1px solid var(--border);
  border-radius:10px;padding:8px 10px;color:var(--fog);
  font-size:12px;
}
.m-lang-picker select{
  background:none;border:none;color:var(--paper);
  font-family:inherit;font-size:12.5px;flex:1;outline:none;
}
.m-shield{
  display:flex;align-items:center;gap:7px;
  margin-top:10px;padding:8px 10px;
  color:var(--teal);font-size:11px;font-family:'JetBrains Mono',monospace;
}

/* ---- main ---- */
.m-main{flex:1;min-width:0;overflow-y:auto;}
.m-feed{max-width:640px;margin:0 auto;padding:36px 24px 60px;}
.m-feed-head h1{
  font-family:'Spectral',serif;font-size:30px;font-weight:600;margin:0 0 4px;
}
.m-feed-head p{color:var(--fog);font-size:13.5px;margin:0 0 24px;}

/* ---- composer ---- */
.m-composer{
  display:flex;gap:12px;
  background:var(--surface);border:1px solid var(--border);
  border-radius:16px;padding:16px;margin-bottom:28px;
}
.m-composer-body{flex:1;display:flex;flex-direction:column;gap:10px;}
.m-composer textarea{
  width:100%;background:var(--surface-2);border:1px solid var(--border);
  border-radius:10px;padding:10px 12px;color:var(--paper);
  font-family:inherit;font-size:14px;resize:none;outline:none;
}
.m-composer textarea:focus{border-color:var(--gold);}
.m-composer-actions{display:flex;align-items:center;justify-content:space-between;}
.m-hint{font-size:11px;color:var(--fog);}

/* ---- buttons ---- */
.m-btn{
  background:var(--gold);color:#1A1204;border:none;border-radius:9px;
  padding:8px 16px;font-family:inherit;font-size:13px;font-weight:600;
  cursor:pointer;display:flex;align-items:center;gap:6px;
}
.m-btn:disabled{opacity:0.4;cursor:default;}
.m-btn--icon{padding:8px 12px;}
.m-btn-ghost{
  background:none;border:1px solid var(--border);color:var(--teal);
  border-radius:8px;padding:6px 12px;font-family:inherit;font-size:12.5px;
  cursor:pointer;display:inline-flex;align-items:center;gap:6px;width:fit-content;
}
.m-icon-btn{background:none;border:none;color:var(--fog);cursor:pointer;padding:4px;}

/* ---- ring ---- */
.m-ring-track{fill:none;stroke:var(--surface-2);stroke-width:3;}
.m-ring-value{fill:none;stroke:var(--gold);stroke-width:3;stroke-linecap:round;
  transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 0.4s;}
.m-ring{flex-shrink:0;}

/* ---- ribbon (signature element) ---- */
.m-ribbon{
  position:relative;height:3px;border-radius:2px;margin-bottom:12px;
  background:linear-gradient(90deg,var(--gold),var(--gold));
  overflow:hidden;
}
.m-ribbon--dual{background:linear-gradient(90deg,var(--gold),var(--teal));}
.m-ribbon-dot{
  position:absolute;top:-2px;left:0;width:6px;height:7px;border-radius:50%;
  background:var(--paper);box-shadow:0 0 6px var(--gold);
  animation:m-travel 3.2s ease-in-out infinite;
}
@keyframes m-travel{
  0%{left:0;}
  50%{left:calc(100% - 6px);}
  100%{left:0;}
}

/* ---- posts ---- */
.m-posts{display:flex;flex-direction:column;gap:20px;}
.m-post{
  background:var(--surface);border:1px solid var(--border);
  border-radius:16px;padding:18px 18px 16px;
}
.m-post-head{display:flex;align-items:center;gap:10px;margin-bottom:2px;}
.m-avatar{
  width:36px;height:36px;border-radius:50%;background:var(--surface-2);
  border:1px solid var(--border);display:flex;align-items:center;justify-content:center;
  font-family:'Spectral',serif;font-weight:600;color:var(--gold);flex-shrink:0;
}
.m-avatar--sm{width:30px;height:30px;font-size:13px;}
.m-post-name{font-size:14px;font-weight:600;}
.m-post-flag{margin-left:2px;}
.m-post-sub{
  font-size:11.5px;color:var(--fog);display:flex;align-items:center;gap:5px;
  font-family:'JetBrains Mono',monospace;
}
.m-post-text{font-size:15px;line-height:1.55;margin:12px 0 10px;}
.m-translation{
  border-left:2px solid var(--teal);padding-left:12px;margin-top:8px;
}
.m-translation-tag{
  font-size:10.5px;color:var(--teal);font-family:'JetBrains Mono',monospace;
  text-transform:uppercase;letter-spacing:0.04em;
}
.m-translation p{margin:4px 0 0;font-size:14px;line-height:1.5;color:var(--paper);}

/* ---- warning ---- */
.m-warning{
  display:flex;gap:10px;align-items:flex-start;
  background:rgba(255,110,97,0.08);border:1px solid var(--coral);
  border-radius:10px;padding:10px 12px;
}
.m-warning-icon{color:var(--coral);flex-shrink:0;margin-top:2px;}
.m-warning-body{flex:1;}
.m-warning-title{font-size:12.5px;font-weight:600;color:var(--coral);}
.m-warning-reason{font-size:12px;color:var(--fog);margin-top:2px;}
.m-warning-actions{display:flex;gap:6px;align-items:center;}

/* ---- chat layout ---- */
.m-chat{display:flex;height:100vh;}
.m-contacts{
  width:250px;flex-shrink:0;border-right:1px solid var(--border);
  padding:20px 10px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;
}
.m-contact{
  display:flex;gap:10px;align-items:center;background:none;border:none;
  padding:10px;border-radius:12px;cursor:pointer;text-align:left;color:var(--paper);
}
.m-contact:hover{background:var(--surface);}
.m-contact.is-active{background:var(--surface);border:1px solid var(--border);}
.m-contact-name{font-size:13.5px;font-weight:600;}
.m-contact-sub{font-size:11px;color:var(--fog);font-family:'JetBrains Mono',monospace;}

.m-thread{flex:1;display:flex;flex-direction:column;min-width:0;}
.m-thread-head{
  display:flex;align-items:center;gap:10px;padding:18px 24px;
  border-bottom:1px solid var(--border);
}
.m-thread-body{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:14px;}
.m-empty{color:var(--fog);font-size:13px;text-align:center;margin-top:40px;}

.m-bubble{max-width:70%;padding:12px 14px;border-radius:14px;font-size:14px;line-height:1.5;}
.m-bubble--me{align-self:flex-end;background:var(--gold);color:#1A1204;border-bottom-right-radius:4px;}
.m-bubble--them{align-self:flex-start;background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:4px;}
.m-bubble--typing{display:flex;align-items:center;gap:8px;color:var(--fog);font-size:12.5px;}
.m-bubble .m-ribbon{margin-bottom:8px;height:2px;}
.m-bubble--me .m-ribbon{background:linear-gradient(90deg,#1A1204,#1A1204);opacity:0.25;}
.m-original-toggle{
  margin-top:8px;background:none;border:none;color:var(--teal);
  font-size:11px;cursor:pointer;padding:0;font-family:'JetBrains Mono',monospace;
}

.m-thread-input{padding:16px 24px 22px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:10px;}
.m-input-row{display:flex;gap:10px;}
.m-input-row input{
  flex:1;background:var(--surface-2);border:1px solid var(--border);
  border-radius:10px;padding:11px 14px;color:var(--paper);font-family:inherit;
  font-size:14px;outline:none;
}
.m-input-row input:focus{border-color:var(--gold);}

@media (max-width: 860px){
  .m-nav{width:64px;padding:16px 8px;}
  .m-nav-item span, .m-brand span, .m-lang-picker, .m-shield span{display:none;}
  .m-contacts{width:80px;}
  .m-contact-sub, .m-contact-name{display:none;}
}
`;
