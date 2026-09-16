/**
 * ThermoLink Mobile Web App Controller (V2.0 com Supabase Realtime)
 * Fortlev Tank, Animated Arrow Conduit, Desalination Flow Square & Mandatory Manual Timer
 */

// --------------------------- CONFIGURAÇÕES DE NUVEM (SUPABASE) ---------------------------
const SUPABASE_URL = "https://oihzayyjpczdmocsxzgz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Cu1IkJ64sMm4yy6WnTUkVA_moP44Oaj";
const DEVICE_ID = "dessalinizador_0001";

// Application State
const appState = {
  espUrl: 'http://192.168.4.1',
  pollInterval: 1200,
  dataSource: 'simulated', // 'supabase', 'local', 'simulated'
  lastDataTimestamp: 0,
  manualCommandTimestamp: 0,
  
  // Real or Simulated Telemetry
  nivel: 50,            // Water level percentage (0 to 100%)
  boiaMecanica: false,  // Safety float switch
  modo: 0,              // 0: Automático, 1: Manual Ligado, 2: Manual Desligado
  comandoLigar: false,  // Active pumping state
  
  dessalinizador: {
    online: true,
    vazao_l_min: 0.0,
    rele1: false,
    rele2: false,
    erro_fluxo: false
  },

  // Manual timer countdown
  timerTotalSegundos: 0,
  timerRestanteSegundos: 0,
  timerInterval: null,

  // Selected preset in modal
  selectedDurationSeconds: 900 // Default 15 min (900s)
};

// ======================== DOM Elements ========================
const el = {};

// Supabase Client Instance
let sb = null;
let realtimeChannel = null;

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  initSupabase();
  bindEvents();
  startAppLoop();
});

function cacheElements() {
  el.statusPill = document.getElementById('statusPill');
  el.statusPillText = document.getElementById('statusPillText');

  // Cloud & Safety Badges
  el.cloudSourcePill = document.getElementById('cloudSourcePill');
  el.cloudSourceText = document.getElementById('cloudSourceText');
  el.boiaMecanicaPill = document.getElementById('boiaMecanicaPill');
  el.boiaMecanicaText = document.getElementById('boiaMecanicaText');

  // Tank & Water
  el.tankWaterMass = document.getElementById('tankWaterMass');
  el.levelNumber = document.getElementById('levelNumber');
  el.levelStatusText = document.getElementById('levelStatusText');
  el.levelBarFill = document.getElementById('levelBarFill');

  // Pipe & Arrows
  el.pipeConduit = document.getElementById('pipeConduit');

  // Desalination & Flow
  el.desalUnitBox = document.getElementById('desalUnitBox');
  el.desalStateTag = document.getElementById('desalStateTag');
  el.ledPump = document.getElementById('ledPump');
  el.flowMeterSquare = document.getElementById('flowMeterSquare');
  el.flowNumber = document.getElementById('flowNumber');
  el.flowSubText = document.getElementById('flowSubText');

  // Action Buttons
  el.btnAutoMode = document.getElementById('btnAutoMode');
  el.btnManualToggle = document.getElementById('btnManualToggle');
  el.manualToggleText = document.getElementById('manualToggleText');
  el.manualToggleSub = document.getElementById('manualToggleSub');

  // Countdown Strip
  el.countdownStrip = document.getElementById('countdownStrip');
  el.countdownDigits = document.getElementById('countdownDigits');

  // Modal
  el.timerModalBackdrop = document.getElementById('timerModalBackdrop');
  el.presetChips = document.querySelectorAll('.preset-chip');
  el.customTimeInputs = document.getElementById('customTimeInputs');
  el.inputCustomHours = document.getElementById('inputCustomHours');
  el.inputCustomMinutes = document.getElementById('inputCustomMinutes');
  el.btnConfirmStartManual = document.getElementById('btnConfirmStartManual');

  // Toast
  el.toastBox = document.getElementById('toastBox');
}

// ======================== Supabase Initialization ========================
function initSupabase() {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('[Supabase] Cliente conectado com sucesso a:', SUPABASE_URL);

      setupSupabaseRealtime();
      fetchStatusFromSupabase();
    } catch (e) {
      console.warn('[Supabase] Falha ao inicializar cliente:', e);
    }
  } else {
    console.warn('[Supabase] Biblioteca CDN não disponível. Rodando com fallback local/simulado.');
  }
}

