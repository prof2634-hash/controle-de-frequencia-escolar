/* ================= Estado e utilidades ================= */
let TURMAS = [];
let ALUNOS = [];
let CHAMADAS = [];
let chamadaEstado = {}; // alunoId -> "P" | "F" | "J"

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Percentual mínimo de frequência exigido pela legislação (LDB) alinhado à BNCC
const FREQUENCIA_MINIMA = 75;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2500);
}

function iniciais(nome) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}

function nomeTurma(id) {
  const t = TURMAS.find((x) => x.id === id);
  return t ? t.nome : "Sem turma";
}

function hoje() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function formatarData(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/* ================= Navegação ================= */
function navegar(destino) {
  $$(".view").forEach((v) => v.classList.remove("active"));
  $("#view-" + destino)?.classList.add("active");
  $$(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.go === destino)
  );
  window.scrollTo(0, 0);

  if (destino === "inicio") atualizarStats();
  if (destino === "alunos") renderAlunos();
  if (destino === "turmas") renderTurmas();
  if (destino === "chamada") prepararChamada();
  if (destino === "relatorios") prepararRelatorios();
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-go]");
  if (el) navegar(el.dataset.go);
});

/* ================= Modal ================= */
function abrirModal(titulo, htmlCorpo) {
  $("#modal-title").textContent = titulo;
  $("#modal-body").innerHTML = htmlCorpo;
  $("#modal").classList.add("show");
}
function fecharModal() {
  $("#modal").classList.remove("show");
}
$("#modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") fecharModal();
});

/* ================= Carregar dados ================= */
async function carregarTudo() {
  [TURMAS, ALUNOS, CHAMADAS] = await Promise.all([
    DB.getAll("turmas"),
    DB.getAll("alunos"),
    DB.getAll("chamadas"),
  ]);
  TURMAS.sort((a, b) => a.nome.localeCompare(b.nome));
  ALUNOS.sort((a, b) => a.nome.localeCompare(b.nome));
}

function atualizarStats() {
  $("#stat-alunos").textContent = ALUNOS.length;
  $("#stat-turmas").textContent = TURMAS.length;
  $("#stat-chamadas").textContent = CHAMADAS.length;
}

/* ================= TURMAS ================= */
function renderTurmas() {
  const cont = $("#lista-turmas");
  if (!TURMAS.length) {
    cont.innerHTML = vazio("Nenhuma turma cadastrada", "Toque em \"Nova turma\" para começar.");
    return;
  }
  cont.innerHTML = `<ul class="list">${TURMAS.map((t) => {
    const qtd = ALUNOS.filter((a) => a.turmaId === t.id).length;
    return `<li class="list-item">
      <div class="avatar">${iniciais(t.nome)}</div>
      <div class="info">
        <strong>${escapar(t.nome)}</strong>
        <small>${escapar(t.disciplina || "")}${t.disciplina ? " · " : ""}${qtd} aluno(s)</small>
      </div>
      <div class="actions">
        <button class="icon-btn" onclick="editarTurma('${t.id}')" aria-label="Editar turma">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
        </button>
        <button class="icon-btn danger" onclick="excluirTurma('${t.id}')" aria-label="Excluir turma">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>
    </li>`;
  }).join("")}</ul>`;
}

function formTurma(t = {}) {
  return `
    <label for="f-turma-nome">Nome da turma</label>
    <input id="f-turma-nome" placeholder="Ex.: 5º Ano A" value="${escapar(t.nome || "")}" />
    <label for="f-turma-disc">Disciplina / Componente (BNCC)</label>
    <input id="f-turma-disc" placeholder="Ex.: Matemática" value="${escapar(t.disciplina || "")}" />
    <label for="f-turma-ano">Ano letivo</label>
    <input id="f-turma-ano" type="number" placeholder="${new Date().getFullYear()}" value="${t.ano || new Date().getFullYear()}" />
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarTurma('${t.id || ""}')">Salvar</button>
    </div>`;
}

function novaTurma() { abrirModal("Nova turma", formTurma()); }
function editarTurma(id) {
  const t = TURMAS.find((x) => x.id === id);
  abrirModal("Editar turma", formTurma(t));
}

async function salvarTurma(id) {
  const nome = $("#f-turma-nome").value.trim();
  if (!nome) return toast("Informe o nome da turma");
  const turma = {
    id: id || DB.uid(),
    nome,
    disciplina: $("#f-turma-disc").value.trim(),
    ano: Number($("#f-turma-ano").value) || new Date().getFullYear(),
  };
  await DB.put("turmas", turma);
  await carregarTudo();
  fecharModal();
  renderTurmas();
  toast("Turma salva");
}

