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
@import url('https://fon
