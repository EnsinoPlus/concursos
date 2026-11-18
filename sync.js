// =====================================================================
// PROGRESSO NA CONTA — sincroniza o progresso do aluno com o banco (tabela progresso).
// O navegador continua guardando uma cópia local; a cópia do banco acompanha o aluno
// em qualquer aparelho. Carregue depois de app.js e auth.js.
// =====================================================================
const CHAVES_SYNC = ['areaId', 'respostas', 'dias', 'srs', 'cardsCriados', 'edital', 'editalAbertos', 'redacao'];
function cargaSync(d) {
  const o = {};
  CHAVES_SYNC.forEach(k => { if (d[k] !== undefined && d[k] !== null) o[k] = d[k]; });
  return o;
}
let snapshotSync = JSON.stringify(cargaSync(ler()));
let sincronizado = false;   // só envia depois de decidir, no login, qual cópia vale
let pendenteSync = false;
let temporizadorSync = null;

// Toda gravação do progresso passa por aqui: marca a hora da mudança e agenda o envio.
const salvarOriginal = salvar;
salvar = function (d) {
  if (usuario) d._dono = usuario.id;
  const s = JSON.stringify(cargaSync(d));
  if (s !== snapshotSync) { snapshotSync = s; d._t = Date.now(); agendarEnvio(); }
  salvarOriginal(d);
};

function agendarEnvio() {
  pendenteSync = true;
  clearTimeout(temporizadorSync);
  temporizadorSync = setTimeout(() => enviarProgresso(false), 1500);
}

async function enviarProgresso(ultimaChance) {
  if (!sincronizado || !tokenAtual || !pendenteSync) return;
  pendenteSync = false;
  const d = ler();
  const corpo = JSON.stringify({ dados: { ...cargaSync(d), _t: d._t || Date.now() } });
  try {
    const r = await fetch(API + '/progresso', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenAtual },
      body: corpo, keepalive: !!ultimaChance && corpo.length < 60000
    });
    if (r.status === 409) { const j = await r.json(); adotarProgresso(j.dados, 'Seu progresso foi atualizado a partir de outro aparelho.'); return; }
    if (!r.ok) throw new Error(r.status);
  } catch (e) {
    pendenteSync = true;
    clearTimeout(temporizadorSync);
    temporizadorSync = setTimeout(() => enviarProgresso(false), 15000);
  }
}
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') enviarProgresso(true); });
addEventListener('pagehide', () => enviarProgresso(true));

// Troca o progresso local pelo do banco.
function adotarProgresso(remoto, aviso) {
  const antigo = ler();
  const novo = { ...cargaSync(remoto), _t: remoto._t || 0, _dono: usuario ? usuario.id : undefined };
  if (usuario && antigo._dono === usuario.id && antigo.gabaritos) novo.gabaritos = antigo.gabaritos;
  salvarOriginal(novo);
  snapshotSync = JSON.stringify(cargaSync(novo));
  estado.areaId = novo.areaId || null;
  estado.qIdx = 0; estado.filtroMateria = 'todas';
  aplicarGabaritos();
  const redesenhar = () => abrir(estado.modulo);
  if (usandoAPI) completarGabaritos().then(redesenhar); else redesenhar();
  if (aviso && typeof avisoPerfil === 'function') avisoPerfil(aviso);
}

// Progresso antigo, guardado neste navegador antes da conta existir: junta ao do banco.
function mesclarLegado(l, r) {
  const m = { ...cargaSync(r) };
  m.areaId = l.areaId || r.areaId;
  m.respostas = { ...(r.respostas || {}), ...(l.respostas || {}) };
  m.dias = [...new Set([...(r.dias || []), ...(l.dias || [])])].sort();
  const cartoes = {};
  [...(r.cardsCriados || []), ...(l.cardsCriados || [])].forEach(c => { cartoes[chaveCard(c)] = c; });
  m.cardsCriados = Object.values(cartoes);
  m.srs = { ...(r.srs || {}) };
  Object.entries(l.srs || {}).forEach(([k, v]) => { if (!m.srs[k] || v > m.srs[k]) m.srs[k] = v; });
  m.edital = { ...(r.edital || {}) };
  Object.entries(l.edital || {}).forEach(([a, marcas]) => { m.edital[a] = { ...(m.edital[a] || {}), ...marcas }; });
  m.editalAbertos = { ...(r.editalAbertos || {}), ...(l.editalAbertos || {}) };
  const tl = ((l.redacao || {}).texto || '').length, tr = ((r.redacao || {}).texto || '').length;
  if (tl || tr) m.redacao = tl >= tr ? l.redacao : r.redacao;
  return m;
}

// Chamada logo depois do login.
async function sincronizarProgresso() {
  if (!usuario || !tokenAtual) return;
  try {
    const r = await fetch(API + '/progresso', { headers: { Authorization: 'Bearer ' + tokenAtual } });
    if (!r.ok) throw new Error(r.status);
    const remoto = (await r.json()).dados;
    const local = ler();
    const mesmoDono = local._dono === usuario.id, semDono = !local._dono;
    if (!remoto) {
      if (mesmoDono || semDono) {
        if (Object.keys(cargaSync(local)).length) {
          local._dono = usuario.id; if (!local._t) local._t = Date.now();
          salvarOriginal(local); pendenteSync = true;
        }
      } else adotarProgresso({ _t: 0 }, null);   // sobrou progresso de outra pessoa: começa do zero
    } else if (mesmoDono) {
      if ((local._t || 0) > (remoto._t || 0)) pendenteSync = true; else adotarProgresso(remoto, null);
    } else if (semDono) {
      adotarProgresso({ ...mesclarLegado(local, remoto), _t: Date.now() }, null);
      pendenteSync = true;
    } else adotarProgresso(remoto, null);
    sincronizado = true;
    if (pendenteSync) enviarProgresso(false);
  } catch (e) {
    console.warn('Não foi possível sincronizar o progresso agora:', e.message);
    setTimeout(sincronizarProgresso, 30000);
  }
}
function pararSincronizacao() { sincronizado = false; pendenteSync = false; clearTimeout(temporizadorSync); }
