(function(){
  function createMatchDetailsModule(options){
    options = options || {};
    const query = typeof options.$ === 'function' ? options.$ : ((selector)=> document.querySelector(selector));
    const ctx = {
      renderTeamCard: options.renderTeamCard || (()=> null),
      refreshSplitMemberStates: options.refreshSplitMemberStates || (()=>{}),
      ensureSyntheticStyles: options.ensureSyntheticStyles || (()=>{}),
      removeSyntheticManagementPanel: options.removeSyntheticManagementPanel || (()=>{}),
      updateSyntheticManagementPanel: options.updateSyntheticManagementPanel || (()=>{}),
      bindDnD: options.bindDnD || (()=>{}),
      bindDetailsControls: options.bindDetailsControls || (()=>{}),
      bindTeamMapButtons: options.bindTeamMapButtons || (()=>{}),
      bindTeamNameButtons: options.bindTeamNameButtons || (()=>{}),
      bindSyntheticTeamButtons: options.bindSyntheticTeamButtons || (()=>{}),
      fetchIssuesForDetails: options.fetchIssuesForDetails || (()=>{}),
      updateUnplacedTeamsPanels: options.updateUnplacedTeamsPanels || (()=>{}),
      getState: typeof options.getState === 'function' ? options.getState : (()=> ({})),
    };
    const PHASES = ['appetizer', 'main', 'dessert'];

    function updateState(patch){
      if (!patch || typeof patch !== 'object') return;
      Object.assign(ctx, patch);
    }

    function normalizeList(value){
      const arr = Array.isArray(value) ? value : [];
      const out = [];
      const seen = new Set();
      arr.forEach((item)=>{
        if (item == null) return;
        const str = String(item).trim();
        if (!str || seen.has(str)) return;
        seen.add(str);
        out.push(str);
      });
      return out;
    }

    function teamAllergiesFor(teamId, teamDetails){
      if (teamId == null) return [];
      const det = teamDetails[String(teamId)] || {};
      return normalizeList(det.allergies);
    }

    function hostFallbackAllergiesFor(teamId, teamDetails){
      if (teamId == null) return [];
      const det = teamDetails[String(teamId)] || {};
      const hostVals = normalizeList(det.host_allergies);
      if (hostVals.length) return hostVals;
      return normalizeList(det.allergies);
    }

    function groupsByPhase(){
      const state = ctx.getState() || {};
      const groups = Array.isArray(state.detailsGroups) ? state.detailsGroups : [];
      const by = { appetizer: [], main: [], dessert: [] };
      groups.forEach((group, index)=>{
        if (!group || !group.phase) return;
        const phase = group.phase;
        if (!by[phase]) by[phase] = [];
        by[phase].push({ ...group, _idx: index });
      });
      return by;
    }

    function extractSoloIdsFromSynthetic(syntheticId){
      const state = ctx.getState() || {};
      const teamDetails = state.teamDetails || {};
      const soloIds = [];
      if (!syntheticId || typeof syntheticId !== 'string') return soloIds;
      if (syntheticId.startsWith('pair:')){
        const emails = syntheticId.substring(5).split('+').filter(Boolean).map((email)=> email.toLowerCase());
        if (!emails.length) return soloIds;
        Object.keys(teamDetails).forEach((tid)=>{
          if (tid.startsWith('pair:') || tid.startsWith('split:')) return;
          const det = teamDetails[tid] || {};
          const members = Array.isArray(det.members) ? det.members : [];
          members.forEach((member)=>{
            const memberEmail = (member && member.email ? member.email : '').toLowerCase();
            if (!memberEmail) return;
            if (emails.some((email)=> email.includes(memberEmail) || memberEmail.includes(email))){
              soloIds.push(tid);
            }
          });
        });
        return soloIds;
      }
      if (syntheticId.startsWith('split:')){
        const email = syntheticId.substring(6).toLowerCase();
        if (!email) return soloIds;
        Object.keys(teamDetails).forEach((tid)=>{
          if (tid.startsWith('pair:') || tid.startsWith('split:')) return;
          const det = teamDetails[tid] || {};
          const members = Array.isArray(det.members) ? det.members : [];
          members.forEach((member)=>{
            const memberEmail = (member && member.email ? member.email : '').toLowerCase();
            if (!memberEmail) return;
            if (email.includes(memberEmail) || memberEmail.includes(email)){
              soloIds.push(tid);
            }
          });
        });
      }
      return soloIds;
    }

    function calculateLocalMetrics(){
      const state = ctx.getState() || {};
      const detailsGroups = Array.isArray(state.detailsGroups) ? state.detailsGroups : [];
      const teamDetails = state.teamDetails || {};
      const syntheticDrafts = state.syntheticDrafts || {};
      const singlesDraft = syntheticDrafts.singles || {};

      const metrics = {
        total_participant_count: 0,
        assigned_participant_count: 0,
        phase_summary: {
          appetizer: { assigned_participants: 0, expected_participants: 0, missing_participants: 0, assigned_units: 0, expected_units: 0, group_count: 0 },
          main: { assigned_participants: 0, expected_participants: 0, missing_participants: 0, assigned_units: 0, expected_units: 0, group_count: 0 },
          dessert: { assigned_participants: 0, expected_participants: 0, missing_participants: 0, assigned_units: 0, expected_units: 0, group_count: 0 },
        },
      };

      const hiddenSingles = new Set(
        Object.entries(singlesDraft)
          .filter(([, info])=>{
            if (!info || typeof info !== 'object') return false;
            if (info.originalTeamSplit === true) return true;
            if (info.status && info.status !== 'available') return true;
            return false;
          })
          .map(([teamId])=> String(teamId))
      );

      const allTeamIds = Object.keys(teamDetails)
        .filter((tid)=> !tid.startsWith('pair:') && !tid.startsWith('split:'))
        .filter((tid)=> !hiddenSingles.has(String(tid)));

      const readTeamSize = (details)=>{
        if (!details || typeof details !== 'object') return 1;
        const explicit = Number(details.size);
        if (Number.isFinite(explicit) && explicit > 0) return explicit;
        const members = Array.isArray(details.members) ? details.members.filter(Boolean) : [];
        if (members.length) return members.length;
        return 1;
      };

      let totalParticipants = 0;
      let totalUnits = 0;
      allTeamIds.forEach((tid)=>{
        const det = teamDetails[tid] || {};
        totalParticipants += readTeamSize(det);
        totalUnits += 1;
      });
      metrics.total_participant_count = totalParticipants;

      PHASES.forEach((phase)=>{
        metrics.phase_summary[phase].expected_participants = totalParticipants;
        metrics.phase_summary[phase].expected_units = totalUnits;
      });

      detailsGroups.forEach((group)=>{
        const phase = group && group.phase;
        if (!phase || !metrics.phase_summary[phase]) return;
        metrics.phase_summary[phase].group_count += 1;

        if (group.host_team_id){
          const hostId = String(group.host_team_id);
          const det = teamDetails[hostId] || {};
          metrics.phase_summary[phase].assigned_participants += readTeamSize(det);
        }
        (group.guest_team_ids || []).forEach((tid)=>{
          const guestId = String(tid);
          const det = teamDetails[guestId] || {};
          metrics.phase_summary[phase].assigned_participants += readTeamSize(det);
        });
      });

      PHASES.forEach((phase)=>{
        const soloTeams = new Set();
        detailsGroups.forEach((group)=>{
          if (!group || group.phase !== phase) return;
          if (group.host_team_id){
            const hostId = String(group.host_team_id);
            if (hostId.startsWith('pair:') || hostId.startsWith('split:')){
              extractSoloIdsFromSynthetic(hostId).forEach((soloId)=> soloTeams.add(soloId));
            } else {
              soloTeams.add(hostId);
            }
          }
          (group.guest_team_ids || []).forEach((tid)=>{
            const guestId = String(tid);
            if (guestId.startsWith('pair:') || guestId.startsWith('split:')){
              extractSoloIdsFromSynthetic(guestId).forEach((soloId)=> soloTeams.add(soloId));
            } else {
              soloTeams.add(guestId);
            }
          });
        });
        metrics.phase_summary[phase].assigned_units = soloTeams.size;
      });

      PHASES.forEach((phase)=>{
        const summary = metrics.phase_summary[phase];
        summary.missing_participants = Math.max(0, summary.expected_participants - summary.assigned_participants);
      });

      const allPlacedSoloTeams = new Set();
      detailsGroups.forEach((group)=>{
        if (group && group.host_team_id){
          const hostId = String(group.host_team_id);
          if (hostId.startsWith('pair:') || hostId.startsWith('split:')){
            extractSoloIdsFromSynthetic(hostId).forEach((soloId)=> allPlacedSoloTeams.add(soloId));
          } else {
            allPlacedSoloTeams.add(hostId);
          }
        }
        (group && group.guest_team_ids || []).forEach((tid)=>{
          const guestId = String(tid);
          if (guestId.startsWith('pair:') || guestId.startsWith('split:')){
            extractSoloIdsFromSynthetic(guestId).forEach((soloId)=> allPlacedSoloTeams.add(soloId));
          } else {
            allPlacedSoloTeams.add(guestId);
          }
        });
      });

      let totalAssignedParticipants = 0;
      allPlacedSoloTeams.forEach((tid)=>{
        const det = teamDetails[tid] || {};
        totalAssignedParticipants += readTeamSize(det);
      });
      metrics.assigned_participant_count = totalAssignedParticipants;

      return metrics;
    }

    function renderMatchDetailsBoard(){
      const state = ctx.getState() || {};
      const detailsVersion = state.detailsVersion;
      const detailsMetrics = state.detailsMetrics || {};
      const unsaved = Boolean(state.unsaved);
      const teamDetails = state.teamDetails || {};

      const box = query('#match-details');
      const msg = query('#match-details-msg');
      if (!box || !msg) return;

      if (!detailsVersion){
        box.innerHTML = '';
        msg.textContent = 'No proposal loaded yet.';
        ctx.removeSyntheticManagementPanel();
        PHASES.forEach((phase)=>{
          const panel = document.getElementById(`unplaced-${phase}-panel`);
          if (!panel) return;
          panel.classList.add('hidden');
          panel.classList.remove('visible');
        });
        return;
      }

      ctx.refreshSplitMemberStates();

      const by = groupsByPhase();

      box.innerHTML = '';
      msg.textContent = unsaved ? 'You have unsaved changes. Metrics reflect the current preview and are not saved yet.' : '';

      const remoteMetrics = (detailsMetrics && typeof detailsMetrics === 'object') ? detailsMetrics : {};
      const localMetrics = calculateLocalMetrics();

      const totalParticipants = Number.isFinite(localMetrics.total_participant_count)
        ? localMetrics.total_participant_count
        : (Number.isFinite(remoteMetrics.total_participant_count) ? Number(remoteMetrics.total_participant_count) : null);

      const assignedParticipants = Number.isFinite(localMetrics.assigned_participant_count)
        ? localMetrics.assigned_participant_count
        : (Number.isFinite(remoteMetrics.assigned_participant_count) ? Number(remoteMetrics.assigned_participant_count) : null);

      const phaseSummaryRemote = remoteMetrics.phase_summary || {};
      const phaseSummaryLocal = localMetrics.phase_summary || {};
      const phaseSummary = PHASES.reduce((acc, phase)=>{
        acc[phase] = Object.assign({}, phaseSummaryRemote[phase] || {}, phaseSummaryLocal[phase] || {});
        return acc;
      }, {});

      const headline = document.createElement('div');
      headline.className = 'mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#1f2937]';

      const totalsBlock = document.createElement('div');
      totalsBlock.className = 'flex flex-wrap items-center gap-3';
      const totalLabel = document.createElement('div');
      totalLabel.className = 'flex items-baseline gap-2';
      totalLabel.innerHTML = `\n      <span class="text-xs uppercase tracking-wide text-[#64748b]">Total participants</span>\n      <span class="text-base font-semibold text-[#111827]">${totalParticipants != null ? totalParticipants : '—'}</span>`;
      totalsBlock.appendChild(totalLabel);
      const assignedLabel = document.createElement('div');
      assignedLabel.className = 'text-xs text-[#64748b]';
      assignedLabel.textContent = `Assigned: ${assignedParticipants != null ? assignedParticipants : '—'}`;
      totalsBlock.appendChild(assignedLabel);
      headline.appendChild(totalsBlock);

      if (unsaved){
        const notice = document.createElement('div');
        notice.className = 'text-xs text-[#b45309] font-medium';
        notice.textContent = 'Preview metrics include unsaved adjustments.';
        headline.appendChild(notice);
      }

      box.appendChild(headline);

      const summaryKeys = PHASES.filter((phase)=> Object.prototype.hasOwnProperty.call(phaseSummary, phase));
      if (summaryKeys.length){
        const summaryGrid = document.createElement('div');
        summaryGrid.className = 'mb-4 grid gap-3 md:grid-cols-3';
        summaryKeys.forEach((phase)=>{
          const info = phaseSummary[phase] || {};
          const assignedVal = Number(info.assigned_participants);
          const expectedVal = Number(info.expected_participants);
          const assignedPhase = Number.isFinite(assignedVal) ? assignedVal : null;
          const expectedPhase = Number.isFinite(expectedVal) ? expectedVal : null;
          const missingVal = Number(info.missing_participants);
          const missingPhase = Number.isFinite(missingVal)
            ? missingVal
            : (expectedPhase != null && assignedPhase != null ? Math.max(expectedPhase - assignedPhase, 0) : null);
          const groupsCountVal = Number(info.group_count);
          const groupsCount = Number.isFinite(groupsCountVal) ? groupsCountVal : null;
          const unitsAssignedVal = Number(info.assigned_units);
          const unitsAssigned = Number.isFinite(unitsAssignedVal) ? unitsAssignedVal : null;
          const expectedUnitsVal = Number(info.expected_units);
          const expectedUnits = Number.isFinite(expectedUnitsVal) ? expectedUnitsVal : null;

          const card = document.createElement('div');
          const hasGap = (missingPhase != null && missingPhase > 0) || (expectedPhase != null && assignedPhase != null && assignedPhase < expectedPhase);
          card.className = hasGap
            ? 'rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#7f1d1d]'
            : 'rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm text-[#1f2937]';

          const title = document.createElement('div');
          title.className = 'uppercase text-[11px] font-semibold text-[#475569] tracking-wide';
          title.textContent = phase;
          card.appendChild(title);

          const participantsLine = document.createElement('div');
          participantsLine.className = 'mt-1 text-lg font-semibold';
          const assignedLabelText = assignedPhase != null ? assignedPhase : '?';
          const expectedLabelText = expectedPhase != null ? expectedPhase : '?';
          participantsLine.textContent = `${assignedLabelText}/${expectedLabelText} participants`;
          card.appendChild(participantsLine);

          const unitLine = document.createElement('div');
          unitLine.className = 'text-xs text-[#4a5568]';
          const unitsAssignedLabel = unitsAssigned != null ? unitsAssigned : '?';
          const expectedUnitsLabel = expectedUnits != null ? expectedUnits : '?';
          const groupLabel = groupsCount != null ? groupsCount : '?';
          unitLine.textContent = `Units: ${unitsAssignedLabel}/${expectedUnitsLabel} · Groups: ${groupLabel}`;
          card.appendChild(unitLine);

          if (hasGap){
            const gapLine = document.createElement('div');
            gapLine.className = 'mt-1 text-xs font-medium';
            const missingParticipants = missingPhase != null ? Math.max(missingPhase, 0) : null;
            gapLine.textContent = missingParticipants != null
              ? `${missingParticipants} missing participant${missingParticipants > 1 ? 's' : ''}`
              : 'Participant coverage incomplete';
            card.appendChild(gapLine);
          }

          summaryGrid.appendChild(card);
        });
        box.appendChild(summaryGrid);
      }

      ctx.ensureSyntheticStyles();

      const legend = document.createElement('div');
      legend.className = 'flex flex-wrap gap-4 items-center text-[11px] bg-[#f8fafc] p-2 rounded-lg border border-[#e2e8f0]';
  legend.innerHTML = `\n      <div class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-[#dc2626]"></span> unpaid</div>\n      <div class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-[#16a34a]"></span> paid</div>\n      <div class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-[#9ca3af]"></span> n/a</div>\n      <div class="flex items-center gap-2"><span class="synthetic-indicator" style="width:16px;height:16px;font-size:10px;">✳</span> synthetic team (editable)</div>`;
      box.appendChild(legend);

      PHASES.forEach((phase)=>{
        const section = document.createElement('div');
        section.className = 'phase-section';
        section.id = `phase-section-${phase}`;
        section.innerHTML = `<div class="font-semibold mb-2 capitalize">${phase}</div>`;
        const wrap = document.createElement('div');
        wrap.className = 'grid grid-cols-1 md:grid-cols-3 gap-3';
        (by[phase] || []).forEach((group)=>{
          const card = document.createElement('div');
          card.className = 'p-3 rounded-xl border border-[#f0f4f7] bg-[#fcfcfd] group relative';

          const hostZone = document.createElement('div');
          hostZone.className = 'host-zone mb-2 p-2 rounded border border-dashed bg-white/40';
          hostZone.dataset.phase = phase;
          hostZone.dataset.groupIdx = String(group._idx);
          hostZone.dataset.role = 'host';
          hostZone.innerHTML = '<div class="text-xs text-[#4a5568] mb-1 flex items-center justify-between"><span>Host</span></div>';
          const hostTeamId = group.host_team_id != null ? String(group.host_team_id) : null;
          const hostAllergies = normalizeList(
            Array.isArray(group.host_allergies) && group.host_allergies.length
              ? group.host_allergies
              : hostFallbackAllergiesFor(hostTeamId, teamDetails)
          );
          const hostCard = hostTeamId ? ctx.renderTeamCard(hostTeamId) : null;
          if (hostCard){
            hostCard.dataset.phase = phase;
            hostCard.dataset.groupIdx = String(group._idx);
            hostCard.dataset.role = 'host';
            hostZone.appendChild(hostCard);
          }

          const addr = group.host_address_public || group.host_address;
          const addrEl = document.createElement('div');
          addrEl.className = 'text-[11px] text-[#4a5568] mt-1 truncate';
          addrEl.textContent = `Host address: ${addr ? addr : '—'}`;
          hostZone.appendChild(addrEl);

          if (hostAllergies.length){
            const allergyEl = document.createElement('div');
            allergyEl.className = 'text-[11px] text-[#334155] mt-1 truncate';
            allergyEl.textContent = `Host allergies: ${hostAllergies.join(', ')}`;
            hostZone.appendChild(allergyEl);
          }
          card.appendChild(hostZone);

          const guestZone = document.createElement('div');
          guestZone.className = 'guest-zone p-2 rounded border border-dashed min-h-10 bg-white/40';
          guestZone.dataset.phase = phase;
          guestZone.dataset.groupIdx = String(group._idx);
          guestZone.dataset.role = 'guest';
          guestZone.innerHTML = '<div class="text-xs text-[#4a5568] mb-1">Guests</div>';
          (group.guest_team_ids || []).forEach((tid)=>{
            const guestId = String(tid);
            const guestCard = ctx.renderTeamCard(guestId);
            if (guestCard){
              guestCard.dataset.phase = phase;
              guestCard.dataset.groupIdx = String(group._idx);
              guestCard.dataset.role = 'guest';
              guestZone.appendChild(guestCard);
            }
          });
          card.appendChild(guestZone);

          const guestUnionSet = new Set(normalizeList(group.guest_allergies_union));
          const guestMap = (group.guest_allergies && typeof group.guest_allergies === 'object') ? group.guest_allergies : {};
          Object.values(guestMap).forEach((list)=>{
            normalizeList(list).forEach((item)=> guestUnionSet.add(item));
          });
          (group.guest_team_ids || []).forEach((tid)=>{
            teamAllergiesFor(tid, teamDetails).forEach((item)=> guestUnionSet.add(item));
          });
          const guestUnion = Array.from(guestUnionSet);

          let uncovered = normalizeList(group.uncovered_allergies);
          if (!uncovered.length && guestUnion.length){
            const hostSet = new Set(hostAllergies);
            uncovered = guestUnion.filter((item)=> !hostSet.has(item));
          }

          const metLine = document.createElement('div');
          metLine.className = 'mt-2 text-xs text-[#4a5568]';
          const travel = group.travel_seconds != null ? `${(group.travel_seconds || 0).toFixed(0)}s` : '—';
          const score = group.score != null ? `${(group.score || 0).toFixed(1)}` : '—';
          const warns = (group.warnings && group.warnings.length) ? ` · warnings: ${group.warnings.join(', ')}` : '';
          metLine.textContent = `Travel: ${travel} · Score: ${score}${warns}`;
          card.appendChild(metLine);

          const allergySummary = document.createElement('div');
          allergySummary.className = 'mt-2 text-[11px] leading-snug text-[#4a5568]';
          if (guestUnion.length){
            const guestLine = document.createElement('div');
            guestLine.textContent = `Guest allergies: ${guestUnion.join(', ')}`;
            allergySummary.appendChild(guestLine);
          }
          if (uncovered.length){
            const uncoveredLine = document.createElement('div');
            uncoveredLine.className = 'mt-1 text-[#b91c1c]';
            uncoveredLine.textContent = `Uncovered: ${uncovered.join(', ')}`;
            allergySummary.appendChild(uncoveredLine);
            // Note: do NOT mark the entire group card as red for allergy-only issues.
            // Red highlighting is reserved for host_reuse warnings (handled below).
          } else if (guestUnion.length){
            const coveredLine = document.createElement('div');
            coveredLine.className = 'mt-1 text-[#16a34a]';
            coveredLine.textContent = 'Host covers listed allergies';
            allergySummary.appendChild(coveredLine);
          }
          if (allergySummary.childNodes.length){
            card.appendChild(allergySummary);
          }

          // Highlight groups with host reuse issues (these should be shown in red).
          const hasHostReuse = Array.isArray(group.warnings) && group.warnings.indexOf('host_reuse') !== -1;
          if (hasHostReuse){
            card.classList.remove('border-[#f0f4f7]');
            card.classList.remove('bg-[#fcfcfd]');
            card.classList.add('border-[#fecaca]', 'bg-[#fef2f2]');
          }

          wrap.appendChild(card);
        });
        section.appendChild(wrap);
        box.appendChild(section);
      });

      const ctrl = document.createElement('div');
      ctrl.className = 'flex gap-2 items-center flex-wrap';
      ctrl.innerHTML = `\n      <button id="btn-save-groups" class="bg-[#008080] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#00b3b3]">Save changes</button>\n      <button id="btn-validate-groups" class="bg-[#ffc241] text-[#172a3a] px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#ffe5d0]">Validate</button>\n      <button id="btn-release-groups" class="bg-[#2563eb] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#1d4ed8]">Release</button>\n      <button id="btn-reload-details" class="bg-[#4a5568] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:opacity-90">Reload</button>\n      <span id="details-issues" class="text-sm"></span>\n    `;
      if (unsaved){
        const releaseBtn = ctrl.querySelector('#btn-release-groups');
        if (releaseBtn){
          releaseBtn.disabled = true;
          releaseBtn.classList.add('opacity-60');
          releaseBtn.title = 'Save changes before releasing';
        }
      }
      box.appendChild(ctrl);

      ctx.bindDnD();
      ctx.bindDetailsControls();
      ctx.bindTeamMapButtons();
      ctx.bindTeamNameButtons();
      ctx.bindSyntheticTeamButtons();
      ctx.fetchIssuesForDetails();
      ctx.updateUnplacedTeamsPanels();
      ctx.updateSyntheticManagementPanel();
    }

    return {
      groupsByPhase,
      renderMatchDetailsBoard,
      calculateLocalMetrics,
      extractSoloIdsFromSynthetic,
      updateState,
    };
  }

  window.dhAdminDashboard = window.dhAdminDashboard || {};
  window.dhAdminDashboard.createMatchDetailsModule = createMatchDetailsModule;
})();
