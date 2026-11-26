import { useEffect, useMemo, useState } from "react";
import {
  Activity, BookOpen, BrainCircuit, Users, GraduationCap, ChartNoAxesCombined,
  Settings, ShieldCheck, Award, Search, LogOut, Menu, Network, Database,
  Sparkles, ChevronRight, Plus, RefreshCw, Layers3, Clock3, CheckCircle2, Pencil, Trash2,
  AlertTriangle, MapPinned, Target, Zap, CalendarDays, TrendingUp, X
} from "lucide-react";

const API = (import.meta.env.VITE_API_URL || "https://edumaster-api-qqyx.onrender.com").replace(/\/$/, "");
type User = { id: string; full_name: string; email: string; role: string };
type AnyRow = Record<string, any>;

const nav = [
  ["Resumen", "dashboard", ChartNoAxesCombined],
  ["Estudiantes", "students", Users],
  ["Cursos", "courses", BookOpen],
  ["Evaluaciones", "assessments", GraduationCap],
  ["Matrículas", "enrollments", Users],
  ["Rutas informativas", "paths", Layers3],
  ["Seguimiento", "tracking", Activity],
  ["Analítica", "analytics", ChartNoAxesCombined],
  ["Dataset y modelos", "models", Database],
  ["Laboratorio ML", "lab", BrainCircuit],
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
  models: "Gobierno de datasets, experimentos y versiones de modelos.",
  lab: "Carga de datasets, configuración, entrenamiento y evaluación.",
  certificates: "Emisión y verificación de logros académicos.",
  audit: "Trazabilidad de operaciones de la plataforma.",
  admin: "Configuración institucional y control de acceso.",
};

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
    // El resumen necesita SIEMPRE ambos endpoints: conteos y analítica.
    // Antes dashboard estaba en el mapa de endpoints y nunca ejecutaba esta carga combinada.
    if (page === "dashboard" || page === "analytics") {
      setLoading(true); setError("");
      try {
        const [summary, analytics] = await Promise.all([
          api("/api/v1/dashboard/summary"),
          api("/api/v1/dashboard/analytics"),
        ]);
        setData((current) => ({ ...current, dashboard: { ...summary, ...analytics } }));
      } catch (e: any) { setError(e.message || "No se pudo cargar el panel analítico."); }
      finally { setLoading(false); }
      return;
    }
    if (page === "models") {
      setLoading(true); setError("");
      try {
        const [models, datasets, experiments] = await Promise.all([
          api("/api/v1/ml/models"), api("/api/v1/ml/datasets"), api("/api/v1/ml/experiments"),
        ]);
        setData((current) => ({ ...current, models, mlDatasets: datasets, mlExperiments: experiments }));
      } catch (e: any) { setError(e.message || "No se pudo cargar el registro de modelos."); }
      finally { setLoading(false); }
      return;
    }
    const endpoints: Record<string, string> = {
      students: "/api/v1/students",
      courses: "/api/v1/courses",
      assessments: "/api/v1/assessments",
      enrollments: "/api/v1/enrollments",
      paths: "/api/v1/learning-paths",
      tracking: "/api/v1/learning-events",
      certificates: "/api/v1/certificates",
      admin: "/api/v1/users",
      audit: "/api/v1/audit-logs",
    };
    if (!endpoints[page]) return;
    setLoading(true);
    setError("");
    try {
      const result = await api(endpoints[page]);
      setData((current) => ({ ...current, [page]: result }));
      if (page === "assessments" || page === "enrollments" || page === "certificates" || page === "tracking") {
        const [students, courses, assessments, results] = await Promise.all([
          api("/api/v1/students"), api("/api/v1/courses"), api("/api/v1/assessments"), api("/api/v1/results"),
        ]);
        setData((current) => ({ ...current, students, courses, assessments, results }));
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

          {page === "dashboard" && <Dashboard data={data.dashboard || {}} setPage={setPage} api={api} refresh={reload} user={user} />}
          {page === "students" && <DataPage title="Estudiantes registrados" subtitle="Directorio académico de la institución." items={asArray(data.students)} kind="students" api={api} refresh={reload} />}
          {page === "courses" && <DataPage title="Catálogo de cursos" subtitle="Oferta académica y contenidos formativos." items={asArray(data.courses)} kind="courses" api={api} refresh={reload} />}
          {page === "assessments" && <DataPage title="Evaluaciones" subtitle="Instrumentos de evaluación asociados a cursos." items={asArray(data.assessments)} kind="assessments" api={api} refresh={reload} courses={asArray(data.courses)} students={asArray(data.students)} results={asArray(data.results)} /> }
          {page === "enrollments" && <EnrollmentPage items={asArray(data.enrollments)} students={asArray(data.students)} courses={asArray(data.courses)} api={api} refresh={reload} />}
          {page === "paths" && <PathsPage items={asArray(data.paths)} api={api} refresh={reload} />}
          {page === "tracking" && <div className="grid2"><InfoPanel icon={<Activity />} title="Registrar actividad" text="Registra eventos académicos vinculados a estudiantes."><EventForm students={asArray(data.students)} api={api} refresh={reload} /></InfoPanel><div className="panel"><div className="panelhead"><div><h3>Historial de actividad</h3><p>Eventos registrados en la institución</p></div><Activity /></div>{asArray(data.tracking).map((x: any) => <div className="auditrow" key={x.id}><Activity /><b>{x.student_name || x.event_type}</b><span>{x.course_title ? `${x.course_title} · ` : ""}{x.event_type} · {x.description}</span><time>{x.occurred_at ? new Date(x.occurred_at).toLocaleString() : ""}</time></div>)}{!asArray(data.tracking).length && <div className="empty">No hay eventos registrados.</div>}</div></div>}
          {page === "analytics" && <Analytics data={data.dashboard || {}} />}
          {page === "models" && <Models items={asArray(data.models)} datasets={asArray(data.mlDatasets)} experiments={asArray(data.mlExperiments)} setPage={setPage} /> }
          {page === "lab" && <MLLab token={token} apiBase={API} />}
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

function Dashboard({ data, setPage, api, refresh, user }: any) {
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState("");
  const stats = [
    { icon: Users, label: "Estudiantes", value: data.students ?? 0, hint: `${data.active_students ?? 0} activos`, page: "students" },
    { icon: BookOpen, label: "Cursos", value: data.courses ?? 0, hint: "En el catálogo", page: "courses" },
    { icon: GraduationCap, label: "Evaluaciones", value: data.assessments ?? 0, hint: "Instrumentos registrados", page: "assessments" },
    { icon: Activity, label: "Matrículas", value: data.enrollments ?? 0, hint: `${data.completed_enrollments ?? 0} completadas`, page: "enrollments" },
  ];
  const recent = Array.isArray(data.recent_activity) ? data.recent_activity : [];
  const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
  const trend = Array.isArray(data.monthly_progress) ? data.monthly_progress : [];
  const mastery = Array.isArray(data.skill_mastery) ? data.skill_mastery : [];
  async function addDemoData() {
    if (!confirm("Se agregarán registros claramente identificados como DEMO: estudiantes, cursos, evaluaciones, matrículas, notas y actividad. No se eliminarán tus registros actuales. ¿Continuar?")) return;
    setSeeding(true); setSeedMessage("");
    try {
      const result = await api("/api/v1/demo/seed", { method: "POST" });
      setSeedMessage(result.message || "Datos de demostración listos.");
      await refresh();
    } catch (e: any) { setSeedMessage(e.message || "No se pudieron agregar los datos demo."); }
    finally { setSeeding(false); }
  }
  return <>
    <section className="welcome">
      <div><div className="welcome-tag"><Sparkles size={14} /> PANEL INSTITUCIONAL</div><h2>Aprende. Practica. Destaca.</h2><p>Indicadores académicos calculados a partir de estudiantes, matrículas, evaluaciones y actividades registradas.</p></div>
      <div className="welcome-art"><div className="art-ring r1" /><div className="art-ring r2" /><BrainCircuit size={70} /><span className="artnode n1" /><span className="artnode n2" /><span className="artnode n3" /></div>
    </section>

    <section className="stats">
      {stats.map(({ icon: Icon, label, value, hint, page }) => <button className="statcard" key={label} onClick={() => setPage(page)}>
        <div className="stathead"><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small>{hint}</small>
      </button>)}
    </section>

    {(Number(data.students || 0) < 10 || Number(data.courses || 0) < 5 || Number(data.graded_results || 0) < 10) && ["institution_admin", "director", "superadmin"].includes(user?.role || "") && <section className="panel demo-seed-panel">
      <div><span className="pill amber">DATOS DE PRUEBA</span><h3>Completa el entorno con registros de demostración</h3><p>Agrega un conjunto relacionado de estudiantes, cursos, matrículas, evaluaciones, notas y actividad para probar las gráficas y módulos. Cada registro está identificado con el prefijo DEMO.</p>{seedMessage && <small className="demo-message">{seedMessage}</small>}</div>
      <button className="primary" onClick={addDemoData} disabled={seeding}>{seeding ? "Agregando datos…" : "Agregar datos de demostración"}</button>
    </section>}

    <section className="reference-grid">
      <div className="panel analytics-panel">
        <div className="panelhead"><div><h3>Evolución del rendimiento académico</h3><p>Promedio mensual real de calificaciones registradas (escala 0–20)</p></div><TrendingUp /></div>
        {trend.length ? <><div className="chart-kpi"><b>{Number(trend[trend.length - 1]?.value || 0).toFixed(1)}/20</b><span>Promedio del último periodo · {trend[trend.length - 1]?.count || 0} notas</span></div><TrendChart rows={trend} /></> : <EmptyChart message="Todavía no hay calificaciones registradas" detail="Usa el botón de datos de demostración o registra evaluaciones y notas para construir la serie." />}
      </div>
      <div className="panel map-panel">
        <div className="panelhead"><div><h3>Mapa de estudiantes</h3><p>Ubicaciones registradas por distrito</p></div><MapPinned /></div>
        <StudentMap points={data.geo_points || []} missing={data.students_without_location || 0} />
      </div>
      <div className="panel mastery-panel">
        <div className="panelhead"><div><h3>Dominio estimado por área formativa</h3><p>Porcentaje calculado desde las notas de cada curso</p></div><Target /></div>
        {mastery.length ? <div className="mastery-list">{mastery.slice(0, 8).map((x: any) => <div className="mastery-row" key={x.name}><span>{x.name}</span><div className="mastery-track"><i style={{ width: `${Math.max(0, Math.min(100, Number(x.value) || 0))}%` }} /></div><b>{Number(x.value).toFixed(0)}%</b></div>)}</div> : <EmptyChart message="Sin notas para estimar el avance" detail="Al registrar resultados, se mostrará el porcentaje por curso. Es un indicador aproximado, no una rúbrica de competencias." />}
        {mastery.length > 0 && <small className="muted">Estimación académica derivada del promedio de notas; no sustituye una evaluación por rúbrica.</small>}
      </div>
      <div className="panel recommendations-panel">
        <div className="panelhead"><div><h3>Recomendaciones</h3><p>Sugerencias registradas para acompañamiento académico</p></div><Sparkles /></div>
        {recommendations.length ? recommendations.slice(0, 5).map((x: any, i: number) => <div className="recommend-row" key={x.id || i}><span className="recommend-icon"><Zap size={15} /></span><div><b>{x.title || x.name || "Recomendación"}</b><small>{x.student_name ? `${x.student_name} · ` : ""}{x.description || x.reason || "Revisar progreso académico"}</small><small className="pill gray">{x.status || "pendiente"}</small></div></div>) : <EmptyChart message="No hay recomendaciones registradas" detail="Se mostrarán aquí las recomendaciones que se creen en el motor académico." />}
      </div>
      <div className="panel activity-panel">
        <div className="panelhead"><div><h3>Actividad reciente</h3><p>Últimos eventos de aprendizaje</p></div><button className="textlink" onClick={() => setPage("tracking")}>Ver seguimiento <ChevronRight size={14} /></button></div>
        {recent.length ? recent.slice(0, 7).map((x: any, i: number) => <div className="activity-row" key={x.id || i}><span className="activity-check"><CheckCircle2 size={15} /></span><div><b>{x.student_name || x.event_type || x.description || "Evento académico"}</b><small>{x.description || x.event_type || "Actividad registrada"}</small></div><time>{x.occurred_at ? new Date(x.occurred_at).toLocaleDateString() : ""}</time></div>) : <EmptyChart message="No hay actividad reciente" detail="Los eventos aparecen luego de registrar actividad en Seguimiento." />}
      </div>
    </section>
    <section className="bottomgrid">
      <div className="panel"><div className="panelhead"><div><h3>Accesos rápidos</h3><p>Operaciones frecuentes</p></div></div><div className="quickgrid">
        {[[Users, "Registrar estudiante", "students"], [BookOpen, "Gestionar cursos", "courses"], [GraduationCap, "Revisar evaluaciones", "assessments"], [BrainCircuit, "Abrir Laboratorio ML", "lab"]].map(([Icon, label, target]: any) => <button className="quick" key={label} onClick={() => setPage(target)}><Icon /><span>{label}</span><ChevronRight /></button>)}
      </div></div>
      <div className="panel"><div className="panelhead"><div><h3>Calidad y uso responsable</h3><p>Lectura de los indicadores</p></div><ShieldCheck /></div>
        <div className="principle"><CheckCircle2 /><span>Las gráficas se calculan desde los registros académicos almacenados.</span></div>
        <div className="principle"><CheckCircle2 /><span>El dominio por área es una aproximación basada en calificaciones.</span></div>
        <div className="principle"><CheckCircle2 /><span>Los registros DEMO se identifican y no deben confundirse con datos reales.</span></div>
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

function DataPage({ title, subtitle, items, kind, api, refresh, courses = [], students = [], results = [] }: any) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<AnyRow>({});
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const courseNames = new Map(courses.map((x: any) => [x.id, x.title]));
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
  return <div className="data-page"><div className="panel tablepanel"><div className="panelhead"><div><h3>{title}</h3><p>{subtitle}</p></div><button className="primary" onClick={() => { setShow(!show); setEditingId(null); setForm({}); }}><Plus size={16} /> Nuevo registro</button></div>
    {show && <form className="inlineform" onSubmit={save}>
      {kind === "students" ? <><input placeholder="Código" required value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /><input placeholder="Nombre completo" required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /><input placeholder="Correo" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input placeholder="Distrito" value={form.district || ""} onChange={(e) => setForm({ ...form, district: e.target.value })} /><input placeholder="Latitud (opcional)" type="number" step="any" value={form.latitude ?? ""} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /><input placeholder="Longitud (opcional)" type="number" step="any" value={form.longitude ?? ""} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></> :
        kind === "courses" ? <><input placeholder="Código" required value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /><input placeholder="Nombre del curso" required value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input placeholder="Nivel" value={form.level || ""} onChange={(e) => setForm({ ...form, level: e.target.value })} /></> :
          <><select required value={form.course_id || ""} onChange={(e) => setForm({ ...form, course_id: e.target.value })}><option value="">Seleccionar curso</option>{courses.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><input placeholder="Título de evaluación" required value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input type="number" placeholder="Puntaje máximo" value={form.max_score || "20"} onChange={(e) => setForm({ ...form, max_score: e.target.value })} /></>}
      <button className="primary" disabled={saving}>{saving ? "Guardando…" : editingId ? "Actualizar" : "Guardar"}</button><button type="button" className="outline" onClick={() => { setShow(false); setEditingId(null); }}>Cancelar</button>
    </form>}
    <div className="tablewrap"><table><thead><tr>{[...(kind === "students" ? ["Código", "Nombre", "Correo", "Distrito", "Estado"] : kind === "courses" ? ["Código", "Curso", "Nivel", "Estado"] : ["Evaluación", "Curso ID", "Puntaje máximo", "Estado"]), "Acciones"].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>
      {items.map((x: any) => <tr key={x.id}>{kind === "students" ? <><td><b>{x.student_code}</b></td><td>{x.full_name}</td><td>{x.email}</td><td>{x.district || "—"}</td><td><span className="pill green">{x.status}</span></td></> : kind === "courses" ? <><td><b>{x.code}</b></td><td>{x.title}</td><td>{x.level}</td><td><span className="pill green">{x.status}</span></td></> : <><td>{x.title}</td><td>{courseNames.get(x.course_id) || x.course_id?.slice(0, 9)}</td><td>{x.max_score}</td><td>{x.status}</td></>}<td><button className="outline small" title="Editar" onClick={() => { setEditingId(x.id); setForm(kind === "students" ? {code:x.student_code,name:x.full_name,email:x.email,district:x.district,latitude:x.latitude,longitude:x.longitude} : kind === "courses" ? {code:x.code,title:x.title,description:x.description,level:x.level} : {course_id:x.course_id,title:x.title,max_score:x.max_score,due_date:x.due_date}); setShow(true); }}><Pencil size={13}/></button> <button className="outline small" title="Eliminar o archivar" onClick={async()=>{if(!confirm("¿Deseas eliminar o archivar este registro?"))return;try{await api(`/api/v1/${kind}/${x.id}`,{method:"DELETE"});await refresh();}catch(e:any){alert(e.message)}}}><Trash2 size={13}/></button></td></tr>)}
    </tbody></table>{!items.length && <div className="empty">Aún no hay registros.</div>}</div>
    </div>
    {kind === "assessments" && <GradeEntry assessments={items} students={students} courses={courses} results={results} api={api} refresh={refresh} />}
  </div>;
}



function GradeEntry({ assessments, students, courses, results, api, refresh }: any) {
  const [assessment, setAssessment] = useState(""); const [student, setStudent] = useState("");
  const [score, setScore] = useState("15"); const [feedback, setFeedback] = useState(""); const [busy, setBusy] = useState(false);
  const studentNames = new Map(students.map((x:any)=>[x.id,x.full_name]));
  const assessmentNames = new Map(assessments.map((x:any)=>[x.id,x.title]));
  const courseNames = new Map(courses.map((x:any)=>[x.id,x.title]));
  async function submit(e:React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api("/api/v1/results", {method:"POST", body:JSON.stringify({assessment_id:assessment,student_id:student,score:Number(score),feedback})}); setFeedback(""); await refresh(); }
    catch(e:any) { alert(e.message); } finally { setBusy(false); }
  }
  return <div className="panel grade-panel"><div className="panelhead"><div><h3>Registro de calificaciones</h3><p>Guarda resultados vinculados a una evaluación y un estudiante.</p></div><GraduationCap/></div>
    <form className="inlineform" onSubmit={submit}><select required value={assessment} onChange={e=>setAssessment(e.target.value)}><option value="">Evaluación</option>{assessments.map((x:any)=><option value={x.id} key={x.id}>{x.title}</option>)}</select><select required value={student} onChange={e=>setStudent(e.target.value)}><option value="">Estudiante</option>{students.map((x:any)=><option value={x.id} key={x.id}>{x.full_name}</option>)}</select><input type="number" min="0" max="20" step="0.1" value={score} onChange={e=>setScore(e.target.value)} required/><input value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Retroalimentación opcional"/><button className="primary" disabled={busy||!assessments.length||!students.length}>{busy?"Guardando…":"Registrar nota"}</button></form>
    <div className="tablewrap"><table><thead><tr><th>Estudiante</th><th>Evaluación</th><th>Curso</th><th>Nota</th><th>Fecha</th></tr></thead><tbody>{results.map((x:any)=><tr key={x.id}><td>{studentNames.get(x.student_id)||x.student_id}</td><td>{assessmentNames.get(x.assessment_id)||x.assessment_id}</td><td>{courseNames.get(assessments.find((a:any)=>a.id===x.assessment_id)?.course_id)||"—"}</td><td><b>{x.score}</b></td><td>{x.graded_at?new Date(x.graded_at).toLocaleDateString():"—"}</td></tr>)}</tbody></table>{!results.length&&<div className="empty">Todavía no hay calificaciones registradas.</div>}</div>
  </div>;
}

function EnrollmentPage({ items, students, courses, api, refresh }: any) {
  const [student, setStudent] = useState(""); const [course, setCourse] = useState(""); const [busy, setBusy] = useState(false);
  const studentNames = new Map(students.map((x:any)=>[x.id,x.full_name])); const courseNames = new Map(courses.map((x:any)=>[x.id,x.title]));
  const completed = items.filter((x:any)=>x.status==="completed").length; const active = items.filter((x:any)=>x.status==="active").length; const withdrawn = items.filter((x:any)=>x.status==="withdrawn").length;
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { await api("/api/v1/enrollments", { method: "POST", body: JSON.stringify({ student_id: student, course_id: course }) }); setStudent(""); setCourse(""); await refresh(); } catch (e: any) { alert(e.message); } finally { setBusy(false); } }
  return <div className="panel"><div className="panelhead"><div><h3>Matrículas académicas</h3><p>Asocia estudiantes con cursos y controla el avance de cada inscripción.</p></div><GraduationCap /></div>
    <div className="stats enrollment-stats"><Stat label="Total" value={items.length} hint="Matrículas"/><Stat label="Activas" value={active} hint="En progreso"/><Stat label="Completadas" value={completed} hint="Con opción a certificado"/><Stat label="Retiradas" value={withdrawn} hint="No continúan"/></div>
    <form className="inlineform" onSubmit={save}><select required value={student} onChange={e=>setStudent(e.target.value)}><option value="">Seleccionar estudiante</option>{students.map((x:any)=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select><select required value={course} onChange={e=>setCourse(e.target.value)}><option value="">Seleccionar curso</option>{courses.map((x:any)=><option key={x.id} value={x.id}>{x.title}</option>)}</select><button className="primary" disabled={busy || !students.length || !courses.length}>{busy?"Guardando…":"Registrar matrícula"}</button></form>
    <div className="tablewrap"><table><thead><tr><th>Estudiante</th><th>Curso</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>{items.map((x:any)=><tr key={x.id}><td>{studentNames.get(x.student_id)||x.student_id}</td><td>{courseNames.get(x.course_id)||x.course_id}</td><td><select value={x.status} onChange={async(e)=>{try{await api(`/api/v1/enrollments/${x.id}/status?status_value=${e.target.value}`,{method:"PATCH"});await refresh();}catch(err:any){alert(err.message)}}}><option value="active">Activa</option><option value="completed">Completada</option><option value="withdrawn">Retirada</option></select></td><td>{x.enrolled_at?new Date(x.enrolled_at).toLocaleDateString():"—"}</td></tr>)}</tbody></table>{!items.length&&<div className="empty">Todavía no hay matrículas.</div>}</div>
  </div>;
}

function PathsPage({ items, api, refresh }: any) {
  const [title,setTitle]=useState(""); const [description,setDescription]=useState(""); const [level,setLevel]=useState("General");
  async function save(e:React.FormEvent){e.preventDefault();try{await api("/api/v1/learning-paths",{method:"POST",body:JSON.stringify({title,description,level,status:"published"})});setTitle("");setDescription("");await refresh();}catch(e:any){alert(e.message)}}
  return <div className="panel"><div className="panelhead"><div><h3>Rutas de aprendizaje</h3><p>Define itinerarios y niveles formativos.</p></div><Layers3/></div><form className="inlineform" onSubmit={save}><input required placeholder="Nombre de la ruta" value={title} onChange={e=>setTitle(e.target.value)}/><input placeholder="Descripción" value={description} onChange={e=>setDescription(e.target.value)}/><select value={level} onChange={e=>setLevel(e.target.value)}><option>Inicial</option><option>General</option><option>Intermedio</option><option>Avanzado</option></select><button className="primary">Crear ruta</button></form>{items.map((x:any)=><div className="modelitem" key={x.id}><div className="modelicon"><BookOpen/></div><div><b>{x.title}</b><small>{x.description}</small><small>{x.level} · {x.status}</small></div></div>)}{!items.length&&<div className="empty">No hay rutas formativas creadas.</div>}</div>;
}
function CertificatesPage({items,students,courses,api,refresh}:any){
  const [student,setStudent]=useState(""); const [course,setCourse]=useState("");
  const studentNames=new Map(students.map((x:any)=>[x.id,x.full_name])); const courseNames=new Map(courses.map((x:any)=>[x.id,x.title]));
  async function issue(e:React.FormEvent){e.preventDefault();try{const x=await api("/api/v1/certificates",{method:"POST",body:JSON.stringify({student_id:student,course_id:course})});alert(`Certificado emitido: ${x.certificate_code}`);await refresh();}catch(e:any){alert(e.message)}}
  return <div className="panel"><div className="panelhead"><div><h3>Emisión y verificación de certificados</h3><p>Solo se emiten para matrículas marcadas como completadas.</p></div><Award/></div>
    <div className="stats"><Stat label="Certificados emitidos" value={items.length} hint="Registros institucionales"/><Stat label="Estudiantes" value={students.length} hint="Directorio disponible"/><Stat label="Cursos" value={courses.length} hint="Catálogo disponible"/></div>
    <form className="inlineform" onSubmit={issue}><select required value={student} onChange={e=>setStudent(e.target.value)}><option value="">Estudiante</option>{students.map((x:any)=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select><select required value={course} onChange={e=>setCourse(e.target.value)}><option value="">Curso</option>{courses.map((x:any)=><option key={x.id} value={x.id}>{x.title}</option>)}</select><button className="primary">Emitir certificado</button></form>
    {items.map((x:any)=><div className="auditrow" key={x.id}><Award/><b>{x.certificate_code}</b><span>{studentNames.get(x.student_id)||x.student_id}</span><span>{courseNames.get(x.course_id)||x.course_id}</span><small>{x.issued_at?new Date(x.issued_at).toLocaleDateString():""}</small></div>)}{!items.length&&<div className="empty">No se han emitido certificados.</div>}
  </div>;
}

function AdminPage({items,user,orgName,api,refresh}:any){const [name,setName]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [role,setRole]=useState("teacher");async function create(e:React.FormEvent){e.preventDefault();try{await api("/api/v1/users",{method:"POST",body:JSON.stringify({full_name:name,email,password,role})});setName("");setEmail("");setPassword("");await refresh();}catch(e:any){alert(e.message)}}return <div className="grid2"><div className="panel"><div className="panelhead"><div><h3>Usuarios y roles</h3><p>Administración de accesos institucionales.</p></div><ShieldCheck/></div><form className="eventform" onSubmit={create}><label>Nombre completo</label><input required value={name} onChange={e=>setName(e.target.value)}/><label>Correo institucional</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/><label>Contraseña temporal (12 caracteres mínimo)</label><input required minLength={12} type="password" value={password} onChange={e=>setPassword(e.target.value)}/><label>Rol</label><select value={role} onChange={e=>setRole(e.target.value)}><option value="teacher">Docente</option><option value="student">Estudiante</option><option value="analyst">Analista</option><option value="director">Director</option><option value="institution_admin">Administrador</option></select><button className="primary">Crear usuario</button></form></div><div className="panel"><h3>Entorno institucional</h3><div className="quality"><span>Institución</span><b>{orgName}</b></div><div className="quality"><span>Usuario actual</span><b>{user?.full_name}</b></div><div className="quality"><span>Rol</span><b>{user?.role}</b></div><div className="quality"><span>Usuarios registrados</span><b>{items.length}</b></div></div><div className="panel span2"><h3>Directorio de usuarios</h3>{items.map((x:any)=><div className="auditrow" key={x.id}><Users/><b>{x.full_name}</b><span>{x.email}</span><span>{x.role}</span><span className={`pill ${x.is_active?"green":"gray"}`}>{x.is_active?"Activo":"Inactivo"}</span></div>)}{!items.length&&<div className="empty">No hay usuarios registrados.</div>}</div></div>}

function EventForm({ students, api, refresh }: any) {
  const [student, setStudent] = useState(""); const [type, setType] = useState("lesson_viewed"); const [desc, setDesc] = useState("");
  async function send(e: React.FormEvent) { e.preventDefault(); try { await api("/api/v1/learning-events", { method: "POST", body: JSON.stringify({ student_id: student, event_type: type, description: desc }) }); alert("Evento registrado correctamente."); setDesc(""); await refresh(); } catch (e: any) { alert(e.message); } }
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
  const progress = Array.isArray(data.monthly_progress) ? data.monthly_progress : [];
  const performance = Array.isArray(data.course_performance) ? data.course_performance : [];
  const mastery = Array.isArray(data.skill_mastery) ? data.skill_mastery : [];
  return <div className="analytics-page">
    <div className="stats"><Stat label="Estudiantes" value={data.students ?? 0} hint={`${data.active_students ?? 0} activos`} /><Stat label="Cursos" value={data.courses ?? 0} hint="En catálogo" /><Stat label="Matrículas" value={data.enrollments ?? 0} hint={`${data.completed_enrollments ?? 0} completadas`} /><Stat label="Notas registradas" value={data.graded_results ?? 0} hint={`${data.learning_events ?? 0} eventos`} /></div>
    <div className="grid2"><div className="panel"><div className="panelhead"><div><h3>Evolución mensual del promedio</h3><p>Promedio real de calificaciones registradas, de 0 a 20</p></div><TrendingUp /></div>{progress.length ? <TrendChart rows={progress} /> : <EmptyChart message="Sin resultados evaluados" detail="Agrega calificaciones para construir la serie mensual." />}</div>
    <div className="panel"><div className="panelhead"><div><h3>Desempeño por curso</h3><p>Promedio de notas y cantidad de resultados</p></div><Target /></div>{performance.length ? <div className="mastery-list">{performance.map((x:any)=><div className="mastery-row" key={x.name}><span>{x.name}</span><div className="mastery-track"><i style={{width:`${Math.max(0,Math.min(100,Number(x.value)*5))}%`}}/></div><b>{Number(x.value).toFixed(1)}/20</b></div>)}</div> : <EmptyChart message="Sin notas por curso" detail="Los resultados aparecerán cuando se registren evaluaciones calificadas." />}</div></div>
    <div className="panel"><div className="panelhead"><div><h3>Avance estimado por área formativa</h3><p>Conversión del promedio de notas a escala porcentual para comparar cursos.</p></div><Target /></div>{mastery.length ? <div className="mastery-list">{mastery.map((x:any)=><div className="mastery-row" key={x.name}><span>{x.name}</span><div className="mastery-track"><i style={{width:`${Math.max(0,Math.min(100,Number(x.value)||0))}%`}}/></div><b>{Number(x.value).toFixed(0)}%</b></div>)}</div> : <EmptyChart message="No hay información suficiente" detail="Se requiere al menos una nota por curso." />}</div>
    <div className="panel"><h3>Calidad y gobierno de datos</h3><p className="muted">Indicadores calculados con registros persistidos en la base institucional.</p><div className="quality"><span>Estudiantes con ubicación</span><b>{data.students_with_location ?? 0} / {data.students ?? 0}</b></div><div className="quality"><span>Matrículas completadas</span><b>{data.completed_enrollments ?? 0} / {data.enrollments ?? 0}</b></div><div className="quality"><span>Resultados de evaluación</span><b>{data.graded_results ?? 0}</b></div><div className="quality"><span>Eventos de aprendizaje</span><b>{data.learning_events ?? 0}</b></div><div className="quality"><span>Origen</span><b>{data.data_quality?.note || "Datos académicos registrados"}</b></div></div>
  </div>;
}

function Models({ items, datasets, experiments, setPage }: any) {
  return <div className="models-workspace">
    <div className="stats"><Stat label="Datasets cargados" value={datasets.length} hint="CSV registrados"/><Stat label="Experimentos" value={experiments.length} hint="Entrenamientos guardados"/><Stat label="Modelos institucionales" value={items.length} hint="Versiones registradas"/><Stat label="Último accuracy" value={experiments.length?`${(Number(experiments[0].accuracy)*100).toFixed(1)}%`:"—"} hint="Experimento más reciente"/></div>
    <div className="grid2"><div className="panel"><div className="panelhead"><div><h3>Registro de modelos institucionales</h3><p>Versiones y estado de aprobación.</p></div><BrainCircuit/></div>{items.map((x:any)=><div className="modelitem" key={x.id}><div className="modelicon"><Network/></div><div><b>{x.name}</b><small>Versión {x.version} · {x.stage}</small><small>{x.description}</small></div><span className="pill amber">{x.approval_status}</span></div>)}{!items.length&&<div className="empty">No hay versiones institucionales registradas. Los experimentos del laboratorio se muestran por separado.</div>}</div>
      <div className="panel"><div className="panelhead"><div><h3>Datasets cargados</h3><p>Archivos CSV listos para explorarse y entrenarse.</p></div><Database/></div>{datasets.map((x:any)=><div className="modelitem" key={x.id}><div className="modelicon"><Database/></div><div><b>{x.filename}</b><small>{x.rows} filas · {x.columns?.length||0} columnas · {x.missing||0} faltantes</small><small>{x.columns?.join(", ")}</small></div><span className="pill green">Cargado</span></div>)}{!datasets.length&&<div className="empty">No hay datasets cargados todavía.</div>}<button className="primary full" onClick={()=>setPage("lab")}>Abrir Laboratorio ML</button></div>
    </div>
    <div className="panel"><div className="panelhead"><div><h3>Experimentos de redes neuronales</h3><p>Resultados generados en Laboratorio ML y asociados con su dataset.</p></div><Activity/></div>{experiments.map((x:any)=><div className="experiment-row" key={x.id}><BrainCircuit/><span><b>{x.dataset_name}</b><small>Objetivo: {x.target} · MLP {(x.architecture||[]).join("–")} · {x.epochs_completed} iteraciones · F1 {Number(x.f1_weighted).toFixed(3)}</small></span><strong>{(Number(x.accuracy)*100).toFixed(1)}%</strong><small>{new Date(x.created_at).toLocaleDateString()}</small></div>)}{!experiments.length&&<div className="empty">Cuando entrenes un modelo, sus métricas aparecerán aquí.</div>}</div>
    <div className="panel"><h3>Flujo de control del modelo</h3>{["Dataset cargado y revisado", "Preprocesamiento reproducible", "Entrenamiento MLP con scikit-learn", "Evaluación con conjunto de prueba", "Revisión humana y aprobación institucional", "Monitoreo antes de uso productivo"].map((x,i)=><div className="flowstep" key={x}><span>{i+1}</span>{x}</div>)}</div>
  </div>;
}

function NetworkDiagram({ inputCount, hiddenLayers, outputCount, inputLabel = "Características", outputLabel = "Clases" }: any) {
  const safeHidden = (Array.isArray(hiddenLayers) ? hiddenLayers : []).map((x: any) => Math.max(2, Math.min(12, Number(x) || 2)));
  const sizes = [Math.max(1, Math.min(8, Number(inputCount) || 1)), ...safeHidden.map((x:number)=>Math.min(8,x)), Math.max(1, Math.min(8, Number(outputCount) || 1))];
  const names = [inputLabel, ...safeHidden.map((_:number,i:number)=>`Capa oculta ${i+1}`), outputLabel];
  const xs = sizes.map((_:number,i:number)=>70+i*(760/Math.max(1,sizes.length-1)));
  const nodes = sizes.map((n:number,li:number)=>Array.from({length:n},(_:any,ni:number)=>({x:xs[li],y:28+(ni+1)*(204/(n+1))})));
  return <div className="network-preview">
    <div className="network-preview-head"><b>Arquitectura MLP vinculada al experimento</b><span>{Number(inputCount)||0} entradas · {safeHidden.join("–") || "sin capas"} · {Number(outputCount)||0} salidas</span></div>
    <svg viewBox="0 0 900 260" role="img" aria-label="Diagrama de la arquitectura de red neuronal">
      {nodes.slice(1).map((layer:any[],li:number)=>layer.map((node:any,ni:number)=>nodes[li].map((prev:any,pi:number)=><line key={`${li}-${ni}-${pi}`} x1={prev.x+11} y1={prev.y} x2={node.x-11} y2={node.y} className="network-edge"/>)))}
      {nodes.map((layer:any[],li:number)=>layer.map((node:any,ni:number)=><g key={`${li}-${ni}`}><circle cx={node.x} cy={node.y} r="10" className={`network-node node-${li}`} /><title>{names[li]} · neurona {ni+1}</title></g>))}
      {names.map((name:string,i:number)=><text key={name} x={xs[i]} y="250" textAnchor="middle" className="network-layer-label">{name}</text>)}
    </svg>
    <p className="muted">El diagrama refleja los atributos, capas ocultas y clases del dataset/experimento seleccionado. No es una red conceptual independiente.</p>
  </div>;
}

function LossChart({ values }: { values: number[] }) {
  const clean = (values || []).map(Number).filter(Number.isFinite);
  if (clean.length < 2) return <EmptyChart message="Curva de pérdida no disponible" detail="El entrenamiento debe devolver al menos dos valores de pérdida." />;
  const min = Math.min(...clean), max = Math.max(...clean), span = Math.max(0.000001, max-min);
  const pts = clean.map((v,i)=>`${8+i*84/(clean.length-1)},${88-((v-min)/span)*68}`).join(" ");
  return <div className="loss-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={pts} fill="none" className="loss-line" vectorEffect="non-scaling-stroke" />{clean.map((v,i)=><circle key={i} cx={8+i*84/(clean.length-1)} cy={88-((v-min)/span)*68} r="1.3" className="loss-dot"><title>Iteración {i+1}: {v.toFixed(4)}</title></circle>)}</svg><div className="loss-labels"><span>Pérdida inicial: {clean[0].toFixed(4)}</span><span>Final: {clean[clean.length-1].toFixed(4)}</span></div></div>;
}

function MLLab({ token, apiBase }: any) {
  const [datasets, setDatasets] = useState<AnyRow[]>([]);
  const [experiments, setExperiments] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState(""); const [target, setTarget] = useState(""); const [layers, setLayers] = useState("64,32");
  const [activation, setActivation] = useState("relu"); const [epochs, setEpochs] = useState("150");
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<any>(null); const [message, setMessage] = useState("");
  const headers = { Authorization: `Bearer ${token}` };
  async function refresh() {
    const [d, e] = await Promise.all([fetch(`${apiBase}/api/v1/ml/datasets`, { headers }), fetch(`${apiBase}/api/v1/ml/experiments`, { headers })]);
    if (!d.ok) throw new Error("No se pudieron consultar los datasets.");
    if (!e.ok) throw new Error("No se pudo consultar el historial de experimentos.");
    const rows = await d.json(); const history = await e.json();
    setDatasets(rows); setExperiments(history);
    if (rows[0] && !selected) { setSelected(rows[0].id); setTarget(rows[0].columns?.[rows[0].columns.length - 1] || ""); }
    return { datasets: rows, experiments: history };
  }
  useEffect(() => { refresh().catch((e) => setMessage(e.message)); }, []);
  async function uploadFile(file: File) {
    setBusy(true); setMessage("");
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch(`${apiBase}/api/v1/ml/datasets`, { method: "POST", headers, body: fd });
      const j = await r.json(); if (!r.ok) throw new Error(j.detail || "Error al cargar CSV");
      setMessage(`Dataset cargado correctamente: ${j.rows} filas, ${j.columns.length} columnas y ${j.missing} valores faltantes.`);
      await refresh(); setSelected(j.id); setTarget(j.columns[j.columns.length - 1]); setResult(null);
    } catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (file) await uploadFile(file); e.target.value = ""; }
  async function loadExample() {
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/dataset_estudiantes_demo.csv");
      if (!r.ok) throw new Error("No se encontró el CSV de ejemplo en el frontend. Vuelve a desplegar el proyecto actualizado.");
      const file = new File([await r.blob()], "dataset_estudiantes_demo.csv", { type: "text/csv" });
      await uploadFile(file);
    } catch (e:any) { setMessage(e.message); setBusy(false); }
  }
  async function train() {
    if (!selected || !target || !/^\d+(,\d+)*$/.test(layers.replace(/\s/g,""))) { setMessage("Selecciona dataset, objetivo y capas válidas (ejemplo: 64,32)."); return; }
    const layerValues=layers.split(",").map((x:string)=>Number(x.trim()));
    if (layerValues.some((x:number)=>x<2||x>512)||layerValues.length>4) { setMessage("Cada capa debe tener entre 2 y 512 neuronas (máximo 4 capas)."); return; }
    if (Number(epochs)<30||Number(epochs)>1000) { setMessage("Las épocas deben estar entre 30 y 1000."); return; }
    setBusy(true); setMessage("Entrenando el perceptrón multicapa en el backend…"); setResult(null);
    try {
      const fd = new FormData(); fd.append("dataset_id", selected); fd.append("target", target); fd.append("hidden_layers", layers.replace(/\s/g,"")); fd.append("activation", activation); fd.append("max_iter", epochs); fd.append("test_size", "0.2");
      const r = await fetch(`${apiBase}/api/v1/ml/train`, { method: "POST", headers, body: fd }); const j = await r.json();
      if (!r.ok) throw new Error(j.detail || "No se pudo entrenar");
      setResult(j); setMessage("Entrenamiento completado. Se guardó el experimento; el modelo sigue en estado experimental, sin aprobación institucional.");
      await refresh();
    } catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  const dataset = datasets.find((x) => x.id === selected);
  const profile = dataset?.profiles || {};
  const targetProfile = profile[target] || {};
  const featureCount = Math.max(0, (dataset?.columns?.length || 0) - 1);
  const targetClassCount = Number(targetProfile.unique_count || 0);
  const currentLayers = layers.split(",").map((x:string)=>Number(x.trim())).filter((x:number)=>Number.isFinite(x)&&x>0);
  const previewRows = Array.isArray(dataset?.sample) ? dataset.sample : [];
  function showExperiment(x:any) { setResult(x); setSelected(x.dataset_id); setTarget(x.target); setLayers((x.architecture||[64,32]).join(",")); setActivation(x.activation||"relu"); setMessage(`Visualizando experimento guardado ${String(x.id).slice(0,8)}.`); }
  return <div className="ml-lab">
    <div className="ml-intro panel"><div><span className="pill green">LABORATORIO DE APRENDIZAJE AUTOMÁTICO</span><h2>Entrena, evalúa y compara redes neuronales</h2><p>El flujo usa tu CSV, entrena un MLP real en el backend y conecta su arquitectura con las métricas del experimento.</p></div><div className="ml-intro-icon"><BrainCircuit size={42}/></div></div>
    <div className="grid2">
      <div className="panel"><div className="panelhead"><div><h3>1. Dataset y exploración</h3><p>CSV supervisado · límite 10 MB · mínimo 20 filas</p></div><Database/></div>
        <label className="uploadbox"><input type="file" accept=".csv,text/csv" onChange={upload} disabled={busy}/><b>Seleccionar archivo CSV</b><small>Sube tus propios datos o utiliza el dataset de práctica incluido.</small></label>
        <button className="outline full" disabled={busy} onClick={loadExample}>Cargar dataset de ejemplo (180 registros)</button>
        <div className="dataset-list">{datasets.map((d:any)=><button key={d.id} className={`datasetrow ${selected===d.id?"selected":""}`} onClick={()=>{setSelected(d.id);setTarget(d.columns?.[d.columns.length-1]||"");setResult(null);}}><Database size={17}/><span><b>{d.filename}</b><small>{d.rows} filas · {d.columns?.length} columnas · {d.missing} faltantes</small></span><span className="pill gray">{selected===d.id?"Seleccionado":"Abrir"}</span></button>)}</div>
        {!datasets.length&&<div className="empty">No hay datasets cargados. Carga el archivo de ejemplo para probar el flujo completo.</div>}
      </div>
      <div className="panel"><div className="panelhead"><div><h3>2. Preparación y parámetros</h3><p>Clasificación supervisada con MLPClassifier</p></div><Settings/></div>
        <label>Dataset de trabajo</label><select value={selected} onChange={e=>{setSelected(e.target.value);const d=datasets.find((x:any)=>x.id===e.target.value);setTarget(d?.columns?.[d.columns.length-1]||"");setResult(null);}}><option value="">Selecciona un dataset</option>{datasets.map((d:any)=><option value={d.id} key={d.id}>{d.filename}</option>)}</select>
        <label>Variable objetivo (clase a predecir)</label><select value={target} onChange={e=>setTarget(e.target.value)} disabled={!dataset}>{(dataset?.columns||[]).map((c:string)=><option key={c} value={c}>{c}</option>)}</select>
        {dataset&&<div className="dataset-facts"><div><b>{dataset.rows}</b><span>Filas</span></div><div><b>{dataset.columns?.length||0}</b><span>Columnas</span></div><div><b>{dataset.missing||0}</b><span>Faltantes</span></div><div><b>{targetClassCount||"—"}</b><span>Clases del objetivo</span></div></div>}
        <label>Capas ocultas (neuronas por capa)</label><input value={layers} onChange={e=>setLayers(e.target.value)} placeholder="64,32"/>
        <div className="form-hint">Ejemplo: 64,32 significa dos capas ocultas; cada número representa neuronas.</div>
        <div className="grid2 compact-grid"><div><label>Activación</label><select value={activation} onChange={e=>setActivation(e.target.value)}><option value="relu">ReLU</option><option value="tanh">Tanh</option><option value="logistic">Sigmoide</option></select></div><div><label>Épocas máximas</label><input type="number" min="30" max="1000" value={epochs} onChange={e=>setEpochs(e.target.value)}/></div></div>
        <button className="primary full" disabled={busy||!dataset||!target} onClick={train}>{busy?"Procesando…":"Entrenar red neuronal"}</button>
        <div className="notice-note">El backend divide los datos en 80% entrenamiento y 20% prueba, imputa faltantes, escala variables numéricas y codifica categorías.</div>
      </div>
    </div>
    <div className="panel"><div className="panelhead"><div><h3>3. Arquitectura de red neuronal</h3><p>Diagrama que cambia con el dataset y las capas configuradas.</p></div><Network/></div>
      <NetworkDiagram inputCount={result?.features?.length ?? featureCount} hiddenLayers={result?.architecture ?? currentLayers} outputCount={result?.classes?.length ?? targetClassCount} inputLabel={`Entradas (${result?.features?.length ?? featureCount})`} outputLabel={`Salidas (${(result?.classes?.length ?? targetClassCount) || "?"})`}/>
      <div className="architecture-legend"><span>Entrada: columnas predictoras</span><span>Ocultas: neuronas configuradas</span><span>Salida: categorías objetivo</span><span>Activación: {result?.activation || activation}</span></div>
    </div>
    {message&&<div className="panel ml-message"><p>{message}</p></div>}
    {dataset&&<div className="panel"><div className="panelhead"><div><h3>4. Vista previa y calidad del dataset</h3><p>Primeros registros del archivo seleccionado</p></div><Database/></div>
      <div className="dataset-facts"><div><b>{dataset.rows}</b><span>Registros totales</span></div><div><b>{featureCount}</b><span>Características posibles</span></div><div><b>{dataset.missing||0}</b><span>Valores vacíos</span></div><div><b>{dataset.uploaded_at?new Date(dataset.uploaded_at).toLocaleDateString():"—"}</b><span>Fecha de carga</span></div></div>
      {Object.keys(profile).length>0&&<div className="profile-grid">{Object.entries(profile).map(([name,p]:any)=><div className="profile-chip" key={name}><b>{name}</b><span>{p.dtype} · {p.unique_count} valores únicos · {p.missing} vacíos</span></div>)}</div>}
      {previewRows.length>0&&<div className="tablewrap"><table><thead><tr>{dataset.columns.slice(0,7).map((c:string)=><th key={c}>{c}</th>)}</tr></thead><tbody>{previewRows.slice(0,8).map((row:any,i:number)=><tr key={i}>{dataset.columns.slice(0,7).map((c:string)=><td key={c}>{row[c]===null||row[c]===undefined?"—":String(row[c]).slice(0,40)}</td>)}</tr>)}</tbody></table></div>}
    </div>}
    {result&&<div className="ml-results">
      <div className="panel"><div className="panelhead"><div><h3>5. Resultado del entrenamiento</h3><p>Experimento {String(result.id).slice(0,12)} · evaluación holdout 80/20</p></div><span className="pill amber">Experimental / no aprobado</span></div>
        <div className="stats ml-stats"><Stat label="Accuracy" value={`${(Number(result.accuracy)*100).toFixed(1)}%`} hint="Exactitud en prueba"/><Stat label="Precisión ponderada" value={Number(result.precision_weighted).toFixed(3)} hint="Promedio ponderado"/><Stat label="Recall ponderado" value={Number(result.recall_weighted).toFixed(3)} hint="Cobertura de clases"/><Stat label="F1 ponderado" value={Number(result.f1_weighted).toFixed(3)} hint="Balance precisión/recall"/></div>
        <div className="quality"><span>Filas usadas / entrenamiento / prueba</span><b>{result.rows_used} / {result.train_rows} / {result.test_rows}</b></div><div className="quality"><span>Épocas ejecutadas</span><b>{result.epochs_completed} de {result.max_epochs}</b></div><div className="quality"><span>Función de activación</span><b>{result.activation}</b></div><div className="quality"><span>Características</span><b>{(result.features||[]).join(", ")}</b></div><div className="quality"><span>Clases</span><b>{(result.classes||[]).join(", ")}</b></div>
      </div>
      <div className="grid2"><div className="panel"><div className="panelhead"><div><h3>Curva de pérdida</h3><p>Evolución del error durante las iteraciones del entrenamiento</p></div><TrendingUp/></div><LossChart values={result.loss_curve||[]}/></div>
        <div className="panel"><div className="panelhead"><div><h3>Matriz de confusión</h3><p>Filas = clase real · columnas = predicción</p></div><Target/></div>
          <div className="tablewrap confusion-wrap"><table><thead><tr><th>Real / Pred.</th>{(result.classes||[]).map((c:string)=><th key={c}>{c}</th>)}</tr></thead><tbody>{(result.confusion_matrix||[]).map((row:number[],i:number)=><tr key={i}><th>{result.classes?.[i]||i}</th>{row.map((v:number,j:number)=><td key={j} className={i===j?"confusion-correct":""}>{v}</td>)}</tr>)}</tbody></table></div>
        </div></div>
      <div className="panel"><div className="panelhead"><div><h3>Arquitectura utilizada en este entrenamiento</h3><p>{(result.features||[]).length} entradas → {(result.architecture||[]).join(" → ")} → {(result.classes||[]).length} salidas</p></div><BrainCircuit/></div><NetworkDiagram inputCount={result.features?.length||0} hiddenLayers={result.architecture||[]} outputCount={result.classes?.length||0} inputLabel={`Entradas (${result.features?.length||0})`} outputLabel={`Clases (${result.classes?.length||0})`}/><div className="notice-note">La red corresponde al modelo MLPClassifier de scikit-learn efectivamente entrenado. Las métricas no implican aprobación para decisiones académicas automáticas.</div></div>
    </div>}
    <div className="panel"><div className="panelhead"><div><h3>6. Historial de experimentos</h3><p>Selecciona un entrenamiento para volver a consultar sus métricas y arquitectura.</p></div><Clock3/></div>
      {experiments.map((x:any)=><button className={`experiment-row ${result?.id===x.id?"selected":""}`} key={x.id} onClick={()=>showExperiment(x)}><BrainCircuit/><span><b>{x.dataset_name}</b><small>Objetivo: {x.target} · {(x.architecture||[]).join("–")} · {x.epochs_completed} iteraciones</small></span><strong>{(Number(x.accuracy)*100).toFixed(1)}%</strong><small>{new Date(x.created_at).toLocaleString()}</small></button>)}
      {!experiments.length&&<div className="empty">Todavía no hay entrenamientos. Carga el CSV de ejemplo y ejecuta el entrenamiento para generar el primer experimento.</div>}
    </div>
  </div>;
}

function Audit({ items }: any) {
  return <div className="panel"><div className="panelhead"><div><h3>Bitácora de auditoría</h3><p>Últimas operaciones registradas</p></div><ShieldCheck /></div>{items.map((x: any) => <div className="auditrow" key={x.id}><Clock3 /><b>{x.action}</b><span>{x.resource}</span><small>{x.actor_email}</small><time>{x.occurred_at ? new Date(x.occurred_at).toLocaleString() : ""}</time></div>)}{!items.length && <div className="empty">Todavía no hay operaciones registradas.</div>}</div>;
}

export default App;
