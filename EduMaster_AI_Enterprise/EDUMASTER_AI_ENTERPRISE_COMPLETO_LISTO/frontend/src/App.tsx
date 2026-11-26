import { useEffect, useMemo, useState } from "react";
import {
  Activity, BookOpen, BrainCircuit, Users, GraduationCap, ChartNoAxesCombined,
  Settings, ShieldCheck, Award, Bell, Search, LogOut, Menu, Network, Database,
  Sparkles, ChevronRight, Plus, RefreshCw, Layers3, Clock3, CheckCircle2, Pencil, Trash2,
  AlertTriangle, MapPinned, Target, Zap, CalendarDays, TrendingUp, X
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
type User = { id: string; full_name: string; email: string; role: string };
type AnyRow = Record<string, any>;

const nav = [
  ["Resumen", "dashboard", ChartNoAxesCombined],
  ["Estudiantes", "students", Users],
  ["Cursos", "courses", BookOpen],
  ["Evaluaciones", "assessments", GraduationCap],
  ["Matrículas", "enrollments", Users],
  ["Rutas formativas", "paths", Layers3],
  ["Seguimiento", "tracking", Activity],
  ["Analítica", "analytics", ChartNoAxesCombined],
  ["Arquitectura IA", "neural", BrainCircuit],
  ["Dataset y modelos", "models", Database],
  ["Laboratorio ML", "lab", BrainCircuit],
  ["Recomendaciones", "recommendations", Sparkles],
  ["Certificaciones", "certificates", Award],
  ["Auditoría", "audit", ShieldCheck],
  ["Administración", "admin", Settings],
] as const;

const descriptions: Record<string, string> = {
  dashboard: "Visión integral del ecosistema de aprendizaje inteligente.",
  students: "Identidad académica y estado de estudiantes.",
  courses: "Gestión del catálogo académico y contenidos formativos.",
  assessments: "Evaluaciones e instrumentos asociados a los cursos.",
  enrollments: "Gestión de matrículas y estados de participación.",
  paths: "Diseño y administración de itinerarios formativos.",
  tracking: "Eventos y evidencias del proceso de aprendizaje.",
  analytics: "Indicadores derivados de los datos registrados.",
  neural: "Topología multitarea y rutas de procesamiento neuronal.",
  models: "Gobierno de datasets, experimentos y versiones de modelos.",
  lab: "Carga de datasets, configuración, entrenamiento y evaluación.",
  recommendations: "Sugerencias contextualizadas y retroalimentación.",
  certificates: "Emisión y verificación de logros académicos.",
  audit: "Trazabilidad de operaciones de la plataforma.",
  admin: "Configuración institucional y control de acceso.",
};

const networkHeads = [
  { id: "A", name: "Finalización de cursos", desc: "Estima la probabilidad de completar un curso.", inputs: ["completion_ratio", "assessment_mean", "active_days_14d"], hidden: [8, 5], output: "Probabilidad de finalización", color: "#31c7ff" },
  { id: "B", name: "Dominio de habilidades", desc: "Estima el nivel de dominio sustentado por evidencias.", inputs: ["skill_evidence_score", "assessment_trend", "course_level"], hidden: [10, 6], output: "Nivel ordinal de competencia", color: "#a78bfa" },
  { id: "C", name: "Riesgo de desconexión", desc: "Detecta señales para ofrecer acompañamiento humano.", inputs: ["days_since_last_activity", "active_days_14d", "late_submissions_30d"], hidden: [12, 6], output: "Señal de apoyo", color: "#f6b94b" },
  { id: "D", name: "Recomendación de aprendizaje", desc: "Ordena recursos según brechas y objetivos.", inputs: ["skill_gap", "course_goal", "recommendation_feedback"], hidden: [10, 5], output: "Ranking de recursos", color: "#42dfb1" },
  { id: "E", name: "Participación educativa", desc: "Analiza patrones de interacción con contenidos.", inputs: ["sessions_14d", "active_days_14d", "content_events"], hidden: [8, 4], output: "Índice de participación", color: "#fb8acb" },
  { id: "F", name: "Red neuronal multitarea", desc: "Comparte una representación interna para varias tareas.", inputs: ["features_tabulares", "secuencia_temporal"], hidden: [16, 12, 8], output: "Salidas multitarea", color: "#f5a65b" },
];

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("em_token") || "");
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState("dashboard");
  const [data, setData] = useState<AnyRow>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [orgName, setOrgName] = useState("Institución educativa");

  const api = async (path: string, opts: RequestInit = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.detail || `Error ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
  };

  useEffect(() => {
    if (!token) { setUser(null); return; }
    api("/api/v1/auth/me")
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("em_token");
        setToken("");
      });
  }, [token]);

  useEffect(() => { if (token) api("/api/v1/organization").then((x: any) => setOrgName(x.name)).catch(() => {}); }, [token]);

  const reload = async () => {
    if (!token) return;
    const endpoints: Record<string, string> = {
      dashboard: "/api/v1/dashboard/summary",
      students: "/api/v1/students",
      courses: "/api/v1/courses",
      assessments: "/api/v1/assessments",
      enrollments: "/api/v1/enrollments",
      paths: "/api/v1/learning-paths",
      tracking: "/api/v1/learning-events",
      certificates: "/api/v1/certificates",
      admin: "/api/v1/users",
      recommendations: "/api/v1/recommendations",
      models: "/api/v1/ml/models",
      audit: "/api/v1/audit-logs",
    };
    if (!endpoints[page]) {
      if (page === "dashboard" || page === "analytics") {
        setLoading(true); setError("");
        try {
          const [summary, analytics] = await Promise.all([api("/api/v1/dashboard/summary"), api("/api/v1/dashboard/analytics")]);
          setData((current) => ({ ...current, dashboard: { ...summary, ...analytics } }));
        } catch (e: any) { setError(e.message || "No se pudo cargar el panel."); }
        finally { setLoading(false); }
      }
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api(endpoints[page]);
      setData((current) => ({ ...current, [page]: result }));
      if (page === "assessments" || page === "enrollments" || page === "certificates") {
        const [students, courses, assessments] = await Promise.all([api("/api/v1/students"), api("/api/v1/courses"), api("/api/v1/assessments")]);
        setData((current) => ({ ...current, students, courses, assessments }));
      }
    } catch (e: any) {
      setError(e.message || "No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [page, token]);

  const logout = () => {
    localStorage.removeItem("em_token");
    setToken("");
    setUser(null);
    setPage("dashboard");
  };

  if (!token) {
    return <Login onLogin={(newToken, newUser) => {
      localStorage.setItem("em_token", newToken);
      setToken(newToken);
      setUser(newUser);
    }} />;
  }

  const currentTitle = nav.find((item) => item[1] === page)?.[0] || "Plataforma";

  return (
    <div className="app">
      <aside className={`sidebar ${mobile ? "show" : ""}`}>
        <div className="brand">
          <div className="brandmark"><BrainCircuit /></div>
          <div><b>EduMaster<span>.ai</span></b><small>ENTERPRISE LEARNING</small></div>
          <button className="mobile-close" onClick={() => setMobile(false)} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
        <div className="org"><span className="live-dot" /> {orgName.toLocaleUpperCase()} <span className="orgtag">ACTIVA</span></div>
        <div className="navlabel">PLATAFORMA</div>
        <nav>
          {nav.map(([label, id, Icon]) => (
            <button key={id} className={`navitem ${page === id ? "active" : ""}`} onClick={() => { setPage(id); setMobile(false); }}>
              <Icon size={17} /><span>{label}</span>{page === id && <ChevronRight size={15} className="navchev" />}
            </button>
          ))}
        </nav>
        <div className="sidebottom">
          <div className="secure"><ShieldCheck size={16} /><div><b>Entorno protegido</b><small>Sesión autenticada</small></div></div>
          <button className="profile" onClick={logout}>
            <div className="avatar">{user?.full_name?.slice(0, 1) || "A"}</div>
            <div className="profiletext"><b>{user?.full_name || "Administrador"}</b><small>{user?.role || "usuario"}</small></div>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="hamb" onClick={() => setMobile(!mobile)} aria-label="Abrir menú"><Menu /></button>
          <div className="crumb">Plataforma <span>/</span> <b>{currentTitle}</b></div>
          <div className="topright">
            <div className="search"><Search size={15} /><input placeholder="Buscar en EduMaster.ai" /></div>
            <button className="iconbtn" aria-label="Notificaciones"><Bell size={18} /><i /></button>
            <div className="topavatar">{user?.full_name?.slice(0, 1) || "A"}</div>
          </div>
        </header>

        <div className="content">
          <div className="pagehead">
            <div><div className="eyebrow">EDUMASTER.AI / ENTERPRISE</div><h1>{currentTitle}</h1><p>{descriptions[page]}</p></div>
            <div className="headactions"><span className="env"><span className="live-dot" /> SISTEMA CONECTADO</span><button className="ghost" onClick={reload}><RefreshCw size={15} /> Actualizar</button></div>
          </div>
          {error && <div className="alert"><AlertTriangle size={16} />{error}</div>}
          {loading && <div className="loadingbar" />}

          {page === "dashboard" && <Dashboard data={data.dashboard || {}} setPage={setPage} />}
          {page === "students" && <DataPage title="Estudiantes registrados" subtitle="Directorio académico de la institución." items={asArray(data.students)} kind="students" api={api} refresh={reload} />}
          {page === "courses" && <DataPage title="Catálogo de cursos" subtitle="Oferta académica y contenidos formativos." items={asArray(data.courses)} kind="courses" api={api} refresh={reload} />}
          {page === "assessments" && <DataPage title="Evaluaciones" subtitle="Instrumentos de evaluación asociados a cursos." items={asArray(data.assessments)} kind="assessments" api={api} refresh={reload} courses={asArray(data.courses)} />}
          {page === "enrollments" && <EnrollmentPage items={asArray(data.enrollments)} students={asArray(data.students)} courses={asArray(data.courses)} api={api} refresh={reload} />}
          {page === "paths" && <PathsPage items={asArray(data.paths)} api={api} refresh={reload} />}
          {page === "tracking" && <div className="grid2"><InfoPanel icon={<Activity />} title="Registrar actividad" text="Registra eventos académicos vinculados a estudiantes."><EventForm students={asArray(data.students)} api={api} /></InfoPanel><div className="panel"><div className="panelhead"><div><h3>Historial de actividad</h3><p>Eventos registrados en la institución</p></div><Activity /></div>{asArray(data.tracking).map((x: any) => <div className="auditrow" key={x.id}><Activity /><b>{x.event_type}</b><span>{x.description}</span><time>{x.occurred_at ? new Date(x.occurred_at).toLocaleString() : ""}</time></div>)}{!asArray(data.tracking).length && <div className="empty">No hay eventos registrados.</div>}</div></div>}
          {page === "analytics" && <Analytics data={data.dashboard || {}} />}
          {page === "neural" && <Neural />}
          {page === "models" && <Models items={asArray(data.models)} />}
          {page === "lab" && <MLLab token={token} apiBase={API} />}
          {page === "recommendations" && <InfoPanel icon={<Sparkles />} title="Motor de recomendaciones" text="Las recomendaciones combinan señales del modelo con reglas académicas, prerrequisitos, disponibilidad y revisión docente."><div className="notice-note">Las recomendaciones reales aparecerán cuando el backend disponga de resultados generados y un modelo aprobado.</div></InfoPanel>}
          {page === "certificates" && <CertificatesPage items={asArray(data.certificates)} students={asArray(data.students)} courses={asArray(data.courses)} api={api} refresh={reload} />}
          {page === "audit" && <Audit items={asArray(data.audit)} />}
          {page === "admin" && <AdminPage items={asArray(data.admin)} user={user} orgName={orgName} api={api} refresh={reload} />}
        </div>
      </main>
    </div>
  );
}

function asArray(value: any): AnyRow[] { return Array.isArray(value) ? value : value?.items || value?.data || []; }

function Login({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/api/v1/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || "No se pudo iniciar sesión.");
      if (!payload.access_token || !payload.user) throw new Error("La API no devolvió el token o los datos del usuario.");
      onLogin(payload.access_token, payload.user);
    } catch (e: any) { setError(e.message || "Error de conexión con el servidor."); }
    finally { setBusy(false); }
  }
  return (
    <div className="login">
      <div className="loginvisual">
        <div className="loginorb orb1" /><div className="loginorb orb2" />
        <div className="loginbrand"><div className="brandmark big"><BrainCircuit /></div><h1>EduMaster<span>.ai</span></h1><p>Plataforma empresarial de aprendizaje inteligente</p></div>
        <div className="loginfoot">LEARNING INTELLIGENCE PLATFORM <span>•</span> ENTERPRISE EDITION</div>
      </div>
      <div className="loginform"><div className="formbox">
        <div className="eyebrow">ACCESO INSTITUCIONAL</div><h2>Iniciar sesión</h2><p>Accede a tu espacio de trabajo institucional.</p>
        <form onSubmit={submit}>
          <label>Correo institucional</label><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" required />
          <label>Contraseña</label><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
          {error && <div className="alert"><AlertTriangle size={15} />{error}</div>}
          <button className="primary full" disabled={busy}>{busy ? "Validando…" : "Ingresar a la plataforma"} <ChevronRight size={17} /></button>
        </form>
        <div className="loginhint">Utiliza las credenciales del administrador institucional configuradas durante la instalación.</div>
        <small className="muted">Conexión segura mediante autenticación JWT.</small>
      </div></div>
    </div>
  );
}

function Dashboard({ data, setPage }: any) {
  const stats = [
    { icon: Users, label: "Estudiantes", value: data.students ?? "—", hint: "Registros institucionales", page: "students" },
    { icon: BookOpen, label: "Cursos", value: data.courses ?? "—", hint: "Catálogo académico", page: "courses" },
    { icon: GraduationCap, label: "Evaluaciones", value: data.assessments ?? "—", hint: "Instrumentos registrados", page: "assessments" },
    { icon: Activity, label: "Eventos de aprendizaje", value: data.learning_events ?? "—", hint: "Trazabilidad académica", page: "tracking" },
  ];
  const recent = Array.isArray(data.recent_activity) ? data.recent_activity : [];
  const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
  const trend = Array.isArray(data.monthly_progress) ? data.monthly_progress : [];
  return <>
    <section className="welcome">
      <div><div className="welcome-tag"><Sparkles size={14} /> PANEL INSTITUCIONAL</div><h2>Aprende. Practica. Destaca.</h2><p>Monitorea la actividad académica, el progreso y los servicios de la plataforma desde un solo lugar.</p></div>
      <div className="welcome-art"><div className="art-ring r1" /><div className="art-ring r2" /><BrainCircuit size={70} /><span className="artnode n1" /><span className="artnode n2" /><span className="artnode n3" /></div>
    </section>

    <section className="stats">
      {stats.map(({ icon: Icon, label, value, hint, page }) => <button className="statcard" key={label} onClick={() => setPage(page)}>
        <div className="stathead"><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small>{hint}</small>
      </button>)}
    </section>

    <section className="reference-grid">
      <div className="panel analytics-panel">
        <div className="panelhead"><div><h3>Ingresos y progreso analítico</h3><p>Indicadores temporales proporcionados por el backend</p></div><TrendingUp /></div>
        {trend.length ? <TrendChart rows={trend} /> : <EmptyChart message="Aún no hay una serie histórica disponible." detail="Cuando la API exponga datos mensuales, aquí se visualizará la evolución real." />}
      </div>
      <div className="panel map-panel">
        <div className="panelhead"><div><h3>Mapa de progreso de aprendizaje</h3><p>Distribución geográfica de estudiantes</p></div><MapPinned /></div>
        <StudentMap points={data.geo_points || []} missing={data.students_without_location || 0} />
      </div>
      <div className="panel mastery-panel">
        <div className="panelhead"><div><h3>Dominio de habilidades</h3><p>Competencias y evidencias académicas</p></div><Target /></div>
        {Array.isArray(data.skill_mastery) && data.skill_mastery.length ? <div className="mastery-list">{data.skill_mastery.map((x: any) => <div className="mastery-row" key={x.name}><span>{x.name}</span><div className="mastery-track"><i style={{ width: `${Math.max(0, Math.min(100, Number(x.value) || 0))}%` }} /></div><b>{x.value}%</b></div>)}</div> : Array.isArray(data.course_performance) && data.course_performance.length ? <><div className="mastery-list">{data.course_performance.map((x: any) => <div className="mastery-row" key={x.name}><span>{x.name}</span><div className="mastery-track"><i style={{ width: `${Math.max(0, Math.min(100, Number(x.value) * 5))}%` }} /></div><b>{Number(x.value).toFixed(1)}/20</b></div>)}</div><small className="muted">Desempeño por curso (notas registradas), no dominio de competencias.</small></> : <EmptyChart message="Sin evidencias de competencias." detail="Registra resultados de evaluaciones para ver desempeño académico. El dominio por habilidad requiere rúbricas/competencias." />}
      </div>
      <div className="panel recommendations-panel">
        <div className="panelhead"><div><h3>Recomendaciones de IA</h3><p>Sugerencias disponibles desde el servicio</p></div><Sparkles /></div>
        {recommendations.length ? recommendations.slice(0, 5).map((x: any, i: number) => <div className="recommend-row" key={x.id || i}><span className="recommend-icon"><Zap size={15} /></span><div><b>{x.title || x.name || "Recomendación"}</b><small>{x.description || x.reason || "Sugerencia académica"}</small></div></div>) : <EmptyChart message="No hay recomendaciones generadas." detail="No se muestran sugerencias sin evidencia registrada." />}
      </div>
      <div className="panel activity-panel">
        <div className="panelhead"><div><h3>Actividad reciente</h3><p>Últimos eventos registrados</p></div><button className="textlink" onClick={() => setPage("tracking")}>Ver seguimiento <ChevronRight size={14} /></button></div>
        {recent.length ? recent.slice(0, 5).map((x: any, i: number) => <div className="activity-row" key={x.id || i}><span className="activity-check"><CheckCircle2 size={15} /></span><div><b>{x.title || x.event_type || x.description || "Evento académico"}</b><small>{x.student_name || x.student || "Actividad registrada"}</small></div><time>{x.created_at ? new Date(x.created_at).toLocaleString() : ""}</time></div>) : <EmptyChart message="No hay actividad reciente disponible." detail="Los eventos aparecerán aquí después de registrarse." />}
      </div>
    </section>
    <section className="bottomgrid">
      <div className="panel"><div className="panelhead"><div><h3>Accesos rápidos</h3><p>Operaciones frecuentes</p></div></div><div className="quickgrid">
        {[[Users, "Registrar estudiante", "students"], [BookOpen, "Gestionar cursos", "courses"], [GraduationCap, "Revisar evaluaciones", "assessments"], [BrainCircuit, "Visualizar redes neuronales", "neural"]].map(([Icon, label, target]: any) => <button className="quick" key={label} onClick={() => setPage(target)}><Icon /><span>{label}</span><ChevronRight /></button>)}
      </div></div>
      <div className="panel"><div className="panelhead"><div><h3>Principios de IA responsable</h3><p>Controles del proyecto</p></div><ShieldCheck /></div>
        <div className="principle"><CheckCircle2 /><span>Predicciones como estimaciones, no certezas.</span></div>
        <div className="principle"><CheckCircle2 /><span>Riesgo orientado a acompañamiento humano.</span></div>
        <div className="principle"><CheckCircle2 /><span>Los datos deben validarse antes de generar indicadores educativos.</span></div>
      </div>
    </section>
  </>;
}

function EmptyChart({ message, detail }: { message: string; detail: string }) {
  return <div className="empty-chart"><ChartNoAxesCombined size={27} /><b>{message}</b><span>{detail}</span></div>;
}

function TrendChart({ rows }: { rows: AnyRow[] }) {
  const points = rows.slice(-12).map((r, i) => ({ label: r.month || r.label || String(i + 1), value: Number(r.value ?? r.progress ?? r.total ?? 0) }));
  const max = Math.max(1, ...points.map((p) => p.value));
  const coords = points.map((p, i) => `${points.length === 1 ? 50 : 8 + i * (84 / (points.length - 1))},${88 - (p.value / max) * 68}`).join(" ");
  return <div className="trend-wrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-svg"><defs><linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#31c7ff" stopOpacity=".3" /><stop offset="100%" stopColor="#31c7ff" stopOpacity="0" /></linearGradient></defs><polygon points={`8,88 ${coords} 92,88`} fill="url(#trendFill)" /><polyline points={coords} fill="none" stroke="#31c7ff" strokeWidth="1.7" vectorEffect="non-scaling-stroke" />{points.map((p, i) => <circle key={i} cx={points.length === 1 ? 50 : 8 + i * (84 / (points.length - 1))} cy={88 - (p.value / max) * 68} r="1.8" fill="#7ee3ff" />)}</svg><div className="trend-labels">{points.map((p, i) => <span key={i}>{p.label}</span>)}</div></div>;
}

function Neural() {
  const [active, setActive] = useState("");
  const [playing, setPlaying] = useState(false);
  const head = networkHeads.find((x) => x.id === active);
  const columns = head ? [head.inputs, ...head.hidden.map((n) => Array.from({ length: Math.min(n, 8) }, (_, i) => `N${i + 1}`)), ["Salida"]] : [];
  const positions = columns.map((col, ci) => col.map((_, ni) => ({ x: 45 + ci * (890 / Math.max(columns.length - 1, 1)), y: 25 + (ni + 1) * (250 / (col.length + 1)) })));
  return <div className="neuralpage">
    <div className="neuralintro"><div><span className="eyebrow">AI PLATFORM / NEURAL LAB</span><h2>Arquitecturas neuronales EduMaster.ai</h2><p>Selecciona una red. Solo la arquitectura elegida se muestra activa.</p></div><span className="pill amber">MODO CONTROLADO</span></div>
    <div className="panel"><div className="panelhead"><div><h3>Catálogo de seis redes</h3><p>Diseños conceptuales de las tareas educativas.</p></div><span className="pill green">{head ? "1 SELECCIONADA" : "0 ACTIVAS"}</span></div><div className="headcards">{networkHeads.map((x) => <button key={x.id} onClick={() => { setActive(x.id); setPlaying(false); }} className={`headcard ${active === x.id ? "chosen" : ""}`} style={{ "--route": x.color } as any}><div className="headcardtop"><span>RED {x.id}</span><span className={`pill ${active === x.id ? "green" : "gray"}`}>{active === x.id ? "ENCENDIDA" : "APAGADA"}</span></div><b>{x.name}</b><small>{x.desc}</small></button>)}</div></div>
    <div className="panel neuralcanvas"><div className="canvashead"><div><b>{head?.name || "Ninguna red seleccionada"}</b><small>{head?.desc || "Selecciona una arquitectura del catálogo."}</small></div>{head && <div className="canvascontrols"><button className="outline small" onClick={() => setPlaying(!playing)}>{playing ? "Pausar animación" : "Encender visualización"}</button><button className="outline small" onClick={() => { setActive(""); setPlaying(false); }}>Apagar red</button></div>}</div>
      {head ? <><svg className={`network-svg ${playing ? "animate" : ""}`} viewBox="0 0 980 310" role="img" aria-label={`Topología de ${head.name}`}>{positions.slice(0, -1).flatMap((col, ci) => col.flatMap((p) => positions[ci + 1].map((q, qi) => <line key={`${ci}-${p.x}-${p.y}-${qi}`} x1={p.x + 8} y1={p.y} x2={q.x - 8} y2={q.y} className="wire selected" style={{ "--route": head.color } as any} />)))}{positions.map((col, ci) => col.map((p, ni) => <circle key={`${ci}-${ni}`} cx={p.x} cy={p.y} r="8" className="node temporal" style={{ "--route": head.color } as any} />))}{columns.map((_, i) => <text key={i} x={45 + i * (890 / Math.max(columns.length - 1, 1))} y="300" textAnchor="middle" className="svglabel">{i === 0 ? "ENTRADA" : i === columns.length - 1 ? "SALIDA" : `CAPA OCULTA ${i}`}</text>)}</svg><div className="inspectgrid"><div className="panel"><h3>Inspector de arquitectura</h3><div className="inspectrow"><span>Entradas</span><b>{head.inputs.join(", ")}</b></div>{head.hidden.map((n, i) => <div className="inspectrow" key={i}><span>Capa oculta {i + 1}</span><b>{n} neuronas · ReLU (diseño)</b></div>)}<div className="inspectrow"><span>Salida</span><b>{head.output}</b></div></div><div className="panel"><h3>Explicación funcional</h3><p className="muted">Las entradas se transforman mediante capas ocultas. Cada neurona combina señales usando pesos y una función de activación para producir la salida definida para la tarea.</p><div className="notice-note"><AlertTriangle size={15} /> La animación representa el flujo visual; no demuestra entrenamiento ni inferencia real.</div></div></div></> : <div className="empty"><BrainCircuit size={38} />Selecciona una red para visualizar sus capas y conexiones.</div>}
    </div>
  </div>;
}

function DataPage({ title, subtitle, items, kind, api, refresh, courses = [] }: any) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<AnyRow>({});
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const body = kind === "students"
        ? { student_code: form.code, full_name: form.name, email: form.email || "", district: form.district || "", latitude: form.latitude === "" || form.latitude == null ? null : Number(form.latitude), longitude: form.longitude === "" || form.longitude == null ? null : Number(form.longitude), status: "active" }
        : kind === "courses"
          ? { code: form.code, title: form.title, description: form.description || "", level: form.level || "General", status: "published" }
          : { course_id: form.course_id, title: form.title, max_score: Number(form.max_score || 20), status: "draft", due_date: form.due_date || "" };
      await api(editingId ? `/api/v1/${kind}/${editingId}` : `/api/v1/${kind}`, { method: editingId ? "PUT" : "POST", body: JSON.stringify(body) });
      setShow(false); setForm({}); setEditingId(null); await refresh();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }
  return <div className="panel tablepanel"><div className="panelhead"><div><h3>{title}</h3><p>{subtitle}</p></div><button className="primary" onClick={() => { setShow(!show); setEditingId(null); setForm({}); }}><Plus size={16} /> Nuevo registro</button></div>
    {show && <form className="inlineform" onSubmit={save}>
      {kind === "students" ? <><input placeholder="Código" required value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /><input placeholder="Nombre completo" required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input placeholder="Correo" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input placeholder="Distrito" value={form.district || ""} onChange={(e) => setForm({ ...form, district: e.target.value })} /><input placeholder="Latitud (opcional)" type="number" step="any" value={form.latitude ?? ""} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /><input placeholder="Longitud (opcional)" type="number" step="any" value={form.longitude ?? ""} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></> :
        kind === "courses" ? <><input placeholder="Código" required value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /><input placeholder="Nombre del curso" required value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input placeholder="Nivel" value={form.level || ""} onChange={(e) => setForm({ ...form, level: e.target.value })} /></> :
          <><select required value={form.course_id || ""} onChange={(e) => setForm({ ...form, course_id: e.target.value })}><option value="">Seleccionar curso</option>{courses.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><input placeholder="Título de evaluación" required value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input type="number" placeholder="Puntaje máximo" value={form.max_score || "20"} onChange={(e) => setForm({ ...form, max_score: e.target.value })} /></>}
      <button className="primary" disabled={saving}>{saving ? "Guardando…" : editingId ? "Actualizar" : "Guardar"}</button><button type="button" className="outline" onClick={() => { setShow(false); setEditingId(null); }}>Cancelar</button>
    </form>}
    <div className="tablewrap"><table><thead><tr>{[...(kind === "students" ? ["Código", "Nombre", "Correo", "Distrito", "Estado"] : kind === "courses" ? ["Código", "Curso", "Nivel", "Estado"] : ["Evaluación", "Curso ID", "Puntaje máximo", "Estado"]), "Acciones"].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>
      {items.map((x: any) => <tr key={x.id}>{kind === "students" ? <><td><b>{x.student_code}</b></td><td>{x.full_name}</td><td>{x.email}</td><td>{x.district || "—"}</td><td><span className="pill green">{x.status}</span></td></> : kind === "courses" ? <><td><b>{x.code}</b></td><td>{x.title}</td><td>{x.level}</td><td><span className="pill green">{x.status}</span></td></> : <><td>{x.title}</td><td className="mono">{x.course_id?.slice(0, 9)}</td><td>{x.max_score}</td><td>{x.status}</td></>}<td><button className="outline small" title="Editar" onClick={() => { setEditingId(x.id); setForm(kind === "students" ? {code:x.student_code,name:x.full_name,email:x.email,district:x.district,latitude:x.latitude,longitude:x.longitude} : kind === "courses" ? {code:x.code,title:x.title,description:x.description,level:x.level} : {course_id:x.course_id,title:x.title,max_score:x.max_score,due_date:x.due_date}); setShow(true); }}><Pencil size={13}/></button> <button className="outline small" title="Eliminar o archivar" onClick={async()=>{if(!confirm("¿Deseas eliminar o archivar este registro?"))return;try{await api(`/api/v1/${kind}/${x.id}`,{method:"DELETE"});await refresh();}catch(e:any){alert(e.message)}}}><Trash2 size={13}/></button></td></tr>)}
    </tbody></table>{!items.length && <div className="empty">Aún no hay registros.</div>}</div>
  </div>;
}


function EnrollmentPage({ items, students, courses, api, refresh }: any) {
  const [student, setStudent] = useState(""); const [course, setCourse] = useState(""); const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { await api("/api/v1/enrollments", { method: "POST", body: JSON.stringify({ student_id: student, course_id: course }) }); setStudent(""); setCourse(""); await refresh(); } catch (e: any) { alert(e.message); } finally { setBusy(false); } }
  return <div className="panel"><div className="panelhead"><div><h3>Matrículas académicas</h3><p>Asocia estudiantes con cursos de la institución.</p></div><GraduationCap /></div><form className="inlineform" onSubmit={save}><select required value={student} onChange={e=>setStudent(e.target.value)}><option value="">Seleccionar estudiante</option>{students.map((x:any)=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select><select required value={course} onChange={e=>setCourse(e.target.value)}><option value="">Seleccionar curso</option>{courses.map((x:any)=><option key={x.id} value={x.id}>{x.title}</option>)}</select><button className="primary" disabled={busy || !students.length || !courses.length}>{busy?"Guardando…":"Registrar matrícula"}</button></form><div className="tablewrap"><table><thead><tr><th>Estudiante ID</th><th>Curso ID</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>{items.map((x:any)=><tr key={x.id}><td>{x.student_id}</td><td>{x.course_id}</td><td><select value={x.status} onChange={async(e)=>{try{await api(`/api/v1/enrollments/${x.id}/status?status_value=${e.target.value}`,{method:"PATCH"});await refresh();}catch(err:any){alert(err.message)}}}><option value="active">Activa</option><option value="completed">Completada</option><option value="withdrawn">Retirada</option></select></td><td>{x.enrolled_at?new Date(x.enrolled_at).toLocaleDateString():"—"}</td></tr>)}</tbody></table>{!items.length&&<div className="empty">Todavía no hay matrículas.</div>}</div></div>;
}
function PathsPage({ items, api, refresh }: any) {
  const [title,setTitle]=useState(""); const [description,setDescription]=useState(""); const [level,setLevel]=useState("General");
  async function save(e:React.FormEvent){e.preventDefault();try{await api("/api/v1/learning-paths",{method:"POST",body:JSON.stringify({title,description,level,status:"published"})});setTitle("");setDescription("");await refresh();}catch(e:any){alert(e.message)}}
  return <div className="panel"><div className="panelhead"><div><h3>Rutas de aprendizaje</h3><p>Define itinerarios y niveles formativos.</p></div><Layers3/></div><form className="inlineform" onSubmit={save}><input required placeholder="Nombre de la ruta" value={title} onChange={e=>setTitle(e.target.value)}/><input placeholder="Descripción" value={description} onChange={e=>setDescription(e.target.value)}/><select value={level} onChange={e=>setLevel(e.target.value)}><option>Inicial</option><option>General</option><option>Intermedio</option><option>Avanzado</option></select><button className="primary">Crear ruta</button></form>{items.map((x:any)=><div className="modelitem" key={x.id}><div className="modelicon"><BookOpen/></div><div><b>{x.title}</b><small>{x.description}</small><small>{x.level} · {x.status}</small></div></div>)}{!items.length&&<div className="empty">No hay rutas formativas creadas.</div>}</div>;
}
function CertificatesPage({items,students,courses,api,refresh}:any){const [student,setStudent]=useState("");const [course,setCourse]=useState("");async function issue(e:React.FormEvent){e.preventDefault();try{const x=await api("/api/v1/certificates",{method:"POST",body:JSON.stringify({student_id:student,course_id:course})});alert(`Certificado emitido: ${x.certificate_code}`);await refresh();}catch(e:any){alert(e.message)}}return <div className="panel"><div className="panelhead"><div><h3>Emisión y verificación de certificados</h3><p>Solo se emiten para matrículas marcadas como completadas.</p></div><Award/></div><form className="inlineform" onSubmit={issue}><select required value={student} onChange={e=>setStudent(e.target.value)}><option value="">Estudiante</option>{students.map((x:any)=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select><select required value={course} onChange={e=>setCourse(e.target.value)}><option value="">Curso</option>{courses.map((x:any)=><option key={x.id} value={x.id}>{x.title}</option>)}</select><button className="primary">Emitir certificado</button></form>{items.map((x:any)=><div className="auditrow" key={x.id}><Award/><b>{x.certificate_code}</b><span>{x.student_id}</span><span>{x.course_id}</span><small>{x.issued_at?new Date(x.issued_at).toLocaleDateString():""}</small></div>)}{!items.length&&<div className="empty">No se han emitido certificados.</div>}</div>}
function AdminPage({items,user,orgName,api,refresh}:any){const [name,setName]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [role,setRole]=useState("teacher");async function create(e:React.FormEvent){e.preventDefault();try{await api("/api/v1/users",{method:"POST",body:JSON.stringify({full_name:name,email,password,role})});setName("");setEmail("");setPassword("");await refresh();}catch(e:any){alert(e.message)}}return <div className="grid2"><div className="panel"><div className="panelhead"><div><h3>Usuarios y roles</h3><p>Administración de accesos institucionales.</p></div><ShieldCheck/></div><form className="eventform" onSubmit={create}><label>Nombre completo</label><input required value={name} onChange={e=>setName(e.target.value)}/><label>Correo institucional</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/><label>Contraseña temporal (12 caracteres mínimo)</label><input required minLength={12} type="password" value={password} onChange={e=>setPassword(e.target.value)}/><label>Rol</label><select value={role} onChange={e=>setRole(e.target.value)}><option value="teacher">Docente</option><option value="student">Estudiante</option><option value="analyst">Analista</option><option value="director">Director</option><option value="institution_admin">Administrador</option></select><button className="primary">Crear usuario</button></form></div><div className="panel"><h3>Entorno institucional</h3><div className="quality"><span>Institución</span><b>{orgName}</b></div><div className="quality"><span>Usuario actual</span><b>{user?.full_name}</b></div><div className="quality"><span>Rol</span><b>{user?.role}</b></div><div className="quality"><span>Usuarios registrados</span><b>{items.length}</b></div></div><div className="panel span2"><h3>Directorio de usuarios</h3>{items.map((x:any)=><div className="auditrow" key={x.id}><Users/><b>{x.full_name}</b><span>{x.email}</span><span>{x.role}</span><span className={`pill ${x.is_active?"green":"gray"}`}>{x.is_active?"Activo":"Inactivo"}</span></div>)}{!items.length&&<div className="empty">No hay usuarios registrados.</div>}</div></div>}

function EventForm({ students, api }: any) {
  const [student, setStudent] = useState(""); const [type, setType] = useState("lesson_viewed"); const [desc, setDesc] = useState("");
  async function send(e: React.FormEvent) { e.preventDefault(); try { await api("/api/v1/learning-events", { method: "POST", body: JSON.stringify({ student_id: student, event_type: type, description: desc }) }); alert("Evento registrado correctamente."); setDesc(""); } catch (e: any) { alert(e.message); } }
  return <form className="eventform" onSubmit={send}><label>Estudiante</label><select required value={student} onChange={(e) => setStudent(e.target.value)}><option value="">Seleccionar estudiante</option>{students.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select><label>Tipo de evento</label><select value={type} onChange={(e) => setType(e.target.value)}>{["lesson_viewed", "activity_started", "activity_completed", "assessment_submitted", "course_completed"].map((x) => <option key={x}>{x}</option>)}</select><label>Descripción</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Detalle opcional" /><button className="primary">Registrar evento</button></form>;
}

function InfoPanel({ icon, title, text, children }: any) { return <div className="panel infopanel"><div className="infoicon">{icon}</div><h2>{title}</h2><p>{text}</p>{children}</div>; }
function Stat({ label, value, hint }: any) { return <div className="statcard"><div className="stathead">{label}</div><strong>{value}</strong><small>{hint}</small></div>; }

function StudentMap({ points, missing }: { points: AnyRow[]; missing: number }) {
  if (!points.length) return <div className="map-placeholder"><MapPinned size={35} /><b>Mapa institucional</b><span>No hay coordenadas registradas. Al editar estudiantes, agrega latitud y longitud para ubicarlos.</span><small>{missing} estudiantes sin ubicación</small></div>;
  const lats = points.map(p=>Number(p.latitude)), lons=points.map(p=>Number(p.longitude));
  const minLat=Math.min(...lats), maxLat=Math.max(...lats), minLon=Math.min(...lons), maxLon=Math.max(...lons);
  const x=(lon:number)=>8+(maxLon===minLon?42:(lon-minLon)/(maxLon-minLon)*84);
  const y=(lat:number)=>88-(maxLat===minLat?42:(lat-minLat)/(maxLat-minLat)*76);
  return <div className="student-map"><svg viewBox="0 0 100 100" role="img" aria-label="Ubicaciones registradas de estudiantes"><path d="M8 18 Q28 5 43 18 T92 22 M5 62 Q25 48 44 62 T95 58 M25 5 Q18 35 30 95 M70 5 Q60 45 78 95" className="map-gridline"/>{points.map(p=><circle key={p.id} cx={x(Number(p.longitude))} cy={y(Number(p.latitude))} r="2.5"><title>{p.name} · {p.district || "Ubicación registrada"}</title></circle>)}</svg><div className="map-legend">{points.length} ubicaciones · {missing} sin coordenadas</div><div className="map-locations">{points.slice(0,4).map(p=><span key={p.id}>{p.name} · {p.district || "Sin distrito"}</span>)}</div></div>;
}

function Analytics({ data }: any) {
  return <div className="analytics-page">
    <div className="stats"><Stat label="Estudiantes" value={data.students ?? 0} hint="Registros institucionales" /><Stat label="Matrículas" value={data.enrollments ?? 0} hint={`${data.completed_enrollments ?? 0} completadas`} /><Stat label="Notas registradas" value={data.graded_results ?? 0} hint="Resultados de evaluaciones" /><Stat label="Eventos" value={data.learning_events ?? 0} hint="Actividad de aprendizaje" /></div>
    <div className="grid2"><div className="panel"><div className="panelhead"><div><h3>Evolución mensual de notas</h3><p>Promedio real de resultados por mes</p></div><TrendingUp /></div>{data.monthly_progress?.length ? <TrendChart rows={data.monthly_progress} /> : <EmptyChart message="Sin resultados evaluados" detail="Registra notas para construir la serie mensual." />}</div>
    <div className="panel"><div className="panelhead"><div><h3>Desempeño por curso</h3><p>Promedio de notas registradas (escala original)</p></div><Target /></div>{data.course_performance?.length ? <div className="mastery-list">{data.course_performance.map((x:any)=><div className="mastery-row" key={x.name}><span>{x.name}</span><div className="mastery-track"><i style={{width:`${Math.max(0,Math.min(100,Number(x.value)*5))}%`}}/></div><b>{x.value}/20</b></div>)}</div> : <EmptyChart message="Sin notas por curso" detail="Los resultados aparecerán cuando se registren evaluaciones calificadas." />}</div></div>
    <div className="panel"><h3>Calidad y gobierno de datos</h3><p className="muted">Indicadores calculados con registros reales. Los objetivos de calidad son controles, no resultados medidos.</p><div className="quality"><span>Estudiantes con ubicación</span><b>{data.students_with_location ?? 0} / {data.students ?? 0}</b></div><div className="quality"><span>Resultados de evaluación</span><b>{data.graded_results ?? 0}</b></div><div className="quality"><span>Estado de datos</span><b>{data.data_quality?.note || "Sin información"}</b></div></div>
  </div>;
}

function Models({ items }: any) {
  return <div className="grid2"><div className="panel"><div className="panelhead"><div><h3>Registro de modelos</h3><p>Versiones y estado de aprobación</p></div><BrainCircuit /></div>{items.map((x: any) => <div className="modelitem" key={x.id}><div className="modelicon"><Network /></div><div><b>{x.name}</b><small>Versión {x.version} · {x.stage}</small><small>{x.description}</small></div><span className="pill amber">{x.approval_status}</span></div>)}{!items.length && <div className="empty">No hay modelos registrados.</div>}<div className="notice-note">Los checkpoints y métricas se muestran cuando el backend los registra.</div></div><div className="panel"><h3>Flujo MLOps previsto</h3>{["Dataset versionado", "Baseline interpretable", "Entrenamiento PyTorch", "Evaluación y calibración", "Registro MLflow", "Aprobación humana", "Staging / Shadow", "Producción y monitoreo"].map((x, i) => <div className="flowstep" key={x}><span>{i + 1}</span>{x}</div>)}</div></div>;
}

function MLLab({ token, apiBase }: any) {
  const [datasets, setDatasets] = useState<AnyRow[]>([]); const [experiments, setExperiments] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState(""); const [target, setTarget] = useState(""); const [layers, setLayers] = useState("64,32");
  const [activation, setActivation] = useState("relu"); const [epochs, setEpochs] = useState("150");
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<any>(null); const [message, setMessage] = useState("");
  const headers = { Authorization: `Bearer ${token}` };
  async function refresh() {
    const [d, e] = await Promise.all([fetch(`${apiBase}/api/v1/ml/datasets`, { headers }), fetch(`${apiBase}/api/v1/ml/experiments`, { headers })]);
    if (d.ok) { const rows = await d.json(); setDatasets(rows); if (rows[0] && !selected) { setSelected(rows[0].id); setTarget(rows[0].columns?.[rows[0].columns.length - 1] || ""); } }
    if (e.ok) setExperiments(await e.json());
  }
  useEffect(() => { refresh().catch((e) => setMessage(e.message)); }, []);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; setBusy(true); setMessage("");
    try { const fd = new FormData(); fd.append("file", file); const r = await fetch(`${apiBase}/api/v1/ml/datasets`, { method: "POST", headers, body: fd }); const j = await r.json(); if (!r.ok) throw new Error(j.detail || "Error al cargar CSV"); setMessage(`Dataset cargado: ${j.rows} filas y ${j.columns.length} columnas.`); await refresh(); setSelected(j.id); setTarget(j.columns[j.columns.length - 1]); }
    catch (e: any) { setMessage(e.message); } finally { setBusy(false); e.target.value = ""; }
  }
  async function train() {
    setBusy(true); setMessage("Entrenando red neuronal…"); setResult(null);
    try { const fd = new FormData(); fd.append("dataset_id", selected); fd.append("target", target); fd.append("hidden_layers", layers); fd.append("activation", activation); fd.append("max_iter", epochs); fd.append("test_size", "0.2"); const r = await fetch(`${apiBase}/api/v1/ml/train`, { method: "POST", headers, body: fd }); const j = await r.json(); if (!r.ok) throw new Error(j.detail || "No se pudo entrenar"); setResult(j); setMessage("Entrenamiento completado. El modelo queda experimental y sin aprobación."); await refresh(); }
    catch (e: any) { setMessage(e.message); } finally { setBusy(false); }
  }
  const dataset = datasets.find((x) => x.id === selected);
  return <div className="grid2">
    <div className="panel"><div className="panelhead"><div><h3>1. Ingesta y calidad del dataset</h3><p>CSV supervisado · máximo 10 MB</p></div><Database /></div><label className="uploadbox"><input type="file" accept=".csv,text/csv" onChange={upload} disabled={busy} /><b>Seleccionar archivo CSV</b><small>Valida estructura, filas y valores faltantes.</small></label>{datasets.map((d) => <button key={d.id} className={`datasetrow ${selected === d.id ? "selected" : ""}`} onClick={() => { setSelected(d.id); setTarget(d.columns?.[d.columns.length - 1] || ""); setResult(null); }}><Database size={17} /><span><b>{d.filename}</b><small>{d.rows} filas · {d.columns?.length} columnas · {d.missing} faltantes</small></span><span className="pill gray">{selected === d.id ? "Elegido" : "Usar"}</span></button>)}{!datasets.length && <div className="empty">Todavía no has cargado datasets.</div>}</div>
    <div className="panel"><div className="panelhead"><div><h3>2. Configuración de red neuronal</h3><p>Perceptrón multicapa (MLP) para clasificación</p></div><BrainCircuit /></div><label>Columna objetivo</label><select value={target} onChange={(e) => setTarget(e.target.value)} disabled={!dataset}>{(dataset?.columns || []).map((c: string) => <option key={c}>{c}</option>)}</select><label>Capas ocultas</label><input value={layers} onChange={(e) => setLayers(e.target.value)} placeholder="64,32" /><small className="muted">Ejemplo: 64,32 crea dos capas ocultas.</small><label>Función de activación</label><select value={activation} onChange={(e) => setActivation(e.target.value)}><option value="relu">ReLU</option><option value="tanh">Tanh</option><option value="logistic">Sigmoide</option></select><label>Épocas máximas</label><input type="number" min="30" max="1000" value={epochs} onChange={(e) => setEpochs(e.target.value)} /><button className="primary full" disabled={busy || !dataset || !target} onClick={train}>{busy ? "Procesando…" : "Entrenar red neuronal"}</button><div className="notice-note">División 80% entrenamiento y 20% prueba. El pipeline procesa valores faltantes, escala numéricos y codifica categorías.</div></div>
    {message && <div className="panel span2"><p className="muted">{message}</p></div>}
    {result && <div className="panel span2"><div className="panelhead"><div><h3>3. Resultados de evaluación</h3><p>Experimento {String(result.id).slice(0, 8)} · holdout 80/20</p></div><span className="pill amber">Experimental / no aprobado</span></div><div className="grid3"><Stat label="Accuracy" value={`${(result.accuracy * 100).toFixed(1)}%`} hint="Exactitud en prueba" /><Stat label="F1 ponderado" value={Number(result.f1_weighted).toFixed(3)} hint="Balance precisión / recall" /><Stat label="Épocas ejecutadas" value={result.epochs_completed} hint={`Máximo: ${result.max_epochs}`} /></div><div className="quality"><span>Precisión ponderada</span><b>{Number(result.precision_weighted).toFixed(3)}</b></div><div className="quality"><span>Recall ponderado</span><b>{Number(result.recall_weighted).toFixed(3)}</b></div><h4>Matriz de confusión</h4><div className="tablewrap"><table><tbody>{(result.confusion_matrix || []).map((row: number[], i: number) => <tr key={i}>{row.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody></table></div><p className="muted">Características: {(result.features || []).join(", ")}. Clases: {(result.classes || []).join(", ")}.</p><div className="notice-note">Las métricas dependen del dataset y no demuestran por sí solas validez educativa.</div></div>}
    <div className="panel span2"><div className="panelhead"><div><h3>4. Historial de experimentos</h3><p>Entrenamientos guardados por institución</p></div><Clock3 /></div>{experiments.map((x) => <div className="auditrow" key={x.id}><BrainCircuit /><b>{x.dataset_name}</b><span>{x.target}</span><span>Accuracy {(x.accuracy * 100).toFixed(1)}%</span><small>{x.architecture?.join("–")} · {x.epochs_completed} épocas</small></div>)}{!experiments.length && <div className="empty">Aún no hay experimentos.</div>}</div>
  </div>;
}

function Audit({ items }: any) {
  return <div className="panel"><div className="panelhead"><div><h3>Bitácora de auditoría</h3><p>Últimas operaciones registradas</p></div><ShieldCheck /></div>{items.map((x: any) => <div className="auditrow" key={x.id}><Clock3 /><b>{x.action}</b><span>{x.resource}</span><small>{x.actor_email}</small><time>{x.occurred_at ? new Date(x.occurred_at).toLocaleString() : ""}</time></div>)}{!items.length && <div className="empty">Todavía no hay operaciones registradas.</div>}</div>;
}

export default App;
