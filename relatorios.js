// js/relatorios.js
import {
    db, $, showNotification,
    state, waitForAuth,
    ONLY_PRO, getProfLabelByColecao, getSelectedColecao,
    collection, query, where, getDocs, orderBy,
    formatCurrency, formatDate, ymdToDateObj
} from "./firebase.js";

export function initRelatoriosTab() {
    const relProf = $("#relProf");
    const relDe = $("#relDe");
    const relAte = $("#relAte");
    const relGrupo = $("#relGrupo");
    const relGerarBtn = $("#relGerarBtn");
    const exportCsv = $("#exportCsv");
    const relDetalheTbody = $("#relDetalheTbody");
    const kpiQtd = $("#kpiQtd");
    const kpiBruto = $("#kpiBruto");
    const kpiTicket = $("#kpiTicket");
    const reportsChartCanvas = $("#reportsChart");
    const reportsChartLegend = $("#reportsChartLegend");
    const reportsProfChartCanvas = $("#reportsProfChart");
    const reportsProfLegend = $("#reportsProfLegend");
    const reportsGrupoChartCanvas = $("#reportsGrupoChart");
    const reportsGrupoLegend = $("#reportsGrupoChartLegend");
    const prodRelTbody = $("#prodRelTbody");

    if (!relGerarBtn || !relDetalheTbody) return;

    // ✅ garante estruturas no state
    state.charts = state.charts || {};
    state.reportCache = state.reportCache || [];

    function destroyChart(inst) {
        try { inst?.destroy?.(); } catch { }
    }

    function setLegend(el, items) {
        if (!el) return;
        el.innerHTML = (items || [])
            .map((it) => `
        <div class="legend-item">
          <span class="legend-dot" style="background:${it.color}"></span>
          <span>${it.label}</span>
        </div>
      `)
            .join("");
    }

    function buildLegendFromChart(chart) {
        if (!chart) return [];
        const meta = chart.data?.datasets?.[0];
        const bg = meta?.backgroundColor;
        const labels = chart.data?.labels || [];
        if (!labels.length) return [];
        return labels.map((l, i) => ({
            label: l,
            color: Array.isArray(bg) ? (bg[i] || "#94a3b8") : (bg || "#94a3b8"),
        }));
    }

    // ===== helpers de data (produtos) =====
    function pad2(n) { return String(n).padStart(2, "0"); }

    function dateToYmd(d) {
        if (!d) return "";
        const dt = d instanceof Date ? d : new Date(d);
        if (Number.isNaN(dt.getTime())) return "";
        return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
    }

    function tsToDateMaybe(v) {
        // Firestore Timestamp tem toDate()
        if (!v) return null;
        if (v instanceof Date) return v;
        if (typeof v?.toDate === "function") return v.toDate();
        // alguns salvam como {seconds, nanoseconds}
        if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
        return null;
    }

    function pickSaleYmd(sale) {
        // tenta vários campos comuns
        const ymd =
            (sale?.dateYmd || sale?.dataYmd || sale?.ymd || sale?.data || sale?.date || "").toString().trim();

        // se já for yyyy-mm-dd
        if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;

        // tenta timestamp/date
        const dt =
            tsToDateMaybe(sale?.createdAt) ||
            tsToDateMaybe(sale?.created_at) ||
            tsToDateMaybe(sale?.timestamp) ||
            tsToDateMaybe(sale?.dataHora) ||
            tsToDateMaybe(sale?.dateTs) ||
            null;

        const fromTs = dateToYmd(dt);
        if (fromTs) return fromTs;

        // tenta "DD/MM/YYYY"
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(ymd)) {
            const [dd, mm, yyyy] = ymd.split("/");
            return `${yyyy}-${mm}-${dd}`;
        }

        return "";
    }

    function normalizeSale(raw) {
        const s = raw || {};

        // colecao do profissional (vários nomes possíveis)
        const profColecao =
            s.profColecao ||
            s.professionalColecao ||
            s.profissionalColecao ||
            s.colecao ||
            s.colecaoProf ||
            s.prof ||
            s.profissional ||
            "";

        const profNome =
            s.profNome ||
            s.professionalName ||
            s.profissionalNome ||
            s.professional ||
            s.profissionalLabel ||
            "";

        // itens (se existirem)
        const items = Array.isArray(s.items) ? s.items
            : Array.isArray(s.produtos) ? s.produtos
                : Array.isArray(s.cart) ? s.cart
                    : [];

        // qty/total direto
        let qty = Number(s.qty ?? s.qtd ?? s.quantidade ?? 0) || 0;
        let total = Number(s.total ?? s.valorTotal ?? s.totalGeral ?? s.totalValue ?? 0) || 0;

        // se não veio direto, calcula pelos itens
        if ((!qty || !total) && items.length) {
            if (!qty) {
                qty = items.reduce((acc, it) => acc + (Number(it.qty ?? it.qtd ?? it.quantidade ?? 0) || 0), 0);
            }
            if (!total) {
                total = items.reduce((acc, it) => {
                    const itTotal = Number(it.total ?? it.valorTotal ?? 0);
                    if (!Number.isNaN(itTotal) && itTotal) return acc + itTotal;

                    const p = Number(it.price ?? it.preco ?? it.valor ?? 0) || 0;
                    const q = Number(it.qty ?? it.qtd ?? it.quantidade ?? 0) || 0;
                    return acc + (p * q);
                }, 0);
            }
        }

        return {
            ...s,
            profColecao,
            profNome,
            qty: qty || 0,
            total: total || 0,
            dateYmd: pickSaleYmd(s)
        };
    }

    // ===== SERVIÇOS (agenda) =====
    async function fetchAppointmentsRange(colecao, deYmd, ateYmd) {
        await waitForAuth();
        const rows = [];
        const qy = query(
            collection(db, colecao),
            where("data", ">=", deYmd),
            where("data", "<=", ateYmd)
        );
        const snap = await getDocs(qy);
        snap.forEach((d) => {
            const v = d.data() || {};
            const hora = (v.hora || "").trim();
            const data = (v.data || "").trim();
            const bloqueado = !!v.bloqueado;

            const firstName = (v.clienteNome || "").trim();
            const lastName = (v.clienteSobrenome || "").trim();
            const fullName =
                (v.clienteNomeCompleto || "").trim() ||
                [firstName, lastName].filter(Boolean).join(" ") ||
                (v.cliente || "");

            const telefone = v.clienteTelefone || v.telefoneCliente || v.phone || v.telefone || "";

            const valor =
                v.valor !== undefined && v.valor !== null
                    ? Number(v.valor)
                    : v.servicoValor !== undefined && v.servicoValor !== null
                        ? Number(v.servicoValor)
                        : 0;

            const forma = v.pagamentoForma || "";
            const raclub = v?.raclub?.status === "membro";
            const servicoNome = v.servicoNome || v.servico || "";

            rows.push({
                id: d.id,
                colecao,
                profissional: v.profissional || getProfLabelByColecao(colecao),
                data,
                hora,
                clienteNome: bloqueado && !fullName ? "" : fullName || "—",
                telefone,
                valor,
                pagamentoForma: forma,
                raclub,
                bloqueado,
                servico: servicoNome || "Serviço",
            });
        });

        rows.sort((a, b) => {
            const da = `${a.data || ""} ${a.hora || ""}`;
            const dbb = `${b.data || ""} ${b.hora || ""}`;
            return da.localeCompare(dbb);
        });

        return rows;
    }

    async function fetchAppointmentsForReports(deYmd, ateYmd, selected) {
        if (selected === "todos") {
            const all = [];
            const list = (state.PROFESSIONALS || []).length ? state.PROFESSIONALS : [ONLY_PRO];
            await Promise.all(
                list.map(async (p) => {
                    const rows = await fetchAppointmentsRange(p.colecao, deYmd, ateYmd);
                    all.push(...rows);
                })
            );
            return all;
        }
        return await fetchAppointmentsRange(selected, deYmd, ateYmd);
    }

    function filterAppointmentsForReports(rows, grupo) {
        return rows.filter((r) => {
            const hasClient = !!(r.clienteNome && r.clienteNome !== "—");
            if (r.bloqueado && !hasClient) return false;

            if (grupo === "membros") return r.raclub === true;
            if (grupo === "nao-membros") return r.raclub !== true;

            return true;
        });
    }

    function renderReportsTable(rows) {
        if (!relDetalheTbody) return;

        if (!rows.length) {
            relDetalheTbody.innerHTML = `<tr><td colspan="6" class="loading-row">Sem dados no período.</td></tr>`;
            return;
        }

        relDetalheTbody.innerHTML = rows
            .map((r) => `
        <tr>
          <td>${r.data ? formatDate(ymdToDateObj(r.data)) : "—"}</td>
          <td>${r.profissional || "—"}</td>
          <td>${r.clienteNome || "—"}</td>
          <td>${r.servico || "—"}</td>
          <td>${r.pagamentoForma || "—"}</td>
          <td>${formatCurrency(r.valor || 0)}</td>
        </tr>
      `)
            .join("");
    }

    function updateReportKPIs(rows) {
        const qtd = rows.length;
        const bruto = rows.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
        const comissao40 = bruto * 0.4;

        if (kpiQtd) kpiQtd.textContent = String(qtd);
        if (kpiBruto) kpiBruto.textContent = formatCurrency(bruto);
        if (kpiTicket) kpiTicket.textContent = formatCurrency(comissao40);
    }

    function buildServiceAggregation(rows) {
        const map = new Map();
        rows.forEach((r) => {
            const key = (r.servico || "Serviço").trim() || "Serviço";
            map.set(key, (map.get(key) || 0) + (Number(r.valor) || 0));
        });
        const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
        return { labels: entries.map((e) => e[0]), values: entries.map((e) => e[1]) };
    }

    function buildProfessionalCountAggregation(rows) {
        const map = new Map();
        rows.forEach((r) => {
            const key = (r.profissional || "—").trim() || "—";
            map.set(key, (map.get(key) || 0) + 1);
        });
        const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
        return { labels: entries.map((e) => e[0]), values: entries.map((e) => e[1]) };
    }

    function buildGroupAggregation(rows) {
        let qtdM = 0, qtdN = 0;
        let valM = 0, valN = 0;

        rows.forEach((r) => {
            if (r.raclub) {
                qtdM++; valM += Number(r.valor) || 0;
            } else {
                qtdN++; valN += Number(r.valor) || 0;
            }
        });

        return { labels: ["RA Club", "Cliente final"], qtd: [qtdM, qtdN], val: [valM, valN] };
    }

    function renderReportsCharts(rows) {
        // ⚠️ usa Chart global do seu HTML

        // 1) serviço (pie)
        if (reportsChartCanvas) {
            destroyChart(state.charts.reportsChartInstance);
            const { labels, values } = buildServiceAggregation(rows);

            state.charts.reportsChartInstance = new Chart(reportsChartCanvas, {
                type: "pie",
                data: { labels, datasets: [{ data: values }] },
                options: { responsive: true, plugins: { legend: { display: false } } },
            });

            setLegend(reportsChartLegend, buildLegendFromChart(state.charts.reportsChartInstance));
        }

        // 2) por profissional (bar)
        if (reportsProfChartCanvas) {
            destroyChart(state.charts.reportsProfChartInstance);
            const { labels, values } = buildProfessionalCountAggregation(rows);

            state.charts.reportsProfChartInstance = new Chart(reportsProfChartCanvas, {
                type: "bar",
                data: { labels, datasets: [{ data: values }] },
                options: { responsive: true, plugins: { legend: { display: false } } },
            });

            setLegend(reportsProfLegend, buildLegendFromChart(state.charts.reportsProfChartInstance));
        }

        // 3) grupo (combo)
        if (reportsGrupoChartCanvas) {
            destroyChart(state.charts.reportsGrupoChartInstance);
            const g = buildGroupAggregation(rows);

            state.charts.reportsGrupoChartInstance = new Chart(reportsGrupoChartCanvas, {
                type: "bar",
                data: {
                    labels: g.labels,
                    datasets: [
                        { label: "Qtd", data: g.qtd },
                        { label: "Valor", data: g.val, type: "line" },
                    ],
                },
                options: { responsive: true },
            });

            if (reportsGrupoLegend) reportsGrupoLegend.innerHTML = "";
        }
    }

    // ===== PRODUTOS (PDV) =====
    async function fetchProductSalesForReports(deYmd, ateYmd) {
        await waitForAuth();

        // ✅ tenta queries com range (podem exigir índice composto em alguns projetos)
        const tryQueries = [
            () => query(
                collection(db, "pdv_sales"),
                where("dateYmd", ">=", deYmd),
                where("dateYmd", "<=", ateYmd)
            ),
            () => query(
                collection(db, "pdv_sales"),
                where("dataYmd", ">=", deYmd),
                where("dataYmd", "<=", ateYmd)
            ),
        ];

        // 1) tenta range por string (mais rápido)
        for (const buildQ of tryQueries) {
            try {
                const snap = await getDocs(buildQ());
                return snap.docs.map((d) => normalizeSale({ id: d.id, ...(d.data() || {}) }));
            } catch (e) {
                // segue para fallback
                console.warn("Falha query range produtos (tentando fallback):", e?.message || e);
            }
        }

        // 2) fallback: busca sem range e filtra no JS (não depende de índice)
        try {
            // tenta ordenar por algum campo comum
            let snap;
            try {
                snap = await getDocs(query(collection(db, "pdv_sales"), orderBy("dateYmd")));
            } catch {
                try {
                    snap = await getDocs(query(collection(db, "pdv_sales"), orderBy("dataYmd")));
                } catch {
                    snap = await getDocs(collection(db, "pdv_sales"));
                }
            }

            const all = snap.docs.map((d) => normalizeSale({ id: d.id, ...(d.data() || {}) }));
            const filtered = all.filter((s) => {
                const ymd = s.dateYmd || "";
                if (!ymd) return false;
                return ymd >= deYmd && ymd <= ateYmd;
            });

            return filtered;
        } catch (e) {
            // re-lança pra ser tratado no gerarRelatorios (vai mostrar mensagem na tabela)
            throw e;
        }
    }

    function renderProductReportTable(sales, selectedProfColecao) {
        if (!prodRelTbody) return;

        const normalized = (sales || []).map(normalizeSale);

        const filtered = selectedProfColecao && selectedProfColecao !== "todos"
            ? normalized.filter((s) => (s.profColecao || "") === selectedProfColecao)
            : normalized;

        if (!filtered.length) {
            prodRelTbody.innerHTML = `<tr><td colspan="4" class="loading-row">Sem vendas de produtos no período.</td></tr>`;
            return;
        }

        const map = new Map();
        filtered.forEach((s) => {
            const prof = s.profNome || getProfLabelByColecao(s.profColecao) || "—";
            const qty = Number(s.qty || 0);
            const total = Number(s.total || 0);
            const prev = map.get(prof) || { qty: 0, total: 0 };
            map.set(prof, { qty: prev.qty + qty, total: prev.total + total });
        });

        const rows = [...map.entries()].sort((a, b) => b[1].total - a[1].total);

        prodRelTbody.innerHTML = rows
            .map(([prof, agg]) => {
                const comissao = agg.total * 0.1;
                return `
          <tr>
            <td>${prof}</td>
            <td>${agg.qty}</td>
            <td>${formatCurrency(agg.total)}</td>
            <td>${formatCurrency(comissao)}</td>
          </tr>
        `;
            })
            .join("");
    }

    async function gerarRelatorios() {
        const deYmd = relDe?.value;
        const ateYmd = relAte?.value;
        const grupo = relGrupo?.value || "todos";
        const sel = relProf?.value || getSelectedColecao();

        if (!deYmd || !ateYmd) return showNotification("Selecione 'De' e 'Até'.", "error");

        try {
            relDetalheTbody.innerHTML = `<tr><td colspan="6" class="loading-row">Carregando...</td></tr>`;
            if (prodRelTbody) prodRelTbody.innerHTML = `<tr><td colspan="4" class="loading-row">Carregando...</td></tr>`;

            // ===== SERVIÇOS =====
            const raw = await fetchAppointmentsForReports(deYmd, ateYmd, sel);
            const rows = filterAppointmentsForReports(raw, grupo);

            rows.sort((a, b) => {
                const aa = `${a.data || ""} ${a.hora || ""}`;
                const bb = `${b.data || ""} ${b.hora || ""}`;
                return aa.localeCompare(bb);
            });

            state.reportCache = rows;

            renderReportsTable(rows);
            updateReportKPIs(rows);

            try {
                renderReportsCharts(rows);
            } catch (e) {
                console.warn("Erro ao renderizar gráficos:", e);
            }

            // ===== PRODUTOS (não pode derrubar serviços) =====
            if (prodRelTbody) {
                try {
                    const sales = await fetchProductSalesForReports(deYmd, ateYmd);
                    renderProductReportTable(sales, sel);
                } catch (e) {
                    console.warn("Erro ao carregar vendas de produtos:", e);
                    prodRelTbody.innerHTML = `<tr><td colspan="4" class="loading-row">Erro ao carregar vendas de produtos.</td></tr>`;
                }
            }

            showNotification("Relatórios gerados!", "success");
        } catch (err) {
            console.error(err);
            showNotification("Erro ao gerar relatórios.", "error");
            relDetalheTbody.innerHTML = `<tr><td colspan="6" class="loading-row">Erro ao gerar relatório.</td></tr>`;
            if (prodRelTbody) prodRelTbody.innerHTML = `<tr><td colspan="4" class="loading-row">Erro ao gerar relatório.</td></tr>`;
        }
    }

    relGerarBtn?.addEventListener("click", gerarRelatorios);

    function rowsToCsv(rows) {
        const header = ["Data", "Hora", "Profissional", "Cliente", "Serviço", "Forma", "Valor", "RAClub"];
        const lines = [header.join(";")];
        rows.forEach((r) => {
            const line = [
                r.data || "",
                r.hora || "",
                (r.profissional || "").replaceAll(";", ","),
                (r.clienteNome || "").replaceAll(";", ","),
                (r.servico || "").replaceAll(";", ","),
                (r.pagamentoForma || "").replaceAll(";", ","),
                String(Number(r.valor || 0)).replace(".", ","),
                r.raclub ? "SIM" : "NAO",
            ];
            lines.push(line.join(";"));
        });
        return lines.join("\n");
    }

    exportCsv?.addEventListener("click", async () => {
        try {
            if (!state.reportCache?.length) {
                showNotification("Gere um relatório primeiro.", "error");
                return;
            }
            const csv = rowsToCsv(state.reportCache);
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `relatorio_servicos_${(relDe?.value || "")}_a_${(relAte?.value || "")}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            showNotification("Erro ao exportar CSV.", "error");
        }
    });
}
