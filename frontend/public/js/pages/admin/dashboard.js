(function(){
  const helpers = (window.dhAdminDashboard && window.dhAdminDashboard.helpers) || null;
  if (!helpers) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[DinnerHopping] Admin dashboard helpers missing. Ensure js/pages/admin/dashboard/helpers.js loads first.');
    }
    return;
  }

  const {
    apiFetch,
    $,
    $$,
    fmtDate,
    toast,
    toastLoading,
    getDialog,
    showDialogAlert,
    showDialogConfirm,
    escapeHtml,
  } = helpers;

  const L = typeof window !== 'undefined' ? window.L : null;

  // --- Edit mode state ---
  let editingId = null;

  // --- Matching details state ---
  let detailsVersion = null; // number
  let detailsGroups = [];    // [{phase, host_team_id, guest_team_ids, score?, travel_seconds?, host_address_public?}]
  let detailsMetrics = {};   // { total_participant_count, phase_summary: { phase: { assigned_participants, ... } } }
  let teamDetails = {};      // { team_id: {size, team_diet, course_preference, can_host_main, lat, lon} }
  let unsaved = false;
  const teamNamesCache = {};

  function markUnsaved(){
    unsaved = true;
  }

  let eventsModule = null;
  let enterCreateMode = ()=>{ editingId = null; };
  let enterEditMode = ()=>{};
  let readForm = ()=>({});

  let matchingModule = null;
  let ensureTeamNames = async ()=> null;
  let confirmAndRelease = async ()=> false;

  let proposalsModule = null;
  let loadProposals = async ()=>{};

  let mapModule = null;
  let bindMaps = ()=>{};
  let bindTeamMapButtons = ()=>{};
  let drawLegend = ()=>{};

  let participantsModule = null;

  let teamCardModule = null;
  let computeTeamLabel = (team, fallbackId)=>{
    if (!team) return fallbackId != null ? `Team ${fallbackId}` : 'Team';
    const members = Array.isArray(team.members) ? team.members : [];
    const firstMember = members.find((member)=> member && (member.display_name || member.first_name || member.last_name || member.email));
    if (firstMember){
      return (
        (firstMember.display_name && firstMember.display_name.trim()) ||
        `${(firstMember.first_name || '').trim()} ${(firstMember.last_name || '').trim()}`.trim() ||
        (firstMember.email || '').split('@')[0] ||
        (firstMember.email || '')
      ) || (fallbackId != null ? `Team ${fallbackId}` : 'Team');
    }
    if (team.name && typeof team.name === 'string' && team.name.trim()) return team.name.trim();
    return fallbackId != null ? `Team ${fallbackId}` : 'Team';
  };
  let formatMemberName = (member)=>{
    if (!member || typeof member !== 'object') return '';
    return (
      (member.display_name || '').trim() ||
      [member.first_name || '', member.last_name || ''].map((part)=> part.trim()).filter(Boolean).join(' ') ||
      (member.email || '').split('@')[0] ||
      (member.email || '')
    );
  };
  let buildMemberPreview = (member, team, fallbackLabel, teamId)=>{
    const label = formatMemberName(member) || fallbackLabel || `Team ${teamId || ''}`;
    const details = [label];
    if (member && member.email) details.push(`Email: ${member.email}`);
    if (member && member.phone) details.push(`Phone: ${member.phone}`);
    if (team && team.team_diet) details.push(`Diet: ${team.team_diet}`);
    return details.join('\n');
  };
  let buildTeamPreview = (team, fallbackLabel, teamId)=>{
    const label = fallbackLabel || computeTeamLabel(team, teamId);
    const details = [label];
    if (team && team.team_diet) details.push(`Diet: ${team.team_diet}`);
    return details.join('\n');
  };
  let renderTeamCard = (tid)=>{
    const el = document.createElement('div');
    el.className = 'team-card bg-white border border-[#e5e7eb] rounded-lg p-2 text-xs shadow-sm';
    el.dataset.teamId = tid;
    el.textContent = getTeamLabel(tid, detailsVersion);
    return el;
  };

  let syntheticModule = null;
  let syntheticDrafts = {
    splits: {},
    splitMembers: {},
    createStage: [],
    createdPairs: [],
    singles: {},
  };
  let syntheticTempTeamIds = new Set();
  let ensureSyntheticStyles = ()=>{};
  let updateSyntheticState = ()=>{};
  let isSyntheticId = ()=>false;
  let sanitizeForSyntheticId = (value)=> String(value || '');
  let recordSyntheticTempId = ()=>{};
  let cleanupTemporarySyntheticTeams = ()=>{};
  let isTeamIdPlaced = ()=>false;
  let removeTeamFromGroups = ()=> false;
  let generateSplitId = ()=> null;
  let buildSplitTeamDetails = ()=> null;
  let ensureSyntheticSplitDraft = ()=> null;
  let setSplitMemberStatus = ()=>{};
  let getSplitMemberStatus = ()=> 'available';
  let refreshSplitMemberStates = ()=>{};
  let finalizeComponentUsage = ()=>{};
  let rollbackSyntheticPair = ()=>{};
  let autoPersistSyntheticPair = ()=>{};
  let removeCreatedPairFromDrafts = ()=>{};
  let generatePairIdFromComponents = ()=> null;
  let createPairFromStage = ()=> null;
  let isManagedSplitId = ()=> false;
  let isManagedPairId = ()=> false;
  let renderSyntheticCreateStage = ()=>{};
  let listAvailableSyntheticParticipants = ()=>[];
  let renderSyntheticAvailableParticipants = ()=>{};
  let removeSyntheticManagementPanel = ()=>{};
  let updateSyntheticManagementPanel = ()=>{};

  let matchDetailsModule = null;
  let groupsByPhaseDelegate = ()=> ({ appetizer: [], main: [], dessert: [] });
  let renderMatchDetailsBoardDelegate = ()=>{};
  let calculateLocalMetricsDelegate = ()=> ({
    total_participant_count: 0,
    assigned_participant_count: 0,
    phase_summary: {
      appetizer: {
        assigned_participants: 0,
        expected_participants: 0,
        missing_participants: 0,
        assigned_units: 0,
        expected_units: 0,
        group_count: 0,
      },
      main: {
        assigned_participants: 0,
        expected_participants: 0,
        missing_participants: 0,
        assigned_units: 0,
        expected_units: 0,
        group_count: 0,
      },
      dessert: {
        assigned_participants: 0,
        expected_participants: 0,
        missing_participants: 0,
        assigned_units: 0,
        expected_units: 0,
        group_count: 0,
      },
    },
  });
  let extractSoloIdsFromSyntheticDelegate = ()=> [];

  function syncMatchDetailsModuleDependencies(){
    if (!matchDetailsModule || typeof matchDetailsModule.updateState !== 'function') return;
    matchDetailsModule.updateState({
      renderTeamCard,
      refreshSplitMemberStates,
      ensureSyntheticStyles,
      removeSyntheticManagementPanel,
      updateSyntheticManagementPanel,
      bindDnD,
      bindDetailsControls,
      bindTeamMapButtons,
      bindTeamNameButtons,
      bindSyntheticTeamButtons,
      fetchIssuesForDetails,
      updateUnplacedTeamsPanels,
    });
  }

  let issuesModule = null;
  let resolveIssueMeta = (type)=>{
    const key = typeof type === 'string' && type.length ? type : 'issue';
    return {
      label: key.replace(/_/g, ' '),
      description: 'Details unavailable.',
      tone: 'info',
    };
  };
  let toneForIssues = (issueTypes)=>{
    if (!Array.isArray(issueTypes) || issueTypes.length === 0) return 'neutral';
    const meta = resolveIssueMeta(issueTypes[0]);
    return meta && meta.tone ? meta.tone : 'neutral';
  };
  let createIssueChip = (type, stats)=>{
    const chip = document.createElement('span');
    const meta = resolveIssueMeta(type);
    const total = typeof stats === 'number' ? stats : ((stats && stats.total) != null ? Number(stats.total) : 0);
    chip.className = 'issue-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e2e8f0] text-[#334155]';
    chip.textContent = `${meta.label}: ${total}`;
    if (meta.description) chip.title = meta.description;
    return chip;
  };
  let createIssueCard = (item, version)=>{
    const card = document.createElement('div');
    card.className = 'issue-item rounded-xl border border-[#e2e8f0] p-3 text-xs space-y-1 bg-white shadow-sm';
    const issues = Array.isArray(item && item.issues) ? item.issues : [];
    const meta = resolveIssueMeta(issues[0]);
    const title = document.createElement('div');
    title.className = 'font-semibold text-[#1f2937]';
    title.textContent = meta.label || 'Issue';
    card.appendChild(title);
    if (meta.description){
      const desc = document.createElement('div');
      desc.className = 'text-[#334155]';
      desc.textContent = meta.description;
      card.appendChild(desc);
    }
    if (item && item.group){
      const host = document.createElement('div');
      host.textContent = `Host: ${getTeamLabel(item.group.host_team_id, version)}`;
      host.className = 'text-[#475569]';
      card.appendChild(host);
    }
    return card;
  };

  function versionKey(version){
    return version != null ? String(version) : '__current__';
  }

  function updateTeamNameCache(version, teamMap){
    const key = versionKey(version);
    const cache = teamNamesCache[key] = teamNamesCache[key] || {};
    Object.entries(teamMap || {}).forEach(([tid, team])=>{
      const id = String(tid);
      cache[id] = computeTeamLabel(team, id);
    });
    return cache;
  }

  function getTeamLabel(teamId, version){
    if (teamId == null) return '—';
    const id = String(teamId);
    const key = versionKey(version);
    if (teamNamesCache[key] && teamNamesCache[key][id]) return teamNamesCache[key][id];
    if (teamDetails[id]){
      const lbl = computeTeamLabel(teamDetails[id], id);
      const cache = teamNamesCache[key] = teamNamesCache[key] || {};
      cache[id] = lbl;
      return lbl;
    }
    for (const otherKey of Object.keys(teamNamesCache)){
      if (teamNamesCache[otherKey] && teamNamesCache[otherKey][id]) return teamNamesCache[otherKey][id];
    }
    return `Team ${id}`;
  }

  async function copyEmailToClipboard(email){
    if (!email) throw new Error('No email provided');
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
      await navigator.clipboard.writeText(email);
      return;
    }
    await new Promise((resolve, reject)=>{
      try {
        const ta = document.createElement('textarea');
        ta.value = email;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) resolve(); else reject(new Error('Copy command failed'));
      } catch (err){
        reject(err);
      }
    });
  }

  async function ensureCsrf(){
    try {
      if (window.dh && typeof window.dh.initCsrf === 'function'){
        await window.dh.initCsrf();
      } else if (typeof window.initCsrf === 'function'){
        await window.initCsrf();
      }
    } catch (_) {}
  }

  function setBtnLoading(btn, text){
    if (!btn) return;
    btn.dataset._orig = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    btn.classList.add('opacity-70');
  }

  function clearBtnLoading(btn){
    if (!btn) return;
    const t = btn.dataset._orig;
    if (t) btn.textContent = t;
    btn.disabled = false;
    btn.classList.remove('opacity-70');
  }

  function toDateInputValue(value){
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function toDateTimeLocalInputValue(value){
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function initializeTeamCardModule(){
    const factory = (window.dhAdminDashboard && window.dhAdminDashboard.createTeamCardModule) || null;
    if (!factory){
      if (typeof console !== 'undefined' && console.warn){
        console.warn('[DinnerHopping] Team card module missing. Ensure js/pages/admin/dashboard/team-card-module.js loads first.');
      }
      return;
    }
    teamCardModule = factory({ teamDetails });
    if (!teamCardModule) return;
    if (typeof teamCardModule.computeTeamLabel === 'function') computeTeamLabel = teamCardModule.computeTeamLabel;
    if (typeof teamCardModule.formatMemberName === 'function') formatMemberName = teamCardModule.formatMemberName;
    if (typeof teamCardModule.buildMemberPreview === 'function') buildMemberPreview = teamCardModule.buildMemberPreview;
    if (typeof teamCardModule.buildTeamPreview === 'function') buildTeamPreview = teamCardModule.buildTeamPreview;
    if (typeof teamCardModule.renderTeamCard === 'function') renderTeamCard = teamCardModule.renderTeamCard;
    if (typeof teamCardModule.updateState === 'function') teamCardModule.updateState({ teamDetails });
    syncMatchDetailsModuleDependencies();
  }

  function initializeEventsModule(){
    const factory = (window.dhAdminDashboard && window.dhAdminDashboard.createEventsModule) || null;
    if (!factory){
      if (typeof console !== 'undefined' && console.warn){
        console.warn('[DinnerHopping] Events module missing. Ensure js/pages/admin/dashboard/events-module.js loads first.');
      }
      return;
    }
    eventsModule = factory({
      $,
      toast,
      toDateInputValue,
      toDateTimeLocalInputValue,
      setEditingId: (value)=>{ editingId = value; },
      getEditingId: ()=> editingId,
    }) || null;
    if (!eventsModule) return;
    if (typeof eventsModule.enterCreateMode === 'function') enterCreateMode = eventsModule.enterCreateMode;
    if (typeof eventsModule.enterEditMode === 'function') enterEditMode = eventsModule.enterEditMode;
    if (typeof eventsModule.readForm === 'function') readForm = eventsModule.readForm;
    if (typeof eventsModule.updateState === 'function') eventsModule.updateState({ editingId });
  }

  function initializeIssuesModule(){
    const factory = (window.dhAdminDashboard && window.dhAdminDashboard.createIssuesModule) || null;
    if (!factory){
      if (typeof console !== 'undefined' && console.warn){
        console.warn('[DinnerHopping] Issues module missing. Ensure js/pages/admin/dashboard/issues-module.js loads first.');
      }
      return;
    }
    issuesModule = factory({ getTeamLabel });
    if (!issuesModule) return;
    if (typeof issuesModule.resolveIssueMeta === 'function') resolveIssueMeta = issuesModule.resolveIssueMeta;
    if (typeof issuesModule.toneForIssues === 'function') toneForIssues = issuesModule.toneForIssues;
    if (typeof issuesModule.createIssueChip === 'function') createIssueChip = issuesModule.createIssueChip;
    if (typeof issuesModule.createIssueCard === 'function') createIssueCard = issuesModule.createIssueCard;
    if (typeof issuesModule.updateState === 'function') issuesModule.updateState({ getTeamLabel });
  }

  function initializeSyntheticModule(){
    const syntheticModuleFactory = (window.dhAdminDashboard && window.dhAdminDashboard.createSyntheticModule) || null;
    if (!syntheticModuleFactory){
      if (typeof console !== 'undefined' && console.error){
        console.error('[DinnerHopping] Synthetic module missing. Ensure js/pages/admin/dashboard/synthetic-module.js loads first.');
      }
      return;
    }
    syntheticModule = syntheticModuleFactory({
      apiFetch,
      toast,
      toastLoading,
      $,
      computeTeamLabel,
      renderTeamCard,
      renderMatchDetailsBoard,
      markUnsaved,
      teamDetails,
      detailsGroups,
      detailsVersion,
    });
    syntheticDrafts = syntheticModule.drafts;
    syntheticTempTeamIds = syntheticModule.tempTeamIds;
    ensureSyntheticStyles = syntheticModule.ensureSyntheticStyles;
    updateSyntheticState = syntheticModule.updateState;
    isSyntheticId = syntheticModule.isSyntheticId;
    sanitizeForSyntheticId = syntheticModule.sanitizeForSyntheticId;
    recordSyntheticTempId = syntheticModule.recordSyntheticTempId;
    cleanupTemporarySyntheticTeams = syntheticModule.cleanupTemporarySyntheticTeams;
    isTeamIdPlaced = syntheticModule.isTeamIdPlaced;
    removeTeamFromGroups = syntheticModule.removeTeamFromGroups;
    generateSplitId = syntheticModule.generateSplitId;
    buildSplitTeamDetails = syntheticModule.buildSplitTeamDetails;
    ensureSyntheticSplitDraft = syntheticModule.ensureSyntheticSplitDraft;
    setSplitMemberStatus = syntheticModule.setSplitMemberStatus;
    getSplitMemberStatus = syntheticModule.getSplitMemberStatus;
    refreshSplitMemberStates = syntheticModule.refreshSplitMemberStates;
    finalizeComponentUsage = syntheticModule.finalizeComponentUsage;
    rollbackSyntheticPair = syntheticModule.rollbackSyntheticPair;
    autoPersistSyntheticPair = syntheticModule.autoPersistSyntheticPair;
    removeCreatedPairFromDrafts = syntheticModule.removeCreatedPairFromDrafts;
    generatePairIdFromComponents = syntheticModule.generatePairIdFromComponents;
    createPairFromStage = syntheticModule.createPairFromStage;
    isManagedSplitId = syntheticModule.isManagedSplitId;
    isManagedPairId = syntheticModule.isManagedPairId;
    renderSyntheticCreateStage = syntheticModule.renderSyntheticCreateStage;
    listAvailableSyntheticParticipants = syntheticModule.listAvailableSyntheticParticipants;
    renderSyntheticAvailableParticipants = syntheticModule.renderSyntheticAvailableParticipants;
    if (typeof syntheticModule.removeSyntheticManagementPanel === 'function') removeSyntheticManagementPanel = syntheticModule.removeSyntheticManagementPanel;
    if (typeof syntheticModule.updateSyntheticManagementPanel === 'function') updateSyntheticManagementPanel = syntheticModule.updateSyntheticManagementPanel;
    if (teamCardModule && typeof teamCardModule.setIsSyntheticChecker === 'function'){
      teamCardModule.setIsSyntheticChecker(isSyntheticId);
    }
    syncMatchDetailsModuleDependencies();
  }

  function initializeMatchDetailsModule(){
    const factory = (window.dhAdminDashboard && window.dhAdminDashboard.createMatchDetailsModule) || null;
    if (!factory){
      if (typeof console !== 'undefined' && console.warn){
        console.warn('[DinnerHopping] Match details module missing. Ensure js/pages/admin/dashboard/match-details-module.js loads first.');
      }
      return;
    }
    matchDetailsModule = factory({
      $,
      renderTeamCard,
      refreshSplitMemberStates,
      ensureSyntheticStyles,
      removeSyntheticManagementPanel,
      updateSyntheticManagementPanel,
      bindDnD,
      bindDetailsControls,
      bindTeamMapButtons,
      bindTeamNameButtons,
      bindSyntheticTeamButtons,
      fetchIssuesForDetails,
      updateUnplacedTeamsPanels,
      getState: ()=> ({
        detailsVersion,
        detailsGroups,
        detailsMetrics,
        teamDetails,
        unsaved,
        syntheticDrafts,
      }),
    }) || null;
    if (!matchDetailsModule) return;
    if (typeof matchDetailsModule.groupsByPhase === 'function') groupsByPhaseDelegate = matchDetailsModule.groupsByPhase;
    if (typeof matchDetailsModule.renderMatchDetailsBoard === 'function') renderMatchDetailsBoardDelegate = matchDetailsModule.renderMatchDetailsBoard;
    if (typeof matchDetailsModule.calculateLocalMetrics === 'function') calculateLocalMetricsDelegate = matchDetailsModule.calculateLocalMetrics;
    if (typeof matchDetailsModule.extractSoloIdsFromSynthetic === 'function') extractSoloIdsFromSyntheticDelegate = matchDetailsModule.extractSoloIdsFromSynthetic;
    syncMatchDetailsModuleDependencies();
  }

  function initializeMatchingModule(){
    const factory = (window.dhAdminDashboard && window.dhAdminDashboard.createMatchingModule) || null;
    if (!factory){
      if (typeof console !== 'undefined' && console.warn){
        console.warn('[DinnerHopping] Matching module missing. Ensure js/pages/admin/dashboard/matching-module.js loads first.');
      }
      return;
    }
    matchingModule = factory({
      apiFetch,
      toast,
      toastLoading,
      showDialogConfirm,
      getTeamLabel,
      versionKey,
      updateTeamNameCache,
      getTeamNamesCache: ()=> teamNamesCache,
      getTeamDetails: ()=> teamDetails,
      setBtnLoading,
      clearBtnLoading,
      loadEvents,
      loadProposals,
      loadMatchDetails,
      getMatchingState: ()=> ({ unsaved, detailsVersion }),
    }) || null;
    if (!matchingModule) return;
    if (typeof matchingModule.ensureTeamNames === 'function') ensureTeamNames = matchingModule.ensureTeamNames;
    if (typeof matchingModule.confirmAndRelease === 'function') confirmAndRelease = matchingModule.confirmAndRelease;
    if (proposalsModule && typeof proposalsModule.updateState === 'function'){
      proposalsModule.updateState({ ensureTeamNames, confirmAndRelease });
    }
  }

  function initializeMapModule(){
    const factory = (window.dhAdminDashboard && window.dhAdminDashboard.createMapModule) || null;
    if (!factory){
      if (typeof console !== 'undefined' && console.warn){
        console.warn('[DinnerHopping] Map module missing. Ensure js/pages/admin/dashboard/map-module.js loads first.');
      }
      return;
    }
    mapModule = factory({
      $,
      apiFetch,
      toast,
      toastLoading,
      getDetailsVersion: ()=> detailsVersion,
      L,
    }) || null;
    if (!mapModule) return;
    if (typeof mapModule.bindMaps === 'function') bindMaps = mapModule.bindMaps;
    if (typeof mapModule.bindTeamMapButtons === 'function') bindTeamMapButtons = mapModule.bindTeamMapButtons;
    if (typeof mapModule.drawLegend === 'function') drawLegend = mapModule.drawLegend;
    if (typeof mapModule.updateState === 'function') mapModule.updateState({ detailsVersion });
    syncMatchDetailsModuleDependencies();
  }
  
  function initializeProposalsModule(){
    const factory = (window.dhAdminDashboard && window.dhAdminDashboard.createProposalsModule) || null;
    if (!factory){
      if (typeof console !== 'undefined' && console.warn){
        console.warn('[DinnerHopping] Proposals module missing. Ensure js/pages/admin/dashboard/proposals-module.js loads first.');
      }
      return;
    }
    proposalsModule = factory({
      $,
      apiFetch,
      fmtDate,
      toast,
      toastLoading,
      showDialogConfirm,
      showDialogAlert,
      ensureTeamNames,
      confirmAndRelease,
      createIssueChip,
      createIssueCard,
      getTeamLabel,
      getDetailsVersion: ()=> detailsVersion,
      getUnsaved: ()=> unsaved,
      loadMatchDetails,
      setBtnLoading,
      clearBtnLoading,
    }) || null;
    if (!proposalsModule) return;
    if (typeof proposalsModule.loadProposals === 'function') loadProposals = proposalsModule.loadProposals;
    if (typeof proposalsModule.updateState === 'function'){
      proposalsModule.updateState({ ensureTeamNames, confirmAndRelease, createIssueChip, createIssueCard, getTeamLabel });
    }
  }

  initializeTeamCardModule();
  initializeEventsModule();
  initializeParticipantsModule();
  initializeIssuesModule();
  initializeSyntheticModule();
  initializeMatchDetailsModule();
  initializeProposalsModule();
  initializeMatchingModule();
  initializeMapModule();

  function bindTeamNameButtons(){
    const root = $('#match-details');
    if (!root || root.dataset.nameBound) return;
    root.addEventListener('click', async (ev)=>{
      const btn = ev.target.closest('.team-member-btn, .team-name-btn');
      if (!btn || !root.contains(btn)) return;
      const email = (btn.dataset.email || '').trim();
      if (!email){
        toast('No email available for this contact.', { type: 'info' });
        return;
      }
      try {
        await copyEmailToClipboard(email);
        toast(`Copied ${email} to clipboard.`, { type: 'success' });
      } catch (err){
        toast('Unable to copy email to clipboard.', { type: 'error' });
      }
    });
    root.dataset.nameBound = '1';
  }
  function bindSyntheticTeamButtons(){
    if (bindSyntheticTeamButtons._bound) return;
    document.addEventListener('click', async (ev)=>{
      const btn = ev.target.closest('.team-create-btn');
      if (!btn) return;
      ev.preventDefault();
      const tid = btn.dataset.teamId;
      if (!tid) return;
      const evId = $('#matching-event-select') ? $('#matching-event-select').value : null;
      if (!evId){
        toast('Select an event before continuing.', { type: 'warning' });
        return;
      }
      const proceed = await showDialogConfirm(`Create a persistent team from ${tid}?`, { title: 'Create team', confirmLabel: 'Create', tone: 'warning' });
      if (!proceed) return;
      const t = toastLoading('Creating team...');
      const res = await apiFetch(`/admin/teams/create-from-synthetic?event_id=${encodeURIComponent(evId)}&synthetic_id=${encodeURIComponent(tid)}`, { method: 'POST' });
      t.close();
      if (res.ok){
        toast('Team created.', { type: 'success' });
        await loadMatchDetails(detailsVersion);
      } else {
        const txt = await res.text().catch(()=> 'Error');
        await showDialogAlert(`Failed: ${txt}`, { title: 'Error', tone: 'danger' });
      }
    });
    bindSyntheticTeamButtons._bound = true;
  }

  function bindWeightInfo(){
    if (bindWeightInfo._bound) return;
    document.addEventListener('click', (ev)=>{
      const btn = ev.target.closest('.weight-info');
      if (!btn) return;
      ev.preventDefault();
      const info = (btn.dataset && btn.dataset.info) ? btn.dataset.info : 'No description available.';
      showDialogAlert(info, { title: 'Weight option details', tone: 'info' });
    });
    bindWeightInfo._bound = true;
  }

  function bindAlgorithmInfo(){
    if (bindAlgorithmInfo._bound) return;
    document.addEventListener('click', (ev)=>{
      const btn = ev.target.closest('.algo-info');
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      const info = btn.dataset && btn.dataset.info ? btn.dataset.info : 'No description available.';
      const title = btn.dataset && btn.dataset.title ? btn.dataset.title : 'Algorithm details';
      showDialogAlert(info, { title, tone: 'info' });
    });
    bindAlgorithmInfo._bound = true;
  }

  function bindAdvancedWeightsToggle(){
    if (bindAdvancedWeightsToggle._bound) return;
    const btn = document.getElementById('advanced-weight-toggle');
    const panel = document.getElementById('advanced-weight-panel');
    if (!btn || !panel) return;
    const icon = document.getElementById('advanced-weight-toggle-icon');
    const syncState = ()=>{
      const hidden = panel.classList.contains('hidden');
      btn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
      if (icon) icon.textContent = hidden ? '▼' : '▲';
    };
    btn.addEventListener('click', ()=>{
      panel.classList.toggle('hidden');
      syncState();
    });
    syncState();
    bindAdvancedWeightsToggle._bound = true;
  }

  function groupsByPhase(){
    return groupsByPhaseDelegate();
  }

  function renderMatchDetailsBoard(){
    return renderMatchDetailsBoardDelegate();
  }

  function calculateLocalMetrics(){
    return calculateLocalMetricsDelegate();
  }

  function extractSoloIdsFromSynthetic(id){
    return extractSoloIdsFromSyntheticDelegate(id);
  }

  function updateUnplacedTeamsPanels(){
    // Recalculate metrics locally based on current detailsGroups
    const localMetrics = calculateLocalMetrics();
    const phaseSummary = localMetrics.phase_summary || {};
    
    // Collect team IDs that are placed BY PHASE (per phase tracking)
    const placedByPhase = {
      appetizer: new Set(),
      main: new Set(),
      dessert: new Set()
    };
    
    // Also track which solo teams are part of synthetic pairs/splits
    const solosInSyntheticTeams = new Set();
    
    detailsGroups.forEach(g => {
      const phase = g.phase;
      if (!placedByPhase[phase]) return;
      
      if (g.host_team_id) {
        const htid = String(g.host_team_id);
        placedByPhase[phase].add(htid);
        
        // If it's a synthetic ID, extract the solo team IDs
        if (htid.startsWith('pair:') || htid.startsWith('split:')) {
          extractSoloIdsFromSynthetic(htid).forEach(sid => solosInSyntheticTeams.add(sid));
        }
      }
      
      (g.guest_team_ids || []).forEach(tid => {
        const gtid = String(tid);
        placedByPhase[phase].add(gtid);
        
        // If it's a synthetic ID, extract the solo team IDs
        if (gtid.startsWith('pair:') || gtid.startsWith('split:')) {
          extractSoloIdsFromSynthetic(gtid).forEach(sid => solosInSyntheticTeams.add(sid));
        }
      });
    });

    // Consider all units (real teams and synthetic pair:/split: units)
    const allTeamIds = Object.keys(teamDetails);

    const ensureArray = (value)=> Array.isArray(value) ? value : [];
    const memberTokenCache = new Map();

    const getMemberTokens = (teamId, details)=>{
      if (memberTokenCache.has(teamId)) return memberTokenCache.get(teamId);
      const tokens = new Set();
      const members = ensureArray(details && details.members);
      members.forEach((member)=>{
        if (!member || typeof member !== 'object') return;
        const push = (val)=>{
          const token = (val || '').toString().trim().toLowerCase();
          if (token) tokens.add(token);
        };
        push(member.email);
        push(member.display_name);
        const combined = [member.first_name || '', member.last_name || '']
          .map((part)=> (part || '').toString().trim().toLowerCase())
          .filter(Boolean)
          .join(' ');
        push(combined);
        if (member.user_id != null) push(`uid:${member.user_id}`);
      });
      ensureArray(details && details.emails).forEach((email)=>{
        const token = (email || '').toString().trim().toLowerCase();
        if (token) tokens.add(token);
      });
      const out = Array.from(tokens);
      memberTokenCache.set(teamId, out);
      return out;
    };

    const placedTokensByPhase = {
      appetizer: new Set(),
      main: new Set(),
      dessert: new Set(),
    };

    const recordPlacedTokens = (phase, teamId)=>{
      const bucket = placedTokensByPhase[phase];
      if (!bucket) return;
      const tokens = getMemberTokens(teamId, teamDetails[teamId] || {});
      tokens.forEach((token)=> bucket.add(token));
    };

    detailsGroups.forEach((group)=>{
      const phase = group.phase;
      if (!placedTokensByPhase[phase]) return;
      if (group.host_team_id != null) {
        recordPlacedTokens(phase, String(group.host_team_id));
      }
      (group.guest_team_ids || []).forEach((gid)=>{
        recordPlacedTokens(phase, String(gid));
      });
    });

    const candidateMaps = {
      appetizer: new Map(),
      main: new Map(),
      dessert: new Map(),
    };

    const canonicalKeyForTeam = (teamId, details)=>{
      const tokens = getMemberTokens(teamId, details);
      if (tokens.length) return tokens.slice().sort().join('|');
      return `id:${teamId}`;
    };

    const getTeamSize = (details)=>{
      if (!details || typeof details !== 'object') return 1;
      const explicit = Number(details.size);
      if (Number.isFinite(explicit) && explicit > 0) return explicit;
      const members = ensureArray(details.members);
      if (members.length) return members.length;
      return 1;
    };

    const getCandidateCreatedAt = (details)=>{
      const source = details && (details.synthetic_created_at || (details.origin && details.origin.synthetic_created_at) || details.updated_at || details.created_at);
      if (!source) return 0;
      if (typeof source === 'number') return source;
      const parsed = Date.parse(source);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const getCandidateTypeRank = (teamId, details)=>{
      const kind = details && details.synthetic_kind;
      const originType = details && details.origin && details.origin.type;
      if (teamId.startsWith('pair:') || kind === 'pair' || originType === 'synthetic_pair') return 0;
      if (teamId.startsWith('split:') || teamId.startsWith('solo:') || kind === 'split' || originType === 'synthetic_split') return 2;
      return 1;
    };

    const compareCandidates = (a, b)=>{
      const typeDiff = a.typeRank - b.typeRank;
      if (typeDiff !== 0) return typeDiff;
      const sizeDiff = b.size - a.size;
      if (sizeDiff !== 0) return sizeDiff;
      const createdDiff = (b.createdAt || 0) - (a.createdAt || 0);
      if (createdDiff !== 0) return createdDiff;
      return a.teamId.localeCompare(b.teamId);
    };

    const choosePreferredCandidates = (candidates)=>{
      const sorted = candidates.slice().sort(compareCandidates);
      const preferred = [];
      const tokenOwner = new Map();
      sorted.forEach((candidate)=>{
        const tokens = candidate.tokens || [];
        if (!tokens.length){
          preferred.push(candidate);
          return;
        }
        const ownersSet = new Set(tokens.map((token)=> tokenOwner.get(token)).filter(Boolean));
        const uncoveredTokens = tokens.filter((token)=> !tokenOwner.has(token));
        if (uncoveredTokens.length){
          const tokensToAssign = new Set(uncoveredTokens);
          ownersSet.forEach((owner)=>{
            if (!owner) return;
            if (compareCandidates(candidate, owner) < 0){
              const idx = preferred.indexOf(owner);
              if (idx >= 0) preferred.splice(idx, 1);
              owner.tokens.forEach((token)=>{
                if (tokenOwner.get(token) === owner) tokenOwner.delete(token);
                tokensToAssign.add(token);
              });
            }
          });
          preferred.push(candidate);
          tokens.forEach((token)=>{
            if (tokensToAssign.has(token)) tokenOwner.set(token, candidate);
          });
          return;
        }
        if (!ownersSet.size){
          preferred.push(candidate);
          tokens.forEach((token)=> tokenOwner.set(token, candidate));
          return;
        }
        const betterThanAllOwners = Array.from(ownersSet).every((owner)=> compareCandidates(candidate, owner) < 0);
        if (!betterThanAllOwners) return;
        ownersSet.forEach((owner)=>{
          const idx = preferred.indexOf(owner);
          if (idx >= 0) preferred.splice(idx, 1);
          owner.tokens.forEach((token)=>{
            if (tokenOwner.get(token) === owner) tokenOwner.delete(token);
          });
        });
        preferred.push(candidate);
        tokens.forEach((token)=> tokenOwner.set(token, candidate));
      });
      return preferred;
    };

    const registerCandidate = (phase, candidate)=>{
      const map = candidateMaps[phase];
      if (!map) return;
      const existing = map.get(candidate.key);
      if (!existing || compareCandidates(candidate, existing) < 0) {
        map.set(candidate.key, candidate);
      }
    };

    const phases = ['appetizer', 'main', 'dessert'];

    phases.forEach((phase)=>{
      const placedTokens = placedTokensByPhase[phase] || new Set();
      allTeamIds.forEach((tid)=>{
        const det = teamDetails[tid] || {};

        const isPlacedInThisPhase = placedByPhase[phase].has(tid);
        const isPartOfSyntheticTeam = solosInSyntheticTeams.has(tid);

        if (tid.startsWith('split:')) {
          const managedSplit = isManagedSplitId(tid);
          const splitStatus = managedSplit ? getSplitMemberStatus(tid) : 'available';
          if (splitStatus && splitStatus !== 'available') {
            return;
          }
        }

        const singleInfo = syntheticDrafts.singles[tid];
        const singleStatus = singleInfo && singleInfo.status ? String(singleInfo.status) : 'available';
        const isOriginalTeamSplit = singleInfo && singleInfo.originalTeamSplit === true;
        const isSingleUnavailable = singleInfo && ['consumed', 'paired', 'staged'].includes(singleStatus);

        if (isPlacedInThisPhase || isPartOfSyntheticTeam || isOriginalTeamSplit || isSingleUnavailable) {
          return;
        }

        const tokens = getMemberTokens(tid, det);
        if (tokens.length && tokens.every((token)=> placedTokens.has(token))) {
          return;
        }

        const key = canonicalKeyForTeam(tid, det);
        const size = getTeamSize(det);
        const candidate = {
          teamId: tid,
          details: det,
          size,
          key,
          tokens,
          typeRank: getCandidateTypeRank(tid, det),
          createdAt: getCandidateCreatedAt(det),
        };

        registerCandidate(phase, candidate);
      });
    });

    // Update/create each panel outside of sections (in body)
    phases.forEach(phase => {
      // Try to find existing panel or create new one
      let panel = $(`#unplaced-${phase}-panel`);
      
      if (!panel) {
        panel = document.createElement('div');
        panel.id = `unplaced-${phase}-panel`;
        panel.className = 'floating-panel';
        panel.dataset.phase = phase;
        
        const icons = { appetizer: '🥗', main: '🍖', dessert: '🍰' };
        panel.innerHTML = `
          <div class="floating-panel-header">
            <span>${icons[phase]} ${phase.charAt(0).toUpperCase() + phase.slice(1)} - Unplaced</span>
            <span id="unplaced-${phase}-count" class="bg-white/20 px-2 py-0.5 rounded-full text-xs">0</span>
          </div>
          <div id="unplaced-${phase}-content" class="floating-panel-content">
            <div class="text-xs text-gray-500 text-center py-4">No unplaced teams</div>
          </div>
        `;
        
        document.body.appendChild(panel);
      }
      
      const content = panel.querySelector(`#unplaced-${phase}-content`);
      const count = panel.querySelector(`#unplaced-${phase}-count`);
      
      if (!content || !count) return;
      
      // Check if there are missing participants according to metrics
      const phaseInfo = phaseSummary[phase] || {};
      const missingParticipants = Number(phaseInfo.missing_participants || 0);
      const expectedUnits = Number(phaseInfo.expected_units || 0);
      const assignedUnits = Number(phaseInfo.assigned_units || 0);
      const missingUnits = Math.max(0, expectedUnits - assignedUnits);
      const hasShortfall = missingParticipants > 0 || missingUnits > 0;
      
      const candidateMap = candidateMaps[phase] || new Map();
      const candidates = Array.from(candidateMap.values());

      // Only show panel if there are actually missing participants/units
      if (!hasShortfall) {
        content.innerHTML = '<div class="text-xs text-gray-500 text-center py-4">No missing participants</div>';
        count.textContent = '0';
        panel.classList.add('hidden');
      } else if (!candidates.length) {
        // There is a shortfall but no candidates we can surface yet
        const summaryParts = [];
        if (missingParticipants > 0) summaryParts.push(`${missingParticipants} participant(s)`);
        if (missingUnits > 0) summaryParts.push(`${missingUnits} unit(s)`);
        content.innerHTML = `<div class="text-xs text-gray-500 text-center py-4">Missing ${summaryParts.join(' & ')}<br/>No unplaced teams available</div>`;
        count.textContent = summaryParts.join(' / ');
        panel.classList.remove('hidden');
      } else {
          const preferredCandidates = choosePreferredCandidates(candidates);

          let participantsToFill = missingParticipants;
          let unitsToFill = missingUnits;
          const finalSelection = [];
          const coveredTokens = new Set();

          for (let i = 0; i < preferredCandidates.length && (participantsToFill > 0 || unitsToFill > 0); i++) {
            const candidate = preferredCandidates[i];
            const tokens = candidate.tokens || [];
            const fullyCovered = tokens.length && tokens.every((token)=> coveredTokens.has(token));
            if (fullyCovered) continue;
            finalSelection.push(candidate);
            participantsToFill -= candidate.size;
            if (unitsToFill > 0) unitsToFill -= 1;
            tokens.forEach((token)=> coveredTokens.add(token));
          }

          const providedParticipants = finalSelection.reduce((sum, cand) => sum + cand.size, 0);
          const providedUnits = finalSelection.length;
          const remainingParticipants = Math.max(missingParticipants - providedParticipants, 0);
          const remainingUnits = Math.max(missingUnits - providedUnits, 0);

          const summaryParts = [];
          if (missingParticipants > 0) summaryParts.push(`${missingParticipants} participant(s)`);
          if (missingUnits > 0) summaryParts.push(`${missingUnits} unit(s)`);
          count.textContent = summaryParts.join(' / ');
          content.innerHTML = '';

          finalSelection.forEach(candidate => {
            const tid = candidate.teamId;
            // Use the existing renderTeamCard function for consistent styling
            const teamCard = renderTeamCard(tid);

            // Add unplaced-specific data attributes for drag and drop
            teamCard.dataset.phase = phase;
            teamCard.dataset.groupIdx = '-1';
            teamCard.dataset.role = 'unplaced';

            content.appendChild(teamCard);
          });

          if (remainingParticipants > 0 || remainingUnits > 0) {
            const note = document.createElement('div');
            note.className = 'mt-2 text-[11px] text-[#b91c1c] text-center';
            const noteParts = [];
            if (remainingParticipants > 0) noteParts.push(`${remainingParticipants} additional participant(s)`);
            if (remainingUnits > 0) noteParts.push(`${remainingUnits} additional unit(s)`);
            note.textContent = `${noteParts.join(' and ')} still need placement`;
            content.appendChild(note);
          }

          panel.classList.remove('hidden');
      }
    });
    
    // Update panel positions based on scroll
    updateFloatingPanelPositions();

    // Refresh synthetic management panel alongside unplaced data
    updateSyntheticManagementPanel();
  }

  function updateFloatingPanelPositions() {
    const phases = ['appetizer', 'main', 'dessert'];
    const headerHeight = 120; // Approximate header + nav height
    const topOffset = 20; // Top margin when sticky
    
    phases.forEach(phase => {
      const panel = $(`#unplaced-${phase}-panel`);
      const section = $(`#phase-section-${phase}`);
      
      if (!panel || !section || panel.classList.contains('hidden')) {
        if (panel) panel.classList.remove('visible');
        return;
      }
      
      const sectionRect = section.getBoundingClientRect();
      const panelHeight = panel.offsetHeight;
      const viewportHeight = window.innerHeight;
      
      // Check if section is in viewport
      const sectionTop = sectionRect.top;
      const sectionBottom = sectionRect.bottom;
      const isInView = sectionBottom > headerHeight && sectionTop < viewportHeight;
      
      if (isInView) {
        panel.classList.add('visible');
        
        // Calculate panel position
        let panelTop;
        
        if (sectionTop > headerHeight) {
          // Section is below fold, panel should be at section top
          panelTop = sectionTop;
        } else if (sectionBottom < headerHeight + panelHeight + topOffset) {
          // Section is scrolling out of view, panel should stick to section bottom
          panelTop = sectionBottom - panelHeight;
        } else {
          // Section is in view, panel should be sticky at top
          panelTop = headerHeight + topOffset;
        }
        
        panel.style.top = `${Math.max(headerHeight, panelTop)}px`;
      } else {
        panel.classList.remove('visible');
      }
    });
  }

  // Setup scroll listener for floating panels
  let scrollTimeout;
  function setupFloatingPanelScrollListener() {
    window.addEventListener('scroll', () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateFloatingPanelPositions, 10);
    }, { passive: true });
    
    window.addEventListener('resize', () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateFloatingPanelPositions, 10);
    }, { passive: true });
  }

  removeSyntheticManagementPanel = function(){
    const panel = document.getElementById('synthetic-management-panel');
    if (panel){
      panel.remove();
    }
    syntheticDrafts.splits = {};
    syntheticDrafts.splitMembers = {};
    syntheticDrafts.createStage = [];
    syntheticDrafts.createdPairs = [];
    syntheticDrafts.singles = {};
    cleanupTemporarySyntheticTeams();
  };


  function initializeParticipantsModule(){
    const factory = (window.dhAdminDashboard && window.dhAdminDashboard.createParticipantsModule) || null;
    if (!factory){
      if (typeof console !== 'undefined' && console.warn){
        console.warn('[DinnerHopping] Participants module missing. Ensure js/pages/admin/dashboard/participants-module.js loads first.');
      }
      return;
    }
    participantsModule = factory({
      apiFetch,
      toast,
      fmtDate,
      escapeHtml,
      $,
    }) || null;
  }

  async function fetchIssuesForDetails(){
    try {
      if (!detailsVersion) return;
      const evId = $('#matching-event-select').value; if (!evId) return;
      const res = await apiFetch(`/matching/${evId}/issues?version=${detailsVersion}`);
      if (!res.ok) return;
      const data = await res.json().catch(()=>null); if (!data) return;
      const groups = data.issues || [];
      let missing = 0, partial = 0, cancelled = 0, incomplete = 0, duplicates = 0, allergies = 0, registrationMissing = 0, phaseGaps = 0;
      groups.forEach(g=>{
        const counts = g.issue_counts || {};
        missing += Number(counts.payment_missing || 0);
        partial += Number(counts.payment_partial || 0);
        cancelled += Number(counts.faulty_team_cancelled || 0);
        incomplete += Number(counts.team_incomplete || 0);
        duplicates += Number(counts.duplicate_pair || 0);
        allergies += Number(counts.uncovered_allergy || 0);
        registrationMissing += Number(counts.registration_missing || 0);
        phaseGaps += Number(counts.phase_participation_gap || 0);
      });
      const el = $('#details-issues');
      const parts = [];
      if (missing) parts.push(`${missing} missing payment`);
      if (partial) parts.push(`${partial} partial payment`);
      if (cancelled) parts.push(`${cancelled} cancelled team`);
      if (incomplete) parts.push(`${incomplete} incomplete team`);
      if (duplicates) parts.push(`${duplicates} duplicate encounter`);
      if (allergies) parts.push(`${allergies} uncovered allergy`);
      if (registrationMissing) parts.push(`${registrationMissing} missing registration${registrationMissing>1?'s':''}`);
      if (phaseGaps) parts.push(`${phaseGaps} phase participation gap${phaseGaps>1?'s':''}`);
      el.textContent = parts.length ? parts.join(' · ') : 'No outstanding issues.';
    } catch(e){}
  }

  async function previewCurrentGroups(){
    const evId = $('#matching-event-select').value;
    if (!evId || !detailsGroups || !detailsGroups.length) return;
    // Call preview (fast travel estimation) to refresh score/travel/warnings
    try {
      const res = await apiFetch(`/matching/${evId}/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groups: detailsGroups }) });
      if (!res.ok) return;
    const data = await res.json().catch(()=>null);
    if (!data || !Array.isArray(data.groups)) return;
    detailsGroups = data.groups;
  updateSyntheticState({ teamDetails, detailsGroups, detailsVersion });
      if (data.metrics && typeof data.metrics === 'object'){
        detailsMetrics = data.metrics;
      }
      renderMatchDetailsBoard();
    } catch (e) {}
  }

  function bindDnD(){
    const root = $('#match-details');
    const dragData = { teamId: null, fromPhase: null, fromGroupIdx: null, role: null };
    if (!root.dataset.dndBound){
      // dragstart on cards (in match details)
      root.addEventListener('dragstart', (e)=>{
        const card = e.target.closest('.team-card'); if (!card || !root.contains(card)) return;
        dragData.teamId = card.dataset.teamId;
        dragData.fromPhase = card.dataset.phase; dragData.fromGroupIdx = Number(card.dataset.groupIdx);
        dragData.role = card.dataset.role;
        try { e.dataTransfer.setData('text/plain', dragData.teamId || ''); } catch(_) {}
        e.dataTransfer.effectAllowed = 'move';
      }, true);
      
      // dragstart on cards in floating panels (global listener)
      document.body.addEventListener('dragstart', (e)=>{
        const card = e.target.closest('.team-card');
        const isInFloatingPanel = card && card.closest('.floating-panel-content');
        if (!isInFloatingPanel) return;
        
        dragData.teamId = card.dataset.teamId;
        dragData.fromPhase = card.dataset.phase; 
        dragData.fromGroupIdx = Number(card.dataset.groupIdx);
        dragData.role = card.dataset.role;
        try { e.dataTransfer.setData('text/plain', dragData.teamId || ''); } catch(_) {}
        e.dataTransfer.effectAllowed = 'move';
      }, true);
      
      // dragend anywhere within root
      root.addEventListener('dragend', ()=>{
        dragData.teamId = null; dragData.fromPhase = null; dragData.fromGroupIdx = null; dragData.role = null;
      }, true);
      
      // dragend on floating panels
      document.body.addEventListener('dragend', (e)=>{
        const card = e.target.closest('.team-card');
        const isInFloatingPanel = card && card.closest('.floating-panel-content');
        if (!isInFloatingPanel) return;
        dragData.teamId = null; dragData.fromPhase = null; dragData.fromGroupIdx = null; dragData.role = null;
      }, true);
      // delegated dragover on zones
      root.addEventListener('dragover', (ev)=>{
        const zone = ev.target && (ev.target.closest && ev.target.closest('.host-zone, .guest-zone'));
        if (!zone || !root.contains(zone)) return;
        ev.preventDefault(); ev.stopPropagation();
        try{ ev.dataTransfer.dropEffect = 'move'; } catch(_){}
      }, true);
      // delegated dragover on floating panels (to allow dropping teams back)
      root.addEventListener('dragover', (ev)=>{
        const panel = ev.target && (ev.target.closest && ev.target.closest('.floating-panel-content'));
        if (!panel || !root.contains(panel)) return;
        ev.preventDefault(); ev.stopPropagation();
        try{ ev.dataTransfer.dropEffect = 'move'; } catch(_){}
      }, true);
      // delegated drop on zones
      root.addEventListener('drop', async (ev)=>{
        const zone = ev.target && (ev.target.closest && ev.target.closest('.host-zone, .guest-zone'));
        if (!zone || !root.contains(zone)) return;
        ev.preventDefault(); ev.stopPropagation();
        const toPhase = zone.dataset.phase; const toIdx = Number(zone.dataset.groupIdx); const toRole = zone.dataset.role;
        if (!dragData.teamId) return;
        let changed = false;
        
        // Check if dragging from unplaced panel
        const fromUnplaced = dragData.role === 'unplaced' || dragData.fromGroupIdx === -1;
        
        if (toRole === 'host'){
          const sameGroup = (dragData.fromGroupIdx === toIdx) && (dragData.fromPhase === toPhase);
          const toG = detailsGroups[toIdx];
          
          if (fromUnplaced) {
            // Dragging from unplaced panel to host zone
            const prevHost = toG.host_team_id ? String(toG.host_team_id) : null;
            toG.host_team_id = dragData.teamId;
            if (prevHost){ 
              toG.guest_team_ids = toG.guest_team_ids || [];
              if (!toG.guest_team_ids.some(t=> String(t)===prevHost)) toG.guest_team_ids.push(prevHost); 
            }
            changed = true;
          } else if (dragData.role === 'guest'){
            if (sameGroup){
              const prevHost = toG.host_team_id ? String(toG.host_team_id) : null;
              toG.guest_team_ids = (toG.guest_team_ids||[]).filter(t=> String(t) !== dragData.teamId);
              toG.host_team_id = dragData.teamId;
              if (prevHost){ toG.guest_team_ids.push(prevHost); }
              changed = true;
            } else {
              const fromG = detailsGroups[dragData.fromGroupIdx];
              const prevHost = toG.host_team_id ? String(toG.host_team_id) : null;
              fromG.guest_team_ids = (fromG.guest_team_ids||[]).filter(t=> String(t) !== dragData.teamId);
              toG.host_team_id = dragData.teamId;
              toG.guest_team_ids = (toG.guest_team_ids||[]).filter(t=> String(t) !== dragData.teamId);
              if (prevHost){ if (!toG.guest_team_ids.some(t=> String(t)===prevHost)) toG.guest_team_ids.push(prevHost); }
              changed = true;
            }
          } else {
            toast("Dragging a host onto another 'Host' isn't supported. Move a guest into 'Host' to promote it.", { type: 'warning' });
            return;
          }
        } else if (toRole === 'guest'){
          const toG = detailsGroups[toIdx];
          
          if (fromUnplaced) {
            // Dragging from unplaced panel to guest zone
            if (String(toG.host_team_id) !== dragData.teamId){
              toG.guest_team_ids = toG.guest_team_ids || [];
              if (!toG.guest_team_ids.some(t=> String(t)===dragData.teamId)) toG.guest_team_ids.push(dragData.teamId);
              changed = true;
            }
          } else {
            const fromG = detailsGroups[dragData.fromGroupIdx];
            if (dragData.role === 'guest'){
              fromG.guest_team_ids = (fromG.guest_team_ids||[]).filter(t=> String(t) !== dragData.teamId);
            } else if (dragData.role === 'host'){
              toast("Moving a host into 'Guests' isn't supported.", { type: 'warning' });
              return;
            }
            if (String(toG.host_team_id) !== dragData.teamId){
              toG.guest_team_ids = toG.guest_team_ids || [];
              if (!toG.guest_team_ids.some(t=> String(t)===dragData.teamId)) toG.guest_team_ids.push(dragData.teamId);
              changed = true;
            }
          }
        }
        if (!changed) return;
        unsaved = true;
        if (typeof markUnsaved === 'function') markUnsaved();
        updateSyntheticState({ detailsGroups });
        const localMetricsAfterChange = calculateLocalMetrics();
        if (localMetricsAfterChange && typeof localMetricsAfterChange === 'object'){
          const nextPhaseSummary = Object.assign({}, detailsMetrics && detailsMetrics.phase_summary || {}, localMetricsAfterChange.phase_summary || {});
          detailsMetrics = {
            ...detailsMetrics,
            total_participant_count: localMetricsAfterChange.total_participant_count,
            assigned_participant_count: localMetricsAfterChange.assigned_participant_count,
            phase_summary: nextPhaseSummary,
          };
        }
        // Clear drag context before any DOM changes
        dragData.teamId = null; dragData.fromPhase = null; dragData.fromGroupIdx = null; dragData.role = null;
        // Defer UI update until after drop/dragend completes to avoid breaking subsequent drags
        const doUpdate = async ()=>{
          renderMatchDetailsBoard();
          try { await validateCurrentGroups(); } catch(_) {}
          try { await previewCurrentGroups(); } catch(_) {}
          toast('Unsaved changes (preview updated).', { type: 'info' });
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(()=>{ doUpdate(); }); else setTimeout(()=>{ doUpdate(); }, 0);
      }, true);
      // delegated drop on floating panels (to remove teams from matching)
      root.addEventListener('drop', async (ev)=>{
        const panelContent = ev.target && (ev.target.closest && ev.target.closest('.floating-panel-content'));
        if (!panelContent) return;
        ev.preventDefault(); ev.stopPropagation();
        
        if (!dragData.teamId) return;
        
        // Only allow removing teams that are currently placed (not already unplaced)
        if (dragData.role === 'unplaced') {
          toast('Team is already unplaced.', { type: 'info' });
          return;
        }
        
        // Remove team from its current group
        if (dragData.fromGroupIdx >= 0 && dragData.fromGroupIdx < detailsGroups.length) {
          const fromG = detailsGroups[dragData.fromGroupIdx];
          let removed = false;
          
          if (dragData.role === 'host') {
            if (String(fromG.host_team_id) === dragData.teamId) {
              fromG.host_team_id = null;
              removed = true;
            }
          } else if (dragData.role === 'guest') {
            const beforeLen = (fromG.guest_team_ids || []).length;
            fromG.guest_team_ids = (fromG.guest_team_ids || []).filter(t => String(t) !== dragData.teamId);
            removed = fromG.guest_team_ids.length < beforeLen;
          }
          
          if (removed) {
            unsaved = true;
            if (typeof markUnsaved === 'function') markUnsaved();
            updateSyntheticState({ detailsGroups });
            const localMetricsAfterRemoval = calculateLocalMetrics();
            if (localMetricsAfterRemoval && typeof localMetricsAfterRemoval === 'object'){
              const nextPhaseSummary = Object.assign({}, detailsMetrics && detailsMetrics.phase_summary || {}, localMetricsAfterRemoval.phase_summary || {});
              detailsMetrics = {
                ...detailsMetrics,
                total_participant_count: localMetricsAfterRemoval.total_participant_count,
                assigned_participant_count: localMetricsAfterRemoval.assigned_participant_count,
                phase_summary: nextPhaseSummary,
              };
            }
            // Clear drag context before any DOM changes
            dragData.teamId = null; dragData.fromPhase = null; dragData.fromGroupIdx = null; dragData.role = null;
            // Defer UI update
            const doUpdate = async ()=>{
              renderMatchDetailsBoard();
              try { await validateCurrentGroups(); } catch(_) {}
              try { await previewCurrentGroups(); } catch(_) {}
              toast('Team removed from matching (unsaved).', { type: 'info' });
            };
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(()=>{ doUpdate(); }); else setTimeout(()=>{ doUpdate(); }, 0);
          }
        }
      }, true);
      root.dataset.dndBound = '1';
    }
  }

  async function validateCurrentGroups(){
    const evId = $('#matching-event-select').value;
    const res = await apiFetch(`/matching/${evId}/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groups: detailsGroups }) });
    const data = await res.json().catch(()=>({ violations:[], phase_issues:[], group_issues:[] }));
    const issues = [];
    (data.violations||[]).forEach(v=>{
      const names = (v.pair||[]).map(id=> getTeamLabel(id, detailsVersion));
      issues.push(`pair ${names[0]||'—'} ↔ ${names[1]||'—'} ${v.count} times`);
    });
    (data.phase_issues||[]).forEach(v=>{
      const teamLabel = getTeamLabel(v.team_id, detailsVersion);
      issues.push(`[${v.phase}] team ${teamLabel}: ${v.issue}`);
    });
    (data.group_issues||[]).forEach(v=> issues.push(`[${v.phase||'?'}] group#${v.group_idx}: ${v.issue}`));
    $('#details-issues').textContent = issues.length ? `Issues: ${issues.join(' · ')}` : 'No issues detected.';
    if (issues.length){ toast(`Warnings: ${issues.length} issue(s) detected.`, { type: 'warning' }); }
  }

  function bindDetailsControls(){
    $('#btn-reload-details').addEventListener('click', async ()=>{ const t = toastLoading('Loading details...'); await loadMatchDetails(detailsVersion); t.close(); });
    $('#btn-validate-groups').addEventListener('click', validateCurrentGroups);
    const releaseBtn = $('#btn-release-groups');
    if (releaseBtn){
      releaseBtn.addEventListener('click', async (e)=>{
        if (unsaved){
          toast('Please save changes before releasing.', { type: 'warning' });
          return;
        }
        const evId = $('#matching-event-select').value;
        await confirmAndRelease(evId, detailsVersion, e.currentTarget);
      });
    }
    $('#btn-save-groups').addEventListener('click', async (e)=>{
      const btn = e.currentTarget; setBtnLoading(btn, 'Saving...');
      const evId = $('#matching-event-select').value;
      let r = await apiFetch(`/matching/${evId}/set_groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: detailsVersion, groups: detailsGroups }) });
      if (r.ok){
        const res = await r.json().catch(()=>({}));
        if (res.status === 'warning'){
          const msgs = [].concat(
            (res.violations||[]).map(v=>{
              const names = (v.pair||[]).map(id=> getTeamLabel(id, detailsVersion));
              return `pair ${names[0]||'—'} ↔ ${names[1]||'—'} ${v.count} times`;
            }),
            (res.phase_issues||[]).map(v=>`[${v.phase}] ${getTeamLabel(v.team_id, detailsVersion)} ${v.issue}`)
          );
          toast(`Warnings (${msgs.length})`, { type: 'warning' });
          const proceed = await showDialogConfirm(`Warnings detected:\n${msgs.join('\n')}\nProceed anyway?`, {
            title: 'Warnings detected',
            confirmLabel: 'Save anyway',
            tone: 'warning',
          });
          if (proceed){
            r = await apiFetch(`/matching/${evId}/set_groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: detailsVersion, groups: detailsGroups, force: true }) });
          } else {
            clearBtnLoading(btn); return;
          }
        }
        if (r.ok){
          unsaved = false;
          toast('Changes saved.', { type: 'success' });
          await loadProposals();
          await loadMatchDetails(detailsVersion);
        } else {
          const t = await r.text();
          await showDialogAlert(`Failed to save: ${t}`, { tone: 'danger', title: 'Save groups failed' });
        }
      } else {
        const t = await r.text();
        await showDialogAlert(`Failed to save: ${t}`, { tone: 'danger', title: 'Save groups failed' });
      }
      clearBtnLoading(btn);
    });
  }

  async function loadMatchDetails(version){
    const evId = $('#matching-event-select').value;
    const url = version ? `/matching/${evId}/details?version=${version}` : `/matching/${evId}/details`;
    const t = toastLoading('Loading matching details...');
    // show spinner message
    $('#match-details').innerHTML = '<div class="flex items-center gap-2 text-sm"><span class="spinner"></span> Loading details...</div>';
    
  // Preserve local synthetic teams (split: and pair:) BEFORE making the request
  // to capture the current state (after any local removals)
    const syntheticTeamsBeforeLoad = {};
    Object.entries(teamDetails || {}).forEach(([tid, details]) => {
      if (tid.startsWith('split:') || tid.startsWith('pair:')) {
        syntheticTeamsBeforeLoad[tid] = details;
      }
    });
    
    const res = await apiFetch(url);
    if (!res.ok){
      detailsMetrics = {};
      $('#match-details').innerHTML = '';
      $('#match-details-msg').textContent = 'No details available.';
      t.update('No details.');
      t.close();
      return;
    }
    const data = await res.json().catch(()=>null);
    if (!data){
      detailsMetrics = {};
      $('#match-details').innerHTML = '';
      t.update('Load error.');
      t.close();
      return;
    }
    detailsVersion = data.version;
    if (mapModule && typeof mapModule.updateState === 'function'){
      mapModule.updateState({ detailsVersion });
    }
    detailsGroups = data.groups || [];
    detailsMetrics = data.metrics || {};
    
  // Load fresh data from the server
    teamDetails = data.team_details || {};
    if (teamCardModule && typeof teamCardModule.updateState === 'function'){
      teamCardModule.updateState({ teamDetails });
    }
    
  // Restore ONLY synthetic teams that existed before reloading
    Object.entries(syntheticTeamsBeforeLoad).forEach(([tid, details]) => {
      teamDetails[tid] = details;
    });

  updateSyntheticState({ teamDetails, detailsGroups, detailsVersion });

    unsaved = false;
    updateTeamNameCache(detailsVersion, teamDetails);
    renderMatchDetailsBoard();
    t.update('Details loaded'); t.close();
  }

  async function loadEvents(){
    const tbody = $('#events-tbody');
    const countEl = $('#events-count');
    const selects = [$('#matching-event-select'), $('#map-event-select')].filter(Boolean);
    if (!tbody){
      if (typeof console !== 'undefined' && console.error){ console.error('[DinnerHopping] events-tbody element missing.'); }
      return;
    }
    tbody.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-sm text-gray-500">Loading events...</td></tr>`;
    try {
      const res = await apiFetch('/events/');
      if (!res || !res.ok){
        const reason = res ? await res.text().catch(()=> '') : '';
        throw new Error(reason || `Request failed${res ? ` (${res.status})` : ''}`);
      }
      const events = await res.json().catch(()=>[]);
      tbody.innerHTML = '';
      if (!Array.isArray(events) || events.length === 0){
        tbody.innerHTML = '<tr><td colspan="7" class="p-3 text-center text-sm text-gray-500">No events found.</td></tr>';
      } else {
        events.forEach(ev=>{
          const tr = document.createElement('tr');
          const currentStatus = (ev.status||'').toLowerCase();
          tr.innerHTML = `
            <td class="p-2 font-semibold">${ev.title||'Untitled'}</td>
            <td class="p-2">${ev.date||''}</td>
            <td class="p-2">${ev.city||''}</td>
            <td class="p-2"><span class="tag tag-${currentStatus}">${ev.status||''}</span></td>
            <td class="p-2"><span class="tag tag-${(ev.matching_status||'').toLowerCase()}">${ev.matching_status||''}</span></td>
            <td class="p-2">${ev.attendee_count||0}</td>
            <td class="p-2 space-y-1">
              <div class="flex items-center gap-2">
                <select data-action="set-status-select" data-id="${ev.id}" class="border border-[#f0f4f7] rounded-xl p-1 text-sm">
                  <option value="draft" ${currentStatus==='draft'?'selected':''}>draft</option>
                  <option value="coming_soon" ${currentStatus==='coming_soon'?'selected':''}>coming_soon</option>
                  <option value="open" ${currentStatus==='open'?'selected':''}>open</option>
                </select>
                <button data-action="set-status" data-id="${ev.id}" class="bg-[#008080] text-white px-2 py-1 rounded-xl text-xs font-semibold hover:bg-[#00b3b3]">Set</button>
              </div>
              <div class="flex items-center gap-2">
                <button data-action="edit" data-id="${ev.id}" class="bg-[#ffc241] text-[#172a3a] px-2 py-1 rounded-xl text-xs font-semibold hover:bg-[#ffe5d0]">Edit</button>
                <button data-action="delete" data-id="${ev.id}" data-title="${ev.title||''}" class="bg-[#e53e3e] text-white px-2 py-1 rounded-xl text-xs font-semibold hover:opacity-90">Delete</button>
              </div>
            </td>`;
          tbody.appendChild(tr);
        });
      }
      if (countEl){
        const total = Array.isArray(events) ? events.length : 0;
        countEl.textContent = `${total} event${total === 1 ? '' : 's'}`;
      }
      selects.forEach(sel=>{
        if (!sel) return;
        if (!Array.isArray(events) || events.length === 0){
          sel.innerHTML = '<option value="">No events available</option>';
        } else {
          sel.innerHTML = events.map(e=>`<option value="${e.id}">${e.title} (${e.date||''})</option>`).join('');
        }
      });
      if (participantsModule && typeof participantsModule.onEventsRefreshed === 'function'){
        await participantsModule.onEventsRefreshed(Array.isArray(events) ? events : []);
      }
    } catch (err){
      if (typeof console !== 'undefined' && console.error){ console.error('Failed to load events', err); }
      const message = err && err.message ? err.message : 'Failed to load events.';
      tbody.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-sm text-red-600">${escapeHtml(message)}</td></tr>`;
      if (countEl) countEl.textContent = '';
      selects.forEach(sel=>{ if (sel) sel.innerHTML = '<option value="">No events available</option>'; });
      return;
    }
    tbody.onclick = async (e)=>{
      const btn = e.target.closest('button'); if (!btn) return;
      const id = btn.getAttribute('data-id'); const action = btn.getAttribute('data-action');
      if (action === 'set-status'){
        const row = btn.closest('tr');
        const select = row && row.querySelector('select[data-action="set-status-select"][data-id="'+id+'"]');
        const newStatus = select ? select.value : null;
        if (!newStatus) return;
        const r = await apiFetch(`/events/${id}/status/${encodeURIComponent(newStatus)}`, { method: 'POST' });
        if (r.ok) { await loadEvents(); }
        else {
          const t = await r.text();
          await showDialogAlert(`Failed to set status: ${t}`, { tone: 'danger', title: 'Update status failed' });
        }
      } else if (action === 'edit'){
        const r = await apiFetch(`/events/${id}?anonymise=false`);
        if (!r.ok) return;
        const ev = await r.json().catch(()=>null);
        if (!ev) return;
        ev.id = id;
        enterEditMode(ev);
      } else if (action === 'delete'){
        const title = btn.getAttribute('data-title') || id;
        const confirmed = await showDialogConfirm(`Delete event "${title}"? This will also remove related registrations, matches, plans, etc.`, {
          title: 'Delete event',
          confirmLabel: 'Delete',
          tone: 'danger',
          destructive: true,
        });
        if (!confirmed) return;
        const r = await apiFetch(`/events/${id}`, { method: 'DELETE' });
        if (r.ok) { await loadEvents(); }
        else {
          const t = await r.text();
          await showDialogAlert(`Failed to delete: ${t}`, { tone: 'danger', title: 'Delete event failed' });
        }
      }
    }
    await resumeMatchingProgressIfNeeded();
  }

  async function handleCreate(){
    const f = $('#create-event-form');
    if (!f) return;
    f.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const payload = readForm();
      const out = $('#create-event-msg');
      let res;
      const btn = $('#btn-submit-event'); setBtnLoading(btn, editingId ? 'Updating...' : 'Creating...');
      if (editingId){
        res = await apiFetch(`/events/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        res = await apiFetch('/events/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      if (res.ok) {
        out.textContent = editingId ? 'Event updated.' : 'Event created as draft.';
        enterCreateMode();
        await loadEvents();
      } else {
        const t = await res.text().catch(()=> '');
        out.textContent = `Failed to ${editingId ? 'update' : 'create'} event. ${t}`;
      }
      clearBtnLoading(btn);
    });
    const cancelBtn = $('#btn-cancel-edit');
    if (cancelBtn){
      cancelBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        enterCreateMode();
      });
    }
  }

  function readWeights(){
    const defaults = {
      dist: 1,
      pref: 5,
      allergy: 3,
      desired_host: 10,
      trans: 0.5,
      final_party: 0.5,
      phase_order: 0,
      cap_penalty: 5,
      dup: 1000,
    };
    const get = (id, key)=>{
      const el = document.getElementById(id);
      if (!el) return defaults[key];
      const val = parseFloat(el.value);
      return Number.isFinite(val) ? val : defaults[key];
    };
    return {
      dist: get('w-dist', 'dist'),
      pref: get('w-pref', 'pref'),
      allergy: get('w-allergy', 'allergy'),
      desired_host: get('w-desired-host', 'desired_host'),
      trans: get('w-trans', 'trans'),
      final_party: get('w-final-party', 'final_party'),
      phase_order: get('w-phase-order', 'phase_order'),
      cap_penalty: get('w-cap-penalty', 'cap_penalty'),
      dup: get('w-dup', 'dup'),
    };
  }

  function selectedAlgorithms(){
    const algos = [];
    if ($('#algo-greedy').checked) algos.push('greedy');
    if ($('#algo-random').checked) algos.push('random');
    if ($('#algo-local').checked) algos.push('local_search');
    return algos;
  }

  const matchingProgressEls = {
    container: document.getElementById('matching-progress'),
    label: document.getElementById('matching-progress-label'),
    value: document.getElementById('matching-progress-value'),
    bar: document.getElementById('matching-progress-bar'),
    meta: document.getElementById('matching-progress-meta'),
  };
  const matchingProgressState = { current: 0, target: 0, rafId: null };
  let matchingJobPoll = null;

  function showMatchingProgressContainer(){
    const el = matchingProgressEls.container;
    if (!el) return;
    el.classList.remove('hidden');
    requestAnimationFrame(()=>{ el.classList.remove('opacity-0'); });
  }

  function hideMatchingProgressContainer(){
    const el = matchingProgressEls.container;
    if (!el) return;
    el.classList.add('opacity-0');
    setTimeout(()=>{
      if (!el.classList.contains('opacity-0')) return;
      el.classList.add('hidden');
      flashMatchingMessage('');
    }, 250);
  }

  function applyMatchingProgress(value){
    const pct = Math.max(0, Math.min(1, value));
    if (matchingProgressEls.bar) matchingProgressEls.bar.style.width = `${(pct * 100).toFixed(1)}%`;
    if (matchingProgressEls.value) matchingProgressEls.value.textContent = `${Math.round(pct * 100)}%`;
  }

  function resetMatchingProgress(){
    if (matchingProgressState.rafId){
      cancelAnimationFrame(matchingProgressState.rafId);
      matchingProgressState.rafId = null;
    }
    matchingProgressState.current = 0;
    matchingProgressState.target = 0;
    applyMatchingProgress(0);
    if (matchingProgressEls.meta) matchingProgressEls.meta.textContent = '';
  }

  function animateMatchingProgress(target){
    matchingProgressState.target = Math.max(0, Math.min(1, target));
    if (matchingProgressState.rafId) return;
    const step = ()=>{
      const diff = matchingProgressState.target - matchingProgressState.current;
      if (Math.abs(diff) < 0.001){
        matchingProgressState.current = matchingProgressState.target;
        applyMatchingProgress(matchingProgressState.current);
        matchingProgressState.rafId = null;
        return;
      }
      matchingProgressState.current += diff * 0.18;
      applyMatchingProgress(matchingProgressState.current);
      matchingProgressState.rafId = requestAnimationFrame(step);
    };
    matchingProgressState.rafId = requestAnimationFrame(step);
  }

  function translateJobMessage(message){
    if (!message) return '';
    const map = [
      { pattern: /En attente de démarrage/i, text: 'Waiting to start' },
      { pattern: /Initialisation/i, text: 'Initializing...' },
      { pattern: /Chargement des données/i, text: 'Loading data...' },
      { pattern: /Traitement des résultats/i, text: 'Processing results...' },
      { pattern: /Terminé/i, text: 'Completed' },
      { pattern: /Échec du matching/i, text: 'Matching failed' },
      { pattern: /Annulé/i, text: 'Cancelled' },
    ];
    for (const entry of map){
      if (entry.pattern.test(message)) return entry.text;
    }
  const startMatch = message.match(/Démarrage de l'algorithme\s+(.+)/i);
  if (startMatch) return `Starting ${startMatch[1].trim()} algorithm`;
  const doneMatch = message.match(/Algorithme\s+(.+) terminé/i);
  if (doneMatch) return `Algorithm ${doneMatch[1].trim()} finished`;
    if (message.includes(' - ')){
      const [prefix, suffix] = message.split(' - ', 2);
      if (prefix && suffix) return `${prefix.trim()}: ${suffix.trim()}`;
    }
    return message;
  }

  function flashMatchingMessage(text){
    const el = document.getElementById('matching-msg');
    if (!el) return;
    if (typeof text === 'string') el.textContent = text;
    el.classList.remove('matching-flash');
    void el.offsetWidth;
    el.classList.add('matching-flash');
  }

  function updateMatchingProgressUI(job){
    if (!job) return;
    const status = (job.status || '').toLowerCase();
    const progress = typeof job.progress === 'number' ? job.progress : 0;
    const labelEl = matchingProgressEls.label;
    if (labelEl){
      switch(status){
        case 'queued': labelEl.textContent = 'Waiting to start'; break;
        case 'running': labelEl.textContent = 'Matching in progress'; break;
        case 'completed': labelEl.textContent = 'Completed'; break;
        case 'failed': labelEl.textContent = 'Failed'; break;
        case 'cancelled': labelEl.textContent = 'Cancelled'; break;
        default: labelEl.textContent = 'Matching status'; break;
      }
    }
    if (matchingProgressEls.meta){
      const metaParts = [];
      const message = translateJobMessage(job.message || '');
      if (message) metaParts.push(message);
      if (Array.isArray(job.algorithms) && job.algorithms.length){
        metaParts.push(`Algorithms: ${job.algorithms.join(', ')}`);
      }
      matchingProgressEls.meta.textContent = metaParts.join(' • ');
    }
    showMatchingProgressContainer();
    const minProgress = status === 'queued' ? Math.max(progress, 0.05) : progress;
    animateMatchingProgress(minProgress);
  }

  function extractProposalVersions(job){
    if (!job || !Array.isArray(job.proposals)) return [];
    return job.proposals
      .map(entry => Number(entry && entry.version))
      .filter(num => Number.isFinite(num));
  }

  function stopMatchingJobPolling(){
    if (!matchingJobPoll) return;
    if (matchingJobPoll.timer) clearTimeout(matchingJobPoll.timer);
    matchingJobPoll = null;
  }

  async function handleMatchingJobCompletion(eventId, job){
    const status = (job.status || '').toLowerCase();
    const versions = extractProposalVersions(job);
    if (status === 'completed'){
      await loadProposals({ highlightVersions: versions });
      flashMatchingMessage('Matching completed. Latest proposals highlighted.');
      toast('Matching completed successfully.', { type: 'success' });
    } else if (status === 'failed'){
      await loadProposals();
      flashMatchingMessage('Matching failed. Please review the logs.');
      toast('Matching failed. Please review the logs.', { type: 'error' });
    } else if (status === 'cancelled'){
      flashMatchingMessage('Matching was cancelled.');
      toast('Matching was cancelled.', { type: 'warning' });
    }
    setTimeout(()=>{ hideMatchingProgressContainer(); resetMatchingProgress(); }, 1200);
  }

  async function pollMatchingJob(){
    const ctx = matchingJobPoll;
    if (!ctx) return;
    try{
      const res = await apiFetch(`/matching/${ctx.eventId}/jobs/${ctx.jobId}`);
      if (!matchingJobPoll || matchingJobPoll !== ctx) return;
      if (!res.ok) throw new Error(`Polling failed with status ${res.status}`);
      const job = await res.json().catch(()=>null);
      if (!job) throw new Error('Invalid job payload');
      updateMatchingProgressUI(job);
      const status = (job.status || '').toLowerCase();
      if (status === 'completed' || status === 'failed' || status === 'cancelled'){
        stopMatchingJobPolling();
        await handleMatchingJobCompletion(ctx.eventId, job);
      } else {
        ctx.timer = setTimeout(pollMatchingJob, 2000);
      }
    } catch(err){
      if (!matchingJobPoll || matchingJobPoll !== ctx) return;
      console.error('Matching job polling failed', err);
      ctx.timer = setTimeout(pollMatchingJob, 4000);
    }
  }

  function beginMatchingJobTracking(eventId, job){
    if (!job || !job.id) return;
    stopMatchingJobPolling();
    flashMatchingMessage('Matching is in progress. Progress is updating below.');
    updateMatchingProgressUI(job);
    matchingJobPoll = { eventId, jobId: job.id, timer: null };
    pollMatchingJob();
  }

  async function resumeMatchingProgressIfNeeded(){
    stopMatchingJobPolling();
    const select = document.getElementById('matching-event-select');
    const eventId = select ? select.value : '';
    if (!eventId){
      hideMatchingProgressContainer();
      resetMatchingProgress();
      return;
    }
    try{
      const res = await apiFetch(`/matching/${eventId}/jobs?limit=3`);
      if (!res.ok){
        hideMatchingProgressContainer();
        resetMatchingProgress();
        return;
      }
      const jobs = await res.json().catch(()=>[]);
      const active = Array.isArray(jobs) ? jobs.find(job=>{
        const status = (job.status || '').toLowerCase();
        return status === 'running' || status === 'queued';
      }) : null;
      if (active){
        beginMatchingJobTracking(eventId, active);
      } else {
        hideMatchingProgressContainer();
        resetMatchingProgress();
      }
    } catch(err){
      console.error('Failed to resume matching progress', err);
    }
  }

  async function startMatching(){
    $('#btn-start-matching').addEventListener('click', async (e)=>{
      const btn = e.currentTarget;
      const evId = $('#matching-event-select').value;
      if (!evId){
        toast('Please select an event first.', { type: 'warning' });
        return;
      }
      const algorithms = selectedAlgorithms();
      if (!algorithms.length){
        toast('Select at least one matching algorithm.', { type: 'warning' });
        return;
      }
    const weights = readWeights();
    setBtnLoading(btn, 'Starting...');
    const loader = toastLoading('Starting matching...');
      try {
        const res = await apiFetch(`/matching/${evId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ algorithms, weights }),
        });
        if (res.ok){
          const data = await res.json().catch(()=>null);
          if (data){
            if (data.status === 'already_running'){
              flashMatchingMessage('A matching job is already running for this event.');
              toast('A matching job is already running.', { type: 'info' });
            } else {
              flashMatchingMessage('Matching started. We will notify you when it finishes.');
              toast('Matching started successfully.', { type: 'success' });
            }
            if (data.job && data.job.id){
              beginMatchingJobTracking(evId, data.job);
            }
          } else {
            flashMatchingMessage('Matching started. We will notify you when it finishes.');
            toast('Matching started successfully.', { type: 'success' });
          }
          loader.update('Matching started');
          await loadProposals();
        } else {
          const errText = await res.text().catch(()=> 'Failed to start matching');
          flashMatchingMessage(`Failed to start: ${errText}`);
          loader.update('Matching error');
        }
      } catch(err){
        console.error('Failed to start matching', err);
        flashMatchingMessage(`Failed to start: ${err.message || err}`);
        loader.update('Matching error');
      } finally {
        loader.close();
        clearBtnLoading(btn);
      }
    });
    // Refresh proposals only — do not automatically reload match details to avoid
    // fetching heavy detail payloads when the admin just wants to refresh proposals.
    $('#btn-refresh-matches').addEventListener('click', async ()=>{
      const t = toastLoading('Refreshing proposals...');
      await loadProposals();
      t.update('Proposals refreshed');
      t.close();
    });
    const delAllBtn = $('#btn-delete-all-matches');
    if (delAllBtn){
      delAllBtn.addEventListener('click', async (e)=>{
        const btn = e.currentTarget; const evId = $('#matching-event-select').value;
        if (!evId) return;
        const confirmed = await showDialogConfirm('Delete ALL match proposals for this event?', {
          title: 'Delete all proposals',
          confirmLabel: 'Delete all',
          tone: 'danger',
          destructive: true,
        });
        if (!confirmed) return;
        setBtnLoading(btn, 'Deleting...');
        const t = toastLoading('Deleting proposals...');
        const r = await apiFetch(`/matching/${evId}/matches`, { method: 'DELETE' });
        if (r.ok){
          $('#matching-msg').textContent = 'All matches deleted.';
          detailsVersion = null; detailsGroups = []; teamDetails = {}; unsaved = false;
          if (mapModule && typeof mapModule.updateState === 'function'){
            mapModule.updateState({ detailsVersion });
          }
          if (teamCardModule && typeof teamCardModule.updateState === 'function'){
            teamCardModule.updateState({ teamDetails });
          }
          updateSyntheticState({ teamDetails, detailsGroups, detailsVersion });
          $('#match-details').innerHTML = '';
          // Remove floating panels when matches are deleted
          ['appetizer', 'main', 'dessert'].forEach(phase => {
            const panel = $(`#unplaced-${phase}-panel`);
            if (panel) panel.remove();
          });
          await loadProposals();
          t.update('Deleted');
        } else {
          const tx = await r.text();
          await showDialogAlert(`Failed to delete: ${tx}`, { tone: 'danger', title: 'Delete proposals failed' });
          t.update('Delete error');
        }
        t.close();
        clearBtnLoading(btn);
      });
    }
    const eventSelect = document.getElementById('matching-event-select');
    if (eventSelect){
      eventSelect.addEventListener('change', resumeMatchingProgressIfNeeded);
    }
  }

  // Removed old Manual Adjustments & Issues UI binding; handled dynamically via proposal issues button

  async function bindRefunds(){
    const processBtn = $('#btn-process-refunds');
    $('#btn-load-refunds').addEventListener('click', async ()=>{
      const evId = $('#refunds-event-select').value;
      const res = await apiFetch(`payments/admin/events/${evId}/refunds`);
      const data = await res.json().catch(()=>({ enabled:false, items:[], total_refund_cents:0 }));
      const box = $('#refunds-overview');
      const msg = $('#refunds-msg');
      if (!data.enabled){ box.textContent = 'Refund option disabled for this event.'; processBtn.classList.add('hidden'); msg.textContent=''; return; }
      const hasItems = Array.isArray(data.items) && data.items.length>0;
      if (hasItems){ processBtn.classList.remove('hidden'); } else { processBtn.classList.add('hidden'); }
      const rows = data.items.map(it=>`<tr data-reg="${it.registration_id}"><td class="p-1">${it.user_email||''}</td><td class="p-1">${(it.amount_cents/100).toFixed(2)} €</td><td class="p-1 text-xs">${it.registration_id}</td><td class="p-1"><button class="btn-refund-one bg-[#008080] text-white rounded px-2 py-1 text-xs">Refund</button></td></tr>`).join('');
      box.innerHTML = hasItems ? `
        <div class="font-semibold mb-2">Total refunds: ${(data.total_refund_cents/100).toFixed(2)} €</div>
        <div class="overflow-x-auto mt-2">
          <table class="min-w-full text-sm"><thead><tr class="bg-[#f0f4f7]"><th class="p-1 text-left">User</th><th class="p-1 text-left">Amount</th><th class="p-1 text-left">Registration</th><th class="p-1 text-left">Action</th></tr></thead><tbody>${rows}</tbody></table>
        </div>` : '<div class="text-sm">No refunds due.</div>';
      msg.textContent = hasItems ? '' : 'No pending refunds.';
    });
    if (processBtn){
      processBtn.addEventListener('click', async ()=>{
        const evId = $('#refunds-event-select').value; if (!evId) return;
        const t = toastLoading('Processing refunds...');
        const r = await apiFetch(`/events/${evId}/refunds/process`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const data = await r.json().catch(()=>({}));
        if (r.ok){ t.update(`Processed ${data.processed||0}`); toast(`Refunds processed: ${data.processed||0}`, { type: 'success' }); }
        else { t.update('Error'); toast('Refund processing failed', { type: 'error' }); }
        t.close();
        // reload overview
        try { $('#btn-load-refunds').click(); } catch(e){}
      });
    }
    // delegated per-row refund
    document.addEventListener('click', async (e)=>{
      const btn = e.target && e.target.closest && e.target.closest('.btn-refund-one');
      if (!btn) return;
      const tr = btn.closest('tr[data-reg]'); if (!tr) return;
      const regId = tr.getAttribute('data-reg');
      const evId = $('#refunds-event-select').value; if (!evId || !regId) return;
      const t = toastLoading('Refunding...');
      btn.disabled = true; btn.classList.add('opacity-70');
      const r = await apiFetch(`/events/${evId}/refunds/process`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registration_ids: [regId] }) });
      const data = await r.json().catch(()=>({}));
      if (r.ok){ t.update('Done'); toast('Refund processed', { type: 'success' }); }
      else { t.update('Error'); toast('Refund failed', { type: 'error' }); }
      t.close();
      try { $('#btn-load-refunds').click(); } catch(e){}
    });
  }

  async function safeRun(step, label){
    try {
      await step();
    } catch (err){
      console.error(`Admin dashboard init issue in ${label}:`, err);
    }
  }

  async function init(){
    await safeRun(ensureCsrf, 'ensureCsrf');
    await safeRun(loadEvents, 'loadEvents');
    await safeRun(handleCreate, 'handleCreate');
    await safeRun(startMatching, 'startMatching');
    await safeRun(bindRefunds, 'bindRefunds');
    bindWeightInfo();
    bindAlgorithmInfo();
    bindAdvancedWeightsToggle();
    bindMaps();
    setupFloatingPanelScrollListener();
    // Do not auto-load matching proposals or details on page load.
    // Users must click "Start Matching" or "Refresh Proposals" to fetch them.
    const placeholder = document.getElementById('match-details-msg');
    if (placeholder) placeholder.textContent = 'Click “Refresh Proposals” or “Start Matching” to load data.';
    drawLegend();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