async function excluirTurma(id) {
  const qtd = ALUNOS.filter((a) => a.turmaId === id).length;
  abrirModal("Excluir turma", `
    <p>Tem certeza que deseja excluir <strong>${escapar(nomeTurma(id))}</strong>?</p>
    ${qtd ? `<p class="hint">${qtd} aluno(s) ficarão sem turma. As chamadas desta turma também serão removidas.</p>` : ""}
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="confirmarExcluirTurma('${id}')">Excluir</button>
    </div>`);
}

async function confirmarExcluirTurma(id) {
  await DB.remove("turmas", id);
  for (const a of ALUNOS.filter((a) => a.turmaId === id)) {
    await DB.put("alunos", { ...a, turmaId: "" });
  }
  for (const c of CHAMADAS.filter((c) => c.turmaId === id)) {
    await DB.remove("chamadas", c.id);
  }
  await carregarTudo();
  fecharModal();
  renderTurmas();
  toast("Turma excluída");
}

/* ================= ALUNOS ================= */
function renderAlunos() {
  const cont = $("#lista-alunos");
  if (!ALUNOS.length) {
    cont.innerHTML = vazio("Nenhum aluno cadastrado", "Toque em \"Novo aluno\" para começar.");
    return;
  }
  cont.innerHTML = `<ul class="list">${ALUNOS.map((a) => `
    <li class="list-item">
      <div class="avatar">${iniciais(a.nome)}</div>
      <div class="info">
        <strong>${escapar(a.nome)}</strong>
        <small>${a.matricula ? "Matrícula " + escapar(a.matricula) + " · " : ""}${escapar(nomeTurma(a.turmaId))}</small>
      </div>
      <div class="actions">
        <button class="icon-btn" onclick="editarAluno('${a.id}')" aria-label="Editar aluno">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
        </button>
        <button class="icon-btn danger" onclick="excluirAluno('${a.id}')" aria-label="Excluir aluno">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>
    </li>`).join("")}</ul>`;
}

function opcoesTurma(selecionada) {
  const base = `<option value="">Sem turma</option>`;
  return base + TURMAS.map((t) =>
    `<option value="${t.id}" ${t.id === selecionada ? "selected" : ""}>${escapar(t.nome)}</option>`
  ).join("");
}

function formAluno(a = {}) {
  return `
    <label for="f-aluno-nome">Nome completo</label>
    <input id="f-aluno-nome" placeholder="Nome do aluno" value="${escapar(a.nome || "")}" />
    <label for="f-aluno-mat">Matrícula (opcional)</label>
    <input id="f-aluno-mat" placeholder="Nº de matrícula" value="${escapar(a.matricula || "")}" />
    <label for="f-aluno-turma">Turma</label>
    <select id="f-aluno-turma">${opcoesTurma(a.turmaId)}</select>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="salvarAluno('${a.id || ""}')">Salvar</button>
    </div>`;
}

function novoAluno() {
  if (!TURMAS.length) {
    return abrirModal("Crie uma turma primeiro", `
      <p>Cadastre ao menos uma turma antes de adicionar alunos.</p>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="fecharModal()">Fechar</button>
        <button class="btn btn-primary" onclick="fecharModal();navegar('turmas');novaTurma()">Criar turma</button>
      </div>`);
  }
  abrirModal("Novo aluno", formAluno());
}

function editarAluno(id) {
  const a = ALUNOS.find((x) => x.id === id);
  abrirModal("Editar aluno", formAluno(a));
}

async function salvarAluno(id) {
  const nome = $("#f-aluno-nome").value.trim();
  if (!nome) return toast("Informe o nome do aluno");
  const aluno = {
    id: id || DB.uid(),
    nome,
    matricula: $("#f-aluno-mat").value.trim(),
    turmaId: $("#f-aluno-turma").value,
  };
  await DB.put("alunos", aluno);
  await carregarTudo();
  fecharModal();
  renderAlunos();
  toast("Aluno salvo");
}

function excluirAluno(id) {
  const a = ALUNOS.find((x) => x.id === id);
  abrirModal("Excluir aluno", `
    <p>Excluir <strong>${escapar(a.nome)}</strong>? Os registros de chamada deste aluno serão removidos.</p>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="confirmarExcluirAluno('${id}')">Excluir</button>
    </div>`);
}

async function confirmarExcluirAluno(id) {
  await DB.remove("alunos", id);
  for (const c of CHAMADAS) {
    if (c.registros && c.registros[id]) {
      delete c.registros[id];
      await DB.put("chamadas", c);
    }
  }
  await carregarTudo();
  fecharModal();
  renderAlunos();
  toast("Aluno excluído");
}