// Escuta alterações em tempo real via WebSocket
function setupSupabaseRealtime() {
  if (!sb) return;

  try {
    realtimeChannel = sb
      .channel('realtime:device_state')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'device_state',
          filter: `device_id=eq.${DEVICE_ID}`
        },
        (payload) => {
          if (payload && payload.new) {
            console.log('[Supabase Realtime] Telemetria em tempo real:', payload.new);
            applyTelemetryData(payload.new, 'supabase');
          }
        }
      )
      .subscribe((status) => {
        console.log('[Supabase Realtime Status]:', status);
        if (status === 'SUBSCRIBED') {
          appState.dataSource = 'supabase';
          updateDataSourceBadge();
        }
      });
  } catch (err) {
    console.warn('[Supabase Realtime Error]:', err);
  }
}

// Consulta de estado via REST no Supabase
async function fetchStatusFromSupabase() {
  if (!sb) return false;

  try {
    const { data, error } = await sb
      .from('device_state')
      .select('*')
      .eq('device_id', DEVICE_ID)
      .maybeSingle();

    if (error) {
      console.warn('[Supabase REST Query Error]:', error.message);
      return false;
    }

    if (data) {
      applyTelemetryData(data, 'supabase');
      return true;
    }
  } catch (err) {
    console.warn('[Supabase Query Exception]:', err);
  }
  return false;
}

// Aplica a telemetria recebida do ESP ou do banco de dados ao estado da aplicação
function applyTelemetryData(data, source) {
  appState.dataSource = source;
  appState.lastDataTimestamp = Date.now();

  // Telemetria dos sensores: atualiza sempre para visualização informativa
  appState.nivel = Number(data.nivel ?? appState.nivel);
  appState.boiaMecanica = Boolean(data.boia_mecanica);
  appState.dessalinizador.online = Boolean(data.boia_online);

  // Proteção contra falha de fluxo (VÁLIDA NO MODO AUTOMÁTICO)
  // No modo manual, o temporizador definido pelo operador tem prioridade absoluta!
  if (data.erro_fluxo) {
    appState.dessalinizador.erro_fluxo = true;
    if (appState.modo === 0 && appState.comandoLigar) {
      showToast('🚨 Bloqueio de proteção: Sem fluxo de água no modo automático!');
      appState.comandoLigar = false;
    }
  } else {
    appState.dessalinizador.erro_fluxo = false;
  }

  // =========================================================================
  // REGRA DE OURO DO MODO MANUAL:
  // Se o modo manual está ativo no temporizador (ex: 15 min),
  // NENHUMA leitura externa ou sensor de boia pode cancelar o manual!
  // =========================================================================
  if (appState.modo === 1 && appState.timerRestanteSegundos > 0) {
    appState.comandoLigar = true;
    
    // Se o ESP estiver online e enviando vazão real, exibe a vazão real
    if (data.fluxo_l_min !== undefined && Number(data.fluxo_l_min) > 0) {
      appState.dessalinizador.vazao_l_min = Number(data.fluxo_l_min);
    }
    if (data.rele1 !== undefined) appState.dessalinizador.rele1 = Boolean(data.rele1);
    if (data.rele2 !== undefined) appState.dessalinizador.rele2 = Boolean(data.rele2);
  } else if (appState.modo !== 1) {
    // Fora do modo manual (Auto ou Desligado), sincroniza normalmente com o banco
    appState.modo = Number(data.modo ?? appState.modo);
    appState.comandoLigar = Boolean(data.deve_ligar || data.rele1);
    if (data.fluxo_l_min !== undefined) {
      appState.dessalinizador.vazao_l_min = Number(data.fluxo_l_min);
    }
    appState.dessalinizador.rele1 = Boolean(data.rele1);
    appState.dessalinizador.rele2 = Boolean(data.rele2);
  } else {
    // appState.modo === 1 e timerRestanteSegundos === 0 (ex: página recém-aberta)
    if (Number(data.modo) === 0) {
      // ESP já retornou ao automático
      appState.modo = 0;
      appState.comandoLigar = Boolean(data.deve_ligar || data.rele1);
    } else {
      appState.comandoLigar = true;
    }
  }

  updateDataSourceBadge();
  evaluateSystemState();
  updateVisuals();
}

