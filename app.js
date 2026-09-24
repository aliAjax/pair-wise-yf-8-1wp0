const storageKey = "zfl17-film-strip-desk";

const fallbackThumbs = ["#d49b35", "#347d89", "#b54d48", "#4d7656", "#6d6378"];

const STATUS_PENDING = "待检查";
const STATUS_PROCESSED = "已处理";
const STATUS_SCREENABLE = "可放映";
const STATUSES = [STATUS_PENDING, STATUS_PROCESSED, STATUS_SCREENABLE];

const defaultState = {
  reelTitle: "春日试映A卷",
  segments: [
    {
      id: crypto.randomUUID(),
      code: "A-001",
      duration: 18,
      shift: "正常",
      damage: "完好",
      note: "开场街景，节奏平稳，适合保留原顺序。",
      thumb: "",
      status: STATUS_SCREENABLE
    },
    {
      id: crypto.randomUUID(),
      code: "A-006",
      duration: 9,
      shift: "偏红",
      damage: "轻微划痕",
      note: "人物近景左侧有划痕，试映时留意是否明显。",
      thumb: "",
      status: STATUS_PENDING
    },
    {
      id: crypto.randomUUID(),
      code: "A-012",
      duration: 14,
      shift: "褪色",
      damage: "接片松动",
      note: "接片位置靠近段尾，放映前建议重新压平。",
      thumb: "",
      status: STATUS_PROCESSED
    }
  ]
};

let state = loadState();
let draggedId = null;
let editingId = null;

const els = {
  reelTitle: document.querySelector("#reelTitle"),
  colorFilter: document.querySelector("#colorFilter"),
  searchInput: document.querySelector("#searchInput"),
  segmentForm: document.querySelector("#segmentForm"),
  formTitle: document.querySelector("#formTitle"),
  codeInput: document.querySelector("#codeInput"),
  durationInput: document.querySelector("#durationInput"),
  shiftInput: document.querySelector("#shiftInput"),
  damageInput: document.querySelector("#damageInput"),
  thumbInput: document.querySelector("#thumbInput"),
  thumbHint: document.querySelector("#thumbHint"),
  noteInput: document.querySelector("#noteInput"),
  submitBtn: document.querySelector("#submitBtn"),
  cancelEditBtn: document.querySelector("#cancelEditBtn"),
  segmentList: document.querySelector("#segmentList"),
  warningList: document.querySelector("#warningList"),
  screenableDuration: document.querySelector("#screenableDuration"),
  pendingCount: document.querySelector("#pendingCount"),
  segmentCount: document.querySelector("#segmentCount"),
  exportBtn: document.querySelector("#exportBtn")
};

