import { RPCImpl } from "protobufjs";
import { mediaingest } from "./proto/mediainfo";
import { connect } from "amqplib";

(async () => {
  const connection = await connect("amqp://localhost");
  try {
    const channel = await connection.createChannel();

    const rpc: RPCImpl = async (method, requestData, callback) => {
      const correlationId = Math.random().toString(36).substring(2);
      const replyQueue = await channel.assertQueue("", {
        exclusive: true,
      });
      await channel.consume(replyQueue.queue, (message) => {
        if (!message) {
          return console.error("empty message");
        }

        if (message.properties.correlationId !== correlationId) {
          return console.error("other correlation id", message.properties.correlationId);
        }

        console.debug(message.content.toString());
        callback(null, Uint8Array.from(message.content));
        channel.ack(message);
      });

      channel.publish("", method.name, Buffer.from(requestData), {
        replyTo: replyQueue.queue,
        correlationId,
      });
    };

    const service = new mediaingest.MediaInfoService(rpc);
    const mediaInfo = await service.getMediaInfo({ source: "ping" });
    console.log(mediaInfo);
  } catch (e) {
    console.error(e);
  } finally {
    await connection.close();
  }
})();
