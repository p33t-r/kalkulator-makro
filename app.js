    const MEALS_CONFIG = [
      { id: 'breakfast', name: 'Śniadanie' },
      { id: 'lunch', name: 'Obiad' },
      { id: 'dinner', name: 'Kolacja' },
      { id: 'snacks', name: 'Przekąski / Napoje / Inne' }
    ];

    const UNITS = ['g', 'szt', 'ml', 'łyżeczka', 'łyżka', 'plaster', 'szklanka', 'porcja'];

    let state = {
      apiKey: localStorage.getItem('gemini_api_key') || '',
      targets: JSON.parse(localStorage.getItem('macro_targets')) || { kcal: 2000, p: 150, f: 70, c: 200, fib: 30 },
      meals: JSON.parse(localStorage.getItem('daily_meals_data')) || {},
      customIngredients: JSON.parse(localStorage.getItem('custom_ingredients_list')) || [],
      savedPresets: JSON.parse(localStorage.getItem('saved_presets_db')) || {},
      aiIngredients: JSON.parse(localStorage.getItem('ai_ingredients_db')) || {},
      mealsHistory: JSON.parse(localStorage.getItem('meals_history')) || [],
      dailyHistory: JSON.parse(localStorage.getItem('daily_history')) || []
    };

    let activeHistoryMealId = null;
    let activeTargetPicker = null;
    let openManualBoxes = {}; // Przechowuje stan otwartych pól edycji ręcznej składników { 'mealId-idx': true }

    function getTodayDateString() {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function checkAndResetDailyData() {
      const today = getTodayDateString();
      const lastActiveDate = localStorage.getItem('last_active_date');

      if (lastActiveDate !== today) {
        MEALS_CONFIG.forEach(m => {
          state.meals[m.id] = [{ name: '', amount: '', unit: 'g', kcal: 0, p: 0, f: 0, c: 0, fib: 0, manual: false, locked: false }];
        });
        localStorage.setItem('daily_meals_data', JSON.stringify(state.meals));
        localStorage.setItem('last_active_date', today);
      }
    }

    function init() {
      if (!state.apiKey) openModal('settings-modal');
      
      checkAndResetDailyData();

      MEALS_CONFIG.forEach(mealCfg => {
        if (!state.meals[mealCfg.id] || !Array.isArray(state.meals[mealCfg.id])) {
          state.meals[mealCfg.id] = [{ name: '', amount: '', unit: 'g', kcal: 0, p: 0, f: 0, c: 0, fib: 0, manual: false, locked: false }];
        } else {
          state.meals[mealCfg.id] = state.meals[mealCfg.id].filter(item => item.name || item.amount);
          if (state.meals[mealCfg.id].length === 0) {
            state.meals[mealCfg.id] = [{ name: '', amount: '', unit: 'g', kcal: 0, p: 0, f: 0, c: 0, fib: 0, manual: false, locked: false }];
          }
        }
      });

      let savedProfile = null;
      try {
        savedProfile = JSON.parse(localStorage.getItem('user_profile') || 'null');
      } catch (err) {
        savedProfile = null;
      }
      applyProfileToForm(savedProfile);
      renderTargets();
      updateIngredientsDatalist();
      renderMeals();
      renderHistoryAndChart();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkAndResetDailyData();
        renderMeals();
      }
    });

    function toggleProfile() {
      const el = document.getElementById('profile-details');
      el.style.display = el.style.display === 'block' ? 'none' : 'block';
    }

    function setManualCalorieTarget() {
      const kcalVal = parseFloat(document.getElementById('manual-kcal-input').value);
      if (!kcalVal || kcalVal <= 0) {
        alert("Wpisz poprawną wartość kalorii!");
        return;
      }

      const pGrams = Math.round((kcalVal * 0.25) / 4);
      const fGrams = Math.round((kcalVal * 0.30) / 9);
      const cGrams = Math.round((kcalVal * 0.45) / 4);
      const fibGrams = 30;

      state.targets = { kcal: kcalVal, p: pGrams, f: fGrams, c: cGrams, fib: fibGrams };
      localStorage.setItem('macro_targets', JSON.stringify(state.targets));
      renderTargets();
      renderMeals();
      toggleProfile();
    }

    function saveManualFullTargets() {
      const kcal = parseFloat(document.getElementById('manual-kcal-input').value) || 0;
      const p = parseFloat(document.getElementById('manual-p-input').value) || 0;
      const f = parseFloat(document.getElementById('manual-f-input').value) || 0;
      const c = parseFloat(document.getElementById('manual-c-input').value) || 0;
      const fib = parseFloat(document.getElementById('manual-fib-input').value) || 25;

      if (!kcal || !p || !f || !c) {
        alert("Wypełnij pola dla kalorii oraz makroskładników!");
        return;
      }

      state.targets = { kcal, p, f, c, fib };
      localStorage.setItem('macro_targets', JSON.stringify(state.targets));
      renderTargets();
      renderMeals();
      toggleProfile();
    }

    function renderTargets() {
      document.getElementById('target-kcal').innerText = `/ ${state.targets.kcal}`;
      document.getElementById('target-p').innerText = `/ ${state.targets.p}g`;
      document.getElementById('target-f').innerText = `/ ${state.targets.f}g`;
      document.getElementById('target-c').innerText = `/ ${state.targets.c}g`;
      document.getElementById('target-fib').innerText = `/ ${state.targets.fib || 30}g`;

      document.getElementById('manual-kcal-input').value = state.targets.kcal;
      document.getElementById('manual-p-input').value = state.targets.p;
      document.getElementById('manual-f-input').value = state.targets.f;
      document.getElementById('manual-c-input').value = state.targets.c;
      document.getElementById('manual-fib-input').value = state.targets.fib || 30;
    }

    function updateIngredientsDatalist() {
      const datalist = document.getElementById('saved-ingredients-list');
      if (!datalist) return;
      datalist.innerHTML = state.customIngredients.map(item => `<option value="${item}">`).join('');
    }

    function saveNewIngredientName(name) {
      const cleanName = name.trim();
      if (cleanName && !state.customIngredients.includes(cleanName)) {
        state.customIngredients.push(cleanName);
        state.customIngredients.sort();
        localStorage.setItem('custom_ingredients_list', JSON.stringify(state.customIngredients));
        updateIngredientsDatalist();
      }
    }

    function updateGauge(type, current, target) {
      const fillEl = document.getElementById(`gauge-fill-${type}`);
      if (!fillEl || !target) return;

      const percent = Math.min(Math.round((current / target) * 100), 100);
      fillEl.setAttribute('stroke-dasharray', `${percent}, 100`);

      const ratio = current / target;
      if (ratio > 1.15) {
        fillEl.style.stroke = 'var(--danger)';
      } else if (ratio >= 0.85 && ratio <= 1.15) {
        fillEl.style.stroke = 'var(--success)';
      } else {
        if (type === 'kcal') fillEl.style.stroke = '#fca5a5'; // Jasnoczerwony dla kcal
        else if (type === 'p') fillEl.style.stroke = '#38bdf8'; // Niebieski dla białka
        else if (type === 'f') fillEl.style.stroke = '#fdba74'; // Pomarańczowy dla tłuszczu
        else if (type === 'c') fillEl.style.stroke = '#86efac'; // Zielony dla węgli
        else if (type === 'fib') fillEl.style.stroke = '#d8b4fe'; // Fioletowy dla błonnika
        else fillEl.style.stroke = 'var(--accent)';
      }
    }

    function renderMeals() {
      const container = document.getElementById('meals-container');
      container.innerHTML = '';

      let dayTotal = { kcal: 0, p: 0, f: 0, c: 0, fib: 0 };

      MEALS_CONFIG.forEach(mealCfg => {
        const mealData = state.meals[mealCfg.id];
        let mealTotal = { kcal: 0, p: 0, f: 0, c: 0, fib: 0 };

        mealData.forEach(item => {
          mealTotal.kcal += item.kcal || 0;
          mealTotal.p += item.p || 0;
          mealTotal.f += item.f || 0;
          mealTotal.c += item.c || 0;
          mealTotal.fib += item.fib || 0;
        });

        dayTotal.kcal += mealTotal.kcal;
        dayTotal.p += mealTotal.p;
        dayTotal.f += mealTotal.f;
        dayTotal.c += mealTotal.c;
        dayTotal.fib += mealTotal.fib;

        const card = document.createElement('div');
        card.className = 'card';

        const targetKcal = state.targets.kcal || 2000;
        const targetP = state.targets.p || 150;
        const targetF = state.targets.f || 70;
        const targetC = state.targets.c || 200;
        const targetFib = state.targets.fib || 30;

        const pctKcal = Math.min(Math.round((mealTotal.kcal / targetKcal) * 100), 100);
        const pctP = Math.min(Math.round((mealTotal.p / targetP) * 100), 100);
        const pctF = Math.min(Math.round((mealTotal.f / targetF) * 100), 100);
        const pctC = Math.min(Math.round((mealTotal.c / targetC) * 100), 100);
        const pctFib = Math.min(Math.round((mealTotal.fib / targetFib) * 100), 100);

        card.innerHTML = `
          <div class="meal-header" style="align-items: flex-start; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
              <h3 style="margin-bottom: 0; font-size: 15px; font-weight: 600;">${mealCfg.name}</h3>
              <div class="meal-actions">
                <button class="btn btn-history-meal" onclick="openMealHistoryModal('${mealCfg.id}')">📋 Historia</button>
                <button class="btn btn-reset-meal" onclick="resetSingleMeal('${mealCfg.id}')">🗑️ Reset</button>
              </div>
            </div>
            
            <div style="display: flex; gap: 10px; align-items: center; font-size: 12px; flex-wrap: wrap;">
              <span>🔥 ${Math.round(mealTotal.kcal)} kcal</span>
              <span style="color:var(--text-muted)">|</span>
              <span><span style="display:inline-block; width:6px; height:6px; background:#38bdf8; border-radius:50%; margin-right:3px;"></span>B: ${Math.round(mealTotal.p)}g</span>
              <span><span style="display:inline-block; width:6px; height:6px; background:#fdba74; border-radius:50%; margin-right:3px;"></span>T: ${Math.round(mealTotal.f)}g</span>
              <span><span style="display:inline-block; width:6px; height:6px; background:#86efac; border-radius:50%; margin-right:3px;"></span>W: ${Math.round(mealTotal.c)}g</span>
              <span><span style="display:inline-block; width:6px; height:6px; background:#d8b4fe; border-radius:50%; margin-right:3px;"></span>Bł: ${Math.round(mealTotal.fib)}g</span>
            </div>
          </div>

          <div id="items-${mealCfg.id}">

          <div id="items-${mealCfg.id}">
            ${mealData.map((item, idx) => {
              const boxKey = `${mealCfg.id}-${idx}`;
              const isBoxOpen = openManualBoxes[boxKey] === true;
              return `
              <div class="item-card">
                <div class="item-main-row">
                  <input type="text" list="saved-ingredients-list" placeholder="Składnik" value="${item.name}" onchange="updateItem('${mealCfg.id}', ${idx}, 'name', this.value)">
                  <button class="btn-icon btn-preset-pick" title="Wybierz zapisany składnik" onclick="openPresetsModal('${mealCfg.id}', ${idx})">📖</button>
                  <input type="number" placeholder="Ilość" value="${item.amount}" onchange="updateItem('${mealCfg.id}', ${idx}, 'amount', this.value)">
                  <select ${item.locked ? 'disabled' : ''} onchange="updateItem('${mealCfg.id}', ${idx}, 'unit', this.value)">
                    ${UNITS.map(u => `<option value="${u}" ${item.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
                  </select>
                  <button class="btn-icon btn-edit-item" title="Ręczne Makro" onclick="toggleManualBox('${mealCfg.id}', ${idx})">${item.locked ? '🔒' : '✏️'}</button>
                  <button class="btn-icon btn-remove" onclick="removeItem('${mealCfg.id}', ${idx})">✕</button>
                </div>
                
                <div class="item-stats-bar">
                  <span>${Math.round(item.kcal || 0)} kcal</span>
                  <span>B: ${Math.round(item.p || 0)}g</span>
                  <span>T: ${Math.round(item.f || 0)}g</span>
                  <span>W: ${Math.round(item.c || 0)}g</span>
                  <span>Bł: ${Math.round(item.fib || 0)}g</span>
                  ${item.locked ? (state.aiIngredients[item.presetKey] ? '<span style="color:var(--accent)">[AI]</span>' : '<span style="color:var(--accent)">[Baza]</span>') : item.manual ? '<span style="color:var(--warning)">[Ręczne]</span>' : ''}
                </div>

                <div class="manual-override-box" id="manual-box-${mealCfg.id}-${idx}" style="display: ${isBoxOpen ? 'flex' : 'none'};">
                  <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 2px;">Ręczne definiowanie wzorca makro:</div>
                  <div class="manual-override-inputs">
                    <div><label style="font-size:8px;color:var(--text-muted)">Baz. Ilość</label><input type="number" id="m-base-amt-${mealCfg.id}-${idx}" value="${item.baseAmount || item.amount || 100}"></div>
                    <div><label style="font-size:8px;color:var(--text-muted)">Jednostka</label>
                      <select id="m-base-unit-${mealCfg.id}-${idx}">
                        ${UNITS.map(u => `<option value="${u}" ${(item.unit || 'g') === u ? 'selected' : ''}>${u}</option>`).join('')}
                      </select>
                    </div>
                    <div><label style="font-size:8px;color:var(--text-muted)">Kcal</label><input type="number" id="m-kcal-${mealCfg.id}-${idx}" value="${item.kcal || ''}"></div>
                    <div><label style="font-size:8px;color:var(--text-muted)">Białko</label><input type="number" id="m-p-${mealCfg.id}-${idx}" value="${item.p || ''}"></div>
                    <div><label style="font-size:8px;color:var(--text-muted)">Tłuszcz</label><input type="number" id="m-f-${mealCfg.id}-${idx}" value="${item.f || ''}"></div>
                    <div><label style="font-size:8px;color:var(--text-muted)">Węgle</label><input type="number" id="m-c-${mealCfg.id}-${idx}" value="${item.c || ''}"></div>
                    <div><label style="font-size:8px;color:var(--text-muted)">Błonnik</label><input type="number" id="m-fib-${mealCfg.id}-${idx}" value="${item.fib || ''}"></div>
                  </div>
                  <div style="display: flex; gap: 4px; margin-top: 4px;">
                    <button class="btn btn-sm" style="flex: 1;" onclick="applyManualOverride('${mealCfg.id}', ${idx})">Zastosuj</button>
                    <button class="btn btn-sm" style="flex: 1; background: var(--success);" onclick="saveToPresetsFromManual('${mealCfg.id}', ${idx})">💾 Zapisz do bazy</button>
                  </div>
                </div>
              </div>
            `;}).join('')}
          </div>
          <button class="btn btn-add" onclick="addItem('${mealCfg.id}')">+ Dodaj pole</button>
        `;
        container.appendChild(card);
      });

      document.getElementById('sum-kcal').innerText = Math.round(dayTotal.kcal);
      document.getElementById('sum-p').innerText = Math.round(dayTotal.p) + 'g';
      document.getElementById('sum-f').innerText = Math.round(dayTotal.f) + 'g';
      document.getElementById('sum-c').innerText = Math.round(dayTotal.c) + 'g';
      document.getElementById('sum-fib').innerText = Math.round(dayTotal.fib) + 'g';

      updateGauge('kcal', dayTotal.kcal, state.targets.kcal);
      updateGauge('p', dayTotal.p, state.targets.p);
      updateGauge('f', dayTotal.f, state.targets.f);
      updateGauge('c', dayTotal.c, state.targets.c);
      updateGauge('fib', dayTotal.fib, state.targets.fib || 30);

      localStorage.setItem('daily_meals_data', JSON.stringify(state.meals));
      localStorage.setItem('last_active_date', getTodayDateString());
      saveTodayToDailyHistory(dayTotal);
    }

    function toggleManualBox(mealId, idx) {
      const boxKey = `${mealId}-${idx}`;
      const box = document.getElementById(`manual-box-${boxKey}`);
      if (!box) return;
      const isOpen = box.style.display === 'flex';
      box.style.display = isOpen ? 'none' : 'flex';
      openManualBoxes[boxKey] = !isOpen;
    }

    function applyManualOverride(mealId, idx) {
      const baseAmt = parseFloat(document.getElementById(`m-base-amt-${mealId}-${idx}`).value) || 100;
      const baseUnit = document.getElementById(`m-base-unit-${mealId}-${idx}`).value;
      const kcal = parseFloat(document.getElementById(`m-kcal-${mealId}-${idx}`).value) || 0;
      const p = parseFloat(document.getElementById(`m-p-${mealId}-${idx}`).value) || 0;
      const f = parseFloat(document.getElementById(`m-f-${mealId}-${idx}`).value) || 0;
      const c = parseFloat(document.getElementById(`m-c-${mealId}-${idx}`).value) || 0;
      const fib = parseFloat(document.getElementById(`m-fib-${mealId}-${idx}`).value) || 0;

      const currentItem = state.meals[mealId][idx];
      currentItem.baseAmount = baseAmt;
      currentItem.unit = baseUnit;
      currentItem.kcal = kcal;
      currentItem.p = p;
      currentItem.f = f;
      currentItem.c = c;
      currentItem.fib = fib;
      currentItem.manual = true;
      currentItem.locked = false;

      // Zamknij pole edycji ręcznej po kliknięciu "zastosuj"
      const boxKey = `${mealId}-${idx}`;
      delete openManualBoxes[boxKey];

      renderMeals();
    }

    function saveToPresetsFromManual(mealId, idx) {
      const item = state.meals[mealId][idx];
      const name = item.name.trim();

      if (!name) {
        alert("Wpisz najpierw nazwę składnika!");
        return;
      }

      const baseAmt = parseFloat(document.getElementById(`m-base-amt-${mealId}-${idx}`).value) || 100;
      const baseUnit = document.getElementById(`m-base-unit-${mealId}-${idx}`).value;
      const kcal = parseFloat(document.getElementById(`m-kcal-${mealId}-${idx}`).value) || 0;
      const p = parseFloat(document.getElementById(`m-p-${mealId}-${idx}`).value) || 0;
      const f = parseFloat(document.getElementById(`m-f-${mealId}-${idx}`).value) || 0;
      const c = parseFloat(document.getElementById(`m-c-${mealId}-${idx}`).value) || 0;
      const fib = parseFloat(document.getElementById(`m-fib-${mealId}-${idx}`).value) || 0;

      state.savedPresets[name.toLowerCase()] = {
        name: name,
        baseAmount: baseAmt,
        unit: baseUnit,
        kcal: kcal,
        p: p,
        f: f,
        c: c,
        fib: fib
      };

      localStorage.setItem('saved_presets_db', JSON.stringify(state.savedPresets));
      saveNewIngredientName(name);

      item.presetKey = name.toLowerCase();
      item.locked = true;
      item.unit = baseUnit;
      item.baseAmount = baseAmt;
      
      recalculateItemByPreset(item);

      // Zamknij pole edycji ręcznej po zapisaniu do bazy
      const boxKey = `${mealId}-${idx}`;
      delete openManualBoxes[boxKey];

      renderMeals();
      alert(`Zapisano "${name}" w podręcznej bazie!`);
    }

    function recalculateItemByPreset(item) {
      if (!item.presetKey) return;
      let preset = state.savedPresets[item.presetKey] || state.aiIngredients[item.presetKey];
      if (!preset) return;

      const currentAmt = parseFloat(item.amount) || 0;
      const ratio = preset.baseAmount > 0 ? (currentAmt / preset.baseAmount) : 0;

      item.kcal = Math.round(preset.kcal * ratio);
      item.p = Math.round(preset.p * ratio * 10) / 10;
      item.f = Math.round(preset.f * ratio * 10) / 10;
      item.c = Math.round(preset.c * ratio * 10) / 10;
      item.fib = Math.round(preset.fib * ratio * 10) / 10;
    }

    function updateItem(mealId, idx, field, value) {
      const item = state.meals[mealId][idx];

      if (field === 'amount') {
        item.amount = parseFloat(value) || '';
        if (item.locked && item.presetKey) {
          recalculateItemByPreset(item);
        }
      } else if (field === 'name') {
        const cleanName = value.trim();
        item.name = value;
        item.locked = false;
        item.presetKey = null;

        if (cleanName) {
          saveNewIngredientName(cleanName);
          const lowerKey = cleanName.toLowerCase();
          
          // Sprawdź czy składnik istnieje w bazie AI lub User z dopasowaniem jednostki
          if (state.aiIngredients[lowerKey]) {
            const aiPreset = state.aiIngredients[lowerKey];
            if (aiPreset.unit === item.unit) {
              item.presetKey = lowerKey;
              item.locked = true;
              item.baseAmount = aiPreset.baseAmount || 100;
              if (!item.amount) item.amount = item.baseAmount;
              recalculateItemByPreset(item);
            }
          } else if (state.savedPresets[lowerKey]) {
            const preset = state.savedPresets[lowerKey];
            if (preset.unit === item.unit) {
              item.presetKey = lowerKey;
              item.locked = true;
              item.baseAmount = preset.baseAmount || 100;
              if (!item.amount) item.amount = preset.baseAmount;
              recalculateItemByPreset(item);
            }
          }
        }
      } else if (field === 'unit') {
        item.unit = value;
        // Po zmianie jednostki sprawdź, czy baza posiada wpis dla nowej jednostki
        if (item.name) {
          const lowerKey = item.name.trim().toLowerCase();
          let matchedPreset = state.aiIngredients[lowerKey] || state.savedPresets[lowerKey];
          if (matchedPreset && matchedPreset.unit === value) {
            item.presetKey = lowerKey;
            item.locked = true;
            item.baseAmount = matchedPreset.baseAmount || 100;
            if (!item.amount) item.amount = item.baseAmount;
            recalculateItemByPreset(item);
          } else {
            item.locked = false;
            item.presetKey = null;
          }
        }
      }

      renderMeals();
    }

    /* === PRZETWARZANIE I EDYCJA BAZY PODRĘCZNEJ === */
    /* === POŁĄCZONE OKNO BAZ SKŁADNIKÓW (ZAKŁADKI) === */
    function openCombinedIngredientsModal() {
      activeTargetPicker = null;
      switchIngredientsTab('user');
      openModal('presets-modal');
    }

    function switchIngredientsTab(tab) {
      const btnUser = document.getElementById('tab-btn-user');
      const btnAi = document.getElementById('tab-btn-ai');
      const contentUser = document.getElementById('tab-content-user');
      const contentAi = document.getElementById('tab-content-ai');

      if (tab === 'user') {
        btnUser.style.background = 'var(--accent)';
        btnAi.style.background = 'var(--card-border)';
        contentUser.style.display = 'block';
        contentAi.style.display = 'none';
        document.getElementById('preset-search-input').value = '';
        renderPresetsList();
      } else {
        btnUser.style.background = 'var(--card-border)';
        btnAi.style.background = 'var(--accent)';
        contentUser.style.display = 'none';
        contentAi.style.display = 'block';
        document.getElementById('ai-preset-search-input').value = '';
        renderAiPresetsList();
      }
    }

    function openPresetsModalDirect() {
      activeTargetPicker = null;
      openCombinedIngredientsModal();
    }

    function openAiIngredientsModal() {
      activeTargetPicker = null;
      switchIngredientsTab('ai');
      openModal('presets-modal');
    }

    function openPresetsModal(mealId, idx) {
      activeTargetPicker = { mealId, idx };
      document.getElementById('preset-search-input').value = '';
      renderPresetsList();
      openModal('presets-modal');
    }

    function filterPresetsList() {
      renderPresetsList();
    }

    function renderPresetsList() {
      const presetsList = document.getElementById('presets-list');
      const searchQuery = (document.getElementById('preset-search-input').value || '').toLowerCase().trim();
      let keys = Object.keys(state.savedPresets);

      if (searchQuery) {
        keys = keys.filter(k => {
          const p = state.savedPresets[k];
          return p.name.toLowerCase().includes(searchQuery);
        });
      }

      keys.sort((a, b) => {
        const nameA = state.savedPresets[a].name.toLowerCase();
        const nameB = state.savedPresets[b].name.toLowerCase();
        return nameA.localeCompare(nameB, 'pl');
      });

      if (keys.length === 0) {
        presetsList.innerHTML = `<div style="text-align: center; font-size: 12px; color: var(--text-muted); padding: 12px;">Brak pasujących składników w bazie.</div>`;
        return;
      }

      presetsList.innerHTML = keys.map(k => {
        const p = state.savedPresets[k];
        return `
          <div class="history-card-item">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div onclick="selectPresetItem('${k}')" style="cursor:pointer; flex: 1; min-width: 0;">
                <div style="font-weight: bold; font-size: 13px; color: var(--text); word-break: break-word;">${p.name}</div>
                <div style="font-size: 10px; color: var(--text-muted); word-break: break-word;">${p.baseAmount} ${p.unit} ➔ ${p.kcal} kcal | B:${p.p}g T:${p.f}g W:${p.c}g | Bł:${p.fib}g</div>
              </div>
              <div class="preset-action-btns">
                <button class="btn-icon btn-preset-pick" style="padding: 4px 6px; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none;" title="Wybierz" onclick="selectPresetItem('${k}')">➕</button>
                <button class="btn-icon btn-edit-item" style="padding: 4px 6px; font-size: 13px; display: inline-flex; align-items: center; justify-content: center;" title="Edytuj" onclick="togglePresetEditBox('${k}')">✏️</button>
                <button class="btn-icon btn-remove" style="padding: 4px 6px; font-size: 13px; display: inline-flex; align-items: center; justify-content: center;" title="Usuń z bazy" onclick="deletePresetItem('${k}')">🗑️</button>
              </div>
            </div>

            <div class="preset-edit-box" id="preset-edit-box-${k.replace(/\s+/g, '_')}">
              <div style="font-size: 10px; color: var(--text-muted);">Edycja wzorca w bazie:</div>
              <div class="manual-override-inputs">
                <div><label style="font-size:8px;color:var(--text-muted)">Nazwa</label><input type="text" id="pe-name-${k}" value="${p.name}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Baz. Ilość</label><input type="number" id="pe-amt-${k}" value="${p.baseAmount}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Jednostka</label>
                  <select id="pe-unit-${k}">
                    ${UNITS.map(u => `<option value="${u}" ${p.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
                  </select>
                </div>
                <div><label style="font-size:8px;color:var(--text-muted)">Kcal</label><input type="number" id="pe-kcal-${k}" value="${p.kcal}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Białko</label><input type="number" id="pe-p-${k}" value="${p.p}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Tłuszcz</label><input type="number" id="pe-f-${k}" value="${p.f}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Węgle</label><input type="number" id="pe-c-${k}" value="${p.c}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Błonnik</label><input type="number" id="pe-fib-${k}" value="${p.fib || 0}"></div>
              </div>
              <div style="display: flex; gap: 4px; margin-top: 4px;">
                <button class="btn btn-sm" style="flex: 1;" onclick="savePresetEdit('${k}')">Zapisz zmiany 💾</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    function togglePresetEditBox(key) {
      const safeKey = key.replace(/\s+/g, '_');
      const box = document.getElementById(`preset-edit-box-${safeKey}`);
      if (box) {
        box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
      }
    }

    function savePresetEdit(oldKey) {
      const newName = document.getElementById(`pe-name-${oldKey}`).value.trim();
      if (!newName) {
        alert("Nazwa nie może być pusta!");
        return;
      }

      const newBaseAmt = parseFloat(document.getElementById(`pe-amt-${oldKey}`).value) || 100;
      const newUnit = document.getElementById(`pe-unit-${oldKey}`).value;
      const newKcal = parseFloat(document.getElementById(`pe-kcal-${oldKey}`).value) || 0;
      const newP = parseFloat(document.getElementById(`pe-p-${oldKey}`).value) || 0;
      const newF = parseFloat(document.getElementById(`pe-f-${oldKey}`).value) || 0;
      const newC = parseFloat(document.getElementById(`pe-c-${oldKey}`).value) || 0;
      const newFib = parseFloat(document.getElementById(`pe-fib-${oldKey}`).value) || 0;

      const newKey = newName.toLowerCase();

      delete state.savedPresets[oldKey];

      state.savedPresets[newKey] = {
        name: newName,
        baseAmount: newBaseAmt,
        unit: newUnit,
        kcal: newKcal,
        p: newP,
        f: newF,
        c: newC,
        fib: newFib
      };

      localStorage.setItem('saved_presets_db', JSON.stringify(state.savedPresets));
      saveNewIngredientName(newName);

      // Zaktualizuj aktywne pozycje na liście
      MEALS_CONFIG.forEach(m => {
        state.meals[m.id].forEach(item => {
          if (item.presetKey === oldKey) {
            item.presetKey = newKey;
            item.name = newName;
            item.unit = newUnit;
            recalculateItemByPreset(item);
          }
        });
      });

      renderMeals();
      renderPresetsList();
    }

    function deletePresetItem(key) {
      if (confirm(`Czy na pewno chcesz usunąć "${state.savedPresets[key]?.name || key}" z bazy zapamiętanych składników?`)) {
        delete state.savedPresets[key];
        localStorage.setItem('saved_presets_db', JSON.stringify(state.savedPresets));
        
        MEALS_CONFIG.forEach(m => {
          state.meals[m.id].forEach(item => {
            if (item.presetKey === key) {
              item.locked = false;
              item.presetKey = null;
            }
          });
        });

        renderMeals();
        renderPresetsList();
      }
    }

    function selectPresetItem(presetKey) {
      if (!activeTargetPicker) return;
      const { mealId, idx } = activeTargetPicker;
      const preset = state.savedPresets[presetKey] || state.aiIngredients[presetKey];

      if (preset && state.meals[mealId][idx]) {
        const item = state.meals[mealId][idx];
        item.name = preset.name;
        item.unit = preset.unit;
        item.locked = true;
        item.presetKey = presetKey;
        if (!item.amount) item.amount = preset.baseAmount;

        recalculateItemByPreset(item);
        renderMeals();
        closeModal('presets-modal');
      }
    }

    /* === BAZA AI SKŁADNIKÓW === */
    function openAiIngredientsModal() {
      document.getElementById('ai-preset-search-input').value = '';
      renderAiPresetsList();
      openModal('ai-ingredients-modal');
    }

    function filterAiPresetsList() {
      renderAiPresetsList();
    }

    function renderAiPresetsList() {
      const presetsList = document.getElementById('ai-presets-list');
      const searchQuery = (document.getElementById('ai-preset-search-input').value || '').toLowerCase().trim();
      let keys = Object.keys(state.aiIngredients);

      if (searchQuery) {
        keys = keys.filter(k => {
          const p = state.aiIngredients[k];
          return p.name.toLowerCase().includes(searchQuery);
        });
      }

      keys.sort((a, b) => {
        const nameA = state.aiIngredients[a].name.toLowerCase();
        const nameB = state.aiIngredients[b].name.toLowerCase();
        return nameA.localeCompare(nameB, 'pl');
      });

      if (keys.length === 0) {
        presetsList.innerHTML = `<div style="text-align: center; font-size: 12px; color: var(--text-muted); padding: 12px;">Brak składników w bazie AI.</div>`;
        return;
      }

      presetsList.innerHTML = keys.map(k => {
        const p = state.aiIngredients[k];
        return `
          <div class="history-card-item">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div onclick="selectPresetItem('${k}')" style="cursor:pointer; flex: 1; min-width: 0;">
                <div style="font-weight: bold; font-size: 13px; color: var(--text); word-break: break-word;">${p.name}</div>
                <div style="font-size: 10px; color: var(--text-muted); word-break: break-word;">${p.baseAmount} ${p.unit} ➔ ${p.kcal} kcal | B:${p.p}g T:${p.f}g W:${p.c}g | Bł:${p.fib}g</div>
              </div>
              <div class="preset-action-btns">
                <button class="btn-icon btn-preset-pick" style="padding: 4px 6px; font-size: 13px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none;" title="Wybierz" onclick="selectPresetItem('${k}')">➕</button>
                <button class="btn-icon btn-edit-item" style="padding: 4px 6px; font-size: 13px; display: inline-flex; align-items: center; justify-content: center;" title="Edytuj" onclick="toggleAiPresetEditBox('${k}')">✏️</button>
                <button class="btn-icon btn-remove" style="padding: 4px 6px; font-size: 13px; display: inline-flex; align-items: center; justify-content: center;" title="Usuń z bazy AI" onclick="deleteAiPresetItem('${k}')">🗑️</button>
              </div>
            </div>

            <div class="preset-edit-box" id="ai-preset-edit-box-${k.replace(/\s+/g, '_')}">
              <div style="font-size: 10px; color: var(--text-muted);">Edycja składnika AI w bazie:</div>
              <div class="manual-override-inputs">
                <div><label style="font-size:8px;color:var(--text-muted)">Nazwa</label><input type="text" id="ai-pe-name-${k}" value="${p.name}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Baz. Ilość</label><input type="number" id="ai-pe-amt-${k}" value="${p.baseAmount}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Jednostka</label>
                  <select id="ai-pe-unit-${k}">
                    ${UNITS.map(u => `<option value="${u}" ${p.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
                  </select>
                </div>
                <div><label style="font-size:8px;color:var(--text-muted)">Kcal</label><input type="number" id="ai-pe-kcal-${k}" value="${p.kcal}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Białko</label><input type="number" id="ai-pe-p-${k}" value="${p.p}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Tłuszcz</label><input type="number" id="ai-pe-f-${k}" value="${p.f}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Węgle</label><input type="number" id="ai-pe-c-${k}" value="${p.c}"></div>
                <div><label style="font-size:8px;color:var(--text-muted)">Błonnik</label><input type="number" id="ai-pe-fib-${k}" value="${p.fib || 0}"></div>
              </div>
              <div style="display: flex; gap: 4px; margin-top: 4px;">
                <button class="btn btn-sm" style="flex: 1;" onclick="saveAiPresetEdit('${k}')">Zapisz zmiany 💾</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    function toggleAiPresetEditBox(key) {
      const safeKey = key.replace(/\s+/g, '_');
      const box = document.getElementById(`ai-preset-edit-box-${safeKey}`);
      if (box) {
        box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
      }
    }

    function saveAiPresetEdit(oldKey) {
      const newName = document.getElementById(`ai-pe-name-${oldKey}`).value.trim();
      if (!newName) {
        alert("Nazwa nie może być pusta!");
        return;
      }

      const newBaseAmt = parseFloat(document.getElementById(`ai-pe-amt-${oldKey}`).value) || 100;
      const newUnit = document.getElementById(`ai-pe-unit-${oldKey}`).value;
      const newKcal = parseFloat(document.getElementById(`ai-pe-kcal-${oldKey}`).value) || 0;
      const newP = parseFloat(document.getElementById(`ai-pe-p-${oldKey}`).value) || 0;
      const newF = parseFloat(document.getElementById(`ai-pe-f-${oldKey}`).value) || 0;
      const newC = parseFloat(document.getElementById(`ai-pe-c-${oldKey}`).value) || 0;
      const newFib = parseFloat(document.getElementById(`ai-pe-fib-${oldKey}`).value) || 0;

      const newKey = newName.toLowerCase();

      delete state.aiIngredients[oldKey];

      state.aiIngredients[newKey] = {
        name: newName,
        baseAmount: newBaseAmt,
        unit: newUnit,
        kcal: newKcal,
        p: newP,
        f: newF,
        c: newC,
        fib: newFib
      };

      localStorage.setItem('ai_ingredients_db', JSON.stringify(state.aiIngredients));
      saveNewIngredientName(newName);

      MEALS_CONFIG.forEach(m => {
        state.meals[m.id].forEach(item => {
          if (item.presetKey === oldKey) {
            item.presetKey = newKey;
            item.name = newName;
            item.unit = newUnit;
            recalculateItemByPreset(item);
          }
        });
      });

      renderMeals();
      renderAiPresetsList();
    }

    function deleteAiPresetItem(key) {
      if (confirm(`Czy na pewno chcesz usunąć "${state.aiIngredients[key]?.name || key}" z bazy AI?`)) {
        delete state.aiIngredients[key];
        localStorage.setItem('ai_ingredients_db', JSON.stringify(state.aiIngredients));
        
        MEALS_CONFIG.forEach(m => {
          state.meals[m.id].forEach(item => {
            if (item.presetKey === key) {
              item.locked = false;
              item.presetKey = null;
            }
          });
        });

        renderMeals();
        renderAiPresetsList();
      }
    }

    function exportAiIngredientsJson() {
      downloadJson(`baza_ai_skladniki_${getExportDateStamp()}.json`, state.aiIngredients);
    }

    function importAiIngredientsFromJson(input) {
      readJsonFile(input, (data) => {
        if (data && typeof data === 'object') {
          state.aiIngredients = { ...state.aiIngredients, ...data };
          localStorage.setItem('ai_ingredients_db', JSON.stringify(state.aiIngredients));
          alert("Pomyślnie wczytano bazę składników AI!");
          renderAiPresetsList();
          renderMeals();
        } else {
          alert("Niepoprawny format pliku.");
        }
      });
    }

    function addItem(mealId) {
      state.meals[mealId].push({ name: '', amount: '', unit: 'g', kcal: 0, p: 0, f: 0, c: 0, fib: 0, manual: false, locked: false });
      renderMeals();
    }

    function removeItem(mealId, idx) {
      if (state.meals[mealId].length > 1) {
        state.meals[mealId].splice(idx, 1);
      } else {
        state.meals[mealId][0] = { name: '', amount: '', unit: 'g', kcal: 0, p: 0, f: 0, c: 0, fib: 0, manual: false, locked: false };
      }
      renderMeals();
    }

    function resetSingleMeal(mealId) {
      state.meals[mealId] = [{ name: '', amount: '', unit: 'g', kcal: 0, p: 0, f: 0, c: 0, fib: 0, manual: false, locked: false }];
      renderMeals();
    }

    function resetWholeDay() {
      if (confirm("Czy na pewno chcesz wyczyścić wszystkie wpisane dziś posiłki?")) {
        MEALS_CONFIG.forEach(m => {
          state.meals[m.id] = [{ name: '', amount: '', unit: 'g', kcal: 0, p: 0, f: 0, c: 0, fib: 0, manual: false, locked: false }];
        });
        renderMeals();
      }
    }

    function saveTodayToDailyHistory(dayTotal) {
      if (dayTotal.kcal === 0) return;
      
      const todayDate = getTodayDateString();
      const existingIdx = state.dailyHistory.findIndex(h => h.date === todayDate);

      const entry = {
        date: todayDate,
        displayDate: new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }),
        totals: { ...dayTotal }
      };

      if (existingIdx >= 0) {
        state.dailyHistory[existingIdx] = entry;
      } else {
        state.dailyHistory.unshift(entry);
      }

      state.dailyHistory = state.dailyHistory.slice(0, 30);
      localStorage.setItem('daily_history', JSON.stringify(state.dailyHistory));
    }

    function renderHistoryAndChart() {
      const chartArea = document.getElementById('chart-bars-area');
      const historyList = document.getElementById('daily-history-list');
      
      const last7Days = state.dailyHistory.slice(0, 7).reverse();
      const maxKcal = Math.max(...last7Days.map(d => d.totals.kcal), state.targets.kcal, 2000);

      chartArea.innerHTML = last7Days.map(d => {
        const heightPct = Math.round((d.totals.kcal / maxKcal) * 100);
        return `
          <div class="chart-bar-wrap">
            <div class="chart-val">${Math.round(d.totals.kcal)}</div>
            <div class="chart-bar" style="height: ${heightPct}%;"></div>
            <div class="chart-label">${d.displayDate}</div>
          </div>
        `;
      }).join('') || '<div style="color:var(--text-muted);font-size:12px;text-align:center;width:100%">Brak danych historii z ostatnich dni.</div>';

      historyList.innerHTML = state.dailyHistory.map(d => `
        <div class="history-card-item">
          <div style="font-weight:bold;color:var(--accent);font-size:12px;">${d.date} (${d.displayDate})</div>
          <div style="font-size:12px;margin-top:4px;">
            🔥 <strong>${Math.round(d.totals.kcal)} kcal</strong> | B: ${Math.round(d.totals.p)}g | T: ${Math.round(d.totals.f)}g | W: ${Math.round(d.totals.c)}g | Bł: ${Math.round(d.totals.fib)}g
          </div>
        </div>
      `).join('') || '<div style="color:var(--text-muted);font-size:12px;text-align:center;">Brak wpisów w historii.</div>';
    }

    function saveCurrentStateToHistory() {
      const todayStr = new Date().toLocaleDateString('pl-PL');
      
      MEALS_CONFIG.forEach(m => {
        const items = state.meals[m.id].filter(i => i.name && i.amount);
        if (items.length > 0) {
          state.mealsHistory.unshift({
            date: todayStr,
            mealId: m.id,
            mealName: m.name,
            items: JSON.parse(JSON.stringify(items))
          });
        }
      });

      state.mealsHistory = state.mealsHistory.slice(0, 30);
      localStorage.setItem('meals_history', JSON.stringify(state.mealsHistory));
    }

    function openMealHistoryModal(mealId) {
      activeHistoryMealId = mealId;
      const historyList = document.getElementById('history-list');
      const filtered = state.mealsHistory.filter(h => h.mealId === mealId);

      if (filtered.length === 0) {
        historyList.innerHTML = `<div style="text-align: center; font-size: 13px; color: var(--text-muted); padding: 10px;">Brak historii dla tego posiłku. Wykonaj przeliczenie z AI, aby zapisać historię.</div>`;
      } else {
        historyList.innerHTML = filtered.map((h, idx) => `
          <div class="history-card-item" onclick="copyMealFromHistory(${idx}, '${mealId}')" style="cursor:pointer">
            <div style="font-size: 11px; color: var(--accent); font-weight: bold;">${h.date}</div>
            <div style="font-size: 13px; margin-top: 4px;">
              ${h.items.map(i => `${i.amount}${i.unit} ${i.name}`).join(', ')}
            </div>
          </div>
        `).join('');
      }

      openModal('history-modal');
    }

    function copyMealFromHistory(histIdx, mealId) {
      const filtered = state.mealsHistory.filter(h => h.mealId === mealId);
      if (filtered[histIdx]) {
        state.meals[mealId] = JSON.parse(JSON.stringify(filtered[histIdx].items));
        renderMeals();
        closeModal('history-modal');
      }
    }

    function openModal(id) { 
      if (id === 'history-chart-modal') renderHistoryAndChart();
      document.getElementById(id).style.display = 'flex'; 
    }
    function closeModal(id) { document.getElementById(id).style.display = 'none'; }

    function saveApiKey() {
      const key = document.getElementById('api-key-input').value.trim();
      if (key) {
        state.apiKey = key;
        localStorage.setItem('gemini_api_key', key);
        closeModal('settings-modal');
      }
    }

    async function callGemini(prompt) {
      if (!state.apiKey) {
        alert("Brak klucza API! Wprowadź go w ustawieniach (ikona koła zębatego).");
        openModal('settings-modal');
        return null;
      }

      const apiKey = state.apiKey.trim();
      const candidateModels = ['gemini-3.5-flash-lite'];

      for (const model of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" }
            })
          });

          if (res.status === 404) continue;

          if (!res.ok) {
            const errText = await res.text();
            alert(`Błąd API (${res.status}): ${errText}`);
            return null;
          }

          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) return JSON.parse(rawText);
        } catch (err) {
          console.error(`Błąd z modelem ${model}:`, err);
        }
      }

      alert("Żaden z dostępnych modeli Gemini nie odpowiedział.");
      return null;
    }

    async function calculateAllWithAI() {
      document.getElementById('loading-spinner').style.display = 'block';
      
      let itemsToAnalyze = [];

      MEALS_CONFIG.forEach(meal => {
        state.meals[meal.id].forEach((item, idx) => {
          if (item.name && item.amount && !item.manual && !item.locked) {
            const cleanNameKey = item.name.trim().toLowerCase();
            let matchedPreset = state.aiIngredients[cleanNameKey] || state.savedPresets[cleanNameKey];
            
            // Sprawdź czy składnik istnieje w bazie ORAZ czy zgadza się jednostka
            if (matchedPreset && matchedPreset.unit === item.unit) {
              item.presetKey = cleanNameKey;
              item.locked = true;
              item.baseAmount = matchedPreset.baseAmount || 100;
              recalculateItemByPreset(item);
            } else {
              saveNewIngredientName(item.name);
              itemsToAnalyze.push({ mealId: meal.id, idx: idx, query: `${item.amount} ${item.unit} ${item.name}`, name: item.name.trim(), amount: item.amount, unit: item.unit });
            }
          }
        });
      });

      if (itemsToAnalyze.length === 0) {
        document.getElementById('loading-spinner').style.display = 'none';
        saveCurrentStateToHistory();
        renderMeals();
        return;
      }

      const prompt = `Przeanalizuj listę składników i oszacuj wartości odżywcze bazując na podanej ilości i jednostce (w tym błonnik - fib). Zwróć tablicę JSON:
      Lista produktów: ${JSON.stringify(itemsToAnalyze)}
      Format odpowiedzi JSON:
      [{"mealId": "...", "idx": 0, "name": "...", "baseAmount": 100, "unit": "g", "kcal": 150, "p": 10, "f": 5, "c": 15, "fib": 3}]`;

      const result = await callGemini(prompt);
      document.getElementById('loading-spinner').style.display = 'none';

      if (result && Array.isArray(result)) {
        result.forEach(res => {
          if (state.meals[res.mealId] && state.meals[res.mealId][res.idx]) {
            const item = state.meals[res.mealId][res.idx];
            item.kcal = res.kcal || 0;
            item.p = res.p || 0;
            item.f = res.f || 0;
            item.c = res.c || 0;
            item.fib = res.fib || 0;
            
            if (res.name) {
              const key = res.name.trim().toLowerCase();
              const baseAmt = res.baseAmount || item.amount || 100;
              const unit = res.unit || item.unit || 'g';
              const currentAmt = parseFloat(item.amount) || baseAmt;
              const ratio = baseAmt > 0 ? (currentAmt / baseAmt) : 1;

              // Zapisz do bazy AI
              state.aiIngredients[key] = {
                name: res.name.trim(),
                baseAmount: baseAmt,
                unit: unit,
                kcal: Math.round(res.kcal / ratio),
                p: Math.round((res.p / ratio) * 10) / 10,
                f: Math.round((res.f / ratio) * 10) / 10,
                c: Math.round((res.c / ratio) * 10) / 10,
                fib: Math.round((res.fib / ratio) * 10) / 10
              };

              item.presetKey = key;
              item.locked = true;
              item.baseAmount = baseAmt;
              item.unit = unit;
            }
          }
        });
        localStorage.setItem('ai_ingredients_db', JSON.stringify(state.aiIngredients));
        saveCurrentStateToHistory();
        renderMeals();
      }
    }

    async function calculateTargetsWithAI() {
      const gender = document.getElementById('prof-gender').value;
      const age = document.getElementById('prof-age').value;
      const height = document.getElementById('prof-height').value;
      const weight = document.getElementById('prof-weight').value;
      const goal = document.getElementById('prof-goal').value;

      const prompt = `Na podstawie danych wylicz dzienne zapotrzebowanie kaloryczne oraz makroskładniki i błonnik (fib):
      Płeć: ${gender}, Wiek: ${age}, Wzrost: ${height}cm, Waga: ${weight}kg, Cel/Trening: ${goal}.

      Zwróć odpowiedź w formacie JSON:
      {"kcal": 2200, "p": 160, "f": 70, "c": 230, "fib": 30}`;

      document.getElementById('loading-spinner').style.display = 'block';
      const result = await callGemini(prompt);
      document.getElementById('loading-spinner').style.display = 'none';

      if (result && result.kcal) {
        state.targets = result;
        localStorage.setItem('macro_targets', JSON.stringify(state.targets));
        renderTargets();
        renderMeals();
        toggleProfile();
      }
    }

    function triggerJsonImport(inputId) {
      const input = document.getElementById(inputId);
      if (input) input.click();
    }

    function downloadJson(filename, data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    function readJsonFile(input, onData) {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          onData(JSON.parse(reader.result));
        } catch (err) {
          alert('Niepoprawny plik JSON.');
        }
      };
      reader.readAsText(file);
    }

    function getExportDateStamp() {
      return getTodayDateString();
    }

    function getProfileFromForm() {
      return {
        gender: document.getElementById('prof-gender').value,
        age: document.getElementById('prof-age').value,
        height: document.getElementById('prof-height').value,
        weight: document.getElementById('prof-weight').value,
        goal: document.getElementById('prof-goal').value
      };
    }

    function applyProfileToForm(profile) {
      if (!profile) return;
      if (profile.gender) document.getElementById('prof-gender').value = profile.gender;
      if (profile.age !== undefined && profile.age !== '') document.getElementById('prof-age').value = profile.age;
      if (profile.height !== undefined && profile.height !== '') document.getElementById('prof-height').value = profile.height;
      if (profile.weight !== undefined && profile.weight !== '') document.getElementById('prof-weight').value = profile.weight;
      if (profile.goal !== undefined) document.getElementById('prof-goal').value = profile.goal;
    }

    function exportProfileJson() {
      const payload = {
        type: 'makro_profile',
        version: 1,
        exportedAt: getExportDateStamp(),
        targets: state.targets,
        profile: getProfileFromForm()
      };
      downloadJson(`profil-makro-${payload.exportedAt}.json`, payload);
    }

    function importProfileFromJson(input) {
      readJsonFile(input, (data) => {
        if (!data || data.type !== 'makro_profile' || !data.targets) {
          alert('To nie jest plik ustawień profilu.');
          return;
        }

        state.targets = {
          kcal: data.targets.kcal || 0,
          p: data.targets.p || 0,
          f: data.targets.f || 0,
          c: data.targets.c || 0,
          fib: data.targets.fib || 30
        };
        localStorage.setItem('macro_targets', JSON.stringify(state.targets));

        const profile = data.profile || {};
        applyProfileToForm(profile);
        localStorage.setItem('user_profile', JSON.stringify(getProfileFromForm()));

        renderTargets();
        renderMeals();
        alert('Wczytano ustawienia profilu.');
      });
    }

    function exportIngredientsJson() {
      const payload = {
        type: 'makro_ingredients',
        version: 1,
        exportedAt: getExportDateStamp(),
        savedPresets: state.savedPresets,
        customIngredients: state.customIngredients
      };
      downloadJson(`skladniki-makro-${payload.exportedAt}.json`, payload);
    }

    function importIngredientsFromJson(input) {
      readJsonFile(input, (data) => {
        if (!data || data.type !== 'makro_ingredients' || !data.savedPresets) {
          alert('To nie jest plik bazy składników.');
          return;
        }

        if (!confirm('Wczytanie nadpisze aktualną bazę składników. Kontynuować?')) return;

        state.savedPresets = data.savedPresets || {};
        state.customIngredients = Array.isArray(data.customIngredients) ? data.customIngredients : [];
        localStorage.setItem('saved_presets_db', JSON.stringify(state.savedPresets));
        localStorage.setItem('custom_ingredients_list', JSON.stringify(state.customIngredients));

        updateIngredientsDatalist();
        if (document.getElementById('presets-modal').style.display === 'flex') {
          renderPresetsList();
        }
        renderMeals();
        alert('Wczytano bazę składników.');
      });
    }

    function exportHistoryJson() {
      const payload = {
        type: 'makro_history',
        version: 1,
        exportedAt: getExportDateStamp(),
        dailyHistory: state.dailyHistory,
        mealsHistory: state.mealsHistory
      };
      downloadJson(`historia-makro-${payload.exportedAt}.json`, payload);
    }

    function importHistoryFromJson(input) {
      readJsonFile(input, (data) => {
        if (!data || data.type !== 'makro_history') {
          alert('To nie jest plik historii.');
          return;
        }

        if (!confirm('Wczytanie nadpisze aktualną historię dni i posiłków. Kontynuować?')) return;

        state.dailyHistory = Array.isArray(data.dailyHistory) ? data.dailyHistory : [];
        state.mealsHistory = Array.isArray(data.mealsHistory) ? data.mealsHistory : [];
        localStorage.setItem('daily_history', JSON.stringify(state.dailyHistory));
        localStorage.setItem('meals_history', JSON.stringify(state.mealsHistory));

        renderHistoryAndChart();
        alert('Wczytano historię.');
      });
    }

    init();
  
