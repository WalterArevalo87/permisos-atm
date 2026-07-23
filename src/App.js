import { useState, useEffect } from "react";

const API_URL = "http://localhost:5185/api/correo/enviar";

const ACCESOS = [
  "Mantenimiento preventivo", "Mantenimiento correctivo",
  "Instalación de hardware",  "Actualización de software",
  "Recarga de efectivo",      "Revisión de seguridad",
  "Inspección técnica",       "Otro",
  "Dispensador estado fatal", "Lectora estado Fatal", "Cambio de componentes",
];

const EMPTY  = { atm:"", empresa:"", acceso:"", fecha:"", hora:"", motivo:"", persona:"" };
const COLORS = ["#2563eb","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#be185d","#65a30d","#ea580c","#0284c7","#9333ea"];

export default function App() {
  const [tab, setTab]             = useState("dashboard");
  const [form, setForm]           = useState(EMPTY);
  const [permisos, setPermisos]   = useState([]);
  const [email, setEmail]         = useState("");
  const [search, setSearch]       = useState("");
  const [toast, setToast]         = useState(null);
  const [sending, setSending]     = useState(false);
  const [filtroActivo, setFiltro] = useState(null);

  useEffect(() => {
    const saved      = localStorage.getItem("atm-permisos");
    const savedEmail = localStorage.getItem("atm-email");
    if (saved)      setPermisos(JSON.parse(saved));
    if (savedEmail) setEmail(savedEmail);
  }, []);

  const save = (list) => {
    setPermisos(list);
    localStorage.setItem("atm-permisos", JSON.stringify(list));
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const validate = () => Object.values(form).every(v => v.trim() !== "");

  const handleSaveOnly = () => {
    if (!validate()) return showToast("⚠ Completa todos los campos");
    save([{ ...form, id: Date.now(), createdAt: new Date().toISOString(), enviado: false }, ...permisos]);
    setForm(EMPTY); setTab("history"); showToast("✓ Permiso guardado");
  };

  const handleSendEmail = async () => {
    if (!validate()) return showToast("⚠ Completa todos los campos");
    if (!email)      return showToast("⚠ Ingresa un correo de destino");
    setSending(true); showToast("Enviando correo...");
    try {
      const res  = await fetch(API_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ...form, emailTo: email }) });
      const data = await res.json();
      if (res.ok) {
        save([{ ...form, id: Date.now(), createdAt: new Date().toISOString(), enviado: true, emailTo: email }, ...permisos]);
        setForm(EMPTY); setTab("history"); showToast("✓ Correo enviado correctamente");
      } else { showToast(`✗ ${data.mensaje}`); }
    } catch { showToast("✗ No se pudo conectar con la API"); }
    finally   { setSending(false); }
  };

  const handleResend = async (p) => {
    const to = p.emailTo || email;
    if (!to) return showToast("⚠ No hay correo guardado");
    setSending(true);
    try {
      const res  = await fetch(API_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ atm:p.atm, empresa:p.empresa, acceso:p.acceso, fecha:p.fecha, hora:p.hora, persona:p.persona, motivo:p.motivo, emailTo:to }) });
      const data = await res.json();
      showToast(res.ok ? "✓ Correo reenviado" : `✗ ${data.mensaje}`);
    } catch { showToast("✗ Error al reenviar"); }
    finally   { setSending(false); }
  };

  const handleDelete = (id) => save(permisos.filter(p => p.id !== id));

  const filtered = permisos.filter(p =>
    !search || [p.atm, p.empresa, p.persona, p.acceso].some(v => v.toLowerCase().includes(search.toLowerCase()))
  );

  const aplicarFiltro = (tipo, valor, label) => {
    if (filtroActivo?.tipo===tipo && filtroActivo?.valor===valor) setFiltro(null);
    else setFiltro({ tipo, valor, label });
  };

  const permisosFiltrados = filtroActivo
    ? permisos.filter(p => {
        if (filtroActivo.tipo==="estado")  return filtroActivo.valor==="enviado" ? p.enviado : !p.enviado;
        if (filtroActivo.tipo==="acceso")  return p.acceso  === filtroActivo.valor;
        if (filtroActivo.tipo==="empresa") return p.empresa === filtroActivo.valor;
        if (filtroActivo.tipo==="atm")     return p.atm     === filtroActivo.valor;
        if (filtroActivo.tipo==="dia")     return p.createdAt?.startsWith(filtroActivo.valor);
        return true;
      })
    : permisos;

  const totalPermisos  = permisos.length;
  const totalEnviados  = permisos.filter(p => p.enviado).length;
  const totalGuardados = permisos.filter(p => !p.enviado).length;

  const porAcceso  = ACCESOS.map(a => ({ nombre:a, total: permisos.filter(p=>p.acceso===a).length })).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const porEmpresa = [...new Set(permisos.map(p=>p.empresa))].map(e=>({ nombre:e, total: permisos.filter(p=>p.empresa===e).length })).sort((a,b)=>b.total-a.total).slice(0,6);
  const porATM     = [...new Set(permisos.map(p=>p.atm))].map(a=>({ nombre:a, total: permisos.filter(p=>p.atm===a).length })).sort((a,b)=>b.total-a.total).slice(0,6);

  const ultimos7dias = Array.from({ length:7 }, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    const key = d.toISOString().split("T")[0];
    return { dia: d.toLocaleDateString("es-EC",{weekday:"short",day:"2-digit"}), key, total: permisos.filter(p=>p.createdAt?.startsWith(key)).length };
  });

  const maxDia=Math.max(...ultimos7dias.map(d=>d.total),1);
  const maxAcceso=Math.max(...porAcceso.map(a=>a.total),1);
  const maxEmpresa=Math.max(...porEmpresa.map(e=>e.total),1);
  const maxATM=Math.max(...porATM.map(a=>a.total),1);
  const isActive=(tipo,valor)=>filtroActivo?.tipo===tipo&&filtroActivo?.valor===valor;

  const s = {
    wrap:     { maxWidth:960, margin:"0 auto", padding:"1rem", fontFamily:"system-ui,sans-serif" },
    toast:    { position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", background:"#fff", border:"1px solid #ccc", padding:"10px 20px", borderRadius:8, fontSize:14, zIndex:999, boxShadow:"0 4px 12px rgba(0,0,0,0.1)", whiteSpace:"nowrap" },
    tabs:     { display:"flex", gap:4, background:"#f4f4f4", borderRadius:8, padding:4, marginBottom:"1rem" },
    tab:      (a) => ({ flex:1, padding:"7px 12px", border:"none", borderRadius:6, cursor:"pointer", background:a?"#fff":"transparent", fontWeight:a?500:400, fontSize:13, color:a?"#111":"#666", boxShadow:a?"0 1px 3px rgba(0,0,0,0.1)":"none" }),
    emailBox: { background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"10px 14px", marginBottom:12, display:"flex", gap:10, alignItems:"center" },
    card:     { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"1.25rem" },
    grid2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 },
    label:    { fontSize:11, fontWeight:500, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.3px", display:"block", marginBottom:5 },
    input:    { width:"100%", padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:6, fontSize:14, fontFamily:"inherit" },
    select:   { width:"100%", padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:6, fontSize:14, fontFamily:"inherit" },
    textarea: { width:"100%", padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:6, fontSize:14, fontFamily:"inherit", resize:"vertical", minHeight:80 },
    btnRow:   { display:"flex", gap:10, marginTop:16 },
    btnSave:  { flex:1, padding:"10px 16px", background:"#f9fafb", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, cursor:"pointer" },
    btnSend:  (d) => ({ flex:1.6, padding:"10px 16px", background:d?"#93c5fd":"#2563eb", color:"#fff", border:"none", borderRadius:8, fontSize:14, fontWeight:500, cursor:d?"not-allowed":"pointer" }),
    permCard: { background:"#fff", border:"1px solid #e5e7eb", borderLeft:"3px solid #2563eb", borderRadius:"0 12px 12px 0", padding:"12px 14px" },
    pill:     (bg,color) => ({ fontSize:11, padding:"3px 8px", borderRadius:20, background:bg, color }),
    iconBtn:  { background:"none", border:"none", cursor:"pointer", fontSize:16, color:"#9ca3af", padding:"2px 4px" },
  };

  const BarChart = ({ data, max, color, height=90, tipo }) => (
    <div style={{ display:"flex", alignItems:"flex-end", gap:3, height, paddingTop:6 }}>
      {data.map((d,i) => {
        const activo=isActive(tipo, d.key||d.nombre);
        return (
          <div key={i} onClick={() => d.total>0 && aplicarFiltro(tipo, d.key||d.nombre, d.nombre||d.dia)}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2, cursor:d.total>0?"pointer":"default" }}>
            <span style={{ fontSize:9, color:"#6b7280" }}>{d.total>0?d.total:""}</span>
            <div style={{ width:"100%", background:activo?"#1d4ed8":color, borderRadius:"3px 3px 0 0",
              height:Math.max((d.total/max)*(height-24),d.total>0?3:0), transition:"all 0.2s",
              outline:activo?"2px solid #1d4ed8":"none", outlineOffset:1 }} />
            <span style={{ fontSize:8, color:activo?"#1d4ed8":"#9ca3af", fontWeight:activo?600:400,
              textAlign:"center", maxWidth:48, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {d.nombre||d.dia}
            </span>
          </div>
        );
      })}
    </div>
  );

  const HorizBar = ({ data, max, colors, tipo }) => (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      {data.map((d,i) => {
        const activo=isActive(tipo, d.nombre);
        return (
          <div key={i} onClick={() => aplicarFiltro(tipo, d.nombre, d.nombre)}
            style={{ cursor:"pointer", padding:"2px 4px", borderRadius:5,
              background:activo?"#eff6ff":"transparent",
              border:activo?"1px solid #bfdbfe":"1px solid transparent", transition:"all 0.15s" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
              <span style={{ fontSize:10, color:activo?"#1d4ed8":"#374151", fontWeight:activo?600:400,
                maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.nombre}</span>
              <span style={{ fontSize:10, fontWeight:500 }}>{d.total}</span>
            </div>
            <div style={{ background:"#f3f4f6", borderRadius:3, height:5 }}>
              <div style={{ background:activo?"#1d4ed8":(colors?colors[i%colors.length]:"#2563eb"),
                borderRadius:3, height:5, width:`${(d.total/max)*100}%`, transition:"all 0.3s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );

  const ListaFiltrada = ({ lista }) => (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {lista.map(p => (
        <div key={p.id} style={{ padding:"8px 12px", background:"#f9fafb", borderRadius:8,
          border:"1px solid #f3f4f6", borderLeft:"3px solid #2563eb" }}>
          <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:4 }}>
            <div>
              <span style={{ fontSize:12, fontWeight:500 }}>🖥 {p.atm}</span>
              <span style={{ fontSize:11, color:"#6b7280", marginLeft:8 }}>🏢 {p.empresa}</span>
              <span style={{ fontSize:11, color:"#6b7280", marginLeft:8 }}>👤 {p.persona}</span>
            </div>
            <div style={{ display:"flex", gap:5, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontSize:10, padding:"2px 6px", borderRadius:20, background:"#eff6ff", color:"#1d4ed8" }}>🔑 {p.acceso}</span>
              <span style={{ fontSize:10, color:"#9ca3af" }}>📅 {p.fecha}</span>
              <span style={{ fontSize:10, color:"#9ca3af" }}>🕐 {p.hora}</span>
              {p.enviado
                ? <span style={{ fontSize:10, padding:"2px 6px", borderRadius:20, background:"#f0fdf4", color:"#15803d" }}>✓ enviado</span>
                : <span style={{ fontSize:10, padding:"2px 6px", borderRadius:20, background:"#f9fafb", color:"#9ca3af", border:"1px solid #e5e7eb" }}>guardado</span>}
            </div>
          </div>
          {p.motivo && <div style={{ fontSize:10, color:"#9ca3af", marginTop:3, fontStyle:"italic" }}>"{p.motivo}"</div>}
        </div>
      ))}
    </div>
  );

  return (
    <div style={s.wrap}>
      {toast && <div style={s.toast}>{toast}</div>}

      <div style={{ marginBottom:"1rem", paddingBottom:"0.75rem", borderBottom:"1px solid #e5e7eb", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:24 }}>🏧</div>
          <div>
            <h1 style={{ fontSize:18, fontWeight:500, margin:0 }}>Permisos de acceso ATM</h1>
            <p style={{ fontSize:11, color:"#9ca3af", marginTop:1 }}>Registro y control de ingresos a cajeros automáticos</p>
          </div>
        </div>
        <span style={{ fontSize:10, color:"#9ca3af", background:"#f3f4f6", padding:"2px 8px", borderRadius:20 }}>v1.0.0</span>
      </div>

      <div style={s.tabs}>
        <button style={s.tab(tab==="dashboard")} onClick={() => setTab("dashboard")}>📊 Dashboard</button>
        <button style={s.tab(tab==="form")}      onClick={() => setTab("form")}>📋 Nueva solicitud</button>
        <button style={s.tab(tab==="history")}   onClick={() => setTab("history")}>
          🕐 Historial {permisos.length>0 && `(${permisos.length})`}
        </button>
      </div>

      {/* ══════════════ DASHBOARD ══════════════ */}
      {tab === "dashboard" && (
        <>
          {/* Tarjetas */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:8 }}>
            {[
              { label:"Total permisos",   valor:totalPermisos,  icon:"📋", color:"#eff6ff", border:"#bfdbfe", text:"#1d4ed8", tipo:"total",  val:"total"    },
              { label:"Correos enviados", valor:totalEnviados,  icon:"✉",  color:"#f0fdf4", border:"#bbf7d0", text:"#15803d", tipo:"estado", val:"enviado"  },
              { label:"Solo guardados",   valor:totalGuardados, icon:"💾", color:"#fefce8", border:"#fde68a", text:"#92400e", tipo:"estado", val:"guardado" },
            ].map((c,i) => {
              const activo=filtroActivo?.tipo===c.tipo&&filtroActivo?.valor===c.val;
              return (
                <div key={i} onClick={() => c.tipo!=="total" && aplicarFiltro(c.tipo, c.val, c.label)}
                  style={{ background:c.color, border:`2px solid ${activo?c.text:c.border}`, borderRadius:10,
                    padding:"8px 14px", cursor:c.tipo!=="total"?"pointer":"default",
                    display:"flex", alignItems:"center", gap:10,
                    transform:activo?"scale(1.02)":"scale(1)", transition:"all 0.15s",
                    boxShadow:activo?`0 4px 14px ${c.border}`:"none" }}>
                  <div style={{ fontSize:22 }}>{c.icon}</div>
                  <div>
                    <div style={{ fontSize:24, fontWeight:700, color:c.text, lineHeight:1 }}>{c.valor}</div>
                    <div style={{ fontSize:10, color:c.text, opacity:0.8, marginTop:1 }}>{c.label}</div>
                    {activo && <div style={{ fontSize:9, color:c.text, fontWeight:600 }}>● Filtro activo</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPermisos === 0 ? (
            <div style={{ textAlign:"center", padding:"2rem", color:"#9ca3af" }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📊</div>
              <p>Aún no hay datos.</p>
              <button onClick={() => setTab("form")}
                style={{ marginTop:12, padding:"8px 16px", background:"#2563eb", color:"#fff", border:"none", borderRadius:8, fontSize:13, cursor:"pointer" }}>
                + Nueva solicitud
              </button>
            </div>
          ) : (
            <>
              {filtroActivo && (
                <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"6px 12px",
                  marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:12, color:"#1d4ed8" }}>🔍 <strong>{filtroActivo.label}</strong> — {permisosFiltrados.length} resultado(s)</span>
                  <button onClick={() => setFiltro(null)}
                    style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#1d4ed8", fontWeight:500 }}>
                    ✕ Quitar filtro
                  </button>
                </div>
              )}

              {filtroActivo ? (
                <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"1rem", maxHeight:420, overflowY:"auto" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:12, fontWeight:500 }}>📋 {filtroActivo.label}</span>
                    <span style={{ fontSize:11, color:"#9ca3af" }}>{permisosFiltrados.length} registro(s)</span>
                  </div>
                  {permisosFiltrados.length===0
                    ? <p style={{ fontSize:13, color:"#9ca3af", textAlign:"center" }}>Sin resultados.</p>
                    : <ListaFiltrada lista={permisosFiltrados} />}
                </div>
              ) : (
                <>
                  {/* 4 gráficas en una fila */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:8 }}>
                    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px" }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"#374151", marginBottom:1 }}>📅 Últimos 7 días</div>
                      <div style={{ fontSize:9, color:"#9ca3af", marginBottom:4 }}>Clic para filtrar</div>
                      <BarChart data={ultimos7dias} max={maxDia} color="#93c5fd" height={90} tipo="dia" />
                    </div>
                    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px", overflowY:"auto", maxHeight:160 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"#374151", marginBottom:1 }}>🔑 Por acceso</div>
                      <div style={{ fontSize:9, color:"#9ca3af", marginBottom:4 }}>Clic para filtrar</div>
                      {porAcceso.length===0 ? <p style={{ fontSize:11, color:"#9ca3af" }}>Sin datos</p>
                        : <HorizBar data={porAcceso} max={maxAcceso} colors={COLORS} tipo="acceso" />}
                    </div>
                    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px", overflowY:"auto", maxHeight:160 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"#374151", marginBottom:1 }}>🏢 Por empresa</div>
                      <div style={{ fontSize:9, color:"#9ca3af", marginBottom:4 }}>Clic para filtrar</div>
                      {porEmpresa.length===0 ? <p style={{ fontSize:11, color:"#9ca3af" }}>Sin datos</p>
                        : <HorizBar data={porEmpresa} max={maxEmpresa} colors={["#16a34a","#15803d","#166534","#14532d","#052e16","#bbf7d0"]} tipo="empresa" />}
                    </div>
                    <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px" }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"#374151", marginBottom:1 }}>🖥 Por ATM</div>
                      <div style={{ fontSize:9, color:"#9ca3af", marginBottom:4 }}>Clic para filtrar</div>
                      {porATM.length===0 ? <p style={{ fontSize:11, color:"#9ca3af" }}>Sin datos</p>
                        : <BarChart data={porATM} max={maxATM} color="#c4b5fd" height={90} tipo="atm" />}
                    </div>
                  </div>

                  {/* Tabla compacta */}
                  <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:"10px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontSize:11, fontWeight:500, color:"#374151" }}>🕐 Últimos registros</span>
                      {permisos.length>6 && (
                        <button onClick={() => setTab("history")}
                          style={{ fontSize:11, color:"#2563eb", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>
                          Ver todos ({permisos.length}) →
                        </button>
                      )}
                    </div>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                      <thead>
                        <tr style={{ background:"#f9fafb" }}>
                          {["ATM","Empresa","Acceso","Persona","Fecha","Hora","Estado"].map(h => (
                            <th key={h} style={{ padding:"5px 8px", textAlign:"left", color:"#6b7280", fontWeight:500,
                              fontSize:10, textTransform:"uppercase", borderBottom:"1px solid #e5e7eb" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {permisos.slice(0,6).map((p,i) => (
                          <tr key={p.id} style={{ borderBottom:"1px solid #f3f4f6", background:i%2===0?"#fff":"#fafafa" }}>
                            <td style={{ padding:"5px 8px", fontWeight:500, color:"#111", maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>🖥 {p.atm}</td>
                            <td style={{ padding:"5px 8px", color:"#374151" }}>{p.empresa}</td>
                            <td style={{ padding:"5px 8px" }}>
                              <span style={{ fontSize:9, padding:"1px 6px", borderRadius:20, background:"#eff6ff", color:"#1d4ed8", whiteSpace:"nowrap" }}>{p.acceso}</span>
                            </td>
                            <td style={{ padding:"5px 8px", color:"#374151", maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.persona}</td>
                            <td style={{ padding:"5px 8px", color:"#6b7280" }}>{p.fecha}</td>
                            <td style={{ padding:"5px 8px", color:"#6b7280" }}>{p.hora}</td>
                            <td style={{ padding:"5px 8px" }}>
                              {p.enviado
                                ? <span style={{ fontSize:9, padding:"1px 6px", borderRadius:20, background:"#f0fdf4", color:"#15803d" }}>✓ enviado</span>
                                : <span style={{ fontSize:9, padding:"1px 6px", borderRadius:20, background:"#f9fafb", color:"#9ca3af", border:"1px solid #e5e7eb" }}>guardado</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ══════════════ FORMULARIO ══════════════ */}
      {tab === "form" && (
        <>
          <div style={s.emailBox}>
            <span style={{ fontSize:22 }}>✉</span>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:11, fontWeight:500, color:"#1d4ed8", display:"block", marginBottom:4 }}>CORREOS DE DESTINO</label>
              <input type="text" value={email} placeholder="correo1@empresa.com, correo2@empresa.com"
                onChange={e => { setEmail(e.target.value); localStorage.setItem("atm-email", e.target.value); }}
                style={{ ...s.input, border:"1px solid #93c5fd", fontSize:13 }} />
              <span style={{ fontSize:11, color:"#93c5fd", marginTop:4, display:"block" }}>Separa las direcciones con coma ( , )</span>
            </div>
          </div>
          <div style={s.card}>
            <div style={s.grid2}>
              <div style={{ display:"flex", flexDirection:"column" }}>
                <label style={s.label}>Nombre del ATM</label>
                <input name="atm" value={form.atm} onChange={handleChange} placeholder="ATM-001 Centro Cívico" style={s.input} />
              </div>
              <div style={{ display:"flex", flexDirection:"column" }}>
                <label style={s.label}>Empresa</label>
                <input name="empresa" value={form.empresa} onChange={handleChange} placeholder="Nombre de la empresa" style={s.input} />
              </div>
              <div style={{ display:"flex", flexDirection:"column", gridColumn:"1 / -1" }}>
                <label style={s.label}>Solicitar acceso</label>
                <select name="acceso" value={form.acceso} onChange={handleChange} style={s.select}>
                  <option value="">Selecciona el tipo de acceso...</option>
                  {ACCESOS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div style={{ display:"flex", flexDirection:"column" }}>
                <label style={s.label}>Fecha de ingreso</label>
                <input type="date" name="fecha" value={form.fecha} onChange={handleChange} style={s.input} />
              </div>
              <div style={{ display:"flex", flexDirection:"column" }}>
                <label style={s.label}>Hora de ingreso</label>
                <input type="time" name="hora" value={form.hora} onChange={handleChange} style={s.input} />
              </div>
              <div style={{ display:"flex", flexDirection:"column", gridColumn:"1 / -1" }}>
                <label style={s.label}>Persona que ingresa</label>
                <input name="persona" value={form.persona} onChange={handleChange} placeholder="Nombre completo del técnico / responsable" style={s.input} />
              </div>
              <div style={{ display:"flex", flexDirection:"column", gridColumn:"1 / -1" }}>
                <label style={s.label}>Motivo</label>
                <textarea name="motivo" value={form.motivo} onChange={handleChange} placeholder="Describe el motivo del acceso al ATM..." style={s.textarea} />
              </div>
            </div>
            <div style={s.btnRow}>
              <button onClick={handleSaveOnly} style={s.btnSave} disabled={sending}>💾 Solo guardar</button>
              <button onClick={handleSendEmail} style={s.btnSend(sending)} disabled={sending}>
                {sending ? "Enviando..." : "✉ Guardar y enviar correo"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════ HISTORIAL ══════════════ */}
      {tab === "history" && (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontWeight:500, fontSize:15 }}>Historial de permisos</span>
            {permisos.length>0 && (
              <button onClick={() => { if(window.confirm("¿Eliminar todo el historial?")) save([]); }}
                style={{ padding:"5px 10px", background:"transparent", border:"1px solid #d1d5db", borderRadius:6, fontSize:12, cursor:"pointer", color:"#6b7280" }}>
                🗑 Limpiar todo
              </button>
            )}
          </div>
          {permisos.length>1 && (
            <input placeholder="Buscar por ATM, empresa o persona..." value={search}
              onChange={e => setSearch(e.target.value)} style={{ ...s.input, marginBottom:12 }} />
          )}
          {filtered.length===0 ? (
            <div style={{ textAlign:"center", padding:"2.5rem", color:"#9ca3af" }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
              <p>{permisos.length===0 ? "Aún no hay permisos registrados." : "Sin resultados."}</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filtered.map(p => (
                <div key={p.id} style={s.permCard}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:500, fontSize:15 }}>🖥 {p.atm}</div>
                      <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{new Date(p.createdAt).toLocaleString("es-EC")}</div>
                    </div>
                    <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                      {p.enviado && <button onClick={() => handleResend(p)} style={s.iconBtn} title="Reenviar" disabled={sending}>📨</button>}
                      <button onClick={() => handleDelete(p.id)} style={s.iconBtn} title="Eliminar">✕</button>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                    <span style={s.pill("#eff6ff","#1d4ed8")}>🔑 {p.acceso}</span>
                    <span style={s.pill("#f3f4f6","#374151")}>🏢 {p.empresa}</span>
                    {p.enviado
                      ? <span style={s.pill("#f0fdf4","#15803d")}>✓ {p.emailTo}</span>
                      : <span style={s.pill("#f9fafb","#9ca3af")}>Solo guardado</span>}
                  </div>
                  <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:12, color:"#6b7280" }}>
                    <span>📅 {p.fecha}</span>
                    <span>🕐 {p.hora}</span>
                    <span>👤 {p.persona}</span>
                  </div>
                  {p.motivo && (
                    <div style={{ fontSize:12, color:"#6b7280", marginTop:6, paddingTop:6, borderTop:"1px solid #f3f4f6", fontStyle:"italic" }}>
                      "{p.motivo}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}