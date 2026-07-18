type PrintDrug = {
  drug_name: string
  dosage?: string
  duration?: string
  notes?: string
}

type PrintFormat = 'a4' | 'thermal'

type ClinicBrand = {
  clinicName: string
  logoUrl?: string | null
  clinicPhone?: string | null
  clinicAddress?: string | null
  doctorName?: string
  format?: PrintFormat
}

type RequestKind = 'lab' | 'radiology' | 'generic'

function formatPrintDate(d = new Date()) {
  return d.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function detectRequestKind(title: string, explicit?: RequestKind): RequestKind {
  if (explicit && explicit !== 'generic') return explicit
  const t = title.toLowerCase()
  if (/radiolog|أشعة|اشعة|x-?ray|mri|ct|سونار|موجات/.test(t)) return 'radiology'
  if (/lab|تحليل|تحاليل|معمل/.test(t)) return 'lab'
  return 'generic'
}

function brandHeader(input: ClinicBrand & { docTitle: string; docSubtitle?: string; accent: string }) {
  const logo = input.logoUrl
    ? `<img class="logo" src="${escapeHtml(input.logoUrl)}" alt="" />`
    : `<div class="logo-fallback" style="border-color:${input.accent};color:${input.accent}">${escapeHtml(
        input.clinicName.slice(0, 1),
      )}</div>`

  const contactBits = [input.clinicPhone, input.clinicAddress].filter(Boolean).map((x) => escapeHtml(String(x)))

  return `
    <header class="doc-header" style="--accent:${input.accent}">
      <div class="brand-row">
        ${logo}
        <div class="brand-text">
          <div class="clinic-name">${escapeHtml(input.clinicName)}</div>
          ${contactBits.length ? `<div class="clinic-contact">${contactBits.join(' · ')}</div>` : ''}
        </div>
        <div class="doc-badge" style="background:${input.accent}">
          <div class="doc-badge-title">${escapeHtml(input.docTitle)}</div>
          ${input.docSubtitle ? `<div class="doc-badge-sub">${escapeHtml(input.docSubtitle)}</div>` : ''}
        </div>
      </div>
      <div class="header-rule" style="background:${input.accent}"></div>
    </header>
  `
}

function patientBar(input: {
  patientName?: string
  fileNumber?: number
  doctorName?: string
  diagnosis?: string
  extra?: string
}) {
  const cells: string[] = []
  if (input.patientName) {
    cells.push(`<div class="info-cell"><span class="k">المريض</span><span class="v">${escapeHtml(input.patientName)}</span></div>`)
  }
  if (input.fileNumber != null && input.fileNumber > 0) {
    cells.push(`<div class="info-cell"><span class="k">رقم الملف</span><span class="v">#${input.fileNumber}</span></div>`)
  }
  if (input.doctorName) {
    cells.push(`<div class="info-cell"><span class="k">الطبيب</span><span class="v">${escapeHtml(input.doctorName)}</span></div>`)
  }
  cells.push(`<div class="info-cell"><span class="k">التاريخ</span><span class="v">${escapeHtml(formatPrintDate())}</span></div>`)
  if (input.diagnosis?.trim()) {
    cells.push(
      `<div class="info-cell info-cell-wide"><span class="k">التشخيص</span><span class="v">${escapeHtml(input.diagnosis.trim())}</span></div>`,
    )
  }
  if (input.extra) {
    cells.push(`<div class="info-cell info-cell-wide"><span class="k"></span><span class="v">${input.extra}</span></div>`)
  }
  return `<section class="patient-bar">${cells.join('')}</section>`
}

function docFooter(clinicName: string) {
  return `
    <footer class="doc-footer">
      <div>نتمنى لكم الشفاء العاجل</div>
      <div class="footer-muted">${escapeHtml(clinicName)} · ${escapeHtml(formatPrintDate())}</div>
    </footer>
  `
}

function sheetStyle(thermal: boolean) {
  return `
    :root {
      --ink: #12261f;
      --muted: #5a6e66;
      --line: #d7e3dc;
      --paper: #ffffff;
      --soft: #f3f8f5;
    }

    * { box-sizing: border-box; }
    body {
      font-family: "Cairo", "Segoe UI", Tahoma, sans-serif;
      color: var(--ink);
      margin: 0;
      padding: ${thermal ? '6px' : '18px'};
      background: #eef2f0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: ${thermal ? '80mm' : '210mm'};
      max-width: 100%;
      margin: 0 auto;
      background: var(--paper);
      padding: ${thermal ? '10px 8px' : '22px 26px 18px'};
      border-radius: ${thermal ? '0' : '10px'};
      box-shadow: ${thermal ? 'none' : '0 8px 28px rgba(18, 38, 31, 0.08)'};
      min-height: ${thermal ? 'auto' : '277mm'};
      display: flex;
      flex-direction: column;
    }
    .doc-header { margin-bottom: ${thermal ? '8px' : '14px'}; }
    .brand-row {
      display: flex;
      align-items: center;
      gap: ${thermal ? '8px' : '14px'};
    }
    .logo, .logo-fallback {
      width: ${thermal ? '36px' : '56px'};
      height: ${thermal ? '36px' : '56px'};
      border-radius: 12px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .logo-fallback {
      display: grid;
      place-items: center;
      border: 2px solid;
      font-weight: 800;
      font-size: ${thermal ? '16px' : '22px'};
      background: var(--soft);
    }
    .brand-text { flex: 1; min-width: 0; }
    .clinic-name {
      font-size: ${thermal ? '13px' : '20px'};
      font-weight: 800;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }
    .clinic-contact {
      margin-top: 2px;
      font-size: ${thermal ? '9px' : '11px'};
      color: var(--muted);
      line-height: 1.4;
    }
    .doc-badge {
      color: #fff;
      border-radius: 10px;
      padding: ${thermal ? '6px 8px' : '8px 12px'};
      text-align: center;
      min-width: ${thermal ? '64px' : '96px'};
      flex-shrink: 0;
    }
    .doc-badge-title {
      font-size: ${thermal ? '11px' : '14px'};
      font-weight: 800;
      line-height: 1.2;
    }
    .doc-badge-sub {
      margin-top: 2px;
      font-size: ${thermal ? '8px' : '10px'};
      opacity: 0.9;
      font-weight: 600;
    }
    .header-rule {
      height: 3px;
      border-radius: 999px;
      margin-top: ${thermal ? '8px' : '12px'};
      opacity: 0.9;
    }

    .patient-bar {
      display: grid;
      grid-template-columns: ${thermal ? '1fr 1fr' : '1fr 1fr 1fr 1fr'};
      gap: ${thermal ? '6px' : '8px'};
      background: var(--soft);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: ${thermal ? '8px' : '10px 12px'};
      margin-bottom: ${thermal ? '10px' : '16px'};
    }
    .info-cell { min-width: 0; }
    .info-cell-wide { grid-column: 1 / -1; }
    .info-cell .k {
      display: block;
      font-size: ${thermal ? '8px' : '10px'};
      color: var(--muted);
      font-weight: 700;
      margin-bottom: 1px;
    }
    .info-cell .v {
      display: block;
      font-size: ${thermal ? '10px' : '13px'};
      font-weight: 700;
      line-height: 1.35;
      word-break: break-word;
    }

    .section {
      margin-bottom: ${thermal ? '10px' : '14px'};
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: ${thermal ? '11px' : '13px'};
      font-weight: 800;
      margin: 0 0 ${thermal ? '6px' : '8px'};
      color: var(--ink);
    }
    .section-title::before {
      content: "";
      width: 4px;
      height: 1em;
      border-radius: 4px;
      background: var(--accent, #0f766e);
      flex-shrink: 0;
    }

    .rx-mark {
      font-family: Georgia, "Times New Roman", serif;
      font-size: ${thermal ? '28px' : '42px'};
      font-weight: 700;
      line-height: 1;
      color: #0f766e;
      opacity: 0.85;
      margin: 0 0 ${thermal ? '4px' : '6px'};
    }

    .drug-list { display: flex; flex-direction: column; gap: ${thermal ? '6px' : '8px'}; }
    .drug-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: ${thermal ? '7px 8px' : '10px 12px'};
      background: #fff;
      position: relative;
      padding-inline-start: ${thermal ? '28px' : '40px'};
    }
    .drug-num {
      position: absolute;
      inset-inline-start: ${thermal ? '6px' : '10px'};
      top: 50%;
      transform: translateY(-50%);
      width: ${thermal ? '16px' : '22px'};
      height: ${thermal ? '16px' : '22px'};
      border-radius: 999px;
      background: #0f766e;
      color: #fff;
      font-size: ${thermal ? '9px' : '11px'};
      font-weight: 800;
      display: grid;
      place-items: center;
    }
    .drug-name {
      font-size: ${thermal ? '11px' : '14px'};
      font-weight: 800;
      margin-bottom: 2px;
    }
    .drug-meta {
      display: flex;
      flex-wrap: wrap;
      gap: ${thermal ? '4px' : '6px'};
      font-size: ${thermal ? '9px' : '12px'};
      color: var(--muted);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--soft);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 2px 8px;
      font-weight: 600;
      color: var(--ink);
    }
    .drug-notes {
      margin-top: 4px;
      font-size: ${thermal ? '9px' : '12px'};
      color: var(--muted);
    }

    .req-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: ${thermal ? '5px' : '7px'};
    }
    .req-list li {
      display: flex;
      align-items: flex-start;
      gap: ${thermal ? '8px' : '10px'};
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: ${thermal ? '7px 8px' : '10px 12px'};
      font-size: ${thermal ? '11px' : '14px'};
      font-weight: 700;
      background: #fff;
    }
    .check {
      width: ${thermal ? '14px' : '18px'};
      height: ${thermal ? '14px' : '18px'};
      border: 2px solid #94a3b8;
      border-radius: 4px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .req-index {
      color: var(--muted);
      font-size: ${thermal ? '10px' : '12px'};
      font-weight: 800;
      min-width: 1.4em;
    }

    .instruct-box {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--soft);
      padding: ${thermal ? '8px' : '12px 14px'};
      font-size: ${thermal ? '11px' : '13px'};
      line-height: 1.7;
    }
    .instruct-box p { margin: 0 0 8px; }
    .instruct-box p:last-child { margin-bottom: 0; }
    .instruct-box ul {
      margin: 0;
      padding-inline-start: 18px;
    }
    .instruct-box li { margin-bottom: 4px; }

    .follow-banner {
      margin-top: ${thermal ? '8px' : '12px'};
      border-radius: 10px;
      padding: ${thermal ? '8px' : '10px 12px'};
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      font-weight: 800;
      font-size: ${thermal ? '11px' : '13px'};
      color: #065f46;
    }

    .sign-row {
      margin-top: auto;
      padding-top: ${thermal ? '12px' : '20px'};
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
    }
    .sign-box {
      text-align: center;
      min-width: ${thermal ? '70px' : '120px'};
    }
    .sign-box img {
      max-height: ${thermal ? '40px' : '64px'};
      max-width: ${thermal ? '90px' : '140px'};
      object-fit: contain;
      display: block;
      margin: 0 auto 4px;
    }
    .sign-line {
      border-top: 1px solid var(--line);
      margin-top: ${thermal ? '28px' : '40px'};
      padding-top: 4px;
      font-size: ${thermal ? '9px' : '11px'};
      color: var(--muted);
      font-weight: 700;
    }
    .sign-name {
      font-size: ${thermal ? '10px' : '12px'};
      font-weight: 800;
      color: var(--ink);
    }

    .empty-hint {
      color: #b91c1c;
      font-size: ${thermal ? '10px' : '12px'};
      font-weight: 700;
      padding: 8px;
      background: #fef2f2;
      border-radius: 8px;
      border: 1px solid #fecaca;
    }

    table.data {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: ${thermal ? '10px' : '13px'};
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 10px;
    }
    table.data th, table.data td {
      padding: ${thermal ? '6px 5px' : '8px 10px'};
      text-align: right;
      border-bottom: 1px solid var(--line);
    }
    table.data th {
      background: var(--soft);
      font-weight: 800;
      font-size: ${thermal ? '9px' : '11px'};
      color: var(--muted);
    }
    table.data tr:last-child td { border-bottom: none; }
    .total {
      margin-top: 12px;
      font-size: ${thermal ? '13px' : '18px'};
      font-weight: 800;
      text-align: left;
      direction: ltr;
    }

    .doc-footer {
      margin-top: ${thermal ? '10px' : '18px'};
      padding-top: ${thermal ? '8px' : '12px'};
      border-top: 1px dashed var(--line);
      text-align: center;
      font-size: ${thermal ? '10px' : '12px'};
      font-weight: 700;
      color: var(--ink);
    }
    .footer-muted {
      margin-top: 2px;
      font-size: ${thermal ? '8px' : '10px'};
      color: var(--muted);
      font-weight: 600;
    }

    .content { flex: 1; }

    @media print {
      body { padding: 0; background: #fff; }
      .sheet {
        box-shadow: none;
        border-radius: 0;
        width: 100%;
        min-height: auto;
        padding: ${thermal ? '4px' : '0'};
      }
      .print-bar { display: none !important; }
    }
  `
}

function openPrint(title: string, bodyHtml: string, format: PrintFormat = 'a4') {
  const thermal = format === 'thermal'
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>${sheetStyle(thermal)}
    .print-bar { margin-bottom: 14px; text-align: center; }
    .print-bar button {
      font-family: "Cairo", Tahoma, sans-serif;
      padding: 10px 22px;
      border: none;
      border-radius: 10px;
      background: #0f766e;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button type="button" onclick="window.print()">طباعة / Print</button>
  </div>
  <div class="sheet">${bodyHtml}</div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')

  if (!win) {
    URL.revokeObjectURL(url)
    printViaHiddenIframe(html)
    return
  }

  const revoke = () => {
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* ignore */
    }
  }

  const tryPrint = () => {
    try {
      win.focus()
      win.print()
    } catch {
      /* user can use the Print button */
    }
  }

  win.addEventListener?.('load', () => {
    window.setTimeout(tryPrint, 450)
  })
  window.setTimeout(tryPrint, 900)
  window.setTimeout(revoke, 120_000)
}

function printViaHiddenIframe(html: string) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe)
      }, 1000)
    }
  }, 300)
}

