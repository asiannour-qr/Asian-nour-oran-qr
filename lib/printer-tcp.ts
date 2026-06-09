import net from "net";

const CONNECT_TIMEOUT_MS = 5000;
const WRITE_TIMEOUT_MS = 5000;

export async function sendEscPosToPrinter(ip: string, port: number, payload: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      socket.end();
      resolve();
    };

    socket.setTimeout(CONNECT_TIMEOUT_MS);

    socket.once("timeout", () => {
      fail(new Error("Délai dépassé lors de la connexion à l'imprimante"));
    });

    socket.once("error", (err) => {
      fail(err instanceof Error ? err : new Error(String(err)));
    });

    socket.connect(port, ip, () => {
      socket.setTimeout(WRITE_TIMEOUT_MS);
      socket.write(payload, (writeErr) => {
        if (writeErr) {
          fail(writeErr);
          return;
        }
        succeed();
      });
    });
  });
}