/* ================= CHAMADA ================= */
function prepararChamada() {
  const sel = $("#chamada-turma");
  sel.innerHTML = TURMAS.length
    ? TURMAS.map((t) => `<option value="${t.id}">${escapar(t.nome)}</option>`).join("")
    : `<option value="">Nenhuma turma</option>`;
  if (!$("#chamada-data").value) $("#chamada-data").value = hoje();
  renderChamadaLista();
}

function renderChamadaLista() {
  const turmaId = $("#chamada-turma").value;
  const cont = $("#chamada-lista");
  const btnSalvar = $("#btn-salvar-chamada");
  const alunos = ALUNOS.filter((a) => a.turmaId === turmaId);

  if (!turmaId || !alunos.length) {
    cont.innerHTML = vazio("Sem alunos nesta turma", "Cadastre alunos ou escolha outra turma.");
    btnSalvar.style.display = "none";
    return;
  }

  // pré-carrega chamada existente da mesma data/bimestre, se houver
  const data = $("#chamada-data").value;
  const bim = $("#chamada-bimestre").value;
  const existente = CHAMADAS.find(
    (c) => c.turmaId === turmaId && c.data === data && String(c.bimestre) === String(bim)
  );

  chamadaEstado = {};
  alunos.forEach((a) => {
    chamadaEstado[a.id] = existente?.registros?.[a.id] || "P";
  });
  if (existente) $("#chamada-aulas").value = existente.aulas || 1;

  cont.innerHTML = alunos.map((a) => `
    <div class="chamada-student">
      <div class="avatar">${iniciais(a.nome)}</div>
      <div class="info"><strong>${escapar(a.nome)}</strong></div>
      <div class="toggle-group" data-aluno="${a.id}">
        <button class="toggle p ${chamadaEstado[a.id] === "P" ? "active" : ""}" data-v="P" title="Presente">P</button>
        <button class="toggle f ${chamadaEstado[a.id] === "F" ? "active" : ""}" data-v="F" title="Falta">F</button>
        <button class="toggle j ${chamadaEstado[a.id] === "J" ? "active" : ""}" data-v="J" title="Falta justificada">J</button>
      </div>
    </div>`).join("");

  btnSalvar.style.display = "flex";
  if (existente) toast("Chamada existente carregada para edição");
}

$("#chamada-lista").addEventListener("click", (e) => {
  const btn = e.target.closest(".toggle");
  if (!btn) return;
  const grupo = btn.closest(".toggle-group");
  const alunoId = grupo.dataset.aluno;
  chamadaEstado[alunoId] = btn.dataset.v;
  grupo.querySelectorAll(".toggle").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
});

$("#btn-todos-presente").addEventListener("click", () => {
  $$("#chamada-lista .toggle-group").forEach((g) => {
    chamadaEstado[g.dataset.aluno] = "P";
    g.querySelectorAll(".toggle").forEach((t) => t.classList.toggle("active", t.dataset.v === "P"));
  });
  toast("Todos marcados como presentes");
});

["#chamada-turma", "#chamada-data", "#chamada-bimestre"].forEach((s) =>
  $(s).addEventListener("change", renderChamadaLista)
);

async function salvarChamada() {
  const turmaId = $("#chamada-turma").value;
  const data = $("#chamada-data").value;
  const bimestre = $("#chamada-bimestre").value;
  const aulas = Number($("#chamada-aulas").value) || 1;
  if (!turmaId || !data) return toast("Selecione turma e data");

  const existente = CHAMADAS.find(
    (c) => c.turmaId === turmaId && c.data === data && String(c.bimestre) === String(bimestre)
  );

  const chamada = {
    id: existente?.id || DB.uid(),
    turmaId,
    data,
    bimestre: Number(bimestre),
    aulas,
    registros: { ...chamadaEstado },
    criadoEm: existente?.criadoEm || Date.now(),
  };
  await DB.put("chamadas", chamada);
  await carregarTudo();
  toast(existente ? "Chamada atualizada" : "Chamada salva");
}

/* ================= RELATÓRIOS (BNCC) ================= */
function prepararRelatorios() {
  const sel = $("#rel-turma");
  sel.innerHTML = TURMAS.length
    ? TURMAS.map((t) => `<option value="${t.id}">${escapar(t.nome)}</option>`).join("")
    : `<option value="">Nenhuma turma</option>`;
  $("#rel-conteudo").innerHTML = "";
}