function updateDataSourceBadge() {
  if (!el.cloudSourcePill || !el.cloudSourceText) return;

  if (appState.dataSource === 'supabase') {
    el.cloudSourcePill.className = 'source-badge cloud';
    el.cloudSourceText.textContent = '☁️ Supabase Nuvem';
  } else if (appState.dataSource === 'local') {
    el.cloudSourcePill.className = 'source-badge local';
    el.cloudSourceText.textContent = '📶 ESP8266 Local';
  } else {
    el.cloudSourcePill.className = 'source-badge simulated';
    el.cloudSourceText.textContent = '⚡ Simulação Ativa';
  }

  // Atualiza badge de segurança da Boia Mecânica
  if (el.boiaMecanicaPill && el.boiaMecanicaText) {
    if (appState.boiaMecanica) {
      if (appState.modo === 1) {
        // No modo manual, a boia mecânica é expressamente ignorada
        el.boiaMecanicaPill.className = 'boia-badge alarm';
        el.boiaMecanicaText.textContent = '⚠️ Boia Mecânica: ALERTA (IGNORADA NO MANUAL)';
      } else {
        el.boiaMecanicaPill.className = 'boia-badge alarm';
        el.boiaMecanicaText.textContent = '🚨 BOIA MECÂNICA: ALERTA (BLOQUEIO AUTO)';
      }
    } else {
      el.boiaMecanicaPill.className = 'boia-badge ok';
      el.boiaMecanicaText.textContent = '🛡️ Boia Mecânica: NORMAL';
    }
  }
}

// ======================== Event Listeners ========================
function bindEvents() {
  // Botão Modo Automático
  el.btnAutoMode.addEventListener('click', () => {
    setModeAuto();
  });

  // Botão Manual: Alterna entre Iniciar (abrindo modal com tempo) e Parar Manual
  el.btnManualToggle.addEventListener('click', () => {
    if (appState.modo === 1 && appState.comandoLigar) {
      // Se já estiver funcionando no manual, o clique funciona como DESLIGAR / PARAR IMEDIATO
      stopManual();
    } else {
      // Se estiver parado ou em auto, abre o modal obrigatório de seleção de tempo
      openTimerModal();
    }
  });

  // Seleção de tempo pré-definido no Modal (Chips)
  el.presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      el.presetChips.forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      
      const secVal = chip.dataset.sec;
      if (secVal === 'custom') {
        el.customTimeInputs.style.display = 'grid';
      } else {
        el.customTimeInputs.style.display = 'none';
        appState.selectedDurationSeconds = parseInt(secVal, 10);
      }
    });
  });

  // Botão de Confirmação do Modal de Tempo
  el.btnConfirmStartManual.addEventListener('click', () => {
    const selectedChip = document.querySelector('.preset-chip.selected');
    if (selectedChip && selectedChip.dataset.sec === 'custom') {
      const h = parseInt(el.inputCustomHours.value, 10) || 0;
      const m = parseInt(el.inputCustomMinutes.value, 10) || 0;
      const totalSec = (h * 3600) + (m * 60);
      if (totalSec <= 0) {
        showToast('Informe um tempo superior a 0 minutos');
        return;
      }
      appState.selectedDurationSeconds = totalSec;
    }

    startManualWithTimer(appState.selectedDurationSeconds);
    closeTimerModal();
  });
}

// ======================== Modal de Tempo ========================
function openTimerModal() {
  el.timerModalBackdrop.classList.add('show');
}

function closeTimerModal() {
  el.timerModalBackdrop.classList.remove('show');
}
window.closeTimerModal = closeTimerModal;

// ======================== Lógica de Controle dos Modos ========================

// 1. Ativar Modo Automático
function setModeAuto() {
  appState.modo = 0;
  appState.manualCommandTimestamp = 0;
  if (appState.timerInterval) clearInterval(appState.timerInterval);
  el.countdownStrip.style.display = 'none';

  // No modo automático, se o nível estiver cheio ou a boia mecânica ativada, desliga
  if (appState.boiaMecanica || appState.nivel >= 100) {
    appState.comandoLigar = false;
  }

  dispatchCommand('auto', 0);
  showToast('Modo Automático Ativado (Controle por Boia)');
  evaluateSystemState();
  updateVisuals();
}

