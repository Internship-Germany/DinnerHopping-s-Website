(function(){
  if (typeof window === 'undefined') return;
  const root = window.dhAdminDashboard = window.dhAdminDashboard || {};

  root.createProposalsModule = function createProposalsModule(context){
    const {
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
      getDetailsVersion = ()=> null,
      getUnsaved = ()=> false,
      loadMatchDetails = async ()=>{},
      setBtnLoading = ()=>{},
      clearBtnLoading = ()=>{},
    } = context || {};

    if (typeof $ !== 'function' || typeof apiFetch !== 'function'){
      return null;
    }

    let ensureTeamNamesFn = typeof ensureTeamNames === 'function' ? ensureTeamNames : async ()=>{};
    let confirmAndReleaseFn = typeof confirmAndRelease === 'function' ? confirmAndRelease : null;
    let createIssueChipFn = typeof createIssueChip === 'function' ? createIssueChip : null;
    let createIssueCardFn = typeof createIssueCard === 'function' ? createIssueCard : null;
    let getTeamLabelFn = typeof getTeamLabel === 'function' ? getTeamLabel : ()=> 'Team';

    function notify(message, options){
      if (typeof toast === 'function') toast(message, options);
    }

    function startLoader(label){
      if (typeof toastLoading === 'function') return toastLoading(label);
      return { update(){}, close(){} };
    }

    function formatDate(value){
      if (!value) return null;
      if (typeof fmtDate === 'function') return fmtDate(value);
      return value;
    }

    function buildIssueChip(issue, info){
  if (createIssueChipFn) return createIssueChipFn(issue, info);
      const span = document.createElement('span');
      span.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e2e8f0] text-[#334155]';
      const total = info && typeof info.total === 'number' ? info.total : 0;
      span.textContent = `${issue}: ${total}`;
      return span;
    }

    function buildIssueCard(item, version){
  if (createIssueCardFn) return createIssueCardFn(item, version);
      const card = document.createElement('div');
      card.className = 'issue-item rounded-xl border border-[#e2e8f0] p-3 text-xs space-y-1 bg-white shadow-sm';
      const title = document.createElement('div');
      title.className = 'font-semibold text-[#1f2937]';
      title.textContent = `Issue (${Array.isArray(item?.issues) ? item.issues.join(', ') : 'unknown'})`;
      card.appendChild(title);
      if (item && item.group && item.group.host_team_id){
        const host = document.createElement('div');
        host.textContent = `Host: ${labelForTeam(item.group.host_team_id, version)}`;
        host.className = 'text-[#475569]';
        card.appendChild(host);
      }
      return card;
    }

    function labelForTeam(id, version){
  if (getTeamLabelFn) return getTeamLabelFn(id, version);
      return `Team ${id}`;
    }

    async function loadProposals(options){
      const opts = options || {};
      const highlightVersions = new Set();
      if (Array.isArray(opts.highlightVersions)){
        opts.highlightVersions.forEach((val)=>{
          const num = Number(val);
          if (Number.isFinite(num)) highlightVersions.add(num);
        });
      }
      const highlightDuration = typeof opts.highlightDuration === 'number' ? Math.max(0, opts.highlightDuration) : 5000;
      const evSelect = $('#matching-event-select');
      const evId = evSelect ? evSelect.value : null;
      if (!evId) return;
      const box = $('#proposals');
      if (!box) return;
      const res = await apiFetch(`/matching/${evId}/matches`);
      const list = await res.json().catch(()=> []);
      box.innerHTML = '';
      const finalizedRecord = list.find((m)=> (m.status || '').toLowerCase() === 'finalized');
      const finalizedVersion = finalizedRecord ? Number(finalizedRecord.version) : null;
      const currentDetailsVersion = getDetailsVersion();
      const hasUnsaved = !!getUnsaved();

      list.forEach((m)=>{
        const version = Number(m.version);
        const metrics = m.metrics || {};
        const algorithm = m.algorithm || '';
        const isFinalized = (m.status || '').toLowerCase() === 'finalized';
        const isCurrent = currentDetailsVersion === version;
        const wasEdited = Boolean(m.updated_at && (!m.created_at || m.updated_at !== m.created_at));
        const classes = ['p-3','rounded-xl','border','transition','shadow-sm','proposal-card'];
        if (isFinalized){
          classes.push('border-[#bbf7d0]','bg-[#f0fdf4]');
        } else {
          classes.push('border-[#f0f4f7]','bg-white');
          if (finalizedVersion != null && version !== finalizedVersion){
            classes.push('opacity-70');
          }
        }
        if (isCurrent){
          classes.push('ring-2','ring-offset-1','ring-[#2563eb]');
        }
        const card = document.createElement('div');
        card.className = classes.join(' ');

        const createdAt = formatDate(m.created_at);
        const updatedAt = formatDate(m.updated_at);
        const finalizedAt = formatDate(m.finalized_at);
        const metaParts = [];
        if (createdAt) metaParts.push(`Created ${createdAt}`);
        if (updatedAt && (!createdAt || updatedAt !== createdAt)) metaParts.push(`Updated ${updatedAt}`);
        if (finalizedAt) metaParts.push(`Released ${finalizedAt}`);
        const badges = [];
        if (isFinalized) badges.push('<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#bbf7d0] text-[#065f46]">Released</span>');
        if (wasEdited && !isFinalized) badges.push('<span class="px-2 py-0.5 rounded-full text-[11px] bg-[#fee2e2] text-[#b91c1c]">Edited</span>');

        const travel = (metrics.total_travel_seconds || 0).toFixed(0);
        const score = (metrics.aggregate_group_score || 0).toFixed(1);
        const totalParticipants = Number(metrics.total_participant_count || 0);
        const assignedParticipants = Number(metrics.assigned_participant_count || 0);
        const missingParticipants = Math.max(0, totalParticipants - assignedParticipants);
        const participantsLabel = totalParticipants ? `${assignedParticipants}/${totalParticipants}${missingParticipants ? ` (missing ${missingParticipants})` : ''}` : '—';
        const releaseAlreadyExists = finalizedVersion != null;
        const releaseDisabled = (!isFinalized && releaseAlreadyExists && version !== finalizedVersion) || (hasUnsaved && currentDetailsVersion === version);
        let releaseClasses = isFinalized ? 'bg-[#e53e3e] hover:bg-[#c53030]' : 'bg-[#1b5e20] hover:bg-[#166534]';
        let releaseLabel = isFinalized ? 'Delete release' : 'Release';
        if (!isFinalized && hasUnsaved && currentDetailsVersion === version){
          releaseClasses = 'bg-[#9ca3af] cursor-not-allowed';
          releaseLabel = 'Save first';
        }

        card.innerHTML = `
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="font-semibold flex items-center gap-2">v${version}${algorithm ? ` · ${algorithm}` : ''}${badges.length ? ` <span class=\"flex gap-1\">${badges.join('')}</span>` : ''}</div>
            <div class="text-sm text-[#4a5568]">Travel: ${travel}s · Score: ${score} · Participants: ${participantsLabel}</div>
          </div>
          ${metaParts.length ? `<div class="mt-1 text-xs text-[#475569]">${metaParts.join(' · ')}</div>` : ''}
          <div class="mt-2 flex flex-wrap gap-2">
            <button data-view="${version}" class="bg-[#4a5568] text-white rounded-xl px-3 py-1 text-sm">${isCurrent ? 'Viewing' : 'View'}</button>
            <button data-release="${version}" data-finalized="${isFinalized ? '1' : '0'}" class="${releaseClasses} text-white rounded-xl px-3 py-1 text-sm" ${releaseDisabled ? 'disabled' : ''}>${releaseLabel}</button>
            <button data-issues="${version}" class="bg-[#008080] text-white rounded-xl px-3 py-1 text-sm">View issues</button>
            <button data-delete="${version}" class="bg-[#e53e3e] text-white rounded-xl px-3 py-1 text-sm">Delete</button>
          </div>`;
        if (highlightVersions.has(version)){
          card.classList.add('matching-highlight');
          if (highlightDuration > 0){
            setTimeout(()=>{ card.classList.remove('matching-highlight'); }, highlightDuration);
          }
        }
        box.appendChild(card);
      });

      box.onclick = async (event)=>{
        const viewBtn = event.target.closest('button[data-view]');
        const releaseBtn = event.target.closest('button[data-release]');
        const issuesBtn = event.target.closest('button[data-issues]');
        const deleteBtn = event.target.closest('button[data-delete]');
        const evAgain = $('#matching-event-select');
        const eventId = evAgain ? evAgain.value : null;
        if (!eventId) return;

        if (viewBtn){
          setBtnLoading(viewBtn, 'Opening...');
          const version = Number(viewBtn.getAttribute('data-view'));
          await loadMatchDetails(version);
          clearBtnLoading(viewBtn);
          return;
        }

        if (releaseBtn){
          const version = Number(releaseBtn.getAttribute('data-release'));
          const finalizedAttr = releaseBtn.getAttribute('data-finalized');
          if (finalizedAttr === '1'){
            if (typeof showDialogConfirm === 'function'){
              const confirmed = await showDialogConfirm(`Unrelease proposal v${version}? This will remove generated plans but keep the proposal.`, {
                title: `Unrelease proposal v${version}`,
                confirmLabel: 'Unrelease',
                tone: 'danger',
                destructive: true,
              });
              if (!confirmed) return;
            }
            setBtnLoading(releaseBtn, 'Unreleasing...');
            const loader = startLoader('Unreleasing...');
            try {
              const resUnrelease = await apiFetch(`/matching/${eventId}/unrelease?version=${version}`, { method: 'POST' });
              if (resUnrelease.ok){
                loader.update('Unreleased');
                await loadProposals();
                if (getDetailsVersion() === version) await loadMatchDetails(version);
              } else {
                const text = await resUnrelease.text().catch(()=> 'Unrelease failed');
                if (typeof showDialogAlert === 'function'){
                  await showDialogAlert(`Failed to unrelease: ${text}`, { tone: 'danger', title: 'Unrelease failed' });
                } else {
                  notify(`Failed to unrelease: ${text}`, { type: 'error' });
                }
              }
            } catch (err){
              const message = err && err.message ? err.message : String(err);
              if (typeof showDialogAlert === 'function'){
                await showDialogAlert(`Failed to unrelease: ${message}`, { tone: 'danger', title: 'Unrelease failed' });
              } else {
                notify(`Failed to unrelease: ${message}`, { type: 'error' });
              }
            } finally {
              loader.close();
              clearBtnLoading(releaseBtn);
            }
          } else {
            if (getUnsaved() && getDetailsVersion() === version){
              notify('Save changes before releasing this proposal.', { type: 'warning' });
              return;
            }
            if (typeof confirmAndReleaseFn === 'function'){
              await confirmAndReleaseFn(eventId, version, releaseBtn);
            } else {
              notify('Release action is unavailable at the moment.', { type: 'error' });
            }
          }
          return;
        }

        if (issuesBtn){
          const version = Number(issuesBtn.getAttribute('data-issues'));
          if (getUnsaved() && version === getDetailsVersion()){
            if (typeof showDialogConfirm === 'function'){
              const proceed = await showDialogConfirm(
                'You have unsaved changes. The issues shown will be based on the last saved state, not your current modifications.\n\nSave your changes first for accurate issue detection.',
                {
                  title: 'Unsaved changes',
                  confirmLabel: 'View issues anyway',
                  cancelLabel: 'Cancel',
                  tone: 'warning',
                }
              );
              if (!proceed) return;
            }
          }
          const card = issuesBtn.closest('.proposal-card');
          if (!card) return;
          const existing = card.querySelector('.issues-panel');
          if (existing){
            existing.remove();
            return;
          }
          const loader = startLoader('Analyzing issues...');
          const resIssues = await apiFetch(`/matching/${eventId}/issues?version=${version}`);
          const payload = await resIssues.json().catch(()=> ({ groups: [], issues: [] }));
          const items = payload.issues || [];
          const count = items.length;
          if (!count){
            loader.update('No issues detected');
            loader.close();
            return;
          }
          if (ensureTeamNamesFn){
            await ensureTeamNamesFn(eventId, version);
          }
          loader.update(`${count} group(s) with issues`);
          loader.close();

          const summaryByIssue = {};
          const ensureEntry = (issue)=>{
            if (!summaryByIssue[issue]){
              summaryByIssue[issue] = { total: 0, teamIds: new Set(), teamNames: new Set() };
            }
            return summaryByIssue[issue];
          };
          items.forEach((it)=>{
            const perIssueCounts = it.issue_counts || {};
            Object.entries(perIssueCounts).forEach(([issue, total])=>{
              const entry = ensureEntry(issue);
              entry.total += Number(total) || 0;
            });
            const actorMap = it.actors || {};
            Object.entries(actorMap).forEach(([issue, actors])=>{
              const entry = ensureEntry(issue);
              (actors || []).forEach((actor)=>{
                if (actor && actor.team_id){
                  const tid = String(actor.team_id);
                  entry.teamIds.add(tid);
                  entry.teamNames.add(labelForTeam(tid, version));
                }
                if (actor && Array.isArray(actor.pair)){
                  actor.pair.forEach((tid)=>{
                    const id = String(tid);
                    entry.teamIds.add(id);
                    entry.teamNames.add(labelForTeam(id, version));
                  });
                }
              });
            });
            if (!Object.keys(perIssueCounts).length && Array.isArray(it.issues)){
              it.issues.forEach((issue)=>{
                const entry = ensureEntry(issue);
                entry.total += 1;
              });
            }
          });

          const panel = document.createElement('div');
          panel.className = 'issues-panel mt-3 rounded-xl border border-[#e2e8f0] bg-white p-3 text-sm shadow-sm space-y-3';

          const header = document.createElement('div');
          header.className = 'flex items-center justify-between gap-2 flex-wrap';
          header.innerHTML = `<span class="font-semibold text-[#111827]">Issues overview</span><span class="text-xs text-[#6b7280]">Proposal v${version}</span>`;
          panel.appendChild(header);

          const summary = document.createElement('div');
          summary.className = 'flex flex-wrap gap-2';
          Object.entries(summaryByIssue)
            .map(([issue, entry])=>{
              const teamCount = entry.teamIds ? entry.teamIds.size : 0;
              const names = entry.teamNames ? Array.from(entry.teamNames).filter(Boolean) : [];
              const total = entry.total || teamCount;
              return [issue, { total, uniqueTeams: teamCount || null, teamNames: names }];
            })
            .filter(([, info])=> info.total > 0)
            .sort((a, b)=> (b[1].total - a[1].total))
            .forEach(([issue, info])=>{
              summary.appendChild(buildIssueChip(issue, info));
            });
          if (!summary.children.length){
            const empty = document.createElement('span');
            empty.className = 'text-xs text-[#64748b]';
            empty.textContent = 'No grouped issues reported.';
            summary.appendChild(empty);
          }
          panel.appendChild(summary);

          const list = document.createElement('div');
          list.className = 'space-y-2 max-h-60 overflow-auto pr-1';
          items.forEach((item)=>{
            list.appendChild(buildIssueCard(item, version));
          });
          panel.appendChild(list);

          card.appendChild(panel);
          return;
        }

        if (deleteBtn){
          const version = Number(deleteBtn.getAttribute('data-delete'));
          let confirmed = true;
          if (typeof showDialogConfirm === 'function'){
            confirmed = await showDialogConfirm(`Delete proposal v${version}?`, {
              title: 'Delete proposal',
              confirmLabel: 'Delete',
              tone: 'danger',
              destructive: true,
            });
          }
          if (!confirmed) return;
          const response = await apiFetch(`/matching/${eventId}/matches?version=${version}`, { method: 'DELETE' });
          if (response.ok){
            await loadProposals();
            if (getDetailsVersion() === version){
              await loadMatchDetails();
            }
          } else {
            const text = await response.text();
            if (typeof showDialogAlert === 'function'){
              await showDialogAlert(`Failed to delete: ${text}`, { tone: 'danger', title: 'Delete proposal failed' });
            } else {
              notify(`Failed to delete: ${text}`, { type: 'error' });
            }
          }
        }
      };
    }

    function updateState(next){
      if (next){
        if (typeof next.ensureTeamNames === 'function') ensureTeamNamesFn = next.ensureTeamNames;
        if (typeof next.confirmAndRelease === 'function' || next.confirmAndRelease === null){
          confirmAndReleaseFn = next.confirmAndRelease;
        }
        if (typeof next.createIssueChip === 'function' || next.createIssueChip === null){
          createIssueChipFn = next.createIssueChip;
        }
        if (typeof next.createIssueCard === 'function' || next.createIssueCard === null){
          createIssueCardFn = next.createIssueCard;
        }
        if (typeof next.getTeamLabel === 'function' || next.getTeamLabel === null){
          getTeamLabelFn = next.getTeamLabel || (()=> 'Team');
        }
      }
    }

    return {
      loadProposals,
      updateState,
    };
  };
})();