function loadState() {
  const defaults = structuredClone(defaultState);
  const saved = localStorage.getItem(storageKey);
  if (!saved) return defaults;
  try {
    const parsed = JSON.parse(saved);
    // 旧版本数据没有状态字段：逐段补成「待检查」，原胶片卷进度不丢
    parsed.segments = (parsed.segments || []).map((item) => ({
      ...item,
      duration: Number(item.duration) || 0,
      status: STATUSES.includes(item.status) ? item.status : STATUS_PENDING
    }));
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function isFlawed(item) {
  return item.damage !== "完好" || item.shift !== "正常";
}

// 破损或偏色、且还没标为已处理时，不能直接可放映
function canMarkScreenable(item) {
  return !isFlawed(item) || item.status === STATUS_PROCESSED;
}

function canSetStatus(item, next) {
  if (next !== STATUS_SCREENABLE) return true;
  return canMarkScreenable(item);
}

function getFilteredSegments() {
  const color = els.colorFilter.value;
  const keyword = els.searchInput.value.trim();
  return state.segments.filter((item) => {
    const matchesColor = color === "all" || item.shift === color;
    const matchesKeyword = !keyword || `${item.code}${item.note}${item.damage}`.includes(keyword);
    return matchesColor && matchesKeyword;
  });
}

function renderStats() {
  const screenable = state.segments
    .filter((item) => item.status === STATUS_SCREENABLE)
    .reduce((sum, item) => sum + Number(item.duration), 0);
  const pending = state.segments.filter((item) => item.status === STATUS_PENDING).length;
  els.screenableDuration.textContent = formatDuration(screenable);
  els.pendingCount.textContent = pending;
  els.segmentCount.textContent = state.segments.length;
}

function renderStatusControls(item) {
  return STATUSES.map((status) => {
    const active = item.status === status;
    const disabled = !active && !canSetStatus(item, status);
    const hint = disabled ? `需先标记为「${STATUS_PROCESSED}」` : `标记为${status}`;
    return `
      <button
        type="button"
        class="status-btn status-${escapeHtml(status)}${active ? " active" : ""}"
        data-status-id="${item.id}"
        data-status="${escapeHtml(status)}"
        ${disabled ? "disabled" : ""}
        title="${hint}"
      >${status}</button>
    `;
  }).join("");
}

function renderList() {
  const segments = getFilteredSegments();
  els.segmentList.innerHTML =
    segments
      .map((item) => {
        const realIndex = state.segments.findIndex((segment) => segment.id === item.id);
        const hasDamage = item.damage !== "完好";
        const flawed = isFlawed(item);
        return `
          <article class="segment-card${editingId === item.id ? " editing" : ""}" draggable="true" data-id="${item.id}">
            <div class="thumb">
              ${
                item.thumb
                  ? `<img src="${item.thumb}" alt="${escapeHtml(item.code)}缩略图" />`
                  : `<div class="film-placeholder" style="background:${fallbackThumbs[realIndex % fallbackThumbs.length]}">${escapeHtml(item.code)}</div>`
              }
            </div>
            <div class="segment-main">
              <div class="segment-title">
                <strong>${realIndex + 1}. ${escapeHtml(item.code)}</strong>
                <span>${formatDuration(item.duration)}</span>
                <span class="status-badge status-${escapeHtml(item.status)}">${item.status}</span>
              </div>
              <div class="tag-row">
                <span class="tag">${escapeHtml(item.shift)}</span>
                <span class="tag ${hasDamage ? "damage" : "ok"}">${escapeHtml(item.damage)}</span>
              </div>
              <p class="segment-note">${escapeHtml(item.note || "没有备注。")}</p>
              <div class="status-row">
                ${renderStatusControls(item)}
                ${flawed && item.status !== STATUS_PROCESSED && item.status !== STATUS_SCREENABLE
                  ? `<span class="status-note">破损或偏色处理完前不能直接可放映</span>`
                  : ""}
              </div>
            </div>
            <div class="segment-actions">
              <button type="button" title="上移" data-move-up="${item.id}">↑</button>
              <button type="button" title="下移" data-move-down="${item.id}">↓</button>
              <button type="button" title="编辑编号、时长、颜色或破损" data-edit="${item.id}">✎</button>
              <button type="button" title="删除" data-delete="${item.id}">×</button>
            </div>
          </article>
        `;
      })
      .join("") || `<p class="empty">没有符合筛选的片段。</p>`;
}

function renderWarnings() {
  const warnings = state.segments.filter((item) => item.damage !== "完好" || item.shift !== "正常");
  els.warningList.innerHTML =
    warnings
      .map((item) => {
        const index = state.segments.findIndex((segment) => segment.id === item.id) + 1;
        const reasons = [item.shift !== "正常" ? item.shift : "", item.damage !== "完好" ? item.damage : ""].filter(Boolean).join(" · ");
        return `
          <div class="warning-item">
            <strong>${index}. ${escapeHtml(item.code)}｜${item.status}</strong>
            <span>${escapeHtml(reasons)}${item.note ? `：${escapeHtml(item.note)}` : ""}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">当前清单没有颜色偏移或破损提醒。</p>`;
}

function renderFormMode() {
  const editing = editingId !== null;
  els.formTitle.textContent = editing ? "修改片段" : "录入片段";
  els.submitBtn.textContent = editing ? "保存修改" : "加入放映清单";
  els.cancelEditBtn.hidden = !editing;
  els.thumbHint.textContent = editing ? "不选文件则保留原缩略图" : "";
}

function renderAll() {
  saveState();
  if (editingId !== null && !state.segments.some((item) => item.id === editingId)) {
    exitEditMode(false);
  }
  els.reelTitle.value = state.reelTitle;
  renderFormMode();
  renderStats();
  renderList();
  renderWarnings();
}

function formatDuration(seconds) {
  const value = Number(seconds) || 0;
  const minutes = Math.floor(value / 60);
  const rest = String(value % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

async function addOrUpdateSegment(event) {
  event.preventDefault();
  const code = els.codeInput.value.trim();
  const duration = Number(els.durationInput.value);
  const shift = els.shiftInput.value;
  const damage = els.damageInput.value;
  const note = els.noteInput.value.trim();
  const newThumb = await readFileAsDataUrl(els.thumbInput.files[0]);

  if (editingId !== null) {
    const item = state.segments.find((segment) => segment.id === editingId);
    if (item) {
      // 编号、时长、颜色或破损改动后，该片段回到待检查；仅改备注/缩略图不影响状态
      const coreChanged =
        item.code !== code ||
        Number(item.duration) !== duration ||
        item.shift !== shift ||
        item.damage !== damage;
      item.code = code;
      item.duration = duration;
      item.shift = shift;
      item.damage = damage;
      item.note = note;
      if (newThumb) item.thumb = newThumb;
      if (coreChanged) item.status = STATUS_PENDING;
    }
    exitEditMode(false);
  } else {
    state.segments.push({
      id: crypto.randomUUID(),
      code,
      duration,
      shift,
      damage,
      note,
      thumb: newThumb,
      status: STATUS_PENDING
    });
    els.segmentForm.reset();
    els.durationInput.value = 12;
  }
  renderAll();
}

function enterEditMode(id) {
  const item = state.segments.find((segment) => segment.id === id);
  if (!item) return;
  editingId = id;
  els.codeInput.value = item.code;
  els.durationInput.value = item.duration;
  els.shiftInput.value = item.shift;
  els.damageInput.value = item.damage;
  els.noteInput.value = item.note || "";
  els.thumbInput.value = "";
  renderAll();
  els.codeInput.focus();
}

function exitEditMode(shouldRender = true) {
  editingId = null;
  els.segmentForm.reset();
  els.durationInput.value = 12;
  if (shouldRender) renderAll();
}

function setStatus(id, next) {
  const item = state.segments.find((segment) => segment.id === id);
  if (!item || item.status === next || !canSetStatus(item, next)) return;
  item.status = next;
  renderAll();
}

function moveSegment(id, direction) {
  const index = state.segments.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.segments.length) return;
  const [item] = state.segments.splice(index, 1);
  state.segments.splice(target, 0, item);
  renderAll();
}

function exportList() {
  const total = state.segments.reduce((sum, item) => sum + Number(item.duration), 0);
  const screenableTotal = state.segments
    .filter((item) => item.status === STATUS_SCREENABLE)
    .reduce((sum, item) => sum + Number(item.duration), 0);
  const lines = [
    `胶片卷：${state.reelTitle || "未命名胶片卷"}`,
    `片段数：${state.segments.length}`,
    `总时长：${formatDuration(total)}`,
    `可放总时长：${formatDuration(screenableTotal)}`,
    `待检查：${state.segments.filter((item) => item.status === STATUS_PENDING).length} 段`,
    "",
    ...state.segments.map(
      (item, index) =>
        `${index + 1}. ${item.code}｜${formatDuration(item.duration)}｜${item.shift}｜${item.damage}｜状态：${item.status}｜${item.note || "无备注"}`
    )
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${state.reelTitle || "film-reel"}-checklist.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

els.reelTitle.addEventListener("input", () => {
  state.reelTitle = els.reelTitle.value;
  saveState();
});
els.colorFilter.addEventListener("change", renderList);
els.searchInput.addEventListener("input", renderList);
els.segmentForm.addEventListener("submit", addOrUpdateSegment);
els.cancelEditBtn.addEventListener("click", () => exitEditMode());
els.exportBtn.addEventListener("click", exportList);

els.segmentList.addEventListener("click", (event) => {
  const statusBtn = event.target.closest("[data-status-id]");
  const edit = event.target.closest("[data-edit]");
  const up = event.target.closest("[data-move-up]");
  const down = event.target.closest("[data-move-down]");
  const remove = event.target.closest("[data-delete]");
  if (statusBtn) setStatus(statusBtn.dataset.statusId, statusBtn.dataset.status);
  if (edit) enterEditMode(edit.dataset.edit);
  if (up) moveSegment(up.dataset.moveUp, -1);
  if (down) moveSegment(down.dataset.moveDown, 1);
  if (remove) {
    state.segments = state.segments.filter((item) => item.id !== remove.dataset.delete);
    renderAll();
  }
});

els.segmentList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card) return;
  draggedId = card.dataset.id;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});

els.segmentList.addEventListener("dragend", (event) => {
  event.target.closest("[data-id]")?.classList.remove("dragging");
  draggedId = null;
});

els.segmentList.addEventListener("dragover", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card || !draggedId || card.dataset.id === draggedId) return;
  event.preventDefault();
  const fromIndex = state.segments.findIndex((item) => item.id === draggedId);
  const toIndex = state.segments.findIndex((item) => item.id === card.dataset.id);
  if (fromIndex < 0 || toIndex < 0) return;
  const [item] = state.segments.splice(fromIndex, 1);
  state.segments.splice(toIndex, 0, item);
  renderAll();
});

renderAll();
