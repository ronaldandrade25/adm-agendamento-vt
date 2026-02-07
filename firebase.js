// /js/firebase.js (ESM)
// ✅ Arquivo "central" com Firebase + Auth + Helpers + Modal + Tabs + Estado compartilhado
// ✅ Importa e inicia as abas (agenda/relatorios/clientes/pdv/config)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    Timestamp,
    // ✅✅✅ AJUSTE: exports que faltavam para PDV / filtros sem índice
    limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ✅ Storage (necessário para upload de foto do profissional)
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ✅ Módulos por aba
import { initAgendaTab } from "./agenda.js";
import { initRelatoriosTab } from "./relatorios.js";
import { initClientesTab } from "./clientes.js";
import { initPdvTab } from "./pdv.js";
import { initConfiguracoesTab } from "./configuracoes.js";

/* ========= Firebase ========= */
const firebaseConfig = {
    apiKey: "AIzaSyDgaoVZK-5TF5xDFulLISridU9IXbmEYgg",
    authDomain: "barbearia-agenda-fe2a7.firebaseapp.com",
    projectId: "barbearia-agenda-fe2a7",
    storageBucket: "barbearia-agenda-fe2a7.firebasestorage.app",
    messagingSenderId: "876658896099",
    appId: "1:876658896099:web:6a361416ed84fd636f29d6",
    measurementId: "G-NJ4ETW1TNZ",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ✅ Storage exports
export const storage = getStorage(app);
export { ref, uploadBytes, getDownloadURL };

/* ========= Admins ========= */
export const ADMINS = ["andraderonald685@gmail.com"];

/* ========= Helpers ========= */
export const $ = (s) => document.querySelector(s);
export const $$ = (s) => document.querySelectorAll(s);
export const pad2 = (n) => String(n).padStart(2, "0");
export const normalize = (s) => (s || "").toString().trim().toLowerCase();
export const formatCurrency = (n) =>
    (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const ymdToDateObj = (ymd) => {
    const [y, m, d] = String(ymd).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0);
};
export const formatDate = (tsOrDate) => {
    if (!tsOrDate) return "";
    const d = tsOrDate?.toDate ? tsOrDate.toDate() : tsOrDate;
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const toMinutes = (hhmm) => {
    const [h, m] = String(hhmm || "0:0").split(":").map(Number);
    return h * 60 + (m || 0);
};
export const minutesToHHMM = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${pad2(h)}:${pad2(m)}`;
};

// ✅ Ajuste: manter "_" (importante para nomes e ids compostos)
export function slugify(str) {
    return (str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_") // preserva "_"
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_");
}

export const toKey = (ymd, hh) => `${ymd}_${hh}`;

/* ========= Notificações ========= */
const notificationContainer = $("#notification-container");
export function showNotification(message, type = "success") {
    if (!notificationContainer) return;
    const div = document.createElement("div");
    div.className = `notification ${type}`;
    div.innerHTML = `<span>${message}</span>`;
    notificationContainer.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

/* ========= Modal genérico ========= */
const modalEl = $("#mainModal");
const modalTitle = $("#modalTitle");
const modalBody = $("#modalBody");
const modalFooter = $("#modalFooter");
const modalClose = $("#modalClose");

export const mainModal = {
    show({ title = "", body = "", buttons = [] }) {
        if (!modalEl) return;
        if (modalTitle) modalTitle.textContent = title;
        if (modalBody) modalBody.innerHTML = body;
        if (modalFooter) modalFooter.innerHTML = "";

        (buttons || []).forEach((b) => {
            const btn = document.createElement("button");
            btn.className = `btn ${b.class || ""}`;
            btn.innerHTML = b.text || "OK";
            btn.addEventListener("click", async () => {
                if (b.onClick) {
                    const result = await b.onClick();
                    if (result === false) return;
                }
                mainModal.hide();
            });
            modalFooter?.appendChild(btn);
        });

        modalEl.classList.remove("hidden");
    },
    hide() {
        if (!modalEl) return;
        modalEl.classList.add("hidden");
    },
};

modalClose?.addEventListener("click", () => mainModal.hide());
modalEl?.addEventListener("click", (e) => {
    if (e.target === modalEl) mainModal.hide();
});

/* ========= Tabs ========= */
const mainContents = document.querySelectorAll("main");
const tabBtns = document.querySelectorAll(".tab-btn");

export function showTab(tab) {
    const targetId = `${tab}Main`;
    mainContents.forEach((main) => {
        if (main.id === targetId) main.classList.remove("hidden-block");
        else main.classList.add("hidden-block");
    });

    tabBtns.forEach((btn) => {
        if (btn.dataset.tab === tab) btn.classList.add("active");
        else btn.classList.remove("active");
    });
}

/* ========= DOM Auth ========= */
const authGate = $("#authGate");
const authEmail = $("#authEmail");
const authPassword = $("#authPassword");
const authSubmit = $("#authSubmit");
const authError = $("#authError");
const logoutBtn = $("#logoutBtn");

/* ========= Auth Gate ========= */
let _authReadyResolve;
export const authReady = new Promise((res) => (_authReadyResolve = res));

export function toggleGate(show) {
    if (!authGate) return;
    if (show) authGate.classList.remove("hidden");
    else authGate.classList.add("hidden");
}
export async function waitForAuth() {
    return authReady;
}

onAuthStateChanged(auth, (user) => {
    const ok = !!user && ADMINS.includes(user.email || "");
    if (ok) {
        toggleGate(false);
        logoutBtn?.classList.remove("hidden");
        _authReadyResolve?.(user);
    } else {
        toggleGate(true);
        logoutBtn?.classList.add("hidden");
    }
});

authSubmit?.addEventListener("click", async () => {
    if (!authEmail?.value || !authPassword?.value) {
        if (authError) authError.textContent = "Preencha e-mail e senha.";
        return;
    }
    authSubmit.disabled = true;
    if (authError) authError.textContent = "";
    try {
        await signInWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value);
    } catch (err) {
        console.error(err);
        if (authError) authError.textContent = "Falha no login. Verifique e-mail e senha.";
    } finally {
        authSubmit.disabled = false;
    }
});

authPassword?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") authSubmit?.click();
});

logoutBtn?.addEventListener("click", async () => {
    try {
        await signOut(auth);
        showNotification("Sessão encerrada.", "success");
    } catch (err) {
        console.error(err);
        showNotification("Erro ao sair.", "error");
    }
});

/* ========= Estado compartilhado ========= */
export const BOOKING_URL = "https://barbeariaratorre2.vercel.app/";

export const PAYMENT_METHODS = [
    "PIX",
    "Dinheiro",
    "Cartão de Crédito",
    "Cartão de Débito",
    "RA Club",
    "Outro",
];

// ✅ fallback
export const ONLY_PRO = { label: "Rodrigo Torre2", colecao: "reservas_rodrigotorre2" };

export const state = {
    // ✅✅✅ AJUSTE (CONFIG): adiciona intervalo sem quebrar o resto
    BUSINESS_HOURS: {
        inicio: "09:00",
        fim: "19:00",
        hasInterval: false,
        intervalStart: "",
        intervalEnd: "",
    },
    HOURS: [],
    SERVICOS: [],
    PROFESSIONALS: [],
    CFG_WEEK: null, // { weekdays, dayStart, dayEnd }
    allClients: [],
    pdvProducts: [],
    pdvSales: [], // ✅✅✅ AJUSTE: adiciona no state (usado pelo PDV)
    reportCache: [],
    charts: {
        reportsChartInstance: null,
        reportsProfChartInstance: null,
        reportsGrupoChartInstance: null,
    },
};

// horários
export function generateHours(
    start = state.BUSINESS_HOURS.inicio,
    end = state.BUSINESS_HOURS.fim,
    stepMinutes = 25
) {
    const hours = [];
    const [sh, sm] = String(start || "09:00").split(":").map(Number);
    const [eh, em] = String(end || "19:00").split(":").map(Number);

    let current = new Date(2000, 0, 1, sh, sm, 0);
    const endDate = new Date(2000, 0, 1, eh, em, 0);

    // ✅✅✅ AJUSTE (CONFIG): pular horários dentro do intervalo (almoço/pausa) se estiver ativo
    const hasInterval = !!state?.BUSINESS_HOURS?.hasInterval;
    const iStart = String(state?.BUSINESS_HOURS?.intervalStart || "").trim();
    const iEnd = String(state?.BUSINESS_HOURS?.intervalEnd || "").trim();
    const iStartMin = hasInterval && iStart ? toMinutes(iStart) : null;
    const iEndMin = hasInterval && iEnd ? toMinutes(iEnd) : null;

    function isInInterval(hhmm) {
        if (!hasInterval || iStartMin == null || iEndMin == null) return false;
        const m = toMinutes(hhmm);
        // intervalo válido somente se end > start
        if (iEndMin <= iStartMin) return false;
        return m >= iStartMin && m < iEndMin;
    }

    while (current <= endDate) {
        const h = pad2(current.getHours());
        const m = pad2(current.getMinutes());
        const hhmm = `${h}:${m}`;

        if (!isInInterval(hhmm)) hours.push(hhmm);

        current.setMinutes(current.getMinutes() + stepMinutes);
    }

    // mantém fallback antigo (sem afetar mobile/desktop)
    if (!hours.includes("18:30") && !isInInterval("18:30")) hours.push("18:30");

    return hours;
}
state.HOURS = generateHours();

// coleções (docs/collections)
export const CFG_DOC_HORARIOS = doc(db, "config", "horarios");
export const CFG_DOC_SEMANA = doc(db, "config", "semana");

export const COL_SERVICOS = collection(db, "servicos");
export const COL_PROF = collection(db, "profissionais");

/**
 * ✅✅✅ EXCEÇÕES (PADRÃO ÚNICO)
 * Vamos usar:
 *   /config/excecoes/dias/{ymd}
 * (é exatamente o que o agenda.js já tenta ler)
 */
export const CFG_DOC_EXCECOES = doc(db, "config", "excecoes");

// ✅ AJUSTE AQUI: era "datas", agora é "dias"
export const CFG_COL_EXCECOES = collection(db, "config", "excecoes", "dias");
export const cfgExcecaoDoc = (ymd) => doc(db, "config", "excecoes", "dias", String(ymd || ""));

/* ========= Profissionais helpers ========= */
export function getProfByColecao(colecao) {
    return (state.PROFESSIONALS || []).find((p) => p.colecao === colecao);
}
export function getProfLabelByColecao(colecao) {
    const found = getProfByColecao(colecao);
    return found?.label || found?.nome || ONLY_PRO.label;
}

/* ========= Sincronização de profissional (Agenda/Relatórios/PDV) ========= */
export function getSelectedColecao() {
    const profissionalSelect = $("#profissionalSelect");
    const v = (profissionalSelect?.value || "").trim();

    // Agenda aceita "todos"
    if (v) return v;

    // fallback seguro
    return ONLY_PRO.colecao;
}

export function setSelectedColecao(colecao) {
    if (!colecao) return;

    const profissionalSelect = $("#profissionalSelect");
    const relProf = $("#relProf");
    const pdvSaleProfSelect = $("#pdvSaleProf");

    // Agenda aceita "todos"
    if (profissionalSelect && profissionalSelect.value !== colecao) profissionalSelect.value = colecao;

    // Relatórios: se estiver em "todos", não força
    if (relProf && relProf.value !== "todos" && relProf.value !== colecao) relProf.value = colecao;

    if (pdvSaleProfSelect && pdvSaleProfSelect.value !== colecao) pdvSaleProfSelect.value = colecao;
}

// ✅✅✅ lista só com profissionais ATIVOS + mantém seleção do usuário
export function populateProfessionalSelects() {
    const listAll = (state.PROFESSIONALS || []);
    const list = listAll.filter((p) => p && p.ativo !== false);

    const profissionalSelect = $("#profissionalSelect");
    const relProf = $("#relProf");
    const pdvSaleProfSelect = $("#pdvSaleProf");

    // ========= AGENDA =========
    if (profissionalSelect) {
        const current = (profissionalSelect.value || "").trim();

        if (!list.length) {
            profissionalSelect.innerHTML = `<option value="${ONLY_PRO.colecao}">Nenhum profissional cadastrado</option>`;
            profissionalSelect.disabled = true;
        } else {
            profissionalSelect.disabled = false;

            const opts = [
                `<option value="todos">Todos</option>`,
                ...list.map((p) => `<option value="${p.colecao}">${p.label || p.nome || p.colecao}</option>`),
            ];
            profissionalSelect.innerHTML = opts.join("");

            const exists = [...profissionalSelect.options].some((o) => o.value === current);
            profissionalSelect.value = exists ? current : "todos";
        }
    }

    // ========= RELATÓRIOS =========
    if (relProf) {
        const current = (relProf.value || "").trim();

        if (!list.length) {
            relProf.innerHTML = `<option value="todos">Sem profissionais cadastrados</option>`;
            relProf.disabled = true;
        } else {
            relProf.disabled = false;

            const opts = [
                `<option value="todos">Todos os profissionais</option>`,
                ...list.map((p) => `<option value="${p.colecao}">${p.label || p.nome || p.colecao}</option>`),
            ];
            relProf.innerHTML = opts.join("");

            const exists = [...relProf.options].some((o) => o.value === current);
            relProf.value = exists ? current : "todos";
        }
    }

    // ========= PDV =========
    if (pdvSaleProfSelect) {
        const current = (pdvSaleProfSelect.value || "").trim();
        const firstColecao = list[0]?.colecao || ONLY_PRO.colecao;

        if (!list.length) {
            pdvSaleProfSelect.innerHTML = `<option value="${ONLY_PRO.colecao}">Nenhum profissional cadastrado</option>`;
            pdvSaleProfSelect.disabled = true;
        } else {
            pdvSaleProfSelect.disabled = false;
            pdvSaleProfSelect.innerHTML = list
                .map((p) => `<option value="${p.colecao}">${p.label || p.nome || p.colecao}</option>`)
                .join("");

            const exists = list.some((p) => p.colecao === current);
            pdvSaleProfSelect.value = exists ? current : firstColecao;
        }
    }
}

export function bindProfessionalSync({ onAgendaChange } = {}) {
    const profissionalSelect = $("#profissionalSelect");
    const relProf = $("#relProf");
    const pdvSaleProfSelect = $("#pdvSaleProf");

    profissionalSelect?.addEventListener("change", () => {
        onAgendaChange?.();
    });

    relProf?.addEventListener("change", () => {
        if (relProf.value !== "todos") setSelectedColecao(relProf.value);
    });

    pdvSaleProfSelect?.addEventListener("change", () => {
        setSelectedColecao(pdvSaleProfSelect.value);
    });
}

/* ========= LISTENERS GLOBAIS (após login) ========= */
function startGlobalListeners() {
    if (window.__globalListenersStarted) return;
    window.__globalListenersStarted = true;

    // ✅ Profissionais
    onSnapshot(
        query(COL_PROF, orderBy("nome")),
        (snap) => {
            const list = snap.docs.map((d) => {
                const v = d.data() || {};
                const nome = v.nome || "";
                return {
                    id: d.id,
                    nome,
                    label: nome,
                    fotoUrl: v.fotoUrl || "",
                    whatsapp: v.whatsapp || "",
                    ativo: v.ativo !== false,
                    colecao: v.colecao || `reservas_${slugify(nome)}`,
                };
            });

            state.PROFESSIONALS = list;
            populateProfessionalSelects();

            console.log(
                "[GLOBAL] profissionais:",
                list.map((p) => ({ id: p.id, nome: p.nome, colecao: p.colecao, ativo: p.ativo }))
            );
        },
        (err) => console.error("Erro listener profissionais (global):", err)
    );

    // ✅ Serviços
    onSnapshot(
        query(COL_SERVICOS, orderBy("nome")),
        (snap) => {
            state.SERVICOS = snap.docs.map((d) => {
                const v = d.data() || {};
                return {
                    id: d.id,
                    nome: v.nome || "",
                    valor: Number(v.valor || 0),
                    tempoMin: Number(v.tempoMin || 30),
                    ativo: v.ativo !== false,
                };
            });

            console.log("[GLOBAL] serviços:", state.SERVICOS.length);
        },
        (err) => console.error("Erro listener serviços (global):", err)
    );
}

/* ========= Modal: seleção de serviços ========= */
export function openServicosModal(onSelect) {
    const overlay = document.createElement("div");
    overlay.className = "servicos-modal-overlay";

    const listaHtml = (state.SERVICOS || [])
        .map((s, i) => {
            if (s.placeholder) return "";
            return `
        <button type="button" class="servico-item" data-serv-index="${i}">
          <span class="servico-nome">${s.nome}</span>
          <span class="servico-valor">${formatCurrency(s.valor)}</span>
        </button>
      `;
        })
        .join("");

    overlay.innerHTML = `
    <div class="servicos-modal-box">
      <div class="servicos-modal-header">
        <span>Selecionar serviço</span>
        <button class="btn btn-sm btn-light servicos-close" type="button">&times;</button>
      </div>
      <div class="servicos-modal-body">
        <div class="servicos-search">
          <input id="servicosSearch" type="text" placeholder="Pesquisar serviço..." />
        </div>
        <div class="servicos-list">${listaHtml}</div>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.closest(".servicos-close")) close();
    });

    const listEl = overlay.querySelector(".servicos-list");
    listEl?.addEventListener("click", (e) => {
        const btn = e.target.closest(".servico-item");
        if (!btn) return;
        const idx = Number(btn.dataset.servIndex);
        const serv = state.SERVICOS[idx];
        if (serv && onSelect) onSelect(serv);
        close();
    });

    const searchInput = overlay.querySelector("#servicosSearch");
    if (searchInput && listEl) {
        searchInput.addEventListener("input", () => {
            const term = normalize(searchInput.value);
            listEl.querySelectorAll(".servico-item").forEach((btn) => {
                const name = normalize(btn.querySelector(".servico-nome")?.textContent || "");
                btn.style.display = !term || name.includes(term) ? "flex" : "none";
            });
        });
        searchInput.focus();
    }
}

/* ========= Firestore exports (usados pelos módulos) ========= */
export {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    Timestamp,
    // ✅✅✅ AJUSTE: exporta limit também (se você usar depois)
    limit,
};

/* ========= INIT ========= */
function setDefaultDates() {
    const dataFiltro = $("#dataFiltro");
    const relDe = $("#relDe");
    const relAte = $("#relAte");

    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = pad2(hoje.getMonth() + 1);
    const d = pad2(hoje.getDate());

    if (dataFiltro) dataFiltro.value = `${y}-${m}-${d}`;
    if (relDe) relDe.value = `${y}-${m}-01`;
    if (relAte) relAte.value = `${y}-${m}-${d}`;
}

async function init() {
    tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            showTab(tab);
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    await waitForAuth();

    startGlobalListeners();

    initAgendaTab();
    initRelatoriosTab();
    initClientesTab();
    initPdvTab();
    initConfiguracoesTab();

    setDefaultDates();
    showTab("agenda");
}

document.addEventListener("DOMContentLoaded", init);
