import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs";

export const s3 = new S3Client({
  endpoint: process.env.MINIO_URL ?? "http://localhost:9000",
  region: "us-east-1", // precisa definir uma região, mesmo usando MinIO
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? "admin",
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? "admin123",
  },
  forcePathStyle: true, // equivalente ao s3ForcePathStyle
});

export async function uploadFile(path: string, name: string): Promise<string> {
  const bucketName = process.env.MINIO_BUCKET ?? "public";
  const buffer = fs.readFileSync(path);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: name,
      Body: buffer,
      ACL: "public-read", // funciona com MinIO configurado para ACL
    })
  );

  return `${process.env.FILES_URL ?? "http://localhost:9000"}/${bucketName}/${name}`;
}
