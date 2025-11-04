(function(){
  if (typeof window === 'undefined') return;
  const root = window.dhAdminDashboard = window.dhAdminDashboard || {};

  root.createTeamCardModule = function createTeamCardModule(context){
    const initial = context || {};
    let teamDetails = initial.teamDetails || {};
    let syntheticCheck = (typeof initial.isSyntheticId === 'function') ? initial.isSyntheticId : (()=> false);

    function setIsSyntheticChecker(fn){
      if (typeof fn === 'function'){
        syntheticCheck = fn;
      }
    }

    function updateState(next){
      if (next && next.teamDetails){
        teamDetails = next.teamDetails;
      }
    }

    function formatMemberName(member){
      if (!member || typeof member !== 'object') return '';
      const display = (member.display_name || '').trim();
      if (display) return display;
      const first = (member.first_name || '').trim();
      const last = (member.last_name || '').trim();
      const combined = [first, last].filter(Boolean).join(' ');
      if (combined) return combined;
      const email = (member.email || '').trim();
      if (email){
        const localPart = email.split('@')[0];
        return localPart || email;
      }
      return '';
    }

    function computeTeamLabel(team, fallbackId){
      if (!team) return fallbackId != null ? `Team ${fallbackId}` : 'Team';
      const members = Array.isArray(team.members) ? team.members : [];
      const names = members.map((member)=> formatMemberName(member)).filter(Boolean);
      if (names.length) return names.join(', ');
      if (team.name && typeof team.name === 'string' && team.name.trim()) return team.name.trim();
      return fallbackId != null ? `Team ${fallbackId}` : 'Team';
    }

    function buildMemberPreview(member, team, fallbackLabel, teamId){
      const lines = [];
      const name = formatMemberName(member) || fallbackLabel || `Team ${teamId || ''}`;
      lines.push(name);
      const email = (member && member.email) ? member.email : null;
      if (email) lines.push(`Email: ${email}`);
      if (member && member.phone) lines.push(`Phone: ${member.phone}`);
      if (team){
        if (team.team_diet) lines.push(`Diet: ${team.team_diet}`);
        if (team.course_preference) lines.push(`Preference: ${team.course_preference}`);
        if (team.can_host_main != null) lines.push(`Can host main: ${team.can_host_main ? 'yes' : 'no'}`);
      }
      return lines.join('\n');
    }

    function buildTeamPreview(team, fallbackLabel, teamId){
      const lines = [];
      const label = fallbackLabel || computeTeamLabel(team, teamId);
      lines.push(label);
      if (team){
        if (team.team_diet) lines.push(`Diet: ${team.team_diet}`);
        if (team.course_preference) lines.push(`Preference: ${team.course_preference}`);
        if (team.can_host_main != null) lines.push(`Can host main: ${team.can_host_main ? 'yes' : 'no'}`);
        if (Array.isArray(team.host_allergies) && team.host_allergies.length){
          lines.push(`Host allergies: ${team.host_allergies.join(', ')}`);
        }
      }
      return lines.join('\n');
    }

    function renderTeamCard(tid){
      const det = teamDetails[tid] || {};
      const pref = det.course_preference ? `pref: ${det.course_preference}` : '';
      const diet = det.team_diet ? `diet: ${det.team_diet}` : '';
      const canMain = det.can_host_main ? 'main✔' : '';
      const pay = det.payment || {};
      const payStatus = pay.status;
      let colorClasses = 'bg-white border border-[#e5e7eb]';
      let dotClass = null;
      let dotTitle = '';
      if (payStatus === 'unpaid'){
        colorClasses = 'bg-[#fef2f2] border border-[#fecaca]';
        dotClass = 'bg-[#dc2626]';
        dotTitle = 'Unpaid';
      } else if (payStatus === 'partial'){
        colorClasses = 'bg-[#fffbeb] border border-[#fde68a]';
        dotClass = 'bg-[#f59e0b]';
        dotTitle = 'Partial payment';
      } else if (payStatus === 'paid'){
        colorClasses = 'bg-[#f0fdf4] border border-[#bbf7d0]';
        dotClass = 'bg-[#16a34a]';
        dotTitle = 'Paid';
      }

      const el = document.createElement('div');
      el.className = `team-card ${colorClasses} rounded-lg p-2 text-xs cursor-move shadow-sm flex items-start justify-between gap-2 transition-colors duration-150`;
      el.draggable = true;
      el.dataset.teamId = tid;

      const infoWrap = document.createElement('div');
      infoWrap.className = 'min-w-0 flex-1';

      const nameRow = document.createElement('div');
      nameRow.className = 'flex items-center gap-1 font-semibold text-sm flex-wrap';

      const synthetic = syntheticCheck && syntheticCheck(tid);
      if (synthetic){
        const badge = document.createElement('span');
        badge.className = 'synthetic-indicator';
        badge.textContent = '✳';
        badge.title = 'Synthetic team (editable)';
        nameRow.appendChild(badge);
      }

      const members = Array.isArray(det.members) ? det.members : [];
      if (members.length){
        members.forEach((member, idx)=>{
          const label = formatMemberName(member) || `Member ${idx+1}`;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'team-member-btn truncate text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2563eb]';
          btn.dataset.teamId = tid;
          btn.dataset.memberIndex = String(idx);
          btn.textContent = label;
          btn.style.background = 'transparent';
          btn.style.border = 'none';
          btn.style.padding = '0';
          btn.style.margin = '0';
          btn.style.cursor = 'pointer';
          const email = (member && member.email) ? member.email : '';
          if (email) btn.dataset.email = email;
          btn.title = buildMemberPreview(member, det, label, tid);
          nameRow.appendChild(btn);
          if (idx < members.length - 1){
            const comma = document.createElement('span');
            comma.textContent = ',';
            comma.className = 'text-[#4a5568]';
            nameRow.appendChild(comma);
          }
        });
      } else {
        const label = computeTeamLabel(det, tid);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'team-name-btn truncate text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2563eb]';
        btn.dataset.teamId = tid;
        btn.textContent = label;
        btn.style.background = 'transparent';
        btn.style.border = 'none';
        btn.style.padding = '0';
        btn.style.margin = '0';
        btn.style.cursor = 'pointer';
        btn.title = buildTeamPreview(det, label, tid);
        const primaryEmail = members.length ? (members.find((m)=> (m.email || '').trim()) || {}).email : null;
        if (primaryEmail) btn.dataset.email = primaryEmail;
        nameRow.appendChild(btn);
      }

      if (dotClass){
        const dotEl = document.createElement('span');
        dotEl.className = `inline-block w-2.5 h-2.5 rounded-full ${dotClass}`;
        if (dotTitle) dotEl.title = dotTitle;
        nameRow.appendChild(dotEl);
      }

      infoWrap.appendChild(nameRow);

      const meta = [pref, diet, canMain].filter(Boolean).join(' · ');
      if (meta){
        const metaEl = document.createElement('div');
        metaEl.className = 'text-[#4a5568] truncate';
        metaEl.textContent = meta;
        infoWrap.appendChild(metaEl);
      }

      if (payStatus && payStatus !== 'n/a'){
        const statusEl = document.createElement('div');
        statusEl.className = `mt-0.5 text-[10px] uppercase tracking-wide ${payStatus === 'unpaid' ? 'text-[#b91c1c]' : 'text-[#92400e]'}`;
        statusEl.textContent = payStatus;
        infoWrap.appendChild(statusEl);
      }

      const allergyList = Array.isArray(det.allergies) ? det.allergies.map((v)=> (v == null ? '' : String(v).trim())).filter(Boolean) : [];
      if (allergyList.length){
        const allergyEl = document.createElement('div');
        allergyEl.className = 'mt-1 text-[11px] text-[#0f172a] truncate';
        allergyEl.textContent = `allergies: ${allergyList.join(', ')}`;
        infoWrap.appendChild(allergyEl);
      }

      const mapBtn = document.createElement('button');
      mapBtn.className = 'team-map-btn text-[13px]';
      mapBtn.title = 'View path';
      mapBtn.dataset.teamId = tid;
      mapBtn.textContent = '🗺️';
      el.appendChild(infoWrap);
      el.appendChild(mapBtn);
      return el;
    }

    return {
      updateState,
      setIsSyntheticChecker,
      formatMemberName,
      computeTeamLabel,
      buildMemberPreview,
      buildTeamPreview,
      renderTeamCard,
    };
  };
})();
