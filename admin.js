// =====================================================================
// ÁREA ADMINISTRATIVA — só entra quem está na tabela admins do banco.
// =====================================================================
const API = window.API_CONCURSOS || (['127.0.0.1', 'localhost'].includes(location.hostname) ? 'http://127.0.0.1:8765/api' : '/api');
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let token = null;
let MATERIAS = [];
let aba = 'resumo';
const filtros = { alunos: { busca: '', pagina: 0 }, questoes: { materia: '', busca: '', revisada: '', pagina: 0 }, cards: { materia: '' } };

const CARTAO = 'bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-300 dark:border-slate-800 shadow-sm';
const BOTAO = 'px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs inline-flex items-center gap-1.5';
const BOTAO2 = 'px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs inline-flex items-center gap-1.5';
const BOTAO_PERIGO = 'px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-bold text-xs inline-flex items-center gap-1.5';
const CAMPO = 'w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm';

function esc(t) { const d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }
function icones() { if (window.lucide) lucide.createIcons(); }
function data(d) { return d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true }) : '—'; }
function nomeMateria(id) { const m = MATERIAS.find(x => x.id === id); return m ? m.nome : id; }
function opcoesMateria(sel, comTodas) {
  return (comTodas ? `<option value="">Todas as matérias</option>` : '') + MATERIAS.map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.nome)}</option>`).join('');
}

async function api(caminho, opcoes = {}) {
  const r = await fetch(API + caminho, { ...opcoes, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opcoes.headers || {}) } });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.detail ? (typeof corpo.detail === 'string' ? corpo.detail : 'Dados inválidos') : 'Erro ' + r.status);
  return corpo;
}
async function acao(fn, msgOk) {
  try { await fn(); if (msgOk) aviso(msgOk); } catch (e) { aviso(e.message, true); }
}
function aviso(msg, erro) {
  const el = document.createElement('div');
  el.className = `fixed bottom-4 right-4 z-[60] px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${erro ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`;
  el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 3500);
}

// ---------- LOGIN ----------
function telaEntrar(msg) {
  document.getElementById('abas').innerHTML = '';
  document.getElementById('conteudo').innerHTML = `<form onsubmit="entrar(event)" class="${CARTAO} max-w-sm mx-auto mt-10 space-y-3">
    <h1 class="text-lg font-extrabold">Entrar na administração</h1>
    <p class="text-xs text-slate-600 dark:text-slate-400">Use sua conta Ensino Plus. Só administradores têm acesso.</p>
    ${msg ? `<p class="text-xs p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">${esc(msg)}</p>` : ''}
    <input id="e-email" type="email" required placeholder="E-mail" class="${CAMPO}" autocomplete="email">
    <input id="e-senha" type="password" required placeholder="Senha" class="${CAMPO}" autocomplete="current-password">
    <button class="${BOTAO} w-full justify-center">Entrar</button>
  </form>`;
  icones();
}
async function entrar(ev) {
  ev.preventDefault();
  const { error } = await sb.auth.signInWithPassword({ email: document.getElementById('e-email').value.trim(), password: document.getElementById('e-senha').value });
  if (error) telaEntrar(/Invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar.');
}
async function sair() { await sb.auth.signOut(); }

sb.auth.onAuthStateChange(async (ev, sessao) => {
  token = sessao ? sessao.access_token : null;
  if (ev === 'TOKEN_REFRESHED') return;
  if (!token) {
    // Se o servidor estiver com ADMIN_SEM_LOGIN ligado, a administração abre sem entrar.
    try { const eu = await api('/admin/eu'); if (eu.sem_login) { abrirSemLogin(eu); return; } } catch (e) {}
    telaEntrar(); return;
  }
  try {
    const eu = await api('/admin/eu');
    document.getElementById('adm-email').textContent = eu.email;
    MATERIAS = await fetch(API + '/materias').then(r => r.json());
    mostrar(aba);
  } catch (e) {
    document.getElementById('abas').innerHTML = '';
    document.getElementById('conteudo').innerHTML = `<div class="${CARTAO} max-w-md mx-auto mt-10 space-y-3 text-sm">
      <strong class="block">Sem acesso à administração</strong>
      <p class="text-slate-600 dark:text-slate-400">${esc(e.message)}. Peça para um administrador liberar sua conta.</p>
      <div class="flex gap-2"><a href="index.html" class="${BOTAO2}">Voltar para a página</a><button onclick="sair()" class="${BOTAO2}">Entrar com outra conta</button></div></div>`;
  }
});

async function abrirSemLogin(eu) {
  document.getElementById('adm-email').textContent = eu.email;
  if (!document.getElementById('aviso-sem-login')) {
    const faixa = document.createElement('div');
    faixa.id = 'aviso-sem-login';
    faixa.className = 'px-4 py-2 text-xs font-bold text-center bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
    faixa.textContent = 'Administração aberta SEM login (ADMIN_SEM_LOGIN ligado no servidor). Qualquer pessoa com este endereço vê os alunos e pode alterar o conteúdo.';
    document.body.insertBefore(faixa, document.body.firstChild);
  }
  MATERIAS = await fetch(API + '/materias').then(r => r.json());
  mostrar(aba);
}

// ---------- ABAS ----------
const ABAS = [['resumo', 'Resumo', 'layout-dashboard'], ['alunos', 'Alunos', 'users'], ['questoes', 'Questões', 'check-square'], ['cards', 'Flashcards', 'layers'], ['areas', 'Áreas', 'compass'], ['materias', 'Matérias e edital', 'list-checks'], ['textos', 'Textos da página', 'type'], ['admins', 'Administradores', 'shield'], ['historico', 'Histórico', 'history']];
function mostrar(a) {
  aba = a;
  document.getElementById('abas').innerHTML = ABAS.map(([id, nome, ic]) => `<button onclick="mostrar('${id}')" class="px-3 py-2.5 border-b-2 whitespace-nowrap inline-flex items-center gap-1.5 ${id === aba ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'}"><i data-lucide="${ic}" class="w-4 h-4"></i>${nome}</button>`).join('');
  document.getElementById('conteudo').innerHTML = '<p class="text-sm text-slate-500">Carregando...</p>';
  ({ resumo: abaResumo, alunos: abaAlunos, questoes: abaQuestoes, cards: abaCards, areas: abaAreas, materias: abaMaterias, textos: abaTextos, admins: abaAdmins, historico: abaHistorico })[a]().then(icones).catch(e => {
    document.getElementById('conteudo').innerHTML = `<p class="text-sm text-rose-600">${esc(e.message)}</p>`;
  });
}
function conteudo(html) { document.getElementById('conteudo').innerHTML = html; icones(); }

// ---------- RESUMO ----------
async function abaResumo() {
  const r = await api('/admin/resumo');
  const bloco = (rotulo, valor, dica) => `<div class="${CARTAO}"><span class="text-xs font-bold text-slate-500 uppercase">${rotulo}</span><strong class="block text-3xl mt-1">${valor}</strong>${dica ? `<span class="text-xs text-slate-500">${dica}</span>` : ''}</div>`;
  conteudo(`<div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
    ${bloco('Alunos', r.alunos, `${r.ativos_7d} ativos nos últimos 7 dias`)}
    ${bloco('Questões', r.questoes, `${r.questoes_nao_revisadas} aguardando revisão`)}
    ${bloco('Flashcards', r.flashcards)}
    ${bloco('Matérias', MATERIAS.length)}
    ${bloco('Alunos com progresso', r.alunos_com_progresso, 'têm o progresso guardado na conta')}
    ${bloco('Respostas registradas', r.respostas_total, 'em questões respondidas pelos alunos')}
  </div>`);
}

// ---------- ALUNOS ----------
async function abaAlunos() {
  const f = filtros.alunos;
  const r = await api(`/admin/alunos?busca=${encodeURIComponent(f.busca)}&pagina=${f.pagina}`);
  ALUNOS_TELA = r.alunos;
  PRE_TELA = r.pre || [];
  const linhas = r.alunos.map(a => `<tr class="border-t border-slate-200 dark:border-slate-800">
      <td class="py-2 pr-3"><strong>${esc(a.nome || '—')}</strong><span class="block text-xs text-slate-500">${esc(a.email)}</span></td>
      <td class="py-2 pr-3"><select onchange="editarAluno('${a.id}', { plano: this.value })" class="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1">
        ${['gratuito', 'mensal', 'anual', 'bloqueado'].map(p => `<option ${p === a.plano ? 'selected' : ''}>${p}</option>`).join('')}</select></td>
      <td class="py-2 pr-3 text-xs">${validadeTexto(a)}</td>
      <td class="py-2 pr-3 text-xs capitalize">${esc(a.origem || 'manual')}${a.observacao ? ` <span title="${esc(a.observacao)}" class="cursor-help">📝</span>` : ''}</td>
      <td class="py-2 pr-3 text-xs">${data(a.primeiro_acesso)}</td>
      <td class="py-2 pr-3 text-xs">${data(a.ultimo_acesso)}</td>
      <td class="py-2 pr-3 text-xs text-center">${a.acessos}</td>
      <td class="py-2 pr-3 text-xs"><label class="inline-flex items-center gap-1"><input type="checkbox" ${a.admin ? 'checked' : ''} onchange="editarAluno('${a.id}', { admin: this.checked }, this)"> admin</label></td>
      <td class="py-2 text-right"><button onclick="formEditarAluno('${a.id}')" class="${BOTAO2}"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar</button> <button onclick="verDesempenho('${a.id}')" title="Ver desempenho" class="${BOTAO2}"><i data-lucide="activity" class="w-3.5 h-3.5"></i>Desempenho</button>${a.admin ? '' : ` <button onclick="apagarAluno('${a.id}')" title="Apagar aluno" class="${BOTAO_PERIGO}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>`}</td>
    </tr>`).join('');
  conteudo(`<div class="${CARTAO} space-y-4">
    <div class="flex flex-wrap gap-2 items-center justify-between">
      <h2 class="font-extrabold">Alunos <span class="text-slate-500 font-semibold">(${r.total})</span></h2>
      <button onclick="formAluno()" class="${BOTAO}"><i data-lucide="user-plus" class="w-4 h-4"></i>Adicionar aluno</button>
      <form onsubmit="event.preventDefault(); filtros.alunos.busca = this.b.value; filtros.alunos.pagina = 0; mostrar('alunos')" class="flex gap-2">
        <input name="b" value="${esc(f.busca)}" placeholder="Buscar por nome ou e-mail" class="${CAMPO} !w-64"><button class="${BOTAO2}">Buscar</button></form>
    </div>
    <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-xs text-slate-500 uppercase"><th class="pb-2">Aluno</th><th>Plano</th><th>Validade</th><th>Origem</th><th>1º acesso</th><th>Último acesso</th><th>Acessos</th><th>Admin</th><th></th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="9" class="py-4 text-slate-500">Nenhum aluno encontrado.</td></tr>'}</tbody></table></div>
    ${paginacao('alunos', r.total, 50)}
    ${PRE_TELA.length ? `<div class="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
      <h3 class="font-bold text-sm">Cadastrados, aguardando o primeiro login <span class="text-slate-500 font-semibold">(${PRE_TELA.length})</span></h3>
      <table class="w-full text-sm"><tbody>${PRE_TELA.map(p => `<tr class="border-t border-slate-200 dark:border-slate-800">
        <td class="py-2 pr-3"><strong>${esc(p.nome || '—')}</strong><span class="block text-xs text-slate-500">${esc(p.email)}</span></td>
        <td class="pr-3 text-xs">${esc(p.plano)}${p.plano_validade ? ' até ' + dia(p.plano_validade) : ''}</td><td class="pr-3 text-xs capitalize">${esc(p.origem || 'manual')}</td><td class="pr-3 text-xs">${data(p.criado_em)}</td>
        <td class="text-right"><button onclick="cancelarPre('${esc(p.email)}')" class="${BOTAO2}">Cancelar</button></td></tr>`).join('')}</tbody></table>
    </div>` : ''}
  </div>`);
}
const ORIGENS = [['manual', 'Manual'], ['cortesia', 'Cortesia'], ['hotmart', 'Hotmart'], ['asaas', 'Asaas'], ['outro', 'Outro']];
const UFS_ADM = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
function dia(d) { return d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—'; }
function validadeTexto(a) {
  if (a.plano !== 'mensal' && a.plano !== 'anual') return '<span class="text-slate-400">—</span>';
  if (!a.plano_validade) return '<span class="text-amber-600 dark:text-amber-400 font-semibold" title="Plano pago sem data de vencimento">sem validade</span>';
  return dia(a.plano_validade);
}
function camposAluno(a, novo) {
  a = a || {};
  return `<div class="grid sm:grid-cols-2 gap-3">
    ${novo ? `<label class="text-xs font-bold block sm:col-span-2">E-mail da conta Ensino Plus<input name="email" type="email" required class="${CAMPO} mt-1" placeholder="aluno@exemplo.com"></label>` : `<p class="sm:col-span-2 text-xs text-slate-500">${esc(a.email)}</p>`}
    <label class="text-xs font-bold block sm:col-span-2">Nome ${novo ? '<span class="font-normal text-slate-500">(opcional)</span>' : ''}<input name="nome" maxlength="120" value="${esc(a.nome || '')}" class="${CAMPO} mt-1"></label>
    <label class="text-xs font-bold block">Plano<select name="plano" class="${CAMPO} mt-1">${['gratuito', 'mensal', 'anual', 'bloqueado'].filter(p => !novo || p !== 'bloqueado').map(p => `<option ${p === (a.plano || 'gratuito') ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
    <label class="text-xs font-bold block">Validade do plano<input name="plano_validade" type="date" value="${esc(a.plano_validade ? String(a.plano_validade).slice(0, 10) : '')}" class="${CAMPO} mt-1"><span class="font-normal text-[11px] text-slate-500">Só para mensal e anual. Vencido, volta para gratuito.</span></label>
    <label class="text-xs font-bold block">Origem<select name="origem" class="${CAMPO} mt-1">${ORIGENS.map(([v, n]) => `<option value="${v}" ${v === (a.origem || 'manual') ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="text-xs font-bold block">WhatsApp<input name="whatsapp" value="${esc(a.whatsapp || '')}" placeholder="(85) 99999-9999" inputmode="tel" class="${CAMPO} mt-1"></label>
    <label class="text-xs font-bold block">Cidade<input name="cidade" maxlength="80" value="${esc(a.cidade || '')}" class="${CAMPO} mt-1"></label>
    <label class="text-xs font-bold block">Estado<select name="uf" class="${CAMPO} mt-1"><option value="">—</option>${UFS_ADM.map(u => `<option ${u === a.uf ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
    <label class="text-xs font-bold block sm:col-span-2">Concurso que está estudando<input name="concurso_alvo" maxlength="120" value="${esc(a.concurso_alvo || '')}" class="${CAMPO} mt-1"></label>
    <label class="text-xs font-bold block sm:col-span-2">Observação interna <span class="font-normal text-slate-500">(só a equipe vê)</span><textarea name="observacao" rows="2" maxlength="500" class="${CAMPO} mt-1" placeholder="Ex.: pagou por PIX em 18/11">${esc(a.observacao || '')}</textarea></label>
  </div>`;
}
function dadosDoForm(f) {
  return { nome: f.nome.value, plano: f.plano.value, plano_validade: f.plano_validade.value, origem: f.origem.value, whatsapp: f.whatsapp.value, cidade: f.cidade.value, uf: f.uf.value, concurso_alvo: f.concurso_alvo.value, observacao: f.observacao.value };
}
function formAluno() {
  abrirModal(`<form onsubmit="salvarNovoAluno(event)" class="${CARTAO} w-full max-w-xl space-y-3 my-8">
    <div class="flex justify-between items-center"><h2 class="font-extrabold">Adicionar aluno</h2><button type="button" onclick="fecharModal()"><i data-lucide="x" class="w-5 h-5"></i></button></div>
    ${camposAluno(null, true)}
    <p class="text-[11px] text-slate-500">A pessoa entra na página com este mesmo e-mail (criando a conta ou usando a que já tem). No primeiro login, os dados definidos aqui passam a valer.</p>
    <div class="flex justify-end gap-2"><button type="button" onclick="fecharModal()" class="${BOTAO2}">Cancelar</button><button class="${BOTAO}">Adicionar</button></div>
  </form>`);
}
function formEditarAluno(id) {
  const a = ALUNOS_TELA.find(x => x.id === id);
  if (!a) return;
  abrirModal(`<form onsubmit="salvarEdicaoAluno(event, '${id}')" class="${CARTAO} w-full max-w-xl space-y-3 my-8">
    <div class="flex justify-between items-center"><h2 class="font-extrabold">Editar aluno</h2><button type="button" onclick="fecharModal()"><i data-lucide="x" class="w-5 h-5"></i></button></div>
    ${camposAluno(a, false)}
    <div class="flex justify-end gap-2"><button type="button" onclick="fecharModal()" class="${BOTAO2}">Cancelar</button><button class="${BOTAO}">Salvar</button></div>
  </form>`);
}
async function salvarEdicaoAluno(ev, id) {
  ev.preventDefault();
  try {
    await api('/admin/alunos/' + id, { method: 'PATCH', body: JSON.stringify(dadosDoForm(ev.target)) });
    fecharModal(); aviso('Aluno atualizado.'); mostrar('alunos');
  } catch (e) { aviso(e.message, true); }
}
async function salvarNovoAluno(ev) {
  ev.preventDefault();
  const f = ev.target;
  try {
    await api('/admin/alunos', { method: 'POST', body: JSON.stringify({ email: f.email.value, ...dadosDoForm(f) }) });
    fecharModal(); aviso('Aluno cadastrado. Os dados valem no primeiro login dele.'); mostrar('alunos');
  } catch (e) { aviso(e.message, true); }
}
async function cancelarPre(email) {
  if (!confirm(`Cancelar o cadastro de ${email}?`)) return;
  await acao(() => api('/admin/alunos/pre/' + encodeURIComponent(email), { method: 'DELETE' }), 'Cadastro cancelado.');
  mostrar('alunos');
}
async function editarAluno(id, dados, caixa) {
  if (dados.admin !== undefined && !confirm(dados.admin ? 'Dar acesso de administrador a este aluno?' : 'Tirar o acesso de administrador deste aluno?')) { if (caixa) caixa.checked = !caixa.checked; return; }
  await acao(() => api('/admin/alunos/' + id, { method: 'PATCH', body: JSON.stringify(dados) }), 'Aluno atualizado.');
  mostrar('alunos');
}
async function apagarAluno(id) {
  const a = ALUNOS_TELA.find(x => x.id === id);
  if (!a) return;
  if (!confirm(`Apagar o aluno ${a.nome || a.email} (${a.email})?\n\nIsso remove o cadastro dele deste projeto (plano, perfil, foto e progresso de estudo). A conta de login Ensino Plus continua existindo: se ele entrar de novo na página, volta como aluno novo, gratuito.\n\nPara impedir o acesso, mude o plano para "bloqueado" em vez de apagar.`)) return;
  await acao(() => api('/admin/alunos/' + id, { method: 'DELETE' }), 'Aluno apagado.');
  mostrar('alunos');
}
function renomearAluno(id) {
  const a = ALUNOS_TELA.find(x => x.id === id);
  const nome = prompt('Nome do aluno:', (a && a.nome) || '');
  if (nome !== null) editarAluno(id, { nome });
}
function paginacao(alvo, total, porPagina) {
  const f = filtros[alvo]; const paginas = Math.ceil(total / porPagina);
  if (paginas <= 1) return '';
  return `<div class="flex items-center gap-2 text-xs">
    <button ${f.pagina === 0 ? 'disabled' : ''} onclick="filtros.${alvo}.pagina--; mostrar('${alvo}')" class="${BOTAO2}">Anterior</button>
    <span>Página ${f.pagina + 1} de ${paginas}</span>
    <button ${f.pagina + 1 >= paginas ? 'disabled' : ''} onclick="filtros.${alvo}.pagina++; mostrar('${alvo}')" class="${BOTAO2}">Próxima</button></div>`;
}

// ---------- QUESTÕES ----------
let QUESTOES_TELA = [];
let ALUNOS_TELA = [];
let PRE_TELA = [];
async function abaQuestoes() {
  const f = filtros.questoes;
  const r = await api(`/admin/questoes?materia=${f.materia}&busca=${encodeURIComponent(f.busca)}&revisada=${f.revisada}&pagina=${f.pagina}`);
  QUESTOES_TELA = r.questoes;
  const lista = r.questoes.map((q, i) => `<div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="font-mono font-bold">${esc(q.id)}</span>
        <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold">${esc(nomeMateria(q.materia))}</span>
        <span class="px-2 py-0.5 rounded-md ${q.revisada ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'} font-semibold">${q.revisada ? 'Revisada' : 'Não revisada'}</span>
        <span class="text-slate-500">${esc(q.fonte)}</span>
        <span class="ml-auto font-bold text-emerald-700 dark:text-emerald-400">Gabarito: ${esc(q.correta)}</span>
      </div>
      <p class="text-sm">${esc(q.enunciado)}</p>
      <div class="flex gap-2"><button onclick="formQuestao(${i})" class="${BOTAO2}"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar</button>
        <button onclick="apagarQuestao('${esc(q.id)}')" class="${BOTAO_PERIGO}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Apagar</button></div>
    </div>`).join('');
  conteudo(`<div class="${CARTAO} space-y-4">
    <div class="flex flex-wrap gap-2 items-center justify-between">
      <h2 class="font-extrabold">Questões <span class="text-slate-500 font-semibold">(${r.total})</span></h2>
      <div class="flex gap-2"><button onclick="formQAPI()" class="${BOTAO2}"><i data-lucide="cloud-download" class="w-4 h-4"></i>Importar da QAPI</button>
      <button onclick="formImportar()" class="${BOTAO2}"><i data-lucide="upload" class="w-4 h-4"></i>Importar em lote</button>
      <button onclick="formQuestao(-1)" class="${BOTAO}"><i data-lucide="plus" class="w-4 h-4"></i>Nova questão</button></div>
    </div>
    <form onsubmit="event.preventDefault(); Object.assign(filtros.questoes, { materia: this.m.value, revisada: this.r.value, busca: this.b.value, pagina: 0 }); mostrar('questoes')" class="flex flex-wrap gap-2">
      <select name="m" class="${CAMPO} !w-auto">${opcoesMateria(f.materia, true)}</select>
      <select name="r" class="${CAMPO} !w-auto"><option value="">Revisadas e não revisadas</option><option value="nao" ${f.revisada === 'nao' ? 'selected' : ''}>Só não revisadas</option><option value="sim" ${f.revisada === 'sim' ? 'selected' : ''}>Só revisadas</option></select>
      <input name="b" value="${esc(f.busca)}" placeholder="Buscar no enunciado ou código" class="${CAMPO} !w-64"><button class="${BOTAO2}">Filtrar</button>
    </form>
    <div class="space-y-3">${lista || '<p class="text-sm text-slate-500">Nenhuma questão encontrada.</p>'}</div>
    ${paginacao('questoes', r.total, 50)}
  </div>`);
}
function abrirModal(html) { const m = document.getElementById('modal'); m.innerHTML = html; m.classList.remove('hidden'); icones(); }
function fecharModal() { const m = document.getElementById('modal'); m.classList.add('hidden'); m.innerHTML = ''; }
function formQuestao(i) {
  const q = i >= 0 ? QUESTOES_TELA[i] : { id: '', materia: filtros.questoes.materia || MATERIAS[0].id, enunciado: '', alternativas: { A: '', B: '', C: '', D: '' }, correta: 'A', comentario: '', fonte: 'Ensino Plus (autoral)', revisada: false };
  const letras = ['A', 'B', 'C', 'D', 'E'];
  abrirModal(`<form onsubmit="salvarQuestao(event, ${i >= 0 ? `'${esc(q.id)}'` : 'null'})" class="${CARTAO} w-full max-w-2xl space-y-3 my-8">
    <div class="flex justify-between items-center"><h2 class="font-extrabold">${i >= 0 ? 'Editar questão ' + esc(q.id) : 'Nova questão'}</h2><button type="button" onclick="fecharModal()"><i data-lucide="x" class="w-5 h-5"></i></button></div>
    <div class="grid sm:grid-cols-2 gap-3">
      <label class="text-xs font-bold">Matéria<select name="materia" class="${CAMPO} mt-1">${opcoesMateria(q.materia)}</select></label>
      <label class="text-xs font-bold">Código ${i >= 0 ? '' : '<span class="font-normal text-slate-500">(opcional)</span>'}<input name="codigo" value="${esc(q.id)}" ${i >= 0 ? 'disabled' : ''} class="${CAMPO} mt-1"></label>
    </div>
    <label class="text-xs font-bold block">Enunciado<textarea name="enunciado" required rows="4" class="${CAMPO} mt-1">${esc(q.enunciado)}</textarea></label>
    ${letras.map(l => `<label class="text-xs font-bold flex items-center gap-2"><input type="radio" name="correta" value="${l}" ${q.correta === l ? 'checked' : ''} title="Marcar como correta"><span class="w-4">${l})</span><input name="alt${l}" value="${esc((q.alternativas || {})[l] || '')}" placeholder="${l === 'E' ? 'Alternativa E (opcional)' : 'Alternativa ' + l}" class="${CAMPO}"></label>`).join('')}
    <p class="text-[11px] text-slate-500">Marque o círculo da alternativa correta.</p>
    <label class="text-xs font-bold block">Comentário / explicação<textarea name="comentario" rows="3" class="${CAMPO} mt-1">${esc(q.comentario)}</textarea></label>
    <div class="grid sm:grid-cols-2 gap-3 items-end">
      <label class="text-xs font-bold">Fonte<input name="fonte" value="${esc(q.fonte)}" class="${CAMPO} mt-1"></label>
      <label class="text-xs font-bold inline-flex items-center gap-2 pb-2"><input type="checkbox" name="revisada" ${q.revisada ? 'checked' : ''}> Revisada por professor</label>
    </div>
    <div class="flex justify-end gap-2"><button type="button" onclick="fecharModal()" class="${BOTAO2}">Cancelar</button><button class="${BOTAO}">Salvar</button></div>
  </form>`);
}
async function salvarQuestao(ev, id) {
  ev.preventDefault();
  const f = ev.target;
  const alternativas = {};
  ['A', 'B', 'C', 'D', 'E'].forEach(l => { if (f['alt' + l].value.trim()) alternativas[l] = f['alt' + l].value; });
  const dados = { id: id || f.codigo.value || null, materia: f.materia.value, enunciado: f.enunciado.value, alternativas, correta: (f.correta.value || ''), comentario: f.comentario.value, fonte: f.fonte.value, revisada: f.revisada.checked };
  try {
    await api(id ? '/admin/questoes/' + encodeURIComponent(id) : '/admin/questoes', { method: id ? 'PUT' : 'POST', body: JSON.stringify(dados) });
    fecharModal(); aviso('Questão salva.'); mostrar('questoes');
  } catch (e) { aviso(e.message, true); }
}
async function apagarQuestao(id) {
  if (!confirm(`Apagar a questão ${id}? Ela some para todos os alunos. Uma cópia fica guardada no histórico.`)) return;
  await acao(() => api('/admin/questoes/' + encodeURIComponent(id), { method: 'DELETE' }), 'Questão apagada.');
  mostrar('questoes');
}

// ---------- FLASHCARDS ----------
let CARDS_TELA = [];
async function abaCards() {
  const f = filtros.cards;
  CARDS_TELA = await api('/admin/flashcards?materia=' + f.materia);
  const lista = CARDS_TELA.map((c, i) => `<div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
      <span class="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold">${esc(nomeMateria(c.materia))}</span>
      <p class="text-sm font-bold">${esc(c.frente)}</p>
      <p class="text-sm text-slate-600 dark:text-slate-400">${c.verso}</p>
      <div class="flex gap-2"><button onclick="formCard(${i})" class="${BOTAO2}"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar</button>
        <button onclick="apagarCard(${c.id})" class="${BOTAO_PERIGO}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Apagar</button></div>
    </div>`).join('');
  conteudo(`<div class="${CARTAO} space-y-4">
    <div class="flex flex-wrap gap-2 items-center justify-between">
      <h2 class="font-extrabold">Flashcards <span class="text-slate-500 font-semibold">(${CARDS_TELA.length})</span></h2>
      <div class="flex gap-2"><select onchange="filtros.cards.materia = this.value; mostrar('cards')" class="${CAMPO} !w-auto">${opcoesMateria(f.materia, true)}</select>
      <button onclick="formCard(-1)" class="${BOTAO}"><i data-lucide="plus" class="w-4 h-4"></i>Novo flashcard</button></div>
    </div>
    <div class="grid md:grid-cols-2 gap-3">${lista || '<p class="text-sm text-slate-500">Nenhum flashcard.</p>'}</div>
  </div>`);
}
function formCard(i) {
  const c = i >= 0 ? CARDS_TELA[i] : { materia: filtros.cards.materia || MATERIAS[0].id, frente: '', verso: '' };
  abrirModal(`<form onsubmit="salvarCard(event, ${i >= 0 ? c.id : 'null'})" class="${CARTAO} w-full max-w-xl space-y-3 my-8">
    <div class="flex justify-between items-center"><h2 class="font-extrabold">${i >= 0 ? 'Editar flashcard' : 'Novo flashcard'}</h2><button type="button" onclick="fecharModal()"><i data-lucide="x" class="w-5 h-5"></i></button></div>
    <label class="text-xs font-bold block">Matéria<select name="materia" class="${CAMPO} mt-1">${opcoesMateria(c.materia)}</select></label>
    <label class="text-xs font-bold block">Frente (pergunta)<textarea name="frente" required rows="2" class="${CAMPO} mt-1">${esc(c.frente)}</textarea></label>
    <label class="text-xs font-bold block">Verso (resposta) <span class="font-normal text-slate-500">aceita &lt;strong&gt; para negrito</span><textarea name="verso" required rows="4" class="${CAMPO} mt-1">${esc(c.verso)}</textarea></label>
    <div class="flex justify-end gap-2"><button type="button" onclick="fecharModal()" class="${BOTAO2}">Cancelar</button><button class="${BOTAO}">Salvar</button></div>
  </form>`);
}
async function salvarCard(ev, id) {
  ev.preventDefault();
  const f = ev.target;
  try {
    await api(id ? '/admin/flashcards/' + id : '/admin/flashcards', { method: id ? 'PUT' : 'POST', body: JSON.stringify({ materia: f.materia.value, frente: f.frente.value, verso: f.verso.value }) });
    fecharModal(); aviso('Flashcard salvo.'); mostrar('cards');
  } catch (e) { aviso(e.message, true); }
}
async function apagarCard(id) {
  if (!confirm('Apagar este flashcard? Uma cópia fica guardada no histórico.')) return;
  await acao(() => api('/admin/flashcards/' + id, { method: 'DELETE' }), 'Flashcard apagado.');
  mostrar('cards');
}

// ---------- MATÉRIAS ----------
async function abaMaterias() {
  MATERIAS = await fetch(API + '/materias').then(r => r.json());
  conteudo(`<div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs text-slate-600 dark:text-slate-400">Edite o nome e os tópicos do edital verticalizado. Um tópico por linha. Matéria básica aparece em todas as áreas.</p>
      <button onclick="formNovaMateria()" class="${BOTAO}"><i data-lucide="plus" class="w-4 h-4"></i>Nova matéria</button>
    </div>
    <div class="grid md:grid-cols-2 gap-4">${MATERIAS.map(m => `<form onsubmit="salvarMateria(event, '${m.id}')" class="${CARTAO} space-y-2">
      <input name="nome" required value="${esc(m.nome)}" class="${CAMPO} font-bold">
      <label class="inline-flex items-center gap-2 text-xs font-semibold"><input type="checkbox" name="comum" ${m.comum ? 'checked' : ''}> Matéria básica (aparece em todas as áreas)</label>
      <textarea name="topicos" rows="6" class="${CAMPO} text-xs">${esc(m.topicos.join('\n'))}</textarea>
      <div class="flex gap-2"><button class="${BOTAO2}"><i data-lucide="save" class="w-3.5 h-3.5"></i>Salvar</button>
        <button type="button" onclick="apagarMateria('${m.id}')" class="${BOTAO_PERIGO}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Apagar</button></div>
    </form>`).join('')}</div></div>`);
}
async function salvarMateria(ev, id) {
  ev.preventDefault();
  const f = ev.target;
  await acao(() => api('/admin/materias/' + id, { method: 'PUT', body: JSON.stringify({ nome: f.nome.value, comum: f.comum.checked, topicos: f.topicos.value.split('\n') }) }), 'Matéria salva.');
}
function formNovaMateria() {
  abrirModal(`<form onsubmit="salvarNovaMateria(event)" class="${CARTAO} w-full max-w-lg space-y-3 my-8">
    <div class="flex justify-between items-center"><h2 class="font-extrabold">Nova matéria</h2><button type="button" onclick="fecharModal()"><i data-lucide="x" class="w-5 h-5"></i></button></div>
    <label class="text-xs font-bold block">Nome<input name="nome" required maxlength="80" class="${CAMPO} mt-1" placeholder="Ex.: Direito Eleitoral"></label>
    <label class="inline-flex items-center gap-2 text-xs font-semibold"><input type="checkbox" name="comum"> Matéria básica (aparece em todas as áreas)</label>
    <label class="text-xs font-bold block">Tópicos do edital <span class="font-normal text-slate-500">(um por linha)</span><textarea name="topicos" rows="6" class="${CAMPO} mt-1"></textarea></label>
    <p class="text-[11px] text-slate-500">Depois de criar, inclua a matéria nas áreas desejadas na aba Áreas.</p>
    <div class="flex justify-end gap-2"><button type="button" onclick="fecharModal()" class="${BOTAO2}">Cancelar</button><button class="${BOTAO}">Criar</button></div>
  </form>`);
}
async function salvarNovaMateria(ev) {
  ev.preventDefault();
  const f = ev.target;
  try {
    await api('/admin/materias', { method: 'POST', body: JSON.stringify({ nome: f.nome.value, comum: f.comum.checked, topicos: f.topicos.value.split('\n') }) });
    fecharModal(); aviso('Matéria criada.'); mostrar('materias');
  } catch (e) { aviso(e.message, true); }
}
async function apagarMateria(id) {
  const m = MATERIAS.find(x => x.id === id);
  if (!confirm(`Apagar a matéria "${m ? m.nome : id}"? Ela sai também das áreas. Só é possível se não tiver questões nem flashcards.`)) return;
  await acao(() => api('/admin/materias/' + id, { method: 'DELETE' }), 'Matéria apagada.');
  mostrar('materias');
}

// ---------- ÁREAS ----------
const ICONES_AREA = ['briefcase', 'scale', 'gavel', 'shield', 'siren', 'landmark', 'piggy-bank', 'banknote', 'calculator', 'heart-pulse', 'stethoscope', 'graduation-cap', 'book-open', 'cpu', 'laptop', 'building-2', 'users', 'wrench', 'globe'];
const CORES_AREA = [['blue', 'Azul'], ['indigo', 'Índigo'], ['slate', 'Cinza'], ['emerald', 'Verde'], ['amber', 'Âmbar'], ['rose', 'Rosa'], ['violet', 'Violeta'], ['cyan', 'Ciano']];
const COR_CLASSE = { blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300', slate: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300', emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300', cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300' };
let AREAS_TELA = [];
async function abaAreas() {
  MATERIAS = await fetch(API + '/materias').then(r => r.json());
  AREAS_TELA = await fetch(API + '/areas').then(r => r.json());
  conteudo(`<div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs text-slate-600 dark:text-slate-400">As áreas são as opções que o aluno escolhe na página inicial. Cada área tem seus cargos e suas matérias (as básicas entram em todas).</p>
      <button onclick="formArea(-1)" class="${BOTAO}"><i data-lucide="plus" class="w-4 h-4"></i>Nova área</button>
    </div>
    <div class="grid md:grid-cols-2 gap-4">${AREAS_TELA.map((a, i) => `<div class="${CARTAO} space-y-3">
      <div class="flex items-start gap-3">
        <span class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${COR_CLASSE[a.cor] || COR_CLASSE.blue}"><i data-lucide="${esc(a.icone)}" class="w-5 h-5"></i></span>
        <div class="min-w-0"><strong class="block">${esc(a.nome)}</strong><span class="text-xs text-slate-600 dark:text-slate-400">${esc(a.descricao || '')}</span></div>
      </div>
      <p class="text-xs"><strong>Cargos:</strong> ${a.cargos.length ? esc(a.cargos.join(' • ')) : '—'}</p>
      <p class="text-xs"><strong>Matérias:</strong> ${a.materias.length ? a.materias.map(nomeMateria).map(esc).join(', ') : '—'}</p>
      <div class="flex gap-2"><button onclick="formArea(${i})" class="${BOTAO2}"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar</button>
        <button onclick="apagarArea('${a.id}')" class="${BOTAO_PERIGO}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Apagar</button></div>
    </div>`).join('')}</div></div>`);
}
function formArea(i) {
  const a = i >= 0 ? AREAS_TELA[i] : { nome: '', descricao: '', icone: 'briefcase', cor: 'blue', cargos: [], materias: [] };
  const icones = ICONES_AREA.includes(a.icone) ? ICONES_AREA : [a.icone, ...ICONES_AREA];
  abrirModal(`<form onsubmit="salvarArea(event, ${i >= 0 ? `'${a.id}'` : 'null'})" class="${CARTAO} w-full max-w-xl space-y-3 my-8">
    <div class="flex justify-between items-center"><h2 class="font-extrabold">${i >= 0 ? 'Editar área' : 'Nova área'}</h2><button type="button" onclick="fecharModal()"><i data-lucide="x" class="w-5 h-5"></i></button></div>
    <label class="text-xs font-bold block">Nome<input name="nome" required maxlength="60" value="${esc(a.nome)}" class="${CAMPO} mt-1"></label>
    <label class="text-xs font-bold block">Descrição<textarea name="descricao" rows="2" maxlength="200" class="${CAMPO} mt-1">${esc(a.descricao || '')}</textarea></label>
    <div class="grid sm:grid-cols-2 gap-3">
      <label class="text-xs font-bold block">Ícone<select name="icone" class="${CAMPO} mt-1">${icones.map(x => `<option ${x === a.icone ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <label class="text-xs font-bold block">Cor<select name="cor" class="${CAMPO} mt-1">${CORES_AREA.map(([v, n]) => `<option value="${v}" ${v === a.cor ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    <label class="text-xs font-bold block">Cargos <span class="font-normal text-slate-500">(um por linha)</span><textarea name="cargos" rows="3" class="${CAMPO} mt-1">${esc(a.cargos.join('\n'))}</textarea></label>
    <fieldset class="space-y-1"><legend class="text-xs font-bold mb-1">Matérias desta área</legend>
      <div class="grid sm:grid-cols-2 gap-1 max-h-56 overflow-y-auto p-2 rounded-xl border border-slate-300 dark:border-slate-700">${MATERIAS.map(m => `<label class="text-xs inline-flex items-center gap-2"><input type="checkbox" name="mat" value="${m.id}" ${a.materias.includes(m.id) ? 'checked' : ''}>${esc(m.nome)}${m.comum ? ' <span class="text-slate-500">(básica)</span>' : ''}</label>`).join('')}</div>
    </fieldset>
    <div class="flex justify-end gap-2"><button type="button" onclick="fecharModal()" class="${BOTAO2}">Cancelar</button><button class="${BOTAO}">Salvar</button></div>
  </form>`);
}
async function salvarArea(ev, id) {
  ev.preventDefault();
  const f = ev.target;
  const dados = { nome: f.nome.value, descricao: f.descricao.value, icone: f.icone.value, cor: f.cor.value, cargos: f.cargos.value.split('\n'), materias: [...f.querySelectorAll('input[name=mat]:checked')].map(x => x.value) };
  try {
    await api(id ? '/admin/areas/' + id : '/admin/areas', { method: id ? 'PUT' : 'POST', body: JSON.stringify(dados) });
    fecharModal(); aviso('Área salva.'); mostrar('areas');
  } catch (e) { aviso(e.message, true); }
}
async function apagarArea(id) {
  const a = AREAS_TELA.find(x => x.id === id);
  if (!confirm(`Apagar a área "${a ? a.nome : id}"? Ela some da página inicial. As matérias, questões e flashcards não são apagados.`)) return;
  await acao(() => api('/admin/areas/' + id, { method: 'DELETE' }), 'Área apagada.');
  mostrar('areas');
}

// ---------- IMPORTAR QUESTÕES (CSV ou JSON) ----------
let LOTE = [];
function parseCSV(texto) {
  texto = texto.replace(/^\uFEFF/, '');
  const primeira = texto.split(/\r?\n/)[0] || '';
  const sep = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = []; let campo = '', linha = [], aspas = false;
  const fechar = () => { linha.push(campo); campo = ''; if (linha.some(x => x.trim() !== '')) linhas.push(linha); linha = []; };
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) { if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += ch; }
    else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && texto[i + 1] === '\n') i++; fechar(); }
    else campo += ch;
  }
  if (campo !== '' || linha.length) fechar();
  if (!linhas.length) return [];
  const cab = linhas.shift().map(h => h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  return linhas.map(l => {
    const o = Object.fromEntries(cab.map((h, i) => [h, (l[i] || '').trim()]));
    if (!o.correta && o.gabarito) o.correta = o.gabarito;
    if (!o.comentario && o.explicacao) o.comentario = o.explicacao;
    if (!o.enunciado && o.questao) o.enunciado = o.questao;
    return o;
  });
}
function baixarModelo() {
  const csv = '\uFEFFid;materia;enunciado;a;b;c;d;e;correta;comentario;fonte;revisada\n;Língua Portuguesa;"Exemplo de enunciado, com vírgula?";Alternativa A;Alternativa B;Alternativa C;Alternativa D;;B;Explicação da resposta;QAPI;nao\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'modelo-questoes.csv'; a.click(); URL.revokeObjectURL(a.href);
}
function formImportar() {
  LOTE = [];
  abrirModal(`<div class="${CARTAO} w-full max-w-2xl space-y-3 my-8">
    <div class="flex justify-between items-center"><h2 class="font-extrabold">Importar questões em lote</h2><button type="button" onclick="fecharModal()"><i data-lucide="x" class="w-5 h-5"></i></button></div>
    <p class="text-xs text-slate-600 dark:text-slate-400">Envie um arquivo <strong>CSV</strong> (separado por vírgula ou ponto e vírgula, como o Excel salva) ou <strong>JSON</strong>. Colunas: <span class="font-mono">materia, enunciado, a, b, c, d, e, correta, comentario</span> e, se quiser, <span class="font-mono">id, fonte, revisada</span>. A matéria pode ser o nome ou o código de uma matéria já cadastrada. Máximo de 2000 questões por arquivo.</p>
    <button type="button" onclick="baixarModelo()" class="${BOTAO2}"><i data-lucide="download" class="w-4 h-4"></i>Baixar modelo CSV</button>
    <label class="text-xs font-bold block">Fonte das questões <span class="font-normal text-slate-500">(usada quando o arquivo não traz a coluna fonte)</span><input id="imp-fonte" value="Importada" maxlength="120" class="${CAMPO} mt-1" placeholder="Ex.: QAPI"></label>
    <input id="imp-arquivo" type="file" accept=".csv,.json,text/csv,application/json" onchange="lerArquivoImport(this.files[0])" class="text-xs">
    <div id="imp-resultado" class="text-sm"></div>
    <p class="text-[11px] text-slate-500">As questões importadas entram como <strong>não revisadas</strong>. Se usar questões da QAPI, lembre de manter a atribuição visível na página.</p>
    <div class="flex justify-end gap-2"><button type="button" onclick="fecharModal()" class="${BOTAO2}">Cancelar</button><button id="imp-botao" disabled onclick="importarAgora()" class="${BOTAO} disabled:opacity-40">Importar</button></div>
  </div>`);
}
async function lerArquivoImport(arquivo) {
  const res = document.getElementById('imp-resultado'), botao = document.getElementById('imp-botao');
  botao.disabled = true; LOTE = [];
  if (!arquivo) return;
  try {
    const texto = await arquivo.text();
    if (/\.json$/i.test(arquivo.name)) { const j = JSON.parse(texto); LOTE = Array.isArray(j) ? j : (j.questoes || []); }
    else LOTE = parseCSV(texto);
    if (!LOTE.length) throw new Error('O arquivo não tem questões.');
    if (LOTE.length > 2000) throw new Error(`O arquivo tem ${LOTE.length} questões. Divida em arquivos de até 2000.`);
    res.innerHTML = '<span class="text-slate-500">Conferindo...</span>';
    const r = await api('/admin/questoes/importar', { method: 'POST', body: JSON.stringify({ questoes: LOTE, fonte: document.getElementById('imp-fonte').value, aplicar: false }) });
    res.innerHTML = `<p class="font-semibold"><span class="text-emerald-600">${r.validas} prontas para importar</span>${r.total_erros ? ` • <span class="text-rose-600">${r.total_erros} com problema (serão ignoradas)</span>` : ''}</p>
      ${r.total_erros ? `<ul class="mt-2 max-h-40 overflow-y-auto text-xs space-y-0.5">${r.erros.slice(0, 50).map(e => `<li>Linha ${e.linha}: ${esc(e.erro)}</li>`).join('')}${r.total_erros > 50 ? `<li>... e mais ${r.total_erros - 50}</li>` : ''}</ul>` : ''}`;
    botao.textContent = `Importar ${r.validas} questões`; botao.disabled = r.validas === 0;
  } catch (e) { res.innerHTML = `<p class="text-rose-600 font-semibold">${esc(e.message)}</p>`; }
}
async function importarAgora() {
  const botao = document.getElementById('imp-botao');
  botao.disabled = true; botao.textContent = 'Importando...';
  try {
    const r = await api('/admin/questoes/importar', { method: 'POST', body: JSON.stringify({ questoes: LOTE, fonte: document.getElementById('imp-fonte').value, aplicar: true }) });
    fecharModal(); aviso(`${r.gravadas} questões importadas.`); mostrar('questoes');
  } catch (e) { aviso(e.message, true); botao.disabled = false; botao.textContent = 'Tentar de novo'; }
}

// ---------- IMPORTAÇÃO DA QAPI ----------
// O servidor busca as questões na QAPI (com a chave guardada lá) e grava no banco.
// Cada página = 1 cota (R$ 0,01) e traz até 10 questões; textos de apoio custam 1 cota cada, uma vez só.
// Importar de novo a mesma matéria continua de onde parou e não repete questões.
async function formQAPI() {
  let s = { materias: [], configurada: true }, feitas = [];
  try { [s, feitas] = await Promise.all([api('/admin/qapi/sugestoes'), api('/admin/qapi/importacoes')]); } catch (e) { aviso(e.message, true); return; }
  const progresso = {};
  feitas.forEach(f => { try { const k = JSON.parse(f.chave); if (!k.banca && !k.ano) progresso[k.materia] = f; } catch (e) {} });
  const linha = n => { const f = progresso[n]; return f ? ` — ${Math.min(f.total || 0, (f.proxima_pagina - 1) * 10)} de ${f.total} já buscadas` : ''; };
  abrirModal(`<div class="${CARTAO} w-full max-w-2xl space-y-3 my-8">
    <div class="flex justify-between items-center"><h2 class="font-extrabold">Importar questões da QAPI</h2><button type="button" onclick="fecharModal()"><i data-lucide="x" class="w-5 h-5"></i></button></div>
    ${s.configurada ? '' : `<p class="text-xs p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">A chave da QAPI não está configurada no servidor. Cadastre a variável <span class="font-mono">QAPI_KEY</span> no Easypanel.</p>`}
    <p class="text-xs text-slate-600 dark:text-slate-400">Questões reais de concursos, com gabarito oficial e comentário. Cada página custa <strong>1 cota (R$ 0,01)</strong> e traz até 10 questões. Importar de novo continua de onde parou.</p>
    <div class="space-y-1"><p class="text-xs font-bold">Matérias trabalhistas</p>
      ${s.materias.map(n => `<button type="button" onclick="document.getElementById('qp-materia').value=this.dataset.n" data-n="${esc(n)}" class="block w-full text-left text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-indigo-400"><strong>${esc(n)}</strong><span class="text-slate-500">${esc(linha(n))}</span></button>`).join('')}
    </div>
    <label class="text-xs font-bold block">Matéria na QAPI (nome exato)<input id="qp-materia" class="${CAMPO} mt-1" placeholder="Ex.: Direito do Trabalho"></label>
    <label class="text-xs font-bold block">Guardar na matéria<select id="qp-destino" class="${CAMPO} mt-1"><option value="">Criar ou usar matéria com o mesmo nome</option>${opcoesMateria('')}</select></label>
    <div class="grid grid-cols-3 gap-2">
      <label class="text-xs font-bold block">Banca (opcional)<input id="qp-banca" class="${CAMPO} mt-1" placeholder="Ex.: FCC"></label>
      <label class="text-xs font-bold block">Ano (opcional)<input id="qp-ano" inputmode="numeric" maxlength="4" class="${CAMPO} mt-1" placeholder="Ex.: 2024"></label>
      <label class="text-xs font-bold block">Páginas (máx. 60)<input id="qp-paginas" type="number" min="1" max="60" value="10" oninput="document.getElementById('qp-custo').textContent = 'até ' + (this.value * 10) + ' questões • cerca de R$ ' + (this.value * 0.01).toFixed(2).replace('.', ',')" class="${CAMPO} mt-1"></label>
    </div>
    <p id="qp-custo" class="text-xs text-slate-600 dark:text-slate-400">até 100 questões • cerca de R$ 0,10</p>
    <div id="qp-resultado" class="text-sm"></div>
    <p class="text-[11px] text-slate-500">As questões entram como <strong>não revisadas</strong> e mostram "Questões fornecidas por QAPI" para o aluno, como pedem os termos da QAPI. Depois, inclua a matéria nas áreas certas (aba Áreas).</p>
    <div class="flex justify-end gap-2"><button type="button" onclick="fecharModal()" class="${BOTAO2}">Fechar</button><button id="qp-botao" onclick="importarQAPI()" class="${BOTAO}" ${s.configurada ? '' : 'disabled'}>Importar</button></div>
  </div>`);
}
async function importarQAPI() {
  const v = id => document.getElementById(id).value.trim();
  const corpo = { materia_qapi: v('qp-materia'), materia: v('qp-destino'), banca: v('qp-banca'), ano: v('qp-ano'), paginas: Number(v('qp-paginas')) || 1 };
  if (!corpo.materia_qapi) { aviso('Informe a matéria da QAPI.', true); return; }
  const botao = document.getElementById('qp-botao'), res = document.getElementById('qp-resultado');
  botao.disabled = true; botao.textContent = 'Importando...';
  res.innerHTML = '<p class="text-slate-500">Buscando na QAPI. Pode levar alguns segundos por página.</p>';
  try {
    const r = await api('/admin/qapi/importar', { method: 'POST', body: JSON.stringify(corpo) });
    res.innerHTML = `<div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs space-y-1">
      <p><strong>${r.gravadas} questões novas</strong> gravadas em <strong>${esc(nomeMateria(r.materia) || r.materia)}</strong>.</p>
      <p>${r.repetidas} já existiam • ${r.ignoradas} ignoradas (incompletas) • ${r.cotas} cotas usadas (R$ ${(r.cotas * 0.01).toFixed(2).replace('.', ',')})</p>
      <p>A QAPI tem ${r.total_na_qapi ?? '?'} questões com esse filtro. ${r.paginas_restantes ? `Faltam ${r.paginas_restantes} páginas: clique em Importar de novo para continuar.` : 'Todas já foram buscadas.'}</p></div>`;
    MATERIAS = await fetch(API + '/materias').then(x => x.json());
  } catch (e) { res.innerHTML = ''; aviso(e.message, true); }
  botao.disabled = false; botao.textContent = 'Importar';
}

// ---------- HISTÓRICO ----------
const NOMES_ACAO = { editar_texto: 'Editou texto da página', criar_materia: 'Criou matéria', apagar_materia: 'Apagou matéria', criar_area: 'Criou área', editar_area: 'Editou área', apagar_area: 'Apagou área', apagar_aluno: 'Apagou aluno', importar_questoes: 'Importou questões', importar_qapi: 'Importou questões da QAPI', pre_cadastrar_aluno: 'Cadastrou aluno', cancelar_pre_cadastro: 'Cancelou cadastro de aluno', adicionar_admin: 'Deu acesso de admin', convidar_admin: 'Convidou admin', cancelar_convite: 'Cancelou convite de admin', remover_admin: 'Removeu admin', editar_aluno: 'Editou aluno', criar_questao: 'Criou questão', editar_questao: 'Editou questão', apagar_questao: 'Apagou questão', criar_flashcard: 'Criou flashcard', editar_flashcard: 'Editou flashcard', apagar_flashcard: 'Apagou flashcard', editar_materia: 'Editou matéria' };
async function abaHistorico() {
  const h = await api('/admin/historico');
  conteudo(`<div class="${CARTAO} space-y-3"><h2 class="font-extrabold">Histórico de alterações</h2>
    <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-xs text-slate-500 uppercase"><th class="pb-2">Quando</th><th>Quem</th><th>O quê</th><th>Item</th></tr></thead><tbody>
    ${h.map(l => `<tr class="border-t border-slate-200 dark:border-slate-800"><td class="py-2 pr-3 text-xs">${data(l.criado_em)}</td><td class="pr-3 text-xs">${esc(l.admin || '—')}</td><td class="pr-3">${esc(NOMES_ACAO[l.acao] || l.acao)}</td><td class="font-mono text-xs">${esc(l.alvo)}</td></tr>`).join('') || '<tr><td colspan="4" class="py-4 text-slate-500">Nenhuma alteração ainda.</td></tr>'}
    </tbody></table></div></div>`);
}

// ---------- ADMINISTRADORES ----------
async function abaAdmins() {
  const r = await api('/admin/admins');
  const linhas = r.admins.map(a => `<tr class="border-t border-slate-200 dark:border-slate-800">
      <td class="py-2 pr-3"><strong>${esc(a.nome || '—')}</strong><span class="block text-xs text-slate-500">${esc(a.email)}</span></td>
      <td class="pr-3 text-xs">${a.principal ? '<span class="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold">Principal</span>' : 'Administrador'}</td>
      <td class="pr-3 text-xs">${data(a.criado_em)}</td>
      <td class="text-right">${a.principal ? '' : `<button onclick="removerAdmin('${a.id}', '${esc(a.email)}')" class="${BOTAO_PERIGO}"><i data-lucide="user-minus" class="w-3.5 h-3.5"></i>Remover</button>`}</td>
    </tr>`).join('');
  const convites = r.convites.map(c => `<tr class="border-t border-slate-200 dark:border-slate-800">
      <td class="py-2 pr-3">${esc(c.email)}</td><td class="pr-3 text-xs">Convidado por ${esc(c.convidado_por || '—')}</td><td class="pr-3 text-xs">${data(c.criado_em)}</td>
      <td class="text-right"><button onclick="cancelarConvite('${esc(c.email)}')" class="${BOTAO2}">Cancelar convite</button></td></tr>`).join('');
  conteudo(`<div class="space-y-4">
    <form onsubmit="adicionarAdmin(event)" class="${CARTAO} space-y-3">
      <h2 class="font-extrabold">Adicionar administrador</h2>
      <p class="text-xs text-slate-600 dark:text-slate-400">Digite o e-mail da conta Ensino Plus da pessoa. Se ela já entrou na página, vira administradora na hora. Se ainda não entrou, fica como convite e vira administradora no primeiro login.</p>
      <div class="flex flex-wrap gap-2"><input name="email" type="email" required placeholder="email@exemplo.com" class="${CAMPO} !w-72"><button class="${BOTAO}"><i data-lucide="user-plus" class="w-4 h-4"></i>Adicionar</button></div>
    </form>
    <div class="${CARTAO} space-y-3"><h2 class="font-extrabold">Administradores <span class="text-slate-500 font-semibold">(${r.admins.length})</span></h2>
      <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-xs text-slate-500 uppercase"><th class="pb-2">Pessoa</th><th>Tipo</th><th>Desde</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div></div>
    ${r.convites.length ? `<div class="${CARTAO} space-y-3"><h2 class="font-extrabold">Convites pendentes <span class="text-slate-500 font-semibold">(${r.convites.length})</span></h2>
      <div class="overflow-x-auto"><table class="w-full text-sm"><tbody>${convites}</tbody></table></div></div>` : ''}
  </div>`);
}
async function adicionarAdmin(ev) {
  ev.preventDefault();
  const email = ev.target.email.value.trim();
  if (!confirm(`Dar acesso de administrador para ${email}? A pessoa poderá editar questões, alunos e outros administradores.`)) return;
  try {
    const r = await api('/admin/admins', { method: 'POST', body: JSON.stringify({ email }) });
    aviso(r.situacao === 'admin' ? 'Administrador adicionado.' : 'Convite criado. A pessoa vira administradora no primeiro login.');
    mostrar('admins');
  } catch (e) { aviso(e.message, true); }
}
async function removerAdmin(id, email) {
  if (!confirm(`Tirar o acesso de administrador de ${email}?`)) return;
  await acao(() => api('/admin/admins/' + id, { method: 'DELETE' }), 'Acesso removido.');
  mostrar('admins');
}
async function cancelarConvite(email) {
  if (!confirm(`Cancelar o convite de ${email}?`)) return;
  await acao(() => api('/admin/admins/convites/' + encodeURIComponent(email), { method: 'DELETE' }), 'Convite cancelado.');
  mostrar('admins');
}

// ---------- DESEMPENHO DE UM ALUNO ----------
async function verDesempenho(id) {
  abrirModal(`<div class="${CARTAO} w-full max-w-2xl my-8 text-sm">Carregando...</div>`);
  try {
    const d = await api(`/admin/alunos/${id}/desempenho`);
    const a = d.aluno;
    const topo = `<div class="flex justify-between items-start gap-3"><div><h2 class="font-extrabold">Desempenho</h2><p class="text-xs text-slate-500">${esc(a.nome || '—')} • ${esc(a.email)}</p></div><button onclick="fecharModal()"><i data-lucide="x" class="w-5 h-5"></i></button></div>`;
    if (d.sem_progresso) {
      abrirModal(`<div class="${CARTAO} w-full max-w-2xl my-8 space-y-3">${topo}<p class="text-sm text-slate-600 dark:text-slate-400">Este aluno ainda não tem progresso guardado. Ele aparece aqui depois de responder questões ou usar a página logado.</p></div>`);
      return;
    }
    const pct = d.respondidas ? Math.round(d.acertos / d.respondidas * 100) : 0;
    const caixa = (r, v, sub) => `<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><span class="text-[10px] font-bold uppercase text-slate-500">${r}</span><strong class="block text-xl">${v}</strong>${sub ? `<span class="text-[11px] text-slate-500">${sub}</span>` : ''}</div>`;
    const barra = m => {
      const p = Math.round(m.acertos / m.total * 100);
      const cor = p >= 75 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-500' : 'bg-rose-500';
      return `<div><div class="flex justify-between text-xs font-bold mb-1"><span>${esc(m.materia)} <span class="font-normal text-slate-500">(${m.total})</span></span><span>${p}%</span></div><div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div class="${cor} h-full rounded-full" style="width:${p}%"></div></div></div>`;
    };
    const edital = Object.entries(d.edital_topicos || {});
    abrirModal(`<div class="${CARTAO} w-full max-w-2xl my-8 space-y-4">${topo}
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        ${caixa('Questões respondidas', d.respondidas)}
        ${caixa('Aproveitamento', d.respondidas ? pct + '%' : '—', d.respondidas ? d.acertos + ' acertos' : '')}
        ${caixa('Dias estudados', d.dias_estudados, d.ultimo_dia ? 'último: ' + dia(d.ultimo_dia) : '')}
        ${caixa('Sequência', d.sequencia + (d.sequencia === 1 ? ' dia' : ' dias'))}
        ${caixa('Flashcards revisados', d.flashcards_revisados, d.flashcards_criados + ' criados por ele')}
        ${caixa('Redação', d.redacao_palavras + ' palavras', 'no rascunho atual')}
      </div>
      <div class="space-y-3"><h3 class="font-bold text-sm">Aproveitamento por matéria</h3>${d.por_materia.length ? d.por_materia.map(barra).join('') : '<p class="text-xs text-slate-500">Nenhuma questão respondida.</p>'}</div>
      ${edital.length ? `<div class="space-y-1"><h3 class="font-bold text-sm">Edital verticalizado</h3>${edital.map(([n, q]) => `<p class="text-xs">${esc(n)}: <strong>${q}</strong> tópicos marcados como estudados</p>`).join('')}</div>` : ''}
      <p class="text-[11px] text-slate-500">Atualizado em ${data(d.atualizado)}.</p>
    </div>`);
  } catch (e) { fecharModal(); aviso(e.message, true); }
}

// ---------- TEXTOS DA PÁGINA ----------
let TEXTOS = {};
async function abaTextos() {
  TEXTOS = await fetch(API + '/conteudo').then(r => r.json());
  const mods = TEXTOS.modulos || {}, guias = TEXTOS.guias || {};
  const nomeGuia = id => id === 'inicio' ? 'Página inicial' : ((mods[id] || {}).nome || id);
  const sec = (titulo, dica, corpo, chave) => `<form onsubmit="salvarTexto(event, '${chave}')" class="${CARTAO} space-y-3"><div><h2 class="font-extrabold">${titulo}</h2><p class="text-xs text-slate-500">${dica}</p></div>${corpo}<button class="${BOTAO}"><i data-lucide="save" class="w-4 h-4"></i>Salvar</button></form>`;
  const pg = TEXTOS.pegadinhas || { alerta: [], excecao: [] };
  conteudo(`<div class="space-y-4">
    ${sec('Módulos', 'Nome e descrição de cada cartão da página inicial.', Object.entries(mods).map(([id, m]) => `<div class="grid sm:grid-cols-3 gap-2"><input name="nome_${id}" value="${esc(m.nome)}" maxlength="60" class="${CAMPO} font-bold"><textarea name="desc_${id}" rows="2" maxlength="300" class="${CAMPO} sm:col-span-2 text-xs">${esc(m.desc)}</textarea></div>`).join(''), 'modulos')}
    ${sec('Acesso à página dos alunos', 'Define se o aluno precisa entrar com a conta para estudar. Sem login, as questões ficam abertas a qualquer visitante e o progresso fica só no navegador de cada pessoa (não há perfil, plano por conta nem desempenho por aluno). Ao mudar, ajuste também o texto do rodapé. Antes de importar as questões da QAPI, volte a exigir login.', `<label class="inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="login_obrigatorio" ${(TEXTOS.acesso || { login_obrigatorio: true }).login_obrigatorio ? 'checked' : ''}> Exigir login para estudar</label>`, 'acesso')}
    ${sec('Planos e preços', 'Valores da aba Planos da página. O anual precisa custar menos que 12 meses do mensal.', (() => { const pl = TEXTOS.planos || { mensal: {}, anual: {}, beneficios: [] }; return `<div class="grid sm:grid-cols-3 gap-3">
      <label class="text-xs font-bold block">Mensal (R$)<input name="preco_mensal" type="number" step="0.01" min="1" max="9999" required value="${pl.mensal.preco ?? ''}" class="${CAMPO} mt-1"></label>
      <label class="text-xs font-bold block">Anual (R$)<input name="preco_anual" type="number" step="0.01" min="1" max="9999" required value="${pl.anual.preco ?? ''}" class="${CAMPO} mt-1"></label>
      <label class="text-xs font-bold block">Parcelas do anual<select name="parcelas" class="${CAMPO} mt-1">${Array.from({ length: 12 }, (_, i) => i + 1).map(n => `<option ${n === (pl.anual.parcelas || 12) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div><label class="text-xs font-bold block">O que está incluído <span class="font-normal text-slate-500">(um item por linha, até 12)</span><textarea name="beneficios" rows="7" class="${CAMPO} mt-1 font-normal">${esc((pl.beneficios || []).join('\n'))}</textarea></label>`; })(), 'planos')}
    ${sec('Guias da barra lateral', 'Os passos que aparecem ao lado de cada módulo. Um passo por linha (até 8).', Object.entries(guias).map(([id, l]) => `<label class="text-xs font-bold block">${esc(nomeGuia(id))}<textarea name="guia_${id}" rows="${Math.min(l.length + 1, 6)}" class="${CAMPO} mt-1 font-normal">${esc(l.join('\n'))}</textarea></label>`).join(''), 'guias')}
    ${sec('Rodapé', 'Texto no fim de todas as páginas.', `<input name="rodape" value="${esc(TEXTOS.rodape || '')}" maxlength="200" class="${CAMPO}">`, 'rodape')}
    ${sec('Critérios de autoavaliação da redação', 'Um critério por linha (até 12). Mudar a ordem ou a quantidade pode desmarcar a autoavaliação que o aluno já fez.', `<textarea name="criterios" rows="7" class="${CAMPO}">${esc((TEXTOS.criterios_redacao || []).join('\n'))}</textarea>`, 'criterios_redacao')}
    ${sec('Marcador de pegadinhas', 'Uma palavra ou expressão por linha. Use [oa] para o/a e ? para uma letra opcional. Exemplo: privativ[oa]s? vale para privativo, privativa, privativos e privativas.', `<div class="grid sm:grid-cols-2 gap-3"><label class="text-xs font-bold block"><span class="marca-alerta">Palavras absolutas (vermelho)</span><textarea name="alerta" rows="10" class="${CAMPO} mt-2 font-mono text-xs font-normal">${esc(pg.alerta.join('\n'))}</textarea></label><label class="text-xs font-bold block"><span class="marca-excecao">Exceções (amarelo)</span><textarea name="excecao" rows="10" class="${CAMPO} mt-2 font-mono text-xs font-normal">${esc(pg.excecao.join('\n'))}</textarea></label></div>`, 'pegadinhas')}
  </div>`);
}
async function salvarTexto(ev, chave) {
  ev.preventDefault();
  const f = ev.target; let valor;
  if (chave === 'modulos') { valor = {}; Object.keys(TEXTOS.modulos).forEach(id => { valor[id] = { nome: f['nome_' + id].value, desc: f['desc_' + id].value }; }); }
  else if (chave === 'guias') { valor = {}; Object.keys(TEXTOS.guias).forEach(id => { valor[id] = f['guia_' + id].value.split('\n'); }); }
  else if (chave === 'rodape') valor = f.rodape.value;
  else if (chave === 'acesso') valor = { login_obrigatorio: f.login_obrigatorio.checked };
  else if (chave === 'planos') valor = { mensal: { preco: Number(f.preco_mensal.value) }, anual: { preco: Number(f.preco_anual.value), parcelas: Number(f.parcelas.value) }, beneficios: f.beneficios.value.split('\n') };
  else if (chave === 'criterios_redacao') valor = f.criterios.value.split('\n');
  else valor = { alerta: f.alerta.value.split('\n'), excecao: f.excecao.value.split('\n') };
  try { await api('/admin/conteudo/' + chave, { method: 'PUT', body: JSON.stringify({ valor }) }); aviso('Texto salvo. Já vale para os alunos.'); }
  catch (e) { aviso(e.message, true); }
}
