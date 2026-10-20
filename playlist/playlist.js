"use strict";
/*
 * A playlist shared from Nocturne travels in the link itself, after the "#":
 * {"v":2, "n": name, "t": [[title, artist, seconds, YouTube id or ""]]}, gzipped, base64url
 * (SharedPlaylist.java in the phone app). The part after "#" never leaves the browser, and this
 * page sends nothing anywhere: it reads the songs here and offers to open them in Nocturne.
 */

async function decodePlaylist(hash) {
  const data = String(hash || "").replace(/^#/, "");
  if (!/^[A-Za-z0-9_-]{16,}$/.test(data)) return null;
  try {
    const b64 = data.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((data.length + 3) % 4);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const o = JSON.parse(await new Response(stream).text());
    if (!o || typeof o.n !== "string" || !o.n.trim() || !Array.isArray(o.t)) return null;
    const tracks = o.t
      .filter((r) => Array.isArray(r) && typeof r[0] === "string" && r[0].trim())
      .slice(0, 500)
      .map((r) => ({ title: r[0], artist: typeof r[1] === "string" ? r[1] : "", seconds: typeof r[2] === "number" ? r[2] : 0 }));
    return tracks.length ? { name: o.n.trim(), tracks, data } : null;
  } catch (e) {
    return null;
  }
}

/** Nocturne's own link for the "Open in Nocturne" button; back to this page when it isn't installed. */
function appLink(data) {
  const back = location.href.split("#")[0].split("?")[0] + "?missing=1#" + data;
  return "intent://playlist?d=" + data + "#Intent;scheme=nocturne;package=app.nocturne.player;S.browser_fallback_url="
    + encodeURIComponent(back) + ";end";
}

function time(s) {
  if (!s) return "";
  s = Math.round(s);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

async function show() {
  const $ = (id) => document.getElementById(id);
  const pl = await decodePlaylist(location.hash);
  if (!pl) {
    $("name").textContent = "This link isn't complete";
    $("count").textContent = "Ask for the playlist to be shared again, and open the whole link.";
    return;
  }
  document.title = pl.name + " · Nocturne";
  $("name").textContent = pl.name;
  $("count").textContent = pl.tracks.length + (pl.tracks.length === 1 ? " song" : " songs");
  const android = /Android/i.test(navigator.userAgent);
  const missing = new URLSearchParams(location.search).has("missing");
  if (android) {
    const open = $("open");
    open.href = appLink(pl.data);
    open.hidden = false;
  }
  $("note").textContent = missing ? "Nocturne isn't on this phone. Once it is, tap the link again."
    : android ? "Opens the playlist in Nocturne, where you can get all of its songs."
    : "Open this link on an Android phone with Nocturne to get the playlist.";
  const list = $("songs");
  for (const t of pl.tracks) {
    const li = document.createElement("li");
    const words = document.createElement("div");
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = t.title;
    const artist = document.createElement("span");
    artist.className = "artist";
    artist.textContent = t.artist;
    words.append(title, artist);
    const len = document.createElement("span");
    len.className = "time";
    len.textContent = time(t.seconds);
    li.append(words, len);
    list.append(li);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", show);
  window.addEventListener("hashchange", () => location.reload());
}
if (typeof module !== "undefined") module.exports = { decodePlaylist };
