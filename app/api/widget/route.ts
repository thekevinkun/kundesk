// Serves the embeddable widget script — loaded by the <script> tag business owners paste
// Returns JavaScript that injects a chat iframe into the host page
// No auth required — public endpoint, org validated via data-org attribute

import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgs, chatbots } from "@/lib/db/schema";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Read org slug and accent color from script tag data attributes
  // These are set by the business owner when they paste the embed code
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

  // Verify org exists and has an active chatbot — don't serve widget for invalid orgs
  const [org] = await db
    .select({ id: orgs.id, slug: orgs.slug })
    .from(orgs)
    .where(eq(orgs.slug, orgSlug))
    .limit(1);

  if (!org) {
    return new NextResponse("// Org not found", {
      status: 404,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  const [chatbot] = await db
    .select({ accentColor: chatbots.accentColor, isActive: chatbots.isActive })
    .from(chatbots)
    .where(eq(chatbots.orgId, org.id))
    .limit(1);

  if (!chatbot?.isActive) {
    return new NextResponse("// Chatbot not active", {
      status: 404,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  // Use color from data attribute if valid hex, otherwise fall back to chatbot's saved color
  const accentColor =
    colorParam && /^#[0-9a-fA-F]{6}$/.test(colorParam)
      ? colorParam
      : chatbot.accentColor;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kundesk.vercel.app";
  const chatUrl = `${appUrl}/chat/${org.slug}`;

  // Generate the widget script — self-contained IIFE, no dependencies
  // Injects a floating button + iframe into the host page
  const script = `
(function() {
  'use strict';

  // Prevent double-initialization if script is loaded twice
  if (window.__kundesk_widget_loaded) return;
  window.__kundesk_widget_loaded = true;

  var CHAT_URL = ${JSON.stringify(chatUrl)};
  var COLOR = ${JSON.stringify(accentColor)};
  var Z_INDEX = 999999;

  // ── Styles ──
  var style = document.createElement('style');
  style.textContent = [
    '#kundesk-widget-btn {',
    '  position: fixed;',
    '  bottom: 24px;',
    '  right: 24px;',
    '  width: 56px;',
    '  height: 56px;',
    '  border-radius: 50%;',
    '  background: ' + COLOR + ';',
    '  border: none;',
    '  cursor: pointer;',
    '  z-index: ' + Z_INDEX + ';',
    '  box-shadow: 0 4px 20px rgba(0,0,0,0.2);',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  transition: transform 0.2s, box-shadow 0.2s;',
    '  font-size: 24px;',
    '  line-height: 1;',
    '}',
    '#kundesk-widget-btn:hover {',
    '  transform: scale(1.08);',
    '  box-shadow: 0 8px 28px rgba(0,0,0,0.25);',
    '}',
    '#kundesk-widget-iframe-wrap {',
    '  position: fixed;',
    '  bottom: 92px;',
    '  right: 24px;',
    '  width: 380px;',
    '  height: 600px;',
    '  max-height: calc(100vh - 120px);',
    '  border-radius: 20px;',
    '  overflow: hidden;',
    '  box-shadow: 0 12px 48px rgba(0,0,0,0.18);',
    '  z-index: ' + Z_INDEX + ';',
    '  display: none;',
    '  transition: opacity 0.25s, transform 0.25s;',
    '  opacity: 0;',
    '  transform: translateY(12px) scale(0.97);',
    '}',
    '#kundesk-widget-iframe-wrap.open {',
    '  display: block;',
    '}',
    '#kundesk-widget-iframe-wrap.visible {',
    '  opacity: 1;',
    '  transform: translateY(0) scale(1);',
    '}',
    '#kundesk-widget-iframe {',
    '  width: 100%;',
    '  height: 100%;',
    '  border: none;',
    '}',
    '@media (max-width: 480px) {',
    '  #kundesk-widget-iframe-wrap {',
    '    width: calc(100vw - 16px);',
    '    height: calc(100vh - 100px);',
    '    bottom: 80px;',
    '    right: 8px;',
    '    border-radius: 14px;',
    '  }',
    '}',
  ].join('\\n');
  document.head.appendChild(style);

  // ── Toggle button ──
  var btn = document.createElement('button');
  btn.id = 'kundesk-widget-btn';
  btn.setAttribute('aria-label', 'Buka chat');
  btn.innerHTML = '💬';
  document.body.appendChild(btn);

  // ── iframe wrapper ──
  var wrap = document.createElement('div');
  wrap.id = 'kundesk-widget-iframe-wrap';

  // ── iframe — lazy loaded on first open ──
  var iframe = document.createElement('iframe');
  iframe.id = 'kundesk-widget-iframe';
  iframe.setAttribute('title', 'Kundesk Chat');
  iframe.setAttribute('allow', 'microphone; camera');
  // src set on first open — avoids loading the chat page until user clicks
  wrap.appendChild(iframe);
  document.body.appendChild(wrap);

  var isOpen = false;
  var iframeLoaded = false;

  function openWidget() {
    isOpen = true;
    btn.innerHTML = '✕';
    btn.setAttribute('aria-label', 'Tutup chat');

    // Lazy load iframe — only on first open
    if (!iframeLoaded) {
      iframe.src = CHAT_URL;
      iframeLoaded = true;
    }

    wrap.classList.add('open');
    // Small delay so display:block is painted before opacity transition starts
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        wrap.classList.add('visible');
      });
    });
  }

  function closeWidget() {
    isOpen = false;
    btn.innerHTML = '💬';
    btn.setAttribute('aria-label', 'Buka chat');
    wrap.classList.remove('visible');

    // Wait for transition before hiding — keeps animation smooth
    setTimeout(function() {
      if (!isOpen) wrap.classList.remove('open');
    }, 260);
  }

  btn.addEventListener('click', function() {
    if (isOpen) closeWidget();
    else openWidget();
  });

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isOpen) closeWidget();
  });
})();
`.trim();

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Cache for 5 minutes — short enough that color/config changes propagate quickly
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
