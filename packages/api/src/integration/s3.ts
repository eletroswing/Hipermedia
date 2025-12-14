import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const s3 = new S3Client({
  endpoint: process.env.MINIO_URL ?? "http://localhost:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? "admin",
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? "admin123",
  },
  forcePathStyle: true,
});

export async function findRecordedFiles(bucket: string = "public") {
  const command = new ListObjectsV2Command({ Bucket: bucket });
  const response = await s3.send(command);

  const allKeys = response.Contents?.map(obj => obj.Key) || [];

  const regex = /^[^\/]+\/[^\/]+\/recorded\.m3u8$/;
  const matches = allKeys.filter(key => regex.test(key as string));

  const endpoint = process.env.MINIO_URL ?? "http://localhost:9000";
  const urls = matches.map(key => `${endpoint}/${bucket}/${key}`);

  return urls;
}