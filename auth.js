// =====================================================================
// LOGIN — usa a mesma conta Ensino Plus (Supabase) dos outros sistemas.
// Precisa de config.js (SUPABASE_URL e SUPABASE_ANON_KEY, chave pública).
// =====================================================================
// Login com Google desligado por enquanto: o Supabase compartilhado precisa liberar o endereço da página
// (Authentication > URL Configuration > Redirect URLs). Quando liberar, troque para true.
const LOGIN_GOOGLE = false;

// Se o login é obrigatório vem da administração (Textos da página > Acesso). null = ainda não sabemos.
let loginObrigatorio = null;
function aplicarRegraDeLogin() {
  if (loginObrigatorio === null) return;
  if (loginObrigatorio && !usuario) { modoLogin = 'entrar'; telaLogin(); }
  else esconderLogin();
  if (!loginObrigatorio && typeof iniciarConteudo === 'function') iniciarConteudo();
}
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let usuario = null;
let ehAdmin = false;
let tokenAtual = null;
var perfil = null; // preenchido por perfil.js
let modoLogin = 'entrar'; // entrar | criar | recuperar

function telaLogin(msg, tipo) {
  let el = document.getElementById('tela-login');
  if (!el) { el = document.createElement('div'); el.id = 'tela-login'; document.body.appendChild(el); }
  const titulo = { entrar: 'Entrar', criar: 'Criar conta', recuperar: 'Recuperar senha' }[modoLogin];
  const aviso = msg ? `<p class="text-xs p-3 rounded-xl ${tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'}">${esc(msg)}</p>` : '';
  const campo = 'w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm';
  el.className = 'fixed inset-0 z-[100] bg-[#eaedf2] dark:bg-[#0b0f19] flex items-center justify-center p-4 overflow-y-auto';
  el.innerHTML = `<form onsubmit="enviarLogin(event)" class="${CARTAO} w-full max-w-sm space-y-4">
    <div class="flex items-center gap-2.5">
      <div class="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs">EP</div>
      <div><span class="font-bold text-sm block">Ensino Plus</span><span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">CONCURSOS</span></div>
    </div>
    <div>
      <h1 class="text-lg font-extrabold">${titulo}</h1>
      <p class="text-xs text-slate-600 dark:text-slate-400">${modoLogin === 'recuperar' ? 'Enviaremos um link para você criar uma nova senha.' : 'Use a mesma conta dos sistemas Ensino Plus.'}</p>
    </div>
    ${aviso}
    ${modoLogin === 'criar' ? `<input id="login-nome" required placeholder="Seu nome" class="${campo}" autocomplete="name">` : ''}
    <input id="login-email" type="email" required placeholder="E-mail" class="${campo}" autocomplete="email">
    ${modoLogin !== 'recuperar' ? `<input id="login-senha" type="password" required minlength="6" placeholder="Senha" class="${campo}" autocomplete="${modoLogin === 'criar' ? 'new-password' : 'current-password'}">` : ''}
    <button id="login-botao" class="${BOTAO} w-full">${{ entrar: 'Entrar', criar: 'Criar conta', recuperar: 'Enviar link' }[modoLogin]}</button>
    ${LOGIN_GOOGLE && modoLogin !== 'recuperar' ? `<button type="button" onclick="entrarGoogle()" class="${BOTAO2} w-full">Entrar com Google</button>` : ''}
    <div class="flex justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
      ${modoLogin === 'entrar'
        ? `<button type="button" onclick="trocarModo('criar')">Criar conta</button><button type="button" onclick="trocarModo('recuperar')">Esqueci a senha</button>`
        : `<button type="button" onclick="trocarModo('entrar')">Voltar para entrar</button>`}
    </div>
  </form>`;
}
function trocarModo(m) { modoLogin = m; telaLogin(); }
function esconderLogin() { const el = document.getElementById('tela-login'); if (el) el.remove(); }