// 2. Iniciar Modo Manual com Temporizador (IGNORA BOIAS, RESPEITA FLUXO)
function startManualWithTimer(seconds) {
  console.log(`[MANUAL] Iniciando dessalinizador por ${seconds} segundos (ignorando boias)...`);
  
  appState.modo = 1;
  appState.comandoLigar = true;
  appState.manualCommandTimestamp = Date.now();
  appState.timerTotalSegundos = seconds;
  appState.timerRestanteSegundos = seconds;
  appState.dessalinizador.erro_fluxo = false;

  // Inicia contagem regressiva visual
  if (appState.timerInterval) clearInterval(appState.timerInterval);
  appState.timerInterval = setInterval(() => {
    if (appState.timerRestanteSegundos > 0 && appState.modo === 1) {
      appState.timerRestanteSegundos--;
      el.countdownDigits.textContent = formatTime(appState.timerRestanteSegundos);
    } else if (appState.modo === 1) {
      // Tempo limite do modo manual esgotado -> desliga e entra diretamente no modo automático!
      clearInterval(appState.timerInterval);
      showToast('Tempo limite atingido! Retornando ao Modo Automático.');
      setModeAuto();
    }
  }, 1000);

  el.countdownStrip.style.display = 'flex';
  el.countdownDigits.textContent = formatTime(appState.timerRestanteSegundos);

  // Envia comando para o banco de dados Supabase e/ou rede local do ESP8266
  dispatchCommand('ligar', seconds);
  showToast(`Ligado Manual (${formatDurationLabel(seconds)}) ⏱️`);
  
  // Atualiza a tela imediatamente (partida instantânea dos visuais)
  evaluateSystemState();
  updateVisuals();
}

// 3. Parar Manual / Desligamento de Emergência
function stopManual() {
  console.log('[MANUAL] Desligamento manual solicitado pelo operador.');
  appState.modo = 2; // Manual Desligado
  appState.comandoLigar = false;
  appState.manualCommandTimestamp = Date.now();
  if (appState.timerInterval) clearInterval(appState.timerInterval);
  el.countdownStrip.style.display = 'none';

  dispatchCommand('desligar', 0);
  showToast('Dessalinizador Desligado!');
  evaluateSystemState();
  updateVisuals();
}

// ======================== Despacho de Comandos (Nuvem & Local) ========================
async function dispatchCommand(tipo, seconds = 0) {
  let supabaseCommand = tipo;
  if (tipo === 'ligar') supabaseCommand = 'manual_on';
  else if (tipo === 'desligar') supabaseCommand = 'manual_off';
  else if (tipo === 'auto') supabaseCommand = 'auto';

  // 1. Envia comando para a fila do Supabase e atualiza o device_state imediatamente
  if (sb) {
    try {
      // Grava comando na fila de comandos para o ESP
      sb.from('control_commands')
        .insert({
          device_id: DEVICE_ID,
          command: supabaseCommand,
          duration_seconds: seconds,
          executed: false
        })
        .then(({ error }) => {
          if (!error) console.log(`[Supabase Cloud] Comando '${supabaseCommand}' enfileirado.`);
          else console.warn('[Supabase Cloud Insert Error]:', error.message);
        });

      // Atualiza o device_state instantaneamente para sincronia imediata entre navegadores
      const updateData = {
        modo: (tipo === 'ligar' ? 1 : (tipo === 'desligar' ? 2 : 0)),
        deve_ligar: (tipo === 'ligar'),
        rele1: (tipo === 'ligar'),
        rele2: (tipo === 'ligar'),
        updated_at: new Date().toISOString()
      };
      sb.from('device_state')
        .update(updateData)
        .eq('device_id', DEVICE_ID)
        .then(({ error }) => {
          if (!error) console.log('[Supabase Cloud] device_state sincronizado.');
        });

    } catch (err) {
      console.warn('[Supabase Dispatch Error]:', err);
    }
  }

  // 2. Se estiver na rede local do ESP8266, envia requisição REST com tempo limite
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const url = `${appState.espUrl}/api/comando?tipo=${tipo}&segundos=${seconds}`;
    await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    console.log(`[ESP8266 Local] Comando '${tipo}' entregue com sucesso.`);
  } catch (e) {
    // Modo nuvem ou ESP desconectado do AP
  }
}

