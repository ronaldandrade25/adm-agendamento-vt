// js/clientes.js
import {
    db, $, normalize, formatCurrency, showNotification, mainModal,
    state, waitForAuth,
    addDoc, updateDoc, deleteDoc, doc, collection, onSnapshot, query, orderBy, serverTimestamp,
    formatDate
} from "./firebase.js";

export function initClientesTab() {
    const clientForm = $("#clientForm");
    const clientTableBody = $("#clientTableBody");
    const clientSearch = $("#clientSearch");
    const paymentsTableBody = $("#paymentsTableBody");
    const clientTypeSelect = $("#clientType");
    const clientValueField = $("#clientValueField");
    const clientPayDayField = $("#clientPayDayField");
    const clientNameInput = $("#clientName");
    const clientPhoneInput = $("#clientPhone");
    const clientValueInput = $("#clientValue");
    const clientPayDayInput = $("#clientPayDay");
    const clientFilterButtons = document.querySelectorAll(".filter-tab-btn");
    const activeMembersSpan = $("#activeMembers");
    const estimatedRevenueSpan = $("#estimatedRevenue");
    const monthlyTotalSpan = $("#monthlyTotal");

    if (!clientTableBody) return;

    function togglePlanFields() {
        if (!clientTypeSelect) return;
        const isPlan = clientTypeSelect.value === "plano_jc";
        if (clientValueField) clientValueField.style.display = isPlan ? "flex" : "none";
        if (clientPayDayField) clientPayDayField.style.display = isPlan ? "flex" : "none";
    }
    clientTypeSelect?.addEventListener("change", togglePlanFields);

    function mapOldClientDoc(id, v) {
        const name = v.name || v.nome || "";
        const phone = v.phone || v.telefone || "";
        const rawType = v.type || (v.plano ? "plano_jc" : "cliente");
        const isPlanFlag =
            rawType === "plano_jc" ||
            rawType === "plano_ra" ||
            v.plano === "ra_club" ||
            v.plano === "PLANO_RA" ||
            v.isPlan === true;

        const type = isPlanFlag ? "plano_jc" : rawType || "cliente";
        const value = v.value ?? v.valorMensal ?? v.valor ?? 0;
        const payDay = v.payDay ?? v.diaPagamento ?? null;
        const status = v.status || v.situacao || (isPlanFlag ? "ativo" : null);

        return { id, name, phone, type, value, payDay, status };
    }

    function applyClientFilters() {
        if (!clientTableBody) return;

        const searchTerm = normalize(clientSearch?.value || "");
        const activeFilter =
            [...clientFilterButtons].find((b) => b.classList.contains("active"))?.dataset.filter || "todos";

        const rows = (state.allClients || []).filter((c) => {
            const matchesText =
                !searchTerm || normalize(c.name).includes(searchTerm) || normalize(c.phone).includes(searchTerm);

            let matchesFilter = true;
            if (activeFilter === "clientes") matchesFilter = c.type === "cliente";
            else if (activeFilter === "plano_jc") matchesFilter = c.type === "plano_jc";

            return matchesText && matchesFilter;
        });

        if (!rows.length) {
            clientTableBody.innerHTML = `<tr><td colspan="6" class="loading-row">${state.allClients.length ? "Nenhum cliente encontrado." : "Carregando..."}</td></tr>`;
            return;
        }

        clientTableBody.innerHTML = rows
            .map((c) => {
                const tipoLabel = c.type === "plano_jc" ? "Plano RA" : "Cliente comum";
                const status = c.type === "plano_jc" ? (c.status || "ativo") : "—";
                const valor = c.type === "plano_jc" ? formatCurrency(c.value || 0) : "—";

                return `
          <tr>
            <td>${c.name || "—"}</td>
            <td>${c.phone || "—"}</td>
            <td>${tipoLabel}</td>
            <td>${valor}</td>
            <td>${status}</td>
            <td>
              <div class="timeslot-actions">
                <button class="btn btn-sm btn-edit" data-action="edit-client" data-id="${c.id}">
                  <i class="bx bx-pencil"></i>
                </button>

                ${c.type === "plano_jc"
                        ? `
                    <button class="btn btn-sm btn-success" data-action="pay-client" data-id="${c.id}">
                      <i class="bx bx-dollar"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" data-action="toggle-status" data-id="${c.id}">
                      <i class="bx ${(c.status || "ativo") === "ativo" ? "bx-pause" : "bx-play"}"></i>
                    </button>
                  `
                        : ""
                    }

                ${c.type === "cliente"
                        ? `
                    <button class="btn btn-sm btn-del" data-action="delete-client" data-id="${c.id}">
                      <i class="bx bx-trash"></i>
                    </button>
                  `
                        : ""
                    }
              </div>
            </td>
          </tr>
        `;
            })
            .join("");
    }

    function updateClientKPIs() {
        const activePlanMembers = (state.allClients || []).filter(
            (c) => c.type === "plano_jc" && (c.status || "ativo") === "ativo"
        );
        if (activeMembersSpan) activeMembersSpan.textContent = String(activePlanMembers.length);

        const total = activePlanMembers.reduce((sum, c) => sum + (Number(c.value) || 0), 0);
        if (estimatedRevenueSpan) estimatedRevenueSpan.textContent = formatCurrency(total);
    }

    clientSearch?.addEventListener("input", applyClientFilters);
    clientFilterButtons?.forEach((btn) => {
        btn.addEventListener("click", () => {
            clientFilterButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            applyClientFilters();
        });
    });

    // salvar novo cliente
    clientForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await waitForAuth();

        const name = (clientNameInput?.value || "").trim();
        if (!name) return showNotification("Informe o nome do cliente.", "error");

        const type = clientTypeSelect?.value || "cliente";
        const phone = (clientPhoneInput?.value || "").trim();
        const isPlan = type === "plano_jc";
        const value = isPlan ? Number(clientValueInput?.value || 0) : 0;
        const payDay = isPlan ? Number(clientPayDayInput?.value || 0) : null;
        const status = isPlan ? "ativo" : null;

        const dataFirestore = {
            name,
            phone,
            type,
            value,
            payDay,
            status,
            createdAt: serverTimestamp(),

            // compat antigo:
            nome: name,
            telefone: phone,
            valorMensal: value,
            diaPagamento: payDay,
            situacao: status,
            plano: isPlan ? "ra_club" : "cliente",
        };

        try {
            await addDoc(collection(db, "raclub_clients"), dataFirestore);
            clientForm.reset();
            if (clientTypeSelect) clientTypeSelect.value = "cliente";
            togglePlanFields();
            showNotification("Cliente salvo com sucesso!", "success");
        } catch (err) {
            console.error(err);
            showNotification("Erro ao salvar cliente.", "error");
        }
    });

    clientTableBody?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const { action, id } = btn.dataset;
        if (!id) return;

        if (action === "edit-client") openEditClientModal(id);
        if (action === "toggle-status") toggleClientStatus(id);
        if (action === "pay-client") openPaymentModalForClient(id);
        if (action === "delete-client") deleteClient(id);
    });

    async function openEditClientModal(id) {
        const client = (state.allClients || []).find((c) => c.id === id);
        if (!client) return;

        mainModal.show({
            title: "Editar cliente",
            body: `
        <div class="form-grid">
          <div class="field">
            <label>Nome</label>
            <input id="editClientName" value="${client.name || ""}" />
          </div>
          <div class="field">
            <label>Telefone</label>
            <input id="editClientPhone" value="${client.phone || ""}" />
          </div>
          <div class="field">
            <label>Tipo</label>
            <select id="editClientType">
              <option value="cliente" ${client.type === "cliente" ? "selected" : ""}>Cliente comum</option>
              <option value="plano_jc" ${client.type === "plano_jc" ? "selected" : ""}>Plano RA</option>
            </select>
          </div>
          <div class="field">
            <label>Valor plano (R$)</label>
            <input id="editClientValue" type="number" step="0.01" value="${client.value || 0}" />
          </div>
          <div class="field">
            <label>Dia do pagamento</label>
            <input id="editClientPayDay" type="number" min="1" max="31" value="${client.payDay || ""}" />
          </div>
          <div class="field">
            <label>Status</label>
            <select id="editClientStatus">
              <option value="">—</option>
              <option value="ativo" ${(client.status || "ativo") === "ativo" ? "selected" : ""}>Ativo</option>
              <option value="pausado" ${client.status === "pausado" ? "selected" : ""}>Pausado</option>
            </select>
          </div>
        </div>
      `,
            buttons: [
                { text: "Cancelar", class: "btn-light" },
                {
                    text: "Salvar",
                    class: "btn-edit",
                    onClick: async () => {
                        await waitForAuth();
                        const name = $("#editClientName").value.trim();
                        if (!name) {
                            showNotification("Nome é obrigatório.", "error");
                            return false;
                        }
                        const type = $("#editClientType").value;
                        const phone = $("#editClientPhone").value.trim();
                        const value = Number($("#editClientValue").value || 0);
                        const payDay = Number($("#editClientPayDay").value || 0) || null;
                        const status = $("#editClientStatus").value || null;

                        const isPlan = type === "plano_jc";

                        try {
                            await updateDoc(doc(db, "raclub_clients", id), {
                                name,
                                phone,
                                type,
                                value: isPlan ? value : 0,
                                payDay: isPlan ? payDay : null,
                                status: isPlan ? status || "ativo" : null,

                                // compat antigo:
                                nome: name,
                                telefone: phone,
                                valorMensal: isPlan ? value : 0,
                                diaPagamento: isPlan ? payDay : null,
                                situacao: isPlan ? (status || "ativo") : null,
                                plano: isPlan ? "ra_club" : "cliente",
                            });
                            showNotification("Cliente atualizado!", "success");
                        } catch (err) {
                            console.error(err);
                            showNotification("Erro ao atualizar cliente.", "error");
                        }
                    },
                },
            ],
        });
    }

    async function toggleClientStatus(id) {
        const client = (state.allClients || []).find((c) => c.id === id);
        if (!client) return;

        const curr = client.status || "ativo";
        const next = curr === "ativo" ? "pausado" : "ativo";

        try {
            await updateDoc(doc(db, "raclub_clients", id), { status: next, situacao: next });
            showNotification("Status atualizado!", "success");
        } catch (err) {
            console.error(err);
            showNotification("Erro ao atualizar status.", "error");
        }
    }

    async function deleteClient(id) {
        const client = (state.allClients || []).find((c) => c.id === id);
        if (!client) return;

        mainModal.show({
            title: "Remover cliente",
            body: `<p>Tem certeza que deseja remover <strong>${client.name}</strong>? Essa ação não pode ser desfeita.</p>`,
            buttons: [
                { text: "Cancelar", class: "btn-light" },
                {
                    text: "Remover",
                    class: "btn-del",
                    onClick: async () => {
                        await waitForAuth();
                        try {
                            await deleteDoc(doc(db, "raclub_clients", id));
                            showNotification("Cliente removido.", "success");
                        } catch (err) {
                            console.error(err);
                            showNotification("Erro ao remover cliente.", "error");
                        }
                    },
                },
            ],
        });
    }

    async function openPaymentModalForClient(id) {
        const client = (state.allClients || []).find((c) => c.id === id);
        if (!client) return;

        const valueDefault = client.type === "plano_jc" ? Number(client.value || 0) : 0;

        mainModal.show({
            title: "Registrar pagamento",
            body: `
        <div class="form-grid">
          <p>Cliente: <strong>${client.name}</strong></p>
          <div class="field">
            <label>Valor</label>
            <input id="payValue" type="number" step="0.01" value="${valueDefault}" />
          </div>
        </div>
      `,
            buttons: [
                { text: "Cancelar", class: "btn-light" },
                {
                    text: "Registrar",
                    class: "btn-edit",
                    onClick: async () => {
                        await waitForAuth();
                        const v = Number($("#payValue").value || 0);
                        if (!v) {
                            showNotification("Informe um valor válido.", "error");
                            return false;
                        }
                        try {
                            await addDoc(collection(db, "raclub_payments"), {
                                clientId: client.id,
                                clientName: client.name || "",
                                value: v,
                                date: serverTimestamp(),

                                // compat antigo:
                                nomeCliente: client.name || "",
                                valor: v,
                                dataPagamento: serverTimestamp(),
                            });
                            showNotification("Pagamento registrado!", "success");
                        } catch (err) {
                            console.error(err);
                            showNotification("Erro ao registrar pagamento.", "error");
                        }
                    },
                },
            ],
        });
    }

    function renderPayments(payments) {
        if (!paymentsTableBody) return;

        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthly = payments.filter((p) => {
            const ts = p.date || p.dataPagamento || p.createdAt;
            const d = ts?.toDate ? ts.toDate() : null;
            if (!d) return false;
            return d >= firstOfMonth;
        });

        if (!monthly.length) {
            paymentsTableBody.innerHTML = `<tr><td colspan="4" class="loading-row">Nenhum pagamento este mês.</td></tr>`;
            if (monthlyTotalSpan) monthlyTotalSpan.textContent = formatCurrency(0);
            return;
        }

        paymentsTableBody.innerHTML = monthly
            .map((p) => {
                const ts = p.date || p.dataPagamento || p.createdAt;
                const d = ts?.toDate ? ts.toDate() : new Date();
                const nome = p.clientName || p.nomeCliente || p.nome || "—";
                const valor = p.value ?? p.valor ?? 0;

                return `
          <tr>
            <td data-label="Data">${formatDate(d)}</td>
            <td data-label="Cliente">${nome}</td>
            <td data-label="Valor">${formatCurrency(valor)}</td>
            <td data-label="Ações">
              <button class="btn btn-sm btn-del" data-payment-id="${p.id}">
                <i class="bx bx-trash"></i>
              </button>
            </td>
          </tr>
        `;
            })
            .join("");

        const total = monthly.reduce((sum, p) => sum + (Number(p.value ?? p.valor) || 0), 0);
        if (monthlyTotalSpan) monthlyTotalSpan.textContent = formatCurrency(total);
    }

    paymentsTableBody?.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-payment-id]");
        if (!btn) return;
        const id = btn.dataset.paymentId;

        mainModal.show({
            title: "Remover pagamento",
            body: "<p>Deseja remover este registro?</p>",
            buttons: [
                { text: "Cancelar", class: "btn-light" },
                {
                    text: "Confirmar",
                    class: "btn-del",
                    onClick: async () => {
                        await waitForAuth();
                        try {
                            await deleteDoc(doc(db, "raclub_payments", id));
                            showNotification("Pagamento removido!", "success");
                        } catch (err) {
                            console.error(err);
                            showNotification("Erro ao remover pagamento.", "error");
                        }
                    },
                },
            ],
        });
    });

    // listeners
    (async () => {
        await waitForAuth();

        onSnapshot(
            collection(db, "raclub_clients"),
            (snap) => {
                state.allClients = snap.docs.map((d) => mapOldClientDoc(d.id, d.data() || {}));
                state.allClients.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                applyClientFilters();
                updateClientKPIs();
            },
            (error) => console.error("Erro listener clientes:", error)
        );

        onSnapshot(
            query(collection(db, "raclub_payments"), orderBy("date", "desc")),
            (snap) => {
                const payments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                renderPayments(payments);
            },
            (error) => console.error("Erro listener pagamentos:", error)
        );

        togglePlanFields();
        applyClientFilters();
        updateClientKPIs();
    })();
}