function calcularRelatorio(turmaId, bimestre) {
  const alunos = ALUNOS.filter((a) => a.turmaId === turmaId);
  const chamadas = CHAMADAS.filter(
    (c) => c.turmaId === turmaId && (Number(bimestre) === 0 || Number(c.bimestre) === Number(bimestre))
  );

  const totalAulas = chamadas.reduce((s, c) => s + (c.aulas || 1), 0);

  const dados = alunos.map((a) => {
    let presencas = 0, faltas = 0, justificadas = 0;
    chamadas.forEach((c) => {
      const st = c.registros?.[a.id];
      const aulas = c.aulas || 1;
      if (st === "P") presencas += aulas;
      else if (st === "F") faltas += aulas;
      else if (st === "J") { justificadas += aulas; presencas += 0; }
      // registro ausente = considerado não computado
    });
    const computadas = presencas + faltas + justificadas;
    const percentPresenca = computadas ? (presencas / computadas) * 100 : 0;
    const percentFalta = computadas ? ((faltas + justificadas) / computadas) * 100 : 0;
    return {
      aluno: a,
      presencas, faltas, justificadas,
      computadas,
      percentPresenca,
      percentFalta,
      aprovadoFrequencia: percentPresenca >= FREQUENCIA_MINIMA,
    };
  });

  const mediaTurma = dados.length
    ? dados.reduce((s, d) => s + d.percentPresenca, 0) / dados.length
    : 0;
  const emRisco = dados.filter((d) => !d.aprovadoFrequencia && d.computadas > 0).length;

  return { alunos, chamadas, totalAulas, dados, mediaTurma, emRisco };
}

function classeBadge(p) {
  if (p >= FREQUENCIA_MINIMA) return "good";
  if (p >= 60) return "warn";
  return "bad";
}

function gerarRelatorio() {
  const turmaId = $("#rel-turma").value;
  const bimestre = $("#rel-bimestre").value;
  if (!turmaId) return toast("Selecione uma turma");

  const r = calcularRelatorio(turmaId, bimestre);
  const cont = $("#rel-conteudo");

  if (!r.alunos.length) {
    cont.innerHTML = vazio("Turma sem alunos", "Cadastre alunos para gerar o relatório.");
    return;
  }
  if (!r.chamadas.length) {
    cont.innerHTML = vazio("Sem chamadas no período", "Registre chamadas para este bimestre.");
    return;
  }

  const bimLabel = Number(bimestre) === 0 ? "Ano letivo" : `${bimestre}º Bimestre`;
  const tNome = nomeTurma(turmaId);
  const t = TURMAS.find((x) => x.id === turmaId) || {};

  const linhas = r.dados.map((d) => `
    <tr>
      <td>${escapar(d.aluno.nome)}</td>
      <td class="num">${d.presencas}</td>
      <td class="num">${d.faltas}</td>
      <td class="num">${d.justificadas}</td>
      <td class="num"><span class="badge ${classeBadge(d.percentPresenca)}">${d.percentPresenca.toFixed(1)}%</span></td>
      <td class="num">${d.percentFalta.toFixed(1)}%</td>
    </tr>`).join("");

  const html = `
    <div class="card">
      <div class="stats-row" style="margin-bottom:6px">
        <div class="stat"><b>${r.totalAulas}</b><small>Aulas dadas</small></div>
        <div class="stat"><b>${r.mediaTurma.toFixed(1)}%</b><small>Média presença</small></div>
        <div class="stat"><b>${r.emRisco}</b><small>Abaixo de ${FREQUENCIA_MINIMA}%</small></div>
      </div>
      <p class="hint">Referência BNCC/LDB: frequência mínima de ${FREQUENCIA_MINIMA}% para aprovação. Alunos em vermelho estão em risco de reprovação por frequência.</p>
    </div>

    <div class="card">
      <h3>${escapar(tNome)} · ${bimLabel}</h3>
      <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th>Aluno</th><th class="num">P</th><th class="num">F</th>
            <th class="num">FJ</th><th class="num">Assiduidade</th><th class="num">Ausência</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      </div>
      <p class="hint" style="margin-top:10px">P = presenças · F = faltas · FJ = faltas justificadas (contadas como ausência para frequência)</p>
    </div>

    <div class="card no-print">
      <button class="btn btn-primary" onclick="imprimirRelatorio('${turmaId}','${bimestre}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Imprimir / Salvar PDF
      </button>
    </div>`;

  cont.innerHTML = html;
}

