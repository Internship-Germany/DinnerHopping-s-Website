(function(){
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
})();
