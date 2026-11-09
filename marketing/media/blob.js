"use strict";
/*
 * 미디어 공개 주소 — Vercel Blob (공개 · 주소에 무작위 꼬리). Meta 등 플랫폼이 가져갈 HTTPS 주소가 필요할 때.
 * 열쇠 BLOB_READ_WRITE_TOKEN 은 GitHub Secrets / 이 PC 의 marketing/.env.local 에만.
 * Hobby 포함분: 저장 1GB · 전송 10GB · 업로드 2,000회 — 넘으면 30일 사용 불가 → 게시 후 30일 지나면 지운다(PHASE 10 정리).
 */
const fs = require("fs");
const path = require("path");

function createBlobMedia({ token = process.env.BLOB_READ_WRITE_TOKEN, prefix = "mkt" } = {}) {
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN 이 없습니다.");
  const { put, del } = require("@vercel/blob");
  return {
    async put(file, { contentId, folder = "contents" } = {}) {
      const name = `${prefix}/${folder}/${contentId || "misc"}/${path.basename(file.path)}`;
      const r = await put(name, fs.createReadStream(file.path), { access: "public", token, contentType: file.contentType, addRandomSuffix: true, multipart: fs.statSync(file.path).size > 50 * 1024 * 1024 });
      return { url: r.url, blobPath: r.pathname };
    },
    remove: (url) => del(url, { token }),
  };
}

module.exports = { createBlobMedia };
