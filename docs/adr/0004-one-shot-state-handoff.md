---
status: accepted
date: 2026-10-19
---

# 4. One-Shot State Handoff without Backend Synchronization

## Context

Readers frequently want to switch between reading on desktop and mobile (or tablet). In typical modern web and mobile applications, cross-device reading is implemented via centralized backend services, cloud databases, user accounts, and real-time websocket synchronization.

However, Zenolet is architected as a sovereign, serverless, static-only web application with no database, no user accounts, and zero server infrastructure beyond a lightweight stateless Cloudflare Worker CORS proxy.

This creates two key architectural realities:

1. **One-Shot Snapshot**: Without a central database, continuous synchronization is impossible. Transferring state across devices transfers a point-in-time coordinate snapshot. Once imported onto a second device, reading positions on both devices naturally diverge.
2. **Payload vs. File Transfer**: The QR code and URL payload (`#s=...`) encode only lightweight reading coordinates (book ID, chapter index, intra-chapter progress fraction, and theme/font preferences). The actual EPUB archive and illustrations are not transferred through the QR code; the receiving device must download and cache the book online upon first opening unless that device already cached that book.

## Decision

1. **One-Shot State Handoff Model**: Formally define and present the cross-device handoff feature as a **One-Shot State Handoff**, rather than synchronization ("sync") or file transfer.
2. **Explicit User Communication**:
   - Rename user-facing entry points to **"Continue Reading on Another Device"** (with a standard **Share** toolbar action).
   - Display clear explanatory notices in the handoff dialog and about documentation stating that positions track independently after handoff and that the receiving device requires an internet connection to fetch the book if not already cached.
3. **One-Click URL Sharing**: Supplement the visual QR code with an integrated "Copy Link" action so users transferring to other desktops or laptops can easily copy the handoff link.
4. **Stateless URL Payload Preserved**: Retain compressed deflate-raw base64url payloads (`#s=...`) via `fflate` as the sole transfer mechanism, preserving zero-backend privacy.

## Consequences

- User expectations are clear: readers understand that Zenolet is not a cloud-synced platform, avoiding confusion when positions diverge after reading on a second device.
- Eliminates user surprise when a receiving device requires an internet connection on first open.
- Preserves Zenolet's core identity as a 100% serverless, private, static application requiring zero databases, accounts, or ongoing hosting costs.
