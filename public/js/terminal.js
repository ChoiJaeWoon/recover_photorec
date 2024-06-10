document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const terminalContainer = document.getElementById("terminal-container");
  const term = new Terminal();
  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalContainer);
  fitAddon.fit();

  socket.on("photorec-output", (data) => {
    term.write(data);
  });

  term.onKey(e => {
    const input = e.key;
    socket.emit("input", input);
  });

  window.addEventListener("resize", () => {
    fitAddon.fit();
    socket.emit("resize", { cols: term.cols, rows: term.rows });
  });

  // Fit terminal initially
  fitAddon.fit();
  socket.emit("resize", { cols: term.cols, rows: term.rows });
});
