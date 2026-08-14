// Server-side counterpart to the client's renderPreview() in public/index.html.
// Kept deliberately close in structure to that function so the generated
// PDF visually matches what the person saw in the builder. If the client
// rendering logic changes meaningfully, this should be updated to match.

const ICONS = {
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92Z"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>`,
  briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  cap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg>`,
  award: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6l2 3h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><path d="M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/><circle cx="17" cy="7" r="2.2"/><path d="M17.5 13a4 4 0 0 1 4 4v1h-2"/></svg>`,
  wrench: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.4-3.4a6 6 0 0 1-8 8L6.4 20.6a2 2 0 0 1-2.8-2.8L11.3 11a6 6 0 0 1 8-8l-3.4 3.4z"/></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>`,
  palette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
  currency: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 8h4a2 2 0 0 1 0 4H9a2 2 0 0 0 0 4h5"/><path d="M12 6v2"/><path d="M12 16v2"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  sports: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>`,
  music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  plane: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-1 .1-1.3.5l-.7.8c-.4.5-.2 1.2.3 1.5L9 12l-2 3H3l-1 1 3 2 2 3 1-1v-4l3-2 3.6 6.1c.3.5 1 .7 1.5.3l.8-.7c.4-.3.6-.8.5-1.3z"/></svg>`,
  gamepad: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>`,
  chef: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
};

const FONTS = {
  classic: { display: "'Fraunces',serif", body: "'Inter',sans-serif" },
  modern: { display: "'Poppins',sans-serif", body: "'Inter',sans-serif" },
  elegant: { display: "'Playfair Display',serif", body: "'Source Sans 3',sans-serif" },
  minimal: { display: "'IBM Plex Sans',sans-serif", body: "'IBM Plex Sans',sans-serif" },
};

const PILL_ICON_KEYWORDS = [
  { icon: 'code', words: ['python','javascript','java','html','css','sql','coding','programming','software','developer','react','node','aws','cloud','it support','system','database','api'] },
  { icon: 'chart', words: ['excel','data','analytics','analysis','powerbi','power bi','tableau','statistics','reporting','forecasting'] },
  { icon: 'palette', words: ['design','photoshop','illustrator','figma','canva','ui','ux','graphic','branding','art'] },
  { icon: 'currency', words: ['accounting','finance','budget','audit','tax','reconciliation','banking','invest','payroll'] },
  { icon: 'chat', words: ['communication','writing','speaking','presentation','negotiation','customer service','sales','copywriting'] },
  { icon: 'users', words: ['management','leadership','team','supervision','mentoring','coaching','recruitment','hr'] },
  { icon: 'sports', words: ['football','soccer','basketball','running','gym','fitness','swimming','rugby','athletics','volleyball'] },
  { icon: 'book', words: ['reading','books','literature','blogging'] },
  { icon: 'music', words: ['music','singing','guitar','piano','dj','choir'] },
  { icon: 'plane', words: ['travel','traveling','travelling'] },
  { icon: 'gamepad', words: ['gaming','games','chess','esports'] },
  { icon: 'chef', words: ['cooking','baking','food','cuisine'] },
];
function pillIcon(text) {
  const lower = (text || '').toLowerCase();
  for (const group of PILL_ICON_KEYWORDS) {
    if (group.words.some((w) => lower.includes(w))) return ICONS[group.icon];
  }
  return ICONS.star;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SECTION_LABELS = {
  summary: 'Summary', experience: 'Experience', education: 'Education', skills: 'Skills',
  tools: 'Tools & Technologies', certifications: 'Certifications', projects: 'Projects',
  volunteer: 'Volunteer Work', hobbies: 'Hobbies & Interests', references: 'References',
};

const RESUME_CSS = `
  .paper{width:100%;background:#fff;padding:46px 42px;position:relative;font-family:var(--cv-font-body);}
  .paper-pattern{position:fixed;inset:0;z-index:0;pointer-events:none;background-repeat:repeat;}
  #resumePreview{position:relative;z-index:1;}
  .paper-pattern.pat-none{display:none;}
  .paper-pattern.pat-dots{background-image:radial-gradient(circle, var(--accent) 1.5px, transparent 1.5px);background-size:18px 18px;opacity:.10;}
  .paper-pattern.pat-lines{background-image:repeating-linear-gradient(45deg, var(--accent) 0 2px, transparent 2px 14px);opacity:.06;}
  .paper-pattern.pat-grid{background-image:linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px);background-size:26px 26px;opacity:.055;}
  .paper-pattern.pat-corner{background-image:radial-gradient(circle at top left, var(--accent) 0%, transparent 32%), radial-gradient(circle at bottom right, var(--accent) 0%, transparent 32%);opacity:.10;background-repeat:no-repeat;}
  .paper-pattern.pat-circuit{background-image:linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px), radial-gradient(var(--accent) 1.6px, transparent 1.6px);background-size:32px 32px,32px 32px,32px 32px;background-position:0 0,0 0,16px 16px;opacity:.075;}
  .paper-pattern.pat-hex{background-image:radial-gradient(circle, var(--accent) 1.6px, transparent 1.6px), radial-gradient(circle, var(--accent) 1.6px, transparent 1.6px);background-size:26px 26px,26px 26px;background-position:0 0,13px 13px;opacity:.09;}
  .paper-pattern.pat-wave{background-image:repeating-linear-gradient(120deg, var(--accent) 0 1.5px, transparent 1.5px 20px, var(--accent) 20px 21.5px, transparent 21.5px 42px);opacity:.055;}
  .paper-pattern.pat-triangles{background-image:conic-gradient(from 45deg, var(--accent) 0 25%, transparent 0 50%, var(--accent) 0 75%, transparent 0);background-size:26px 26px;opacity:.06;}
  .r-contact-icon{display:inline-flex;align-items:center;gap:4px;}
  .r-contact-icon svg{width:11px;height:11px;flex-shrink:0;}
  .r-avatar{width:74px;height:74px;border-radius:50%;object-fit:cover;flex-shrink:0;}
  .r-header-flex{display:flex;align-items:center;gap:18px;}
  .tpl-minimal .r-header-flex{flex-direction:column;text-align:center;}
  .r-name{font-family:var(--cv-font-display);font-weight:700;line-height:1.05;}
  .r-title{color:var(--accent);font-weight:600;}
  .r-section-title{font-family:'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase;font-size:11.5px;color:var(--accent);margin:22px 0 10px;display:flex;align-items:center;gap:6px;}
  .r-section-title svg{width:13px;height:13px;flex-shrink:0;}
  .tpl-minimal .r-section-title{justify-content:flex-start;}
  .r-item{margin-bottom:14px;}
  .r-item-head{display:flex;justify-content:space-between;font-size:13.5px;font-weight:600;}
  .r-item-sub{font-size:12.5px;color:#6b6f7a;margin-bottom:5px;}
  .r-item ul{margin:4px 0 0;padding-left:18px;font-size:13px;line-height:1.55;}
  .r-contact{font-size:12px;color:#6b6f7a;margin-top:6px;}
  .r-skills{display:flex;flex-wrap:wrap;gap:7px;}
  .r-skill-pill{font-size:11.5px;background:#f1ede4;padding:4px 10px;border-radius:5px;display:inline-flex;align-items:center;gap:5px;}
  .r-skill-pill svg{width:11px;height:11px;flex-shrink:0;color:var(--accent);}
  .tpl-classic .r-skill-pill svg{display:none;}
  .tpl-modern .r-header{border-bottom:3px solid var(--accent);padding-bottom:14px;margin-bottom:6px;}
  .tpl-modern .r-name{font-size:30px;}
  .tpl-modern .r-title{font-size:14px;margin-top:2px;}
  .tpl-classic{font-family:var(--cv-font-body);}
  .tpl-classic .r-name{font-family:var(--cv-font-body);font-size:24px;font-weight:700;color:#000;}
  .tpl-classic .r-title{color:#000;font-weight:500;}
  .tpl-classic .r-section-title{font-family:var(--cv-font-body);color:#000;border-bottom:1.5px solid #000;padding-bottom:4px;letter-spacing:.03em;}
  .tpl-classic .r-header{border-bottom:1.5px solid #000;padding-bottom:12px;}
  .tpl-minimal .r-header{text-align:center;padding-bottom:16px;}
  .tpl-minimal .r-name{font-size:27px;letter-spacing:.02em;}
  .tpl-minimal .r-section-title{text-align:left;border-top:1px solid #e2ddd0;padding-top:12px;}
  .tpl-minimal .r-contact{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;}
`;

function buildResumeHtml(content) {
  const state = content || {};
  const p = state.personal || {};
  const accent = state.accent || '#1f6f5c';
  const template = state.template || 'modern';
  const pattern = state.pattern || 'none';
  const fontPair = FONTS[state.font] || FONTS.classic;

  const expHtml = (state.experience || []).filter(e => e.title || e.company).map(e => `
    <div class="r-item">
      <div class="r-item-head"><span>${esc(e.title) || 'Job title'}${e.company ? ' · ' + esc(e.company) : ''}</span><span>${esc(e.start)} – ${esc(e.end)}</span></div>
      <div class="r-item-sub">${esc(e.location)}</div>
      ${e.achievements && e.achievements.trim() ? `<ul>${e.achievements.split('\n').filter(Boolean).map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
    </div>`).join('');

  const eduHtml = (state.education || []).filter(e => e.degree || e.institution).map(e => `
    <div class="r-item">
      <div class="r-item-head"><span>${esc(e.degree) || 'Qualification'}</span><span>${esc(e.start)} – ${esc(e.end)}</span></div>
      <div class="r-item-sub">${esc(e.institution)}${e.grade ? ' · ' + esc(e.grade) : ''}</div>
    </div>`).join('');

  const skillsArr = (state.skills || '').split(',').map(s => s.trim()).filter(Boolean);
  const toolsArr = (state.tools || '').split(',').map(s => s.trim()).filter(Boolean);
  const hobbiesArr = (state.hobbies || '').split(',').map(s => s.trim()).filter(Boolean);

  const certHtml = (state.certifications || []).filter(c => c.name).map(c => {
    const dateRange = [c.startDate, c.completionDate].filter(Boolean).join(' – ');
    return `<div class="r-item">
      <div class="r-item-head"><span>${esc(c.name)}</span><span>${esc(dateRange)}</span></div>
      <div class="r-item-sub">${esc(c.issuer)}${c.expiryDate ? ` · Expires ${esc(c.expiryDate)}` : ''}</div>
    </div>`;
  }).join('');

  const projHtml = (state.projects || []).filter(pr => pr.name).map(pr => `
    <div class="r-item">
      <div class="r-item-head"><span>${esc(pr.name)}</span>${pr.link ? `<span style="font-weight:400;font-size:11px;color:#6b6f7a">${esc(pr.link)}</span>` : ''}</div>
      ${pr.description ? `<div style="font-size:13px;line-height:1.55;margin-top:3px;">${esc(pr.description)}</div>` : ''}
    </div>`).join('');

  const volHtml = (state.volunteer || []).filter(v => v.role || v.organization).map(v => `
    <div class="r-item">
      <div class="r-item-head"><span>${esc(v.role) || 'Role'}${v.organization ? ' · ' + esc(v.organization) : ''}</span><span>${esc(v.start)} – ${esc(v.end)}</span></div>
      ${v.description ? `<div style="font-size:13px;line-height:1.55;margin-top:3px;">${esc(v.description)}</div>` : ''}
    </div>`).join('');

  const refHtml = state.referencesMode === 'note'
    ? ((state.referencesNote || '').trim() ? `<div style="font-size:13px;">${esc(state.referencesNote)}</div>` : '')
    : (state.references || []).filter(r => r.name).map(r => `
      <div class="r-item">
        <div class="r-item-head"><span>${esc(r.name)}</span>${r.title ? `<span style="font-weight:400;font-size:11px;color:#6b6f7a">${esc(r.title)}</span>` : ''}</div>
        <div class="r-item-sub">${[r.phone, r.email].filter(Boolean).map(esc).join(' · ')}</div>
      </div>`).join('');

  const contactParts = [];
  if (p.email) contactParts.push(`<span class="r-contact-icon">${ICONS.mail}${esc(p.email)}</span>`);
  if (p.phone) contactParts.push(`<span class="r-contact-icon">${ICONS.phone}${esc(p.phone)}</span>`);
  if (p.location) contactParts.push(`<span class="r-contact-icon">${ICONS.pin}${esc(p.location)}</span>`);
  if (p.linkedin) contactParts.push(`<span class="r-contact-icon">${ICONS.link}${esc(p.linkedin)}</span>`);
  const contactBits = contactParts.join('  ·  ');
  const avatarHtml = p.photo ? `<img src="${p.photo}" class="r-avatar" alt="">` : '';

  const sectionsRegistry = {
    summary: { title: 'Summary', icon: ICONS.fileText, html: state.summary ? `<div style="font-size:13px;line-height:1.6">${esc(state.summary)}</div>` : '' },
    experience: { title: 'Experience', icon: ICONS.briefcase, html: expHtml },
    education: { title: 'Education', icon: ICONS.cap, html: eduHtml },
    skills: { title: 'Skills', icon: ICONS.award, html: skillsArr.length ? `<div class="r-skills">${skillsArr.map(s => `<span class="r-skill-pill">${pillIcon(s)}${esc(s)}</span>`).join('')}</div>` : '' },
    tools: { title: 'Tools & Technologies', icon: ICONS.wrench, html: toolsArr.length ? `<div class="r-skills">${toolsArr.map(t => `<span class="r-skill-pill">${pillIcon(t)}${esc(t)}</span>`).join('')}</div>` : '' },
    certifications: { title: 'Certifications', icon: ICONS.award, html: certHtml },
    projects: { title: 'Projects', icon: ICONS.folder, html: projHtml },
    volunteer: { title: 'Volunteer Work', icon: ICONS.award, html: volHtml },
    hobbies: { title: 'Hobbies & Interests', icon: ICONS.heart, html: hobbiesArr.length ? `<div class="r-skills">${hobbiesArr.map(h => `<span class="r-skill-pill">${pillIcon(h)}${esc(h)}</span>`).join('')}</div>` : '' },
    references: { title: 'References', icon: ICONS.users, html: refHtml },
  };

  const order = Array.isArray(state.sectionOrder) && state.sectionOrder.length
    ? state.sectionOrder
    : Object.keys(sectionsRegistry);
  Object.keys(sectionsRegistry).forEach(key => { if (!order.includes(key)) order.push(key); });

  const sectionsHtml = order.map(key => {
    const sec = sectionsRegistry[key];
    if (!sec || !sec.html) return '';
    return `<div class="r-section-title">${sec.icon}${sec.title}</div>${sec.html}`;
  }).join('');

  const fontLink = `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="${fontLink}" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  @page{ size:A4; margin:0; }
  html,body{background:#fff;margin:0;padding:0;}
  :root{ --accent:${accent}; --cv-font-display:${fontPair.display}; --cv-font-body:${fontPair.body}; }
  ${RESUME_CSS}
</style>
</head>
<body>
  <div class="paper tpl-${esc(template)}">
    <div class="paper-pattern pat-${esc(pattern)}"></div>
    <div id="resumePreview">
      <div class="r-header">
        <div class="r-header-flex">
          ${avatarHtml}
          <div>
            <div class="r-name">${esc(p.name) || 'Your Name'}</div>
            <div class="r-title">${esc(p.title) || 'Professional Title'}</div>
            <div class="r-contact">${contactBits || ''}</div>
          </div>
        </div>
      </div>
      ${sectionsHtml}
    </div>
  </div>
</body>
</html>`;
}

module.exports = { buildResumeHtml };
