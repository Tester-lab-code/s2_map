async function loadData() {
  const res = await fetch('./data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('data.json の読み込みに失敗しました');
  return await res.json();
}

function storageKey() { return 'level-list:' + location.pathname; }

function defineColumnsByOrder(headers) {
  const cols = [];
  const total = Math.min(headers.length, 14); // A〜N
  const pairs = Math.min(Math.floor(total / 2), 7);

  for (let i = 0; i < pairs; i++) {
    const levelNo = 7 - i;
    const levelKey = headers[2*i];
    const progKey  = headers[2*i + 1];

    cols.push({ key: levelKey, label: `レベル${levelNo}`, type: 'text' });
    cols.push({ key: progKey,  label: `進捗${levelNo}`,  type: 'select' });
  }

  return cols;
}

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

function mergeSavedRows(defaultRows, savedRows) {
  const out = defaultRows.map((r, i) => Object.assign({}, r, savedRows?.[i] || {}));
  if (savedRows && savedRows.length > defaultRows.length) {
    for (let i = defaultRows.length; i < savedRows.length; i++) out.push(savedRows[i]);
  }
  return out;
}

(async () => {
  const data = await loadData();
  const columns = defineColumnsByOrder(data.headers);

  const defaultRows = data.rows;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(storageKey()) || 'null'); } catch (_) {}
  const baseRows = mergeSavedRows(defaultRows, saved?.rows);

  const tableWrap = document.getElementById('tableWrap');
  const tableApi = buildTable(tableWrap, columns, baseRows);

  document.getElementById('addRowBtn').addEventListener('click', () => {
    tableApi.addRow();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const rows = tableApi.getRows();
    localStorage.setItem(storageKey(), JSON.stringify({ rows }));
    alert('保存しました（このブラウザで保持されます）');
  });

  document.getElementById('downloadCsvBtn').addEventListener('click', () => {
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

  document.getElementById('resetBtn').addEventListener('click', () => {
    localStorage.removeItem(storageKey());
    location.reload();
  });

  document.getElementById('hideDone').addEventListener('change', () => {
    tableApi.applyHideDone();
  });

  tableApi.applyHideDone();
})();
