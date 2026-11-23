// Configuração do estilo (Tailwind). Para refazer o estilo depois de mudar as classes:
//   npx tailwindcss@3.4.17 -c tailwind.config.js -i entrada.css -o estilo.css --minify
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './admin.html', './app.js', './auth.js', './perfil.js', './planos.js', './sync.js', './admin.js'],
  theme: { extend: { fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'monospace'] } } },
  plugins: []
};
