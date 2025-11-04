(function(){
  if (typeof window === 'undefined') return;
  const root = window.dhAdminDashboard = window.dhAdminDashboard || {};

  root.createMatchingModule = function createMatchingModule(context){
    const {
      apiFetch,
      toast,
      toastLoading,
      showDialogConfirm,
      getTeamLabel,
      versionKey,
      updateTeamNameCache,
      getTeamNamesCache = ()=> ({}),
      setBtnLoading = ()=>{},
      clearBtnLoading = ()=>{},
  loadEvents = async ()=>{},
      loadProposals = async ()=>{},
      loadMatchDetails = async ()=>{},
    } = context || {};

    if (typeof apiFetch !== 'function'){
      return null;
    }

    async function ensureTeamNames(evId, version){
      const cache = getTeamNamesCache() || {};
      const key = versionKey(version);
      if (cache[key]) return cache[key];
      const params = version != null ? `?version=${encodeURIComponent(version)}` : '';
      try {
        const res = await apiFetch(`/matching/${evId}/details${params}`);
        if (!res.ok) return null;
        const data = await res.json().catch(()=> null);
        if (!data || !data.team_details) return null;
        return updateTeamNameCache(data.version, data.team_details);
      } catch (err){
        return null;
      }
    }

    async function confirmAndRelease(evId, version, btn){
      if (!evId || version == null){
        if (typeof toast === 'function'){
          toast('No proposal loaded to release.', { type: 'warning' });
        }
        return false;
      }
      const button = btn || null;
      const baseMsg = `Release proposal v${version}?`;
      if (button) setBtnLoading(button, 'Checking...');
      let prompt = baseMsg;
      try {
        await ensureTeamNames(evId, version);
        const res = await apiFetch(`/matching/${evId}/issues?version=${version}`);
        const data = await res.json().catch(()=> ({ issues: [] }));
        const items = Array.isArray(data.issues) ? data.issues : [];
        if (items.length){
          const counts = {};
          items.forEach((entry)=>{ (entry.issues || []).forEach((kind)=>{ counts[kind] = (counts[kind] || 0) + 1; }); });
          const summary = Object.entries(counts)
            .map(([kind, total])=> `- ${kind.replace(/_/g, ' ')}: ${total}`)
            .join('\n');
          const sample = items.slice(0, 5).map((entry)=>{
            const group = entry.group || {};
            const hostLabel = getTeamLabel(group.host_team_id, version);
            const guestLabels = (group.guest_team_ids || []).map((id)=> getTeamLabel(id, version)).join(', ') || '—';
            const tags = (entry.issues || []).map((k)=> k.replace(/_/g, ' ')).join(', ');
            return `• ${group.phase || '?'} host ${hostLabel} → guests ${guestLabels} (${tags})`;
          }).join('\n');
          prompt = `${baseMsg}\n\nMatching issues detected:\n${summary}${sample ? `\n\nExamples:\n${sample}` : ''}`;
          if (items.length > 5){
            prompt += `\n...and ${items.length - 5} more group(s)`;
          }
        } else {
          prompt = `${baseMsg}\n\nNo matching issues detected.`;
        }
      } catch (err){
        prompt = `${baseMsg}\n\n(Unable to fetch matching issues. Proceed anyway?)`;
      }
      if (button) clearBtnLoading(button);
      const confirmed = await showDialogConfirm(prompt, {
        title: `Release proposal v${version}`,
        confirmLabel: 'Release',
        tone: 'warning',
      });
      if (!confirmed) return false;
      if (button) setBtnLoading(button, 'Releasing...');
      const loader = toastLoading ? toastLoading('Releasing final plan...') : { update() {}, close() {} };
      try {
        const res = await apiFetch(`/matching/${evId}/finalize?version=${version}`, { method: 'POST' });
        if (res.ok){
          if (loader && typeof loader.update === 'function') loader.update('Plan released');
          await loadEvents();
          await loadProposals({ highlightVersion: version, highlightDuration: 4000 });
          await loadMatchDetails(version);
          return true;
        }
        const txt = await res.text().catch(()=> 'Release failed');
        if (loader && typeof loader.update === 'function') loader.update('Release error');
        if (typeof toast === 'function'){
          toast(txt || 'Release failed', { type: 'error' });
        }
        return false;
      } catch (err){
        if (loader && typeof loader.update === 'function') loader.update('Release error');
        if (typeof toast === 'function'){
          toast(`Release failed: ${err?.message || err}`, { type: 'error' });
        }
        return false;
      } finally {
        if (loader && typeof loader.close === 'function') loader.close();
        if (button) clearBtnLoading(button);
      }
    }

    function updateState(next){
      if (!next) return;
      if (typeof next.getTeamLabel === 'function'){
        context.getTeamLabel = next.getTeamLabel;
      }
    }

    return {
      ensureTeamNames,
      confirmAndRelease,
      updateState,
    };
  };
})();
