// Serves the embeddable widget script — loaded by the <script> tag business owners paste
// Returns JavaScript that injects a floating chat panel into the host page
// No auth required — public endpoint, org validated via slug

import { type NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgs, chatbots } from "@/lib/db/schema";
import { checkWidgetRateLimit } from "@/lib/redis";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get("org");
  const colorParam = searchParams.get("color");

  // Validate org slug — prevent injection via query param
  if (!orgSlug || !/^[a-zA-Z0-9_-]+$/.test(orgSlug)) {
    return new NextResponse("// Invalid org slug", {
      status: 400,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  // Rate limit by IP — widget route is public and unauthenticated
  // Prevents enumeration of org slugs and DB hammering
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1";
  const ipLimit = await checkWidgetRateLimit(ip, orgSlug);
  if (!ipLimit.success) {
    return new NextResponse("// Rate limit exceeded", {
      status: 429,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  // Verify org exists
  const [org] = await db
    .select({ id: orgs.id, slug: orgs.slug, name: orgs.name })
    .from(orgs)
    .where(eq(orgs.slug, orgSlug))
    .limit(1);

  if (!org) {
    return new NextResponse("// Org not found", {
      status: 404,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  // Fetch org image from Clerk — available on the Organization object
  // Falls back to null if Clerk API fails — widget shows initial letter instead
  let orgImageUrl: string | null = null;
  try {
    const client = await clerkClient();
    const clerkOrg = await client.organizations.getOrganization({
      organizationId: org.id,
    });
    orgImageUrl = clerkOrg.imageUrl ?? null;
  } catch {
    // Non-fatal — widget still works without the image
    orgImageUrl = null;
  }

  const [chatbot] = await db
    .select({
      accentColor: chatbots.accentColor,
      isActive: chatbots.isActive,
      name: chatbots.name,
    })
    .from(chatbots)
    .where(eq(chatbots.orgId, org.id))
    .limit(1);

  if (!chatbot?.isActive) {
    return new NextResponse("// Chatbot not active", {
      status: 404,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  // Use color from param if valid hex, otherwise fall back to saved color
  const accentColor =
    colorParam && /^#[0-9a-fA-F]{6}$/.test(colorParam)
      ? colorParam
      : chatbot.accentColor;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://kundesk.vercel.app";
  const chatUrl = `${appUrl}/chat/${org.slug}`;

  // Derive a lighter version of the accent for the panel header gradient
  // We pass it as a string — computed from the hex in JS below
  const script = `
(function() {
  'use strict';

  if (window.__kundesk_widget_loaded) return;
  window.__kundesk_widget_loaded = true;

  var CHAT_URL = ${JSON.stringify(chatUrl)};
  var COLOR = ${JSON.stringify(accentColor)};
  var BOT_NAME = ${JSON.stringify(chatbot.name)};
  var ORG_NAME = ${JSON.stringify(org.name)};
  var ORG_IMAGE = ${JSON.stringify(orgImageUrl)};
  var Z = 999999;
  var unreadCount = 0;
  var isOpen = false;
  var iframeLoaded = false;

  // ── Hex to RGB helper ──
  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1,3),16);
    var g = parseInt(hex.slice(3,5),16);
    var b = parseInt(hex.slice(5,7),16);
    return r + ',' + g + ',' + b;
  }
  var RGB = hexToRgb(COLOR);

  // ── Inject styles ──
  var style = document.createElement('style');
  style.textContent = [
    /* ── Button ── */
    '#kd-btn {',
    '  position:fixed; bottom:24px; right:24px;',
    '  width:60px; height:60px; border-radius:50%;',
    '  background:' + COLOR + ';',
    '  border:none; cursor:pointer;',
    '  z-index:' + Z + ';',
    '  box-shadow: 0 4px 24px rgba(' + RGB + ',0.45), 0 2px 8px rgba(0,0,0,0.15);',
    '  display:flex; align-items:center; justify-content:center;',
    '  opacity:0;',
    '  outline:none;',
    '  will-change:transform;',
    // No animation here — applied via JS after DOM ready
    '}',
    '#kd-btn.ready {',
    '  opacity:1;',
    '  transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease;',
    '}',
    '#kd-btn.ready:hover {',
    '  transform:scale(1.12);',
    '  box-shadow: 0 8px 32px rgba(' + RGB + ',0.6), 0 4px 12px rgba(0,0,0,0.2);',
    '}',
    '#kd-btn.ready:active { transform:scale(0.94); }',
    '#kd-btn:active { transform:scale(0.95); }',

    /* ── Button icon ── */
    '#kd-btn-icon {',
    '  width:26px; height:26px;',
    '  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s;',
    '  display:flex; align-items:center; justify-content:center;',
    '}',

    /* ── Pulse ring ── */
    '#kd-pulse {',
    '  position:fixed; bottom:24px; right:24px;',
    '  width:60px; height:60px; border-radius:50%;',
    '  background: rgba(' + RGB + ',0.35);',
    '  z-index:' + (Z-1) + ';',
    '  pointer-events:none;',
    '  animation: kd-pulse 2.5s ease-out infinite;',
    '}',

    /* ── Unread badge ── */
    '#kd-badge {',
    '  position:absolute; top:-3px; right:-3px;',
    '  min-width:20px; height:20px;',
    '  background:#ef4444;',
    '  border:2.5px solid white;',
    '  border-radius:100px;',
    '  font-size:10px; font-weight:800;',
    '  color:white;',
    '  display:none; align-items:center; justify-content:center;',
    '  padding:0 4px;',
    '  font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '  animation: kd-badge-pop 0.3s cubic-bezier(0.34,1.56,0.64,1);',
    '}',
    '#kd-badge.visible { display:flex; }',

    /* ── Panel ── */
    '#kd-panel {',
    '  position:fixed; bottom:96px; right:24px;',
    '  width:380px;',
    '  height:640px;',
    '  max-height:calc(100vh - 120px);',
    '  border-radius:20px;',
    '  overflow:hidden;',
    '  box-shadow: 0 24px 64px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06);',
    '  z-index:' + Z + ';',
    '  display:flex; flex-direction:column;',
    '  pointer-events:none;',
    '  opacity:0;',
    '  transform:translateY(20px) scale(0.95);',
    '  transform-origin: bottom right;',
    '  transition: opacity 0.3s cubic-bezier(0.22,1,0.36,1), transform 0.3s cubic-bezier(0.22,1,0.36,1);',
    '  background:#ffffff;',
    '}',
    '#kd-panel.open {',
    '  opacity:1;',
    '  transform:translateY(0) scale(1);',
    '  pointer-events:all;',
    '}',

    /* ── Panel header ── */
    '#kd-header {',
    '  padding:16px 18px 14px;',
    '  background: linear-gradient(135deg, ' + COLOR + ' 0%, rgba(' + RGB + ',0.85) 100%);',
    '  display:flex; align-items:center; gap:12px;',
    '  flex-shrink:0;',
    '  position:relative;',
    '  overflow:hidden;',
    '}',
    /* Decorative circles in header */
    '#kd-header::before {',
    '  content:"";',
    '  position:absolute; top:-20px; right:-20px;',
    '  width:100px; height:100px; border-radius:50%;',
    '  background:rgba(255,255,255,0.1);',
    '  pointer-events:none;',
    '}',
    '#kd-header::after {',
    '  content:"";',
    '  position:absolute; bottom:-30px; right:30px;',
    '  width:80px; height:80px; border-radius:50%;',
    '  background:rgba(255,255,255,0.07);',
    '  pointer-events:none;',
    '}',

    /* ── Avatar in header ── */
    '#kd-avatar {',
    '  width:40px; height:40px; border-radius:50%;',
    '  background:rgba(255,255,255,0.2);',
    '  border:2px solid rgba(255,255,255,0.4);',
    '  display:flex; align-items:center; justify-content:center;',
    '  font-size:18px; font-weight:800; color:white;',
    '  font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '  flex-shrink:0; position:relative; z-index:1;',
    '}',

    /* ── Header text ── */
    '#kd-header-text { flex:1; min-width:0; position:relative; z-index:1; }',
    '#kd-bot-name {',
    '  font-size:15px; font-weight:700; color:white;',
    '  font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '  letter-spacing:-0.01em; line-height:1.2;',
    '  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;',
    '}',
    '#kd-status {',
    '  display:flex; align-items:center; gap:5px;',
    '  font-size:11.5px; color:rgba(255,255,255,0.8);',
    '  font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '  margin-top:2px;',
    '}',
    '#kd-status-dot {',
    '  width:6px; height:6px; border-radius:50%;',
    '  background:#4ade80;',
    '  animation: kd-blink 2s ease-in-out infinite;',
    '  flex-shrink:0;',
    '}',
    '#kd-org-name {',
    '  font-size:11px; color:rgba(255,255,255,0.7);',
    '  font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
    '  margin-top:1px; margin-bottom:1px;',
    '  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;',
    '}',

    /* ── Close button ── */
    '#kd-close {',
    '  width:32px; height:32px; border-radius:50%;',
    '  background:rgba(255,255,255,0.15);',
    '  border:none; cursor:pointer;',
    '  display:flex; align-items:center; justify-content:center;',
    '  color:white; font-size:16px;',
    '  transition: background 0.2s, transform 0.2s;',
    '  flex-shrink:0; position:relative; z-index:1;',
    '}',
    '#kd-close:hover { background:rgba(255,255,255,0.25); transform:rotate(90deg); }',

    /* ── Iframe ── */
    '#kd-iframe {',
    '  flex:1; width:100%; border:none;',
    '  display:block;',
    '}',

    /* ── Keyframes ── */
    '@keyframes kd-pulse {',
    '  0%   { transform:scale(1);   opacity:0.6; }',
    '  70%  { transform:scale(1.7); opacity:0;   }',
    '  100% { transform:scale(1.7); opacity:0;   }',
    '}',
    '@keyframes kd-blink {',
    '  0%,100% { opacity:1; }',
    '  50%     { opacity:0.4; }',
    '}',
    '@keyframes kd-badge-pop {',
    '  from { transform:scale(0); }',
    '  to   { transform:scale(1); }',
    '}',

    /* ── Mobile ── */
    '@media (max-width:768px) {',
    '  #kd-panel {',
    '    width:100vw;',
    '    height:100vh;',
    '    max-height:100vh;',
    '    bottom:0; right:0;',
    '    border-radius:0;',
    // Slide up from bottom on mobile
    '    transform:translateY(100%);',
    '  }',
    '  #kd-panel.open {',
    '    transform:translateY(0);',
    '    opacity:1;',
    '  }',
    '  #kd-btn { bottom:16px; right:16px; }',
    '  #kd-pulse { bottom:16px; right:16px; }',
    '}',
  ].join('\\n');
  document.head.appendChild(style);

  // ── Build DOM ──

  // Pulse ring — sits behind the button
  var pulse = document.createElement('div');
  pulse.id = 'kd-pulse';
  document.body.appendChild(pulse);

  // Toggle button
  var btn = document.createElement('button');
  btn.id = 'kd-btn';
  btn.setAttribute('aria-label', 'Buka chat');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<div id="kd-btn-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/></svg></div>' +
    '<div id="kd-badge" aria-label="pesan belum dibaca"></div>';
  document.body.appendChild(btn);

  // Entrance animation via JS — avoids CSS animation conflicting with hover transforms
  // Start hidden (opacity:0 in CSS), then animate in, then add .ready to enable hover
  setTimeout(function() {
    btn.style.transition = 'opacity 0.3s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
    btn.style.transform = 'scale(0.5) translateY(20px)';
    // Force reflow so transition fires
    btn.offsetHeight;
    btn.style.opacity = '1';
    btn.style.transform = 'scale(1) translateY(0)';
    // After entrance completes, switch to hover-ready state
    setTimeout(function() {
      btn.style.transition = '';
      btn.style.transform = '';
      btn.style.opacity = '';
      btn.classList.add('ready');
    }, 500);
  }, 100);

  // Panel
  var panel = document.createElement('div');
  panel.id = 'kd-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Chat dengan ' + BOT_NAME);

  // Panel header — declared here, populated immediately, then appended to panel
  var header = document.createElement('div');
  header.id = 'kd-header';

  // Build header structure — text content set via textContent, never innerHTML
  // Avatar image set via setAttribute — prevents XSS via malicious ORG_IMAGE URL
  header.innerHTML =
    '<div id="kd-avatar"></div>' +
    '<div id="kd-header-text">' +
      '<div id="kd-bot-name"></div>' +
      '<div id="kd-org-name"></div>' +
      '<div id="kd-status"><div id="kd-status-dot"></div><span>Online — siap membantu</span></div>' +
    '</div>' +
    '<button id="kd-close" aria-label="Tutup chat">&#x2715;</button>';

  // Set text content safely — textContent never interprets HTML
  header.querySelector('#kd-bot-name').textContent = BOT_NAME;
  header.querySelector('#kd-org-name').textContent = ORG_NAME;

  // Set avatar safely — image via setAttribute, fallback via textContent
  var avatarEl = header.querySelector('#kd-avatar');
  if (ORG_IMAGE) {
    var img = document.createElement('img');
    img.setAttribute('src', ORG_IMAGE);
    img.setAttribute('alt', ORG_NAME);
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
    avatarEl.appendChild(img);
  } else {
    // textContent safely renders the first letter — no HTML interpretation
    avatarEl.textContent = BOT_NAME.charAt(0).toUpperCase();
  }

  panel.appendChild(header);

  // Iframe — lazy loaded on first open
  var iframe = document.createElement('iframe');
  iframe.id = 'kd-iframe';
  iframe.setAttribute('title', 'Chat ' + ORG_NAME);
  iframe.setAttribute('allow', 'microphone');
  panel.appendChild(iframe);

  document.body.appendChild(panel);

  // ── Badge helpers ──
  var badge = document.getElementById('kd-badge');

  function showBadge(count) {
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.classList.add('visible');
  }

  function clearBadge() {
    unreadCount = 0;
    badge.classList.remove('visible');
  }

  // ── Open / close ──
  function openWidget() {
    isOpen = true;
    panel.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Tutup chat');

    // Lock body scroll — prevents page scrolling behind the widget
    document.body.style.overflow = 'hidden';

    // Swap icon to X
    document.getElementById('kd-btn-icon').innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>';

    // Stop pulse while open
    pulse.style.animationPlayState = 'paused';
    pulse.style.opacity = '0';

    // Lazy load iframe
    if (!iframeLoaded) {
      iframe.src = CHAT_URL;
      iframeLoaded = true;
    }

    clearBadge();
    iframe.focus();
  }

  function closeWidget() {
    isOpen = false;
    panel.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Buka chat');

    // Restore body scroll
    document.body.style.overflow = '';

    // Swap icon back to chat bubble
    document.getElementById('kd-btn-icon').innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/></svg>';

    // Resume pulse
    pulse.style.animationPlayState = 'running';
    pulse.style.opacity = '';

    btn.focus();
  }

  btn.addEventListener('click', function() {
    if (isOpen) closeWidget(); else openWidget();
  });

  document.getElementById('kd-close').addEventListener('click', closeWidget);

  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isOpen) closeWidget();
  });

  // ── Unread badge via postMessage from iframe ──
  window.addEventListener('message', function(e) {
    // Only accept messages from our chat iframe
    if (!iframe.src || !e.origin) return;
    try {
      var origin = new URL(iframe.src).origin;
      if (e.origin !== origin) return;
    } catch(err) { return; }

    if (e.data && e.data.type === 'kundesk:new_message') {
      if (!isOpen) {
        unreadCount++;
        showBadge(unreadCount);
      }
    }
  });

})();
`.trim();

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // 5 minute cache — short enough for color/config changes to propagate
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