function imprimirRelatorio(turmaId, bimestre) {
  const r = calcularRelatorio(turmaId, bimestre);
  const t = TURMAS.find((x) => x.id === turmaId) || {};
  const bimLabel = Number(bimestre) === 0 ? "Ano letivo" : `${bimestre}º Bimestre`;

  const linhas = r.dados.map((d) => `
    <tr>
      <td>${escapar(d.aluno.nome)}</td>
      <td style="text-align:center">${d.presencas}</td>
      <td style="text-align:center">${d.faltas}</td>
      <td style="text-align:center">${d.justificadas}</td>
      <td style="text-align:center">${d.percentPresenca.toFixed(1)}%</td>
      <td style="text-align:center">${d.percentFalta.toFixed(1)}%</td>
      <td style="text-align:center">${d.aprovadoFrequencia ? "OK" : "Risco"}</td>
    </tr>`).join("");

  $("#print-area").innerHTML = `
    <div style="font-family:sans-serif;color:#000;padding:10px">
      <h2 style="margin:0 0 2px">Relatório de Frequência</h2>
      <p style="margin:0 0 2px"><strong>Turma:</strong> ${escapar(t.nome || "")} ${t.disciplina ? " · " + escapar(t.disciplina) : ""}</p>
      <p style="margin:0 0 2px"><strong>Período:</strong> ${bimLabel} · Ano ${t.ano || new Date().getFullYear()}</p>
      <p style="margin:0 0 2px"><strong>Aulas dadas:</strong> ${r.totalAulas} · <strong>Média de presença:</strong> ${r.mediaTurma.toFixed(1)}%</p>
      <p style="margin:0 0 10px;font-size:12px">Frequência mínima BNCC/LDB: ${FREQUENCIA_MINIMA}%</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#eee">
            <th style="text-align:left;border:1px solid #999;padding:5px">Aluno</th>
            <th style="border:1px solid #999;padding:5px">P</th>
            <th style="border:1px solid #999;padding:5px">F</th>
            <th style="border:1px solid #999;padding:5px">FJ</th>
            <th style="border:1px solid #999;padding:5px">Assiduidade</th>
            <th style="border:1px solid #999;padding:5px">Ausência</th>
            <th style="border:1px solid #999;padding:5px">Situação</th>
          </tr>
        </thead>
        <tbody>${linhas.replace(/<td/g, '<td style="border:1px solid #999;padding:5px"')}</tbody>
      </table>
      <p style="margin-top:20px;font-size:12px">Emitido em ${formatarData(hoje())} — Documento de uso exclusivo do professor.</p>
      <p style="margin-top:40px;font-size:12px">_______________________________<br/>Assinatura do professor(a)</p>
    </div>`;
  window.print();
}

/* ================= Utilidades de UI ================= */
function vazio(titulo, sub) {
  return `<div class="empty">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
    <p><strong>${titulo}</strong></p>
    <p>${sub}</p>
  </div>`;
}

function escapar(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ================= Backup ================= */
async function exportarDados() {
  const data = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    turmas: TURMAS,
    alunos: ALUNOS,
    chamadas: CHAMADAS,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `frequencia-backup-${hoje()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup exportado");
}

function importarDados(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.turmas || !data.alunos || !data.chamadas) throw new Error("Formato inválido");
      await DB.clearAll();
      for (const t of data.turmas) await DB.put("turmas", t);
      for (const a of data.alunos) await DB.put("alunos", a);
      for (const c of data.chamadas) await DB.put("chamadas", c);
      await carregarTudo();
      navegar("inicio");
      toast("Dados importados com sucesso");
    } catch (err) {
      toast("Arquivo inválido");
    }
  };
  reader.readAsText(file);
}

/* ================= Ligações de eventos ================= */
$("#btn-nova-turma").addEventListener("click", novaTurma);
$("#btn-novo-aluno").addEventListener("click", novoAluno);
$("#btn-salvar-chamada").addEventListener("click", salvarChamada);
$("#btn-gerar-rel").addEventListener("click", gerarRelatorio);
$("#btn-export").addEventListener("click", exportarDados);
$("#btn-import").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", (e) => {
  if (e.target.files[0]) importarDados(e.target.files[0]);
  e.target.value = "";
});

// expõe funções usadas em onclick inline
Object.assign(window, {
  navegar, fecharModal, novaTurma, editarTurma, salvarTurma, excluirTurma,
  confirmarExcluirTurma, novoAluno, editarAluno, salvarAluno, excluirAluno,
  confirmarExcluirAluno, imprimirRelatorio,
});

/* ================= Início ================= */
(async function init() {
  await DB.open();
  await carregarTudo();
  atualizarStats();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
