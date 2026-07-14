/* ==========================================================================
   Packliste Spanien – app.js
   Reines Vanilla JavaScript, keine Frameworks, keine Abhängigkeiten.
   Verantwortlich für: Zustand & Persistenz (localStorage), Rendering,
   Suche/Filter, Kategorie- und Item-Interaktionen, Statistik,
   Import/Export (JSON/CSV) und Druckansicht.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     1) KONSTANTEN & ZUSTAND
     ------------------------------------------------------------------ */
  const STORAGE_KEY = "packliste_spanien_v1";

  // Anzeige-Labels für die Personen-/Zuordnungswerte aus data.js
  const PERSON_LABELS = {
    Papa: "Papa",
    Mama: "Mama",
    Tochter1: "Tochter 1 (4 Jahre)",
    Tochter2: "Tochter 2 (2 Jahre)",
    Familie: "Familie / Allgemein",
  };

  // Standardzustand, falls noch nichts im Speicher liegt
  function createDefaultState() {
    return {
      version: 1,
      theme: "system", // "system" | "light" | "dark"
      overrides: {},   // { [itemId]: { packed: bool, favorite: bool } } für Seed-Items
      customItems: [], // vom Nutzer hinzugefügte Packpunkte
      customCategories: [], // vom Nutzer hinzugefügte Kategorien
      collapsed: {},   // { [categoryId]: bool }
      syncCode: null,  // 6-stelliger Code der geteilten Liste, falls verbunden
      filters: {
        search: "",
        person: null,
        suitcase: null,
        favoritesOnly: false,
        hideDone: false,
      },
    };
  }

  let state = loadState();

  /* ------------------------------------------------------------------
     2) PERSISTENZ
     ------------------------------------------------------------------ */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      // Fehlende Felder mit Defaults auffüllen (Vorwärtskompatibilität)
      return Object.assign(createDefaultState(), parsed, {
        filters: Object.assign(createDefaultState().filters, parsed.filters || {}),
      });
    } catch (err) {
      console.error("Konnte gespeicherten Zustand nicht laden:", err);
      return createDefaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Konnte Zustand nicht speichern:", err);
      showToast("Speichern fehlgeschlagen (Speicher voll?)");
    }
    pushToCloudDebounced();
  }

  /* ------------------------------------------------------------------
     3) DATENMODELL: Seed-Daten + Nutzer-Ergänzungen zusammenführen
     ------------------------------------------------------------------ */
  function getAllCategories() {
    const seed = PACKING_DATA.categories.map((c) => Object.assign({}, c, { custom: false }));
    const custom = state.customCategories.map((c) => Object.assign({}, c, { custom: true }));
    return seed.concat(custom);
  }

  function getAllItems() {
    const seedItems = PACKING_DATA.items.map((it) => {
      const ov = state.overrides[it.id] || {};
      return Object.assign({}, it, {
        packed: !!ov.packed,
        favorite: !!ov.favorite,
        custom: false,
      });
    });
    return seedItems.concat(state.customItems);
  }

  function setItemPacked(itemId, packed) {
    updateItem(itemId, { packed });
  }
  function toggleItemFavorite(itemId) {
    const item = getAllItems().find((i) => i.id === itemId);
    if (!item) return;
    updateItem(itemId, { favorite: !item.favorite });
  }

  function updateItem(itemId, patch) {
    const customIdx = state.customItems.findIndex((i) => i.id === itemId);
    if (customIdx !== -1) {
      Object.assign(state.customItems[customIdx], patch);
    } else {
      const current = state.overrides[itemId] || { packed: false, favorite: false };
      state.overrides[itemId] = Object.assign({}, current, patch);
    }
    saveState();
  }

  function deleteCustomItem(itemId) {
    state.customItems = state.customItems.filter((i) => i.id !== itemId);
    saveState();
  }

  function addCustomItem(text, categoryId, person) {
    const cat = getAllCategories().find((c) => c.id === categoryId);
    const suitcase = guessSuitcase(categoryId, person);
    const item = {
      id: "c" + Date.now() + Math.floor(Math.random() * 1000),
      category: categoryId,
      sub: "Eigene Punkte",
      person: person,
      suitcase: suitcase,
      text: text,
      packed: false,
      favorite: false,
      custom: true,
    };
    state.customItems.push(item);
    saveState();
    return item;
  }

  function guessSuitcase(categoryId, person) {
    const map = {
      Papa: "Koffer Papa",
      Mama: "Koffer Mama",
      Tochter1: "Koffer Kinder",
      Tochter2: "Koffer Kinder",
    };
    return map[person] || "Sonstiges";
  }

  function addCustomCategory(name, icon) {
    const palette = ["#0A84FF", "#FF375F", "#FF9F0A", "#34C759", "#5E5CE6", "#FF453A", "#64D2FF", "#BF5AF2"];
    const color = palette[getAllCategories().length % palette.length];
    const cat = {
      id: "cc" + Date.now(),
      name: name,
      icon: icon || "📦",
      color: color,
      person: "Familie",
    };
    state.customCategories.push(cat);
    saveState();
    return cat;
  }

  /* ------------------------------------------------------------------
     4) FILTER & SUCHE
     ------------------------------------------------------------------ */
  function getFilteredItems() {
    const items = getAllItems();
    const f = state.filters;
    const q = f.search.trim().toLowerCase();

    return items.filter((it) => {
      if (q && !it.text.toLowerCase().includes(q)) return false;
      if (f.person && it.person !== f.person) return false;
      if (f.suitcase && it.suitcase !== f.suitcase) return false;
      if (f.favoritesOnly && !it.favorite) return false;
      if (f.hideDone && it.packed) return false;
      return true;
    });
  }

  function getDistinctPersons() {
    const set = new Set(getAllItems().map((i) => i.person).filter(Boolean));
    return Array.from(set);
  }
  function getDistinctSuitcases() {
    const set = new Set(getAllItems().map((i) => i.suitcase).filter(Boolean));
    return Array.from(set);
  }

  /* ------------------------------------------------------------------
     5) RENDERING: LISTE
     ------------------------------------------------------------------ */
  const categoryListEl = document.getElementById("categoryList");
  const emptyStateEl = document.getElementById("emptyState");

  function render() {
    renderHeaderProgress();
    renderCategoryList();
    renderChips();
  }

  function renderHeaderProgress() {
    const all = getAllItems();
    const packedCount = all.filter((i) => i.packed).length;
    const total = all.length;
    const pct = total ? Math.round((packedCount / total) * 100) : 0;
    document.getElementById("progressFill").style.width = pct + "%";
    document.getElementById("progressCount").textContent = `${packedCount} / ${total} gepackt`;
    document.getElementById("progressPercent").textContent = pct + " %";
    document.getElementById("headerSubtitle").textContent =
      pct === 100 && total > 0 ? "Alles gepackt – Bon voyage! 🎉" : "Familienurlaub";
  }

  function renderCategoryList() {
    const categories = getAllCategories();
    const filteredItems = getFilteredItems();
    const itemsByCat = {};
    filteredItems.forEach((it) => {
      (itemsByCat[it.category] = itemsByCat[it.category] || []).push(it);
    });

    // Nur Kategorien mit mindestens einem passenden Punkt anzeigen
    const visibleCats = categories.filter((c) => itemsByCat[c.id] && itemsByCat[c.id].length > 0);

    emptyStateEl.hidden = visibleCats.length > 0;
    categoryListEl.innerHTML = "";

    visibleCats.forEach((cat) => {
      const items = itemsByCat[cat.id];
      // Innerhalb der Kategorie nach Unterkategorie gruppieren, Reihenfolge wie im Datensatz
      const packedInCat = items.filter((i) => i.packed).length;
      const collapsed = !!state.collapsed[cat.id];

      const card = document.createElement("div");
      card.className = "category-card";
      card.dataset.collapsed = String(collapsed);
      card.dataset.categoryId = cat.id;

      const circumference = 2 * Math.PI * 16;
      const pct = items.length ? packedInCat / items.length : 0;
      const dashOffset = circumference * (1 - pct);
      const allChecked = items.length > 0 && packedInCat === items.length;

      card.innerHTML = `
        <div class="category-header" data-role="toggle-collapse">
          <div class="category-icon" style="background:${cat.color}22; color:${cat.color}">${escapeHtml(cat.icon)}</div>
          <div class="category-title-wrap">
            <div class="category-title">${escapeHtml(cat.name)}</div>
            <div class="category-sub">${packedInCat} / ${items.length} gepackt</div>
          </div>
          <div class="category-mini-progress">
            <svg viewBox="0 0 40 40">
              <circle class="mini-progress-bg" cx="20" cy="20" r="16"></circle>
              <circle class="mini-progress-fg" cx="20" cy="20" r="16"
                stroke="${cat.color}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${dashOffset}"></circle>
            </svg>
          </div>
          <button class="category-check-all" data-role="check-all" data-checked="${allChecked}" title="Alle in dieser Kategorie abhaken" aria-label="Alle in dieser Kategorie abhaken">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <svg class="chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        <div class="item-list"><div class="item-list-inner"></div></div>
      `;

      const itemListEl = card.querySelector(".item-list-inner");
      items.forEach((it) => itemListEl.appendChild(renderItemRow(it)));

      categoryListEl.appendChild(card);
    });
  }

  function renderItemRow(item) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.dataset.itemId = item.id;
    row.dataset.packed = String(item.packed);

    row.innerHTML = `
      <button class="item-checkbox ${item.packed ? "checked" : ""}" data-role="toggle-packed" aria-label="Als gepackt markieren">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </button>
      <div class="item-text">${escapeHtml(item.text)}</div>
      <button class="item-fav-btn" data-role="toggle-fav" data-active="${item.favorite}" aria-label="Favorit">★</button>
      ${item.custom ? '<button class="item-delete-btn" data-role="delete-item" aria-label="Löschen">✕</button>' : ""}
    `;
    return row;
  }

  function renderChips() {
    const f = state.filters;
    setChipActive("chipFavorites", f.favoritesOnly);
    setChipActive("chipHideDone", f.hideDone);
    setChipActive("chipPersonFilter", !!f.person, f.person ? PERSON_LABELS[f.person] || f.person : "Person");
    setChipActive("chipSuitcaseFilter", !!f.suitcase, f.suitcase || "Koffer");
  }
  function setChipActive(id, active, label) {
    const el = document.getElementById(id);
    el.dataset.active = String(active);
    if (label) el.textContent = (id === "chipFavorites" ? "★ " : "") + label;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ------------------------------------------------------------------
     6) EVENT-DELEGATION: Liste
     ------------------------------------------------------------------ */
  categoryListEl.addEventListener("click", (e) => {
    const toggleCollapseEl = e.target.closest('[data-role="toggle-collapse"]');
    const checkAllEl = e.target.closest('[data-role="check-all"]');
    const togglePackedEl = e.target.closest('[data-role="toggle-packed"]');
    const toggleFavEl = e.target.closest('[data-role="toggle-fav"]');
    const deleteItemEl = e.target.closest('[data-role="delete-item"]');

    if (checkAllEl) {
      e.stopPropagation();
      const card = checkAllEl.closest(".category-card");
      const catId = card.dataset.categoryId;
      const items = getFilteredItems().filter((i) => i.category === catId);
      const allChecked = items.every((i) => i.packed);
      items.forEach((i) => setItemPacked(i.id, !allChecked));
      render();
      return;
    }
    if (togglePackedEl) {
      const row = togglePackedEl.closest(".item-row");
      const item = getAllItems().find((i) => i.id === row.dataset.itemId);
      setItemPacked(item.id, !item.packed);
      render();
      return;
    }
    if (toggleFavEl) {
      const row = toggleFavEl.closest(".item-row");
      toggleItemFavorite(row.dataset.itemId);
      render();
      return;
    }
    if (deleteItemEl) {
      const row = deleteItemEl.closest(".item-row");
      deleteCustomItem(row.dataset.itemId);
      render();
      showToast("Packpunkt gelöscht");
      return;
    }
    if (toggleCollapseEl) {
      const card = toggleCollapseEl.closest(".category-card");
      const catId = card.dataset.categoryId;
      state.collapsed[catId] = !state.collapsed[catId];
      saveState();
      card.dataset.collapsed = String(state.collapsed[catId]);
      return;
    }
  });

  document.getElementById("expandAllBtn").addEventListener("click", () => {
    getAllCategories().forEach((c) => (state.collapsed[c.id] = false));
    saveState();
    render();
  });
  document.getElementById("collapseAllBtn").addEventListener("click", () => {
    getAllCategories().forEach((c) => (state.collapsed[c.id] = true));
    saveState();
    render();
  });

  /* ------------------------------------------------------------------
     7) SUCHE
     ------------------------------------------------------------------ */
  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");

  searchInput.value = state.filters.search;
  clearSearchBtn.hidden = state.filters.search.length === 0;

  let searchDebounce = null;
  searchInput.addEventListener("input", () => {
    clearSearchBtn.hidden = searchInput.value.length === 0;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.filters.search = searchInput.value;
      saveState();
      render();
    }, 120);
  });
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.hidden = true;
    state.filters.search = "";
    saveState();
    render();
    searchInput.focus();
  });

  /* ------------------------------------------------------------------
     8) FILTER-CHIPS
     ------------------------------------------------------------------ */
  document.getElementById("chipFavorites").addEventListener("click", () => {
    state.filters.favoritesOnly = !state.filters.favoritesOnly;
    saveState();
    render();
  });
  document.getElementById("chipHideDone").addEventListener("click", () => {
    state.filters.hideDone = !state.filters.hideDone;
    saveState();
    render();
  });
  document.getElementById("chipPersonFilter").addEventListener("click", () => openPersonSheet());
  document.getElementById("chipSuitcaseFilter").addEventListener("click", () => openSuitcaseSheet());

  function openPersonSheet() {
    const wrap = document.getElementById("personOptions");
    wrap.innerHTML = "";
    const allOpt = buildSheetOption("Alle Personen", !state.filters.person, () => {
      state.filters.person = null;
      saveState();
      render();
      openPersonSheet();
    });
    wrap.appendChild(allOpt);
    getDistinctPersons().forEach((p) => {
      const opt = buildSheetOption(PERSON_LABELS[p] || p, state.filters.person === p, () => {
        state.filters.person = p;
        saveState();
        render();
        openPersonSheet();
      });
      wrap.appendChild(opt);
    });
    showSheet("personSheetOverlay");
  }

  function openSuitcaseSheet() {
    const wrap = document.getElementById("suitcaseOptions");
    wrap.innerHTML = "";
    const allOpt = buildSheetOption("Alle Koffer", !state.filters.suitcase, () => {
      state.filters.suitcase = null;
      saveState();
      render();
      openSuitcaseSheet();
    });
    wrap.appendChild(allOpt);
    getDistinctSuitcases().forEach((s) => {
      const opt = buildSheetOption(s, state.filters.suitcase === s, () => {
        state.filters.suitcase = s;
        saveState();
        render();
        openSuitcaseSheet();
      });
      wrap.appendChild(opt);
    });
    showSheet("suitcaseSheetOverlay");
  }

  function buildSheetOption(label, active, onClick) {
    const el = document.createElement("div");
    el.className = "sheet-option";
    el.dataset.active = String(active);
    el.innerHTML = `<span>${escapeHtml(label)}</span><span class="check-dot"></span>`;
    el.addEventListener("click", onClick);
    return el;
  }

  /* ------------------------------------------------------------------
     9) SHEETS (Bottom-Sheets) allgemein
     ------------------------------------------------------------------ */
  function showSheet(id) {
    document.getElementById(id).hidden = false;
  }
  function hideSheet(id) {
    document.getElementById(id).hidden = true;
  }
  document.querySelectorAll(".sheet-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.hasAttribute("data-close-sheet")) {
        overlay.hidden = true;
      }
    });
  });

  /* ------------------------------------------------------------------
     10) ANSICHTEN (Bottom Navigation)
     ------------------------------------------------------------------ */
  const views = ["viewList", "viewStats", "viewSettings"];
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view;
      views.forEach((v) => (document.getElementById(v).hidden = v !== target));
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b === btn));
      if (target === "viewStats") renderStats();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  /* ------------------------------------------------------------------
     11) STATISTIK
     ------------------------------------------------------------------ */
  function renderStats() {
    const items = getAllItems();
    const total = items.length;
    const packed = items.filter((i) => i.packed).length;
    const favorites = items.filter((i) => i.favorite).length;
    const open = total - packed;

    document.getElementById("statsGrid").innerHTML = [
      statCard(total, "Packpunkte gesamt"),
      statCard(packed, "Bereits gepackt"),
      statCard(open, "Noch offen"),
      statCard(favorites, "Favoriten"),
    ].join("");

    const personRows = getDistinctPersons()
      .map((p) => {
        const subset = items.filter((i) => i.person === p);
        return { label: PERSON_LABELS[p] || p, packed: subset.filter((i) => i.packed).length, total: subset.length };
      })
      .sort((a, b) => b.total - a.total);
    document.getElementById("statsPersonBars").innerHTML = personRows.map(barRow).join("");

    const catRows = getAllCategories()
      .map((c) => {
        const subset = items.filter((i) => i.category === c.id);
        return { label: c.name, packed: subset.filter((i) => i.packed).length, total: subset.length };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
    document.getElementById("statsCategoryBars").innerHTML = catRows.map(barRow).join("");
  }

  function statCard(value, label) {
    return `<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  }
  function barRow(r) {
    const pct = r.total ? Math.round((r.packed / r.total) * 100) : 0;
    return `<div class="stat-bar-row">
      <div class="stat-bar-top"><strong>${escapeHtml(r.label)}</strong><span class="count">${r.packed} / ${r.total}</span></div>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }

  /* ------------------------------------------------------------------
     12) EIGENE PACKPUNKTE / KATEGORIEN HINZUFÜGEN
     ------------------------------------------------------------------ */
  document.getElementById("fabAddItem").addEventListener("click", openAddItemSheet);

  function openAddItemSheet() {
    const catSelect = document.getElementById("newItemCategory");
    catSelect.innerHTML = getAllCategories()
      .map((c) => `<option value="${c.id}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`)
      .join("");

    const personSelect = document.getElementById("newItemPerson");
    personSelect.innerHTML = Object.keys(PERSON_LABELS)
      .map((key) => `<option value="${key}">${escapeHtml(PERSON_LABELS[key])}</option>`)
      .join("");

    document.getElementById("newItemText").value = "";
    showSheet("addItemSheetOverlay");
    setTimeout(() => document.getElementById("newItemText").focus(), 260);
  }

  document.getElementById("saveNewItemBtn").addEventListener("click", () => {
    const text = document.getElementById("newItemText").value.trim();
    if (!text) {
      showToast("Bitte eine Bezeichnung eingeben");
      return;
    }
    const categoryId = document.getElementById("newItemCategory").value;
    const person = document.getElementById("newItemPerson").value;
    addCustomItem(text, categoryId, person);
    hideSheet("addItemSheetOverlay");
    render();
    showToast("Packpunkt hinzugefügt");
  });

  document.getElementById("addCategoryBtn").addEventListener("click", () => {
    document.getElementById("newCategoryName").value = "";
    document.getElementById("newCategoryIcon").value = "";
    showSheet("addCategorySheetOverlay");
  });

  document.getElementById("saveNewCategoryBtn").addEventListener("click", () => {
    const name = document.getElementById("newCategoryName").value.trim();
    const icon = document.getElementById("newCategoryIcon").value.trim();
    if (!name) {
      showToast("Bitte einen Namen eingeben");
      return;
    }
    addCustomCategory(name, icon);
    hideSheet("addCategorySheetOverlay");
    showToast("Kategorie angelegt");
  });

  /* ------------------------------------------------------------------
     13) EINSTELLUNGEN: Aktionen
     ------------------------------------------------------------------ */
  document.getElementById("markAllBtn").addEventListener("click", () => {
    if (!confirm("Wirklich alle Packpunkte als gepackt markieren?")) return;
    getAllItems().forEach((i) => setItemPacked(i.id, true));
    render();
    showToast("Alles abgehakt ✅");
  });

  document.getElementById("resetAllBtn").addEventListener("click", () => {
    if (!confirm("Wirklich den gesamten Packfortschritt zurücksetzen?")) return;
    getAllItems().forEach((i) => setItemPacked(i.id, false));
    render();
    showToast("Fortschritt zurückgesetzt");
  });

  document.getElementById("printBtn").addEventListener("click", () => {
    window.print();
  });

  /* ------------------------------------------------------------------
     14) IMPORT / EXPORT
     ------------------------------------------------------------------ */
  document.getElementById("exportJsonBtn").addEventListener("click", () => {
    const dataStr = JSON.stringify(state, null, 2);
    downloadFile(dataStr, "packliste-spanien-export.json", "application/json");
    showToast("JSON exportiert");
  });

  document.getElementById("importJsonBtn").addEventListener("click", () => {
    document.getElementById("importFileInput").click();
  });

  document.getElementById("importFileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        state = Object.assign(createDefaultState(), imported, {
          filters: Object.assign(createDefaultState().filters, imported.filters || {}),
        });
        saveState();
        applyTheme();
        render();
        showToast("Import erfolgreich");
      } catch (err) {
        console.error(err);
        showToast("Import fehlgeschlagen: ungültige Datei");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  document.getElementById("exportCsvBtn").addEventListener("click", () => {
    const items = getAllItems();
    const catNameById = {};
    getAllCategories().forEach((c) => (catNameById[c.id] = c.name));
    const header = ["Kategorie", "Unterkategorie", "Person", "Koffer", "Text", "Gepackt", "Favorit"];
    const rows = items.map((i) => [
      catNameById[i.category] || i.category,
      i.sub || "",
      PERSON_LABELS[i.person] || i.person || "",
      i.suitcase || "",
      i.text,
      i.packed ? "Ja" : "Nein",
      i.favorite ? "Ja" : "Nein",
    ]);
    const csv = [header].concat(rows).map((r) => r.map(csvEscape).join(";")).join("\r\n");
    downloadFile("\uFEFF" + csv, "packliste-spanien-export.csv", "text/csv;charset=utf-8");
    showToast("CSV exportiert");
  });

  function csvEscape(value) {
    const str = String(value);
    if (/[;"\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ------------------------------------------------------------------
     15) DESIGN-MODUS (Hell / Dunkel / System)
     ------------------------------------------------------------------ */
  const themeSelect = document.getElementById("themeSelect");
  themeSelect.value = state.theme;
  themeSelect.addEventListener("change", () => {
    state.theme = themeSelect.value;
    saveState();
    applyTheme();
  });

  document.getElementById("themeToggleBtn").addEventListener("click", () => {
    const order = ["system", "light", "dark"];
    const next = order[(order.indexOf(state.theme) + 1) % order.length];
    state.theme = next;
    themeSelect.value = next;
    saveState();
    applyTheme();
    showToast("Darstellung: " + (next === "system" ? "System" : next === "light" ? "Hell" : "Dunkel"));
  });

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    const isDark =
      state.theme === "dark" ||
      (state.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.getElementById("themeIconSun").style.display = isDark ? "none" : "block";
    document.getElementById("themeIconMoon").style.display = isDark ? "block" : "none";
  }

  /* ------------------------------------------------------------------
     16) TOAST-BENACHRICHTIGUNGEN
     ------------------------------------------------------------------ */
  let toastTimer = null;
  function showToast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ------------------------------------------------------------------
     17) SERVICE WORKER REGISTRIEREN (Offline-Unterstützung)
     ------------------------------------------------------------------ */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch((err) => {
        console.warn("Service Worker konnte nicht registriert werden:", err);
      });
    });
  }

  /* ------------------------------------------------------------------
     19) GEMEINSAME BEARBEITUNG (Sync über Firebase Firestore)
     ------------------------------------------------------------------
     Zwei Geräte (z. B. du und deine Partnerin/dein Partner) können
     dieselbe Packliste bearbeiten. Ein Gerät erstellt eine geteilte
     Liste und erhält einen 6-stelligen Code, das andere Gerät tritt mit
     diesem Code bei. Danach werden Packstatus, Favoriten und eigene
     Punkte/Kategorien in Echtzeit zwischen beiden Geräten abgeglichen.
     Ohne gültige Konfiguration in firebase-config.js bleibt die App
     unverändert im reinen Lokalmodus (kein Fehler, kein Sync).
     ------------------------------------------------------------------ */
  let db = null;
  let unsubscribeCloud = null;
  let isApplyingRemoteUpdate = false;
  let cloudPushTimer = null;

  function isFirebaseConfigured() {
    return (
      typeof firebase !== "undefined" &&
      typeof FIREBASE_CONFIG !== "undefined" &&
      FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.apiKey !== "DEIN_API_KEY"
    );
  }

  function initFirebase() {
    if (!isFirebaseConfigured()) return false;
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      return true;
    } catch (err) {
      console.error("Firebase-Initialisierung fehlgeschlagen:", err);
      return false;
    }
  }

  function generateSyncCode() {
    // Zeichen ohne leicht verwechselbare (0/O, 1/I) für bessere Lesbarkeit beim Diktieren
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function getSyncPayload() {
    return {
      overrides: state.overrides,
      customItems: state.customItems,
      customCategories: state.customCategories,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
  }

  function applyRemoteData(data) {
    isApplyingRemoteUpdate = true;
    state.overrides = data.overrides || {};
    state.customItems = data.customItems || [];
    state.customCategories = data.customCategories || [];
    saveState();
    isApplyingRemoteUpdate = false;
    render();
  }

  function subscribeToCloud(code) {
    if (!db) return;
    if (unsubscribeCloud) unsubscribeCloud();
    unsubscribeCloud = db.collection("packlisten").doc(code).onSnapshot(
      (doc) => {
        if (!doc.exists) return;
        applyRemoteData(doc.data());
      },
      (err) => {
        console.error("Sync-Fehler:", err);
        showToast("Synchronisierung unterbrochen – bitte Internetverbindung prüfen");
      }
    );
  }

  function pushToCloudDebounced() {
    if (!state.syncCode || !db || isApplyingRemoteUpdate) return;
    clearTimeout(cloudPushTimer);
    cloudPushTimer = setTimeout(() => {
      db.collection("packlisten")
        .doc(state.syncCode)
        .set(getSyncPayload(), { merge: true })
        .catch((err) => console.error("Konnte Änderungen nicht synchronisieren:", err));
    }, 400);
  }

  async function createSharedList() {
    if (!initFirebase()) {
      showToast("Firebase ist nicht konfiguriert – siehe firebase-config.js");
      return;
    }
    const code = generateSyncCode();
    try {
      await db.collection("packlisten").doc(code).set(getSyncPayload());
      state.syncCode = code;
      saveState();
      subscribeToCloud(code);
      renderSyncStatus();
      document.getElementById("syncCodeDisplay").textContent = code;
      showSheet("syncCodeSheetOverlay");
    } catch (err) {
      console.error(err);
      showToast("Geteilte Liste konnte nicht erstellt werden");
    }
  }

  async function joinSharedList(rawCode) {
    if (!initFirebase()) {
      showToast("Firebase ist nicht konfiguriert – siehe firebase-config.js");
      return;
    }
    const code = rawCode.trim().toUpperCase();
    if (code.length < 4) {
      showToast("Bitte einen gültigen Code eingeben");
      return;
    }
    try {
      const doc = await db.collection("packlisten").doc(code).get();
      if (!doc.exists) {
        showToast("Diesen Code gibt es nicht");
        return;
      }
      applyRemoteData(doc.data());
      state.syncCode = code;
      saveState();
      subscribeToCloud(code);
      renderSyncStatus();
      showToast("Verbunden mit geteilter Liste " + code);
    } catch (err) {
      console.error(err);
      showToast("Verbindung fehlgeschlagen");
    }
  }

  function disconnectSync() {
    if (unsubscribeCloud) unsubscribeCloud();
    unsubscribeCloud = null;
    state.syncCode = null;
    saveState();
    renderSyncStatus();
    showToast("Synchronisierung getrennt");
  }

  function renderSyncStatus() {
    const statusText = document.getElementById("syncStatusText");
    const createBtn = document.getElementById("createSyncBtn");
    const joinBtn = document.getElementById("joinSyncBtn");
    const disconnectBtn = document.getElementById("disconnectSyncBtn");
    if (state.syncCode) {
      statusText.textContent = `Verbunden mit geteilter Liste „${state.syncCode}“. Änderungen werden automatisch mit allen verbundenen Geräten abgeglichen.`;
      createBtn.hidden = true;
      joinBtn.hidden = true;
      disconnectBtn.hidden = false;
    } else {
      statusText.textContent =
        "Noch nicht verbunden. Erstelle eine geteilte Liste oder verbinde dich mit dem Code deiner Partnerin bzw. deines Partners, um die Packliste gemeinsam in Echtzeit zu bearbeiten.";
      createBtn.hidden = false;
      joinBtn.hidden = false;
      disconnectBtn.hidden = true;
    }
  }

  document.getElementById("createSyncBtn").addEventListener("click", createSharedList);
  document.getElementById("joinSyncBtn").addEventListener("click", () => {
    document.getElementById("joinSyncCodeInput").value = "";
    showSheet("joinSyncSheetOverlay");
  });
  document.getElementById("confirmJoinSyncBtn").addEventListener("click", () => {
    const code = document.getElementById("joinSyncCodeInput").value;
    joinSharedList(code).then(() => hideSheet("joinSyncSheetOverlay"));
  });
  document.getElementById("disconnectSyncBtn").addEventListener("click", () => {
    if (confirm("Synchronisierung wirklich trennen? Die Liste bleibt lokal auf diesem Gerät erhalten.")) {
      disconnectSync();
    }
  });
  document.getElementById("copySyncCodeBtn").addEventListener("click", () => {
    const code = document.getElementById("syncCodeDisplay").textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => showToast("Code kopiert"));
    }
  });

  /* ------------------------------------------------------------------
     20) INITIALISIERUNG
     ------------------------------------------------------------------ */
  applyTheme();
  renderSyncStatus();
  if (state.syncCode && initFirebase()) {
    subscribeToCloud(state.syncCode);
  }
  render();
})();
