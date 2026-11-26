// =====================================================================
// ENSINO PLUS CONCURSOS — LÓGICA DA PÁGINA
// Todo o conteúdo (matérias, áreas, questões, flashcards, textos) vem da API; nada fica escrito na página.
// O progresso do aluno fica na conta (sync.js), com uma cópia neste navegador (localStorage).
// =====================================================================

// ---------- ARMAZENAMENTO ----------
const CHAVE = 'ensinoplus-concursos-v2';
function ler() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
function salvar(d) { try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch (e) {} }
function dataISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function hoje() { return dataISO(new Date()); }
function esc(t) { const div = document.createElement('div'); div.textContent = t == null ? '' : String(t); return div.innerHTML; }
// Texto com Markdown simples (negrito, itálico, sublinhado e quebras de linha). Escapa tudo antes,
// então é seguro para conteúdo vindo de fora (questões da QAPI).
function md(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br>');
}
function icones() { if (window.lucide) lucide.createIcons(); }

// ---------- CONTEÚDO (preenchido pela API em carregarDaAPI) ----------
const MATERIAS = {};
const AREAS = [];
const MATERIAS_COMUNS = [];
const QUESTOES = [];
const FLASHCARDS = [];
let estadoConteudo = 'carregando'; // carregando | ok | erro

// ---------- ESTADO ----------
const estado = {
  modulo: 'inicio',
  areaId: ler().areaId || null,
  filtroMateria: 'todas',
  qIdx: 0,
  escolhida: null,
  riscadas: new Set(),
  cardAtual: null,
  cardVirado: false,
  carregandoQuestoes: false,
  reportando: null,
  semente: ''
};
function area() { return AREAS.find(a => a.id === estado.areaId) || null; }
function materiasDaArea() {
  const a = area();
  return a ? [...MATERIAS_COMUNS, ...a.materias.filter(m => !MATERIAS_COMUNS.includes(m))] : [...MATERIAS_COMUNS];
}

// ---------- CORES (classes completas para o Tailwind reconhecer) ----------
const COR = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  slate: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300'
};
const CARTAO = 'bg-white dark:bg-[#111625] rounded-2xl p-6 border border-slate-300 dark:border-slate-800 shadow-sm';
const BOTAO = 'px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md inline-flex items-center justify-center gap-2 transition-colors';
const BOTAO2 = 'px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors';

// ---------- MÓDULOS ----------
const MODULOS = [
  { id: 'questoes', nome: 'Caderno de Questões', icone: 'check-square', grupo: 'pratica', desc: 'Questões comentadas da sua área e das matérias básicas, com cartão de respostas.' },
  { id: 'flashcards', nome: 'Flashcards de Revisão', icone: 'layers', grupo: 'pratica', desc: 'Cartões de memorização que voltam na hora certa conforme sua avaliação.' },
  { id: 'redacao', nome: 'Redação e Discursiva', icone: 'pen-line', grupo: 'pratica', desc: 'Folha pautada com contador de linhas e roteiro de autoavaliação pelos critérios das bancas.' },
  { id: 'edital', nome: 'Edital Verticalizado', icone: 'list-checks', grupo: 'estrategia', desc: 'Checklist das matérias e tópicos da sua área, com a porcentagem já estudada.' },
  { id: 'simulado', nome: 'Diagnóstico de Pontos Fracos', icone: 'activity', grupo: 'estrategia', desc: 'Seu aproveitamento por matéria e um atalho para treinar o que está mais fraco.' },
  { id: 'desempenho', nome: 'Meu Desempenho', icone: 'trophy', grupo: 'estrategia', desc: 'Questões respondidas, acertos e sequência de dias estudando.' },
  { id: 'pegadinhas', nome: 'Marcador de Pegadinhas', icone: 'search-check', grupo: 'estrategia', desc: 'Cole qualquer texto de estudo e veja destacadas as palavras que as bancas usam para enganar.' },
  { id: 'recursos', nome: 'Modelo de Recurso', icone: 'file-text', grupo: 'estrategia', desc: 'Monte o texto do recurso contra o gabarito preliminar a partir dos seus argumentos.' },
  { id: 'tutor', nome: 'Tutor com IA', icone: 'message-circle', grupo: 'breve', desc: 'Conversa com perguntas e correções em tempo real.' },
  { id: 'podcast', nome: 'Resumos em Áudio', icone: 'headphones', grupo: 'breve', desc: 'Resumos narrados para ouvir no trânsito ou na academia.' }
];

