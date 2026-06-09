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

module.exports = { pipeStream };
