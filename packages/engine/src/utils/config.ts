import EventEmitter from "node:events";
import { broadcast } from "@/lib/broadcast";

export const broadcasts = new Map<string, ReturnType<typeof broadcast>>()
export const eventEmitter = new EventEmitter()