// ---------- NAVEGAÇÃO ----------
function abrir(modulo, rolarParaAreas) {
  if (estadoConteudo !== 'ok') { telaConteudo(); return; }
  if (modulo !== 'inicio' && modulo !== 'perfil' && modulo !== 'planos' && !area()) { modulo = 'inicio'; rolarParaAreas = true; }
  estado.modulo = modulo;
  const render = {
    inicio: renderInicio, questoes: renderQuestoes, flashcards: renderFlashcards, redacao: renderRedacao,
    edital: renderEdital, simulado: renderSimulado, desempenho: renderDesempenho, pegadinhas: renderPegadinhas, recursos: renderRecursos,
    perfil: () => renderPerfil(),
    planos: () => renderPlanos()
  }[modulo] || renderInicio;
  render();
  renderLateral();
  atualizarCabecalho();
  icones();
  if (rolarParaAreas) { const el = document.getElementById('bloco-areas'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}
function atualizarCabecalho() {
  mostrarCronometro();
  const a = area();
  document.getElementById('label-area').textContent = a ? `Área: ${a.nome}` : 'Escolha sua área';
}
function escolherArea(id) {
  const mudou = estado.areaId !== id;
  estado.areaId = id;
  estado.filtroMateria = 'todas';
  estado.qIdx = 0;
  const d = ler(); d.areaId = id; salvar(d);
  if (mudou) carregarQuestoesArea();
  abrir('inicio');
  const el = document.getElementById('bloco-modulos'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function cabecalhoModulo(rotulo, titulo, sub) {
  return `<div class="pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
    <button onclick="abrir('inicio')" class="text-[11px] font-bold text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1 mb-2"><i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Voltar à sala de estudos</button>
    <span class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">${rotulo}</span>
    <h2 class="text-xl font-bold text-slate-900 dark:text-white mt-0.5">${titulo}</h2>
    ${sub ? `<p class="text-xs text-slate-600 dark:text-slate-400 mt-1">${sub}</p>` : ''}
  </div>`;
}

// ---------- INÍCIO ----------
function renderInicio() {
  const a = area();
  const cardsArea = AREAS.map(x => {
    const sel = x.id === estado.areaId;
    return `<button onclick="escolherArea('${x.id}')" class="text-left p-4 rounded-2xl border transition-all ${sel ? 'border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30' : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-[#111625] hover:border-indigo-400'}">
      <div class="flex items-center gap-2.5">
        <span class="w-9 h-9 rounded-xl flex items-center justify-center ${COR[x.cor]}"><i data-lucide="${x.icone}" class="w-4 h-4"></i></span>
        <strong class="text-sm text-slate-900 dark:text-white">${x.nome}</strong>
        ${sel ? '<span class="ml-auto text-[10px] font-bold text-indigo-600 dark:text-indigo-400">SELECIONADA</span>' : ''}
      </div>
      <p class="text-[11px] text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">${x.descricao}</p>
    </button>`;
  }).join('');

  const blocoModulos = !a ? `<div class="${CARTAO} text-center text-sm text-slate-600 dark:text-slate-400">Escolha sua área acima para abrir a sala de estudos com as matérias certas para você.</div>` : (() => {
    const card = m => {
      const breve = m.grupo === 'breve';
      return `<div class="${CARTAO} !p-5 flex flex-col justify-between gap-4 ${breve ? 'opacity-70' : 'hover:border-indigo-500 transition-colors'}">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-900/40"><i data-lucide="${m.icone}" class="w-4 h-4"></i></span>
            ${breve ? '<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Em breve</span>' : ''}
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">${m.nome}</h3>
          <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">${m.desc}</p>
        </div>
        ${breve ? '<span class="text-[11px] text-slate-500">Depende da integração com IA (próxima etapa).</span>' : `<button onclick="abrir('${m.id}')" class="${BOTAO2} w-full">Abrir</button>`}
      </div>`;
    };
    const grupo = (g, titulo) => `<div class="space-y-3"><h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">${titulo}</h3><div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">${MODULOS.filter(m => m.grupo === g).map(card).join('')}</div></div>`;
    return `<div class="space-y-6">${grupo('pratica', 'Prática diária')}${grupo('estrategia', 'Estratégia e apoio')}${grupo('breve', 'Em desenvolvimento')}</div>`;
  })();

  document.getElementById('painel').innerHTML = `
    <div class="rounded-2xl p-7 sm:p-9 bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 text-white shadow-lg">
      <span class="text-[11px] font-bold uppercase tracking-wider bg-white/15 px-2.5 py-1 rounded-full">Concursos públicos de todas as áreas</span>
      <h1 class="text-2xl sm:text-3xl font-extrabold mt-4 leading-tight">Sua sala de estudos para concursos</h1>
      <p class="text-sm text-indigo-100 mt-2 max-w-2xl">Escolha sua área e treine as matérias básicas que quase todo concurso cobra, mais as específicas do seu cargo.</p>
      ${a ? `<p class="text-xs text-indigo-200 mt-4">Área atual: <strong class="text-white">${a.nome}</strong> • ${materiasDaArea().length} matérias no seu plano</p>` : ''}
    </div>
    <div id="bloco-areas" class="space-y-3 scroll-mt-24">
      <h2 class="text-sm font-bold text-slate-900 dark:text-white">1. Qual é a sua área?</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${cardsArea}</div>
    </div>
    <div id="bloco-modulos" class="space-y-3 scroll-mt-24">
      <h2 class="text-sm font-bold text-slate-900 dark:text-white">2. Sua mesa de estudos</h2>
      ${blocoModulos}
    </div>`;
}

// ---------- QUESTÕES ----------
function questoesFiltradas() {
  const mats = materiasDaArea();
  return QUESTOES.filter(q => mats.includes(q.materia) && (estado.filtroMateria === 'todas' || q.materia === estado.filtroMateria));
}
function respostas() { return ler().respostas || {}; }
function mudarFiltro(v) {
  estado.filtroMateria = v; estado.qIdx = 0; abrir('questoes');
  // matéria ainda pouco carregada: busca o primeiro lote dela
  if (v !== 'todas' && QUESTOES.filter(q => q.materia === v).length < Math.min(LOTE_QUESTOES, totalDaMateria(v))) carregarMaisQuestoes();
}
function totalDaMateria(m) { return (MATERIAS[m] && MATERIAS[m].total_questoes) || 0; }
function materiaPorId() { const mapa = {}; QUESTOES.forEach(q => { mapa[q.id] = q.materia; }); return mapa; }
function renderQuestoes() {
  const lista = questoesFiltradas();
  const todasDaArea = materiasDaArea();
  const mats = todasDaArea.filter(m => totalDaMateria(m) > 0);
  const nCarregadas = m => QUESTOES.filter(q => q.materia === m).length;
  const cargaArea = QUESTOES.filter(q => todasDaArea.includes(q.materia)).length;
  const totalArea = todasDaArea.reduce((t, m) => t + totalDaMateria(m), 0);
  const cargaAtual = estado.filtroMateria === 'todas' ? cargaArea : nCarregadas(estado.filtroMateria);
  const totalAtual = estado.filtroMateria === 'todas' ? totalArea : totalDaMateria(estado.filtroMateria);
  const faltam = cargaAtual < totalAtual;
  const filtro = `<div class="space-y-1.5"><label class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 flex-wrap">Matéria:
    <select onchange="mudarFiltro(this.value)" class="text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5">
      <option value="todas" ${estado.filtroMateria === 'todas' ? 'selected' : ''}>Todas da minha área (${cargaArea} de ${totalArea})</option>
      ${mats.map(m => `<option value="${m}" ${estado.filtroMateria === m ? 'selected' : ''}>${MATERIAS[m].nome} (${nCarregadas(m)} de ${totalDaMateria(m)})</option>`).join('')}
    </select></label>
    ${faltam || estado.carregandoQuestoes ? `<p class="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">${estado.carregandoQuestoes ? 'Carregando questões...' : `Carregadas ${cargaAtual} de ${totalAtual}. A cada visita a sala sorteia um conjunto novo.`}
      ${faltam && !estado.carregandoQuestoes ? `<button onclick="carregarMaisQuestoes()" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Carregar mais ${Math.min(LOTE_QUESTOES, totalAtual - cargaAtual)}</button>` : ''}</p>` : ''}</div>`;
  if (!lista.length) {
    document.getElementById('painel').innerHTML = `<div class="${CARTAO}">${cabecalhoModulo('Prática ativa', 'Caderno de Questões')}${filtro}<p class="text-sm text-slate-600 dark:text-slate-400 mt-4">${estado.carregandoQuestoes ? 'Carregando as questões da sua área...' : 'Ainda não há questões cadastradas para esta matéria.'}</p></div>`;
    return;
  }
  if (estado.qIdx >= lista.length) estado.qIdx = 0;
  const q = lista[estado.qIdx];
  const resp = respostas()[q.id];
  const alternativas = Object.entries(q.alternativas).map(([letra, texto]) => {
    let cls = 'border-slate-300 dark:border-slate-700 hover:border-indigo-400';
    if (resp) {
      if (letra === resp.escolha && !resp.acertou) cls = 'border-rose-400 bg-rose-50 dark:bg-rose-950/40';
      if (letra === q.correta && (resp.acertou || resp.revelada)) cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40';
    } else if (estado.escolhida === letra) cls = 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-400';
    const riscada = estado.riscadas.has(letra) ? 'riscada' : '';
    return `<div class="flex items-stretch gap-2">
      <button ${resp ? 'disabled' : `onclick="marcar('${letra}')"`} class="flex-1 text-left p-3 rounded-xl border ${cls} text-sm flex gap-3 transition-colors">
        <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400">${letra})</span><span class="${riscada}">${md(texto)}</span>
      </button>
      ${resp ? '' : `<button onclick="riscar('${letra}')" title="Riscar alternativa" class="px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-rose-600"><i data-lucide="strikethrough" class="w-4 h-4"></i></button>`}
    </div>`;
  }).join('');

  let retorno = '';
  if (resp && resp.acertou) {
    retorno = `<div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-sm space-y-1"><strong class="text-emerald-800 dark:text-emerald-300">Resposta correta! Letra ${q.correta}.</strong><p class="text-slate-700 dark:text-slate-300">${md(q.comentario)}</p></div>`;
  } else if (resp) {
    retorno = `<div class="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-sm space-y-3">
      <strong class="text-rose-800 dark:text-rose-300">Você errou esta questão.</strong>
      <div class="flex flex-wrap gap-2">
        <button onclick="revelar()" class="${BOTAO2}" title="Mostra a letra certa em verde nas alternativas"><i data-lucide="eye" class="w-4 h-4"></i> Mostrar resposta</button>
        <button onclick="document.getElementById('explicacao').classList.toggle('hidden')" class="${BOTAO2}" title="Mostra a fundamentação da questão"><i data-lucide="book-open" class="w-4 h-4"></i> Mostrar explicação</button>
      </div>
      <p id="explicacao" class="hidden text-slate-700 dark:text-slate-300">${md(q.comentario)}</p>
    </div>`;
  }

  document.getElementById('painel').innerHTML = `<div class="${CARTAO} space-y-5">
    ${cabecalhoModulo('Prática ativa', 'Caderno de Questões', 'Questões comentadas da sua área e das matérias básicas.')}
    ${filtro}
    <div class="flex items-center justify-between text-xs flex-wrap gap-2">
      <span class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Questão ${estado.qIdx + 1} de ${lista.length}</span>
      <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold">${MATERIAS[q.materia].nome}</span>
    </div>
    ${origemQuestao(q)}
    ${textoBase(q)}
    <p class="text-base leading-relaxed text-slate-900 dark:text-white">${md(q.enunciado)}</p>
    <div class="space-y-2">${alternativas}</div>
    ${resp ? '' : `<button onclick="confirmar()" class="${BOTAO} w-full"><i data-lucide="check" class="w-4 h-4"></i> Confirmar resposta</button>`}
    ${retorno}
    <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
      <button onclick="navegar(-1)" class="${BOTAO2}"><i data-lucide="chevron-left" class="w-4 h-4"></i> Anterior</button>
      <button onclick="salvarComoCard()" class="${BOTAO2}"><i data-lucide="layers" class="w-4 h-4"></i> Salvar como flashcard</button>
      <button onclick="navegar(1)" class="${BOTAO2}">Próxima <i data-lucide="chevron-right" class="w-4 h-4"></i></button>
    </div>
    ${caixaReporte(q)}
  </div>`;
}
// ---------- REPORTAR ERRO NA QUESTÃO ----------
const MOTIVOS_REPORTE = [['gabarito', 'Gabarito errado'], ['enunciado', 'Erro no enunciado ou nas alternativas'], ['explicacao', 'Explicação errada ou faltando'], ['desatualizada', 'Questão desatualizada (lei mudou)'], ['outro', 'Outro problema']];
function caixaReporte(q) {
  if (!usandoAPI) return '';
  const enviados = ler().reportes || {};
  if (estado.reportando !== q.id) {
    return `<div class="text-center">${enviados[q.id]
      ? `<span class="text-xs text-slate-500 inline-flex items-center gap-1.5"><i data-lucide="flag" class="w-3.5 h-3.5"></i> Você reportou um problema nesta questão. Obrigado!</span>`
      : `<button onclick="abrirReporte()" class="text-xs font-semibold text-slate-500 hover:text-rose-600 inline-flex items-center gap-1.5"><i data-lucide="flag" class="w-3.5 h-3.5"></i> Reportar erro nesta questão</button>`}</div>`;
  }
  return `<form onsubmit="enviarReporte(event)" class="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 space-y-3 text-sm">
    <strong class="block text-rose-800 dark:text-rose-300">Qual é o problema desta questão?</strong>
    <div class="space-y-1.5">${MOTIVOS_REPORTE.map(([v, t], i) => `<label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="motivo" value="${v}" ${i === 0 ? 'checked' : ''}> ${t}</label>`).join('')}</div>
    <textarea name="detalhe" maxlength="1000" rows="3" placeholder="Explique em poucas palavras (opcional). Ex.: a resposta certa é a letra B, conforme o art. 7º da CF." class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"></textarea>
    <div class="flex justify-end gap-2">
      <button type="button" onclick="estado.reportando = null; abrir('questoes')" class="${BOTAO2}">Cancelar</button>
      <button class="${BOTAO}"><i data-lucide="send" class="w-4 h-4"></i> Enviar reporte</button>
    </div>
  </form>`;
}
function abrirReporte() { estado.reportando = questoesFiltradas()[estado.qIdx].id; abrir('questoes'); }
async function enviarReporte(ev) {
  ev.preventDefault();
  const f = ev.target; const qid = estado.reportando;
  const botao = f.querySelector('button:not([type])'); botao.disabled = true;
  try {
    const r = await fetch(`${API}/questoes/${encodeURIComponent(qid)}/reportar`, {
      method: 'POST', headers: cabecalhos(true), body: JSON.stringify({ motivo: f.motivo.value, detalhe: f.detalhe.value })
    });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(typeof corpo.detail === 'string' ? corpo.detail : 'Não foi possível enviar agora. Tente de novo.');
    const d = ler(); d.reportes = d.reportes || {}; d.reportes[qid] = hoje(); salvar(d);
    estado.reportando = null; abrir('questoes');
  } catch (e) { alert(e.message === 'Failed to fetch' ? 'Sem conexão. Tente de novo.' : e.message); botao.disabled = false; }
}
// Banca, órgão, ano e cargo da prova (questões reais importadas da QAPI).
function origemQuestao(q) {
  const o = q.origem || {};
  const partes = [o.banca, o.orgao, o.ano].filter(Boolean).map(esc);
  if (!partes.length && q.fonte !== 'QAPI') return '';
  return `<div class="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
    ${partes.length ? `<p><strong class="text-slate-800 dark:text-slate-200">${partes.join(' • ')}</strong>${o.cargo ? ` — ${esc(o.cargo)}` : ''}</p>` : ''}
    ${o.assunto ? `<p>Assunto: ${esc(o.assunto)}</p>` : ''}
    ${q.fonte === 'QAPI' ? `<p class="text-[11px] text-slate-500">Questões fornecidas por QAPI</p>` : ''}
  </div>`;
}
// Texto de apoio que algumas questões usam (fica recolhido para não ocupar a tela).
function textoBase(q) {
  if (!q.texto_base) return '';
  return `<details open class="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-3 text-sm">
    <summary class="cursor-pointer font-bold text-slate-800 dark:text-slate-200">${q.texto_titulo ? esc(q.texto_titulo) : 'Texto de apoio'}</summary>
    <div class="mt-2 leading-relaxed text-slate-700 dark:text-slate-300">${md(q.texto_base)}</div>
    ${q.texto_fonte ? `<p class="mt-2 text-[11px] text-slate-500">Fonte: ${esc(q.texto_fonte)}</p>` : ''}
  </details>`;
}
function marcar(l) { estado.escolhida = l; abrir('questoes'); }
function riscar(l) { estado.riscadas.has(l) ? estado.riscadas.delete(l) : estado.riscadas.add(l); abrir('questoes'); }
function navegar(passo) {
  const n = questoesFiltradas().length;
  estado.qIdx = (estado.qIdx + passo + n) % n;
  estado.escolhida = null; estado.riscadas = new Set();
  abrir('questoes');
}
function irParaQuestao(i) { estado.qIdx = i; estado.escolhida = null; estado.riscadas = new Set(); abrir('questoes'); }
async function confirmar() {
  if (!estado.escolhida) { alert('Selecione uma alternativa antes de confirmar.'); return; }
  const q = questoesFiltradas()[estado.qIdx];
  if (usandoAPI && !q.correta) {
    try {
      const r = await fetch(`${API}/questoes/${encodeURIComponent(q.id)}/responder`, {
        method: 'POST', headers: cabecalhos(true), body: JSON.stringify({ resposta: estado.escolhida })
      });
      if (!r.ok) throw new Error(r.status);
      const g = await r.json();
      q.correta = g.correta; q.comentario = g.comentario || '';
      const dg = ler(); dg.gabaritos = dg.gabaritos || {}; dg.gabaritos[q.id] = { correta: q.correta, comentario: q.comentario }; salvar(dg);
    } catch (e) { alert('Não foi possível corrigir agora. Verifique sua conexão e tente de novo.'); return; }
  }
  const d = ler();
  d.respostas = d.respostas || {};
  if (!d.respostas[q.id]) {
    d.respostas[q.id] = { escolha: estado.escolhida, acertou: estado.escolhida === q.correta, data: hoje(), materia: q.materia };
    d.dias = d.dias || [];
    if (!d.dias.includes(hoje())) d.dias.push(hoje());
    salvar(d);
  }
  estado.escolhida = null;
  abrir('questoes');
}
function revelar() {
  const q = questoesFiltradas()[estado.qIdx];
  const d = ler();
  if (d.respostas && d.respostas[q.id]) { d.respostas[q.id].revelada = true; salvar(d); }
  abrir('questoes');
}
function refazerQuestoes() {
  if (!confirm('Apagar suas respostas e refazer as questões da sua área? Seus flashcards e o edital não são afetados.')) return;
  const d = ler(); const mats = materiasDaArea(); const mapa = materiaPorId();
  Object.keys(d.respostas || {}).forEach(id => { if (mats.includes(d.respostas[id].materia || mapa[id])) delete d.respostas[id]; });
  salvar(d); estado.qIdx = 0; abrir('questoes');
}

// ---------- FLASHCARDS (repetição espaçada simples) ----------
const DIAS_REVISAO = { errei: 1, medio: 3, facil: 7 };
function baralho() {
  const mats = materiasDaArea();
  const criados = (ler().cardsCriados || []).filter(c => mats.includes(c.materia));
  return [...FLASHCARDS.filter(c => mats.includes(c.materia)), ...criados];
}
function chaveCard(c) { return c.materia + '|' + c.frente.slice(0, 80); }
function pendentes() {
  const srs = ler().srs || {};
  return baralho().filter(c => !srs[chaveCard(c)] || srs[chaveCard(c)] <= hoje());
}
function renderFlashcards() {
  const pend = pendentes();
  const total = baralho().length;
  if (!estado.cardAtual || !pend.some(c => chaveCard(c) === estado.cardAtual)) { estado.cardAtual = pend[0] ? chaveCard(pend[0]) : null; estado.cardVirado = false; }
  const c = baralho().find(x => chaveCard(x) === estado.cardAtual);
  const corpo = !c ? `<div class="p-8 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-center space-y-2">
      <i data-lucide="party-popper" class="w-8 h-8 mx-auto text-emerald-600"></i>
      <strong class="block text-emerald-800 dark:text-emerald-300">Revisão de hoje concluída!</strong>
      <p class="text-xs text-slate-600 dark:text-slate-400">Os ${total} cartões do seu baralho voltam nas datas definidas pela sua avaliação.</p></div>` : `
    <div class="flex items-center justify-between text-xs">
      <span class="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">${pend.length} para revisar hoje • ${total} no baralho</span>
      <span class="font-semibold text-slate-600 dark:text-slate-400">${MATERIAS[c.materia].nome}</span>
    </div>
    <button onclick="virarCard()" class="w-full min-h-[220px] p-6 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-600 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-4 text-center">
      <span class="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400">${estado.cardVirado ? 'Verso • resposta' : 'Frente • clique para ver a resposta'}</span>
      <span class="text-base sm:text-lg font-bold text-slate-900 dark:text-white">${esc(c.frente)}</span>
      ${estado.cardVirado ? `<span class="text-sm text-emerald-800 dark:text-emerald-300 border-t border-slate-200 dark:border-slate-700 pt-4">${c.verso}</span>` : ''}
    </button>
    ${estado.cardVirado ? `<div class="space-y-2 text-center"><span class="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Como foi sua lembrança?</span>
      <div class="grid grid-cols-3 gap-2">
        <button onclick="avaliarCard('errei')" class="py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-bold text-xs">Errei / Difícil<span class="block text-[10px] font-normal">volta amanhã</span></button>
        <button onclick="avaliarCard('medio')" class="py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 text-amber-700 dark:text-amber-300 font-bold text-xs">Médio<span class="block text-[10px] font-normal">em 3 dias</span></button>
        <button onclick="avaliarCard('facil')" class="py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold text-xs">Acertei / Fácil<span class="block text-[10px] font-normal">em 7 dias</span></button>
      </div></div>` : '<p class="text-center text-[11px] text-slate-500">Tente lembrar a resposta antes de virar o cartão.</p>'}`;
  document.getElementById('painel').innerHTML = `<div class="${CARTAO} space-y-5 max-w-2xl">${cabecalhoModulo('Memorização ativa', 'Flashcards de Revisão')}${corpo}</div>`;
}
function virarCard() { estado.cardVirado = !estado.cardVirado; abrir('flashcards'); }
function avaliarCard(nivel) {
  const d = ler(); d.srs = d.srs || {};
  const prox = new Date(); prox.setDate(prox.getDate() + DIAS_REVISAO[nivel]);
  d.srs[estado.cardAtual] = dataISO(prox);
  salvar(d);
  const resto = pendentes().filter(c => chaveCard(c) !== estado.cardAtual);
  estado.cardAtual = resto[0] ? chaveCard(resto[0]) : null;
  estado.cardVirado = false;
  abrir('flashcards');
}
function salvarComoCard() {
  const q = questoesFiltradas()[estado.qIdx];
  if (!q.correta) { alert('Responda a questão primeiro para salvá-la como flashcard com a resposta.'); return; }
  const card = { materia: q.materia, frente: q.enunciado, verso: `<strong>Letra ${q.correta}:</strong> ${md(q.alternativas[q.correta])}<br><br>${md(q.comentario)}` };
  const d = ler(); d.cardsCriados = d.cardsCriados || [];
  if (d.cardsCriados.some(c => chaveCard(c) === chaveCard(card))) { alert('Esta questão já está no seu baralho de flashcards.'); return; }
  d.cardsCriados.push(card); salvar(d);
  alert('Questão salva no seu baralho de flashcards. Ela já aparece na revisão de hoje.');
}

// ---------- EDITAL VERTICALIZADO ----------
function marcasEdital() { return ((ler().edital || {})[estado.areaId]) || {}; }
function renderEdital() {
  const marcas = marcasEdital();
  const mats = materiasDaArea();
  let feitos = 0, total = 0;
  const blocos = mats.map(m => {
    const tops = MATERIAS[m].topicos;
    const f = tops.filter((_, i) => marcas[m + ':' + i]).length;
    feitos += f; total += tops.length;
    const abertos = (ler().editalAbertos || {})[m] !== false;
    return `<div class="rounded-xl border border-slate-300 dark:border-slate-800 overflow-hidden">
      <button onclick="alternarMateriaEdital('${m}')" class="w-full p-3.5 bg-slate-100 dark:bg-slate-800 flex items-center justify-between text-left">
        <strong class="text-xs text-slate-900 dark:text-white">${MATERIAS[m].nome}${MATERIAS[m].comum ? ' <span class="font-normal text-slate-500">• básica</span>' : ''}</strong>
        <span class="text-xs text-slate-500 font-mono font-bold">${f} / ${tops.length} ${abertos ? '▴' : '▾'}</span>
      </button>
      ${abertos ? `<div class="p-4 space-y-2.5 text-xs">${tops.map((t, i) => `<label class="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" ${marcas[m + ':' + i] ? 'checked' : ''} onchange="marcarTopico('${m}', ${i}, this.checked)" class="w-4 h-4 rounded"><span class="text-slate-800 dark:text-slate-200">${esc(t)}</span></label>`).join('')}</div>` : ''}
    </div>`;
  }).join('');
  const pct = total ? Math.round(feitos / total * 100) : 0;
  document.getElementById('painel').innerHTML = `<div class="${CARTAO} space-y-5">
    ${cabecalhoModulo('Organização', `Edital Verticalizado • ${area().nome}`, 'Marque os tópicos que você já estudou. Use o edital oficial do seu concurso para conferir os tópicos exatos.')}
    <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
      <div class="flex justify-between text-xs font-bold"><span>Cobertura do conteúdo</span><span class="text-indigo-600 dark:text-indigo-400 font-mono">${feitos} de ${total} tópicos • ${pct}%</span></div>
      <div class="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div class="bg-indigo-600 h-full rounded-full transition-all" style="width:${pct}%"></div></div>
    </div>
    <div class="space-y-3">${blocos}</div>
  </div>`;
}
function marcarTopico(m, i, v) {
  const d = ler(); d.edital = d.edital || {}; d.edital[estado.areaId] = d.edital[estado.areaId] || {};
  d.edital[estado.areaId][m + ':' + i] = v; salvar(d); abrir('edital');
}
function alternarMateriaEdital(m) {
  const d = ler(); d.editalAbertos = d.editalAbertos || {};
  d.editalAbertos[m] = d.editalAbertos[m] === false; salvar(d); abrir('edital');
}

// ---------- DESEMPENHO POR MATÉRIA ----------
function estatisticas() {
  const r = respostas(); const mats = materiasDaArea(); const porMateria = {}; const mapa = materiaPorId();
  Object.entries(r).forEach(([id, x]) => {
    const m = x.materia || mapa[id];   // respostas antigas não têm a matéria: valem só se a questão estiver carregada
    if (!m || !mats.includes(m)) return;
    const s = porMateria[m] = porMateria[m] || { acertos: 0, total: 0 };
    s.total++; if (x.acertou) s.acertos++;
  });
  return porMateria;
}
function renderSimulado() {
  const st = estatisticas();
  const lista = Object.entries(st).map(([m, s]) => ({ m, pct: Math.round(s.acertos / s.total * 100), total: s.total })).sort((a, b) => a.pct - b.pct);
  const barras = !lista.length ? '<p class="text-sm text-slate-600 dark:text-slate-400">Você ainda não respondeu questões da sua área. Resolva algumas no Caderno de Questões e o diagnóstico aparece aqui.</p>' :
    lista.map(x => {
      const [cor, rot] = x.pct >= 75 ? ['emerald', 'Forte'] : x.pct >= 50 ? ['amber', 'Médio'] : ['rose', 'Ponto fraco'];
      const barra = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }[cor];
      const txt = { emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600' }[cor];
      return `<div><div class="flex justify-between text-xs font-bold mb-1"><span>${MATERIAS[x.m].nome} <span class="font-normal text-slate-500">(${x.total} ${x.total === 1 ? 'questão' : 'questões'})</span></span><span class="${txt}">${x.pct}% • ${rot}</span></div>
        <div class="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div class="${barra} h-full rounded-full" style="width:${x.pct}%"></div></div></div>`;
    }).join('');
  const fraca = lista[0];
  document.getElementById('painel').innerHTML = `<div class="${CARTAO} space-y-5">
    ${cabecalhoModulo('Diagnóstico individual', 'Diagnóstico de Pontos Fracos', 'Calculado com as questões que você respondeu nesta área.')}
    <div class="space-y-4">${barras}</div>
    <button onclick="${fraca ? `treinarMateria('${fraca.m}')` : "abrir('questoes')"}" class="${BOTAO} w-full"><i data-lucide="zap" class="w-4 h-4"></i> ${fraca ? `Treinar ${MATERIAS[fraca.m].nome}` : 'Ir para o Caderno de Questões'}</button>
  </div>`;
}
function treinarMateria(m) {
  estado.filtroMateria = m;
  const lista = questoesFiltradas(); const r = respostas();
  const i = lista.findIndex(q => !r[q.id]);
  estado.qIdx = i >= 0 ? i : 0;
  abrir('questoes');
  if (i < 0) {
    // as questões carregadas já foram respondidas: busca um lote novo antes de dizer que acabou
    if (lista.length < totalDaMateria(m)) carregarMaisQuestoes();
    else alert(`Você já respondeu todas as questões de ${MATERIAS[m].nome}. Novas questões entram conforme o banco cresce.`);
  }
}
function sequenciaDias() {
  const set = new Set(ler().dias || []); const d = new Date(); let n = 0;
  if (!set.has(hoje())) d.setDate(d.getDate() - 1);
  while (set.has(dataISO(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function renderDesempenho() {
  const r = Object.values(respostas());
  const acertos = r.filter(x => x.acertou).length;
  const seq = sequenciaDias();
  const dias = (ler().dias || []).length;
  const item = (rot, val, ic) => `<div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3"><i data-lucide="${ic}" class="w-5 h-5 text-indigo-600 dark:text-indigo-400"></i><div><span class="block text-[11px] text-slate-500 font-semibold">${rot}</span><strong class="text-lg font-mono">${val}</strong></div></div>`;
  document.getElementById('painel').innerHTML = `<div class="${CARTAO} space-y-5">
    ${cabecalhoModulo('Acompanhamento', 'Meu Desempenho', 'Todos os números vêm das suas respostas e dos dias em que você estudou.')}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${item('Questões respondidas', r.length, 'check-square')}
      ${item('Aproveitamento geral', r.length ? Math.round(acertos / r.length * 100) + '%' : '—', 'target')}
      ${item('Sequência de dias estudando', seq + (seq === 1 ? ' dia' : ' dias') + (seq ? ' 🔥' : ''), 'flame')}
      ${item('Dias estudados no total', dias, 'calendar-check')}
    </div>
    <p class="text-[11px] text-slate-500">Seus números ficam salvos ${typeof usuario !== 'undefined' && usuario ? 'na sua conta' : 'neste navegador'}.</p>
    <button onclick="refazerQuestoes()" class="${BOTAO2}"><i data-lucide="rotate-ccw" class="w-4 h-4"></i> Refazer as questões da minha área</button>
  </div>`;
}

// ---------- REDAÇÃO ----------
const CRITERIOS_REDACAO = [
  'Respondi exatamente ao que o tema pediu, sem fugir do assunto.',
  'O texto tem introdução, desenvolvimento e conclusão claros.',
  'Cada parágrafo traz um argumento com explicação ou exemplo.',
  'Usei conectivos para ligar as ideias (além disso, portanto, entretanto...).',
  'Revisei ortografia, acentuação, crase e concordância.',
  'Fiquei dentro do limite de linhas pedido pela banca.'
];
function renderRedacao() {
  const d = ler(); const rascunho = d.redacao || { tema: '', texto: '', checks: {} };
  document.getElementById('painel').innerHTML = `<div class="${CARTAO} space-y-5">
    ${cabecalhoModulo('Prática escrita', 'Redação e Discursiva', 'Escreva, acompanhe o tamanho do texto e faça a autoavaliação pelos critérios que as bancas usam. Seu rascunho fica salvo.')}
    <input id="red-tema" value="${esc(rascunho.tema)}" oninput="salvarRedacao()" placeholder="Tema proposto (ex.: Os desafios da saúde pública no Brasil)" class="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5">
    <textarea id="red-texto" oninput="salvarRedacao()" rows="14" placeholder="Escreva aqui sua redação ou resposta discursiva..." class="folha-pautada w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-1">${esc(rascunho.texto)}</textarea>
    <div id="red-contador" class="text-xs font-mono font-bold text-slate-600 dark:text-slate-400"></div>
    <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
      <strong class="text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Autoavaliação</strong>
      ${CRITERIOS_REDACAO.map((c, i) => `<label class="flex items-start gap-2.5 text-xs cursor-pointer"><input type="checkbox" ${rascunho.checks[i] ? 'checked' : ''} onchange="salvarRedacao()" data-crit="${i}" class="w-4 h-4 mt-0.5 rounded"><span>${c}</span></label>`).join('')}
      <p id="red-resultado" class="text-xs font-bold pt-1"></p>
    </div>
    <p class="text-[11px] text-slate-500">A correção automática com nota por IA está em desenvolvimento.</p>
  </div>`;
  atualizarContadorRedacao();
}
function salvarRedacao() {
  const checks = {}; document.querySelectorAll('[data-crit]').forEach(c => { checks[c.dataset.crit] = c.checked; });
  const d = ler(); d.redacao = { tema: document.getElementById('red-tema').value, texto: document.getElementById('red-texto').value, checks }; salvar(d);
  atualizarContadorRedacao();
}
function atualizarContadorRedacao() {
  const t = document.getElementById('red-texto').value;
  const palavras = (t.trim().match(/\S+/g) || []).length;
  const linhasAprox = Math.ceil(t.length / 70) + (t.match(/\n/g) || []).length;
  document.getElementById('red-contador').textContent = `${palavras} ${palavras === 1 ? 'palavra' : 'palavras'} • cerca de ${linhasAprox} ${linhasAprox === 1 ? 'linha' : 'linhas'} de folha de prova (≈70 caracteres por linha)`;
  const marcados = document.querySelectorAll('[data-crit]:checked').length;
  const res = document.getElementById('red-resultado');
  res.textContent = marcados === CRITERIOS_REDACAO.length ? 'Todos os critérios conferidos. Bom trabalho!' : `${marcados} de ${CRITERIOS_REDACAO.length} critérios conferidos. Revise os itens desmarcados.`;
  res.className = 'text-xs font-bold pt-1 ' + (marcados === CRITERIOS_REDACAO.length ? 'text-emerald-600' : 'text-amber-600');
}

// ---------- MARCADOR DE PEGADINHAS ----------
function renderPegadinhas() {
  document.getElementById('painel').innerHTML = `<div class="${CARTAO} space-y-5">
    ${cabecalhoModulo('Leitura atenta', 'Marcador de Pegadinhas', 'Cole um artigo de lei, um trecho de apostila ou o enunciado de uma questão. As palavras que mais derrubam candidatos ficam destacadas.')}
    <textarea id="peg-texto" rows="7" placeholder="Cole aqui o texto que você está estudando..." class="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5"></textarea>
    <button onclick="marcarPegadinhas()" class="${BOTAO}"><i data-lucide="search-check" class="w-4 h-4"></i> Marcar pegadinhas</button>
    <div class="flex flex-wrap gap-3 text-[11px]"><span class="marca-alerta">sempre, nunca, somente, vedado</span><span class="marca-excecao">salvo, exceto, ressalvado</span><span class="marca-numero">prazos e números</span></div>
    <div id="peg-resultado" class="hidden p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm leading-relaxed"></div>
  </div>`;
}
const PEGADINHAS = {"alerta": ["sempre", "nunca", "jamais", "somente", "apenas", "exclusivamente", "privativ[oa]s?", "vedad[oa]s?", "proibid[oa]s?", "obrigatóri[oa]s?", "obrigatoriamente", "todos", "todas", "nenhum", "nenhuma", "deverá", "deverão", "poderá", "poderão", "independentemente", "necessariamente"], "excecao": ["salvo", "exceto", "ressalvad[oa]s?", "ressalva", "desde que", "a não ser", "com exceção", "em regra", "via de regra"]};
function marcarPegadinhas() {
  const t = document.getElementById('peg-texto').value.trim();
  if (!t) { alert('Cole um texto para analisar.'); return; }
  let h = esc(t);
  // Limites de palavra que entendem acentos (o \b do JavaScript não reconhece "á", "ê" etc.)
  const palavras = lista => new RegExp('(^|[^\\wÀ-ÿ])(' + lista + ')(?=[^\\wÀ-ÿ]|$)', 'gi');
  const alerta = palavras(PEGADINHAS.alerta.join('|'));
  const excecao = palavras(PEGADINHAS.excecao.join('|'));
  const numero = palavras('\\d+(?:[.,]\\d+)?(?:\\s*(?:dias?|horas?|meses|mês|anos?|%|por cento))?');
  h = h.replace(numero, '$1<span class="marca-numero">$2</span>')
       .replace(alerta, '$1<span class="marca-alerta">$2</span>')
       .replace(excecao, '$1<span class="marca-excecao">$2</span>');
  const qtd = (h.match(/class="marca-/g) || []).length;
  const box = document.getElementById('peg-resultado');
  box.innerHTML = `<p class="text-xs font-bold mb-3 text-slate-600 dark:text-slate-400">${qtd} ponto(s) de atenção encontrados:</p>` + h.replace(/\n/g, '<br>');
  box.classList.remove('hidden');
}

// ---------- MODELO DE RECURSO ----------
function renderRecursos() {
  const campo = (id, rot, ph, tipo) => `<label class="block text-xs font-bold text-slate-700 dark:text-slate-300 space-y-1"><span>${rot}</span>${tipo === 'area' ? `<textarea id="${id}" rows="4" placeholder="${ph}" class="w-full text-sm font-normal rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5"></textarea>` : `<input id="${id}" placeholder="${ph}" class="w-full text-sm font-normal rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5">`}</label>`;
  document.getElementById('painel').innerHTML = `<div class="${CARTAO} space-y-5">
    ${cabecalhoModulo('Pós-prova', 'Modelo de Recurso contra Gabarito', 'Preencha os campos e gere o texto do recurso. Confira sempre as regras e o prazo do edital do seu concurso.')}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${campo('rc-concurso', 'Concurso e cargo', 'Ex.: Prefeitura de X • Assistente Administrativo')}
      ${campo('rc-questao', 'Número da questão', 'Ex.: 27')}
      ${campo('rc-gabarito', 'Gabarito preliminar', 'Ex.: Letra B')}
      ${campo('rc-pedido', 'O que você pede', 'Ex.: alteração para a letra D ou anulação')}
    </div>
    ${campo('rc-argumento', 'Seus argumentos', 'Explique por que o gabarito está errado ou a questão tem mais de uma resposta.', 'area')}
    ${campo('rc-fonte', 'Fundamento (lei, artigo, doutrina ou jurisprudência)', 'Ex.: art. 37 da Constituição Federal; autor e obra; súmula...', 'area')}
    <button onclick="gerarRecurso()" class="${BOTAO}"><i data-lucide="file-text" class="w-4 h-4"></i> Gerar texto do recurso</button>
    <div id="rc-saida" class="hidden space-y-2">
      <textarea id="rc-texto" rows="12" class="w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5"></textarea>
      <button onclick="copiarRecurso()" class="${BOTAO2}"><i data-lucide="copy" class="w-4 h-4"></i> Copiar texto</button>
    </div>
  </div>`;
}
function gerarRecurso() {
  const v = id => document.getElementById(id).value.trim();
  if (!v('rc-questao') || !v('rc-argumento')) { alert('Preencha pelo menos o número da questão e os seus argumentos.'); return; }
  const texto = `À Banca Examinadora${v('rc-concurso') ? ' do concurso ' + v('rc-concurso') : ''},

Venho, respeitosamente, interpor recurso contra o gabarito preliminar da questão ${v('rc-questao')}${v('rc-gabarito') ? ', divulgado como ' + v('rc-gabarito') : ''}.

DOS FUNDAMENTOS
${v('rc-argumento')}
${v('rc-fonte') ? '\nO entendimento acima encontra amparo em: ' + v('rc-fonte') + '.\n' : ''}
DO PEDIDO
Diante do exposto, requer-se ${v('rc-pedido') || 'a revisão do gabarito da questão'}, por ser medida de justiça e de respeito aos princípios da legalidade e da isonomia entre os candidatos.

Nestes termos, pede deferimento.`;
  document.getElementById('rc-texto').value = texto;
  document.getElementById('rc-saida').classList.remove('hidden');
}
function copiarRecurso() {
  const t = document.getElementById('rc-texto');
  t.select();
  (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => alert('Texto copiado.')).catch(() => { document.execCommand('copy'); alert('Texto copiado.'); });
}

// ---------- LATERAL (GUIA E CARTÃO DE RESPOSTAS) ----------
const GUIAS = {
  planos: ['Compare o plano mensal e o anual.', 'O anual sai mais barato por mês.', 'A assinatura online chega em breve.'],
  inicio: ['Escolha a sua área (por exemplo, Saúde ou Policial).', 'A sala monta seu plano: matérias básicas + matérias da área.', 'Abra um módulo e comece pelo Caderno de Questões.'],
  questoes: ['Escolha a matéria no filtro (ou deixe "Todas").', 'Marque uma alternativa e clique em Confirmar.', 'Errou? Use "Mostrar explicação" para entender e "Mostrar resposta" para ver a letra certa.', 'Use o ícone de risco para eliminar alternativas.', '"Salvar como flashcard" leva a questão para sua revisão.'],
  flashcards: ['Leia a frente e tente lembrar a resposta.', 'Clique no cartão para virar.', 'Avalie sua lembrança: o cartão volta amanhã, em 3 ou em 7 dias.'],
  redacao: ['Digite o tema e escreva seu texto.', 'Acompanhe palavras e linhas no contador.', 'Marque a autoavaliação antes de dar o texto por terminado.'],
  edital: ['Abra cada matéria e marque os tópicos que já estudou.', 'A barra mostra quanto do conteúdo você já cobriu.', 'Confira sempre o edital oficial do seu concurso.'],
  simulado: ['Responda questões no Caderno.', 'Volte aqui para ver o aproveitamento por matéria.', 'Use o botão para treinar a matéria mais fraca.'],
  desempenho: ['Seus números vêm das questões respondidas.', 'Estude um pouco todo dia para manter a sequência.'],
  pegadinhas: ['Cole um trecho de lei, apostila ou questão.', 'Vermelho: palavras absolutas (sempre, nunca, somente).', 'Amarelo: exceções (salvo, exceto).', 'Azul: prazos e números, que as bancas adoram trocar.'],
  recursos: ['Preencha os dados da questão e seus argumentos.', 'Cite a lei ou a fonte que sustenta o pedido.', 'Gere, revise e copie o texto para o sistema da banca.']
};
function renderLateral() {
  const passos = GUIAS[estado.modulo] || GUIAS.inicio;
  let html = '';
  if (estado.modulo === 'questoes') {
    const lista = questoesFiltradas(); const r = respostas();
    html += `<div class="${CARTAO} !p-5 space-y-3">
      <h3 class="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"><i data-lucide="layout-grid" class="w-4 h-4 text-indigo-600"></i> Cartão de respostas</h3>
      <div class="grid grid-cols-6 gap-2">${lista.map((q, i) => {
        let c = 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400';
        if (r[q.id]) c = r[q.id].acertou ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300';
        if (i === estado.qIdx) c = 'bg-indigo-600 border-indigo-700 text-white ring-2 ring-indigo-300';
        return `<button onclick="irParaQuestao(${i})" class="aspect-square rounded-lg border text-xs font-mono font-bold ${c}">${i + 1}</button>`;
      }).join('')}</div>
      <div class="flex justify-between text-[10px] text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800"><span>🟩 acerto</span><span>🟥 erro</span><span>🟦 atual</span><span>⬜ pendente</span></div>
    </div>`;
  }
  html += `<div class="${CARTAO} !p-5 space-y-3">
    <h3 class="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"><i data-lucide="compass" class="w-4 h-4 text-indigo-600"></i> Guia rápido</h3>
    <ol class="space-y-2.5">${passos.map((p, i) => `<li class="flex gap-2.5 text-xs text-slate-700 dark:text-slate-300"><span class="w-5 h-5 shrink-0 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">${i + 1}</span><span>${p}</span></li>`).join('')}</ol>
  </div>`;
  const a = area();
  if (a) {
    html += `<div class="${CARTAO} !p-5 space-y-2">
      <h3 class="font-bold text-xs uppercase tracking-wider">Seu plano • ${a.nome}</h3>
      <p class="text-[11px] text-slate-600 dark:text-slate-400">Cargos comuns: ${a.cargos.join('; ')}.</p>
      <div class="flex flex-wrap gap-1.5 pt-1">${materiasDaArea().map(m => `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-md ${MATERIAS[m].comum ? 'bg-slate-100 dark:bg-slate-800' : COR[a.cor]}">${MATERIAS[m].nome}</span>`).join('')}</div>
    </div>`;
  }
  document.getElementById('lateral').innerHTML = html;
}

// ---------- TEMA E CRONÔMETRO ----------
function alternarTema() {
  const escuro = document.documentElement.classList.toggle('dark');
  try { localStorage.setItem('theme', escuro ? 'dark' : 'light'); } catch (e) {}
  atualizarIconeTema();
}
function atualizarIconeTema() {
  const i = document.getElementById('icone-tema');
  const escuro = document.documentElement.classList.contains('dark');
  if (i) { i.setAttribute('data-lucide', escuro ? 'sun' : 'moon'); }
  icones();
}
let segundos = 0, cronometroAtivo = true;
// O cronômetro só aparece e só conta dentro dos módulos de estudo (não na tela inicial, em Planos ou no Perfil).
function emAreaDeEstudo() { return MODULOS.some(m => m.id === estado.modulo && m.grupo !== 'breve'); }
function mostrarCronometro() { const cx = document.getElementById('caixa-cronometro'); if (cx) cx.style.display = emAreaDeEstudo() ? '' : 'none'; }
setInterval(() => {
  if (!cronometroAtivo || !emAreaDeEstudo()) return;
  segundos++;
  const h = String(Math.floor(segundos / 3600)).padStart(2, '0');
  const m = String(Math.floor(segundos % 3600 / 60)).padStart(2, '0');
  const s = String(segundos % 60).padStart(2, '0');
  const el = document.getElementById('cronometro'); if (el) el.textContent = `${h}:${m}:${s}`;
}, 1000);
function alternarCronometro() {
  cronometroAtivo = !cronometroAtivo;
  document.getElementById('btn-cronometro').textContent = cronometroAtivo ? 'Pausar' : 'Retomar';
}

// ---------- CONEXÃO COM A API ----------
// Endereço da API: no PC é a porta 8765; publicado, a própria página serve a API em /api.
// Para trocar, defina window.API_CONCURSOS antes de app.js.
const API = window.API_CONCURSOS || (['127.0.0.1', 'localhost'].includes(location.hostname) ? 'http://127.0.0.1:8765/api' : '/api');
let usandoAPI = false;
// Cabeçalho com o login do aluno (questões e flashcards só são entregues a quem entrou).
function cabecalhos(json) {
  const h = json ? { 'Content-Type': 'application/json' } : {};
  if (typeof tokenAtual !== 'undefined' && tokenAtual) h.Authorization = 'Bearer ' + tokenAtual;
  return h;
}
async function pegar(caminho) {
  const r = await fetch(API + caminho, { headers: cabecalhos(false) });
  if (!r.ok) throw new Error(caminho + ' ' + r.status);
  return r.json();
}
// Gabaritos que o aluno já recebeu ao responder (a API só entrega depois da resposta).
function aplicarGabaritos() {
  const g = ler().gabaritos || {};
  QUESTOES.forEach(q => { if (g[q.id]) { q.correta = g[q.id].correta; q.comentario = g[q.id].comentario; } });
}
// Respostas dadas sem o gabarito guardado neste aparelho: busca o gabarito uma vez.
async function completarGabaritos() {
  if (!usandoAPI) return;
  const r = respostas(); const dg = ler(); dg.gabaritos = dg.gabaritos || {};
  for (const q of QUESTOES.filter(q => r[q.id] && !q.correta)) {
    try {
      const g = await fetch(`${API}/questoes/${encodeURIComponent(q.id)}/responder`, {
        method: 'POST', headers: cabecalhos(true), body: JSON.stringify({ resposta: r[q.id].escolha })
      }).then(x => x.json());
      q.correta = g.correta; q.comentario = g.comentario || '';
      dg.gabaritos[q.id] = { correta: q.correta, comentario: q.comentario };
    } catch (e) {}
  }
  salvar(dg);
}
async function carregarDaAPI() {
  try {
    const [areas, materias, cards] = await Promise.all([pegar('/areas'), pegar('/materias'), pegar('/flashcards')]);
    Object.keys(MATERIAS).forEach(k => delete MATERIAS[k]);
    materias.forEach(m => { MATERIAS[m.id] = { nome: m.nome, comum: m.comum, topicos: m.topicos, total_questoes: m.total_questoes }; });
    AREAS.splice(0, AREAS.length, ...areas);
    MATERIAS_COMUNS.splice(0, MATERIAS_COMUNS.length, ...materias.filter(m => m.comum).map(m => m.id));
    QUESTOES.splice(0, QUESTOES.length);
    FLASHCARDS.splice(0, FLASHCARDS.length, ...cards);
    usandoAPI = true;
    estadoConteudo = 'ok';
  } catch (e) {
    console.warn('Não foi possível carregar o conteúdo da API:', e.message);
    estadoConteudo = 'erro';
  }
  abrir(estado.modulo);
  if (estadoConteudo === 'ok') carregarQuestoesArea();   // só as questões da área do aluno, não o banco todo
}

// ---------- CARGA DAS QUESTÕES (limite estável) ----------
// A página nunca baixa o banco inteiro: só a área do aluno, em lotes de 100, até TETO_QUESTOES de uma vez.
// O servidor alterna entre as matérias e sorteia um conjunto novo a cada visita (semente). O aluno pode pedir
// mais lotes no Caderno. Assim o tamanho do download não cresce quando entram mais questões no banco.
const TETO_QUESTOES = 500, LOTE_QUESTOES = 100;
let cargaId = 0, inicioArea = 0;
function acrescentarQuestoes(lista) {
  const ja = new Set(QUESTOES.map(q => q.id));
  lista.filter(q => !ja.has(q.id)).forEach(q => QUESTOES.push({ ...q, correta: null, comentario: '' }));
}
async function carregarQuestoesArea() {
  const id = ++cargaId;
  QUESTOES.splice(0, QUESTOES.length);
  inicioArea = 0;
  if (!estado.areaId || !usandoAPI) return;
  estado.carregandoQuestoes = true; estado.semente = Math.random().toString(36).slice(2, 10);
  if (estado.modulo === 'questoes') abrir('questoes');
  try {
    while (QUESTOES.length < TETO_QUESTOES) {
      const lote = await pegar(`/questoes?area=${encodeURIComponent(estado.areaId)}&limite=${LOTE_QUESTOES}&inicio=${inicioArea}&semente=${estado.semente}`);
      if (id !== cargaId) return;   // o aluno trocou de área no meio da carga
      if (!lote.questoes.length) break;
      acrescentarQuestoes(lote.questoes); inicioArea += lote.questoes.length;
      if (inicioArea >= lote.total) break;
    }
    aplicarGabaritos();
    await completarGabaritos();
  } catch (e) {
    console.warn('Não foi possível carregar as questões:', e.message);
  }
  if (id !== cargaId) return;
  estado.carregandoQuestoes = false;
  if (['questoes', 'simulado'].includes(estado.modulo)) abrir(estado.modulo);
}
// Botão "Carregar mais" do Caderno: mais um lote do filtro atual (da matéria escolhida ou da área).
async function carregarMaisQuestoes() {
  if (estado.carregandoQuestoes) return;
  const id = cargaId, m = estado.filtroMateria;
  estado.carregandoQuestoes = true; abrir('questoes');
  try {
    const inicio = m === 'todas' ? inicioArea : QUESTOES.filter(q => q.materia === m).length;
    const alvo = m === 'todas' ? `area=${encodeURIComponent(estado.areaId)}` : `materia=${encodeURIComponent(m)}`;
    const lote = await pegar(`/questoes?${alvo}&limite=${LOTE_QUESTOES}&inicio=${inicio}&semente=${estado.semente}`);
    if (id !== cargaId) return;
    acrescentarQuestoes(lote.questoes);
    if (m === 'todas') inicioArea += lote.questoes.length;
    aplicarGabaritos();
    await completarGabaritos();
    // se o aluno está numa questão já respondida, leva para a primeira que ainda não respondeu
    const lista = questoesFiltradas(), r = respostas(), prox = lista.findIndex(q => !r[q.id]);
    if (prox >= 0 && lista[estado.qIdx] && r[lista[estado.qIdx].id]) estado.qIdx = prox;
  } catch (e) {
    alert('Não foi possível carregar mais questões agora. Verifique sua conexão e tente de novo.');
  }
  if (id !== cargaId) return;
  estado.carregandoQuestoes = false;
  if (estado.modulo === 'questoes') abrir('questoes');
}

// Tela mostrada enquanto o conteúdo carrega ou quando a API não responde.
function telaConteudo() {
  const erro = estadoConteudo === 'erro';
  document.getElementById('painel').innerHTML = `<div class="${CARTAO} text-center space-y-3 max-w-lg mx-auto">
    <i data-lucide="${erro ? 'wifi-off' : 'loader'}" class="w-8 h-8 mx-auto ${erro ? 'text-rose-500' : 'text-indigo-500 animate-spin'}"></i>
    <strong class="block">${erro ? 'Não foi possível carregar o conteúdo' : 'Carregando o conteúdo...'}</strong>
    ${erro ? `<p class="text-xs text-slate-600 dark:text-slate-400">Verifique sua conexão e tente de novo.</p><button onclick="recarregarConteudo()" class="${BOTAO}">Tentar de novo</button>` : ''}
  </div>`;
  document.getElementById('lateral').innerHTML = '';
  icones();
}
// O conteúdo só carrega depois do login (chamado por auth.js).
let conteudoIniciado = false;
function iniciarConteudo() { if (conteudoIniciado) return; conteudoIniciado = true; carregarDaAPI(); }
function recarregarConteudo() { estadoConteudo = 'carregando'; telaConteudo(); carregarDaAPI(); carregarConteudo(); }

// Planos e preços (editados na administração; estes são os valores de partida).
let PLANOS = {"mensal": {"preco": 19.9}, "anual": {"preco": 179.9, "parcelas": 12}, "beneficios": ["Questões comentadas de todas as áreas", "Flashcards com revisão espaçada", "Edital verticalizado da sua área", "Diagnóstico de pontos fracos e desempenho por matéria", "Redação com autoavaliação pelos critérios das bancas", "Marcador de pegadinhas e modelo de recurso", "Seu progresso salvo na conta, em qualquer aparelho"]};

// Textos editados na administração (módulos, guias, rodapé, critérios da redação e pegadinhas).
async function carregarConteudo() {
  try {
    const c = await pegar('/conteudo');
    if (c.modulos) MODULOS.forEach(m => { const x = c.modulos[m.id]; if (x) { m.nome = esc(x.nome); m.desc = esc(x.desc); } });
    if (c.guias) Object.keys(c.guias).forEach(k => { GUIAS[k] = c.guias[k].map(esc); });
    if (c.criterios_redacao) CRITERIOS_REDACAO.splice(0, CRITERIOS_REDACAO.length, ...c.criterios_redacao.map(esc));
    if (c.pegadinhas) { PEGADINHAS.alerta = c.pegadinhas.alerta; PEGADINHAS.excecao = c.pegadinhas.excecao; }
    if (c.planos) PLANOS = c.planos;
    loginObrigatorio = c.acesso ? c.acesso.login_obrigatorio !== false : true;
    aplicarRegraDeLogin();
    const rodape = document.getElementById('rodape');
    if (c.rodape && rodape) rodape.textContent = c.rodape;
    abrir(estado.modulo);
  } catch (e) {
    console.warn('Textos da administração indisponíveis, usando os padrões:', e.message);
    loginObrigatorio = true;   // sem saber a regra, exige login (mais seguro)
    if (typeof aplicarRegraDeLogin === 'function') aplicarRegraDeLogin();
  }
}

// ---------- INÍCIO ----------
abrir('inicio');
atualizarIconeTema();
carregarConteudo();