// ======================== Loop de Consulta de Dados ========================
async function fetchStatusFromESP() {
  // 1. Tenta API REST local do ESP8266 (se conectado diretamente ao Wi-Fi dele)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${appState.espUrl}/api/status`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      applyTelemetryData(data, 'local');
      return;
    }
  } catch (e) {
    // Não está na rede local do ESP8266
  }

  // 2. Consulta pelo banco Supabase (Nuvem em tempo real)
  const okSupabase = await fetchStatusFromSupabase();
  if (okSupabase) {
    return;
  }

  // 3. Fallback: Se não há rede local nem dados no Supabase, roda simulação interativa
  if (Date.now() - appState.lastDataTimestamp > 4000) {
    appState.dataSource = 'simulated';
    updateDataSourceBadge();
    stepSimulation();
  }
}

// ======================== Motor de Simulação Física ========================
function stepSimulation() {
  // No modo automático (modo === 0), segue a lógica da boia
  if (appState.modo === 0) {
    if (appState.nivel <= 0) {
      appState.comandoLigar = true;
    } else if (appState.nivel >= 100 || appState.boiaMecanica) {
      appState.comandoLigar = false;
    }
  }

  evaluateSystemState();

  // No modo manual (modo === 1), bombeia INDEPENDENTE de boia mecânica ou nível 100%!
  // Só para se for comandado parar ou houver erro de fluxo
  const podeBombear = (appState.modo === 1) 
    ? (appState.comandoLigar && !appState.dessalinizador.erro_fluxo)
    : (appState.comandoLigar && !appState.boiaMecanica && !appState.dessalinizador.erro_fluxo);

  if (podeBombear) {
    appState.dessalinizador.vazao_l_min = 14.2 + (Math.sin(Date.now() / 1500) * 0.5);
    appState.dessalinizador.rele1 = true;
    appState.dessalinizador.rele2 = true;
    appState.nivel = Math.min(100, appState.nivel + 0.35); // Enche gradualmente
  } else {
    appState.dessalinizador.vazao_l_min = 0.0;
    appState.dessalinizador.rele1 = false;
    appState.dessalinizador.rele2 = false;
    if (appState.nivel > 0 && appState.modo !== 1) {
      appState.nivel = Math.max(0, appState.nivel - 0.05); // Consumo lento em repouso
    }
  }
}

function evaluateSystemState() {
  // Apenas desliga no automático por boia mecânica. No manual, a boia é ignorada!
  if (appState.modo === 0 && appState.boiaMecanica) {
    appState.comandoLigar = false;
  }
}

