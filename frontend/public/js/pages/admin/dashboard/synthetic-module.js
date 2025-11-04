(function(){
  if (typeof window === 'undefined') return;
  const root = window.dhAdminDashboard = window.dhAdminDashboard || {};

  root.createSyntheticModule = function createSyntheticModule(context){
    const {
      apiFetch,
      toast,
      toastLoading,
      $,
      computeTeamLabel,
      renderTeamCard,
      renderMatchDetailsBoard,
      markUnsaved,
    } = context || {};

  let teamDetails = context ? context.teamDetails : {};
  let detailsGroups = context ? context.detailsGroups : [];
  let detailsVersion = context && typeof context.detailsVersion !== 'undefined' ? context.detailsVersion : null;

    const drafts = {
      splits: {},
      splitMembers: {},
      createStage: [],
      createdPairs: [],
      singles: {},
    };
    const tempTeamIds = new Set();
    let stylesInjected = false;

    function updateState(nextState){
      if (nextState && nextState.teamDetails) teamDetails = nextState.teamDetails;
      function removeCreatedPairFromDrafts(pairId){
        const target = String(pairId);
        drafts.createdPairs = drafts.createdPairs.filter((pair)=> String(pair.pairId) !== target);
      }

      if (nextState && nextState.detailsGroups) detailsGroups = nextState.detailsGroups;
      if (nextState && Object.prototype.hasOwnProperty.call(nextState, 'detailsVersion')){
        detailsVersion = nextState.detailsVersion;
      }
    }

    function ensureSyntheticStyles(){
      if (stylesInjected) return;
      const style = document.createElement('style');
      style.textContent = `
        .synthetic-drop-zone {
          border: 2px dashed #94a3b8;
          border-radius: 12px;
          padding: 16px 14px;
          background: #f8fafc;
          text-align: center;
          font-size: 12px;
          color: #475569;
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .synthetic-drop-zone.drag-active {
          border-color: #2563eb;
          background: #e0f2fe;
          color: #1d4ed8;
        }
        .synthetic-available-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .synthetic-available-item {
          border: 1px dashed #cbd5f5;
          border-radius: 10px;
          padding: 6px;
          background: #fff;
        }
        .synthetic-pending-actions button {
          border: none;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .synthetic-pending-actions button[data-synthetic-action="process-create"] {
          background: #10b981;
          color: #ffffff;
        }
        .synthetic-pending-actions button[data-synthetic-action="process-split"] {
          background: #f59e0b;
          color: #ffffff;
        }
        .synthetic-pending-actions button[data-synthetic-action="remove"] {
          background: #e2e8f0;
          color: #475569;
        }
        .synthetic-pending-actions button:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .synthetic-indicator {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #f97316;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
        }
        .synthetic-remove-btn {
          border: none;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 600;
          background: #e2e8f0;
          color: #334155;
          cursor: pointer;
        }
        .synthetic-remove-btn:hover {
          background: #cbd5f5;
        }
        .synthetic-split-entry,
        .synthetic-pair-entry {
          transition: box-shadow 0.2s ease;
        }
        .synthetic-split-entry:hover,
        .synthetic-pair-entry:hover {
          box-shadow: 0 10px 18px rgba(15, 23, 42, 0.08);
        }
        .synthetic-legend {
          font-size: 11px;
          color: #475569;
          background: #f8fafc;
          padding: 10px 14px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .synthetic-panel-section-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #1f2937;
        }
        .synthetic-drop-hint {
          margin-top: 6px;
          font-size: 11px;
          color: #64748b;
        }
        .synthetic-create-stage {
          margin-top: 10px;
          padding: 8px;
          border: 1px dashed #cbd5f5;
          border-radius: 10px;
          min-height: 52px;
          background: #ffffff;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: flex-start;
        }
        .synthetic-stage-empty {
          font-size: 11px;
          color: #94a3b8;
        }
        .synthetic-stage-item {
          position: relative;
        }
        .synthetic-stage-remove {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #ef4444;
          color: #ffffff;
          border: none;
          font-size: 11px;
          line-height: 1;
          cursor: pointer;
        }
        .synthetic-stage-remove:hover {
          opacity: 0.85;
        }
        .synthetic-item-status {
          margin-top: 4px;
          font-size: 10px;
          color: #64748b;
        }
        .synthetic-item-disabled {
          opacity: 0.5;
          cursor: default;
        }
      `;
      document.head.appendChild(style);
      stylesInjected = true;
    }

    function isSyntheticId(teamId){
      if (!teamId) return false;
      return String(teamId).startsWith('pair:') || String(teamId).startsWith('split:');
    }

    function sanitizeForSyntheticId(value){
      return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '') || 'member';
    }

    function recordSyntheticTempId(teamId){
      tempTeamIds.add(String(teamId));
    }

    function cleanupTemporarySyntheticTeams(){
      tempTeamIds.forEach((tid)=>{
        delete teamDetails[tid];
      });
      tempTeamIds.clear();
    }

    function isTeamIdPlaced(teamId){
      const target = String(teamId);
      return detailsGroups.some((group)=>{
        if (String(group.host_team_id) === target) return true;
        return (group.guest_team_ids || []).some((gid)=> String(gid) === target);
      });
    }

    function removeTeamFromGroups(teamId){
      const target = String(teamId);
      let changed = false;
      detailsGroups.forEach((group)=>{
        if (String(group.host_team_id) === target){
          group.host_team_id = null;
          changed = true;
        }
        const before = (group.guest_team_ids || []).length;
        group.guest_team_ids = (group.guest_team_ids || []).filter((gid)=> String(gid) !== target);
        if ((group.guest_team_ids || []).length !== before){
          changed = true;
        }
      });
      return changed;
    }

    function generateSplitId(originalId, member, index){
      const baseEmail = member && member.email ? member.email : `${originalId}-${index+1}`;
      const normalizedOriginal = sanitizeForSyntheticId(originalId);
      const base = sanitizeForSyntheticId(baseEmail);
      let candidate = `split:${normalizedOriginal}:${base}`;
      let attempt = 1;
      while (teamDetails[candidate] || drafts.splitMembers[candidate]){
        candidate = `split:${normalizedOriginal}:${base}-${attempt++}`;
      }
      return candidate;
    }

    function buildSplitTeamDetails(splitId, member, source, originalId){
      const clonedMember = member ? { ...member } : { full_name: 'Participant' };
      const payment = source && source.payment ? { ...source.payment } : { status: 'not_applicable' };
      const createdAt = Date.now();
      return {
        id: splitId,
        size: 1,
        team_diet: source ? source.team_diet : null,
        course_preference: source ? source.course_preference : null,
        can_host_main: source ? !!source.can_host_main : false,
        payment,
        members: [clonedMember],
        synthetic_parent: originalId,
        synthetic_kind: 'split',
        synthetic_created_at: createdAt,
      };
    }

    function ensureSyntheticSplitDraft(teamId){
      const originalId = String(teamId);
      if (drafts.splits[originalId]){
        return drafts.splits[originalId];
      }
      const source = teamDetails[originalId];
      if (!source || !Array.isArray(source.members) || source.members.length === 0){
        return null;
      }
      const members = [];
      source.members.forEach((member, index)=>{
        const splitId = generateSplitId(originalId, member, index);
        const splitDetails = buildSplitTeamDetails(splitId, member, source, originalId);
        teamDetails[splitId] = splitDetails;
        recordSyntheticTempId(splitId);
        drafts.splitMembers[splitId] = { originalId, memberIndex: index };
        members.push({ splitId, member: member ? { ...member } : null, status: 'available' });
      });
      const entry = {
        originalId,
        splitIds: members.map((m)=> m.splitId),
        members,
        label: computeTeamLabel ? computeTeamLabel(source, originalId) : originalId,
      };
      drafts.splits[originalId] = entry;
      return entry;
    }

    function setSplitMemberStatus(splitId, status){
      const info = drafts.splitMembers[splitId];
      if (!info) return;
      const entry = drafts.splits[info.originalId];
      if (!entry) return;
      const target = entry.members.find((m)=> m.splitId === splitId);
      if (target){
        target.status = status;
      }
    }

    function getSplitMemberStatus(splitId){
      const info = drafts.splitMembers[splitId];
      if (!info) return 'available';
      const entry = drafts.splits[info.originalId];
      if (!entry) return 'available';
      const target = entry.members.find((m)=> m.splitId === splitId);
      return target ? target.status || 'available' : 'available';
    }

    function refreshSplitMemberStates(){
      const stagedSet = new Set(drafts.createStage.map(String));
      const pairedSet = new Set();
      drafts.createdPairs.forEach((pair)=>{
        (pair.componentIds || []).forEach((sid)=> pairedSet.add(String(sid)));
      });
      const placedSet = new Set();
      detailsGroups.forEach((group)=>{
        if (group.host_team_id != null){
          placedSet.add(String(group.host_team_id));
        }
        (group.guest_team_ids || []).forEach((gid)=> placedSet.add(String(gid)));
      });
      Object.values(drafts.splits).forEach((entry)=>{
        entry.members.forEach((memberRec)=>{
          const sid = String(memberRec.splitId);
          if (pairedSet.has(sid)){
            memberRec.status = 'paired';
          } else if (stagedSet.has(sid)){
            memberRec.status = 'staged';
          } else if (placedSet.has(sid)){
            memberRec.status = 'placed';
          } else {
            memberRec.status = 'available';
          }
        });
      });
    }

    function mergePreferredDiet(currentDiet, nextDiet){
      if (!nextDiet) return currentDiet;
      const priority = { vegan: 3, vegetarian: 2, omnivore: 1 };
      const curScore = currentDiet && priority[currentDiet] ? priority[currentDiet] : 0;
      const nextScore = priority[nextDiet] || 0;
      if (nextScore === 0 && !currentDiet) return nextDiet;
      if (nextScore > curScore) return nextDiet;
      return currentDiet || nextDiet;
    }

    function buildPersistedTeamDetails(newTeamId, componentSnapshots){
      if (!Array.isArray(componentSnapshots) || !componentSnapshots.length) return null;

      const members = [];
      const allergies = new Set();
      const hostAllergies = new Set();
      const emailSet = new Set();
      const emails = [];
      let teamDiet = null;
      let coursePreference = null;
      let canHostMain = false;
      let canHostAny = false;
      let lat = null;
      let lon = null;
      let size = 0;
      let paidCount = 0;
      let activeRegCount = 0;
      let syntheticCreatedAt = Date.now();

      componentSnapshots.forEach((snapshot)=>{
        if (!snapshot || !snapshot.details) return;
        const det = snapshot.details;
        const detMembers = Array.isArray(det.members) ? det.members : [];
        detMembers.forEach((member)=>{
          if (!member) return;
          members.push({ ...member });
          const memberEmail = (member.email || '').trim();
          if (memberEmail){
            const lower = memberEmail.toLowerCase();
            if (!emailSet.has(lower)){
              emailSet.add(lower);
              emails.push(memberEmail);
            }
          }
        });
        size += det.size || (detMembers.length || 1);
        teamDiet = mergePreferredDiet(teamDiet, det.team_diet || null);
        if (!coursePreference && det.course_preference) coursePreference = det.course_preference;
        if (det.can_host_main) canHostMain = true;
        if (det.can_host_any) canHostAny = true;
        (det.allergies || []).forEach((item)=>{ if (item) allergies.add(item); });
        (det.host_allergies || []).forEach((item)=>{ if (item) hostAllergies.add(item); });
        if (lat == null && det.lat != null) lat = det.lat;
        if (lon == null && det.lon != null) lon = det.lon;
        const payment = det.payment || {};
        paidCount += Number(payment.paid_count || 0);
        activeRegCount += Number(payment.active_reg_count || 0);
        const createdSource = det.synthetic_created_at || (det.origin && det.origin.synthetic_created_at);
        if (createdSource){
          const ts = typeof createdSource === 'number' ? createdSource : Date.parse(createdSource);
          if (!Number.isNaN(ts)) syntheticCreatedAt = Math.max(syntheticCreatedAt, ts);
        }
      });

      const paymentStatus = (function(){
        if (!activeRegCount) return 'n/a';
        if (paidCount === 0) return 'unpaid';
        if (paidCount < activeRegCount) return 'partial';
        return 'paid';
      })();

      return {
        id: newTeamId,
        size: size || members.length || componentSnapshots.length,
        team_diet: teamDiet || 'omnivore',
        course_preference: coursePreference || null,
        can_host_main: canHostMain,
        can_host_any: canHostAny,
        lat,
        lon,
        allergies: Array.from(allergies),
        host_allergies: Array.from(hostAllergies),
        payment: {
          status: paymentStatus,
          paid_count: paidCount,
          active_reg_count: activeRegCount,
        },
        members,
        emails,
        origin: {
          type: 'synthetic_pair',
          source_components: componentSnapshots.map((snap)=> snap.id),
          synthetic_created_at: syntheticCreatedAt,
        },
        synthetic_created_at: syntheticCreatedAt,
        synthetic_kind: 'pair',
      };
    }

    function finalizeComponentUsage(componentIds){
      componentIds.forEach((componentId)=>{
        const id = String(componentId);
        if (isManagedSplitId(id)){
          const info = drafts.splitMembers[id];
          if (info){
            const entry = drafts.splits[info.originalId];
            if (entry){
              entry.members = entry.members.filter((member)=> String(member.splitId) !== id);
              entry.splitIds = entry.splitIds.filter((sid)=> String(sid) !== id);
              if (!entry.members.length){
                delete drafts.splits[info.originalId];
              }
            }
            delete drafts.splitMembers[id];
          }
          if (tempTeamIds.has(id)){
            tempTeamIds.delete(id);
          }
          delete teamDetails[id];
        } else if (drafts.singles[id]){
          const previous = drafts.singles[id] || {};
          drafts.singles[id] = {
            ...previous,
            status: 'consumed',
            consumed: true
          };
        }
      });
    }
    function removeCreatedPairFromDrafts(pairId){
      const target = String(pairId);
      drafts.createdPairs = drafts.createdPairs.filter((pair)=> String(pair.pairId) !== target);
    }

    function rollbackSyntheticPair(pairId, componentIds, message){
      const target = String(pairId);
      drafts.createdPairs = drafts.createdPairs.filter((pair)=> String(pair.pairId) !== target);
      if (tempTeamIds.has(target)){
        tempTeamIds.delete(target);
      }
      delete teamDetails[target];
      componentIds.slice().reverse().forEach((componentId)=>{
        const id = String(componentId);
        if (isManagedSplitId(id)){
          setSplitMemberStatus(id, 'available');
        } else {
          const entry = drafts.singles[id] || { status: 'available' };
          entry.status = 'available';
          drafts.singles[id] = entry;
        }
        if (!drafts.createStage.includes(id)){
          drafts.createStage.unshift(id);
        }
      });
      refreshSplitMemberStates();
      if (typeof renderMatchDetailsBoard === 'function') renderMatchDetailsBoard();
      if (typeof updateSyntheticManagementPanel === 'function') updateSyntheticManagementPanel();
      if (message && typeof toast === 'function'){
        toast(message, { type: 'error' });
      }
    }

    async function autoPersistSyntheticPair(pairId, componentIds){
      const evSelect = typeof $ === 'function' ? $('#matching-event-select') : null;
      const evId = evSelect ? evSelect.value : null;
      if (!evId){
        rollbackSyntheticPair(pairId, componentIds, 'Select an event before creating a new team.');
        return;
      }
      const loader = typeof toastLoading === 'function' ? toastLoading('Auto-creating team...') : { close(){} };
      try {
        const uniqueComponentIds = Array.from(new Set(componentIds.map((id)=> String(id))));
        const res = await apiFetch(
          `/admin/teams/create-from-synthetic?event_id=${encodeURIComponent(evId)}&synthetic_id=${encodeURIComponent(pairId)}&force=1`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ component_ids: uniqueComponentIds })
          }
        );
        if (loader && typeof loader.close === 'function') loader.close();
        if (!res.ok){
          const txt = await res.text().catch(()=> 'Creation failed.');
          console.error('[CREATE TEAM ERROR]', { status: res.status, error: txt, pairId, componentIds });
          rollbackSyntheticPair(pairId, componentIds, `Creation failed (HTTP ${res.status}): ${txt}`);
          return;
        }
        const payload = await res.json().catch(()=> null);
        const newTeamId = payload && payload.team_id ? String(payload.team_id) : null;
        const parentCleanupIds = new Set();
        const componentSnapshots = componentIds.map((componentId)=>{
          const cid = String(componentId);
          const det = teamDetails && teamDetails[cid] ? teamDetails[cid] : null;
          const snapshot = det ? {
            id: cid,
            details: {
              ...det,
              members: Array.isArray(det.members) ? det.members.map((member)=> member ? { ...member } : member) : [],
              allergies: Array.isArray(det.allergies) ? det.allergies.slice() : [],
              host_allergies: Array.isArray(det.host_allergies) ? det.host_allergies.slice() : [],
              emails: Array.isArray(det.emails) ? det.emails.slice() : [],
              payment: det.payment ? { ...det.payment } : {},
            },
          } : { id: cid, details: null };
          if (det && det.synthetic_parent){
            parentCleanupIds.add(String(det.synthetic_parent));
          }
          return snapshot;
        });

        removeCreatedPairFromDrafts(pairId);
        finalizeComponentUsage(componentIds);
        if (tempTeamIds.has(pairId)){
          tempTeamIds.delete(pairId);
        }
        delete teamDetails[pairId];

        componentSnapshots.forEach((snapshot)=>{
          if (!snapshot) return;
          const cid = String(snapshot.id);
          if (teamDetails[cid]){
            delete teamDetails[cid];
          }
        });

        parentCleanupIds.forEach((parentId)=>{
          delete teamDetails[parentId];
          const prev = drafts.singles[parentId] || { originalTeamSplit: true };
          drafts.singles[parentId] = {
            ...prev,
            status: 'consumed',
            consumed: true,
            originalTeamSplit: true,
          };
        });

        if (newTeamId){
          const mergedDetails = buildPersistedTeamDetails(newTeamId, componentSnapshots);
          if (mergedDetails){
            teamDetails[newTeamId] = mergedDetails;
          }
        }

        if (typeof toast === 'function'){
          if (newTeamId){
            toast('New team created and available in unplaced teams.', { type: 'success' });
          } else {
            toast('New team created. Save your changes to include it in matching.', { type: 'success' });
          }
        }

        refreshSplitMemberStates();
        if (typeof renderMatchDetailsBoard === 'function') renderMatchDetailsBoard();
        if (typeof updateSyntheticManagementPanel === 'function') updateSyntheticManagementPanel();

      } catch (error){
        if (loader && typeof loader.close === 'function') loader.close();
        rollbackSyntheticPair(pairId, componentIds, 'Auto-creation failed (network).');
      }
    }

    function generatePairIdFromComponents(componentIds){
      const emailParts = componentIds.map((sid, idx)=>{
        const det = teamDetails[sid];
        const member = det && Array.isArray(det.members) && det.members[0] ? det.members[0] : null;
        const email = member && member.email ? member.email : `member-${idx+1}`;
        return email;
      }).filter(Boolean);
      const base = emailParts.length ? emailParts.join('+') : componentIds.join('-');
      let candidate = `pair:${base}`;
      let attempt = 1;
      while (teamDetails[candidate] || drafts.createdPairs.some((pair)=> String(pair.pairId) === candidate)){
        candidate = `pair:${base}-${attempt++}`;
      }
      return candidate;
    }

    function createPairFromStage(){
      if (drafts.createStage.length < 2) return null;
      const startIdx = Math.max(drafts.createStage.length - 2, 0);
      const usedComponents = drafts.createStage.splice(startIdx, 2).map(String);
      if (usedComponents.length < 2){
        return null;
      }
      usedComponents.forEach((componentId)=>{
        if (isManagedSplitId(componentId)){
          setSplitMemberStatus(componentId, 'paired');
        } else {
          const rec = drafts.singles[componentId] || { status: 'available' };
          rec.status = 'paired';
          drafts.singles[componentId] = rec;
        }
      });
      const pairId = generatePairIdFromComponents(usedComponents);
      const members = usedComponents.flatMap((componentId)=>{
        const det = teamDetails[componentId];
        if (!det || !Array.isArray(det.members)) return [];
        return det.members.map((member)=> ({ ...member }));
      });
      const pairDetails = {
        id: pairId,
        size: members.length || usedComponents.length,
        team_diet: null,
        course_preference: null,
        can_host_main: members.some((m)=> m && m.can_host_main),
        payment: { status: 'not_applicable' },
        members,
        synthetic_kind: 'pair',
        synthetic_from_split_ids: usedComponents.slice(),
        synthetic_created_at: Date.now(),
      };
      teamDetails[pairId] = pairDetails;
      recordSyntheticTempId(pairId);
      drafts.createdPairs.push({
        pairId,
        componentIds: usedComponents.slice(),
        label: computeTeamLabel ? computeTeamLabel(pairDetails, pairId) : pairId,
      });
      refreshSplitMemberStates();
      if (typeof renderMatchDetailsBoard === 'function') renderMatchDetailsBoard();
      if (typeof updateSyntheticManagementPanel === 'function') updateSyntheticManagementPanel();
      autoPersistSyntheticPair(pairId, usedComponents.slice());
      return pairId;
    }

    function isManagedSplitId(splitId){
      return Object.prototype.hasOwnProperty.call(drafts.splitMembers, splitId);
    }

    function isManagedPairId(pairId){
      return drafts.createdPairs.some((pair)=> String(pair.pairId) === String(pairId));
    }

    function listAvailableSyntheticParticipants(){
      const items = [];
      Object.values(drafts.splits).forEach((entry)=>{
        if (!entry || !Array.isArray(entry.members)) return;
        entry.members.forEach((memberRec)=>{
          const status = memberRec && memberRec.status ? memberRec.status : 'available';
          if (status === 'available'){
            items.push(String(memberRec.splitId));
          }
        });
      });
      Object.entries(drafts.singles).forEach(([teamId, info])=>{
        if (info && info.originalTeamSplit === true) return;
        const status = info && info.status ? info.status : 'available';
        if (status === 'available'){
          items.push(String(teamId));
        }
      });
      return items;
    }

    function renderSyntheticCreateStage(container){
      if (!container) return;
      container.innerHTML = '';
      if (!drafts.createStage.length){
        const empty = document.createElement('div');
        empty.className = 'synthetic-stage-empty';
        empty.textContent = 'Drag a single participant here to start a new team.';
        container.appendChild(empty);
        return;
      }
      drafts.createStage.forEach((splitId)=>{
        const card = typeof renderTeamCard === 'function' ? renderTeamCard(splitId) : null;
        if (!card) return;
        card.dataset.phase = 'unplaced';
        card.dataset.groupIdx = '-1';
        card.dataset.role = 'unplaced';
        const wrapper = document.createElement('div');
        wrapper.className = 'synthetic-stage-item';
        wrapper.appendChild(card);
        container.appendChild(wrapper);
      });
    }

    function renderSyntheticAvailableParticipants(container){
      if (!container) return;
      container.innerHTML = '';
      const availableIds = listAvailableSyntheticParticipants();
      if (!availableIds.length){
        const empty = document.createElement('div');
        empty.className = 'synthetic-stage-empty';
        empty.textContent = 'No participants available right now.';
        container.appendChild(empty);
        return;
      }
      availableIds.sort().forEach((tid)=>{
        const card = typeof renderTeamCard === 'function' ? renderTeamCard(tid) : null;
        if (!card) return;
        card.dataset.phase = 'unplaced';
        card.dataset.groupIdx = '-1';
        card.dataset.role = 'unplaced';
        const wrapper = document.createElement('div');
        wrapper.className = 'synthetic-available-item';
        wrapper.appendChild(card);
        container.appendChild(wrapper);
      });
    }

    function removeSyntheticManagementPanel(){
      const panel = document.getElementById('synthetic-management-panel');
      if (panel){
        panel.remove();
      }
      drafts.splits = {};
      drafts.splitMembers = {};
      drafts.createStage = [];
      drafts.createdPairs = [];
      drafts.singles = {};
      cleanupTemporarySyntheticTeams();
    }

    function syntheticPanelZoneFromEvent(ev){
      if (!ev || !ev.target || typeof ev.target.closest !== 'function') return null;
      return ev.target.closest('.synthetic-drop-zone');
    }

    function handleSyntheticPanelDragOver(ev){
      const zone = syntheticPanelZoneFromEvent(ev);
      if (!zone) return;
      ev.preventDefault();
      zone.classList.add('drag-active');
      try { ev.dataTransfer.dropEffect = 'move'; } catch (_) {}
    }

    function handleSyntheticPanelDragLeave(ev){
      const zone = syntheticPanelZoneFromEvent(ev);
      if (!zone) return;
      zone.classList.remove('drag-active');
    }

    function handleSyntheticPanelDrop(ev){
      const zone = syntheticPanelZoneFromEvent(ev);
      if (!zone) return;
      ev.preventDefault();
      zone.classList.remove('drag-active');
      const action = zone.dataset.action;
      if (!action) return;
      const raw = (ev.dataTransfer && ev.dataTransfer.getData) ? ev.dataTransfer.getData('text/plain') : '';
      const tid = raw ? String(raw).trim() : '';
      if (!tid) return;

      if (action === 'split'){
        const entry = ensureSyntheticSplitDraft(tid);
        if (!entry){
          if (typeof toast === 'function'){
            toast("Unable to prepare this team (missing participants).", { type: 'warning' });
          }
          return;
        }
        const removed = removeTeamFromGroups(tid);
        if (removed && typeof markUnsaved === 'function') markUnsaved();
        if (removed && typeof renderMatchDetailsBoard === 'function'){
          renderMatchDetailsBoard();
        }
        drafts.singles[tid] = { status: 'paired', originalTeamSplit: true };
        refreshSplitMemberStates();
        if (typeof renderMatchDetailsBoard === 'function') renderMatchDetailsBoard();
        updateSyntheticManagementPanel();
        if (typeof toast === 'function'){
          toast('Participants available for new combinations.', { type: 'success' });
        }
        return;
      }

      if (action === 'create'){
        let stageId = tid;
        if (isManagedSplitId(stageId)){
          const status = getSplitMemberStatus(stageId);
          if (status === 'paired'){
            if (typeof toast === 'function') toast('This participant is already used in a newly created team.', { type: 'info' });
            return;
          }
          if (drafts.createStage.includes(stageId)){
            if (typeof toast === 'function') toast('Participant already present in the create area.', { type: 'info' });
            return;
          }
          if (status === 'placed'){
            const removed = removeTeamFromGroups(stageId);
            if (removed && typeof markUnsaved === 'function') markUnsaved();
            if (removed && typeof renderMatchDetailsBoard === 'function'){
              renderMatchDetailsBoard();
              refreshSplitMemberStates();
            }
          }
          drafts.createStage.push(stageId);
          setSplitMemberStatus(stageId, 'staged');
        } else {
          const source = teamDetails[stageId];
          if (!source){
            if (typeof toast === 'function') toast('Unable to find this participant.', { type: 'warning' });
            return;
          }
          const memberCount = Array.isArray(source.members) ? source.members.length : (source.size || 0) || 0;
          if (memberCount > 1){
            if (typeof toast === 'function') toast('Split this team first to obtain individual participants.', { type: 'info' });
            return;
          }
          const singleStatus = (drafts.singles[stageId] && drafts.singles[stageId].status) || 'available';
          if (singleStatus === 'paired'){
            if (typeof toast === 'function') toast('This participant is already used in a newly created team.', { type: 'info' });
            return;
          }
          if (drafts.createStage.includes(stageId)){
            if (typeof toast === 'function') toast('Participant already present in the create area.', { type: 'info' });
            return;
          }
          if (isTeamIdPlaced(stageId)){
            const removed = removeTeamFromGroups(stageId);
            if (removed && typeof markUnsaved === 'function') markUnsaved();
            if (removed && typeof renderMatchDetailsBoard === 'function'){
              renderMatchDetailsBoard();
              refreshSplitMemberStates();
            }
          }
          drafts.singles[stageId] = { status: 'staged' };
          drafts.createStage.push(stageId);
        }

        updateSyntheticManagementPanel();
            if (typeof toast === 'function') toast('Participant added to the create area.', { type: 'success' });
        refreshSplitMemberStates();
        if (typeof renderMatchDetailsBoard === 'function'){
          renderMatchDetailsBoard();
        }
        if (drafts.createStage.length >= 2){
          createPairFromStage();
        }
      }
    }

    function updateSyntheticManagementPanel(){
      if (detailsVersion == null){
        removeSyntheticManagementPanel();
        return;
      }
      ensureSyntheticStyles();
      refreshSplitMemberStates();

      const syntheticIds = Object.keys(teamDetails || {}).filter((id)=> id.startsWith('pair:') || id.startsWith('split:'));
      const pairIds = syntheticIds.filter((id)=> id.startsWith('pair:')).sort();
      const splitIds = syntheticIds.filter((id)=> id.startsWith('split:')).sort();
      const singleDraftIds = Object.entries(drafts.singles || {})
        .filter(([, info])=> !info || info.status !== 'consumed')
        .map(([id])=> id);

      let panel = document.getElementById('synthetic-management-panel');
      if (!panel){
        panel = document.createElement('div');
        panel.id = 'synthetic-management-panel';
        panel.className = 'floating-panel synthetic-tools-panel';
        document.body.appendChild(panel);
      }
      panel.classList.remove('hidden');
      panel.classList.add('visible');
      panel.style.top = '120px';
      panel.style.left = '20px';
      panel.style.right = 'auto';
      panel.style.width = '300px';
      panel.style.maxHeight = '75vh';
      panel.style.overflowY = 'auto';

      const header = document.createElement('div');
      header.className = 'floating-panel-header';
  header.innerHTML = '<span>Synthetic team management</span>';

      const content = document.createElement('div');
      content.className = 'floating-panel-content space-y-4';

      const dropZones = document.createElement('div');
      dropZones.className = 'space-y-3';

      const splitZone = document.createElement('div');
      splitZone.className = 'synthetic-drop-zone';
      splitZone.dataset.action = 'split';
      splitZone.innerHTML = `
        <div class="synthetic-panel-section-title">Split</div>
        <div class="synthetic-drop-hint">Drag a multi-person team here to prepare an instant split.</div>
      `;
      ['dragenter', 'dragover'].forEach((evt)=> splitZone.addEventListener(evt, handleSyntheticPanelDragOver));
      splitZone.addEventListener('dragleave', handleSyntheticPanelDragLeave);
      splitZone.addEventListener('drop', handleSyntheticPanelDrop);
      dropZones.appendChild(splitZone);

      const createZone = document.createElement('div');
      createZone.className = 'synthetic-drop-zone';
      createZone.dataset.action = 'create';
      createZone.innerHTML = `
        <div class="synthetic-panel-section-title">Create</div>
        <div class="synthetic-drop-hint">Drag a single participant here (split or already solo) to form a new team.</div>
        <div class="synthetic-create-stage"></div>
      `;
      ['dragenter', 'dragover'].forEach((evt)=> createZone.addEventListener(evt, handleSyntheticPanelDragOver));
      createZone.addEventListener('dragleave', handleSyntheticPanelDragLeave);
      createZone.addEventListener('drop', handleSyntheticPanelDrop);
      const stageContainer = createZone.querySelector('.synthetic-create-stage');
      renderSyntheticCreateStage(stageContainer);
      dropZones.appendChild(createZone);

      content.appendChild(dropZones);

      const availableSection = document.createElement('div');
      availableSection.className = 'space-y-2';
      availableSection.innerHTML = `<div class="synthetic-panel-section-title">Participants disponibles</div>`;
      const availableList = document.createElement('div');
      availableList.className = 'synthetic-available-list';
      renderSyntheticAvailableParticipants(availableList);
      availableSection.appendChild(availableList);
      content.appendChild(availableSection);

      const availability = document.createElement('div');
      availability.className = 'text-[11px] text-[#64748b] bg-[#f8fafc] rounded-lg border border-[#e2e8f0] p-3';
      const availableParticipantCount = listAvailableSyntheticParticipants().length;
      availability.innerHTML = `
        <div class="synthetic-panel-section-title">Available</div>
        <div>Synthetic teams: ${pairIds.length}</div>
        <div>Split participants: ${splitIds.length}</div>
        <div>Tracked solo participants: ${singleDraftIds.length}</div>
        <div>Available participants: ${availableParticipantCount}</div>
        <div>In preparation (create area): ${drafts.createStage.length}</div>
      `;
      content.appendChild(availability);

      panel.innerHTML = '';
      panel.appendChild(header);
      panel.appendChild(content);
    }

    return {
      drafts,
      tempTeamIds,
      ensureSyntheticStyles,
      isSyntheticId,
      sanitizeForSyntheticId,
      recordSyntheticTempId,
      cleanupTemporarySyntheticTeams,
      isTeamIdPlaced,
      removeTeamFromGroups,
      generateSplitId,
      buildSplitTeamDetails,
      ensureSyntheticSplitDraft,
      setSplitMemberStatus,
      getSplitMemberStatus,
      refreshSplitMemberStates,
      finalizeComponentUsage,
      rollbackSyntheticPair,
      autoPersistSyntheticPair,
      removeCreatedPairFromDrafts,
      generatePairIdFromComponents,
      createPairFromStage,
      isManagedSplitId,
      isManagedPairId,
      renderSyntheticCreateStage,
      listAvailableSyntheticParticipants,
      renderSyntheticAvailableParticipants,
      removeSyntheticManagementPanel,
      updateSyntheticManagementPanel,
      updateState,
    };
  };
})();
