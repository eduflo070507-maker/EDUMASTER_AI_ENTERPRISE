
import { useEffect, useState } from 'react';
import {
  Activity, BookOpen, BrainCircuit, Users, GraduationCap,
  ChartNoAxesCombined, Settings, ShieldCheck, Award, Bell,
  Search, LogOut, Menu, Network, Database, Sparkles,
  ChevronRight, Plus, RefreshCw, Layers3, Clock3,
  CheckCircle2, AlertTriangle
} from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

type Item = {
  id: string;
  [key: string]: any;
};

const nav = [
  ['Resumen', 'dashboard', ChartNoAxesCombined],
  ['Estudiantes', 'students', Users],
  ['Cursos', 'courses', BookOpen],
  ['Evaluaciones', 'assessments', GraduationCap],
  ['Seguimiento', 'tracking', Activity],
  ['Analítica', 'analytics', ChartNoAxesCombined],
  ['Arquitectura IA', 'neural', BrainCircuit],
  ['Dataset y modelos', 'models', Database],
  ['Laboratorio ML', 'lab', BrainCircuit],
  ['Recomendaciones', 'recommendations', Sparkles],
  ['Certificaciones', 'certificates', Award],
  ['Auditoría', 'audit', ShieldCheck],
  ['Administración', 'admin', Settings]
] as const;

const heads = [
  {
    id: 'A', name: 'Finalización de cursos', short: 'Completion',
    desc: 'Estima probabilidad de completar un curso.',
    out: 'Probabilidad de finalización', color: '#31c7ff',
    inputs: ['completion_ratio', 'assessment_mean', 'active_days_14d'],
    hidden: [8, 5], output: 1
  },
  {
    id: 'B', name: 'Dominio de habilidades', short: 'Skill mastery',
    desc: 'Estima el nivel de dominio sustentado por evidencias.',
    out: 'Nivel ordinal de competencia', color: '#a78bfa',
    inputs: ['skill_evidence_score', 'assessment_trend', 'course_level'],
    hidden: [10, 6], output: 3
  },
  {
    id: 'C', name: 'Riesgo de desconexión', short: 'Disengagement',
    desc: 'Detecta señales para ofrecer acompañamiento humano.',
    out: 'Señal de apoyo', color: '#f6b94b',
    inputs: ['days_since_last_activity', 'active_days_14d', 'late_submissions_30d'],
    hidden: [12, 6], output: 1
  },
  {
    id: 'D', name: 'Recomendación de aprendizaje', short: 'Recommendation',
    desc: 'Ordena recursos y actividades según brechas y objetivos.',
    out: 'Ranking de recursos', color: '#42dfb1',
    inputs: ['skill_gap', 'course_goal', 'recommendation_feedback'],
    hidden: [10, 5], output: 5
  },
  {
    id: 'E', name: 'Participación educativa', short: 'Engagement',
    desc: 'Analiza patrones de interacción con actividades y contenidos.',
    out: 'Índice de participación', color: '#fb8acb',
    inputs: ['sessions_14d', 'active_days_14d', 'content_events'],
    hidden: [8, 4], output: 1
  },
  {
    id: 'F', name: 'Red neuronal multitarea', short: 'Multi-task',
    desc: 'Comparte una representación interna para varias tareas.',
    out: 'Finalización, dominio, apoyo y ranking',
    color: '#f5a65b',
    inputs: ['features_tabulares', 'secuencia_temporal'],
    hidden: [16, 12, 8], output: 4
  }
];

