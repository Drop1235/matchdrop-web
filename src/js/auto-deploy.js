/*
  auto-deploy.js
  --------------
  Netlify API で dist-web ディレクトリを ZIP 化してワンクリック公開するユーティリティ。
  Electron (nodeIntegration=true) のレンダラーから呼び出す想定。
*/

const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const NETLIFY_API_URL = 'https://api.netlify.com/api/v1/sites';

/**
 * distPath 以下を zip 化して Netlify へデプロイ
 * @param {Object} opts
 * @param {string} opts.accessToken - Netlify Personal Access Token
 * @param {string} opts.siteId - Netlify Site ID
 * @param {string} [opts.distPath] - デプロイするディレクトリ (既定: dist-web)
 */
async function deployToNetlify({ accessToken, siteId, distPath = path.join(__dirname, '..', '..', 'dist-web') }) {
  if (!accessToken || !siteId) throw new Error('NetlifyアクセストークンまたはSite IDが未設定です');
  if (!fs.existsSync(distPath)) throw new Error(`ディレクトリが存在しません: ${distPath}`);

  // 1. Zip 作成
  const zip = new AdmZip();
  zip.addLocalFolder(distPath);
  const zipBuffer = zip.toBuffer();

  // 2. multipart/form-data
  const form = new FormData();
  form.append('file', zipBuffer, { filename: 'deploy.zip', contentType: 'application/zip' });

  // 3. Netlify API 呼び出し
  const res = await fetch(`${NETLIFY_API_URL}/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...form.getHeaders(),
    },
    body: form
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Netlifyデプロイ失敗: ${res.status} ${text}`);
  }

  return res.json();
}

module.exports = { deployToNetlify };


