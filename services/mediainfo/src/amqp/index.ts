import os from "os";
import { Channel, connect, Message } from "amqplib";

import { mediaingest } from "../proto/mediainfo";
import { ConsumeMessage } from "amqplib/properties";

export type MessageConsumer = (message: ConsumeMessage) => Promise<Uint8Array>;

const replyConsumer: MessageConsumer = async () => {
  return mediaingest.MediaInfo.encode({
    format: {
      name: "pong",
    },
  }).finish();
};

export function createConsumer(channel: Channel, consumer: MessageConsumer) {
  return async function consumerWrapper(message: Message | null): Promise<void> {
    if (message === null) {
      return;
    }

    try {
      const reply = await consumer(message);
      channel.publish("", message.properties.replyTo, Buffer.from(reply), {
        correlationId: message.properties.correlationId,
      });
      channel.ack(message);
    } catch (error) {
      console.error({ fields: message.fields, consumerName: consumer.name, error }, "Failed to consume message");
      channel.reject(message, false);
    }
  };
}

export async function setupAmqp(dsn: string): Promise<void> {
  const connection = await connect(dsn);
  const channel = await connection.createChannel();
  await channel.prefetch(1, false);

  const mediaInfoService = new mediaingest.MediaInfoService(() => {
    // noop
  });
  const queue = await channel.assertQueue(mediaInfoService.getMediaInfo.name);
  // await channel.bindQueue(queue.queue, "", mediaInfoService.getMediaInfo.name);

  await channel.consume(queue.queue, createConsumer(channel, replyConsumer), {
    consumerTag: os.hostname(),
  });
}