export function printPrescription(
  input: ClinicBrand & {
    patientName: string
    fileNumber: number
    doctorName: string
    diagnosis?: string
    drugs: PrintDrug[]
    stampUrl?: string | null
    signatureUrl?: string | null
  },
) {
  const accent = '#0f766e'
  const drugs = input.drugs.filter((d) => d.drug_name.trim())
  const drugCards = drugs
    .map((d, i) => {
      const pills: string[] = []
      if (d.dosage?.trim()) pills.push(`<span class="pill">${escapeHtml(d.dosage)}</span>`)
      if (d.duration?.trim()) pills.push(`<span class="pill">${escapeHtml(d.duration)}</span>`)
      return `<div class="drug-card">
        <span class="drug-num">${i + 1}</span>
        <div class="drug-name">${escapeHtml(d.drug_name)}</div>
        ${pills.length ? `<div class="drug-meta">${pills.join('')}</div>` : ''}
        ${d.notes?.trim() ? `<div class="drug-notes">${escapeHtml(d.notes)}</div>` : ''}
      </div>`
    })
    .join('')

  const stamp = input.stampUrl
    ? `<img src="${escapeHtml(input.stampUrl)}" alt="" />`
    : ''
  const signature = input.signatureUrl
    ? `<img src="${escapeHtml(input.signatureUrl)}" alt="" />`
    : ''

  openPrint(
    'روشتة طبية',
    `${brandHeader({
      ...input,
      docTitle: 'روشتة',
      docSubtitle: 'Prescription',
      accent,
    })}
    ${patientBar({
      patientName: input.patientName,
      fileNumber: input.fileNumber,
      doctorName: input.doctorName,
      diagnosis: input.diagnosis,
    })}
    <div class="content" style="--accent:${accent}">
      <div class="rx-mark">℞</div>
      <div class="section">
        <h2 class="section-title">الأدوية</h2>
        ${
          drugCards
            ? `<div class="drug-list">${drugCards}</div>`
            : `<div class="empty-hint">لا توجد أدوية في الروشتة</div>`
        }
      </div>
    </div>
    <div class="sign-row">
      <div class="sign-box">
        ${stamp || '<div style="height:40px"></div>'}
        <div class="sign-line">ختم العيادة</div>
      </div>
      <div class="sign-box">
        ${signature || '<div style="height:40px"></div>'}
        <div class="sign-name">${escapeHtml(input.doctorName)}</div>
        <div class="sign-line">توقيع الطبيب</div>
      </div>
    </div>
    ${docFooter(input.clinicName)}`,
    input.format,
  )
}

