const storageKey = "zfl17-film-strip-desk";

const fallbackThumbs = ["#d49b35", "#347d89", "#b54d48", "#4d7656", "#6d6378"];

const STATUS = {
  PENDING: "pending",
  PROCESSED: "processed",
  READY: "ready"
};

const statusMeta = {
  [STATUS.PENDING]: { label: "待检查", className: "pending" },
  [STATUS.PROCESSED]: { label: "已处理", className: "processed" },
  [STATUS.READY]: { label: "可放映", className: "ready" }
};

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
      status: STATUS.READY
    },
    {
      id: crypto.randomUUID(),
      code: "A-006",
      duration: 9,
      shift: "偏红",
      damage: "轻微划痕",
      note: "人物近景左侧有划痕，试映时留意是否明显。",
      thumb: "",
      status: STATUS.PENDING
    },
    {
      id: crypto.randomUUID(),
      code: "A-012",
      duration: 14,
      shift: "褪色",
      damage: "接片松动",
      note: "接片位置靠近段尾，放映前建议重新压平。",
      thumb: "",
      status: STATUS.PROCESSED
    }
  ]
};

let state = loadState();
let draggedId = null;
let editingId = null;

const els = {
  reelTitle: document.querySelector("#reelTitle"),
  colorFilter: document.querySelector("#colorFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  searchInput: document.querySelector("#searchInput"),
  segmentForm: document.querySelector("#segmentForm"),
  codeInput: document.querySelector("#codeInput"),
  durationInput: document.querySelector("#durationInput"),
  shiftInput: document.querySelector("#shiftInput"),
  damageInput: document.querySelector("#damageInput"),
  thumbInput: document.querySelector("#thumbInput"),
  noteInput: document.querySelector("#noteInput"),
  segmentList: document.querySelector("#segmentList"),
  warningList: document.querySelector("#warningList"),
  totalDuration: document.querySelector("#totalDuration"),
  projectableDuration: document.querySelector("#projectableDuration"),
  pendingCount: document.querySelector("#pendingCount"),
  segmentCount: document.querySelector("#segmentCount"),
  exportBtn: document.querySelector("#exportBtn")
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  const base = saved
    ? (() => {
        try {
          return { ...structuredClone(defaultState), ...JSON.parse(saved) };
        } catch {
          return structuredClone(defaultState);
        }
      })()
    : structuredClone(defaultState);
  base.segments = (base.segments || []).map((item) => ({
    ...item,
    status: statusMeta[item.status] ? item.status : STATUS.PENDING
  }));
  return base;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getFilteredSegments() {
  const color = els.colorFilter.value;
  const status = els.statusFilter.value;
  const keyword = els.searchInput.value.trim();
  return state.segments.filter((item) => {
    const matchesColor = color === "all" || item.shift === color;
    const matchesStatus = status === "all" || item.status === status;
    const matchesKeyword = !keyword || `${item.code}${item.note}${item.damage}`.includes(keyword);
    return matchesColor && matchesStatus && matchesKeyword;
  });
}

function hasIssue(item) {
  return item.damage !== "完好" || item.shift !== "正常";
}

function canProject(item) {
  return !hasIssue(item);
}

function renderStats() {
  const total = state.segments.reduce((sum, item) => sum + Number(item.duration), 0);
  const projectable = state.segments
    .filter((item) => item.status === STATUS.READY)
    .reduce((sum, item) => sum + Number(item.duration), 0);
  const pending = state.segments.filter((item) => item.status === STATUS.PENDING).length;
  els.totalDuration.textContent = formatDuration(total);
  els.projectableDuration.textContent = formatDuration(projectable);
  els.pendingCount.textContent = pending;
  els.segmentCount.textContent = state.segments.length;
}

function renderList() {
  const segments = getFilteredSegments();
  els.segmentList.innerHTML =
    segments
      .map((item) => {
        const realIndex = state.segments.findIndex((segment) => segment.id === item.id);
        if (editingId === item.id) return renderEditCard(item, realIndex);
        return renderViewCard(item, realIndex);
      })
      .join("") || `<p class="empty">没有符合筛选的片段。</p>`;
}

function renderViewCard(item, realIndex) {
  const damaged = item.damage !== "完好";
  const meta = statusMeta[item.status];
  const blocked = item.status === STATUS.PROCESSED && !canProject(item);
  const reasons = [item.shift !== "正常" ? item.shift : "", item.damage !== "完好" ? item.damage : ""]
    .filter(Boolean)
    .join("、");

  let actions = "";
  if (item.status === STATUS.PENDING) {
    actions = `
      <button type="button" data-mark="${item.id}:${STATUS.PROCESSED}">标为已处理</button>
      <button type="button" data-mark="${item.id}:${STATUS.READY}" ${canProject(item) ? "" : "disabled"} title="存在${escapeAttr(reasons)}时不可直接标为可放映">标为可放映</button>
    `;
  } else if (item.status === STATUS.PROCESSED) {
    actions = `
      <button type="button" data-mark="${item.id}:${STATUS.READY}" ${canProject(item) ? "" : "disabled"} title="先修复颜色偏移与破损后才能标为可放映">标为可放映</button>
      <button type="button" data-mark="${item.id}:${STATUS.PENDING}">退回待检查</button>
    `;
  } else {
    actions = `<button type="button" data-mark="${item.id}:${STATUS.PROCESSED}">退回已处理</button>`;
  }

  return `
    <article class="segment-card status-${meta.className}" draggable="true" data-id="${item.id}">
      <div class="thumb">
        ${
          item.thumb
            ? `<img src="${item.thumb}" alt="${escapeAttr(item.code)}缩略图" />`
            : `<div class="film-placeholder" style="background:${fallbackThumbs[realIndex % fallbackThumbs.length]}">${escapeHtml(item.code)}</div>`
        }
      </div>
      <div class="segment-main">
        <div class="segment-title">
          <strong>${realIndex + 1}. ${escapeHtml(item.code)}</strong>
          <span>${formatDuration(item.duration)}</span>
          <span class="status-badge ${meta.className}">${meta.label}</span>
        </div>
        <div class="tag-row">
          <span class="tag">${escapeHtml(item.shift)}</span>
          <span class="tag ${damaged ? "damage" : "ok"}">${escapeHtml(item.damage)}</span>
        </div>
        ${blocked ? `<p class="gate-note">破损或偏色（${escapeHtml(reasons)}）尚未处理，不能标为可放映。</p>` : ""}
        <p class="segment-note">${escapeHtml(item.note || "没有备注。")}</p>
      </div>
      <div class="segment-actions">
        <button type="button" title="上移" data-move-up="${item.id}">↑</button>
        <button type="button" title="下移" data-move-down="${item.id}">↓</button>
        <button type="button" title="编辑" data-edit="${item.id}">改</button>
        <button type="button" title="删除" data-delete="${item.id}">×</button>
        ${actions}
      </div>
    </article>
  `;
}

function renderEditCard(item, realIndex) {
  return `
    <article class="segment-card editing status-${statusMeta[item.status].className}" draggable="false" data-id="${item.id}">
      <div class="edit-head">
        <strong>编辑第 ${realIndex + 1} 段（${escapeHtml(item.code)}）</strong>
        <span class="status-badge ${statusMeta[item.status].className}">${statusMeta[item.status].label}</span>
      </div>
      <p class="edit-tip">改动编号、时长、颜色或破损情况后，该片段将自动回到待检查。</p>
      <form class="edit-form" data-edit-form="${item.id}">
        <div class="edit-grid">
          <label>
            片段编号
            <input data-field="code" required value="${escapeAttr(item.code)}" />
          </label>
          <label>
            时长秒数
            <input data-field="duration" required type="number" min="1" value="${escapeAttr(item.duration)}" />
          </label>
          <label>
            颜色偏移
            <select data-field="shift">${optionList(["正常", "偏红", "偏青", "偏黄", "褪色"], item.shift)}</select>
          </label>
          <label>
            破损情况
            <select data-field="damage">${optionList(["完好", "轻微划痕", "齿孔破损", "接片松动", "需跳过"], item.damage)}</select>
          </label>
          <label class="edit-note">
            备注
            <textarea data-field="note" rows="3">${escapeHtml(item.note)}</textarea>
          </label>
        </div>
        <p class="edit-error" data-edit-error></p>
        <div class="edit-buttons">
          <button class="primary" type="submit" data-save="${item.id}">保存</button>
          <button type="button" data-cancel="${item.id}">取消</button>
        </div>
      </form>
    </article>
  `;
}

function optionList(options, selected) {
  return options
    .map((value) => `<option value="${escapeAttr(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function renderWarnings() {
  const warnings = state.segments.filter(hasIssue);
  els.warningList.innerHTML =
    warnings
      .map((item) => {
        const index = state.segments.findIndex((segment) => segment.id === item.id) + 1;
        const reasons = [item.shift !== "正常" ? item.shift : "", item.damage !== "完好" ? item.damage : ""]
          .filter(Boolean)
          .join(" · ");
        const meta = statusMeta[item.status];
        return `
          <div class="warning-item">
            <div class="warning-head">
              <strong>${index}. ${escapeHtml(item.code)}</strong>
              <span class="status-badge ${meta.className}">${meta.label}</span>
            </div>
            <span>${escapeHtml(reasons)}${item.note ? `：${escapeHtml(item.note)}` : ""}</span>
          </div>
        `;
      })
      .join("") || `<p class="empty">当前清单没有颜色偏移或破损提醒。</p>`;
}

function renderAll() {
  saveState();
  els.reelTitle.value = state.reelTitle;
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

async function addSegment(event) {
  event.preventDefault();
  const thumb = await readFileAsDataUrl(els.thumbInput.files[0]);
  state.segments.push({
    id: crypto.randomUUID(),
    code: els.codeInput.value.trim(),
    duration: Number(els.durationInput.value),
    shift: els.shiftInput.value,
    damage: els.damageInput.value,
    note: els.noteInput.value.trim(),
    thumb,
    status: STATUS.PENDING
  });
  els.segmentForm.reset();
  els.durationInput.value = 12;
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

function markStatus(id, nextStatus) {
  const item = state.segments.find((segment) => segment.id === id);
  if (!item) return;
  if (nextStatus === STATUS.READY && !canProject(item)) return;
  item.status = nextStatus;
  renderAll();
}

function startEdit(id) {
  editingId = id;
  renderList();
}

function cancelEdit() {
  editingId = null;
  renderList();
}

function saveEdit(id, form) {
  const item = state.segments.find((segment) => segment.id === id);
  if (!item) return;
  const errorBox = form.querySelector("[data-edit-error]");
  const code = form.querySelector('[data-field="code"]').value.trim();
  const duration = Number(form.querySelector('[data-field="duration"]').value);
  const shift = form.querySelector('[data-field="shift"]').value;
  const damage = form.querySelector('[data-field="damage"]').value;
  const note = form.querySelector('[data-field="note"]').value.trim();

  if (!code) {
    errorBox.textContent = "请填写片段编号。";
    return;
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    errorBox.textContent = "时长必须是大于 0 的秒数。";
    return;
  }

  const trackedChanged =
    code !== item.code || duration !== Number(item.duration) || shift !== item.shift || damage !== item.damage;

  item.code = code;
  item.duration = duration;
  item.shift = shift;
  item.damage = damage;
  item.note = note;
  if (trackedChanged) item.status = STATUS.PENDING;

  editingId = null;
  renderAll();
}

function exportList() {
  const projectable = state.segments
    .filter((item) => item.status === STATUS.READY)
    .reduce((sum, item) => sum + Number(item.duration), 0);
  const lines = [
    `胶片卷：${state.reelTitle || "未命名胶片卷"}`,
    `导出时间：${new Date().toLocaleString()}`,
    `总时长：${formatDuration(state.segments.reduce((sum, item) => sum + Number(item.duration), 0))}`,
    `可放总时长：${formatDuration(projectable)}`,
    `片段数：${state.segments.length}`,
    "",
    ...state.segments.map(
      (item, index) =>
        `${index + 1}. ${item.code}｜${formatDuration(item.duration)}｜${item.shift}｜${item.damage}｜状态：${statusMeta[item.status].label}｜${item.note || "无备注"}`
    )
  ];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/plain;charset=utf-8" });
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

function escapeAttr(value) {
  return escapeHtml(value);
}

els.reelTitle.addEventListener("input", () => {
  state.reelTitle = els.reelTitle.value;
  saveState();
});
els.colorFilter.addEventListener("change", renderList);
els.statusFilter.addEventListener("change", renderList);
els.searchInput.addEventListener("input", renderList);
els.segmentForm.addEventListener("submit", addSegment);
els.exportBtn.addEventListener("click", exportList);

els.segmentList.addEventListener("click", (event) => {
  const mark = event.target.closest("[data-mark]");
  const up = event.target.closest("[data-move-up]");
  const down = event.target.closest("[data-move-down]");
  const edit = event.target.closest("[data-edit]");
  const cancel = event.target.closest("[data-cancel]");
  const remove = event.target.closest("[data-delete]");
  if (mark) {
    const [id, nextStatus] = mark.dataset.mark.split(":");
    markStatus(id, nextStatus);
    return;
  }
  if (edit) {
    startEdit(edit.dataset.edit);
    return;
  }
  if (cancel) {
    cancelEdit();
    return;
  }
  if (up) moveSegment(up.dataset.moveUp, -1);
  if (down) moveSegment(down.dataset.moveDown, 1);
  if (remove) {
    state.segments = state.segments.filter((item) => item.id !== remove.dataset.delete);
    if (editingId === remove.dataset.delete) editingId = null;
    renderAll();
  }
});

els.segmentList.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-edit-form]");
  if (!form) return;
  event.preventDefault();
  saveEdit(form.dataset.editForm, form);
});

els.segmentList.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card || card.classList.contains("editing")) return;
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
  if (!card || !draggedId || card.dataset.id === draggedId || card.classList.contains("editing")) return;
  event.preventDefault();
  const fromIndex = state.segments.findIndex((item) => item.id === draggedId);
  const toIndex = state.segments.findIndex((item) => item.id === card.dataset.id);
  if (fromIndex < 0 || toIndex < 0) return;
  const [item] = state.segments.splice(fromIndex, 1);
  state.segments.splice(toIndex, 0, item);
  renderAll();
});

renderAll();
