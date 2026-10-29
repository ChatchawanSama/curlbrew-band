import { z } from "zod";

export const env = z.object({
  DATABASE_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  AWS_ENDPOINT_URL_S3: z.string().url().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default("ap-southeast-1"),
  S3_BUCKET: z.string().default("uploads"),
  CURLBREW_ADMIN_USERNAME: z.string().min(1).optional(),
  CURLBREW_ADMIN_PASSWORD: z.string().min(1).optional(),
  CURLBREW_SESSION_SECRET: z.string().min(32).optional(),
}).parse({ DATABASE_URL: process.env.DATABASE_URL, BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET, BETTER_AUTH_URL: process.env.BETTER_AUTH_URL, AWS_ENDPOINT_URL_S3: process.env.AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY, AWS_REGION: process.env.AWS_REGION, S3_BUCKET: process.env.S3_BUCKET, CURLBREW_ADMIN_USERNAME: process.env.CURLBREW_ADMIN_USERNAME, CURLBREW_ADMIN_PASSWORD: process.env.CURLBREW_ADMIN_PASSWORD, CURLBREW_SESSION_SECRET: process.env.CURLBREW_SESSION_SECRET });
