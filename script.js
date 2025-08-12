async function loadData() {
  const res = await fetch('./data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('data.json の読み込みに失敗しました');
  return await res.json();
}

function makeHeadersLabels(colsCount) {
  // 0-based index: even => odd column number (1,3,5..), odd => even column number
  // Odd columns labeled レベル1..7, Even columns labeled 進捗1..7
  const labels = [];
  let pairIndex = 0;
  for (let i = 0; i < colsCount; i++) {
    if (i % 2 === 0) { // odd column (A, C, ...)
      pairIndex = Math.floor(i / 2) + 1;
      labels.push(`レベル${pairIndex}`);
    } else {
      labels.push(`進捗${pairIndex}`);
    }
  }
  return labels;
}

function buildTable(container, data) {
  const headers = data.headers;
  const rows = data.rows;
  const colsCount = headers.length;
  const headerLabels = makeHeadersLabels(colsCount);

  container.innerHTML = '';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for (let i = 0; i < colsCount; i++) {
    const th = document.createElement('th');
    th.textContent = headerLabels[i] || headers[i] || '';
    if (i % 2 === 0) th.classList.add('odd'); // odd columns (0-based even index)
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  function makeCell(colIndex, value) {
    const td = document.createElement('td');
    if (colIndex % 2 === 0) {
      // odd column: free text
      const input = document.createElement('input');
      input.type = 'text';
      input.value = value ?? '';
      input.addEventListener('input', () => { td.dataset.value = input.value; });
      td.appendChild(input);
      td.dataset.value = value ?? '';
    } else {
      // even column: dropdown ["", "空白", "済"]
      const sel = document.createElement('select');
      const options = ["", "空白", "済"];
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        sel.appendChild(o);
      });
      // normalize existing value: if not in options, keep as is (append dynamically)
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
    }
    return td;
  }

  function rowHasDoneInEvenColumns(tr) {
    for (let i = 1; i < colsCount; i += 2) {
      const td = tr.children[i];
      const v = (td?.dataset?.value ?? '').trim();
      if (v === '済') return true;
    }
    return false;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    for (let i = 0; i < colsCount; i++) {
      const colKey = headers[i];
      tr.appendChild(makeCell(i, row[colKey]));
    }
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  function getRows() {
    const out = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      const r = {};
      for (let i = 0; i < colsCount; i++) {
        const colKey = headers[i];
        const td = tr.children[i];
        r[colKey] = td?.dataset?.value ?? '';
      }
      out.push(r);
    });
    return out;
  }

  function addRow() {
    const tr = document.createElement('tr');
    for (let i = 0; i < colsCount; i++) {
      tr.appendChild(makeCell(i, ''));
    }
    tbody.appendChild(tr);
    applyHideDone();
  }

  function applyHideDone() {
    const hide = document.getElementById('hideDone')?.checked;
    tbody.querySelectorAll('tr').forEach(tr => {
      if (hide && rowHasDoneInEvenColumns(tr)) {
        tr.style.display = 'none';
      } else {
        tr.style.display = '';
      }
    });
  }

  return { getRows, addRow, applyHideDone };
}

function toCsv(headers, rows) {
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const head = headers.map(escape).join(',');
  const body = rows.map(r => headers.map(h => escape(r[h])).join(',')).join('\n');
  return head + '\n' + body;
}

(async () => {
  const data = await loadData();
  const tableWrap = document.getElementById('tableWrap');
  const tableApi = buildTable(tableWrap, data);

  document.getElementById('addRowBtn').addEventListener('click', () => {
    tableApi.addRow();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  document.getElementById('downloadCsvBtn').addEventListener('click', () => {
    const rows = tableApi.getRows();
    const csv = toCsv(data.headers, rows);
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
    location.reload();
  });

  document.getElementById('hideDone').addEventListener('change', () => {
    tableApi.applyHideDone();
  });

  // 初期適用
  tableApi.applyHideDone();
})();
