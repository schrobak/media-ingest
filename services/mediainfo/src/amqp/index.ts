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

      // prepare response
      const res = mediaingest.MediaInfo.encode({ format: { name: "pong" } }).finish();

      // send response
      channel.sendToQueue(message.properties.replyTo, Buffer.from(res), {
        correlationId: message.properties.correlationId,
      });
      channel.ack(message);
    },
    {
      consumerTag: os.hostname(),
    }
  );
}
