import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDEA4i5-lbRT9PCwlLv0HZ6htWAZlH2qQU",
  authDomain: "loneliss.appspot.com",
  projectId: "loneliss",
  storageBucket: "loneliss.firebasestorage.app",
  messagingSenderId: "600687956895",
  appId: "1:600687956895:web:0d28974aca3a3963b863aa",
  measurementId: "G-4WY09H504X"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const MOODS = [
  { emoji: "😄", label: "Great", value: 5, color: "#22c55e" },
  { emoji: "🙂", label: "Good", value: 4, color: "#84cc16" },
  { emoji: "😐", label: "Okay", value: 3, color: "#eab308" },
  { emoji: "😔", label: "Low", value: 2, color: "#f97316" },
  { emoji: "😞", label: "Really low", value: 1, color: "#ef4444" },
];

const BADGES = [
  { id: "first_checkin", icon: "🌱", label: "First step", desc: "Complete your first check-in" },
  { id: "streak3", icon: "🔥", label: "On fire", desc: "3-day check-in streak" },
  { id: "streak7", icon: "⚡", label: "Momentum", desc: "7-day streak" },
  { id: "social5", icon: "🤝", label: "Connector", desc: "Log 5 social interactions" },
  { id: "nudge10", icon: "💌", label: "Nudge fan", desc: "Act on 10 nudges" },
  { id: "week1", icon: "🌟", label: "Week one", desc: "Use the app for 7 days" },
];

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const greet = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

function LoadingScreen() {
  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      background: "#f0fdf4",
      flexDirection: "column",
      gap: 16,
    }}>
      <span style={{ fontSize: 48 }}>🌿</span>
      <p style={{ color: "#16a34a", fontWeight: 600, fontSize: 16, margin: 0 }}>Loading…</p>
    </div>
  );
}

