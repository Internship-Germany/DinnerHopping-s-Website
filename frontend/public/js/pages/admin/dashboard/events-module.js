(function(){
  if (typeof window === 'undefined') return;
  const root = window.dhAdminDashboard = window.dhAdminDashboard || {};

  root.createEventsModule = function createEventsModule(context){
    const {
      $,
      toast,
    toDateInputValue,
    toDateTimeLocalInputValue,
    setEditingId = ()=>{},
    } = context || {};

    if (typeof $ !== 'function'){
      return null;
    }

    function toTimeInputValue(value){
      const v = value;
      if (!v) return '';
      if (typeof v === 'string'){
        const txt = v.trim();
        if (!txt) return '';
        if (/^\d{2}:\d{2}$/.test(txt)) return txt;
        if (/^\d{1}:\d{2}$/.test(txt)){
          const [hh, mm] = txt.split(':');
          return `${hh.padStart(2, '0')}:${mm}`;
        }
        if (/^\d{1,2}h\d{1,2}$/.test(txt)){
          const parts = txt.split('h');
          if (parts.length === 2){
            const hh = parts[0].padStart(2, '0');
            const mm = parts[1].padStart(2, '0');
            return `${hh}:${mm}`;
          }
        }
        if (/^[T]?\d{2}:\d{2}(:\d{2})?$/.test(txt)){
          const hhmm = txt.startsWith('T') ? txt.slice(1) : txt;
          const [hh, mm] = hhmm.split(':');
          return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
        }
        const normalized = txt.startsWith('T') ? `1970-01-01${txt}` : (txt.includes('T') ? txt : `1970-01-01T${txt}`);
        const parsed = Date.parse(normalized);
        if (!Number.isNaN(parsed)){
          const d = new Date(parsed);
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          return `${hh}:${mm}`;
        }
        return '';
      }
      if (v instanceof Date){
        const hh = String(v.getHours()).padStart(2, '0');
        const mm = String(v.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      }
      if (typeof v === 'number' && Number.isFinite(v)){
        const totalMinutes = Math.floor(v / 60);
        const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
        const mm = String(totalMinutes % 60).padStart(2, '0');
        return `${hh}:${mm}`;
      }
      return '';
    }

    function setForm(ev){
      const form = $('#create-event-form');
      if (!form) return;
      const titleInput = form.querySelector('input[name="title"]');
      if (titleInput) titleInput.value = ev.title || '';
      const cityInput = form.querySelector('input[name="city"]');
      if (cityInput) cityInput.value = ev.city || '';
      const dateInput = form.querySelector('input[name="date"]');
      if (dateInput) dateInput.value = toDateInputValue ? toDateInputValue(ev.date) : (ev.date || '');
      const startInput = form.querySelector('input[name="start_at"]');
      if (startInput) startInput.value = toTimeInputValue(ev.start_at);
      const regDeadline = form.querySelector('input[name="registration_deadline"]');
      if (regDeadline) regDeadline.value = toDateTimeLocalInputValue ? toDateTimeLocalInputValue(ev.registration_deadline) : (ev.registration_deadline || '');
      const appetizerInput = form.querySelector('input[name="appetizer_time"]');
      if (appetizerInput) appetizerInput.value = ev.appetizer_time || '';
      const mainInput = form.querySelector('input[name="main_time"]');
      if (mainInput) mainInput.value = ev.main_time || '';
      const dessertInput = form.querySelector('input[name="dessert_time"]');
      if (dessertInput) dessertInput.value = ev.dessert_time || '';
      const paymentDeadline = form.querySelector('input[name="payment_deadline"]');
      if (paymentDeadline) paymentDeadline.value = toDateTimeLocalInputValue ? toDateTimeLocalInputValue(ev.payment_deadline) : (ev.payment_deadline || '');
      const capacityInput = form.querySelector('input[name="capacity"]');
      if (capacityInput) capacityInput.value = ev.capacity != null ? String(ev.capacity) : '';
      const feeInput = form.querySelector('input[name="fee_cents"]');
      if (feeInput) feeInput.value = ev.fee_cents != null ? String(ev.fee_cents) : '';
      const zipInput = form.querySelector('input[name="valid_zip_codes"]');
      if (zipInput) zipInput.value = Array.isArray(ev.valid_zip_codes) ? ev.valid_zip_codes.join(', ') : '';
      const afterPartyInput = form.querySelector('input[name="after_party_address"]');
      if (afterPartyInput){
        const afterPartyLocation = ev.after_party_location || ev.location || null;
        const afterPartyAddress = afterPartyLocation && (afterPartyLocation.address_public || afterPartyLocation.address || '');
        afterPartyInput.value = afterPartyAddress || '';
      }
      const extraInfo = form.querySelector('textarea[name="extra_info"]');
      if (extraInfo) extraInfo.value = ev.extra_info || '';
      const refundInput = form.querySelector('input[name="refund_on_cancellation"]');
      if (refundInput) refundInput.checked = !!ev.refund_on_cancellation;
      const chatInput = form.querySelector('input[name="chat_enabled"]');
      if (chatInput) chatInput.checked = !!ev.chat_enabled;
      document.dispatchEvent(new CustomEvent('dh:event_form_loaded'));
    }

    function enterEditMode(ev){
      if (!ev || ev.id == null){
        if (typeof toast === 'function'){
          toast('Unable to load this event.', { type: 'error' });
        }
        return;
      }
      setEditingId(ev.id);
      setForm(ev);
      const title = document.getElementById('create-form-title');
      if (title){
        title.textContent = ev.title ? `Edit Event – ${ev.title}` : 'Edit Event';
      }
      const submit = document.getElementById('btn-submit-event');
      if (submit){
        submit.textContent = 'Update Event';
      }
      const cancel = document.getElementById('btn-cancel-edit');
      if (cancel){
        cancel.classList.remove('hidden');
        cancel.disabled = false;
      }
      const msg = document.getElementById('create-event-msg');
      if (msg) msg.textContent = 'Editing existing event. Remember to save changes.';
      const form = document.getElementById('create-event-form');
      if (form){
        form.dataset.mode = 'edit';
        try {
          form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {
          /* ignore browsers that block scrollIntoView */
        }
      }
    }

    function enterCreateMode(){
      setEditingId(null);
      const form = document.getElementById('create-event-form');
      if (form){
        form.reset();
        delete form.dataset.mode;
      }
      const title = document.getElementById('create-form-title');
      if (title) title.textContent = 'Create New Event';
      const submit = document.getElementById('btn-submit-event');
      if (submit) submit.textContent = 'Create Event (Draft)';
      const cancel = document.getElementById('btn-cancel-edit');
      if (cancel){
        cancel.classList.add('hidden');
        cancel.disabled = false;
      }
      const msg = document.getElementById('create-event-msg');
      if (msg) msg.textContent = '';
      document.dispatchEvent(new CustomEvent('dh:event_form_loaded'));
    }

    function readForm(){
      const form = document.getElementById('create-event-form');
      if (!form) return {};
      const fd = new FormData(form);
      const payload = {
        title: fd.get('title'),
        date: fd.get('date') || null,
        start_at: fd.get('start_at') || null,
        city: fd.get('city') || null,
        capacity: fd.get('capacity') ? Number(fd.get('capacity')) : null,
        fee_cents: fd.get('fee_cents') ? Number(fd.get('fee_cents')) : 0,
        registration_deadline: fd.get('registration_deadline') || null,
        payment_deadline: fd.get('payment_deadline') || null,
        extra_info: fd.get('extra_info') || null,
        refund_on_cancellation: fd.get('refund_on_cancellation') ? true : false,
        chat_enabled: fd.get('chat_enabled') ? true : false,
        valid_zip_codes: (fd.get('valid_zip_codes') || '').split(',').map((s)=> s.trim()).filter(Boolean),
      };
      const appetizer = (fd.get('appetizer_time') || '').trim();
      if (appetizer) payload.appetizer_time = appetizer;
      const main = (fd.get('main_time') || '').trim();
      if (main) payload.main_time = main;
      const dessert = (fd.get('dessert_time') || '').trim();
      if (dessert) payload.dessert_time = dessert;
      const afterPartyAddress = (fd.get('after_party_address') || '').trim();
      if (afterPartyAddress){
        payload.after_party_location = { address: afterPartyAddress };
      }
      return payload;
    }

    function updateState(next){
      if (next && Object.prototype.hasOwnProperty.call(next, 'editingId')){
        setEditingId(next.editingId);
      }
    }

    return {
      updateState,
      enterEditMode,
      enterCreateMode,
      readForm,
      toTimeInputValue,
    };
  };
})();
