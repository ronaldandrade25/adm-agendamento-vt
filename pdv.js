// js/pdv.js
import {
    db, $, showNotification, mainModal,
    state, waitForAuth,
    PAYMENT_METHODS,
    getSelectedColecao, setSelectedColecao, getProfLabelByColecao,
    populateProfessionalSelects,
    addDoc, updateDoc, deleteDoc, doc, collection, onSnapshot, serverTimestamp
} from "./firebase.js";

export function initPdvTab() {
    const pdvProductForm = $("#pdvProductForm");
    const pdvProductNameInput = $("#pdvProductName");
    const pdvProductPriceInput = $("#pdvProductPrice");
    const pdvProductStockInput = $("#pdvProductStock");
    const pdvProductsTbody = $("#pdvProductsTbody");

    const pdvSaleForm = $("#pdvSaleForm");
    const pdvSaleProductSelect = $("#pdvSaleProduct");
    const pdvSaleProfSelect = $("#pdvSaleProf");
    const pdvSaleQtyInput = $("#pdvSaleQty");
    const pdvSaleMethodSelect = $("#pdvSaleMethod");

    if (!pdvProductsTbody && !pdvSaleForm) return;

    function fillPdvPaymentMethods() {
        if (!pdvSaleMethodSelect) return;
        pdvSaleMethodSelect.innerHTML =
            `<option value="">Selecione</option>` +
            PAYMENT_METHODS.map((m) => `<option value="${m}">${m}</option>`).join("");
    }

    function fillPdvProfOptions() {
        if (!pdvSaleProfSelect) return;
        const opts = (state.PROFESSIONALS || []).map(
            (p) => `<option value="${p.colecao}">${p.label || p.nome || p.colecao}</option>`
        ).join("");

        pdvSaleProfSelect.innerHTML = opts || `<option value="${getSelectedColecao()}">${getProfLabelByColecao(getSelectedColecao())}</option>`;
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
                        const price = p.price == null ? "—" : (Number(p.price) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                        const stock = Number(p.stock || 0);
                        return `
              <tr>
                <td>${p.name || "—"}</td>
                <td>${price}</td>
                <td>${stock}</td>
                <td>
                  <button class="btn btn-sm btn-del" data-pdv-del="${p.id}">
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
                `<option value="">Selecione</option>` +
                state.pdvProducts
                    .filter((p) => p.ativo !== false)
                    .map((p) => {
                        const label = p.price != null
                            ? `${p.name} • ${(Number(p.price) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                            : p.name;
                        return `<option value="${p.id}">${label}</option>`;
                    })
                    .join("");
        }
    }

    pdvProductForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
            await waitForAuth();

            const name = (pdvProductNameInput?.value || "").trim();
            const price = pdvProductPriceInput?.value ? Number(pdvProductPriceInput.value) : null;
            const stock = pdvProductStockInput?.value ? Number(pdvProductStockInput.value) : 0;

            if (!name) return showNotification("Informe o nome do produto.", "error");

            await addDoc(collection(db, "produtos"), {
                nome: name,
                preco: price,
                estoque: Number.isNaN(stock) ? 0 : stock,
                ativo: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            pdvProductForm.reset();
            showNotification("Produto cadastrado!", "success");
        } catch (err) {
            console.error(err);
            showNotification("Erro ao cadastrar produto.", "error");
        }
    });

    pdvProductsTbody?.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-pdv-del]");
        if (!btn) return;
        const id = btn.dataset.pdvDel;
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
    });

    // Vendas: coleção "pdv_sales"
    pdvSaleForm?.addEventListener("submit", async (e) => {
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

            const product = state.pdvProducts.find((p) => p.id === productId);
            if (!product) return showNotification("Produto não encontrado.", "error");

            const unitPrice = product.price == null ? 0 : Number(product.price);
            const total = unitPrice * qty;

            const profNome = getProfLabelByColecao(profColecao);
            const currentStock = Number(product.stock || 0);

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
                dateYmd: (() => {
                    const d = new Date();
                    const pad2 = (n) => String(n).padStart(2, "0");
                    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
                })(),
            });

            // decrementa estoque
            try {
                await updateDoc(doc(db, "produtos", productId), {
                    estoque: currentStock - qty,
                    updatedAt: serverTimestamp(),
                });
            } catch (err) {
                console.warn("Não consegui atualizar estoque (ok se não usa estoque):", err);
            }

            pdvSaleForm.reset();
            if (pdvSaleQtyInput) pdvSaleQtyInput.value = 1;
            fillPdvPaymentMethods();
            fillPdvProfOptions();
            setSelectedColecao(profColecao);

            showNotification("Venda registrada!", "success");
        } catch (err) {
            console.error(err);
            showNotification("Erro ao registrar venda.", "error");
        }
    });

    // listener produtos
    (async () => {
        await waitForAuth();

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
    })();
}
