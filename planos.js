// =====================================================================
// PLANOS — aba com os valores do plano mensal e do anual.
// Os valores vêm da administração (aba Textos da página). O pagamento online
// ainda não está ligado: o botão fica desativado até a cobrança entrar.
// =====================================================================
function brl(v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function renderPlanos() {
  const m = PLANOS.mensal.preco, a = PLANOS.anual.preco, par = PLANOS.anual.parcelas || 12;
  const porMes = a / 12;
  const economia = Math.max(0, Math.round((1 - a / (m * 12)) * 100));
  const atual = perfil && perfil.plano ? perfil.plano : null;
  const validade = perfil && perfil.plano_validade ? String(perfil.plano_validade).slice(0, 10).split('-').reverse().join('/') : null;
  const itens = (PLANOS.beneficios || []).map(b => `<li class="flex gap-2 text-sm"><i data-lucide="check" class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"></i><span>${esc(b)}</span></li>`).join('');

  const cartao = (id, titulo, preco, linhas, destaque) => `<div class="${CARTAO} space-y-4 relative ${destaque ? 'ring-2 ring-indigo-500' : ''}">
    ${destaque ? `<span class="absolute -top-3 left-5 px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider">Melhor valor${economia ? ` • economize ${economia}%` : ''}</span>` : ''}
    ${atual === id ? `<span class="absolute -top-3 right-5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider">Seu plano${validade ? ' até ' + validade : ''}</span>` : ''}
    <div><h3 class="font-bold text-sm uppercase tracking-wider text-slate-600 dark:text-slate-400">${titulo}</h3>
      <p class="mt-1"><strong class="text-3xl font-extrabold">${brl(preco)}</strong><span class="text-sm text-slate-500"> ${id === 'mensal' ? 'por mês' : 'por ano'}</span></p>
      ${linhas.map(l => `<p class="text-xs text-slate-600 dark:text-slate-400">${l}</p>`).join('')}</div>
    <ul class="space-y-2">${itens}</ul>
    <button disabled class="${BOTAO} w-full opacity-50 cursor-not-allowed">Assinatura em breve</button>
  </div>`;

  document.getElementById('painel').innerHTML = `<div class="space-y-5">
    <div class="${CARTAO}">${cabecalhoModulo('Planos', 'Escolha seu plano', 'Os dois planos dão o mesmo acesso. No anual você paga menos por mês.')}
      <p class="text-xs text-slate-600 dark:text-slate-400">${atual ? `Seu plano atual: <strong>${esc(atual)}</strong>${validade ? ` (válido até ${validade})` : ''}.` : ''} O pagamento online será liberado em breve; por enquanto os valores abaixo são informativos.</p>
    </div>
    <div class="grid sm:grid-cols-2 gap-6 pt-2">
      ${cartao('mensal', 'Mensal', m, ['Cobrança todo mês'], false)}
      ${cartao('anual', 'Anual', a, [par > 1 ? `ou ${par}x de ${brl(a / par)} no cartão` : 'pagamento à vista', `equivale a ${brl(porMes)} por mês`], true)}
    </div>
    <p class="text-[11px] text-slate-500">Em breve: Tutor com IA e resumos em áudio.</p>
  </div>`;
}
