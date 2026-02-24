<<<<<<< HEAD
// js/pdv.js
=======
// pdv.js
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
import {
  db, $, showNotification, mainModal,
  state, waitForAuth,
  PAYMENT_METHODS,
  getSelectedColecao, setSelectedColecao, getProfLabelByColecao,
  populateProfessionalSelects,
  addDoc, updateDoc, deleteDoc, doc, collection, onSnapshot, serverTimestamp,
<<<<<<< HEAD
  // ✅ novos imports (para listar/filtrar vendas)
  query, where, getDocs, orderBy, limit
} from "./firebase.js";

export function initPdvTab() {
  // ============================================================
  // ✅ IDs (compatível com seu HTML atual + seu JS antigo)
  // ============================================================

  // --- Produto (HTML atual)
  const pdvProdNome = $("#pdvProdNome");
  const pdvProdValor = $("#pdvProdValor");
  const pdvProdSalvarBtn = $("#pdvProdSalvarBtn");

  // --- Produto (JS antigo)
  const pdvProductForm = $("#pdvProductForm");
  const pdvProductNameInput = $("#pdvProductName");
  const pdvProductPriceInput = $("#pdvProductPrice");
  const pdvProductStockInput = $("#pdvProductStock");

  const pdvProductsTbody = $("#pdvProductsTbody");

  // --- Venda (HTML atual)
  const pdvSaleProfSelect = $("#pdvSaleProf");
  const pdvSaleProductSelect = $("#pdvSaleProduto") || $("#pdvSaleProduct");
  const pdvSaleQtyInput = $("#pdvSaleQtd") || $("#pdvSaleQty");
  const pdvSaleAddBtn = $("#pdvSaleAddBtn");

  // --- Venda (JS antigo)
  const pdvSaleForm = $("#pdvSaleForm");
  const pdvSaleMethodSelect = $("#pdvSaleMethod"); // (se existir no seu projeto antigo)

  // --- Últimas vendas (HTML atual)
  const pdvSalesTbody = $("#pdvSalesTbody");
  const pdvSalesDe = $("#pdvSalesDe");
  const pdvSalesAte = $("#pdvSalesAte");
  const pdvFiltrarVendas = $("#pdvFiltrarVendas");

  if (!pdvProductsTbody && !pdvSaleForm && !pdvSaleAddBtn) return;

  // ============================================================
  // Helpers
  // ============================================================
  const pad2 = (n) => String(n).padStart(2, "0");
  const todayYmd = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const formatBRL = (v) =>
    (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const ymdToBr = (ymd) => {
    if (!ymd || typeof ymd !== "string" || !ymd.includes("-")) return "—";
    const [y, m, d] = ymd.split("-");
    if (!y || !m || !d) return ymd;
    return `${d}/${m}/${y}`;
  };
=======
  query, where, getDoc // ✅ preciso pro “cancelar venda” devolver estoque
} from "./firebase.js";

export function initPdvTab() {
  // Produto
  const pdvProdNameInput = $("#pdvProdNome");
  const pdvProdPriceInput = $("#pdvProdValor");
  const pdvProdStockInput = $("#pdvProdEstoque");
  const pdvProdSaveBtn = $("#pdvProdSalvarBtn");
  const pdvProductsTbody = $("#pdvProductsTbody");

  // Venda
  const pdvSaleProductSelect = $("#pdvSaleProduto");
  const pdvSaleProfSelect = $("#pdvSaleProf");
  const pdvSaleQtyInput = $("#pdvSaleQtd");
  const pdvSaleMethodSelect = $("#pdvSaleMetodo");
  const pdvSaleAddBtn = $("#pdvSaleAddBtn");

  // Lista vendas + filtros (suporta os 2 formatos de HTML)
  const pdvSalesTbody = $("#pdvSalesTbody");

  // ✅ formato antigo: 1 data
  const pdvSalesDateInput = $("#pdvSalesDate");

  // ✅ formato novo: período (De/Até) + botão + (opcional) mês
  const pdvSalesDeInput = $("#pdvSalesDe");
  const pdvSalesAteInput = $("#pdvSalesAte");
  const pdvSalesFiltrarBtn = $("#pdvSalesFiltrarBtn");
  const pdvSalesMesInput = $("#pdvSalesMes"); // opcional (type="month")

  if (!pdvProductsTbody && !pdvSaleAddBtn && !pdvProdSaveBtn && !pdvSalesTbody) return;

  state.pdvProducts = state.pdvProducts || [];
  state.pdvSales = state.pdvSales || [];

  function pad2(n) { return String(n).padStart(2, "0"); }

  function ymdFromDate(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function todayYmd() {
    return ymdFromDate(new Date());
  }

  function moneyBRL(v) {
    return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function dateBR(d) {
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return "—"; }
  }

  function tsToMillis(t) {
    if (!t) return 0;
    if (typeof t.toMillis === "function") return t.toMillis();
    const ms = new Date(t).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  function lastDayOfMonth(year, month1to12) {
    // mês 1..12
    return new Date(year, month1to12, 0); // dia 0 do próximo mês = último dia do mês atual
  }

  // controla listener de vendas conforme filtro
  let unsubscribeSales = null;
  let currentSalesFilterKey = null; // string pra comparar filtros atuais
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c

  function fillPdvPaymentMethods() {
    if (!pdvSaleMethodSelect) return;
    pdvSaleMethodSelect.innerHTML =
<<<<<<< HEAD
      `<option value="">Selecione</option>` +
      PAYMENT_METHODS.map((m) => `<option value="${m}">${m}</option>`).join("");
=======
      `<option value="">Selecione...</option>` +
      (PAYMENT_METHODS || []).map((m) => `<option value="${m}">${m}</option>`).join("");
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
  }

  function fillPdvProfOptions() {
    if (!pdvSaleProfSelect) return;

    const opts = (state.PROFESSIONALS || [])
      .map((p) => `<option value="${p.colecao}">${p.label || p.nome || p.colecao}</option>`)
      .join("");

    pdvSaleProfSelect.innerHTML =
      opts || `<option value="${getSelectedColecao()}">${getProfLabelByColecao(getSelectedColecao())}</option>`;

    pdvSaleProfSelect.disabled = false;
    setSelectedColecao(getSelectedColecao());
  }

<<<<<<< HEAD
  // ============================================================
  // ✅ PRODUTOS: render + editar + excluir
  // ============================================================
  function renderPdvProducts() {
    // tabela produtos
    if (pdvProductsTbody) {
      if (!state.pdvProducts?.length) {
        // seu HTML atual tem 3 colunas (Produto, Valor, Ações)
        pdvProductsTbody.innerHTML = `<tr><td colspan="3" class="loading-row">Nenhum produto cadastrado.</td></tr>`;
      } else {
        pdvProductsTbody.innerHTML = state.pdvProducts
          .map((p) => {
            const price = p.price == null ? "—" : formatBRL(p.price);
=======
  function renderPdvProducts() {
    if (pdvProductsTbody) {
      if (!state.pdvProducts.length) {
        pdvProductsTbody.innerHTML = `<tr><td colspan="4" class="loading-row">Nenhum produto cadastrado.</td></tr>`;
      } else {
        pdvProductsTbody.innerHTML = state.pdvProducts
          .map((p) => {
            const price = p.price == null ? "—" : moneyBRL(p.price);
            const stock = Number(p.stock || 0);
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
            return `
              <tr>
                <td>${p.name || "—"}</td>
                <td>${price}</td>
<<<<<<< HEAD
                <td style="text-align:right;">
                  <div class="table-actions" style="justify-content:flex-end; gap:8px;">
                    <!-- ✅ editar -->
                    <button type="button" class="btn btn-sm btn-light" data-pdv-edit="${p.id}" title="Editar produto">
                      <i class="bx bx-edit-alt"></i>
                    </button>
                    <!-- ✅ excluir -->
                    <button type="button" class="btn btn-sm btn-del" data-pdv-del="${p.id}" title="Remover produto">
                      <i class="bx bx-trash"></i>
                    </button>
                  </div>
=======
                <td>${stock}</td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="btn btn-sm btn-light" data-pdv-edit="${p.id}" title="Editar">
                    <i class="bx bx-edit-alt"></i>
                  </button>
                  <button class="btn btn-sm btn-del" data-pdv-del="${p.id}" title="Excluir" style="margin-left:6px;">
                    <i class="bx bx-trash"></i>
                  </button>
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
                </td>
              </tr>
            `;
          })
          .join("");
      }
    }

<<<<<<< HEAD
    // select de produtos na venda
    if (pdvSaleProductSelect) {
      pdvSaleProductSelect.innerHTML =
        `<option value="">Selecione</option>` +
        (state.pdvProducts || [])
          .filter((p) => p.ativo !== false)
          .map((p) => {
            const label =
              p.price != null
                ? `${p.name} • ${formatBRL(p.price)}`
                : p.name;
=======
    if (pdvSaleProductSelect) {
      pdvSaleProductSelect.innerHTML =
        `<option value="">Selecione...</option>` +
        state.pdvProducts
          .filter((p) => p.ativo !== false)
          .map((p) => {
            const priceLabel = p.price != null ? moneyBRL(p.price) : "—";
            const stock = Number(p.stock || 0);
            const label = `${p.name} • ${priceLabel} • Estoque: ${stock}`;
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
            return `<option value="${p.id}">${label}</option>`;
          })
          .join("");
    }
  }

<<<<<<< HEAD
  async function openEditProductModal(productId) {
    await waitForAuth();
    const p = (state.pdvProducts || []).find((x) => x.id === productId);
    if (!p) return showNotification("Produto não encontrado.", "error");

    const currentName = p.name || "";
    const currentPrice = p.price == null ? "" : String(p.price);
    const currentStock = p.stock == null ? "" : String(p.stock);
    const currentAtivo = p.ativo !== false;

    mainModal.show({
      title: "Editar produto",
      body: `
        <div class="form-grid">
          <div class="field">
            <label>Nome</label>
            <input id="pdvEditNome" value="${String(currentName).replaceAll('"', "&quot;")}" />
          </div>

          <div class="field">
            <label>Preço (R$)</label>
            <input id="pdvEditPreco" type="number" step="0.01" value="${String(currentPrice).replaceAll('"', "&quot;")}" />
          </div>

          <div class="field">
            <label>Estoque (opcional)</label>
            <input id="pdvEditEstoque" type="number" step="1" value="${String(currentStock).replaceAll('"', "&quot;")}" />
          </div>

          <div class="field">
            <label>Ativo</label>
            <select id="pdvEditAtivo">
              <option value="true" ${currentAtivo ? "selected" : ""}>Sim</option>
              <option value="false" ${!currentAtivo ? "selected" : ""}>Não</option>
            </select>
            <small class="muted">Se ficar "Não", ele some do seletor de venda.</small>
          </div>
        </div>
      `,
      buttons: [
        { text: "Cancelar", class: "btn-light" },
        {
          text: "Salvar",
          class: "btn-edit",
          onClick: async () => {
            try {
              const nome = ($("#pdvEditNome")?.value || "").trim();
              const precoRaw = $("#pdvEditPreco")?.value;
              const estoqueRaw = $("#pdvEditEstoque")?.value;
              const ativoRaw = $("#pdvEditAtivo")?.value;

              if (!nome) return showNotification("Informe o nome do produto.", "error");

              const preco =
                precoRaw === "" || precoRaw == null ? null : Number(precoRaw);
              const estoque =
                estoqueRaw === "" || estoqueRaw == null ? 0 : Number(estoqueRaw);

              await updateDoc(doc(db, "produtos", productId), {
                nome,
                preco: Number.isNaN(preco) ? null : preco,
                estoque: Number.isNaN(estoque) ? 0 : estoque,
                ativo: ativoRaw !== "false",
                updatedAt: serverTimestamp(),
              });

              showNotification("Produto atualizado!", "success");
            } catch (err) {
              console.error(err);
              showNotification("Erro ao atualizar produto.", "error");
            }
          },
        },
      ],
    });
  }

  // cadastrar produto (compatível com botão do HTML atual OU form antigo)
  async function handleCreateProduct() {
    try {
      await waitForAuth();

      const name =
        (pdvProdNome?.value || pdvProductNameInput?.value || "").trim();

      const priceVal =
        pdvProdValor?.value ?? pdvProductPriceInput?.value ?? "";

      const stockVal =
        pdvProductStockInput?.value ?? ""; // só existe no JS antigo / alguns layouts

      const price = priceVal !== "" ? Number(priceVal) : null;
      const stock = stockVal !== "" ? Number(stockVal) : 0;

      if (!name) return showNotification("Informe o nome do produto.", "error");

      await addDoc(collection(db, "produtos"), {
        nome: name,
        preco: Number.isNaN(price) ? null : price,
=======
  function renderPdvSales() {
    if (!pdvSalesTbody) return;

    const rows = state.pdvSales || [];
    if (!rows.length) {
      pdvSalesTbody.innerHTML = `<tr><td colspan="6" class="loading-row">Sem vendas para exibir.</td></tr>`;
      return;
    }

    pdvSalesTbody.innerHTML = rows
      .slice(0, 200)
      .map((s) => {
        const d =
          s.createdAt?.toDate ? s.createdAt.toDate()
            : s.date?.toDate ? s.date.toDate()
              : s.createdAt ? s.createdAt
                : null;

        return `
          <tr>
            <td>${d ? dateBR(d) : (s.dateYmd || "—")}</td>
            <td>${s.profNome || s.profColecao || "—"}</td>
            <td>${s.productName || "—"}</td>
            <td>${Number(s.qty || 0)}</td>
            <td>${moneyBRL(s.total || 0)}</td>
            <td style="text-align:right; white-space:nowrap;">
              <button class="btn btn-sm btn-del" data-pdv-cancel-sale="${s.id}" title="Cancelar venda">
                <i class="bx bx-x-circle"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function buildSalesQueryFromUI() {
    const base = collection(db, "pdv_sales");

    // ✅ prioridade: novo formato (De/Até)
    const de = (pdvSalesDeInput?.value || "").trim();
    const ate = (pdvSalesAteInput?.value || "").trim();

    if (de || ate) {
      const clauses = [];
      if (de) clauses.push(where("dateYmd", ">=", de));
      if (ate) clauses.push(where("dateYmd", "<=", ate));
      return query(base, ...clauses);
    }

    // ✅ formato antigo (1 data)
    const ymd = (pdvSalesDateInput?.value || "").trim();
    if (ymd) {
      return query(base, where("dateYmd", "==", ymd));
    }

    // ✅ sem filtro: deixa “todas” (atenção: pode crescer muito)
    return query(base);
  }

  function filterKeyFromUI() {
    const de = (pdvSalesDeInput?.value || "").trim();
    const ate = (pdvSalesAteInput?.value || "").trim();
    const one = (pdvSalesDateInput?.value || "").trim();
    return JSON.stringify({ de, ate, one });
  }

  function startSalesListenerFromUI() {
    const nextKey = filterKeyFromUI();
    if (nextKey === currentSalesFilterKey && typeof unsubscribeSales === "function") return;
    currentSalesFilterKey = nextKey;

    if (typeof unsubscribeSales === "function") {
      try { unsubscribeSales(); } catch (_) { }
      unsubscribeSales = null;
    }

    if (pdvSalesTbody) {
      pdvSalesTbody.innerHTML = `<tr><td colspan="6" class="loading-row">Carregando vendas...</td></tr>`;
    }

    try {
      const q = buildSalesQueryFromUI();

      // ✅ SEM orderBy => não exige índice composto
      unsubscribeSales = onSnapshot(
        q,
        (snap) => {
          const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

          // ✅ ordena no JS (desc por createdAt)
          arr.sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));

          state.pdvSales = arr;
          renderPdvSales();
        },
        (error) => {
          console.error("Erro listener vendas:", error);
          if (pdvSalesTbody) {
            pdvSalesTbody.innerHTML = `<tr><td colspan="6" class="loading-row">Não foi possível carregar as vendas.</td></tr>`;
          }
        }
      );
    } catch (err) {
      console.warn("Listener de vendas não iniciou:", err);
      if (pdvSalesTbody) {
        pdvSalesTbody.innerHTML = `<tr><td colspan="6" class="loading-row">Não foi possível carregar as vendas.</td></tr>`;
      }
    }
  }

  // ========= Produtos: cadastrar =========
  pdvProdSaveBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await waitForAuth();

      const name = (pdvProdNameInput?.value || "").trim();
      const price = pdvProdPriceInput?.value !== "" ? Number(pdvProdPriceInput.value) : null;
      const stock = pdvProdStockInput?.value !== "" ? Number(pdvProdStockInput.value) : 0;

      if (!name) return showNotification("Informe o nome do produto.", "error");
      if (price != null && Number.isNaN(price)) return showNotification("Valor do produto inválido.", "error");
      if (Number.isNaN(stock) || stock < 0) return showNotification("Estoque inválido.", "error");

      await addDoc(collection(db, "produtos"), {
        nome: name,
        preco: price,
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
        estoque: Number.isNaN(stock) ? 0 : stock,
        ativo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

<<<<<<< HEAD
      // limpa campos
      if (pdvProductForm) pdvProductForm.reset();
      if (pdvProdNome) pdvProdNome.value = "";
      if (pdvProdValor) pdvProdValor.value = "";
=======
      if (pdvProdNameInput) pdvProdNameInput.value = "";
      if (pdvProdPriceInput) pdvProdPriceInput.value = "";
      if (pdvProdStockInput) pdvProdStockInput.value = 0;
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c

      showNotification("Produto cadastrado!", "success");
    } catch (err) {
      console.error(err);
      showNotification("Erro ao cadastrar produto.", "error");
    }
<<<<<<< HEAD
  }

  pdvProductForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleCreateProduct();
  });

  pdvProdSalvarBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await handleCreateProduct();
  });

  // ações na tabela de produtos (editar/excluir)
  pdvProductsTbody?.addEventListener("click", async (e) => {
    const btnEdit = e.target.closest("[data-pdv-edit]");
    const btnDel = e.target.closest("[data-pdv-del]");

    if (btnEdit) {
      const id = btnEdit.dataset.pdvEdit;
      if (!id) return;
      return openEditProductModal(id);
    }

=======
  });

  // ========= Produtos: editar / excluir =========
  pdvProductsTbody?.addEventListener("click", async (e) => {
    const btnDel = e.target.closest("[data-pdv-del]");
    const btnEdit = e.target.closest("[data-pdv-edit]");

    // excluir
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
    if (btnDel) {
      const id = btnDel.dataset.pdvDel;
      if (!id) return;

      mainModal.show({
        title: "Remover produto",
        body: "<p>Deseja remover este produto?</p>",
        buttons: [
          { text: "Cancelar", class: "btn-light" },
          {
            text: "Remover",
            class: "btn-del",
            onClick: async () => {
              try {
                await waitForAuth();
                await deleteDoc(doc(db, "produtos", id));
                showNotification("Produto removido!", "success");
              } catch (err) {
                console.error(err);
                showNotification("Erro ao remover produto.", "error");
              }
            },
          },
        ],
      });
<<<<<<< HEAD
    }
  });

  // ============================================================
  // ✅ VENDAS: registrar + listar + filtrar por data
  // ============================================================
  function renderSalesTable(rows) {
    if (!pdvSalesTbody) return;

    if (!rows?.length) {
      pdvSalesTbody.innerHTML = `<tr><td colspan="5" class="loading-row">Sem vendas para exibir.</td></tr>`;
      return;
    }

    pdvSalesTbody.innerHTML = rows
      .map((s) => {
        const data = ymdToBr(s.dateYmd || "");
        const prof = s.profNome || getProfLabelByColecao(s.profColecao) || "—";
        const produto = s.productName || s.product || "—";
        const qtd = Number(s.qty || 0);
        const total = formatBRL(s.total || 0);

        return `
          <tr>
            <td>${data}</td>
            <td>${prof}</td>
            <td>${produto}</td>
            <td>${qtd}</td>
            <td>${total}</td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadSalesRange(deYmd, ateYmd) {
    await waitForAuth();

    // Se não vier período, carrega as últimas 20 (mais recente)
    if (!deYmd || !ateYmd) {
      try {
        const qy = query(
          collection(db, "pdv_sales"),
          orderBy("dateYmd", "desc"),
          limit(20)
        );
        const snap = await getDocs(qy);
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        renderSalesTable(rows);
        return;
      } catch (err) {
        console.warn("Falha ao carregar últimas vendas com orderBy(dateYmd). Tentando fallback:", err);
        const snap = await getDocs(collection(db, "pdv_sales"));
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
        rows.sort((a, b) => String(b.dateYmd || "").localeCompare(String(a.dateYmd || "")));
        renderSalesTable(rows.slice(0, 20));
        return;
      }
    }

    // Com período, filtra por dateYmd (YYYY-MM-DD)
    try {
      const qy = query(
        collection(db, "pdv_sales"),
        where("dateYmd", ">=", deYmd),
        where("dateYmd", "<=", ateYmd),
        orderBy("dateYmd", "desc")
      );
      const snap = await getDocs(qy);
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      renderSalesTable(rows);
    } catch (err) {
      // fallback: lê tudo e filtra client-side (evita travar por índice)
      console.warn("Falha query vendas por range, usando fallback:", err);
      const snap = await getDocs(collection(db, "pdv_sales"));
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      const filtered = rows.filter((x) => {
        const dt = String(x.dateYmd || "");
        return dt >= deYmd && dt <= ateYmd;
      });
      filtered.sort((a, b) => String(b.dateYmd || "").localeCompare(String(a.dateYmd || "")));
      renderSalesTable(filtered);
    }
  }

  async function handleRegisterSale() {
=======

      return;
    }

    // editar
    if (btnEdit) {
      const id = btnEdit.dataset.pdvEdit;
      if (!id) return;

      const p = (state.pdvProducts || []).find((x) => x.id === id);
      const initialName = (p?.name || "").trim();
      const initialPrice = p?.price ?? null;
      const initialStock = Number(p?.stock || 0);

      mainModal.show({
        title: "Editar produto",
        body: `
          <div class="field">
            <label>Nome</label>
            <input id="pdvEditNome" value="${String(initialName).replace(/"/g, "&quot;")}" />
          </div>
          <div class="field" style="margin-top:10px;">
            <label>Valor (R$)</label>
            <input id="pdvEditValor" type="number" step="0.01" value="${initialPrice == null ? "" : Number(initialPrice)}" />
          </div>
          <div class="field" style="margin-top:10px;">
            <label>Estoque (qtd)</label>
            <input id="pdvEditEstoque" type="number" min="0" step="1" value="${Number.isFinite(initialStock) ? initialStock : 0}" />
          </div>
        `,
        buttons: [
          { text: "Cancelar", class: "btn-light" },
          {
            text: "Salvar",
            class: "btn-edit",
            onClick: async () => {
              try {
                await waitForAuth();
                const nome = ($("#pdvEditNome")?.value || "").trim();
                const valorStr = ($("#pdvEditValor")?.value ?? "").toString();
                const estoqueStr = ($("#pdvEditEstoque")?.value ?? "").toString();

                const preco = valorStr !== "" ? Number(valorStr) : null;
                const estoque = estoqueStr !== "" ? Number(estoqueStr) : 0;

                if (!nome) return showNotification("Informe o nome do produto.", "error"), false;
                if (preco != null && Number.isNaN(preco)) return showNotification("Valor do produto inválido.", "error"), false;
                if (Number.isNaN(estoque) || estoque < 0) return showNotification("Estoque inválido.", "error"), false;

                await updateDoc(doc(db, "produtos", id), {
                  nome,
                  preco,
                  estoque,
                  updatedAt: serverTimestamp(),
                });

                showNotification("Produto atualizado!", "success");
              } catch (err) {
                console.error(err);
                showNotification("Erro ao atualizar produto.", "error");
                return false;
              }
            },
          },
        ],
      });

      return;
    }
  });

  // ========= Vendas: registrar =========
  pdvSaleAddBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
    try {
      await waitForAuth();

      const productId = pdvSaleProductSelect?.value || "";
      const profColecao = pdvSaleProfSelect?.value || getSelectedColecao();
      const qty = Number(pdvSaleQtyInput?.value || 1);
<<<<<<< HEAD

      // method pode não existir no seu HTML novo (se não tiver, salva "Outro")
      const method = pdvSaleMethodSelect?.value || "Outro";

      if (!productId) return showNotification("Selecione um produto.", "error");
      if (!qty || qty <= 0) return showNotification("Quantidade inválida.", "error");
      if (pdvSaleMethodSelect && !pdvSaleMethodSelect.value) {
        return showNotification("Selecione a forma de pagamento.", "error");
      }
=======
      const method = pdvSaleMethodSelect?.value || "";

      if (!productId) return showNotification("Selecione um produto.", "error");
      if (!qty || qty <= 0) return showNotification("Quantidade inválida.", "error");
      if (!method) return showNotification("Selecione a forma de pagamento.", "error");
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c

      const product = (state.pdvProducts || []).find((p) => p.id === productId);
      if (!product) return showNotification("Produto não encontrado.", "error");

      const unitPrice = product.price == null ? 0 : Number(product.price);
      const total = unitPrice * qty;

      const profNome = getProfLabelByColecao(profColecao);
      const currentStock = Number(product.stock || 0);

<<<<<<< HEAD
=======
      if (currentStock - qty < 0) {
        return showNotification(`Estoque insuficiente. Disponível: ${currentStock}`, "error");
      }

>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
      await addDoc(collection(db, "pdv_sales"), {
        productId,
        productName: product.name || "",
        unitPrice,
        qty,
        total,
        method,
        profColecao,
        profNome,
        createdAt: serverTimestamp(),
        dateYmd: todayYmd(),
      });

<<<<<<< HEAD
      // decrementa estoque (se você usa estoque)
      try {
        await updateDoc(doc(db, "produtos", productId), {
          estoque: currentStock - qty,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn("Não consegui atualizar estoque (ok se não usa estoque):", err);
      }

      // limpa UI
      if (pdvSaleForm) pdvSaleForm.reset();
      if (pdvSaleQtyInput) pdvSaleQtyInput.value = 1;
=======
      await updateDoc(doc(db, "produtos", productId), {
        estoque: currentStock - qty,
        updatedAt: serverTimestamp(),
      });

      if (pdvSaleProductSelect) pdvSaleProductSelect.value = "";
      if (pdvSaleQtyInput) pdvSaleQtyInput.value = 1;
      if (pdvSaleMethodSelect) pdvSaleMethodSelect.value = "";
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c

      fillPdvPaymentMethods();
      fillPdvProfOptions();
      setSelectedColecao(profColecao);

      showNotification("Venda registrada!", "success");
<<<<<<< HEAD

      // atualiza lista (mantém período se usuário filtrou)
      await loadSalesRange(pdvSalesDe?.value || "", pdvSalesAte?.value || "");
=======
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
    } catch (err) {
      console.error(err);
      showNotification("Erro ao registrar venda.", "error");
    }
<<<<<<< HEAD
  }

  // compat: submit de form (antigo)
  pdvSaleForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleRegisterSale();
  });

  // HTML novo: botão registrar venda
  pdvSaleAddBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await handleRegisterSale();
  });

  // Filtrar vendas por data
  pdvFiltrarVendas?.addEventListener("click", async (e) => {
    e.preventDefault();
    const de = (pdvSalesDe?.value || "").trim();
    const ate = (pdvSalesAte?.value || "").trim();

    if ((de && !ate) || (!de && ate)) {
      return showNotification("Selecione 'De' e 'Até' para filtrar.", "error");
    }

    await loadSalesRange(de, ate);
  });

  // ============================================================
  // ✅ listeners (produtos realtime) + carga inicial vendas
  // ============================================================
  (async () => {
    await waitForAuth();

    // se você usa esse helper para popular selects em outros lugares
    try { populateProfessionalSelects?.(); } catch {}

=======
  });

  // ========= Vendas: cancelar (delete + devolve estoque) =========
  pdvSalesTbody?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-pdv-cancel-sale]");
    if (!btn) return;

    const saleId = btn.dataset.pdvCancelSale;
    if (!saleId) return;

    const sale = (state.pdvSales || []).find((s) => s.id === saleId);
    if (!sale) return showNotification("Venda não encontrada na lista.", "error");

    mainModal.show({
      title: "Cancelar venda",
      body: `<p>Deseja cancelar esta venda?</p>
             <p class="muted" style="margin-top:8px;">
               Produto: <b>${sale.productName || "—"}</b> • Qtd: <b>${Number(sale.qty || 0)}</b>
             </p>`,
      buttons: [
        { text: "Voltar", class: "btn-light" },
        {
          text: "Cancelar venda",
          class: "btn-del",
          onClick: async () => {
            try {
              await waitForAuth();

              const productId = sale.productId;
              const qty = Number(sale.qty || 0);

              // 1) devolve estoque
              if (productId && qty > 0) {
                const productRef = doc(db, "produtos", productId);
                const snap = await getDoc(productRef);
                const v = snap.exists() ? (snap.data() || {}) : {};
                const currentStock = Number(v.estoque ?? v.stock ?? 0);

                await updateDoc(productRef, {
                  estoque: currentStock + qty,
                  updatedAt: serverTimestamp(),
                });
              }

              // 2) apaga venda
              await deleteDoc(doc(db, "pdv_sales", saleId));

              showNotification("Venda cancelada!", "success");
            } catch (err) {
              console.error(err);
              showNotification("Erro ao cancelar venda.", "error");
              return false;
            }
          },
        },
      ],
    });
  });

  // ========= Filtros =========
  // antigo: 1 data
  pdvSalesDateInput?.addEventListener("change", () => {
    startSalesListenerFromUI();
  });

  // novo: De/Até
  pdvSalesFiltrarBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    startSalesListenerFromUI();
  });

  // novo (opcional): mês => preenche De/Até
  pdvSalesMesInput?.addEventListener("change", () => {
    const v = (pdvSalesMesInput.value || "").trim(); // "YYYY-MM"
    if (!v) return;

    const [yStr, mStr] = v.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m) return;

    const first = new Date(y, m - 1, 1);
    const last = lastDayOfMonth(y, m);

    if (pdvSalesDeInput) pdvSalesDeInput.value = ymdFromDate(first);
    if (pdvSalesAteInput) pdvSalesAteInput.value = ymdFromDate(last);

    startSalesListenerFromUI();
  });

  // ========= init listeners =========
  (async () => {
    await waitForAuth();

    // produtos
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
    onSnapshot(
      collection(db, "produtos"),
      (snap) => {
        state.pdvProducts = snap.docs.map((d) => {
          const v = d.data() || {};
          return {
            id: d.id,
            name: v.nome || v.name || "",
            price: v.preco ?? v.price ?? null,
            stock: v.estoque ?? v.stock ?? 0,
            ativo: v.ativo !== false,
          };
        });

        state.pdvProducts.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        renderPdvProducts();
      },
      (error) => console.error("Erro listener produtos:", error)
    );

    fillPdvPaymentMethods();
    fillPdvProfOptions();
    renderPdvProducts();

<<<<<<< HEAD
    // carrega últimas vendas (ou período já preenchido)
    if (pdvSalesDe && pdvSalesAte && (pdvSalesDe.value || pdvSalesAte.value)) {
      await loadSalesRange(pdvSalesDe.value || "", pdvSalesAte.value || "");
    } else {
      await loadSalesRange("", "");
    }
  })();
}
=======
    // ✅ defaults de filtro:
    // - se tiver De/Até: mês atual (01 até hoje)
    // - senão: data de hoje no input antigo
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = pad2(hoje.getMonth() + 1);
    const d = pad2(hoje.getDate());

    if (pdvSalesDeInput && pdvSalesAteInput) {
      if (!pdvSalesDeInput.value) pdvSalesDeInput.value = `${y}-${m}-01`;
      if (!pdvSalesAteInput.value) pdvSalesAteInput.value = `${y}-${m}-${d}`;
    } else if (pdvSalesDateInput) {
      if (!pdvSalesDateInput.value) pdvSalesDateInput.value = `${y}-${m}-${d}`;
    }

    startSalesListenerFromUI();
    renderPdvSales();

    try { populateProfessionalSelects?.(); } catch (_) { }
  })();
}
>>>>>>> 6a7bbd6e8442a1c53a605d179a5c5b4fa972087c