export function printInvoice(
  input: ClinicBrand & {
    patientName: string
    fileNumber: number
    consultationFee: number
    discounts: number
    services: { name: string; amount: number }[]
    total: number
    paymentMethod: string
    createdAt: string
    cashier?: string
  },
) {
  const accent = '#0369a1'
  const serviceRows = input.services
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.name)}</td><td style="text-align:left;direction:ltr">${s.amount}</td></tr>`,
    )
    .join('')

  openPrint(
    'فاتورة',
    `${brandHeader({
      ...input,
      docTitle: 'فاتورة',
      docSubtitle: 'Invoice',
      accent,
    })}
    ${patientBar({
      patientName: input.patientName,
      fileNumber: input.fileNumber,
      doctorName: input.cashier,
      extra: escapeHtml(new Date(input.createdAt).toLocaleString('ar-EG')),
    })}
    <div class="content" style="--accent:${accent}">
      <div class="section">
        <h2 class="section-title">تفاصيل الفاتورة</h2>
        <table class="data">
          <thead><tr><th>البند</th><th style="text-align:left">المبلغ</th></tr></thead>
          <tbody>
            <tr><td>كشف</td><td style="text-align:left;direction:ltr">${input.consultationFee}</td></tr>
            ${serviceRows}
            <tr><td>خصم</td><td style="text-align:left;direction:ltr">-${input.discounts}</td></tr>
          </tbody>
        </table>
        <div class="total">${input.total.toLocaleString('ar-EG')} ج.م</div>
        <div style="margin-top:6px;font-size:12px;color:var(--muted);font-weight:700">
          طريقة الدفع: ${escapeHtml(input.paymentMethod)}
        </div>
      </div>
    </div>
    ${docFooter(input.clinicName)}`,
    input.format,
  )
}

export function printRequestList(
  input: ClinicBrand & {
    title: string
    patientName?: string
    fileNumber?: number
    doctorName?: string
    diagnosis?: string
    items: string[]
    kind?: RequestKind
  },
) {
  const kind = detectRequestKind(input.title, input.kind)
  const accent = kind === 'radiology' ? '#1e40af' : kind === 'lab' ? '#0369a1' : '#334155'
  const docTitle = kind === 'radiology' ? 'طلب أشعة' : kind === 'lab' ? 'طلب تحاليل' : input.title
  const docSubtitle =
    kind === 'radiology' ? 'Radiology request' : kind === 'lab' ? 'Lab request' : 'Request'

  const items = input.items.map((x) => x.trim()).filter(Boolean)
  const list = items
    .map(
      (item, i) =>
        `<li>
          <span class="check" aria-hidden="true"></span>
          <span class="req-index">${i + 1}.</span>
          <span>${escapeHtml(item)}</span>
        </li>`,
    )
    .join('')

  openPrint(
    docTitle,
    `${brandHeader({
      ...input,
      docTitle,
      docSubtitle,
      accent,
    })}
    ${patientBar({
      patientName: input.patientName,
      fileNumber: input.fileNumber,
      doctorName: input.doctorName,
      diagnosis: input.diagnosis,
    })}
    <div class="content" style="--accent:${accent}">
      <div class="section">
        <h2 class="section-title">${kind === 'radiology' ? 'الفحوصات المطلوبة' : kind === 'lab' ? 'التحاليل المطلوبة' : escapeHtml(input.title)}</h2>
        ${items.length ? `<ul class="req-list">${list}</ul>` : `<div class="empty-hint">لا توجد بنود</div>`}
      </div>
      ${
        kind !== 'generic'
          ? `<div class="section" style="margin-top:16px">
              <h2 class="section-title">ملاحظات المعمل / المركز</h2>
              <div class="instruct-box" style="min-height:56px;background:#fff"></div>
            </div>`
          : ''
      }
    </div>
    <div class="sign-row">
      <div class="sign-box">
        <div class="sign-line">ختم العيادة</div>
      </div>
      <div class="sign-box">
        <div class="sign-name">${escapeHtml(input.doctorName ?? '')}</div>
        <div class="sign-line">توقيع الطبيب</div>
      </div>
    </div>
    ${docFooter(input.clinicName)}`,
    input.format,
  )
}

/** Short patient takeaway: diagnosis, meds, follow-up, clinic contact */
export function printDischargeSlip(
  input: ClinicBrand & {
    patientName: string
    fileNumber: number
    doctorName: string
    diagnosis?: string
    drugs: PrintDrug[]
    followUpDate?: string
    instructions?: string
  },
) {
  const accent = '#b45309'
  const drugList = input.drugs
    .filter((d) => d.drug_name.trim())
    .map((d, i) => {
      const pills: string[] = []
      if (d.dosage?.trim()) pills.push(`<span class="pill">${escapeHtml(d.dosage)}</span>`)
      if (d.duration?.trim()) pills.push(`<span class="pill">${escapeHtml(d.duration)}</span>`)
      return `<div class="drug-card">
        <span class="drug-num" style="background:${accent}">${i + 1}</span>
        <div class="drug-name">${escapeHtml(d.drug_name)}</div>
        ${pills.length ? `<div class="drug-meta">${pills.join('')}</div>` : ''}
      </div>`
    })
    .join('')

  const instructionBlocks = (input.instructions ?? '')
    .split(/\n\s*———\s*\n|\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  const instructionHtml = instructionBlocks.length
    ? instructionBlocks
        .map((block) => {
          const lines = block
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
          if (lines.length <= 1) {
            return `<p>${escapeHtml(block)}</p>`
          }
          return `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^[-•*]\s*/, ''))}</li>`).join('')}</ul>`
        })
        .join('')
    : ''

  openPrint(
    'تعليمات المريض',
    `${brandHeader({
      ...input,
      docTitle: 'تعليمات',
      docSubtitle: 'Patient instructions',
      accent,
    })}
    ${patientBar({
      patientName: input.patientName,
      fileNumber: input.fileNumber,
      doctorName: input.doctorName,
      diagnosis: input.diagnosis,
    })}
    <div class="content" style="--accent:${accent}">
      ${
        drugList
          ? `<div class="section">
              <h2 class="section-title">الأدوية</h2>
              <div class="drug-list">${drugList}</div>
            </div>`
          : ''
      }
      <div class="section">
        <h2 class="section-title">تعليمات الطبيب</h2>
        ${
          instructionHtml
            ? `<div class="instruct-box">${instructionHtml}</div>`
            : `<div class="empty-hint">لا توجد تعليمات مكتوبة — أضفها من شاشة الكشف</div>`
        }
      </div>
      ${
        input.followUpDate
          ? `<div class="follow-banner">موعد المتابعة: ${escapeHtml(input.followUpDate)}</div>`
          : ''
      }
    </div>
    ${docFooter(input.clinicName)}`,
    input.format,
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function printDayClose(input: {
  clinicName: string
  dateLabel: string
  patientsToday: number
  appointmentsToday: number
  doneToday: number
  waiting: number
  noShows: number
  followUps: number
  unpaidDone: number
  revenueToday: number
  doctorName?: string
  logoUrl?: string | null
  clinicPhone?: string | null
}) {
  const accent = '#334155'
  openPrint(
    'إقفال اليوم',
    `${brandHeader({
      clinicName: input.clinicName,
      logoUrl: input.logoUrl,
      clinicPhone: input.clinicPhone,
      doctorName: input.doctorName,
      docTitle: 'إقفال يوم',
      docSubtitle: 'Day close',
      accent,
    })}
    ${patientBar({
      doctorName: input.doctorName,
      extra: escapeHtml(input.dateLabel),
    })}
    <div class="content" style="--accent:${accent}">
      <div class="section">
        <h2 class="section-title">ملخص اليوم</h2>
        <table class="data">
          <tbody>
            <tr><td>المرضى</td><td>${input.patientsToday}</td></tr>
            <tr><td>الحجوزات</td><td>${input.appointmentsToday}</td></tr>
            <tr><td>منتهي</td><td>${input.doneToday}</td></tr>
            <tr><td>انتظار متبقي</td><td>${input.waiting}</td></tr>
            <tr><td>غياب</td><td>${input.noShows}</td></tr>
            <tr><td>متابعات اليوم</td><td>${input.followUps}</td></tr>
            <tr><td>بدون دفع</td><td>${input.unpaidDone}</td></tr>
          </tbody>
        </table>
        <div class="total">${input.revenueToday.toLocaleString('ar-EG')} ج.م</div>
      </div>
    </div>
    ${docFooter(input.clinicName)}`,
    'a4',
  )
}

export function printWeeklyReport(input: {
  clinicName: string
  rangeLabel: string
  visits: number
  patients: number
  revenue: number
  topDiseases: { name: string; count: number }[]
  doctorName?: string
  logoUrl?: string | null
  clinicPhone?: string | null
}) {
  const accent = '#0f766e'
  const diseaseRows = input.topDiseases
    .slice(0, 8)
    .map((d) => `<tr><td>${escapeHtml(d.name)}</td><td>${d.count}</td></tr>`)
    .join('')

  openPrint(
    'التقرير الأسبوعي',
    `${brandHeader({
      clinicName: input.clinicName,
      logoUrl: input.logoUrl,
      clinicPhone: input.clinicPhone,
      doctorName: input.doctorName,
      docTitle: 'تقرير',
      docSubtitle: 'Weekly report',
      accent,
    })}
    ${patientBar({
      doctorName: input.doctorName,
      extra: escapeHtml(input.rangeLabel),
    })}
    <div class="content" style="--accent:${accent}">
      <div class="section">
        <h2 class="section-title">ملخص الفترة</h2>
        <table class="data">
          <tbody>
            <tr><td>عدد الكشوف</td><td>${input.visits}</td></tr>
            <tr><td>مرضى مميزون</td><td>${input.patients}</td></tr>
            <tr><td>الإيراد</td><td>${input.revenue.toLocaleString('ar-EG')} ج.م</td></tr>
          </tbody>
        </table>
      </div>
      ${
        diseaseRows
          ? `<div class="section">
              <h2 class="section-title">أكثر التشخيصات</h2>
              <table class="data">
                <thead><tr><th>التشخيص</th><th>#</th></tr></thead>
                <tbody>${diseaseRows}</tbody>
              </table>
            </div>`
          : ''
      }
    </div>
    ${docFooter(input.clinicName)}`,
    'a4',
  )
}
