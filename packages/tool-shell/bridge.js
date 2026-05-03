(function () {
  var TOOL_ID = (document.currentScript && document.currentScript.getAttribute("data-tool-id")) || "unknown";

  function send(type, data) {
    window.parent.postMessage(Object.assign({ type: type, toolId: TOOL_ID }, data || {}), "*");
  }

  send("tool:ready", { url: window.location.href });

  window.addEventListener("message", function (e) {
    if (!e.data || !e.data.type) return;

    if (e.data.type === "shell:config") {
      var nameEl = document.getElementById("toolbox-tool-name");
      if (nameEl) nameEl.textContent = e.data.toolName || e.data.toolId || TOOL_ID;
      var ptsEl = document.getElementById("toolbox-points");
      if (ptsEl) ptsEl.textContent = (e.data.points || 0) + " pts";
      var freeEl = document.getElementById("toolbox-free-remaining");
      if (freeEl) freeEl.textContent = (e.data.freeRemaining || 0) + " free";
    }
  });

  window.toolbox = {
    uploadFile: function (file) {
      return new Promise(function (resolve) {
        send("tool:file:upload:request", {
          name: file.name,
          size: file.size,
          type: file.type,
        });
        window.addEventListener("message", function handler(e) {
          if (e.data && e.data.type === "shell:file:upload:url") {
            window.removeEventListener("message", handler);
            resolve(e.data.url);
          }
        });
      });
    },
    downloadFile: function (data, filename, mimeType) {
      var blob = new Blob([data], { type: mimeType || "application/octet-stream" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      send("tool:complete", { filename: filename });
    },
    complete: function (result) {
      send("tool:complete", { result: result });
    },
    error: function (message) {
      send("tool:error", { message: message });
    },
    resize: function (height) {
      send("tool:resize", { height: height });
    },
  };
})();
