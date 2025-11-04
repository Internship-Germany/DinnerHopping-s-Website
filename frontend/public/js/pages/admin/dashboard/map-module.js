(function(){
  if (typeof window === 'undefined') return;
  const root = window.dhAdminDashboard = window.dhAdminDashboard || {};

  root.createMapModule = function createMapModule(context){
    const {
      $,
      apiFetch,
      toast,
      toastLoading,
      getDetailsVersion = ()=> null,
      L: leafletInstance,
    } = context || {};

    if (typeof $ !== 'function' || typeof apiFetch !== 'function'){
      return null;
    }

    const leaflet = leafletInstance || (typeof window !== 'undefined' ? window.L : null);
    if (!leaflet){
      if (typeof console !== 'undefined' && console.warn){
        console.warn('[DinnerHopping] Leaflet not available for map module.');
      }
      return null;
    }

    const state = {
      mainMap: null,
      mainLayers: [],
      teamMap: null,
      teamLayers: [],
      teamMapCurrentId: null,
      mapsBound: false,
      teamBtnsBound: false,
    };

    function noopLoader(){
      return {
        update(){},
        close(){},
      };
    }

    function startLoader(label){
      return typeof toastLoading === 'function' ? toastLoading(label) : noopLoader();
    }

    function notify(message, options){
      if (typeof toast === 'function'){
        toast(message, options);
      }
    }

    function ensureMainMap(){
      if (state.mainMap) return state.mainMap;
      const el = $('#travel-map');
      if (!el) return null;
      state.mainMap = leaflet.map(el).setView([51.0, 9.0], 6);
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(state.mainMap);
      return state.mainMap;
    }

    function ensureTeamMap(){
      if (state.teamMap) return state.teamMap;
      const el = $('#team-map');
      if (!el) return null;
      state.teamMap = leaflet.map(el).setView([51.0, 9.0], 7);
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(state.teamMap);
      return state.teamMap;
    }

    function clearLayers(layers){
      layers.forEach((layer)=>{
        try {
          layer.remove();
        } catch (err){
          /* ignore layer removal errors */
        }
      });
      layers.length = 0;
    }

    function phaseColor(phase){
      switch (phase){
        case 'appetizer': return '#059669';
        case 'main': return '#f97316';
        case 'dessert': return '#f59e0b';
        case 'after_party': return '#7c3aed';
        default: return '#6b7280';
      }
    }

    function drawLegend(container){
      const target = container || $('#map-legend');
      if (!target) return;
      target.innerHTML = '';
      const items = [
        { color: '#059669', label: 'Appetizer' },
        { color: '#f97316', label: 'Main' },
        { color: '#f59e0b', label: 'Dessert' },
        { color: '#7c3aed', label: 'After party' },
      ];
      items.forEach((item)=>{
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 text-sm';
        const swatch = document.createElement('span');
        swatch.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:9999px;background:${item.color}`;
        row.appendChild(swatch);
        const label = document.createElement('span');
        label.textContent = item.label;
        row.appendChild(label);
        target.appendChild(row);
      });
    }

    function drawPathsOn(map, dataPoints, dataGeom, layers){
      const tp = (dataPoints && dataPoints.team_paths) || {};
      const bounds = dataPoints && dataPoints.bounds;
      const afterParty = dataPoints && dataPoints.after_party;
      const colors = ['#e11d48', '#1d4ed8', '#059669', '#f59e0b', '#7c3aed', '#f43f5e', '#0ea5e9', '#10b981', '#f97316'];
      let colorIdx = 0;
      for (const [tid, rec] of Object.entries(tp)){
        const pts = (rec.points || []).filter((p)=> typeof p.lat === 'number' && typeof p.lon === 'number');
        if (pts.length < 1) continue;
        const color = colors[colorIdx++ % colors.length];
        const geomRec = dataGeom && dataGeom.team_geometries && dataGeom.team_geometries[tid];
        if (geomRec && Array.isArray(geomRec.segments) && geomRec.segments.length){
          geomRec.segments.forEach((segment)=>{
            const poly = leaflet.polyline(segment, { color, weight: 3, opacity: 0.85 }).addTo(map);
            layers.push(poly);
          });
        } else {
          const latlngs = pts.map((p)=> [p.lat, p.lon]);
          if (latlngs.length >= 2){
            const poly = leaflet.polyline(latlngs, { color, weight: 3, opacity: 0.8, dashArray: '6 6' }).addTo(map);
            layers.push(poly);
          }
        }
        pts.forEach((p)=>{
          const markerColor = phaseColor(p.phase);
          const marker = leaflet.circleMarker([p.lat, p.lon], { radius: 5, color: markerColor, fillColor: markerColor, fillOpacity: 0.95, weight: 1 }).addTo(map);
          marker.bindTooltip(`${p.phase}`, { permanent: false, direction: 'top', offset: [0, -4] });
          layers.push(marker);
        });
      }
      if (afterParty && typeof afterParty.lat === 'number' && typeof afterParty.lon === 'number'){
        const ap = leaflet.circleMarker([afterParty.lat, afterParty.lon], { radius: 6, color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 1, weight: 2 }).addTo(map);
        ap.bindTooltip('After party', { permanent: false, direction: 'top', offset: [0, -4] });
        layers.push(ap);
      }
      if (bounds && Number.isFinite(bounds.min_lat) && Number.isFinite(bounds.min_lon) && Number.isFinite(bounds.max_lat) && Number.isFinite(bounds.max_lon)){
        try {
          map.fitBounds([[bounds.min_lat, bounds.min_lon], [bounds.max_lat, bounds.max_lon]], { padding: [20, 20] });
        } catch (err){
          /* ignore fitBounds errors */
        }
      }
      drawLegend();
    }

    function buildVersionQuery(){
      const version = getDetailsVersion();
      return (typeof version === 'number' && !Number.isNaN(version)) ? `version=${encodeURIComponent(version)}` : '';
    }

    async function loadTravelMapAll(){
      const map = ensureMainMap();
      if (!map) return;
      const evSelect = $('#map-event-select');
      const matchingSelect = $('#matching-event-select');
      const evId = (evSelect && evSelect.value) || (matchingSelect && matchingSelect.value) || null;
      if (!evId) return;
      const realCheckbox = $('#map-real-route');
      const useReal = !!(realCheckbox && realCheckbox.checked);
      const msg = $('#map-msg');
      if (msg) msg.textContent = 'Loading...';
      const loader = startLoader('Loading map...');
      clearLayers(state.mainLayers);
      const vq = buildVersionQuery();
      try {
        const baseUrl = `/matching/${evId}/paths${vq ? `?${vq}` : ''}`;
        const [pointsRes, geomRes] = await Promise.all([
          apiFetch(baseUrl + `${vq ? '&' : '?'}fast=1`),
          useReal ? apiFetch(`/matching/${evId}/paths/geometry${vq ? `?${vq}` : ''}`) : Promise.resolve({ ok: false }),
        ]);
        if (!pointsRes.ok){
          if (msg) msg.textContent = 'No data.';
          notify(`Map: error ${pointsRes.status}`, { type: 'warning' });
          loader.update('Load error');
          return;
        }
        const dataPoints = await pointsRes.json().catch(()=> ({ team_paths: {}, bounds: null }));
        const dataGeom = useReal && geomRes.ok ? await geomRes.json().catch(()=> null) : null;
        drawPathsOn(map, dataPoints, dataGeom, state.mainLayers);
        const has = Object.keys(dataPoints.team_paths || {}).length;
        if (msg) msg.textContent = has ? 'Done.' : 'No data.';
        loader.update(has ? 'Map ready' : 'No data');
      } catch (err){
        notify('Unable to load travel map.', { type: 'error' });
        if (msg) msg.textContent = 'Error.';
        loader.update('Load error');
      } finally {
        loader.close();
      }
    }

    async function loadTravelMapFiltered(){
      const map = ensureMainMap();
      if (!map) return;
      const evSelect = $('#map-event-select');
      const matchingSelect = $('#matching-event-select');
      const evId = (evSelect && evSelect.value) || (matchingSelect && matchingSelect.value) || null;
      if (!evId) return;
      const realCheckbox = $('#map-real-route');
      const useReal = !!(realCheckbox && realCheckbox.checked);
      const idsInput = $('#map-team-ids');
      const idsString = idsInput ? idsInput.value : '';
      const ids = idsString.split(',').map((s)=> s.trim()).filter(Boolean).join(',');
      const msg = $('#map-msg');
      if (msg) msg.textContent = 'Loading...';
      const loader = startLoader('Loading selected paths...');
      clearLayers(state.mainLayers);
      const vq = buildVersionQuery();
      try {
        const base = `/matching/${evId}/paths${vq ? `?${vq}` : ''}${ids ? `${vq ? '&' : '?'}ids=${encodeURIComponent(ids)}` : ''}`;
        const [pointsRes, geomRes] = await Promise.all([
          apiFetch(base + `${(vq || ids) ? '&' : '?'}fast=1`),
          useReal ? apiFetch(`/matching/${evId}/paths/geometry${vq ? `?${vq}` : ''}${ids ? `${vq ? '&' : '?'}ids=${encodeURIComponent(ids)}` : ''}`) : Promise.resolve({ ok: false }),
        ]);
        if (!pointsRes.ok){
          if (msg) msg.textContent = 'No data.';
          notify(`Map: error ${pointsRes.status}`, { type: 'warning' });
          loader.update('Load error');
          return;
        }
        const dataPoints = await pointsRes.json().catch(()=> ({ team_paths: {}, bounds: null }));
        const dataGeom = useReal && geomRes.ok ? await geomRes.json().catch(()=> null) : null;
        drawPathsOn(map, dataPoints, dataGeom, state.mainLayers);
        const has = Object.keys(dataPoints.team_paths || {}).length;
        if (msg) msg.textContent = has ? 'Done.' : 'No data.';
        loader.update(has ? 'Map ready' : 'No data');
      } catch (err){
        notify('Unable to load selected paths.', { type: 'error' });
        if (msg) msg.textContent = 'Error.';
        loader.update('Load error');
      } finally {
        loader.close();
      }
    }

    async function openTeamMap(teamId){
      if (!teamId) return;
      state.teamMapCurrentId = teamId;
      const modal = $('#team-map-modal');
      if (!modal) return;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      try {
        document.body.style.overflow = 'hidden';
      } catch (err){
        /* ignore body overflow errors */
      }
      const map = ensureTeamMap();
      if (!map) return;
      await refreshTeamMap();
    }

    async function refreshTeamMap(){
      if (!state.teamMapCurrentId) return;
      const map = ensureTeamMap();
      if (!map) return;
      const matchingSelect = $('#matching-event-select');
      const evId = matchingSelect ? matchingSelect.value : null;
      if (!evId) return;
      const realCheckbox = $('#team-map-real');
      const useReal = !!(realCheckbox && realCheckbox.checked);
      const msg = $('#team-map-msg');
      if (msg) msg.textContent = 'Loading...';
      const loader = startLoader('Loading team path...');
      clearLayers(state.teamLayers);
      const ids = encodeURIComponent(state.teamMapCurrentId);
      const vq = buildVersionQuery();
      try {
        const pathsEndpoint = `/matching/${evId}/paths${vq ? `?${vq}` : ''}&fast=1&ids=${ids}`.replace('?&', '?');
        const geomEndpoint = `/matching/${evId}/paths/geometry${vq ? `?${vq}` : ''}&ids=${ids}`.replace('?&', '?');
        const [pointsRes, geomRes] = await Promise.all([
          apiFetch(pathsEndpoint),
          useReal ? apiFetch(geomEndpoint) : Promise.resolve({ ok: false }),
        ]);
        if (!pointsRes.ok){
          if (msg) msg.textContent = 'No data.';
          notify(`Team path: error ${pointsRes.status}`, { type: 'warning' });
          loader.update('Load error');
          return;
        }
        const dataPoints = await pointsRes.json().catch(()=> ({ team_paths: {}, bounds: null }));
        const dataGeom = useReal && geomRes.ok ? await geomRes.json().catch(()=> null) : null;
        drawPathsOn(map, dataPoints, dataGeom, state.teamLayers);
        const ok = dataPoints.team_paths && dataPoints.team_paths[state.teamMapCurrentId];
        if (msg) msg.textContent = ok ? 'Done.' : 'No data.';
        loader.update(ok ? 'Path ready' : 'No data');
      } catch (err){
        notify('Unable to load team path.', { type: 'error' });
        if (msg) msg.textContent = 'Error.';
        loader.update('Load error');
      } finally {
        loader.close();
      }
    }

    function bindMaps(){
      if (state.mapsBound) return;
      const allBtn = $('#btn-map-all');
      if (allBtn){
        allBtn.addEventListener('click', (event)=>{
          event.preventDefault();
          loadTravelMapAll();
        });
      }
      const loadBtn = $('#btn-map-load');
      if (loadBtn){
        loadBtn.addEventListener('click', async (event)=>{
          event.preventDefault();
          const idsInput = $('#map-team-ids');
          const ids = idsInput ? idsInput.value.trim() : '';
          if (ids){
            await loadTravelMapFiltered();
          } else {
            await loadTravelMapAll();
          }
        });
      }
      const closeBtn = $('#team-map-close');
      if (closeBtn){
        closeBtn.addEventListener('click', ()=>{
          const modal = $('#team-map-modal');
          if (!modal) return;
          modal.classList.add('hidden');
          modal.classList.remove('flex');
          try {
            document.body.style.overflow = '';
          } catch (err){
            /* ignore body overflow restore errors */
          }
        });
      }
      const refreshBtn = $('#team-map-refresh');
      if (refreshBtn){
        refreshBtn.addEventListener('click', (event)=>{
          event.preventDefault();
          refreshTeamMap();
        });
      }
      state.mapsBound = true;
    }

    function bindTeamMapButtons(){
      const rootEl = $('#match-details');
      if (!rootEl || state.teamBtnsBound) return;
      rootEl.addEventListener('click', async (event)=>{
        const btn = event.target.closest('.team-map-btn');
        if (!btn || !rootEl.contains(btn)) return;
        const teamId = btn.getAttribute('data-team-id');
        await openTeamMap(teamId);
      });
      state.teamBtnsBound = true;
    }

    function updateState(next){
      if (next && Object.prototype.hasOwnProperty.call(next, 'teamMapCurrentId')){
        state.teamMapCurrentId = next.teamMapCurrentId;
      }
      if (next && Object.prototype.hasOwnProperty.call(next, 'detailsVersion')){
        // No direct map state to reset for version changes yet, but hook kept for future use.
      }
    }

    return {
      bindMaps,
      bindTeamMapButtons,
      drawLegend,
      loadTravelMapAll,
      loadTravelMapFiltered,
      openTeamMap,
      refreshTeamMap,
      updateState,
    };
  };
})();
