/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BriefingCardData } from '../types';

export function generateSingleFileHtml(data: BriefingCardData, themeName: 'cream' | 'white' | 'charcoal' = 'cream'): string {
  // Theme definitions for local HTML
  const themes = {
    cream: {
      bodyBg: '#F9F9F7',
      cardBg: '#FAF9F5',
      border: '#1A1A1A',
      textMain: '#1A1A1A',
      textMuted: '#666666',
      accentRed: '#C8102E',
      accentStamp: 'rgba(200, 16, 46, 0.08)',
      highlight: '#FFFFFF',
    },
    white: {
      bodyBg: '#F4F4F5',
      cardBg: '#FFFFFF',
      border: '#09090B',
      textMain: '#09090B',
      textMuted: '#52525B',
      accentRed: '#E11D48',
      accentStamp: 'rgba(225, 29, 72, 0.08)',
      highlight: '#F4F4F5',
    },
    charcoal: {
      bodyBg: '#09090B',
      cardBg: '#1C1C1E',
      border: '#3F3F46',
      textMain: '#FAFAFA',
      textMuted: '#A1A1AA',
      accentRed: '#FF453A',
      accentStamp: 'rgba(255, 69, 58, 0.15)',
      highlight: '#27272A',
    }
  };

  const t = themes[themeName] || themes.cream;

  // Render viewpoints list
  const viewpointsHtml = (data.mainEpisode.viewpoints || [])
    .map((view, i) => `
      <li class="viewpoint-item">
        <span class="viewpoint-no">0${i + 1}</span>
        <span class="viewpoint-text">${view}</span>
      </li>
    `).join('');

  // Render golden quotes
  const quotesHtml = (data.mainEpisode.goldenQuotes || [])
    .map(q => `
      <div class="quote-box">
        <div class="quote-mark">“</div>
        <div class="quote-text">${q.quote}</div>
        <div class="quote-source">— ${q.source}</div>
      </div>
    `).join('');

  // Render backup episodes
  const backupsHtml = data.backupEpisodes.map((ep, i) => `
    <a href="${ep.href || '#'}" class="backup-card" target="_blank" rel="noopener noreferrer">
      <div class="backup-header">
        <span class="backup-scenario">${ep.scenario || ''}</span>
        <span class="backup-tag">${ep.triageTag || ''}</span>
      </div>
      
      <div class="backup-body">
        <div class="backup-cover" style="background: ${ep.coverBg.includes('#') ? ep.coverBg : '#2D3139'};">
          <span>${ep.coverText || ep.podcastName.substring(0, 2)}</span>
        </div>
        <div class="backup-info">
          <div class="backup-podcast">${ep.podcastName}</div>
          <div class="backup-title">${ep.episodeTitle}</div>
        </div>
      </div>
    </a>
  `).join('');

  const synthesisHtml = data.synthesis
    ? 'body' in data.synthesis
      ? `
    <div class="synthesis-card">
      <div class="synthesis-item">
        <span class="bullet">${data.synthesis.type === 'consensus' ? '●' : '▲'}</span>
        <p>${data.synthesis.title}<br>${data.synthesis.body}</p>
      </div>
    </div>
      `
      : `
    <div class="synthesis-card">
      <div class="synthesis-grid">
        <div class="synthesis-col">
          <div class="col-title">
            <span>选题共识</span>
            <span class="sub">Consensus</span>
          </div>
          ${data.synthesis.consensus
            .map(c => `<div class="synthesis-item"><span class="bullet">●</span><p>${c}</p></div>`)
            .join('')}
        </div>
        
        <div class="synthesis-col">
          <div class="col-title">
            <span>交锋分歧</span>
            <span class="sub">Divergence</span>
          </div>
          ${data.synthesis.divergence
            .map(d => `<div class="synthesis-item"><span class="bullet">▲</span><p>${d}</p></div>`)
            .join('')}
        </div>
      </div>
    </div>
      `
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>播客选题简报 - ${data.dateStr}</title>
  <style>
    /* Google Fonts Import for high typography fidelity offline fallback */
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Noto+Serif+SC:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');

    /* CSS CSS Reset & Base styling */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: ${t.bodyBg};
      color: ${t.textMain};
      font-family: "Inter", "Helvetica Neue", -apple-system, sans-serif;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Container */
    .container {
      width: 100%;
      max-width: 680px;
      margin: 0 auto;
    }

    /* Card Wrapper with tear-off design */
    .calendar-card {
      background-color: ${t.cardBg};
      border: 8px solid ${t.border};
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
      position: relative;
      margin-bottom: 24px;
      overflow: hidden;
    }

    /* Tear off dots header pattern */
    .tear-margin {
      height: 14px;
      border-bottom: 2px solid ${t.border};
      display: flex;
      justify-content: space-around;
      background-color: rgba(0,0,0,0.03);
      padding: 0 10px;
    }
    .tear-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: ${t.bodyBg};
      margin-top: 4px;
      border: 1px solid ${t.border};
    }

    /* Card Padding Section */
    .card-content {
      padding: 32px 36px;
      position: relative;
    }

    /* Chinese Stamp Sign */
    .editorial-seal {
      position: absolute;
      top: 32px;
      right: 36px;
      border: 1.5px solid ${t.accentRed};
      color: ${t.accentRed};
      font-family: "Noto Serif SC", serif;
      font-weight: 700;
      font-size: 11px;
      line-height: 1.1;
      padding: 6px 4px;
      letter-spacing: 2px;
      text-orientation: upright;
      writing-mode: vertical-rl;
      user-select: none;
      opacity: 0.85;
      transform: rotate(-1deg);
      background-color: ${t.accentStamp};
    }

    /* Calendar Date Header */
    .card-header {
      margin-bottom: 30px;
      border-bottom: 1px solid ${t.border};
      padding-bottom: 16px;
    }

    .date-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 12px;
    }

    .main-date {
      font-family: "Playfair Display", Georgia, serif;
      font-size: 38px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.5px;
    }

    .issue-tag {
      font-family: "Inter", monospace;
      font-weight: 600;
      font-size: 11px;
      letter-spacing: 1px;
      color: ${t.textMuted};
      text-transform: uppercase;
    }

    .china-date {
      font-family: "Noto Serif SC", serif;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 2px;
      color: ${t.textMuted};
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge-today {
      border: 1px solid ${t.border};
      font-size: 11px;
      padding: 1px 6px;
      font-family: "Inter", sans-serif;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    /* Main Big Card */
    .main-item {
      display: block;
      color: inherit;
      text-decoration: none;
      margin-bottom: 24px;
    }

    /* Episode Branding banner */
    .branding-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .podcast-avatar {
      width: 24px;
      height: 24px;
      background-color: ${t.accentRed};
      color: #FFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      font-family: "Noto Serif SC", serif;
      border-radius: 2px;
    }

    .podcast-name {
      font-family: "Noto Serif SC", serif;
      font-weight: 750;
      font-size: 12px;
      letter-spacing: 1.5px;
      background-color: ${t.border};
      color: ${t.bodyBg};
      display: inline-block;
      padding: 3px 8px;
      text-transform: uppercase;
    }

    /* Title of single episode */
    .episode-headline {
      font-family: "Noto Serif SC", serif;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.45;
      margin-bottom: 14px;
      word-break: break-all;
    }

    /* Guest detail block */
    .guest-block {
      background-color: ${t.highlight};
      border-left: 3px solid ${t.border};
      padding: 12px 16px;
      margin-bottom: 24px;
    }

    .guest-title {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: ${t.textMuted};
      margin-bottom: 4px;
    }

    .guest-desc {
      font-size: 13.5px;
      font-weight: 500;
      color: ${t.textMain};
    }

    /* Custom Recommendation Banner */
    .recommend-box {
      margin-bottom: 28px;
      background-color: ${t.highlight};
      border-left: 3px solid ${t.accentRed};
      padding: 12px 16px;
    }
    .recommend-label {
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 1px;
      display: inline-block;
      margin-bottom: 4px;
      color: ${t.accentRed};
    }
    .recommend-text {
      font-size: 14px;
      color: ${t.textMuted};
      text-align: justify;
    }

    /* Viewpoints Block */
    .viewpoints-container {
      margin-bottom: 32px;
    }
    .section-title-alt {
      font-family: "Noto Serif SC", serif;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 1px;
      text-transform: uppercase;
      border-bottom: 1px solid ${t.border};
      padding-bottom: 6px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-title-alt .en {
      font-family: "Playfair Display", Georgia, serif;
      font-size: 11px;
      color: ${t.textMuted};
      font-weight: 400;
    }

    .viewpoint-list {
      list-style-type: none;
    }
    .viewpoint-item {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      align-items: flex-start;
    }
    .viewpoint-no {
      font-family: "Playfair Display", Georgia, serif;
      font-size: 14px;
      font-weight: 700;
      color: ${t.accentRed};
      margin-top: 1px;
    }
    .viewpoint-text {
      font-size: 14.5px;
      font-weight: 400;
      color: ${t.textMain};
      text-align: justify;
      flex: 1;
    }

    /* Golden quote style */
    .quote-box {
      border-top: 2px dashed ${t.border};
      padding: 24px 4px;
      background-color: transparent;
      margin-bottom: 28px;
      position: relative;
    }
    .quote-mark {
      font-family: "Playfair Display", Georgia, serif;
      font-size: 38px;
      color: ${t.accentRed};
      line-height: 1;
      height: 15px;
      margin-top: -8px;
    }
    .quote-text {
      font-family: "Noto Serif SC", serif;
      font-size: 17.5px;
      font-weight: 600;
      line-height: 1.6;
      margin-bottom: 12px;
      position: relative;
      z-index: 2;
    }
    .quote-source {
      font-size: 12px;
      font-weight: 700;
      color: ${t.textMuted};
      text-align: right;
    }

    /* Main Triage Tag Placement Row */
    .main-triage {
      display: flex;
      justify-content: flex-end;
      border-top: 1px solid ${t.border};
      padding-top: 16px;
    }
    .triage-badge {
      border: 1.5px solid ${t.border};
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background-color: ${t.cardBg};
    }

    /* Secondary backup grid */
    .backup-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }
    @media (max-width: 580px) {
      .backup-grid {
        grid-template-columns: 1fr;
      }
    }

    .backup-card {
      background-color: ${t.cardBg};
      border: 3px solid ${t.border};
      padding: 18px;
      display: block;
      color: inherit;
      text-decoration: none;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .backup-card:hover {
      box-shadow: 0 6px 16px rgba(0,0,0,0.06);
      transform: translateY(-1px);
    }
    .backup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 2px solid ${t.border};
      padding-bottom: 8px;
    }
    .backup-scenario {
      font-size: 11px;
      font-weight: 600;
      color: ${t.accentRed};
    }
    .backup-tag {
      font-size: 11px;
      border: 1px solid ${t.border};
      padding: 1px 4px;
      font-weight: 600;
    }
    .backup-body {
      display: flex;
      gap: 12px;
    }
    .backup-cover {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Noto Serif SC", serif;
      font-size: 11px;
      font-weight: 700;
      color: #FFF;
      flex-shrink: 0;
    }
    .backup-info {
      flex: 1;
      min-width: 0;
    }
    .backup-podcast {
      font-family: "Noto Serif SC", serif;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .backup-title {
      font-size: 12px;
      line-height: 1.4;
      font-weight: 400;
      color: ${t.textMuted};
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Cross-Episode Synthesis block (Consensus / Divergence) */
    .synthesis-card {
      background-color: ${t.border};
      color: ${t.cardBg};
      border: 8px solid ${t.border};
      padding: 24px 28px;
    }
    .synthesis-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 36px;
    }
    @media (max-width: 580px) {
      .synthesis-grid {
        grid-template-columns: 1fr;
        gap: 20px;
      }
    }

    .synthesis-col {
      display: flex;
      flex-direction: column;
    }
    .col-title {
      font-family: "Noto Serif SC", serif;
      font-size: 14.5px;
      font-weight: 700;
      letter-spacing: 1.5px;
      border-bottom: 2px solid ${themeName === 'charcoal' ? '#44444A' : 'rgba(255,255,255,0.25)'};
      padding-bottom: 6px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .col-title .sub {
      font-family: "Inter", sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: ${themeName === 'charcoal' ? t.textMuted : 'rgba(255,255,255,0.6)'};
    }
    .synthesis-item {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .synthesis-item .bullet {
      color: ${themeName === 'charcoal' ? t.accentRed : '#C8102E'};
      margin-top: 2px;
      font-size: 12px;
    }
    .synthesis-item p {
      font-size: 13.5px;
      color: ${themeName === 'charcoal' ? t.textMuted : 'rgba(255,255,255,0.85)'};
      text-align: justify;
      line-height: 1.6;
    }

    /* Print media rule */
    @media print {
      body {
        background-color: #FFF;
        padding: 0;
      }
      .calendar-card, .backup-card, .synthesis-card {
        box-shadow: none;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>

  <div class="container">
  
    <!-- Main Tear-off Calendar styled Card -->
    <div class="calendar-card">
      <div class="tear-margin">
        <div class="tear-dot"></div>
        <div class="tear-dot"></div>
        <div class="tear-dot"></div>
        <div class="tear-dot"></div>
        <div class="tear-dot"></div>
        <div class="tear-dot"></div>
        <div class="tear-dot"></div>
        <div class="tear-dot"></div>
        <div class="tear-dot"></div>
        <div class="tear-dot"></div>
        <div class="tear-dot"></div>
        <div class="tear-dot"></div>
      </div>
      
      <div class="card-content">
        <!-- Vertical stamp watermark -->
        <div class="editorial-seal">今日聽薦</div>
        
        <!-- Header -->
        <div class="card-header">
          <div class="date-row">
            <span class="main-date">${data.dateStr}</span>
            <span class="issue-tag">${data.issueNo}</span>
          </div>
          <div class="china-date">
            <span>${data.chinaDateStr}</span>
            <span class="badge-today">SELECTED</span>
          </div>
        </div>
        
        <!-- Main focus show links and title -->
        <a href="${data.mainEpisode.href || '#'}" class="main-item" target="_blank" rel="noopener noreferrer">
          <div class="branding-row">
            <div class="podcast-avatar">${data.mainEpisode.coverText || data.mainEpisode.podcastName.substring(0,1)}</div>
            <div class="podcast-name">${data.mainEpisode.podcastName}</div>
          </div>
          
          <h2 class="episode-headline">${data.mainEpisode.episodeTitle}</h2>
        </a>
        
        <!-- Speaker background if any -->
        ${data.mainEpisode.guestBackground ? `
        <div class="guest-block">
          <div class="guest-title">GUEST BACKGROUND / 嘉宾背景</div>
          <div class="guest-desc">${data.mainEpisode.guestBackground}</div>
        </div>
        ` : ''}
        
        <!-- Why Recommend -->
        ${data.mainEpisode.whyRecommended ? `
        <div class="recommend-box">
          <div class="recommend-label">推荐语</div>
          <p class="recommend-text">${data.mainEpisode.whyRecommended}</p>
        </div>
        ` : ''}
        
        <!-- Viewpoints -->
        <div class="viewpoints-container">
          <div class="section-title-alt">
            <span>核心观点</span>
            <span class="en">KEY INSIGHTS</span>
          </div>
          <ul class="viewpoint-list">
            ${viewpointsHtml}
          </ul>
        </div>
        
        <!-- Gold Quotation -->
        ${quotesHtml}
        
        <!-- Triage Tag -->
        <div class="main-triage">
          <div class="triage-badge">
            ${data.mainEpisode.triageTag}
          </div>
        </div>
        
      </div>
    </div>
    
    <!-- Backup grid -->
    <div class="backup-grid">
      ${backupsHtml}
    </div>
    
    <!-- Mutual divergence and consensus -->
    ${synthesisHtml}
    
  </div>

</body>
</html>
`;
}
