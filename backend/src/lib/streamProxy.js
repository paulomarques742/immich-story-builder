const axios = require('axios');

// Margem abaixo do limite de 32 MiB do Cloud Run para respostas com Content-Length.
const CLOUD_RUN_BUFFER_LIMIT = 31 * 1024 * 1024;

// Faz pipe de uma resposta-stream do Immich (axios responseType: 'stream')
// para res, tratando o cancelamento do cliente e erros de stream sem derrubar
// o processo. Sem isto, um <video> que cancela pedidos Range a meio faz o
// stream upstream emitir 'error' sem listener → exceção não tratada → crash.
function pipeStream(req, res, upstream) {
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    upstream.data.destroy();
  };

  // Erro vindo do Immich (ou ligação reposta a meio do stream).
  upstream.data.on('error', (err) => {
    cleanup();
    if (!res.headersSent) {
      res.status(502).end();
    } else {
      res.destroy();
    }
  });

  // Cliente cancelou / fechou a ligação (seek de vídeo, navegação, etc.).
  res.on('close', cleanup);

  upstream.data.pipe(res);
}

// Faz proxy do stream de vídeo do Immich para res. Tenta primeiro o stream
// transcodificado web-friendly (/video/playback); se o Immich falhar (ex.:
// transcoding desativado/incompleto → 500), cai para o ficheiro /original
// (vídeos de telemóvel são h264/mp4 e o browser reproduz nativamente).
// Regista o erro real para os logs do Cloud Run.
async function proxyImmichVideo(req, res, { baseURL, apiKey, assetId }) {
  const headers = { 'x-api-key': apiKey };
  if (req.headers.range) headers['Range'] = req.headers.range;
  const get = (path) =>
    axios.get(`${baseURL}/api/assets/${assetId}/${path}`, { headers, responseType: 'stream' });

  let response;
  try {
    response = await get('video/playback');
  } catch (err) {
    console.error(`[video] playback ${assetId}: ${err.response?.status || err.code || err.message} — fallback /original`);
    try {
      response = await get('original');
    } catch (err2) {
      console.error(`[video] original ${assetId}: ${err2.response?.status || err2.code || err2.message}`);
      if (!res.headersSent) res.status(err2.response?.status || 502).end();
      return;
    }
  }

  forwardStreamHeaders(res, response);
  pipeStream(req, res, response);
}

// Reencaminha status + headers de uma resposta-stream do Immich.
// Cloud Run rejeita respostas com Content-Length > 32 MiB ("Response size was
// too large"). Só reencaminhamos o Content-Length para respostas pequenas (que
// o iOS/Safari preferem); acima do limite omitimos → Express envia em
// Transfer-Encoding: chunked, que o Cloud Run faz stream sem limite.
function forwardStreamHeaders(res, response) {
  res.status(response.status);
  for (const h of ['content-type', 'content-range', 'accept-ranges']) {
    if (response.headers[h]) res.setHeader(h, response.headers[h]);
  }
  const len = Number(response.headers['content-length']);
  if (Number.isFinite(len) && len <= CLOUD_RUN_BUFFER_LIMIT) {
    res.setHeader('content-length', response.headers['content-length']);
  }
}

module.exports = { pipeStream, proxyImmichVideo, forwardStreamHeaders };
