import { RPCImpl } from "protobufjs";
import { mediaingest } from "./proto/mediainfo";
import { connect } from "amqplib";

(async () => {
  const connection = await connect("amqp://localhost");
  try {
    const channel = await connection.createChannel();
    const replyQueue = await channel.assertQueue("", {
      exclusive: true,
    });

    const rpcCall: RPCImpl = async (method, requestData, callback) => {
      const correlationId = Math.random().toString(36).substring(2);

      await channel.consume(
        replyQueue.queue,
        (message) => {
          if (!message) {
            return console.log("empty message");
          }

          if (message.properties.correlationId !== correlationId) {
            return console.log("other correlation id", message.properties.correlationId);
          }

          console.log("rpc call response received");
          callback(null, Uint8Array.from(message.content));
        },
        {
          noAck: true,
        }
      );

      channel.sendToQueue(`${mediaingest.MediaInfoService.name}.${method.name}`, Buffer.from(requestData), {
        replyTo: replyQueue.queue,
        correlationId,
      });

      console.log("rpc call sent");
    };

    const service = new mediaingest.MediaInfoService(rpcCall);
    console.log("sending rpc call");
    const mediaInfo = await service.getMediaInfo({ source: "ping" });
    console.log(mediaInfo);
  } catch (e) {
    console.error(e);
    // } finally {
    //   await connection.close();
  }
})();
