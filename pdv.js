// pdv.js
import {
  db, $, showNotification, mainModal,
  state, waitForAuth,
  PAYMENT_METHODS,
  getSelectedColecao, setSelectedColecao, getProfLabelByColecao,
  populateProfessionalSelects,
  addDoc, updateDoc, deleteDoc, doc, collection, onSnapshot, serverTimestamp,
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

  function fillPdvPaymentMethods() {
    if (!pdvSaleMethodSelect) return;
    pdvSaleMethodSelect.innerHTML =
      `<option value="">Selecione...</option>` +
      (PAYMENT_METHODS || []).map((m) => `<option value="${m}">${m}</option>`).join("");
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

  function renderPdvProducts() {
    if (pdvProductsTbody) {
      if (!state.pdvProducts.length) {
        pdvProductsTbody.innerHTML = `<tr><td colspan="4" class="loading-row">Nenhum produto cadastrado.</td></tr>`;
      } else {
        pdvProductsTbody.innerHTML = state.pdvProducts
          .map((p) => {
            const price = p.price == null ? "—" : moneyBRL(p.price);
            const stock = Number(p.stock || 0);
            return `
              <tr>
                <td>${p.name || "—"}</td>
                <td>${price}</td>
                <td>${stock}</td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="btn btn-sm btn-light" data-pdv-edit="${p.id}" title="Editar">
                    <i class="bx bx-edit-alt"></i>
                  </button>
                  <button class="btn btn-sm btn-del" data-pdv-del="${p.id}" title="Excluir" style="margin-left:6px;">
                    <i class="bx bx-trash"></i>
                  </button>
                </td>
              </tr>
            `;
          })
          .join("");
      }
    }

    if (pdvSaleProductSelect) {
      pdvSaleProductSelect.innerHTML =
        `<option value="">Selecione...</option>` +
        state.pdvProducts
          .filter((p) => p.ativo !== false)
          .map((p) => {
            const priceLabel = p.price != null ? moneyBRL(p.price) : "—";
            const stock = Number(p.stock || 0);
            const label = `${p.name} • ${priceLabel} • Estoque: ${stock}`;
            return `<option value="${p.id}">${label}</option>`;
          })
          .join("");
    }
  }

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
        estoque: Number.isNaN(stock) ? 0 : stock,
        ativo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (pdvProdNameInput) pdvProdNameInput.value = "";
      if (pdvProdPriceInput) pdvProdPriceInput.value = "";
      if (pdvProdStockInput) pdvProdStockInput.value = 0;

      showNotification("Produto cadastrado!", "success");
    } catch (err) {
      console.error(err);
      showNotification("Erro ao cadastrar produto.", "error");
    }
  });

  // ========= Produtos: editar / excluir =========
  pdvProductsTbody?.addEventListener("click", async (e) => {
    const btnDel = e.target.closest("[data-pdv-del]");
    const btnEdit = e.target.closest("[data-pdv-edit]");

    // excluir
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
    try {
      await waitForAuth();

      const productId = pdvSaleProductSelect?.value || "";
      const profColecao = pdvSaleProfSelect?.value || getSelectedColecao();
      const qty = Number(pdvSaleQtyInput?.value || 1);
      const method = pdvSaleMethodSelect?.value || "";

      if (!productId) return showNotification("Selecione um produto.", "error");
      if (!qty || qty <= 0) return showNotification("Quantidade inválida.", "error");
      if (!method) return showNotification("Selecione a forma de pagamento.", "error");

      const product = (state.pdvProducts || []).find((p) => p.id === productId);
      if (!product) return showNotification("Produto não encontrado.", "error");

      const unitPrice = product.price == null ? 0 : Number(product.price);
      const total = unitPrice * qty;

      const profNome = getProfLabelByColecao(profColecao);
      const currentStock = Number(product.stock || 0);

      if (currentStock - qty < 0) {
        return showNotification(`Estoque insuficiente. Disponível: ${currentStock}`, "error");
      }

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

      await updateDoc(doc(db, "produtos", productId), {
        estoque: currentStock - qty,
        updatedAt: serverTimestamp(),
      });

      if (pdvSaleProductSelect) pdvSaleProductSelect.value = "";
      if (pdvSaleQtyInput) pdvSaleQtyInput.value = 1;
      if (pdvSaleMethodSelect) pdvSaleMethodSelect.value = "";

      fillPdvPaymentMethods();
      fillPdvProfOptions();
      setSelectedColecao(profColecao);

      showNotification("Venda registrada!", "success");
    } catch (err) {
      console.error(err);
      showNotification("Erro ao registrar venda.", "error");
    }
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
