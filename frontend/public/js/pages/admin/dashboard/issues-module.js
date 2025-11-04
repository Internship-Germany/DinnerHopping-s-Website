(function(){
  if (typeof window === 'undefined') return;
  const root = window.dhAdminDashboard = window.dhAdminDashboard || {};

  root.createIssuesModule = function createIssuesModule(context){
    const initial = context || {};
    let getTeamLabel = (typeof initial.getTeamLabel === 'function')
      ? initial.getTeamLabel
      : ((teamId)=> (teamId != null ? `Team ${teamId}` : 'Team'));

    const ISSUE_METADATA = {
      payment_missing: { label: 'Missing payment', description: 'At least one team assigned to this group has not completed payment.', tone: 'error' },
      payment_partial: { label: 'Partial payment', description: 'A team recorded a partial payment; verify before confirmation.', tone: 'warning' },
      faulty_team_cancelled: { label: 'Cancelled team', description: 'A cancelled team is still assigned in this proposal.', tone: 'error' },
      team_incomplete: { label: 'Incomplete team', description: 'A team has missing participants or required information.', tone: 'warning' },
      uncovered_allergy: { label: 'Uncovered allergy', description: 'Some guest allergies are not covered by the host.', tone: 'error' },
      capacity_mismatch: { label: 'Capacity mismatch', description: 'The assigned host cannot serve the current number of guests.', tone: 'warning' },
      duplicate_pair: { label: 'Duplicate encounter', description: 'Teams meet more than once across phases.', tone: 'warning' },
      diet_conflict: { label: 'Diet conflict', description: 'Host/guest dietary preferences are incompatible.', tone: 'warning' },
      registration_missing: { label: 'Missing registration', description: 'Active registrations are not included in the proposal.', tone: 'error' },
      phase_participation_gap: { label: 'Missing phase participation', description: 'Teams are absent from one or more meal phases.', tone: 'error' },
    };

    const ISSUE_TONE_STYLES = {
      error: { chipBg: '#fee2e2', chipText: '#7f1d1d', chipBorder: '#fecaca', cardBg: '#fff5f5', cardBorder: '#fecaca', accent: '#dc2626' },
      warning: { chipBg: '#fef3c7', chipText: '#92400e', chipBorder: '#fde68a', cardBg: '#fffbeb', cardBorder: '#fde68a', accent: '#f59e0b' },
      info: { chipBg: '#dbeafe', chipText: '#1d4ed8', chipBorder: '#bfdbfe', cardBg: '#eff6ff', cardBorder: '#bfdbfe', accent: '#2563eb' },
      neutral: { chipBg: '#e2e8f0', chipText: '#334155', chipBorder: '#cbd5f5', cardBg: '#f8fafc', cardBorder: '#e2e8f0', accent: '#94a3b8' },
    };

    const ISSUE_TONE_RANK = { neutral: 0, info: 1, warning: 2, error: 3 };

    function updateState(next){
      if (next && typeof next.getTeamLabel === 'function'){
        getTeamLabel = next.getTeamLabel;
      }
    }

    function resolveIssueMeta(type){
      const key = typeof type === 'string' && type.length ? type : 'issue';
      if (ISSUE_METADATA[key]) return ISSUE_METADATA[key];
      return {
        label: key.replace(/_/g, ' '),
        description: 'See detailed logs for more information.',
        tone: 'info',
      };
    }

    function toneForIssues(issueTypes){
      if (!Array.isArray(issueTypes) || issueTypes.length === 0) return 'neutral';
      let selected = 'neutral';
      let best = -1;
      issueTypes.forEach((type)=>{
        const tone = resolveIssueMeta(type).tone || 'neutral';
        const rank = ISSUE_TONE_RANK[tone] != null ? ISSUE_TONE_RANK[tone] : ISSUE_TONE_RANK.neutral;
        if (rank > best){
          best = rank;
          selected = tone;
        }
      });
      return selected;
    }

    function createIssueChip(type, stats){
      const meta = resolveIssueMeta(type);
      const tone = meta.tone || 'neutral';
      const styles = ISSUE_TONE_STYLES[tone] || ISSUE_TONE_STYLES.neutral;
      const chip = document.createElement('span');
      chip.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shadow-sm';
      chip.style.background = styles.chipBg;
      chip.style.color = styles.chipText;
      chip.style.border = `1px solid ${styles.chipBorder}`;
      const total = typeof stats === 'number' ? stats : Number((stats && stats.total) || 0);
      const unique = (stats && typeof stats === 'object' && stats.uniqueTeams != null) ? Number(stats.uniqueTeams) : Number.NaN;
      const sameCount = Number.isFinite(unique) && unique > 0 && unique !== total ? ` (${unique} team${unique > 1 ? 's' : ''})` : '';
      chip.textContent = `${meta.label}: ${total}${sameCount}`;
      const teamNames = (stats && typeof stats === 'object' && Array.isArray(stats.teamNames)) ? stats.teamNames : [];
      const tooltipParts = [meta.description];
      if (teamNames.length){
        const display = teamNames.slice(0, 8);
        const remaining = teamNames.length - display.length;
        if (remaining > 0){
          display.push(`…+${remaining}`);
        }
        tooltipParts.push(`Teams: ${display.join(', ')}`);
      }
      chip.title = tooltipParts.filter(Boolean).join('\n');
      return chip;
    }

    function createIssueCard(item, version){
      const group = item && item.group ? item.group : {};
      const issueTypes = Array.isArray(item && item.issues) ? item.issues : [];
      const tone = toneForIssues(issueTypes);
      const styles = ISSUE_TONE_STYLES[tone] || ISSUE_TONE_STYLES.neutral;
      const card = document.createElement('div');
      card.className = 'issue-item rounded-xl border p-3 text-xs space-y-2 shadow-sm';
      card.style.background = styles.cardBg;
      card.style.borderColor = styles.cardBorder;
      card.style.borderLeftWidth = '4px';
      card.style.borderLeftStyle = 'solid';
      card.style.borderLeftColor = styles.accent;

      const phase = document.createElement('div');
      phase.className = 'font-semibold text-[#1f2937] uppercase tracking-wide text-[11px]';
      phase.textContent = group.phase ? group.phase : 'Unknown phase';
      card.appendChild(phase);

      const hostName = getTeamLabel(group.host_team_id, version);
      const hostLine = document.createElement('div');
      hostLine.className = 'text-[#1f2937]';
      hostLine.innerHTML = `<span class="font-medium">Host</span>: ${hostName}`;
      card.appendChild(hostLine);

      const guestNames = Array.isArray(group.guest_team_ids) ? group.guest_team_ids.map((id)=> getTeamLabel(id, version)) : [];
      const guestLine = document.createElement('div');
      guestLine.className = 'text-[#334155]';
      guestLine.innerHTML = `<span class="font-medium">Guests</span>: ${guestNames.length ? guestNames.join(', ') : '—'}`;
      card.appendChild(guestLine);

      if (issueTypes.length){
        const list = document.createElement('ul');
        list.style.paddingLeft = '16px';
        list.style.color = '#334155';
        list.style.marginTop = '4px';
        issueTypes.forEach((type)=>{
          const meta = resolveIssueMeta(type);
          const li = document.createElement('li');
          const base = document.createElement('div');
          base.textContent = `${meta.label} – ${meta.description}`;
          li.appendChild(base);
          const actorEntries = (item && item.actors && item.actors[type]) || [];
          const details = [];
          actorEntries.forEach((entry)=>{
            if (entry && Array.isArray(entry.pair)){
              const names = entry.pair.map((id)=> getTeamLabel(id, version));
              const count = entry.total ? ` (${entry.total} encounters)` : '';
              details.push(`${names.join(' ↔ ')}${count}`);
              return;
            }
            if (entry && entry.team_id){
              const name = getTeamLabel(entry.team_id, version);
              let label = entry.role === 'host' ? `Host ${name}` : (entry.role === 'guest' ? `Guest ${name}` : name);
              if (Array.isArray(entry.allergies) && entry.allergies.length){
                label += ` – ${entry.allergies.join(', ')}`;
              }
              if (entry.warning){
                label += ` (${String(entry.warning).replace(/_/g, ' ')})`;
              }
              if (Array.isArray(entry.missing_phases) && entry.missing_phases.length){
                label += ` – Missing phases: ${entry.missing_phases.join(', ')}`;
              }
              if (Array.isArray(entry.missing_emails) && entry.missing_emails.length){
                label += ` – Missing participants: ${entry.missing_emails.join(', ')}`;
              }
              if (Array.isArray(entry.missing_unit_ids) && entry.missing_unit_ids.length){
                label += ` – Units: ${entry.missing_unit_ids.join(', ')}`;
              }
              details.push(label);
            }
          });
          if (details.length){
            const sub = document.createElement('ul');
            sub.className = 'ml-4 list-disc text-[#1f2937]';
            details.forEach((text)=>{
              const subLi = document.createElement('li');
              subLi.textContent = text;
              sub.appendChild(subLi);
            });
            li.appendChild(sub);
          }
          list.appendChild(li);
        });
        card.appendChild(list);
      }

      if (Array.isArray(group.warnings) && group.warnings.length){
        const warn = document.createElement('div');
        warn.className = 'text-[#ca8a04]';
        warn.textContent = `Warnings: ${group.warnings.join(', ')}`;
        card.appendChild(warn);
      }

      return card;
    }

    return {
      updateState,
      resolveIssueMeta,
      toneForIssues,
      createIssueChip,
      createIssueCard,
    };
  };
})();