function traduzErro(e) {
  const m = (e && e.message) || '';
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).';
  if (/already registered|already exists/i.test(m)) return 'Este e-mail já tem conta. Use "Entrar".';
  if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos.';
  return 'Não foi possível concluir. Tente de novo.';
}

async function enviarLogin(ev) {
  ev.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senhaEl = document.getElementById('login-senha');
  const botao = document.getElementById('login-botao');
  botao.disabled = true; botao.textContent = 'Aguarde...';
  try {
    if (modoLogin === 'entrar') {
      const { error } = await sb.auth.signInWithPassword({ email, password: senhaEl.value });
      if (error) throw error;
    } else if (modoLogin === 'criar') {
      const nome = document.getElementById('login-nome').value.trim();
      const { data, error } = await sb.auth.signUp({ email, password: senhaEl.value, options: { data: { full_name: nome, name: nome } } });
      if (error) throw error;
      if (!data.session) { modoLogin = 'entrar'; telaLogin('Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.', 'ok'); }
    } else {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
      modoLogin = 'entrar'; telaLogin('Se o e-mail tiver conta, você vai receber o link em instantes.', 'ok');
    }
  } catch (e) {
    telaLogin(traduzErro(e));
  }
}
async function entrarGoogle() {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) telaLogin(traduzErro(error));
}
async function sair() { await sb.auth.signOut(); }

function mostrarUsuario() {
  const el = document.getElementById('usuario-area');
  if (!el) return;
  if (!usuario) { ehAdmin = false; el.innerHTML = ''; return; }
  const nome = (perfil && perfil.nome) || (usuario.user_metadata && (usuario.user_metadata.full_name || usuario.user_metadata.name)) || usuario.email;
  el.innerHTML = (ehAdmin ? `<a href="admin.html" title="Área administrativa" class="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">Admin</a>` : '') +
    `<button onclick="abrir('perfil')" title="Meu perfil" class="flex items-center gap-2 rounded-full hover:opacity-80">${typeof avatar === 'function' ? avatar('p') : ''}<span class="hidden lg:inline text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-[140px] truncate">${esc(nome)}</span></button>
    <button onclick="sair()" title="Sair da conta" class="p-2 rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"><i data-lucide="log-out" class="w-4 h-4"></i></button>`;
  icones();
}

sb.auth.onAuthStateChange((evento, sessao) => {
  usuario = sessao ? sessao.user : null;
  tokenAtual = sessao ? sessao.access_token : null;
  if (!usuario) { perfil = null; alunoRegistrado = false; conteudoIniciado = false; estadoConteudo = 'carregando'; if (typeof pararSincronizacao === 'function') pararSincronizacao(); }
  else if (typeof iniciarConteudo === 'function') iniciarConteudo();
  if (evento === 'PASSWORD_RECOVERY') {
    const nova = prompt('Digite sua nova senha (mínimo 6 caracteres):');
    if (nova) sb.auth.updateUser({ password: nova }).then(({ error }) => alert(error ? traduzErro(error) : 'Senha alterada.'));
  }
  aplicarRegraDeLogin();
  mostrarUsuario();
  if (usuario && (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION')) registrarAluno(sessao.access_token);
});

// Cadastra a pessoa como aluno de concursos (tabela alunos do banco concursos).
let alunoRegistrado = false;
let aluno = null;
async function registrarAluno(token) {
  if (alunoRegistrado) return;
  alunoRegistrado = true;
  try {
    const r = await fetch(API + '/alunos/entrar', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error(r.status);
    aluno = await r.json();
    if (typeof sincronizarProgresso === 'function') sincronizarProgresso();
    // Administradores veem o atalho para a área administrativa.
    const adm = await fetch(API + '/admin/eu', { headers: { Authorization: 'Bearer ' + token } });
    ehAdmin = adm.ok;
    mostrarUsuario();
    carregarPerfil();
  } catch (e) {
    alunoRegistrado = false;
    console.warn('Não foi possível registrar o aluno agora:', e.message);
  }
}
