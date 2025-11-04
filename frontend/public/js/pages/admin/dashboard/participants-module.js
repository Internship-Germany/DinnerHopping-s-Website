(function(){
  if (typeof window === 'undefined') return;
  const root = window.dhAdminDashboard = window.dhAdminDashboard || {};

  root.createParticipantsModule = function createParticipantsModule(context){
    const {
      apiFetch,
      toast,
      fmtDate,
      escapeHtml,
      $,
    } = context || {};

    const selectOne = typeof $ === 'function' ? $ : (selector)=> document.querySelector(selector);
    const safeFmtDate = typeof fmtDate === 'function' ? fmtDate : (value)=> value || '';
    const safeEscapeHtml = typeof escapeHtml === 'function' ? escapeHtml : (value)=> (value == null ? '' : String(value));

    const state = {
      eventId: null,
      rows: [],
      summary: { total: 0, by_payment_status: {}, by_registration_status: {} },
      loading: false,
      visible: true,
      sortKey: 'last_name',
      sortDir: 'asc',
      search: '',
    };
    let initialized = false;
    const selectors = {
      section: '#participants-section',
      select: '#participants-event-select',
      search: '#participants-search',
      refresh: '#participants-refresh',
      toggle: '#participants-toggle',
      loading: '#participants-loading',
      wrapper: '#participants-table-wrapper',
      tbody: '#participants-tbody',
      empty: '#participants-empty',
      count: '#participants-count',
      summary: '#participants-summary',
      headers: '#participants-section th.sortable',
    };
    const PAYMENT_LABELS = {
      paid: 'Paid',
      pending: 'Pending',
      pending_payment: 'Pending',
      covered_by_team: 'Paid by team',
      failed: 'Failed',
      not_applicable: 'N/A',
      unpaid: 'Unpaid',
      unknown: 'Unknown',
    };
    const PAYMENT_BADGES = {
      paid: 'bg-[#bbf7d0] text-[#166534]',
      pending: 'bg-[#fef3c7] text-[#92400e]',
      pending_payment: 'bg-[#fef3c7] text-[#92400e]',
      covered_by_team: 'bg-[#dbeafe] text-[#1d4ed8]',
      failed: 'bg-[#fee2e2] text-[#b91c1c]',
      not_applicable: 'bg-[#e2e8f0] text-[#334155]',
      unpaid: 'bg-[#e2e8f0] text-[#334155]',
      unknown: 'bg-[#e2e8f0] text-[#334155]',
    };
    const GENDER_LABELS = {
      female: 'Female',
      male: 'Male',
      non_binary: 'Non-binary',
      diverse: 'Diverse',
      other: 'Other',
      prefer_not_to_say: 'Prefer not to say',
    };
    const TEAM_ROLE_LABELS = {
      creator: 'Captain',
      partner: 'Partner',
    };
    const REGISTRATION_LABELS = {
      confirmed: 'Confirmed',
      pending: 'Pending',
      pending_payment: 'Awaiting payment',
      invited: 'Invited',
      paid: 'Paid',
      refunded: 'Refunded',
      cancelled_by_user: 'Cancelled (participant)',
      cancelled_admin: 'Cancelled (admin)',
      expired: 'Expired',
      draft: 'Draft',
    };

    function init(){
      if (initialized) return;
      const select = selectOne(selectors.select);
      if (select){
        select.addEventListener('change', (event)=>{
          state.eventId = event.target.value || null;
          fetchAndRender(true);
        });
      }
      const searchInput = selectOne(selectors.search);
      if (searchInput){
        searchInput.addEventListener('input', (event)=>{
          state.search = (event.target.value || '').trim();
          render();
        });
      }
      const refreshBtn = selectOne(selectors.refresh);
      if (refreshBtn){
        refreshBtn.addEventListener('click', (event)=>{
          event.preventDefault();
          fetchAndRender(true);
        });
      }
      const toggleBtn = selectOne(selectors.toggle);
      if (toggleBtn){
        toggleBtn.addEventListener('click', (event)=>{
            event.preventDefault();
            state.visible = !state.visible;
            toggleBtn.textContent = state.visible ? 'Hide' : 'Show';
            render();
          });
      }
      const section = selectOne(selectors.section);
      if (section){
        const head = section.querySelector('thead');
        if (head){
          head.addEventListener('click', (event)=>{
            const th = event.target.closest('th.sortable');
            if (!th) return;
            const key = th.dataset.sort;
            if (!key) return;
            if (state.sortKey === key){
              state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
              state.sortKey = key;
              state.sortDir = 'asc';
            }
            render();
          });
        }
      }
      initialized = true;
    }

    function setLoading(active){
      const el = selectOne(selectors.loading);
      if (!el) return;
      if (active){
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }

    function sortValue(row, key){
      const value = row[key];
      if (key === 'updated_display' || key === 'updated_at' || key === 'created_at'){
        return value ? new Date(value).getTime() : null;
      }
      if (typeof value === 'string'){
        return value.toLowerCase();
      }
      if (value === null || value === undefined){
        return null;
      }
      return value;
    }

    function applyFilters(){
      const rows = state.rows.slice();
      const needle = state.search ? state.search.toLowerCase() : '';
      let filtered = rows;
      if (needle){
        filtered = rows.filter((row)=> row.search_blob.includes(needle));
      }
      filtered.sort((a, b)=>{
        const va = sortValue(a, state.sortKey);
        const vb = sortValue(b, state.sortKey);
        if (va === vb) return 0;
        if (va === null || va === undefined) return state.sortDir === 'asc' ? -1 : 1;
        if (vb === null || vb === undefined) return state.sortDir === 'asc' ? 1 : -1;
        if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
        return 0;
      });
      return filtered;
    }

    function formatPaymentStatus(status){
      if (!status) return PAYMENT_LABELS.unknown;
      return PAYMENT_LABELS[status] || status;
    }

    function paymentBadgeClass(status){
      if (!status) return PAYMENT_BADGES.unknown;
      return PAYMENT_BADGES[status] || PAYMENT_BADGES.unknown;
    }

    function formatGender(value){
      if (!value) return '';
      return GENDER_LABELS[value] || value;
    }

    function formatRegistrationStatus(status){
      if (!status) return '';
      return REGISTRATION_LABELS[status] || status;
    }

    function formatTeamRole(row){
      if (!row.team_id){
        return 'Solo';
      }
      if (!row.team_role){
        return '';
      }
      return TEAM_ROLE_LABELS[row.team_role] || row.team_role;
    }

    function updateSortHeaders(){
      const headers = document.querySelectorAll(selectors.headers);
      headers.forEach((th)=>{
        const key = th.dataset.sort;
        if (!key){
          th.removeAttribute('aria-sort');
          return;
        }
        if (key === state.sortKey){
          th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
        } else {
          th.setAttribute('aria-sort', 'none');
        }
      });
    }

    function updateCount(filteredLength, el){
      if (!el) return;
      const total = state.summary.total || state.rows.length;
      if (!total){
        el.textContent = '0 participant';
        return;
      }
      if (filteredLength === total){
        el.textContent = total === 1 ? '1 participant' : `${total} participants`;
      } else {
        el.textContent = `${filteredLength} / ${total} participants`;
      }
    }

    function updateSummary(el){
      if (!el) return;
      const entries = Object.entries(state.summary.by_payment_status || {});
      if (!entries.length){
        el.textContent = '';
        return;
      }
      const parts = entries.map(([status, count])=> `${formatPaymentStatus(status)} (${count})`);
  el.textContent = `Payments: ${parts.join(' · ')}`;
    }

    function renderRow(row){
      const lastName = safeEscapeHtml(row.last_name || '');
      const firstName = safeEscapeHtml(row.first_name || '');
      const email = safeEscapeHtml(row.email || '');
      const gender = safeEscapeHtml(formatGender(row.gender));
      const registration = safeEscapeHtml(formatRegistrationStatus(row.registration_status));
      const paymentLabel = safeEscapeHtml(formatPaymentStatus(row.payment_status));
      const paymentClass = paymentBadgeClass(row.payment_status);
      const teamName = row.team_name ? safeEscapeHtml(row.team_name) : (row.team_id ? '' : 'Solo');
      const teamRole = safeEscapeHtml(formatTeamRole(row));
      const updatedRaw = row.updated_display || row.updated_at || row.created_at;
      const updated = updatedRaw ? safeEscapeHtml(safeFmtDate(updatedRaw)) : '';
      return `\
<tr class="border-b border-[#f0f4f7] last:border-b-0">\
  <td class="p-2">${lastName}</td>\
  <td class="p-2">${firstName}</td>\
  <td class="p-2 font-medium text-[#1d4ed8]">${email}</td>\
  <td class="p-2">${gender}</td>\
  <td class="p-2">${registration}</td>\
  <td class="p-2"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${paymentClass}">${paymentLabel}</span></td>\
  <td class="p-2">${teamName || '—'}</td>\
  <td class="p-2">${teamRole}</td>\
  <td class="p-2">${updated}</td>\
</tr>`;
    }

    function render(){
      const wrapper = selectOne(selectors.wrapper);
      const tbody = selectOne(selectors.tbody);
      const empty = selectOne(selectors.empty);
      const countEl = selectOne(selectors.count);
      const summaryEl = selectOne(selectors.summary);
      if (!tbody) return;
      const filtered = applyFilters();
      if (state.visible){
        wrapper && wrapper.classList.remove('hidden');
        summaryEl && summaryEl.classList.remove('hidden');
      } else {
        wrapper && wrapper.classList.add('hidden');
        summaryEl && summaryEl.classList.add('hidden');
      }
      if (!filtered.length){
        tbody.innerHTML = '';
        empty && empty.classList.remove('hidden');
      } else {
        empty && empty.classList.add('hidden');
        tbody.innerHTML = filtered.map(renderRow).join('');
      }
      updateCount(filtered.length, countEl);
      updateSummary(summaryEl);
      updateSortHeaders();
    }

    async function fetchAndRender(force){
      if (!state.eventId){
        state.rows = [];
        state.summary = { total: 0, by_payment_status: {}, by_registration_status: {} };
        render();
        return;
      }
      if (state.loading && !force){
        return;
      }
      if (typeof apiFetch !== 'function'){
        console.error('[DinnerHopping] participants-module: apiFetch not provided.');
        return;
      }
      state.loading = true;
      setLoading(true);
      try {
        const res = await apiFetch(`/admin/events/${state.eventId}/participants`);
        if (!res.ok){
          const text = await res.text().catch(()=> 'Error');
          throw new Error(text || 'Failed to load');
        }
        const data = await res.json().catch(()=> ({ participants: [], summary: { total: 0, by_payment_status: {}, by_registration_status: {} } }));
        const participants = Array.isArray(data.participants) ? data.participants : [];
        state.rows = participants.map((p)=>{
          const blob = [p.full_name, p.email, p.team_name, p.registration_status, p.payment_status]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return {
            ...p,
            updated_display: p.payment_updated_at || p.updated_at || p.created_at,
            search_blob: blob,
          };
        });
        state.summary = data.summary || { total: state.rows.length, by_payment_status: {}, by_registration_status: {} };
        if (!state.summary.total){
          state.summary.total = state.rows.length;
        }
        render();
      } catch (error){
        console.error('participants.fetch', error);
        if (toast){
          toast('Unable to load participants.', { type: 'error' });
        }
      } finally {
        state.loading = false;
        setLoading(false);
      }
    }

    async function onEventsRefreshed(events){
      init();
      const hasEvents = Array.isArray(events) && events.length > 0;
      const select = selectOne(selectors.select);
      const searchInput = selectOne(selectors.search);
      const toggleBtn = selectOne(selectors.toggle);
      const refreshBtn = selectOne(selectors.refresh);

      if (select){
        if (hasEvents){
          const options = events.map((ev)=>{
            const value = safeEscapeHtml(ev.id);
            const labelText = `${ev.title || 'Event'}${ev.date ? ` (${ev.date})` : ''}`;
            const label = safeEscapeHtml(labelText);
            return `<option value="${value}">${label}</option>`;
          }).join('');
          select.innerHTML = options;
          if (state.eventId && events.some((ev)=> ev.id === state.eventId)){
            select.value = state.eventId;
          } else {
            select.value = events[0].id;
            state.eventId = events[0].id;
          }
          select.disabled = false;
        } else {
            select.innerHTML = '<option value="">No events</option>';
          select.disabled = true;
          select.value = '';
          state.eventId = null;
        }
      }

      if (searchInput){
        searchInput.disabled = !hasEvents;
        if (!hasEvents){
          searchInput.value = '';
          state.search = '';
        }
      }

      if (toggleBtn){
        toggleBtn.disabled = !hasEvents;
        toggleBtn.textContent = state.visible ? 'Hide' : 'Show';
      }

      if (refreshBtn){
        refreshBtn.disabled = !hasEvents;
      }

      if (hasEvents){
        await fetchAndRender(true);
      } else {
        state.rows = [];
        state.summary = { total: 0, by_payment_status: {}, by_registration_status: {} };
        render();
      }
    }

    return {
      init,
      onEventsRefreshed,
      fetch: fetchAndRender,
    };
  };
})();
