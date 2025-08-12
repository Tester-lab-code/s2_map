// ===== 共有APIエンドポイント =====
const API_URL = 'https://lucky-hat-c148.keisuke-egawa.workers.dev';

// ===== 読み込み（共有） =====
async function loadData() {
  const res = await fetch(API_URL, { method: 'GET', cache: 'no-store' });
  if (!res.ok) throw new Error('サーバーからの読み込みに失敗しました');
  return await res.json(); // { headers, rows }
}

// ===== 保存（共有・自動で2リポジトリ同期） =====
async function saveShared(headers, rows) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ headers, rows })
  });
  const j = await res.json();
  if (!j.ok) throw new Error('保存に失敗しました');
}

// ===== ローカルバックアップ =====
function storageKey() { return 'level-list:' + location.pathname; }

// ===== 列定義：A..N(14列) → レベル7..1 / 進捗7..1 =====
function defineColumnsByOrder(headers) {
  const cols = [];
  const safeHeader = (idx) => headers[idx] ?? `__pad${idx}`;

  for (let i = 0; i < 7; i++) {
    const levelNo = 7 - i;         // 7..1
    const levelKey = safeHeader(2*i);
    const progKey  = safeHeader(2*i + 1);

    cols.push({ key: levelKey, label: `レベル${levelNo}`, type: 'text' });
    cols.push({ key: progKey,  label: `進捗${levelNo}`,  type: 'select' });
  }
  return cols;
}

// ===== テーブル構築 =====
function buildTable(container, columns, baseRows) {
  container.innerHTML = '';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.type === 'text') th.classList.add('level');
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  function makeCell(col, value) {
    const td = document.createElement('td');
    if (col.type === 'select') {
      const sel = document.createElement('select');
      const options = ["", "済"];
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        sel.appendChild(o);
      });
      const v = value ?? '';
      if (!options.includes(v) && v !== '') {
        const extra = document.createElement('option');
        extra.value = v;
        extra.textContent = v;
        sel.appendChild(extra);
      }
      sel.value = v;
      sel.addEventListener('change', () => { td.dataset.value = sel.value; applyHideDone(); });
      td.appendChild(sel);
      td.dataset.value = v;
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = value ?? '';
      input.addEventListener('input', () => { td.dataset.value = input.value; });
      td.appendChild(input);
      td.dataset.value = value ?? '';
    }
    return td;
  }

  function rowHasDoneInSelects(tr) {
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (col.type === 'select') {
        const td = tr.children[i];
        const v = (td?.dataset?.value ?? '').trim();
        if (v === '済') return true;
      }
    }
    return false;
  }

  baseRows.forEach(row => {
    const tr = document.createElement('tr');
    columns.forEach(col => {
      tr.appendChild(makeCell(col, row[col.key]));
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  function getRows() {
    const out = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const r = {};
      columns.forEach((col, idx) => {
        const td = tr.children[idx];
        r[col.key] = td?.dataset?.value ?? '';
      });
      out.push(r);
    });
    return out;
  }

  function addRow() {
    const tr = document.createElement('tr');
    columns.forEach(col => tr.appendChild(makeCell(col, '')));
    tbody.appendChild(tr);
    applyHideDone();
  }

  function applyHideDone() {
    const hide = document.getElementById('hideDone')?.checked;
    tbody.querySelectorAll('tr').forEach(tr => {
      if (hide && rowHasDoneInSelects(tr)) {
        tr.style.display = 'none';
      } else {
        tr.style.display = '';
      }
    });
  }

  return { getRows, addRow, applyHideDone };
}

// ===== CSV出力 =====
function toCsv(columns, rows) {
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const head = columns.map(c => escape(c.label)).join(',');
  const body = rows.map(r => columns.map(c => escape(r[c.key])).join(',')).join('\n');
  return head + '\n' + body;
}

// ===== 横スライド（ドラッグ）＆ボタン =====
function enableHorizontalSlide(scroller, stepPx) {
  let isDown = false, startX = 0, scrollLeft = 0;
  scroller.addEventListener('mousedown', (e) => {
    isDown = true;
    scroller.classList.add('dragging');
    startX = e.pageX - scroller.offsetLeft;
    scrollLeft = scroller.scrollLeft;
  });
  window.addEventListener('mouseup', () => { isDown = false; scroller.classList.remove('dragging'); });
  scroller.addEventListener('mouseleave', () => { isDown = false; scroller.classList.remove('dragging'); });
  scroller.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - scroller.offsetLeft;
    const walk = (x - startX) * 1;
    scroller.scrollLeft = scrollLeft - walk;
  });

  const leftBtn = document.getElementById('scrollLeftBtn');
  const rightBtn = document.getElementById('scrollRightBtn');
  const step = stepPx || 320;
  leftBtn?.addEventListener('click', () => scroller.scrollBy({ left: -step, behavior: 'smooth' }));
  rightBtn?.addEventListener('click', () => scroller.scrollBy({ left: step, behavior: 'smooth' }));
}

// ===== 起動 =====
let data = null;
(async () => {
  // 共有データ読み込み
  data = await loadData();

  // 列定義
  const columns = defineColumnsByOrder(data.headers);

  // ローカル保存があればマージ（バックアップ用途）
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(storageKey()) || 'null'); } catch (_) {}
  const defaultRows = data.rows;
  const baseRows = (() => {
    if (!saved?.rows) return defaultRows;
    const out = defaultRows.map((r, i) => Object.assign({}, r, saved.rows[i] || {}));
    if (saved.rows.length > defaultRows.length) {
      for (let i = defaultRows.length; i < saved.rows.length; i++) out.push(saved.rows[i]);
    }
    return out;
  })();

  const tableWrap = document.getElementById('tableWrap');
  const tableApi = buildTable(tableWrap, columns, baseRows);

  // ボタン類
  document.getElementById('addRowBtn')?.addEventListener('click', () => {
    tableApi.addRow();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  document.getElementById('saveBtn')?.addEventListener('click', async () => {
    const rows = tableApi.getRows();
    try {
      await saveShared(data.headers, rows); // 共有保存（Workerが2リポジトリ同期）
      // バックアップとしてローカルにも保存
      localStorage.setItem(storageKey(), JSON.stringify({ rows }));
      alert('サーバーに保存しました（全員で共有）');
    } catch (e) {
      // 失敗時はローカル退避
      localStorage.setItem(storageKey(), JSON.stringify({ rows }));
      alert('サーバー保存に失敗しました。ローカルに退避しました。\n' + e.message);
    }
  });

  document.getElementById('downloadCsvBtn')?.addEventListener('click', () => {
    const rows = tableApi.getRows();
    const csv = toCsv(columns, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('resetBtn')?.addEventListener('click', () => {
    localStorage.removeItem(storageKey());
    location.reload();
  });

  document.getElementById('hideDone')?.addEventListener('change', () => tableApi.applyHideDone());

  // 横スライド設定
  document.addEventListener('DOMContentLoaded', () => {
    const scroller = document.getElementById('tableScroller');
    let step = 0;
    const headRow = document.querySelector('thead tr');
    if (headRow) {
      const cells = Array.from(headRow.children);
      if (cells.length >= 2) {
        const w = cells[0].getBoundingClientRect().width + cells[1].getBoundingClientRect().width;
        step = Math.max(280, Math.floor(w));
      }
    }
    enableHorizontalSlide(scroller, step || 320);
  });

  // 初期適用
  tableApi.applyHideDone();
})();