export default function LonelissApp() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("home");
  const [checkins, setCheckins] = useState([]);
  const [todayCheckin, setTodayCheckin] = useState(null);
  const [streak, setStreak] = useState(0);
  const [points, setPoints] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [nudge, setNudge] = useState(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState(null);
  const [socialSlider, setSocialSlider] = useState(3);
  const [note, setNote] = useState("");
  const [checkinStep, setCheckinStep] = useState(1);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) loadUserData(u.uid);
    });
    return unsub;
  }, []);

  const loadUserData = async (uid) => {
    try {
      const q = query(
        collection(db, "checkins"),
        where("uid", "==", uid),
        orderBy("date", "desc"),
        limit(30)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCheckins(docs);
      const today = docs.find((d) => d.date === dayKey());
      setTodayCheckin(today || null);

      let s = 0;
      const cur = new Date();
      for (let i = 0; i < 30; i++) {
        const k = dayKey(new Date(cur - i * 86400000));
        if (docs.find((d) => d.date === k)) s++;
        else break;
      }
      setStreak(s);

      const p = docs.length * 10 + s * 5;
      setPoints(p);
      const badges = [];
      if (docs.length >= 1) badges.push("first_checkin");
      if (s >= 3) badges.push("streak3");
      if (s >= 7) badges.push("streak7");
      const socialCount = docs.reduce((acc, d) => acc + (d.socialCount || 0), 0);
      if (socialCount >= 5) badges.push("social5");
      setEarnedBadges(badges);
    } catch (e) {
      console.error("loadUserData error", e);
    }
  };

  const signInEmail = async (email, password, isSignUp, name) => {
    try {
      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      const msg =
        e.code === "auth/user-not-found" ? "No account found. Sign up first."
        : e.code === "auth/wrong-password" ? "Wrong password."
        : e.code === "auth/email-already-in-use" ? "Email already registered. Sign in instead."
        : e.code === "auth/weak-password" ? "Password must be at least 6 characters."
        : e.code === "auth/invalid-email" ? "Please enter a valid email address."
        : e.code === "auth/invalid-credential" ? "Wrong email or password."
        : "Something went wrong. Try again.";
      showToast(msg, "error");
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setCheckins([]);
    setTodayCheckin(null);
    setStreak(0);
    setPoints(0);
    setEarnedBadges([]);
    setNudge(null);
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const submitCheckin = async () => {
    if (!user || !selectedMood) return;
    try {
      await addDoc(collection(db, "checkins"), {
        uid: user.uid,
        date: dayKey(),
        mood: selectedMood.value,
        moodLabel: selectedMood.label,
        socialCount: socialSlider,
        note,
        ts: serverTimestamp(),
      });
      loadUserData(user.uid);
      setCheckinStep(4);
      showToast("Check-in saved! +10 pts");
      fetchNudge(selectedMood.value, socialSlider);
    } catch (e) {
      showToast("Failed to save. Try again.", "error");
    }
  };

  const fetchNudge = async (moodVal, social) => {
    setNudgeLoading(true);
    try {
      const prompt = `You are a warm, empathetic student wellness companion called Connectly.
A student just checked in. Mood score: ${moodVal}/5, Social interactions today: ${social}/5.
Give ONE short, uplifting nudge (2-3 sentences max) that:
- Acknowledges their current state with empathy
- Gently suggests a specific, easy action to reconnect with someone or feel better
- Feels like a caring friend, not a therapist
Do not use bullet points. Be warm and conversational.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyA7djesOyyr8bWiNJU0PxwaYYqakBMR6jk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "You're doing great — keep going!";
      setNudge(text);
    } catch (e) {
      setNudge("You showed up today, and that matters. Consider sending a quick hello to someone you haven't spoken to in a while.");
    }
    setNudgeLoading(false);
  };

  if (authLoading) return <LoadingScreen />;
  if (!user) return <LoginScreen onSignIn={signInEmail} auth={auth} />;

  const firstName = user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "there";
  const avgMood =
    checkins.length > 0
      ? (checkins.slice(0, 7).reduce((a, c) => a + c.mood, 0) / Math.min(checkins.length, 7)).toFixed(1)
      : null;

  return (
    <div style={styles.app}>
      {toast && (
        <div style={{ ...styles.toast, background: toast.type === "error" ? "#ef4444" : "#22c55e" }}>
          {toast.msg}
        </div>
      )}

      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🌿</span>
          <span style={styles.logoText}>Connectly</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.pointsBadge}>⭐ {points} pts</div>
        </div>
      </header>

      <nav style={styles.nav}>
        {[
          { id: "home", icon: "🏠", label: "Home" },
          { id: "checkin", icon: "✅", label: "Check in" },
          { id: "history", icon: "📊", label: "History" },
          { id: "badges", icon: "🏅", label: "Badges" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setScreen(t.id);
              if (t.id === "checkin") {
                setCheckinStep(1);
                setSelectedMood(null);
                setSocialSlider(3);
                setNote("");
              }
            }}
            style={{ ...styles.navBtn, ...(screen === t.id ? styles.navBtnActive : {}) }}
          >
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={styles.navLabel}>{t.label}</span>
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {screen === "home" && (
          <HomeScreen
            firstName={firstName}
            streak={streak}
            avgMood={avgMood}
            nudge={nudge}
            nudgeLoading={nudgeLoading}
            todayCheckin={todayCheckin}
            checkins={checkins}
            onCheckIn={() => setScreen("checkin")}
            onFetchNudge={() => fetchNudge(todayCheckin?.mood || 3, todayCheckin?.socialCount || 3)}
          />
        )}
        {screen === "checkin" && (
          <CheckInScreen
            step={checkinStep}
            setStep={setCheckinStep}
            moods={MOODS}
            selectedMood={selectedMood}
            setSelectedMood={setSelectedMood}
            socialSlider={socialSlider}
            setSocialSlider={setSocialSlider}
            note={note}
            setNote={setNote}
            onSubmit={submitCheckin}
            nudge={nudge}
            nudgeLoading={nudgeLoading}
            todayCheckin={todayCheckin}
          />
        )}
        {screen === "history" && <HistoryScreen checkins={checkins} />}
        {screen === "badges" && (
          <BadgesScreen badges={BADGES} earned={earnedBadges} />
        )}
      </main>

      <button onClick={signOut} style={styles.signOut}>Sign out</button>
    </div>
  );
}

function LoginScreen({ onSignIn, auth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const handleReset = async () => {
    if (!resetEmail) {
      alert("Enter email first");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch (e) {
      alert("No account found with that email.");
    }
  };

  if (showReset) {
    return (
      <div style={styles.loginPage}>
        <div style={styles.loginCard}>
          <div style={{ fontSize: 64 }}>🔑</div>
          <h1 style={{ ...styles.loginTitle, fontSize: 24 }}>Reset password</h1>
          <p style={styles.loginSub}>We'll send a reset link to your email</p>
          {resetSent ? (
            <div style={{ background: "#d1fae5", padding: 12, borderRadius: 10 }}>
              <p style={{ margin: 0 }}>✓ Reset email sent!</p>
            </div>
          ) : (
            <>
              <input
                type="email"
                placeholder="Your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                style={styles.authInput}
              />
              <button onClick={handleReset} style={styles.signInBtn}>
                Send reset link
              </button>
            </>
          )}
          <p
            onClick={() => {
              setShowReset(false);
              setResetSent(false);
              setResetEmail("");
            }}
            style={{ cursor: "pointer", color: "green" }}
          >
            ← Back
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.loginPage}>
      <div style={styles.loginCard}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>🌿</div>
        <h1 style={styles.loginTitle}>Connectly</h1>
        <p style={styles.loginSub}>Your gentle companion for student wellbeing</p>

        <div style={styles.featureList}>
          {[
            ["😊", "Daily mood check-ins"],
            ["💌", "AI-generated nudges"],
            ["🔥", "Streaks & badges"],
            ["📊", "Wellbeing trends"],
          ].map(([icon, text]) => (
            <div key={text} style={styles.featureRow}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={styles.featureText}>{text}</span>
            </div>
          ))}
        </div>

        {isSignUp && (
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.authInput}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ ...styles.authInput, marginTop: isSignUp ? 10 : 0 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ ...styles.authInput, marginTop: 10 }}
        />

        {!isSignUp && (
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8, textAlign: "right" }}>
            <span onClick={() => setShowReset(true)} style={{ color: "#16a34a", cursor: "pointer", fontWeight: 600 }}>
              Forgot password?
            </span>
          </p>
        )}

        <button onClick={() => onSignIn(email, password, isSignUp, name)} style={styles.signInBtn}>
          {isSignUp ? "Create account" : "Sign in"}
        </button>

        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 14 }}>
          {isSignUp ? "Already have an account? " : "Don't have an account? "}
          <span onClick={() => setIsSignUp(!isSignUp)} style={{ color: "#16a34a", cursor: "pointer", fontWeight: 600 }}>
            {isSignUp ? "Sign in" : "Sign up"}
          </span>
        </p>
      </div>
    </div>
  );
}

function HomeScreen({ firstName, streak, avgMood, nudge, nudgeLoading, todayCheckin, checkins, onCheckIn, onFetchNudge }) {
  const moodColor = avgMood >= 4 ? "#22c55e" : avgMood >= 3 ? "#eab308" : avgMood >= 2 ? "#f97316" : "#ef4444";

  return (
    <div style={styles.screen}>
      <h2 style={styles.greeting}>{greet()}, {firstName} 👋</h2>

      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={styles.statIcon}>🔥</span>
          <span style={styles.statNum}>{streak}</span>
          <span style={styles.statLabel}>day streak</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statIcon}>📅</span>
          <span style={styles.statNum}>{checkins.length}</span>
          <span style={styles.statLabel}>check-ins</span>
        </div>
        <div style={{ ...styles.statCard, borderColor: moodColor }}>
          <span style={styles.statIcon}>💚</span>
          <span style={{ ...styles.statNum, color: moodColor }}>{avgMood || "—"}</span>
          <span style={styles.statLabel}>avg mood</span>
        </div>
      </div>

      {!todayCheckin ? (
        <div style={styles.checkinPrompt}>
          <p style={styles.promptText}>How are you feeling today?</p>
          <p style={styles.promptSub}>Take 30 seconds for a quick check-in.</p>
          <button onClick={onCheckIn} style={styles.primaryBtn}>Start today's check-in →</button>
        </div>
      ) : (
        <div style={styles.doneCard}>
          <span style={{ fontSize: 32 }}>{MOODS.find((m) => m.value === todayCheckin.mood)?.emoji}</span>
          <div>
            <p style={styles.doneTitle}>Today: {todayCheckin.moodLabel}</p>
            <p style={styles.doneSub}>Social interactions: {todayCheckin.socialCount}/5</p>
          </div>
          <span style={styles.checkmark}>✓</span>
        </div>
      )}

      <div style={styles.nudgeCard}>
        <div style={styles.nudgeHeader}>
          <span style={{ fontSize: 20 }}>💌</span>
          <span style={styles.nudgeTitle}>Your nudge</span>
          {todayCheckin && <button onClick={onFetchNudge} style={styles.refreshBtn}>↻ New</button>}
        </div>
        {nudgeLoading ? (
          <p style={styles.nudgeText}>Crafting your nudge…</p>
        ) : nudge ? (
          <p style={styles.nudgeText}>{nudge}</p>
        ) : (
          <p style={styles.nudgeTextMuted}>Complete a check-in to get your personalised nudge.</p>
        )}
      </div>

      {checkins.length > 1 && (
        <div style={styles.miniChart}>
          <p style={styles.sectionLabel}>Last 7 days</p>
          <div style={styles.barRow}>
            {checkins.slice(0, 7).reverse().map((c, i) => {
              const m = MOODS.find((x) => x.value === c.mood);
              return (
                <div key={i} style={styles.barWrap}>
                  <div style={{ ...styles.bar, height: c.mood * 18 + "px", background: m?.color || "#ccc" }} />
                  <span style={styles.barEmoji}>{m?.emoji}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckInScreen({ step, setStep, moods, selectedMood, setSelectedMood, socialSlider, setSocialSlider, note, setNote, onSubmit, nudge, nudgeLoading, todayCheckin }) {
  if (todayCheckin && step !== 4) {
    return (
      <div style={styles.screen}>
        <div style={styles.alreadyDone}>
          <span style={{ fontSize: 48 }}>✅</span>
          <h3 style={styles.alreadyTitle}>Already checked in today!</h3>
          <p style={styles.alreadySub}>Come back tomorrow to keep your streak going.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.screen}>
      {step < 4 && (
        <div style={styles.progress}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ ...styles.progressDot, background: step >= s ? "#16a34a" : "#d1d5db" }} />
          ))}
        </div>
      )}

      {step === 1 && (
        <div style={styles.stepWrap}>
          <h2 style={styles.stepTitle}>How are you feeling right now?</h2>
          <div style={styles.moodGrid}>
            {moods.map((m) => (
              <button
                key={m.value}
                onClick={() => setSelectedMood(m)}
                style={{
                  ...styles.moodBtn,
                  background: selectedMood?.value === m.value ? m.color + "22" : "white",
                  borderColor: selectedMood?.value === m.value ? m.color : "#e5e7eb",
                  transform: selectedMood?.value === m.value ? "scale(1.08)" : "scale(1)",
                }}
              >
                <span style={{ fontSize: 36 }}>{m.emoji}</span>
                <span style={styles.moodLabel}>{m.label}</span>
              </button>
            ))}
          </div>
          <button disabled={!selectedMood} onClick={() => setStep(2)} style={{ ...styles.primaryBtn, opacity: selectedMood ? 1 : 0.4 }}>
            Next →
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={styles.stepWrap}>
          <h2 style={styles.stepTitle}>How many people did you meaningfully interact with today?</h2>
          <div style={styles.sliderWrap}>
            <span style={styles.sliderValue}>{socialSlider}</span>
            <input type="range" min={0} max={5} step={1} value={socialSlider} onChange={(e) => setSocialSlider(Number(e.target.value))} style={styles.slider} />
            <div style={styles.sliderLabels}><span>0</span><span>5+</span></div>
          </div>
          <p style={styles.sliderHint}>
            {socialSlider === 0 ? "It's okay to have quiet days 🌙" : socialSlider <= 2 ? "A little connection goes a long way 🌱" : "Nice, you're reaching out! 🌟"}
          </p>
          <div style={styles.btnRow}>
            <button onClick={() => setStep(1)} style={styles.secondaryBtn}>← Back</button>
            <button onClick={() => setStep(3)} style={styles.primaryBtn}>Next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={styles.stepWrap}>
          <h2 style={styles.stepTitle}>Anything on your mind? <span style={{ color: "#9ca3af", fontSize: 16 }}>(optional)</span></h2>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write a few words… or leave it blank." rows={4} style={styles.textarea} />
          <div style={styles.btnRow}>
            <button onClick={() => setStep(2)} style={styles.secondaryBtn}>← Back</button>
            <button onClick={onSubmit} style={styles.primaryBtn}>Save check-in ✓</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={styles.stepWrap}>
          <div style={styles.successAnim}>
            <span style={{ fontSize: 64 }}>🎉</span>
            <h2 style={styles.successTitle}>Check-in saved!</h2>
            <p style={styles.successSub}>+10 points earned</p>
          </div>
          <div style={styles.nudgeCard}>
            <div style={styles.nudgeHeader}>
              <span style={{ fontSize: 20 }}>💌</span>
              <span style={styles.nudgeTitle}>Your nudge</span>
            </div>
            {nudgeLoading ? <p style={styles.nudgeText}>Crafting your nudge…</p> : nudge ? <p style={styles.nudgeText}>{nudge}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryScreen({ checkins }) {
  if (checkins.length === 0) {
    return (
      <div style={styles.screen}>
        <div style={styles.empty}>
          <span style={{ fontSize: 48 }}>📊</span>
          <p style={styles.emptyText}>No check-ins yet. Start your first one!</p>
        </div>
      </div>
    );
  }
  return (
    <div style={styles.screen}>
      <h2 style={styles.sectionTitle}>Your history</h2>
      <div style={styles.historyList}>
        {checkins.map((c) => {
          const m = MOODS.find((x) => x.value === c.mood);
          return (
            <div key={c.id} style={styles.historyItem}>
              <span style={{ fontSize: 28 }}>{m?.emoji}</span>
              <div style={{ flex: 1 }}>
                <p style={styles.historyDate}>{c.date}</p>
                <p style={styles.historyMood}>{m?.label} · {c.socialCount} social</p>
                {c.note ? <p style={styles.historyNote}>"{c.note}"</p> : null}
              </div>
              <div style={{ ...styles.moodDot, background: m?.color }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BadgesScreen({ badges, earned }) {
  return (
    <div style={styles.screen}>
      <h2 style={styles.sectionTitle}>Badges</h2>
      <p style={styles.sectionSub}>{earned.length} of {badges.length} earned</p>
      <div style={styles.badgeGrid}>
        {badges.map((b) => {
          const isEarned = earned.includes(b.id);
          return (
            <div key={b.id} style={{ ...styles.badgeCard, opacity: isEarned ? 1 : 0.4 }}>
              <span style={{ fontSize: 36, filter: isEarned ? "none" : "grayscale(1)" }}>{b.icon}</span>
              <p style={styles.badgeLabel}>{b.label}</p>
              <p style={styles.badgeDesc}>{b.desc}</p>
              {isEarned && <span style={styles.earnedTag}>Earned ✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  app: { fontFamily: "'Segoe UI', system-ui, sans-serif", maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#f0fdf4", display: "flex", flexDirection: "column", position: "relative" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 12px", background: "white", borderBottom: "1px solid #d1fae5", position: "sticky", top: 0, zIndex: 10 },
  logo: { display: "flex", alignItems: "center", gap: 8 },
  logoIcon: { fontSize: 24 },
  logoText: { fontSize: 20, fontWeight: 700, color: "#14532d", letterSpacing: "-0.5px" },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  pointsBadge: { background: "#bbf7d0", color: "#166534", borderRadius: 20, padding: "4px 10px", fontSize: 13, fontWeight: 600 },
  nav: { display: "flex", justifyContent: "space-around", background: "white", borderBottom: "1px solid #d1fae5", padding: "4px 0" },
  navBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 12px", border: "none", background: "transparent", cursor: "pointer", borderRadius: 12, transition: "background 0.15s" },
  navBtnActive: { background: "#d1fae5" },
  navLabel: { fontSize: 11, color: "#374151", fontWeight: 500 },
  main: { flex: 1, overflowY: "auto" },
  screen: { padding: "20px 20px 80px" },
  toast: { position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", color: "white", borderRadius: 10, padding: "10px 20px", fontWeight: 600, fontSize: 14, zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" },
  loginPage: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f0fdf4", padding: 20 },
  loginCard: { background: "white", borderRadius: 24, padding: "40px 32px", maxWidth: 360, width: "100%", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" },
  loginTitle: { fontSize: 32, fontWeight: 800, color: "#14532d", margin: "0 0 6px", letterSpacing: "-1px" },
  loginSub: { color: "#6b7280", fontSize: 15, margin: "0 0 24px" },
  featureList: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 28, textAlign: "left" },
  featureRow: { display: "flex", alignItems: "center", gap: 12 },
  featureText: { color: "#374151", fontSize: 15 },
  authInput: { width: "100%", borderRadius: 10, border: "1.5px solid #d1d5db", padding: "12px 14px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#111" },
  signInBtn: { width: "100%", background: "#16a34a", color: "white", border: "none", borderRadius: 12, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 16 },
  greeting: { fontSize: 22, fontWeight: 700, color: "#14532d", marginBottom: 16 },
  statsRow: { display: "flex", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, background: "white", borderRadius: 14, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, border: "1.5px solid #d1fae5" },
  statIcon: { fontSize: 20 },
  statNum: { fontSize: 22, fontWeight: 800, color: "#14532d" },
  statLabel: { fontSize: 11, color: "#6b7280", textAlign: "center" },
  checkinPrompt: { background: "white", borderRadius: 16, padding: "20px", marginBottom: 16, border: "1.5px solid #bbf7d0", textAlign: "center" },
  promptText: { fontSize: 18, fontWeight: 700, color: "#14532d", margin: "0 0 6px" },
  promptSub: { color: "#6b7280", fontSize: 14, margin: "0 0 16px" },
  doneCard: { background: "white", borderRadius: 16, padding: "16px 20px", marginBottom: 16, border: "1.5px solid #bbf7d0", display: "flex", alignItems: "center", gap: 14 },
  doneTitle: { margin: 0, fontWeight: 700, color: "#14532d", fontSize: 16 },
  doneSub: { margin: "4px 0 0", color: "#6b7280", fontSize: 13 },
  checkmark: { marginLeft: "auto", fontSize: 22, color: "#22c55e", fontWeight: 700 },
  nudgeCard: { borderRadius: 16, padding: "16px 20px", marginBottom: 16, border: "1.5px solid #fde68a", background: "#fffbeb" },
  nudgeHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  nudgeTitle: { fontWeight: 700, color: "#92400e", fontSize: 15, flex: 1 },
  refreshBtn: { background: "#fef3c7", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 13, cursor: "pointer", color: "#92400e", fontWeight: 600 },
  nudgeText: { color: "#78350f", fontSize: 15, lineHeight: 1.6, margin: 0 },
  nudgeTextMuted: { color: "#a78bfa", fontSize: 14, margin: 0, fontStyle: "italic" },
  miniChart: { background: "white", borderRadius: 16, padding: "16px 20px", border: "1.5px solid #d1fae5" },
  sectionLabel: { fontSize: 13, color: "#6b7280", fontWeight: 600, margin: "0 0 12px" },
  barRow: { display: "flex", gap: 8, alignItems: "flex-end", height: 100 },
  barWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4, transition: "height 0.3s", minHeight: 8 },
  barEmoji: { fontSize: 14 },
  progress: { display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 },
  progressDot: { width: 10, height: 10, borderRadius: "50%", transition: "background 0.3s" },
  stepWrap: { display: "flex", flexDirection: "column", gap: 20 },
  stepTitle: { fontSize: 20, fontWeight: 700, color: "#14532d", margin: 0 },
  moodGrid: { display: "flex", gap: 10, flexWrap: "wrap" },
  moodBtn: { flex: "1 1 calc(33% - 10px)", minWidth: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 8px", border: "2px solid #e5e7eb", borderRadius: 14, cursor: "pointer", transition: "all 0.15s", background: "white" },
  moodLabel: { fontSize: 13, color: "#374151", fontWeight: 500 },
  sliderWrap: { display: "flex", flexDirection: "column", gap: 10, alignItems: "center" },
  sliderValue: { fontSize: 48, fontWeight: 800, color: "#14532d" },
  slider: { width: "100%", accentColor: "#16a34a" },
  sliderLabels: { display: "flex", justifyContent: "space-between", width: "100%", fontSize: 12, color: "#9ca3af" },
  sliderHint: { textAlign: "center", color: "#6b7280", fontSize: 15, margin: 0 },
  textarea: { width: "100%", borderRadius: 12, border: "1.5px solid #d1fae5", padding: "12px 14px", fontSize: 15, fontFamily: "inherit", resize: "vertical", outline: "none", color: "#111", boxSizing: "border-box" },
  btnRow: { display: "flex", gap: 10 },
  primaryBtn: { flex: 1, background: "#16a34a", color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "opacity 0.15s" },
  secondaryBtn: { background: "white", color: "#374151", border: "1.5px solid #d1d5db", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  successAnim: { textAlign: "center", marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: 800, color: "#14532d", margin: "8px 0 4px" },
  successSub: { color: "#16a34a", fontWeight: 600, fontSize: 15, margin: 0 },
  alreadyDone: { textAlign: "center", padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  alreadyTitle: { fontSize: 20, fontWeight: 700, color: "#14532d", margin: 0 },
  alreadySub: { color: "#6b7280", fontSize: 15, margin: 0 },
  sectionTitle: { fontSize: 20, fontWeight: 700, color: "#14532d", marginBottom: 4 },
  sectionSub: { fontSize: 14, color: "#6b7280", marginBottom: 16 },
  historyList: { display: "flex", flexDirection: "column", gap: 10 },
  historyItem: { background: "white", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12, border: "1px solid #e5e7eb" },
  historyDate: { margin: 0, fontSize: 13, color: "#9ca3af", fontWeight: 500 },
  historyMood: { margin: "2px 0 0", fontSize: 15, fontWeight: 600, color: "#374151" },
  historyNote: { margin: "4px 0 0", fontSize: 13, color: "#6b7280", fontStyle: "italic" },
  moodDot: { width: 10, height: 10, borderRadius: "50%", marginTop: 4, flexShrink: 0 },
  empty: { textAlign: "center", padding: "60px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  emptyText: { color: "#6b7280", fontSize: 16 },
  badgeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  badgeCard: { background: "white", borderRadius: 16, padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, border: "1.5px solid #d1fae5", textAlign: "center", transition: "opacity 0.3s" },
  badgeLabel: { fontSize: 14, fontWeight: 700, color: "#14532d", margin: 0 },
  badgeDesc: { fontSize: 12, color: "#6b7280", margin: 0 },
  earnedTag: { background: "#d1fae5", color: "#065f46", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 },
  signOut: { position: "fixed", bottom: 12, right: 16, background: "transparent", border: "none", color: "#9ca3af", fontSize: 12, cursor: "pointer", padding: "4px 8px" },
};