function App() {
  const [token, setToken] = useState(localStorage.getItem('em_token') || '');
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState('dashboard');
  const [data, setData] = useState<any>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobile, setMobile] = useState(false);

  const api = async (path: string, opts: any = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {})
      }
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(
        typeof result.detail === 'string'
          ? result.detail
          : `Error ${response.status}: ${response.statusText}`
      );
    }

    if (response.status === 204) return null;
    return response.json();
  };

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    api('/api/v1/auth/me')
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('em_token');
        setToken('');
        setUser(null);
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError('');

    const paths: Record<string, string> = {
      dashboard: '/api/v1/dashboard/summary',
      students: '/api/v1/students',
      courses: '/api/v1/courses',
      assessments: '/api/v1/assessments',
      recommendations: '/api/v1/recommendations',
      models: '/api/v1/ml/models',
      audit: '/api/v1/audit-logs'
    };

    if (paths[page]) {
      api(paths[page])
        .then((value: any) => {
          setData((previous: any) => ({
            ...previous,
            [page]: value
          }));
        })
        .catch((e: any) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [page, token]);

  const logout = () => {
    localStorage.removeItem('em_token');
    setToken('');
    setUser(null);
  };

  if (!token) {
    return (
      <Login
        onLogin={(newToken: string, newUser: User) => {
          localStorage.setItem('em_token', newToken);
          setToken(newToken);
          setUser(newUser);
        }}
      />
    );
  }

  return (
    <div className="app">
      <aside className={`sidebar ${mobile ? 'show' : ''}`}>
        <div className="brand">
          <div className="brandmark"><BrainCircuit /></div>
          <div>
            <b>EduMaster<span>.ai</span></b>
            <small>ENTERPRISE LEARNING</small>
          </div>
        </div>

        <div className="org">
          <span className="live-dot" /> INSTITUCIÓN DEMO
          <span className="orgtag">ONLINE</span>
        </div>

        <div className="navlabel">PLATAFORMA</div>

        <nav>
          {nav.map(([label, id, Icon]) => (
            <button
              key={id}
              className={`navitem ${page === id ? 'active' : ''}`}
              onClick={() => {
                setPage(id);
                setMobile(false);
              }}
            >
              <Icon size={17} />
              <span>{label}</span>
              {page === id && <ChevronRight size={15} className="navchev" />}
            </button>
          ))}
        </nav>

        <div className="sidebottom">
          <div className="secure">
            <ShieldCheck size={16} />
            <div>
              <b>Entorno protegido</b>
              <small>Sesión autenticada</small>
            </div>
          </div>

          <button className="profile" onClick={logout}>
            <div className="avatar">
              {user?.full_name?.slice(0, 1) || 'A'}
            </div>
            <div className="profiletext">
              <b>{user?.full_name || 'Usuario'}</b>
              <small>{user?.role || 'usuario'}</small>
            </div>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="hamb" onClick={() => setMobile(!mobile)}>
            <Menu />
          </button>

          <div className="crumb">
            Plataforma <span>/</span>
            <b>{nav.find(x => x[1] === page)?.[0]}</b>
          </div>

          <div className="topright">
            <div className="search">
              <Search size={15} />
              <input placeholder="Buscar en EduMaster.ai" />
            </div>
            <button className="iconbtn">
              <Bell size={18} />
              <i />
            </button>
            <div className="topavatar">
              {user?.full_name?.slice(0, 1) || 'A'}
            </div>
          </div>
        </header>

        <div className="content">
          <div className="pagehead">
            <div>
              <div className="eyebrow">EDUMASTER.AI / ENTERPRISE</div>
              <h1>{nav.find(x => x[1] === page)?.[0] || 'Plataforma'}</h1>
              <p>{pageDescription(page)}</p>
            </div>
            <div className="headactions">
              <span className="env">
                <span className="live-dot" /> SISTEMA CONECTADO
              </span>
              <button className="ghost" onClick={() => setPage(page)}>
                <RefreshCw size={15} /> Actualizar
              </button>
            </div>
          </div>

          {error && (
            <div className="alert">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {loading && <div className="loadingbar" />}

          {page === 'dashboard' && (
            <Dashboard data={data.dashboard || {}} setPage={setPage} />
          )}

          {page === 'neural' && <Neural />}

          {page === 'students' && (
            <DataPage
              title="Estudiantes registrados"
              subtitle="Directorio académico de la institución."
              items={data.students || []}
              kind="students"
              api={api}
              reload={() => setPage('students')}
            />
          )}

          {page === 'courses' && (
            <DataPage
              title="Catálogo de cursos"
              subtitle="Oferta académica y contenidos formativos."
              items={data.courses || []}
              kind="courses"
              api={api}
              reload={() => setPage('courses')}
            />
          )}

          {page === 'assessments' && (
            <DataPage
              title="Evaluaciones"
              subtitle="Instrumentos de evaluación asociados a cursos."
              items={data.assessments || []}
              kind="assessments"
              api={api}
              reload={() => setPage('assessments')}
              courses={data.courses || []}
            />
          )}

          {page === 'tracking' && (
            <InfoPanel
              icon={<Activity />}
              title="Seguimiento del aprendizaje"
              text="Registra eventos académicos válidos para construir el historial de progreso."
            >
              <EventForm students={data.students || []} api={api} />
            </InfoPanel>
          )}

          {page === 'analytics' && <Analytics data={data.dashboard || {}} />}

          {page === 'models' && <Models items={data.models || []} />}

          {page === 'lab' && <MLLab token={token} apiBase={API} />}

          {page === 'recommendations' && (
            <InfoPanel
              icon={<Sparkles />}
              title="Motor de recomendaciones"
              text="Las recomendaciones deben combinar señales del modelo con reglas académicas y revisión docente."
            >
              <div className="demo-note">
                DEMO · Aún no hay un modelo aprobado ni recomendaciones generadas por inferencia real.
              </div>
            </InfoPanel>
          )}

          {page === 'certificates' && (
            <InfoPanel
              icon={<Award />}
              title="Certificaciones"
              text="La emisión debe validar criterios oficiales de finalización, evitar duplicados y registrar folio, emisor y verificación QR."
            >
              <div className="demo-note">
                Módulo base preparado. La emisión PDF/QR se incorpora en la siguiente iteración.
              </div>
            </InfoPanel>
          )}

          {page === 'audit' && <Audit items={data.audit || []} />}

          {page === 'admin' && (
            <InfoPanel
              icon={<Settings />}
              title="Administración de la plataforma"
              text="Gestión inicial de roles y entorno. El control de permisos se valida en el backend."
            >
              <div className="grid3">
                <Stat label="Sesión" value="Autenticada" hint="JWT activo" />
                <Stat label="Rol actual" value={user?.role || '—'} hint="Asignado en backend" />
                <Stat label="Organización" value="DEMO" hint="Aislamiento institucional base" />
              </div>
            </InfoPanel>
          )}
        </div>
      </main>
    </div>
  );
}

function pageDescription(p: string) {
  const descriptions: Record<string, string> = {
    dashboard: 'Visión integral del ecosistema de aprendizaje inteligente.',
    neural: 'Topología multitarea, rutas de procesamiento y salidas del modelo.',
    students: 'Identidad académica y estado de estudiantes.',
    courses: 'Gestión del catálogo académico.',
    assessments: 'Evaluaciones, instrumentos y planificación.',
    tracking: 'Eventos y evidencias del proceso de aprendizaje.',
    analytics: 'Indicadores derivados de los datos registrados.',
    models: 'Gobierno de datasets, experimentos y versiones de modelos.',
    lab: 'Carga de datasets, configuración, entrenamiento y evaluación.',
    recommendations: 'Sugerencias contextualizadas y retroalimentación.',
    certificates: 'Emisión y verificación de logros académicos.',
    audit: 'Trazabilidad de operaciones de la plataforma.',
    admin: 'Configuración institucional y control de acceso.'
  };
  return descriptions[p] || '';
}

function Login({ onLogin }: {
  onLogin: (token: string, user: User) => void
}) {
  const [email, setEmail] = useState('admin@edumaster.ai');
  const [password, setPassword] = useState('EduMaster123!');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    setErr('');

    try {
      const response = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result.detail === 'string'
            ? result.detail
            : `Error ${response.status}: no se pudo iniciar sesión.`
        );
      }

      if (!result.access_token || !result.user) {
        throw new Error('El backend no devolvió access_token y user. Revisa la respuesta de autenticación.');
      }

      onLogin(result.access_token, result.user);

    } catch (error: any) {
      setErr(error.message || 'No se pudo conectar con el servidor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="loginvisual">
        <div className="loginorb orb1" />
        <div className="loginorb orb2" />

        <div className="loginbrand">
          <div className="brandmark big"><BrainCircuit /></div>
          <h1>EduMaster<span>.ai</span></h1>
          <p>Plataforma empresarial de aprendizaje inteligente</p>
        </div>

        <div className="loginfoot">
          LEARNING INTELLIGENCE PLATFORM
          <span>•</span> ENTERPRISE EDITION
        </div>
      </div>

      <div className="loginform">
        <div className="formbox">
          <div className="eyebrow">BIENVENIDO DE NUEVO</div>
          <h2>Iniciar sesión</h2>
          <p>Accede a tu espacio de trabajo institucional.</p>

          <form onSubmit={submit}>
            <label>Correo institucional</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              required
            />

            <label>Contraseña</label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />

            {err && (
              <div className="alert">
                <AlertTriangle size={16} /> {err}
              </div>
            )}

            <button className="primary full" disabled={busy}>
              {busy ? 'Validando…' : 'Ingresar a la plataforma'}
              <ChevronRight size={17} />
            </button>
          </form>

          <div className="loginhint">
            <b>Acceso de prueba DEMO</b>
            <br />
            admin@edumaster.ai
            <br />
            EduMaster123!
          </div>

          <small className="muted">
            Entorno de demostración. Cambia las credenciales antes de producción.
          </small>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ data, setPage }: any) {
  return (
    <>
      <div className="welcome">
        <div>
          <div className="welcome-tag">
            <Sparkles size={14} /> PANEL INSTITUCIONAL
          </div>
          <h2>Inteligencia para transformar el aprendizaje.</h2>
          <p>
            Monitorea la actividad académica, el progreso y los servicios de la plataforma desde un solo lugar.
          </p>
        </div>
        <div className="welcome-art">
          <div className="art-ring r1" />
          <div className="art-ring r2" />
          <BrainCircuit size={70} />
          <span className="artnode n1" />
          <span className="artnode n2" />
          <span className="artnode n3" />
        </div>
      </div>

      <div className="stats">
        {[
          [Users, 'Estudiantes', data.students ?? '—', 'Registros institucionales', 'students'],
          [BookOpen, 'Cursos activos', data.courses ?? '—', 'Catálogo académico', 'courses'],
          [GraduationCap, 'Evaluaciones', data.assessments ?? '—', 'Instrumentos registrados', 'assessments'],
          [Activity, 'Eventos de aprendizaje', data.learning_events ?? '—', 'Trazabilidad académica', 'tracking']
        ].map(([Icon, label, value, hint, page]: any) => (
          <div className="statcard" key={label} onClick={() => setPage(page)}>
            <div className="stathead">
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>

      <div className="dashgrid">
        <div className="panel">
          <div className="panelhead">
            <div>
              <h3>Arquitectura de aprendizaje inteligente</h3>
              <p>Modelo multitarea · vista general</p>
            </div>
            <button className="textlink" onClick={() => setPage('neural')}>
              Explorar arquitectura <ChevronRight size={14} />
            </button>
          </div>
          <MiniNetwork />
        </div>

        <div className="panel statuspanel">
          <div className="panelhead">
            <div>
              <h3>Estado de la plataforma IA</h3>
              <p>Gobierno y disponibilidad de modelos</p>
            </div>
            <BrainCircuit />
          </div>

          <div className="statusrow">
            <span className="statusicon"><Database /></span>
            <div><b>Dataset</b><small>Preparado para pruebas DEMO</small></div>
            <span className="pill amber">DEMO</span>
          </div>

          <div className="statusrow">
            <span className="statusicon purple"><Network /></span>
            <div><b>Modelo multitarea</b><small>Sin aprobación para producción</small></div>
            <span className="pill gray">Experimental</span>
          </div>

          <div className="statusrow">
            <span className="statusicon green"><ShieldCheck /></span>
            <div><b>Gobierno</b><small>Autorización en backend</small></div>
            <span className="pill green">Activo</span>
          </div>

          <button className="outline full" onClick={() => setPage('models')}>
            Ver plataforma IA
          </button>
        </div>
      </div>

      <div className="bottomgrid">
        <div className="panel">
          <div className="panelhead">
            <div><h3>Accesos rápidos</h3><p>Operaciones frecuentes</p></div>
          </div>
          <div className="quickgrid">
            {[
              ['Registrar estudiante', 'students', Users],
              ['Crear curso', 'courses', BookOpen],
              ['Revisar evaluaciones', 'assessments', GraduationCap],
              ['Visualizar redes neuronales', 'neural', BrainCircuit]
            ].map(([title, page, Icon]: any) => (
              <button className="quick" key={title} onClick={() => setPage(page)}>
                <Icon /><span>{title}</span><ChevronRight size={15} />
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panelhead">
            <div><h3>Principios de IA responsable</h3><p>Controles del proyecto</p></div>
          </div>
          {[
            'Predicciones como estimaciones, no certezas.',
            'Riesgo orientado a acompañamiento humano.',
            'Datos DEMO no validan calidad educativa.'
          ].map(item => (
            <div className="principle" key={item}>
              <CheckCircle2 /><span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MiniNetwork() {
  return (
    <div className="mininet">
      <div className="minicol">
        <small>ENTRADA</small>
        {['Rendimiento', 'Participación', 'Progreso', 'Evaluaciones'].map(x => <span key={x}>{x}</span>)}
      </div>
      <div className="miniarrows">··········</div>
      <div className="minicol cyan">
        <small>PROCESAMIENTO</small>
        {['Rama tabular', 'Rama temporal', 'Fusión'].map(x => <span key={x}>{x}</span>)}
      </div>
      <div className="miniarrows">··········</div>
      <div className="minicol purple">
        <small>SALIDAS</small>
        {['Finalización', 'Habilidades', 'Riesgo', 'Recomendación'].map(x => <span key={x}>{x}</span>)}
      </div>
    </div>
  );
}

function Neural() {
  const [active, setActive] = useState('');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('normal');

  const h = heads.find(x => x.id === active);

  const columns = h
    ? [h.inputs, ...h.hidden.map(n => Array.from({ length: Math.min(n, 8) }, (_, j) => `N${j + 1}`)), Array.from({ length: Math.min(h.output, 5) }, (_, j) => `S${j + 1}`)]
    : [];

  const xs = columns.map((_, i) => 80 + i * (820 / Math.max(columns.length - 1, 1)));

  const pts = columns.map((col, ci) =>
    col.map((_, ni) => ({
      x: xs[ci],
      y: 300 / (col.length + 1) * (ni + 1)
    }))
  );

  return (
    <div className="neuralpage">
      <div className="neuralintro">
        <div>
          <span className="eyebrow">AI PLATFORM / NEURAL LAB</span>
          <h2>Arquitecturas neuronales EduMaster.ai</h2>
          <p>Selecciona una sola red. Al cambiar de selección, la anterior se apaga.</p>
        </div>
        <div className="modelstate">
          <span className="pill amber">MODO CONTROLADO</span>
          <small>Máximo 1 arquitectura activa</small>
        </div>
      </div>

      <div className="panel neural-selector-panel">
        <div className="panelhead">
          <div><h3>Catálogo de seis redes</h3><p>Solo una arquitectura seleccionada a la vez.</p></div>
          <span className="pill green">{h ? '1 SELECCIONADA' : '0 ACTIVAS'}</span>
        </div>

        <div className="headcards">
          {heads.map(x => (
            <button
              key={x.id}
              onClick={() => { setActive(x.id); setPlaying(false); }}
              className={`headcard ${active === x.id ? 'chosen' : ''}`}
              style={{ '--route': x.color } as any}
            >
              <div className="headcardtop">
                <span>RED {x.id}</span>
                <span className={`pill ${active === x.id ? 'green' : 'gray'}`}>
                  {active === x.id ? 'ENCENDIDA' : 'APAGADA'}
                </span>
              </div>
              <b>{x.name}</b>
              <small>{x.desc}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="panel neuralcanvas">
        <div className="canvashead">
          <div>
            <b>{h ? h.name : 'Ninguna red seleccionada'}</b>
            <small>{h ? h.desc : 'Selecciona una arquitectura del catálogo.'}</small>
          </div>
          <div className="canvascontrols">
            {h && (
              <>
                <button className="outline small" onClick={() => setPlaying(!playing)}>
                  {playing ? 'Pausar animación' : 'Encender visualización'}
                </button>
                <button className="outline small" onClick={() => { setActive(''); setPlaying(false); }}>
                  Apagar red
                </button>
                <select value={speed} onChange={e => setSpeed(e.target.value)}>
                  <option value="slow">Lenta</option>
                  <option value="normal">Normal</option>
                  <option value="fast">Rápida</option>
                </select>
              </>
            )}
          </div>
        </div>

        {h ? (
          <>
            <svg className={`network-svg ${playing ? 'animate' : ''}`} viewBox="0 0 980 350" role="img">
              {pts.slice(0, -1).map((col, ci) =>
                col.flatMap(pt =>
                  pts[ci + 1].map((next, ni) => (
                    <line
                      key={`${ci}-${pt.y}-${ni}`}
                      x1={pt.x + 10}
                      y1={pt.y}
                      x2={next.x - 10}
                      y2={next.y}
                      className="wire selected"
                      style={{ '--route': h.color } as any}
                    />
                  ))
                )
              )}

              {pts.map((col, ci) =>
                col.map((pt, ni) => (
                  <g key={`${ci}-${ni}`}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="10"
                      className={`node ${ci === 0 ? 'input' : ci === pts.length - 1 ? 'output' : 'temporal'}`}
                      style={{ '--route': h.color } as any}
                    />
                    <circle cx={pt.x} cy={pt.y} r="3" className="nodecore" />
                  </g>
                ))
              )}

              {xs.map((x, i) => (
                <text key={i} x={x} y="335" textAnchor="middle" className="svglabel">
                  {i === 0 ? 'ENTRADA' : i === xs.length - 1 ? 'SALIDA' : `CAPA OCULTA ${i}`}
                </text>
              ))}
            </svg>

            <div className="legend">
              <span><i className="dot cyan" />Entrada</span>
              <span><i className="dot purple" />Capas ocultas</span>
              <span><i className="dot mint" />Salida</span>
              <span className="pill green">RED {h.id} SELECCIONADA</span>
            </div>

            <div className="inspectgrid">
              <div className="panel">
                <div className="panelhead">
                  <div><h3>Inspector de arquitectura</h3><p>Topología conceptual</p></div>
                  <Layers3 />
                </div>
                <div className="inspectrow"><span>Entradas</span><b>{h.inputs.join(', ')}</b></div>
                {h.hidden.map((n, i) => (
                  <div className="inspectrow" key={i}>
                    <span>Capa oculta {i + 1}</span>
                    <b>{n} neuronas · ReLU (diseño)</b>
                  </div>
                ))}
                <div className="inspectrow"><span>Salida</span><b>{h.out}</b></div>
              </div>

              <div className="panel">
                <div className="panelhead">
                  <div><h3>Explicación funcional</h3><p>Relación con el dominio educativo</p></div>
                  <BrainCircuit />
                </div>
                <p className="muted">
                  Los datos de entrada se transforman a través de capas ocultas.
                  Cada neurona combina señales mediante pesos y una función de activación.
                </p>
                <div className="demo-note">
                  <AlertTriangle size={16} />
                  La animación representa conexiones y flujo visual, no entrenamiento ni inferencia real.
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="empty">
            <BrainCircuit size={38} />
            Selecciona una red para encenderla y visualizar su conexión completa.
          </div>
        )}
      </div>
    </div>
  );
}

function DataPage({ title, subtitle, items, kind, api, reload, courses = [] }: any) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({});

  async function save(e: any) {
    e.preventDefault();

    try {
      const body = kind === 'students'
        ? {
            student_code: form.code,
            full_name: form.name,
            email: form.email || '',
            status: 'active'
          }
        : kind === 'courses'
        ? {
            code: form.code,
            title: form.title,
            description: form.description || '',
            level: form.level || 'General',
            status: 'published'
          }
        : {
            course_id: form.course_id,
            title: form.title,
            max_score: Number(form.max_score || 20),
            status: 'draft',
            due_date: form.due_date || ''
          };

      await api(`/api/v1/${kind}`, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      setShow(false);
      setForm({});
      reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="panel tablepanel">
      <div className="panelhead">
        <div><h3>{title}</h3><p>{subtitle}</p></div>
        <button className="primary" onClick={() => setShow(!show)}>
          <Plus size={16} /> Nuevo registro
        </button>
      </div>

      {show && (
        <form className="inlineform" onSubmit={save}>
          {kind === 'students' ? (
            <>
              <input placeholder="Código" required onChange={e => setForm({ ...form, code: e.target.value })} />
              <input placeholder="Nombre completo" required onChange={e => setForm({ ...form, name: e.target.value })} />
              <input placeholder="Correo" onChange={e => setForm({ ...form, email: e.target.value })} />
            </>
          ) : kind === 'courses' ? (
            <>
              <input placeholder="Código" required onChange={e => setForm({ ...form, code: e.target.value })} />
              <input placeholder="Nombre del curso" required onChange={e => setForm({ ...form, title: e.target.value })} />
              <input placeholder="Nivel" onChange={e => setForm({ ...form, level: e.target.value })} />
            </>
          ) : (
            <>
              <select required onChange={e => setForm({ ...form, course_id: e.target.value })}>
                <option value="">Seleccionar curso</option>
                {courses.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <input placeholder="Título de evaluación" required onChange={e => setForm({ ...form, title: e.target.value })} />
              <input type="number" placeholder="Puntaje máximo" onChange={e => setForm({ ...form, max_score: e.target.value })} />
            </>
          )}
          <button className="primary">Guardar</button>
        </form>
      )}

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              {(kind === 'students'
                ? ['Código', 'Nombre', 'Correo', 'Estado']
                : kind === 'courses'
                ? ['Código', 'Curso', 'Nivel', 'Estado']
                : ['Evaluación', 'Curso ID', 'Puntaje máximo', 'Estado']
              ).map(x => <th key={x}>{x}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((x: any) => (
              <tr key={x.id}>
                {kind === 'students' ? (
                  <>
                    <td><b>{x.student_code}</b></td>
                    <td>{x.full_name}</td>
                    <td>{x.email}</td>
                    <td><span className="pill green">{x.status}</span></td>
                  </>
                ) : kind === 'courses' ? (
                  <>
                    <td><b>{x.code}</b></td>
                    <td>{x.title}</td>
                    <td>{x.level}</td>
                    <td><span className="pill green">{x.status}</span></td>
                  </>
                ) : (
                  <>
                    <td>{x.title}</td>
                    <td className="mono">{x.course_id?.slice(0, 9)}</td>
                    <td>{x.max_score}</td>
                    <td>{x.status}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <div className="empty">Aún no hay registros.</div>}
      </div>
    </div>
  );
}

function EventForm({ students, api }: any) {
  const [student, setStudent] = useState('');
  const [type, setType] = useState('lesson_viewed');
  const [desc, setDesc] = useState('');

  async function send(e: any) {
    e.preventDefault();

    try {
      await api('/api/v1/learning-events', {
        method: 'POST',
        body: JSON.stringify({
          student_id: student,
          event_type: type,
          description: desc
        })
      });

      alert('Evento registrado correctamente');
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <form className="eventform" onSubmit={send}>
      <label>Estudiante</label>
      <select required value={student} onChange={e => setStudent(e.target.value)}>
        <option value="">Seleccionar estudiante</option>
        {students.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
      </select>

      <label>Tipo de evento</label>
      <select value={type} onChange={e => setType(e.target.value)}>
        {['lesson_viewed', 'activity_started', 'activity_completed', 'assessment_submitted', 'course_completed'].map(x => (
          <option key={x}>{x}</option>
        ))}
      </select>

      <label>Descripción</label>
      <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Detalle opcional" />
      <button className="primary">Registrar evento</button>
    </form>
  );
}

function InfoPanel({ icon, title, text, children }: any) {
  return (
    <div className="panel infopanel">
      <div className="infoicon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}

function Analytics({ data }: any) {
  return (
    <div className="grid3">
      <Stat label="Estudiantes" value={data.students ?? 0} hint="Registros en base de datos" />
      <Stat label="Cursos" value={data.courses ?? 0} hint="Oferta académica" />
      <Stat label="Eventos" value={data.learning_events ?? 0} hint="Eventos persistidos" />

      <div className="panel span3">
        <h3>Calidad y gobierno de datos</h3>
        <p className="muted">
          El proyecto define controles de completitud, deduplicación, rangos,
          trazabilidad, representatividad y privacidad.
        </p>
        <div className="quality"><span>Completitud campos críticos</span><b>Objetivo ≥ 98%</b></div>
        <div className="quality"><span>Eventos duplicados tras deduplicación</span><b>Objetivo 0</b></div>
        <div className="quality"><span>Datos sensibles directos</span><b>Excluir salvo aprobación</b></div>
      </div>
    </div>
  );
}

function Models({ items }: any) {
  return (
    <div className="grid2">
      <div className="panel">
        <div className="panelhead">
          <div><h3>Registro de modelos</h3><p>Versiones y estado de aprobación</p></div>
          <BrainCircuit />
        </div>

        {items.map((x: any) => (
          <div className="modelitem" key={x.id}>
            <div className="modelicon"><Network /></div>
            <div>
              <b>{x.name}</b>
              <small>Versión {x.version} · {x.stage}</small>
              <small>{x.description}</small>
            </div>
            <span className="pill amber">{x.approval_status}</span>
          </div>
        ))}

        <div className="demo-note">
          No hay checkpoints ni métricas de entrenamiento reales en esta entrega.
        </div>
      </div>

      <div className="panel">
        <h3>Flujo MLOps previsto</h3>
        {[
          'Dataset versionado',
          'Baseline interpretable',
          'Entrenamiento PyTorch',
          'Evaluación y calibración',
          'Registro MLflow',
          'Aprobación humana',
          'Staging / Shadow',
          'Producción y monitoreo'
        ].map((x, i) => (
          <div className="flowstep" key={x}><span>{i + 1}</span>{x}</div>
        ))}
      </div>
    </div>
  );
}

function MLLab({ token, apiBase }: any) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [experiments, setExperiments] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const [target, setTarget] = useState('');
  const [layers, setLayers] = useState('64,32');
  const [activation, setActivation] = useState('relu');
  const [epochs, setEpochs] = useState('150');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  async function refresh() {
    const [d, e] = await Promise.all([
      fetch(`${apiBase}/api/v1/ml/datasets`, { headers }),
      fetch(`${apiBase}/api/v1/ml/experiments`, { headers })
    ]);

    if (d.ok) {
      const x = await d.json();
      setDatasets(x);

      if (x[0] && !selected) {
        setSelected(x[0].id);
        setTarget(x[0].columns[x[0].columns.length - 1]);
      }
    }

    if (e.ok) setExperiments(await e.json());
  }

  useEffect(() => {
    refresh().catch(e => setMessage(e.message));
  }, []);

  async function upload(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setMessage('');

    try {
      const fd = new FormData();
      fd.append('file', file);

      const response = await fetch(`${apiBase}/api/v1/ml/datasets`, {
        method: 'POST',
        headers,
        body: fd
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Error al cargar CSV');
      }

      setMessage(`Dataset cargado: ${result.rows} filas y ${result.columns.length} columnas.`);
      await refresh();
      setSelected(result.id);
      setTarget(result.columns[result.columns.length - 1]);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function train() {
    setBusy(true);
    setMessage('Entrenando red neuronal. Puede tardar según el tamaño del CSV…');
    setResult(null);

    try {
      const fd = new FormData();
      fd.append('dataset_id', selected);
      fd.append('target', target);
      fd.append('hidden_layers', layers);
      fd.append('activation', activation);
      fd.append('max_iter', epochs);
      fd.append('test_size', '0.2');

      const response = await fetch(`${apiBase}/api/v1/ml/train`, {
        method: 'POST',
        headers,
        body: fd
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'No se pudo entrenar');
      }

      setResult(result);
      setMessage('Entrenamiento completado. El modelo queda experimental y sin aprobación.');
      await refresh();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const dataset = datasets.find(x => x.id === selected);

  return (
    <div className="grid2">
      <div className="panel">
        <div className="panelhead">
          <div><h3>1. Ingesta y calidad del dataset</h3><p>CSV supervisado · máximo 10 MB · mínimo 20 filas</p></div>
          <Database />
        </div>

        <label className="uploadbox">
          <input type="file" accept=".csv,text/csv" onChange={upload} disabled={busy} />
          <b>Seleccionar archivo CSV</b>
          <small>Se validan columnas, filas, valores faltantes y duplicidad de nombres.</small>
        </label>

        {datasets.map(d => (
          <button
            key={d.id}
            className={`datasetrow ${selected === d.id ? 'selected' : ''}`}
            onClick={() => {
              setSelected(d.id);
              setTarget(d.columns[d.columns.length - 1]);
              setResult(null);
            }}
          >
            <Database size={17} />
            <span>
              <b>{d.filename}</b>
              <small>{d.rows} filas · {d.columns.length} columnas · {d.missing} valores faltantes</small>
            </span>
            <span className="pill gray">{selected === d.id ? 'Elegido' : 'Usar'}</span>
          </button>
        ))}

        {!datasets.length && <div className="empty">Todavía no has cargado datasets.</div>}
      </div>

      <div className="panel">
        <div className="panelhead">
          <div><h3>2. Configuración de red neuronal</h3><p>Perceptrón multicapa (MLP) para clasificación</p></div>
          <BrainCircuit />
        </div>

        <label>Columna objetivo (etiqueta)</label>
        <select value={target} onChange={e => setTarget(e.target.value)} disabled={!dataset}>
          {(dataset?.columns || []).map((c: string) => <option key={c}>{c}</option>)}
        </select>

        <label>Capas ocultas (neuronas por capa)</label>
        <input value={layers} onChange={e => setLayers(e.target.value)} placeholder="64,32" />
        <small className="muted">Ejemplo: 64,32 crea dos capas ocultas.</small>

        <label>Función de activación</label>
        <select value={activation} onChange={e => setActivation(e.target.value)}>
          <option value="relu">ReLU</option>
          <option value="tanh">Tanh</option>
          <option value="logistic">Sigmoide</option>
        </select>

        <label>Épocas máximas</label>
        <input type="number" min="30" max="1000" value={epochs} onChange={e => setEpochs(e.target.value)} />

        <button className="primary full" disabled={busy || !dataset || !target} onClick={train}>
          {busy ? 'Procesando…' : 'Entrenar red neuronal'}
        </button>

        <div className="demo-note">
          Los datos se dividen en 80% entrenamiento y 20% prueba.
          Se imputan faltantes, escalan variables numéricas y codifican categorías dentro del pipeline.
        </div>
      </div>

      {message && <div className="panel span2"><p className="muted">{message}</p></div>}

      {result && (
        <div className="panel span2">
          <div className="panelhead">
            <div>
              <h3>3. Resultados de evaluación</h3>
              <p>Experimento {result.id?.slice(0, 8)} · holdout 80/20</p>
            </div>
            <span className="pill amber">Experimental / no aprobado</span>
          </div>

          <div className="grid3">
            <Stat label="Accuracy" value={`${(result.accuracy * 100).toFixed(1)}%`} hint="Exactitud en prueba" />
            <Stat label="F1 ponderado" value={result.f1_weighted.toFixed(3)} hint="Precisión / recall" />
            <Stat label="Épocas ejecutadas" value={result.epochs_completed} hint={`Máximo: ${result.max_epochs}`} />
          </div>

          <div className="quality"><span>Precisión ponderada</span><b>{result.precision_weighted.toFixed(3)}</b></div>
          <div className="quality"><span>Recall ponderado</span><b>{result.recall_weighted.toFixed(3)}</b></div>

          <h4>Matriz de confusión</h4>
          <div className="tablewrap">
            <table>
              <tbody>
                {result.confusion_matrix.map((row: number[], i: number) => (
                  <tr key={i}>
                    {row.map((v: number, j: number) => <td key={j}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted">
            Características: {result.features.join(', ')}.
            Clases: {result.classes.join(', ')}.
          </p>

          <div className="demo-note">
            Estas métricas dependen del dataset, su calidad y su representatividad.
          </div>
        </div>
      )}

      <div className="panel span2">
        <div className="panelhead">
          <div><h3>4. Historial de experimentos</h3><p>Entrenamientos guardados por institución</p></div>
          <Clock3 />
        </div>

        {experiments.map(x => (
          <div className="auditrow" key={x.id}>
            <BrainCircuit />
            <b>{x.dataset_name}</b>
            <span>{x.target}</span>
            <span>Accuracy {(x.accuracy * 100).toFixed(1)}%</span>
            <small>{x.architecture.join('–')} · {x.epochs_completed} épocas</small>
          </div>
        ))}

        {!experiments.length && <div className="empty">Aún no hay experimentos.</div>}
      </div>
    </div>
  );
}

function Audit({ items }: any) {
  return (
    <div className="panel">
      <div className="panelhead">
        <div><h3>Bitácora de auditoría</h3><p>Últimas operaciones registradas</p></div>
        <ShieldCheck />
      </div>

      {items.map((x: any) => (
        <div className="auditrow" key={x.id}>
          <Clock3 />
          <b>{x.action}</b>
          <span>{x.resource}</span>
          <small>{x.actor_email}</small>
          <time>{new Date(x.occurred_at).toLocaleString()}</time>
        </div>
      ))}

      {!items.length && <div className="empty">Todavía no hay operaciones registradas.</div>}
    </div>
  );
}

function Stat({ label, value, hint }: any) {
  return (
    <div className="statcard">
      <div className="stathead">{label}</div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

export default App;
