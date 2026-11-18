// =====================================================================
// MEU PERFIL — o aluno edita as próprias informações, a foto e a senha.
// =====================================================================
// perfil (dados do aluno) é declarado em auth.js
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

async function apiPerfil(caminho, opcoes = {}) {
  const r = await fetch(API + '/perfil' + caminho, { ...opcoes, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenAtual } });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof corpo.detail === 'string' ? corpo.detail : 'Não foi possível salvar. Tente de novo.');
  return corpo;
}
async function carregarPerfil() {
  try { perfil = await apiPerfil(''); mostrarUsuario(); } catch (e) { console.warn('Perfil indisponível:', e.message); }
}
function iniciais(nome) {
  return (nome || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') || '?';
}
function avatar(tamanho) {
  const nome = (perfil && perfil.nome) || (usuario && usuario.email) || '';
  const cls = tamanho === 'g' ? 'w-24 h-24 text-2xl' : 'w-8 h-8 text-[11px]';
  return perfil && perfil.foto
    ? `<img src="${perfil.foto}" alt="Foto de perfil" class="${cls} rounded-full object-cover border border-slate-300 dark:border-slate-700">`
    : `<span class="${cls} rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center">${esc(iniciais(nome))}</span>`;
}

function renderPerfil() {
  const painel = document.getElementById('painel');
  if (!perfil) {
    painel.innerHTML = `<div class="${CARTAO}">${cabecalhoModulo('Sua conta', 'Meu perfil')}<p class="text-sm text-slate-500">Carregando...</p></div>`;
    carregarPerfil().then(() => { if (estado.modulo === 'perfil' && perfil) abrir('perfil'); });
    return;
  }
  const campo = 'w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm';
  const p = perfil;
  painel.innerHTML = `<div class="${CARTAO} space-y-6">
    ${cabecalhoModulo('Sua conta', 'Meu perfil', 'Seus dados ficam visíveis só para você e para a equipe Ensino Plus.')}
    <div class="flex flex-wrap items-center gap-5">
      ${avatar('g')}
      <div class="space-y-2">
        <div class="flex flex-wrap gap-2">
          <label class="${BOTAO} cursor-pointer"><i data-lucide="camera" class="w-4 h-4"></i> ${p.foto ? 'Trocar foto' : 'Enviar foto'}
            <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" onchange="enviarFoto(this.files[0])"></label>
          ${p.foto ? `<button onclick="removerFoto()" class="${BOTAO2}"><i data-lucide="trash-2" class="w-4 h-4"></i> Remover</button>` : ''}
        </div>
        <p class="text-[11px] text-slate-500">JPG, PNG ou WEBP. A foto é recortada em quadrado e reduzida automaticamente.</p>
      </div>
    </div>

    <form onsubmit="salvarPerfil(event)" class="grid sm:grid-cols-2 gap-4">
      <label class="text-xs font-bold sm:col-span-2">Nome completo<input name="nome" required minlength="2" maxlength="120" value="${esc(p.nome || '')}" class="${campo} mt-1" autocomplete="name"></label>
      <label class="text-xs font-bold">E-mail<input value="${esc(p.email)}" disabled class="${campo} mt-1 opacity-60"><span class="font-normal text-[11px] text-slate-500">O e-mail é o da sua conta Ensino Plus e não muda aqui.</span></label>
      <label class="text-xs font-bold">WhatsApp<input name="whatsapp" value="${esc(p.whatsapp || '')}" placeholder="(85) 99999-9999" inputmode="tel" class="${campo} mt-1" autocomplete="tel"></label>
      <label class="text-xs font-bold">Cidade<input name="cidade" maxlength="80" value="${esc(p.cidade || '')}" class="${campo} mt-1" autocomplete="address-level2"></label>
      <label class="text-xs font-bold">Estado<select name="uf" class="${campo} mt-1"><option value="">—</option>${UFS.map(u => `<option ${u === p.uf ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="text-xs font-bold sm:col-span-2">Concurso que você está estudando<input name="concurso_alvo" maxlength="120" value="${esc(p.concurso_alvo || '')}" placeholder="Ex.: INSS — Técnico do Seguro Social" class="${campo} mt-1"></label>
      <div class="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
        <span class="text-[11px] text-slate-500">Plano: <strong>${esc(p.plano)}</strong>${p.plano_validade ? ' (válido até ' + String(p.plano_validade).slice(0, 10).split('-').reverse().join('/') + ')' : ''} • Aluno desde ${new Date(p.primeiro_acesso).toLocaleDateString('pt-BR')}</span>
        <button class="${BOTAO}"><i data-lucide="save" class="w-4 h-4"></i> Salvar alterações</button>
      </div>
    </form>

    <form onsubmit="trocarSenha(event)" class="pt-5 border-t border-slate-200 dark:border-slate-800 grid sm:grid-cols-3 gap-3 items-end">
      <h3 class="sm:col-span-3 font-bold text-sm">Alterar senha</h3>
      <label class="text-xs font-bold">Nova senha<input name="s1" type="password" required minlength="6" class="${campo} mt-1" autocomplete="new-password"></label>
      <label class="text-xs font-bold">Repita a nova senha<input name="s2" type="password" required minlength="6" class="${campo} mt-1" autocomplete="new-password"></label>
      <button class="${BOTAO2}"><i data-lucide="key-round" class="w-4 h-4"></i> Alterar senha</button>
      <p class="sm:col-span-3 text-[11px] text-slate-500">A senha vale para todos os sistemas Ensino Plus que usam esta conta.</p>
    </form>
  </div>`;
}

function avisoPerfil(msg, erro) {
  const el = document.createElement('div');
  el.className = `fixed bottom-4 right-4 z-[60] px-4 py-3 rounded-xl text-sm font-semibold shadow-lg text-white ${erro ? 'bg-rose-600' : 'bg-emerald-600'}`;
  el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 3500);
}
async function salvarPerfil(ev) {
  ev.preventDefault();
  const f = ev.target;
  try {
    perfil = await apiPerfil('', { method: 'PUT', body: JSON.stringify({ nome: f.nome.value, whatsapp: f.whatsapp.value, cidade: f.cidade.value, uf: f.uf.value, concurso_alvo: f.concurso_alvo.value }) });
    avisoPerfil('Perfil salvo.'); mostrarUsuario(); abrir('perfil');
  } catch (e) { avisoPerfil(e.message, true); }
}

// Recorta em quadrado e reduz para 320x320 antes de enviar.
function reduzirImagem(arquivo) {
  return new Promise((ok, falha) => {
    if (!arquivo || !/^image\/(jpeg|png|webp)$/.test(arquivo.type)) return falha(new Error('Escolha uma imagem JPG, PNG ou WEBP.'));
    if (arquivo.size > 15 * 1024 * 1024) return falha(new Error('Imagem muito grande (máximo 15 MB).'));
    const img = new Image();
    img.onload = () => {
      const lado = Math.min(img.width, img.height), T = 320;
      const c = document.createElement('canvas'); c.width = T; c.height = T;
      c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, T, T);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => falha(new Error('Não foi possível ler esta imagem.'));
    img.src = URL.createObjectURL(arquivo);
  });
}
async function enviarFoto(arquivo) {
  try {
    const imagem = await reduzirImagem(arquivo);
    perfil = await apiPerfil('/foto', { method: 'PUT', body: JSON.stringify({ imagem }) });
    avisoPerfil('Foto atualizada.'); mostrarUsuario(); abrir('perfil');
  } catch (e) { avisoPerfil(e.message, true); }
}
async function removerFoto() {
  if (!confirm('Remover sua foto de perfil?')) return;
  try { perfil = await apiPerfil('/foto', { method: 'DELETE' }); mostrarUsuario(); abrir('perfil'); } catch (e) { avisoPerfil(e.message, true); }
}
async function trocarSenha(ev) {
  ev.preventDefault();
  const f = ev.target;
  if (f.s1.value !== f.s2.value) { avisoPerfil('As duas senhas não são iguais.', true); return; }
  const { error } = await sb.auth.updateUser({ password: f.s1.value });
  if (error) { avisoPerfil(/different from the old/i.test(error.message) ? 'A nova senha precisa ser diferente da atual.' : traduzErro(error), true); return; }
  f.reset(); avisoPerfil('Senha alterada.');
}