// ======================== Renderizador Visual da Interface ========================
function updateVisuals() {
  const emManual = (appState.modo === 1 && appState.comandoLigar);
  
  // No modo manual, o bombeamento entra DIRETO e IMEDIATAMENTE independente de qualquer boia ou fluxo!
  const isPumping = emManual || (!appState.dessalinizador.erro_fluxo && appState.comandoLigar && appState.dessalinizador.vazao_l_min > 0.1);

  const nivelRound = Math.round(appState.nivel);

  // 1. Gráfico da Caixa d'Água Fortlev
  el.tankWaterMass.style.height = `${appState.nivel}%`;
  el.tankWaterMass.classList.toggle('rippling', isPumping);
  el.levelNumber.textContent = `${nivelRound}`;
  el.levelBarFill.style.width = `${appState.nivel}%`;

  if (appState.modo === 1) {
    // No modo manual, informa claramente que a boia está sendo ignorada
    if (appState.boiaMecanica) {
      el.levelStatusText.textContent = '⚠️ Boia Acionada (Ignorada no Manual)';
      el.levelStatusText.style.color = 'var(--amber)';
    } else if (appState.nivel >= 100) {
      el.levelStatusText.textContent = 'Caixa Cheia (Manual Forçado)';
      el.levelStatusText.style.color = 'var(--emerald-glow)';
    } else {
      el.levelStatusText.textContent = 'Operação Manual em Andamento';
      el.levelStatusText.style.color = 'var(--accent-cyan)';
    }
  } else {
    // Modo automático
    if (appState.boiaMecanica) {
      el.levelStatusText.textContent = '🚨 Alerta: Boia Mecânica (Bloqueado)';
      el.levelStatusText.style.color = 'var(--rose)';
    } else if (appState.nivel >= 100) {
      el.levelStatusText.textContent = 'Caixa Cheia (100%)';
      el.levelStatusText.style.color = 'var(--emerald-glow)';
    } else if (appState.nivel <= 0) {
      el.levelStatusText.textContent = 'Caixa Seca (0%)';
      el.levelStatusText.style.color = 'var(--rose)';
    } else if (appState.nivel < 50) {
      el.levelStatusText.textContent = 'Nível Baixo';
      el.levelStatusText.style.color = 'var(--amber)';
    } else {
      el.levelStatusText.textContent = 'Nível Adequado';
      el.levelStatusText.style.color = '#bae6fd';
    }
  }

  // 2. Tubulação de Alimentação com Partículas e Setas Animadas
  el.pipeConduit.classList.toggle('flowing', isPumping);

  // 3. Unidade do Dessalinizador e Mostrador de Vazão
  el.desalUnitBox.classList.toggle('active', isPumping);
  el.ledPump.classList.toggle('active', isPumping);
  el.flowMeterSquare.classList.toggle('flowing', isPumping);

  // Exibe a vazão real do sensor ou vazão nominal enquanto no manual
  let vazaoExibida = appState.dessalinizador.vazao_l_min;
  if (emManual && vazaoExibida <= 0.0) {
    vazaoExibida = 14.5;
  }
  el.flowNumber.textContent = isPumping ? vazaoExibida.toFixed(1) : '0.0';
  el.flowSubText.textContent = isPumping 
    ? (emManual ? 'Bombeando (Modo Manual Ativo)' : 'Bombeando para a caixa') 
    : 'Sem fluxo ativo';

  if (appState.dessalinizador.erro_fluxo && !emManual) {
    el.desalStateTag.textContent = 'ERRO FLUXO';
    el.desalStateTag.style.color = 'var(--rose)';
    el.statusPill.className = 'status-pill offline';
    el.statusPillText.textContent = 'SEM FLUXO';
  } else if (isPumping) {
    el.desalStateTag.textContent = emManual ? 'MANUAL ATIVO' : 'BOMBEANDO';
    el.desalStateTag.style.color = 'var(--accent-cyan)';
    el.statusPill.className = 'status-pill active-pumping';
    el.statusPillText.textContent = emManual ? 'MANUAL EM OPERAÇÃO' : 'EM OPERAÇÃO';
  } else {
    el.desalStateTag.textContent = 'PRONTO';
    el.desalStateTag.style.color = '#bae6fd';
    el.statusPill.className = 'status-pill online';
    el.statusPillText.textContent = 'ONLINE';
  }

  // 4. Estado Visual dos Botões de Ação
  el.btnAutoMode.classList.toggle('active-mode', appState.modo === 0);

  if (appState.modo === 1 && appState.comandoLigar) {
    el.btnManualToggle.classList.add('is-running');
    el.manualToggleText.textContent = 'DESLIGAR / PARAR';
    el.manualToggleSub.textContent = 'Parar Manual 🛑';
  } else {
    el.btnManualToggle.classList.remove('is-running');
    el.manualToggleText.textContent = 'LIGAR MANUAL';
    el.manualToggleSub.textContent = 'Definir Tempo ⏱️';
  }
}

// ======================== Loop Principal do App ========================
function startAppLoop() {
  setInterval(async () => {
    await fetchStatusFromESP();
    updateVisuals();
  }, appState.pollInterval);
}

// ======================== Funções Auxiliares ========================
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDurationLabel(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h} hora${h > 1 ? 's' : ''}`;
  return `${m} minutos`;
}

function showToast(msg) {
  el.toastBox.textContent = msg;
  el.toastBox.classList.add('show');
  setTimeout(() => el.toastBox.classList.remove('show'), 3000);
}
