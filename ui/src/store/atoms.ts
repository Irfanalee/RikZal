import { atom } from "jotai";
import type { MorningBrief, ConnectorStatus, NewsFeed } from "../lib/types";

export const briefAtom = atom<MorningBrief | null>(null);
export const connectorStatusAtom = atom<ConnectorStatus[]>([]);
export const sidebarCollapsedAtom = atom<boolean>(false);
export const personaAtom = atom<string>("Developer");
export const newsFeedAtom = atom<NewsFeed | null>(null);
