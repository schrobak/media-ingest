import { setupAmqp } from "./amqp";

(async () => {
  try {
    await setupAmqp("amqp://localhost");
  } catch (e) {
    console.error(e);
  }
})();
