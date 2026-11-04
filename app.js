const { useState, useEffect, useRef } = React;

// --- CONFIGURAÇÃO DO REALTIME DATABASE DO MUNDO SENAI 2026 ---
const firebaseConfig = {
  apiKey: "AIzaSyAydShRse8ZFc1lVU_HNCtuJVmJCTaf3d4",
  authDomain: "vota-mundo-senai2026.firebaseapp.com",
  databaseURL: "https://vota-mundo-senai2026-default-rtdb.firebaseio.com",
  projectId: "vota-mundo-senai2026",
  storageBucket: "vota-mundo-senai2026.firebasestorage.app",
  messagingSenderId: "793079994609",
  appId: "1:793079994609:web:cac7a7634ea1170f0df150"
};

// --- FUNÇÃO PARA GERAR O SOM DA URNA ELETRÔNICA (WEB AUDIO API) ---
const playUrnaSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // Primeiro tom (grave)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, ctx.currentTime);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Segundo tom (agudo - característico do pilili)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1400, ctx.currentTime);
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    // Execução dos sons
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.warn("Áudio não permitido ou indisponível:", e);
  }
};

function App() {
  const [view, setView] = useState('vote'); // 'vote', 'thankyou', 'admin'
  const [votes, setVotes] = useState([]);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [db, setDb] = useState(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  
  const [totemId, setTotemId] = useState(() => localStorage.getItem('totem_id') || 'Totem 01');
  const [chartType, setChartType] = useState('doughnut');
  
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const reportRef = useRef(null);

  // Prevenção de descanso de tela (Wake Lock API)
  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake Lock não suportado:', err);
      }
    };
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (wakeLock) wakeLock.release();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Trava de teclado (Apenas a tecla ESC abre o modal)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.keyCode === 27) {
        setShowUnlockModal(true);
        return;
      }
      if (showUnlockModal) return;
      
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [showUnlockModal]);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [view, showUnlockModal, showClearModal]);

  const handleTotemIdChange = (id) => {
    setTotemId(id);
    localStorage.setItem('totem_id', id);
  };

  // Inicialização do Firebase
  useEffect(() => {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      const realtimeDb = firebase.database();
      setDb(realtimeDb);
      setIsFirebaseConnected(true);
    } catch (err) {
      console.error("Erro ao inicializar Firebase:", err);
    }

    const localVotes = JSON.parse(localStorage.getItem('totem_votes') || '[]');
    setVotes(localVotes);
  }, []);

  // Escuta dados do Realtime Database
  useEffect(() => {
    if (!db) return;
    
    const votesRef = db.ref('votos');
    votesRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const remoteVotes = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).reverse();

        setVotes(remoteVotes);
        localStorage.setItem('totem_votes', JSON.stringify(remoteVotes));
      } else {
        setVotes([]);
        localStorage.setItem('totem_votes', JSON.stringify([]));
      }
    }, (error) => {
      console.warn("Falha no Realtime DB:", error);
    });

    return () => votesRef.off();
  }, [db]);

  // Função para registrar o voto + Tocar Som da Urna
  const handleVote = async (opinion, label) => {
    // Toca o som da urna ao votar
    playUrnaSound();

    const newVote = {
      opinion,
      label,
      totemId: totemId,
      date: new Date().toLocaleDateString('pt-BR'),
      time: new Date().toLocaleTimeString('pt-BR'),
      timestamp: new Date().toISOString()
    };

    setView('thankyou');

    if (db) {
      try {
        await db.ref('votos').push(newVote);
      } catch (e) {
        console.error("Erro ao gravar no Firebase:", e);
      }
    } else {
      const updatedLocal = [newVote, ...votes];
      setVotes(updatedLocal);
      localStorage.setItem('totem_votes', JSON.stringify(updatedLocal));
    }

    setTimeout(() => {
      setView('vote');
    }, 2500);
  };

  const handleClearDatabase = async () => {
    if (db) {
      try {
        await db.ref('votos').remove();
      } catch (e) {
        console.error("Erro ao limpar dados no Firebase:", e);
      }
    }
    
    localStorage.removeItem('totem_votes');
    setVotes([]);
    setShowClearModal(false);
  };

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passwordInput === 'senai2026') {
      setShowUnlockModal(false);
      setPasswordInput('');
      setAuthError(false);
      setView('admin');
    } else {
      setAuthError(true);
    }
  };

  const exportCSV = () => {
    if (votes.length === 0) return alert("Não há votos registrados.");
    
    let csvContent = "data:text/csv;charset=utf-8,ID,Totem,Opiniao,Data,Hora,Timestamp\n";
    votes.forEach(v => {
      csvContent += `"${v.id || ''}","${v.totemId || 'Totem 01'}","${v.label}","${v.date}","${v.time}","${v.timestamp}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `votos_mundo_senai_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    if (votes.length === 0) return alert("Não há dados para gerar PDF.");
    const element = reportRef.current;
    
    const opt = {
      margin:       0.3,
      filename:     `relatorio_satisfacao_mundo_senai_${new Date().toISOString().slice(0,10)}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, backgroundColor: '#051D42' },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save();
  };

  useEffect(() => {
    if (view === 'admin' && chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const totalVerde = votes.filter(v => v.opinion === 'muito_satisfeito').length;
      const totalAmarelo = votes.filter(v => v.opinion === 'satisfeito').length;
      const totalVermelho = votes.filter(v => v.opinion === 'insatisfeito').length;

      const ctx = chartRef.current.getContext('2d');
      
      chartInstance.current = new Chart(ctx, {
        type: chartType,
        data: {
          labels: ['Muito Satisfeito', 'Satisfeito', 'Insatisfeito'],
          datasets: [{
            label: 'Quantidade de Votos',
            data: [totalVerde, totalAmarelo, totalVermelho],
            backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
            borderRadius: chartType === 'bar' ? 8 : 0,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              display: chartType === 'doughnut',
              labels: { color: '#F4F6F9', font: { size: 14, family: 'Montserrat' } } 
            }
          },
          scales: chartType === 'bar' ? {
            y: { ticks: { color: '#94A3B8' }, grid: { color: '#1E293B' } },
            x: { ticks: { color: '#F4F6F9', font: { size: 12, weight: 'bold', family: 'Montserrat' } }, grid: { display: false } }
          } : {}
        }
      });
    }
  }, [view, votes, chartType]);

  return (
    <div className="h-screen w-screen flex flex-col justify-between p-4 sm:p-8 bg-senai-deepbg text-slate-100 relative select-none">
      
      <button 
        onClick={() => setShowUnlockModal(true)}
        className="absolute top-4 right-4 opacity-20 hover:opacity-100 transition-opacity bg-senai-darkblue text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold z-50"
      >
        ⚙️ Config / Admin (ESC)
      </button>

      {/* --- TELA DE VOTAÇÃO TOUCH --- */}
      {view === 'vote' && (
        <div className="h-full flex flex-col justify-between py-2 max-w-5xl mx-auto w-full">
          
          <header className="text-center space-y-3">
            <div className="flex justify-center items-center pt-2">
              <img 
                src="Logo_Senai_Branco_Fundo_Transparente.png" 
                alt="Logo Sistema FIEP SENAI" 
                className="h-16 sm:h-20 object-contain drop-shadow-md"
              />
            </div>

            <div className="pt-1">
              <span className="bg-senai-orange/20 text-senai-orange border border-senai-orange/40 text-xs sm:text-sm font-extrabold px-4 py-1.5 rounded-full uppercase tracking-widest">
                Mundo SENAI 2026 • {totemId}
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black font-display text-white tracking-tight pt-1">
              Como foi sua experiência na feira?
            </h1>
            <p className="text-slate-300 text-base sm:text-lg">Toque em uma das opções abaixo para registrar sua opinião</p>
          </header>

          <main className="grid grid-cols-1 md:grid-cols-3 gap-6 my-auto py-4">
            
            <button
              onClick={() => handleVote('muito_satisfeito', 'Muito Satisfeito')}
              className="group bg-senai-darkblue/90 hover:bg-senai-darkblue active:scale-95 transition-all duration-200 rounded-3xl p-8 flex flex-col items-center justify-between border-2 border-emerald-500/80 shadow-[0_0_30px_rgba(16,185,129,0.2)] min-h-[300px]"
            >
              <div className="bg-emerald-950/60 p-6 rounded-2xl mb-4 text-emerald-400 group-hover:scale-110 transition-transform border border-emerald-500/30">
                <i data-lucide="smile" className="w-20 h-20 stroke-[1.5]"></i>
              </div>
              <div className="text-center">
                <h2 className="text-3xl font-black font-display text-white">Muito Satisfeito</h2>
                <p className="text-slate-300 text-sm mt-1">Excelente experiência!</p>
              </div>
            </button>

            <button
              onClick={() => handleVote('satisfeito', 'Satisfeito')}
              className="group bg-senai-darkblue/90 hover:bg-senai-darkblue active:scale-95 transition-all duration-200 rounded-3xl p-8 flex flex-col items-center justify-between border-2 border-amber-500/80 shadow-[0_0_30px_rgba(245,158,11,0.2)] min-h-[300px]"
            >
              <div className="bg-amber-950/60 p-6 rounded-2xl mb-4 text-amber-400 group-hover:scale-110 transition-transform border border-amber-500/30">
                <i data-lucide="meh" className="w-20 h-20 stroke-[1.5]"></i>
              </div>
              <div className="text-center">
                <h2 className="text-3xl font-black font-display text-white">Satisfeito</h2>
                <p className="text-slate-300 text-sm mt-1">Atendeu expectativas</p>
              </div>
            </button>

            <button
              onClick={() => handleVote('insatisfeito', 'Insatisfeito')}
              className="group bg-senai-darkblue/90 hover:bg-senai-darkblue active:scale-95 transition-all duration-200 rounded-3xl p-8 flex flex-col items-center justify-between border-2 border-rose-500/80 shadow-[0_0_30px_rgba(239,68,68,0.2)] min-h-[300px]"
            >
              <div className="bg-rose-950/60 p-6 rounded-2xl mb-4 text-rose-400 group-hover:scale-110 transition-transform border border-rose-500/30">
                <i data-lucide="frown" className="w-20 h-20 stroke-[1.5]"></i>
              </div>
              <div className="text-center">
                <h2 className="text-3xl font-black font-display text-white">Insatisfeito</h2>
                <p className="text-slate-300 text-sm mt-1">Pode melhorar</p>
              </div>
            </button>

          </main>

          <footer className="text-center text-xs text-slate-400 font-semibold tracking-wider uppercase">
            Sistema FIEP • SENAI Paraná • 2026
          </footer>
        </div>
      )}

      {/* --- TELA DE AGRADECIMENTO --- */}
      {view === 'thankyou' && (
        <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-24 h-24 bg-emerald-500/15 text-emerald-400 rounded-full flex items-center justify-center border-2 border-emerald-500/40 animate-bounce shadow-2xl shadow-emerald-500/20">
            <i data-lucide="check" className="w-12 h-12"></i>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black font-display text-white">Muito Obrigado!</h2>
          <p className="text-slate-300 text-xl sm:text-2xl">Sua avaliação ajuda a fortalecer a indústria do Paraná.</p>
        </div>
      )}

      {/* --- TELA DE ADMIN --- */}
      {view === 'admin' && (
        <div className="h-full flex flex-col overflow-y-auto max-w-6xl mx-auto w-full p-2">
          
          <div className="flex flex-wrap justify-between items-center border-b border-slate-800 pb-4 mb-6 gap-3">
            <div>
              <h2 className="text-2xl font-black font-display text-white">Painel Consolidado • Mundo SENAI 2026</h2>
              <p className="text-slate-400 text-sm">Monitoramento de satisfação em tempo real</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={exportPDF} 
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-1.5 shadow-lg"
              >
                📄 Gerar PDF
              </button>
              <button 
                onClick={exportCSV} 
                className="bg-senai-blue hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-sm font-bold transition shadow-lg"
              >
                📥 Baixar CSV
              </button>
              <button 
                onClick={() => setShowClearModal(true)} 
                className="bg-rose-950/80 border border-rose-800/80 hover:bg-rose-900 text-rose-300 px-3.5 py-2 rounded-xl text-sm font-bold transition"
              >
                🗑️ Limpar Banco
              </button>
              <button 
                onClick={() => setView('vote')} 
                className="bg-senai-orange hover:bg-orange-600 text-white px-3.5 py-2 rounded-xl text-sm font-bold transition shadow-lg"
              >
                Voltar ao Totem
              </button>
            </div>
          </div>

          <div ref={reportRef} className="p-2 bg-senai-deepbg">
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-senai-darkblue border border-slate-800 p-5 rounded-2xl shadow-xl">
                <div className="text-slate-400 text-sm font-semibold">Total Geral de Votos</div>
                <div className="text-4xl font-black font-display text-white mt-2">{votes.length}</div>
              </div>
              <div className="bg-senai-darkblue border border-slate-800 p-5 rounded-2xl shadow-xl">
                <div className="text-slate-400 text-sm font-semibold">Índice de Satisfação</div>
                <div className="text-4xl font-black font-display text-emerald-400 mt-2">
                  {votes.length > 0 
                    ? Math.round((votes.filter(v => v.opinion !== 'insatisfeito').length / votes.length) * 100) 
                    : 0}%
                </div>
              </div>
              <div className="bg-senai-darkblue border border-slate-800 p-5 rounded-2xl shadow-xl">
                <div className="text-slate-400 text-sm font-semibold">Identificação da Máquina</div>
                <select 
                  value={totemId} 
                  onChange={(e) => handleTotemIdChange(e.target.value)}
                  className="mt-2 bg-senai-deepbg border border-slate-700 text-white rounded-lg px-3 py-1.5 font-bold text-sm"
                >
                  <option value="Totem 01">Totem 01</option>
                  <option value="Totem 02">Totem 02</option>
                  <option value="Totem 03">Totem 03</option>
                </select>
              </div>
              <div className="bg-senai-darkblue border border-slate-800 p-5 rounded-2xl shadow-xl">
                <div className="text-slate-400 text-sm font-semibold">Status do Firebase</div>
                <div className="text-sm font-bold mt-3 flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${isFirebaseConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  {isFirebaseConnected ? 'Realtime DB Online' : 'Modo Offline (Local)'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              
              <div className="bg-senai-darkblue border border-slate-800 p-6 rounded-2xl h-80 flex flex-col shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold font-display text-white">Distribuição de Avaliações</h3>
                  <div className="flex bg-senai-deepbg p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setChartType('doughnut')}
                      className={`px-3 py-1 rounded-lg font-bold transition ${chartType === 'doughnut' ? 'bg-senai-blue text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      🍕 Pizza
                    </button>
                    <button
                      onClick={() => setChartType('bar')}
                      className={`px-3 py-1 rounded-lg font-bold transition ${chartType === 'bar' ? 'bg-senai-blue text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      📊 Colunas
                    </button>
                  </div>
                </div>
                <div className="w-full h-full relative">
                  <canvas ref={chartRef}></canvas>
                </div>
              </div>

              <div className="bg-senai-darkblue border border-slate-800 p-6 rounded-2xl h-80 flex flex-col shadow-xl">
                <h3 className="text-lg font-bold font-display text-white mb-4">Últimos Registros (Todas as Máquinas)</h3>
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-senai-deepbg text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-2">Data/Hora</th>
                        <th className="p-2">Totem</th>
                        <th className="p-2">Avaliação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {votes.slice(0, 50).map((v, i) => (
                        <tr key={i} className="border-b border-slate-800/50">
                          <td className="p-2 font-mono text-xs">{v.date} {v.time}</td>
                          <td className="p-2 text-xs font-semibold text-senai-orange">{v.totemId || 'Totem 01'}</td>
                          <td className="p-2 font-bold">{v.label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* --- MODAL CONFIRMAÇÃO DE LIMPEZA --- */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-senai-darkblue border border-rose-900/60 p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-500/20 text-2xl">
              ⚠️
            </div>
            <h3 className="text-xl font-bold font-display text-white">Zerar Todos os Votos?</h3>
            <p className="text-slate-300 text-sm">Esta ação apagará permanentemente todos os registros do Firebase. Deseja continuar?</p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowClearModal(false)}
                className="w-1/2 bg-slate-800 text-slate-300 py-3 rounded-xl font-bold hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearDatabase}
                className="w-1/2 bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-500 transition"
              >
                Sim, Limpar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE SENHA (senai2026) --- */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUnlock} className="bg-senai-darkblue border border-slate-700 p-6 rounded-3xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold font-display text-white text-center">Acesso Restrito SENAI</h3>
            <p className="text-slate-300 text-sm text-center">Digite a senha para desbloquear o painel.</p>
            
            <input
              type="password"
              placeholder="Senha de acesso"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-senai-deepbg border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-senai-orange text-center font-mono text-lg"
              autoFocus
            />

            {authError && (
              <p className="text-rose-500 text-xs text-center font-semibold">Senha incorreta.</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowUnlockModal(false); setAuthError(false); }}
                className="w-1/2 bg-slate-800 text-slate-300 py-3 rounded-xl font-bold hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="w-1/2 bg-senai-orange text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition"
              >
                Entrar
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);