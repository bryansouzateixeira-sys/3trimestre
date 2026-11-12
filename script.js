(function () {
  'use strict';

  const R = 1800;           // raio da arena
  const GAP = 7;            // distancia entre as bolinhas do corpo
  const QTD_COMIDA = 700;   // bolinhas na arena
  const QTD_BOTS = 10;      // cobras rivais
  const NOMES = ['Naja', 'Jib\u00f3ia', 'V\u00edbora', 'Sucuri', 'Coral', 'Mamba', 'Cascavel', 'Anaconda', 'P\u00edton', 'Jararaca', 'Surucucu', 'Cobra-rei'];

  let raiz, palco, btnIniciar, btnTela, cv, ctx, pal;
  let hudPlacar, hudRank, btnTurbo, aviso, avisoTitulo, avisoTexto;
  let W = 0, H = 0, dpr = 1, zoom = 1, vx0 = 0, vx1 = 0, vy0 = 0, vy1 = 0;
  let cobras = [], comida = [], eu = null;
  let rodando = false, loopAtivo = false, ultimo = 0, tRank = 0, recorde = 0, matiz = 48;
  let turbo = false, turboId = -1, mx = null, my = null;
  const teclas = {};

  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  const raio = c => 7 + Math.min(14, c.pts.length * 0.045);
  const criar = (tag, cls, pai) => {
    const e = document.createElement(tag);
    e.className = cls;
    (pai || palco).appendChild(e);
    return e;
  };

  /* criacao */
  function novaCobra(nome, bot, x, y) {
    const ang = rnd(0, 6.283);
    const c = { nome, bot, ang, alvo: ang, meta: ang, t: 0, turbo: false, gota: 0, morta: false,
                massa: bot ? rnd(25, 90) : 30, h: Math.floor(rnd(0, 360)), pts: [] };
    for (let i = 0; i < 12; i++) c.pts.push({ x: x - Math.cos(ang) * i * GAP, y: y - Math.sin(ang) * i * GAP });
    return c;
  }

  function novaBot() {
    let x, y;
    do {
      const a = rnd(0, 6.283), d = rnd(0, R - 250);
      x = Math.cos(a) * d; y = Math.sin(a) * d;
    } while (dist2(x, y, eu.pts[0].x, eu.pts[0].y) < 360000);
    return novaCobra(NOMES[Math.floor(rnd(0, NOMES.length))], true, x, y);
  }

  function novaComida(x, y, v, h) {
    if (x === undefined) {
      const a = rnd(0, 6.283), d = Math.sqrt(Math.random()) * (R - 40);
      x = Math.cos(a) * d; y = Math.sin(a) * d;
    }
    v = v || 1 + Math.floor(Math.random() * 3);
    return { x, y, v, r: 3 + v * 1.6, c: h === undefined ? Math.floor(rnd(0, 360)) : h };
  }

  /* movimento */
  function mover(c, dt) {
    let d = c.alvo - c.ang;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const giro = 0.09 / (1 + c.pts.length / 140) * dt;
    c.ang += Math.max(-giro, Math.min(giro, d));

    const acel = c.turbo && c.massa > 20;
    const vel = (acel ? 4.6 : 2.6) * dt;
    const h = c.pts[0];
    h.x += Math.cos(c.ang) * vel;
    h.y += Math.sin(c.ang) * vel;

    const n = Math.min(250, 10 + Math.floor(c.massa / 4));
    while (c.pts.length < n) { const u = c.pts[c.pts.length - 1]; c.pts.push({ x: u.x, y: u.y }); }
    while (c.pts.length > n) c.pts.pop();
    for (let i = 1; i < c.pts.length; i++) {
      const a = c.pts[i - 1], b = c.pts[i];
      const dx = a.x - b.x, dy = a.y - b.y, L = Math.hypot(dx, dy);
      if (L > GAP) { b.x += dx * (L - GAP) / L; b.y += dy * (L - GAP) / L; }
    }
    if (acel) {                                   // acelerar gasta tamanho e solta bolinhas
      c.massa -= 0.1 * dt;
      c.gota += dt;
      if (c.gota > 12) {
        c.gota = 0;
        const u = c.pts[c.pts.length - 1];
        comida.push(novaComida(u.x, u.y, 1, c.h));
      }
    }
  }

  /* bots */
  function perigo(b, px, py) {
    for (const o of cobras) {
      if (o === b) continue;
      for (let i = 0; i < o.pts.length; i += 2) {
        if (dist2(o.pts[i].x, o.pts[i].y, px, py) < 2500) return o.pts[i];
      }
    }
    return null;
  }

  function pensar(b, dt) {
    const h = b.pts[0];
    b.t -= dt;
    if (b.t <= 0) {
      b.t = rnd(15, 40);
      let melhor = null, m = 160000;              // comida em ate 400px
      for (const f of comida) {
        const d = dist2(f.x, f.y, h.x, h.y);
        if (d < m) { m = d; melhor = f; }
      }
      b.meta = melhor ? Math.atan2(melhor.y - h.y, melhor.x - h.x) : b.ang + rnd(-1.2, 1.2);
    }
    let alvo = b.meta;
    if (Math.hypot(h.x, h.y) > R - 260) alvo = Math.atan2(-h.y, -h.x);       // fugir da borda
    const q = perigo(b, h.x + Math.cos(b.ang) * 55, h.y + Math.sin(b.ang) * 55);
    if (q) alvo = b.ang + (Math.sin(Math.atan2(q.y - h.y, q.x - h.x) - b.ang) > 0 ? -1.6 : 1.6);
    b.alvo = alvo;
  }

  /* colisao, morte e placar */
  function bateu(c, h, r) {
    for (const o of cobras) {
      if (o === c) continue;
      const rr = r * 0.7 + raio(o) * 0.8, lim = rr * rr;
      for (const q of o.pts) {
        if (dist2(q.x, q.y, h.x, h.y) < lim) return true;
      }
    }
    return false;
  }

  function mostrarAviso(titulo, texto) {
    avisoTitulo.textContent = titulo;
    avisoTexto.textContent = texto;
    aviso.classList.remove('cb-oculto');
  }

  function hudAtualizar() {
    const lista = cobras.slice().sort((a, b) => b.massa - a.massa);
    const top = lista.slice(0, 5).map((c, i) => (i + 1) + '. ' + c.nome + '  ' + Math.floor(c.massa));
    const pos = lista.indexOf(eu);
    if (pos > 4) top.push((pos + 1) + '. Voc\u00ea  ' + Math.floor(eu.massa));
    hudRank.textContent = 'Ranking\n' + top.join('\n');
    hudPlacar.textContent = 'Tamanho ' + Math.floor(eu.massa) + '\nRecorde ' + Math.max(recorde, Math.floor(eu.massa));
  }

  function morrer(c) {
    const k = cobras.indexOf(c);
    if (k < 0) return;
    cobras.splice(k, 1);
    for (let i = 0; i < c.pts.length; i += 2) {
      comida.push(novaComida(c.pts[i].x + rnd(-6, 6), c.pts[i].y + rnd(-6, 6), 3, c.h));
    }
    if (c.bot) { cobras.push(novaBot()); return; }
    c.morta = true;
    recorde = Math.max(recorde, Math.floor(c.massa));
    try { localStorage.setItem('cobrinha_recorde', recorde); } catch (e) { }
    hudAtualizar();
    mostrarAviso('Fim de jogo', 'Seu tamanho: ' + Math.floor(c.massa) + '\nRecorde: ' + recorde + '\nClique aqui para jogar de novo.');
  }

  /* atualizacao e desenho */
  function atualizar(dt) {
    if (!eu.morta) {
      eu.turbo = turbo || !!teclas.Space;
      const dir = (teclas.ArrowRight || teclas.KeyD ? 1 : 0) - (teclas.ArrowLeft || teclas.KeyA ? 1 : 0);
      if (dir) eu.alvo = eu.ang + dir * 0.35;
    }
    const mortos = [];
    for (const c of cobras) {
      if (c.bot) pensar(c, dt);
      mover(c, dt);
      const h = c.pts[0], r = raio(c);
      for (let i = comida.length - 1; i >= 0; i--) {
        const f = comida[i], rr = r + f.r + 8;
        if (dist2(f.x, f.y, h.x, h.y) < rr * rr) { c.massa += f.v; comida.splice(i, 1); }
      }
      if (Math.hypot(h.x, h.y) > R || bateu(c, h, r)) mortos.push(c);
    }
    mortos.forEach(c => morrer(c));
    while (comida.length < QTD_COMIDA) comida.push(novaComida());
    tRank -= dt;
    if (tRank <= 0) { tRank = 20; hudAtualizar(); }
  }

  function desenharCobra(c) {
    const r = raio(c), n = c.pts.length, luz = c.turbo && c.massa > 20 ? 14 : 0;
    for (let i = n - 1; i >= 0; i--) {
      const p = c.pts[i];
      if (p.x < vx0 - 30 || p.x > vx1 + 30 || p.y < vy0 - 30 || p.y > vy1 + 30) continue;
      ctx.fillStyle = 'hsl(' + c.h + ',85%,' + ((i % 6 < 3 ? 52 : 42) + luz) + '%)';
      ctx.beginPath(); ctx.arc(p.x, p.y, r * (1 - 0.35 * i / n), 0, 7); ctx.fill();
    }
    const h = c.pts[0], ex = Math.cos(c.ang), ey = Math.sin(c.ang);
    for (const s of [-1, 1]) {
      const x = h.x + ex * r * 0.4 - ey * r * 0.55 * s, y = h.y + ey * r * 0.4 + ex * r * 0.55 * s;
      ctx.fillStyle = pal.olho; ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, 7); ctx.fill();
      ctx.fillStyle = pal.pupila; ctx.beginPath(); ctx.arc(x + ex * r * 0.14, y + ey * r * 0.14, r * 0.19, 0, 7); ctx.fill();
    }
    ctx.fillStyle = pal.nome;
    ctx.font = '600 ' + (14 / zoom) + 'px ' + pal.fonte;
    ctx.textAlign = 'center';
    ctx.fillText(c.nome, h.x, h.y - r - 8);
  }

  function desenhar() {
    const h = eu.pts[0];
    zoom = Math.max(0.5, 1 - eu.pts.length / 500) * (Math.min(W, H) < 520 ? 0.8 : 1);
    vx0 = h.x - W / 2 / zoom; vx1 = h.x + W / 2 / zoom;
    vy0 = h.y - H / 2 / zoom; vy1 = h.y + H / 2 / zoom;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = pal.fundo;
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-h.x, -h.y);

    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7);
    ctx.fillStyle = pal.arena; ctx.fill();
    ctx.fillStyle = pal.pontos;
    for (let gx = Math.floor(vx0 / 60) * 60; gx < vx1; gx += 60) {
      for (let gy = Math.floor(vy0 / 60) * 60; gy < vy1; gy += 60) {
        if (gx * gx + gy * gy < R * R) ctx.fillRect(gx - 2, gy - 2, 4, 4);
      }
    }
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7);
    ctx.lineWidth = 16; ctx.strokeStyle = pal.borda; ctx.stroke();

    for (const f of comida) {
      if (f.x < vx0 - 20 || f.x > vx1 + 20 || f.y < vy0 - 20 || f.y > vy1 + 20) continue;
      ctx.fillStyle = 'hsla(' + f.c + ',90%,60%,.28)';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 2, 0, 7); ctx.fill();
      ctx.fillStyle = 'hsl(' + f.c + ',90%,64%)';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
    }
    for (let i = cobras.length - 1; i >= 0; i--) desenharCobra(cobras[i]);     // voce fica por cima
  }

  function ajustar() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = palco.clientWidth; H = palco.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }

  function quadro(t) {
    let dt = (t - ultimo) / 16.667;
    if (!(dt > 0)) dt = 1;
    if (dt > 2.5) dt = 2.5;
    ultimo = t;
    if (palco.clientWidth !== W || palco.clientHeight !== H) ajustar();
    if (rodando) { atualizar(dt); desenhar(); }
    requestAnimationFrame(quadro);
  }

  /* controles e inicio */
  function mirar(x, y) {
    mx = x; my = y;
    if (!rodando || eu.morta) return;
    const b = palco.getBoundingClientRect();
    eu.alvo = Math.atan2(y - b.top - H / 2, x - b.left - W / 2);
  }

  function lerPaleta() {
    const estilo = getComputedStyle(raiz);
    const cor = n => estilo.getPropertyValue(n).trim();
    pal = { fundo: cor('--cb-fundo'), arena: cor('--cb-arena'), borda: cor('--cb-borda'), pontos: cor('--cb-pontos'),
            nome: cor('--cb-nome'), olho: cor('--cb-olho'), pupila: cor('--cb-pupila'), fonte: cor('--cb-fonte') };
    matiz = +cor('--cb-voce') || 48;
  }

  function iniciar() {
    btnIniciar.blur();
    lerPaleta();
    cobras = []; comida = [];
    eu = novaCobra('Voc\u00ea', false, rnd(-200, 200), rnd(-200, 200));
    eu.h = matiz;
    cobras.push(eu);
    for (let i = 0; i < QTD_BOTS; i++) cobras.push(novaBot());
    while (comida.length < QTD_COMIDA) comida.push(novaComida());
    turbo = false; rodando = true; tRank = 0;
    aviso.classList.add('cb-oculto');
    btnIniciar.textContent = 'Reiniciar';
    ajustar();
    if (mx !== null) mirar(mx, my);
    if (!loopAtivo) { loopAtivo = true; ultimo = performance.now(); requestAnimationFrame(quadro); }
  }

  function telaCheia() {
    btnTela.blur();
    const pedir = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
    if (!pedir) { raiz.classList.toggle('cb-full'); return; }        // iPhone: tela cheia simulada
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const p = pedir.call(raiz);
      if (p && p.catch) p.catch(() => raiz.classList.toggle('cb-full'));
    }
  }

  function montar() {
    palco = document.createElement('div');
    palco.className = 'cb-palco';
    raiz.appendChild(palco);

    cv = document.createElement('canvas');
    palco.appendChild(cv);
    ctx = cv.getContext('2d');
    hudPlacar = criar('div', 'cb-placar');
    hudRank = criar('div', 'cb-rank');
    btnTurbo = criar('button', 'cb-turbo');
    btnTurbo.type = 'button';
    btnTurbo.textContent = '\u26A1\uFE0F';
    btnTurbo.setAttribute('aria-label', 'Acelerar');
    aviso = criar('div', 'cb-aviso');
    avisoTitulo = criar('h3', 'cb-aviso-titulo', aviso);
    avisoTexto = criar('p', 'cb-aviso-texto', aviso);
    mostrarAviso('Jogo da Cobrinha', 'Guie a cobra com o mouse ou o dedo.\nSegure o clique, Espa\u00e7o ou \u26A1\uFE0F para acelerar.\nColete bolinhas para crescer e fuja das outras cobras!\nClique em Iniciar jogo.');
    ajustar();

    window.addEventListener('pointermove', e => { if (e.isPrimary) mirar(e.clientX, e.clientY); });
    palco.addEventListener('pointerdown', e => {
      if (e.isPrimary) mirar(e.clientX, e.clientY);
      if (e.pointerType === 'mouse' && e.button === 0) { turbo = true; turboId = e.pointerId; }
    });
    btnTurbo.addEventListener('pointerdown', e => { e.stopPropagation(); turbo = true; turboId = e.pointerId; });
    ['pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, e => { if (e.pointerId === turboId) turbo = false; }));
    window.addEventListener('blur', () => { turbo = false; });
    aviso.addEventListener('click', iniciar);

    document.addEventListener('keydown', e => {
      if (!rodando || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      teclas[e.code] = true;
      if (/^(Space|Arrow)/.test(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', e => {
      delete teclas[e.code];
      if (rodando && e.code === 'Space') e.preventDefault();
    });
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => {
      raiz.classList.toggle('cb-full', !!(document.fullscreenElement || document.webkitFullscreenElement));
    }));
  }

  function start() {
    raiz = document.getElementById('cobrinha');
    btnIniciar = document.getElementById('cobrinhaIniciar');
    btnTela = document.getElementById('cobrinhaTelaCheia');
    if (!raiz || !btnIniciar || !btnTela) { console.error('Cobrinha: HTML nao encontrado (ids cobrinha, cobrinhaIniciar, cobrinhaTelaCheia).'); return; }
    try { recorde = +localStorage.getItem('cobrinha_recorde') || 0; } catch (e) { }
    montar();
    btnIniciar.addEventListener('click', iniciar);
    btnTela.addEventListener('click', telaCheia);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();




