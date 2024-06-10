document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const terminalContainer = document.getElementById("terminal-container");
  const xterm = new Terminal();
  xterm.open(terminalContainer);

  socket.on("output", (data) => {
    xterm.write(data);
  });

  xterm.onKey(e => {
    const input = e.key;
    socket.emit("input", input);
  });

  socket.on("photorec-output", (data) => {
    xterm.write(data);
  });

  window.addEventListener("resize", () => {
    const cols = xterm.cols;
    const rows = xterm.rows;
    socket.emit("resize", { cols, rows });
  });
});
