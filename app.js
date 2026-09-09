/* Grátis em Lisboa — leitor do eventos.json. Sem dependências. */
(function () {
  "use strict";

  var DADOS = null;
  var estado = {
    periodo: "7",           // hoje | fds | 7 | 30 | tudo
    concelhos: [],          // [] = todos
    tipos: [],              // [] = todos
    procura: ""
  };

  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun",
               "jul", "ago", "set", "out", "nov", "dez"];

  var PERIODOS = [
    { id: "hoje",  rot: "Hoje" },
    { id: "fds",   rot: "Fim de semana" },
    { id: "7",     rot: "7 dias" },
    { id: "30",    rot: "30 dias" },
    { id: "tudo",  rot: "Tudo" }
  ];

  // ---------------------------------------------------------------- ajudas

  function $(s) { return document.querySelector(s); }

  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function maisDias(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function dataObj(iso) {
    var p = iso.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function rotuloDia(iso) {
    var d = dataObj(iso), h = hojeISO();
    var pref = iso === h ? "Hoje · " : (iso === maisDias(1) ? "Amanhã · " : "");
    return pref + DIAS[d.getDay()] + ", " + d.getDate() + " " + MESES[d.getMonth()];
  }

  function semAcentos(s) {
    return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function esc(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Matiz determinística a partir de uma string (categoria) — dá variedade
     visual consistente aos cartões sem precisar de mapear cor a cor. */
  function matiz(s) {
    var h = 0;
    s = s || "";
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  var ICONE_PARTILHA = '<svg viewBox="0 0 24 24"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/>' +
    '<path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>';

  function textoPartilha(e) {
    var quando = rotuloDia(e.data);
    return e.titulo + " — " + quando + (e.local ? " · " + e.local : "") + "\n" + e.link;
  }

  /* Limites do próximo fim de semana (sáb+dom); se já for fds, o corrente. */
  function janelaFds() {
    var d = new Date(), dow = d.getDay();
    var ate = dow === 0 ? 0 : 6 - dow;      // dias até sábado
    var sab = maisDias(dow === 0 ? -1 : ate);
    var dom = maisDias(dow === 0 ? 0 : ate + 1);
    return [sab < hojeISO() ? hojeISO() : sab, dom];
  }

  function janela() {
    var h = hojeISO();
    switch (estado.periodo) {
      case "hoje": return [h, h];
      case "fds":  return janelaFds();
      case "7":    return [h, maisDias(7)];
      case "30":   return [h, maisDias(30)];
      default:     return [h, "9999-12-31"];
    }
  }

  // ------------------------------------------------------------- filtragem

  function passaData(e, ini, fim) {
    var a = e.data, b = e.data_fim || e.data;
    return a <= fim && b >= ini;      // sobreposição de intervalos
  }

  function filtrar() {
    var j = janela(), ini = j[0], fim = j[1];
    var q = semAcentos(estado.procura).trim();
    var cs = estado.concelhos;
    var ts = estado.tipos;
    return DADOS.eventos.filter(function (e) {
      if (!passaData(e, ini, fim)) return false;
      if (cs.length && cs.indexOf(e.concelho) < 0) return false;
      if (ts.length && ts.indexOf(e.tipo) < 0) return false;
      if (q) {
        var alvo = semAcentos(e.titulo + " " + e.local + " " + e.concelho +
                              " " + (e.tipo || "") + " " + (e.descricao || ""));
        if (alvo.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  // ------------------------------------------------------------- desenhar

  function cartao(e) {
    var partes = [];
    if (e.hora) partes.push('<span class="hora">' + esc(e.hora) + "</span>");
    if (e.local) partes.push(esc(e.local));

    var tags = ['<span class="tag gratis">GRÁTIS</span>',
                '<span class="tag conc">' + esc(e.concelho) + "</span>"];
    if (e.tipo) tags.push('<span class="tag">' + esc(e.tipo) + "</span>");
    if (e.requer_inscricao) tags.push('<span class="tag">inscrição prévia</span>');
    if (e.em_curso && e.data_fim && e.data_fim !== e.data) {
      tags.push('<span class="tag curso">até ' + rotuloCurto(e.data_fim) + "</span>");
    }
    var links = (e.fontes || [{ fonte: e.fonte, link: e.link }]).map(function (f) {
      return '<a href="' + esc(f.link) + '" target="_blank" rel="noopener">' +
             esc(f.fonte) + "</a>";
    }).join(" · ");
    tags.push('<span class="fonte">' + links + "</span>");
    tags.push('<button class="btn-partilha" data-partilha="' + esc(e.link) + '" ' +
              'data-texto="' + esc(textoPartilha(e)) + '" type="button">' +
              ICONE_PARTILHA + "Partilhar</button>");

    return '<article class="cartao" style="--h:' + matiz(e.tipo) + '">' +
      '<h2><a href="' + esc(e.link) + '" target="_blank" rel="noopener">' +
        esc(e.titulo) + "</a></h2>" +
      (partes.length ? '<p class="meta">' + partes.join(" · ") + "</p>" : "") +
      (e.descricao ? '<p class="desc">' + esc(e.descricao) + "</p>" : "") +
      '<div class="tags">' + tags.join("") + "</div>" +
      "</article>";
  }

  function rotuloCurto(iso) {
    var d = dataObj(iso);
    return d.getDate() + " " + MESES[d.getMonth()];
  }

  function desenhar() {
    var evs = filtrar();
    var alvo = $("#lista");
    if (!evs.length) {
      alvo.innerHTML = '<p class="vazio">Nada de graça neste filtro.<br>' +
                       "Experimenta alargar o período ou limpar os concelhos.</p>";
      atualizarContagens(evs);
      return;
    }
    var html = [], diaAtual = null, h = hojeISO();
    evs.forEach(function (e) {
      if (e.data !== diaAtual) {
        diaAtual = e.data;
        html.push('<h2 class="dia' + (diaAtual === h ? " hoje" : "") + '">' +
                  rotuloDia(diaAtual) + "</h2>");
      }
      html.push(cartao(e));
    });
    alvo.innerHTML = html.join("");
    atualizarContagens(evs);
  }

  function atualizarContagens(evs) {
    var n = evs.length;
    $("#rodape-txt").textContent =
      n + (n === 1 ? " evento" : " eventos") + " neste filtro · " +
      DADOS.eventos.length + " grátis no total, até " +
      rotuloCurto(DADOS.ultima_data || hojeISO()) + ".";

    var r = estado.concelhos.length
      ? (estado.concelhos.length === 1 ? estado.concelhos[0]
         : estado.concelhos.length + " concelhos")
      : "Todos os concelhos";
    $("#conc-resumo").textContent = r;

    var rt = estado.tipos.length
      ? (estado.tipos.length === 1 ? estado.tipos[0]
         : estado.tipos.length + " tipos")
      : "Todos os tipos";
    $("#tipo-resumo").textContent = rt;
  }

  // -------------------------------------------------------------- controlos

  function montarPeriodos() {
    $("#periodos").innerHTML = PERIODOS.map(function (p) {
      return '<button class="chip' + (p.id === estado.periodo ? " on" : "") +
             '" data-p="' + p.id + '">' + p.rot + "</button>";
    }).join("");
    $("#periodos").onclick = function (ev) {
      var b = ev.target.closest("[data-p]");
      if (!b) return;
      estado.periodo = b.dataset.p;
      guardar();
      montarPeriodos();
      desenhar();
    };
  }

  function montarConcelhos() {
    var cont = {};
    DADOS.eventos.forEach(function (e) {
      cont[e.concelho] = (cont[e.concelho] || 0) + 1;
    });
    var lista = Object.keys(cont).sort(function (a, b) {
      return cont[b] - cont[a] || a.localeCompare(b, "pt");
    });
    $("#concelhos").innerHTML = lista.map(function (c) {
      var on = estado.concelhos.indexOf(c) >= 0;
      return '<button class="chip' + (on ? " on" : "") + '" data-c="' + esc(c) +
             '">' + esc(c) + '<span class="n">' + cont[c] + "</span></button>";
    }).join("");
    $("#concelhos").onclick = function (ev) {
      var b = ev.target.closest("[data-c]");
      if (!b) return;
      var c = b.dataset.c, i = estado.concelhos.indexOf(c);
      if (i < 0) estado.concelhos.push(c); else estado.concelhos.splice(i, 1);
      guardar();
      montarConcelhos();
      desenhar();
    };
    $("#btn-limpar-conc").onclick = function () {
      estado.concelhos = [];
      guardar();
      montarConcelhos();
      desenhar();
    };
  }

  function montarTipos() {
    var cont = {};
    DADOS.eventos.forEach(function (e) {
      cont[e.tipo] = (cont[e.tipo] || 0) + 1;
    });
    var lista = Object.keys(cont).sort(function (a, b) {
      return cont[b] - cont[a] || a.localeCompare(b, "pt");
    });
    $("#tipos").innerHTML = lista.map(function (t) {
      var on = estado.tipos.indexOf(t) >= 0;
      return '<button class="chip' + (on ? " on" : "") + '" data-t="' + esc(t) +
             '">' + esc(t) + '<span class="n">' + cont[t] + "</span></button>";
    }).join("");
    $("#tipos").onclick = function (ev) {
      var b = ev.target.closest("[data-t]");
      if (!b) return;
      var t = b.dataset.t, i = estado.tipos.indexOf(t);
      if (i < 0) estado.tipos.push(t); else estado.tipos.splice(i, 1);
      guardar();
      montarTipos();
      desenhar();
    };
    $("#btn-limpar-tipo").onclick = function () {
      estado.tipos = [];
      guardar();
      montarTipos();
      desenhar();
    };
  }

  function guardar() {
    try { localStorage.setItem("gratislx", JSON.stringify(estado)); } catch (e) {}
  }
  function repor() {
    try {
      var s = JSON.parse(localStorage.getItem("gratislx") || "null");
      if (s && s.periodo) {
        estado.periodo = s.periodo;
        estado.concelhos = s.concelhos || [];
        estado.tipos = s.tipos || [];
      }
    } catch (e) {}
  }

  // ------------------------------------------------------------------ carga

  function cabecalho() {
    var g = new Date(DADOS.gerado_em);
    var idade = Math.floor((Date.now() - g.getTime()) / 86400000);
    var txt = DADOS.eventos.length + " eventos gratuitos · " +
      DADOS.concelhos.length + " concelhos · dados de " +
      g.getDate() + " " + MESES[g.getMonth()] +
      " às " + pad(g.getHours()) + ":" + pad(g.getMinutes());
    var el = $("#sub");
    el.textContent = idade >= 3 ? txt + " (com " + idade + " dias — vale a pena atualizar)"
                                : txt;
    el.className = "sub" + (idade >= 3 ? " velho" : "");
  }

  function carregar(forcar) {
    var url = "dados/eventos.json" + (forcar ? "?t=" + Date.now() : "");
    fetch(url, forcar ? { cache: "reload" } : {})
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (d) {
        DADOS = d;
        cabecalho();
        montarPeriodos();
        montarConcelhos();
        montarTipos();
        desenhar();
      })
      .catch(function () {
        $("#sub").textContent = "não consegui carregar os dados";
        $("#lista").innerHTML = '<p class="vazio">Sem dados.<br>' +
          "Corre o <code>pipeline.py</code> e recarrega.</p>";
      });
  }

  /* Partilha por evento: Web Share API nativa (abre o menu do telemóvel,
     WhatsApp incluído) com recurso a copiar para a área de transferência
     quando o browser não suportar (tipicamente desktop). */
  function partilhar(botao) {
    var link = botao.dataset.partilha;
    var texto = botao.dataset.texto;
    if (navigator.share) {
      // "text" sem o link (a API mostra "url" à parte); no clipboard abaixo
      // o texto completo, com link, viaja junto — não há "url" separado ali.
      var textoSemLink = texto.replace(/\n[^\n]*$/, "");
      navigator.share({ title: "Grátis em Lisboa", text: textoSemLink, url: link }).catch(function () {});
      return;
    }
    var copiar = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(texto)
      : Promise.reject();
    copiar.then(function () {
      avisarCopiado(botao);
    }).catch(function () {
      // Último recurso: seleção manual via prompt, para browsers muito antigos.
      window.prompt("Copia o link:", link);
    });
  }

  function avisarCopiado(botao) {
    botao.classList.add("copiado");
    botao.textContent = "Copiado ✓";
    setTimeout(function () {
      botao.classList.remove("copiado");
      botao.innerHTML = ICONE_PARTILHA + "Partilhar";
    }, 1800);
  }

  document.addEventListener("DOMContentLoaded", function () {
    repor();
    $("#lista").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-partilha]");
      if (b) partilhar(b);
    });
    var busca = $("#pesquisa"), t;
    busca.oninput = function () {
      clearTimeout(t);
      t = setTimeout(function () {
        estado.procura = busca.value;
        desenhar();
      }, 140);
    };
    $("#btn-recarregar").onclick = function () { carregar(true); };
    carregar(false);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  });
})();
