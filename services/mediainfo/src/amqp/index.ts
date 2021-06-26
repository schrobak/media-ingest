import os from "os";
import { connect } from "amqplib";
import { mediaingest } from "../proto/mediainfo";

export async function setupAmqp(dsn: string): Promise<void> {
  const connection = await connect(dsn);
  const channel = await connection.createChannel();
  await channel.prefetch(1);

  const mediaInfoService = new mediaingest.MediaInfoService(() => {
    // noop
  });
  const queue = await channel.assertQueue(
    `${mediaingest.MediaInfoService.name}.${mediaInfoService.getMediaInfo.name}`,
    {
      durable: false,
    }
  );

  await channel.consume(
    queue.queue,
    (message) => {
      if (!message) {
        return console.log("empty message");
      }

      // get request
      const req = mediaingest.GetMediaInfoRequest.decode(Uint8Array.from(message.content));

      console.log(req);

      if (Math.random() < 0.5) {
        channel.sendToQueue(
          message.properties.replyTo,
          Buffer.from(
            mediaingest.MediaInfoError.encode({
              message: "Cannot get source media info",
            }).finish()
          ),
          {
            correlationId: message.properties.correlationId,
            type: mediaingest.MediaInfoError.name,
          }
        );
      } else {
        // prepare response
        const res = mediaingest.MediaInfo.encode({ format: { name: "pong" } }).finish();

        // send response
        channel.sendToQueue(message.properties.replyTo, Buffer.from(res), {
          correlationId: message.properties.correlationId,
          type: mediaingest.MediaInfo.name,
        });
      }

      channel.ack(message);
    },
    {
      consumerTag: os.hostname(),
    }
  );
}
